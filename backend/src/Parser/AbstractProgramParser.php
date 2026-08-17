<?php

declare(strict_types=1);

namespace App\Parser;

use App\Entity\BankProduct;
use App\Service\BatchProcessor;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Базовый абстрактный класс для парсеров ипотечных программ.
 * Реализует шаблонный метод с использованием генераторов для экономии памяти.
 */
abstract class AbstractProgramParser
{
    protected HttpClientInterface $httpClient;
    protected BatchProcessor $batchProcessor;

    public function __construct(
        HttpClientInterface $httpClient,
        BatchProcessor $batchProcessor
    ) {
        $this->httpClient = $httpClient;
        $this->batchProcessor = $batchProcessor;
    }

    /**
     * Возвращает тип продукта, который парсит данный адаптер (mortgage, mortgage_refinance, etc.)
     */
    abstract public function getProductType(): string;

    /**
     * Генератор: возвращает порции данных BankProduct.
     * Каждая итерация — один продукт, что позволяет обрабатывать большие объёмы без загрузки в память.
     *
     * @return \Generator<BankProduct>
     */
    abstract public function parse(int $limit = 100): \Generator;

    /**
     * Парсит строку процентной ставки вида "от 5.5% до 12%" или "5.5%-12%" в [min, max].
     */
    protected function parseRate(string $rateStr): array
    {
        if (empty($rateStr)) {
            return ['0.00', '0.00'];
        }

        $normalized = str_replace(',', '.', $rateStr);
        preg_match_all('/(\d+(?:\.\d+)?)/', $normalized, $matches);
        $floats = array_map('floatval', $matches[1]);

        if (empty($floats)) {
            return ['0.00', '0.00'];
        }

        return [
            number_format((float) min($floats), 2, '.', ''),
            number_format((float) max($floats), 2, '.', ''),
        ];
    }

    /**
     * Определяет тип программы по названию.
     */
    protected function determineProgramType(string $name): string
    {
        $nameLower = mb_strtolower($name);
        $governmentKeywords = ['семейная', 'it', 'ит-', 'дальневосточная', 'арктическая', 'сельская', 'военная', 'господдерж'];

        foreach ($governmentKeywords as $keyword) {
            if (str_contains($nameLower, $keyword)) {
                return 'GOVERNMENT';
            }
        }

        // Рефинансирование — отдельный тип
        if (str_contains($nameLower, 'рефинанс')) {
            return 'REFINANCE';
        }

        return 'STANDARD';
    }

    /**
     * Определяет тип программы (таб) по названию.
     * Возвращает значения: STANDARD, FAMILY, MILITARY, IT, FAR_EAST, ARCTIC, RURAL
     */
    protected function determineTabsType(string $name): string
    {
        $nameLower = mb_strtolower($name);

        // Семейная ипотека
        if (str_contains($nameLower, 'семей') || str_contains($nameLower, 'для семьи') || str_contains($nameLower, 'семья')) {
            return 'FAMILY';
        }
        // Военная ипотека
        if (str_contains($nameLower, 'военн') || str_contains($nameLower, 'для военных')) {
            return 'MILITARY';
        }
        // IT-ипотека
        if (str_contains($nameLower, 'it') || str_contains($nameLower, 'ит-') || str_contains($nameLower, 'айти') || str_contains($nameLower, 'для it')) {
            return 'IT';
        }
        // Дальневосточная ипотека
        if (str_contains($nameLower, 'дальневосточ') || str_contains($nameLower, 'дальний восток')) {
            return 'FAR_EAST';
        }
        // Арктическая ипотека
        if (str_contains($nameLower, 'арктич') || str_contains($nameLower, 'арктика')) {
            return 'ARCTIC';
        }
        // Сельская ипотека
        if (str_contains($nameLower, 'сельск') || str_contains($nameLower, 'для села') || str_contains($nameLower, 'сельская местность')) {
            return 'RURAL';
        }

        return 'STANDARD';
    }

    /**
     * Определяет тип недвижимости по названию программы.
     */
    protected function determinePropertyType(string $name): string
    {
        $nameLower = mb_strtolower($name);

        if (str_contains($nameLower, 'новострой') || str_contains($nameLower, 'строящ')) {
            return 'NEW_BUILD';
        }
        if (str_contains($nameLower, 'вторич') || str_contains($nameLower, 'готовое') || str_contains($nameLower, 'апартаменты')) {
            return 'SECONDARY';
        }
        if (str_contains($nameLower, 'дом') || str_contains($nameLower, 'ижс') || str_contains($nameLower, 'таунхаус') || str_contains($nameLower, 'участок')) {
            return 'HOUSE';
        }
        if (str_contains($nameLower, 'коммерч')) {
            return 'COMMERCIAL';
        }
        if (str_contains($nameLower, 'машино-место') || str_contains($nameLower, 'кладовк')) {
            return 'PARKING';
        }

        return 'ALL';
    }

    /**
     * Создаёт entity BankProduct из массива данных.
     */
    protected function createBankProduct(array $data): BankProduct
    {
        $product = new BankProduct();
        $product
            ->setBankName($data['bank_name'] ?? 'Неизвестный банк')
            ->setBankLogoUrl($data['bank_logo_url'] ?? null)
            ->setProgramName($data['program_name'] ?? 'Ипотека')
            ->setProgramType($data['program_type'] ?? 'STANDARD')
            ->setInterestRateMin($data['interest_rate_min'] ?? '0.00')
            ->setInterestRateMax($data['interest_rate_max'] ?? '0.00')
            ->setMinDownPaymentPercent($data['min_down_payment_percent'] ?? '15.00')
            ->setMaxLoanAmount(isset($data['max_loan_amount']) ? (string) $data['max_loan_amount'] : null)
            ->setMinLoanAmount(isset($data['min_loan_amount']) ? (string) $data['min_loan_amount'] : null)
            ->setLoanTermMinMonths($data['loan_term_min_months'] ?? 12)
            ->setLoanTermMaxMonths($data['loan_term_max_months'] ?? 360)
            ->setPropertyType($data['property_type'] ?? 'ALL')
            ->setTabsType($data['tabs_type'] ?? $this->determineTabsType($data['program_name'] ?? ''))
            ->setRegion($data['region'] ?? 'ALL')
            ->setApplicationUrl($data['application_url'] ?? null)
            ->setSourceUrl($data['source_url'] ?? null)
            ->setParsedAt(new \DateTimeImmutable())
            ->setIsActive(true);

        return $product;
    }
}
