import { Boxes } from 'lucide-react';
import type { FC } from 'react';
import { ADMIN_CONFIG } from '@/config/site';

interface BrandLogoProps {
  className?: string;
  variant?: 'brand' | 'white' | 'dark';
  height?: number;
}

const variantClasses = {
  brand: 'text-brand',
  white: 'text-white',
  dark: 'text-slate-900',
} as const;

/** Identidad visual genérica del sistema de inventario. */
export const BrandLogo: FC<BrandLogoProps> = ({
  className = '',
  variant = 'brand',
  height = 36,
}) => (
  <div
    className={`flex select-none items-center gap-2.5 font-extrabold tracking-tight ${variantClasses[variant]} ${className}`}
    style={{ height: `${height}px` }}
    aria-label={ADMIN_CONFIG.name}
  >
    <span className="flex aspect-square h-full items-center justify-center rounded-lg bg-current/10">
      <Boxes className="h-[58%] w-[58%]" aria-hidden="true" />
    </span>
    <span className="whitespace-nowrap text-base">{ADMIN_CONFIG.name}</span>
  </div>
);
