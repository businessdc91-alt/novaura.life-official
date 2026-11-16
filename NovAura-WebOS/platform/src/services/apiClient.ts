import { kernelStorage } from '../kernel/kernelStorage.js';
/**
 * NovAura API Client
 * Connects to LIVE Polsia backend - NO MOCK DATA
 */

const API_URL = ((import.meta.env.VITE_BACKEND_URL as string) || 'https://novaura.life/api').replace(/\/$/, '');

const TOKEN_KEY = 'novaura-auth-token';

export const apiClient = {
  getToken(): string | null {
    return kernelStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    kernelStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    kernelStorage.removeItem(TOKEN_KEY);
  },

  async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${response.status})`);
    }

    return response.json();
  },

  get<T = any>(path: string) {
    return this.request<T>(path, { method: 'GET' });
  },

  post<T = any>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patch<T = any>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  
  delete<T = any>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  },
};

/**
 * Safe API request that returns null on error instead of throwing
 */
export async function safeRequest<T>(
  requestFn: () => Promise<T>,
  fallback?: T
): Promise<T | null> {
  try {
    return await requestFn();
  } catch (err) {
    console.warn('API request failed:', err);
    return fallback || null;
  }
}
