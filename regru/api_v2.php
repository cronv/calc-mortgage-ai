<?php

declare(strict_types=1);

/**
 * Пример скрипта для поиска ипотечных предложений по критериям (без Symfony)
 * Входные параметры: cost, down_payment, term
 * Выход: массив подходящих предложений с рассчитанными платежами
 */

function calculateAnnuityPayment(float $loan, int $term, float $rate): float
{
    if ($term <= 0 || $rate <= 0) {
        return 0.0;
    }
    $i = $rate / 100 / 12;
    if ($i === 0) {
        return $loan / $term;
    }
    $n = $term;
    $numerator = $loan * $i;
    $denominator = 1 - pow(1 + $i, -$n);
    return round($numerator / $denominator, 2);
}

/**
 * Основная функция поиска подходящих предложений
 *
 * @param array $offers     Массив предложений (как в вашем JSON)
 * @param float $cost       Стоимость недвижимости
 * @param float $down      Размер первоначального взноса
 * @param int   $term      Срок кредита в месяцах
 * @param string $region   Регион (ALL или конкретное)
 * @param string $property_type  Тип недвижимости (ALL или конкретный)
 *
 * @return array
 */
function filterAndSortOffers(array $offers, float $cost, float $down, int $term, string $region = 'ALL', string $property_type = 'ALL'): array
{
    $loan = max(100000.0, $cost - $down); // минимальный кредит
    $minDownPercent = 0.0; // минимальный % первоначального взноса по всем предложениям
    $matched = [];

    foreach ($offers as $offer) {
        // Фильтрация по региону
        if ($region !== 'ALL' && !strpos($offer['program_name'] ?? '', $region) && !strpos($offer['program_type'] ?? '', $region)) {
            continue;
        }
        // Фильтрация по типу недвижимости
        if ($property_type !== 'ALL' && $offer['program_type'] !== $property_type) {
            continue;
        }
        // Минимальный размер кредита (loan >= minLoan в предложении не указан, по условию задачи — по общему)
        // Минимальный % первоначального взноса (down >= offer_min_down)
        $minDownOffer = $offer['min_down_payment'];
        if ($minDownOffer > 0 && $down < ($cost * ($minDownOffer / 100))) {
            continue;
        }
        // Минимальный размер кредита по предложению (если есть)
        if (isset($offer['min_loan']) && $loan < $offer['min_loan']) {
            continue;
        }
        // Максимальный срок (если есть max_term в предложении, иначе пропускаем)
        if (isset($offer['max_term']) && $term > $offer['max_term']) {
            continue;
        }
        // Если нужно фильтровать по сроку кредита — можно добавить аналогично

        // Подсчет ставки с учетом скидок (просто для примера — можно улучшить)
        // Берем базовую ставку и применяем простую модель скидок (примерно как в вашем UnderwritingService)
        $baseRate = (float)$offer['calculated_rate'];
        $hasInsurance = isset($offer['has_insurance']) && $offer['has_insurance'];
        $isSalary = isset($offer['is_salary_client']) && $offer['is_salary_client'];
        $electronic = isset($offer['electronic_registration']) && $offer['electronic_registration'];

        // Здесь просто для примера — вы можете заменить на вашу бизнес-логику
        $rateAdjustment = 0.0;
        if (!$hasInsurance) $rateAdjustment += 0.5;
        if ($isSalary) $rateAdjustment -= 0.3;
        if ($electronic) $rateAdjustment -= 0.2;
        $adjustedRate = max(0.1, $baseRate + $rateAdjustment);

        // Вычисляем кредитную сумму (loan)
        // Можно ограничить максимальный кредит по предложению, если есть
        if (isset($offer['max_loan']) && $loan > $offer['max_loan']) {
            continue;
        }

        // Вычисляем ежемесячный платеж
        $monthlyPayment = calculateAnnuityPayment($loan, $term, $adjustedRate);

        // Переплата = (ежемесячный платеж * срок) - кредит
        $overpayment = round($monthlyPayment * $term - $loan, 2);

        $matched[] = [
            'bank_name'          => $offer['bank_name'],
            'program_name'       => $offer['program_name'],
            'program_type'       => $offer['program_type'],
            'calculated_rate'    => round($adjustedRate, 2),
            'monthly_payment'    => round($monthlyPayment, 0),
            'overpayment'        => $overpayment,
            'min_down_payment'   => $offer['min_down_payment'],
            'application_url'    => $offer['application_url'],
        ];
    }

    // Сортировка по ставке
    usort($matched, function($a, $b) {
        return $a['calculated_rate'] <=> $b['calculated_rate'];
    });

    return $matched;
}

// --- Пример использования ---

// Загружаем данные из JSON (здесь используем ваш массив offers)
$offers = '';

// Ввод параметров (можно брать из GET или POST, либо задать статически для примера)
$cost = 1500000; // цена недвижимости
$down_payment = 300000; // первоначальный взнос
$term = 240; // срок в месяцах
$region = 'FAR_EAST'; // или 'ALL'
$property_type = 'GOVERNMENT'; // или 'ALL'

// Фильтрация и сортировка
$result = filterAndSortOffers($offers, $cost, $down_payment, $term, $region, $property_type);

// Выводим результат (например, в виде JSON)
header('Content-Type: application/json');
echo json_encode([
    'offers' => $result,
    'total_offers' => count($result),
    // 'government_programs_applied' => ['FAMILY', 'IT', 'PREFERENTIAL', 'RURAL', 'FAR_EAST'] // если нужно
]);

// --- Конец скрипта ---

?>
