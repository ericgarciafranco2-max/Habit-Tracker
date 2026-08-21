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
  weekSummary,
  yearHeatmap,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { Bar, BarChart, Empty, Heatmap, Ring, Sparkline } from '../components/ui.js';
import { hm, pct } from '../lib/format.js';

export function Dashboard() {
  const { doc, today } = useStore();
  const [year, setYear] = useState(() => fromISODate(today).getFullYear());

  const level = levelFromXp(doc.profile.xp);
  const heat = useMemo(() => yearHeatmap(doc, year, today), [doc, year, today]);
  const months = useMemo(() => monthlyRates(doc, year, today), [doc, year, today]);
  const yearStats = useMemo(
    () => periodStats(doc, `${year}-01-01`, `${year}-12-31`, today),
    [doc, year, today],
  );

  const weeks = useMemo(() => {
    const out = [] as Array<{ label: string; rate: number; xp: number; study: number }>;
    for (let i = 11; i >= 0; i--) {
      const start = startOfWeek(addDays(today, -7 * i));
      const s = weekSummary(doc, start, today);
      out.push({ label: start.slice(5), rate: s.rate, xp: s.xp, study: s.studyMinutes });
    }
    return out;
  }, [doc, today]);

  const doneDays = heat.filter((h) => h.rate >= 1).length;
  const zeroDays = heat.filter((h) => h.rate === 0).length;
  const avg = heat.length ? heat.reduce((a, h) => a + h.rate, 0) / heat.length : 0;
  const bestStreak = Math.max(0, ...yearStats.map((s) => s.streak.best));
  const currentStreaks = yearStats.filter((s) => s.streak.current > 0).length;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => setYear(year - 1)}>
          ‹
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '1.05rem' }}>Panel {year}</h1>
        <button className="btn ghost small" onClick={() => setYear(year + 1)}>
          ›
        </button>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 16 }}>
          <Ring value={avg} sub="media anual" />
          <div style={{ flex: 1 }}>
            <div className="bold" style={{ fontSize: '1.1rem' }}>
              Nivel {level.level} · {level.title}
            </div>
            <div className="tiny faint" style={{ marginBottom: 5 }}>
              {doc.profile.xp} XP totales
            </div>
            <Bar value={level.progress} />
            <div className="tiny faint" style={{ marginTop: 6 }}>
              {level.xpForNext - level.xpInLevel} XP para el nivel {level.level + 1}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="stat">
          <div className="k">Dias perfectos</div>
          <div className="v">{doneDays}</div>
          <div className="s">de {heat.length}</div>
        </div>
        <div className="stat">
          <div className="k">Dias en cero</div>
          <div className="v" style={{ color: zeroDays ? 'var(--danger)' : undefined }}>
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
          <div className="v">{currentStreaks}</div>
          <div className="s">habitos</div>
        </div>
      </div>

      <div className="section-label">Mapa del año</div>
      <div className="card">
        <Heatmap data={heat} />
        <div className="row tiny faint" style={{ marginTop: 8 }}>
          <span>Menos</span>
          <div className="row" style={{ gap: 2 }}>
            {[0, 0.3, 0.6, 0.9, 1].map((r) => (
              <i
                key={r}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  display: 'block',
                  background:
                    r === 0
                      ? 'var(--surface-3)'
                      : `color-mix(in srgb, var(--accent) ${r * 100}%, var(--surface-3))`,
                }}
              />
            ))}
          </div>
          <span>Mas</span>
        </div>
      </div>

      <div className="section-label">Por meses</div>
      <div className="card">
        <BarChart
          values={months}
          labels={MONTH_LONG.map((m) => m.slice(0, 1).toUpperCase())}
          height={100}
        />
      </div>

      <div className="section-label">Ultimas 12 semanas</div>
      <div className="card">
        <Sparkline values={weeks.map((w) => w.rate)} height={60} />
        <div className="row tiny faint" style={{ marginTop: 6 }}>
          <span style={{ flex: 1 }}>{weeks[0]?.label}</span>
          <span>{weeks[weeks.length - 1]?.label}</span>
        </div>
        <hr className="sep" />
        <div className="row small">
          <div style={{ flex: 1 }}>
            <div className="faint tiny">Media</div>
            <div className="bold">{pct(weeks.reduce((a, w) => a + w.rate, 0) / (weeks.length || 1))}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="faint tiny">Estudio total</div>
            <div className="bold">{hm(weeks.reduce((a, w) => a + w.study, 0))}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="faint tiny">XP</div>
            <div className="bold">{weeks.reduce((a, w) => a + w.xp, 0)}</div>
          </div>
        </div>
      </div>

      <div className="section-label">Ranking de habitos</div>
      <div className="card">
        {yearStats.length ? (
          yearStats.map((s, i) => (
            <div key={s.habit.id} style={{ marginBottom: 11 }}>
              <div className="row tiny" style={{ marginBottom: 3 }}>
                <span className="faint mono" style={{ width: 18 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1 }}>
                  {s.habit.emoji} {s.habit.name}
                </span>
                {s.streak.current > 0 && <span className="faint">🔥 {s.streak.current}</span>}
                <span className="mono bold" style={{ width: 40, textAlign: 'right' }}>
                  {pct(s.rate)}
                </span>
              </div>
              <Bar value={s.rate} color={s.habit.color} />
            </div>
          ))
        ) : (
          <Empty text="Sin datos de este año" />
        )}
      </div>

      <div className="section-label">Historial</div>
      <div className="card">
        {list(doc.ledger)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 25)
          .map((e) => (
            <div className="list-item" key={e.id}>
              <span style={{ width: 22 }}>
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
              <div style={{ flex: 1 }}>
                <div className="small">{e.text}</div>
                <div className="tiny faint">{e.date}</div>
              </div>
            </div>
          ))}
        {!list(doc.ledger).length && <Empty text="Todavia no hay historial" />}
      </div>
    </>
  );
}
