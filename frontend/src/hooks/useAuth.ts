import { useCallback, useEffect, useState } from 'react';
import { ADMIN_CONFIG, AUTH_SESSION_STORAGE_KEY, AUTH_STORAGE_KEY, AUTH_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '@/config/site';
import { apiRequest } from '@/lib/api';
import { loginErrorMessage } from '@/lib/apiErrors';
import type { AdminSection, UsuarioRol } from '@/types';

export interface LoginCredentials {
  usuario: string;
  password: string;
  remember: boolean;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export interface AuthSession {
  id: string;
  email: string;
  usuario: string;
  nombre: string;
  rol: UsuarioRol;
  telefono: string;
  modulos: AdminSection[];
  superAdmin: boolean;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthSession;
}

const EMPTY_SESSION: AuthSession = {
  id: '',
  email: '',
  usuario: '',
  nombre: '',
  rol: 'Administrador',
  telefono: '',
  modulos: [],
  superAdmin: false,
};

const SESSION_KEYS = [
  AUTH_STORAGE_KEY,
  AUTH_SESSION_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
];

/** Lee de localStorage o, si la sesión es solo de esta pestaña, de sessionStorage. */
function readStored(key: string): string | null {
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
}

function readSession(): AuthSession {
  try {
    const stored = readStored(AUTH_SESSION_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthSession) : EMPTY_SESSION;
  } catch {
    return EMPTY_SESSION;
  }
}

/** Elimina la sesión de ambos almacenes. */
function clearStoredSession() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of SESSION_KEYS) storage.removeItem(key);
  }
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession>(readSession);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(readSession().id),
  );

  const logout = useCallback(() => {
    // Revoca la cookie HttpOnly; si falla, la sesión local se cierra igual.
    void fetch(`${ADMIN_CONFIG.apiUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }).catch(() => undefined);
    setIsAuthenticated(false);
    setSession(EMPTY_SESSION);
    clearStoredSession();
  }, []);

  // Cualquier 401 de la API cierra la sesión local.
  useEffect(() => {
    window.addEventListener('inventory:unauthorized', logout);
    return () => window.removeEventListener('inventory:unauthorized', logout);
  }, [logout]);

  // Valida el token guardado contra el servidor y refresca módulos y rol.
  useEffect(() => {
    if (!readStored(AUTH_SESSION_STORAGE_KEY)) return;
    apiRequest<AuthSession>('/auth/me')
      .then((user) => {
        setSession(user);
        setIsAuthenticated(true);
      })
      .catch(() => {
        /* Un 401 dispara inventory:unauthorized; un fallo de red conserva la sesión cacheada. */
      });
  }, []);

  const authenticate = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    const { usuario, password, remember } = credentials;
    if (!usuario.trim() || !password) {
      return { ok: false, error: 'Todos los campos son obligatorios.' };
    }
    if (usuario.trim().length < 2) {
      return { ok: false, error: 'El usuario debe tener al menos 2 caracteres.' };
    }
    if (password.length < 8) {
      return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
    }
    if (!ADMIN_CONFIG.apiUrl) {
      return { ok: false, error: 'La URL del backend no está configurada (VITE_API_URL).' };
    }

    try {
      const response = await fetch(`${ADMIN_CONFIG.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ usuario: usuario.trim(), password }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // La respuesta no contiene JSON.
      }

      if (!response.ok) {
        return { ok: false, error: loginErrorMessage(response.status, payload) };
      }

      const sessionPayload = payload as Partial<AuthResponse> | null;
      if (!sessionPayload?.user || !sessionPayload.accessToken || !sessionPayload.refreshToken) {
        return { ok: false, error: 'La respuesta del servidor no contiene una sesión válida.' };
      }

      const target = remember ? window.localStorage : window.sessionStorage;
      const other = remember ? window.sessionStorage : window.localStorage;
      for (const key of SESSION_KEYS) other.removeItem(key);

      target.setItem(AUTH_STORAGE_KEY, 'true');
      target.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(sessionPayload.user));
      // Los tokens viven únicamente en cookies HttpOnly. Se eliminan restos de
      // versiones anteriores del panel.
      target.removeItem(AUTH_TOKEN_STORAGE_KEY);
      target.removeItem(REFRESH_TOKEN_STORAGE_KEY);

      setSession(sessionPayload.user);
      setIsAuthenticated(true);
      return { ok: true };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor. Verifica que la API esté disponible.' };
    }
  }, []);

  return { isAuthenticated, session, authenticate, logout };
}
