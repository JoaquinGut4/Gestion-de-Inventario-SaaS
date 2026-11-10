import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** Clases de color del encabezado (ej. "bg-brand"). */
  headerClass?: string;
  /** Ancho máximo u otras clases del panel. */
  panelClass?: string;
  children: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  labelledBy,
  title,
  subtitle,
  icon,
  headerClass = 'bg-brand',
  panelClass = 'max-w-lg',
  children,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-0 backdrop-blur-xs animate-in fade-in duration-150 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`safe-bottom flex h-dvh max-h-dvh w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl ${panelClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex min-h-16 items-center justify-between px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top,0px))] text-white sm:px-6 sm:pb-4 sm:pt-[calc(1rem+env(safe-area-inset-top,0px))] ${headerClass}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-bold">
              {icon}
            </div>
            <div>
              <h3 id={labelledBy} className="text-base font-bold text-white tracking-tight">
                {title}
              </h3>
              {subtitle && <p className="text-[11px] text-white/80">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
