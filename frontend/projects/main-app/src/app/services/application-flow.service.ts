import { Injectable, signal, computed } from '@angular/core';
import type { BankOffer } from './offers.service';
import { annuityPayment } from '../core/mortgage-math';
import { PROPERTY_PRESETS } from '../services/mortgage.service';
import { PROPERTY_TYPE_TO_KEY } from '../core/anketa-data';

/** Этапы мастера: 5 шагов + авторизация (после шага 1) + финал. */
export type WizardStage = 's1' | 'auth' | 'code' | 's2' | 's3' | 's4' | 's5' | 'done';

export interface Coborrower { lastName: string; firstName: string; middleName: string; phone: string }

/** Данные анкеты заёмщика (5 шагов). */
export interface AnketaData {
  // Шаг 1 — параметры кредита
  propertyType: string;
  cost: number;
  down: number;
  termValue: number;
  termUnit: 'years' | 'months';
  // Авторизация
  phone: string;
  // Шаг 2 — контакты
  city: string;
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  income: number;
  // Шаг 3 — паспорт и адреса
  gender: 'm' | 'f';
  passport: string;
  passportCode: string;
  passportDate: string;
  birthPlace: string;
  passportIssuer: string;
  birthDate: string;
  nameUnchanged: boolean;
  prevLastName: string;
  prevFirstName: string;
  prevMiddleName: string;
  regAddress: string;
  regDate: string;
  liveSameAsReg: boolean;
  liveAddress: string;
  liveDate: string;
  // Шаг 4 — работа
  employment: string;
  workStart: string;
  position: string;
  orgName: string;
  workPhone: string;
  staffCount: string;
  orgType: string;
  industry: string;
  orgAddress: string;
  inn: string;
  salaryBank: string;
  experience: string;
  // Шаг 5 — семья
  marital: string;
  prenup: string;               // has | no_count | no_skip | ''
  coborrowers: Coborrower[];
  children: string;
  useMatCapital: '' | 'yes' | 'no';
  education: string;
  creditPayments: number;
  snils: string;
}

const EMPTY: AnketaData = {
  propertyType: '', cost: 2_500_000, down: 500_000, termValue: 20, termUnit: 'years',
  phone: '',
  city: '', lastName: '', firstName: '', middleName: '', email: '', income: 0,
  gender: 'm', passport: '', passportCode: '', passportDate: '', birthPlace: '',
  passportIssuer: '', birthDate: '', nameUnchanged: true,
  prevLastName: '', prevFirstName: '', prevMiddleName: '',
  regAddress: '', regDate: '', liveSameAsReg: true, liveAddress: '', liveDate: '',
  employment: '', workStart: '', position: '', orgName: '', workPhone: '',
  staffCount: '', orgType: '', industry: '', orgAddress: '', inn: '', salaryBank: '', experience: '',
  marital: '', prenup: '', coborrowers: [], children: '', useMatCapital: '',
  education: '', creditPayments: 0, snils: '',
};

/** Получить ставку по типу недвижимости. Если тип не найден — вернуть defaultRate. */
function getRateForPropertyType(propertyType: string, defaultRate: number): number {
  const key = PROPERTY_TYPE_TO_KEY[propertyType];
  if (!key) return defaultRate;
  const preset = PROPERTY_PRESETS.find((p) => p.key === key);
  return preset ? preset.rate : defaultRate;
}

