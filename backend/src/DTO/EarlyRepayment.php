<?php

declare(strict_types=1);

namespace App\DTO;

/**
 * Параметры досрочного погашения.
 * mode: 'once' (разовое), 'monthly', 'quarterly', 'yearly' (периодическое).
 * strategy: 'reduce_term' (уменьшать срок) | 'reduce_payment' (уменьшать платёж).
 */
final class EarlyRepayment
{
    public function __construct(
        public readonly float $amount,
        public readonly int $fromMonth,
        public readonly string $mode = 'once',
        public readonly string $strategy = 'reduce_term',
    ) {
    }

    public static function fromArray(array $d): self
    {
        return new self(
            amount: (float) ($d['amount'] ?? 0),
            fromMonth: (int) ($d['fromMonth'] ?? 1),
            mode: (string) ($d['mode'] ?? 'once'),
            strategy: (string) ($d['strategy'] ?? 'reduce_term'),
        );
    }

    /** Срабатывает ли досрочный взнос на данном месяце. */
    public function appliesAt(int $month): bool
    {
        if ($month < $this->fromMonth) {
            return false;
        }
        return match ($this->mode) {
            'once'      => $month === $this->fromMonth,
            'monthly'   => true,
            'quarterly' => (($month - $this->fromMonth) % 3) === 0,
            'yearly'    => (($month - $this->fromMonth) % 12) === 0,
            default     => false,
        };
    }
}
