import {
  Component, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ApplicationFlowService, Coborrower } from '../../services/application-flow.service';
import { ValidationService } from '../../services/validation.service';
import { SuggestInputComponent } from './suggest-input.component';
import {
  PROPERTY_TYPES, TERM_UNITS, EMPLOYMENT_TYPES, STAFF_COUNT, ORG_TYPES, INDUSTRIES,
  WORK_EXPERIENCE, MARITAL, CHILDREN, EDUCATION, SPOUSE_HINT, PRENUP_OPTIONS,
  SALARY_BANKS, suggestCities, suggestAddresses,
} from '../../core/anketa-data';
import { exportAnketaPdf, exportAnketaDocx } from '../../core/anketa-export';
import { copyText } from '../../core/share-link';

/**
 * Мастер «Подать заявку» из 5 шагов (по макетам):
 * 1 — параметры кредита; затем авторизация (телефон → код из СМС);
 * 2 — контакты; 3 — паспорт и адреса; 4 — работа и стаж; 5 — семья
 * (созаёмщики/брачный договор/маткапитал); финал — благодарность,
 * скачивание анкеты в PDF/Word и ссылка для заёмщика.
 */
@Component({
  selector: 'app-application-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, SuggestInputComponent],
  template: `
    <a class="back" href="#" (click)="$event.preventDefault(); flow.back()">← Назад</a>

    @if (flow.stage() === 'auth' || flow.stage() === 'code') {
      <!-- ======= АВТОРИЗАЦИЯ ======= -->
      <div class="authwrap">
        <div class="authcard">
          @if (flow.stage() === 'auth') {
            <h2>Войти или зарегистрироваться</h2>
            <div class="atabs">
              @for (t of authTabs; track t) {
                <button type="button" [class.on]="authTab() === t" (click)="authTab.set(t)">{{ t }}</button>
              }
            </div>
            <p class="ahint">Укажите номер телефона, на который поступит бесплатный звонок с кодом</p>
            <div class="phonefld" [class.errb]="authTouched() && !phoneValid()">
              <span class="flag">🇷🇺</span>
              <input type="tel" inputmode="tel" maxlength="16" [value]="flow.data().phone"
                     placeholder="+7 900 000-00-00" (input)="onPhone($event)">
            </div>
            <button type="button" class="cont" (click)="requestCode()">Получить код</button>
            <p class="legal">Нажимая кнопку «Получить код», вы подтверждаете согласие на
              <a href="#">обработку персональных данных</a> и получение <a href="#">рекламных рассылок</a>.</p>
            <button type="button" class="sharelink" (click)="copyBorrowerLink()">
              {{ linkCopied() ? 'Ссылка скопирована ✓' : 'Скопировать ссылку на анкету для заёмщика' }}
            </button>
          } @else {
            <h2>Личный кабинет</h2>
            <b class="codehead">Введите код из СМС</b>
            <p class="ahint left">Мы отправили СМС с кодом на номер<br>
              {{ flow.data().phone }} <a href="#" (click)="$event.preventDefault(); flow.back()">изменить</a></p>
            <div class="pins">
              @for (i of [0,1,2,3]; track i) {
                <input type="text" inputmode="numeric" maxlength="1" class="pin"
                       [id]="'pin' + i" [value]="pins()[i]"
                       (input)="onPin($event, i)" (keydown)="onPinKey($event, i)">
              }
            </div>
            @if (resendIn() > 0) {
              <div class="resend">Отправить код повторно можно через <b>{{ resendIn() }}</b> сек</div>
            } @else {
              <button type="button" class="cont" (click)="requestCode()">Отправить код повторно</button>
            }
          }
        </div>
      </div>
    } @else if (flow.stage() === 'done') {
      <!-- ======= БЛАГОДАРНОСТЬ ======= -->
      <div class="authwrap">
        <div class="authcard done">
          <div class="ok">✓</div>
          <h2>Заявка отправлена!</h2>
          <p class="ahint">Анкета заёмщика сформирована и передана менеджеру.
            Скачайте копию или поделитесь ссылкой на анкету.</p>
          @if (submitError()) {
            <p class="warn">Не удалось передать заявку на сервер — скачайте анкету и отправьте менеджеру вручную.</p>
          }
          <div class="dlrow">
            <button type="button" class="dl" [disabled]="exporting()" (click)="downloadPdf()">
              {{ exporting() === 'pdf' ? 'Готовим…' : 'Скачать PDF' }}
            </button>
            <button type="button" class="dl" [disabled]="exporting()" (click)="downloadWord()">
              {{ exporting() === 'docx' ? 'Готовим…' : 'Скачать Word' }}
            </button>
            <button type="button" class="dl ghost" (click)="copyBorrowerLink()">
              {{ linkCopied() ? 'Скопировано ✓' : 'Поделиться ссылкой' }}
            </button>
          </div>
          <button type="button" class="cont" (click)="flow.close()">Вернуться к предложениям</button>
        </div>
      </div>
    } @else {
      <!-- ======= ШАГИ 1–5 ======= -->
      <div class="wiz">
        <div class="wleft">
          <div class="guard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="#3E9B4F"/>
              <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Гарантируем сохранность и безопасность ваших данных
          </div>

          @switch (flow.stage()) {
            @case ('s1') {
              <div class="frow">
                <label class="fld" [class.err]="touched() && !d().propertyType">
                  <span>Тип недвижимости</span>
                  <select [value]="d().propertyType" (change)="set('propertyType', val($event))">
                    <option value="" disabled>Выбрать</option>
                    @for (p of propertyTypes; track p) { <option [value]="p">{{ p }}</option> }
                  </select>
                </label>
                <label class="fld" [class.err]="touched() && d().cost <= 0">
                  <span>Стоимость недвижимости</span>
                  <input type="text" inputmode="numeric" [value]="money(d().cost)"
                         (input)="setMoney('cost', $event)">
                </label>
              </div>
              <div class="frow">
                <label class="fld">
                  <span>Первоначальный взнос</span>
                  <input type="text" inputmode="numeric" [value]="money(d().down)"
                         (input)="setMoney('down', $event)">
                </label>
                <label class="fld" [class.err]="touched() && d().termValue <= 0">
                  <span>{{ termFieldLabel() }}</span>
                  <div class="tin">
                    <input type="number" min="1" [value]="d().termValue"
                           (input)="set('termValue', numVal($event))">
                    <select class="unit" [value]="d().termUnit" (change)="set('termUnit', val($event))">
                      @for (u of termUnits; track u.key) { <option [value]="u.key">{{ u.suffix }}</option> }
                    </select>
                  </div>
                </label>
              </div>
            }
            @case ('s2') {
              <app-suggest-input label="Город получения кредита" placeholder="Начните вводить город"
                [value]="d().city" [invalid]="touched() && !d().city"
                [provider]="cityProvider" (valueChange)="set('city', $event)" />
              <div class="frow">
                <label class="fld" [class.err]="touched() && !d().lastName">
                  <span>Фамилия</span>
                  <input type="text" [value]="d().lastName" placeholder="Введите" (input)="set('lastName', val($event))">
                </label>
                <label class="fld" [class.err]="touched() && !d().firstName">
                  <span>Имя</span>
                  <input type="text" [value]="d().firstName" placeholder="Введите" (input)="set('firstName', val($event))">
                </label>
              </div>
              <div class="frow">
                <label class="fld">
                  <span>Отчество</span>
                  <input type="text" [value]="d().middleName" placeholder="Введите" (input)="set('middleName', val($event))">
                </label>
                <label class="fld" [class.err]="touched() && d().email !== '' && !emailValid()">
                  <span>Электронная почта</span>
                  <input type="email" [value]="d().email" placeholder="Введите" (input)="set('email', val($event))">
                </label>
              </div>
              <div class="frow">
                <label class="fld" [class.err]="touched() && d().income <= 0">
                  <span>Ежемесячный доход</span>
                  <input type="text" inputmode="numeric" [value]="money(d().income)"
                         placeholder="Введите" (input)="setMoney('income', $event)">
                </label>
                <div></div>
              </div>
            }
            @case ('s3') {
              <b class="sect">Паспортные данные</b>
              <div class="gender">
                <button type="button" [class.on]="d().gender === 'm'" (click)="set('gender', 'm')">Мужчина</button>
                <button type="button" [class.on]="d().gender === 'f'" (click)="set('gender', 'f')">Женщина</button>
              </div>
              <div class="frow">
                <label class="fld" [class.err]="touched() && !d().passport">
                  <span>Серия и номер паспорта</span>
                  <input type="text" inputmode="numeric" maxlength="11" [value]="d().passport" placeholder="0000 000000"
                         (input)="onPassport($event)" (keydown)="allowDigitsOnly($event)">
                </label>
                <label class="fld">
                  <span>Код подразделения</span>
                  <input type="text" inputmode="numeric" maxlength="7" [value]="d().passportCode" placeholder="000-000"
                         (input)="onPassportCode($event)" (keydown)="allowDigitsOnly($event)">
                </label>
              </div>
              <div class="frow">
                <label class="fld">
                  <span>Дата выдачи</span>
                  <input type="text" [value]="d().passportDate" placeholder="дд.мм.гггг"
                         (input)="onDate($event); set('passportDate', val($event))">
                </label>
                <label class="fld">
                  <span>Место рождения</span>
                  <input type="text" [value]="d().birthPlace" placeholder="Введите"
                         (input)="set('birthPlace', val($event))">
                </label>
              </div>
              <label class="fld">
                <span>Кем выдан</span>
                <input type="text" [value]="d().passportIssuer" placeholder="Введите"
                       (input)="set('passportIssuer', val($event))">
              </label>
              <div class="frow">
                <label class="fld" [class.err]="touched() && !d().birthDate">
                  <span>Дата рождения</span>
                  <input type="text" [value]="d().birthDate" placeholder="дд.мм.гггг"
                         (input)="onDate($event); set('birthDate', val($event))">
                </label>
                <div></div>
              </div>

              <label class="tgl">
                <input type="checkbox" [checked]="d().nameUnchanged" (change)="set('nameUnchanged', chk($event))">
                <i></i> ФИО не менялось
              </label>
              @if (!d().nameUnchanged) {
                <div class="frow">
                  <label class="fld"><span>Предыдущая фамилия</span>
                    <input type="text" [value]="d().prevLastName" placeholder="Введите" (input)="set('prevLastName', val($event))"></label>
                  <label class="fld"><span>Предыдущее имя</span>
                    <input type="text" [value]="d().prevFirstName" placeholder="Введите" (input)="set('prevFirstName', val($event))"></label>
                </div>
                <div class="frow">
                  <label class="fld"><span>Предыдущее отчество</span>
                    <input type="text" [value]="d().prevMiddleName" placeholder="Введите" (input)="set('prevMiddleName', val($event))"></label>
                  <div></div>
                </div>
              }

              <b class="sect">Адреса</b>
              <app-suggest-input label="Адрес регистрации" placeholder="Начните вводить адрес"
                [value]="d().regAddress" [invalid]="touched() && !d().regAddress"
                [provider]="addressProvider" (valueChange)="set('regAddress', $event)" />
              <div class="frow">
                <label class="fld">
                  <span>Дата регистрации</span>
                  <input type="text" [value]="d().regDate" placeholder="дд.мм.гггг"
                         (input)="onDate($event); set('regDate', val($event))">
                </label>
                <div></div>
              </div>
              <label class="tgl">
                <input type="checkbox" [checked]="d().liveSameAsReg" (change)="set('liveSameAsReg', chk($event))">
                <i></i> Адрес проживания совпадает с регистрацией
              </label>
              @if (!d().liveSameAsReg) {
                <app-suggest-input label="Адрес проживания" placeholder="Начните вводить адрес"
                  [value]="d().liveAddress" [provider]="addressProvider" (valueChange)="set('liveAddress', $event)" />
                <div class="frow">
                  <label class="fld">
                    <span>Дата проживания</span>
                    <input type="text" [value]="d().liveDate" placeholder="дд.мм.гггг"
                           (input)="onDate($event); set('liveDate', val($event))">
                  </label>
                  <div></div>
                </div>
              }
            }
            @case ('s4') {
              <b class="sect">Текущее место работы</b>
              <div class="frow">
                <label class="fld" [class.err]="touched() && !d().employment">
                  <span>Тип занятости</span>
                  <select [value]="d().employment" (change)="set('employment', val($event))">
                    <option value="" disabled>Выберите</option>
                    @for (e of employmentTypes; track e) { <option [value]="e">{{ e }}</option> }
                  </select>
                </label>
                <label class="fld">
                  <span>Начало работы на последнем месте</span>
                  <input type="text" [value]="d().workStart" placeholder="День можно указать приблизительно"
                         (input)="set('workStart', val($event))">
                </label>
              </div>

              @if (isWorking()) {
                <div class="frow">
                  <label class="fld"><span>Должность</span>
                    <input type="text" [value]="d().position" placeholder="Введите" (input)="set('position', val($event))"></label>
                  <label class="fld" [class.err]="touched() && !d().orgName">
                    <span>Название организации</span>
                    <input type="text" [value]="d().orgName" placeholder="Введите" (input)="set('orgName', val($event))"></label>
                </div>
                <div class="frow">
                  <label class="fld"><span>Рабочий телефон</span>
                    <input type="tel" inputmode="tel" maxlength="18" [value]="d().workPhone" placeholder="+7 (9" (input)="set('workPhone', val($event))"></label>
                  <label class="fld"><span>Численность работников</span>
                    <select [value]="d().staffCount" (change)="set('staffCount', val($event))">
                      <option value="" disabled>Выберите</option>
                      @for (s of staffCount; track s) { <option [value]="s">{{ s }}</option> }
                    </select></label>
                </div>
                <div class="frow">
                  <label class="fld"><span>Тип организации</span>
                    <select [value]="d().orgType" (change)="set('orgType', val($event))">
                      <option value="" disabled>Выберите</option>
                      @for (o of orgTypes; track o) { <option [value]="o">{{ o }}</option> }
                    </select></label>
                  <label class="fld"><span>Сфера деятельности</span>
                    <select [value]="d().industry" (change)="set('industry', val($event))">
                      <option value="" disabled>Выберите</option>
                      @for (i of industries; track i) { <option [value]="i">{{ i }}</option> }
                    </select></label>
                </div>
                <label class="fld"><span>Адрес организации</span>
                  <app-suggest-input label="" placeholder="Начните вводить адрес"
                    [value]="d().orgAddress" [provider]="addressProvider" (valueChange)="set('orgAddress', $event)" /></label>
                <div class="frow">
                  <label class="fld" [class.err]="touched() && d().inn !== '' && !validateInn(d().inn)"><span>ИНН</span>
                    <input type="text" inputmode="numeric" maxlength="12" [value]="d().inn" placeholder="0000000000 или 000000000000"
                           (input)="onInn($event)" (keydown)="allowDigitsOnly($event)"></label>

                  <!-- Зарплатный банк: список с логотипами и поиском -->
                  <div class="fld bankfld" [class.open]="bankOpen()">
                    <span>Зарплатный банк</span>
                    @if (d().salaryBank) {
                      <div class="pickrow">
                        <b>{{ d().salaryBank }}</b>
                        <button type="button" class="clear" aria-label="Очистить" (click)="set('salaryBank', '')">✕</button>
                      </div>
                    } @else {
                      <input type="text" [value]="bankQuery()" placeholder="Введите"
                             (focus)="bankOpen.set(true)" (input)="bankQuery.set(val($event))">
                    }
                    @if (bankOpen() && !d().salaryBank) {
                      <div class="banklist">
                        @for (b of banksFiltered(); track b.name) {
                          <button type="button" (mousedown)="pickBank(b.name)">
                            <i [style.background]="b.color">{{ b.name.charAt(0) }}</i> {{ b.name }}
                          </button>
                        }
                        @if (banksFiltered().length === 0) { <div class="bempty">Банк не найден</div> }
                      </div>
                    }
                  </div>
                </div>
              }

              <b class="sect">Доход и стаж</b>
              <div class="frow">
                <label class="fld" [class.err]="touched() && !d().experience">
                  <span>Общий трудовой стаж</span>
                  <select [value]="d().experience" (change)="set('experience', val($event))">
                    <option value="" disabled>Выберите</option>
                    @for (w of workExperience; track w) { <option [value]="w">{{ w }}</option> }
                  </select>
                </label>
                <div></div>
              </div>
            }
            @case ('s5') {
              <b class="sect">Личные данные</b>
              <label class="fld" [class.err]="touched() && !d().marital">
                <span>Семейное положение</span>
                <select [value]="d().marital" (change)="onMarital($event)">
                  <option value="" disabled>Выберите</option>
                  @for (m of marital; track m) { <option [value]="m">{{ m }}</option> }
                </select>
              </label>

              @if (d().marital === 'Женат/замужем') {
                <div class="hintbox">{{ spouseHint }}</div>
                <div class="radios">
                  @for (p of prenupOptions; track p.key) {
                    <label class="radio">
                      <input type="radio" name="prenup" [checked]="d().prenup === p.key"
                             (change)="set('prenup', p.key)">
                      <i></i> {{ p.label }}
                    </label>
                  }
                </div>
                @if (d().prenup === 'has') {
                  <div class="cob">
                    <div class="cobhead">
                      <b>Созаёмщики</b>
                      <button type="button" class="addcob" (click)="addCoborrower()">+ Добавить созаёмщика</button>
                    </div>
                    @for (c of d().coborrowers; track $index; let ci = $index) {
                      <div class="cobcard">
                        <div class="frow">
                          <label class="fld"><span>Фамилия</span>
                            <input type="text" [value]="c.lastName" placeholder="Введите" (input)="setCob(ci, 'lastName', $event)"></label>
                          <label class="fld"><span>Имя</span>
                            <input type="text" [value]="c.firstName" placeholder="Введите" (input)="setCob(ci, 'firstName', $event)"></label>
                        </div>
                        <div class="frow">
                          <label class="fld"><span>Отчество</span>
                            <input type="text" [value]="c.middleName" placeholder="Введите" (input)="setCob(ci, 'middleName', $event)"></label>
                          <label class="fld"><span>Телефон</span>
                            <input type="tel" maxlength="16" [value]="c.phone" placeholder="+7" (input)="setCob(ci, 'phone', $event)"></label>
                        </div>
                        <button type="button" class="rmcob" (click)="removeCoborrower(ci)">Удалить</button>
                      </div>
                    }
                  </div>
                }
              }

              <div class="frow">
                <label class="fld">
                  <span>Дети до 18 лет</span>
                  <select [value]="d().children" (change)="onChildren($event)">
                    <option value="" disabled>Выберите</option>
                    @for (c of children; track c) { <option [value]="c">{{ c }}</option> }
                  </select>
                </label>
                <label class="fld" [class.err]="touched() && !d().education">
                  <span>Образование</span>
                  <select [value]="d().education" (change)="set('education', val($event))">
                    <option value="" disabled>Выберите</option>
                    @for (e of education; track e) { <option [value]="e">{{ e }}</option> }
                  </select>
                </label>
              </div>

              @if (showMatCapital()) {
                <div class="radios inline">
                  <span class="rlabel">Буду использовать мат. капитал:</span>
                  <label class="radio"><input type="radio" name="matcap" [checked]="d().useMatCapital === 'yes'"
                        (change)="set('useMatCapital', 'yes')"><i></i> Да</label>
                  <label class="radio"><input type="radio" name="matcap" [checked]="d().useMatCapital === 'no'"
                        (change)="set('useMatCapital', 'no')"><i></i> Нет</label>
                </div>
              }

              <div class="frow">
                <label class="fld">
                  <span>Траты по кредитам в месяц</span>
                  <input type="text" inputmode="numeric" [value]="money(d().creditPayments) || '0 ₽'"
                         (input)="setMoney('creditPayments', $event)">
                </label>
                <label class="fld" [class.err]="touched() && d().snils !== '' && !validateSnils(d().snils)">
                  <span>СНИЛС</span>
                  <input type="text" inputmode="numeric" maxlength="14" [value]="d().snils" placeholder="000-000-000 00"
                         (input)="onSnils($event)" (keydown)="allowDigitsOnly($event)">
                </label>
              </div>
            }
          }

          <button type="button" class="cont" [disabled]="submitting()" (click)="continueStep()">
            {{ flow.stage() === 's5' ? (submitting() ? 'Отправляем…' : 'Отправить заявку') : 'Продолжить' }}
          </button>
        </div>

        <!-- САЙДБАР -->
        <aside class="wside">
          <div class="steplbl">Шаг {{ flow.stepNumber() }} из 5</div>
          <div class="prog"><i [style.width.%]="flow.stepNumber() / 5 * 100"></i></div>
          <div class="sgrid">
            <div>
              <b>{{ flow.loan() | number:'1.0-0' }} ₽</b>
              <span>Сумма кредита</span>
            </div>
            <div>
              <b>{{ flow.payment() | number:'1.0-0' }} ₽</b>
              <span>Ежемесячный платёж</span>
            </div>
          </div>
          @if (flow.offer(); as o) {
            <div class="sbank">
              <div class="slogo">
                @if (o.bank_logo_url) {
                    <img [src]="o.bank_logo_url" [alt]="o.bank_name" class="slogo" />
                } @else {
                    {{ o.bank_name.charAt(0) }}
                }
              </div>
              <div>
                <b>{{ o.bank_name }}</b>
                <span>{{ d().propertyType || 'Ипотека' }} · {{ o.program_name }} · от {{ flow.rate() }}%</span>
              </div>
            </div>
          }
        </aside>
      </div>
    }
  `,
  styles: [`
    :host{display:block}
    .back{display:inline-block;color:var(--link);font-size:14px;margin:2px 0 14px}

    .wiz{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr);gap:0;background:var(--soft);border-radius:16px;overflow:hidden}
    .wleft{padding:clamp(16px,2.5vw,26px);border-right:1px solid #EBEBEB}
    .wside{padding:clamp(16px,2.5vw,26px)}

    .guard{display:flex;align-items:center;gap:9px;background:#F2FBEA;border-radius:12px;padding:11px 14px;font-size:13px;margin-bottom:18px}

    .sect{display:block;font-size:17px;font-weight:700;margin:6px 0 12px}
    .frow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
    .frow>.fld{margin-bottom:0}
    .fld{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:9px 14px 11px;min-width:0;margin-bottom:12px;position:relative}
    .fld:focus-within{border-color:#000}
    .fld.err{border-color:#E2574C}
    .fld>span{display:block;font-size:12px;color:var(--muted);margin-bottom:2px}
    .fld input,.fld select{width:100%;border:0;padding:0;font-size:15px;font-weight:600;background:transparent;font-family:inherit;-webkit-appearance:none;appearance:none}
    .fld input:focus,.fld select:focus{outline:0}
    .fld select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23000' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 2px center;padding-right:20px}
    .tin{display:flex;align-items:center;gap:6px}
    .tin input{flex:1}
    .tin .unit{width:64px;border-left:1px solid var(--line);padding-left:10px;font-size:14px;font-weight:500}

    .gender{display:inline-flex;gap:8px;margin-bottom:14px}
    .gender button{border:1px solid #000;background:#fff;border-radius:22px;padding:10px 22px;font-size:14px;font-weight:500}
    .gender button.on{background:var(--accent);border-color:var(--accent);font-weight:600}

    .tgl{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:500;margin:4px 0 14px;cursor:pointer}
    .tgl input{position:absolute;opacity:0;width:0}
    .tgl i{width:38px;height:22px;border-radius:11px;background:#CFD6DD;position:relative;transition:background .15s;flex:0 0 auto}
    .tgl i::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}
    .tgl input:checked + i{background:var(--dark)}
    .tgl input:checked + i::after{left:18px}

    .hintbox{background:#FFF7E8;border:1px solid #F3DFB6;border-radius:12px;padding:13px 15px;font-size:13px;line-height:1.55;white-space:pre-line;margin-bottom:12px}
    .radios{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
    .radios.inline{flex-direction:row;align-items:center;flex-wrap:wrap;gap:14px}
    .rlabel{font-size:14px;font-weight:500}
    .radio{display:flex;align-items:center;gap:9px;font-size:14px;cursor:pointer}
    .radio input{position:absolute;opacity:0;width:0}
    .radio i{width:18px;height:18px;border:2px solid var(--muted);border-radius:50%;position:relative;flex:0 0 auto}
    .radio input:checked + i{border-color:var(--accent)}
    .radio input:checked + i::after{content:'';position:absolute;inset:3px;border-radius:50%;background:var(--accent)}

    .cob{margin-bottom:14px}
    .cobhead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
    .cobhead b{font-size:15px}
    .addcob{border:1px dashed #000;background:#fff;border-radius:18px;padding:8px 14px;font-size:13px;font-weight:500}
    .cobcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px}
    .cobcard .fld{background:var(--soft)}
    .rmcob{border:0;background:transparent;color:#E2574C;font-size:13px;padding:2px 0}

    .bankfld .pickrow{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .bankfld .pickrow b{font-size:15px;font-weight:600}
    .bankfld .clear{border:0;background:var(--soft);border-radius:50%;width:24px;height:24px;color:var(--muted)}
    .banklist{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:60;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.12);max-height:260px;overflow-y:auto}
    .banklist button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:#fff;padding:10px 13px;font-size:14px}
    .banklist button:hover{background:var(--soft)}
    .banklist i{width:26px;height:26px;border-radius:7px;color:#fff;font-style:normal;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
    .bempty{padding:14px;font-size:13px;color:var(--muted);text-align:center}

    .cont{display:block;width:100%;max-width:360px;margin-top:16px;border:0;border-radius:26px;padding:15px;font-size:15px;font-weight:600;background:var(--accent)}
    .cont:disabled{opacity:.6}

    /* Сайдбар */
    .steplbl{font-size:14px;font-weight:600;margin-bottom:8px}
    .prog{height:4px;border-radius:2px;background:var(--dark);overflow:hidden;margin-bottom:20px}
    .prog i{display:block;height:100%;background:var(--accent);transition:width .25s}
    .sgrid{display:flex;flex-direction:column;gap:16px;margin-bottom:20px}
    .sgrid b{display:block;font-size:20px;font-weight:700}
    .sgrid span{font-size:13px;color:var(--muted)}
    .sbank{display:flex;gap:11px;align-items:flex-start}
    .slogo{width:38px;height:38px;border-radius:10px;background:#1B75BB;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
    .sbank b{display:block;font-size:15px;font-weight:700}
    .sbank span{font-size:12px;color:var(--muted);line-height:1.4}

    /* Авторизация / финал */
    .authwrap{display:flex;justify-content:center;padding:24px 0 40px}
    .authcard{background:#fff;border-radius:18px;box-shadow:0 18px 48px rgba(19,25,33,.12);padding:clamp(22px,4vw,34px);width:100%;max-width:520px;text-align:center}
    .authcard h2{font-size:clamp(19px,3.4vw,24px);font-weight:700;margin-bottom:16px}
    .atabs{display:flex;justify-content:center;gap:26px;margin-bottom:16px}
    .atabs button{border:0;background:transparent;font-size:15px;color:var(--muted);padding:7px 2px;border-bottom:2px solid transparent}
    .atabs button.on{color:#000;font-weight:600;border-bottom-color:var(--accent)}
    .ahint{font-size:14px;color:#333;margin-bottom:16px;line-height:1.5}
    .ahint.left{text-align:left}
    .ahint a{color:var(--link)}
    .codehead{display:block;text-align:left;font-size:17px;font-weight:700;margin-bottom:6px}
    .phonefld{display:flex;align-items:center;gap:10px;background:#F2F5F9;border-radius:12px;padding:0 14px;height:52px;border:1px solid transparent}
    .phonefld.errb{border-color:#E2574C}
    .phonefld .flag{font-size:18px}
    .phonefld input{flex:1;border:0;background:transparent;font-size:16px;font-weight:500}
    .phonefld input:focus{outline:0}
    .legal{font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5;text-align:left}
    .legal a{color:inherit;text-decoration:underline}
    .sharelink{border:0;background:transparent;color:var(--link);font-size:13px;margin-top:14px;padding:6px}
    .pins{display:flex;gap:12px;justify-content:center;margin:18px 0 22px}
    .pin{width:64px;height:56px;text-align:center;font-size:22px;font-weight:600;background:#F2F5F9;border:1px solid #3E9B4F;border-radius:10px}
    .pin:focus{outline:0;border-color:#000}
    .resend{background:#FBE8CC;border-radius:26px;padding:15px;font-size:14px}
    .done .ok{width:64px;height:64px;border-radius:50%;background:#E8F5E9;color:#2E7D32;font-size:34px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
    .warn{background:#FEF4F3;color:#C0392B;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:12px}
    .dlrow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:8px}
    .dl{border:1px solid #000;background:#fff;border-radius:22px;padding:11px 18px;font-size:14px;font-weight:500}
    .dl:hover{background:var(--accent);border-color:var(--accent)}
    .dl:disabled{opacity:.6}
    .dl.ghost{border-color:var(--line)}

    /* Адаптив */
    @media (max-width:900px){
      .wiz{grid-template-columns:1fr}
      .wleft{border-right:0;border-bottom:1px solid #EBEBEB}
      .wside{order:-1;border-bottom:1px solid #EBEBEB}
      .sgrid{flex-direction:row;gap:24px}
    }
    @media (max-width:620px){
      .frow{grid-template-columns:1fr;gap:0}
      .frow>.fld{margin-bottom:12px}
      .cont{max-width:none}
      .sgrid{flex-direction:column;gap:12px}
      .pins{gap:8px}
      .pin{width:56px;height:52px}
      .dlrow{flex-direction:column}
      .dl{width:100%}
    }
  `],
})
export class ApplicationWizardComponent {
  readonly flow = inject(ApplicationFlowService);
  readonly validation = inject(ValidationService);

