import { useRef, useState } from 'react';
import {
  DEFAULT_HABIT_KEYS,
  HABIT_CATALOG,
  ensureDoc,
  habitFromTemplate,
  list,
  newId,
  patchProfile,
  put,
  putMany,
  type Habit,
} from '@habit/core';
import { useStore } from '../store/store.js';
import { defaultServerUrl, login, register } from '../store/api.js';
import { Empty, Segmented, Sheet, Switch, useConfirm, useToast } from '../components/ui.js';
import { HabitSheet } from '../components/HabitSheet.js';
import { requestPermission } from '../lib/notifications.js';
import { scheduleLabel } from '../lib/format.js';

type Tab = 'habitos' | 'perfil' | 'sync' | 'datos';

export function Settings({ editing, setEditing }: { editing: Habit | null; setEditing: (h: Habit | null) => void }) {
  const [tab, setTab] = useState<Tab>('habitos');
  return (
    <>
      <div className="page-head">
        <h1 className="title-lg">Ajustes</h1>
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'habitos', label: 'Habitos' },
          { value: 'perfil', label: 'Perfil' },
          { value: 'sync', label: 'Sincronizacion' },
          { value: 'datos', label: 'Datos' },
        ]}
      />
      {tab === 'habitos' && <HabitsTab editing={editing} setEditing={setEditing} />}
      {tab === 'perfil' && <ProfileTab />}
      {tab === 'sync' && <SyncTab />}
      {tab === 'datos' && <DataTab />}
    </>
  );
}

/* ---------------------------- Habitos ----------------------------- */

function HabitsTab({ editing, setEditing }: { editing: Habit | null; setEditing: (h: Habit | null) => void }) {
  const { doc, today, update } = useStore();
  const [catalog, setCatalog] = useState(false);
  const habits = list(doc.habits).filter((h) => !h.archived).sort((a, b) => a.order - b.order);

  const blank = (): Habit => ({
    id: newId('h_'),
    updatedAt: Date.now(),
    createdAt: Date.now(),
    name: '',
    emoji: '🎯',
    color: '#7dd3a0',
    category: 'otro',
    kind: 'build',
    measure: 'check',
    target: 1,
    minimum: 1,
    schedule: { type: 'daily' },
    reminders: [],
    nonNegotiable: false,
    weight: 3,
    order: habits.length,
    archived: false,
  });

  const move = (habit: Habit, delta: number) => {
    const idx = habits.findIndex((h) => h.id === habit.id);
    const target = idx + delta;
    if (target < 0 || target >= habits.length) return;
    const reordered = [...habits];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(target, 0, item!);
    update((d) => putMany(d, 'habits', reordered.map((h, i) => ({ ...h, order: i }))));
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12, gap: 8 }}>
        <button className="btn primary" style={{ flex: 1 }} onClick={() => setEditing(blank())}>
          + Nuevo habito
        </button>
        <button className="btn" onClick={() => setCatalog(true)}>
          Catalogo
        </button>
      </div>

      <div className="card flush">
        {habits.map((h, i) => (
          <div className="habit-row" key={h.id}>
            <div className="emoji" style={{ background: `color-mix(in srgb, ${h.color} 22%, transparent)` }}>
              {h.emoji}
            </div>
            <button
              className="info"
              style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }}
              onClick={() => setEditing(h)}
            >
              <div className="name">
                {h.name}
                {h.nonNegotiable && <span className="chip bad tiny">innegociable</span>}
                {h.retireRequestedAt && <span className="chip warn tiny">baja pedida</span>}
              </div>
              <div className="meta">
                <span>{scheduleLabel(h.schedule)}</span>
                <span>peso {h.weight}</span>
                {h.debtRule && (
                  <span>
                    deuda {h.debtRule.amount} {h.debtRule.unit}
                  </span>
                )}
              </div>
            </button>
            <div className="stack" style={{ gap: 2 }}>
              <button className="btn ghost small" disabled={i === 0} onClick={() => move(h, -1)} style={{ padding: '0 6px' }}>
                ▲
              </button>
              <button
                className="btn ghost small"
                disabled={i === habits.length - 1}
                onClick={() => move(h, 1)}
                style={{ padding: '0 6px' }}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
        {!habits.length && <Empty text="Sin habitos. Empieza con 4 o 5, no con quince." />}
      </div>

      <p className="tiny faint">
        Consejo que vale mas que la app entera: menos habitos, mas innegociables. Cinco cumplidos
        valen mas que quince a medias.
      </p>

      {editing && (
        <HabitSheet habit={editing} today={today} update={update} onClose={() => setEditing(null)} />
      )}

      {catalog && (
        <Sheet title="Catalogo de habitos" onClose={() => setCatalog(false)}>
          <p className="muted small">Toca uno para añadirlo. Luego lo ajustas a tu vida.</p>
          {HABIT_CATALOG.map((tpl) => {
            const already = habits.some((h) => h.name === tpl.name);
            return (
              <div className="list-item" key={tpl.key}>
                <span style={{ fontSize: '1.1rem' }}>{tpl.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div className="small bold">{tpl.name}</div>
                  <div className="tiny faint">
                    {scheduleLabel(tpl.schedule)}
                    {tpl.nonNegotiable && ' · innegociable'}
                  </div>
                </div>
                <button
                  className="btn small"
                  disabled={already}
                  onClick={() =>
                    update((d) => put(d, 'habits', habitFromTemplate(tpl, habits.length)))
                  }
                >
                  {already ? 'Ya lo tienes' : 'Añadir'}
                </button>
              </div>
            );
          })}
          <p className="tiny faint" style={{ marginTop: 10 }}>
            Recomendados para empezar: {DEFAULT_HABIT_KEYS.length} habitos, de los cuales 4 innegociables.
          </p>
        </Sheet>
      )}
    </>
  );
}

