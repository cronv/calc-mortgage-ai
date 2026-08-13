<?php

declare(strict_types=1);

namespace App\DTO;

/**
 * DTO для поиска подходящих ипотечных продуктов.
 * Используется в BankProductRepository::findActiveMatching().
 */
final class ProductMatchCriteria
{
    public function __construct(
        public readonly string $region = 'ALL',
        public readonly ?string $propertyType = null,
        public readonly ?string $tabsType = null,
        public readonly ?string $programType = null,
        public readonly float $loanAmount = 0.0,
        public readonly int $termMonths = 240,
    ) {
    }

    /** Фабрика из массива входных данных. */
    public static function fromArray(array $data): self
    {
        return new self(
            region: (string) ($data['region'] ?? 'ALL'),
            propertyType: isset($data['propertyType']) ? (string) $data['propertyType'] : null,
            tabsType: isset($data['tabsType']) ? (string) $data['tabsType'] : null,
            programType: isset($data['programType']) ? (string) $data['programType'] : null,
            loanAmount: (float) ($data['loanAmount'] ?? 0),
            termMonths: (int) ($data['termMonths'] ?? 240),
        );
    }
}
