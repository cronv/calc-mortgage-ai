#!/bin/sh
set -e
cd /var/www/html

echo "[entrypoint] PHP $(php -r 'echo PHP_VERSION;')"

# 1. Зависимости (идемпотентно: ставим только если нет vendor).
if [ ! -d vendor ]; then
  echo "[entrypoint] composer install..."
  if [ "${APP_ENV}" = "prod" ]; then
    composer install --no-dev --optimize-autoloader --no-interaction --no-progress
  else
    composer install --no-interaction --no-progress
  fi
fi

# 2. Права на var/.
mkdir -p var/cache var/log
chmod -R 777 var || true

# 3. Ждём MySQL.
echo "[entrypoint] ожидание MySQL..."
until php bin/console dbal:run-sql "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done

# 4. Миграции (идемпотентно).
echo "[entrypoint] миграции..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# 5. Фикстуры — только если таблица банков пуста (чтобы не плодить дубли при перезапуске).
COUNT=$(php bin/console dbal:run-sql "SELECT COUNT(*) AS c FROM bank_products" 2>/dev/null | grep -oE '[0-9]+' | head -n1 || echo 0)
if [ "${APP_ENV}" != "prod" ] && [ "${COUNT:-0}" = "0" ]; then
  echo "[entrypoint] загрузка фикстур (БД пуста)..."
  php bin/console doctrine:fixtures:load --no-interaction --append
fi

# 6. Прогрев кэша.
php bin/console cache:warmup || true

echo "[entrypoint] старт php-fpm"
exec "$@"
