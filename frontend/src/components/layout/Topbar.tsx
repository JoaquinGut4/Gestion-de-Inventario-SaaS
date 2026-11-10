import { Boxes, Menu, Radio } from 'lucide-react';
import type { AdminSection } from '@/types';

interface TopbarProps {
  title: string;
  description: string;
  onToggleSidebar: () => void;
  onNavigate: (section: AdminSection) => void;
}

export function Topbar({
  title,
  description,
  onToggleSidebar,
  onNavigate,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/90 px-3 pb-2 pt-[calc(.5rem+env(safe-area-inset-top,0px))] backdrop-blur-xl sm:gap-3 sm:px-6 sm:pb-3 sm:pt-[calc(.75rem+env(safe-area-inset-top,0px))]">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="hidden items-center gap-1.5 text-[10px] font-semibold text-slate-400 sm:flex">
            <span>Inventario</span><span>/</span><span className="text-brand">Administración</span>
          </div>
          <h1 className="truncate text-lg font-extrabold tracking-[-0.025em] text-ink sm:text-xl">{title}</h1>
          <p className="hidden max-w-xl truncate text-[11px] text-slate-500 xl:block">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 lg:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <Radio className="h-3 w-3 text-success" />
          Datos en vivo
        </div>

        <button
          type="button"
          onClick={() => onNavigate('inventario')}
          title="Ir al inventario"
          aria-label="Ir al inventario"
          className="group inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand text-xs font-bold text-white shadow-sm shadow-brand/20 transition-[background-color,transform] hover:bg-brand-deep active:scale-[.97] sm:w-auto sm:px-3.5"
        >
          <Boxes className="w-3.5 h-3.5 text-highlight transition-transform group-hover:scale-110" />
          <span className="hidden sm:inline">Inventario</span>
        </button>
      </div>
    </header>
  );
}
