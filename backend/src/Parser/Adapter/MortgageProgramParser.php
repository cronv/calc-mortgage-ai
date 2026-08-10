<?php

declare(strict_types=1);

namespace App\Parser\Adapter;

use App\Parser\AbstractProgramParser;

/**
 * Парсер для стандартной ипотеки (mortgage).
 * 
 * Анализ API banki.ru:
 * 1. GET /bff/catalog/api/v1/widget/group — возвращает список банков с программами
 *    Параметры:
 *    - pageType=CALCHYPOTHEC
 *    - productTypes[]=mortgage
 *    - requestedAmount, requestedTerm, initialFee — параметры калькулятора
 *    - regionId — регион (4 = Москва)
 *    - page, limit — пагинация
 * 
 * 2. GET /bff/catalog/api/v2/products?uids[]=... — детальная информация по продуктам
 *    uids[] — массив ID продуктов из первого запроса
 * 
 * UID формируется как: <bank_id><product_type_id>
 * Например: 1273406 где 12734 — bank_id, 06 — product_type_id (mortgage)
 */
class MortgageProgramParser extends AbstractProgramParser
{
    private const BASE_URL = 'https://www.banki.ru';
    private const WIDGET_GROUP_URL = 'https://www.banki.ru/bff/catalog/api/v1/widget/group';
    private const PRODUCTS_URL = 'https://www.banki.ru/bff/catalog/api/v2/products';

    /**
     * @var array<string, array> Кэш банковских данных (bank_id => bank_info)
     */
    private array $bankCache = [];

    public function getProductType(): string
    {
        return 'mortgage';
    }

    /**
     * Генератор: парсит ипотечные программы порционно.
     * 
     * @param int $limit Максимальное количество программ для возврата
     * @return \Generator<\App\Entity\BankProduct>
     */
    public function parse(int $limit = 100): \Generator
    {
        $page = 1;
        $perPage = 15;
        $count = 0;

        while ($count < $limit) {
            // Шаг 1: Получаем список продуктов с банка
            $widgetData = $this->fetchWidgetGroup($page, $perPage);

            if (empty($widgetData['offers']['items'])) {
                break; // Больше нет данных
            }

            // Собираем UIDs для детального запроса
            $uids = [];
            $offerMap = []; // uid => offer данные из виджета

            foreach ($widgetData['offers']['items'] as $bankGroup) {
                // Сохраняем информацию о банке в кэш
                if (isset($bankGroup['partnerData']['id'])) {
                    $this->bankCache[$bankGroup['partnerData']['id']] = $bankGroup['partnerData'];
                }

                $programs = $bankGroup['items'] ?? [];
                foreach ($programs as $program) {
                    if (!isset($program['uid'])) {
                        continue;
                    }

                    $uids[] = $program['uid'];
                    $offerMap[$program['uid']] = $program;

                    if (count($uids) >= 50) {
                        // Обрабатываем порцию UID'ов
                        yield from $this->processUidsBatch($uids, $offerMap, $limit, $count);
                        $count += count($uids);
                        $uids = [];
                        $offerMap = [];

                        if ($count >= $limit) {
                            break 2;
                        }
                    }
                }

                if ($count >= $limit) {
                    break;
                }
            }

            // Обрабатываем оставшиеся UID'ы
            if (!empty($uids)) {
                yield from $this->processUidsBatch($uids, $offerMap, $limit, $count);
                $count += count($uids);
            }

            $page++;

            // Проверка: если на странице меньше чем perPage, значит это последняя страница
            if (count($widgetData['offers']['items']) < $perPage) {
                break;
            }
        }
    }

    /**
     * Запрашивает данные виджета группы продуктов.
     */
    private function fetchWidgetGroup(int $page, int $limit): array
    {
        $queryParams = [
            'pageType' => 'CALCHYPOTHEC',
            'productTypes[]' => 'mortgage',
            'requestedAmount' => '1500000',
            'requestedTerm' => '20',
            'requestedTermUnit' => '7', // years
            'initialFee' => '2500000',
            'sort' => 'popular',
            'order' => 'desc',
            'page' => (string) $page,
            'limit' => (string) $limit,
            'isMulti' => 'false',
            'price' => '4000000',
            'regionId' => '4', // Москва
            'reason' => 'show_more',
        ];

        $url = self::WIDGET_GROUP_URL . '?' . http_build_query($queryParams);

        $response = $this->httpClient->request('GET', $url, [
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'application/json, text/plain, */*',
                'Accept-Language' => 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer' => 'https://www.banki.ru/services/calculators/hypothec/',
            ],
        ]);