  // Справочники
  readonly propertyTypes = PROPERTY_TYPES;
  readonly termUnits = TERM_UNITS;
  readonly employmentTypes = EMPLOYMENT_TYPES;
  readonly staffCount = STAFF_COUNT;
  readonly orgTypes = ORG_TYPES;
  readonly industries = INDUSTRIES;
  readonly workExperience = WORK_EXPERIENCE;
  readonly marital = MARITAL;
  readonly children = CHILDREN;
  readonly education = EDUCATION;
  readonly spouseHint = SPOUSE_HINT;
  readonly prenupOptions = PRENUP_OPTIONS;
  readonly authTabs = ['Агент', 'Клиент', 'Партнёр'] as const;

  readonly cityProvider = suggestCities;
  readonly addressProvider = suggestAddresses;

  // UI-состояние
  readonly touched = signal(false);
  readonly authTab = signal<string>('Клиент');
  readonly authTouched = signal(false);
  readonly pins = signal<string[]>(['', '', '', '']);
  readonly resendIn = signal(0);
  readonly bankOpen = signal(false);
  readonly bankQuery = signal('');
  readonly linkCopied = signal(false);
  readonly exporting = signal<'' | 'pdf' | 'docx'>('');
  readonly submitting = signal(false);
  readonly submitError = signal(false);

