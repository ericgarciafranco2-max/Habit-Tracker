import type { ISODate, Clock } from './types.js';

export const DAY_MS = 86_400_000;

export const WEEKDAY_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
/** Inicial sin ambiguedad: X para miercoles, como en cualquier horario. */
export const WEEKDAY_INITIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const WEEKDAY_LONG = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];
export const MONTH_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local -> YYYY-MM-DD (sin pasar por UTC, que desplaza el dia). */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function today(now: Date = new Date()): ISODate {
  return toISODate(now);
}

/**
 * El "dia logico": antes de la hora de corte (p.ej. 04:00) seguimos en el dia
 * anterior. Trasnochar no te regala un dia nuevo.
 */
export function logicalToday(cutoff: Clock, now: Date = new Date()): ISODate {
  const [h, m] = cutoff.split(':').map(Number);
  const shifted = new Date(now.getTime());
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (minutesNow < (h ?? 0) * 60 + (m ?? 0)) shifted.setDate(shifted.getDate() - 1);
  return toISODate(shifted);
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = fromISODate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(a).getTime() - fromISODate(b).getTime()) / DAY_MS);
}

export function weekday(date: ISODate): number {
  return fromISODate(date).getDay();
}

/** Lunes como primer dia de la semana. */
export function startOfWeek(date: ISODate): ISODate {
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function endOfWeek(date: ISODate): ISODate {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  const d = fromISODate(date);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

export function rangeDates(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 5000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function monthDates(year: number, month0: number): ISODate[] {
  const total = daysInMonth(year, month0);
  return Array.from({ length: total }, (_, i) => `${year}-${pad(month0 + 1)}-${pad(i + 1)}`);
}

/** Divide un mes en "semanas" de calendario (lunes a domingo). */
export function monthWeeks(year: number, month0: number): ISODate[][] {
  const dates = monthDates(year, month0);
  const weeks: ISODate[][] = [];
  let current: ISODate[] = [];
  for (const date of dates) {
    if (current.length && weekday(date) === 1) {
      weeks.push(current);
      current = [];
    }
    current.push(date);
  }
  if (current.length) weeks.push(current);
  return weeks;
}

export function clockToMinutes(c: Clock): number {
  const [h, m] = c.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToClock(min: number): Clock {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function formatDateLong(date: ISODate): string {
  const d = fromISODate(date);
  return `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} de ${MONTH_LONG[d.getMonth()]}`;
}

export function formatDateShort(date: ISODate): string {
  const d = fromISODate(date);
  return `${d.getDate()} ${MONTH_LONG[d.getMonth()]?.slice(0, 3)}`;
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}
