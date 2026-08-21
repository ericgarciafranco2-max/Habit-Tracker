/**
 * El sistema de presion.
 *
 * Un tracker que solo pinta cuadritos no obliga a nada. Estas funciones
 * convierten cada fallo en una consecuencia concreta y cada logro en algo que
 * se puede perder:
 *
 *  1. Regla no-zero: cada habito tiene un minimo que salva la racha.
 *  2. Deuda: fallar genera deuda (minutos, repeticiones, euros) que hay que pagar.
 *  3. Avisos y sancion: 3 fallos exigibles en 7 dias asignan una penitencia
 *     que TU escribiste cuando estabas motivado.
 *  4. Recompensas bloqueadas: lo que te gusta no se desbloquea hasta cerrar
 *     los innegociables del dia.
 *  5. Rituales: el dia no se abre sin plan ni se cierra sin revision.
 *  6. Blindaje: en modo estricto no se editan dias pasados, no se retiran
 *     habitos en caliente y no se suaviza un contrato firmado.
 */
import { list, patchProfile } from './doc.js';
import { newId, entryId } from './id.js';
import {
  addDays,
  clockToMinutes,
  endOfWeek,
  logicalToday,
  monthKey,
  rangeDates,
  startOfWeek,
  toISODate,
} from './date.js';
import { isRequired, isScheduled } from './schedule.js';
import { counts, dayScore, getEntry, statusFor, streak, weekSummary } from './stats.js';
import type {
  Debt,
  Doc,
  Entry,
  Habit,
  ISODate,
  LedgerEvent,
  LedgerKind,
  Penance,
} from './types.js';

export const LATE_EDIT_MS = 24 * 60 * 60 * 1000;
export const RETIRE_COOLDOWN_MS = 72 * 60 * 60 * 1000;
export const STRIKE_LIMIT = 3;

export function logEvent(
  doc: Doc,
  date: ISODate,
  kind: LedgerKind,
  text: string,
  amount?: number,
  id?: string,
): Doc {
  const eventId = id ?? newId('ev_');
  const ev: LedgerEvent = {
    id: eventId,
    updatedAt: Date.now(),
    date,
    kind,
    text,
    amount,
  };
  return { ...doc, ledger: { ...doc.ledger, [eventId]: ev } };
}

/* ------------------------------------------------------------------ */
/* Registro de habitos                                                 */
/* ------------------------------------------------------------------ */

export interface LogOptions {
  now?: number;
  /** Marca explicita de congelacion (gasta una ficha). */
  freeze?: boolean;
  note?: string;
}

/**
 * Registra un valor para un habito en una fecha, aplicando las reglas:
 * estado segun minimo/objetivo, marca de edicion tardia y pago automatico
 * de deuda si te pasas del objetivo.
 */
export function logHabit(
  doc: Doc,
  habitId: string,
  date: ISODate,
  value: number,
  opts: LogOptions = {},
): Doc {
  const habit = doc.habits[habitId];
  if (!habit || habit.deleted) return doc;
  const now = opts.now ?? Date.now();
  const id = entryId(habitId, date);
  const prev = doc.entries[id];
  const dayEnd = new Date(`${date}T23:59:59`).getTime();
  const late = now - dayEnd > LATE_EDIT_MS;

  const entry: Entry = {
    id,
    updatedAt: now,
    habitId,
    date,
    value,
    status: opts.freeze ? 'frozen' : statusFor(habit, value),
    note: opts.note ?? prev?.note,
    loggedAt: prev?.loggedAt ?? now,
    editedLate: late || prev?.editedLate,
  };

  let next: Doc = { ...doc, entries: { ...doc.entries, [id]: entry } };

  if (late && !prev?.editedLate) {
    next = logEvent(
      next,
      date,
      'edicion-tardia',
      `Retocaste "${habit.name}" del ${date} mas de 24h despues. Queda registrado.`,
    );
  }

  // Pasarse del objetivo paga deuda pendiente del mismo habito.
  const surplus = value - habit.target;
  if (surplus > 0 && habit.debtRule) {
    next = payDebtWithSurplus(next, habitId, surplus, date);
  }
  return next;
}

export function toggleHabit(doc: Doc, habitId: string, date: ISODate, now = Date.now()): Doc {
  const habit = doc.habits[habitId];
  if (!habit) return doc;
  const current = getEntry(doc, habitId, date);
  if (habit.measure === 'check') {
    const next = counts(current) ? 0 : 1;
    return logHabit(doc, habitId, date, next, { now });
  }
  const next = counts(current) ? 0 : habit.target;
  return logHabit(doc, habitId, date, next, { now });
}

