<?php

declare(strict_types=1);

namespace App\Service;

use App\DTO\CalculationRequest;
use App\DTO\EarlyRepayment;
use App\DTO\PaymentRow;

/**
 * Расчёт ипотеки: аннуитет, дифференцированный платёж, график погашения,
 * досрочное погашение (уменьшение срока / уменьшение платежа), материнский капитал.
 *
 * Денежные значения округляются до копеек на каждом шаге, чтобы итог графика
 * совпадал с банковским (отсутствие накопленной ошибки округления).
 */
final class MortgageCalculator
{
    private const SCALE = 2;

    /** Аннуитетный ежемесячный платёж по формуле с коэффициентом аннуитета. */
    public function annuityPayment(float $loan, int $months, float $annualRate): float
    {
        if ($months <= 0) {
            return 0.0;
        }
        $i = $annualRate / 100 / 12;
        if ($i <= 0.0) {
            return $this->round($loan / $months);
        }
        $pow = (1 + $i) ** $months;
        return $this->round($loan * $i * $pow / ($pow - 1));
    }

    /**
     * Построить график без досрочных погашений.
     *
     * @return PaymentRow[]
     */
    public function buildSchedule(CalculationRequest $req): array
    {
        return $this->schedule(
            $req->loanAmount,
            $req->months,
            $req->rate,
            $req->paymentType,
            null,
            0.0,
        );
    }

    /**
     * График с досрочным погашением и (опционально) материнским капиталом.
     * Маткапитал вносится разово на первом месяце как уменьшение тела долга.
     *
     * @return PaymentRow[]
     */
    public function buildScheduleWithEarlyRepayment(
        CalculationRequest $req,
        ?EarlyRepayment $early,
        float $maternalCapital = 0.0,
    ): array {
        return $this->schedule(
            $req->loanAmount,
            $req->months,
            $req->rate,
            $req->paymentType,
            $early,
            $maternalCapital,
        );
    }

    /**
     * Ядро построения графика.
     *
     * @return PaymentRow[]
     */
    private function schedule(
        float $loan,
        int $months,
        float $annualRate,
        string $type,
        ?EarlyRepayment $early,
        float $maternalCapital,
    ): array {
        $i = $annualRate / 100 / 12;
        $balance = $loan;

        // Маткапитал уменьшает тело долга до старта погашения.
        if ($maternalCapital > 0) {
            $balance = max(0.0, $balance - $maternalCapital);
        }

        $rows = [];
        $start = new \DateTimeImmutable('first day of next month');

        // Базовый аннуитетный платёж и фиксированная часть тела для диффа.
        $annuity = $this->annuityPayment($balance, $months, $annualRate);
        $principalFixed = $months > 0 ? $balance / $months : 0.0;

        $month = 0;
        while ($balance > 0.005 && $month < $months) {
            $month++;
            $interest = $this->round($balance * $i);

            if ($type === 'diff') {
                $principal = min($principalFixed, $balance);
                $payment = $this->round($principal + $interest);
            } else {
                $payment = min($annuity, $this->round($balance + $interest));
                $principal = $this->round($payment - $interest);
            }

            $balance = $this->round($balance - $principal);

            // Досрочный взнос на этом месяце.
            $extra = 0.0;
            if ($early !== null && $early->amount > 0 && $early->appliesAt($month)) {
                $extra = min($early->amount, $balance);
                $balance = $this->round($balance - $extra);

                // Стратегия "уменьшать платёж": пересчитываем аннуитет на оставшийся срок.
                if ($early->strategy === 'reduce_payment' && $type !== 'diff') {
                    $remaining = $months - $month;
                    if ($remaining > 0 && $balance > 0) {
                        $annuity = $this->annuityPayment($balance, $remaining, $annualRate);
                    }
                }
                // Стратегия "уменьшать срок": платёж тот же, срок сократится естественно.
            }

            $rows[] = new PaymentRow(
                $month,
                $start->modify('+' . ($month - 1) . ' months'),
                $payment,
                $principal,
                $interest,
                $extra,
                max(0.0, $balance),
            );
        }

        return $rows;
    }

    /**
     * Подобрать сумму кредита под желаемый ежемесячный платёж (режим «По платежу»).
     */
    public function loanFromPayment(float $monthlyPayment, int $months, float $annualRate): float
    {
        $i = $annualRate / 100 / 12;
        if ($i <= 0.0) {
            return $this->round($monthlyPayment * $months);
        }
        $pow = (1 + $i) ** $months;
        return $this->round($monthlyPayment * ($pow - 1) / ($i * $pow));
    }

    /** @param PaymentRow[] $rows */
    public function totalPayout(array $rows): float
    {
        $sum = 0.0;
        foreach ($rows as $r) {
            $sum += $r->payment + $r->extra;
        }
        return $this->round($sum);
    }

    /** @param PaymentRow[] $rows */
    public function totalInterest(array $rows): float
    {
        $sum = 0.0;
        foreach ($rows as $r) {
            $sum += $r->interest;
        }
        return $this->round($sum);
    }

    private function round(float $v): float
    {
        return round($v, self::SCALE);
    }
}
