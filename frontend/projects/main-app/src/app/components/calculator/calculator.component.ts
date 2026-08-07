import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  MortgageService, PROGRAMS, PROPERTY_PRESETS, ProgramKey, PropertyKey,
} from '../../services/mortgage.service';
import { ModalComponent } from '../modal/modal.component';
import { PaymentChartComponent } from '../payment-chart/payment-chart.component';

/**
 * Калькулятор по макету: тёмный таб-бар «Ипотека/Рефинансирование»,
 * режимы «По стоимости/По платежу», поля с плавающими лейблами,
 * селект программы, срок в годах, чипы ставок по типу жилья
 * и панель результатов с кнопкой «График платежей» (модалка).
 */
@Component({
  selector: 'app-calculator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, ModalComponent, PaymentChartComponent],
  template: `
    <!-- Тёмный таб-бар -->
    <div class="tabsbar" role="tablist">
      <button type="button" role="tab" [class.on]="svc.input().tab === 'mortgage'"
              [attr.aria-selected]="svc.input().tab === 'mortgage'"
              (click)="svc.switchTab('mortgage')">Ипотека</button>
      <button type="button" role="tab" [class.on]="svc.input().tab === 'refinance'"
              [attr.aria-selected]="svc.input().tab === 'refinance'"
              (click)="svc.switchTab('refinance')">Рефинансирование</button>
    </div>

    <div class="calc">
      <div class="grid">
        <!-- ФОРМА -->
        <div class="form">
          @if (svc.input().tab === 'mortgage') {
            <div class="modes">
              <button type="button" [class.on]="svc.input().mode === 'by_cost'"
                      (click)="svc.patch({ mode: 'by_cost' })">По стоимости</button>
              <button type="button" [class.on]="svc.input().mode === 'by_payment'"
                      (click)="svc.patch({ mode: 'by_payment' })">По платежу</button>
            </div>

            <div class="frow">
              @if (svc.input().mode === 'by_cost') {
                <label class="fld">
                  <span>Стоимость недвижимости</span>
                  <input type="text" inputmode="numeric" [value]="money(svc.input().cost)"
                         (input)="onMoney($event, 'cost')">
                </label>
              } @else {
                <label class="fld">
                  <span>Желаемый платёж, ₽/мес</span>
                  <input type="text" inputmode="numeric" [value]="money(svc.input().desiredPayment)"
                         (input)="onMoney($event, 'desiredPayment')">
                </label>
              }
              <label class="fld">
                <span>Первоначальный взнос</span>
                <input type="text" inputmode="numeric" [value]="money(svc.input().down)"
                       (input)="onMoney($event, 'down')">
              </label>
            </div>

            <div class="frow">
              <label class="fld">
                <span>Ипотечная программа</span>
                <select [value]="svc.input().program" (change)="onProgram($event)">
                  @for (p of programs; track p.key) {
                    <option [value]="p.key">{{ p.label }}</option>
                  }
                </select>
              </label>
              <label class="fld">
                <span>Срок в годах</span>
                <div class="tin">
                  <input type="number" min="1" max="50" [value]="svc.years()"
                         (input)="onYears($event)">
                  <em>г.</em>
                </div>
              </label>
            </div>

            <div class="frow rate-row">
              <label class="fld">
                <span>Ставка</span>
                <input type="number" min="0.1" max="40" step="0.1" [value]="svc.input().rate"
                       (input)="onNum($event, 'rate')">
              </label>
              <div class="chips">
                @for (c of chips; track c.key) {
                  <button type="button" [class.dark]="c.key === 'SECONDARY'"
                          [class.on]="svc.input().propertyType === c.key"
                          (click)="applyChip(c.key)">
                    {{ c.label }} <b>от {{ c.rate }}%</b>
                  </button>
                }
              </div>
            </div>
          } @else {
            <!-- РЕФИНАНСИРОВАНИЕ -->
            <div class="frow">
              <label class="fld">
                <span>Остаток долга</span>
                <input type="text" inputmode="numeric" [value]="money(svc.input().currentBalance)"
                       (input)="onMoney($event, 'currentBalance')">
              </label>
              <label class="fld">
                <span>Текущий платёж, ₽/мес</span>
                <input type="text" inputmode="numeric" [value]="money(svc.input().currentPayment)"
                       (input)="onMoney($event, 'currentPayment')">
              </label>
            </div>
            <div class="frow">
              <label class="fld">
                <span>Текущая ставка, %</span>
                <input type="number" min="0.1" max="40" step="0.1" [value]="svc.input().currentRate"
                       (input)="onNum($event, 'currentRate')">
              </label>
              <label class="fld">
                <span>Новая ставка, %</span>
                <input type="number" min="0.1" max="40" step="0.1" [value]="svc.input().rate"
                       (input)="onNum($event, 'rate')">
              </label>
            </div>
            <div class="frow">
              <label class="fld">
                <span>Срок в годах</span>
                <div class="tin">
                  <input type="number" min="1" max="50" [value]="svc.years()"
                         (input)="onYears($event)">
                  <em>г.</em>
                </div>
              </label>
              <div></div>
            </div>
          }
        </div>

        <!-- РЕЗУЛЬТАТ -->
        <div class="res">
          <div class="rgrid">
            @if (svc.input().tab === 'mortgage') {
              <div class="cell">
                <b class="green">{{ svc.monthlyPayment() | number:'1.0-0' }} ₽</b>
                <span>Ежемесячный платёж</span>
              </div>
              <div class="cell">
                <b>{{ svc.loan() | number:'1.0-0' }} ₽</b>
                <span>Сумма кредита</span>
              </div>
              <div class="cell">
                <b>{{ svc.overpayment() | number:'1.0-0' }} ₽</b>
                <span>Переплата по кредиту</span>
              </div>
              <div class="cell">
                <b>{{ svc.totalPayout() | number:'1.0-0' }} ₽</b>
                <span>Общая выплата</span>
              </div>
              <div class="cell">
                <b>{{ svc.recommendedIncome() | number:'1.0-0' }} ₽</b>
                <span>Рекомендуемый доход</span>
              </div>
              <div class="cell">
                <b>{{ svc.taxDeduction() | number:'1.0-0' }} ₽</b>
                <span>Налоговый вычет
                  <i class="q" title="13% со стоимости жилья (до 2 млн ₽) и 13% с уплаченных процентов (до 3 млн ₽)">i</i>
                </span>
              </div>
            } @else {
              <div class="cell">
                <b class="green">{{ svc.refinanceNewPayment() | number:'1.0-0' }} ₽</b>
                <span>Новый платёж</span>
              </div>
              <div class="cell">
                <b>{{ svc.input().currentPayment | number:'1.0-0' }} ₽</b>
                <span>Текущий платёж</span>
              </div>
              <div class="cell">
                <b [class.green]="svc.refinanceSaving() > 0" [class.red]="svc.refinanceSaving() < 0">
                  {{ svc.refinanceSaving() | number:'1.0-0' }} ₽</b>
                <span>Экономия за срок</span>
              </div>
              <div class="cell">
                <b>{{ svc.loan() | number:'1.0-0' }} ₽</b>
                <span>Сумма кредита</span>
              </div>
              <div class="cell">
                <b>{{ svc.overpayment() | number:'1.0-0' }} ₽</b>
                <span>Переплата</span>
              </div>
              <div class="cell">
                <b>{{ svc.totalPayout() | number:'1.0-0' }} ₽</b>
                <span>Общая выплата</span>
              </div>
            }
          </div>

          <button type="button" class="sched" (click)="chartOpen.set(true)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/>
              <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            График платежей
          </button>
        </div>
      </div>
    </div>

    <app-modal [open]="chartOpen()" title="График платежей" (closed)="chartOpen.set(false)">
      <app-payment-chart />
    </app-modal>
  `,
  styles: [`
    :host{display:block}

    .tabsbar{
      display:flex;gap:8px;background:var(--dark);border-radius:16px;padding:8px;
      margin-bottom:16px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;
    }
    .tabsbar::-webkit-scrollbar{display:none}
    .tabsbar button{
      border:0;background:transparent;color:#fff;padding:11px 22px;border-radius:11px;
      font-size:15px;font-weight:500;white-space:nowrap;flex:0 0 auto;
    }
    .tabsbar button.on{background:var(--accent);color:#000;font-weight:600}

    .calc{background:var(--soft);border-radius:16px;padding:clamp(14px,2.5vw,24px)}
    .grid{display:grid;grid-template-columns:1.15fr 1fr;gap:clamp(16px,3vw,32px)}

    .modes{display:inline-flex;gap:8px;margin-bottom:16px}
    .modes button{
      border:1px solid #000;background:#fff;border-radius:22px;padding:10px 20px;
      font-size:14px;font-weight:500;white-space:nowrap;
    }
    .modes button.on{background:var(--accent);border-color:var(--accent);font-weight:600}

    .frow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}

    .fld{
      display:block;background:#fff;border:1px solid var(--line);border-radius:14px;
      padding:9px 14px 11px;min-width:0;
    }
    .fld:focus-within{border-color:#000}
    .fld>span{display:block;font-size:12px;color:var(--muted);margin-bottom:2px}
    .fld input,.fld select{
      width:100%;border:0;padding:0;font-size:16px;font-weight:600;background:transparent;
      font-family:inherit;-webkit-appearance:none;appearance:none;
    }
    .fld input:focus,.fld select:focus{outline:0}
    .fld select{
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23000' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat:no-repeat;background-position:right 2px center;padding-right:20px;
    }
    .tin{display:flex;align-items:center;gap:8px}
    .tin input{flex:1}
    .tin em{font-style:normal;font-size:14px;color:var(--muted);border-left:1px solid var(--line);padding-left:10px}

    .rate-row{grid-template-columns:1fr 1.4fr;align-items:start}
    .chips{display:flex;flex-wrap:wrap;gap:8px;padding-top:4px}
    .chips button{
      border:1px solid var(--line);background:#fff;border-radius:18px;padding:8px 13px;
      font-size:13px;font-weight:500;white-space:nowrap;
    }
    .chips button b{font-weight:600;color:#1D9E75}
    .chips button.dark{background:var(--dark);color:#fff;border-color:var(--dark)}
    .chips button.dark b{color:var(--accent)}
    .chips button.on{outline:2px solid var(--accent);outline-offset:1px}

    .res{background:#fff;border:1px solid var(--line);border-radius:14px;padding:clamp(16px,2.5vw,24px);align-self:start}
    .rgrid{display:grid;grid-template-columns:1fr 1fr;gap:18px 16px}
    .cell b{display:block;font-size:clamp(17px,2.2vw,21px);font-weight:700;white-space:nowrap}
    .cell b.green{color:#12A14B;font-size:clamp(20px,2.6vw,24px)}
    .cell b.red{color:#E2574C}
    .cell span{display:block;font-size:13px;color:var(--muted);margin-top:2px}
    .q{
      display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;
      border:1px solid var(--muted);border-radius:50%;font-size:10px;font-style:normal;
      color:var(--muted);vertical-align:1px;margin-left:3px;cursor:help;
    }
    .sched{
      display:inline-flex;align-items:center;gap:9px;margin-top:20px;border:0;background:transparent;
      font-size:15px;font-weight:500;padding:6px 0;color:var(--ink);
    }
    .sched:hover{color:var(--link)}

    /* ---------- ПЛАНШЕТ ≤900: одна колонка, результат сверху ---------- */
    @media (max-width:900px){
      .grid{grid-template-columns:1fr}
      .res{order:-1}
    }
    /* ---------- МОБИЛЬНЫЙ ≤620 ---------- */
    @media (max-width:620px){
      .frow{grid-template-columns:1fr}
      .rate-row{grid-template-columns:1fr}
      .modes{display:flex;width:100%}
      .modes button{flex:1}
      .rgrid{gap:14px 12px}
    }
    /* ---------- 375px ---------- */
    @media (max-width:400px){
      .tabsbar button{padding:10px 16px;font-size:14px}
      .chips button{flex:1 1 100%;text-align:left}
    }
  `],
})
export class CalculatorComponent {
  readonly svc = inject(MortgageService);
  readonly chartOpen = signal(false);
  readonly programs = PROGRAMS;
  readonly chips = PROPERTY_PRESETS;

  /** Формат денег с пробелами-разделителями. */
  money(v: number): string {
    return v > 0 ? Math.round(v).toLocaleString('ru-RU') : '';
  }

  onMoney(e: Event, key: 'cost' | 'down' | 'desiredPayment' | 'currentBalance' | 'currentPayment'): void {
    const raw = (e.target as HTMLInputElement).value.replace(/[^\d]/g, '');
    this.svc.patch({ [key]: Number(raw) || 0 } as never);
  }

  onNum(e: Event, key: 'rate' | 'currentRate'): void {
    const value = Number((e.target as HTMLInputElement).value) || 0;
    this.svc.patch({ [key]: value } as never);
  }

  onYears(e: Event): void {
    this.svc.patchYears(Number((e.target as HTMLInputElement).value) || 1);
  }

  onProgram(e: Event): void {
    this.svc.patch({ program: (e.target as HTMLSelectElement).value as ProgramKey });
  }

  applyChip(key: PropertyKey): void {
    const preset = PROPERTY_PRESETS.find((c) => c.key === key)!;
    this.svc.patch({ propertyType: key, rate: preset.rate });
  }
}
