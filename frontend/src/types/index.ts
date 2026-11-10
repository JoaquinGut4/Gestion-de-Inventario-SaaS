/**
 * Tipos compartidos del panel de inventario.
 */

/** Secciones navegables del menú principal del panel. */
export type AdminSection =
  | 'dashboard'
  | 'inventario'
  | 'movimientos'
  | 'reportes'
  | 'configuracion';

export type InventarioCategoriaBaseId =
  | 'laptops'
  | 'computadoras'
  | 'monitores'
  | 'tablets'
  | 'televisores'
  | 'impresoras'
  | 'proyectores';

export type InventarioCategoriaId = InventarioCategoriaBaseId | `custom-${string}`;

export interface InventarioCampoPersonalizado {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export interface InventarioCategoria {
  id: InventarioCategoriaId;
  label: string;
  codigo: number;
  /** Claves de los campos comunes habilitados. Si se omite, se usan todos. */
  camposBase?: string[];
  camposPersonalizados?: InventarioCampoPersonalizado[];
}

export type InventarioUbicacion = 'Almacén 1' | 'Almacén 2' | 'Almacén 3' | 'Taller' | 'Alquilado';

/** Registro individual de un activo. Los campos opcionales dependen de su categoría. */
export interface InventarioRegistro {
  id: string;
  categoriaId: InventarioCategoriaId;
  sku: string;
  qr: string;
  foto: string;
  categoria: number;
  item?: string;
  marca: string;
  descripcion: string;
  numeroSerial: string;
  procesador?: string;
  ghz?: string;
  generacion?: string;
  pantalla?: string;
  memoriaRam?: string;
  memoriaInterna?: string;
  tipoMemoriaInterna?: string;
  modelo?: string;
  fechaCompra: string | null;
  facturaGuiaCompra: string;
  precio: number;
  proveedor: string;
  alquiler?: string;
  ubicacion: string;
  estado: string;
  observaciones: string;
  especificacionesPersonalizadas?: Record<string, string>;
  /** Reservado para integraciones futuras (pedidos / préstamos). */
  pedidoActivo?: string | null;
}

export type MovimientoModulo = 'Inventario' | 'Configuración';
export type MovimientoAccion = 'Creó' | 'Editó' | 'Eliminó' | 'Agregó' | 'Modificó' | 'Guardó';

export interface MovimientoAuditoria {
  id: string;
  fecha: string;
  usuario: string;
  modulo: MovimientoModulo;
  accion: MovimientoAccion;
  elemento: string;
  detalle: string;
  ip?: string;
  dispositivo?: string;
}

export interface DashboardResumen {
  inventarioTotal: number;
  inventarioPorEstado: Record<string, number>;
  inventarioPorUbicacion: Array<{
    ubicacion: InventarioUbicacion;
    total: number;
    disponibles: number;
    alquiler: number;
    mantenimiento: number;
    categorias: Array<{
      categoria: string;
      total: number;
      disponibles: number;
    }>;
  }>;
  categorias: Array<{
    categoria: string;
    total: number;
    disponibles: number;
  }>;
  valorInventario: number;
  movimientosRecientes: MovimientoAuditoria[];
}

export type UsuarioRol = 'Administrador' | 'Operador' | 'Consulta';

export interface UsuarioAdministrador {
  id: string;
  nombre: string;
  email: string;
  usuario: string;
  password?: string;
  rol: UsuarioRol;
  telefono: string;
  superAdmin?: boolean;
  activo: boolean;
  modulos: AdminSection[];
  createdAt: string;
}

/** Filtros rápidos del inventario. */
export type InventarioFiltro = 'all' | 'alquiler' | 'oficina' | 'taller';
