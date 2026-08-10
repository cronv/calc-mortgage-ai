<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\BankProductRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ипотечный продукт банка — единый источник данных для обоих калькуляторов.
 * Индексы подобраны под типовые выборки маркетплейса (фильтр по активности,
 * типу программы, типу недвижимости, диапазону срока).
 */
#[ORM\Entity(repositoryClass: BankProductRepository::class)]
#[ORM\Table(name: 'bank_products')]
#[ORM\UniqueConstraint(name: 'uniq_bank_program', columns: ['bank_name', 'program_name'])]
#[ORM\Index(name: 'idx_active_type', columns: ['is_active', 'program_type'])]
#[ORM\Index(name: 'idx_property_type', columns: ['property_type'])]
#[ORM\Index(name: 'idx_term_range', columns: ['loan_term_min_months', 'loan_term_max_months'])]
#[ORM\Index(name: 'idx_rate', columns: ['interest_rate_min'])]
#[ORM\HasLifecycleCallbacks]
class BankProduct
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $bankName = '';

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $bankLogoUrl = null;

    #[ORM\Column(length: 255)]
    private string $programName = '';

    /** GOVERNMENT | STANDARD | PROMO | REFINANCE */
    #[ORM\Column(length: 20)]
    private string $programType = 'STANDARD';

    #[ORM\Column(type: 'decimal', precision: 5, scale: 2)]
    private string $interestRateMin = '0.00';

    #[ORM\Column(type: 'decimal', precision: 5, scale: 2)]
    private string $interestRateMax = '0.00';

    #[ORM\Column(type: 'decimal', precision: 5, scale: 2)]
    private string $minDownPaymentPercent = '15.00';

    #[ORM\Column(type: 'decimal', precision: 14, scale: 2, nullable: true)]
    private ?string $maxLoanAmount = null;

    #[ORM\Column(type: 'decimal', precision: 14, scale: 2, nullable: true)]
    private ?string $minLoanAmount = null;

    #[ORM\Column(type: 'integer')]
    private int $loanTermMinMonths = 12;

    #[ORM\Column(type: 'integer')]
    private int $loanTermMaxMonths = 360;

    /** NEW_BUILDING | SECONDARY | CONSTRUCTION | ALL */
    #[ORM\Column(length: 20)]
    private string $propertyType = 'ALL';

    #[ORM\Column(type: 'boolean')]
    private bool $insuranceRequired = true;

    #[ORM\Column(type: 'decimal', precision: 4, scale: 2)]
    private string $rateWithoutInsurance = '1.00';

    #[ORM\Column(type: 'decimal', precision: 4, scale: 2)]
    private string $salaryClientDiscount = '0.50';

    #[ORM\Column(type: 'decimal', precision: 4, scale: 2)]
    private string $electronicRegistrationDiscount = '0.30';

    #[ORM\Column(length: 100)]
    private string $region = 'ALL';

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $specialConditions = null;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $applicationUrl = null;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $sourceUrl = null;

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
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function setId(?int $id): self { $this->id = $id; return $this; }

    public function getBankName(): string { return $this->bankName; }
    public function setBankName(string $v): self { $this->bankName = $v; return $this; }

    public function getBankLogoUrl(): ?string { return $this->bankLogoUrl; }
    public function setBankLogoUrl(?string $v): self { $this->bankLogoUrl = $v; return $this; }

    public function getProgramName(): string { return $this->programName; }
    public function setProgramName(string $v): self { $this->programName = $v; return $this; }

    public function getProgramType(): string { return $this->programType; }
    public function setProgramType(string $v): self { $this->programType = $v; return $this; }

    public function getInterestRateMin(): string { return $this->interestRateMin; }
    public function setInterestRateMin(string $v): self { $this->interestRateMin = $v; return $this; }

    public function getInterestRateMax(): string { return $this->interestRateMax; }
    public function setInterestRateMax(string $v): self { $this->interestRateMax = $v; return $this; }

    public function getMinDownPaymentPercent(): string { return $this->minDownPaymentPercent; }
    public function setMinDownPaymentPercent(string $v): self { $this->minDownPaymentPercent = $v; return $this; }

    public function getMaxLoanAmount(): ?string { return $this->maxLoanAmount; }
    public function setMaxLoanAmount(?string $v): self { $this->maxLoanAmount = $v; return $this; }

    public function getMinLoanAmount(): ?string { return $this->minLoanAmount; }
    public function setMinLoanAmount(?string $v): self { $this->minLoanAmount = $v; return $this; }

    public function getLoanTermMinMonths(): int { return $this->loanTermMinMonths; }
    public function setLoanTermMinMonths(int $v): self { $this->loanTermMinMonths = $v; return $this; }

    public function getLoanTermMaxMonths(): int { return $this->loanTermMaxMonths; }
    public function setLoanTermMaxMonths(int $v): self { $this->loanTermMaxMonths = $v; return $this; }

    public function getPropertyType(): string { return $this->propertyType; }
    public function setPropertyType(string $v): self { $this->propertyType = $v; return $this; }

    public function isInsuranceRequired(): bool { return $this->insuranceRequired; }
    public function setInsuranceRequired(bool $v): self { $this->insuranceRequired = $v; return $this; }

    public function getRateWithoutInsurance(): string { return $this->rateWithoutInsurance; }
    public function setRateWithoutInsurance(string $v): self { $this->rateWithoutInsurance = $v; return $this; }

    public function getSalaryClientDiscount(): string { return $this->salaryClientDiscount; }
    public function setSalaryClientDiscount(string $v): self { $this->salaryClientDiscount = $v; return $this; }

    public function getElectronicRegistrationDiscount(): string { return $this->electronicRegistrationDiscount; }
    public function setElectronicRegistrationDiscount(string $v): self { $this->electronicRegistrationDiscount = $v; return $this; }

    public function getRegion(): string { return $this->region; }
    public function setRegion(string $v): self { $this->region = $v; return $this; }

    public function getSpecialConditions(): ?array { return $this->specialConditions; }
    public function setSpecialConditions(?array $v): self { $this->specialConditions = $v; return $this; }

    public function getApplicationUrl(): ?string { return $this->applicationUrl; }
    public function setApplicationUrl(?string $v): self { $this->applicationUrl = $v; return $this; }

    public function getSourceUrl(): ?string { return $this->sourceUrl; }
    public function setSourceUrl(?string $v): self { $this->sourceUrl = $v; return $this; }

    public function getParsedAt(): ?\DateTimeImmutable { return $this->parsedAt; }
    public function setParsedAt(?\DateTimeImmutable $v): self { $this->parsedAt = $v; return $this; }

    public function isActive(): bool { return $this->isActive; }
    public function setIsActive(bool $v): self { $this->isActive = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
}
