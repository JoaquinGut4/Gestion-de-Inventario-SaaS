import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  History,
  Layers,
  PackageCheck,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { InventoryDistribution } from '@/components/dashboard/InventoryDistribution';
import { Modal } from '@/components/ui/Modal';
import type { AdminSection, DashboardResumen } from '@/types';

interface DashboardPageProps {
  resumen: DashboardResumen | null;
  onNavigate: (section: AdminSection) => void;
}

type DashboardCounter = 'total' | 'available' | 'rented' | 'maintenance' | 'categories' | 'value';

const TECHNICAL_STATUSES = [
  'Revisar',
  'Mantenimiento',
  'Diagnóstico',
  'Reparación',
  'Reemplazo requerido',
  'Reservado para reemplazo',
];

const priceFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

interface SummaryRow {
  label: string;
  value: number | string;
  detail: string;
  suffix?: string;
}

function CounterSummaryModal({
  counter,
  resumen,
  onClose,
  onNavigate,
}: {
  counter: DashboardCounter | null;
  resumen: DashboardResumen;
  onClose: () => void;
  onNavigate: (section: AdminSection) => void;
}) {
  const states = Object.entries(resumen.inventarioPorEstado);
  const available = resumen.inventarioPorEstado.Disponible ?? 0;
  const rented = resumen.inventarioPorEstado.Alquiler ?? 0;
  const maintenance = TECHNICAL_STATUSES.reduce((sum, state) => sum + (resumen.inventarioPorEstado[state] ?? 0), 0);

  const config: {
    title: string;
    subtitle: string;
    total: number | string;
    icon: ReactNode;
    headerClass: string;
    rows: SummaryRow[];
    footer?: string;
  } = (() => {
    switch (counter) {
      case 'available':
        return {
          title: 'Equipos disponibles',
          subtitle: 'Activos listos para asignación o alquiler',
          total: available,
          icon: <CheckCircle2 className="h-4 w-4" />,
          headerClass: 'bg-success',
          rows: resumen.inventarioPorUbicacion.map((location) => ({
            label: location.ubicacion,
            value: location.disponibles,
            detail: `${location.disponibles} de ${location.total} equipos disponibles`,
            suffix: 'equipos',
          })),
        };
      case 'rented':
        return {
          title: 'Equipos en alquiler',
          subtitle: 'Activos fuera de almacén por contrato de alquiler',
          total: rented,
          icon: <RotateCcw className="h-4 w-4" />,
          headerClass: 'bg-brand',
          rows: resumen.inventarioPorUbicacion
            .filter((location) => location.alquiler > 0)
            .map((location) => ({
              label: location.ubicacion,
              value: location.alquiler,
              detail: `${location.alquiler} equipos alquilados en esta ubicación`,
              suffix: 'equipos',
            })),
        };
      case 'maintenance':
        return {
          title: 'Equipos en servicio técnico',
          subtitle: 'Activos en revisión, reparación o mantenimiento',
          total: maintenance,
          icon: <Wrench className="h-4 w-4" />,
          headerClass: 'bg-warning',
          rows: TECHNICAL_STATUSES.map((state) => ({
            label: state,
            value: resumen.inventarioPorEstado[state] ?? 0,
            detail: 'Equipos en este estado operativo',
            suffix: 'equipos',
          })).filter((row) => row.value > 0),
        };
      case 'categories':
        return {
          title: 'Categorías del inventario',
          subtitle: 'Distribución de activos por categoría',
          total: resumen.categorias.length,
          icon: <Layers className="h-4 w-4" />,
          headerClass: 'bg-brand',
          rows: resumen.categorias.map((category) => ({
            label: category.categoria,
            value: category.total,
            detail: `${category.disponibles} disponibles de ${category.total} registrados`,
            suffix: 'equipos',
          })),
        };
      case 'value':
        return {
          title: 'Valor del inventario',
          subtitle: 'Suma de los precios de compra de los activos',
          total: priceFormatter.format(resumen.valorInventario),
          icon: <CircleDollarSign className="h-4 w-4" />,
          headerClass: 'bg-brand-deep',
          rows: resumen.categorias.map((category) => ({
            label: category.categoria,
            value: category.total,
            detail: `${category.total} equipos · ${category.disponibles} disponibles`,
            suffix: 'equipos',
          })),
          footer: `Valor total registrado: ${priceFormatter.format(resumen.valorInventario)}`,
        };
      case 'total':
      default:
        return {
          title: 'Total de equipos',
          subtitle: 'Distribución actual del inventario',
          total: resumen.inventarioTotal,
          icon: <Boxes className="h-4 w-4" />,
          headerClass: 'bg-brand',
          rows: states.map(([label, value]) => ({
            label,
            value,
            detail: `${Math.round((value / Math.max(resumen.inventarioTotal, 1)) * 100)}% del inventario`,
            suffix: 'equipos',
          })),
        };
    }
  })();

  return (
    <Modal
      isOpen={counter !== null}
      onClose={onClose}
      labelledBy="counter-summary-title"
      title={config.title}
      subtitle={config.subtitle}
      icon={config.icon}
      headerClass={config.headerClass}
      panelClass="max-w-2xl"
    >
      <div className="overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-highlight/50 bg-brand-soft/60 px-4 py-3">
          <div>
            <p className="font-mono text-2xl font-extrabold tracking-tight text-brand tabular-nums">{config.total}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Resumen del indicador seleccionado</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-brand shadow-xs">Actual</span>
        </div>

        <div className="space-y-2.5">
          {config.rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs font-semibold text-slate-500">No hay registros para mostrar.</div>
          ) : config.rows.map((item) => (
            <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 transition-[border-color,box-shadow] duration-150 hover:border-brand/25 hover:shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    {config.icon}
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-extrabold text-ink">{item.label}</h4>
                    <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 font-mono text-[10px] font-bold text-brand">
                  {item.value} {item.suffix ?? ''}
                </span>
              </div>
            </article>
          ))}
        </div>

        {config.footer && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-highlight/40 bg-brand-soft/50 px-4 py-3 text-xs font-bold text-brand">
            <CircleDollarSign className="h-4 w-4" />
            {config.footer}
          </p>
        )}
      </div>
      <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => { onClose(); onNavigate('inventario'); }} className="group flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-white transition-transform duration-150 active:scale-[.97]">
          Ver módulo completo <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </Modal>
  );
}

