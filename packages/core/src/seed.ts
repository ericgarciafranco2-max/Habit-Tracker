import { emptyDoc, patchProfile } from './doc.js';
import { newId } from './id.js';
import { today } from './date.js';
import type { Doc, Habit, Penance, Reward, Subject } from './types.js';

export interface HabitTemplate extends Omit<Habit, 'id' | 'updatedAt' | 'createdAt' | 'order'> {
  key: string;
}

type TemplateInput = Omit<HabitTemplate, 'archived' | 'reminders' | 'nonNegotiable'> &
  Partial<Pick<Habit, 'reminders' | 'nonNegotiable'>>;

const t = (h: TemplateInput): HabitTemplate => ({
  archived: false,
  reminders: [],
  nonNegotiable: false,
  ...h,
});

/**
 * Catalogo de habitos. Todos son editables y se pueden borrar; esto es solo
 * el punto de partida para no empezar con una pantalla en blanco.
 */
export const HABIT_CATALOG: HabitTemplate[] = [
  t({
    key: 'despertar',
    name: 'Levantarme a la hora',
    emoji: '⏰',
    color: '#b58400',
    category: 'disciplina',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'daily' },
    windowStart: '05:00',
    windowEnd: '08:00',
    nonNegotiable: true,
    weight: 5,
    debtRule: { amount: 15, unit: 'minutos' },
    notes: 'Sin snooze. Si suena, te levantas.',
    reminders: ['06:30'],
  }),
  t({
    key: 'planificar',
    name: 'Planificar el dia',
    emoji: '📅',
    color: '#0b6bcb',
    category: 'disciplina',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'daily' },
    nonNegotiable: true,
    weight: 4,
    notes: '5 minutos: las 3 cosas que si o si haces hoy.',
    reminders: ['07:00'],
  }),
  t({
    key: 'estudio',
    name: 'Estudio profundo',
    emoji: '📚',
    color: '#1e8e3e',
    category: 'estudio',
    kind: 'build',
    measure: 'minutes',
    target: 90,
    unit: 'min',
    minimum: 25,
    schedule: { type: 'daily' },
    nonNegotiable: true,
    weight: 5,
    debtRule: { amount: 45, unit: 'minutos' },
    notes: 'Sin movil en la mesa. Bloques de 50 min.',
    reminders: ['17:00'],
  }),
  t({
    key: 'clase',
    name: 'Asistir a clase',
    emoji: '🎓',
    color: '#4b44c4',
    category: 'estudio',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'classDays' },
    nonNegotiable: true,
    weight: 4,
    debtRule: { amount: 60, unit: 'minutos' },
    notes: 'Faltar cuesta el doble de recuperar.',
  }),
  t({
    key: 'gimnasio',
    name: 'Entrenar',
    emoji: '🏋️',
    color: '#d93a30',
    category: 'salud',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'timesPerWeek', timesPerWeek: 4 },
    weight: 4,
    debtRule: { amount: 15, unit: 'minutos' },
    notes: 'Minimo valido: 15 min de algo. Cero no existe.',
  }),
  t({
    key: 'pasos',
    name: 'Moverme',
    emoji: '🚶',
    color: '#0e9e8e',
    category: 'salud',
    kind: 'build',
    measure: 'quantity',
    target: 8000,
    unit: 'pasos',
    minimum: 4000,
    schedule: { type: 'daily' },
    weight: 2,
  }),
  t({
    key: 'lectura',
    name: 'Leer',
    emoji: '📖',
    color: '#e8730c',
    category: 'mente',
    kind: 'build',
    measure: 'quantity',
    target: 20,
    unit: 'paginas',
    minimum: 5,
    schedule: { type: 'daily' },
    weight: 3,
    debtRule: { amount: 10, unit: 'paginas' },
  }),
  t({
    key: 'meditar',
    name: 'Meditar',
    emoji: '🧘',
    color: '#0b6bcb',
    category: 'mente',
    kind: 'build',
    measure: 'minutes',
    target: 10,
    unit: 'min',
    minimum: 3,
    schedule: { type: 'daily' },
    weight: 2,
  }),
  t({
    key: 'redes',
    name: 'Sin redes hasta la noche',
    emoji: '📵',
    color: '#d93a30',
    category: 'disciplina',
    kind: 'quit',
    measure: 'check',
    target: 0,
    minimum: 0,
    schedule: { type: 'daily' },
    nonNegotiable: true,
    weight: 4,
    debtRule: { amount: 30, unit: 'minutos' },
    notes: 'Marca la casilla solo si has caido.',
  }),
  t({
    key: 'comida',
    name: 'Comer limpio',
    emoji: '🥗',
    color: '#1e8e3e',
    category: 'salud',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'daily' },
    weight: 3,
  }),
  t({
    key: 'agua',
    name: 'Agua',
    emoji: '💧',
    color: '#0b6bcb',
    category: 'salud',
    kind: 'build',
    measure: 'quantity',
    target: 8,
    unit: 'vasos',
    minimum: 5,
    schedule: { type: 'daily' },
    weight: 1,
  }),
  t({
    key: 'diario',
    name: 'Diario de objetivos',
    emoji: '📝',
    color: '#e8730c',
    category: 'mente',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'daily' },
    weight: 2,
    reminders: ['22:30'],
  }),
  t({
    key: 'dormir',
    name: 'Dormir a mi hora',
    emoji: '🌙',
    color: '#4b44c4',
    category: 'salud',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'daily' },
    windowStart: '22:00',
    windowEnd: '23:45',
    nonNegotiable: true,
    weight: 5,
    debtRule: { amount: 20, unit: 'minutos' },
    reminders: ['23:00'],
  }),
  t({
    key: 'frio',
    name: 'Ducha fria',
    emoji: '❄️',
    color: '#0e9e8e',
    category: 'disciplina',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'timesPerWeek', timesPerWeek: 5 },
    weight: 2,
  }),
  t({
    key: 'proyecto',
    name: 'Proyecto personal',
    emoji: '🚀',
    color: '#d9539b',
    category: 'otro',
    kind: 'build',
    measure: 'minutes',
    target: 45,
    unit: 'min',
    minimum: 15,
    schedule: { type: 'custom', days: [1, 2, 3, 4, 5, 6] },
    weight: 3,
  }),
  t({
    key: 'orden',
    name: 'Dejar el cuarto en orden',
    emoji: '🧹',
    color: '#b58400',
    category: 'disciplina',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'daily' },
    weight: 1,
  }),
];

