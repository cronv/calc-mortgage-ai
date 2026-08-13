import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

/**
 * Переиспользуемое поле ввода с плавающим лейблом.
 * Standalone-компонент для shared/ui библиотеки.
 */
@Component({
  selector: 'ui-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="fld" [class.err]="invalid()">
      @if (label()) {
        <span>{{ label() }}</span>
      }
      @if (type() === 'textarea') {
        <textarea 
          [value]="value()" 
          [placeholder]="placeholder()"
          [rows]="rows()"
          (input)="onInput($event)">
        </textarea>
      } @else {
        <input 
          [type]="type()" 
          [value]="value()" 
          [placeholder]="placeholder()"
          [inputmode]="inputmode()"
          (input)="onInput($event)">
      }
    </label>
  `,
  styles: [`
    :host {
      display: block;
    }
    .fld {
      display: block;
      background: #fff;
      border: 1px solid var(--line, #DEDEDE);
      border-radius: 14px;
      padding: 9px 14px 11px;
      min-width: 0;
    }
    .fld:focus-within {
      border-color: #000;
    }
    .fld.err {
      border-color: #E2574C;
    }
    .fld > span {
      display: block;
      font-size: 12px;
      color: var(--muted, #6A6A6A);
      margin-bottom: 2px;
    }
    .fld input,
    .fld textarea {
      width: 100%;
      border: 0;
      padding: 0;
      font-size: 16px;
      font-weight: 600;
      background: transparent;
      font-family: inherit;
      -webkit-appearance: none;
      appearance: none;
    }
    .fld input:focus,
    .fld textarea:focus {
      outline: 0;
    }
    .fld textarea {
      resize: vertical;
      min-height: 80px;
    }
  `]
})
export class InputComponent {
  label = input('');
  type = input<'text' | 'email' | 'tel' | 'number' | 'password' | 'textarea'>('text');
  value = input('');
  placeholder = input('Введите');
  invalid = input(false);
  inputmode = input<'text' | 'numeric' | 'tel' | 'email'>('text');
  rows = input<number>(3);
  
  onValueChange = output<string>();

  onInput(e: Event): void {
    const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.onValueChange.emit(value);
  }
}
