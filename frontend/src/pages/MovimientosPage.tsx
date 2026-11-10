import { useEffect, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { apiDownload, apiRequest } from '@/lib/api';
import type { PaginatedApi } from '@/lib/operationsApi';
import type { MovimientoAuditoria, MovimientoModulo } from '@/types';

type ModuloFiltro = 'Todos' | MovimientoModulo;
const MODULOS: ModuloFiltro[] = ['Todos', 'Inventario', 'Configuración'];
const formatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

export function MovimientosPage() {
  const { notify } = useToast();
  const [items, setItems] = useState<MovimientoAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState<ModuloFiltro>('Todos');
  const [fecha, setFecha] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState('');

  const query = (includePage = true) => {
    const params = new URLSearchParams();
    if (module !== 'Todos') params.set('module', module);
    if (fecha) {
      params.set('desde', fecha);
      params.set('hasta', fecha);
    }
    if (search.trim()) params.set('search', search.trim());
    if (includePage) {
      params.set('page', String(page));
      params.set('page_size', '50');
    }
    return params.toString();
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<PaginatedApi<MovimientoAuditoria>>(`/movimientos?${query()}`);
      setItems(response.items);
      setTotal(response.total);
      setPages(response.pages);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, module, fecha, search]);

  useEffect(() => setPage(1), [module, fecha, search]);

  const download = async (format: 'csv' | 'pdf') => {
    setDownloading(format);
    try {
      await apiDownload(`/movimientos/export?format=${format}&${query(false)}`, `movimientos.${format}`);
      notify(`Historial descargado en ${format.toUpperCase()}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo descargar el historial.');
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900">Historial de Movimientos</h2>
            <span className="rounded-full border border-highlight/65 bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
              {total} registros
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Auditoría centralizada con IP, dispositivo, filtros y retención del servidor.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void download('pdf')}
            disabled={downloading !== ''}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading === 'pdf' ? 'Generando...' : 'PDF'}
          </button>
          <button
            type="button"
            onClick={() => void download('csv')}
            disabled={downloading !== ''}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading === 'csv' ? 'Generando...' : 'CSV'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Actualizar historial"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 md:grid-cols-[1fr_170px_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Usuario, acción, SKU, detalle..."
              aria-label="Buscar movimientos"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs focus:border-brand focus:outline-none"
            />
          </div>
          <select
            value={module}
            onChange={(event) => setModule(event.target.value as ModuloFiltro)}
            aria-label="Filtrar por módulo"
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-brand focus:outline-none"
          >
            {MODULOS.map((item) => <option key={item} value={item}>{item === 'Todos' ? 'Todos los módulos' : item}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className="shrink-0">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                {['Fecha', 'Usuario', 'Módulo', 'Acción', 'Elemento', 'Detalle', 'IP / dispositivo'].map((label) => (
                  <th key={label} className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    {loading ? 'Cargando movimientos...' : 'No se encontraron movimientos con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatter.format(new Date(item.fecha))}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{item.usuario}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${item.modulo === 'Configuración' ? 'bg-slate-100 text-slate-600' : 'bg-brand-soft text-brand'}`}>
                      {item.modulo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.accion}</td>
                  <td className="px-4 py-3 font-mono font-bold text-brand">{item.elemento}</td>
                  <td className="min-w-72 px-4 py-3 text-slate-600">{item.detalle}</td>
                  <td className="max-w-56 px-4 py-3 text-[10px] text-slate-400">
                    <span className="block">{item.ip || '—'}</span>
                    <span className="block truncate" title={item.dispositivo}>{item.dispositivo || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-slate-600">{total} movimientos</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:opacity-40">Anterior</button>
            <span className="font-semibold text-slate-600">{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:opacity-40">Siguiente</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
