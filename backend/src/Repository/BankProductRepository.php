<?php

declare(strict_types=1);

namespace App\Repository;

use App\DTO\ProductMatchCriteria;
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
     * Активные продукты под заданные критерии: регион, тип недвижимости, тип программы, сумму и срок.
     * Один запрос без N+1: возвращаем плоский список сущностей.
     *
     * @return BankProduct[]
     */
    public function findActiveMatching(ProductMatchCriteria $criteria): array
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
        if ($criteria->propertyType) {
            $qb->andWhere('p.propertyType IN (:ptypes)')->setParameter('ptypes', [$criteria->propertyType]);
        }

        // programType — новый обязательный фильтр для разделения mortgage / mortgage_refinance
        if ($criteria->programType) {
            $qb->andWhere('p.programType = :ptype')->setParameter('ptype', $criteria->programType);
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
