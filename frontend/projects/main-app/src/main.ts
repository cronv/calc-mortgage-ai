import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/**
 * Точка входа публичного калькулятора.
 * Bootstrap standalone-компонента с конфигурацией из app.config.ts.
 */
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