/* ----------------------------- Perfil ----------------------------- */

function ProfileTab() {
  const { doc, update } = useStore();
  const toast = useToast();
  const p = doc.profile;

  return (
    <div className="card">
      <label className="field">
        <span>Tu nombre</span>
        <input type="text" value={p.name} onChange={(e) => update((d) => patchProfile(d, { name: e.target.value }))} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Me levanto a las</span>
          <input type="time" value={p.wakeTime} onChange={(e) => update((d) => patchProfile(d, { wakeTime: e.target.value }))} />
        </label>
        <label className="field">
          <span>Me acuesto a las</span>
          <input type="time" value={p.sleepTime} onChange={(e) => update((d) => patchProfile(d, { sleepTime: e.target.value }))} />
        </label>
      </div>
      <label className="field">
        <span>Hora de cierre del dia</span>
        <input type="time" value={p.dayCutoff} onChange={(e) => update((d) => patchProfile(d, { dayCutoff: e.target.value }))} />
      </label>
      <p className="tiny faint" style={{ marginTop: -6 }}>
        Antes de esa hora sigues en el dia anterior. Trasnochar no te regala un dia nuevo.
      </p>

      <div className="section-label">Estudio</div>
      <div className="field-row">
        <label className="field">
          <span>Min/dia con clase</span>
          <input
            type="number"
            value={p.studyMinutesClassDay}
            onChange={(e) => update((d) => patchProfile(d, { studyMinutesClassDay: Number(e.target.value) }))}
          />
        </label>
        <label className="field">
          <span>Min/dia libre</span>
          <input
            type="number"
            value={p.studyMinutesFreeDay}
            onChange={(e) => update((d) => patchProfile(d, { studyMinutesFreeDay: Number(e.target.value) }))}
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Bloque (min)</span>
          <input
            type="number"
            value={p.pomodoroMinutes}
            onChange={(e) => update((d) => patchProfile(d, { pomodoroMinutes: Number(e.target.value) }))}
          />
        </label>
        <label className="field">
          <span>Descanso (min)</span>
          <input
            type="number"
            value={p.breakMinutes}
            onChange={(e) => update((d) => patchProfile(d, { breakMinutes: Number(e.target.value) }))}
          />
        </label>
      </div>

      <div className="section-label">App</div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div style={{ flex: 1 }} className="small">
          Tema oscuro
        </div>
        <Switch
          label="Tema oscuro"
          checked={p.theme === 'dark'}
          onChange={(v) => update((d) => patchProfile(d, { theme: v ? 'dark' : 'light' }))}
        />
      </div>
      <button
        className="btn block small"
        onClick={async () => {
          const ok = await requestPermission();
          toast(ok ? 'Avisos activados.' : 'El navegador ha denegado los avisos.');
        }}
      >
        Activar recordatorios
      </button>
      <p className="tiny faint" style={{ marginTop: 8 }}>
        Los avisos llegan mientras la app este abierta o instalada. Para que no falle ninguno,
        instalala en el movil (Compartir → Añadir a pantalla de inicio).
      </p>
    </div>
  );
}