/* ------------------------------------------------------------------ */
/* Deuda                                                               */
/* ------------------------------------------------------------------ */

export function pendingDebts(doc: Doc): Debt[] {
  return list(doc.debts)
    .filter((d) => !d.paid)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function debtSummary(doc: Doc): Array<{ unit: string; amount: number }> {
  const map = new Map<string, number>();
  for (const d of pendingDebts(doc)) map.set(d.unit, (map.get(d.unit) ?? 0) + d.amount);
  return [...map.entries()].map(([unit, amount]) => ({ unit, amount }));
}

export function addDebt(
  doc: Doc,
  date: ISODate,
  amount: number,
  unit: string,
  reason: string,
  habitId?: string,
): Doc {
  const id = newId('debt_');
  const debt: Debt = { id, updatedAt: Date.now(), habitId, date, amount, unit, reason, paid: false };
  const next: Doc = { ...doc, debts: { ...doc.debts, [id]: debt } };
  return logEvent(next, date, 'deuda-creada', `${reason}: +${amount} ${unit}`, amount);
}

export function payDebt(doc: Doc, debtId: string, date: ISODate): Doc {
  const debt = doc.debts[debtId];
  if (!debt || debt.paid) return doc;
  const next: Doc = {
    ...doc,
    debts: { ...doc.debts, [debtId]: { ...debt, paid: true, paidAt: Date.now(), updatedAt: Date.now() } },
  };
  return logEvent(next, date, 'deuda-pagada', `Deuda saldada: ${debt.amount} ${debt.unit}`, debt.amount);
}

function payDebtWithSurplus(doc: Doc, habitId: string, surplus: number, date: ISODate): Doc {
  let next = doc;
  let left = surplus;
  for (const debt of pendingDebts(next).filter((d) => d.habitId === habitId)) {
    if (left <= 0) break;
    if (left >= debt.amount) {
      left -= debt.amount;
      next = payDebt(next, debt.id, date);
    } else {
      next = {
        ...next,
        debts: {
          ...next.debts,
          [debt.id]: { ...debt, amount: debt.amount - left, updatedAt: Date.now() },
        },
      };
      left = 0;
    }
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Avisos, sanciones y penitencias                                     */
/* ------------------------------------------------------------------ */

export function strikes(doc: Doc, habit: Habit, upTo: ISODate): number {
  return streak(doc, habit, upTo).recentMisses;
}

export function activePenance(doc: Doc): Penance | undefined {
  return list(doc.penances).find((p) => p.active && p.assignedAt && !p.doneAt);
}

export function assignPenance(doc: Doc, date: ISODate, severity: 1 | 2 | 3, reason: string): Doc {
  if (activePenance(doc)) return doc;
  const pool = list(doc.penances).filter((p) => !p.assignedAt || p.doneAt);
  const candidates = pool.filter((p) => p.severity === severity);
  const chosen = (candidates.length ? candidates : pool)[0];
  if (!chosen) return logEvent(doc, date, 'sancion', `${reason}. No tienes penitencias definidas.`);
  const next: Doc = {
    ...doc,
    penances: {
      ...doc.penances,
      [chosen.id]: { ...chosen, active: true, assignedAt: Date.now(), doneAt: undefined, updatedAt: Date.now() },
    },
  };
  return logEvent(next, date, 'sancion', `${reason} -> penitencia: ${chosen.text}`);
}

export function completePenance(doc: Doc, penanceId: string, date: ISODate): Doc {
  const p = doc.penances[penanceId];
  if (!p) return doc;
  const next: Doc = {
    ...doc,
    penances: {
      ...doc.penances,
      [penanceId]: { ...p, active: false, doneAt: Date.now(), updatedAt: Date.now() },
    },
  };
  return logEvent(next, date, 'sancion', `Penitencia cumplida: ${p.text}`);
}

/* ------------------------------------------------------------------ */
/* Veredicto del dia                                                   */
/* ------------------------------------------------------------------ */

export type Verdict = 'perfecto' | 'aprobado' | 'suspenso' | 'pendiente';

export interface DayVerdict {
  date: ISODate;
  verdict: Verdict;
  requiredHabits: Habit[];
  missed: Habit[];
  nonNegotiableMisses: Habit[];
  rate: number;
  xp: number;
  closed: boolean;
}

export function dayVerdict(doc: Doc, date: ISODate, todayDate: ISODate): DayVerdict {
  const score = dayScore(doc, date);
  const requiredHabits = list(doc.habits).filter(
    (h) => !h.archived && isRequired(doc, h, date),
  );
  const missed = requiredHabits.filter((h) => !counts(getEntry(doc, h.id, date)));
  const nonNegotiableMisses = missed.filter((h) => h.nonNegotiable);
  const day = doc.days[date];
  const closed = Boolean(day?.closedAt);

  let verdict: Verdict;
  if (date >= todayDate && !closed) verdict = 'pendiente';
  else if (missed.length === 0) verdict = 'perfecto';
  else if (nonNegotiableMisses.length === 0 && score.rate >= 0.7) verdict = 'aprobado';
  else verdict = 'suspenso';

  return {
    date,
    verdict,
    requiredHabits,
    missed,
    nonNegotiableMisses,
    rate: score.rate,
    xp: score.xp,
    closed,
  };
}

/**
 * Cierra y liquida un dia pasado: genera deudas, rompe rachas y aplica
 * sanciones. Es idempotente (deja una marca en el ledger) para que abrir la
 * app tres veces no te cobre tres veces.
 */
export function settleDay(doc: Doc, date: ISODate, todayDate: ISODate): Doc {
  const marker = `settle:${date}`;
  if (doc.ledger[marker]) return doc;
  if (date >= todayDate) return doc;

  let next = doc;
  const v = dayVerdict(doc, date, todayDate);

  for (const habit of v.missed) {
    if (habit.debtRule) {
      next = addDebt(
        next,
        date,
        habit.debtRule.amount,
        habit.debtRule.unit,
        `Fallaste "${habit.name}" el ${date}`,
        habit.id,
      );
    }
    const misses = strikes(next, habit, date);
    if (misses >= STRIKE_LIMIT) {
      next = assignPenance(
        next,
        date,
        habit.nonNegotiable ? 3 : 2,
        `${misses} fallos de "${habit.name}" en 7 dias`,
      );
    }
  }

  const xp = v.xp;
  next = patchProfile(next, { xp: Math.max(0, next.profile.xp + xp) });
  next = logEvent(
    next,
    date,
    'xp',
    `Dia ${date}: ${v.verdict} (${Math.round(v.rate * 100)}%), ${xp} XP`,
    xp,
    marker,
  );
  return next;
}

/** Liquida todos los dias pendientes desde el ultimo cierre hasta ayer. */
export function settlePending(doc: Doc, todayDate: ISODate, maxDays = 60): Doc {
  let next = doc;
  for (let i = maxDays; i >= 1; i--) {
    const date = addDays(todayDate, -i);
    if (date < isoFromMs(doc.profile.createdAt)) continue;
    next = settleDay(next, date, todayDate);
  }
  return refreshFreezeTokens(next, todayDate);
}

function isoFromMs(ms: number): ISODate {
  return toISODate(new Date(ms));
}

/* ------------------------------------------------------------------ */
/* Congelaciones                                                       */
/* ------------------------------------------------------------------ */

/**
 * Las fichas de congelacion se reponen cada mes, pero solo 2: son un seguro,
 * no una excusa. Se gana una extra por cada semana perfecta.
 */
export function refreshFreezeTokens(doc: Doc, todayDate: ISODate): Doc {
  const mk = monthKey(todayDate);
  if (doc.profile.freezeMonth === mk) return doc;
  return patchProfile(doc, { freezeMonth: mk, freezeTokens: 2, freezeTokensUsedThisMonth: 0 });
}

export function useFreeze(doc: Doc, habitId: string, date: ISODate): Doc {
  if (doc.profile.freezeTokens <= 0) return doc;
  let next = logHabit(doc, habitId, date, 0, { freeze: true });
  next = patchProfile(next, {
    freezeTokens: next.profile.freezeTokens - 1,
    freezeTokensUsedThisMonth: next.profile.freezeTokensUsedThisMonth + 1,
  });
  const habit = doc.habits[habitId];
  return logEvent(
    next,
    date,
    'congelacion-usada',
    `Congelaste "${habit?.name ?? habitId}" el ${date}. Quedan ${next.profile.freezeTokens}.`,
  );
}

/* ------------------------------------------------------------------ */
/* Recompensas y rituales                                              */
/* ------------------------------------------------------------------ */

export interface LockState {
  locked: boolean;
  pending: Habit[];
  reason: string;
}

/** Lo que te gusta sigue bloqueado mientras queden innegociables sin hacer. */
export function rewardLock(doc: Doc, date: ISODate): LockState {
  const pending = list(doc.habits).filter(
    (h) => !h.archived && h.nonNegotiable && isRequired(doc, h, date) && !counts(getEntry(doc, h.id, date)),
  );
  const penance = activePenance(doc);
  if (penance) {
    return { locked: true, pending, reason: `Tienes una penitencia sin cumplir: ${penance.text}` };
  }
  if (pending.length) {
    return {
      locked: true,
      pending,
      reason: `Te faltan ${pending.length} innegociable(s): ${pending.map((h) => h.name).join(', ')}`,
    };
  }
  return { locked: false, pending: [], reason: 'Desbloqueado. Te lo has ganado.' };
}

export interface RitualState {
  needsOpen: boolean;
  needsClose: boolean;
  canClose: boolean;
  minutesToCutoff: number;
}

export function ritualState(doc: Doc, date: ISODate, now = new Date()): RitualState {
  const day = doc.days[date];
  const cutoff = clockToMinutes(doc.profile.dayCutoff);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sleep = clockToMinutes(doc.profile.sleepTime);
  const minutesToCutoff = (cutoff + 1440 - nowMin) % 1440;
  return {
    needsOpen: !day?.openedAt || (day.mustDo ?? []).length === 0,
    needsClose: !day?.closedAt,
    canClose: nowMin >= sleep - 120 || nowMin < cutoff,
    minutesToCutoff,
  };
}

export function openDay(doc: Doc, date: ISODate, mustDo: string[]): Doc {
  const prev = doc.days[date];
  const day = {
    ...(prev ?? { id: date, date, mustDo: [] }),
    id: date,
    date,
    mustDo,
    openedAt: prev?.openedAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  return { ...doc, days: { ...doc.days, [date]: day } };
}

export function closeDay(
  doc: Doc,
  date: ISODate,
  data: { mood?: number; energy?: number; sleepHours?: number; reflection?: string; win?: string; friction?: string },
): Doc {
  const prev = doc.days[date];
  const day = {
    ...(prev ?? { id: date, date, mustDo: [] }),
    ...data,
    id: date,
    date,
    mustDo: prev?.mustDo ?? [],
    closedAt: Date.now(),
    updatedAt: Date.now(),
  };
  let next: Doc = { ...doc, days: { ...doc.days, [date]: day } };
  next = logEvent(next, date, 'xp', `Dia cerrado con revision`, 0, `close:${date}`);
  return next;
}

/* ------------------------------------------------------------------ */
/* Blindaje anti-trampas                                               */
/* ------------------------------------------------------------------ */

export interface EditPermission {
  allowed: boolean;
  reason?: string;
}

/**
 * En modo estricto no puedes reescribir la historia: solo hoy y ayer.
 * Todo lo demas queda como esta (y las ediciones tardias se registran).
 */
export function canEditDate(doc: Doc, date: ISODate, todayDate: ISODate): EditPermission {
  if (date > todayDate) return { allowed: false, reason: 'No puedes marcar el futuro.' };
  if (!doc.profile.strictMode) return { allowed: true };
  const daysBack = rangeDates(date, todayDate).length - 1;
  if (daysBack <= 1) return { allowed: true };
  return {
    allowed: false,
    reason: 'Modo estricto: solo puedes editar hoy y ayer. Lo demas ya es historia.',
  };
}

/** Retirar un habito exige 72h de enfriamiento: no se abandona en caliente. */
export function requestRetire(doc: Doc, habitId: string, date: ISODate): Doc {
  const habit = doc.habits[habitId];
  if (!habit) return doc;
  if (habit.retireRequestedAt) return doc;
  const next: Doc = {
    ...doc,
    habits: {
      ...doc.habits,
      [habitId]: { ...habit, retireRequestedAt: Date.now(), updatedAt: Date.now() },
    },
  };
  return logEvent(
    next,
    date,
    'contrato',
    `Pediste retirar "${habit.name}". Se podra confirmar en 72h.`,
  );
}

export function canRetire(habit: Habit, now = Date.now()): EditPermission {
  if (!habit.retireRequestedAt) {
    return { allowed: false, reason: 'Primero pide la baja: hay 72h de enfriamiento.' };
  }
  const left = RETIRE_COOLDOWN_MS - (now - habit.retireRequestedAt);
  if (left > 0) {
    const hours = Math.ceil(left / 3_600_000);
    return { allowed: false, reason: `Faltan ${hours}h de enfriamiento.` };
  }
  return { allowed: true };
}

export function cancelRetire(doc: Doc, habitId: string): Doc {
  const habit = doc.habits[habitId];
  if (!habit) return doc;
  return {
    ...doc,
    habits: {
      ...doc.habits,
      [habitId]: { ...habit, retireRequestedAt: undefined, updatedAt: Date.now() },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Auditoria semanal                                                   */
/* ------------------------------------------------------------------ */

export interface WeeklyAudit {
  weekStart: ISODate;
  weekEnd: ISODate;
  rate: number;
  xp: number;
  perfectDays: number;
  misses: number;
  studyMinutes: number;
  worst: Array<{ habit: Habit; misses: number }>;
  best: Array<{ habit: Habit; done: number }>;
  openDebts: Debt[];
  lateEdits: number;
  contractOk: boolean;
  verdict: string;
}

export function weeklyAudit(doc: Doc, anyDateInWeek: ISODate, todayDate: ISODate): WeeklyAudit {
  const weekStart = startOfWeek(anyDateInWeek);
  const weekEnd = endOfWeek(anyDateInWeek);
  const summary = weekSummary(doc, anyDateInWeek, todayDate);
  const days = rangeDates(weekStart, weekEnd).filter((d) => d <= todayDate);

  const missMap = new Map<string, number>();
  const doneMap = new Map<string, number>();
  let lateEdits = 0;
  for (const habit of list(doc.habits).filter((h) => !h.archived)) {
    for (const date of days) {
      if (!isScheduled(doc, habit, date)) continue;
      const e = getEntry(doc, habit.id, date);
      if (e?.editedLate) lateEdits++;
      if (counts(e)) doneMap.set(habit.id, (doneMap.get(habit.id) ?? 0) + 1);
      else if (isRequired(doc, habit, date) && date < todayDate)
        missMap.set(habit.id, (missMap.get(habit.id) ?? 0) + 1);
    }
  }

  const worst = [...missMap.entries()]
    .map(([id, misses]) => ({ habit: doc.habits[id]!, misses }))
    .filter((x) => x.habit)
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 3);
  const best = [...doneMap.entries()]
    .map(([id, done]) => ({ habit: doc.habits[id]!, done }))
    .filter((x) => x.habit)
    .sort((a, b) => b.done - a.done)
    .slice(0, 3);

  const contract = list(doc.contracts).find((c) => c.status === 'activo');
  const contractOk = !contract || summary.rate * 100 >= contract.weeklyThreshold;

  let verdict: string;
  if (summary.rate >= 0.95) verdict = 'Semana impecable. Sube el liston.';
  else if (summary.rate >= 0.8) verdict = 'Semana solida. Ataca tu peor habito.';
  else if (summary.rate >= 0.6) verdict = 'Semana mediocre. Reduce habitos y cumple los que queden.';
  else verdict = 'Semana rota. Vuelve a los innegociables y nada mas.';

  return {
    weekStart,
    weekEnd,
    rate: summary.rate,
    xp: summary.xp,
    perfectDays: summary.perfectDays,
    misses: summary.misses,
    studyMinutes: summary.studyMinutes,
    worst,
    best,
    openDebts: pendingDebts(doc),
    lateEdits,
    contractOk,
    verdict,
  };
}

/** Informe de texto listo para enviar a tu auditor por WhatsApp o email. */
export function auditReportText(doc: Doc, audit: WeeklyAudit): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const lines = [
    `INFORME SEMANAL — ${audit.weekStart} a ${audit.weekEnd}`,
    `Cumplimiento: ${pct(audit.rate)}  |  Dias perfectos: ${audit.perfectDays}/7  |  Fallos: ${audit.misses}`,
    `Estudio: ${Math.round(audit.studyMinutes / 60)}h ${audit.studyMinutes % 60}m  |  XP: ${audit.xp}`,
  ];
  if (audit.best.length) lines.push(`Mejor: ${audit.best.map((b) => `${b.habit.name} (${b.done})`).join(', ')}`);
  if (audit.worst.length) lines.push(`Peor: ${audit.worst.map((w) => `${w.habit.name} (-${w.misses})`).join(', ')}`);
  if (audit.openDebts.length) {
    lines.push(`Deuda pendiente: ${audit.openDebts.map((d) => `${d.amount} ${d.unit}`).join(', ')}`);
  }
  if (audit.lateEdits) lines.push(`Ediciones tardias detectadas: ${audit.lateEdits}`);
  const contract = list(doc.contracts).find((c) => c.status === 'activo');
  if (contract) {
    lines.push(
      audit.contractOk
        ? `Contrato "${contract.title}": CUMPLIDO (minimo ${contract.weeklyThreshold}%).`
        : `Contrato "${contract.title}": INCUMPLIDO. Se ejecuta la prenda: ${contract.stakeDescription}`,
    );
  }
  lines.push(audit.verdict);
  return lines.join('\n');
}

export function currentLogicalDate(doc: Doc, now = new Date()): ISODate {
  return logicalToday(doc.profile.dayCutoff, now);
}
