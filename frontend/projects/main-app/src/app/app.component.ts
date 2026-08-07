import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CalculatorComponent } from './components/calculator/calculator.component';
import { OffersComponent } from './components/offers/offers.component';
import { ApplicationWizardComponent } from './components/wizard/application-wizard.component';
import { ApplicationFlowService } from './services/application-flow.service';
import { environment } from './environments/environment';

/**
 * Каркас страницы по макету: тёмная шапка с навигацией, хлебные крошки,
 * заголовок, описание, CTA-ряд, калькулятор + предложения, рассылка и футер.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalculatorComponent, OffersComponent, ApplicationWizardComponent],
  template: `
    <!-- ШАПКА -->
    <header class="top">
      <div class="wrap trow">
<!--        <a class="logo" href="#">-->
<!--          <span class="mark">И</span> ИпотекаХаб-->
<!--        </a>-->
        <span class="geo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" stroke="currentColor" stroke-width="1.6"/>
            <circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.6"/>
          </svg>
          Москва
        </span>
        <span class="sp"></span>
        <nav class="ticons">
          <a href="#">Разместить</a>
          <a href="#">Избранное</a>
          <a href="#">Профиль</a>
        </nav>
      </div>
      <div class="navrow">
        <div class="wrap nlinks">
          <a href="#">Все</a><a href="#">Аренда</a><a href="#">Продажа</a>
          <a href="#">Новостройки</a><a href="#">Дома и участки</a><a href="#">Коммерческая</a>
          <a href="#" class="act">Ипотека</a><a href="#">Сделка</a><a href="#">Сервисы</a>
        </div>
      </div>
    </header>

    <main class="wrap">
      @if (flow.opened()) {
        <nav class="crumbs"><a href="#" (click)="$event.preventDefault(); flow.close()">Главная</a>
          <span>›</span> <a href="#" (click)="$event.preventDefault(); flow.close()">Ипотека</a>
          <span>›</span> <span>Подать заявку</span></nav>
        <h1>{{ flow.stepNumber() === 1 ? 'Параметры кредита' : 'Контактные данные' }}</h1>
        <app-application-wizard />
      } @else {
        <nav class="crumbs"><a href="#">Главная</a> <span>›</span> <span>Ипотека</span></nav>
        <h1>Ипотечный калькулятор</h1>

        <div class="intro">
          Узнайте все параметры вашего ипотечного кредита за пару минут. Калькулятор мгновенно
          покажет ставку, итоговую сумму и график платежей — просто и без лишних сложностей.
        </div>

        <div class="cta">
          <div class="cta-info">
            <div class="ci">
              <b>Перейдите в <a href="{{ baseRedirectUrl }}/login-server">личный кабинет</a></b>
              <span>и мы оповестим вас о сроках по продуктам</span>
            </div>
            <div class="ci">
              <b>Пройдите <a href="{{ baseRedirectUrl }}/login-user">регистрацию</a></b>
              <span>и мы сохраним все ваши данные и расчёты</span>
            </div>
          </div>
          <div class="cta-btns">
            <a class="btn ghost" href="#calc">Рассчитать ипотеку</a>
            <a class="btn" href="{{ baseRedirectUrl }}/resale-flats/list">Выбрать квартиру</a>
          </div>
        </div>

        <div id="calc"><app-calculator /></div>
        <div id="offers"><app-offers /></div>
      }
    </main>

    <!-- РАССЫЛКА -->
    <section class="subscribe">
      <div class="wrap srow">
        <div>
          <h2>Подпишитесь на рассылку</h2>
          <p>Узнавайте первыми о новостях, акциях, скидках и спецпредложениях!</p>
        </div>
        <div class="sform">
          @if (!subscribed()) {
            <input type="email" inputmode="email" placeholder="Введите e-mail"
                   #email (keydown.enter)="subscribe(email.value)">
            <button type="button" (click)="subscribe(email.value)">Подписаться</button>
          } @else {
            <div class="sok">Спасибо! Вы подписаны.</div>
          }
        </div>
      </div>
    </section>

    <!-- ФУТЕР -->
    <footer class="ftr">
      <div class="wrap fgrid">
        <div><a href="#">Справочный центр</a><a href="#">Тарифы и цены</a><a href="#">Проверка недвижимости</a></div>
        <div><a href="#">Юридические документы</a><a href="#">Реклама на сайте</a><a href="#">Карта сайта</a></div>
        <div><a href="#">Поиск на карте</a><a href="#">Продвижение</a><a href="#">Свежие объявления</a></div>
        <div><a href="#">Помощь</a><a href="#">Сайт для инвесторов</a><a href="#">Ипотечный калькулятор</a></div>
      </div>
      <div class="wrap fnote">
        © {{ year }} ИпотекаХаб — расчёты носят справочный характер и не являются публичной офертой.
      </div>
    </footer>
  `,
  styles: [`
    /* ---- Шапка ---- */
    .top{background:var(--dark);color:#fff}
    .trow{display:flex;align-items:center;gap:18px;height:58px}
    .logo{display:flex;align-items:center;gap:9px;font-weight:700;font-size:18px;color:#fff}
    .logo .mark{width:28px;height:28px;border-radius:8px;background:var(--accent);color:#000;display:flex;align-items:center;justify-content:center;font-size:15px}
    .geo{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:#cfd6dd}
    .sp{flex:1}
    .ticons{display:flex;gap:18px}
    .ticons a{color:#cfd6dd;font-size:13px}
    .ticons a:hover{color:#fff}
    .navrow{background:#1B2530;border-top:1px solid #2A3644}
    .nlinks{display:flex;gap:22px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
    .nlinks::-webkit-scrollbar{display:none}
    .nlinks a{color:#cfd6dd;font-size:14px;padding:12px 0;white-space:nowrap;border-bottom:2px solid transparent}
    .nlinks a.act{color:#fff;border-bottom-color:var(--accent)}
    .nlinks a:hover{color:#fff}

    /* ---- Заголовок и вводный блок ---- */
    .crumbs{font-size:13px;color:var(--muted);padding:16px 0 8px}
    .crumbs a{color:var(--ink)}
    .crumbs span{margin:0 2px}
    h1{font-weight:700;font-size:clamp(22px,4vw,30px);text-transform:uppercase;letter-spacing:.3px;margin-bottom:14px}
    .intro{background:var(--soft);border-radius:14px;padding:16px 20px;font-size:14px;color:#333;line-height:1.55;margin-bottom:16px}

    .cta{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px}
    .cta-info{display:flex;gap:28px;flex-wrap:wrap}
    .ci b{display:block;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.2px}
    .ci b a{color:var(--link)}
    .ci span{font-size:13px;color:var(--muted)}
    .cta-btns{display:flex;gap:10px;flex-wrap:wrap}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:24px;padding:12px 22px;font-size:14px;font-weight:600;background:var(--accent);color:#000}
    .btn.ghost{background:#fff;border:1px solid #000}

    /* ---- Рассылка ---- */
    .subscribe{background:var(--dark);color:#fff;margin-top:44px;padding:34px 0}
    .srow{display:flex;justify-content:space-between;align-items:center;gap:22px;flex-wrap:wrap}
    .subscribe h2{font-size:clamp(19px,3vw,24px);font-weight:700;margin-bottom:6px}
    .subscribe p{font-size:14px;color:#cfd6dd}
    .sform{display:flex;gap:10px;flex-wrap:wrap}
    .sform input{
      height:48px;border:0;border-radius:12px;padding:0 16px;font-size:15px;min-width:260px;
      font-family:inherit;-webkit-appearance:none;appearance:none;
    }
    .sform button{height:48px;border:0;border-radius:12px;padding:0 24px;font-size:15px;font-weight:600;background:var(--accent)}
    .sok{font-size:15px;color:var(--accent);padding:12px 0}

    /* ---- Футер ---- */
    .ftr{background:#0E141B;color:#cfd6dd;padding:30px 0 22px}
    .fgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
    .fgrid a{display:block;color:#cfd6dd;font-size:13px;padding:5px 0}
    .fgrid a:hover{color:#fff}
    .fnote{margin-top:22px;padding-top:16px;border-top:1px solid #2A3644;font-size:12px;color:#8a97a5}

    /* ---- Адаптив ---- */
    @media (max-width:900px){
      .fgrid{grid-template-columns:repeat(2,1fr)}
    }
    @media (max-width:620px){
      .geo{display:none}
      .ticons a:not(:last-child){display:none}
      .cta-btns{width:100%}
      .btn{flex:1;text-align:center}
      .sform{width:100%}
      .sform input{flex:1;min-width:0}
    }
    @media (max-width:400px){
      .fgrid{grid-template-columns:1fr}
      .sform button{width:100%}
    }
  `],
})
export class AppComponent {
  readonly baseRedirectUrl = environment.BASE_REDIRECT_URL;
  readonly flow = inject(ApplicationFlowService);
  readonly year = new Date().getFullYear();
  readonly subscribed = signal(false);

  constructor() {
    // Открытие анкеты по ссылке для заёмщика (?apply=1&...).
    if (typeof location !== 'undefined') {
      const q = new URLSearchParams(location.search);
      if (q.get('apply') === '1') this.flow.openFromUrl(q);
    }
  }

  subscribe(email: string): void {
    if (email.includes('@')) this.subscribed.set(true);
  }
}
