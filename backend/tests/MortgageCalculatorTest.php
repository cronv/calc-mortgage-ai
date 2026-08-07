<?php
declare(strict_types=1);

namespace App\Tests;

use App\DTO\CalculationRequest;
use App\Service\MortgageCalculator;
use PHPUnit\Framework\TestCase;

final class MortgageCalculatorTest extends TestCase
{
    public function testAnnuityPaymentMatchesReference(): void
    {
        $calc = new MortgageCalculator();
        // 6 000 000 ₽, 240 мес, 16.5% → ~ 86 000 ₽/мес
        $pay = $calc->annuityPayment(6_000_000, 240, 16.5);
        $this->assertGreaterThan(85_000, $pay);
        $this->assertLessThan(87_000, $pay);
    }

    public function testScheduleLengthEqualsMonths(): void
    {
        $calc = new MortgageCalculator();
        $req = new CalculationRequest(6_000_000, 240, 16.5, 'ann');
        $this->assertCount(240, $calc->buildSchedule($req));
    }

    public function testBalanceReachesZero(): void
    {
        $calc = new MortgageCalculator();
        $req = new CalculationRequest(6_000_000, 240, 16.5, 'ann');
        $rows = $calc->buildSchedule($req);
        $this->assertLessThan(1.0, end($rows)->balance);
    }

    public function testLoanFromPaymentIsInverseOfAnnuity(): void
    {
        $calc = new MortgageCalculator();
        // Прямая задача: тело → платёж; обратная: платёж → тело. Должны сойтись.
        $pay = $calc->annuityPayment(6_000_000, 240, 16.5);
        $loan = $calc->loanFromPayment($pay, 240, 16.5);
        $this->assertEqualsWithDelta(6_000_000, $loan, 50.0);
    }

    public function testLoanFromPaymentZeroRate(): void
    {
        $calc = new MortgageCalculator();
        // При нулевой ставке тело = платёж × срок.
        $this->assertEqualsWithDelta(2_400_000, $calc->loanFromPayment(10_000, 240, 0.0), 0.01);
    }

    public function testDifferentiatedFirstPaymentIsLargest(): void
    {
        $calc = new MortgageCalculator();
        $req = new CalculationRequest(6_000_000, 240, 16.5, 'diff');
        $rows = $calc->buildSchedule($req);
        // У дифференцированного графика первый платёж — наибольший.
        $this->assertGreaterThan($rows[1]->payment, $rows[0]->payment);
        $this->assertGreaterThan(end($rows)->payment, $rows[0]->payment);
    }
}
