export const ESTADOS_INMUTABLES = ['Disponible', 'Reservado', 'Despachado', 'Alquiler', 'Venta', 'Diagnóstico', 'Reparación', 'Reemplazo requerido', 'Reservado para reemplazo', 'Revisar', 'Baja'] as const;

export function normalizarEstadoInventario(estado: string): string {
  const value = estado.trim();
  // "Vendido" era el nombre anterior del estado asignado al crear una venta.
  if (/^(vendido|venta)$/i.test(value)) return 'Venta';
  return ESTADOS_INMUTABLES.find((fixed) => fixed.toLowerCase() === value.toLowerCase()) ?? estado;
}

export function esEstadoInmutable(estado: string): boolean {
  return ESTADOS_INMUTABLES.some(
    (fixed) => fixed.toLowerCase() === normalizarEstadoInventario(estado).toLowerCase(),
  );
}

export function asegurarEstadosInventario(estados: string[]): string[] {
  const unique: string[] = [];
  for (const raw of [...estados, ...ESTADOS_INMUTABLES]) {
    const value = normalizarEstadoInventario(raw).trim();
    if (value.toLowerCase() === 'taller') continue;
    if (value && !unique.some((state) => state.toLowerCase() === value.toLowerCase())) unique.push(value);
  }
  return unique;
}

export function normalizarEstadosAnteriores(
  estados: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!estados) return estados;
  return Object.fromEntries(
    Object.entries(estados).map(([id, estado]) => [id, normalizarEstadoInventario(estado)]),
  );
}