/* -------------------------- Sincronizacion ------------------------- */

function SyncTab() {
  const { config, setConfig, sync, syncError, lastSync, syncNow } = useStore();
  const toast = useToast();
  const [url, setUrl] = useState(config?.serverUrl ?? defaultServerUrl());
  const [email, setEmail] = useState(config?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (mode: 'login' | 'register') => {
    setBusy(true);
    try {
      const fn = mode === 'login' ? login : register;
      const res = await fn(url, email, password);
      setConfig({ serverUrl: url, token: res.token, email: res.email });
      setPassword('');
      toast('Conectado. Tus datos ya viajan entre dispositivos.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se ha podido conectar');
    } finally {
      setBusy(false);
    }
  };

  if (config) {
    return (
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <span className={`sync-dot ${sync}`} />
          <div style={{ flex: 1 }}>
            <div className="bold small">{config.email}</div>
            <div className="tiny faint">
              {config.serverUrl} ·{' '}
              {sync === 'error'
                ? syncError
                : lastSync
                  ? `ultima sync ${new Date(lastSync).toLocaleTimeString()}`
                  : 'sin sincronizar aun'}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => void syncNow()}>
            Sincronizar ahora
          </button>
          <button className="btn danger" onClick={() => setConfig(null)}>
            Desconectar
          </button>
        </div>
        <p className="tiny faint" style={{ marginTop: 10 }}>
          Funciona sin conexion: se guarda todo en el dispositivo y se sube cuando vuelve la red. Si
          marcas algo en el movil y otra cosa en el PC, se quedan las dos.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="muted small">
        Levanta el servidor en tu PC (<code>npm start</code>) y usa la direccion de red que imprime.
        Tus datos no salen de tus maquinas.
      </p>
      <label className="field">
        <span>Servidor</span>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.1.40:4321" />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      </label>
      <label className="field">
        <span>Contrasena</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" style={{ flex: 1 }} disabled={busy || !email || !password} onClick={() => run('login')}>
          Entrar
        </button>
        <button className="btn" style={{ flex: 1 }} disabled={busy || !email || password.length < 6} onClick={() => run('register')}>
          Crear cuenta
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Datos ----------------------------- */

function DataTab() {
  const { doc, replace, reset } = useStore();
  const { confirm, node } = useConfirm();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows = [['fecha', 'habito', 'valor', 'estado', 'nota']];
    for (const e of Object.values(doc.entries)) {
      if (e.deleted) continue;
      const h = doc.habits[e.habitId];
      rows.push([e.date, h?.name ?? e.habitId, String(e.value), e.status, (e.note ?? '').replace(/"/g, "'")]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = {
    habitos: list(doc.habits).length,
    registros: list(doc.entries).length,
    dias: list(doc.days).length,
    asignaturas: list(doc.subjects).length,
    sesiones: list(doc.sessions).length,
  };

  return (
    <>
      {node}
      <div className="card">
        <div className="grid grid-3" style={{ marginBottom: 12 }}>
          {Object.entries(counts).map(([k, v]) => (
            <div className="stat" key={k}>
              <div className="k">{k}</div>
              <div className="v">{v}</div>
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn small" onClick={exportJson}>
            Exportar JSON
          </button>
          <button className="btn small" onClick={exportCsv}>
            Exportar CSV
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            Importar JSON
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const parsed = JSON.parse(await file.text());
              replace(ensureDoc(parsed));
              toast('Datos importados.');
            } catch {
              toast('El fichero no es valido.');
            }
            e.target.value = '';
          }}
        />
        <p className="tiny faint" style={{ marginTop: 10 }}>
          Tus datos son tuyos: se guardan en el dispositivo y, si activas la sincronizacion, en tu
          propio servidor. Nada va a terceros.
        </p>
      </div>

      <div className="card">
        <div className="bold small" style={{ marginBottom: 6 }}>
          Zona peligrosa
        </div>
        <button
          className="btn danger block small"
          onClick={async () => {
            const ok = await confirm(
              'Borrar todo',
              'Se borra el historial completo de este dispositivo. Exporta antes si quieres conservarlo.',
              'Borrar todo',
            );
            if (!ok) return;
            await reset();
            location.reload();
          }}
        >
          Borrar todos los datos locales
        </button>
      </div>
    </>
  );
}
