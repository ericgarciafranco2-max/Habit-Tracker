import { useState } from 'react';
import {
  canRetire,
  cancelRetire,
  put,
  requestRetire,
  softDelete,
  WEEKDAY_SHORT,
  type Doc,
  type Habit,
  type ISODate,
  type Schedule,
} from '@habit/core';
import { Sheet, Switch, useToast } from './ui.js';
import { PALETTE } from '../lib/palette.js';

const COLORS = PALETTE;
const EMOJIS = [
  '⏰', '📅', '📚', '🎓', '🏋️', '🚶', '📖', '🧘', '📵', '🥗',
  '💧', '📝', '🌙', '❄️', '🚀', '🧹', '💪', '🏃', '🎯', '💰',
];

/**
 * Editor completo de un habito. Todo es editable: objetivo, minimo valido,
 * dias, ventana horaria, peso, deuda por fallo... porque un sistema que no
 * puedes ajustar acabas abandonandolo en dos semanas.
 */
export function HabitSheet({
  habit,
  today,
  onClose,
  update,
}: {
  habit: Habit;
  today: ISODate;
  onClose: () => void;
  update: (fn: (d: Doc) => Doc) => void;
}) {
  const [h, setH] = useState<Habit>(habit);
  const toast = useToast();
  const set = <K extends keyof Habit>(k: K, v: Habit[K]) => setH({ ...h, [k]: v });
  const isNew = !habit.name;
  const retire = canRetire(h);

  const setScheduleType = (type: Schedule['type']) => {
    if (type === 'custom') set('schedule', { type: 'custom', days: [1, 2, 3, 4, 5] });
    else if (type === 'timesPerWeek') set('schedule', { type: 'timesPerWeek', timesPerWeek: 3 });
    else set('schedule', { type } as Schedule);
  };

  const toggleDay = (d: number) => {
    if (h.schedule.type !== 'custom') return;
    const days = h.schedule.days.includes(d)
      ? h.schedule.days.filter((x) => x !== d)
      : [...h.schedule.days, d].sort();
    set('schedule', { type: 'custom', days });
  };

  return (
    <Sheet
      title={isNew ? 'Nuevo habito' : 'Editar habito'}
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={!h.name.trim()}
          onClick={() => {
            update((d) => put(d, 'habits', { ...h, target: h.measure === 'check' ? 1 : h.target }));
            onClose();
          }}
        >
          Guardar
        </button>
      }
    >
      <label className="field">
        <span>Nombre</span>
        <input type="text" value={h.name} onChange={(e) => set('name', e.target.value)} placeholder="Entrenar" />
      </label>

      <label className="field">
        <span>Icono</span>
        <div className="row wrap" style={{ gap: 4 }}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`chip ${h.emoji === e ? 'on' : ''}`}
              style={{ fontSize: '1rem', padding: '4px 8px' }}
              onClick={() => set('emoji', e)}
            >
              {e}
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span>Color</span>
        <div className="row wrap" style={{ gap: 5 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => set('color', c)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: c,
                border: h.color === c ? '2.5px solid var(--text)' : '1px solid var(--separator)',
              }}
              aria-label={c}
            />
          ))}
        </div>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Tipo</span>
          <select value={h.kind} onChange={(e) => set('kind', e.target.value as Habit['kind'])}>
            <option value="build">Hacer</option>
            <option value="quit">Evitar</option>
          </select>
        </label>
        <label className="field">
          <span>Se mide en</span>
          <select value={h.measure} onChange={(e) => set('measure', e.target.value as Habit['measure'])}>
            <option value="check">Si / no</option>
            <option value="quantity">Cantidad</option>
            <option value="minutes">Minutos</option>
          </select>
        </label>
      </div>

      {h.measure !== 'check' && (
        <div className="field-row">
          <label className="field">
            <span>Objetivo</span>
            <input type="number" value={h.target} onChange={(e) => set('target', Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Minimo valido</span>
            <input type="number" value={h.minimum} onChange={(e) => set('minimum', Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Unidad</span>
            <input type="text" value={h.unit ?? ''} onChange={(e) => set('unit', e.target.value)} placeholder="min" />
          </label>
        </div>
      )}
      {h.measure !== 'check' && (
        <p className="tiny faint" style={{ marginTop: -4, marginBottom: 12 }}>
          El minimo es tu regla anti-cero: en un dia horrible haces eso y la racha sigue viva. Ponlo
          tan bajo que sea imposible no hacerlo.
        </p>
      )}

      <label className="field">
        <span>Cuando toca</span>
        <select value={h.schedule.type} onChange={(e) => setScheduleType(e.target.value as Schedule['type'])}>
          <option value="daily">Todos los dias</option>
          <option value="weekdays">Lunes a viernes</option>
          <option value="weekend">Fin de semana</option>
          <option value="custom">Dias concretos</option>
          <option value="timesPerWeek">X veces por semana</option>
          <option value="classDays">Dias con clase</option>
          <option value="freeDays">Dias sin clase</option>
        </select>
      </label>

      {h.schedule.type === 'custom' && (
        <div className="row wrap" style={{ marginBottom: 12, gap: 5 }}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              className={`chip ${h.schedule.type === 'custom' && h.schedule.days.includes(d) ? 'on' : ''}`}
              onClick={() => toggleDay(d)}
            >
              {WEEKDAY_SHORT[d]}
            </button>
          ))}
        </div>
      )}

      {h.schedule.type === 'timesPerWeek' && (
        <label className="field">
          <span>Veces por semana</span>
          <input
            type="number"
            min={1}
            max={7}
            value={h.schedule.timesPerWeek}
            onChange={(e) => set('schedule', { type: 'timesPerWeek', timesPerWeek: Number(e.target.value) })}
          />
        </label>
      )}

      <div className="field-row">
        <label className="field">
          <span>Ventana desde</span>
          <input type="time" value={h.windowStart ?? ''} onChange={(e) => set('windowStart', e.target.value)} />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input type="time" value={h.windowEnd ?? ''} onChange={(e) => set('windowEnd', e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Recordatorios (horas separadas por coma)</span>
        <input
          type="text"
          value={h.reminders.join(', ')}
          placeholder="07:00, 21:30"
          onChange={(e) =>
            set(
              'reminders',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter((s) => /^\d{1,2}:\d{2}$/.test(s)),
            )
          }
        />
      </label>

      <div className="section-label">Presion</div>

      <div className="row" style={{ marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="bold small">Innegociable</div>
          <div className="tiny faint">Bloquea tus recompensas del dia si no lo cumples.</div>
        </div>
        <Switch label="Innegociable" checked={h.nonNegotiable} onChange={(v) => set('nonNegotiable', v)} />
      </div>

      <label className="field">
        <span>Peso (1 = da igual, 5 = define tu año)</span>
        <input
          type="number"
          min={1}
          max={5}
          value={h.weight}
          onChange={(e) => set('weight', Math.min(5, Math.max(1, Number(e.target.value))))}
        />
      </label>

      <div className="row" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="bold small">Deuda si fallo</div>
          <div className="tiny faint">Cada fallo acumula una deuda que tendras que pagar de mas.</div>
        </div>
        <Switch
          label="Deuda si fallo"
          checked={Boolean(h.debtRule)}
          onChange={(v) => set('debtRule', v ? { amount: 15, unit: 'minutos' } : undefined)}
        />
      </div>
      {h.debtRule && (
        <div className="field-row">
          <label className="field">
            <span>Cantidad</span>
            <input
              type="number"
              value={h.debtRule.amount}
              onChange={(e) => set('debtRule', { ...h.debtRule!, amount: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Unidad</span>
            <select
              value={h.debtRule.unit}
              onChange={(e) =>
                set('debtRule', { ...h.debtRule!, unit: e.target.value as NonNullable<Habit['debtRule']>['unit'] })
              }
            >
              <option value="minutos">minutos</option>
              <option value="repeticiones">repeticiones</option>
              <option value="sesiones">sesiones</option>
              <option value="paginas">paginas</option>
              <option value="euros">euros</option>
            </select>
          </label>
        </div>
      )}

      <label className="field">
        <span>Notas / reglas propias</span>
        <textarea value={h.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {!isNew && (
        <>
          <hr className="sep" />
          <div className="small muted" style={{ marginBottom: 8 }}>
            Retirar un habito lleva 72h de enfriamiento. No se abandona en caliente un martes a las
            once de la noche.
          </div>
          {!h.retireRequestedAt ? (
            <button
              className="btn danger small block"
              onClick={() => {
                update((d) => requestRetire(d, h.id, today));
                setH({ ...h, retireRequestedAt: Date.now() });
                toast('Baja solicitada. Si en 72h sigues queriendo, se borra.');
              }}
            >
              Pedir la baja de este habito
            </button>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn small"
                onClick={() => {
                  update((d) => cancelRetire(d, h.id));
                  setH({ ...h, retireRequestedAt: undefined });
                  toast('Baja cancelada. Buena decision.');
                }}
              >
                Cancelar baja
              </button>
              <button
                className="btn danger small"
                disabled={!retire.allowed}
                onClick={() => {
                  update((d) => softDelete(d, 'habits', h.id));
                  onClose();
                }}
              >
                {retire.allowed ? 'Borrar definitivamente' : retire.reason}
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
