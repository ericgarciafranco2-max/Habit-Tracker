import { list } from './doc.js';
import { addDays, diffDays, monthKey, rangeDates, startOfWeek } from './date.js';
import { isRequired, isScheduled, weeklyQuota } from './schedule.js';
import type { Doc, Entry, Habit, ISODate } from './types.js';

/** Primer dia con sentido: no tiene sentido llamar "dia en cero" a un dia
 * anterior a que existiera la app. */
export function trackingStart(doc: Doc): ISODate {
  return isoFromMs(doc.profile.createdAt);
}

export function getEntry(doc: Doc, habitId: string, date: ISODate): Entry | undefined {
  const e = doc.entries[`${habitId}:${date}`];
  return e && !e.deleted ? e : undefined;
}

/** Un dia "cuenta" si llegaste al minimo (regla no-zero) o esta congelado. */
export function counts(entry: Entry | undefined): boolean {
  if (!entry) return false;
  return entry.status === 'done' || entry.status === 'partial' || entry.status === 'frozen';
}

export function statusFor(habit: Habit, value: number): Entry['status'] {
  if (habit.kind === 'quit') return value > 0 ? 'missed' : 'done';
  if (value >= habit.target) return 'done';
  if (value >= habit.minimum && value > 0) return 'partial';
  return 'missed';
}

export interface StreakInfo {
  current: number;
  best: number;
  /** Dias exigibles fallados en los ultimos 7 dias. */
  recentMisses: number;
  lastDone?: ISODate;
}

/** Racha en dias exigibles: los dias que el habito no tocaba no la rompen. */
export function streak(doc: Doc, habit: Habit, upTo: ISODate): StreakInfo {
  const lowerBound = addDays(upTo, -400);
  const start = habit.createdAt ? isoFromMs(habit.createdAt) : lowerBound;
  // Si el habito se creo despues de la fecha consultada (datos importados o
  // fechas de prueba) no tiene sentido recortar por su creacion.
  const from = start > upTo ? lowerBound : maxDate(start, lowerBound);
  const dates = rangeDates(from, upTo);

  let current = 0;
  let best = 0;
  let run = 0;
  let lastDone: ISODate | undefined;

  for (const date of dates) {
    if (!isScheduled(doc, habit, date)) continue;
    const entry = getEntry(doc, habit.id, date);
    if (counts(entry)) {
      run++;
      best = Math.max(best, run);
      lastDone = date;
    } else if (date === upTo) {
      // El dia en curso todavia no cuenta como fallo.
      break;
    } else {
      run = 0;
    }
  }
  current = run;

  let recentMisses = 0;
  for (let i = 1; i <= 7; i++) {
    const date = addDays(upTo, -i);
    if (!isRequired(doc, habit, date)) continue;
    if (!counts(getEntry(doc, habit.id, date))) recentMisses++;
  }

  return { current, best, recentMisses, lastDone };
}

