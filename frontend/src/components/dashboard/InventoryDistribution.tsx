import { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Layers,
  MapPin,
  PieChart,
  ShieldCheck,
  Warehouse,
  Wrench,
} from 'lucide-react';
import type { DashboardResumen, InventarioUbicacion } from '@/types';

interface InventoryDistributionProps {
  locations: DashboardResumen['inventarioPorUbicacion'];
  totalEquipment: number;
  onGoToInventory: () => void;
}

type MetricView = 'disponibles' | 'categorias';

const CATEGORY_COLORS = ['#14264A', '#0F9D76', '#B26A00', '#7C3AED', '#0EA5E9', '#C2383D', '#64748B'];

const LOCATION_CONFIG: Record<InventarioUbicacion, { id: string; color: string; detail: string }> = {
  'Almacén 1': { id: 'alm-1', color: '#14264A', detail: 'Ubicación operativa' },
  'Almacén 2': { id: 'alm-2', color: '#001830', detail: 'Ubicación operativa' },
  'Almacén 3': { id: 'alm-3', color: '#A9C6FF', detail: 'Ubicación operativa' },
  Taller: { id: 'taller', color: '#B26A00', detail: 'Servicio técnico' },
  Alquilado: { id: 'alquilado', color: '#0F9D76', detail: 'Fuera de almacén' },
};

function LocationIcon({ location }: { location: InventarioUbicacion }) {
  if (location === 'Almacén 1') return <Building2 className="h-3.5 w-3.5" />;
  if (location === 'Almacén 2') return <Warehouse className="h-3.5 w-3.5" />;
  if (location === 'Almacén 3') return <MapPin className="h-3.5 w-3.5" />;
  if (location === 'Alquilado') return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <Wrench className="h-3.5 w-3.5" />;
}

