import { useState } from 'react';
import {
  diffDays,
  list,
  newId,
  put,
  softDelete,
  type Doc,
  type Goal,
  type Milestone,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { Bar, Empty, Sheet, useConfirm } from '../components/ui.js';
import { pct } from '../lib/format.js';

/**
 * Objetivos: el "para que" de los habitos. Cada objetivo se ata a habitos
 * concretos, porque un objetivo sin habito diario que lo empuje es una frase
 * bonita en una libreta.
 */
export function Goals() {
  const { doc, today, update } = useStore();
  const [editing, setEditing] = useState<Goal | null>(null);
  const { confirm, node } = useConfirm();
  const goals = list(doc.goals).sort(
    (a, b) => Number(a.status !== 'activo') - Number(b.status !== 'activo') || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'),
  );

  const blank = (): Goal => ({
    id: newId('g_'),
    updatedAt: Date.now(),
    title: '',
    why: '',
    category: 'otro',
    habitIds: [],
    milestones: [],
    status: 'activo',
    createdAt: Date.now(),
  });

  return (
    <>
      {node}
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ flex: 1 }}>Objetivos</h1>
        <button className="btn primary small" onClick={() => setEditing(blank())}>
          + Nuevo
        </button>
      </div>

      {!goals.length && (
        <Empty
          text="Sin objetivos. Empieza por uno solo: el que cambiaria el resto si lo consigues."
          action={
            <button className="btn primary" onClick={() => setEditing(blank())}>
              Definir objetivo
            </button>
          }
        />
      )}

      {goals.map((g) => {
        const doneMs = g.milestones.filter((m) => m.done).length;
        const progress =
          g.metricTarget != null && g.metricTarget !== 0
            ? Math.min(1, (g.metricCurrent ?? 0) / g.metricTarget)
            : g.milestones.length
              ? doneMs / g.milestones.length
              : 0;
        const daysLeft = g.deadline ? diffDays(g.deadline, today) : null;
        return (
          <div className="card" key={g.id} style={{ opacity: g.status === 'activo' ? 1 : 0.6 }}>
            <div className="card-head">
              <h3>{g.title}</h3>
              {daysLeft != null && (
                <span className={`chip tiny ${daysLeft < 14 ? 'warn' : ''}`}>
                  {daysLeft >= 0 ? `${daysLeft} dias` : 'vencido'}
                </span>
              )}
              <button className="btn ghost small" onClick={() => setEditing(g)}>
                Editar
              </button>
            </div>
            {g.why && <p className="small muted">“{g.why}”</p>}
            <div className="row tiny" style={{ marginBottom: 4 }}>
              <span style={{ flex: 1 }}>
                {g.metricTarget != null
                  ? `${g.metricCurrent ?? 0} / ${g.metricTarget} ${g.metricUnit ?? ''}`
                  : `${doneMs}/${g.milestones.length} hitos`}
              </span>
              <span className="mono bold">{pct(progress)}</span>
            </div>
            <Bar value={progress} />

            {g.milestones.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {g.milestones.map((m) => (
                  <div className="list-item" key={m.id}>
                    <input
                      type="checkbox"
                      checked={m.done}
                      style={{ width: 17, height: 17 }}
                      onChange={() =>
                        update((d) =>
                          put(d, 'goals', {
                            ...g,
                            milestones: g.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)),
                          }),
                        )
                      }
                    />
                    <div style={{ flex: 1 }} className="small">
                      <span style={{ textDecoration: m.done ? 'line-through' : undefined }}>{m.title}</span>
                      {m.due && <span className="tiny faint"> · {m.due}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {g.habitIds.length > 0 && (
              <div className="row wrap" style={{ marginTop: 10 }}>
                {g.habitIds.map((id) => {
                  const h = doc.habits[id];
                  return h && !h.deleted ? (
                    <span className="chip tiny" key={id}>
                      {h.emoji} {h.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <GoalSheet
          goal={editing}
          doc={doc}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            update((d) => put(d, 'goals', g));
            setEditing(null);
          }}
          onDelete={async (g) => {
            const ok = await confirm('Borrar objetivo', `Se borrara "${g.title}".`, 'Borrar');
            if (!ok) return;
            update((d) => softDelete(d, 'goals', g.id));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function GoalSheet({
  goal,
  doc,
  onClose,
  onSave,
  onDelete,
}: {
  goal: Goal;
  doc: Doc;
  onClose: () => void;
  onSave: (g: Goal) => void;
  onDelete: (g: Goal) => void;
}) {
  const [g, setG] = useState<Goal>(goal);
  const [milestone, setMilestone] = useState('');
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setG({ ...g, [k]: v });
  const habits = list(doc.habits).filter((h) => !h.archived);

  return (
    <Sheet
      title={goal.title ? 'Editar objetivo' : 'Nuevo objetivo'}
      onClose={onClose}
      footer={
        <div className="row">
          {goal.title && (
            <button className="btn danger small" onClick={() => onDelete(g)}>
              Borrar
            </button>
          )}
          <div className="spacer" />
          <button className="btn primary" disabled={!g.title.trim()} onClick={() => onSave(g)}>
            Guardar
          </button>
        </div>
      }
    >
      <label className="field">
        <span>Objetivo</span>
        <input
          type="text"
          value={g.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Aprobar todo en junio con media de 8"
        />
      </label>
      <label className="field">
        <span>Por que lo quieres (leelo cuando falles)</span>
        <textarea value={g.why} onChange={(e) => set('why', e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Fecha limite</span>
          <input type="date" value={g.deadline ?? ''} onChange={(e) => set('deadline', e.target.value)} />
        </label>
        <label className="field">
          <span>Estado</span>
          <select value={g.status} onChange={(e) => set('status', e.target.value as Goal['status'])}>
            <option value="activo">Activo</option>
            <option value="logrado">Logrado</option>
            <option value="abandonado">Abandonado</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Meta numerica</span>
          <input
            type="number"
            value={g.metricTarget ?? ''}
            onChange={(e) => set('metricTarget', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Actual</span>
          <input
            type="number"
            value={g.metricCurrent ?? ''}
            onChange={(e) => set('metricCurrent', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Unidad</span>
          <input type="text" value={g.metricUnit ?? ''} onChange={(e) => set('metricUnit', e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Habitos que lo empujan</span>
        <div className="row wrap">
          {habits.map((h) => {
            const on = g.habitIds.includes(h.id);
            return (
              <button
                key={h.id}
                className={`chip ${on ? 'on' : ''}`}
                onClick={() => set('habitIds', on ? g.habitIds.filter((x) => x !== h.id) : [...g.habitIds, h.id])}
              >
                {h.emoji} {h.name}
              </button>
            );
          })}
        </div>
      </label>

      <div className="section-label">Hitos</div>
      {g.milestones.map((m) => (
        <div className="row" key={m.id} style={{ marginBottom: 6, gap: 6 }}>
          <input
            type="text"
            value={m.title}
            onChange={(e) =>
              set('milestones', g.milestones.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))
            }
          />
          <input
            type="date"
            style={{ width: 140 }}
            value={m.due ?? ''}
            onChange={(e) =>
              set('milestones', g.milestones.map((x) => (x.id === m.id ? { ...x, due: e.target.value } : x)))
            }
          />
          <button
            className="btn ghost small"
            onClick={() => set('milestones', g.milestones.filter((x) => x.id !== m.id))}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 6 }}>
        <input
          type="text"
          value={milestone}
          placeholder="Terminar temas 1-4"
          onChange={(e) => setMilestone(e.target.value)}
        />
        <button
          className="btn small"
          disabled={!milestone.trim()}
          onClick={() => {
            const m: Milestone = { id: newId('ms_'), title: milestone.trim(), done: false };
            set('milestones', [...g.milestones, m]);
            setMilestone('');
          }}
        >
          Añadir
        </button>
      </div>
    </Sheet>
  );
}