function isoFromMs(ms: number): ISODate {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export interface HabitPeriodStats {
  habit: Habit;
  scheduled: number;
  done: number;
  partial: number;
  missed: number;
  frozen: number;
  total: number;
  rate: number;
  streak: StreakInfo;
}

export function habitStats(
  doc: Doc,
  habit: Habit,
  from: ISODate,
  to: ISODate,
  upTo: ISODate = to,
): HabitPeriodStats {
  // Los dias anteriores a que existiera el sistema no son fallos tuyos.
  const begin = maxDate(from, trackingStart(doc));
  let scheduled = 0;
  let done = 0;
  let partial = 0;
  let missed = 0;
  let frozen = 0;
  let total = 0;
  for (const date of rangeDates(begin, to)) {
    if (date > upTo) break;
    if (!isScheduled(doc, habit, date)) continue;
    scheduled++;
    const e = getEntry(doc, habit.id, date);
    total += e?.value ?? 0;
    if (!e) missed++;
    else if (e.status === 'done') done++;
    else if (e.status === 'partial') partial++;
    else if (e.status === 'frozen') frozen++;
    else missed++;
  }
  const effective = Math.max(scheduled - frozen, 0);
  const rate = effective === 0 ? 0 : (done + partial * 0.5) / effective;
  return {
    habit,
    scheduled,
    done,
    partial,
    missed,
    frozen,
    total,
    rate,
    streak: streak(doc, habit, upTo),
  };
}

export function periodStats(
  doc: Doc,
  from: ISODate,
  to: ISODate,
  upTo: ISODate = to,
): HabitPeriodStats[] {
  return list(doc.habits)
    .filter((h) => !h.archived)
    .map((h) => habitStats(doc, h, from, to, upTo))
    .sort((a, b) => b.rate - a.rate);
}

export interface DayScore {
  date: ISODate;
  required: number;
  completed: number;
  /** 0-1 sobre los habitos exigibles del dia. */
  rate: number;
  nonNegotiablesDone: boolean;
  xp: number;
}

/**
 * XP del dia. Formula: 10 * peso por habito cumplido, mitad si fue minimo,
 * +25% si cerraste todos los innegociables y +1% por dia de racha (tope 50%).
 */
export function dayScore(doc: Doc, date: ISODate): DayScore {
  const habits = list(doc.habits).filter((h) => !h.archived && isScheduled(doc, h, date));
  let required = 0;
  let completed = 0;
  let xp = 0;
  let nonNegotiablesDone = true;

  for (const h of habits) {
    const req = isRequired(doc, h, date);
    const e = getEntry(doc, h.id, date);
    if (req) required++;
    if (counts(e)) {
      if (req) completed++;
      const base = 10 * h.weight;
      const factor = e?.status === 'done' ? 1 : e?.status === 'partial' ? 0.5 : 0.25;
      const s = streak(doc, h, date);
      const streakBonus = 1 + Math.min(s.current, 50) / 100;
      xp += base * factor * streakBonus;
    } else if (req && h.nonNegotiable) {
      nonNegotiablesDone = false;
    }
  }
  if (nonNegotiablesDone && required > 0) xp *= 1.25;
  return {
    date,
    required,
    completed,
    rate: required === 0 ? 1 : completed / required,
    nonNegotiablesDone,
    xp: Math.round(xp),
  };
}

export function totalXp(doc: Doc, from: ISODate, to: ISODate): number {
  return rangeDates(from, to).reduce((acc, d) => acc + dayScore(doc, d).xp, 0);
}

export interface LevelInfo {
  level: number;
  title: string;
  xpInLevel: number;
  xpForNext: number;
  progress: number;
}

const LEVEL_TITLES = [
  'Turista',
  'Aprendiz',
  'Constante',
  'Disciplinado',
  'Implacable',
  'Maquina',
  'Referente',
  'Leyenda',
];

/** Cada nivel cuesta 15% mas que el anterior: subir tarde vale mas. */
export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let need = 500;
  let remaining = Math.max(0, xp);
  while (remaining >= need && level < 99) {
    remaining -= need;
    level++;
    need = Math.round(need * 1.15);
  }
  return {
    level,
    title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))] ?? 'Leyenda',
    xpInLevel: Math.round(remaining),
    xpForNext: need,
    progress: need === 0 ? 0 : remaining / need,
  };
}

export interface WeekSummary {
  weekStart: ISODate;
  weekEnd: ISODate;
  rate: number;
  xp: number;
  perfectDays: number;
  misses: number;
  studyMinutes: number;
}

export function weekSummary(doc: Doc, anyDateInWeek: ISODate, upTo: ISODate): WeekSummary {
  const weekStart = startOfWeek(anyDateInWeek);
  const weekEnd = addDays(weekStart, 6);
  const days = rangeDates(weekStart, weekEnd).filter((d) => d <= upTo);
  let requiredTotal = 0;
  let completedTotal = 0;
  let xp = 0;
  let perfectDays = 0;
  for (const d of days) {
    const s = dayScore(doc, d);
    requiredTotal += s.required;
    completedTotal += s.completed;
    xp += s.xp;
    if (s.required > 0 && s.completed === s.required) perfectDays++;
  }
  const studyMinutes = list(doc.sessions)
    .filter((s) => s.date >= weekStart && s.date <= weekEnd)
    .reduce((a, s) => a + s.minutes, 0);
  return {
    weekStart,
    weekEnd,
    rate: requiredTotal === 0 ? 0 : completedTotal / requiredTotal,
    xp,
    perfectDays,
    misses: Math.max(0, requiredTotal - completedTotal),
    studyMinutes,
  };
}

/** Datos para el mapa de calor anual. */
export function yearHeatmap(doc: Doc, year: number, upTo: ISODate): Array<{ date: ISODate; rate: number }> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return rangeDates(from, to)
    .filter((d) => d <= upTo)
    .map((date) => ({ date, rate: dayScore(doc, date).rate }));
}

export function monthlyRates(doc: Doc, year: number, upTo: ISODate): number[] {
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    const from = `${year}-${String(m + 1).padStart(2, '0')}-01`;
    const to = `${year}-${String(m + 1).padStart(2, '0')}-31`;
    const start = trackingStart(doc);
    const days = rangeDates(from, to).filter(
      (d) => d.startsWith(monthKey(from)) && d <= upTo && d >= start,
    );
    if (!days.length) {
      out.push(0);
      continue;
    }
    let req = 0;
    let comp = 0;
    for (const d of days) {
      const s = dayScore(doc, d);
      req += s.required;
      comp += s.completed;
    }
    out.push(req === 0 ? 0 : comp / req);
  }
  return out;
}

/** Cuanto llevas cumplido de la cuota semanal del habito. */
export function weekProgress(doc: Doc, habit: Habit, date: ISODate): { done: number; quota: number } {
  const weekStart = startOfWeek(date);
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (d > date) break;
    if (counts(getEntry(doc, habit.id, d))) done++;
  }
  return { done, quota: weeklyQuota(doc, habit, weekStart) };
}

export function daysSince(date: ISODate, ref: ISODate): number {
  return diffDays(ref, date);
}