        return $response->toArray();
    }

    /**
     * Запрашивает детальную информацию по продуктам и создаёт генератор BankProduct.
     *
     * @param array<string> $uids Список UID продуктов
     * @param array<string, array> $offerMap Маппинг uid => offer данные
     * @param int $limit Лимит всего продуктов
     * @param int $currentCount Текущее количество обработанных продуктов
     * @return \Generator<\App\Entity\BankProduct>
     */
    private function processUidsBatch(array $uids, array $offerMap, int $limit, int $currentCount): \Generator
    {
        if (empty($uids)) {
            return;
        }

        // Формируем запрос с uids[]
        $uidsQuery = http_build_query(array_map(fn($uid) => ['uids[]' => $uid], $uids), '', '&');
        $url = self::PRODUCTS_URL . '?' . $uidsQuery;

        $response = $this->httpClient->request('GET', $url, [
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'application/json, text/plain, */*',
                'Accept-Language' => 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            ],
        ]);

        $productsData = $response->toArray();
        $products = $productsData['products'] ?? [];

        foreach ($products as $product) {
            if ($currentCount + 1 > $limit) {
                break;
            }

            $bankProduct = $this->extractBankProduct($product, $offerMap);
            if ($bankProduct !== null) {
                yield $bankProduct;
            }

            $currentCount++;
        }
    }

    /**
     * Извлекает BankProduct из данных API.
     */
    private function extractBankProduct(array $product, array $offerMap): ?\App\Entity\BankProduct
    {
        $uid = $product['uid'] ?? null;
        if (!$uid) {
            return null;
        }

        $offer = $offerMap[$uid] ?? [];

        // Информация о банке
        $bankData = $product['partner'] ?? [];
        if (empty($bankData['id']) && isset($offer['partnerData']['id'])) {
            $bankId = $offer['partnerData']['id'];
            $bankData = $this->bankCache[$bankId] ?? $offer['partnerData'];
        }

        $bankName = $bankData['name'] ?? 'Неизвестный банк';
        $bankLogo = $bankData['logoUrl'] ?? $bankData['image'] ?? null;

        // Название программы
        $programName = $product['name'] ?? $offer['productName'] ?? 'Ипотека';

        // Ставка
        $rateMin = $product['rateFrom'] ?? $offer['rateFrom'] ?? 0;
        $rateMax = $product['rateTo'] ?? $offer['rateTo'] ?? $rateMin;

        // Сумма кредита
        $amountMin = $product['amountMin'] ?? null;
        $amountMax = $product['amountMax'] ?? null;

        // Срок
        $termMinMonths = isset($product['termMin']) ? (int) round($product['termMin'] / 30.4375) : 12;
        $termMaxMonths = isset($product['termMax']) ? (int) round($product['termMax'] / 30.4375) : 360;

        // Первоначальный взнос
        $downPayment = $product['initialFeePercent'] ?? $offer['initialFeePercent'] ?? 15;

        return $this->createBankProduct([
            'bank_name' => $bankName,
            'bank_logo_url' => $bankLogo,
            'program_name' => $programName,
            'program_type' => $this->determineProgramType($programName),
            'interest_rate_min' => number_format((float) $rateMin, 2, '.', ''),
            'interest_rate_max' => number_format((float) $rateMax, 2, '.', ''),
            'min_down_payment_percent' => number_format((float) $downPayment, 2, '.', ''),
            'min_loan_amount' => $amountMin,
            'max_loan_amount' => $amountMax,
            'loan_term_min_months' => $termMinMonths,
            'loan_term_max_months' => $termMaxMonths,
            'property_type' => $this->determinePropertyType($programName),
            'region' => 'ALL',
            'application_url' => $product['applicationUrl'] ?? $offer['submitButton']['url'] ?? null,
            'source_url' => self::BASE_URL . '/services/calculators/hypothec/',
        ]);
    }
}
