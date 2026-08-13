import {
  Component, ChangeDetectionStrategy, inject, signal, computed, output, input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MortgageService } from '../../services/mortgage.service';
import type { BankOffer } from '../../services/offers.service';

type FormState = 'idle' | 'sending' | 'success' | 'error';

/**
 * Форма заявки (подбора предложения).
 * Прикладывает снимок текущего расчёта и отправляет на /api/v1/application.
 * По успеху показывает экран благодарности с таймером автозакрытия.
 */
@Component({
  selector: 'app-application-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    @if (state() !== 'success') {
      @if (offer(); as o) {
        <div class="obadge"><b>{{ o.bank_name }}</b> · {{ o.program_name }} · от {{ o.calculated_rate }}%</div>

        <div class="snap">
          <div><span>Платёж</span><b>{{ o.monthly_payment | number:'1.0-0' }} ₽/мес</b></div>
          <div><span>Сумма кредита</span><b>{{ svc.loan() | number:'1.0-0' }} ₽</b></div>
          <div><span>Ставка</span><b>{{ o.calculated_rate }}%</b></div>
        </div>
      }
      <p class="lead">Оставьте контакты — подберём лучшие предложения банков под ваш расчёт.</p>

      <label class="fld">
        <span>Имя <i>*</i></span>
        <input [value]="name()" (input)="name.set(asValue($event))"
               [class.err]="touched() && !nameValid()" placeholder="Как к вам обращаться">
      </label>

      <label class="fld">
        <span>Телефон <i>*</i></span>
        <input [value]="phone()" (input)="onPhone($event)" inputmode="tel"
               [class.err]="touched() && !phoneValid()" placeholder="+7 (___) ___-__-__">
      </label>

      <label class="fld">
        <span>Email</span>
        <input [value]="email()" (input)="email.set(asValue($event))"
               [class.err]="touched() && email() !== '' && !emailValid()" placeholder="you@example.com">
      </label>

      @if (state() === 'error') {
        <div class="msg err-msg">Не удалось отправить заявку. Попробуйте ещё раз.</div>
      }

      <button type="button" class="submit" [disabled]="state() === 'sending'" (click)="submit()">
        {{ state() === 'sending' ? 'Отправляем…' : 'Получить предложения' }}
      </button>
      <p class="note">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
    } @else {
      <div class="thanks">
        <div class="ok">✓</div>
        <h3>Заявка отправлена!</h3>
        <p>Менеджер свяжется с вами в ближайшее время и подберёт лучшие условия.</p>
        <p class="cd">Окно закроется через {{ countdown() }} с</p>
        <button type="button" class="submit ghost" (click)="done.emit()">Закрыть</button>
      </div>
    }
  `,
  styles: [`
    .obadge{background:var(--dark);color:#fff;border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:14px}
    .obadge b{color:var(--accent)}
    .lead{color:var(--muted);margin-bottom:16px;font-size:15px}
    .snap{display:flex;gap:10px;background:var(--soft);border-radius:12px;padding:14px;margin-bottom:18px;flex-wrap:wrap}
    .snap>div{flex:1;min-width:120px}
    .snap span{display:block;font-size:12px;color:var(--muted)}
    .snap b{font-size:16px;font-weight:600}
    @media (max-width:420px){.snap{flex-direction:column;gap:8px}.snap>div{min-width:0}}
    .fld{display:block;margin-bottom:14px}
    .fld>span{display:block;font-size:14px;font-weight:500;margin-bottom:6px}
    .fld>span i{color:#E2574C;font-style:normal}
    .fld input{width:100%;height:48px;border:1px solid var(--line);border-radius:10px;padding:0 14px;font-size:16px}
    .fld input:focus{outline:0;border-color:#000}
    .fld input.err{border-color:#E2574C;background:#FEF4F3}
    .submit{width:100%;height:52px;border:0;border-radius:12px;background:var(--accent);font-weight:700;font-size:16px;margin-top:6px}
    .submit:disabled{opacity:.6}
    .submit.ghost{background:var(--soft);margin-top:14px}
    .note{font-size:12px;color:var(--muted);text-align:center;margin-top:10px}
    .msg{padding:11px 14px;border-radius:10px;font-size:14px;margin-bottom:12px}
    .err-msg{background:#FEF4F3;color:#C0392B}
    .thanks{text-align:center;padding:18px 8px}
    .thanks .ok{width:64px;height:64px;border-radius:50%;background:#E8F5E9;color:#2E7D32;font-size:34px;display:grid;place-items:center;margin:0 auto 16px}
    .thanks h3{font-size:22px;font-weight:700;margin-bottom:8px}
    .thanks p{color:var(--muted);max-width:380px;margin:0 auto 6px}
    .thanks .cd{font-size:13px;margin-top:10px}
  `],
})
export class ApplicationFormComponent {
  readonly svc = inject(MortgageService);
  /** Выбранное предложение банка (из списка предложений). */
  readonly offer = input<BankOffer | null>(null);
  /** Заявка успешно отправлена / закрыта пользователем. */
  readonly done = output<void>();

  readonly name = signal('');
  readonly phone = signal('');
  readonly email = signal('');
  readonly touched = signal(false);
  readonly state = signal<FormState>('idle');
  readonly countdown = signal(15);

  readonly nameValid = computed(() => this.name().trim().length >= 2);
  readonly phoneValid = computed(() => this.digits(this.phone()).length >= 10);
  readonly emailValid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email()));

  asValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  private digits(s: string): string {
    return s.replace(/\D+/g, '');
  }

  /** Простая маска +7 (xxx) xxx-xx-xx. */
  onPhone(e: Event): void {
    let d = this.digits(this.asValue(e));
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    this.phone.set(out);
  }

  async submit(): Promise<void> {
    this.touched.set(true);
    if (!this.nameValid() || !this.phoneValid()) return;
    if (this.email() !== '' && !this.emailValid()) return;

    this.state.set('sending');
    const i = this.svc.input();
    const payload = {
      name: this.name().trim(),
      phone: this.digits(this.phone()),
      email: this.email().trim() || null,
      offer: this.offer() ? {
        bank: this.offer()!.bank_name,
        program: this.offer()!.program_name,
        rate: this.offer()!.calculated_rate,
      } : null,
      calculation: {
        tab: i.tab,
        mode: i.mode,
        loan: this.svc.loan(),
        monthlyPayment: this.svc.monthlyPayment(),
        rate: this.svc.effectiveRate(),
        months: i.months,
      },
    };

    try {
      const res = await fetch('/api/v1/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('bad status ' + res.status);
      this.state.set('success');
      this.startCountdown();
    } catch {
      this.state.set('error');
    }
  }

  private startCountdown(): void {
    this.countdown.set(15);
    const t = setInterval(() => {
      this.countdown.update((c) => c - 1);
      if (this.countdown() <= 0) {
        clearInterval(t);
        this.done.emit();
      }
    }, 1000);
  }
}
