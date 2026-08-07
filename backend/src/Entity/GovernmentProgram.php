<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\GovernmentProgramRepository;
use Doctrine\ORM\Mapping as ORM;

/** Госпрограмма (Семейная, IT, Льготная и т.д.) с лимитами по Москве и регионам. */
#[ORM\Entity(repositoryClass: GovernmentProgramRepository::class)]
#[ORM\Table(name: 'government_programs')]
#[ORM\Index(name: 'idx_gov_active', columns: ['is_active'])]
#[ORM\HasLifecycleCallbacks]
class GovernmentProgram
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 50, unique: true)]
    private string $programKey = '';

    #[ORM\Column(length: 255)]
    private string $programTitle = '';

    #[ORM\Column(type: 'decimal', precision: 5, scale: 2)]
    private string $interestRate = '0.00';

    #[ORM\Column(type: 'decimal', precision: 14, scale: 2, nullable: true)]
    private ?string $maxLoanAmountMoscow = null;

    #[ORM\Column(type: 'decimal', precision: 14, scale: 2, nullable: true)]
    private ?string $maxLoanAmountRegions = null;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $eligibilityCriteria = null;

    #[ORM\Column(length: 20)]
    private string $propertyType = 'NEW_BUILDING';

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $parsedAt = null;

    #[ORM\Column(type: 'boolean')]
    private bool $isActive = true;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function touch(): void { $this->updatedAt = new \DateTimeImmutable(); }

    public function getId(): ?int { return $this->id; }
    public function getProgramKey(): string { return $this->programKey; }
    public function setProgramKey(string $v): self { $this->programKey = $v; return $this; }
    public function getProgramTitle(): string { return $this->programTitle; }
    public function setProgramTitle(string $v): self { $this->programTitle = $v; return $this; }
    public function getInterestRate(): string { return $this->interestRate; }
    public function setInterestRate(string $v): self { $this->interestRate = $v; return $this; }
    public function getMaxLoanAmountMoscow(): ?string { return $this->maxLoanAmountMoscow; }
    public function setMaxLoanAmountMoscow(?string $v): self { $this->maxLoanAmountMoscow = $v; return $this; }
    public function getMaxLoanAmountRegions(): ?string { return $this->maxLoanAmountRegions; }
    public function setMaxLoanAmountRegions(?string $v): self { $this->maxLoanAmountRegions = $v; return $this; }
    public function getEligibilityCriteria(): ?array { return $this->eligibilityCriteria; }
    public function setEligibilityCriteria(?array $v): self { $this->eligibilityCriteria = $v; return $this; }
    public function getPropertyType(): string { return $this->propertyType; }
    public function setPropertyType(string $v): self { $this->propertyType = $v; return $this; }
    public function getParsedAt(): ?\DateTimeImmutable { return $this->parsedAt; }
    public function setParsedAt(?\DateTimeImmutable $v): self { $this->parsedAt = $v; return $this; }
    public function isActive(): bool { return $this->isActive; }
    public function setIsActive(bool $v): self { $this->isActive = $v; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
}
