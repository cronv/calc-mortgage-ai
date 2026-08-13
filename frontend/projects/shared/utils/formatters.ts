/**
 * Форматтеры для shared/utils библиотеки.
 */

/**
 * Форматирование числа в денежный формат с пробелами-разделителями.
 * @example formatMoney(1000000) => "1 000 000"
 */
export function formatMoney(value: number): string {
  return value > 0 ? Math.round(value).toLocaleString('ru-RU') : '';
}

/**
 * Форматирование процента с одним знаком после запятой.
 */
export function formatPercent(value: number): string {
  return value.toFixed(1);
}

/**
 * Форматирование даты в формате ДД.ММ.ГГГГ.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Очистка строки от всех нецифровых символов.
 */
export function digitsOnly(str: string): string {
  return str.replace(/\D+/g, '');
}

/**
 * Простая маска телефона +7 (xxx) xxx-xx-xx.
 */
export function formatPhone(raw: string): string {
  let d = digitsOnly(raw);
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (!d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  
  let out = '+7';
  if (d.length > 1) out += ' (' + d.slice(1, 4);
  if (d.length >= 4) out += ') ' + d.slice(4, 7);
  if (d.length >= 7) out += '-' + d.slice(7, 9);
  if (d.length >= 9) out += '-' + d.slice(9, 11);
  
  return out;
}

/**
 * Проверка email на валидность.
 */
export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/**
 * Склонение слов по числу.
 * @example plural(5, ['предложение', 'предложения', 'предложений']) => 'предложений'
 */
export function plural(n: number, forms: [string, string, string]): string {
  const d = n % 10;
  const h = n % 100;
  
  if (d === 1 && h !== 11) return forms[0];
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return forms[1];
  return forms[2];
}

/**
 * Детерминированный цвет по строке (для логотипов/инициалов).
 */
export function stringToColor(str: string): string {
  const palette = ['#1B75BB', '#D6423A', '#0F6E56', '#7F77DD', '#BA7517', '#232F3D'];
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length];
}
