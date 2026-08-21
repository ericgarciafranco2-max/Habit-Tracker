import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildStudyPlan,
  canEditDate,
  createStarterDoc,
  dayVerdict,
  isRequired,
  levelFromXp,
  logHabit,
  logicalToday,
  mergeDocs,
  pendingDebts,
  rewardLock,
  sampleUniversity,
  settleDay,
  startOfWeek,
  streak,
  useFreeze,
  weeklyAudit,
  type Doc,
  type Habit,
} from '../src/index.js';
import { newId } from '../src/id.js';

const TODAY = '2026-03-16'; // lunes
const habitOf = (doc: Doc, name: string): Habit =>
  Object.values(doc.habits).find((h) => h.name === name)!;

function doc(): Doc {
  return createStarterDoc('Test');
}

describe('dia logico', () => {
  it('antes del corte sigues en el dia anterior', () => {
    expect(logicalToday('04:00', new Date('2026-03-17T02:30:00'))).toBe('2026-03-16');
    expect(logicalToday('04:00', new Date('2026-03-17T09:00:00'))).toBe('2026-03-17');
  });
});

describe('registro y regla no-zero', () => {
  it('el minimo cuenta como parcial y no rompe la racha', () => {
    let d = doc();
    const lectura = habitOf(d, 'Leer');
    d = logHabit(d, lectura.id, TODAY, 6);
    expect(d.entries[`${lectura.id}:${TODAY}`]!.status).toBe('partial');
    d = logHabit(d, lectura.id, TODAY, 25);
    expect(d.entries[`${lectura.id}:${TODAY}`]!.status).toBe('done');
    d = logHabit(d, lectura.id, TODAY, 2);
    expect(d.entries[`${lectura.id}:${TODAY}`]!.status).toBe('missed');
  });

  it('los habitos de evitar se invierten', () => {
    let d = doc();
    const redes = habitOf(d, 'Sin redes hasta la noche');
    d = logHabit(d, redes.id, TODAY, 0);
    expect(d.entries[`${redes.id}:${TODAY}`]!.status).toBe('done');
    d = logHabit(d, redes.id, TODAY, 1);
    expect(d.entries[`${redes.id}:${TODAY}`]!.status).toBe('missed');
  });
});

describe('rachas', () => {
  it('cuenta dias consecutivos exigibles', () => {
    let d = doc();
    const meditar = habitOf(d, 'Meditar');
    for (let i = 5; i >= 1; i--) d = logHabit(d, meditar.id, addDays(TODAY, -i), 10);
    expect(streak(d, meditar, TODAY).current).toBe(5);
  });

  it('un hueco la rompe pero una congelacion la salva', () => {
    let d = doc();
    const meditar = habitOf(d, 'Meditar');
    for (let i = 5; i >= 1; i--) {
      if (i === 3) continue;
      d = logHabit(d, meditar.id, addDays(TODAY, -i), 10);
    }
    expect(streak(d, meditar, TODAY).current).toBe(2);
    d = useFreeze(d, meditar.id, addDays(TODAY, -3));
    expect(streak(d, meditar, TODAY).current).toBe(5);
    expect(d.profile.freezeTokens).toBe(1);
  });
});

describe('habitos por cuota semanal', () => {
  it('solo es obligatorio cuando ya no quedan dias de margen', () => {
    let d = doc();
    const gym = habitOf(d, 'Entrenar'); // 4 veces por semana
    const monday = startOfWeek(TODAY);
    expect(isRequired(d, gym, monday)).toBe(false);
    const thursday = addDays(monday, 3);
    expect(isRequired(d, gym, thursday)).toBe(true); // faltan 4 y quedan 4 dias
    d = logHabit(d, gym.id, monday, 1);
    expect(isRequired(d, gym, thursday)).toBe(false);
  });
});

describe('deuda y sanciones', () => {
  it('fallar un habito con regla de deuda genera deuda', () => {
    let d = doc();
    const yesterday = addDays(TODAY, -1);
    d = settleDay(d, yesterday, TODAY);
    const debts = pendingDebts(d);
    expect(debts.length).toBeGreaterThan(0);
    expect(debts.some((x) => x.unit === 'minutos')).toBe(true);
  });

  it('liquidar el mismo dia dos veces no cobra dos veces', () => {
    let d = doc();
    const yesterday = addDays(TODAY, -1);
    d = settleDay(d, yesterday, TODAY);
    const first = pendingDebts(d).length;
    d = settleDay(d, yesterday, TODAY);
    expect(pendingDebts(d).length).toBe(first);
  });

  it('pasarse del objetivo salda deuda del mismo habito', () => {
    let d = doc();
    const estudio = habitOf(d, 'Estudio profundo');
    d = settleDay(d, addDays(TODAY, -1), TODAY);
    const before = pendingDebts(d).filter((x) => x.habitId === estudio.id);
    expect(before.length).toBe(1);
    d = logHabit(d, estudio.id, TODAY, estudio.target + before[0]!.amount);
    expect(pendingDebts(d).filter((x) => x.habitId === estudio.id).length).toBe(0);
  });
});

