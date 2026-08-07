<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\ApplicationRepository;
use Doctrine\ORM\Mapping as ORM;

/** Заявка пользователя из формы (публичной или партнёрского виджета). */
#[ORM\Entity(repositoryClass: ApplicationRepository::class)]
#[ORM\Table(name: 'applications')]
#[ORM\Index(name: 'idx_app_partner', columns: ['partner_id'])]
#[ORM\Index(name: 'idx_app_created', columns: ['created_at'])]
class Application
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $name = '';

    #[ORM\Column(length: 32)]
    private string $phone = '';

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $email = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $city = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $partnerId = null;

    /** Снимок параметров расчёта на момент заявки. */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $calculationSnapshot = null;

    #[ORM\Column(length: 20)]
    private string $status = 'NEW';

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $v): self { $this->name = $v; return $this; }
    public function getPhone(): string { return $this->phone; }
    public function setPhone(string $v): self { $this->phone = $v; return $this; }
    public function getEmail(): ?string { return $this->email; }
    public function setEmail(?string $v): self { $this->email = $v; return $this; }
    public function getCity(): ?string { return $this->city; }
    public function setCity(?string $v): self { $this->city = $v; return $this; }
    public function getPartnerId(): ?string { return $this->partnerId; }
    public function setPartnerId(?string $v): self { $this->partnerId = $v; return $this; }
    public function getCalculationSnapshot(): ?array { return $this->calculationSnapshot; }
    public function setCalculationSnapshot(?array $v): self { $this->calculationSnapshot = $v; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $v): self { $this->status = $v; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