export const DEFAULT_HABIT_KEYS = [
  'despertar',
  'planificar',
  'estudio',
  'clase',
  'gimnasio',
  'lectura',
  'redes',
  'dormir',
  'meditar',
  'agua',
];

export function habitFromTemplate(tpl: HabitTemplate, order: number, now = Date.now()): Habit {
  const { key, ...rest } = tpl;
  return {
    ...rest,
    id: newId('h_'),
    updatedAt: now,
    createdAt: now,
    order,
  };
}

export const DEFAULT_PENANCES: Array<{ text: string; severity: 1 | 2 | 3 }> = [
  { text: '50 burpees, hoy, sin negociar', severity: 1 },
  { text: '30 min extra de estudio manana', severity: 1 },
  { text: 'Fin de semana sin videojuegos', severity: 2 },
  { text: '10 EUR a la hucha del que menos te apetezca', severity: 2 },
  { text: 'Sabado de 4h de estudio antes de cualquier plan', severity: 3 },
  { text: 'Mandar el informe de la semana a tu auditor, con los fallos en primera linea', severity: 3 },
];

export const DEFAULT_REWARDS: Array<{ text: string; emoji: string; cadence: 'diaria' | 'semanal' }> = [
  { text: 'Una hora de juego / series', emoji: '🎮', cadence: 'diaria' },
  { text: 'Scroll libre 30 min', emoji: '📱', cadence: 'diaria' },
  { text: 'Comida de capricho', emoji: '🍕', cadence: 'semanal' },
  { text: 'Salir el sabado sin culpa', emoji: '🍻', cadence: 'semanal' },
];

