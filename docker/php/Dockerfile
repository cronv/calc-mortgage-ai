# syntax=docker/dockerfile:1
# PHP 8.4 FPM на Alpine: расширения для Symfony 7.2 + Doctrine (MySQL), OPcache, bcmath.
FROM php:8.4-fpm-alpine AS base

# Системные зависимости и сборочные пакеты (virtual-группа удаляется после сборки).
RUN apk add --no-cache \
        git \
        unzip \
        icu-libs \
        oniguruma \
        libzip \
    && apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        icu-dev \
        oniguruma-dev \
        libzip-dev \
    && docker-php-ext-configure intl \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        intl \
        bcmath \
        opcache \
        zip \
    && pecl install apcu \
    && docker-php-ext-enable apcu \
    && apk del .build-deps

# Composer из официального образа.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Production-конфиг php.ini + OPcache.
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php/opcache.ini "$PHP_INI_DIR/conf.d/10-opcache.ini"
COPY docker/php/php-custom.ini "$PHP_INI_DIR/conf.d/20-custom.ini"

WORKDIR /var/www/html

# Entrypoint: ставит зависимости, прогоняет миграции и фикстуры, прогревает кэш, затем php-fpm.
COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]
