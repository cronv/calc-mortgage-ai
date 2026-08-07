<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Андеррайтинг: модификаторы ставки, ПДН, рекомендуемый доход, налоговый вычет.
 */
final class UnderwritingService
{
    private const MAX_DEDUCTION_BASE = 2_000_000.0;     // лимит вычета со стоимости
    private const MAX_DEDUCTION_INTEREST = 3_000_000.0; // лимит вычета с процентов
    private const DEDUCTION_RATE = 0.13;                // НДФЛ

    /**
     * Эффективная ставка с учётом скидок/надбавок.
     */
    public function adjustRate(
        float $baseRate,
        bool $hasInsurance,
        bool $isSalaryClient,
        bool $electronicRegistration,
        float $rateWithoutInsurance = 1.0,
        float $salaryDiscount = 0.5,
        float $electronicDiscount = 0.3,
    ): float {
        $rate = $baseRate;
        if (!$hasInsurance) {
            $rate += $rateWithoutInsurance;
        }
        if ($isSalaryClient) {
            $rate -= $salaryDiscount;
        }
        if ($electronicRegistration) {
            $rate -= $electronicDiscount;
        }
        return max(0.1, round($rate, 2));
    }

    /** ПДН (%) = (платёж по ипотеке + прочие долги) / доход. */
    public function debtToIncome(float $monthlyPayment, float $otherDebts, float $income): float
    {
        if ($income <= 0) {
            return 0.0;
        }
        return round(($monthlyPayment + $otherDebts) / $income * 100, 1);
    }

    /** Рекомендуемый доход: платёж не должен превышать 50% бюджета. */
    public function recommendedIncome(float $monthlyPayment): float
    {
        return round($monthlyPayment / 0.5, 2);
    }

    /** Налоговый вычет: 13% со стоимости (лимит 2 млн) + 13% с процентов (лимит 3 млн). */
    public function taxDeduction(float $loanAmount, float $overpayment): float
    {
        $base = min($loanAmount, self::MAX_DEDUCTION_BASE) * self::DEDUCTION_RATE;
        $interest = min($overpayment, self::MAX_DEDUCTION_INTEREST) * self::DEDUCTION_RATE;
        return round($base + $interest, 2);
    }
}
