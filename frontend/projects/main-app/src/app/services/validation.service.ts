import { Injectable } from '@angular/core';

/**
 * Сервис валидации данных с использованием регулярных выражений
 * для максимальной производительности и переиспользования в различных местах приложения.
 */
@Injectable({ providedIn: 'root' })
export class ValidationService {
  /**
   * Валидация ИНН: 10 или 12 цифр (физлицо/ИП или юрлицо), допускает ведущий ноль.
   * Алгоритм быстрый, без циклов — использует reduce() с коэффициентами.
   * 
   * @param inn - ИНН для проверки (строка)
   * @returns true если ИНН корректен
   */
  validateInn(inn: string): boolean {
    const digits = inn.replace(/\D/g, '');
    
    // Быстрая проверка длины и формата без циклов
    if (!/^(?:\d{10}|\d{12})$/.test(digits)) {
      return false;
    }
    
    // Проверка контрольных сумм для 10-значного ИНН (физлица/ИП)
    if (digits.length === 10) {
      const coeffs1 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
      const sum1 = digits.slice(0, 9).split('').reduce((s, d, i) => s + +d * coeffs1[i], 0);
      const check1 = sum1 % 11;
      const ctrl = check1 > 9 ? 0 : check1;
      return ctrl === +digits[9];
    }
    
    // Проверка контрольных сумм для 12-значного ИНН (юрлица)
    if (digits.length === 12) {
      const coeffs1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
      const coeffs2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
      const sum1 = digits.slice(0, 10).split('').reduce((s, d, i) => s + +d * coeffs1[i], 0);
      let check1 = sum1 % 11;
      if (check1 > 9) {
        check1 = 0;
      }
      if (check1 !== +digits[10]) {
        return false;
      }
      
      const sum2 = digits.slice(0, 11).split('').reduce((s, d, i) => s + +d * coeffs2[i], 0);
      let check2 = sum2 % 11;
      if (check2 > 9) {
        check2 = 0;
      }
      return check2 === +digits[11];
    }
    
    return false;
  }

  /**
   * Валидация СНИЛС: формат 000-000-000 00 с проверкой контрольной суммы.
   * Алгоритм быстрый, использует reduce() с коэффициентами.
   * 
   * @param snils - СНИЛС для проверки (строка)
   * @returns true если СНИЛС корректен
   */
  validateSnils(snils: string): boolean {
    const digits = snils.replace(/\D/g, '');
    
    // Быстрая проверка формата: ровно 11 цифр
    if (!/^\d{11}$/.test(digits)) {
      return false;
    }
    
    // Вычисление контрольной суммы (последние 2 цифры)
    const coeffs = [9, 8, 7, 6, 5, 4, 3, 2, 1];
    const sum = digits.slice(0, 9).split('').reduce((s, d, i) => s + +d * coeffs[i], 0);
    const check = sum % 101;
    const ctrl = check < 100 ? check : 0;
    const formattedCtrl = ctrl.toString().padStart(2, '0');
    
    return formattedCtrl === digits.slice(9, 11);
  }

  /**
   * Валидация серии и номера паспорта: 10 цифр (4 цифры серия + 6 номер).
   * 
   * @param passport - Серия и номер паспорта (строка)
   * @returns true если формат корректен
   */
  validatePassport(passport: string): boolean {
    const digits = passport.replace(/\D/g, '');
    return /^\d{10}$/.test(digits);
  }

  /**
   * Валидация кода подразделения: 6 цифр (формат 000-000).
   * 
   * @param code - Код подразделения (строка)
   * @returns true если формат корректен
   */
  validatePassportCode(code: string): boolean {
    const digits = code.replace(/\D/g, '');
    return /^\d{6}$/.test(digits);
  }

