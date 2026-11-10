interface ApiErrorDetail {
  msg?: string;
  loc?: Array<string | number>;
}

interface ApiErrorPayload {
  detail?: string | ApiErrorDetail[];
}

/** Convierte cualquier `detail` del backend (texto o lista de Pydantic) en un mensaje legible. */
export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null) return fallback;
  const detail = (payload as ApiErrorPayload).detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (!Array.isArray(detail)) return fallback;

  const messages = detail
    .map((item) => {
      if (typeof item !== 'object' || item === null) return '';
      const message = typeof item.msg === 'string' ? item.msg.trim() : '';
      if (!message) return '';
      const location = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== 'body').join('.')
        : '';
      return location ? `${location}: ${message}` : message;
    })
    .filter(Boolean);

  return messages.length > 0 ? messages.join(' ') : fallback;
}

/**
 * Traduce el resultado del endpoint de login a un mensaje accionable.
 *
 * Un 5xx (por ejemplo, el 502 que devuelve el proxy de Vite cuando el backend no
 * está escuchando) no debe presentarse como "credenciales inválidas": el problema
 * está en la conexión con la API, no en los datos del usuario.
 */
export function loginErrorMessage(status: number, payload: unknown): string {
  if (status >= 500) {
    return extractApiErrorMessage(
      payload,
      'No se pudo conectar con el servidor. Verifica que la API esté en línea e inténtalo de nuevo.',
    );
  }

  const fallback =
    status === 401
      ? 'Credenciales inválidas: revisa el correo, el usuario y la contraseña.'
      : status === 403
        ? 'Esta cuenta está desactivada. Contacta al administrador.'
        : status === 429
          ? 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.'
          : `No se pudo iniciar sesión (error ${status}).`;

  return extractApiErrorMessage(payload, fallback);
}
