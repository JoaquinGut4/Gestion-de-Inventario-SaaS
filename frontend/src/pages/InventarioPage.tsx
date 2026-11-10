import { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Building2,
  Check,
  ChevronDown,
  KeyRound,
  Laptop,
  Layers,
  LockKeyhole,
  MapPin,
  Monitor,
  Package,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  Tablet,
  Trash2,
  Tv,
  Warehouse,
  Wrench,
} from 'lucide-react';
import { InventoryModal } from '@/components/modals/InventoryModal';
import { InventoryScannerModal } from '@/components/modals/InventoryScannerModal';
import { Modal } from '@/components/ui/Modal';
import { esEstadoInmutable } from '@/lib/inventoryStates';
import { camposBaseHabilitados, esCategoriaPrincipal } from '@/lib/inventoryCategoryFields';
import type { CampoBaseOpcional } from '@/lib/inventoryCategoryFields';
import type {
  InventarioCategoria,
  InventarioCategoriaBaseId,
  InventarioCategoriaId,
  InventarioRegistro,
} from '@/types';

interface InventarioPageProps {
  estadoActivo: string;
  onEstadoChange: (estado: string) => void;
  registrosInventario: InventarioRegistro[];
  /** Totales por ubicación de todo el inventario (no solo la página actual). */
  conteoUbicaciones: Array<{ ubicacion: string; total: number; disponibles: number }>;
  categoriaActiva: InventarioCategoriaId | 'all';
  ubicacionActiva: UbicacionFiltro;
  pagina: number;
  paginas: number;
  totalRegistros: number;
  onCategoriaChange: (categoriaId: InventarioCategoriaId | 'all') => void;
  onUbicacionChange: (ubicacion: UbicacionFiltro) => void;
  onPaginaChange: (pagina: number) => void;
  onRefresh: () => void;
  estadosInventario: string[];
  categoriasPersonalizadas: InventarioCategoria[];
  onAgregarCategoria: (categoria: InventarioCategoria) => void;
  onEliminarCategoria: (categoriaId: InventarioCategoriaId) => void;
  onAgregarEstado: (estado: string) => void;
  onRenombrarEstado: (anterior: string, nuevo: string) => void;
  onEliminarEstado: (estado: string) => void;
  onAgregarRegistro: (registro: InventarioRegistro) => void;
  onActualizarRegistro: (registro: InventarioRegistro) => void;
  onEliminarRegistro: (registro: InventarioRegistro) => void;
}

type CampoInventario = keyof InventarioRegistro;
type CampoInventarioTabla = CampoInventario | `custom:${string}`;

interface ColumnaInventario {
  key: CampoInventarioTabla;
  label: string;
  width?: string;
}

const COLUMNAS_COMUNES: ColumnaInventario[] = [
  { key: 'sku', label: 'SKU', width: 'min-w-28' },
  { key: 'qr', label: 'Código QR', width: 'min-w-32' },
  { key: 'foto', label: 'Foto', width: 'min-w-24' },
  { key: 'categoria', label: 'Categoría', width: 'min-w-24' },
  { key: 'ubicacion', label: 'Ubicación', width: 'min-w-28' },
];

const COLUMNAS_COMPRA: ColumnaInventario[] = [
  { key: 'fechaCompra', label: 'Fecha de compra', width: 'min-w-32' },
  { key: 'facturaGuiaCompra', label: 'Factura/Guía compra', width: 'min-w-40' },
  { key: 'precio', label: 'Precio', width: 'min-w-28' },
  { key: 'proveedor', label: 'Proveedor', width: 'min-w-36' },
];

const COLUMNAS_CIERRE: ColumnaInventario[] = [
  { key: 'estado', label: 'Estado', width: 'min-w-32' },
  { key: 'observaciones', label: 'Observaciones', width: 'min-w-56' },
];

