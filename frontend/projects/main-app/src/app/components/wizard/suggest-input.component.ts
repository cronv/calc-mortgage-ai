import {
  Component, ChangeDetectionStrategy, input, output, signal, computed,
} from '@angular/core';

/**
 * Поле с подсказками (город / адрес) по ТЗ:
 * при вводе 3+ символов появляются подсказки; клик фиксирует значение
 * в поле с иконкой-крестиком, который сбрасывает выбор.
 */
@Component({
  selector: 'app-suggest-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fld" [class.err]="invalid()">
      <span>{{ label() }}</span>
      @if (picked()) {
        <div class="pickrow">
          <b>{{ value() }}</b>
          <button type="button" class="clear" aria-label="Очистить" (click)="clear()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      } @else {
        <input type="text" [value]="query()" [placeholder]="placeholder()"
               (input)="onInput($event)" (blur)="onBlur()">
      }
    </div>
    @if (!picked() && options().length > 0) {
      <div class="sugg">
        @for (opt of options(); track opt) {
          <button type="button" (mousedown)="pick(opt)">{{ opt }}</button>
        }
      </div>
    }
  `,
  styles: [`
    :host{display:block;position:relative;min-width:0}
    .fld{background:#fff;border:1px solid var(--line);border-radius:14px;padding:9px 14px 11px}
    .fld:focus-within{border-color:#000}
    .fld.err{border-color:#E2574C}
    .fld>span{display:block;font-size:12px;color:var(--muted);margin-bottom:2px}
    .fld input{width:100%;border:0;padding:0;font-size:16px;font-weight:600;background:transparent;-webkit-appearance:none;appearance:none}
    .fld input:focus{outline:0}
    .pickrow{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .pickrow b{font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .clear{border:0;background:var(--soft);border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:var(--muted);flex:0 0 auto}
    .clear:hover{background:var(--line);color:#000}
    .sugg{
      position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:50;background:#fff;
      border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,.12);
      max-height:240px;overflow-y:auto;
    }
    .sugg button{display:block;width:100%;text-align:left;border:0;background:#fff;padding:11px 14px;font-size:14px}
    .sugg button:hover{background:var(--soft)}
  `],
})
export class SuggestInputComponent {
  readonly label = input('');
  readonly placeholder = input('Введите');
  readonly value = input('');
  readonly invalid = input(false);
  /** Провайдер подсказок: (query) => string[] */
  readonly provider = input.required<(q: string) => string[]>();
  readonly valueChange = output<string>();

  readonly query = signal('');
  readonly picked = computed(() => this.value() !== '');
  readonly options = computed(() => this.provider()(this.query()));

  onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  pick(opt: string): void {
    this.valueChange.emit(opt);
    this.query.set('');
  }

  onBlur(): void {
    // Небольшая задержка не нужна: выбор идёт по mousedown (раньше blur).
  }

  clear(): void {
    this.valueChange.emit('');
    this.query.set('');
  }
}
