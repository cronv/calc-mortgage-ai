<?php

declare(strict_types=1);

namespace App\DTO;

/**
 * Параметры поиска подходящих ипотечных продуктов.
 * Используется для подбора предложений по заданным критериям.
 */
final class ProductMatchCriteria
{
    public function __construct(
        public readonly string $region = 'ALL',
        public readonly ?string $propertyType = null, // Опционально, может быть null
        public readonly ?string $programType = null,  // mortgage или mortgage_refinance
        public readonly float $loanAmount = 0.0,
        public readonly int $termMonths = 240,
    ) {
    }

    /** Фабрика из массива данных. */
    public static function fromArray(array $data): self
    {
        return new self(
            region: (string) ($data['region'] ?? 'ALL'),
            propertyType: isset($data['propertyType']) ? (string) $data['propertyType'] : null,
            programType: isset($data['programType']) ? (string) $data['programType'] : null,
            loanAmount: (float) ($data['loanAmount'] ?? 0.0),
            termMonths: (int) ($data['termMonths'] ?? 240),
        );
    }
}