/**
 * Состояние 5-шаговой анкеты заёмщика: открытие из карточки банка или по ссылке,
 * навигация по шагам с «Назад», авторизация по телефону, сводка для PDF/Word,
 * ссылка на заполнение для заёмщика.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationFlowService {
  readonly opened = signal(false);
  readonly stage = signal<WizardStage>('s1');
  readonly offer = signal<BankOffer | null>(null);
  readonly rate = signal(15.5);
  readonly authorized = signal(false);
  readonly data = signal<AnketaData>({ ...EMPTY });

  /** Номер шага для прогресса «Шаг N из 5» (auth относится к шагу 1). */
  readonly stepNumber = computed(() => {
    switch (this.stage()) {
      case 's1': case 'auth': case 'code': return 1;
      case 's2': return 2;
      case 's3': return 3;
      case 's4': return 4;
      default: return 5;
    }
  });

  readonly months = computed(() => {
    const d = this.data();
    return d.termUnit === 'years' ? d.termValue * 12 : d.termValue;
  });
  readonly loan = computed(() => Math.max(0, this.data().cost - this.data().down));
  readonly payment = computed(() => annuityPayment(this.loan(), Math.max(1, this.months()), this.rate()));

  /** Обновление ставки при изменении типа недвижимости. */
  updateRateForPropertyType(): void {
    const d = this.data();
    if (!d.propertyType || !this.offer()) return;
    const newRate = getRateForPropertyType(d.propertyType, this.offer()!.calculated_rate);
    this.rate.set(newRate);
  }

  patch(part: Partial<AnketaData>): void {
    this.data.update((d) => ({ ...d, ...part }));
  }

  /** Открыть анкету из карточки предложения. */
  open(offer: BankOffer, prefill: { cost: number; down: number; years: number; propertyLabel: string }): void {
    this.offer.set(offer);
    this.rate.set(offer.calculated_rate);
    this.data.set({
      ...EMPTY,
      cost: prefill.cost, down: prefill.down,
      termValue: prefill.years, termUnit: 'years',
      propertyType: prefill.propertyLabel,
    });
    this.updateRateForPropertyType();
    this.stage.set('s1');
    this.opened.set(true);
    this.syncUrl();
  }

  /** Открытие по «расшаренной» ссылке (?apply=1&...). */
  openFromUrl(q: URLSearchParams): void {
    const num = (k: string, def: number): number => {
      const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? v : def;
    };
    this.rate.set(num('rate', 15.5));
    const bank = q.get('bank');
    const logo = q.get('logo');
    if (bank) {
      this.offer.set({
        bank_name: bank, bank_logo_url: logo, program_name: q.get('prog') ?? 'Стандартная',
        program_type: 'STANDARD', calculated_rate: this.rate(),
        monthly_payment: 0, overpayment: 0, total_payout: 0,
        min_down_payment: 0, application_url: null,
      });
    }
    this.data.set({
      ...EMPTY,
      cost: num('cost', EMPTY.cost),
      down: num('down', EMPTY.down),
      termValue: num('term', 20),
      termUnit: q.get('unit') === 'months' ? 'months' : 'years',
      propertyType: q.get('pt') ?? '',
    });
    this.updateRateForPropertyType();
    this.stage.set('s1');
    this.opened.set(true);
  }

  /** Ссылка на заполнение анкеты для заёмщика. */
  buildLink(): string {
    const d = this.data();
    const q = new URLSearchParams({
      apply: '1',
      cost: String(d.cost), down: String(d.down),
      term: String(d.termValue), unit: d.termUnit,
      rate: String(this.rate()),
    });
    if (d.propertyType) q.set('pt', d.propertyType);
    const o = this.offer();
    if (o) {
      q.set('bank', o.bank_name);
      q.set('prog', o.program_name);
      if (o.bank_logo_url) q.set('logo', o.bank_logo_url);
    }
    return `${location.origin}${location.pathname}?${q.toString()}`;
  }

  next(): void {
    const s = this.stage();
    if (s === 's1') this.stage.set(this.authorized() ? 's2' : 'auth');
    else if (s === 'auth') this.stage.set('code');
    else if (s === 'code') { this.authorized.set(true); this.stage.set('s2'); }
    else if (s === 's2') this.stage.set('s3');
    else if (s === 's3') this.stage.set('s4');
    else if (s === 's4') this.stage.set('s5');
    else if (s === 's5') this.stage.set('done');
    this.scrollTop();
  }

  /** «Назад» на каждом шаге (по ТЗ). */
  back(): void {
    const s = this.stage();
    if (s === 's1') { this.close(); return; }
    if (s === 'auth') this.stage.set('s1');
    else if (s === 'code') this.stage.set('auth');
    else if (s === 's2') this.stage.set('s1');
    else if (s === 's3') this.stage.set('s2');
    else if (s === 's4') this.stage.set('s3');
    else if (s === 's5') this.stage.set('s4');
    this.scrollTop();
  }

  close(): void {
    this.opened.set(false);
    if (typeof history !== 'undefined') {
      history.replaceState(null, '', location.pathname);
    }
  }

  private syncUrl(): void {
    if (typeof history !== 'undefined') {
      history.replaceState(null, '', this.buildLink());
    }
  }

  private scrollTop(): void {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Сводка анкеты для PDF/Word: секции с парами «поле — значение». */
  summary(): Array<{ title: string; rows: Array<[string, string]> }> {
    const d = this.data();
    const o = this.offer();
    const money = (v: number): string => v > 0 ? v.toLocaleString('ru-RU') + ' ₽' : '—';
    const t = (v: string): string => v || '—';
    const unitLabel = d.termUnit === 'years' ? 'лет' : 'мес.';
    const kids = d.children === '' ? '—' : d.children;

    const rows5: Array<[string, string]> = [
      ['Семейное положение', t(d.marital)],
      ['Дети до 18 лет', kids],
    ];
    if (d.marital === 'Женат/замужем') {
      const pren: Record<string, string> = {
        has: 'Есть брачный договор',
        no_count: 'Нет брачного договора, учитывать доходы супруга',
        no_skip: 'Нет брачного договора, не учитывать доходы супруга',
      };
      rows5.push(['Брачный договор', pren[d.prenup] ?? '—']);
      d.coborrowers.forEach((c, i) => rows5.push([
        `Созаёмщик ${i + 1}`,
        `${c.lastName} ${c.firstName} ${c.middleName}, тел. ${c.phone}`.trim(),
      ]));
    }
    if (d.children !== '' && d.children !== 'Нет') {
      rows5.push(['Материнский капитал', d.useMatCapital === 'yes' ? 'Да' : d.useMatCapital === 'no' ? 'Нет' : '—']);
    }
    rows5.push(
      ['Образование', t(d.education)],
      ['Траты по кредитам в месяц', money(d.creditPayments)],
      ['СНИЛС', t(d.snils)],
    );

    return [
      { title: 'Параметры кредита', rows: [
        ['Банк', o ? `${o.bank_name} · ${o.program_name} · от ${this.rate()}%` : '—'],
        ['Тип недвижимости', t(d.propertyType)],
        ['Стоимость недвижимости', money(d.cost)],
        ['Первоначальный взнос', money(d.down)],
        ['Срок', `${d.termValue} ${unitLabel}`],
        ['Сумма кредита', money(this.loan())],
        ['Ежемесячный платёж (расчётный)', money(Math.round(this.payment()))],
      ]},
      { title: 'Контактные данные', rows: [
        ['Телефон', t(d.phone)],
        ['Город получения кредита', t(d.city)],
        ['ФИО', `${d.lastName} ${d.firstName} ${d.middleName}`.trim() || '—'],
        ['Электронная почта', t(d.email)],
        ['Ежемесячный доход', money(d.income)],
      ]},
      { title: 'Паспортные данные и адреса', rows: [
        ['Пол', d.gender === 'm' ? 'Мужчина' : 'Женщина'],
        ['Серия и номер паспорта', t(d.passport)],
        ['Код подразделения', t(d.passportCode)],
        ['Дата выдачи', t(d.passportDate)],
        ['Кем выдан', t(d.passportIssuer)],
        ['Место рождения', t(d.birthPlace)],
        ['Дата рождения', t(d.birthDate)],
        ['ФИО менялось', d.nameUnchanged ? 'Нет' : `Да (${d.prevLastName} ${d.prevFirstName} ${d.prevMiddleName})`.trim()],
        ['Адрес регистрации', t(d.regAddress)],
        ['Дата регистрации', t(d.regDate)],
        ['Адрес проживания', d.liveSameAsReg ? 'Совпадает с регистрацией' : t(d.liveAddress)],
      ]},
      { title: 'Работа, доход и стаж', rows: [
        ['Тип занятости', t(d.employment)],
        ['Начало работы на последнем месте', t(d.workStart)],
        ['Должность', t(d.position)],
        ['Организация', t(d.orgName)],
        ['Рабочий телефон', t(d.workPhone)],
        ['Численность работников', t(d.staffCount)],
        ['Тип организации', t(d.orgType)],
        ['Сфера деятельности', t(d.industry)],
        ['Адрес организации', t(d.orgAddress)],
        ['ИНН', t(d.inn)],
        ['Зарплатный банк', t(d.salaryBank)],
        ['Общий трудовой стаж', t(d.experience)],
      ]},
      { title: 'Семейное положение', rows: rows5 },
    ];
  }
}
