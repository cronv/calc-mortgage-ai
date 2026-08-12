import { Injectable, signal, computed, Signal } from '@angular/core';
import {
    annuityPayment, loanFromPayment, buildSchedule,
    PaymentType, ScheduleRow,
} from '../core/mortgage-math';
import { parseShareUrl } from '../core/share-link';

/** Вкладка калькулятора (по макету: Ипотека / Рефинансирование). */
export type CalcTab = 'mortgage' | 'mortgage_refinance';

/** Режим ввода: от стоимости или от желаемого платежа. */
export type CalcMode = 'by_cost' | 'by_payment';

/** Ипотечная программа (селект в форме). */
export type ProgramKey = 'STANDARD' | 'FAMILY' | 'MILITARY' | 'IT' | 'FAR_EAST' | 'ARCTIC' | 'RURAL';

/** Тип недвижимости (чипы со ставками). */
export type PropertyKey = 'SECONDARY' | 'NEW_BUILDING' | 'HOUSE';

export type { PaymentType } from '../core/mortgage-math';
export type PaymentRow = ScheduleRow;

export const PROGRAMS: ReadonlyArray<{ key: ProgramKey; label: string }> = [
    { key: 'STANDARD', label: 'Стандартная' },
    { key: 'FAMILY', label: 'Семейная' },
    { key: 'MILITARY', label: 'Военная' },
    { key: 'IT', label: 'ИТ' },
    { key: 'FAR_EAST', label: 'Дальневосточная' },
    { key: 'ARCTIC', label: 'Арктическая' },
    { key: 'RURAL', label: 'Сельская' },
];

/** Верхняя граница ставки по льготным программам. */
export const PROGRAM_RATE_CAP: Partial<Record<ProgramKey, number>> = {
    FAMILY: 6, IT: 5, FAR_EAST: 2, ARCTIC: 2, RURAL: 3, MILITARY: 8,
};

/** Чипы типа недвижимости с пресетами ставок (по макету). */
export const PROPERTY_PRESETS: ReadonlyArray<{ key: PropertyKey; label: string; rate: number }> = [
    { key: 'SECONDARY', label: 'Вторичка', rate: 15.5 },
    { key: 'NEW_BUILDING', label: 'Новостройка', rate: 3.5 },
    { key: 'HOUSE', label: 'ДОМ ИЖС', rate: 5 },
];

/** Полное состояние ввода. */
export interface CalcInput {
    tab: CalcTab;
    mode: CalcMode;
    cost: number;
    down: number;
    desiredPayment: number;
    months: number;
    rate: number;
    paymentType: PaymentType;
    program: ProgramKey;
    propertyType: PropertyKey | '';
    currentBalance: number;
    currentRate: number;
    currentPayment: number;
}

const DEFAULTS: CalcInput = {
    tab: 'mortgage',
    mode: 'by_cost',
    cost: 4_000_000,
    down: 2_500_000,
    desiredPayment: 30_000,
    months: 240,
    rate: 15.5,
    paymentType: 'ann',
    program: 'STANDARD',
    propertyType: '',
    currentBalance: 3_000_000,
    currentRate: 18.5,
    currentPayment: 45_000,
};

/**
 * Единый сервис расчётов. Математика — в core/mortgage-math (общая с Web Worker).
 * При открытии «расшаренной» ссылки состояние восстанавливается из query-параметров.
 */
@Injectable({ providedIn: 'root' })
export class MortgageService {
    readonly input = signal<CalcInput>(this.initialInput());

    private readonly scheduleSig = signal<PaymentRow[]>(
        buildSchedule(DEFAULTS.cost - DEFAULTS.down, DEFAULTS.months, DEFAULTS.rate, DEFAULTS.paymentType)
    );
    readonly schedule: Signal<PaymentRow[]> = this.scheduleSig.asReadonly();

    /** Срок в годах для UI (внутри храним месяцы). */
    readonly years = computed(() => Math.round(this.input().months / 12));

