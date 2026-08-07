<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Application;
use App\Repository\ApplicationRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/** Приём заявок из публичной формы и партнёрского виджета. */
#[Route('/api/v1')]
final class ApplicationController extends AbstractController
{
    public function __construct(
        private readonly ApplicationRepository $applications,
        private readonly ValidatorInterface $validator,
    ) {
    }

    /** POST /api/v1/application */
    #[Route('/application', name: 'api_application', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent() ?: '{}', true) ?? [];

        $name = trim((string) ($data['name'] ?? ''));
        $phone = preg_replace('/\D+/', '', (string) ($data['phone'] ?? '')) ?? '';
        $email = isset($data['email']) ? trim((string) $data['email']) : null;

        $errors = [];
        // Имя обязательно.
        foreach ($this->validator->validate($name, [new Assert\NotBlank(message: 'Введите имя')]) as $violation) {
            $errors[] = ['field' => 'name', 'message' => $violation->getMessage()];
        }
        // Телефон: минимум 10 цифр.
        foreach ($this->validator->validate($phone, [new Assert\Length(min: 10, minMessage: 'Некорректный номер телефона')]) as $violation) {
            $errors[] = ['field' => 'phone', 'message' => $violation->getMessage()];
        }
        // Email опционален, но если задан — должен быть валидным.
        if ($email !== null && $email !== '') {
            $v = $this->validator->validate($email, [new Assert\Email(message: 'Некорректный email')]);
            foreach ($v as $violation) {
                $errors[] = ['field' => 'email', 'message' => $violation->getMessage()];
            }
        }
        if ($errors !== []) {
            return $this->json(['errors' => $errors], 422);
        }

        $application = (new Application())
            ->setName($name)
            ->setPhone($phone)
            ->setEmail($email !== '' ? $email : null)
            ->setCity(isset($data['city']) ? (string) $data['city'] : null)
            ->setPartnerId(isset($data['partnerId']) ? (string) $data['partnerId'] : null)
            ->setCalculationSnapshot($data['calculation'] ?? null);

        $this->applications->save($application);

        return $this->json(['id' => $application->getId(), 'status' => 'NEW'], 201);
    }
}
