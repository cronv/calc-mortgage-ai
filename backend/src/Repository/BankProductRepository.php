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
     * Активные продукты по типу программы (mortgage, mortgage_refinance).
     * Фильтрует по диапазону суммы и срока.
     *
     * @return BankProduct[]
     */
    public function findActiveByProgramType(
        string $programType,
        float $loanAmount,
        int $termMonths,
    ): array {
        $qb = $this->createQueryBuilder('p')
            ->andWhere('p.isActive = :active')->setParameter('active', true)
            ->andWhere('p.programType = :programType')->setParameter('programType', $programType)
            ->andWhere('p.loanTermMinMonths <= :term')
            ->andWhere('p.loanTermMaxMonths >= :term')
            ->setParameter('term', $termMonths);

        if ($loanAmount > 0) {
            $qb->andWhere('(p.minLoanAmount IS NULL OR p.minLoanAmount <= :loan)')
               ->andWhere('(p.maxLoanAmount IS NULL OR p.maxLoanAmount >= :loan)')
               ->setParameter('loan', $loanAmount);
        }

        return $qb->orderBy('p.interestRateMin', 'ASC')->getQuery()->getResult();
    }

    /**
     * Активные продукты под заданные сумму, срок, регион и тип недвижимости.
     * Один запрос без N+1: возвращаем плоский список сущностей.
     *
     * @return BankProduct[]
     * @deprecated Используйте findActiveByProgramType()
     */
    public function findActiveMatching(
        string $region,
        string $propertyType,
        float $loanAmount,
        int $termMonths,
    ): array {
        $qb = $this->createQueryBuilder('p')
            ->andWhere('p.isActive = :active')->setParameter('active', true)
            ->andWhere('p.loanTermMinMonths <= :term')
            ->andWhere('p.loanTermMaxMonths >= :term')
            ->setParameter('term', $termMonths);

        if ($region !== 'ALL') {
            $qb->andWhere('p.region IN (:regions)')->setParameter('regions', [$region, 'ALL']);
        }
        if ($propertyType !== 'ALL') {
            $qb->andWhere('p.propertyType IN (:ptypes)')->setParameter('ptypes', [$propertyType, 'ALL']);
        }
        if ($loanAmount > 0) {
            $qb->andWhere('(p.minLoanAmount IS NULL OR p.minLoanAmount <= :loan)')
               ->andWhere('(p.maxLoanAmount IS NULL OR p.maxLoanAmount >= :loan)')
               ->setParameter('loan', $loanAmount);
        }

        return $qb->orderBy('p.interestRateMin', 'ASC')->getQuery()->getResult();
    }

    /** Upsert по уникальному ключу (bank_name, program_name). */
    public function findOneByBankAndProgram(string $bankName, string $programName): ?BankProduct
    {
        return $this->findOneBy(['bankName' => $bankName, 'programName' => $programName]);
    }
}
