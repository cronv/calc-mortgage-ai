<?php

declare(strict_types=1);

namespace App\Controller;

use App\DTO\CalculationRequest;
use App\DTO\EarlyRepayment;
use App\Service\MortgageCalculator;
use App\Service\UnderwritingService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/** API расчёта ипотеки и графика платежей. */
#[Route('/api')]
final class CalculatorController extends AbstractController
{
    public function __construct(
        private readonly MortgageCalculator $calc,
        private readonly UnderwritingService $uw,
        private readonly ValidatorInterface $validator,
    ) {
    }

    /** POST /api/calculate — платёж, переплата, график. */
    #[Route('/calculate', name: 'api_calculate', methods: ['POST'])]
    public function calculate(Request $request): JsonResponse
    {
        $data = $this->decode($request);

        $rate = $this->uw->adjustRate(
            (float) ($data['rate'] ?? 16.5),
            (bool) ($data['hasInsurance'] ?? true),
            (bool) ($data['isSalaryClient'] ?? false),
            (bool) ($data['electronicRegistration'] ?? false),
        );

        $req = new CalculationRequest(
            loanAmount: (float) ($data['loanAmount'] ?? 0),
            months: (int) ($data['months'] ?? 240),
            rate: $rate,
            paymentType: (string) ($data['paymentType'] ?? 'ann'),
        );

        $violations = $this->validator->validate($req);
        if (count($violations) > 0) {
            return $this->json(['errors' => $this->formatViolations($violations)], 422);
        }

        $schedule = $this->calc->buildSchedule($req);
        $total = $this->calc->totalPayout($schedule);
        $first = $schedule[0]->payment ?? 0.0;
        $over = round($total - $req->loanAmount, 2);

        return $this->json([
            'monthlyPayment'    => $first,
            'overpayment'       => $over,
            'totalPayout'       => $total,
            'effectiveRate'     => $rate,
            'recommendedIncome' => $this->uw->recommendedIncome($first),
            'taxDeduction'      => $this->uw->taxDeduction($req->loanAmount, $over),
            'dti'               => $this->uw->debtToIncome(
                $first,
                (float) ($data['otherDebts'] ?? 0),
                (float) ($data['income'] ?? 0),
            ),
            'schedule'          => array_map(static fn($r) => $r->toArray(), $schedule),
        ]);
    }

    /** POST /api/calculate/early-repayment — график с досрочным погашением и маткапиталом. */
    #[Route('/calculate/early-repayment', name: 'api_calculate_early', methods: ['POST'])]
    public function earlyRepayment(Request $request): JsonResponse
    {
        $data = $this->decode($request);

        $rate = $this->uw->adjustRate(
            (float) ($data['rate'] ?? 16.5),
            (bool) ($data['hasInsurance'] ?? true),
            (bool) ($data['isSalaryClient'] ?? false),
            (bool) ($data['electronicRegistration'] ?? false),
        );

        $req = new CalculationRequest(
            loanAmount: (float) ($data['loanAmount'] ?? 0),
            months: (int) ($data['months'] ?? 240),
            rate: $rate,
            paymentType: (string) ($data['paymentType'] ?? 'ann'),
        );

        $violations = $this->validator->validate($req);
        if (count($violations) > 0) {
            return $this->json(['errors' => $this->formatViolations($violations)], 422);
        }

        $early = isset($data['earlyRepayment'])
            ? EarlyRepayment::fromArray($data['earlyRepayment'])
            : null;
        $maternal = (float) ($data['maternalCapital'] ?? 0);

        $base = $this->calc->buildSchedule($req);
        $withEarly = $this->calc->buildScheduleWithEarlyRepayment($req, $early, $maternal);

        $baseTotal = $this->calc->totalPayout($base);
        $earlyTotal = $this->calc->totalPayout($withEarly);

        return $this->json([
            'baseMonths'      => count($base),
            'newMonths'       => count($withEarly),
            'monthsSaved'     => count($base) - count($withEarly),
            'baseTotalPayout' => $baseTotal,
            'newTotalPayout'  => $earlyTotal,
            'interestSaved'   => round($this->calc->totalInterest($base) - $this->calc->totalInterest($withEarly), 2),
            'schedule'        => array_map(static fn($r) => $r->toArray(), $withEarly),
        ]);
    }

    private function decode(Request $request): array
    {
        return json_decode($request->getContent() ?: '{}', true) ?? [];
    }

    private function formatViolations(iterable $violations): array
    {
        $out = [];
        foreach ($violations as $v) {
            $out[] = ['field' => $v->getPropertyPath(), 'message' => $v->getMessage()];
        }
        return $out;
    }
}