export function DashboardPage({ resumen, onNavigate }: DashboardPageProps) {
  const [selectedCounter, setSelectedCounter] = useState<DashboardCounter | null>(null);

  if (!resumen) {
    return (
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cargando dashboard">
        {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-44 rounded-2xl border border-slate-200 bg-white" />)}
      </div>
    );
  }

  const available = resumen.inventarioPorEstado.Disponible ?? 0;
  const rented = resumen.inventarioPorEstado.Alquiler ?? 0;
  const maintenance = TECHNICAL_STATUSES.reduce((sum, state) => sum + (resumen.inventarioPorEstado[state] ?? 0), 0);
  const stateEntries = Object.entries(resumen.inventarioPorEstado).sort((a, b) => b[1] - a[1]);
  const maxState = Math.max(1, ...stateEntries.map(([, value]) => value));

  const cards = [
    {
      label: 'Total de equipos', value: resumen.inventarioTotal, icon: Boxes, modal: 'total' as const,
      accent: 'brand', meta: `${resumen.categorias.length} categorías registradas`, code: 'INVENTARIO',
    },
    {
      label: 'Disponibles', value: available, icon: CheckCircle2, modal: 'available' as const,
      accent: 'success', meta: `${resumen.inventarioTotal > 0 ? Math.round((available / resumen.inventarioTotal) * 100) : 0}% del total`, code: 'DISPONIBLES',
    },
    {
      label: 'En alquiler', value: rented, icon: RotateCcw, modal: 'rented' as const,
      accent: 'brand', meta: rented === 0 ? 'Sin equipos alquilados' : 'Fuera de almacén', code: 'ALQUILER',
    },
    {
      label: 'En servicio técnico', value: maintenance, icon: Wrench, modal: 'maintenance' as const,
      accent: 'warning', meta: maintenance === 0 ? 'Sin equipos en taller' : 'Revisión y reparación', code: 'TALLER',
    },
    {
      label: 'Categorías', value: resumen.categorias.length, icon: Layers, modal: 'categories' as const,
      accent: 'brand', meta: 'Catálogo técnico', code: 'CATEGORÍAS',
    },
    {
      label: 'Valor del inventario', value: priceFormatter.format(resumen.valorInventario), icon: CircleDollarSign, modal: 'value' as const,
      accent: 'success', meta: 'Precio de compra acumulado', code: 'VALOR',
    },
  ];

  return (
    <div className="animate-in fade-in space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicadores principales">
        {cards.map(({ label, value, icon: Icon, modal, accent, meta, code }) => {
          const isWarning = accent === 'warning';
          const isSuccess = accent === 'success';
          const iconTone = isWarning
            ? 'bg-warning/10 text-warning group-hover:bg-warning'
            : isSuccess
              ? 'bg-success/10 text-success group-hover:bg-success'
              : 'bg-brand-soft text-brand group-hover:bg-brand';
          return (
            <button
              key={label}
              type="button"
              onClick={() => setSelectedCounter(modal)}
              aria-haspopup="dialog"
              className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-brand/30 hover:shadow-[0_16px_35px_rgba(0,24,48,.08)] active:scale-[.985]"
            >
              <div className="flex items-start justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200 group-hover:text-white ${iconTone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-colors group-hover:bg-brand-soft group-hover:text-brand">
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">{label}</p>
                <p className={`mt-1 font-mono font-extrabold tracking-[-0.04em] text-ink tabular-nums ${typeof value === 'string' ? 'text-xl' : 'text-3xl'}`}>{value}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                <span className="font-semibold text-slate-600">{meta}</span>
                <span className="font-mono text-[9px] tracking-wide text-slate-400">{code}</span>
              </div>
              <span className={`absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100 ${isWarning ? 'bg-warning' : isSuccess ? 'bg-success' : 'bg-brand'}`} />
            </button>
          );
        })}
      </section>

      <CounterSummaryModal
        counter={selectedCounter}
        resumen={resumen}
        onClose={() => setSelectedCounter(null)}
        onNavigate={onNavigate}
      />

      <div className="grid items-stretch gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <InventoryDistribution
            locations={resumen.inventarioPorUbicacion}
            totalEquipment={resumen.inventarioTotal}
            onGoToInventory={() => onNavigate('inventario')}
          />

          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><PackageCheck className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-sm font-extrabold text-ink">Estado operativo del inventario</h2>
                  <p className="text-[11px] text-slate-500">Cantidad de equipos por estado</p>
                </div>
              </div>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[9px] font-bold text-slate-500">{stateEntries.length} estados</span>
            </div>

            {stateEntries.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Boxes className="h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-600">Sin equipos registrados</p>
                <p className="mt-1 text-xs text-slate-500">Agrega productos al inventario para ver su distribución.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {stateEntries.map(([state, count]) => {
                  const technical = TECHNICAL_STATUSES.includes(state);
                  const color = state === 'Disponible' ? 'bg-success' : technical ? 'bg-warning' : state === 'Alquiler' ? 'bg-brand' : 'bg-slate-400';
                  return (
                    <div key={state} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 truncate text-[11px] font-semibold text-slate-700" title={state}>{state}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full ${color} transition-[width]`} style={{ width: `${(count / maxState) * 100}%` }} />
                      </span>
                      <span className="w-10 shrink-0 text-right font-mono text-[11px] font-bold text-slate-600 tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Layers className="h-4 w-4" /></span>
              <div>
                <h2 className="text-sm font-extrabold text-ink">Equipos por categoría</h2>
                <p className="text-[11px] text-slate-500">Catálogo técnico consolidado</p>
              </div>
            </div>
            {resumen.categorias.length === 0 ? (
              <p className="py-10 text-center text-xs font-semibold text-slate-500">Aún no hay categorías con equipos.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {resumen.categorias.slice(0, 7).map((category) => {
                  const percentage = resumen.inventarioTotal > 0 ? Math.round((category.total / resumen.inventarioTotal) * 100) : 0;
                  return (
                    <button
                      key={category.categoria}
                      type="button"
                      onClick={() => onNavigate('inventario')}
                      className="group flex w-full flex-col gap-1.5 rounded-xl border border-slate-100 bg-white p-2.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <strong className="truncate text-xs text-slate-900">{category.categoria}</strong>
                        <span className="flex shrink-0 items-baseline gap-1 font-mono">
                          <strong className="text-sm text-brand">{category.total}</strong>
                          <small className="text-[10px] font-semibold text-slate-400">/ {category.disponibles} disp.</small>
                        </span>
                      </span>
                      <span className="flex w-full items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${percentage}%` }} />
                        </span>
                        <small className="w-8 shrink-0 text-right font-mono text-[10px] font-semibold text-slate-500">{percentage}%</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-extrabold text-ink">Accesos rápidos</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Continúa con las tareas más frecuentes</p>
            <div className="mt-3 space-y-2">
              <button type="button" onClick={() => onNavigate('inventario')} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-colors hover:border-brand/30 hover:bg-brand-soft/50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand shadow-xs"><Boxes className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">Gestionar inventario</span><span className="block text-[10px] text-slate-500">Altas, ediciones y estados</span></span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
              <button type="button" onClick={() => onNavigate('reportes')} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-colors hover:border-brand/30 hover:bg-brand-soft/50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand shadow-xs"><FileText className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">Descargar reportes</span><span className="block text-[10px] text-slate-500">Inventario y movimientos en PDF</span></span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
              <button type="button" onClick={() => onNavigate('movimientos')} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-colors hover:border-brand/30 hover:bg-brand-soft/50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand shadow-xs"><History className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">Revisar movimientos</span><span className="block text-[10px] text-slate-500">Auditoría de cambios</span></span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
          </section>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><History className="h-4 w-4" /></span>
            <div><h2 className="text-sm font-extrabold text-ink">Últimos movimientos</h2><p className="text-[11px] text-slate-500">Trazabilidad reciente de la operación</p></div>
          </div>
          <button type="button" onClick={() => onNavigate('movimientos')} className="group hidden items-center gap-1 text-xs font-bold text-brand sm:flex">Ver historial <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></button>
        </div>
        {resumen.movimientosRecientes.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center"><CheckCircle2 className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-600">Sin movimientos recientes</p><p className="mt-1 text-xs text-slate-500">Las nuevas operaciones aparecerán en este registro.</p></div>
        ) : (
          <div className="divide-y divide-slate-100 px-5 sm:px-6">
            {resumen.movimientosRecientes.map((item) => (
              <div key={item.id} className="group flex flex-col gap-2 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 font-mono text-[10px] font-bold text-brand">{item.usuario.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0"><strong className="block text-slate-800">{item.usuario} <small className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[9px] text-brand">{item.modulo}</small></strong><span className="mt-0.5 block truncate text-slate-500">{item.detalle}</span></span>
                </div>
                <time className="flex shrink-0 items-center gap-1.5 pl-11 font-mono text-[10px] text-slate-400 sm:pl-0"><Clock3 className="h-3 w-3" />{new Date(item.fecha).toLocaleString('es-PE')}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
