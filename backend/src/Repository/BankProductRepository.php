<?php

declare(strict_types=1);

namespace App\Repository;

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
     * Активные продукты под заданные сумму, срок, регион и тип недвижимости/программы.
     * Один запрос без N+1: возвращаем плоский список сущностей.
     *
     * @return BankProduct[]
     */
    public function findActiveMatching(
        \App\DTO\ProductMatchCriteria $criteria,
    ): array {
        $qb = $this->createQueryBuilder('p')
            ->andWhere('p.isActive = :active')->setParameter('active', true)
            ->andWhere('p.loanTermMinMonths <= :term')
            ->andWhere('p.loanTermMaxMonths >= :term')
            ->setParameter('term', $criteria->termMonths);

        if ($criteria->region !== 'ALL') {
            $qb->andWhere('p.region IN (:regions)')->setParameter('regions', [$criteria->region, 'ALL']);
        }
        
        // Фильтрация по propertyType (опционально)
        if ($criteria->propertyType !== null && $criteria->propertyType !== 'ALL') {
            $qb->andWhere('p.propertyType IN (:ptypes)')->setParameter('ptypes', [$criteria->propertyType, 'ALL']);
        }
        
        // Фильтрация по programType (mortgage или mortgage_refinance)
        if ($criteria->programType !== null) {
            // Сопоставляем productType из парсера с program_type в БД
            // mortgage -> STANDARD, GOVERNMENT
            // mortgage_refinance -> REFINANCE
            if ($criteria->programType === 'mortgage') {
                $qb->andWhere('p.programType IN (:progTypes)')
                   ->setParameter('progTypes', ['STANDARD', 'GOVERNMENT']);
            } elseif ($criteria->programType === 'mortgage_refinance') {
                $qb->andWhere('p.programType = :refinanceType')
                   ->setParameter('refinanceType', 'REFINANCE');
            }
        }
        
        if ($criteria->loanAmount > 0) {
            $qb->andWhere('(p.minLoanAmount IS NULL OR p.minLoanAmount <= :loan)')
               ->andWhere('(p.maxLoanAmount IS NULL OR p.maxLoanAmount >= :loan)')
               ->setParameter('loan', $criteria->loanAmount);
        }

        return $qb->orderBy('p.interestRateMin', 'ASC')->getQuery()->getResult();
    }

    /** Upsert по уникальному ключу (bank_name, program_name). */
    public function findOneByBankAndProgram(string $bankName, string $programName): ?BankProduct
    {
        return $this->findOneBy(['bankName' => $bankName, 'programName' => $programName]);
    }
}
