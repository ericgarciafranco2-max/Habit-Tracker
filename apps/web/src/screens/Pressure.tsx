import { useMemo, useState } from 'react';
import {
  activePenance,
  addDays,
  auditReportText,
  completePenance,
  formatDateShort,
  list,
  newId,
  patchProfile,
  payDebt,
  pendingDebts,
  put,
  rewardLock,
  softDelete,
  startOfWeek,
  weeklyAudit,
  type Contract,
  type Penance,
  type Reward,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { Bar, Empty, Segmented, Sheet, useConfirm, useToast } from '../components/ui.js';
import { hm, pct } from '../lib/format.js';

type Tab = 'contrato' | 'consecuencias' | 'auditoria';

/**
 * La pantalla que hace que esto no sea "otra app de habitos": aqui vive el
 * contrato, la deuda, las penitencias y el informe que se manda a tu auditor.
 */
export function Pressure() {
  const [tab, setTab] = useState<Tab>('contrato');
  return (
    <>
      <h1 style={{ marginBottom: 12 }}>Presion</h1>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'contrato', label: 'Contrato' },
          { value: 'consecuencias', label: 'Consecuencias' },
          { value: 'auditoria', label: 'Auditoria' },
        ]}
      />
      {tab === 'contrato' && <ContractTab />}
      {tab === 'consecuencias' && <ConsequencesTab />}
      {tab === 'auditoria' && <AuditTab />}
    </>
  );
}

/* ---------------------------- Contrato ---------------------------- */