const COLUMNAS_POR_CATEGORIA: Record<InventarioCategoriaBaseId, ColumnaInventario[]> = {
  laptops: [
    ...COLUMNAS_COMUNES,
    { key: 'marca', label: 'Marca' },
    { key: 'descripcion', label: 'Descripción del equipo', width: 'min-w-52' },
    { key: 'numeroSerial', label: 'Número serial', width: 'min-w-36' },
    { key: 'procesador', label: 'Procesador', width: 'min-w-36' },
    { key: 'ghz', label: 'GHz' },
    { key: 'generacion', label: 'Generación' },
    { key: 'pantalla', label: 'Pantalla' },
    { key: 'memoriaRam', label: 'Memoria RAM' },
    { key: 'memoriaInterna', label: 'Memoria interna' },
    { key: 'tipoMemoriaInterna', label: 'Tipo de memoria interna', width: 'min-w-44' },
    ...COLUMNAS_COMPRA,
    ...COLUMNAS_CIERRE,
  ],
  computadoras: [
    ...COLUMNAS_COMUNES,
    { key: 'marca', label: 'Marca' },
    { key: 'descripcion', label: 'Descripción del equipo', width: 'min-w-52' },
    { key: 'numeroSerial', label: 'Número serial', width: 'min-w-36' },
    { key: 'procesador', label: 'Procesador', width: 'min-w-36' },
    { key: 'ghz', label: 'GHz' },
    { key: 'generacion', label: 'Generación' },
    { key: 'memoriaRam', label: 'Memoria RAM' },
    { key: 'memoriaInterna', label: 'Memoria interna' },
    { key: 'tipoMemoriaInterna', label: 'Tipo de memoria interna', width: 'min-w-44' },
    ...COLUMNAS_COMPRA,
    ...COLUMNAS_CIERRE,
  ],
  monitores: [
    ...COLUMNAS_COMUNES,
    { key: 'marca', label: 'Marca' },
    { key: 'descripcion', label: 'Descripción del equipo', width: 'min-w-52' },
    { key: 'numeroSerial', label: 'Número serial', width: 'min-w-36' },
    { key: 'pantalla', label: 'Pantalla' },
    ...COLUMNAS_COMPRA,
    { key: 'alquiler', label: 'Alquiler' },
    ...COLUMNAS_CIERRE,
  ],
  tablets: [
    ...COLUMNAS_COMUNES,
    { key: 'marca', label: 'Marca' },
    { key: 'descripcion', label: 'Descripción del equipo', width: 'min-w-52' },
    { key: 'numeroSerial', label: 'Núm. serial', width: 'min-w-36' },
    { key: 'procesador', label: 'Procesador', width: 'min-w-40' },
    { key: 'generacion', label: 'Generación' },
    { key: 'pantalla', label: 'Pantalla' },
    { key: 'memoriaRam', label: 'Memoria RAM' },
    { key: 'memoriaInterna', label: 'Memoria interna' },
    ...COLUMNAS_COMPRA,
    ...COLUMNAS_CIERRE,
  ],
  televisores: [
    ...COLUMNAS_COMUNES,
    { key: 'marca', label: 'Marca' },
    { key: 'descripcion', label: 'Descripción del equipo', width: 'min-w-52' },
    { key: 'numeroSerial', label: 'Núm. serial', width: 'min-w-36' },
    { key: 'modelo', label: 'Modelo', width: 'min-w-32' },
    { key: 'pantalla', label: 'Pantalla' },
    ...COLUMNAS_COMPRA,
    ...COLUMNAS_CIERRE,
  ],
  impresoras: [
    ...COLUMNAS_COMUNES,
    { key: 'marca', label: 'Marca' },
    { key: 'descripcion', label: 'Descripción del equipo', width: 'min-w-52' },
    { key: 'numeroSerial', label: 'Núm. serial', width: 'min-w-36' },
    { key: 'modelo', label: 'Modelo', width: 'min-w-32' },
    ...COLUMNAS_COMPRA,
    ...COLUMNAS_CIERRE,
  ],
  proyectores: [
    ...COLUMNAS_COMUNES,
    { key: 'item', label: 'Item' },
    { key: 'marca', label: 'Marca' },
    { key: 'descripcion', label: 'Descripción del equipo', width: 'min-w-52' },
    { key: 'numeroSerial', label: 'Núm. serial', width: 'min-w-36' },
    { key: 'modelo', label: 'Modelo', width: 'min-w-32' },
    ...COLUMNAS_COMPRA,
    ...COLUMNAS_CIERRE,
  ],
};

const COLUMNAS_IDENTIDAD: ColumnaInventario[] = [
  { key: 'marca', label: 'Marca' },
  { key: 'descripcion', label: 'Descripción del equipo', width: 'min-w-52' },
  { key: 'numeroSerial', label: 'Número serial', width: 'min-w-36' },
];

function obtenerColumnas(
  categoriaId: InventarioCategoriaId,
  categoriasPersonalizadas: InventarioCategoria[] = [],
) {
  const columnasBase = COLUMNAS_POR_CATEGORIA[categoriaId as InventarioCategoriaBaseId];
  if (columnasBase) return columnasBase;

  const categoria = categoriasPersonalizadas.find((item) => item.id === categoriaId);
  const habilitados = new Set<CampoBaseOpcional>(camposBaseHabilitados(categoria));
  const columnasPersonalizadas: ColumnaInventario[] = (categoria?.camposPersonalizados ?? []).map(
    (field) => ({ key: `custom:${field.id}`, label: field.label, width: 'min-w-32' }),
  );

  return [
    ...COLUMNAS_COMUNES.filter(
      (columna) =>
        columna.key === 'sku' ||
        columna.key === 'qr' ||
        columna.key === 'categoria' ||
        columna.key === 'ubicacion' ||
        habilitados.has(columna.key as CampoBaseOpcional),
    ),
    ...COLUMNAS_IDENTIDAD.filter((columna) => habilitados.has(columna.key as CampoBaseOpcional)),
    ...columnasPersonalizadas,
    ...COLUMNAS_COMPRA.filter((columna) => habilitados.has(columna.key as CampoBaseOpcional)),
    ...COLUMNAS_CIERRE.filter((columna) => habilitados.has(columna.key as CampoBaseOpcional)),
  ];
}

const CATEGORIAS_BASE: Array<InventarioCategoria & { icon: typeof Laptop }> = [
  { id: 'laptops', label: 'Laptops', codigo: 1, icon: Laptop },
  { id: 'computadoras', label: 'Computadoras', codigo: 2, icon: Package },
  { id: 'monitores', label: 'Monitores', codigo: 3, icon: Monitor },
  { id: 'tablets', label: 'Tablets', codigo: 4, icon: Tablet },
  { id: 'televisores', label: 'Televisores', codigo: 5, icon: Tv },
  { id: 'impresoras', label: 'Impresoras', codigo: 6, icon: Printer },
  { id: 'proyectores', label: 'Proyectores', codigo: 7, icon: Monitor },
];

