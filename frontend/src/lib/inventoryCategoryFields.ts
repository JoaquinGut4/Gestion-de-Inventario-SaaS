import type { InventarioCategoria } from '@/types';

/** Categorías base del inventario: no se pueden eliminar. */
export const CATEGORIAS_PRINCIPALES = [
  'laptops',
  'computadoras',
  'monitores',
  'tablets',
  'televisores',
  'impresoras',
  'proyectores',
] as const;

export function esCategoriaPrincipal(id: string): boolean {
  return (CATEGORIAS_PRINCIPALES as readonly string[]).includes(id);
}

/** Campos comunes que una categoría puede incluir o excluir. */
export const CAMPOS_BASE_OPCIONALES = [
  { key: 'foto', label: 'Foto del producto' },
  { key: 'marca', label: 'Marca' },
  { key: 'descripcion', label: 'Descripción del equipo' },
  { key: 'numeroSerial', label: 'Número serial' },
  { key: 'fechaCompra', label: 'Fecha de compra' },
  { key: 'facturaGuiaCompra', label: 'Factura / Guía de compra' },
  { key: 'precio', label: 'Precio de compra' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'estado', label: 'Estado' },
  { key: 'observaciones', label: 'Observaciones' },
] as const;

export type CampoBaseOpcional = (typeof CAMPOS_BASE_OPCIONALES)[number]['key'];

export const CAMPOS_BASE_OPCIONALES_KEYS: CampoBaseOpcional[] = CAMPOS_BASE_OPCIONALES.map(
  (campo) => campo.key,
);

/**
 * Devuelve los campos comunes habilitados para una categoría.
 * Las categorías antiguas sin `camposBase` mantienen todos los campos.
 */
export function camposBaseHabilitados(categoria?: InventarioCategoria | null): CampoBaseOpcional[] {
  if (!categoria?.camposBase) return [...CAMPOS_BASE_OPCIONALES_KEYS];
  return CAMPOS_BASE_OPCIONALES_KEYS.filter((key) => categoria.camposBase?.includes(key));
}
