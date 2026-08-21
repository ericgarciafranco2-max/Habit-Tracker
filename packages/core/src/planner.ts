/**
 * Planificador universitario.
 *
 * Coge tu horario de clases, tus examenes y tus entregas y devuelve bloques
 * de estudio concretos con hora de inicio y fin. La idea: no decidir cada dia
 * "que estudio hoy", porque esa decision es justo donde se pierde la semana.
 *
 * Reglas del algoritmo:
 *  - Solo usa huecos reales: descuenta clases, sueno y margen de comida.
 *  - Prioriza por holgura (slack): lo que menos margen tiene va primero.
 *  - Reparte: como mucho dos bloques seguidos de la misma asignatura, para
 *    forzar practica espaciada e intercalada.
 *  - Respeta tu tope diario de estudio segun sea dia de clase o dia libre.
 */
import { list } from './doc.js';
import {
  addDays,
  clockToMinutes,
  diffDays,
  minutesToClock,
  weekday,
} from './date.js';
import { isClassDay } from './schedule.js';
import type { ClassSlot, Doc, Exam, ISODate, Subject, Task } from './types.js';

export interface FreeWindow {
  start: number; // minutos desde medianoche
  end: number;
}

export interface StudyBlock {
  date: ISODate;
  start: string;
  end: string;
  minutes: number;
  subjectId?: string;
  subjectName: string;
  color: string;
  title: string;
  kind: 'examen' | 'entrega' | 'repaso';
  itemId: string;
  urgency: number;
}

export interface PlannerOptions {
  horizonDays?: number;
  /** Minutos de colchon despues de la ultima clase. */
  bufferAfterClass?: number;
  lunchStart?: string;
  lunchMinutes?: number;
}

export function classSlotsFor(doc: Doc, date: ISODate): Array<ClassSlot & { subject: Subject }> {
  const wd = weekday(date);
  const out: Array<ClassSlot & { subject: Subject }> = [];
  for (const subject of list(doc.subjects)) {
    if (subject.archived) continue;
    for (const slot of subject.slots) {
      if (slot.day === wd) out.push({ ...slot, subject });
    }
  }
  return out.sort((a, b) => clockToMinutes(a.start) - clockToMinutes(b.start));
}

