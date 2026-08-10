<?php

declare(strict_types=1);

namespace App\Parser\Adapter;

use App\Parser\AbstractProgramParser;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/**
 * Парсер для рефинансирования ипотеки (mortgage_refinance).
 * 
 * Анализ API banki.ru:
 * 1. GET /bff/catalog/api/v1/widget/group — возвращает список банков с программами
 *    Параметры:
 *    - pageType=CALCHYPOTHEC
 *    - productTypes[]=mortgage_refinance
 *    - catalog=refinansirovanie_ipoteki
 *    - requestedAmount, requestedTerm, initialFee — параметры калькулятора
 *    - regionId — регион (4 = Москва)
 *    - page, limit — пагинация
 * 
 * 2. GET /bff/catalog/api/v2/products?uids[]=... — детальная информация по продуктам
 *    uids[] — массив ID продуктов из первого запроса
 * 
 * UID формируется как: <bank_id><product_type_id>
 * Например: 1231507 где 12315 — bank_id, 07 — product_type_id (mortgage_refinance)
 */
#[AutoconfigureTag('app.program_parser')]
class RefinanceProgramParser extends AbstractProgramParser
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
        return 'mortgage_refinance';
    }

    /**
     * Генератор: парсит программы рефинансирования порционно.
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

            if (empty($widgetData['items'])) {
                break; // Больше нет данных
            }

            // Собираем UIDs для детального запроса
            $uids = [];
            $offerMap = []; // uid => offer данные из виджета

            foreach ($widgetData['items'] as $bankGroup) {
                // Сохраняем информацию о банке в кэш
                if (isset($bankGroup['partnerData']['id'])) {
                    $this->bankCache[$bankGroup['partnerData']['id']] = $bankGroup['partnerData'];
                }

                $programs = $bankGroup['items'] ?? [];
                foreach ($programs as $program) {
                    // API возвращает productUid вместо uid
                    $uid = $program['productUid'] ?? null;
                    if (!$uid) {
                        continue;
                    }

                    $uids[] = $uid;
                    $offerMap[$uid] = $program;

                    if (count($uids) >= 50) {
                        // Обрабатываем порцию UID'ов
                        foreach ($this->processUidsBatch($uids, $offerMap) as $bankProduct) {
                            if ($count >= $limit) {
                                break 3;
                            }
                            yield $bankProduct;
                            $count++;
                        }
                        $uids = [];
                        $offerMap = [];
                    }
                }

                if ($count >= $limit) {
                    break;
                }
            }

            // Обрабатываем оставшиеся UID'ы
            if (!empty($uids)) {
                foreach ($this->processUidsBatch($uids, $offerMap) as $bankProduct) {
                    if ($count >= $limit) {
                        break 2;
                    }
                    yield $bankProduct;
                    $count++;
                }
            }

            $page++;

            // Проверка: если на странице меньше чем perPage, значит это последняя страница
            if (count($widgetData['items']) < $perPage) {
                break;
            }
        }
    }

    /**
     * Запрашивает данные виджета группы продуктов для рефинансирования.
     */
    protected function fetchWidgetGroup(int $page, int $limit): array
    {
        $queryParams = [
            'pageType' => 'CALCHYPOTHEC',
            'productTypes[]' => 'mortgage_refinance',
            'requestedAmount' => '3000000',
            'requestedTerm' => '20',
            'requestedTermUnit' => '7', // years
            'initialFee' => '3000000',
            'sort' => 'popular',
            'order' => 'desc',
            'catalog' => 'refinansirovanie_ipoteki',
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
                'Referer' => 'https://www.banki.ru/services/calculators/hypothec/refinansirovanie_ipoteki/',
            ],
        ]);

        return $response->toArray();
    }

    /**
     * Запрашивает детальную информацию по продуктам и создаёт генератор BankProduct.
     *
     * @param array<string> $uids Список UID продуктов
     * @param array<string, array> $offerMap Маппинг uid => offer данные
     * @return \Generator<\App\Entity\BankProduct>
     */
    private function processUidsBatch(array $uids, array $offerMap): \Generator
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
            $bankProduct = $this->extractBankProduct($product, $offerMap);
            if ($bankProduct !== null) {
                yield $bankProduct;
            }
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
        $programName = $product['name'] ?? $offer['productName'] ?? 'Рефинансирование';

        // Ставка
        $rateMin = $product['rateFrom'] ?? $offer['rateFrom'] ?? 0;
        $rateMax = $product['rateTo'] ?? $offer['rateTo'] ?? $rateMin;

        // Сумма кредита
        $amountMin = $product['amountMin'] ?? null;
        $amountMax = $product['amountMax'] ?? null;

        // Срок
        $termMinMonths = isset($product['termMin']) ? (int) round($product['termMin'] / 30.4375) : 12;
        $termMaxMonths = isset($product['termMax']) ? (int) round($product['termMax'] / 30.4375) : 360;

        // Первоначальный взнос (для рефинансирования может быть 0)
        $downPayment = $product['initialFeePercent'] ?? $offer['initialFeePercent'] ?? 0;

        return $this->createBankProduct([
            'bank_name' => $bankName,
            'bank_logo_url' => $bankLogo,
            'program_name' => $programName,
            'program_type' => 'REFINANCE', // Явно указываем REFINANCE
            'interest_rate_min' => number_format((float) $rateMin, 2, '.', ''),
            'interest_rate_max' => number_format((float) $rateMax, 2, '.', ''),
            'min_down_payment_percent' => number_format((float) $downPayment, 2, '.', ''),
            'min_loan_amount' => $amountMin,
            'max_loan_amount' => $amountMax,
            'loan_term_min_months' => $termMinMonths,
            'loan_term_max_months' => $termMaxMonths,
            'property_type' => 'ALL', // Для рефинансирования тип недвижимости не критичен
            'region' => 'ALL',
            'application_url' => $product['applicationUrl'] ?? $offer['submitButton']['url'] ?? null,
            'source_url' => self::BASE_URL . '/services/calculators/hypothec/refinansirovanie_ipoteki/',
        ]);
    }
}
