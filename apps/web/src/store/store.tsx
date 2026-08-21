import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  currentLogicalDate,
  emptyDoc,
  ensureDoc,
  mergeDocs,
  settlePending,
  type Doc,
  type ISODate,
} from '@habit/core';
import { loadLocal, saveLocal, clearLocal } from './db.js';
import { loadConfig, pushSync, saveConfig, type SyncConfig } from './api.js';

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline';

interface StoreValue {
  doc: Doc;
  ready: boolean;
  today: ISODate;
  update: (fn: (doc: Doc) => Doc) => void;
  replace: (doc: Doc) => void;
  reset: () => Promise<void>;
  sync: SyncState;
  syncError: string | null;
  lastSync: number | null;
  config: SyncConfig | null;
  setConfig: (cfg: SyncConfig | null) => void;
  syncNow: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<Doc>(() => emptyDoc());
  const [ready, setReady] = useState(false);
  const [config, setConfigState] = useState<SyncConfig | null>(() => loadConfig());
  const [sync, setSync] = useState<SyncState>(() => (loadConfig() ? 'idle' : 'off'));
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [today, setToday] = useState<ISODate>(() => currentLogicalDate(emptyDoc()));

  const docRef = useRef(doc);
  docRef.current = doc;
  const saveTimer = useRef<number | null>(null);
  const pushTimer = useRef<number | null>(null);

  // Carga inicial: leemos lo guardado y liquidamos los dias pendientes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadLocal();
      if (cancelled) return;
      const base = stored ? ensureDoc(stored) : emptyDoc();
      const date = currentLogicalDate(base);
      const settled = base.profile.onboarded ? settlePending(base, date) : base;
      setDoc(settled);
      setToday(date);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Guardado local con retardo corto: escribir en cada pulsacion es tirar bateria.
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveLocal(docRef.current), 250);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [doc, ready]);

  const doSync = useCallback(
    async (cfg: SyncConfig | null) => {
      if (!cfg) return;
      if (!navigator.onLine) {
        setSync('offline');
        return;
      }
      setSync('syncing');
      try {
        const merged = await pushSync(cfg, docRef.current);
        // Volvemos a mezclar en local por si hubo cambios mientras viajaba.
        const next = mergeDocs(docRef.current, merged);
        setDoc(next);
        await saveLocal(next);
        setSync('idle');
        setSyncError(null);
        setLastSync(Date.now());
      } catch (err) {
        setSync('error');
        setSyncError(err instanceof Error ? err.message : 'Fallo de sincronizacion');
      }
    },
    [],
  );

  // Empuje automatico tras cada cambio (con margen para agrupar).
  useEffect(() => {
    if (!ready || !config) return;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void doSync(config), 2500);
    return () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    };
  }, [doc, config, ready, doSync]);

  // Al volver a la app o recuperar red, sincronizamos y recalculamos el dia.
  useEffect(() => {
    const onFocus = () => {
      const date = currentLogicalDate(docRef.current);
      setToday(date);
      setDoc((d) => (d.profile.onboarded ? settlePending(d, date) : d));
      if (config) void doSync(config);
    };
    const onOnline = () => config && void doSync(config);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onOnline);
    const interval = window.setInterval(onFocus, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, [config, doSync]);

  const update = useCallback((fn: (d: Doc) => Doc) => {
    setDoc((prev) => fn(prev));
  }, []);

  const replace = useCallback((next: Doc) => {
    setDoc(ensureDoc(next));
  }, []);

  const reset = useCallback(async () => {
    await clearLocal();
    setDoc(emptyDoc());
  }, []);

  const setConfig = useCallback(
    (cfg: SyncConfig | null) => {
      saveConfig(cfg);
      setConfigState(cfg);
      setSync(cfg ? 'idle' : 'off');
      setSyncError(null);
      if (cfg) void doSync(cfg);
    },
    [doSync],
  );

  const value = useMemo<StoreValue>(
    () => ({
      doc,
      ready,
      today,
      update,
      replace,
      reset,
      sync,
      syncError,
      lastSync,
      config,
      setConfig,
      syncNow: () => doSync(config),
    }),
    [doc, ready, today, update, replace, reset, sync, syncError, lastSync, config, setConfig, doSync],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore fuera de StoreProvider');
  return ctx;
}
