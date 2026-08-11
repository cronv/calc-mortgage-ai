<?php

declare(strict_types=1);

namespace App\Service;

use Doctrine\ORM\EntityManagerInterface;
use Generator;

/**
 * Универсальный процессор для пакетной записи сущностей.
 * Предотвращает переполнение памяти при обработке больших объемов данных.
 *
 * @template T
 */
readonly class BatchProcessor
{
    /**
     * @param int $batchSize Размер пачки для flush/clear
     */
    public function __construct(
        private EntityManagerInterface $em,
        private int                    $batchSize = 50
    ) {
    }

    /**
     * Обрабатывает генератор сущностей, сохраняя их пачками.
     * Автоматически вызывает flush() и clear() каждые $batchSize итераций.
     *
     * @param Generator<T> $itemsGenerator Генератор, возвращающий сущности
     * @param callable(T): void|null $persistCallback Опциональный колбэк для дополнительной логики перед persist
     *
     * @return int Количество сохраненных сущностей
     */
    public function process(Generator $itemsGenerator, ?callable $persistCallback = null): int
    {
        $count = 0;

        foreach ($itemsGenerator as $item) {
            if ($persistCallback !== null) {
                $persistCallback($item);
            } else {
                // Если нет callback, используем стандартную логику: persist для новых, merge для существующих
                if ($item->getId() !== null) {
                    $this->em->merge($item);
                } else {
                    $this->em->persist($item);
                }
            }

            $count++;

            // Если достигли размера пачки — сбрасываем и чистим память
            if (($count % $this->batchSize) === 0) {
                $this->flushAndClear();
            }
        }

        // Финальный сброс оставшихся сущностей
        if ($count > 0 && ($count % $this->batchSize) !== 0) {
            $this->flushAndClear();
        }

        return $count;
    }

    /**
     * Принудительный сброс и очистка памяти.
     * Полезно вызывать вручную в конце сложных процессов или при переходе между этапами.
     */
    public function flushAndClear(): void
    {
        $this->em->flush();
        $this->em->clear();
    }

    /**
     * Получает текущий размер пачки.
     */
    public function getBatchSize(): int
    {
        return $this->batchSize;
    }
}