const ESTADOS_BASE = [
  { id: 'all', label: 'Todos los estados' },
] as const;

export type UbicacionFiltro = 'all' | 'almacen-1' | 'almacen-2' | 'almacen-3' | 'taller' | 'alquilado';

const UBICACIONES: Array<{
  id: UbicacionFiltro;
  label: string;
  value?: string;
  icon: typeof Layers;
}> = [
  { id: 'all', label: 'Todas', icon: Layers },
  { id: 'almacen-1', label: 'Almacén 1', value: 'Almacén 1', icon: Building2 },
  { id: 'almacen-2', label: 'Almacén 2', value: 'Almacén 2', icon: Warehouse },
  { id: 'almacen-3', label: 'Almacén 3', value: 'Almacén 3', icon: MapPin },
  { id: 'taller', label: 'Taller', value: 'Taller', icon: Wrench },
  { id: 'alquilado', label: 'Alquilado', value: 'Alquilado', icon: KeyRound },
];

/** Convierte el id interno del filtro al valor que guarda la base de datos. */
export function valorUbicacion(ubicacion: UbicacionFiltro): string {
  return UBICACIONES.find((item) => item.id === ubicacion)?.value ?? '';
}



const precioFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

function normalizarBusqueda(value: unknown) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Un equipo vinculado a un pedido activo no puede editarse ni eliminarse. */
function estaEnPedidoActivo(registro: InventarioRegistro): boolean {
  return Boolean(registro.pedidoActivo);
}

/** Un equipo vendido se conserva como historial, pero ya no pertenece al inventario. */
function estaVendido(registro: InventarioRegistro): boolean {
  return normalizarBusqueda(registro.estado ?? '') === 'venta';
}

/**
 * Tabla resumen de 9 columnas: Estado en la 8.ª y Ubicación en la 9.ª.
 * Se conservan las primeras columnas propias de cada categoría.
 */
function columnasResumen(columnas: ColumnaInventario[]): ColumnaInventario[] {
  const estado = columnas.find((columna) => columna.key === 'estado')
    ?? { key: 'estado' as CampoInventarioTabla, label: 'Estado', width: 'min-w-32' };
  const ubicacion = columnas.find((columna) => columna.key === 'ubicacion')
    ?? { key: 'ubicacion' as CampoInventarioTabla, label: 'Ubicación', width: 'min-w-28' };
  const resto = columnas.filter(
    (columna) => columna.key !== 'estado' && columna.key !== 'ubicacion',
  );
  return [...resto.slice(0, 7), estado, ubicacion];
}

