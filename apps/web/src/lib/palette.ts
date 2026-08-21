import { useEffect, useState } from 'react';

/**
 * Paleta categorica del producto.
 *
 * Los ocho tonos pasan las comprobaciones de accesibilidad en los dos modos:
 * banda de luminosidad, croma minimo, separacion suficiente para daltonismo
 * entre tonos contiguos y contraste >= 3:1 contra la superficie. El orden
 * importa (es el mecanismo de seguridad), asi que se asignan por posicion y
 * nunca se generan tonos nuevos.
 *
 * El par claro/oscuro son los mismos ocho tonos re-escalonados para cada
 * fondo, no dos paletas distintas.
 */
export interface SeriesColor {
  name: string;
  light: string;
  dark: string;
}

export const SERIES: SeriesColor[] = [
  { name: 'Azul', light: '#0b6bcb', dark: '#3d8ee8' },
  { name: 'Naranja', light: '#e8730c', dark: '#d5711f' },
  { name: 'Turquesa', light: '#0e9e8e', dark: '#17a88e' },
  { name: 'Ambar', light: '#b58400', dark: '#b98d00' },
  { name: 'Magenta', light: '#d9539b', dark: '#d55e97' },
  { name: 'Verde', light: '#1e8e3e', dark: '#2c9a4c' },
  { name: 'Violeta', light: '#4b44c4', dark: '#7a72e0' },
  { name: 'Rojo', light: '#d93a30', dark: '#e04a42' },
];

export const PALETTE = SERIES.map((s) => s.light);

const DARK_BY_LIGHT = new Map(SERIES.map((s) => [s.light.toLowerCase(), s.dark]));

/** Traduce un color guardado (siempre en su version clara) al modo actual. */
export function seriesColor(hex: string, isDark: boolean): string {
  if (!isDark) return hex;
  return DARK_BY_LIGHT.get(hex.toLowerCase()) ?? hex;
}

/** Color de la serie por posicion, nunca ciclado mas alla de los ocho. */
export function slotColor(index: number, isDark: boolean): string {
  const slot = SERIES[index % SERIES.length]!;
  return isDark ? slot.dark : slot.light;
}

/** Sigue el tema real del documento, lo cambie quien lo cambie. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark',
  );
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
