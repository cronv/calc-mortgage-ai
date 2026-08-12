import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ProgramKey } from './mortgage.service';

/**
 * Предложение банка из единого API GET /api/v1/calculator/match.
 * Поля соответствуют колонкам карточки banki.ru, которые парсер
 * сопоставляет при сборе данных: ставка, платёж, первоначальный взнос.
 */
export interface BankOffer {
  bank_name: string;
  bank_logo_url: string | null;
  program_name: string;
  program_type: string;
  calculated_rate: number;
  monthly_payment: number;
  overpayment: number;
  total_payout: number;
  min_down_payment: number;
  application_url: string | null;
}

export interface MatchQuery {
  cost: number;
  down: number;
  termMonths: number;
  programType: string;
  propertyType?: string;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Загрузка и фильтрация банковских предложений. */
@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly http = inject(HttpClient);

  readonly offers = signal<BankOffer[]>([]);
  readonly state = signal<LoadState>('idle');

  private requestId = 0;

  async load(q: MatchQuery): Promise<void> {
    const id = ++this.requestId;
    this.state.set('loading');
    try {
      const params = new HttpParams()
        .set('cost', String(Math.round(q.cost)))
        .set('down_payment', String(Math.round(q.down)))
        .set('term', String(q.termMonths))
        .set('program_type', q.programType);
      
      // propertyType передаётся только если указан
      if (q.propertyType) {
        params.set('property_type', q.propertyType);
      }
      
      const res = await firstValueFrom(
        this.http.get<{ offers: BankOffer[] }>('/api/v1/calculator/match', { params }),
      );
      if (id !== this.requestId) return; // пришёл более свежий запрос
      this.offers.set(res.offers ?? []);
      this.state.set('ready');
    } catch {
      if (id !== this.requestId) return;
      this.offers.set([]);
      this.state.set('error');
    }
  }

  /** Соответствие предложения выбранной программе (фильтрация на клиенте). */
  matchesProgram(offer: BankOffer, program: ProgramKey): boolean {
    const name = (offer.program_name || '').toLowerCase();
    switch (program) {
      case 'STANDARD':   return offer.program_type === 'STANDARD';
      case 'FAMILY':     return name.includes('семейн');
      case 'IT':         return name.includes('it') || name.includes('ит-');
      case 'FAR_EAST':   return name.includes('дальневосточ');
      case 'RURAL':      return name.includes('сельск');
      case 'MILITARY':   return name.includes('военн');
      case 'ARCTIC':     return name.includes('арктич');
      default:           return true;
    }
  }
}
