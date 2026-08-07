<?php

declare(strict_types=1);

namespace App;

use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;

/**
 * Ядро приложения. Использует MicroKernelTrait: автозагрузка бандлов из config/bundles.php,
 * конфигурация из config/packages, маршруты из config/routes.
 */
final class Kernel extends BaseKernel
{
    use MicroKernelTrait;
}