function UbicacionBadge({ ubicacion }: { ubicacion: string }) {
  const normalizado = ubicacion.toLowerCase();
  const tone = !ubicacion
    ? 'bg-slate-100 text-slate-500 border-slate-200'
    : normalizado.startsWith('cliente') || normalizado.includes('alquilado')
      ? 'bg-brand-soft text-brand border-highlight/65'
      : normalizado.includes('taller')
        ? 'bg-warning/10 text-warning border-warning/30'
        : 'bg-success/10 text-success border-success/30';

  return (
    <span
      title={ubicacion || 'Sin ubicación'}
      className={`inline-flex max-w-full truncate whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}
    >
      {ubicacion || '—'}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const normalizado = estado.toLowerCase();
  const tone = normalizado.includes('alquiler')
    ? 'bg-brand-soft text-brand border-highlight/65'
    : normalizado.includes('reparación') || normalizado.includes('taller') || normalizado.includes('diagnóstico') || normalizado.includes('reemplazo') || normalizado.includes('revisar')
      ? 'bg-warning/10 text-warning border-warning/30'
      : 'bg-success/10 text-success border-success/30';

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {estado}
    </span>
  );
}

function nombreCategoria(
  registro: InventarioRegistro,
  categoriasPersonalizadas: InventarioCategoria[],
): string {
  const base = CATEGORIAS_BASE.find((item) => item.id === registro.categoriaId);
  const personalizada = categoriasPersonalizadas.find((item) => item.id === registro.categoriaId);
  return base?.label ?? personalizada?.label ?? `Categoría ${registro.categoria}`;
}

function valorCelda(
  registro: InventarioRegistro,
  campo: CampoInventarioTabla,
  detail = false,
  categoriaNombre?: string,
) {
  if (campo.startsWith('custom:')) {
    return registro.especificacionesPersonalizadas?.[campo.replace('custom:', '')] || '—';
  }
  const campoBase = campo as CampoInventario;
  if (campoBase === 'foto') {
    return registro.foto ? (
      <img
        src={registro.foto}
        alt={`Foto de ${registro.descripcion}`}
        className={detail ? 'max-h-64 max-w-full rounded-xl object-contain' : 'h-8 w-10 rounded-md object-cover'}
      />
    ) : (
      <span className="text-slate-400">Sin foto</span>
    );
  }
  if (campoBase === 'precio') return precioFormatter.format(registro.precio);
  if (campoBase === 'ubicacion') return <UbicacionBadge ubicacion={registro.ubicacion} />;
  if (campoBase === 'estado') return <EstadoBadge estado={registro.estado} />;
  if (campoBase === 'categoria') return categoriaNombre ?? `Categoría ${registro.categoria}`;
  const value = registro[campoBase];
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function DetallesInventario({
  registro,
  categoriasPersonalizadas,
}: {
  registro: InventarioRegistro;
  categoriasPersonalizadas: InventarioCategoria[];
}) {
  const columnas = obtenerColumnas(registro.categoriaId, categoriasPersonalizadas);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80 p-4 sm:p-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="w-56 px-4 py-3">Campo</th>
              <th className="px-4 py-3">Información</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {columnas.map((columna) => (
              <tr key={columna.key} className="align-top hover:bg-slate-50/70">
                <th scope="row" className="w-56 bg-slate-50/50 px-4 py-3 font-bold text-slate-500">
                  {columna.label}
                </th>
                <td className="px-4 py-3 leading-relaxed text-slate-700">
                  {valorCelda(
                    registro,
                    columna.key,
                    true,
                    nombreCategoria(registro, categoriasPersonalizadas),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InventarioPage({
  estadoActivo,
  onEstadoChange,
  registrosInventario,
  conteoUbicaciones,
  categoriaActiva,
  ubicacionActiva,
  pagina,
  paginas,
  totalRegistros,
  onCategoriaChange,
  onUbicacionChange,
  onPaginaChange,
  onRefresh,
  estadosInventario,
  categoriasPersonalizadas,
  onAgregarCategoria,
  onEliminarCategoria,
  onAgregarRegistro,
  onActualizarRegistro,
  onEliminarRegistro,
}: InventarioPageProps) {
  const [search, setSearch] = useState('');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<InventarioRegistro | null>(null);
  const [selectedRegistro, setSelectedRegistro] = useState<InventarioRegistro | null>(null);
  const categorias = [
    ...CATEGORIAS_BASE,
    ...categoriasPersonalizadas.map((item) => ({ ...item, icon: Package })),
  ];
  const estadosRegistro = estadosInventario.filter(
    (estado) => normalizarBusqueda(estado) !== 'taller',
  );
  const filtrosEstados = estadosInventario.map((estado) => ({
    id: `custom:${estado}`,
    label: estado,
  }));
  const filtrosEstado = [...ESTADOS_BASE, ...filtrosEstados];
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const todasLasCategorias = categoriaActiva === 'all';
  const categoria = categorias.find((item) => item.id === categoriaActiva) ?? categorias[0];
  const CategoriaIcon = todasLasCategorias ? Layers : categoria.icon;
  const columnas = todasLasCategorias ? [] : obtenerColumnas(categoriaActiva, categoriasPersonalizadas);
  const terminosBusqueda = normalizarBusqueda(search).split(/\s+/).filter(Boolean);
  const isGlobalSearch = terminosBusqueda.length > 0;
  const columnasGlobales: ColumnaInventario[] = [
    { key: 'sku', label: 'SKU' },
    { key: 'qr', label: 'Código QR' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'ubicacion', label: 'Ubicación' },
    { key: 'descripcion', label: 'Descripción del equipo' },
    { key: 'marca', label: 'Marca' },
    { key: 'numeroSerial', label: 'Número serial' },
    { key: 'estado', label: 'Estado' },
    { key: 'proveedor', label: 'Proveedor' },
  ];
  // Estado ocupa siempre la 8.ª columna y Ubicación la 9.ª.
  const columnasVisibles = isGlobalSearch || todasLasCategorias
    ? columnasResumen(columnasGlobales)
    : columnasResumen(columnas);

  const registros = registrosInventario.filter((registro) => {
    if (!isGlobalSearch) return true;

    const columnasRegistro = obtenerColumnas(registro.categoriaId, categoriasPersonalizadas);
    const contenido = normalizarBusqueda([
      ...Object.values(registro),
      ...Object.values(registro.especificacionesPersonalizadas ?? {}),
      ...columnasRegistro.map((columna) => columna.label),
      nombreCategoria(registro, categoriasPersonalizadas),
      precioFormatter.format(registro.precio),
    ].join(' '));

    return terminosBusqueda.every((termino) => contenido.includes(termino));
  });
  const estadoLabel = filtrosEstado.find((item) => item.id === estadoActivo)?.label ?? 'Estados';
  const ubicacionActual = UBICACIONES.find((item) => item.id === ubicacionActiva) ?? UBICACIONES[0];
  const totalGeneralInventario = conteoUbicaciones.reduce((total, item) => total + item.total, 0);
  const disponiblesGeneralInventario = conteoUbicaciones.reduce((total, item) => total + item.disponibles, 0);
  const resumenUbicacion = (ubicacion: UbicacionFiltro) => {
    if (ubicacion === 'all') {
      return { total: totalGeneralInventario, disponibles: disponiblesGeneralInventario };
    }
    const option = UBICACIONES.find((item) => item.id === ubicacion);
    const target = normalizarBusqueda(option?.value ?? '');
    const match = conteoUbicaciones.find((item) => normalizarBusqueda(item.ubicacion) === target);
    return { total: match?.total ?? 0, disponibles: match?.disponibles ?? 0 };
  };
  const cantidadUbicacion = (ubicacion: UbicacionFiltro) => resumenUbicacion(ubicacion).total;

  const eliminarCategoria = (categoriaItem: InventarioCategoria) => {
    if (esCategoriaPrincipal(categoriaItem.id)) return;

    const cantidad = registrosInventario.filter(
      (registro) => registro.categoriaId === categoriaItem.id,
    ).length;
    if (cantidad > 0) {
      window.alert(
        `No se puede eliminar "${categoriaItem.label}" porque tiene ${cantidad} ${
          cantidad === 1 ? 'producto registrado' : 'productos registrados'
        }. Cambia esos productos a otra categoría primero.`,
      );
      return;
    }

    if (!window.confirm(`¿Eliminar la categoría "${categoriaItem.label}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    onEliminarCategoria(categoriaItem.id);
    if (categoriaActiva === categoriaItem.id) {
      onCategoriaChange('all');
      onEstadoChange('all');
    }
    setIsCategoryMenuOpen(false);
  };

  const renderFiltroEstado = (item: { id: string; label: string }) => {
    const active = estadoActivo === item.id;
    const protegido = esEstadoInmutable(item.label);
    return (
      <div key={item.id} className="flex items-center gap-1">
        <button
          type="button"
          role="menuitemradio"
          aria-checked={active}
          title={active ? 'Quitar filtro y ver todos' : `Filtrar por ${item.label}`}
          onClick={() => {
            onEstadoChange(active ? 'all' : item.id);
            setIsStatusMenuOpen(false);
          }}
          className={`flex flex-1 cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-[background-color,border-color,transform] active:scale-[.98] ${
            active
              ? 'border-brand bg-brand font-bold text-white shadow-xs'
              : 'border-slate-200/80 bg-slate-50/80 font-semibold text-slate-700 hover:border-brand/25 hover:bg-brand-soft/55'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-white/15 text-highlight' : 'bg-white text-brand'}`}>
              {protegido ? <LockKeyhole className="h-3.5 w-3.5" /> : <Boxes className="h-3.5 w-3.5" />}
            </span>
            <span>
              <span className="block">{item.label}</span>
              <span className={`mt-0.5 block text-[9px] font-medium ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                {protegido ? 'Estado operativo protegido' : 'Estado personalizado'}
              </span>
            </span>
          </span>
          {active && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand"><Check className="h-3 w-3 stroke-[3]" /></span>}
        </button>
      </div>
    );
  };

  const eliminarProducto = (registro: InventarioRegistro) => {
    const confirmed = window.confirm(
      `¿Eliminar el producto ${registro.sku} del inventario? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    onEliminarRegistro(registro);
    if (selectedRegistro?.id === registro.id) setSelectedRegistro(null);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!categoryMenuRef.current?.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Control de Inventario de Equipos
              </h2>
              <span className="rounded-full border border-highlight/65 bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
                {totalRegistros} equipos registrados
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Fichas técnicas y distribución operativa por categoría de activo
            </p>
          </div>

          <div className="flex gap-2">
          <button type="button" onClick={onRefresh} aria-label="Actualizar inventario" title="Actualizar inventario" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => setIsScannerOpen(true)} aria-label="Escanear código QR" className="inline-flex h-11 w-11 shrink-0 touch-manipulation select-none items-center justify-center gap-1.5 rounded-xl border border-highlight/65 bg-brand-soft text-xs font-bold text-brand hover:bg-highlight/25 active:scale-[.98] sm:w-auto sm:px-3.5"><ScanLine className="h-4 w-4" /><span className="hidden sm:inline">Escanear QR</span></button>
          <button
            type="button"
            onClick={() => {
              setEditingRegistro(null);
              setIsInventoryModalOpen(true);
            }}
            className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-brand-deep"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar</span>
          </button>
          </div>
        </div>
      </div>

      <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Layers className="h-4 w-4" /></span>
            <div><h3 className="text-sm font-extrabold text-ink">Filtros de inventario</h3><p className="text-[10px] text-slate-500">Refina la vista de equipos registrados</p></div>
          </div>
          <span className="hidden rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[9px] font-bold text-slate-500 sm:inline-flex">{registros.length} visibles</span>
        </div>

        <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h3 className="text-sm font-extrabold text-ink">
              {ubicacionActual.id === 'all'
                ? 'Consolidado de almacenes y taller'
                : ubicacionActual.id === 'taller'
                  ? 'Taller · equipos en servicio técnico'
                  : ubicacionActual.id === 'alquilado'
                    ? 'Alquilado · equipos fuera de almacén'
                    : `${ubicacionActual.label} · equipos almacenados`}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              La ubicación se administra de forma independiente al estado operativo.
            </p>
          </div>

          <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-300/60 bg-slate-200/75 p-1 shadow-inner [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-max items-center" role="radiogroup" aria-label="Filtrar inventario por ubicación">
              {UBICACIONES.map((option) => {
                const Icon = option.icon;
                const active = ubicacionActiva === option.id;
                const count = cantidadUbicacion(option.id);
                const disponibles = resumenUbicacion(option.id).disponibles;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={`${option.label}: ${count} ${count === 1 ? 'producto' : 'productos'} en total · ${disponibles} disponibles`}
                    onClick={() => onUbicacionChange(option.id)}
                    className={`relative z-10 flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[.97] ${
                      active
                        ? 'border border-slate-200/90 bg-white font-bold text-brand shadow-[0_2px_12px_rgba(20,38,74,.14)]'
                        : 'border border-transparent font-semibold text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-brand' : 'text-slate-500'}`} />
                    <span>{option.label}</span>
                    <span className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] tabular-nums ${active ? 'bg-brand-soft text-brand' : 'bg-slate-300/70 text-slate-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <div className="contents">
            <div ref={categoryMenuRef} className="relative order-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryMenuOpen((current) => !current);
                  setIsStatusMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={isCategoryMenuOpen}
                className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors ${
                  isCategoryMenuOpen
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand/50'
                }`}
              >
                <CategoriaIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{todasLasCategorias ? 'Todas las categorías' : categoria.label}</span>
                {!todasLasCategorias && <span className="text-slate-400">#{categoria.codigo}</span>}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${isCategoryMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isCategoryMenuOpen && (
                <div
                  role="menu"
                  className="animate-in fade-in absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_24px_60px_rgba(0,24,48,.18)] backdrop-blur-xl"
                >
                  <div className="mb-3 flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Package className="h-4 w-4" /></span>
                    <div><h4 className="text-xs font-extrabold text-ink">Enfoque de categoría</h4><p className="text-[10px] text-slate-500">Filtra el catálogo técnico</p></div>
                  </div>
                  <div role="group" aria-label="Categorías de inventario" className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={todasLasCategorias}
                      onClick={() => {
                        if (!todasLasCategorias) onCategoriaChange('all');
                        setIsCategoryMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-[background-color,border-color,transform] active:scale-[.98] ${todasLasCategorias ? 'border-brand bg-brand text-white shadow-xs' : 'border-slate-200/80 bg-slate-50/80 text-slate-700 hover:border-brand/25 hover:bg-brand-soft/55'}`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${todasLasCategorias ? 'bg-white/15 text-highlight' : 'bg-white text-brand'}`}><Layers className="h-3.5 w-3.5" /></span>
                        <span><span className="block font-bold">Todas las categorías</span><span className={`mt-0.5 block text-[9px] font-medium ${todasLasCategorias ? 'text-slate-300' : 'text-slate-400'}`}>Vista consolidada</span></span>
                      </span>
                      {todasLasCategorias && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand"><Check className="h-3 w-3 stroke-[3]" /></span>}
                    </button>
                    {categorias.map((item) => {
                      const Icon = item.icon;
                      const active = categoriaActiva === item.id;
                      const eliminable = !esCategoriaPrincipal(item.id);
                      return (
                        <div key={item.id} className={`flex items-center gap-1 rounded-xl border transition-[background-color,border-color,transform] active:scale-[.98] ${active ? 'border-brand bg-brand text-white shadow-xs' : 'border-slate-200/80 bg-slate-50/80 text-slate-700 hover:border-brand/25 hover:bg-brand-soft/55'}`}>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => {
                              if (!active) onCategoriaChange(item.id);
                              setIsCategoryMenuOpen(false);
                            }}
                            className="flex min-w-0 flex-1 items-center justify-between px-3 py-2.5 text-left text-xs"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/15 text-highlight' : 'bg-white text-brand'}`}><Icon className="h-3.5 w-3.5" /></span>
                              <span className="min-w-0"><span className="block truncate font-bold">{item.label}</span><span className={`mt-0.5 block font-mono text-[9px] font-medium ${active ? 'text-slate-300' : 'text-slate-400'}`}>Código #{item.codigo}</span></span>
                            </span>
                            {active && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand"><Check className="h-3 w-3 stroke-[3]" /></span>}
                          </button>
                          {eliminable && !active && (
                            <button type="button" onClick={() => eliminarCategoria(item)} aria-label={`Eliminar categoría ${item.label}`} title={`Eliminar categoría ${item.label}`} className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-danger/10 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                    <span className="text-slate-400">{categorias.length} categorías</span>
                    <button type="button" onClick={() => setIsCategoryMenuOpen(false)} className="min-h-11 rounded-xl bg-brand px-3 font-bold text-white hover:bg-brand-deep">Listo</button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative order-1 min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="SKU, QR, columna, categoría, serie, proveedor..."
                aria-label="Buscar en todo el inventario por valores o nombres de columnas"
                className={`h-11 w-full rounded-xl border pl-9 pr-3 text-xs text-slate-900 focus:border-brand focus:bg-white focus:outline-none ${
                  isGlobalSearch ? 'border-brand bg-white' : 'border-slate-200 bg-slate-50'
                }`}
              />
            </div>
          </div>

          <div ref={statusMenuRef} className="relative order-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsStatusMenuOpen((current) => !current);
                setIsCategoryMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={isStatusMenuOpen}
              className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors ${
                isStatusMenuOpen
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-brand/50'
              }`}
            >
              <span>{estadoLabel}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isStatusMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStatusMenuOpen && (
              <div role="menu" className="animate-in fade-in absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_24px_60px_rgba(0,24,48,.18)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><LockKeyhole className="h-4 w-4" /></span>
                  <div><h4 className="text-xs font-extrabold text-ink">Enfoque de estado</h4><p className="text-[10px] text-slate-500">Estados disponibles para clasificar equipos</p></div>
                </div>
                <div role="group" aria-label="Estados de inventario" className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={estadoActivo === 'all'}
                    onClick={() => {
                      onEstadoChange('all');
                      setIsStatusMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-[background-color,border-color,transform] active:scale-[.98] ${estadoActivo === 'all' ? 'border-brand bg-brand font-bold text-white' : 'border-slate-200/80 bg-slate-50/80 font-semibold text-slate-700 hover:bg-slate-100'}`}
                  >
                    <span className="flex items-center gap-2.5"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${estadoActivo === 'all' ? 'bg-white/15 text-highlight' : 'bg-white text-brand'}`}><Boxes className="h-3.5 w-3.5" /></span><span><span className="block">Todos los estados</span><span className={`mt-0.5 block text-[9px] font-medium ${estadoActivo === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>Sin filtro operativo</span></span></span>
                    {estadoActivo === 'all' && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand"><Check className="h-3 w-3 stroke-[3]" /></span>}
                  </button>
                  {filtrosEstados.map((item) => renderFiltroEstado(item))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                  <span className="text-slate-400">{filtrosEstados.length} estados</span>
                  <button type="button" onClick={() => setIsStatusMenuOpen(false)} className="min-h-11 rounded-xl bg-brand px-3 font-bold text-white hover:bg-brand-deep">Listo</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              {isGlobalSearch || todasLasCategorias ? 'Todas las categorías' : categoria.label}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              isGlobalSearch || todasLasCategorias
                ? 'border border-highlight/65 bg-brand-soft text-brand'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {isGlobalSearch || todasLasCategorias ? 'Vista consolidada' : `Categoría ${categoria.codigo}`}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            {registros.length} {registros.length === 1 ? 'registro visible' : 'registros visibles'}
          </span>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {registros.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              No se encontraron activos con los criterios seleccionados.
            </p>
          ) : registros.map((registro) => {
            const vendido = estaVendido(registro);
            const bloqueado = vendido || estaEnPedidoActivo(registro);
            return (
              <article key={registro.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedRegistro(registro)}
                      className="min-h-11 text-left"
                    >
                      <span className="block font-mono text-sm font-extrabold text-brand">{registro.sku}</span>
                      <span className="mt-1 block line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                        {registro.descripcion || 'Sin descripción'}
                      </span>
                    </button>
                    <p className="mt-1 text-xs text-slate-600">
                      {nombreCategoria(registro, categoriasPersonalizadas)}{registro.marca ? ` · ${registro.marca}` : ''}
                    </p>
                  </div>
                  {registro.foto ? (
                    <img src={registro.foto} alt="" className="h-14 w-16 shrink-0 rounded-xl border border-slate-200 object-cover" />
                  ) : (
                    <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                      <Package className="h-5 w-5" />
                    </span>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="min-w-0">
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Estado</dt>
                    <dd className="mt-1"><EstadoBadge estado={registro.estado} /></dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Ubicación</dt>
                    <dd className="mt-1"><UbicacionBadge ubicacion={registro.ubicacion} /></dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Serial</dt>
                    <dd className="mt-1 truncate font-mono text-slate-700">{registro.numeroSerial || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Código QR</dt>
                    <dd className="mt-1 truncate font-mono text-slate-700">{registro.qr || '—'}</dd>
                  </div>
                </dl>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRegistro(registro)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"
                  >
                    <Package className="h-4 w-4" />
                    Detalle
                  </button>
                  <button
                    type="button"
                    disabled={bloqueado}
                    onClick={() => {
                      setEditingRegistro(registro);
                      setIsInventoryModalOpen(true);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-highlight/65 bg-brand-soft px-2 text-xs font-bold text-brand disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {bloqueado ? <LockKeyhole className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    {vendido ? 'Vendido' : bloqueado ? 'En pedido' : 'Editar'}
                  </button>
                  <button
                    type="button"
                    disabled={bloqueado}
                    onClick={() => eliminarProducto(registro)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-2 text-xs font-bold text-danger disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                </div>
                {bloqueado && (
                  <p className="flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">
                    <LockKeyhole className="h-4 w-4 shrink-0" />
                    {vendido ? 'Producto vendido: ya no pertenece al inventario.' : `Bloqueado por el pedido ${registro.pedidoActivo ?? 'activo'}.`}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs font-semibold text-slate-600 md:flex xl:hidden">
          Desliza horizontalmente para consultar todas las columnas y acciones.
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {columnasVisibles.map((columna, index) => (
                  <th
                    key={columna.key}
                    scope="col"
                    className={`break-words px-2 py-2.5 text-[9px] leading-tight ${
                      index === 0 ? 'sticky left-0 z-10 bg-slate-50 shadow-[1px_0_0_#e2e8f0]' : ''
                    }`}
                    style={{
                      width:
                        columna.key === 'descripcion'
                          ? '17%'
                          : columna.key === 'foto'
                            ? '7%'
                            : '10%',
                    }}
                  >
                    {columna.label}
                  </th>
                ))}
                <th scope="col" className="w-[8%] px-2 py-2.5 text-center text-[9px] leading-tight">
                  Eliminar
                </th>
                <th scope="col" className="w-[8%] px-2 py-2.5 text-center text-[9px] leading-tight">
                  Editar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={columnasVisibles.length + 2} className="px-6 py-12 text-center text-sm text-slate-500">
                    No se encontraron activos con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                registros.map((registro) => {
                  const vendido = estaVendido(registro);
                  const bloqueado = vendido || estaEnPedidoActivo(registro);
                  return (
                  <tr
                    key={registro.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver detalle del activo ${registro.sku}`}
                    onClick={() => setSelectedRegistro(registro)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedRegistro(registro);
                      }
                    }}
                    className="group cursor-pointer hover:bg-brand-soft/30 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                  >
                    {columnasVisibles.map((columna, index) => (
                      <td
                        key={columna.key}
                        className={`break-words px-2 py-2.5 align-top text-[11px] leading-snug ${
                          columna.key === 'ubicacion' ? 'overflow-hidden' : ''
                        } ${
                          index === 0
                            ? 'sticky left-0 z-10 bg-white font-mono font-bold text-brand shadow-[1px_0_0_#f1f5f9] group-hover:bg-brand-soft/30'
                            : ''
                        }`}
                      >
                        {valorCelda(
                          registro,
                          columna.key,
                          false,
                          nombreCategoria(registro, categoriasPersonalizadas),
                        )}
                      </td>
                    ))}
                    <td className="px-1.5 py-2.5 text-center align-top">
                      <button
                        type="button"
                        disabled={bloqueado}
                        onClick={(event) => {
                          event.stopPropagation();
                          eliminarProducto(registro);
                        }}
                        aria-label={`Eliminar producto ${registro.sku}`}
                        title={vendido ? 'No se puede eliminar: el producto fue vendido' : bloqueado ? `No se puede eliminar: pertenece al pedido ${registro.pedidoActivo ?? 'activo'}` : `Eliminar ${registro.sku}`}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2 text-[10px] font-bold text-danger transition-colors hover:border-danger hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-danger/30 disabled:hover:bg-danger/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    </td>
                    <td className="px-1.5 py-2.5 text-center align-top">
                      <button
                        type="button"
                        disabled={bloqueado}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingRegistro(registro);
                          setIsInventoryModalOpen(true);
                        }}
                        aria-label={vendido ? 'Equipo vendido: ya no pertenece al inventario' : bloqueado ? `Equipo bloqueado por el pedido ${registro.pedidoActivo ?? 'activo'}` : `Editar producto ${registro.sku}`}
                        title={vendido ? 'No se puede editar: el producto fue vendido' : bloqueado ? `No se puede editar: pertenece al pedido ${registro.pedidoActivo ?? 'activo'}` : `Editar ${registro.sku}`}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-highlight/65 bg-brand-soft px-2 text-[10px] font-bold text-brand transition-colors hover:border-brand hover:bg-highlight/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-highlight/65 disabled:hover:bg-brand-soft"
                      >
                        {bloqueado ? <LockKeyhole className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        {vendido ? 'Vendido' : bloqueado ? 'En pedido' : 'Editar'}
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center">
          <span className="font-bold text-slate-700">
            {registros.length} {registros.length === 1 ? 'producto mostrado' : 'productos mostrados'}
          </span>
          <span className="hidden sm:inline">en esta página · 10 por página.</span>
          <div className="flex items-center justify-between gap-2 sm:ml-auto sm:justify-end">
            <button type="button" disabled={pagina <= 1} onClick={() => onPaginaChange(pagina - 1)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-bold disabled:opacity-40">Anterior</button>
            <span className="whitespace-nowrap font-semibold">Página {pagina} de {paginas}</span>
            <button type="button" disabled={pagina >= paginas} onClick={() => onPaginaChange(pagina + 1)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-bold disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </section>

      <InventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => {
          setIsInventoryModalOpen(false);
          setEditingRegistro(null);
        }}
        onCreate={(registro) => {
          onAgregarRegistro(registro);
          onCategoriaChange(registro.categoriaId);
          onEstadoChange('all');
          setSearch('');
          setIsInventoryModalOpen(false);
        }}
        editingRegistro={editingRegistro}
        onUpdate={(registro) => {
          onActualizarRegistro(registro);
          onCategoriaChange(registro.categoriaId);
          setEditingRegistro(null);
          setIsInventoryModalOpen(false);
        }}
        categorias={categorias.map(({ id, label, codigo, camposBase, camposPersonalizados }) => ({
          id,
          label,
          codigo,
          camposBase,
          camposPersonalizados,
        }))}
        onCreateCategory={onAgregarCategoria}
        estados={estadosRegistro}
        existingSkus={registrosInventario
          .filter((registro) => registro.id !== editingRegistro?.id)
          .map((registro) => registro.sku)}
        existingQrs={registrosInventario
          .filter((registro) => registro.id !== editingRegistro?.id)
          .map((registro) => registro.qr)}
      />

      <InventoryScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onFound={(registro) => {
          setIsScannerOpen(false);
          setSelectedRegistro(registro);
        }}
      />

      <Modal
        isOpen={selectedRegistro !== null}
        onClose={() => setSelectedRegistro(null)}
        labelledBy="inventory-detail-modal-title"
        title={selectedRegistro ? `Activo ${selectedRegistro.sku}` : 'Detalle del activo'}
        subtitle={selectedRegistro?.descripcion}
        icon={<Package className="h-4 w-4" />}
        headerClass="bg-brand"
        panelClass="max-w-4xl"
      >
        {selectedRegistro && (
          <DetallesInventario
            registro={selectedRegistro}
            categoriasPersonalizadas={categoriasPersonalizadas}
          />
        )}
      </Modal>
    </div>
  );
}
