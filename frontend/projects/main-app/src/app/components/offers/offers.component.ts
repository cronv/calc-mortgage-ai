import {
  Component, ChangeDetectionStrategy, inject, signal, computed, effect,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MortgageService, PROPERTY_PRESETS } from '../../services/mortgage.service';
import {OffersService, BankOffer, MatchQuery} from '../../services/offers.service';
import { ApplicationFlowService } from '../../services/application-flow.service';
import { ModalComponent } from '../modal/modal.component';
import { ApplicationFormComponent } from '../application-form/application-form.component';

const PAGE = 6;

/**
 * Список банковских предложений (единый API /api/v1/calculator/match):
 * счётчик, сортировка по платежу, карточки с параметрами, заявка в модалке,
 * «Показать ещё». Перезагружается с дебаунсом при изменении параметров расчёта.
 */
@Component({
  selector: 'app-offers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, ModalComponent, ApplicationFormComponent],
  template: `
    <div class="ohead">
      <b>Подобрано {{ filtered().length }} {{ plural(filtered().length) }}</b>
      <button type="button" class="sort" (click)="sortAsc.set(!sortAsc())">
        Платёж по {{ sortAsc() ? 'возрастанию' : 'убыванию' }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8 7v10M8 17l-3-3M8 17l3-3M16 17V7M16 7l-3 3M16 7l3 3"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    @if (osvc.state() === 'loading' && filtered().length === 0) {
      <div class="onote">Подбираем предложения…</div>
    } @else if (osvc.state() === 'error') {
      <div class="onote">Не удалось загрузить предложения банков. Проверьте, что API доступен, и обновите страницу.</div>
    } @else if (filtered().length === 0) {
      <div class="onote">По выбранной программе предложений не найдено — попробуйте другую программу или параметры.</div>
    } @else {
      <div class="olist">
        @for (o of shown(); track $index) {
          <div class="ocard">
              <div class="obank">
                  <div class="ologo" [style.background]="o.bank_logo_url ? '#fff' : logoBg(o.bank_name)">
                      @if (o.bank_logo_url) {
                          <img [src]="o.bank_logo_url" [alt]="o.bank_name" class="ologo-img" />
                      } @else {
                          {{ o.bank_name.charAt(0) }}
                      }
                  </div>
                  <div class="obname">
                    <div>
                      <b>{{ o.bank_name }}</b>
                    </div>
                    <div>
                      <span>{{ o.program_name }}</span>
                    </div>
                    <div>
                      <span>{{ propertyLabel() }}</span>
                    </div>
                  </div>
              </div>

            <div class="oparams">
              <div><span>Ставка</span><b>от {{ o.calculated_rate }}%</b></div>
              <div><span>Срок</span><b>до {{ svc.years() }} лет</b></div>
              <div><span>Платёж</span><b>от {{ o.monthly_payment | number:'1.0-0' }} ₽</b></div>
              <div><span>Первонач. взнос</span><b>от {{ o.min_down_payment | number:'1.0-1' }}%</b></div>
              <div><span>Переплата</span><b>{{ o.overpayment | number:'1.0-0' }} ₽</b></div>
            </div>

            <div class="obtns">
              <button type="button" class="apply main" (click)="startApplication(o)">Отправить заявку</button>
              <button type="button" class="apply" (click)="selected.set(o)">Подробнее</button>
            </div>
          </div>
        }
      </div>

      @if (shown().length < filtered().length) {
        <div class="omore">
          <button type="button" (click)="visible.set(visible() + pageSize)">
            +{{ filtered().length - shown().length }} {{ plural(filtered().length - shown().length) }}
          </button>
        </div>
      }
    }

    <app-modal [open]="!!selected()" title="Заявка в банк" (closed)="selected.set(null)">
      <app-application-form [offer]="selected()" (done)="selected.set(null)" />
    </app-modal>
  `,
  styles: [`
    :host{display:block;margin-top:22px}
    .ohead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
    .ohead b{font-size:16px;font-weight:600}
    .sort{
      display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;
      border-radius:11px;padding:9px 14px;font-size:14px;color:var(--ink);
    }
    .onote{background:var(--soft);border-radius:14px;padding:22px;text-align:center;color:var(--muted);font-size:15px}

    .olist{display:flex;flex-direction:column;gap:12px}
    .ocard{
      display:grid;grid-template-columns:200px 1fr auto;gap:16px;align-items:center;
      background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;
    }
    .obank{display:flex;align-items:center;gap:11px;min-width:0}
    .ologo{
      width:40px;height:40px;border-radius:10px;color:#fff;font-weight:700;font-size:17px;
      display:flex;align-items:center;justify-content:center;flex:0 0 auto;
    }
    .ologo-img {
        width:100%;
        height:100%;
        object-fit:contain;
        border-radius:10px;
    }
    .obname{min-width:0}
    .obname b{display:block;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .obname span{font-size:12px;color:var(--muted)}

    .oparams{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .oparams span{display:block;font-size:12px;color:var(--muted);margin-bottom:2px;white-space:nowrap}
    .oparams b{font-size:14px;font-weight:600;white-space:nowrap}

    .obtns{display:flex;flex-direction:column;gap:8px}
    .apply{
      border:1px solid #000;background:#fff;border-radius:22px;padding:11px 20px;
      font-size:14px;font-weight:500;white-space:nowrap;
    }
    .apply.main{background:var(--accent);border-color:var(--accent);font-weight:600}
    .apply:hover{background:var(--accent);border-color:var(--accent)}

    .omore{text-align:center;margin-top:16px}
    .omore button{border:0;background:transparent;color:var(--link);font-size:15px;padding:8px 12px}

    /* ---------- ≤980: параметры в 3 колонки, кнопка вниз ---------- */
    @media (max-width:980px){
      .ocard{grid-template-columns:1fr auto}
      .obank{grid-column:1}
      .obtns{grid-column:2;grid-row:1}
      .oparams{grid-column:1 / -1;grid-template-columns:repeat(3,minmax(0,1fr))}
    }
    /* ---------- ≤620: 2 колонки, кнопка на всю ширину ---------- */
    @media (max-width:620px){
      .ocard{grid-template-columns:1fr;padding:16px}
      .obtns{grid-column:1;grid-row:auto;width:100%}
      .apply{width:100%;padding:13px}
      .oparams{grid-template-columns:repeat(2,minmax(0,1fr))}
      .oparams b{white-space:normal}
    }
  `],
})
export class OffersComponent {
  readonly svc = inject(MortgageService);
  readonly osvc = inject(OffersService);
  readonly flow = inject(ApplicationFlowService);

