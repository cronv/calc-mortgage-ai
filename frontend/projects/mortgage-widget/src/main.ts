/**
 * Встраиваемый виджет «Подбор ипотеки» (по макету):
 * слева — форма (По стоимости / По платежу), справа — тёмный таб-бар программ
 * и карточки предложений банков из единого API GET /api/v1/calculator/match,
 * внизу «+N предложений».
 *
 * Подключение: <script src="https://host/widget/mortgage-widget.js"
 *   data-partner="demo" data-color-primary="#FEBD69" data-api-base=""></script>
 *
 * Shadow DOM (изоляция стилей). Адаптивность — CSS Container Queries
 * (подстройка под ширину контейнера партнёра, от 375px), фолбэк на @media.
 * Событие родителю: postMessage 'mortgageWidget:onSuccess'.
 */

interface WidgetConfig {
  partner: string;
  primary: string;
  apiBase: string;
}

interface Offer {
  bank_name: string;
  program_name: string;
  program_type: string;
  tabs_type?: string;
  bank_logo_url?: string;
  calculated_rate: number;
  monthly_payment: number;
  overpayment: number;
  application_url: string | null;
}

const PROGRAM_TABS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'STANDARD', label: 'Стандартная' },
  { key: 'FAMILY', label: 'Семейная' },
  { key: 'MILITARY', label: 'Военная' },
  { key: 'IT', label: 'ИТ' },
  { key: 'FAR_EAST', label: 'Дальневосточная' },
  { key: 'ARCTIC', label: 'Арктическая' },
  { key: 'RURAL', label: 'Сельская' },
];

function readConfig(script: HTMLScriptElement | null): WidgetConfig {
  return {
    partner: script?.dataset['partner'] ?? 'demo',
    primary: script?.dataset['colorPrimary'] ?? '#FEBD69',
    apiBase: (script?.dataset['apiBase'] ?? '').replace(/\/$/, ''),
  };
}

function annuity(loan: number, months: number, rate: number): number {
  const i = rate / 100 / 12;
  if (months <= 0) return 0;
  if (i <= 0) return loan / months;
  const p = Math.pow(1 + i, months);
  return loan * i * p / (p - 1);
}

function loanFromPayment(payment: number, months: number, rate: number): number {
  const i = rate / 100 / 12;
  if (months <= 0) return 0;
  if (i <= 0) return payment * months;
  const p = Math.pow(1 + i, months);
  return payment * (p - 1) / (i * p);
}

const fmt = (n: number): string => Math.round(n).toLocaleString('ru-RU');

function matchesProgram(o: Offer, key: string): boolean {
  return o.tabs_type === key || (key === 'STANDARD' && !o.tabs_type);
}

