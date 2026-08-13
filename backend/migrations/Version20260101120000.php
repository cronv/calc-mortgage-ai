<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Начальная схема ипотечного калькулятора: bank_products, government_programs, applications.
 * Индексы рассчитаны под высоконагруженные выборки маркетплейса предложений.
 */
final class Version20260101120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Начальная схема: bank_products, government_programs, applications с индексами';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE bank_products (
                id INT AUTO_INCREMENT NOT NULL,
                bank_name VARCHAR(255) NOT NULL,
                bank_logo_url VARCHAR(500) DEFAULT NULL,
                program_name VARCHAR(255) NOT NULL,
                program_type VARCHAR(20) NOT NULL,
                interest_rate_min NUMERIC(5, 2) NOT NULL,
                interest_rate_max NUMERIC(5, 2) NOT NULL,
                min_down_payment_percent NUMERIC(5, 2) NOT NULL,
                max_loan_amount NUMERIC(14, 2) DEFAULT NULL,
                min_loan_amount NUMERIC(14, 2) DEFAULT NULL,
                loan_term_min_months INT NOT NULL,
                loan_term_max_months INT NOT NULL,
                property_type VARCHAR(20) NOT NULL,
                tabs_type VARCHAR(20) NOT NULL DEFAULT 'ALL',
                insurance_required TINYINT(1) NOT NULL,
                rate_without_insurance NUMERIC(4, 2) NOT NULL,
                salary_client_discount NUMERIC(4, 2) NOT NULL,
                electronic_registration_discount NUMERIC(4, 2) NOT NULL,
                region VARCHAR(100) NOT NULL,
                special_conditions JSON DEFAULT NULL,
                application_url VARCHAR(500) DEFAULT NULL,
                source_url VARCHAR(500) DEFAULT NULL,
                parsed_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                is_active TINYINT(1) NOT NULL,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                updated_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX uniq_bank_program (bank_name, program_name),
                INDEX idx_active_type (is_active, program_type),
                INDEX idx_property_type (property_type),
                INDEX idx_tabs_type (tabs_type),
                INDEX idx_term_range (loan_term_min_months, loan_term_max_months),
                INDEX idx_rate (interest_rate_min),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE government_programs (
                id INT AUTO_INCREMENT NOT NULL,
                program_key VARCHAR(50) NOT NULL,
                program_title VARCHAR(255) NOT NULL,
                interest_rate NUMERIC(5, 2) NOT NULL,
                max_loan_amount_moscow NUMERIC(14, 2) DEFAULT NULL,
                max_loan_amount_regions NUMERIC(14, 2) DEFAULT NULL,
                eligibility_criteria JSON DEFAULT NULL,
                property_type VARCHAR(20) NOT NULL,
                parsed_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                is_active TINYINT(1) NOT NULL,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                updated_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX UNIQ_GOV_KEY (program_key),
                INDEX idx_gov_active (is_active),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE applications (
                id INT AUTO_INCREMENT NOT NULL,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(32) NOT NULL,
                email VARCHAR(255) DEFAULT NULL,
                city VARCHAR(100) DEFAULT NULL,
                partner_id VARCHAR(100) DEFAULT NULL,
                calculation_snapshot JSON DEFAULT NULL,
                status VARCHAR(20) NOT NULL,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX idx_app_partner (partner_id),
                INDEX idx_app_created (created_at),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE applications');
        $this->addSql('DROP TABLE government_programs');
        $this->addSql('DROP TABLE bank_products');
    }
}
