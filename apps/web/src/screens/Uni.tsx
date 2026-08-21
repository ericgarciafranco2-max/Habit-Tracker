import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  buildStudyPlan,
  classSlotsFor,
  clockToMinutes,
  examCountdowns,
  formatDateShort,
  list,
  logHabit,
  newId,
  put,
  softDelete,
  startOfWeek,
  WEEKDAY_SHORT,
  weeklyLoad,
  sampleUniversity,
  getEntry,
  type ClassSlot,
  type Exam,
  type StudySession,
  type Subject,
  type Task,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { Bar, Empty, Segmented, Sheet, useConfirm, useToast } from '../components/ui.js';
import { hm } from '../lib/format.js';

type Tab = 'plan' | 'horario' | 'asignaturas' | 'examenes';

const COLORS = ['#7dd3a0', '#8fb8f0', '#f0c987', '#c9a7f5', '#ef7d6a', '#9fd8c8', '#f5a3c7', '#84c5e8'];

export function Uni() {
  const { doc, update } = useStore();
  const [tab, setTab] = useState<Tab>('plan');
  const toast = useToast();

  const hasData = list(doc.subjects).length > 0;

  return (
    <>
      <h1 style={{ marginBottom: 12 }}>Universidad</h1>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'plan', label: 'Plan' },
          { value: 'horario', label: 'Horario' },
          { value: 'asignaturas', label: 'Asignaturas' },
          { value: 'examenes', label: 'Examenes y entregas' },
        ]}
      />

      {!hasData && (
        <div className="banner info">
          <span className="icon">🎓</span>
          <div style={{ flex: 1 }}>
            <b>Sin asignaturas todavia</b>
            <div className="small">
              Mete tu horario real y el planificador repartira el estudio por ti. O carga un semestre de
              ejemplo para ver como funciona.
            </div>
            <button
              className="btn small"
              style={{ marginTop: 8 }}
              onClick={() => {
                update((d) => sampleUniversity(d));
                toast('Semestre de ejemplo cargado. Editalo o borralo cuando quieras.');
              }}
            >
              Cargar ejemplo
            </button>
          </div>
        </div>
      )}

      {tab === 'plan' && <PlanTab />}
      {tab === 'horario' && <TimetableTab />}
      {tab === 'asignaturas' && <SubjectsTab />}
      {tab === 'examenes' && <ExamsTab />}
    </>
  );
}

/* ------------------------------ Plan ------------------------------ */