    /** Эффективная ставка: льготная программа ограничивает ставку сверху. */
    readonly effectiveRate = computed(() => {
        const i = this.input();
        let r = i.tab === 'mortgage_refinance' ? i.rate : i.rate;
        if (i.tab === 'mortgage') {
            const cap = PROGRAM_RATE_CAP[i.program];
            if (cap !== undefined) r = Math.min(r, cap);
        }
        return Math.max(0.1, Math.round(r * 100) / 100);
    });

    /** Сумма кредита. */
    readonly loan = computed(() => {
        const i = this.input();
        if (i.tab === 'mortgage_refinance') return Math.max(0, i.currentBalance);
        if (i.mode === 'by_payment') {
            return Math.max(0, loanFromPayment(i.desiredPayment, i.months, this.effectiveRate()));
        }
        return Math.max(0, i.cost - i.down);
    });

    /** Оценка стоимости объекта (для налогового вычета в режиме «по платежу»). */
    readonly estimatedCost = computed(() => {
        const i = this.input();
        if (i.tab === 'mortgage_refinance') return i.currentBalance;
        return i.mode === 'by_payment' ? this.loan() + i.down : i.cost;
    });

    readonly monthlyPayment = computed(() => {
        const rows = this.schedule();
        if (rows.length > 0) return rows[0].payment;
        return annuityPayment(this.loan(), this.input().months, this.effectiveRate());
    });

    readonly totalPayout = computed(() => {
        const rows = this.schedule();
        if (rows.length === 0) {
            // Fallback: рассчитать напрямую при пустом графике
            const p = annuityPayment(this.loan(), this.input().months, this.effectiveRate());
            return p * this.input().months;
        }
        return rows.reduce((s, r) => s + r.payment, 0);
    });

    readonly overpayment = computed(() => {
        const total = this.totalPayout();
        const loan = this.loan();
        return total > 0 ? Math.max(0, total - loan) : 0;
    });

    /** Рекомендуемый доход: платёж не выше трети дохода. */
    readonly recommendedIncome = computed(() => Math.round(this.monthlyPayment() * 3));

    /** Налоговый вычет: 13% со стоимости (до 2 млн) + 13% с процентов (до 3 млн). */
    readonly taxDeduction = computed(() =>
        Math.round(Math.min(this.estimatedCost(), 2_000_000) * 0.13
            + Math.min(this.overpayment(), 3_000_000) * 0.13));

    /** Рефинансирование: новый платёж и экономия за срок. */
    readonly refinanceNewPayment = computed(() =>
        annuityPayment(this.input().currentBalance, this.input().months, this.effectiveRate()));
    readonly refinanceSaving = computed(() => {
        const i = this.input();
        if (i.tab !== 'mortgage_refinance') return 0;
        return Math.round((i.currentPayment - this.refinanceNewPayment()) * i.months);
    });

    private worker?: Worker;

    constructor() {
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker(new URL('../workers/mortgage.worker', import.meta.url));
            this.worker.onmessage = ({ data }) => this.scheduleSig.set(data as PaymentRow[]);
        }
        this.recompute();
    }

    /** Стартовое состояние: дефолты + значения из «расшаренной» ссылки. */
    private initialInput(): CalcInput {
        const shared = typeof location !== 'undefined' ? parseShareUrl() : null;
        return shared ? { ...DEFAULTS, ...shared } : { ...DEFAULTS };
    }

    patch(part: Partial<CalcInput>): void {
        this.input.update((cur) => ({ ...cur, ...part }));
        this.recompute();
    }

    switchTab(tab: CalcTab): void {
        this.patch({ tab });
    }

    /** Срок из UI в годах. */
    patchYears(years: number): void {
        const y = Math.min(50, Math.max(1, Math.round(years) || 1));
        this.patch({ months: y * 12 });
    }

    private recompute(): void {
        const i = this.input();
        const loanVal = this.loan();
        const rateVal = this.effectiveRate();

        // Защитная проверка: loan и rate должны быть > 0
        if (loanVal <= 0 || rateVal <= 0) {
            this.scheduleSig.set([]);
            return;
        }

        const payload = { loan: loanVal, months: i.months, rate: rateVal, type: i.paymentType };
        if (this.worker) {
            this.worker.postMessage(payload);
        } else {
            this.scheduleSig.set(buildSchedule(payload.loan, payload.months, payload.rate, payload.type));
        }
    }
}
