<?php

declare(strict_types=1);

namespace App\Command;

use App\Parser\AbstractProgramParser;
use App\Repository\BankProductRepository;
use App\Service\BatchProcessor;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;

#[AsCommand(
    name: 'parser:programs',
    description: 'Парсинг ипотечных программ из banki.ru через адаптеры с использованием генераторов',
)]
final class ParseProgramsCommand extends Command
{
    /**
     * @param iterable<AbstractProgramParser> $parsers
     */
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly BatchProcessor $batchProcessor,
        private readonly BankProductRepository $repository,
        #[AutowireIterator('app.program_parser', defaultPriorityField: 'priority')] private readonly iterable $parsers,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('Парсинг ипотечных программ (Adapter Pattern + Generators)');

        $totalNew = 0;
        $totalUpdated = 0;
        $processedKeys = []; // Глобальный кеш для защиты от дублей

        foreach ($this->parsers as $parser) {
            $productType = $parser->getProductType();
            $io->section(sprintf('Парсинг: %s', $productType));

            $new = 0;
            $updated = 0;

            try {
                // Создаём генератор сущностей с дедупликацией и логикой обновления
                $entityGenerator = $this->createEntityGenerator($parser, $new, $updated, $processedKeys);

                // Используем BatchProcessor для пакетной записи
                $count = $this->batchProcessor->process($entityGenerator);

                $totalNew += $new;
                $totalUpdated += $updated;

                $io->success(sprintf('Готово (%s). Обработано: %d (новых: %d, обновлено: %d)', $productType, $count, $new, $updated));
            } catch (\Throwable $e) {
                $io->error(sprintf('Ошибка при парсинге %s: %s', $productType, $e->getMessage()));
                // Продолжаем с следующим адаптером
            }
        }

        $io->success(sprintf('Всего завершено. Новых: %d, обновлено: %d', $totalNew, $totalUpdated));

        return Command::SUCCESS;
    }

    /**
     * Создаёт генератор сущностей с дедупликацией и логикой обновления/создания.
     *
     * @param AbstractProgramParser $parser Парсер для получения данных
     * @param int &$new Счётчик новых записей (передаётся по ссылке)
     * @param int &$updated Счётчик обновлённых записей (передаётся по ссылке)
     * @param array<string, bool> &$processedKeys Кеш обработанных ключей (передаётся по ссылке)
     * @return \Generator<\App\Entity\BankProduct>
     */
    private function createEntityGenerator(
        AbstractProgramParser $parser,
        int &$new,
        int &$updated,
        array &$processedKeys
    ): \Generator {
        foreach ($parser->parse(100) as $entity) {
            // Нормализуем ключ для проверки на дубли
            $uniqueKey = mb_strtolower(trim($entity->getBankName()) . '|' . trim($entity->getProgramName()));

            if (isset($processedKeys[$uniqueKey])) {
                continue; // Пропускаем дубль
            }
            $processedKeys[$uniqueKey] = true;

            $existing = $this->repository->findOneByBankAndProgram($entity->getBankName(), $entity->getProgramName());
            $isNew = $existing === null;

            if (!$isNew) {
                // Обновляем существующий entity
                $entity->setId($existing->getId());
                $this->em->merge($entity);
                $updated++;
            } else {
                $this->em->persist($entity);
                $new++;
            }

            yield $entity;
        }
    }
}
