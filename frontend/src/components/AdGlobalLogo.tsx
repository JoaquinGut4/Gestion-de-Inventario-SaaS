import type { CSSProperties, FC } from 'react';
import logo from '@/assets/logo/adglobal-logo.png';

interface AdGlobalLogoProps {
  className?: string;
  variant?: 'brand' | 'white' | 'dark';
  height?: number;
}

const variantFilters: Record<NonNullable<AdGlobalLogoProps['variant']>, CSSProperties['filter']> = {
  brand:
    'brightness(0) saturate(100%) invert(34%) sepia(18%) saturate(2026%) hue-rotate(171deg) brightness(89%) contrast(91%)',
  white: 'none',
  dark: 'brightness(0) saturate(100%) invert(10%) sepia(26%) saturate(1700%) hue-rotate(178deg) brightness(94%) contrast(94%)',
};

/** Logotipo oficial compartido con la web pública. */
export const AdGlobalLogo: FC<AdGlobalLogoProps> = ({
  className = '',
  variant = 'brand',
  height = 36,
}) => (
  <img
    src={logo}
    alt="AD GLOBAL"
    width={2200}
    height={512}
    decoding="async"
    draggable={false}
    className={`block w-auto select-none ${className}`}
    style={{ height: `${height}px`, filter: variantFilters[variant] }}
  />
);
