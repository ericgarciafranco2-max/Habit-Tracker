import { useMemo, useState } from 'react';
import {
  addDays,
  fromISODate,
  levelFromXp,
  list,
  MONTH_LONG,
  monthlyRates,
  periodStats,
  startOfWeek,
  trackingStart,
  weekSummary,
  yearHeatmap,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { ColumnChart, Empty, Heatmap, LineChart, Meter, Ring, StackedBar } from '../components/ui.js';
import { Icon } from '../components/Icon.js';
import { hm, pct, plural } from '../lib/format.js';
import { seriesColor, slotColor, useIsDark } from '../lib/palette.js';

const CATEGORY_LABEL: Record<string, string> = {
  salud: 'Salud',
  mente: 'Mente',
  estudio: 'Estudio',
  disciplina: 'Disciplina',
  social: 'Social',
  finanzas: 'Finanzas',
  otro: 'Otro',
};

export function Dashboard() {
  const { doc, today } = useStore();
  const isDark = useIsDark();
  const [year, setYear] = useState(() => fromISODate(today).getFullYear());

  const level = levelFromXp(doc.profile.xp);
  const start = trackingStart(doc);
  const heat = useMemo(() => yearHeatmap(doc, year, today), [doc, year, today]);
  const months = useMemo(() => monthlyRates(doc, year, today), [doc, year, today]);
  const yearStats = useMemo(
    () => periodStats(doc, `${year}-01-01`, `${year}-12-31`, today),
    [doc, year, today],
  );

  const weeks = useMemo(() => {
    const out: Array<{ label: string; value: number; xp: number; study: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(addDays(today, -7 * i));
      const s = weekSummary(doc, weekStart, today);
      out.push({ label: weekStart.slice(8) + '/' + weekStart.slice(5, 7), value: s.rate, xp: s.xp, study: s.studyMinutes });
    }
    return out;
  }, [doc, today]);

  // Reparto del esfuerzo por area: parte respecto al todo, en barra apilada.
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of yearStats) {
      map.set(s.habit.category, (map.get(s.habit.category) ?? 0) + s.done + s.partial * 0.5);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, value], i) => ({
        label: CATEGORY_LABEL[cat] ?? cat,
        value: Math.round(value),
        color: slotColor(i, isDark),
      }));
  }, [yearStats, isDark]);

  const tracked = heat.filter((h) => h.date >= start);
  const doneDays = tracked.filter((h) => h.rate >= 1).length;
  const zeroDays = tracked.filter((h) => h.rate === 0).length;
  const avg = tracked.length ? tracked.reduce((a, h) => a + h.rate, 0) / tracked.length : 0;
  const bestStreak = Math.max(0, ...yearStats.map((s) => s.streak.best));
  const liveStreaks = yearStats.filter((s) => s.streak.current > 0).length;

  return (
    <>
      <div className="page-head row">
        <div style={{ flex: 1 }}>
          <h1 className="title-lg">Panel</h1>
          <div className="sub">{year}</div>
        </div>
        <button className="btn ghost" onClick={() => setYear(year - 1)} aria-label="Año anterior">
          <Icon name="back" size={19} />
        </button>
        <button className="btn ghost" onClick={() => setYear(year + 1)} aria-label="Año siguiente">
          <Icon name="forward" size={19} />
        </button>
      </div>

      <section className="card">
        <div className="row" style={{ gap: 20 }}>
          <Ring value={avg} size={104} color="var(--seq-5)" caption="Media del año" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hero-num">{level.level}</div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              {level.title} · {doc.profile.xp} XP acumulados
            </div>
            <Meter value={level.progress} right={`${level.xpInLevel}/${level.xpForNext}`} />
            <div className="tiny faint">Faltan {level.xpForNext - level.xpInLevel} XP para el nivel {level.level + 1}</div>
          </div>
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="k">Dias perfectos</div>
          <div className="v">{doneDays}</div>
          <div className="s">de {tracked.length}</div>
        </div>
        <div className="stat">
          <div className="k">Dias en cero</div>
          <div className="v" style={{ color: zeroDays ? 'var(--critical)' : undefined }}>
            {zeroDays}
          </div>
          <div className="s">nada marcado</div>
        </div>
        <div className="stat">
          <div className="k">Mejor racha</div>
          <div className="v">{bestStreak}</div>
          <div className="s">dias</div>
        </div>
        <div className="stat">
          <div className="k">Rachas vivas</div>
          <div className="v">{liveStreaks}</div>
          <div className="s">habitos</div>
        </div>
      </div>

      <div className="section-label">Mapa del año</div>
      <section className="card">
        <Heatmap data={heat.map((h) => ({ ...h, empty: h.date < start }))} />
      </section>

      <div className="section-label">Por meses</div>
      <section className="card">
        <ColumnChart
          data={months.map((v, i) => ({
            label: MONTH_LONG[i]!.slice(0, 3),
            value: v,
            caption: MONTH_LONG[i],
          }))}
          color="var(--seq-4)"
          format={(v) => pct(v)}
          height={120}
          max={1}
        />
      </section>

      <div className="section-label">Ultimas 12 semanas</div>
      <section className="card">
        <div className="card-head">
          <h3>Cumplimiento semanal</h3>
          <span className="tiny faint">% de lo obligatorio</span>
        </div>
        <LineChart data={weeks} yMax={1} format={(v) => pct(v)} color="var(--series-1)" />
        <hr className="sep" />
        <div className="row small">
          <div style={{ flex: 1 }}>
            <div className="faint tiny">Media</div>
            <div className="bold num">{pct(weeks.reduce((a, w) => a + w.value, 0) / (weeks.length || 1))}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="faint tiny">Estudio</div>
            <div className="bold num">{hm(weeks.reduce((a, w) => a + w.study, 0))}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="faint tiny">XP</div>
            <div className="bold num">{weeks.reduce((a, w) => a + w.xp, 0)}</div>
          </div>
        </div>
      </section>

      {byCategory.length > 1 && (
        <>
          <div className="section-label">En que se te va el esfuerzo</div>
          <section className="card">
            <StackedBar parts={byCategory} format={(v) => plural(v, 'dia', 'dias')} />
            <p className="tiny faint" style={{ marginTop: 12, marginBottom: 0 }}>
              Si una sola area se come la barra, mira si es la que dijiste que te importaba.
            </p>
          </section>
        </>
      )}

      <div className="section-label">Ranking de habitos</div>
      <section className="card">
        {yearStats.length ? (
          yearStats.map((s) => (
            <Meter
              key={s.habit.id}
              label={
                <>
                  {s.habit.emoji} {s.habit.name}
                  {s.streak.current > 0 && <span className="faint"> · 🔥 {s.streak.current}</span>}
                </>
              }
              value={s.rate}
              right={pct(s.rate)}
              color={seriesColor(s.habit.color, isDark)}
            />
          ))
        ) : (
          <Empty text="Sin datos de este año" />
        )}
      </section>

      <div className="section-label">Historial</div>
      <section className="card flush">
        {list(doc.ledger)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 25)
          .map((e) => (
            <div className="habit-row" key={e.id}>
              <span className="emoji" style={{ background: 'var(--surface-2)' }}>
                {e.kind === 'sancion'
                  ? '⚖️'
                  : e.kind === 'deuda-creada'
                    ? '📉'
                    : e.kind === 'deuda-pagada'
                      ? '✅'
                      : e.kind === 'congelacion-usada'
                        ? '❄️'
                        : e.kind === 'edicion-tardia'
                          ? '👀'
                          : '•'}
              </span>
              <span className="info">
                <span className="name" style={{ fontWeight: 400, fontSize: 14.5 }}>
                  {e.text}
                </span>
                <span className="meta">{e.date}</span>
              </span>
            </div>
          ))}
        {!list(doc.ledger).length && <Empty text="Todavia no hay historial" />}
      </section>
    </>
  );
}