function mount(host: HTMLElement, cfg: WidgetConfig): void {
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host { all: initial; display: block; container-type: inline-size; }
      *, *::before, *::after { box-sizing: border-box; }
      button, input { font-family: inherit; }

      .pw {
        font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
        color: #000; width: 100%;
      }
      h2 { font-size: clamp(20px, 5cqi, 28px); font-weight: 700; margin: 0 0 16px; }

      .cols { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 22px; align-items: start; }

      /* ---- Левая панель ---- */
      .modes { display: flex; gap: 8px; margin-bottom: 12px; }
      .modes button {
        flex: 1; border: 1px solid #000; background: #fff; border-radius: 22px;
        padding: 10px 8px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      }
      .modes button.on { background: ${cfg.primary}; border-color: ${cfg.primary}; color: #000; font-weight: 600; }
      .modes button:hover:not(.on) { background: #f0f0f0; }

      .fld {
        display: block; background: #fff; border: 1px solid #DEDEDE; border-radius: 14px;
        padding: 8px 14px 10px; margin-bottom: 10px; min-width: 0;
        transition: border-color 0.2s ease;
      }
      .fld:focus-within { border-color: #000; }
      .fld > span { display: block; font-size: 12px; color: #6A6A6A; margin-bottom: 2px; }
      .fld input {
        width: 100%; border: 0; padding: 0; font-size: 16px; font-weight: 600;
        background: transparent; -webkit-appearance: none; appearance: none;
      }
      .fld input:focus { outline: 0; }
      .tin { display: flex; align-items: center; gap: 8px; }
      .tin input { flex: 1; }
      .tin em { font-style: normal; font-size: 14px; color: #6A6A6A; border-left: 1px solid #DEDEDE; padding-left: 10px; }
      .note { font-size: 12px; color: #6A6A6A; line-height: 1.5; margin-top: 12px; }

      /* ---- Правая колонка ---- */
      .ptabs {
        display: flex; gap: 4px; background: #131921; border-radius: 16px; padding: 8px;
        overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; margin-bottom: 14px;
        -ms-overflow-style: none;
      }
      .ptabs::-webkit-scrollbar { display: none; }
      .ptabs button {
        border: 0; background: transparent; color: #fff; border-radius: 10px;
        padding: 9px 14px; font-size: 13px; font-weight: 500; cursor: pointer;
        white-space: nowrap; flex: 0 0 auto;
        transition: background-color 0.2s ease, color 0.2s ease;
      }
      .ptabs button:hover:not(.on) { background: rgba(255,255,255,0.1); }
      .ptabs button.on { background: ${cfg.primary}; color: #000; font-weight: 600; }

      .card {
        background: #fff; border: 1px solid #DEDEDE; border-radius: 14px;
        padding: 16px 18px; margin-bottom: 12px;
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
      .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      .chead { display: flex; gap: 12px; align-items: flex-start; }
      .logo {
        width: 38px; height: 38px; border-radius: 10px; background: #1B75BB; color: #fff;
        font-weight: 700; font-size: 16px; display: flex; align-items: center;
        justify-content: center; flex: 0 0 auto;
      }
      .bname { min-width: 0; flex: 1; }
      .bname b { display: block; font-size: 15px; font-weight: 600; }
      .bname span { font-size: 12px; color: #6A6A6A; }
      .cpay { text-align: right; flex: 0 0 auto; }
      .cpay b { display: block; font-size: clamp(17px, 4cqi, 20px); font-weight: 700; white-space: nowrap; }
      .cpay span { font-size: 12px; color: #6A6A6A; }
      .cfoot {
        display: flex; justify-content: space-between; align-items: center; gap: 12px;
        margin-top: 12px; padding-top: 12px; border-top: 1px solid #EEE; flex-wrap: wrap;
      }
      .cfoot .psk { font-size: 13px; color: #6A6A6A; }
      .apply {
        border: 1px solid #000; background: #fff; border-radius: 22px; padding: 10px 18px;
        font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      }
      .apply:hover { background: ${cfg.primary}; border-color: ${cfg.primary}; color: #000; }

      .more { text-align: center; }
      .more button { border: 0; background: transparent; color: #1B75BB; font-size: 14px; cursor: pointer; padding: 8px 12px; text-decoration: underline; }
      .more button:hover { color: #0d5a8a; }
      .empty { background: #F8F8F8; border-radius: 12px; padding: 20px; text-align: center; color: #6A6A6A; font-size: 14px; }

      .thanks { text-align: center; padding: 22px 8px; }
      .thanks .ic {
        width: 54px; height: 54px; border-radius: 50%; background: #E8F5E9; color: #2E7D32;
        font-size: 28px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;
      }
      .thanks b { display: block; font-size: 17px; margin-bottom: 4px; }
      .thanks span { font-size: 13px; color: #6A6A6A; }

      /* ---- Адаптив по ширине контейнера (Container Queries) ---- */
      @container (max-width: 760px) {
        .cols { grid-template-columns: 1fr; }
        aside { order: 2; }
        section { order: 1; }
      }
      @container (max-width: 420px) {
        h2 { font-size: 20px; }
        .modes { flex-direction: column; }
        .modes button { width: 100%; }
        .ptabs { gap: 6px; }
        .ptabs button { padding: 8px 10px; font-size: 12px; }
        .chead { flex-wrap: wrap; }
        .cpay { text-align: left; width: 100%; padding-left: 50px; margin-top: 8px; }
        .cfoot { flex-direction: column; align-items: stretch; }
        .apply { width: 100%; text-align: center; padding: 12px; }
        .fld { padding: 10px 12px; }
        .fld input { font-size: 15px; }
      }

      /* ---- Фолбэк для браузеров без Container Queries (@media) ---- */
      @supports not (container-type: inline-size) {
        @media (max-width: 800px) {
          .cols { grid-template-columns: 1fr; }
          aside { order: 2; }
          section { order: 1; }
        }
        @media (max-width: 430px) {
          h2 { font-size: 20px; }
          .modes { flex-direction: column; }
          .modes button { width: 100%; }
          .ptabs { gap: 6px; }
          .ptabs button { padding: 8px 10px; font-size: 12px; }
          .chead { flex-wrap: wrap; }
          .cpay { text-align: left; width: 100%; padding-left: 50px; margin-top: 8px; }
          .cfoot { flex-direction: column; align-items: stretch; }
          .apply { width: 100%; text-align: center; padding: 12px; }
          .fld { padding: 10px 12px; }
          .fld input { font-size: 15px; }
        }
      }

      /* ---- Кроссбраузерные улучшения ---- */
      @media screen and (-webkit-min-device-pixel-ratio: 0) {
        .fld input::-webkit-outer-spin-button,
        .fld input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .fld input[type=number] {
          -moz-appearance: textfield;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
          animation: none !important;
        }
      }
    </style>

    <div class="pw">
      <div class="cols">
        <aside>
          <h2>Подбор ипотеки</h2>
          <div class="modes">
            <button type="button" data-mode="by_cost" class="on">По стоимости</button>
            <button type="button" data-mode="by_payment">По платежу</button>
          </div>
          <label class="fld" id="f-cost">
            <span>Стоимость недвижимости</span>
            <input id="cost" inputmode="numeric" value="4 000 000">
          </label>
          <label class="fld" id="f-pay" style="display:none">
            <span>Желаемый платёж, ₽/мес</span>
            <input id="pay" inputmode="numeric" value="30 000">
          </label>
          <label class="fld">
            <span>Первоначальный взнос</span>
            <input id="down" inputmode="numeric" value="2 500 000">
          </label>
          <label class="fld">
            <span>Ставка</span>
            <input id="rate" inputmode="decimal" value="15,5">
          </label>
          <label class="fld">
            <span>Срок в годах</span>
            <div class="tin"><input id="term" inputmode="numeric" value="20"><em>г.</em></div>
          </label>
          <p class="note">Это предварительные предложения от банков. Чтобы отправить в них заявку,
          нужно будет заполнить анкету на следующем шаге.</p>
        </aside>

        <section>
          <div class="ptabs" id="ptabs"></div>
          <div id="list"></div>
          <div class="more" id="more" style="display:none">
            <button type="button" id="morebtn"></button>
          </div>
        </section>
      </div>
    </div>
  `;

  const $ = (id: string): HTMLElement => shadow.getElementById(id)!;
  const num = (id: string): number =>
    parseFloat((($(id) as HTMLInputElement).value || '').replace(/\s/g, '').replace(',', '.')) || 0;

  let mode: 'by_cost' | 'by_payment' = 'by_cost';
  let activeProgram = 'STANDARD';
  let offers: Offer[] = [];
  let expanded = false;
  let fetchTimer: number | undefined;
  let aborter: AbortController | null = null;

  // ---- Табы программ ----
  const tabsEl = $('ptabs');
  for (const t of PROGRAM_TABS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.label;
    b.dataset['key'] = t.key;
    if (t.key === activeProgram) b.classList.add('on');
    b.addEventListener('click', () => {
      activeProgram = t.key;
      expanded = false;
      tabsEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      render();
    });
    tabsEl.appendChild(b);
  }

  // ---- Режимы ----
  shadow.querySelectorAll('.modes button').forEach((b) => {
    b.addEventListener('click', () => {
      mode = (b as HTMLElement).dataset['mode'] as typeof mode;
      shadow.querySelectorAll('.modes button').forEach((x) => x.classList.toggle('on', x === b));
      $('f-cost').style.display = mode === 'by_cost' ? '' : 'none';
      $('f-pay').style.display = mode === 'by_payment' ? '' : 'none';
      scheduleFetch();
    });
  });

  function currentCost(): number {
    if (mode === 'by_cost') return num('cost');
    const months = num('term') * 12;
    return loanFromPayment(num('pay'), months, num('rate')) + num('down');
  }

  // ---- Загрузка предложений из единого API ----
  async function fetchOffers(): Promise<void> {
    const cost = currentCost();
    const months = Math.max(12, num('term') * 12);
    aborter?.abort();
    aborter = new AbortController();
    try {
      const q = new URLSearchParams({
        cost: String(Math.round(cost)),
        down_payment: String(Math.round(num('down'))),
        term: String(months),
      });
      const res = await fetch(`${cfg.apiBase}/api/v1/calculator/match?${q}`, { signal: aborter.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { offers?: Offer[] };
      offers = data.offers ?? [];
    } catch {
      // Фолбэк: локальный предварительный расчёт, чтобы виджет оставался полезным без API.
      const loan = Math.max(0, cost - num('down'));
      offers = [{
        bank_name: 'Предварительный расчёт',
        program_name: 'Стандартная',
        program_type: 'STANDARD',
        calculated_rate: num('rate'),
        monthly_payment: annuity(loan, months, num('rate')),
        overpayment: annuity(loan, months, num('rate')) * months - loan,
        application_url: null,
      }];
    }
    render();
  }

  function scheduleFetch(): void {
    window.clearTimeout(fetchTimer);
    fetchTimer = window.setTimeout(() => { void fetchOffers(); }, 350);
  }

  ['cost', 'pay', 'down', 'rate', 'term'].forEach((id) =>
    $(id).addEventListener('input', scheduleFetch));
  ['cost', 'pay', 'down'].forEach((id) =>
    $(id).addEventListener('blur', () => {
      const v = num(id);
      if (v > 0) ($(id) as HTMLInputElement).value = v.toLocaleString('ru-RU');
    }));

  // ---- Рендер списка ----
  function render(): void {
    const list = $('list');
    const visible = offers.filter((o) => matchesProgram(o, activeProgram));
    const shown = expanded ? visible : visible.slice(0, 4);

    if (visible.length === 0) {
      list.innerHTML = `<div class="empty">По программе «${PROGRAM_TABS.find((t) => t.key === activeProgram)?.label}» предложений не найдено. Попробуйте другую программу.</div>`;
      $('more').style.display = 'none';
      return;
    }

    list.innerHTML = shown.map((o: Offer) => {
      const logoContent = o.bank_logo_url
        ? `<img src="${o.bank_logo_url}" alt="${o.bank_name}" class="ologo-img" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" />`
        : o.bank_name.charAt(0).toUpperCase();
      return `
      <div class="card">
        <div class="chead">
          <div class="logo">${logoContent}</div>
          <div class="bname"><b></b><span>Вторичное жильё</span></div>
          <div class="cpay"><b>${fmt(o.monthly_payment)} ₽/мес</b><span>от ${o.calculated_rate}%</span></div>
        </div>
        <div class="cfoot">
          <span class="psk">Переплата по кредиту ${fmt(o.overpayment)} ₽</span>
          <button type="button" class="apply">Отправить заявку</button>
        </div>
      </div>
    `;
    }).join('');

    // Имена банков — через textContent (защита от инъекций в данных API).
    list.querySelectorAll('.bname b').forEach((el, i) => { el.textContent = shown[i].bank_name; });

    list.querySelectorAll('.apply').forEach((btn, i) => {
      btn.addEventListener('click', () => onApply(shown[i]));
    });

    const hidden = visible.length - shown.length;
    $('more').style.display = hidden > 0 ? '' : 'none';
    if (hidden > 0) {
      $('morebtn').textContent = `+${hidden} предложени${hidden === 1 ? 'е' : hidden < 5 ? 'я' : 'й'}`;
    }
  }

  $('morebtn').addEventListener('click', () => { expanded = true; render(); });

  // ---- Заявка ----
  function onApply(offer: Offer): void {
    try {
      window.parent.postMessage({
        type: 'mortgageWidget:onSuccess',
        payload: {
          partner: cfg.partner,
          bank: offer.bank_name,
          rate: offer.calculated_rate,
          payment: Math.round(offer.monthly_payment),
          cost: Math.round(currentCost()),
          down: num('down'),
          termYears: num('term'),
        },
      }, '*');
    } catch { /* родительское окно может быть недоступно */ }

    const list = $('list');
    list.innerHTML = `
      <div class="card"><div class="thanks">
        <div class="ic">✓</div>
        <b>Заявка отправлена!</b>
        <span>Партнёр свяжется с вами. Вернёмся к предложениям через <i id="cd">10</i> с</span>
      </div></div>`;
    let sec = 10;
    const t = window.setInterval(() => {
      sec--;
      const cd = shadow.getElementById('cd');
      if (cd) cd.textContent = String(sec);
      if (sec <= 0) { window.clearInterval(t); render(); }
    }, 1000);
  }

  void fetchOffers();
}

// ---- Точка входа: монтируем рядом со своим <script> ----
const current = document.currentScript as HTMLScriptElement | null;
const cfg = readConfig(current);
const hostParent = current?.parentNode as HTMLElement | null;

if (hostParent && hostParent.id === 'mortgage-widget-demo') {
  mount(hostParent, cfg);
} else if (hostParent) {
  const hostEl = document.createElement('div');
  hostParent.insertBefore(hostEl, current);
  mount(hostEl, cfg);
} else {
  const demo = document.getElementById('mortgage-widget-demo');
  if (demo) mount(demo, cfg);
}
