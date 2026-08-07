<?php

declare(strict_types=1);

namespace App\DataFixtures;

use App\Entity\BankProduct;
use App\Entity\GovernmentProgram;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * Демо-данные: банковские продукты и госпрограммы.
 * Загружаются автоматически в dev при первом старте контейнера,
 * чтобы маркетплейс предложений был непустым сразу после `make up`.
 */
final class AppFixtures extends Fixture
{
    public function load(ObjectManager $manager): void
    {
        foreach ($this->bankProducts() as $data) {
            $product = (new BankProduct())
                ->setBankName($data['bank'])
                ->setBankLogoUrl($data['logo'])
                ->setProgramName($data['program'])
                ->setProgramType($data['type'])
                ->setInterestRateMin($data['rate_min'])
                ->setInterestRateMax($data['rate_max'])
                ->setMinDownPaymentPercent($data['down'])
                ->setMaxLoanAmount($data['max_loan'])
                ->setMinLoanAmount('300000.00')
                ->setLoanTermMinMonths(12)
                ->setLoanTermMaxMonths(360)
                ->setPropertyType($data['property'])
                ->setInsuranceRequired(true)
                ->setRegion('ALL')
                ->setApplicationUrl($data['url'])
                ->setSourceUrl('https://www.banki.ru/services/calculators/hypothec/')
                ->setParsedAt(new \DateTimeImmutable())
                ->setSpecialConditions($data['special'])
                ->setIsActive(true);
            $manager->persist($product);
        }

        foreach ($this->governmentPrograms() as $g) {
            $program = (new GovernmentProgram())
                ->setProgramKey($g['key'])
                ->setProgramTitle($g['title'])
                ->setInterestRate($g['rate'])
                ->setMaxLoanAmountMoscow($g['moscow'])
                ->setMaxLoanAmountRegions($g['regions'])
                ->setEligibilityCriteria($g['criteria'])
                ->setPropertyType('NEW_BUILDING')
                ->setParsedAt(new \DateTimeImmutable())
                ->setIsActive(true);
            $manager->persist($program);
        }

        $manager->flush();
    }

    /** @return array<int, array<string, mixed>> */
    private function bankProducts(): array
    {
        return [
            ['bank' => 'СберБанк', 'logo' => null, 'program' => 'Базовая ипотека', 'type' => 'STANDARD', 'rate_min' => '16.40', 'rate_max' => '18.50', 'down' => '15.00', 'max_loan' => '30000000.00', 'property' => 'ALL', 'url' => 'https://www.sberbank.ru/', 'special' => null],
            ['bank' => 'ВТБ', 'logo' => null, 'program' => 'Победа над формальностями', 'type' => 'STANDARD', 'rate_min' => '16.60', 'rate_max' => '18.70', 'down' => '20.00', 'max_loan' => '30000000.00', 'property' => 'ALL', 'url' => 'https://www.vtb.ru/', 'special' => null],
            ['bank' => 'Альфа-Банк', 'logo' => null, 'program' => 'Альфа-Ипотека', 'type' => 'STANDARD', 'rate_min' => '16.20', 'rate_max' => '18.30', 'down' => '15.00', 'max_loan' => '25000000.00', 'property' => 'ALL', 'url' => 'https://alfabank.ru/', 'special' => null],
            ['bank' => 'Газпромбанк', 'logo' => null, 'program' => 'Ипотека на жильё', 'type' => 'STANDARD', 'rate_min' => '16.50', 'rate_max' => '18.40', 'down' => '20.00', 'max_loan' => '30000000.00', 'property' => 'ALL', 'url' => 'https://www.gazprombank.ru/', 'special' => null],
            ['bank' => 'СберБанк', 'logo' => null, 'program' => 'Семейная ипотека', 'type' => 'GOVERNMENT', 'rate_min' => '5.90', 'rate_max' => '6.00', 'down' => '20.00', 'max_loan' => '12000000.00', 'property' => 'NEW_BUILDING', 'url' => 'https://www.sberbank.ru/family', 'special' => ['family_children' => true, 'min_child_age' => 0]],
            ['bank' => 'ВТБ', 'logo' => null, 'program' => 'IT-ипотека', 'type' => 'GOVERNMENT', 'rate_min' => '4.70', 'rate_max' => '5.00', 'down' => '20.00', 'max_loan' => '18000000.00', 'property' => 'NEW_BUILDING', 'url' => 'https://www.vtb.ru/it', 'special' => ['it_employee' => true]],
            ['bank' => 'Дом.РФ', 'logo' => null, 'program' => 'Дальневосточная ипотека', 'type' => 'GOVERNMENT', 'rate_min' => '1.90', 'rate_max' => '2.00', 'down' => '20.00', 'max_loan' => '9000000.00', 'property' => 'NEW_BUILDING', 'url' => 'https://домрф.рф/', 'special' => ['region' => 'far_east', 'max_age' => 35]],
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function governmentPrograms(): array
    {
        return [
            ['key' => 'FAMILY', 'title' => 'Семейная ипотека', 'rate' => '6.00', 'moscow' => '12000000.00', 'regions' => '6000000.00', 'criteria' => ['children' => true]],
            ['key' => 'IT', 'title' => 'IT-ипотека', 'rate' => '5.00', 'moscow' => '18000000.00', 'regions' => '9000000.00', 'criteria' => ['it_employee' => true]],
            ['key' => 'PREFERENTIAL', 'title' => 'Льготная ипотека', 'rate' => '8.00', 'moscow' => '12000000.00', 'regions' => '6000000.00', 'criteria' => []],
            ['key' => 'RURAL', 'title' => 'Сельская ипотека', 'rate' => '3.00', 'moscow' => '6000000.00', 'regions' => '3000000.00', 'criteria' => ['rural_area' => true]],
            ['key' => 'FAR_EAST', 'title' => 'Дальневосточная ипотека', 'rate' => '2.00', 'moscow' => '9000000.00', 'regions' => '6000000.00', 'criteria' => ['region' => 'far_east', 'max_age' => 35]],
        ];
    }
}
