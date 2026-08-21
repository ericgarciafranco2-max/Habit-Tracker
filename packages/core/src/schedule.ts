import { list } from './doc.js';
import { addDays, startOfWeek, weekday } from './date.js';
import type { Doc, Habit, ISODate } from './types.js';

/** Dias de la semana (0-6) en los que tienes clase presencial. */
export function classDays(doc: Doc): Set<number> {
  const days = new Set<number>();
  for (const s of list(doc.subjects)) {
    if (s.archived) continue;
    for (const slot of s.slots) days.add(slot.day);
  }
  return days;
}

export function isClassDay(doc: Doc, date: ISODate): boolean {
  return classDays(doc).has(weekday(date));
}

/**
 * Si el habito toca hoy.
 *
 * `timesPerWeek` no fija dias concretos: es exigible mientras queden huecos
 * suficientes en la semana. Cuando ya no quedan dias para llegar a la cuota,
 * los dias restantes pasan a ser obligatorios.
 */
export function isScheduled(doc: Doc, habit: Habit, date: ISODate): boolean {
  if (habit.archived) return false;
  const wd = weekday(date);
  switch (habit.schedule.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return wd >= 1 && wd <= 5;
    case 'weekend':
      return wd === 0 || wd === 6;
    case 'custom':
      return habit.schedule.days.includes(wd);
    case 'classDays':
      return isClassDay(doc, date);
    case 'freeDays':
      return !isClassDay(doc, date);
    case 'timesPerWeek':
      return true;
    default:
      return true;
  }
}

/**
 * Un habito `timesPerWeek` solo es *obligatorio* un dia concreto si ya no
 * quedan margenes: hechos + dias restantes == cuota.
 */
export function isRequired(doc: Doc, habit: Habit, date: ISODate): boolean {
  if (!isScheduled(doc, habit, date)) return false;
  if (habit.schedule.type !== 'timesPerWeek') return true;
  const quota = habit.schedule.timesPerWeek;
  const weekStart = startOfWeek(date);
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (d >= date) break;
    const e = doc.entries[`${habit.id}:${d}`];
    if (e && !e.deleted && (e.status === 'done' || e.status === 'partial')) done++;
  }
  const daysLeftIncludingToday = 7 - ((weekday(date) + 6) % 7);
  return quota - done >= daysLeftIncludingToday;
}

/** Cuota semanal esperada del habito (para porcentajes honestos). */
export function weeklyQuota(doc: Doc, habit: Habit, weekStart: ISODate): number {
  if (habit.schedule.type === 'timesPerWeek') return habit.schedule.timesPerWeek;
  let count = 0;
  for (let i = 0; i < 7; i++) if (isScheduled(doc, habit, addDays(weekStart, i))) count++;
  return count;
}

export function habitsForDate(doc: Doc, date: ISODate): Habit[] {
  return list(doc.habits)
    .filter((h) => !h.archived && isScheduled(doc, h, date))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
