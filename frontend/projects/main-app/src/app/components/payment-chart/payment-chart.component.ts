import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MortgageService } from '../../services/mortgage.service';
import { exportScheduleXlsx } from '../../core/excel-export';
import { buildShareUrl, copyText, shareToTelegram } from '../../core/share-link';

/**
 * Содержимое модалки «График платежей»:
 * диаграмма тело/проценты, таблица по годам/месяцам,
 * выгрузка в Excel (.xlsx), ссылка на расчёт и шаринг в Telegram.
 */
@Component({
  selector: 'app-payment-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <div class="sum">
      <div class="bar">
        <i class="body" [style.width.%]="principalPct()"></i>
        <i class="int" [style.width.%]="interestPct()"></i>
      </div>
      <div class="legend">
        <span><i class="sw body"></i>Основной долг: <b>{{ totalPrincipal() | number:'1.0-0' }} ₽</b></span>
        <span><i class="sw int"></i>Проценты: <b>{{ totalInterest() | number:'1.0-0' }} ₽</b></span>
      </div>
    </div>

    <div class="bar-row">
      <div class="switch">
        <button type="button" [class.on]="view() === 'year'" (click)="view.set('year')">По годам</button>
        <button type="button" [class.on]="view() === 'month'" (click)="view.set('month')">По месяцам</button>
      </div>

      <div class="actions">
        <button type="button" (click)="downloadExcel()" [disabled]="exporting()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ exporting() ? 'Готовим…' : 'Скачать Excel' }}
        </button>
        <button type="button" (click)="copyLink()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6L12.5 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          {{ copied() ? 'Скопировано ✓' : 'Ссылка на расчёт' }}
        </button>
        <button type="button" (click)="sendTelegram()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 4 3 11l5.5 2L19 6l-8 8.5V20l3-3.5 4.5 2.5L21 4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
          Telegram
        </button>
      </div>
    </div>

    <div class="tbl">
      <table>
        <thead>
          <tr>
            <th>{{ view() === 'year' ? 'Год' : 'Месяц' }}</th>
            <th>Платёж</th><th>Осн. долг</th><th>Проценты</th><th>Остаток</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.label) {
            <tr>
              <td>{{ row.label }}</td>
              <td>{{ row.payment | number:'1.0-0' }}</td>
              <td>{{ row.principal | number:'1.0-0' }}</td>
              <td>{{ row.interest | number:'1.0-0' }}</td>
              <td>{{ row.balance | number:'1.0-0' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .sum{margin-bottom:16px}
    .bar{display:flex;height:16px;border-radius:8px;overflow:hidden;border:1px solid var(--line)}
    .bar .body{background:var(--panel)}
    .bar .int{background:var(--accent)}
    .legend{display:flex;gap:20px;font-size:13px;margin-top:12px;flex-wrap:wrap}
    .legend .sw{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
    .legend .sw.body{background:var(--panel)}
    .legend .sw.int{background:var(--accent)}

    .bar-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
    .switch{display:inline-flex;background:var(--soft);border-radius:10px;padding:4px}
    .switch button{border:0;background:transparent;padding:8px 16px;border-radius:8px;font-size:14px;font-weight:500;color:var(--muted);min-height:40px}
    .switch button.on{background:#fff;color:#000;box-shadow:0 1px 3px rgba(0,0,0,.1)}

    .actions{display:flex;gap:8px;flex-wrap:wrap}
    .actions button{
      display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;
      border-radius:10px;padding:9px 13px;font-size:13px;font-weight:500;min-height:40px;
    }
    .actions button:hover{border-color:#000}
    .actions button:disabled{opacity:.6}

    .tbl{max-height:360px;overflow:auto;border:1px solid var(--line);border-radius:10px;-webkit-overflow-scrolling:touch}
    table{width:100%;border-collapse:collapse;font-size:13px;min-width:480px}
    thead th{position:sticky;top:0;background:var(--soft);text-align:right;padding:11px 12px;font-weight:600;border-bottom:1px solid var(--line);white-space:nowrap}
    thead th:first-child{text-align:left}
    tbody td{padding:9px 12px;text-align:right;border-bottom:1px solid #eee;white-space:nowrap}
    tbody td:first-child{text-align:left;font-weight:500}
    tbody tr:hover{background:var(--soft)}

    @media (max-width:620px){
      .legend{gap:12px;font-size:12px}
      .switch{display:flex;width:100%}
      .switch button{flex:1}
      .actions{width:100%}
      .actions button{flex:1;justify-content:center}
    }
  `],
})
export class PaymentChartComponent {
  private readonly svc = inject(MortgageService);
  readonly view = signal<'year' | 'month'>('year');
  readonly exporting = signal(false);
  readonly copied = signal(false);

  readonly totalPrincipal = computed(() => this.svc.schedule().reduce((s, r) => s + r.principal, 0));
  readonly totalInterest = computed(() => this.svc.schedule().reduce((s, r) => s + r.interest, 0));
  readonly principalPct = computed(() => {
    const t = this.totalPrincipal() + this.totalInterest();
    return t > 0 ? this.totalPrincipal() / t * 100 : 0;
  });
  readonly interestPct = computed(() => 100 - this.principalPct());

  /** Метка месяца для строки графика: ММ.ГГГГ от следующего месяца. */
  private monthLabel(idx: number): string {
    const start = new Date();
    const d = new Date(start.getFullYear(), start.getMonth() + 1 + idx, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${mm}.${d.getFullYear()}`;
  }

  /** Годовые агрегаты. */
  private readonly byYear = computed(() => {
    const years: Array<{ label: string; payment: number; principal: number; interest: number; balance: number }> = [];
    this.svc.schedule().forEach((r, idx) => {
      const yi = Math.floor(idx / 12);
      if (!years[yi]) years[yi] = { label: (yi + 1) + ' год', payment: 0, principal: 0, interest: 0, balance: r.balance };
      years[yi].payment += r.payment;
      years[yi].principal += r.principal;
      years[yi].interest += r.interest;
      years[yi].balance = r.balance;
    });
    return years;
  });

  readonly rows = computed(() => {
    if (this.view() === 'month') {
      return this.svc.schedule().map((r, idx) => ({
        label: this.monthLabel(idx), payment: r.payment, principal: r.principal,
        interest: r.interest, balance: r.balance,
      }));
    }
    return this.byYear();
  });

  async downloadExcel(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const months = this.svc.schedule().map((r, idx) => ({
        n: r.n, date: this.monthLabel(idx), payment: r.payment,
        principal: r.principal, interest: r.interest, balance: r.balance,
      }));
      await exportScheduleXlsx(months, this.byYear(), {
        loan: this.svc.loan(),
        rate: this.svc.effectiveRate(),
        years: this.svc.years(),
        payment: this.svc.monthlyPayment(),
      });
    } finally {
      this.exporting.set(false);
    }
  }

  async copyLink(): Promise<void> {
    const ok = await copyText(buildShareUrl(this.svc.input()));
    if (ok) {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }
  }

  sendTelegram(): void {
    const url = buildShareUrl(this.svc.input());
    const payment = Math.round(this.svc.monthlyPayment()).toLocaleString('ru-RU');
    shareToTelegram(url, `Расчёт ипотеки: платёж ${payment} ₽/мес, ставка ${this.svc.effectiveRate()}%`);
  }
}
