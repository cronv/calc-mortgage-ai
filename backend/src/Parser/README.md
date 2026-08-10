# Парсер ипотечных программ Banki.ru

## Архитектура

Новая архитектура парсера основана на **Adapter Pattern** с использованием **генераторов PHP** для эффективной работы с памятью.

### Компоненты

```
src/Parser/
├── AbstractProgramParser.php    # Абстрактный базовый класс
└── Adapter/
    ├── MortgageProgramParser.php     # Парсер обычной ипотеки
    └── RefinanceProgramParser.php    # Парсер рефинансирования
```

## Анализ API Banki.ru

### Откуда берутся цифры uids[]

UID продукта формируется по схеме: `<bank_id><product_type_suffix>`

**Примеры:**
- `1273406` = банк `12734` + тип `06` (mortgage)
- `1231507` = банк `12315` + тип `07` (mortgage_refinance)

**Процесс получения данных:**

1. **Первый запрос** — получаем список продуктов:
```http
GET https://www.banki.ru/bff/catalog/api/v1/widget/group?pageType=CALCHYPOTHEC&productTypes[]=mortgage&requestedAmount=1500000&requestedTerm=20&requestedTermUnit=7&initialFee=2500000&sort=popular&order=desc&page=2&limit=15&isMulti=false&price=4000000&regionId=4&reason=show_more
```

Ответ содержит:
- `offers.items[].items[].uid` — UID каждого продукта
- `offers.items[].partnerData` — информация о банке

2. **Второй запрос** — детали по продуктам:
```http
GET https://www.banki.ru/bff/catalog/api/v2/products?uids[]=1273406&uids[]=1084506&...
```

Ответ содержит детальную информацию:
- `products[].rateFrom` / `products[].rateTo` — процентная ставка
- `products[].amountMin` / `products[].amountMax` — сумма кредита
- `products[].termMin` / `products[].termMax` — срок в днях
- `products[].initialFeePercent` — первоначальный взнос %
- `products[].partner` — информация о банке

### Различия между ипотекой и рефинансированием

| Параметр | Ипотека | Рефинансирование |
|----------|---------|------------------|
| `productTypes[]` | `mortgage` | `mortgage_refinance` |
| `catalog` | (нет) | `refinansirovanie_ipoteki` |
| `requestedAmount` | 1500000 | 3000000 |
| `initialFee` | 2500000 | 3000000 |
| URL калькулятора | `/services/calculators/hypothec/` | `/services/calculators/hypothec/refinansirovanie_ipoteki/` |

## Использование генераторов для экономии памяти

### Почему генераторы?

При парсинге большого количества данных (сотни/тысячи продуктов) традиционный подход с загрузкой всех данных в массив может превысить лимит памяти (256М).

**Генераторы позволяют:**
- Обрабатывать данные порционно (lazy evaluation)
- Не хранить все данные в памяти одновременно
- Освобождать память после каждой итерации через `$em->clear()`

### Пример использования

```php
// В команде ParseProgramsCommand
foreach ($parser->parse(100) as $entity) {
    // Обрабатываем по одному продукту
    $this->em->persist($entity);
    
    // Каждые 50 записей сбрасываем в БД и очищаем память
    if ($batchCount % 50 === 0) {
        $this->em->flush();
        $this->em->clear(); // Освобождает память
    }
}
```

## Запуск парсера

```bash
# Через Docker Compose
docker compose -f compose.yaml -f compose.override.yaml exec backend php bin/console parser:programs

# Или напрямую (если PHP установлен локально)
php bin/console parser:programs
```

Команда автоматически:
1. Запускает все зарегистрированные адаптеры по очереди
2. Для каждого адаптера парсит до 100 продуктов
3. Сохраняет данные порциями по 50 записей
4. Пропускает дубликаты (проверка по паре "банк + программа")

## Современный подход Symfony 7.2+ с PHP 8.4

### Автоматическая регистрация через атрибуты

Вместо ручной регистрации сервисов в `services.yaml`, используется современный подход с атрибутами:

**Адаптеры** используют атрибут `#[AutoconfigureTag('app.program_parser')]`:
```php
#[AutoconfigureTag('app.program_parser')]
class MortgageProgramParser extends AbstractProgramParser
```

**Команда** использует атрибут `#[AutowireIterator]` для получения всех адаптеров:
```php
public function __construct(
    #[AutowireIterator('app.program_parser', defaultPriorityField: 'priority')] 
    private readonly iterable $parsers,
) {}
```

**Преимущества:**
- Никакой YAML-конфигурации для новых адаптеров
- Автоконфигурация через `autoconfigure: true`
- Ленивая загрузка сервисов (lazy loading)
- Типобезопасность через атрибуты PHP 8.4

## Расширение функциональности

### Добавление нового адаптера (Symfony 7.2+ с атрибутами)

1. Создайте класс в `src/Parser/Adapter/`:

```php
<?php

namespace App\Parser\Adapter;

use App\Parser\AbstractProgramParser;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

#[AutoconfigureTag('app.program_parser')]
class FamilyMortgageParser extends AbstractProgramParser
{
    public function getProductType(): string
    {
        return 'family_mortgage';
    }

    public function parse(int $limit = 100): \Generator
    {
        // Ваша логика парсинга
        // Используйте yield для возврата продуктов
        // Пример:
        //   $products = $this->fetchFamilyMortgageData();
        //   foreach ($products as $product) {
        //       yield $this->createBankProduct($product);
        //   }
    }
}
```

2. **Готово!** Никакой регистрации в `services.yaml` не требуется — атрибут `#[AutoconfigureTag]` автоматически зарегистрирует адаптер.

Команда `ParseProgramsCommand` использует атрибут `#[AutowireIterator('app.program_parser', defaultPriorityField: 'priority')]` для автоматического получения всех адаптеров.

### Приоритет выполнения адаптеров

Если нужно контролировать порядок выполнения адаптеров, добавьте свойство `$priority`:

```php
#[AutoconfigureTag('app.program_parser')]
class MortgageProgramParser extends AbstractProgramParser
{
    public static int $priority = 10; // Высокий приоритет
    
    // ...
}
```

Адаптеры с большим priority выполнятся первыми.

## Структура данных BankProduct

| Поле | Описание |
|------|----------|
| `bankName` | Название банка |
| `programName` | Название программы |
| `programType` | STANDARD, GOVERNMENT, REFINANCE |
| `interestRateMin/Max` | Процентная ставка |
| `minDownPaymentPercent` | Первоначальный взнос % |
| `minLoanAmount/Max` | Сумма кредита |
| `loanTermMin/MaxMonths` | Срок кредита в месяцах |
| `propertyType` | NEW_BUILD, SECONDARY, HOUSE, etc. |
| `region` | Регион применения |
| `applicationUrl` | Ссылка на заявку |

## Отладка

Для просмотра детальной информации:

```bash
php bin/console parser:programs -v  # verbose режим
php bin/console parser:programs -vv # debug режим
```

## Производительность

- **Память**: ~10-20МБ при парсинге 100 продуктов (благодаря генераторам)
- **Время**: ~5-10 секунд на 100 продуктов (зависит от скорости API banki.ru)
- **Запросы к API**: 1 запрос на страницу + 1 запрос на каждые 50 UID'ов