  readonly sortAsc = signal(true);
  readonly visible = signal(PAGE);
  readonly selected = signal<BankOffer | null>(null);
  readonly pageSize = PAGE;

  /** Отфильтрованные по программе и отсортированные по платежу. */
  readonly filtered = computed(() => {
    const program = this.svc.input().program;
    const list = this.osvc.offers().filter((o) => this.osvc.matchesProgram(o, program));
    const dir = this.sortAsc() ? 1 : -1;
    return [...list].sort((a, b) => (a.monthly_payment - b.monthly_payment) * dir);
  });

  readonly shown = computed(() => this.filtered().slice(0, this.visible()));

  readonly propertyLabel = computed(() => {
    const key = this.svc.input().propertyType;
    const map: Record<string, string> = {
      SECONDARY: 'Вторичное жильё', NEW_BUILDING: 'Новостройка', HOUSE: 'Дом ИЖС',
    };
    return map[key] ?? '';
  });

  constructor() {
    // Перезагрузка предложений с дебаунсом при изменении параметров.
    effect((onCleanup) => {
      const i = this.svc.input();

      let q: MatchQuery = {
        cost: i.mode === 'by_payment' ? this.svc.loan() + i.down : i.cost,
        down: i.down,
        termMonths: i.months,
        programType: i.tab,
      };

      if (i.propertyType) {
        q.propertyType = i.propertyType;
      }

      const t = setTimeout(() => {
        this.visible.set(PAGE);
        void this.osvc.load(q);
      }, 400);
      onCleanup(() => clearTimeout(t));
    });
  }

  /** «Отправить заявку» → мастер анкеты из 5 шагов с префиллом из калькулятора. */
  startApplication(o: BankOffer): void {
    const i = this.svc.input();
    this.flow.open(o, {
      cost: i.mode === 'by_payment' ? Math.round(this.svc.loan() + i.down) : i.cost,
      down: i.down,
      years: this.svc.years(),
      propertyLabel: this.propertyLabel(),
    });
  }

  plural(n: number): string {
    const d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return 'предложение';
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'предложения';
    return 'предложений';
  }

  /** Детеминированный цвет плашки-логотипа по имени банка. */
  logoBg(name: string): string {
    const palette = ['#1B75BB', '#D6423A', '#0F6E56', '#7F77DD', '#BA7517', '#232F3D'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
}
