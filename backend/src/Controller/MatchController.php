<?php

declare(strict_types=1);

namespace App\Controller;

use App\Repository\BankProductRepository;
use App\Repository\GovernmentProgramRepository;
use App\Service\MortgageCalculator;
use App\Service\UnderwritingService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * ЕДИНЫЙ эндпоинт подбора предложений — используется и публичным калькулятором,
 * и встраиваемым виджетом. Данные берутся из одних и тех же таблиц БД.
 */
#[Route('/api/v1/calculator')]
final class MatchController extends AbstractController
{
    public function __construct(
        private readonly BankProductRepository $products,
        private readonly GovernmentProgramRepository $govPrograms,
        private readonly MortgageCalculator $calc,
        private readonly UnderwritingService $uw,
    ) {
    }

    /** GET /api/v1/calculator/match */
    #[Route('/match', name: 'api_match', methods: ['GET'])]
    public function match(Request $request): JsonResponse
    {
        // Валидация и нормализация входных параметров
        $cost = max(100000, (float) $request->query->get('cost', '1500000'));
        $down = max(0, (float) $request->query->get('down_payment', '0'));
        $term = max(12, (int) $request->query->get('term', '240'));

        // Проверка: down не может быть больше cost
        if ($down >= $cost) {
            $down = $cost * 0.2; // Автокоррекция на 20%
        }

        $region = (string) $request->query->get('region', 'ALL');
        $propertyType = $request->query->has('property_type') ? (string) $request->query->get('property_type') : null;
        $programType = $request->query->has('program_type') ? (string) $request->query->get('program_type') : null;
        $hasInsurance = (bool) (int) $request->query->get('has_insurance', '1');
        $isSalary = (bool) (int) $request->query->get('is_salary_client', '0');
        $electronic = (bool) (int) $request->query->get('electronic_registration', '0');

        // Минимальная сумма кредита 100к
        $loan = max(100000.0, $cost - $down);

        $criteria = new \App\DTO\ProductMatchCriteria(
            region: $region,
            propertyType: $propertyType,
            programType: $programType,
            loanAmount: $loan,
            termMonths: $term,
        );

        $matched = $this->products->findActiveMatching($criteria);

        $offers = [];
        foreach ($matched as $p) {
            $rate = $this->uw->adjustRate(
                (float) $p->getInterestRateMin(),
                $hasInsurance,
                $isSalary,
                $electronic,
                (float) $p->getRateWithoutInsurance(),
                (float) $p->getSalaryClientDiscount(),
                (float) $p->getElectronicRegistrationDiscount(),
            );
            $payment = $this->calc->annuityPayment($loan, $term, $rate);
            $total = round($payment * $term, 2);

            $offers[] = [
                'bank_name'          => $p->getBankName(),
                'bank_logo_url'      => $p->getBankLogoUrl(),
                'program_name'       => $p->getProgramName(),
                'program_type'       => $p->getProgramType(),
                'calculated_rate'    => round($rate, 2),
                'monthly_payment'    => round($payment, 0),
                'overpayment'        => round(max(0, $total - $loan), 2),
                'total_payout'       => $total,
                'min_down_payment'   => (float) $p->getMinDownPaymentPercent(),
                'application_url'    => $p->getApplicationUrl(),
                'special_conditions' => $p->getSpecialConditions(),
            ];
        }

        // Сортировка по ставке (по умолчанию). Клиент может пересортировать на фронте.
        usort($offers, static fn($a, $b) => $a['calculated_rate'] <=> $b['calculated_rate']);

        $govApplied = [];
        foreach ($this->govPrograms->findActive() as $g) {
            $govApplied[] = $g->getProgramKey();
        }

        return $this->json([
            'offers'                     => $offers,
            'total_offers'               => count($offers),
            'government_programs_applied' => $govApplied,
        ]);
    }
}