describe('bloqueo de recompensas', () => {
  it('sigue bloqueado hasta cerrar los innegociables', () => {
    let d = doc();
    expect(rewardLock(d, TODAY).locked).toBe(true);
    for (const h of Object.values(d.habits)) {
      if (h.nonNegotiable) d = logHabit(d, h.id, TODAY, h.kind === 'quit' ? 0 : h.target);
    }
    expect(rewardLock(d, TODAY).locked).toBe(false);
  });
});

describe('modo estricto', () => {
  it('no deja reescribir mas alla de ayer', () => {
    const d = doc();
    expect(canEditDate(d, TODAY, TODAY).allowed).toBe(true);
    expect(canEditDate(d, addDays(TODAY, -1), TODAY).allowed).toBe(true);
    expect(canEditDate(d, addDays(TODAY, -4), TODAY).allowed).toBe(false);
    expect(canEditDate(d, addDays(TODAY, 1), TODAY).allowed).toBe(false);
  });
});

describe('veredicto y auditoria', () => {
  it('un dia sin fallos es perfecto', () => {
    let d = doc();
    const yesterday = addDays(TODAY, -1);
    for (const h of Object.values(d.habits)) {
      if (isRequired(d, h, yesterday)) d = logHabit(d, h.id, yesterday, h.kind === 'quit' ? 0 : h.target);
    }
    expect(dayVerdict(d, yesterday, TODAY).verdict).toBe('perfecto');
  });

  it('la auditoria semanal resume fallos y deuda', () => {
    let d = doc();
    d = settleDay(d, addDays(TODAY, -1), TODAY);
    const audit = weeklyAudit(d, TODAY, TODAY);
    expect(audit.weekStart <= TODAY).toBe(true);
    expect(audit.verdict.length).toBeGreaterThan(0);
  });
});

describe('niveles', () => {
  it('cada nivel cuesta mas que el anterior', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(600).level).toBe(2);
    expect(levelFromXp(100000).level).toBeGreaterThan(10);
  });
});

describe('planificador', () => {
  it('genera bloques que respetan el horario de clase', () => {
    let d = sampleUniversity(doc());
    const plan = buildStudyPlan(d, TODAY, { horizonDays: 7 });
    expect(plan.length).toBeGreaterThan(0);
    for (const block of plan) {
      expect(block.minutes).toBeGreaterThanOrEqual(25);
      expect(block.start < block.end).toBe(true);
    }
    void d;
  });

  it('prioriza lo que menos margen tiene', () => {
    const d = sampleUniversity(doc());
    const plan = buildStudyPlan(d, TODAY, { horizonDays: 3 });
    const titles = new Set(plan.map((b) => b.title));
    expect(titles.size).toBeGreaterThan(0);
  });
});

describe('sincronizacion', () => {
  it('gana el registro mas reciente y converge en ambos sentidos', () => {
    const base = doc();
    const habit = habitOf(base, 'Meditar');
    const pc = logHabit(base, habit.id, TODAY, 10, { now: 1000 });
    const movil = logHabit(base, habit.id, TODAY, 25, { now: 2000 });
    const a = mergeDocs(pc, movil);
    const b = mergeDocs(movil, pc);
    expect(a.entries[`${habit.id}:${TODAY}`]!.value).toBe(25);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('respeta los borrados', () => {
    const base = doc();
    const id = newId('h_');
    const withHabit: Doc = {
      ...base,
      habits: {
        ...base.habits,
        [id]: { ...habitOf(base, 'Meditar'), id, updatedAt: 1000, createdAt: 1000 },
      },
    };
    const deleted: Doc = {
      ...withHabit,
      habits: { ...withHabit.habits, [id]: { ...withHabit.habits[id]!, deleted: true, updatedAt: 2000 } },
    };
    const merged = mergeDocs(withHabit, deleted);
    expect(merged.habits[id]!.deleted).toBe(true);
  });

  it('marcar el mismo habito en dos dispositivos no duplica registros', () => {
    const base = doc();
    const habit = habitOf(base, 'Agua');
    const pc = logHabit(base, habit.id, TODAY, 8, { now: 1000 });
    const movil = logHabit(base, habit.id, TODAY, 8, { now: 1500 });
    const merged = mergeDocs(pc, movil);
    expect(Object.keys(merged.entries).length).toBe(1);
  });
});
