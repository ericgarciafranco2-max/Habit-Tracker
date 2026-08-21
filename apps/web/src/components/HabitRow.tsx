import { useState } from 'react';
import {
  canEditDate,
  counts,
  getEntry,
  isRequired,
  logHabit,
  streak,
  toggleHabit,
  useFreeze,
  weekProgress,
  type Doc,
  type Habit,
  type ISODate,
} from '@habit/core';
import { Sheet, useToast } from './ui.js';
import { scheduleLabel } from '../lib/format.js';

interface Props {
  doc: Doc;
  habit: Habit;
  date: ISODate;
  today: ISODate;
  update: (fn: (d: Doc) => Doc) => void;
  onEdit?: (habit: Habit) => void;
}

export function HabitRow({ doc, habit, date, today, update, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const entry = getEntry(doc, habit.id, date);
  const done = counts(entry);
  const required = isRequired(doc, habit, date);
  const permission = canEditDate(doc, date, today);
  const s = streak(doc, habit, today);
  const value = entry?.value ?? 0;

  const guard = (): boolean => {
    if (!permission.allowed) {
      toast(permission.reason ?? 'No puedes editar este dia');
      return false;
    }
    return true;
  };

  const setValue = (next: number) => {
    if (!guard()) return;
    update((d) => logHabit(d, habit.id, date, Math.max(0, next)));
  };

  const cls = entry?.status === 'frozen'
    ? 'frozen'
    : entry?.status === 'partial'
      ? 'partial'
      : done
        ? 'on'
        : entry?.status === 'missed' && value > 0
          ? 'fail'
          : '';

  const mark = entry?.status === 'frozen' ? '❄' : entry?.status === 'partial' ? '◐' : done ? '✓' : '';

  const wp = habit.schedule.type === 'timesPerWeek' ? weekProgress(doc, habit, date) : null;

  return (
    <>
      <div className={`habit-row ${done ? 'done' : ''}`}>
        <div className="emoji" style={{ background: `color-mix(in srgb, ${habit.color} 22%, transparent)` }}>
          {habit.emoji}
        </div>
        <button
          className="info"
          onClick={() => setOpen(true)}
          style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }}
        >
          <div className="name">
            <span className="dot" style={{ background: habit.color }} />
            {habit.name}
            {habit.nonNegotiable && <span className="chip danger tiny">innegociable</span>}
          </div>
          <div className="meta">
            {habit.kind === 'quit' ? (
              <span>evitar</span>
            ) : habit.measure === 'check' ? (
              <span>{scheduleLabel(habit.schedule)}</span>
            ) : (
              <span>
                {value} / {habit.target} {habit.unit ?? ''}
              </span>
            )}
            {s.current > 0 && <span>🔥 {s.current}</span>}
            {wp && (
              <span>
                semana {wp.done}/{wp.quota}
              </span>
            )}
            {!required && <span className="faint">opcional hoy</span>}
          </div>
        </button>

        {habit.measure === 'check' || habit.kind === 'quit' ? (
          <button
            className={`check ${cls}`}
            aria-label={`Marcar ${habit.name}`}
            onClick={() => {
              if (!guard()) return;
              update((d) => toggleHabit(d, habit.id, date));
            }}
          >
            {habit.kind === 'quit' && !done ? '✕' : mark}
          </button>
        ) : (
          <div className="stepper">
            <button onClick={() => setValue(value - stepOf(habit))} aria-label="Restar">
              −
            </button>
            <div className={`value ${done ? 'bold' : 'faint'}`}>{value}</div>
            <button onClick={() => setValue(value + stepOf(habit))} aria-label="Sumar">
              +
            </button>
          </div>
        )}
      </div>

      {open && (
        <Sheet title={`${habit.emoji} ${habit.name}`} onClose={() => setOpen(false)}>
          <div className="grid grid-3" style={{ marginBottom: 12 }}>
            <div className="stat">
              <div className="k">Racha</div>
              <div className="v">🔥 {s.current}</div>
              <div className="s">record {s.best}</div>
            </div>
            <div className="stat">
              <div className="k">Fallos 7d</div>
              <div className="v" style={{ color: s.recentMisses >= 3 ? 'var(--danger)' : undefined }}>
                {s.recentMisses}
              </div>
              <div className="s">3 = sancion</div>
            </div>
            <div className="stat">
              <div className="k">Peso</div>
              <div className="v">{habit.weight}</div>
              <div className="s">{habit.nonNegotiable ? 'innegociable' : 'normal'}</div>
            </div>
          </div>

          {habit.notes && <p className="muted small">{habit.notes}</p>}

          <div className="small muted stack" style={{ marginBottom: 14 }}>
            <div>
              <b>Objetivo:</b> {habit.target} {habit.unit ?? (habit.measure === 'check' ? '' : '')} ·{' '}
              <b>Minimo valido:</b> {habit.minimum} {habit.unit ?? ''}
            </div>
            <div>
              <b>Cuando:</b> {scheduleLabel(habit.schedule)}
              {habit.windowStart && ` · ${habit.windowStart}-${habit.windowEnd}`}
            </div>
            {habit.debtRule && (
              <div>
                <b>Si fallas:</b> +{habit.debtRule.amount} {habit.debtRule.unit} de deuda
              </div>
            )}
          </div>

          {habit.measure !== 'check' && (
            <label className="field">
              <span>Registro de hoy ({habit.unit ?? 'unidades'})</span>
              <input
                type="number"
                value={value}
                min={0}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </label>
          )}

          <label className="field">
            <span>Nota del dia</span>
            <input
              type="text"
              value={entry?.note ?? ''}
              placeholder="Que ha pasado hoy con esto"
              onChange={(e) => {
                if (!guard()) return;
                const note = e.target.value;
                update((d) => logHabit(d, habit.id, date, value, { note }));
              }}
            />
          </label>

          <div className="row wrap" style={{ marginTop: 8 }}>
            <button
              className="btn small"
              disabled={doc.profile.freezeTokens <= 0 || entry?.status === 'frozen'}
              onClick={() => {
                update((d) => useFreeze(d, habit.id, date));
                toast(`Dia congelado. Te quedan ${doc.profile.freezeTokens - 1} fichas este mes.`);
                setOpen(false);
              }}
            >
              ❄ Congelar ({doc.profile.freezeTokens})
            </button>
            {onEdit && (
              <button
                className="btn small"
                onClick={() => {
                  setOpen(false);
                  onEdit(habit);
                }}
              >
                Editar habito
              </button>
            )}
          </div>
          <p className="tiny faint" style={{ marginTop: 10 }}>
            Congelar salva la racha sin mentir: queda registrado que ese dia no lo hiciste. Solo 2 al mes.
          </p>
        </Sheet>
      )}
    </>
  );
}

function stepOf(habit: Habit): number {
  if (habit.measure === 'minutes') return 5;
  if (habit.target >= 1000) return 500;
  if (habit.target >= 100) return 10;
  return 1;
}