function ContractTab() {
  const { doc, today, update } = useStore();
  const [editing, setEditing] = useState<Contract | null>(null);
  const { confirm, node } = useConfirm();
  const toast = useToast();
  const contracts = list(doc.contracts).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const active = contracts.find((c) => c.status === 'activo');

  const blank = (): Contract => ({
    id: newId('ct_'),
    updatedAt: Date.now(),
    title: 'Contrato del semestre',
    startDate: today,
    endDate: addDays(today, 90),
    habitIds: list(doc.habits).filter((h) => h.nonNegotiable).map((h) => h.id),
    weeklyThreshold: 85,
    stakeType: 'dinero',
    stakeAmount: 50,
    stakeDescription: '50 EUR a quien menos me apetezca, transferidos por mi auditor',
    status: 'borrador',
  });

  return (
    <>
      {node}
      {!active && (
        <div className="banner warn">
          <span className="icon">✍️</span>
          <div style={{ flex: 1 }}>
            <b>No tienes contrato firmado</b>
            <div className="small">
              Un objetivo sin consecuencia es un deseo. Firma un contrato: define el minimo semanal, la
              prenda si fallas y quien te audita.
            </div>
            <button className="btn small primary" style={{ marginTop: 8 }} onClick={() => setEditing(blank())}>
              Redactar contrato
            </button>
          </div>
        </div>
      )}

      {contracts.map((c) => {
        const audit = weeklyAudit(doc, today, today);
        const ok = audit.rate * 100 >= c.weeklyThreshold;
        return (
          <div className="card" key={c.id}>
            <div className="card-head">
              <h3>{c.title}</h3>
              <span className={`chip ${c.status === 'activo' ? 'on' : c.status === 'roto' ? 'danger' : ''}`}>
                {c.status}
              </span>
            </div>
            <div className="small muted" style={{ marginBottom: 8 }}>
              {c.startDate} → {c.endDate} · minimo {c.weeklyThreshold}% semanal
            </div>
            <div className="banner" style={{ marginBottom: 8, borderColor: 'var(--line-strong)' }}>
              <span className="icon">⚠️</span>
              <div>
                <b>Si fallo:</b> {c.stakeDescription}
                {c.refereeName && (
                  <div className="tiny faint">Auditor: {c.refereeName} {c.refereeEmail && `(${c.refereeEmail})`}</div>
                )}
              </div>
            </div>
            {c.status === 'activo' && (
              <>
                <div className="row tiny" style={{ marginBottom: 4 }}>
                  <span style={{ flex: 1 }}>Semana en curso</span>
                  <span className="mono bold" style={{ color: ok ? 'var(--accent)' : 'var(--danger)' }}>
                    {pct(audit.rate)} / {c.weeklyThreshold}%
                  </span>
                </div>
                <Bar value={audit.rate} color={ok ? 'var(--accent)' : 'var(--danger)'} />
              </>
            )}
            <div className="row wrap" style={{ marginTop: 10 }}>
              {c.status === 'borrador' && (
                <button
                  className="btn primary small"
                  onClick={async () => {
                    const ok2 = await confirm(
                      'Firmar contrato',
                      'Una vez firmado no se puede suavizar hasta la fecha de fin. Se puede romper, pero quedara registrado. ¿Firmas?',
                      'Firmo',
                    );
                    if (!ok2) return;
                    update((d) =>
                      put(d, 'contracts', {
                        ...c,
                        status: 'activo',
                        signedAt: Date.now(),
                        lockedUntil: c.endDate,
                      }),
                    );
                    toast('Contrato firmado. A partir de ahora hay consecuencias.');
                  }}
                >
                  Firmar
                </button>
              )}
              {c.status === 'activo' && (
                <>
                  <button
                    className="btn danger small"
                    onClick={async () => {
                      const ok2 = await confirm(
                        'Romper el contrato',
                        `Vas a declarar que no lo has cumplido. Se ejecuta la prenda: ${c.stakeDescription}. Queda en el historial.`,
                        'Lo rompo',
                      );
                      if (!ok2) return;
                      update((d) => put(d, 'contracts', { ...c, status: 'roto' }));
                    }}
                  >
                    Romper (asumo la prenda)
                  </button>
                  <button
                    className="btn small"
                    onClick={() =>
                      update((d) => put(d, 'contracts', { ...c, status: 'cumplido' }))
                    }
                  >
                    Marcar cumplido
                  </button>
                </>
              )}
              {c.status === 'borrador' && (
                <button className="btn ghost small" onClick={() => setEditing(c)}>
                  Editar
                </button>
              )}
            </div>
            {c.status === 'activo' && (
              <p className="tiny faint" style={{ marginTop: 8 }}>
                Un contrato firmado no se edita. Esa es toda la gracia.
              </p>
            )}
          </div>
        );
      })}

      {contracts.length > 0 && !active && (
        <button className="btn block" onClick={() => setEditing(blank())}>
          + Nuevo contrato
        </button>
      )}

      {editing && (
        <ContractSheet
          contract={editing}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            update((d) => put(d, 'contracts', c));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ContractSheet({
  contract,
  onClose,
  onSave,
}: {
  contract: Contract;
  onClose: () => void;
  onSave: (c: Contract) => void;
}) {
  const { doc } = useStore();
  const [c, setC] = useState<Contract>(contract);
  const set = <K extends keyof Contract>(k: K, v: Contract[K]) => setC({ ...c, [k]: v });
  const habits = list(doc.habits).filter((h) => !h.archived);

  return (
    <Sheet
      title="Contrato de compromiso"
      onClose={onClose}
      footer={
        <button className="btn primary block" onClick={() => onSave(c)}>
          Guardar borrador
        </button>
      }
    >
      <p className="muted small">
        Esto no es un formulario decorativo: es lo que vas a leer cuando no te apetezca. Escribe una
        prenda que de verdad te duela y pon a alguien que la ejecute.
      </p>
      <label className="field">
        <span>Titulo</span>
        <input type="text" value={c.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Desde</span>
          <input type="date" value={c.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input type="date" value={c.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Minimo semanal exigido (%)</span>
        <input
          type="number"
          min={50}
          max={100}
          value={c.weeklyThreshold}
          onChange={(e) => set('weeklyThreshold', Number(e.target.value))}
        />
      </label>
      <label className="field">
        <span>Habitos cubiertos</span>
        <div className="row wrap">
          {habits.map((h) => {
            const on = c.habitIds.includes(h.id);
            return (
              <button
                key={h.id}
                className={`chip ${on ? 'on' : ''}`}
                onClick={() =>
                  set('habitIds', on ? c.habitIds.filter((x) => x !== h.id) : [...c.habitIds, h.id])
                }
              >
                {h.emoji} {h.name}
              </button>
            );
          })}
        </div>
      </label>
      <label className="field">
        <span>Tipo de prenda</span>
        <select value={c.stakeType} onChange={(e) => set('stakeType', e.target.value as Contract['stakeType'])}>
          <option value="dinero">Dinero</option>
          <option value="prenda">Prenda / castigo</option>
          <option value="social">Social (lo cuentas)</option>
          <option value="privilegio">Perder un privilegio</option>
        </select>
      </label>
      <label className="field">
        <span>Que pasa exactamente si fallo</span>
        <textarea
          value={c.stakeDescription}
          onChange={(e) => set('stakeDescription', e.target.value)}
          placeholder="Mi hermano transfiere 50 EUR de mi cuenta a la suya y no me los devuelve."
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Auditor</span>
          <input type="text" value={c.refereeName ?? ''} onChange={(e) => set('refereeName', e.target.value)} />
        </label>
        <label className="field">
          <span>Su email</span>
          <input type="email" value={c.refereeEmail ?? ''} onChange={(e) => set('refereeEmail', e.target.value)} />
        </label>
      </div>
    </Sheet>
  );
}

/* -------------------------- Consecuencias -------------------------- */

function ConsequencesTab() {
  const { doc, today, update } = useStore();
  const toast = useToast();
  const debts = pendingDebts(doc);
  const penance = activePenance(doc);
  const penances = list(doc.penances);
  const rewards = list(doc.rewards);
  const lock = rewardLock(doc, today);
  const [newPenance, setNewPenance] = useState('');
  const [newReward, setNewReward] = useState('');

  return (
    <>
      <div className="section-label">Deuda pendiente</div>
      <div className="card">
        {debts.length ? (
          <>
            {debts.map((d) => (
              <div className="list-item" key={d.id}>
                <span style={{ fontSize: '1.1rem' }}>📉</span>
                <div style={{ flex: 1 }}>
                  <div className="bold small">
                    {d.amount} {d.unit}
                  </div>
                  <div className="tiny faint">{d.reason}</div>
                </div>
                <button className="btn small" onClick={() => update((doc2) => payDebt(doc2, d.id, today))}>
                  Pagada
                </button>
              </div>
            ))}
            <p className="tiny faint" style={{ marginTop: 8 }}>
              La deuda tambien se paga sola: si superas el objetivo de un habito, el excedente descuenta.
            </p>
          </>
        ) : (
          <Empty text="Sin deuda. Manten esto asi." />
        )}
      </div>

      <div className="section-label">Penitencias</div>
      <div className="card">
        {penance && (
          <div className="banner danger" style={{ marginBottom: 10 }}>
            <span className="icon">⚖️</span>
            <div style={{ flex: 1 }}>
              <b>Activa ahora</b>
              <div className="small">{penance.text}</div>
              <button
                className="btn small primary"
                style={{ marginTop: 8 }}
                onClick={() => update((d) => completePenance(d, penance.id, today))}
              >
                Cumplida
              </button>
            </div>
          </div>
        )}
        <p className="tiny faint">
          Se asigna sola al tercer fallo del mismo habito en 7 dias. Escribelas ahora, que ahora estas
          motivado; luego ya no te apetecera.
        </p>
        {penances.map((p) => (
          <div className="list-item" key={p.id}>
            <span className="chip tiny">{'!'.repeat(p.severity)}</span>
            <div style={{ flex: 1 }} className="small">
              {p.text}
            </div>
            <button className="btn ghost small" onClick={() => update((d) => softDelete(d, 'penances', p.id))}>
              ✕
            </button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          <input
            type="text"
            value={newPenance}
            placeholder="100 flexiones antes de dormir"
            onChange={(e) => setNewPenance(e.target.value)}
          />
          <button
            className="btn small"
            disabled={!newPenance.trim()}
            onClick={() => {
              const p: Penance = {
                id: newId('pen_'),
                updatedAt: Date.now(),
                text: newPenance.trim(),
                severity: 2,
                active: false,
              };
              update((d) => put(d, 'penances', p));
              setNewPenance('');
            }}
          >
            Añadir
          </button>
        </div>
      </div>

      <div className="section-label">Recompensas bloqueadas</div>
      <div className="card">
        <div className={`banner ${lock.locked ? 'warn' : 'ok'}`} style={{ marginBottom: 10 }}>
          <span className="icon">{lock.locked ? '🔒' : '🔓'}</span>
          <div className="small">{lock.reason}</div>
        </div>
        {rewards.map((r) => (
          <div className="list-item" key={r.id}>
            <span>{r.emoji}</span>
            <div style={{ flex: 1 }} className="small">
              {r.text}
            </div>
            <span className="chip tiny">{r.cadence}</span>
            <button className="btn ghost small" onClick={() => update((d) => softDelete(d, 'rewards', r.id))}>
              ✕
            </button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          <input
            type="text"
            value={newReward}
            placeholder="Una hora de PlayStation"
            onChange={(e) => setNewReward(e.target.value)}
          />
          <button
            className="btn small"
            disabled={!newReward.trim()}
            onClick={() => {
              const r: Reward = {
                id: newId('rw_'),
                updatedAt: Date.now(),
                text: newReward.trim(),
                emoji: '🎁',
                cadence: 'diaria',
                enabled: true,
              };
              update((d) => put(d, 'rewards', r));
              setNewReward('');
            }}
          >
            Añadir
          </button>
        </div>
      </div>

      <div className="section-label">Blindaje</div>
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="bold small">Modo estricto</div>
            <div className="tiny faint">
              Prohibe editar dias mas alla de ayer y obliga a 72h de enfriamiento para retirar un habito.
            </div>
          </div>
          <input
            type="checkbox"
            checked={doc.profile.strictMode}
            style={{ width: 20, height: 20 }}
            onChange={(e) => {
              update((d) => patchProfile(d, { strictMode: e.target.checked }));
              toast(e.target.checked ? 'Modo estricto activado.' : 'Modo estricto desactivado. Tu sabras.');
            }}
          />
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>
            <div className="bold small">Congelaciones este mes</div>
            <div className="tiny faint">
              Te quedan {doc.profile.freezeTokens}. Usadas: {doc.profile.freezeTokensUsedThisMonth}.
            </div>
          </div>
          <span className="chip">❄ {doc.profile.freezeTokens}</span>
        </div>
      </div>
    </>
  );
}

/* --------------------------- Auditoria ---------------------------- */

function AuditTab() {
  const { doc, today } = useStore();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const weekDate = addDays(startOfWeek(today), -7 * offset);
  const audit = useMemo(() => weeklyAudit(doc, weekDate, today), [doc, weekDate, today]);
  const report = auditReportText(doc, audit);
  const contract = list(doc.contracts).find((c) => c.status === 'activo');

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Informe semanal', text: report });
        return;
      }
      await navigator.clipboard.writeText(report);
      toast('Informe copiado. Mandaselo a tu auditor.');
    } catch {
      toast('No se ha podido compartir. Copialo a mano.');
    }
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn ghost small" onClick={() => setOffset(offset + 1)}>
          ‹
        </button>
        <div style={{ flex: 1, textAlign: 'center' }} className="small bold">
          {formatDateShort(audit.weekStart)} — {formatDateShort(audit.weekEnd)}
        </div>
        <button className="btn ghost small" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>
          ›
        </button>
      </div>

      <div className="card">
        <div className="grid grid-4" style={{ marginBottom: 12 }}>
          <div className="stat">
            <div className="k">Cumplido</div>
            <div className="v" style={{ color: audit.rate >= 0.85 ? 'var(--accent)' : 'var(--warn)' }}>
              {pct(audit.rate)}
            </div>
          </div>
          <div className="stat">
            <div className="k">Perfectos</div>
            <div className="v">{audit.perfectDays}</div>
            <div className="s">de 7</div>
          </div>
          <div className="stat">
            <div className="k">Fallos</div>
            <div className="v" style={{ color: audit.misses ? 'var(--danger)' : undefined }}>
              {audit.misses}
            </div>
          </div>
          <div className="stat">
            <div className="k">Estudio</div>
            <div className="v">{hm(audit.studyMinutes)}</div>
          </div>
        </div>
        <div className={`banner ${audit.rate >= 0.85 ? 'ok' : 'warn'}`}>
          <span className="icon">{audit.rate >= 0.85 ? '🏆' : '📌'}</span>
          <div className="small">{audit.verdict}</div>
        </div>
        {contract && (
          <div className={`banner ${audit.contractOk ? 'ok' : 'danger'}`}>
            <span className="icon">{audit.contractOk ? '✅' : '⚠️'}</span>
            <div className="small">
              {audit.contractOk
                ? `Contrato cumplido (minimo ${contract.weeklyThreshold}%).`
                : `Contrato incumplido. Prenda: ${contract.stakeDescription}`}
            </div>
          </div>
        )}
      </div>

      {audit.worst.length > 0 && (
        <>
          <div className="section-label">Lo que te esta hundiendo</div>
          <div className="card">
            {audit.worst.map((w) => (
              <div className="list-item" key={w.habit.id}>
                <span>{w.habit.emoji}</span>
                <div style={{ flex: 1 }} className="small">
                  {w.habit.name}
                </div>
                <span className="chip danger tiny">-{w.misses}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {audit.best.length > 0 && (
        <>
          <div className="section-label">Lo que si estas haciendo</div>
          <div className="card">
            {audit.best.map((b) => (
              <div className="list-item" key={b.habit.id}>
                <span>{b.habit.emoji}</span>
                <div style={{ flex: 1 }} className="small">
                  {b.habit.name}
                </div>
                <span className="chip on tiny">{b.done}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {audit.lateEdits > 0 && (
        <div className="banner warn">
          <span className="icon">👀</span>
          <div className="small">
            {audit.lateEdits} registro(s) editados mas de 24h despues. Marcarlo tarde no es hacerlo.
          </div>
        </div>
      )}

      <div className="section-label">Informe para tu auditor</div>
      <div className="card">
        <pre
          className="mono tiny"
          style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text-dim)' }}
        >
          {report}
        </pre>
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={share}>
          Compartir / copiar informe
        </button>
        {contract?.refereeEmail && (
          <a
            className="btn block small"
            style={{ marginTop: 8, textAlign: 'center', textDecoration: 'none' }}
            href={`mailto:${contract.refereeEmail}?subject=${encodeURIComponent(
              `Informe semanal ${audit.weekStart}`,
            )}&body=${encodeURIComponent(report)}`}
          >
            Enviar a {contract.refereeName ?? 'mi auditor'}
          </a>
        )}
      </div>
    </>
  );
}
