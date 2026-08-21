import { useEffect, useState } from 'react';
import type { Habit } from '@habit/core';
import { StoreProvider, useStore } from './store/store.js';
import { ToastProvider } from './components/ui.js';
import { Icon, type IconName } from './components/Icon.js';
import { Today } from './screens/Today.js';
import { Month } from './screens/Month.js';
import { Dashboard } from './screens/Dashboard.js';
import { Uni } from './screens/Uni.js';
import { Goals } from './screens/Goals.js';
import { Pressure } from './screens/Pressure.js';
import { Methods } from './screens/Methods.js';
import { More } from './screens/More.js';
import { Settings } from './screens/Settings.js';
import { Onboarding } from './screens/Onboarding.js';
import { checkReminders } from './lib/notifications.js';

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  /** Solo en la barra lateral de escritorio. */
  desktopOnly?: boolean;
}

const NAV: NavItem[] = [
  { id: 'hoy', label: 'Hoy', icon: 'today' },
  { id: 'mes', label: 'Mes', icon: 'calendar' },
  { id: 'panel', label: 'Panel', icon: 'chart' },
  { id: 'uni', label: 'Uni', icon: 'school' },
  { id: 'objetivos', label: 'Objetivos', icon: 'target', desktopOnly: true },
  { id: 'presion', label: 'Presion', icon: 'scale', desktopOnly: true },
  { id: 'metodos', label: 'Metodos', icon: 'idea', desktopOnly: true },
  { id: 'ajustes', label: 'Ajustes', icon: 'gear', desktopOnly: true },
];

function Shell() {
  const { doc, ready, today, sync } = useStore();
  const [view, setView] = useState<string>(() => location.hash.slice(1) || 'hoy');
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = doc.profile.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', doc.profile.theme === 'dark' ? '#000000' : '#f5f5f7');
  }, [doc.profile.theme]);

  // Navegacion por hash: el boton "atras" del movil funciona.
  useEffect(() => {
    const onHash = () => setView(location.hash.slice(1) || 'hoy');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (location.hash.slice(1) !== view) location.hash = view;
    window.scrollTo({ top: 0 });
  }, [view]);

  // La barra superior solo muestra su linea cuando ya has bajado.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const tick = () => checkReminders(doc, today);
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [doc, today, ready]);

  const go = (v: string) => setView(v);

  if (!ready) {
    return (
      <div className="app-main center" style={{ paddingTop: 90 }}>
        <div className="muted">Cargando…</div>
      </div>
    );
  }

  if (!doc.profile.onboarded) return <Onboarding />;

  return (
    <div className="app">
      <nav className="nav" aria-label="Secciones">
        <div className="nav-brand">
          <Icon name="today" size={20} /> Habitos
        </div>
        {NAV.map((v) => (
          <button
            key={v.id}
            className={v.desktopOnly ? 'only-desktop' : undefined}
            aria-current={view === v.id}
            onClick={() => setView(v.id)}
          >
            <Icon name={v.icon} size={22} stroke={view === v.id ? 2 : 1.7} />
            <span>{v.label}</span>
          </button>
        ))}
        <button
          className="only-mobile"
          aria-current={['objetivos', 'presion', 'metodos', 'ajustes', 'mas'].includes(view)}
          onClick={() => setView('mas')}
        >
          <Icon name="more" size={22} />
          <span>Mas</span>
        </button>
      </nav>

      <div className="app-body">
        <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
          <span className="brand">
            {NAV.find((n) => n.id === view)?.label ?? (view === 'mas' ? 'Mas' : 'Habitos')}
          </span>
          <div className="spacer" />
          <span className={`sync-dot ${sync}`} title={`Sincronizacion: ${sync}`} />
          <span className="tiny faint">{doc.profile.name}</span>
        </header>

        <main className="app-main">
          {view === 'hoy' && (
            <Today
              onEditHabit={(h) => {
                setEditingHabit(h);
                setView('ajustes');
              }}
              go={go}
            />
          )}
          {view === 'mes' && <Month />}
          {view === 'panel' && <Dashboard />}
          {view === 'uni' && <Uni />}
          {view === 'objetivos' && <Goals />}
          {view === 'presion' && <Pressure />}
          {view === 'metodos' && <Methods />}
          {view === 'mas' && <More go={go} />}
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
