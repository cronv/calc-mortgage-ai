<?php
declare(strict_types=1);

// ==================== НАСТРОЙКИ ====================
$TARGET_BASE = 'http://95.165.83.241:8080';   // куда проксируем
$TIMEOUT     = 30;                            // таймаут в секундах
$FOLLOW      = true;                          // следовать редиректам
$fileCached  = __DIR__ . DIRECTORY_SEPARATOR . 'cached';
$fileHeaders  = __DIR__ . DIRECTORY_SEPARATOR . 'headers';

if (file_exists($fileCached)) {
    $cached = file_get_contents($fileCached);
    $forwardHeaders = [];

    if (file_exists($fileHeaders)) {
        $forwardHeaders = file_get_contents($fileHeaders);
        foreach (json_decode($forwardHeaders, true) as $h) {
            header($h, true);
        }
    }
    header('Content-Length: ' . strlen($cached));
    echo $cached;
    exit;
}

// Динамическое определение протокола и хоста (вместо хардкода my.ru)
$PROTO = 'https';
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
    $PROTO = strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']);
} elseif (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    $PROTO = 'https';
} elseif (isset($_SERVER['REQUEST_SCHEME'])) {
    $PROTO = strtolower($_SERVER['REQUEST_SCHEME']);
}
$CURRENT_HOST = $PROTO . '://' . ($_SERVER['HTTP_HOST'] ?? 'my.ru');

// ==================== ПОДГОТОВКА ЗАПРОСА ====================
$requestUri  = $_SERVER['REQUEST_URI'] ?? '/';
$targetUrl   = rtrim($TARGET_BASE, '/') . $requestUri;

$clientHeaders = [];
$skipHeaders   = [
    'host', 'connection', 'keep-alive', 'transfer-encoding',
    'te', 'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate',
    'accept-encoding', // ВАЖНО: убираем, чтобы target не слал Brotli/zstd, которые curl может не декодировать
];

foreach ($_SERVER as $key => $value) {
    if (str_starts_with($key, 'HTTP_')) {
        $name  = str_replace('_', '-', strtolower(substr($key, 5)));
        if (!in_array($name, $skipHeaders, true)) {
            $clientHeaders[] = ucfirstWords($name) . ': ' . $value;
        }
    }
}

// Перезаписываем Host на целевой
$targetHost = parse_url($TARGET_BASE, PHP_URL_HOST);
$targetPort = parse_url($TARGET_BASE, PHP_URL_PORT);
$clientHeaders[] = 'Host: ' . $targetHost . ($targetPort ? ':' . $targetPort : '');

// Явно просим у target только gzip/deflate (curl их гарантированно распакует)
$clientHeaders[] = 'Accept-Encoding: gzip, deflate';

// Передаем оригинальный хост, чтобы target (например, Vite/Next.js) не блокировал запрос и не отдавал fallback
$clientHeaders[] = 'X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? '');
$clientHeaders[] = 'X-Forwarded-Proto: ' . $PROTO;

$body = file_get_contents('php://input');

// ==================== ВЫПОЛНЕНИЕ ЗАПРОСА ====================
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL            => $targetUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER         => true,
    CURLOPT_FOLLOWLOCATION => $FOLLOW,
    CURLOPT_MAXREDIRS      => 10,
    CURLOPT_TIMEOUT        => $TIMEOUT,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_CUSTOMREQUEST  => $_SERVER['REQUEST_METHOD'],
    CURLOPT_HTTPHEADER     => $clientHeaders,
    CURLOPT_USERAGENT      => $_SERVER['HTTP_USER_AGENT'] ?? 'Proxy/1.0',
    CURLOPT_ENCODING       => '', // Авто-декомпрессия gzip/deflate

    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
]);

if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'PATCH'], true) && $body !== '') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);

if ($response === false) {
    $err = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Proxy error: $err";
    exit;
}

$httpCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize  = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

// ==================== РАЗБОР ОТВЕТА ====================
$rawHeaders = substr($response, 0, $headerSize);
$respBody   = substr($response, $headerSize);

$headerBlocks = preg_split('/\r\n\r\n/', trim($rawHeaders));
$lastBlock    = end($headerBlocks);
$lines        = preg_split('/\r\n/', $lastBlock);
array_shift($lines);

$skipResp = [
    'transfer-encoding', 'connection', 'keep-alive',
    'content-encoding', 'content-length',
];

$forwardHeaders = [];
foreach ($lines as $line) {
    if ($line === '') continue;
    [$name, $value] = explode(':', $line, 2) + [1 => ''];
    $lname = strtolower($name);
    if (in_array($lname, $skipResp, true)) continue;

    if ($lname === 'location') {
        $value = str_ireplace($TARGET_BASE, $CURRENT_HOST, $value);
        $value = str_ireplace("http://$targetHost", $CURRENT_HOST, $value);
        $value = str_ireplace("https://$targetHost", $CURRENT_HOST, $value);
    }
    if ($lname === 'set-cookie') {
        $value = preg_replace('/\bdomain=[^;]+;?/i', '', $value);
        $value = preg_replace('/\bsecure\b/i', '', $value);
    }
    $forwardHeaders[] = $name . ':' . $value;
}

// ==================== РЕРАЙТ HTML ====================
$ctHeader = array_values(array_filter($forwardHeaders, fn($h) => str_starts_with(strtolower($h), 'content-type:')))[0] ?? '';
$isHtml   = stripos($ctHeader, 'text/html') !== false;

if ($isHtml && $respBody !== '') {
    $variants = ["$TARGET_BASE"];
    if ($targetPort) {
        $variants[] = "http://$targetHost:$targetPort";
        $variants[] = "https://$targetHost:$targetPort";
    }
    $variants[] = "http://$targetHost";
    $variants[] = "https://$targetHost";

    foreach (array_unique($variants) as $v) {
        $respBody = str_ireplace($v, $CURRENT_HOST, $respBody);
    }

    $respBody = preg_replace(
        '#(href|src|action)=["\']//' . preg_quote($targetHost, '#') . '(?::' . $targetPort . ')?#i',
        '$1="' . $CURRENT_HOST,
        $respBody
    );

    // На всякий случай заменяем base href, если он есть
    $respBody = preg_replace(
        '#<base\s+href=["\'][^"\']*["\']#i',
        '<base href="' . $CURRENT_HOST . '/"',
        $respBody
    );
}

// ==================== ОТДАЧА КЛИЕНТУ ====================
http_response_code($httpCode);
foreach ($forwardHeaders as $h) {
    header($h, true);
}
header('Content-Length: ' . strlen($respBody));

file_put_contents($fileHeaders, json_encode($forwardHeaders), FILE_APPEND | LOCK_EX);
file_put_contents($fileCached, $respBody, FILE_APPEND | LOCK_EX);
echo $respBody;
exit;

// ==================== УТИЛИТЫ ====================
function ucfirstWords(string $str): string {
    return implode('-', array_map('ucfirst', explode('-', $str)));
}
