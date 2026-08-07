<?php

declare(strict_types=1);

namespace App\DTO;

/** Строка графика платежей. Иммутабельный value object. */
final readonly class PaymentRow
{
    public function __construct(
        public int $number,
        public \DateTimeImmutable $date,
        public float $payment,
        public float $principal,
        public float $interest,
        public float $extra,
        public float $balance,
    ) {
    }

    public function toArray(): array
    {
        return [
            'n'         => $this->number,
            'date'      => $this->date->format('Y-m-d'),
            'payment'   => round($this->payment, 2),
            'principal' => round($this->principal, 2),
            'interest'  => round($this->interest, 2),
            'extra'     => round($this->extra, 2),
            'balance'   => round($this->balance, 2),
        ];
    }
}
