/**
 * Выгрузка графика платежей в настоящий .xlsx.
 * exceljs загружается динамически (отдельный lazy-чанк) только по клику «Скачать» —
 * основной бандл не тяжелеет.
 */

export interface ExportMonthRow {
  n: number; date: string; payment: number; principal: number; interest: number; balance: number;
}
export interface ExportYearRow {
  label: string; payment: number; principal: number; interest: number; balance: number;
}
export interface ExportMeta {
  loan: number; rate: number; years: number; payment: number;
}

export async function exportScheduleXlsx(
  months: ExportMonthRow[],
  years: ExportYearRow[],
  meta: ExportMeta,
): Promise<void> {
  const mod: typeof import('exceljs') = await import('exceljs');
  const ExcelJS = (mod as { default?: typeof import('exceljs') }).default ?? mod;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ипотечный калькулятор';
  wb.created = new Date();

  const money = '#,##0';
  const head = { bold: true } as const;
  const headFill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' },
  } as const;

  // ---- Лист «По месяцам» ----
  const wsM = wb.addWorksheet('По месяцам');
  wsM.addRow(['Сумма кредита, ₽', meta.loan]);
  wsM.addRow(['Ставка, %', meta.rate]);
  wsM.addRow(['Срок, лет', meta.years]);
  wsM.addRow(['Ежемесячный платёж, ₽', Math.round(meta.payment)]);
  wsM.addRow([]);
  const hM = wsM.addRow(['№', 'Месяц', 'Платёж, ₽', 'Основной долг, ₽', 'Проценты, ₽', 'Остаток, ₽']);
  hM.font = head;
  hM.eachCell((c) => { c.fill = headFill; });
  for (const r of months) {
    wsM.addRow([r.n, r.date, Math.round(r.payment), Math.round(r.principal), Math.round(r.interest), Math.round(r.balance)]);
  }
  wsM.columns = [
    { width: 6 }, { width: 12 },
    { width: 16, style: { numFmt: money } },
    { width: 18, style: { numFmt: money } },
    { width: 16, style: { numFmt: money } },
    { width: 16, style: { numFmt: money } },
  ];
  wsM.getCell('B1').numFmt = money;
  wsM.getCell('B4').numFmt = money;

  // ---- Лист «По годам» ----
  const wsY = wb.addWorksheet('По годам');
  const hY = wsY.addRow(['Год', 'Платежи, ₽', 'Основной долг, ₽', 'Проценты, ₽', 'Остаток, ₽']);
  hY.font = head;
  hY.eachCell((c) => { c.fill = headFill; });
  for (const r of years) {
    wsY.addRow([r.label, Math.round(r.payment), Math.round(r.principal), Math.round(r.interest), Math.round(r.balance)]);
  }
  wsY.columns = [
    { width: 10 },
    { width: 16, style: { numFmt: money } },
    { width: 18, style: { numFmt: money } },
    { width: 16, style: { numFmt: money } },
    { width: 16, style: { numFmt: money } },
  ];

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'grafik-platezhey.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
