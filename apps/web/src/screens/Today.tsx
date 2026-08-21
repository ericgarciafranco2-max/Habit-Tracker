import { useMemo, useState } from 'react';
import {
  activePenance,
  addDays,
  buildStudyPlan,
  closeDay,
  completePenance,
  counts,
  dayScore,
  dayVerdict,
  debtSummary,
  formatDateLong,
  getEntry,
  habitsForDate,
  isRequired,
  levelFromXp,
  list,
  openDay,
  pendingDebts,
  rewardLock,
  ritualState,
  type Doc,
  type ISODate,
  type Habit,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { HabitRow } from '../components/HabitRow.js';
import { Empty, Meter, Ring, Sheet, useToast } from '../components/ui.js';
import { Icon } from '../components/Icon.js';
import { QuoteCard } from './Methods.js';
import { quoteOfDay } from '../data/quotes.js';
import { hm, pct, sentenceCase, verdictColor, verdictLabel } from '../lib/format.js';
import { seriesColor, useIsDark } from '../lib/palette.js';

export function Today({ onEditHabit, go }: { onEditHabit: (h: Habit) => void; go: (v: string) => void }) {
  const { doc, today, update } = useStore();
  const [date, setDate] = useState<ISODate>(today);
  const [openRitual, setOpenRitual] = useState(false);
  const [closeRitual, setCloseRitual] = useState(false);
  const isDark = useIsDark();
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
  const isToday = date === today;

  const habits = useMemo(() => habitsForDate(doc, date), [doc, date]);
  const required = habits.filter((h) => isRequired(doc, h, date));
  const optional = habits.filter((h) => !isRequired(doc, h, date));

  // Los tres medidores del dia. Cada uno es una razon contra su limite, por eso
  // van en pequeños multiples y no como anillos concentricos.
  const nonNeg = required.filter((h) => h.nonNegotiable);
  const nonNegDone = nonNeg.filter((h) => counts(getEntry(doc, h.id, date))).length;
  const studyHabits = list(doc.habits).filter((h) => !h.archived && h.category === 'estudio' && h.measure === 'minutes');
  const studyTarget = studyHabits.reduce((a, h) => a + h.target, 0);
  const studyDone = studyHabits.reduce((a, h) => a + (getEntry(doc, h.id, date)?.value ?? 0), 0);

  const plan = useMemo(() => buildStudyPlan(doc, date, { horizonDays: 1 }), [doc, date]);
  const quote = quoteOfDay(date);

  return (
    <>
      <div className="page-head row" style={{ gap: 6 }}>
        <div style={{ flex: 1 }}>
          <h1 className="title-lg">{isToday ? 'Hoy' : sentenceCase(formatDateLong(date).split(',')[0]!)}</h1>
          <div className="sub">{sentenceCase(formatDateLong(date))}</div>
        </div>
        <button className="btn ghost" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
          <Icon name="back" size={19} />
        </button>
        <button
          className="btn ghost"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="Dia siguiente"
        >
          <Icon name="forward" size={19} />
        </button>
      </div>

      {/* --------------------------- Resumen --------------------------- */}
      <section className="card" aria-label="Resumen del dia">
        <div
          className="row"
          style={{ justifyContent: 'space-around', gap: 8, marginBottom: 18, maxWidth: 440, margin: '0 auto 18px' }}
        >
          <Ring
            value={nonNeg.length ? nonNegDone / nonNeg.length : 1}
            size={92}
            color="var(--series-1)"
            caption={`Innegociables ${nonNegDone}/${nonNeg.length}`}
          />
          <Ring
            value={score.rate}
            size={92}
            color="var(--series-2)"
            caption={`Habitos ${score.completed}/${score.required}`}
          />
          <Ring
            value={studyTarget ? Math.min(1, studyDone / studyTarget) : 0}
            size={92}
            color="var(--series-3)"
            label={studyTarget ? `${Math.round((studyDone / studyTarget) * 100)}%` : '—'}
            caption={`Estudio ${hm(studyDone)}${studyTarget ? ` / ${hm(studyTarget)}` : ''}`}
          />
        </div>

        <div className="row" style={{ marginBottom: 10 }}>
          <span className={`chip ${verdict.verdict === 'perfecto' ? 'good' : verdict.verdict === 'suspenso' ? 'bad' : verdict.verdict === 'aprobado' ? 'warn' : ''}`}>
            {verdictLabel(verdict.verdict)}
          </span>
          <span className="chip">
            Nivel {level.level} · {level.title}
          </span>
          <div className="spacer" />
          <span className="tiny faint num">+{score.xp} XP</span>
        </div>
        <Meter value={level.progress} color="var(--accent)" />
        <div className="tiny faint">
          {level.xpForNext - level.xpInLevel} XP para el nivel {level.level + 1} · {doc.profile.freezeTokens}{' '}
          congelaciones este mes
        </div>
      </section>

      {/* --------------------------- Presion --------------------------- */}
      {penance && (
        <div className="banner bad">
          <span className="icon">⚖️</span>
          <div style={{ flex: 1 }}>
            <b>Penitencia activa</b>
            <div className="small muted">{penance.text}</div>
            <button
              className="btn tinted small"
              style={{ marginTop: 10 }}
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
            <div className="small muted">
              {debtsByUnit.map((d) => `${d.amount} ${d.unit}`).join(' · ')} de {debts.length} fallo(s). Se paga
              haciendo de mas.
            </div>
            <button className="btn tinted small" style={{ marginTop: 10 }} onClick={() => go('presion')}>
              Ver deuda
            </button>
          </div>
        </div>
      )}

      {isToday && ritual.needsOpen && (
        <div className="banner">
          <span className="icon">🌅</span>
          <div style={{ flex: 1 }}>
            <b>El dia no esta abierto</b>
            <div className="small muted">Dos minutos: elige las 3 cosas que hoy no se negocian.</div>
            <button className="btn primary small" style={{ marginTop: 10 }} onClick={() => setOpenRitual(true)}>
              Abrir el dia
            </button>
          </div>
        </div>
      )}

      {day?.mustDo?.length ? (
        <section className="card">
          <div className="card-head">
            <h3>Las 3 de hoy</h3>
            <button className="btn ghost small" onClick={() => setOpenRitual(true)}>
              Editar
            </button>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20 }} className="small">
            {day.mustDo.map((m, i) => (
              <li key={i} style={{ marginBottom: 3 }}>
                {m}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* --------------------------- Habitos --------------------------- */}
      <div className="section-label">Obligatorios de hoy</div>
      <section className="card flush">
        {required.length ? (
          required.map((h) => (
            <HabitRow
              key={h.id}
              doc={doc}
              habit={h}
              date={date}
              today={today}
              update={update}
              onEdit={onEditHabit}
              color={seriesColor(h.color, isDark)}
            />
          ))
        ) : (
          <Empty text="Hoy no tienes nada obligatorio. Sospechoso." />
        )}
      </section>

      {optional.length > 0 && (
        <>
          <div className="section-label">Opcionales</div>
          <section className="card flush">
            {optional.map((h) => (
              <HabitRow
                key={h.id}
                doc={doc}
                habit={h}
                date={date}
                today={today}
                update={update}
                onEdit={onEditHabit}
                color={seriesColor(h.color, isDark)}
              />
            ))}
          </section>
        </>
      )}

      {/* ---------------------------- Frase ---------------------------- */}
      <div className="section-label">Para cuando no apetezca</div>
      <QuoteCard q={quote} big />

      {/* ------------------------ Plan de estudio ---------------------- */}
      {plan.length > 0 && (
        <>
          <div className="section-label">Plan de estudio de hoy</div>
          <section className="card">
            <div className="timeline">
              {plan.slice(0, 6).map((b, i) => (
                <div className="slot" key={i}>
                  <div className="time">{b.start}</div>
                  <div className="block" style={{ borderLeftColor: seriesColor(b.color, isDark) }}>
                    <div className="t">{b.title}</div>
                    <div className="m">
                      {b.subjectName} · {hm(b.minutes)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn block small" style={{ marginTop: 10 }} onClick={() => go('uni')}>
              Ir al planificador
            </button>
          </section>
        </>
      )}

      {/* ------------------------- Recompensas ------------------------- */}
      <div className="section-label">Recompensas</div>
      <section className={`card ${lock.locked ? 'locked' : ''}`}>
        <div className="row" style={{ marginBottom: 8 }}>
          <Icon name={lock.locked ? 'lock' : 'unlock'} size={19} />
          <b>{lock.locked ? 'Bloqueadas' : 'Desbloqueadas'}</b>
        </div>
        <div className="small muted">{lock.reason}</div>
        <div className="row wrap" style={{ marginTop: 12 }}>
          {list(doc.rewards)
            .filter((r) => r.enabled)
            .map((r) => (
              <span key={r.id} className={`chip ${lock.locked ? '' : 'good'}`}>
                {r.emoji} {r.text}
              </span>
            ))}
        </div>
      </section>

      {isToday && (
        <button className="btn primary block" style={{ marginTop: 4, padding: 14 }} onClick={() => setCloseRitual(true)}>
          {day?.closedAt ? 'Revisar el cierre del dia' : 'Cerrar el dia'}
        </button>
      )}
      {isToday && ritual.needsClose && (
        <p className="tiny faint center" style={{ marginTop: 10 }}>
          El dia se liquida solo a las {doc.profile.dayCutoff}. Lo que no este marcado, cuenta como fallo.
        </p>
      )}

      {openRitual && <OpenRitual doc={doc} date={date} update={update} onClose={() => setOpenRitual(false)} />}
      {closeRitual && (
        <CloseRitual doc={doc} date={date} today={today} update={update} onClose={() => setCloseRitual(false)} />
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
        Tres cosas. Si al final del dia solo hicieras estas tres, el dia estaria bien invertido. Concretas y
        verificables: “tema 4 de Calculo”, no “estudiar”.
      </p>
      {items.map((v, i) => (
        <label className="field" key={i}>
          <span>Innegociable {i + 1}</span>
          <input
            type="text"
            value={v}
            placeholder={['Bloque de estudio de…', 'Entrenar', 'Avanzar la entrega de…'][i]}
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
              closeDay(d, date, {
                mood,
                energy,
                sleepHours: sleep,
                win,
                friction,
                reflection: `${win} | ${friction}`,
              }),
            );
            toast('Dia cerrado. Mañana no empieza de cero: empieza desde aqui.');
            onClose();
          }}
        >
          Firmar el cierre
        </button>
      }
    >
      <div
        className="banner"
        style={{ borderLeftColor: verdictColor(v.verdict), marginBottom: 18 }}
      >
        <span className="icon">{v.verdict === 'perfecto' ? '🏆' : v.verdict === 'suspenso' ? '❌' : '⚠️'}</span>
        <div>
          <b>{verdictLabel(v.verdict)}</b> — {pct(v.rate)} de lo obligatorio
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
                {['Muy mal', 'Regular', 'Normal', 'Bien', 'Genial'][n - 1]}
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
          <span>Sueño (h)</span>
          <input type="number" step="0.5" min="0" max="14" value={sleep} onChange={(e) => setSleep(Number(e.target.value))} />
        </label>
      </div>

      <label className="field">
        <span>Que ha salido bien</span>
        <input type="text" value={win} onChange={(e) => setWin(e.target.value)} placeholder="Una cosa concreta" />
      </label>
      <label className="field">
        <span>Que te ha frenado y como lo evitas mañana</span>
        <textarea
          value={friction}
          onChange={(e) => setFriction(e.target.value)}
          placeholder="El movil en la mesa. Mañana lo dejo en otra habitacion."
        />
      </label>
    </Sheet>
  );
}
