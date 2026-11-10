import type { InventarioCategoria, InventarioRegistro } from '@/types';
import { ADMIN_CONFIG } from '@/config/site';

export interface InventoryStateApi {
  nombre: string;
  inmutable: boolean;
  orden: number;
}

export interface PaginatedApi<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export function inventoryFromApi(item: InventarioRegistro & { alquiler?: boolean | string }): InventarioRegistro {
  const origin = ADMIN_CONFIG.apiUrl.replace(/\/api\/v1\/?$/, '');
  return {
    ...item,
    ubicacion: item.estado === 'Venta' ? (item.ubicacion ?? '') : (item.ubicacion || 'Almacén 1'),
    precio: Number(item.precio) || 0,
    foto: item.foto && !/^(https?:|data:)/i.test(item.foto) ? `${origin}${item.foto.startsWith('/') ? '' : '/'}${item.foto}` : item.foto,
    alquiler:
      typeof item.alquiler === 'boolean'
        ? item.alquiler ? 'Sí' : 'No'
        : item.alquiler,
  };
}

export function inventoryPayload(item: InventarioRegistro): Record<string, unknown> {
  const { id: _id, categoria: _categoria, pedidoActivo: _pedidoActivo, ...payload } = item;
  return {
    ...payload,
    alquiler:
      typeof payload.alquiler === 'string'
        ? /^(sí|si|true|1|yes)$/i.test(payload.alquiler.trim())
        : payload.alquiler,
  };
}

export function categoryPayload(category: InventarioCategoria): Record<string, unknown> {
  return {
    id: category.id,
    label: category.label,
    codigo: category.codigo,
    iconName: 'package',
    camposBase: category.camposBase ?? [],
    camposPersonalizados: category.camposPersonalizados ?? [],
  };
}
