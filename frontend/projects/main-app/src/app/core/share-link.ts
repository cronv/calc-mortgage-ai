import type { CalcInput } from '../services/mortgage.service';

/**
 * Шаринг расчёта ссылкой: состояние калькулятора сериализуется в query-параметры,
 * при открытии такой ссылки калькулятор восстанавливает значения.
 */

/** Собрать URL текущего расчёта. */
export function buildShareUrl(i: CalcInput): string {
  const q = new URLSearchParams({
    t: i.tab,
    m: i.mode,
    c: String(i.cost),
    d: String(i.down),
    p: String(i.desiredPayment),
    y: String(Math.round(i.months / 12)),
    r: String(i.rate),
    g: i.program,
    pt: i.propertyType,
    cb: String(i.currentBalance),
    cr: String(i.currentRate),
    cp: String(i.currentPayment),
  });
  return `${location.origin}${location.pathname}?${q.toString()}`;
}

/** Прочитать состояние из URL (если ссылка «расшаренная»). */
export function parseShareUrl(): Partial<CalcInput> | null {
  if (typeof location === 'undefined' || !location.search) return null;
  const q = new URLSearchParams(location.search);
  if (!q.has('c') && !q.has('p') && !q.has('cb')) return null;

  const num = (k: string): number | undefined => {
    const v = Number(q.get(k));
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  const pick = <T extends string>(k: string, allowed: readonly T[]): T | undefined => {
    const v = q.get(k) as T | null;
    return v !== null && allowed.includes(v) ? v : undefined;
  };

  const out: Partial<CalcInput> = {};
  const tab = pick('t', ['mortgage', 'mortgage_refinance'] as const);
  if (tab) out.tab = tab;
  const mode = pick('m', ['by_cost', 'by_payment'] as const);
  if (mode) out.mode = mode;
  const c = num('c'); if (c !== undefined) out.cost = c;
  const d = num('d'); if (d !== undefined) out.down = d;
  const p = num('p'); if (p !== undefined) out.desiredPayment = p;
  const y = num('y'); if (y !== undefined && y >= 1 && y <= 50) out.months = Math.round(y) * 12;
  const r = num('r'); if (r !== undefined && r > 0 && r <= 40) out.rate = r;
  const g = pick('g', ['STANDARD','FAMILY','MILITARY','IT','FAR_EAST','ARCTIC','RURAL'] as const);
  if (g) out.program = g;
  const pt = pick('pt', ['SECONDARY','NEW_BUILDING','HOUSE'] as const);
  if (pt) out.propertyType = pt;
  const cb = num('cb'); if (cb !== undefined) out.currentBalance = cb;
  const cr = num('cr'); if (cr !== undefined && cr > 0 && cr <= 40) out.currentRate = cr;
  const cp = num('cp'); if (cp !== undefined) out.currentPayment = cp;
  return out;
}

/** Копирование в буфер: Clipboard API + фолбэк на execCommand (Safari/старые браузеры). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Открыть шаринг расчёта в Telegram. */
export function shareToTelegram(url: string, text: string): void {
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  window.open(tg, '_blank', 'noopener');
}
