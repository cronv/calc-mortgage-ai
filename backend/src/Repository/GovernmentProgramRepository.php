<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\GovernmentProgram;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<GovernmentProgram>
 */
class GovernmentProgramRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GovernmentProgram::class);
    }

    public function findOneByKey(string $key): ?GovernmentProgram
    {
        return $this->findOneBy(['programKey' => $key]);
    }

    /** @return GovernmentProgram[] */
    public function findActive(): array
    {
        return $this->findBy(['isActive' => true]);
    }
}
