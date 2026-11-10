import {
  ADMIN_CONFIG,
  AUTH_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from '@/config/site';
import { extractApiErrorMessage } from './apiErrors';

export { extractApiErrorMessage } from './apiErrors';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RefreshResult = { token: string } | { error: 'unauthenticated' | 'network' };

let refreshPromise: Promise<RefreshResult> | null = null;

function readTokenWithStorage(key: string): { token: string; storage: Storage } | null {
  const local = window.localStorage.getItem(key);
  if (local) return { token: local, storage: window.localStorage };
  const session = window.sessionStorage.getItem(key);
  if (session) return { token: session, storage: window.sessionStorage };
  return null;
}

function clearAuthTokens() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    storage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

function dispatchUnauthorized() {
  window.dispatchEvent(new Event('adglobal:unauthorized'));
}

/**
 * Renueva el access token usando el refresh token guardado.
 * Varias peticiones que reciban 401 a la vez comparten la misma renovación.
 */
async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<RefreshResult> => {
    try {
      const response = await fetch(`${ADMIN_CONFIG.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        clearAuthTokens();
        return { error: 'unauthenticated' };
      }

      const payload = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (!payload.accessToken) {
        clearAuthTokens();
        return { error: 'unauthenticated' };
      }

      return { token: payload.accessToken };
    } catch {
      // Error de red: no se cierra la sesión; la siguiente petición reintenta.
      return { error: 'network' };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true);
}

/** Descarga un archivo binario (por ejemplo un PDF) usando la sesión actual. */
export async function apiDownload(path: string, filename: string, init: RequestInit = {}): Promise<void> {
  return download(path, filename, init, true);
}

async function download(path: string, filename: string, init: RequestInit, canRefresh: boolean): Promise<void> {
  if (!ADMIN_CONFIG.apiUrl) throw new Error('VITE_API_URL no está configurada.');

  const token = readTokenWithStorage(AUTH_TOKEN_STORAGE_KEY)?.token ?? null;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${ADMIN_CONFIG.apiUrl}${path}`, { ...init, headers, credentials: 'include' });

  if (response.status === 401) {
    if (canRefresh) {
      const refreshed = await refreshAccessToken();
      if ('token' in refreshed) return download(path, filename, init, false);
      if (refreshed.error === 'unauthenticated') dispatchUnauthorized();
    } else {
      dispatchUnauthorized();
    }
  }

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      message = extractApiErrorMessage(await response.json(), message);
    } catch {
      // La respuesta no contiene JSON.
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function request<T>(path: string, init: RequestInit, canRefresh: boolean): Promise<T> {
  if (!ADMIN_CONFIG.apiUrl) throw new Error('VITE_API_URL no está configurada.');

  const token = readTokenWithStorage(AUTH_TOKEN_STORAGE_KEY)?.token ?? null;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${ADMIN_CONFIG.apiUrl}${path}`, { ...init, headers, credentials: 'include' });

  if (response.status === 401) {
    if (canRefresh) {
      const refreshed = await refreshAccessToken();
      if ('token' in refreshed) return request<T>(path, init, false);
      if (refreshed.error === 'unauthenticated') dispatchUnauthorized();
      // Si falló la red, se conserva la sesión y se informa el 401 original.
    } else {
      dispatchUnauthorized();
    }
  }

  if (!response.ok) {
    const fallback =
      response.status === 401
        ? 'Sesión inválida o vencida'
        : response.status === 403
          ? 'No tienes permisos para esta acción'
          : `Error ${response.status}`;
    let message = fallback;
    try {
      message = extractApiErrorMessage(await response.json(), fallback);
    } catch {
      // La respuesta no contiene JSON.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
