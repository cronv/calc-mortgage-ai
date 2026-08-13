# Makefile ипотечного калькулятора.
# Всё выполняется ВНУТРИ контейнеров. На хосте нужны только Docker и Docker Compose.

COMPOSE := $(shell command -v docker-compose 2>/dev/null || echo "docker compose")
PHP     := $(COMPOSE) exec php

.DEFAULT_GOAL := help
.PHONY: help up down restart logs ps bash bash-mysql build front-build \
        db-migrate db-fixtures db-reset cache-clear test test-back test-front lint stop clean

help: ## Список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	awk 'BEGIN {FS=":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## ЕДИНАЯ КОМАНДА: собрать образы, поднять backend+БД, собрать фронт — всё в контейнерах
	@test -f .env || cp .env.example .env
	$(COMPOSE) build
	$(COMPOSE) up -d mysql php nginx
	@echo ">> Сборка фронтенда в контейнере node (npm ci + ng build)..."
	$(COMPOSE) --profile build run --rm node
	@echo ""
	@echo "=================================================="
	@echo " Готово. Открывайте:"
	@echo "   Публичный калькулятор : http://localhost:8080"
	@echo "   Демо виджета          : http://localhost:8080/widget/widget-demo.html"
	@echo "   Healthcheck API       : http://localhost:8080/api/health"
	@echo "=================================================="

down: ## Остановить и удалить контейнеры
	$(COMPOSE) down

restart: ## Перезапуск backend-сервисов
	$(COMPOSE) restart php nginx

logs: ## Логи
	$(COMPOSE) logs -f

ps: ## Статус контейнеров
	$(COMPOSE) ps

build: ## Только пересобрать образы
	$(COMPOSE) build

front-build: ## Пересобрать только фронтенд
	$(COMPOSE) --profile build $(if $(CONFIG),--configuration=$(CONFIG)) run --rm node

bash: ## Шелл в PHP-контейнере
	$(PHP) sh

bash-mysql: ## MySQL-клиент
	$(COMPOSE) exec mysql mysql -uapp -papp mortgage

db-migrate: ## Применить миграции
	$(PHP) php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

db-fixtures: ## Загрузить фикстуры
	$(PHP) php bin/console doctrine:fixtures:load --no-interaction

db-reset: ## Пересоздать БД + фикстуры
	$(PHP) php bin/console doctrine:database:drop --force --if-exists
	$(PHP) php bin/console doctrine:database:create
	$(MAKE) db-migrate
	$(MAKE) db-fixtures

cache-clear: ## Сбросить кэш Symfony
	$(PHP) php bin/console cache:clear

test: test-back test-front ## Все тесты

test-back: ## PHPUnit
	$(PHP) php bin/phpunit

test-front: ## Angular unit-тесты
	$(COMPOSE) --profile build run --rm node sh -c "npm ci && npm test"

lint: ## php-cs-fixer (dry-run)
	$(PHP) vendor/bin/php-cs-fixer fix --dry-run --diff || true

stop: ## Остановить без удаления
	$(COMPOSE) stop

clean: ## Удалить контейнеры, тома и сборки
	$(COMPOSE) down -v
	rm -rf frontend/dist frontend/node_modules backend/vendor backend/var/cache backend/var/log
