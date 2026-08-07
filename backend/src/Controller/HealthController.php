<?php

declare(strict_types=1);

namespace App\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** Healthcheck для оркестратора и nginx. */
final class HealthController extends AbstractController
{
    public function __construct(private readonly Connection $connection)
    {
    }

    #[Route('/api/health', name: 'api_health', methods: ['GET'])]
    public function health(): JsonResponse
    {
        $db = 'down';
        try {
            $this->connection->executeQuery('SELECT 1');
            $db = 'up';
        } catch (\Throwable) {
            $db = 'down';
        }

        return $this->json([
            'status'   => $db === 'up' ? 'ok' : 'degraded',
            'database' => $db,
            'time'     => (new \DateTimeImmutable())->format('c'),
        ], $db === 'up' ? 200 : 503);
    }
}
