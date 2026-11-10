import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LoginScreen } from '@/components/login/LoginScreen';
import { useToast } from '@/context/ToastContext';
import { CATEGORIAS_BASE_TOTAL } from '@/data/inventario';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/api';
import { asegurarEstadosInventario } from '@/lib/inventoryStates';
import {
  categoryPayload,
  inventoryFromApi,
  inventoryPayload,
} from '@/lib/operationsApi';
import type { InventoryStateApi, PaginatedApi } from '@/lib/operationsApi';
import { ConfiguracionPage } from '@/pages/ConfiguracionPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InventarioPage, valorUbicacion } from '@/pages/InventarioPage';
import type { UbicacionFiltro } from '@/pages/InventarioPage';
import { MovimientosPage } from '@/pages/MovimientosPage';
import { ReportesPage } from '@/pages/ReportesPage';
import type {
  AdminSection,
  DashboardResumen,
  InventarioCategoria,
  InventarioRegistro,
} from '@/types';

/** Filas de inventario mostradas por página. */
const INVENTORY_PAGE_SIZE = 10;

interface InventoryLocationCount {
  ubicacion: string;
  total: number;
  disponibles: number;
}

export default function App() {
  const { isAuthenticated, session, authenticate, logout } = useAuth();
  const { notify } = useToast();

  const [activeNav, setActiveNav] = useState<AdminSection>('dashboard');
  const [inventoryState, setInventoryState] = useState<string>('all');
  const [inventario, setInventario] = useState<InventarioRegistro[]>([]);
  const [estadosInventario, setEstadosInventario] = useState<string[]>([]);
  const [inventarioCategorias, setInventarioCategorias] = useState<InventarioCategoria[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResumen | null>(null);
  const [inventoryCategory, setInventoryCategory] = useState<InventarioCategoria['id'] | 'all'>('all');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryLocation, setInventoryLocation] = useState<UbicacionFiltro>('all');
  const [inventoryPages, setInventoryPages] = useState(1);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryLocationCounts, setInventoryLocationCounts] = useState<InventoryLocationCount[]>([]);

  const refreshInventory = useCallback(async (
    page = inventoryPage,
    categoryId = inventoryCategory,
    location = inventoryLocation,
    state = inventoryState,
  ) => {
    const categoryQuery = categoryId === 'all' ? '' : `&category_id=${encodeURIComponent(categoryId)}`;
    const locationQuery = location === 'all'
      ? ''
      : `&ubicacion=${encodeURIComponent(valorUbicacion(location))}`;
    const stateQuery = state === 'all'
      ? ''
      : state.startsWith('custom:')
        ? `&estado=${encodeURIComponent(state.slice('custom:'.length))}`
        : `&filtro=${encodeURIComponent(state)}`;
    const [assets, categories, states, locationCounts] = await Promise.all([
      apiRequest<PaginatedApi<InventarioRegistro>>(
        `/inventario?page=${page}&page_size=${INVENTORY_PAGE_SIZE}${categoryQuery}${locationQuery}${stateQuery}`,
      ),
      apiRequest<InventarioCategoria[]>('/inventario/categorias'),
      apiRequest<InventoryStateApi[]>('/inventario/estados'),
      apiRequest<InventoryLocationCount[]>(
        `/inventario/resumen-ubicaciones?${`${categoryQuery}${stateQuery}`.replace(/^&/, '')}`,
      ),
    ]);
    setInventario(assets.items.map(inventoryFromApi));
    setInventoryLocationCounts(locationCounts);
    setInventoryPage(assets.page);
    setInventoryPages(assets.pages);
    setInventoryTotal(assets.total);
    setInventarioCategorias(categories.filter((category) => category.id.startsWith('custom-')));
    setEstadosInventario(asegurarEstadosInventario(states.map((state) => state.nombre)).filter((state) => state !== 'Taller'));
  }, [inventoryCategory, inventoryLocation, inventoryPage, inventoryState]);

  const refreshDashboard = useCallback(async () => {
    setDashboard(await apiRequest<DashboardResumen>('/dashboard'));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || session.modulos.length === 0) return;
    const tasks: Promise<unknown>[] = [];
    if (activeNav === 'dashboard') tasks.push(refreshDashboard());
    if (activeNav === 'inventario') tasks.push(refreshInventory());
    void Promise.allSettled(tasks).then((results) => {
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') {
        notify(failed.reason instanceof Error ? failed.reason.message : 'No se pudieron cargar los datos operativos.');
      }
    });
  }, [activeNav, isAuthenticated, notify, refreshDashboard, refreshInventory, session.modulos]);

  const navegar = (section: AdminSection) => {
    if (session.modulos.includes(section)) setActiveNav(section);
  };

  useEffect(() => {
    if (!isAuthenticated || session.modulos.includes(activeNav)) return;
    setActiveNav((session.modulos[0] as AdminSection | undefined) ?? 'dashboard');
  }, [activeNav, isAuthenticated, session.modulos]);

  const handleLogout = () => {
    logout();
    setActiveNav('dashboard');
  };

  const persistInventoryPhoto = async (registro: InventarioRegistro): Promise<InventarioRegistro> => {
    if (!registro.foto?.startsWith('data:')) return registro;
    const blob = await (await fetch(registro.foto)).blob();
    const form = new FormData();
    form.append('file', new File([blob], `${registro.sku}.webp`, { type: blob.type || 'image/webp' }));
    const uploaded = await apiRequest<{ url: string }>('/inventario/fotos', { method: 'POST', body: form });
    return { ...registro, foto: uploaded.url };
  };

  const agregarRegistroInventario = async (registro: InventarioRegistro) => {
    try {
      registro = await persistInventoryPhoto(registro);
      const saved = await apiRequest<InventarioRegistro>('/inventario', {
        method: 'POST',
        body: JSON.stringify(inventoryPayload(registro)),
      });
      setInventario((current) => [inventoryFromApi(saved), ...current]);
      await refreshDashboard().catch(() => undefined);
      notify(`Producto ${saved.sku} agregado al inventario.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo agregar el producto.');
      await refreshInventory().catch(() => undefined);
    }
  };

  const actualizarRegistroInventario = async (registro: InventarioRegistro) => {
    try {
      registro = await persistInventoryPhoto(registro);
      const saved = await apiRequest<InventarioRegistro>(`/inventario/${registro.id}`, {
        method: 'PUT',
        body: JSON.stringify(inventoryPayload(registro)),
      });
      setInventario((current) => current.map((item) => item.id === saved.id ? inventoryFromApi(saved) : item));
      await refreshDashboard().catch(() => undefined);
      notify(`Producto ${saved.sku} actualizado.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo actualizar el producto.');
      await refreshInventory().catch(() => undefined);
    }
  };

  const eliminarRegistroInventario = async (registro: InventarioRegistro) => {
    try {
      await apiRequest<void>(`/inventario/${registro.id}`, { method: 'DELETE' });
      setInventario((current) => current.filter((item) => item.id !== registro.id));
      await refreshDashboard().catch(() => undefined);
      notify(`Producto ${registro.sku} eliminado.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo eliminar el producto.');
    }
  };

  const agregarCategoriaInventario = async (categoria: InventarioCategoria) => {
    try {
      const saved = await apiRequest<InventarioCategoria>('/inventario/categorias', {
        method: 'POST',
        body: JSON.stringify(categoryPayload(categoria)),
      });
      setInventarioCategorias((current) => [...current, saved]);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo crear la categoría.');
      await refreshInventory().catch(() => undefined);
    }
  };

  const eliminarCategoriaInventario = async (categoriaId: InventarioCategoria['id']) => {
    try {
      await apiRequest<void>(`/inventario/categorias/${encodeURIComponent(categoriaId)}`, { method: 'DELETE' });
      setInventarioCategorias((current) => current.filter((item) => item.id !== categoriaId));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo eliminar la categoría.');
    }
  };

  const agregarEstadoInventario = async (estado: string) => {
    try {
      await apiRequest('/inventario/estados', { method: 'POST', body: JSON.stringify({ nombre: estado }) });
      await refreshInventory();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo crear el estado.');
    }
  };

  const renombrarEstadoInventario = async (anterior: string, nuevo: string) => {
    try {
      await apiRequest(`/inventario/estados/${encodeURIComponent(anterior)}`, {
        method: 'PATCH',
        body: JSON.stringify({ nombre: nuevo }),
      });
      await refreshInventory();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo renombrar el estado.');
    }
  };

  const eliminarEstadoInventario = async (estado: string) => {
    try {
      await apiRequest<void>(`/inventario/estados/${encodeURIComponent(estado)}`, { method: 'DELETE' });
      await refreshInventory();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo eliminar el estado.');
    }
  };

  if (!isAuthenticated) {
    return <LoginScreen onAuthenticate={authenticate} />;
  }

  const renderPage = () => {
    switch (activeNav) {
      case 'dashboard':
        return <DashboardPage resumen={dashboard} onNavigate={navegar} />;
      case 'inventario':
        return (
          <InventarioPage
            estadoActivo={inventoryState}
            onEstadoChange={(state) => {
              setInventoryState(state);
              setInventoryPage(1);
              void refreshInventory(1, inventoryCategory, inventoryLocation, state);
            }}
            registrosInventario={inventario}
            conteoUbicaciones={inventoryLocationCounts}
            categoriaActiva={inventoryCategory}
            ubicacionActiva={inventoryLocation}
            pagina={inventoryPage}
            paginas={inventoryPages}
            totalRegistros={inventoryTotal}
            onCategoriaChange={(categoryId) => {
              setInventoryCategory(categoryId);
              setInventoryPage(1);
              void refreshInventory(1, categoryId, inventoryLocation);
            }}
            onUbicacionChange={(location) => {
              setInventoryLocation(location);
              setInventoryPage(1);
              void refreshInventory(1, inventoryCategory, location, inventoryState);
            }}
            onPaginaChange={(page) => void refreshInventory(page, inventoryCategory, inventoryLocation, inventoryState)}
            onRefresh={() => void refreshInventory(inventoryPage, inventoryCategory, inventoryLocation, inventoryState)}
            estadosInventario={estadosInventario}
            categoriasPersonalizadas={inventarioCategorias}
            onAgregarCategoria={(categoria) => void agregarCategoriaInventario(categoria)}
            onEliminarCategoria={(categoriaId) => void eliminarCategoriaInventario(categoriaId)}
            onAgregarEstado={(estado) => void agregarEstadoInventario(estado)}
            onRenombrarEstado={(anterior, nuevo) => void renombrarEstadoInventario(anterior, nuevo)}
            onEliminarEstado={(estado) => void eliminarEstadoInventario(estado)}
            onAgregarRegistro={(registro) => void agregarRegistroInventario(registro)}
            onActualizarRegistro={(registro) => void actualizarRegistroInventario(registro)}
            onEliminarRegistro={(registro) => void eliminarRegistroInventario(registro)}
          />
        );
      case 'movimientos':
        return <MovimientosPage />;
      case 'reportes':
        return <ReportesPage />;
      case 'configuracion':
        return <ConfiguracionPage currentUserId={session.id} />;
    }
  };

  return (
    <AdminLayout
      activeNav={activeNav}
      onNavigate={navegar}
      onLogout={handleLogout}
      session={session}
      inventarioCategorias={CATEGORIAS_BASE_TOTAL + inventarioCategorias.length}
    >
      {renderPage()}
    </AdminLayout>
  );
}
