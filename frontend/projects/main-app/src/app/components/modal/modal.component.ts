import {
  Component, ChangeDetectionStrategy, input, output,
  effect, ElementRef, inject, HostListener,
} from '@angular/core';

/**
 * Переиспользуемое модальное окно.
 * Управляется сигналом open; закрывается по Esc, клику на фон и крестику.
 * Контент проецируется через <ng-content>. Блокирует скролл body, пока открыто.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="onBackdrop($event)">
        <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()">
          <header class="m-head">
            <h2>{{ title() }}</h2>
            <button type="button" class="x" aria-label="Закрыть" (click)="closed.emit()">×</button>
          </header>
          <div class="m-body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .backdrop{
      position:fixed;inset:0;z-index:1000;background:rgba(19,25,33,.55);
      display:flex;align-items:flex-start;justify-content:center;
      padding:40px 16px;overflow-y:auto;
      animation:fade .18s ease-out;
    }
    .dialog{
      background:#fff;border-radius:16px;width:100%;max-width:720px;
      box-shadow:0 24px 64px rgba(0,0,0,.28);
      animation:rise .22s cubic-bezier(.2,.8,.2,1);
      margin:auto;
    }
    .m-head{
      display:flex;align-items:center;justify-content:space-between;gap:12px;
      padding:20px 24px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#fff;border-radius:16px 16px 0 0;z-index:1;
    }
    .m-head h2{font-size:clamp(17px,4.5vw,20px);font-weight:700;line-height:1.2}
    .x{
      width:40px;height:40px;border:0;border-radius:9px;background:var(--soft);
      font-size:24px;line-height:1;color:var(--muted);flex:0 0 auto;
    }
    .x:hover{background:var(--line);color:#000}
    .m-body{padding:24px}
    @keyframes fade{from{opacity:0}to{opacity:1}}
    @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

    /* Планшет/мобильный: окно почти на весь экран, меньше отступы */
    @media (max-width:680px){
      .backdrop{padding:0;align-items:stretch}
      .dialog{
        max-width:100%;min-height:100%;border-radius:0;margin:0;
        display:flex;flex-direction:column;
      }
      .m-head{border-radius:0;padding:16px}
      .m-body{padding:16px;flex:1}
    }
  `],
})
export class ModalComponent {
  /** Открыто ли окно. */
  readonly open = input(false);
  /** Заголовок. */
  readonly title = input('');
  /** Закрывать по клику на фон (по умолчанию да). */
  readonly closeOnBackdrop = input(true);
  /** Событие закрытия. */
  readonly closed = output<void>();

  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    // Блокируем скролл body, пока окно открыто.
    effect(() => {
      const isOpen = this.open();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = isOpen ? 'hidden' : '';
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open()) this.closed.emit();
  }

  onBackdrop(e: MouseEvent): void {
    if (!this.closeOnBackdrop()) return;
    // Закрываем только если клик именно по фону, а не по диалогу.
    if ((e.target as HTMLElement).classList.contains('backdrop')) {
      this.closed.emit();
    }
  }
}
