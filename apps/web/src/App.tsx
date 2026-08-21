import { useEffect, useState } from 'react';
import type { Habit } from '@habit/core';
import { StoreProvider, useStore } from './store/store.js';
import { ToastProvider } from './components/ui.js';
import { Today } from './screens/Today.js';
import { Month } from './screens/Month.js';
import { Dashboard } from './screens/Dashboard.js';
import { Uni } from './screens/Uni.js';
import { Goals } from './screens/Goals.js';
import { Pressure } from './screens/Pressure.js';
import { Settings } from './screens/Settings.js';
import { Onboarding } from './screens/Onboarding.js';
import { checkReminders } from './lib/notifications.js';

const VIEWS = [
  { id: 'hoy', label: 'Hoy', icon: '✓' },
  { id: 'mes', label: 'Mes', icon: '▦' },
  { id: 'panel', label: 'Panel', icon: '◔' },
  { id: 'uni', label: 'Uni', icon: '🎓' },
  { id: 'objetivos', label: 'Metas', icon: '◎' },
  { id: 'presion', label: 'Presion', icon: '⚖' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

function Shell() {
  const { doc, ready, today, sync } = useStore();
  const [view, setView] = useState<ViewId>(() => (location.hash.slice(1) as ViewId) || 'hoy');
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Tema aplicado al documento para que el CSS lo recoja.
  useEffect(() => {
    document.documentElement.dataset.theme = doc.profile.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', doc.profile.theme === 'light' ? '#f2efe6' : '#0f2925');
  }, [doc.profile.theme]);

  // Navegacion por hash: el boton "atras" del movil funciona.
  useEffect(() => {
    const onHash = () => setView(((location.hash.slice(1) as ViewId) || 'hoy'));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (location.hash.slice(1) !== view) location.hash = view;
  }, [view]);

  // Recordatorios: se revisan cada minuto mientras la app este viva.
  useEffect(() => {
    if (!ready) return;
    const tick = () => checkReminders(doc, today);
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [doc, today, ready]);

  const go = (v: string) => setView(v as ViewId);

  if (!ready) {
    return (
      <div className="app-main center" style={{ paddingTop: 80 }}>
        <div className="muted">Cargando...</div>
      </div>
    );
  }

  if (!doc.profile.onboarded) return <Onboarding />;

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <span>👑</span> Habitos
        </div>
        {VIEWS.map((v) => (
          <button key={v.id} aria-current={view === v.id} onClick={() => setView(v.id)}>
            <span className="ico">{v.icon}</span>
            <span>{v.label}</span>
          </button>
        ))}
      </nav>

      <div className="app-body">
        <header className="topbar">
          <div className="brand">
            <span>👑</span> Habit Tracker
          </div>
          <div className="spacer" />
          <span className={`sync-dot ${sync}`} title={`Sincronizacion: ${sync}`} />
          <span className="tiny faint">{doc.profile.name}</span>
        </header>

        <main className="app-main">
          {view === 'hoy' && <Today onEditHabit={(h) => { setEditingHabit(h); setView('ajustes'); }} go={go} />}
          {view === 'mes' && <Month />}
          {view === 'panel' && <Dashboard />}
          {view === 'uni' && <Uni />}
          {view === 'objetivos' && <Goals />}
          {view === 'presion' && <Pressure />}
          {view === 'ajustes' && <Settings editing={editingHabit} setEditing={setEditingHabit} />}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}