function PlanTab() {
  const { doc, today } = useStore();
  const [days, setDays] = useState(7);
  const plan = useMemo(() => buildStudyPlan(doc, today, { horizonDays: days }), [doc, today, days]);
  const countdowns = useMemo(() => examCountdowns(doc, today), [doc, today]);
  const load = useMemo(() => weeklyLoad(doc, startOfWeek(today)), [doc, today]);

  const byDate = useMemo(() => {
    const map = new Map<string, typeof plan>();
    for (const b of plan) {
      const arr = map.get(b.date) ?? [];
      arr.push(b);
      map.set(b.date, arr);
    }
    return map;
  }, [plan]);

  return (
    <>
      <Pomodoro />

      {countdowns.length > 0 && (
        <>
          <div className="section-label">Cuenta atras</div>
          <div className="scroll-x">
            {countdowns.map((c) => (
              <div
                key={c.exam.id}
                className="card"
                style={{ minWidth: 168, marginBottom: 0, borderLeft: `3px solid ${c.subject?.color ?? 'var(--accent)'}` }}
              >
                <div className="tiny faint">{c.subject?.name}</div>
                <div className="bold" style={{ margin: '2px 0' }}>
                  {c.exam.title}
                </div>
                <div
                  style={{ fontSize: '1.6rem', fontWeight: 700, color: c.daysLeft <= 3 ? 'var(--danger)' : undefined }}
                >
                  {c.daysLeft}
                  <span className="tiny faint"> dias</span>
                </div>
                <div className="tiny faint" style={{ marginBottom: 4 }}>
                  {hm(c.studiedMinutes)} de {hm(c.neededMinutes)}
                </div>
                <Bar value={c.readiness} color={c.readiness < 0.5 ? 'var(--warn)' : 'var(--accent)'} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Carga de la semana</div>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 90 }}>
          {load.map((l) => {
            const total = l.classMinutes + l.studyMinutes;
            const max = Math.max(...load.map((x) => x.classMinutes + x.studyMinutes), 60);
            return (
              <div key={l.date} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  style={{
                    height: `${(total / max) * 62}px`,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                  title={`Clase ${hm(l.classMinutes)} · Estudio ${hm(l.studyMinutes)}`}
                >
                  <div style={{ height: `${(l.classMinutes / (total || 1)) * 100}%`, background: 'var(--info)' }} />
                  <div style={{ height: `${(l.studyMinutes / (total || 1)) * 100}%`, background: 'var(--accent)' }} />
                </div>
                <div className="tiny faint">{WEEKDAY_SHORT[new Date(l.date).getDay()]}</div>
              </div>
            );
          })}
        </div>
        <div className="row tiny faint" style={{ marginTop: 6, justifyContent: 'center', gap: 14 }}>
          <span>
            <i style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--info)', borderRadius: 2 }} /> clase
          </span>
          <span>
            <i style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--accent)', borderRadius: 2 }} /> estudio
          </span>
        </div>
      </div>

      <div className="row" style={{ margin: '18px 0 8px' }}>
        <div className="section-label" style={{ margin: 0, flex: 1 }}>
          Bloques planificados
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 110 }}>
          <option value={3}>3 dias</option>
          <option value={7}>7 dias</option>
          <option value={14}>14 dias</option>
        </select>
      </div>

      {plan.length === 0 ? (
        <Empty text="Nada que planificar: añade examenes o entregas con fecha." />
      ) : (
        [...byDate.entries()].map(([date, blocks]) => (
          <div className="card" key={date}>
            <div className="card-head">
              <h3 style={{ textTransform: 'capitalize' }}>
                {date === today ? 'Hoy' : formatDateShort(date)}
              </h3>
              <span className="chip">{hm(blocks.reduce((a, b) => a + b.minutes, 0))}</span>
            </div>
            <div className="timeline">
              {blocks.map((b, i) => (
                <div className="slot" key={i}>
                  <div className="time">{b.start}</div>
                  <div className="block" style={{ borderLeftColor: b.color }}>
                    <div className="t">{b.title}</div>
                    <div className="m">
                      {b.subjectName} · {b.start}-{b.end} · {b.kind}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      <p className="tiny faint">
        El plan se recalcula solo: prioriza lo que menos margen tiene y evita mas de dos bloques
        seguidos de la misma asignatura. Si lo cumples, no llegas a examen en frio.
      </p>
    </>
  );
}

/* ---------------------------- Pomodoro ---------------------------- */

function Pomodoro() {
  const { doc, today, update } = useStore();
  const toast = useToast();
  const subjects = list(doc.subjects).filter((s) => !s.archived);
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(doc.profile.pomodoroMinutes * 60);
  const startedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          window.clearInterval(t);
          setRunning(false);
          finish(doc.profile.pomodoroMinutes);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const finish = (minutes: number) => {
    if (minutes < 1) return;
    const id = newId('ss_');
    const session: StudySession = {
      id,
      updatedAt: Date.now(),
      subjectId: subjectId || undefined,
      date: today,
      minutes,
      technique: 'pomodoro',
      focus: 4,
    };
    update((d) => {
      let next = put(d, 'sessions', session);
      // El tiempo estudiado alimenta el habito de estudio automaticamente.
      const study = list(next.habits).find((h) => h.measure === 'minutes' && h.category === 'estudio');
      if (study) {
        const current = getEntry(next, study.id, today)?.value ?? 0;
        next = logHabit(next, study.id, today, current + minutes);
      }
      return next;
    });
    toast(`${minutes} min registrados. Van al habito de estudio.`);
    if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
    if (Notification?.permission === 'granted') {
      new Notification('Bloque terminado', { body: `${minutes} minutos. Descansa ${doc.profile.breakMinutes}.` });
    }
  };

  const mins = Math.floor(left / 60);
  const secs = left % 60;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Bloque de estudio</h3>
        {subjects.length > 0 && (
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: 150 }}>
            <option value="">Sin asignatura</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="timer-display" style={{ color: running ? 'var(--accent)' : undefined }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <button className="btn primary" style={{ flex: 1 }} onClick={() => setRunning((r) => !r)}>
          {running ? 'Pausar' : 'Empezar'}
        </button>
        <button
          className="btn"
          onClick={() => {
            const elapsed = Math.round((doc.profile.pomodoroMinutes * 60 - left) / 60);
            setRunning(false);
            setLeft(doc.profile.pomodoroMinutes * 60);
            startedRef.current = null;
            if (elapsed >= 5) finish(elapsed);
          }}
        >
          Terminar
        </button>
      </div>
      <p className="tiny faint" style={{ marginTop: 8 }}>
        Movil fuera de la mesa. Al terminar, los minutos se suman solos a tu habito de estudio.
      </p>
    </div>
  );
}

/* ---------------------------- Horario ----------------------------- */

function TimetableTab() {
  const { doc } = useStore();
  const days = [1, 2, 3, 4, 5, 6, 0];
  const rows = days.map((d) => {
    const date = addDays(startOfWeek(new Date().toISOString().slice(0, 10)), d === 0 ? 6 : d - 1);
    return { day: d, slots: classSlotsFor(doc, date) };
  });
  const anySlot = rows.some((r) => r.slots.length);

  return (
    <div className="card">
      {!anySlot && <Empty text="Sin clases registradas. Añadelas dentro de cada asignatura." />}
      {rows.map((r) =>
        r.slots.length ? (
          <div key={r.day} style={{ marginBottom: 14 }}>
            <div className="section-label" style={{ marginTop: 0 }}>
              {['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'][r.day]}
            </div>
            {r.slots
              .sort((a, b) => clockToMinutes(a.start) - clockToMinutes(b.start))
              .map((s) => (
                <div className="list-item" key={s.id}>
                  <span className="mono tiny faint" style={{ width: 82 }}>
                    {s.start}-{s.end}
                  </span>
                  <span className="dot" style={{ width: 8, height: 8, borderRadius: 4, background: s.subject.color }} />
                  <div style={{ flex: 1 }}>
                    <div className="small bold">{s.subject.name}</div>
                    <div className="tiny faint">
                      {s.kind}
                      {s.room ? ` · ${s.room}` : ''}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : null,
      )}
    </div>
  );
}

/* -------------------------- Asignaturas --------------------------- */

function SubjectsTab() {
  const { doc, update } = useStore();
  const [editing, setEditing] = useState<Subject | null>(null);
  const { confirm, node } = useConfirm();
  const subjects = list(doc.subjects).filter((s) => !s.archived);

  const blank = (): Subject => ({
    id: newId('sub_'),
    updatedAt: Date.now(),
    name: '',
    color: COLORS[subjects.length % COLORS.length]!,
    credits: 6,
    difficulty: 3,
    slots: [],
    archived: false,
  });

  return (
    <>
      {node}
      <button className="btn primary block" style={{ marginBottom: 12 }} onClick={() => setEditing(blank())}>
        + Nueva asignatura
      </button>
      {subjects.map((s) => (
        <div className="card" key={s.id} style={{ borderLeft: `3px solid ${s.color}` }}>
          <div className="card-head">
            <h3>{s.name}</h3>
            <span className="chip tiny">{s.credits} ECTS</span>
            <button className="btn ghost small" onClick={() => setEditing(s)}>
              Editar
            </button>
          </div>
          <div className="tiny faint">
            Dificultad {s.difficulty}/5 · {s.slots.length} clase(s) a la semana
          </div>
          <div className="row wrap" style={{ marginTop: 6 }}>
            {s.slots.map((sl) => (
              <span className="chip tiny" key={sl.id}>
                {WEEKDAY_SHORT[sl.day]} {sl.start}-{sl.end}
              </span>
            ))}
          </div>
        </div>
      ))}
      {!subjects.length && <Empty text="Sin asignaturas" />}

      {editing && (
        <SubjectSheet
          subject={editing}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            update((d) => put(d, 'subjects', s));
            setEditing(null);
          }}
          onDelete={async (s) => {
            const ok = await confirm('Borrar asignatura', `Se borrara "${s.name}" y sus clases.`, 'Borrar');
            if (!ok) return;
            update((d) => softDelete(d, 'subjects', s.id));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function SubjectSheet({
  subject,
  onClose,
  onSave,
  onDelete,
}: {
  subject: Subject;
  onClose: () => void;
  onSave: (s: Subject) => void;
  onDelete: (s: Subject) => void;
}) {
  const [s, setS] = useState<Subject>(subject);
  const set = <K extends keyof Subject>(k: K, v: Subject[K]) => setS({ ...s, [k]: v });

  const addSlot = () => {
    const slot: ClassSlot = { id: newId('cs_'), day: 1, start: '09:00', end: '11:00', kind: 'teoria' };
    set('slots', [...s.slots, slot]);
  };
  const updateSlot = (id: string, patch: Partial<ClassSlot>) =>
    set('slots', s.slots.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <Sheet
      title={subject.name ? 'Editar asignatura' : 'Nueva asignatura'}
      onClose={onClose}
      footer={
        <div className="row">
          {subject.name && (
            <button className="btn danger small" onClick={() => onDelete(s)}>
              Borrar
            </button>
          )}
          <div className="spacer" />
          <button className="btn primary" disabled={!s.name.trim()} onClick={() => onSave(s)}>
            Guardar
          </button>
        </div>
      }
    >
      <label className="field">
        <span>Nombre</span>
        <input type="text" value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="Calculo II" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Creditos</span>
          <input type="number" value={s.credits} onChange={(e) => set('credits', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Dificultad 1-5</span>
          <input
            type="number"
            min={1}
            max={5}
            value={s.difficulty}
            onChange={(e) => set('difficulty', Number(e.target.value))}
          />
        </label>
      </div>
      <label className="field">
        <span>Color</span>
        <div className="row wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => set('color', c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: c,
                border: s.color === c ? '2px solid var(--text)' : '1px solid var(--line)',
              }}
              aria-label={c}
            />
          ))}
        </div>
      </label>

      <div className="section-label">Clases</div>
      {s.slots.map((sl) => (
        <div className="row" key={sl.id} style={{ marginBottom: 8, gap: 6 }}>
          <select value={sl.day} onChange={(e) => updateSlot(sl.id, { day: Number(e.target.value) })} style={{ width: 74 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_SHORT[d]}
              </option>
            ))}
          </select>
          <input type="time" value={sl.start} onChange={(e) => updateSlot(sl.id, { start: e.target.value })} />
          <input type="time" value={sl.end} onChange={(e) => updateSlot(sl.id, { end: e.target.value })} />
          <button className="btn ghost small" onClick={() => set('slots', s.slots.filter((x) => x.id !== sl.id))}>
            ✕
          </button>
        </div>
      ))}
      <button className="btn small block" onClick={addSlot}>
        + Añadir clase
      </button>
    </Sheet>
  );
}

/* ------------------------ Examenes y tareas ----------------------- */

function ExamsTab() {
  const { doc, today, update } = useStore();
  const [exam, setExam] = useState<Exam | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const subjects = list(doc.subjects).filter((s) => !s.archived);
  const exams = list(doc.exams).sort((a, b) => a.date.localeCompare(b.date));
  const tasks = list(doc.tasks).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));

  return (
    <>
      <div className="row" style={{ marginBottom: 12, gap: 8 }}>
        <button
          className="btn primary"
          style={{ flex: 1 }}
          disabled={!subjects.length}
          onClick={() =>
            setExam({
              id: newId('ex_'),
              updatedAt: Date.now(),
              subjectId: subjects[0]!.id,
              title: '',
              date: addDays(today, 14),
              weight: 30,
              estimatedHours: 12,
              done: false,
            })
          }
        >
          + Examen
        </button>
        <button
          className="btn"
          style={{ flex: 1 }}
          onClick={() =>
            setTask({
              id: newId('tk_'),
              updatedAt: Date.now(),
              subjectId: subjects[0]?.id,
              title: '',
              due: addDays(today, 7),
              estimatedHours: 3,
              priority: 2,
              done: false,
            })
          }
        >
          + Entrega
        </button>
      </div>

      <div className="section-label">Examenes</div>
      <div className="card">
        {exams.length ? (
          exams.map((e) => {
            const s = doc.subjects[e.subjectId];
            return (
              <div className="list-item" key={e.id}>
                <span className="dot" style={{ width: 8, height: 8, borderRadius: 4, background: s?.color ?? 'var(--accent)' }} />
                <button
                  style={{ flex: 1, background: 'none', border: 0, textAlign: 'left', padding: 0 }}
                  onClick={() => setExam(e)}
                >
                  <div className="small bold" style={{ textDecoration: e.done ? 'line-through' : undefined }}>
                    {e.title || 'Sin titulo'}
                  </div>
                  <div className="tiny faint">
                    {s?.name} · {e.date} · {e.weight}% · {e.estimatedHours}h estimadas
                    {e.grade != null && ` · nota ${e.grade}`}
                  </div>
                </button>
                <input
                  type="checkbox"
                  checked={e.done}
                  style={{ width: 18, height: 18 }}
                  onChange={() => update((d) => put(d, 'exams', { ...e, done: !e.done }))}
                />
              </div>
            );
          })
        ) : (
          <Empty text="Sin examenes" />
        )}
      </div>

      <div className="section-label">Entregas y tareas</div>
      <div className="card">
        {tasks.length ? (
          tasks.map((t) => {
            const s = t.subjectId ? doc.subjects[t.subjectId] : undefined;
            const late = t.due && t.due < today && !t.done;
            return (
              <div className="list-item" key={t.id}>
                <input
                  type="checkbox"
                  checked={t.done}
                  style={{ width: 18, height: 18 }}
                  onChange={() =>
                    update((d) => put(d, 'tasks', { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now() }))
                  }
                />
                <button
                  style={{ flex: 1, background: 'none', border: 0, textAlign: 'left', padding: 0 }}
                  onClick={() => setTask(t)}
                >
                  <div className="small bold" style={{ textDecoration: t.done ? 'line-through' : undefined }}>
                    {t.title || 'Sin titulo'}
                  </div>
                  <div className="tiny" style={{ color: late ? 'var(--danger)' : 'var(--text-faint)' }}>
                    {s?.name ?? 'General'} · {t.due ?? 'sin fecha'} · {t.estimatedHours}h
                    {late && ' · FUERA DE PLAZO'}
                  </div>
                </button>
              </div>
            );
          })
        ) : (
          <Empty text="Sin entregas" />
        )}
      </div>

      {exam && (
        <ExamSheet
          exam={exam}
          subjects={subjects}
          onClose={() => setExam(null)}
          onSave={(e) => {
            update((d) => put(d, 'exams', e));
            setExam(null);
          }}
          onDelete={(e) => {
            update((d) => softDelete(d, 'exams', e.id));
            setExam(null);
          }}
        />
      )}
      {task && (
        <TaskSheet
          task={task}
          subjects={subjects}
          onClose={() => setTask(null)}
          onSave={(t) => {
            update((d) => put(d, 'tasks', t));
            setTask(null);
          }}
          onDelete={(t) => {
            update((d) => softDelete(d, 'tasks', t.id));
            setTask(null);
          }}
        />
      )}
    </>
  );
}

function ExamSheet({
  exam,
  subjects,
  onClose,
  onSave,
  onDelete,
}: {
  exam: Exam;
  subjects: Subject[];
  onClose: () => void;
  onSave: (e: Exam) => void;
  onDelete: (e: Exam) => void;
}) {
  const [e, setE] = useState<Exam>(exam);
  const set = <K extends keyof Exam>(k: K, v: Exam[K]) => setE({ ...e, [k]: v });
  return (
    <Sheet
      title="Examen"
      onClose={onClose}
      footer={
        <div className="row">
          <button className="btn danger small" onClick={() => onDelete(e)}>
            Borrar
          </button>
          <div className="spacer" />
          <button className="btn primary" disabled={!e.title.trim()} onClick={() => onSave(e)}>
            Guardar
          </button>
        </div>
      }
    >
      <label className="field">
        <span>Titulo</span>
        <input type="text" value={e.title} onChange={(ev) => set('title', ev.target.value)} placeholder="Parcial 1" />
      </label>
      <label className="field">
        <span>Asignatura</span>
        <select value={e.subjectId} onChange={(ev) => set('subjectId', ev.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Fecha</span>
          <input type="date" value={e.date} onChange={(ev) => set('date', ev.target.value)} />
        </label>
        <label className="field">
          <span>Peso %</span>
          <input type="number" value={e.weight} onChange={(ev) => set('weight', Number(ev.target.value))} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Horas de estudio necesarias</span>
          <input
            type="number"
            value={e.estimatedHours}
            onChange={(ev) => set('estimatedHours', Number(ev.target.value))}
          />
        </label>
        <label className="field">
          <span>Nota (si ya lo hiciste)</span>
          <input
            type="number"
            step="0.1"
            value={e.grade ?? ''}
            onChange={(ev) => set('grade', ev.target.value === '' ? undefined : Number(ev.target.value))}
          />
        </label>
      </div>
      <p className="tiny faint">
        Las horas estimadas son lo que el planificador reparte por los dias que quedan. Se honesto: si
        pones 4 horas para un parcial, el plan sera igual de flojo.
      </p>
    </Sheet>
  );
}

function TaskSheet({
  task,
  subjects,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  subjects: Subject[];
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const [t, setT] = useState<Task>(task);
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setT({ ...t, [k]: v });
  return (
    <Sheet
      title="Entrega"
      onClose={onClose}
      footer={
        <div className="row">
          <button className="btn danger small" onClick={() => onDelete(t)}>
            Borrar
          </button>
          <div className="spacer" />
          <button className="btn primary" disabled={!t.title.trim()} onClick={() => onSave(t)}>
            Guardar
          </button>
        </div>
      }
    >
      <label className="field">
        <span>Titulo</span>
        <input type="text" value={t.title} onChange={(e) => set('title', e.target.value)} placeholder="Practica 3" />
      </label>
      <label className="field">
        <span>Asignatura</span>
        <select value={t.subjectId ?? ''} onChange={(e) => set('subjectId', e.target.value || undefined)}>
          <option value="">General</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Fecha limite</span>
          <input type="date" value={t.due ?? ''} onChange={(e) => set('due', e.target.value)} />
        </label>
        <label className="field">
          <span>Horas</span>
          <input type="number" value={t.estimatedHours} onChange={(e) => set('estimatedHours', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Prioridad</span>
          <select value={t.priority} onChange={(e) => set('priority', Number(e.target.value) as 1 | 2 | 3)}>
            <option value={1}>Baja</option>
            <option value={2}>Media</option>
            <option value={3}>Alta</option>
          </select>
        </label>
      </div>
    </Sheet>
  );
}
