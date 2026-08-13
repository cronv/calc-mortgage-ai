import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/**
 * Переиспользуемая карточка-контейнер.
 * Standalone-компонент для shared/ui библиотеки.
 */
@Component({
  selector: 'ui-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" [class.compact]="compact()">
      <ng-content />
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .card {
      background: #fff;
      border: 1px solid var(--line, #DEDEDE);
      border-radius: 14px;
      padding: clamp(16px, 2.5vw, 24px);
    }
    .card.compact {
      padding: 14px 16px;
    }
  `]
})
export class CardComponent {
  compact = input<boolean>(false);
}
