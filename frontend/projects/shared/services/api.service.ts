import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Базовый API сервис для shared/services библиотеки.
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  protected readonly http = inject(HttpClient);
  
  private baseUrl = '';

  /**
   * Установка базового URL API.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  /**
   * GET запрос с типизированным ответом.
   */
  async get<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, String(value));
      });
    }
    
    const response = await firstValueFrom(
      this.http.get<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, { params: httpParams })
    );
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data as T;
  }

  /**
   * POST запрос с типизированным ответом.
   */
  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body)
    );
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data as T;
  }
}
