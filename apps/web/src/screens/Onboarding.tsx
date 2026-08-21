import { useState } from 'react';
import {
  DEFAULT_HABIT_KEYS,
  HABIT_CATALOG,
  createStarterDoc,
  list,
  newId,
  patchProfile,
  put,
  type Doc,
  type Penance,
  type Reward,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { scheduleLabel } from '../lib/format.js';

/**
 * Alta en cuatro pasos. Lo importante no es rellenar campos: es que el usuario
 * decida sus innegociables y escriba sus consecuencias mientras esta motivado,
 * porque dentro de dos semanas no lo hara.
 */
export function Onboarding() {
  const { replace, update } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [keys, setKeys] = useState<string[]>(DEFAULT_HABIT_KEYS);
  const [nonNeg, setNonNeg] = useState<string[]>(
    HABIT_CATALOG.filter((h) => h.nonNegotiable && DEFAULT_HABIT_KEYS.includes(h.key)).map((h) => h.key),
  );
  const [wake, setWake] = useState('06:45');
  const [sleep, setSleep] = useState('23:30');
  const [penances, setPenances] = useState<string[]>([
    '50 burpees hoy mismo',
    'Fin de semana sin videojuegos',
    '10 EUR fuera de mi bolsillo',
  ]);
  const [rewards, setRewards] = useState<string[]>(['1 hora de juego o serie', 'Salir el sabado']);

  const finish = () => {
    let doc: Doc = createStarterDoc(name || 'Yo', keys);
    // Aplicamos la eleccion de innegociables sobre los habitos creados.
    const byName = new Map(list(doc.habits).map((h) => [h.name, h]));
    for (const tpl of HABIT_CATALOG) {
      const h = byName.get(tpl.name);
      if (!h) continue;
      const shouldBe = nonNeg.includes(tpl.key);
      if (h.nonNegotiable !== shouldBe) doc = put(doc, 'habits', { ...h, nonNegotiable: shouldBe });
    }
    // Penitencias y recompensas escritas por el usuario sustituyen a las de ejemplo.
    doc = { ...doc, penances: {}, rewards: {} };
    penances.filter(Boolean).forEach((text, i) => {
      const p: Penance = {
        id: newId('pen_'),
        updatedAt: Date.now(),
        text,
        severity: (Math.min(3, i + 1) as 1 | 2 | 3),
        active: false,
      };
      doc = put(doc, 'penances', p);
    });
    rewards.filter(Boolean).forEach((text) => {
      const r: Reward = {
        id: newId('rw_'),
        updatedAt: Date.now(),
        text,
        emoji: '🎁',
        cadence: 'diaria',
        enabled: true,
      };
      doc = put(doc, 'rewards', r);
    });
    doc = patchProfile(doc, { wakeTime: wake, sleepTime: sleep, onboarded: true });
    replace(doc);
    void update;
  };

  return (
    <div className="app-main" style={{ maxWidth: 560, paddingBottom: 48, paddingTop: 28 }}>
      <div className="row" style={{ marginBottom: 18, gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= step ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>

      {step === 0 && (
        <>
          <h1 className="title-lg" style={{ marginBottom: 10 }}>Esto no es otra app de habitos</h1>
          <p className="muted">
            Es un sistema con consecuencias. Marcar casillas no cambia nada; lo que cambia algo es que
            fallar cueste y cumplir desbloquee. En dos minutos lo dejamos montado.
          </p>
          <label className="field" style={{ marginTop: 18 }}>
            <span>¿Como te llamas?</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoFocus />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Me levanto</span>
              <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
            </label>
            <label className="field">
              <span>Me acuesto</span>
              <input type="time" value={sleep} onChange={(e) => setSleep(e.target.value)} />
            </label>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="title-lg" style={{ marginBottom: 10 }}>Elige tus habitos</h1>
          <p className="muted small">
            Menos es mas. Con 6-10 vas sobrado; todos se pueden editar o quitar despues.
          </p>
          <div className="card flush" style={{ marginTop: 16 }}>
            {HABIT_CATALOG.map((tpl) => {
              const on = keys.includes(tpl.key);
              return (
                <div className="habit-row" key={tpl.key}>
                  <span className="emoji" style={{ background: `color-mix(in srgb, ${tpl.color} 16%, transparent)` }}>
                    {tpl.emoji}
                  </span>
                  <div className="info">
                    <div className="name">{tpl.name}</div>
                    <div className="meta">
                      <span>{scheduleLabel(tpl.schedule)}</span>
                      {tpl.measure !== 'check' && (
                        <span>
                          {tpl.target} {tpl.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className={`check ${on ? 'on' : ''}`}
                    onClick={() => setKeys(on ? keys.filter((k) => k !== tpl.key) : [...keys, tpl.key])}
                  >
                    {on ? '✓' : ''}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="title-lg" style={{ marginBottom: 10 }}>¿Cuales son innegociables?</h1>
          <p className="muted small">
            Los innegociables bloquean tus recompensas del dia si no los cumples. Elige pocos: dos o
            tres. Si todo es innegociable, nada lo es.
          </p>
          <div className="row wrap" style={{ marginTop: 14 }}>
            {keys.map((k) => {
              const tpl = HABIT_CATALOG.find((h) => h.key === k)!;
              const on = nonNeg.includes(k);
              return (
                <button
                  key={k}
                  className={`chip ${on ? 'on' : ''}`}
                  style={{ padding: '8px 12px' }}
                  onClick={() => setNonNeg(on ? nonNeg.filter((x) => x !== k) : [...nonNeg, k])}
                >
                  {tpl.emoji} {tpl.name}
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="title-lg" style={{ marginBottom: 10 }}>Consecuencias y recompensas</h1>
          <p className="muted small">
            Escribelas ahora, con la cabeza fria. La app las sacara cuando falles tres veces, que es
            justo cuando no querras escribirlas.
          </p>
          <div className="section-label">Si fallo, me toca...</div>
          {penances.map((p, i) => (
            <label className="field" key={i}>
              <input
                type="text"
                value={p}
                onChange={(e) => setPenances(penances.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </label>
          ))}
          <div className="section-label">Se desbloquea cuando cumplo...</div>
          {rewards.map((r, i) => (
            <label className="field" key={i}>
              <input
                type="text"
                value={r}
                onChange={(e) => setRewards(rewards.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </label>
          ))}
        </>
      )}

      <div className="row" style={{ marginTop: 20, gap: 8 }}>
        {step > 0 && (
          <button className="btn" onClick={() => setStep(step - 1)}>
            Atras
          </button>
        )}
        <div className="spacer" />
        {step < 3 ? (
          <button className="btn primary" disabled={step === 1 && keys.length === 0} onClick={() => setStep(step + 1)}>
            Siguiente
          </button>
        ) : (
          <button className="btn primary" onClick={finish}>
            Empezar
          </button>
        )}
      </div>
    </div>
  );
}
