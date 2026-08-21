import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canEditDate,
  counts,
  fromISODate,
  getEntry,
  habitStats,
  isScheduled,
  list,
  monthDates,
  MONTH_LONG,
  toggleHabit,
  trackingStart,
  WEEKDAY_INITIAL,
  weekday,
  type Habit,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { ColumnChart, Empty, LineChart, Meter, useToast } from '../components/ui.js';
import { Icon } from '../components/Icon.js';
import { pct } from '../lib/format.js';
import { seriesColor, useIsDark } from '../lib/palette.js';

/**
 * La rejilla mensual: filas de habitos, columnas de dias. Es la vista que
 * convierte "creo que voy bien" en una superficie que no admite discusion.
 */
export function Month() {
  const { doc, today, update } = useStore();
  const toast = useToast();
  const isDark = useIsDark();
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
  const from = dates[0]! < start ? start : dates[0]!;
  const to = dates[dates.length - 1]!;

  const stats = useMemo(
    () => habits.map((h) => habitStats(doc, h, from, to, today)),
    [doc, habits, from, to, today],
  );

  const visible = dates.filter((d) => d <= today && d >= start);
  const dailyRates = visible.map((d) => {
    const total = habits.filter((h) => isScheduled(doc, h, d)).length;
    const done = habits.filter((h) => isScheduled(doc, h, d) && counts(getEntry(doc, h.id, d))).length;
    return { label: '', value: total ? done / total : 0, caption: d };
  });
  // Con 30 columnas no caben 30 etiquetas: una de cada cinco basta para orientarse.
  dailyRates.forEach((d, i) => {
    if (i === 0 || (i + 1) % 5 === 0) d.label = String(Number(visible[i]!.slice(8)));
  });

  const moodSeries = visible
    .filter((d) => doc.days[d]?.mood != null)
    .map((d) => ({ label: d.slice(5), value: doc.days[d]!.mood! }));
  const sleepSeries = visible
    .filter((d) => doc.days[d]?.sleepHours != null)
    .map((d) => ({ label: d.slice(5), value: doc.days[d]!.sleepHours! }));

  // Al abrir el mes en curso, la rejilla se coloca sola en el dia de hoy:
  // si no, en un movil te recibe siempre el dia 1.
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const cell = el.querySelector<HTMLElement>('.cell.today');
    if (cell) el.scrollLeft = Math.max(0, cell.offsetLeft - el.clientWidth * 0.6);
  }, [cursor, habits.length]);

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
  const perfect = dailyRates.filter((r) => r.value >= 1).length;
  const zero = dailyRates.filter((r) => r.value === 0).length;

  return (
    <>
      <div className="page-head row">
        <div style={{ flex: 1 }}>
          <h1 className="title-lg" style={{ textTransform: 'capitalize' }}>
            {MONTH_LONG[cursor.month]}
          </h1>
          <div className="sub">{cursor.year}</div>
        </div>
        <button className="btn ghost" onClick={() => move(-1)} aria-label="Mes anterior">
          <Icon name="back" size={19} />
        </button>
        <button className="btn ghost" onClick={() => move(1)} aria-label="Mes siguiente">
          <Icon name="forward" size={19} />
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="k">Cumplido</div>
          <div className="v">{totalScheduled ? pct(totalDone / totalScheduled) : '—'}</div>
          <div className="s">
            {totalDone} de {totalScheduled}
          </div>
        </div>
        <div className="stat">
          <div className="k">Dias perfectos</div>
          <div className="v">{perfect}</div>
          <div className="s">de {dailyRates.length}</div>
        </div>
        <div className="stat">
          <div className="k">Dias en cero</div>
          <div className="v" style={{ color: zero ? 'var(--critical)' : undefined }}>
            {zero}
          </div>
          <div className="s">sin nada marcado</div>
        </div>
        <div className="stat">
          <div className="k">Mejor racha</div>
          <div className="v">{Math.max(0, ...stats.map((s) => s.streak.best))}</div>
          <div className="s">dias seguidos</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Progreso diario</h3>
          <span className="tiny faint">% de habitos del dia</span>
        </div>
        {dailyRates.length ? (
          <ColumnChart
            data={dailyRates}
            color="var(--seq-4)"
            format={(v) => `${Math.round(v * 100)}%`}
            highlightLast
            max={1}
          />
        ) : (
          <Empty text="Todavia no hay dias registrados este mes" />
        )}
      </section>

      {/* --------------------------- La rejilla --------------------------- */}
      <section className="card">
        <div className="grid-wrap" ref={gridRef}>
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
                <th className="day-h" style={{ width: 42 }}>
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
                      <span style={{ marginRight: 6 }}>{h.emoji}</span>
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
                            aria-label={`${h.name} ${d}`}
                            onClick={() => toggle(h, d)}
                          >
                            {entry?.status === 'partial' ? '◐' : ''}
                          </button>
                        </td>
                      );
                    })}
                    <td className="tiny num" style={{ paddingLeft: 8, color: 'var(--text-2)' }}>
                      {pct(s.rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!habits.length && <Empty text="No tienes habitos. Creal­os en Ajustes." />}
        <div className="legend" style={{ marginTop: 14 }}>
          <span className="item">
            <i className="swatch" style={{ background: 'var(--good)' }} /> cumplido
          </span>
          <span className="item">
            <i className="swatch" style={{ background: 'color-mix(in srgb, var(--warning) 78%, transparent)' }} /> minimo
          </span>
          <span className="item">
            <i className="swatch" style={{ background: 'var(--neutral)' }} /> congelado
          </span>
          <span className="item">
            <i className="swatch" style={{ background: 'color-mix(in srgb, var(--critical) 26%, var(--surface-2))' }} />{' '}
            fallado
          </span>
        </div>
      </section>

      <div className="section-label">Analisis del mes</div>
      <section className="card">
        {stats.length ? (
          stats.map((s) => (
            <Meter
              key={s.habit.id}
              label={`${s.habit.emoji} ${s.habit.name}`}
              value={s.rate}
              right={`${s.done + s.partial}/${s.scheduled} · ${pct(s.rate)}`}
              color={seriesColor(s.habit.color, isDark)}
            />
          ))
        ) : (
          <Empty text="Sin datos todavia" />
        )}
      </section>

      <div className="section-label">Bienestar</div>
      <section className="card">
        <div className="card-head">
          <h3>Animo</h3>
          <span className="tiny faint">escala 1–5</span>
        </div>
        <LineChart data={moodSeries} yMax={5} color="var(--series-5)" height={110} />
      </section>
      <section className="card">
        <div className="card-head">
          <h3>Horas de sueño</h3>
          <span className="tiny faint">por noche</span>
        </div>
        <LineChart data={sleepSeries} yMax={10} color="var(--series-7)" height={110} format={(v) => `${v} h`} />
      </section>
      <p className="tiny faint" style={{ padding: '0 4px' }}>
        Animo y sueño van en dos graficas separadas a proposito: meter dos escalas distintas en un solo eje
        es la forma mas facil de leer una relacion que no existe.
      </p>
    </>
  );
}
