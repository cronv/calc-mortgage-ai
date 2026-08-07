<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\BankProduct;
use App\Repository\BankProductRepository;
use Doctrine\ORM\EntityManagerInterface;
use League\Uri\Uri;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DomCrawler\Crawler;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[AsCommand(
    name: 'parser:programs',
    description: 'Парсинг ипотечных программ из banki.ru (HTTP Client + Embedded JSON)',
)]
final class ParseProgramsCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly BankProductRepository $repository,
        private readonly HttpClientInterface $httpClient,
        private readonly string $parserSourceUrl,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('Парсинг ипотечных программ (HTTP Client + JSON)');

        $sourceUri = Uri::new($this->parserSourceUrl);
        if (!$sourceUri->isAbsolute()) {
            $io->error('Некорректный URL источника: ' . $this->parserSourceUrl);
            return Command::FAILURE;
        }

        $io->writeln(sprintf('Источник: <info>%s</info>', (string) $sourceUri));

        try {
            $io->writeln('Загрузка HTML через HttpClient...');
            $response = $this->httpClient->request('GET', (string) $sourceUri, [
                'headers' => [
                    'User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language' => 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                ]
            ]);
            $html = $response->getContent();
            $io->writeln(sprintf('Получено <info>%d</info> байт.', strlen($html)));
        } catch (\Throwable $e) {
            $io->error('Ошибка загрузки: ' . $e->getMessage());
            return Command::FAILURE;
        }

        $rawCards = $this->extractCards($html, $io);

        if ($rawCards === []) {
            $io->warning('Не удалось извлечь данные из HTML. Возможно, структура страницы изменилась.');
            return Command::FAILURE;
        }

        $io->success(sprintf('Найдено программ: %d', count($rawCards)));

        $processedKeys = []; // Локальный кеш для защиты от дублей в рамках одного запуска
        $new = 0;
        $updated = 0;

        $this->em->getConnection()->beginTransaction();
        try {
            foreach ($rawCards as $card) {
                // Нормализуем ключ для проверки на дубли (игнорируем регистр и лишние пробелы)
                $uniqueKey = mb_strtolower(trim($card['bank_name']) . '|' . trim($card['program_name']));

                if (isset($processedKeys[$uniqueKey])) {
                    continue; // Пропускаем дубль, который уже добавлен в UnitOfWork
                }
                $processedKeys[$uniqueKey] = true;

                $existing = $this->repository->findOneByBankAndProgram($card['bank_name'], $card['program_name']);
                $entity = $existing ?? new BankProduct();
                $isNew = $existing === null;

                $entity
                    ->setBankName($card['bank_name'])
                    ->setBankLogoUrl($card['bank_logo_url'])
                    ->setProgramName($card['program_name'])
                    ->setProgramType($card['program_type'])
                    ->setInterestRateMin($card['interest_rate_min'])
                    ->setInterestRateMax($card['interest_rate_max'])
                    ->setMinDownPaymentPercent($card['min_down_payment_percent'])
                    ->setMaxLoanAmount($card['max_loan_amount'])
                    ->setMinLoanAmount($card['min_loan_amount'])
                    ->setLoanTermMinMonths($card['loan_term_min_months'])
                    ->setLoanTermMaxMonths($card['loan_term_max_months'])
                    ->setPropertyType($card['property_type'])
                    ->setRegion($card['region'] ?? 'ALL')
                    ->setApplicationUrl($card['application_url'])
                    ->setSourceUrl((string) $sourceUri)
                    ->setParsedAt(new \DateTimeImmutable())
                    ->setIsActive(true);

                $this->em->persist($entity);
                $isNew ? $new++ : $updated++;

                // Flush in batches to save memory
                if (($new + $updated) % 50 === 0) {
                    $this->em->flush();
                    $this->em->clear();
                }
            }

            $this->em->flush();
            $this->em->getConnection()->commit();
        } catch (\Throwable $e) {
            $this->em->getConnection()->rollBack();
            $io->error('Ошибка при сохранении: ' . $e->getMessage());
            return Command::FAILURE;
        }

        $io->success(sprintf('Готово. Новых: %d, обновлено: %d', $new, $updated));

        return Command::SUCCESS;
    }

    private function extractCards(string $html, SymfonyStyle $io): array
    {
        $crawler = new Crawler($html);
        $cards = [];

        $jsonNodes = $crawler->filter('div[data-module-options]');

        if ($jsonNodes->count() === 0) {
            $io->warning('Блок data-module-options не найден. Попытка найти application/ld+json...');
            return $this->extractFromJsonLd($crawler, $io);
        }

        $data = null;
        $io->info("Найдено блоков data-module-options: " . $jsonNodes->count());

        foreach ($jsonNodes as $node) {
            $jsonString = $node->getAttribute('data-module-options');
            if (!$jsonString) {
                continue;
            }

            $jsonString = html_entity_decode($jsonString, ENT_QUOTES, 'UTF-8');
            $jsonString = str_replace(["\r\n", "\n", "\r"], "\\n", $jsonString);
            $jsonString = str_replace("\t", "\\t", $jsonString);
            $jsonString = preg_replace('/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/', '', $jsonString);

            $decoded = json_decode($jsonString, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                continue;
            }

            if (is_array($decoded) && isset($decoded['offers']['items'])) {
                $data = $decoded;
                $io->info('Найден корректный блок offers-group-widget с программами.');
                break;
            }
        }

        if (!$data) {
            $io->error('Не удалось найти JSON с ипотечными программами ни в одном из data-module-options блоков.');
            return $this->extractFromJsonLd($crawler, $io);
        }

        $bankGroups = $data['offers']['items'];
        foreach ($bankGroups as $group) {
            // Пропускаем "ghost" предложения на уровне группы (например, "Заполните одну анкету")
            if (isset($group['partnerType']) && $group['partnerType'] === '') {
                continue;
            }

            $programs = $group['items'] ?? [];
            foreach ($programs as $program) {
                $programName = $program['productName'] ?? 'Ипотека';

                // ИСПРАВЛЕНИЕ: Данные банка (partnerData) находятся ВНУТРИ каждой программы, а не на уровне группы!
                $bankName = $program['partnerData']['name']
                    ?? $program['productInfo']['partner']['name']
                    ?? 'Неизвестный банк';

                $bankLogo = $program['partnerData']['logoUrl']
                    ?? $program['productInfo']['partner']['image']
                    ?? $program['productInfo']['smallImage']
                    ?? null;

                // Дополнительная страховка от "ghost" офферов и пустых имен, которые могли просочиться
                if (empty($bankName) || $bankName === 'Cложно выбрать?' || $bankName === 'Неизвестный банк') {
                    continue;
                }

                $features = $program['data']['features'] ?? [];
                $rateStr = '';
                $downPaymentStr = '';
                foreach ($features as $feature) {
                    if (($feature['label'] ?? '') === 'Ставка') {
                        $rateStr = $feature['value'] ?? '';
                    }
                    if (($feature['label'] ?? '') === 'Первоначальный взнос') {
                        $downPaymentStr = $feature['value'] ?? '';
                    }
                }

                $meta = $program['productInfo']['meta'] ?? [];

                [$rateMin, $rateMax] = $this->parseRate($rateStr);
                $downPayment = $this->parseDownPayment($downPaymentStr);

                $termMinMonths = isset($meta['termMin']) ? (int) round($meta['termMin'] / 30.4375) : 12;
                $termMaxMonths = isset($meta['termMax']) ? (int) round($meta['termMax'] / 30.4375) : 360;

                $cards[] = [
                    'bank_name' => $bankName,
                    'bank_logo_url' => $bankLogo,
                    'program_name' => $programName,
                    'program_type' => $this->determineProgramType($programName),
                    'interest_rate_min' => $rateMin,
                    'interest_rate_max' => $rateMax,
                    'min_down_payment_percent' => $downPayment,
                    'min_loan_amount' => isset($meta['amountMin']) ? (string) $meta['amountMin'] : null,
                    'max_loan_amount' => isset($meta['amountMax']) ? (string) $meta['amountMax'] : null,
                    'loan_term_min_months' => $termMinMonths,
                    'loan_term_max_months' => $termMaxMonths,
                    'property_type' => $this->determinePropertyType($programName),
                    'region' => 'ALL',
                    'application_url' => $program['submitButton']['url'] ?? $program['productInfo']['url'] ?? null,
                ];
            }
        }

        return $cards;
    }

    private function extractFromJsonLd(Crawler $crawler, SymfonyStyle $io): array
    {
        $cards = [];
        $crawler->filter('script[type="application/ld+json"]')->each(function (Crawler $node) use (&$cards, $io) {
            $json = json_decode($node->text(), true);
            if (!is_array($json)) return;

            $offers = $json['offers']['offers'] ?? [];
            foreach ($offers as $offer) {
                if (($offer['@type'] ?? '') !== 'MortgageLoan') continue;

                $bankName = $offer['broker']['name'] ?? 'Неизвестный банк';

                // ИСПРАВЛЕНИЕ: Пропускаем агрегатора / ghost-офферы из JSON-LD
                if ($bankName === 'Cложно выбрать?' || $bankName === 'Неизвестный банк') {
                    continue;
                }

                $bankLogo = $offer['broker']['image'] ?? null;
                $programName = $offer['name'] ?? 'Ипотека';

                $rateMin = $offer['annualPercentageRate']['minValue'] ?? 0.0;
                $rateMax = $offer['annualPercentageRate']['maxValue'] ?? $rateMin;

                $amountStr = $offer['amount']['value'] ?? '';
                preg_match_all('/(\d+(?:[\s\xA0]*\d+)*)/', $amountStr, $matches);
                $amounts = array_map(fn($a) => (int) preg_replace('/\s+/', '', $a), $matches[1]);
                $minAmt = !empty($amounts) ? min($amounts) : null;
                $maxAmt = !empty($amounts) ? max($amounts) : null;

                $termDays = $offer['loanTerm']['value'] ?? null;
                $termMonths = $termDays ? (int) round($termDays / 30.4375) : 360;

                $cards[] = [
                    'bank_name' => $bankName,
                    'bank_logo_url' => $bankLogo,
                    'program_name' => $programName,
                    'program_type' => $this->determineProgramType($programName),
                    'interest_rate_min' => (string) $rateMin,
                    'interest_rate_max' => (string) $rateMax,
                    'min_down_payment_percent' => '15',
                    'min_loan_amount' => $minAmt,
                    'max_loan_amount' => $maxAmt,
                    'loan_term_min_months' => 12,
                    'loan_term_max_months' => $termMonths,
                    'property_type' => $this->determinePropertyType($programName),
                    'region' => 'ALL',
                    'application_url' => $offer['potentialAction']['url'] ?? $offer['url'] ?? null,
                ];
            }
        });

        if (!empty($cards)) {
            $io->writeln(sprintf('Извлечено из JSON-LD: %d', count($cards)));
        }

        return $cards;
    }

    private function parseRate(string $rateStr): array
    {
        if (empty($rateStr)) return ['0', '0'];
        $normalized = str_replace(',', '.', $rateStr);
        preg_match_all('/(\d+(?:\.\d+)?)/', $normalized, $matches);
        $floats = array_map('floatval', $matches[1]);
        if (empty($floats)) return ['0', '0'];

        return [(string) min($floats), (string) max($floats)];
    }

    private function parseDownPayment(string $str): string
    {
        if (empty($str)) return '15';
        $normalized = str_replace(',', '.', $str);
        if (preg_match('/(\d+(?:\.\d+)?)/', $normalized, $matches)) {
            return (string) floatval($matches[1]);
        }
        return '15';
    }

    private function determineProgramType(string $name): string
    {
        $nameLower = mb_strtolower($name);
        $governmentKeywords = ['семейная', 'it', 'ит-', 'дальневосточная', 'арктическая', 'сельская', 'военная', 'господдерж'];
        foreach ($governmentKeywords as $keyword) {
            if (str_contains($nameLower, $keyword)) {
                return 'GOVERNMENT';
            }
        }
        return 'STANDARD';
    }

    private function determinePropertyType(string $name): string
    {
        $nameLower = mb_strtolower($name);
        if (str_contains($nameLower, 'новострой') || str_contains($nameLower, 'строящ')) return 'NEW_BUILD';
        if (str_contains($nameLower, 'вторич') || str_contains($nameLower, 'готовое') || str_contains($nameLower, 'апартаменты')) return 'SECONDARY';
        if (str_contains($nameLower, 'дом') || str_contains($nameLower, 'ижс') || str_contains($nameLower, 'таунхаус') || str_contains($nameLower, 'участок')) return 'HOUSE';
        if (str_contains($nameLower, 'коммерч')) return 'COMMERCIAL';
        if (str_contains($nameLower, 'машино-место') || str_contains($nameLower, 'кладовк')) return 'PARKING';
        return 'ALL';
    }
}
