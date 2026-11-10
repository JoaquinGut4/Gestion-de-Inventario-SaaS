import { useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { AdGlobalLogo } from '@/components/AdGlobalLogo';
import { ADMIN_CONFIG } from '@/config/site';
import type { LoginCredentials, LoginResult } from '@/hooks/useAuth';

interface LoginScreenProps {
  onAuthenticate: (credentials: LoginCredentials) => Promise<LoginResult>;
}

export function LoginScreen({ onAuthenticate }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const result = await onAuthenticate({ email, usuario, password, remember });

    setIsLoading(false);
    if (!result.ok) {
      setErrorMessage(result.error ?? 'No se pudo iniciar sesión.');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 font-sans text-ink">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white px-4 pb-3.5 pt-[calc(.875rem+env(safe-area-inset-top,0px))] shadow-xs sm:px-8">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AdGlobalLogo variant="brand" height={28} />
            <span className="hidden rounded-full border border-highlight/65 bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand sm:inline">
              Inventario
            </span>
          </div>
        </div>
      </header>

      {/* Login Box */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center mx-auto mb-4 text-white shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Acceso al Sistema de Inventario
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Panel de control y gestión de activos de {ADMIN_CONFIG.name}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Ingresa el correo y el usuario tal como quedaron registrados en tu cuenta. Ambos
              campos deben corresponder a la misma persona.
            </p>
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Email Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="username"
                  placeholder="nombre@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-user"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-user"
                  type="text"
                  value={usuario}
                  onChange={(event) => setUsuario(event.target.value)}
                  required
                  minLength={2}
                  autoComplete="nickname"
                  placeholder="Tu usuario"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand"
              />
              Mantener sesión iniciada en este dispositivo
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-white bg-brand hover:bg-brand-deep active:scale-[0.99] transition-all duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer mt-5 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2 text-sm">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Validando sesión...
                </span>
              ) : (
                <>
                  <span className="text-sm">Ingresar al Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 border-t border-slate-200 pt-5 text-center text-[11px] text-slate-500">
            Acceso exclusivo para personal autorizado de {ADMIN_CONFIG.name}.
          </p>
        </div>
      </main>
    </div>
  );
}
