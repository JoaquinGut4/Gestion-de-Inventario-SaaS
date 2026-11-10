import {
  ArrowLeftRight,
  Boxes,
  FileText,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminSection } from '@/types';

export interface NavItem {
  id: AdminSection;
  label: string;
  /** Título mostrado en la barra superior. */
  title: string;
  description: string;
  icon: LucideIcon;
  /** Se conserva la página y sus permisos, pero no se muestra en el menú principal. */
  hidden?: boolean;
}

/** Menú principal del panel administrativo (orden de operación). */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    description: 'Visualizar el estado del inventario y la actividad reciente.',
    icon: LayoutDashboard,
  },
  {
    id: 'inventario',
    label: 'Inventario',
    title: 'Inventario',
    description: 'Administrar equipos, características, cantidades, estados y disponibilidad.',
    icon: Boxes,
  },
  {
    id: 'movimientos',
    label: 'Movimientos',
    title: 'Movimientos',
    description: 'Consultar la auditoría de cambios, usuarios, equipos y fechas.',
    icon: ArrowLeftRight,
  },
  {
    id: 'reportes',
    label: 'Reportes',
    title: 'Reportes',
    description: 'Descargar reportes en PDF del inventario y de los movimientos.',
    icon: FileText,
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    title: 'Configuración',
    description: 'Administrar usuarios, roles, permisos y accesos por módulo.',
    icon: Settings,
  },
];

export const getNavItem = (section: AdminSection): NavItem =>
  NAV_ITEMS.find((item) => item.id === section) ?? NAV_ITEMS[0];
