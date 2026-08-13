import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Переиспользуемый индикатор загрузки (spinner).
 * Standalone-компонент для shared/ui библиотеки.
 */
@Component({
  selector: 'ui-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loader" role="status" aria-label="Загрузка">
      <svg viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
      </svg>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .loader {
      width: 40px;
      height: 40px;
      animation: rotate 1s linear infinite;
    }
    .loader circle {
      stroke: var(--accent, #FEBD69);
      stroke-linecap: round;
      stroke-dasharray: 80, 200;
      stroke-dashoffset: 0;
      animation: dash 1.5s ease-in-out infinite;
    }
    @keyframes rotate {
      to { transform: rotate(360deg); }
    }
    @keyframes dash {
      0% {
        stroke-dasharray: 1, 200;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 89, 200;
        stroke-dashoffset: -35px;
      }
      100% {
        stroke-dasharray: 89, 200;
        stroke-dashoffset: -124px;
      }
    }
  `]
})
export class LoaderComponent {}