export function InventoryDistribution({ locations, totalEquipment, onGoToInventory }: InventoryDistributionProps) {
  const [hoveredLocation, setHoveredLocation] = useState<InventarioUbicacion | null>(null);
  const [metricView, setMetricView] = useState<MetricView>('disponibles');
  const totalAvailable = locations.reduce((total, location) => total + location.disponibles, 0);
  const totalRented = locations.reduce((total, location) => total + location.alquiler, 0);
  const totalMaintenance = locations.reduce((total, location) => total + location.mantenimiento, 0);
  const activeLocation = locations.find((location) => location.ubicacion === hoveredLocation);
  const categoryTotals = (() => {
    const totals = new Map<string, { categoria: string; total: number; disponibles: number }>();
    for (const location of locations) {
      for (const category of location.categorias ?? []) {
        const current = totals.get(category.categoria) ?? { categoria: category.categoria, total: 0, disponibles: 0 };
        current.total += category.total;
        current.disponibles += category.disponibles;
        totals.set(category.categoria, current);
      }
    }
    return [...totals.values()]
      .filter((category) => category.total > 0)
      .sort((a, b) => b.disponibles - a.disponibles || a.categoria.localeCompare(b.categoria));
  })();
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const gap = 3;
  let accumulatedLength = 0;
  const slices = locations.map((location) => {
    const value = location.disponibles;
    const length = totalAvailable > 0 ? (value / totalAvailable) * circumference : 0;
    const slice = {
      ...location,
      value,
      dash: `${Math.max(length - (value > 0 ? gap : 0), 0)} ${circumference}`,
      offset: -accumulatedLength,
      color: LOCATION_CONFIG[location.ubicacion].color,
    };
    accumulatedLength += length;
    return slice;
  });
  const availabilityRate = totalEquipment > 0 ? (totalAvailable / totalEquipment) * 100 : 0;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <PieChart className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold leading-tight text-ink sm:text-base">Distribución de inventario</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">{locations.length} ubicaciones · {totalAvailable} equipos disponibles</p>
          </div>
        </div>
        <button type="button" onClick={onGoToInventory} className="group flex shrink-0 items-center gap-1 text-[11px] font-bold text-brand">
          Ver inventario <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="mt-3.5 flex rounded-xl bg-slate-100/90 p-1" aria-label="Métrica de distribución">
        <button
          type="button"
          aria-pressed={metricView === 'disponibles'}
          onClick={() => setMetricView('disponibles')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${metricView === 'disponibles' ? 'bg-white text-success shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Disponibles ({totalAvailable})
        </button>
        <button
          type="button"
          aria-pressed={metricView === 'categorias'}
          onClick={() => setMetricView('categorias')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${metricView === 'categorias' ? 'bg-white text-brand shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <Layers className="h-3.5 w-3.5" /> Por categoría ({categoryTotals.length})
        </button>
      </div>

      {metricView === 'disponibles' ? (
      <>
      <div className="flex flex-col items-center justify-center border-b border-slate-100 py-4">
        <div className="relative flex h-48 w-48 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160" role="img" aria-label={`Distribución por ubicación: ${totalAvailable} equipos disponibles`}>
            <circle cx="80" cy="80" r={radius} fill="transparent" strokeWidth="19" className="stroke-slate-100" />
            {slices.filter((slice) => slice.value > 0).map((slice) => (
              <circle
                key={slice.ubicacion}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={hoveredLocation === slice.ubicacion ? 23 : 19}
                strokeDasharray={slice.dash}
                strokeDashoffset={slice.offset}
                strokeLinecap="round"
                className="cursor-pointer transition-[stroke-width] duration-200"
                onMouseEnter={() => setHoveredLocation(slice.ubicacion)}
                onMouseLeave={() => setHoveredLocation(null)}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
            <span className="max-w-28 truncate text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">
              {activeLocation?.ubicacion ?? 'Disponibles'}
            </span>
            <span className="font-mono text-2xl font-extrabold tracking-tight text-ink tabular-nums">
              {activeLocation?.disponibles ?? totalAvailable}
            </span>
            <span className="mt-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-bold text-success">
              {activeLocation ? `${activeLocation.disponibles} disponibles` : `${availabilityRate.toFixed(1)}% disponible`}
            </span>
          </div>
        </div>
        <div className="mt-2 flex w-full items-center justify-around border-t border-slate-100/80 pt-2 text-[10px] font-semibold text-slate-600">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-success" />{totalAvailable} Disp.</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand" />{totalRented} Alq.</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-warning" />{totalMaintenance} Mant.</span>
        </div>
      </div>

      <div className="mt-3.5 space-y-2">
        {locations.map((location) => {
          const config = LOCATION_CONFIG[location.ubicacion];
          const percentage = location.total > 0 ? Math.round((location.disponibles / location.total) * 100) : 0;
          const isActive = hoveredLocation === location.ubicacion;
          return (
            <button
              key={location.ubicacion}
              type="button"
              onClick={onGoToInventory}
              onMouseEnter={() => setHoveredLocation(location.ubicacion)}
              onMouseLeave={() => setHoveredLocation(null)}
              onFocus={() => setHoveredLocation(location.ubicacion)}
              onBlur={() => setHoveredLocation(null)}
              className={`group flex w-full flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-colors ${isActive ? 'border-brand/30 bg-brand-soft/70' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <i className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/60" style={{ color: config.color, backgroundColor: `${config.color}12` }}><LocationIcon location={location.ubicacion} /></i>
                  <span className="min-w-0"><strong className="block truncate text-xs text-slate-900">{location.ubicacion}</strong><small className="block truncate text-[9px] font-medium text-slate-500">{config.detail}</small></span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <strong className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success"><CheckCircle2 className="h-3 w-3" />{location.disponibles} disp.</strong>
                  <small className="font-mono text-[9px] text-slate-400">/ {location.total}</small>
                </span>
              </span>
              <span className="flex w-full items-center gap-2">
                <i className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><i className="block h-full rounded-full bg-success transition-[width]" style={{ width: `${percentage}%` }} /></i>
                <small className="shrink-0 font-mono text-[9px] font-semibold text-slate-500">{percentage}% disponible</small>
              </span>
            </button>
          );
        })}
      </div>
      </>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">
              <Layers className="h-3.5 w-3.5 text-brand" />
              Disponibles por categoría
            </span>
            <span className="rounded-md bg-success/10 px-2 py-0.5 font-mono text-[11px] font-bold text-success">
              {totalAvailable} equipos
            </span>
          </div>

          {categoryTotals.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-10 text-center text-xs font-semibold text-slate-500">
              No hay equipos disponibles registrados.
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {categoryTotals.map((category, index) => {
                const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                const percentage = category.total > 0 ? Math.round((category.disponibles / category.total) * 100) : 0;
                return (
                  <button
                    key={category.categoria}
                    type="button"
                    onClick={onGoToInventory}
                    title={`${category.categoria}: ${category.disponibles} disponibles de ${category.total}`}
                    className="group flex w-full flex-col gap-1.5 rounded-xl border border-slate-100 bg-white p-2.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <strong className="truncate text-xs text-slate-900">{category.categoria}</strong>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-1 font-mono">
                        <strong className="text-sm text-success">{category.disponibles}</strong>
                        <small className="text-[11px] font-semibold text-slate-400">/ {category.total}</small>
                      </span>
                    </span>
                    <span className="flex w-full items-center gap-2">
                      <i className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <i className="block h-full rounded-full transition-[width]" style={{ width: `${percentage}%`, backgroundColor: color }} />
                      </i>
                      <small className="w-9 shrink-0 text-right font-mono text-[11px] font-semibold text-slate-500">{percentage}%</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" />{locations.length} ubicaciones registradas</span>
        <button type="button" onClick={onGoToInventory} className="font-bold text-brand hover:underline">Kardex general</button>
      </div>
    </section>
  );
}
