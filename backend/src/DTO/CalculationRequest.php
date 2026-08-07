<?php

declare(strict_types=1);

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

/** Входной запрос на расчёт ипотеки. Валидируется Symfony Validator. */
final class CalculationRequest
{
    public function __construct(
        #[Assert\Positive(message: 'Сумма кредита должна быть положительной')]
        public readonly float $loanAmount = 0.0,

        #[Assert\Range(min: 1, max: 600, notInRangeMessage: 'Срок должен быть от 1 до 600 месяцев')]
        public readonly int $months = 240,

        #[Assert\Range(min: 0.1, max: 40, notInRangeMessage: 'Ставка должна быть от 0.1% до 40%')]
        public readonly float $rate = 16.5,

        #[Assert\Choice(choices: ['ann', 'diff'], message: 'Тип платежа: ann или diff')]
        public readonly string $paymentType = 'ann',
    ) {
    }

    /** Фабрика из массива входных данных запроса. */
    public static function fromArray(array $data): self
    {
        return new self(
            loanAmount: (float) ($data['loanAmount'] ?? 0),
            months: (int) ($data['months'] ?? 240),
            rate: (float) ($data['rate'] ?? 16.5),
            paymentType: (string) ($data['paymentType'] ?? 'ann'),
        );
    }
}
