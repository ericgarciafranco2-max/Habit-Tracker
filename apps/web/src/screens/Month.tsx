import { useMemo, useState } from 'react';
import {
  canEditDate,
  counts,
  fromISODate,
  getEntry,
  habitStats,
  isScheduled,
  list,
  monthDates,
  trackingStart,
  MONTH_LONG,
  toggleHabit,
  WEEKDAY_INITIAL,
  weekday,
  type Habit,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { Bar, BarChart, Empty, Sparkline, useToast } from '../components/ui.js';
import { pct } from '../lib/format.js';

/**
 * La rejilla mensual: la vista que hace que un tracker se sienta un tracker.
 * Filas = habitos, columnas = dias. Se puede marcar directamente aqui.
 */
export function Month() {
  const { doc, today, update } = useStore();
  const toast = useToast();
  const [cursor, setCursor] = useState(() => {
    const d = fromISODate(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const dates = useMemo(() => monthDates(cursor.year, cursor.month), [cursor]);
  const habits = useMemo(
    () => list(doc.habits).filter((h) => !h.archived).sort((a, b) => a.order - b.order),
    [doc.habits],
  );
  const start = trackingStart(doc);
  // Los dias anteriores a instalar la app no cuentan como fallos.
  const from = (dates[0]! < start ? start : dates[0]!);
  const to = dates[dates.length - 1]!;

  const stats = useMemo(
    () => habits.map((h) => habitStats(doc, h, from, to, today)),
    [doc, habits, from, to, today],
  );

  const moodSeries = dates.filter((d) => d <= today && d >= start).map((d) => doc.days[d]?.mood ?? 0);
  const sleepSeries = dates.filter((d) => d <= today && d >= start).map((d) => doc.days[d]?.sleepHours ?? 0);

  const dailyRates = dates
    .filter((d) => d <= today && d >= start)
    .map((d) => {
      const total = habits.filter((h) => isScheduled(doc, h, d)).length;
      const done = habits.filter((h) => isScheduled(doc, h, d) && counts(getEntry(doc, h.id, d))).length;
      return total ? done / total : 0;
    });

  const move = (delta: number) => {
    const m = cursor.month + delta;
    setCursor({ year: cursor.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };

  const toggle = (habit: Habit, date: string) => {
    const perm = canEditDate(doc, date, today);
    if (!perm.allowed) {
      toast(perm.reason ?? 'No editable');
      return;
    }
    update((d) => toggleHabit(d, habit.id, date));
  };

  const totalDone = stats.reduce((a, s) => a + s.done, 0);
  const totalScheduled = stats.reduce((a, s) => a + s.scheduled, 0);

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => move(-1)}>
          ‹
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '1.05rem', textTransform: 'capitalize' }}>
          {MONTH_LONG[cursor.month]} {cursor.year}
        </h1>
        <button className="btn ghost small" onClick={() => move(1)}>
          ›
        </button>
      </div>

      <div className="card">
        <div className="grid grid-4" style={{ marginBottom: 12 }}>
          <div className="stat">
            <div className="k">Cumplido</div>
            <div className="v">{totalScheduled ? pct(totalDone / totalScheduled) : '—'}</div>
            <div className="s">
              {totalDone} de {totalScheduled}
            </div>
          </div>
          <div className="stat">
            <div className="k">Mejor racha</div>
            <div className="v">{Math.max(0, ...stats.map((s) => s.streak.best))}</div>
            <div className="s">dias seguidos</div>
          </div>
          <div className="stat">
            <div className="k">Dias perfectos</div>
            <div className="v">{dailyRates.filter((r) => r >= 1).length}</div>
            <div className="s">de {dailyRates.length}</div>
          </div>
          <div className="stat">
            <div className="k">Dias en cero</div>
            <div className="v" style={{ color: 'var(--danger)' }}>
              {dailyRates.filter((r) => r === 0).length}
            </div>
            <div className="s">sin nada marcado</div>
          </div>
        </div>
        <BarChart values={dailyRates} color="var(--accent)" height={70} />
        <div className="tiny faint center" style={{ marginTop: 4 }}>
          Progreso diario del mes
        </div>
      </div>

      {/* ------------------------- La rejilla ------------------------- */}
      <div className="card flush" style={{ padding: 12 }}>
        <div className="grid-wrap">
          <table className="month">
            <thead>
              <tr>
                <th className="name-h">Habito</th>
                {dates.map((d) => {
                  const wd = weekday(d);
                  return (
                    <th key={d} className={`day-h ${wd === 0 || wd === 6 ? 'wk' : ''}`}>
                      <div>{WEEKDAY_INITIAL[wd]}</div>
                      <div>{Number(d.slice(8))}</div>
                    </th>
                  );
                })}
                <th className="day-h" style={{ width: 40 }}>
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {habits.map((h, i) => {
                const s = stats[i]!;
                return (
                  <tr key={h.id}>
                    <td className="name-c" title={h.name}>
                      <span style={{ marginRight: 5 }}>{h.emoji}</span>
                      {h.name}
                    </td>
                    {dates.map((d) => {
                      const scheduled = isScheduled(doc, h, d);
                      const entry = getEntry(doc, h.id, d);
                      const cls = !scheduled
                        ? 'off'
                        : entry?.status === 'done'
                          ? 'done'
                          : entry?.status === 'partial'
                            ? 'partial'
                            : entry?.status === 'frozen'
                              ? 'frozen'
                              : d < start
                                ? 'off'
                                : d < today
                                  ? 'missed'
                                  : '';
                      return (
                        <td key={d}>
                          <button
                            className={`cell ${cls} ${d === today ? 'today' : ''}`}
                            disabled={!scheduled || d > today}
                            title={`${h.name} — ${d}`}
                            onClick={() => toggle(h, d)}
                          >
                            {entry?.status === 'frozen' ? '❄' : entry?.status === 'partial' ? '◐' : ''}
                          </button>
                        </td>
                      );
                    })}
                    <td className="mono tiny" style={{ paddingLeft: 6, color: 'var(--text-dim)' }}>
                      {pct(s.rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!habits.length && <Empty text="No tienes habitos. Creal­os en Ajustes." />}
      </div>

      {/* -------------------------- Analisis -------------------------- */}
      <div className="section-label">Analisis del mes</div>
      <div className="card">
        {stats.map((s) => (
          <div key={s.habit.id} style={{ marginBottom: 10 }}>
            <div className="row tiny" style={{ marginBottom: 3 }}>
              <span style={{ flex: 1 }}>
                {s.habit.emoji} {s.habit.name}
              </span>
              <span className="mono faint">
                {s.done + s.partial}/{s.scheduled}
              </span>
              <span className="mono bold" style={{ width: 40, textAlign: 'right' }}>
                {pct(s.rate)}
              </span>
            </div>
            <Bar value={s.rate} color={s.habit.color} />
          </div>
        ))}
        {!stats.length && <Empty text="Sin datos todavia" />}
      </div>

      <div className="section-label">Bienestar</div>
      <div className="card">
        <div className="row small muted" style={{ marginBottom: 4 }}>
          <span style={{ flex: 1 }}>Animo (1-5)</span>
        </div>
        <Sparkline values={moodSeries} color="var(--accent)" />
        <div className="row small muted" style={{ margin: '10px 0 4px' }}>
          <span style={{ flex: 1 }}>Horas de sueno</span>
        </div>
        <Sparkline values={sleepSeries} color="var(--info)" />
      </div>
    </>
  );
}