/** Huecos libres del dia una vez descontadas clases, sueno y comida. */
export function freeWindows(doc: Doc, date: ISODate, opts: PlannerOptions = {}): FreeWindow[] {
  const wake = clockToMinutes(doc.profile.wakeTime) + 45;
  const sleep = clockToMinutes(doc.profile.sleepTime) - 45;
  const buffer = opts.bufferAfterClass ?? 20;
  const busy: FreeWindow[] = classSlotsFor(doc, date).map((s) => ({
    start: clockToMinutes(s.start) - 10,
    end: clockToMinutes(s.end) + buffer,
  }));
  const lunchStart = clockToMinutes(opts.lunchStart ?? '14:00');
  busy.push({ start: lunchStart, end: lunchStart + (opts.lunchMinutes ?? 60) });
  busy.sort((a, b) => a.start - b.start);

  const windows: FreeWindow[] = [];
  let cursor = wake;
  for (const b of busy) {
    if (b.start > cursor) windows.push({ start: cursor, end: Math.min(b.start, sleep) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < sleep) windows.push({ start: cursor, end: sleep });
  return windows.filter((w) => w.end - w.start >= 25);
}

export function dailyCapacity(doc: Doc, date: ISODate): number {
  return isClassDay(doc, date)
    ? doc.profile.studyMinutesClassDay
    : doc.profile.studyMinutesFreeDay;
}

interface WorkItem {
  id: string;
  subjectId?: string;
  subjectName: string;
  color: string;
  title: string;
  deadline: ISODate;
  remaining: number; // minutos
  kind: 'examen' | 'entrega' | 'repaso';
  weight: number;
}

function minutesStudied(doc: Doc, subjectId: string | undefined, from: ISODate, to: ISODate): number {
  return list(doc.sessions)
    .filter((s) => s.subjectId === subjectId && s.date >= from && s.date <= to)
    .reduce((a, s) => a + s.minutes, 0);
}

export function workItems(doc: Doc, from: ISODate, horizon: ISODate): WorkItem[] {
  const items: WorkItem[] = [];
  const subjects = new Map(list(doc.subjects).map((s) => [s.id, s]));

  for (const exam of list(doc.exams) as Exam[]) {
    if (exam.done || exam.date < from) continue;
    const subject = subjects.get(exam.subjectId);
    const studied = minutesStudied(doc, exam.subjectId, addDays(from, -21), from);
    const need = Math.max(0, exam.estimatedHours * 60 - studied);
    if (need === 0) continue;
    items.push({
      id: exam.id,
      subjectId: exam.subjectId,
      subjectName: subject?.name ?? 'Asignatura',
      color: subject?.color ?? '#1e8e3e',
      title: exam.title,
      deadline: exam.date,
      remaining: need,
      kind: 'examen',
      weight: (exam.weight || 20) * (subject?.difficulty ?? 3),
    });
  }

  for (const task of list(doc.tasks) as Task[]) {
    if (task.done || !task.due || task.due < from) continue;
    const subject = task.subjectId ? subjects.get(task.subjectId) : undefined;
    items.push({
      id: task.id,
      subjectId: task.subjectId,
      subjectName: subject?.name ?? 'General',
      color: subject?.color ?? '#0b6bcb',
      title: task.title,
      deadline: task.due,
      remaining: Math.max(30, task.estimatedHours * 60),
      kind: 'entrega',
      weight: 40 * task.priority,
    });
  }

  // Relleno: repaso de asignaturas sin examen cercano, para no llegar en frio.
  for (const subject of list(doc.subjects)) {
    if (subject.archived) continue;
    if (items.some((i) => i.subjectId === subject.id)) continue;
    items.push({
      id: `repaso_${subject.id}`,
      subjectId: subject.id,
      subjectName: subject.name,
      color: subject.color,
      title: `Repaso ${subject.name}`,
      deadline: horizon,
      remaining: 50 * Math.max(1, Math.round(subject.credits / 3)),
      kind: 'repaso',
      weight: 10 * subject.difficulty,
    });
  }
  return items;
}

/** Holgura: minutos disponibles hasta la fecha limite menos lo que falta. */
function slack(item: WorkItem, from: ISODate, capacityPerDay: number): number {
  const days = Math.max(0, diffDays(item.deadline, from));
  return days * capacityPerDay - item.remaining;
}

/** Bloque mas corto que merece la pena sentarse. */
const MIN_BLOCK = 25;

export function buildStudyPlan(doc: Doc, from: ISODate, opts: PlannerOptions = {}): StudyBlock[] {
  const horizonDays = opts.horizonDays ?? 14;
  const horizon = addDays(from, horizonDays - 1);
  const items = workItems(doc, from, horizon);
  if (!items.length) return [];

  const avgCapacity =
    (doc.profile.studyMinutesClassDay + doc.profile.studyMinutesFreeDay) / 2 || 120;
  const blockMinutes = Math.max(25, doc.profile.pomodoroMinutes);
  const breakMinutes = Math.max(5, doc.profile.breakMinutes);
  const plan: StudyBlock[] = [];

  for (let d = 0; d < horizonDays; d++) {
    const date = addDays(from, d);
    let capacity = dailyCapacity(doc, date);
    const windows = freeWindows(doc, date, opts);
    let lastItemId: string | null = null;
    let sameItemStreak = 0;

    for (const win of windows) {
      let cursor = win.start;
      // Permitimos un ultimo bloque mas corto (minimo 25 min) para no dejar
      // sin usar el hueco que queda al final del dia.
      while (capacity >= MIN_BLOCK && win.end - cursor >= MIN_BLOCK) {
        const candidates = items
          .filter((i) => i.remaining > 0 && i.deadline >= date)
          .sort((a, b) => {
            const sa = slack(a, date, avgCapacity);
            const sb = slack(b, date, avgCapacity);
            if (sa !== sb) return sa - sb;
            return b.weight - a.weight;
          });
        if (!candidates.length) break;

        let chosen = candidates[0]!;
        if (chosen.id === lastItemId && sameItemStreak >= 2 && candidates[1]) {
          chosen = candidates[1];
        }

        const minutes = Math.min(blockMinutes, chosen.remaining, capacity, win.end - cursor);
        if (minutes < MIN_BLOCK) break;

        plan.push({
          date,
          start: minutesToClock(cursor),
          end: minutesToClock(cursor + minutes),
          minutes,
          subjectId: chosen.subjectId,
          subjectName: chosen.subjectName,
          color: chosen.color,
          title: chosen.title,
          kind: chosen.kind,
          itemId: chosen.id,
          urgency: Math.round(-slack(chosen, date, avgCapacity)),
        });

        chosen.remaining -= minutes;
        capacity -= minutes;
        sameItemStreak = chosen.id === lastItemId ? sameItemStreak + 1 : 1;
        lastItemId = chosen.id;
        cursor += minutes + breakMinutes;
      }
    }
  }
  return plan;
}

export interface ExamCountdown {
  exam: Exam;
  subject?: Subject;
  daysLeft: number;
  studiedMinutes: number;
  neededMinutes: number;
  readiness: number;
}

export function examCountdowns(doc: Doc, from: ISODate): ExamCountdown[] {
  const subjects = new Map(list(doc.subjects).map((s) => [s.id, s]));
  return (list(doc.exams) as Exam[])
    .filter((e) => !e.done && e.date >= from)
    .map((exam) => {
      const studied = minutesStudied(doc, exam.subjectId, addDays(from, -30), from);
      const needed = exam.estimatedHours * 60;
      return {
        exam,
        subject: subjects.get(exam.subjectId),
        daysLeft: diffDays(exam.date, from),
        studiedMinutes: studied,
        neededMinutes: needed,
        readiness: needed === 0 ? 1 : Math.min(1, studied / needed),
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Carga semanal por dia (minutos de clase + minutos de plan). */
export function weeklyLoad(doc: Doc, weekStart: ISODate): Array<{ date: ISODate; classMinutes: number; studyMinutes: number }> {
  const plan = buildStudyPlan(doc, weekStart, { horizonDays: 7 });
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const classMinutes = classSlotsFor(doc, date).reduce(
      (a, s) => a + (clockToMinutes(s.end) - clockToMinutes(s.start)),
      0,
    );
    const studyMinutes = plan.filter((b) => b.date === date).reduce((a, b) => a + b.minutes, 0);
    return { date, classMinutes, studyMinutes };
  });
}
