import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Переиспользуемая кнопка с вариантами стилей.
 * Standalone-компонент для shared/ui библиотеки.
 */
@Component({
  selector: 'ui-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button 
      type="button"
      [class]="variantClass()"
      [disabled]="disabled()"
      (click)="onClick.emit()">
      <ng-content />
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 22px;
      padding: 11px 22px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .primary {
      background: var(--accent, #FEBD69);
      border-color: var(--accent, #FEBD69);
      color: #000;
      font-weight: 600;
    }
    .primary:hover:not(:disabled) {
      background: #e5a85a;
      border-color: #e5a85a;
    }
    .secondary {
      background: #fff;
      border-color: #000;
      color: #000;
    }
    .secondary:hover:not(:disabled) {
      background: var(--accent, #FEBD69);
      border-color: var(--accent, #FEBD69);
    }
    .ghost {
      background: var(--soft, #F8F8F8);
      border-color: var(--line, #DEDEDE);
      color: #000;
    }
    .ghost:hover:not(:disabled) {
      background: var(--line, #DEDEDE);
    }
    .danger {
      background: #E2574C;
      border-color: #E2574C;
      color: #fff;
    }
    .danger:hover:not(:disabled) {
      background: #c0392b;
      border-color: #c0392b;
    }
  `]
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  disabled = input<boolean>(false);
  onClick = output<void>();

  readonly variantClass = () => this.variant();
}
