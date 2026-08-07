import {
  ApplicationConfig, LOCALE_ID,
  provideZonelessChangeDetection,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeRu from '@angular/common/locales/ru';

registerLocaleData(localeRu);

/**
 * Конфигурация приложения:
 * - zoneless-реактивность на Signals;
 * - HttpClient через fetch;
 * - русская локаль (разделители тысяч пробелами: «101 612 ₽»).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    { provide: LOCALE_ID, useValue: 'ru' },
  ],
};
