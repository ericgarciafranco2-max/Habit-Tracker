/**
 * Modelo de datos del Habit Tracker.
 *
 * Todo el estado del usuario vive en un unico documento (`Doc`) formado por
 * colecciones de registros. Cada registro lleva `updatedAt` y `deleted` para
 * que la sincronizacion PC <-> movil pueda mezclar cambios sin servidor
 * autoritativo: gana la version mas reciente de cada registro.
 */

export type ID = string;
/** Fecha local en formato YYYY-MM-DD. */
export type ISODate = string;
/** Hora local en formato HH:MM. */
export type Clock = string;

export interface Record_ {
  id: ID;
  updatedAt: number;
  deleted?: boolean;
}

export type Category =
  | 'salud'
  | 'mente'
  | 'estudio'
  | 'disciplina'
  | 'social'
  | 'finanzas'
  | 'otro';

export type Measure = 'check' | 'quantity' | 'minutes';
export type HabitKind = 'build' | 'quit';

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekdays' }
  | { type: 'weekend' }
  | { type: 'custom'; days: number[] } // 0=domingo ... 6=sabado
  | { type: 'timesPerWeek'; timesPerWeek: number }
  | { type: 'classDays' }
  | { type: 'freeDays' };

export interface DebtRule {
  /** Cuanto se acumula a la deuda por cada fallo. */
  amount: number;
  unit: 'minutos' | 'repeticiones' | 'sesiones' | 'euros' | 'paginas';
}

export interface Habit extends Record_ {
  name: string;
  emoji: string;
  color: string;
  category: Category;
  kind: HabitKind;
  measure: Measure;
  /** Objetivo diario. Para `check` siempre es 1. */
  target: number;
  unit?: string;
  /** Regla "no-zero": version minima que sigue contando y salva la racha. */
  minimum: number;
  schedule: Schedule;
  /** Ventana horaria en la que cuenta (opcional pero recomendada). */
  windowStart?: Clock;
  windowEnd?: Clock;
  reminders: Clock[];
  /** Innegociable: bloquea recompensas y el cierre del dia si falla. */
  nonNegotiable: boolean;
  /** Peso 1-5: cuanto XP vale y cuanto duele fallarlo. */
  weight: number;
  debtRule?: DebtRule;
  notes?: string;
  order: number;
  archived: boolean;
  /** Blindaje anti-abandono: fecha en la que se pidio retirar el habito. */
  retireRequestedAt?: number;
  createdAt: number;
}

export type EntryStatus = 'done' | 'partial' | 'missed' | 'frozen';

export interface Entry extends Record_ {
  /** id = `${habitId}:${date}` */
  habitId: ID;
  date: ISODate;
  value: number;
  status: EntryStatus;
  note?: string;
  /** Momento real del registro (para detectar retoques tardios). */
  loggedAt: number;
  /** true si se edito mas de 24h despues del dia al que pertenece. */
  editedLate?: boolean;
}

export interface DayLog extends Record_ {
  /** id = fecha */
  date: ISODate;
  mood?: number; // 1-5
  energy?: number; // 1-5
  sleepHours?: number;
  /** Ritual de apertura: las 3 cosas innegociables del dia. */
  mustDo: string[];
  openedAt?: number;
  /** Ritual de cierre. */
  closedAt?: number;
  reflection?: string;
  win?: string;
  friction?: string;
}

export interface Milestone {
  id: ID;
  title: string;
  due?: ISODate;
  done: boolean;
}

export interface Goal extends Record_ {
  title: string;
  why: string;
  category: Category;
  deadline?: ISODate;
  /** Metrica objetivo, p.ej. 100 (kg), 8.5 (nota media). */
  metricTarget?: number;
  metricCurrent?: number;
  metricUnit?: string;
  habitIds: ID[];
  milestones: Milestone[];
  status: 'activo' | 'logrado' | 'abandonado';
  createdAt: number;
}

export interface ClassSlot {
  id: ID;
  day: number; // 0-6
  start: Clock;
  end: Clock;
  room?: string;
  kind: 'teoria' | 'practica' | 'laboratorio' | 'seminario' | 'tutoria';
}

export interface Subject extends Record_ {
  name: string;
  code?: string;
  color: string;
  credits: number;
  /** 1 = facil, 5 = te va a costar. Sube la prioridad en el planificador. */
  difficulty: number;
  targetGrade?: number;
  slots: ClassSlot[];
  archived: boolean;
}

