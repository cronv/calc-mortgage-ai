/**
 * Чистая ипотечная математика — единый источник формул для сервиса и Web Worker.
 * Никаких зависимостей от Angular: можно импортировать и в worker-контекст.
 */

export type PaymentType = 'ann' | 'diff';

export interface ScheduleRow {
  n: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

/** Аннуитетный ежемесячный платёж. */
export function annuityPayment(loan: number, months: number, annualRate: number): number {
  const i = annualRate / 100 / 12;
  if (months <= 0) return 0;
  if (i <= 0) return loan / months;
  const p = Math.pow(1 + i, months);
  return loan * i * p / (p - 1);
}

/** Обратная задача: тело кредита из желаемого платежа. */
export function loanFromPayment(payment: number, months: number, annualRate: number): number {
  const i = annualRate / 100 / 12;
  if (months <= 0) return 0;
  if (i <= 0) return payment * months;
  const p = Math.pow(1 + i, months);
  return payment * (p - 1) / (i * p);
}

/** Построить помесячный график (аннуитет или дифференцированный). */
export function buildSchedule(loan: number, months: number, annualRate: number, type: PaymentType): ScheduleRow[] {
  const i = annualRate / 100 / 12;
  let bal = loan;
  const rows: ScheduleRow[] = [];
  const ann = annuityPayment(loan, months, annualRate);
  const fixed = months > 0 ? loan / months : 0;

  for (let m = 1; m <= months && bal > 0.005; m++) {
    const interest = bal * i;
    const principal = type === 'diff' ? Math.min(fixed, bal) : ann - interest;
    const payment = type === 'diff' ? principal + interest : ann;
    bal = Math.max(0, bal - principal);
    rows.push({
      n: m,
      payment: round2(payment),
      principal: round2(principal),
      interest: round2(interest),
      balance: round2(bal),
    });
  }
  return rows;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
