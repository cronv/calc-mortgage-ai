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
  return o.tabs_type === key;
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
        color: #000; width: 100%; max-width: 100%; overflow-x: hidden; position: relative;
      }
      h2 { font-size: clamp(18px, 5cqi, 24px); font-weight: 700; margin: 0 0 12px; line-height: 1.3; }

      .cols { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 16px; align-items: start; }

      /* ---- Левая панель ---- */
      aside { min-width: 0; max-width: 100%; }
      .modes { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .modes button {
        flex: 1 1 auto; border: 1px solid #000; background: #fff; border-radius: 22px;
        padding: 10px 8px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
        min-width: 0;
      }
      .modes button.on { background: ${cfg.primary}; border-color: ${cfg.primary}; font-weight: 600; }

      .fld {
        display: block; background: #fff; border: 1px solid #DEDEDE; border-radius: 14px;
        padding: 8px 14px 10px; margin-bottom: 10px; min-width: 0; max-width: 100%;
      }
      .fld:focus-within { border-color: #000; }
      .fld > span { display: block; font-size: 12px; color: #6A6A6A; margin-bottom: 2px; line-height: 1.3; }
      .fld input {
        width: 100%; border: 0; padding: 0; font-size: 16px; font-weight: 600;
        background: transparent; -webkit-appearance: none; appearance: none;
        min-width: 0; max-width: 100%;
      }
      .fld input:focus { outline: 0; }
      .tin { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .tin input { flex: 1 1 0; min-width: 0; }
      .tin em { font-style: normal; font-size: 14px; color: #6A6A6A; border-left: 1px solid #DEDEDE; padding-left: 10px; white-space: nowrap; }
      .note { font-size: 12px; color: #6A6A6A; line-height: 1.5; margin-top: 12px; }

      /* ---- Правая колонка ---- */
      section { min-width: 0; max-width: 100%; overflow-x: hidden; }
      .ptabs {
        display: flex; gap: 4px; background: #131921; border-radius: 16px; padding: 8px;
        overflow-x: auto; scrollbar-width: thin; -webkit-overflow-scrolling: touch; margin-bottom: 14px;
        -ms-overflow-style: none;
      }
      .ptabs::-webkit-scrollbar { width: 4px; height: 4px; }
      .ptabs::-webkit-scrollbar-track { background: transparent; }
      .ptabs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 2px; }
      .ptabs button {
        border: 0; background: transparent; color: #fff; border-radius: 10px;
        padding: 9px 14px; font-size: 13px; font-weight: 500; cursor: pointer;
        white-space: nowrap; flex: 0 0 auto;
      }
      .ptabs button.on { background: ${cfg.primary}; color: #000; font-weight: 600; }

      .card {
        background: #fff; border: 1px solid #DEDEDE; border-radius: 14px;
        padding: 14px 16px; margin-bottom: 12px; max-width: 100%; overflow: hidden;
      }
      .chead { display: grid; grid-template-columns: 38px 1fr auto; grid-template-areas: "logo bname cpay"; gap: 12px; align-items: start; }
      .logo {
        width: 38px; height: 38px; border-radius: 10px; background: #1B75BB; color: #fff;
        font-weight: 700; font-size: 16px; display: flex; align-items: center;
        justify-content: center; grid-area: logo; overflow: hidden;
      }
      .bname { grid-area: bname; min-width: 0; word-wrap: break-word; }
      .bname b { display: block; font-size: 15px; font-weight: 600; line-height: 1.3; overflow-wrap: break-word; }
      .bname span { font-size: 12px; color: #6A6A6A; line-height: 1.3; display: block; }
      .cpay { grid-area: cpay; text-align: right; min-width: 120px; }
      .cpay b { display: block; font-size: clamp(15px, 4cqi, 18px); font-weight: 700; white-space: nowrap; line-height: 1.3; }
      .cpay span { font-size: 12px; color: #6A6A6A; white-space: nowrap; display: block; }
      .cfoot {
        display: flex; justify-content: space-between; align-items: center; gap: 12px;
        margin-top: 12px; padding-top: 12px; border-top: 1px solid #EEE; flex-wrap: wrap;
      }
      .cfoot .psk { font-size: 13px; color: #6A6A6A; line-height: 1.4; flex: 1 1 auto; min-width: 0; }
      .apply {
        border: 1px solid #000; background: #fff; border-radius: 22px; padding: 10px 18px;
        font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
      }
      .apply:hover { background: ${cfg.primary}; border-color: ${cfg.primary}; }

      .more { text-align: center; }
      .more button { border: 0; background: transparent; color: #1B75BB; font-size: 14px; cursor: pointer; padding: 8px 12px; }
      .empty { background: #F8F8F8; border-radius: 12px; padding: 20px; text-align: center; color: #6A6A6A; font-size: 14px; line-height: 1.5; }

      .thanks { text-align: center; padding: 22px 8px; }
      .thanks .ic {
        width: 54px; height: 54px; border-radius: 50%; background: #E8F5E9; color: #2E7D32;
        font-size: 28px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;
      }
      .thanks b { display: block; font-size: 17px; margin-bottom: 4px; }
      .thanks span { font-size: 13px; color: #6A6A6A; }

      /* ---- Модальное окно ---- */
      .modal-backdrop {
        position: fixed; inset: 0; z-index: 1000; background: rgba(19,25,33,.55);
        display: none; align-items: flex-start; justify-content: center;
        padding: 40px 16px; overflow-y: auto; animation: fade .18s ease-out;
      }
      .modal-backdrop.open { display: flex; }
      .modal-dialog {
        background: #fff; border-radius: 16px; width: 100%; max-width: 720px;
        box-shadow: 0 24px 64px rgba(0,0,0,.28); animation: rise .22s cubic-bezier(.2,.8,.2,1);
        margin: auto; max-height: 90vh; overflow-y: auto;
      }
      .modal-header {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 20px 24px; border-bottom: 1px solid #DEDEDE; position: sticky; top: 0;
        background: #fff; border-radius: 16px 16px 0 0; z-index: 1;
      }
      .modal-header h2 { font-size: clamp(17px, 4.5vw, 20px); font-weight: 700; line-height: 1.2; margin: 0; }
      .modal-close {
        width: 40px; height: 40px; border: 0; border-radius: 9px; background: #F8F8F8;
        font-size: 24px; line-height: 1; color: #6A6A6A; cursor: pointer; flex: 0 0 auto;
      }
      .modal-close:hover { background: #DEDEDE; color: #000; }
      .modal-body { padding: 24px; }
      @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }

      /* ---- Форма заявки ---- */
      .form-offer-badge {
        background: #131921; color: #fff; border-radius: 10px; padding: 10px 14px;
        font-size: 14px; margin-bottom: 14px;
      }
      .form-offer-badge b { color: ${cfg.primary}; }
      .form-lead { color: #6A6A6A; margin-bottom: 16px; font-size: 15px; }
      .form-snap {
        display: flex; gap: 10px; background: #F8F8F8; border-radius: 12px;
        padding: 14px; margin-bottom: 18px; flex-wrap: wrap;
      }
      .form-snap > div { flex: 1; min-width: 120px; }
      .form-snap span { display: block; font-size: 12px; color: #6A6A6A; }
      .form-snap b { font-size: 16px; font-weight: 600; }
      .form-field { display: block; margin-bottom: 14px; }
      .form-field > span { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; }
      .form-field > span i { color: #E2574C; font-style: normal; }
      .form-field input {
        width: 100%; height: 48px; border: 1px solid #DEDEDE; border-radius: 10px;
        padding: 0 14px; font-size: 16px; font-family: inherit;
      }
      .form-field input:focus { outline: 0; border-color: #000; }
      .form-field input.err { border-color: #E2574C; background: #FEF4F3; }
      .form-submit {
        width: 100%; height: 52px; border: 0; border-radius: 12px;
        background: ${cfg.primary}; font-weight: 700; font-size: 16px; margin-top: 6px;
        cursor: pointer;
      }
      .form-submit:disabled { opacity: .6; cursor: not-allowed; }
      .form-submit.ghost { background: #F8F8F8; margin-top: 14px; }
      .form-note { font-size: 12px; color: #6A6A6A; text-align: center; margin-top: 10px; }
      .form-msg { padding: 11px 14px; border-radius: 10px; font-size: 14px; margin-bottom: 12px; }
      .form-err-msg { background: #FEF4F3; color: #C0392B; }
      .form-thanks { text-align: center; padding: 18px 8px; }
      .form-thanks .ok {
        width: 64px; height: 64px; border-radius: 50%; background: #E8F5E9;
        color: #2E7D32; font-size: 34px; display: grid; place-items: center; margin: 0 auto 16px;
      }
      .form-thanks h3 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
      .form-thanks p { color: #6A6A6A; max-width: 380px; margin: 0 auto 6px; }
      .form-thanks .cd { font-size: 13px; margin-top: 10px; }

      @media (max-width: 420px) {
        .form-snap { flex-direction: column; gap: 8px; }
        .form-snap > div { min-width: 0; }
      }
      @media (max-width: 680px) {
        .modal-backdrop { padding: 0; align-items: stretch; }
        .modal-dialog { max-width: 100%; min-height: 100%; border-radius: 0; margin: 0; }
        .modal-header { border-radius: 0; padding: 16px; }
        .modal-body { padding: 16px; }
      }

      /* ========== АДАПТИВНОСТЬ ЧЕРЕЗ @media (ОСНОВНОЙ ПОДХОД) ========== */
      
      /* Планшет и меньше: одна колонка, форма сверху */
      @media (max-width: 900px) {
        .cols { grid-template-columns: 1fr; }
        aside { order: -1; position: sticky; top: 0; background: #fff; z-index: 10; padding-bottom: 12px; border-bottom: 1px solid #EEE; }
      }

      /* Мобильные ≤768px */
      @media (max-width: 768px) {
        .pw { padding: 0 8px; }
        .cols { gap: 12px; }
        .modes { gap: 6px; }
        .modes button { padding: 8px 6px; font-size: 12px; }
        .fld { padding: 6px 12px 8px; }
        .fld input { font-size: 15px; }
        .ptabs { padding: 6px; gap: 3px; }
        .ptabs button { padding: 8px 12px; font-size: 12px; }
        .card { padding: 12px 14px; }
      }

      /* Мобильные ≤620px */
      @media (max-width: 620px) {
        .pw { padding: 0 4px; }
        h2 { font-size: 18px; margin-bottom: 10px; }
        .chead { grid-template-columns: 36px 1fr auto; gap: 10px; }
        .logo { width: 36px; height: 36px; font-size: 14px; }
        .bname b { font-size: 14px; }
        .bname span { font-size: 11px; }
        .cpay { min-width: 100px; text-align: right; }
        .cpay b { font-size: 15px; }
        .cfoot { flex-direction: column; align-items: stretch; gap: 10px; }
        .cfoot .psk { text-align: center; }
        .apply { width: 100%; text-align: center; padding: 12px; }
      }

      /* Малые мобильные ≤480px */
      @media (max-width: 480px) {
        .pw { padding: 0 2px; }
        .modes { flex-direction: column; gap: 6px; }
        .modes button { width: 100%; text-align: center; }
        .fld { margin-bottom: 8px; }
        .fld input { font-size: 14px; }
        .tin em { font-size: 13px; padding-left: 8px; }
        .ptabs { margin-bottom: 10px; }
        .ptabs button { padding: 7px 10px; font-size: 11px; border-radius: 8px; }
        .card { padding: 10px 12px; margin-bottom: 10px; border-radius: 12px; }
        .chead { grid-template-columns: 32px 1fr; grid-template-areas: "logo bname" "logo cpay"; gap: 8px; }
        .logo { grid-area: logo; width: 32px; height: 32px; font-size: 13px; }
        .bname { grid-area: bname; }
        .cpay { grid-area: cpay; text-align: left; min-width: 0; padding-left: 4px; }
        .cpay b { font-size: 15px; }
        .cpay span { font-size: 11px; }
        .cfoot .psk { font-size: 12px; }
        .apply { padding: 11px; font-size: 13px; }
        .note { font-size: 11px; }
      }

      /* Очень малые экраны ≤375px (минимальная ширина) */
      @media (max-width: 375px) {
        .pw { padding: 0; }
        h2 { font-size: 16px; margin-bottom: 8px; }
        .fld { padding: 5px 10px 7px; border-radius: 12px; }
        .fld > span { font-size: 11px; }
        .fld input { font-size: 13px; }
        .tin em { font-size: 12px; padding-left: 6px; }
        .chead { grid-template-columns: 30px 1fr; grid-template-areas: "logo bname" "logo cpay"; gap: 6px; }
        .logo { grid-area: logo; width: 30px; height: 30px; font-size: 12px; }
        .bname { grid-area: bname; }
        .bname b { font-size: 13px; }
        .bname span { font-size: 10px; }
        .cpay { grid-area: cpay; padding-left: 2px; }
        .cpay b { font-size: 14px; }
        .cpay span { font-size: 10px; }
        .cfoot .psk { font-size: 11px; }
        .apply { padding: 10px; font-size: 12px; border-radius: 20px; }
        .ptabs button { padding: 6px 8px; font-size: 10px; }
      }

      /* Фолбэк для browser без container queries */
      @supports not (container-type: inline-size) {
        @media (max-width: 800px) { .cols { grid-template-columns: 1fr; } }
        @media (max-width: 430px) {
          .chead { grid-template-columns: 32px 1fr; grid-template-areas: "logo bname" "logo cpay"; }
          .cfoot { flex-direction: column; align-items: stretch; }
          .apply { width: 100%; }
        }
      }

      /* Container Queries как дополнение для гибкости внутри контейнеров */
      @container (max-width: 760px) {
        .cols { grid-template-columns: 1fr; }
      }
      @container (max-width: 480px) {
        .chead { grid-template-columns: 32px 1fr; grid-template-areas: "logo bname" "logo cpay"; gap: 8px; }
        .logo { width: 32px; height: 32px; }
        .cpay { text-align: left; min-width: 0; padding-left: 4px; }
        .cfoot { flex-direction: column; align-items: stretch; }
        .apply { width: 100%; text-align: center; padding: 12px; }
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
            <input id="cost" type="text" inputmode="numeric" value="4 000 000">
          </label>
          <label class="fld" id="f-pay" style="display:none">
            <span>Желаемый платёж, ₽/мес</span>
            <input id="pay" type="text" inputmode="numeric" value="30 000">
          </label>
          <label class="fld">
            <span>Первоначальный взнос</span>
            <input id="down" type="text" inputmode="numeric" value="2 500 000">
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

      <!-- Модальное окно -->
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal-dialog">
          <header class="modal-header">
            <h2>Подробнее</h2>
            <button type="button" class="modal-close" id="modal-close-btn" aria-label="Закрыть">×</button>
          </header>
          <div class="modal-body" id="modal-body-content"></div>
        </div>
      </div>
    </div>
  `;

  const $ = (id: string): HTMLElement => shadow.getElementById(id)!;
  const num = (id: string): number =>
    parseFloat((($(id) as HTMLInputElement).value || '').replace(/\s/g, '').replace(',', '.')) || 0;

  /** Формат денег с пробелами-разделителями. */
  const fmtMoney = (v: number): string => v > 0 ? Math.round(v).toLocaleString('ru-RU') : '';

  /** Обработчик ввода для денежных полей с маской. */
  function onMoneyInput(e: Event, id: string): void {
    const input = e.target as HTMLInputElement;
    const oldCursorPos = input.selectionStart || 0;
    const oldValue = input.value;
    
    // Удаляем все нецифровые символы
    const raw = oldValue.replace(/\D+/g, '');
    const value = Number(raw) || 0;
    const newValue = fmtMoney(value);
    
    // Обновляем значение
    input.value = newValue;
    
    // Вычисляем новую позицию курсора
    const diff = newValue.length - oldValue.length;
    const newCursorPos = Math.min(oldCursorPos + diff, newValue.length);
    
    requestAnimationFrame(() => {
      input.focus();
      try {
        input.setSelectionRange(newCursorPos, newCursorPos);
      } catch {}
    });
  }

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

  // ---- Обработчики для денежных полей (cost, pay, down) с маской ----
  ['cost', 'pay', 'down'].forEach((id) => {
    const el = $(id) as HTMLInputElement;
    el.addEventListener('input', (e) => {
      onMoneyInput(e, id);
      scheduleFetch();
    });
    el.addEventListener('blur', () => {
      const v = num(id);
      if (v > 0) el.value = fmtMoney(v);
    });
  });

  // ---- Обработчики для остальных полей (rate, term) ----
  ['rate', 'term'].forEach((id) =>
    $(id).addEventListener('input', scheduleFetch));

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

  // ---- Модальное окно и форма заявки ----
  let modalOpen = false;
  let formState: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  let selectedOffer: Offer | null = null;
  let countdownValue = 15;
  let countdownTimer: number | undefined;

  const formData = { name: '', phone: '', email: '' };
  const formTouched = { value: false };

  function openModal(offer: Offer): void {
    selectedOffer = offer;
    formState = 'idle';
    formData.name = '';
    formData.phone = '';
    formData.email = '';
    formTouched.value = false;
    modalOpen = true;
    renderModal();
    document.body.style.overflow = 'hidden';
    // Фокус на первое поле после рендера
    const nameInput = shadow.getElementById('form-name') as HTMLInputElement | null;
    if (nameInput) nameInput.focus();
  }

  function closeModal(): void {
    modalOpen = false;
    document.body.style.overflow = '';
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = undefined;
    }
    renderModal();
  }

  function startCountdown(): void {
    countdownValue = 15;
    countdownTimer = window.setInterval(() => {
      countdownValue--;
      const cdEl = shadow.getElementById('form-cd');
      if (cdEl) cdEl.textContent = String(countdownValue);
      if (countdownValue <= 0) {
        clearInterval(countdownTimer!);
        countdownTimer = undefined;
        closeModal();
      } else {
        renderModal();
      }
    }, 1000);
  }

  function validateName(): boolean { return formData.name.trim().length >= 2; }
  function digitsOnly(s: string): string { return s.replace(/\D+/g, ''); }
  function validatePhone(): boolean { return digitsOnly(formData.phone).length >= 10; }
  function validateEmail(): boolean {
    const email = formData.email.trim();
    if (email === '') return false;
    // Проверяем наличие @ и .
    if (!email.includes('@') || !email.includes('.')) return false;
    // Базовая проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function onPhoneInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const oldCursorPos = input.selectionStart || 0;
    const oldValue = input.value;
    
    let d = digitsOnly(oldValue);
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    formData.phone = out;
    
    // Обновляем значение без полного рендера
    input.value = out;
    
    // Вычисляем новую позицию курсора
    const diff = out.length - oldValue.length;
    const newCursorPos = Math.min(oldCursorPos + diff, out.length);
    
    requestAnimationFrame(() => {
      input.focus();
      try {
        input.setSelectionRange(newCursorPos, newCursorPos);
      } catch {}
    });
    
    formTouched.value = true;
    // Обновляем только класс ошибки, не перерисовывая всё поле
    const phoneErr = !validatePhone();
    input.classList.toggle('err', phoneErr);
  }

  async function submitForm(): Promise<void> {
    formTouched.value = true;
    
    // Проверяем валидность всех полей
    const isNameValid = validateName();
    const isPhoneValid = validatePhone();
    const isEmailValid = validateEmail();
    
    if (!isNameValid || !isPhoneValid || !isEmailValid) {
      renderModal();
      return;
    }

    formState = 'sending';
    renderModal();

    const payload = {
      name: formData.name.trim(),
      phone: digitsOnly(formData.phone),
      email: formData.email.trim() || null,
      offer: selectedOffer ? {
        bank: selectedOffer.bank_name,
        program: selectedOffer.program_name,
        rate: selectedOffer.calculated_rate,
      } : null,
      calculation: {
        cost: Math.round(currentCost()),
        down: num('down'),
        termMonths: num('term') * 12,
        rate: num('rate'),
        monthlyPayment: selectedOffer ? Math.round(selectedOffer.monthly_payment) : 0,
      },
    };

    try {
      const res = await fetch(`${cfg.apiBase}/api/v1/application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('bad status ' + res.status);
      formState = 'success';
      startCountdown();
    } catch (err) {
      console.error('Ошибка отправки заявки:', err);
      formState = 'error';
    }
    renderModal();
  }

  function renderModal(): void {
    let modalEl = shadow.getElementById('modal-backdrop');
    if (!modalEl) return;

    modalEl.classList.toggle('open', modalOpen);

    const modalBody = shadow.getElementById('modal-body-content');
    if (!modalBody) return;

    if (formState !== 'success') {
      const offerBadge = selectedOffer
        ? `<div class="form-offer-badge"><b>${selectedOffer.bank_name}</b> · ${selectedOffer.program_name} · от ${selectedOffer.calculated_rate}%</div>`
        : '';

      const snapHtml = selectedOffer
        ? `<div class="form-snap">
            <div><span>Платёж</span><b>${fmt(selectedOffer.monthly_payment)} ₽/мес</b></div>
            <div><span>Сумма кредита</span><b>${fmt(currentCost() - num('down'))} ₽</b></div>
            <div><span>Ставка</span><b>${selectedOffer.calculated_rate}%</b></div>
          </div>`
        : '';

      const errorMsg = formState === 'error'
        ? `<div class="form-msg form-err-msg">Не удалось отправить заявку. Попробуйте ещё раз.</div>`
        : '';

      const nameErr = formTouched.value && !validateName() ? ' err' : '';
      const phoneErr = formTouched.value && !validatePhone() ? ' err' : '';
      const emailErr = formTouched.value && !validateEmail() ? ' err' : '';

      // Сохраняем текущий элемент в фокусе и позицию курсора перед рендером
      const activeEl = shadow.activeElement as HTMLInputElement | null;
      const wasFocused = activeEl !== null;
      const cursorPos = wasFocused && activeEl.selectionStart !== null ? activeEl.selectionStart : 0;
      const focusedFieldId = wasFocused ? activeEl.id : null;

      modalBody.innerHTML = `
        ${offerBadge}
        ${snapHtml}
        <p class="form-lead">Оставьте контакты — подберём лучшие предложения банков под ваш расчёт.</p>
        <label class="form-field">
          <span>Имя <i>*</i></span>
          <input type="text" id="form-name" value="${formData.name.replace(/"/g, '&quot;')}" class="${nameErr}" placeholder="Как к вам обращаться">
        </label>
        <label class="form-field">
          <span>Телефон <i>*</i></span>
          <input type="tel" id="form-phone" value="${formData.phone.replace(/"/g, '&quot;')}" class="${phoneErr}" placeholder="+7 (___) ___-__-__">
        </label>
        <label class="form-field">
          <span>Email</span>
          <input type="email" id="form-email" value="${formData.email.replace(/"/g, '&quot;')}" class="${emailErr}" placeholder="you@example.com">
        </label>
        ${errorMsg}
        <button type="button" class="form-submit" id="form-submit-btn" ${formState === 'sending' ? 'disabled' : ''}>
          ${formState === 'sending' ? 'Отправляем…' : 'Получить предложения'}
        </button>
        <p class="form-note">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
      `;

      // Восстанавливаем фокус и позицию курсора
      if (focusedFieldId) {
        const inputToFocus = shadow.getElementById(focusedFieldId) as HTMLInputElement | null;
        if (inputToFocus) {
          inputToFocus.focus();
          try {
            inputToFocus.setSelectionRange(cursorPos, cursorPos);
          } catch {}
        }
      }

      const nameInput = shadow.getElementById('form-name') as HTMLInputElement | null;
      const phoneInput = shadow.getElementById('form-phone') as HTMLInputElement | null;
      const emailInput = shadow.getElementById('form-email') as HTMLInputElement | null;
      const submitBtn = shadow.getElementById('form-submit-btn') as HTMLButtonElement | null;

      if (nameInput) {
        nameInput.addEventListener('input', (e) => {
          formData.name = (e.target as HTMLInputElement).value;
          formTouched.value = true;
          renderModal();
        });
      }
      if (phoneInput) {
        phoneInput.addEventListener('input', onPhoneInput);
      }
      if (emailInput) {
        emailInput.addEventListener('input', (e) => {
          const input = e.target as HTMLInputElement;
          const oldCursorPos = input.selectionStart || 0;
          const oldValue = input.value;
          
          formData.email = oldValue;
          
          // Обновляем только класс ошибки, не перерисовывая всё поле
          const emailErr = !validateEmail();
          input.classList.toggle('err', emailErr);
          
          // Восстанавливаем фокус и позицию курсора
          requestAnimationFrame(() => {
            input.focus();
            try {
              input.setSelectionRange(oldCursorPos, oldCursorPos);
            } catch {}
          });
        });
      }
      if (submitBtn) {
        submitBtn.addEventListener('click', submitForm);
      }
    } else {
      modalBody.innerHTML = `
        <div class="form-thanks">
          <div class="ok">✓</div>
          <h3>Заявка отправлена!</h3>
          <p>Менеджер свяжется с вами в ближайшее время и подберёт лучшие условия.</p>
          <p class="cd">Окно закроется через <b id="form-cd">${countdownValue}</b> с</p>
          <button type="button" class="form-submit ghost" id="form-close-btn">Закрыть</button>
        </div>
      `;
      const closeBtn = shadow.getElementById('form-close-btn') as HTMLButtonElement | null;
      if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
      }
    }
  }

  function onApply(offer: Offer): void {
    openModal(offer);
  }

  // Обработчик закрытия модального окна по крестику
  const modalCloseBtn = shadow.getElementById('modal-close-btn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }

  // Обработчик закрытия модального окна по клику на фон
  function onModalBackdropClick(e: Event): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop') && modalOpen) {
      closeModal();
    }
  }

  // Обработчик закрытия модального окна по Esc
  function onEscKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && modalOpen) {
      closeModal();
    }
  }

  shadow.addEventListener('click', onModalBackdropClick);
  document.addEventListener('keydown', onEscKey);

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