export interface Exam extends Record_ {
  subjectId: ID;
  title: string;
  date: ISODate;
  time?: Clock;
  /** Peso sobre la nota final (0-100). */
  weight: number;
  grade?: number;
  /** Horas de estudio que estimas necesarias. */
  estimatedHours: number;
  done: boolean;
}

export interface Task extends Record_ {
  subjectId?: ID;
  title: string;
  due?: ISODate;
  estimatedHours: number;
  priority: 1 | 2 | 3;
  done: boolean;
  doneAt?: number;
}

export interface StudySession extends Record_ {
  subjectId?: ID;
  date: ISODate;
  minutes: number;
  technique: 'pomodoro' | 'deep-work' | 'repaso' | 'ejercicios' | 'clase';
  focus: number; // 1-5
  note?: string;
}

/** Contrato de compromiso: la pieza que convierte intencion en consecuencia. */
export interface Contract extends Record_ {
  title: string;
  startDate: ISODate;
  endDate: ISODate;
  /** Habitos innegociables cubiertos por el contrato. */
  habitIds: ID[];
  /** Minimo % de cumplimiento semanal exigido. */
  weeklyThreshold: number;
  stakeType: 'dinero' | 'prenda' | 'social' | 'privilegio';
  stakeAmount?: number;
  stakeDescription: string;
  /** Persona que te audita. Recibe el informe semanal. */
  refereeName?: string;
  refereeEmail?: string;
  signedAt?: number;
  signature?: string;
  status: 'borrador' | 'activo' | 'cumplido' | 'roto';
  /** Blindaje: no se puede suavizar el contrato antes de esta fecha. */
  lockedUntil?: ISODate;
}

export interface Debt extends Record_ {
  habitId?: ID;
  date: ISODate;
  amount: number;
  unit: string;
  reason: string;
  paid: boolean;
  paidAt?: number;
}

/** Penitencia: lo que te toca hacer cuando acumulas 3 fallos. */
export interface Penance extends Record_ {
  text: string;
  severity: 1 | 2 | 3;
  assignedAt?: number;
  doneAt?: number;
  active: boolean;
}

/** Recompensa bloqueada hasta cumplir los innegociables del dia. */
export interface Reward extends Record_ {
  text: string;
  emoji: string;
  /** 'diaria' se desbloquea cada dia; 'semanal' con el objetivo semanal. */
  cadence: 'diaria' | 'semanal';
  enabled: boolean;
}

export type LedgerKind =
  | 'xp'
  | 'racha-rota'
  | 'sancion'
  | 'deuda-creada'
  | 'deuda-pagada'
  | 'congelacion-usada'
  | 'edicion-tardia'
  | 'contrato'
  | 'nivel';

export interface LedgerEvent extends Record_ {
  date: ISODate;
  kind: LedgerKind;
  amount?: number;
  text: string;
}

export interface Profile extends Record_ {
  name: string;
  /** Hora a la que el dia se cierra automaticamente y se evalua. */
  dayCutoff: Clock;
  wakeTime: Clock;
  sleepTime: Clock;
  /** Congelaciones disponibles (salvan una racha). Se ganan, no se regalan. */
  freezeTokens: number;
  freezeTokensUsedThisMonth: number;
  freezeMonth: string; // YYYY-MM
  xp: number;
  /** Modo estricto: prohibe editar dias pasados y saltarse rituales. */
  strictMode: boolean;
  /** Minutos de estudio objetivo al dia (dias de clase / dias libres). */
  studyMinutesClassDay: number;
  studyMinutesFreeDay: number;
  pomodoroMinutes: number;
  breakMinutes: number;
  onboarded: boolean;
  theme: 'dark' | 'light';
  createdAt: number;
}

export interface Doc {
  schema: number;
  profile: Profile;
  habits: Record<ID, Habit>;
  entries: Record<ID, Entry>;
  days: Record<ID, DayLog>;
  goals: Record<ID, Goal>;
  subjects: Record<ID, Subject>;
  exams: Record<ID, Exam>;
  tasks: Record<ID, Task>;
  sessions: Record<ID, StudySession>;
  contracts: Record<ID, Contract>;
  debts: Record<ID, Debt>;
  penances: Record<ID, Penance>;
  rewards: Record<ID, Reward>;
  ledger: Record<ID, LedgerEvent>;
}

export type CollectionName = Exclude<keyof Doc, 'schema' | 'profile'>;

export const COLLECTIONS: CollectionName[] = [
  'habits',
  'entries',
  'days',
  'goals',
  'subjects',
  'exams',
  'tasks',
  'sessions',
  'contracts',
  'debts',
  'penances',
  'rewards',
  'ledger',
];