  private resendTimer?: number;

  readonly d = this.flow.data;

  readonly termFieldLabel = computed(() =>
    TERM_UNITS.find((u) => u.key === this.d().termUnit)?.field ?? 'Срок в годах');

  readonly emailValid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.d().email));
  readonly phoneValid = computed(() => this.d().phone.replace(/\D+/g, '').length >= 11);

  readonly isWorking = computed(() => {
    const e = this.d().employment;
    return e !== '' && e !== 'Я не работаю' && e !== 'Я пенсионер';
  });

  readonly showMatCapital = computed(() => {
    const c = this.d().children;
    return c !== '' && c !== 'Нет';
  });

  readonly banksFiltered = computed(() => {
    const q = this.bankQuery().trim().toLowerCase();
    return q === '' ? [...SALARY_BANKS] : SALARY_BANKS.filter((b) => b.name.toLowerCase().includes(q));
  });

  // ---- helpers шаблона ----
  val(e: Event): string { return (e.target as HTMLInputElement).value; }
  numVal(e: Event): number { return Number((e.target as HTMLInputElement).value) || 0; }
  chk(e: Event): boolean { return (e.target as HTMLInputElement).checked; }
  money(v: number): string { return v > 0 ? Math.round(v).toLocaleString('ru-RU') : ''; }

  /** Разрешает ввод только цифр и управляющих клавиш (Backspace, Tab, стрелки) */
  allowDigitsOnly(e: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Delete'];
    if (allowedKeys.includes(e.key)) {
      return;
    }
    // Разрешаем только цифры от 0 до 9
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  }

  set(key: string, value: unknown): void {
    this.flow.patch({ [key]: value } as never);
    if (key === 'propertyType') {
      // Обновляем ставку при изменении типа недвижимости
      this.flow.updateRateForPropertyType();
    }
  }

  setMoney(key: 'cost' | 'down' | 'income' | 'creditPayments', e: Event): void {
    const raw = (e.target as HTMLInputElement).value.replace(/[^\d]/g, '');
    this.set(key, Number(raw) || 0);
  }

  onPhone(e: Event): void {
    let dg = this.val(e).replace(/\D+/g, '');
    if (dg.startsWith('8')) dg = '7' + dg.slice(1);
    if (!dg.startsWith('7')) dg = '7' + dg;
    dg = dg.slice(0, 11);
    let out = '+7';
    if (dg.length > 1) out += ' ' + dg.slice(1, 4);
    if (dg.length >= 4) out += ' ' + dg.slice(4, 7);
    if (dg.length >= 7) out += '-' + dg.slice(7, 9);
    if (dg.length >= 9) out += '-' + dg.slice(9, 11);
    this.set('phone', out);
  }

  // ---- маски на регулярных выражениях (быстрая валидация) ----
  
  /** Маска для серии и номера паспорта: 0000 000000 (используем сервис валидации) */
  onPassport(e: Event): void {
    const raw = this.validation.cleanDigits(this.val(e)).slice(0, 10);
    const out = this.validation.formatPassport(raw);
    this.set('passport', out);
    (e.target as HTMLInputElement).value = out;
  }

  /** Маска для кода подразделения: 000-000 (используем сервис валидации) */
  onPassportCode(e: Event): void {
    const raw = this.validation.cleanDigits(this.val(e)).slice(0, 6);
    const out = this.validation.formatPassportCode(raw);
    this.set('passportCode', out);
    (e.target as HTMLInputElement).value = out;
  }

  /** Маска для даты: дд.мм.гггг с автоматическими точками (используем сервис валидации) */
  onDate(e: Event): void {
    const raw = this.validation.cleanDigits(this.val(e)).slice(0, 8);
    const out = this.validation.formatDate(raw);
    (e.target as HTMLInputElement).value = out;
  }

  /** Маска для ИНН: 10 или 12 цифр (используем сервис валидации), валидация по контрольным суммам */
  onInn(e: Event): void {
    const raw = this.validation.cleanDigits(this.val(e));
    // Ограничиваем ввод до 12 цифр максимум
    const limited = raw.slice(0, 12);
    this.set('inn', limited);
    (e.target as HTMLInputElement).value = limited;
  }

  /** Маска для СНИЛС: 000-000-000 00 (используем сервис валидации), валидация по контрольной сумме */
  onSnils(e: Event): void {
    const raw = this.val(e).replace(/\D/g, '');
    // Ограничиваем ввод до 11 цифр максимум
    const limited = raw.slice(0, 11);
    const out = this.validation.formatSnils(limited);
    this.set('snils', out);
    (e.target as HTMLInputElement).value = limited;
  }

  /** Валидация ИНН через сервис */
  validateInn(inn: string): boolean {
    return this.validation.validateInn(inn);
  }

  /** Валидация СНИЛС через сервис */
  validateSnils(snils: string): boolean {
    return this.validation.validateSnils(snils);
  }

  // ---- шаги ----
  private validStep(): boolean {
    const d = this.d();
    switch (this.flow.stage()) {
      case 's1': return d.propertyType !== '' && d.cost > 0 && d.termValue > 0;
      case 's2': return d.city !== '' && d.lastName !== '' && d.firstName !== ''
        && d.income > 0 && (d.email === '' || this.emailValid());
      case 's3': return d.passport !== '' && d.birthDate !== '' && d.regAddress !== '';
      case 's4': return d.employment !== '' && d.experience !== ''
        && (!this.isWorking() || d.orgName !== '')
        && (d.inn === '' || this.validateInn(d.inn));
      case 's5': return d.marital !== '' && d.education !== ''
        && (d.snils === '' || this.validateSnils(d.snils));
      default: return true;
    }
  }

  continueStep(): void {
    this.touched.set(true);
    if (!this.validStep()) return;
    this.touched.set(false);
    if (this.flow.stage() === 's5') {
      void this.submit();
      return;
    }
    this.flow.next();
  }

  // ---- авторизация ----
  requestCode(): void {
    this.authTouched.set(true);
    if (!this.phoneValid()) return;
    this.pins.set(['', '', '', '']);
    if (this.flow.stage() === 'auth') this.flow.next(); // -> code
    this.startResend();
  }

  private startResend(): void {
    window.clearInterval(this.resendTimer);
    this.resendIn.set(60);
    this.resendTimer = window.setInterval(() => {
      this.resendIn.update((v) => v - 1);
      if (this.resendIn() <= 0) window.clearInterval(this.resendTimer);
    }, 1000);
  }

  onPin(e: Event, i: number): void {
    const v = this.val(e).replace(/\D/g, '').slice(-1);
    this.pins.update((p) => { const n = [...p]; n[i] = v; return n; });
    if (v && i < 3) {
      (document.getElementById('pin' + (i + 1)) as HTMLInputElement | null)?.focus();
    }
    if (this.pins().every((x) => x !== '')) {
      // Демо-подтверждение: код принят → авторизованы, шаг 2.
      window.clearInterval(this.resendTimer);
      this.flow.next();
    }
  }

  onPinKey(e: KeyboardEvent, i: number): void {
    if (e.key === 'Backspace' && this.pins()[i] === '' && i > 0) {
      (document.getElementById('pin' + (i - 1)) as HTMLInputElement | null)?.focus();
    }
  }

  // ---- шаг 5 логика ----
  onMarital(e: Event): void {
    const v = this.val(e);
    this.flow.patch({ marital: v, prenup: '', coborrowers: [] });
  }

  onChildren(e: Event): void {
    const v = this.val(e);
    this.flow.patch({ children: v, useMatCapital: '' });
  }

  addCoborrower(): void {
    this.flow.patch({
      coborrowers: [...this.d().coborrowers, { lastName: '', firstName: '', middleName: '', phone: '' }],
    });
  }

  removeCoborrower(i: number): void {
    this.flow.patch({ coborrowers: this.d().coborrowers.filter((_, idx) => idx !== i) });
  }

  setCob(i: number, key: keyof Coborrower, e: Event): void {
    const list = this.d().coborrowers.map((c, idx) =>
      idx === i ? { ...c, [key]: this.val(e) } : c);
    this.flow.patch({ coborrowers: list });
  }

  pickBank(name: string): void {
    this.set('salaryBank', name);
    this.bankOpen.set(false);
    this.bankQuery.set('');
  }

  // ---- финал ----
  private async submit(): Promise<void> {
    this.submitting.set(true);
    this.submitError.set(false);
    const d = this.d();
    try {
      const res = await fetch('/api/v1/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${d.lastName} ${d.firstName} ${d.middleName}`.trim(),
          phone: d.phone.replace(/\D+/g, ''),
          email: d.email || null,
          offer: this.flow.offer() ? {
            bank: this.flow.offer()!.bank_name,
            program: this.flow.offer()!.program_name,
            rate: this.flow.rate(),
          } : null,
          calculation: {
            cost: d.cost, down: d.down, months: this.flow.months(),
            loan: this.flow.loan(), monthlyPayment: Math.round(this.flow.payment()),
            rate: this.flow.rate(),
          },
          anketa: d,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      this.submitError.set(true); // анкета скачивается локально в любом случае
    } finally {
      this.submitting.set(false);
      this.flow.next(); // -> done (окно благодарности по ТЗ)
    }
  }

  async downloadPdf(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set('pdf');
    try { await exportAnketaPdf(this.flow.summary()); }
    finally { this.exporting.set(''); }
  }

  async downloadWord(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set('docx');
    try { await exportAnketaDocx(this.flow.summary()); }
    finally { this.exporting.set(''); }
  }

  async copyBorrowerLink(): Promise<void> {
    const ok = await copyText(this.flow.buildLink());
    if (ok) {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    }
  }
}
