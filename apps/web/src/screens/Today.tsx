import { useMemo, useState } from 'react';
import {
  activePenance,
  buildStudyPlan,
  closeDay,
  completePenance,
  dayScore,
  dayVerdict,
  debtSummary,
  formatDateLong,
  habitsForDate,
  isRequired,
  levelFromXp,
  list,
  openDay,
  payDebt,
  pendingDebts,
  rewardLock,
  ritualState,
  addDays,
  type Doc,
  type Habit,
  type ISODate,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { HabitRow } from '../components/HabitRow.js';
import { Empty, Ring, Sheet, Stat, useToast } from '../components/ui.js';
import { hm, pct, verdictColor } from '../lib/format.js';

export function Today({ onEditHabit, go }: { onEditHabit: (h: Habit) => void; go: (v: string) => void }) {
  const { doc, today, update } = useStore();
  const [date, setDate] = useState<ISODate>(today);
  const [openRitual, setOpenRitual] = useState(false);
  const [closeRitual, setCloseRitual] = useState(false);
  const toast = useToast();

  const score = dayScore(doc, date);
  const verdict = dayVerdict(doc, date, today);
  const level = levelFromXp(doc.profile.xp);
  const lock = rewardLock(doc, date);
  const ritual = ritualState(doc, date);
  const penance = activePenance(doc);
  const debts = pendingDebts(doc);
  const debtsByUnit = debtSummary(doc);
  const day = doc.days[date];

  const habits = useMemo(() => habitsForDate(doc, date), [doc, date]);
  const required = habits.filter((h) => isRequired(doc, h, date));
  const optional = habits.filter((h) => !isRequired(doc, h, date));

  const plan = useMemo(
    () => buildStudyPlan(doc, date, { horizonDays: 1 }),
    [doc, date],
  );

  const isToday = date === today;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
          ‹
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.05rem' }}>{isToday ? 'Hoy' : formatDateLong(date)}</h1>
          <div className="tiny faint">{isToday ? formatDateLong(date) : ''}</div>
        </div>
        <button
          className="btn ghost small"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="Dia siguiente"
        >
          ›
        </button>
      </div>

      {/* ------------------------- Resumen ------------------------- */}
      <div className="card">
        <div className="row" style={{ gap: 16 }}>
          <Ring
            value={score.rate}
            sub={`${score.completed}/${score.required}`}
            color={verdictColor(verdict.verdict)}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ marginBottom: 6 }}>
              <span className="chip" style={{ borderColor: verdictColor(verdict.verdict), color: verdictColor(verdict.verdict) }}>
                {verdict.verdict.toUpperCase()}
              </span>
              <span className="chip">Nivel {level.level} · {level.title}</span>
            </div>
            <div className="tiny faint" style={{ marginBottom: 4 }}>
              {level.xpInLevel} / {level.xpForNext} XP para el siguiente nivel
            </div>
            <div className="bar">
              <span style={{ width: `${level.progress * 100}%` }} />
            </div>
            <div className="tiny faint" style={{ marginTop: 8 }}>
              {score.xp} XP en juego hoy · {doc.profile.freezeTokens} congelaciones
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------ Presion -------------------------- */}
      {penance && (
        <div className="banner danger">
          <span className="icon">⚖️</span>
          <div style={{ flex: 1 }}>
            <b>Penitencia activa</b>
            <div className="small">{penance.text}</div>
            <button
              className="btn small primary"
              style={{ marginTop: 8 }}
              onClick={() => {
                update((d) => completePenance(d, penance.id, today));
                toast('Penitencia cumplida. Cuenta a cero.');
              }}
            >
              Cumplida
            </button>
          </div>
        </div>
      )}

      {debtsByUnit.length > 0 && (
        <div className="banner warn">
          <span className="icon">📉</span>
          <div style={{ flex: 1 }}>
            <b>Deuda pendiente</b>
            <div className="small">
              {debtsByUnit.map((d) => `${d.amount} ${d.unit}`).join(' · ')} de {debts.length} fallo(s).
              Se paga haciendo de mas, no olvidandola.
            </div>
            <button className="btn small" style={{ marginTop: 8 }} onClick={() => go('presion')}>
              Ver deuda
            </button>
          </div>
        </div>
      )}

      {isToday && ritual.needsOpen && (
        <div className="banner info">
          <span className="icon">🌅</span>
          <div style={{ flex: 1 }}>
            <b>El dia no esta abierto</b>
            <div className="small">Dos minutos: elige las 3 cosas que hoy no se negocian.</div>
            <button className="btn small primary" style={{ marginTop: 8 }} onClick={() => setOpenRitual(true)}>
              Abrir el dia
            </button>
          </div>
        </div>
      )}

      {day?.mustDo?.length ? (
        <div className="card">
          <div className="card-head">
            <h3>Las 3 de hoy</h3>
            <button className="btn ghost small" onClick={() => setOpenRitual(true)}>
              Editar
            </button>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {day.mustDo.map((m, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {m}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* ------------------------- Habitos ------------------------- */}
      <div className="section-label">Innegociables y obligatorios de hoy</div>
      <div className="card flush">
        {required.length ? (
          required.map((h) => (
            <HabitRow key={h.id} doc={doc} habit={h} date={date} today={today} update={update} onEdit={onEditHabit} />
          ))
        ) : (
          <Empty text="Hoy no tienes nada obligatorio. Sospechoso." />
        )}
      </div>

      {optional.length > 0 && (
        <>
          <div className="section-label">Opcionales (suman, no obligan)</div>
          <div className="card flush">
            {optional.map((h) => (
              <HabitRow key={h.id} doc={doc} habit={h} date={date} today={today} update={update} onEdit={onEditHabit} />
            ))}
          </div>
        </>
      )}

      {/* --------------------- Plan de estudio --------------------- */}
      {plan.length > 0 && (
        <>
          <div className="section-label">Plan de estudio de hoy</div>
          <div className="card">
            <div className="timeline">
              {plan.slice(0, 6).map((b, i) => (
                <div className="slot" key={i}>
                  <div className="time">{b.start}</div>
                  <div className="block" style={{ borderLeftColor: b.color }}>
                    <div className="t">{b.title}</div>
                    <div className="m">
                      {b.subjectName} · {hm(b.minutes)} · {b.kind}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn small block" style={{ marginTop: 8 }} onClick={() => go('uni')}>
              Ir al planificador
            </button>
          </div>
        </>
      )}

      {/* ----------------------- Recompensas ----------------------- */}
      <div className="section-label">Recompensas</div>
      <div className={`card ${lock.locked ? 'locked' : ''}`}>
        <div className="row" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: '1.2rem' }}>{lock.locked ? '🔒' : '🔓'}</span>
          <b>{lock.locked ? 'Bloqueadas' : 'Desbloqueadas'}</b>
        </div>
        <div className="small muted">{lock.reason}</div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          {list(doc.rewards)
            .filter((r) => r.enabled)
            .map((r) => (
              <span key={r.id} className={`chip ${lock.locked ? '' : 'on'}`}>
                {r.emoji} {r.text}
              </span>
            ))}
        </div>
      </div>

      {/* ------------------------- Cierre -------------------------- */}
      {isToday && (
        <button
          className="btn primary block"
          style={{ marginTop: 6, padding: '13px' }}
          onClick={() => setCloseRitual(true)}
        >
          {day?.closedAt ? 'Revisar el cierre del dia' : 'Cerrar el dia'}
        </button>
      )}
      {isToday && ritual.needsClose && (
        <p className="tiny faint center" style={{ marginTop: 8 }}>
          El dia se liquida solo a las {doc.profile.dayCutoff}. Lo que no este marcado, cuenta como fallo.
        </p>
      )}

      {openRitual && <OpenRitual doc={doc} date={date} update={update} onClose={() => setOpenRitual(false)} />}
      {closeRitual && (
        <CloseRitual
          doc={doc}
          date={date}
          today={today}
          update={update}
          onClose={() => setCloseRitual(false)}
        />
      )}
    </>
  );
}

/* ---------------------------- Rituales ---------------------------- */

function OpenRitual({
  doc,
  date,
  update,
  onClose,
}: {
  doc: Doc;
  date: ISODate;
  update: (fn: (d: Doc) => Doc) => void;
  onClose: () => void;
}) {
  const existing = doc.days[date]?.mustDo ?? [];
  const [items, setItems] = useState<string[]>([existing[0] ?? '', existing[1] ?? '', existing[2] ?? '']);

  return (
    <Sheet
      title="Abrir el dia"
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={items.filter((i) => i.trim()).length === 0}
          onClick={() => {
            update((d) => openDay(d, date, items.map((i) => i.trim()).filter(Boolean)));
            onClose();
          }}
        >
          Empezar
        </button>
      }
    >
      <p className="muted small">
        Tres cosas. Si al final del dia solo hicieras estas tres, el dia estaria bien invertido.
        Concretas y verificables: "tema 4 de Calculo", no "estudiar".
      </p>
      {items.map((v, i) => (
        <label className="field" key={i}>
          <span>Innegociable {i + 1}</span>
          <input
            type="text"
            value={v}
            placeholder={['Bloque de estudio de...', 'Entrenar', 'Avanzar la entrega de...'][i]}
            onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </label>
      ))}
    </Sheet>
  );
}

function CloseRitual({
  doc,
  date,
  today,
  update,
  onClose,
}: {
  doc: Doc;
  date: ISODate;
  today: ISODate;
  update: (fn: (d: Doc) => Doc) => void;
  onClose: () => void;
}) {
  const day = doc.days[date];
  const [mood, setMood] = useState(day?.mood ?? 3);
  const [energy, setEnergy] = useState(day?.energy ?? 3);
  const [sleep, setSleep] = useState(day?.sleepHours ?? 7);
  const [win, setWin] = useState(day?.win ?? '');
  const [friction, setFriction] = useState(day?.friction ?? '');
  const v = dayVerdict(doc, date, today);
  const toast = useToast();

  return (
    <Sheet
      title="Cerrar el dia"
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          onClick={() => {
            update((d) =>
              closeDay(d, date, { mood, energy, sleepHours: sleep, win, friction, reflection: `${win} | ${friction}` }),
            );
            toast('Dia cerrado. Manana no empieza de cero: empieza desde aqui.');
            onClose();
          }}
        >
          Firmar el cierre
        </button>
      }
    >
      <div className="banner" style={{ borderColor: verdictColor(v.verdict) }}>
        <span className="icon">{v.verdict === 'perfecto' ? '🏆' : v.verdict === 'suspenso' ? '❌' : '⚠️'}</span>
        <div>
          <b>{v.verdict.toUpperCase()}</b> — {pct(v.rate)} de lo obligatorio
          {v.missed.length > 0 && (
            <div className="small muted">Sin hacer: {v.missed.map((h) => h.name).join(', ')}</div>
          )}
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Animo</span>
          <select value={mood} onChange={(e) => setMood(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {['😞', '🙁', '😐', '🙂', '😄'][n - 1]} {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Energia</span>
          <select value={energy} onChange={(e) => setEnergy(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Sueno (h)</span>
          <input type="number" step="0.5" min="0" max="14" value={sleep} onChange={(e) => setSleep(Number(e.target.value))} />
        </label>
      </div>

      <label className="field">
        <span>Que ha salido bien</span>
        <input type="text" value={win} onChange={(e) => setWin(e.target.value)} placeholder="Una cosa concreta" />
      </label>
      <label className="field">
        <span>Que te ha frenado y como lo evitas manana</span>
        <textarea value={friction} onChange={(e) => setFriction(e.target.value)} placeholder="El movil en la mesa. Manana lo dejo en otra habitacion." />
      </label>
    </Sheet>
  );
}

export function DebtList({ doc, today, update }: { doc: Doc; today: ISODate; update: (fn: (d: Doc) => Doc) => void }) {
  const debts = pendingDebts(doc);
  if (!debts.length) return <Empty text="Sin deuda. Asi se ve ir al dia." />;
  return (
    <div>
      {debts.map((d) => (
        <div className="list-item" key={d.id}>
          <div style={{ flex: 1 }}>
            <div className="bold">
              {d.amount} {d.unit}
            </div>
            <div className="tiny faint">{d.reason}</div>
          </div>
          <button className="btn small" onClick={() => update((doc2) => payDebt(doc2, d.id, today))}>
            Pagada
          </button>
        </div>
      ))}
    </div>
  );
}

export { Stat };
