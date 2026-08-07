<?php

// api.php — простой PHP-скрипт для отправки POST-запроса с JSON-данными без SSL верификации

// Получаем параметры из URL
$cost = $_GET['cost'] ?? null;
$down_payment = $_GET['down_payment'] ?? null;
$term = $_GET['term'] ?? null;
$property_type = $_GET['property_type'] ?? null;

if (empty($cost) || empty($down_payment) || empty($term) || empty($property_type)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing required parameters']);
    exit;
}

// Формируем JSON-тело
$data = [
    'cost' => (int)$cost,
    'down_payment' => (int)$down_payment,
    'term' => (int)$term,
    'property_type' => $property_type,
];

// Инициализируем cURL
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => 'http://95.165.83.241:8080/api/v1/calculator/match',
    CURLOPT_CUSTOMREQUEST => 'GET',
    CURLOPT_POSTFIELDS => json_encode($data),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($data_json = json_encode($data))
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => false, // Отключаем проверку SSL
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_FOLLOWLOCATION => false, // Не переходить по редиректам (если не нужно)
    // CURLOPT_TIMEOUT => 10, // Можно добавить таймаут если нужно
]);

// Отправляем запрос
$response = curl_exec($ch);

// Получаем информацию о запросе
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

// Ответ в зависимости от кода HTTP
if ($code >= 200 && $code < 300) {
    // Если ожидаем JSON-ответ
    header('Content-Type: application/json');
    echo $response; // Можно добавить декодирование и проверку, если нужно
} else {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Request failed', 'curl_error' => $err ?? 'Unknown error', 'http_code' => $code]);
}

?>