  /**
   * Валидация даты в формате дд.мм.гггг.
   * Проверяет формат и базовую корректность дня/месяца.
   * 
   * @param date - Дата в формате дд.мм.гггг (строка)
   * @returns true если дата корректна
   */
  validateDate(date: string): boolean {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
    if (!match) {
      return false;
    }
    
    const day = +match[1];
    const month = +match[2];
    const year = +match[3];
    
    // Базовая проверка диапазона
    if (day < 1 || day > 31) {
      return false;
    }
    if (month < 1 || month > 12) {
      return false;
    }
    if (year < 1900 || year > new Date().getFullYear()) {
      return false;
    }
    
    return true;
  }

  /**
   * Очистка строки от нецифровых символов (быстрый regex).
   * 
   * @param value - Входная строка
   * @returns Строка только с цифрами
   */
  cleanDigits(value: string): string {
    return value.replace(/[^\d]/g, '');
  }

  /**
   * Форматирование телефона в формате +7 XXX XXX-XX-XX.
   * 
   * @param phone - Телефон (строка)
   * @returns Отформатированный телефон
   */
  formatPhone(phone: string): string {
    const digits = this.cleanDigits(phone).slice(0, 11);
    let out = '';
    
    if (digits.length > 0) {
      out = '+7';
    }
    if (digits.length >= 2) {
      out += ' ' + digits.slice(1, 4);
    }
    if (digits.length >= 5) {
      out += ' ' + digits.slice(4, 7);
    }
    if (digits.length >= 7) {
      out += '-' + digits.slice(7, 9);
    }
    if (digits.length >= 9) {
      out += '-' + digits.slice(9, 11);
    }
    
    return out;
  }

  /**
   * Форматирование серии и номера паспорта: 0000 000000.
   * 
   * @param passport - Серия и номер (только цифры)
   * @returns Отформатированная строка
   */
  formatPassport(passport: string): string {
    const digits = this.cleanDigits(passport).slice(0, 10);
    return digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
  }

  /**
   * Форматирование кода подразделения: 000-000.
   * 
   * @param code - Код подразделения (только цифры)
   * @returns Отформатированная строка
   */
  formatPassportCode(code: string): string {
    const digits = this.cleanDigits(code).slice(0, 6);
    return digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
  }

  /**
   * Форматирование даты: дд.мм.гггг с автоматическими точками.
   * При удалении символов корректно обрабатывает точки.
   * Использует регулярные выражения для чистоты кода.
   * 
   * @param date - Дата (только цифры)
   * @returns Отформатированная строка
   */
  formatDate(date: string): string {
    const digits = this.cleanDigits(date).slice(0, 8);
    
    // Пустая строка
    if (!digits) {
      return '';
    }
    
    // Формируем шаблон ДД.ММ.ГГГГ, затем обрезаем лишние точки
    const template = digits
      .split('')
      .map((d, i) => {
        if (i === 2 || i === 4) return '.' + d;
        return d;
      })
      .join('');
    
    // Удаляем trailing точку, если она есть в конце
    return template.replace(/\.+$/, '');
  }

  /**
   * Форматирование СНИЛС: 000-000-000 00.
   * 
   * @param snils - СНИЛС (только цифры)
   * @returns Отформатированная строка
   */
  formatSnils(snils: string): string {
    const digits = this.cleanDigits(snils).slice(0, 11);
    let out = '';
    
    if (digits.length > 0) {
      out += digits.slice(0, 3);
    }
    if (digits.length > 3) {
      out += '-' + digits.slice(3, 6);
    }
    if (digits.length > 6) {
      out += '-' + digits.slice(6, 9);
    }
    if (digits.length > 9) {
      out += ' ' + digits.slice(9, 11);
    }
    
    return out;
  }

  /**
   * Форматирование ИНН: 10 или 12 цифр без разделителей.
   * 
   * @param inn - ИНН (только цифры)
   * @returns Отформатированная строка
   */
  formatInn(inn: string): string {
    return this.cleanDigits(inn).slice(0, 12);
  }
}
