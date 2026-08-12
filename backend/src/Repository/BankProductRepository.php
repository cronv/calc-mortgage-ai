<?php

declare(strict_types=1);

namespace App\Repository;

use App\DTO\ProductSearchCriteria;
use App\Entity\BankProduct;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<BankProduct>
 */
class BankProductRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, BankProduct::class);
    }

    /**
     * Активные продукты под заданные параметры поиска.
     * Один запрос без N+1: возвращаем плоский список сущностей.
     *
     * @return BankProduct[]
     */
    public function findActiveMatching(ProductSearchCriteria $criteria): array
    {
        $qb = $this->createQueryBuilder('p')
            ->andWhere('p.isActive = :active')->setParameter('active', true)
            ->andWhere('p.loanTermMinMonths <= :term')
            ->andWhere('p.loanTermMaxMonths >= :term')
            ->setParameter('term', $criteria->termMonths);

        if ($criteria->region !== 'ALL') {
            $qb->andWhere('p.region IN (:regions)')->setParameter('regions', [$criteria->region, 'ALL']);
        }

        // propertyType теперь необязательный параметр
        if ($criteria->propertyType !== null && $criteria->propertyType !== 'ALL') {
            $qb->andWhere('p.propertyType IN (:ptypes)')->setParameter('ptypes', [$criteria->propertyType, 'ALL']);
        }

        // programType - новый обязательный фильтр для разделения mortgage / mortgage_refinance
        if ($criteria->programType !== null) {
            // Сопоставляем programType из DTO (mortgage, mortgage_refinance) с program_type в БД (STANDARD, REFINANCE)
            $programTypes = $this->mapProgramTypeToDbValues($criteria->programType);
            $qb->andWhere('p.programType IN (:programTypes)')->setParameter('programTypes', $programTypes);
        }

        if ($criteria->loanAmount > 0) {
            $qb->andWhere('(p.minLoanAmount IS NULL OR p.minLoanAmount <= :loan)')
               ->andWhere('(p.maxLoanAmount IS NULL OR p.maxLoanAmount >= :loan)')
               ->setParameter('loan', $criteria->loanAmount);
        }

        return $qb->orderBy('p.interestRateMin', 'ASC')->getQuery()->getResult();
    }

    /**
     * Сопоставляет programType (mortgage, mortgage_refinance) со значениями в БД.
     *
     * @return string[]
     */
    private function mapProgramTypeToDbValues(string $programType): array
    {
        return match ($programType) {
            'mortgage' => ['STANDARD', 'GOVERNMENT'],
            'mortgage_refinance' => ['REFINANCE'],
            default => ['STANDARD', 'GOVERNMENT', 'REFINANCE'],
        };
    }

    /** Upsert по уникальному ключу (bank_name, program_name). */
    public function findOneByBankAndProgram(string $bankName, string $programName): ?BankProduct
    {
        return $this->findOneBy(['bankName' => $bankName, 'programName' => $programName]);
    }
}