export function createStarterDoc(
  name: string,
  habitKeys: string[] = DEFAULT_HABIT_KEYS,
  now = Date.now(),
): Doc {
  let doc = emptyDoc(now);
  const chosen = habitKeys
    .map((k) => HABIT_CATALOG.find((h) => h.key === k))
    .filter((x): x is HabitTemplate => Boolean(x));

  const habits: Record<string, Habit> = {};
  chosen.forEach((tpl, i) => {
    const h = habitFromTemplate(tpl, i, now);
    habits[h.id] = h;
  });

  const penances: Record<string, Penance> = {};
  for (const p of DEFAULT_PENANCES) {
    const id = newId('pen_');
    penances[id] = { id, updatedAt: now, text: p.text, severity: p.severity, active: false };
  }

  const rewards: Record<string, Reward> = {};
  for (const r of DEFAULT_REWARDS) {
    const id = newId('rw_');
    rewards[id] = { id, updatedAt: now, text: r.text, emoji: r.emoji, cadence: r.cadence, enabled: true };
  }

  doc = { ...doc, habits, penances, rewards };
  return patchProfile(doc, { name, onboarded: true });
}

/** Semestre de ejemplo para ver el planificador funcionando en 5 segundos. */
export function sampleUniversity(doc: Doc, now = Date.now()): Doc {
  const mk = (
    name: string,
    color: string,
    credits: number,
    difficulty: number,
    slots: Array<[number, string, string, Subject['slots'][number]['kind']]>,
  ): Subject => ({
    id: newId('sub_'),
    updatedAt: now,
    name,
    color,
    credits,
    difficulty,
    archived: false,
    slots: slots.map(([day, start, end, kind]) => ({ id: newId('cs_'), day, start, end, kind })),
  });

  const subjects = [
    mk('Calculo II', '#0b6bcb', 6, 5, [
      [1, '09:00', '11:00', 'teoria'],
      [3, '09:00', '11:00', 'teoria'],
      [4, '12:00', '14:00', 'practica'],
    ]),
    mk('Programacion', '#e8730c', 6, 3, [
      [1, '11:30', '13:30', 'teoria'],
      [2, '16:00', '19:00', 'laboratorio'],
    ]),
    mk('Estadistica', '#0e9e8e', 4.5, 4, [
      [2, '09:00', '11:00', 'teoria'],
      [4, '09:00', '11:00', 'practica'],
    ]),
    mk('Ingles tecnico', '#b58400', 3, 2, [[5, '10:00', '12:00', 'seminario']]),
  ];

  const subjectsMap: Doc['subjects'] = {};
  for (const s of subjects) subjectsMap[s.id] = s;

  const base = today(new Date(now));
  const exams: Doc['exams'] = {};
  const addExam = (subjectId: string, title: string, inDays: number, weight: number, hours: number) => {
    const id = newId('ex_');
    const d = new Date(now + inDays * 86_400_000);
    exams[id] = {
      id,
      updatedAt: now,
      subjectId,
      title,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      weight,
      estimatedHours: hours,
      done: false,
      time: '09:00',
    };
  };
  addExam(subjects[0]!.id, 'Parcial 1', 12, 40, 20);
  addExam(subjects[1]!.id, 'Practica evaluable', 20, 30, 12);
  addExam(subjects[2]!.id, 'Control de temas 1-3', 8, 25, 10);

  const tasks: Doc['tasks'] = {};
  const tid = newId('tk_');
  const due = new Date(now + 5 * 86_400_000);
  tasks[tid] = {
    id: tid,
    updatedAt: now,
    subjectId: subjects[1]!.id,
    title: 'Entrega laboratorio 3',
    due: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`,
    estimatedHours: 4,
    priority: 3,
    done: false,
  };

  void base;
  return { ...doc, subjects: subjectsMap, exams, tasks };
}
