import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeftRight, Boxes, CalendarDays, Download, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { apiDownload, apiRequest } from '@/lib/api';
import { asegurarEstadosInventario } from '@/lib/inventoryStates';
import type { InventoryStateApi } from '@/lib/operationsApi';
import type { InventarioCategoria } from '@/types';

const UBICACIONES = ['Almacén 1', 'Almacén 2', 'Almacén 3', 'Taller', 'Alquilado'];
const MODULOS = ['Inventario', 'Configuración'];

const FIELD_CLASS =
  'h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

function inputDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function inicioMes(): string {
  const today = new Date();
  return inputDate(new Date(today.getFullYear(), today.getMonth(), 1));
}

function finMes(): string {
  const today = new Date();
  return inputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
}

function ReportCard({
  title,
  description,
  icon,
  accent,
  children,
  onDownload,
  loading,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  accent: 'brand' | 'warning' | 'success';
  children: ReactNode;
  onDownload: () => void;
  loading: boolean;
}) {
  const iconClass = accent === 'warning'
    ? 'bg-warning/10 text-warning'
    : accent === 'success'
      ? 'bg-success/10 text-success'
      : 'bg-brand-soft text-brand';
  const buttonClass = accent === 'warning'
    ? 'bg-warning hover:brightness-95'
    : accent === 'success'
      ? 'bg-success hover:brightness-95'
      : 'bg-brand hover:bg-brand-deep';

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{icon}</span>
        <div>
          <h2 className="text-sm font-extrabold text-ink">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex-1 space-y-3">{children}</div>
      <button
        type="button"
        onClick={onDownload}
        disabled={loading}
        className={`mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all active:scale-[.985] disabled:cursor-wait disabled:opacity-60 ${buttonClass}`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {loading ? 'Generando PDF...' : 'Descargar PDF'}
      </button>
    </section>
  );
}

export function ReportesPage() {
  const { notify } = useToast();
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const [categoria, setCategoria] = useState('');
  const [estadoInventario, setEstadoInventario] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [modulo, setModulo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categorias, setCategorias] = useState<InventarioCategoria[]>([]);
  const [estadosInventario, setEstadosInventario] = useState<string[]>([]);
  const [loading, setLoading] = useState('');

  useEffect(() => {
    void Promise.all([
      apiRequest<InventarioCategoria[]>('/inventario/categorias'),
      apiRequest<InventoryStateApi[]>('/inventario/estados'),
    ]).then(([categoryRows, stateRows]) => {
      setCategorias(categoryRows);
      setEstadosInventario(
        asegurarEstadosInventario(stateRows.map((state) => state.nombre))
          .filter((state) => state !== 'Taller'),
      );
    }).catch(() => {
      // Los filtros son opcionales; el reporte de inventario sigue disponible.
    });
  }, []);

  const descargar = async (key: string, path: string, filename: string) => {
    setLoading(key);
    try {
      await apiDownload(path, filename);
      notify('Reporte PDF descargado correctamente.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo generar el reporte.');
    } finally {
      setLoading('');
    }
  };

  const descargarInventario = () => {
    const params = new URLSearchParams();
    if (categoria) params.set('categoria_id', categoria);
    if (estadoInventario) params.set('estado', estadoInventario);
    if (ubicacion) params.set('ubicacion', ubicacion);
    void descargar('inventario', `/reportes/inventario/pdf?${params}`, `reporte-inventario-${inputDate(new Date())}.pdf`);
  };

  const descargarMovimientos = () => {
    if (desde && hasta && desde > hasta) {
      notify('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (modulo) params.set('module', modulo);
    if (busqueda.trim()) params.set('search', busqueda.trim());
    void descargar('movimientos', `/reportes/movimientos/pdf?${params}`, `reporte-movimientos-${hasta || 'hoy'}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Reportes operativos</h2>
          <span className="rounded-full border border-highlight/65 bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
            PDF con tablas
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Descarga información consolidada del inventario y del historial de movimientos con los filtros seleccionados.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          title="Reporte de inventario"
          description="Equipos, categorías, ubicación, estados, seriales, precios y proveedores."
          icon={<Boxes className="h-5 w-5" />}
          accent="success"
          loading={loading === 'inventario'}
          onDownload={descargarInventario}
        >
          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Categoría
            <select value={categoria} onChange={(event) => setCategoria(event.target.value)} className={`${FIELD_CLASS} mt-1`}>
              <option value="">Todas las categorías</option>
              {categorias.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Estado
              <select value={estadoInventario} onChange={(event) => setEstadoInventario(event.target.value)} className={`${FIELD_CLASS} mt-1`}>
                <option value="">Todos</option>
                {estadosInventario.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Ubicación
              <select value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} className={`${FIELD_CLASS} mt-1`}>
                <option value="">Todas</option>
                {UBICACIONES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </ReportCard>

        <ReportCard
          title="Reporte de movimientos"
          description="Auditoría de cambios con usuario, módulo, acción, elemento, fecha e IP."
          icon={<ArrowLeftRight className="h-5 w-5" />}
          accent="brand"
          loading={loading === 'movimientos'}
          onDownload={descargarMovimientos}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Desde
              <input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className={`${FIELD_CLASS} mt-1`} />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Hasta
              <input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className={`${FIELD_CLASS} mt-1`} />
            </label>
          </div>
          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Módulo
            <select value={modulo} onChange={(event) => setModulo(event.target.value)} className={`${FIELD_CLASS} mt-1`}>
              <option value="">Todos los módulos</option>
              {MODULOS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Búsqueda
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Usuario, SKU, detalle..."
              className={`${FIELD_CLASS} mt-1`}
            />
          </label>
        </ReportCard>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-xs">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Contenido de los reportes</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Cada PDF incluye título, filtros aplicados, fecha de generación, resumen de totales, encabezados de tabla,
              filas alternas y numeración de páginas. El reporte de movimientos usa el rango de fechas indicado.
            </p>
          </div>
          <CalendarDays className="ml-auto hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
        </div>
      </section>
    </div>
  );
}
