import type { Doc } from '@habit/core';

/**
 * Dos formas de sincronizar:
 *
 *  - `propio`: el servidor de Node de este repositorio, corriendo en tu PC.
 *  - `google`: una hoja de calculo con Apps Script publicado como aplicacion
 *    web. No hay nada encendido, es gratis, da HTTPS (que es lo que necesita
 *    el movil para instalarse como app de verdad) y los datos aterrizan en una
 *    hoja que puedes abrir.
 */
export type BackendKind = 'propio' | 'google';

export interface SyncConfig {
  kind: BackendKind;
  serverUrl: string;
  /** Sesion en el servidor propio, o clave de la hoja en el caso de Google. */
  token: string;
  email: string;
}

const CONFIG_KEY = 'habit-sync-config';

export function loadConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as Partial<SyncConfig>;
    if (!cfg.serverUrl || !cfg.token) return null;
    // Las configuraciones guardadas antes de existir Google no llevan `kind`.
    return { kind: cfg.kind ?? 'propio', serverUrl: cfg.serverUrl, token: cfg.token, email: cfg.email ?? '' };
  } catch {
    return null;
  }
}

export function saveConfig(cfg: SyncConfig | null): void {
  if (!cfg) localStorage.removeItem(CONFIG_KEY);
  else localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

/** Si sirves la web desde el propio servidor, el origen ya es el correcto. */
export function defaultServerUrl(): string {
  if (typeof location === 'undefined') return '';
  if (location.protocol === 'file:') return 'http://localhost:4321';
  if (location.port === '5173') return `${location.protocol}//${location.hostname}:4321`;
  // En GitHub Pages no hay API detras: ahi lo normal es usar Google.
  if (location.hostname.endsWith('github.io')) return '';
  return location.origin;
}

function normalize(url: string): string {
  return url.replace(/\/+$/, '');
}

/* ------------------------------- Servidor propio ------------------------------- */

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Error ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function register(serverUrl: string, email: string, password: string) {
  return request<{ token: string; email: string }>(`${normalize(serverUrl)}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function login(serverUrl: string, email: string, password: string) {
  return request<{ token: string; email: string }>(`${normalize(serverUrl)}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function health(serverUrl: string) {
  return request<{ ok: boolean }>(`${normalize(serverUrl)}/api/health`, { method: 'GET' });
}

/* ---------------------------------- Google ---------------------------------- */

/**
 * El cuerpo va como texto plano a proposito. Con `application/json` el
 * navegador manda antes una peticion de comprobacion (preflight) que Apps
 * Script no responde, y la sincronizacion se cae por CORS. Con texto plano no
 * hay preflight y la peticion pasa directa.
 */
async function callGoogle<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(normalize(url), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
  } catch {
    // Un fallo de red aqui llega como "Failed to fetch", que no le dice nada a
    // nadie. Casi siempre es la URL mal pegada o falta de conexion.
    throw new Error('No se ha podido contactar con la hoja. Revisa la URL (debe acabar en /exec) y tu conexion.');
  }
  const text = await res.text();
  let data: { error?: string } & Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      'La hoja no ha contestado en JSON. Revisa que publicaste la aplicacion web con acceso "Cualquier usuario".',
    );
  }
  if (data.error) throw new Error(data.error);
  return data as T;
}

export async function pingGoogle(url: string, clave: string) {
  return callGoogle<{ ok: boolean; hoja?: string }>(url, { accion: 'ping', clave });
}

/** Regenera las pestañas legibles de la hoja bajo demanda. */
export async function exportGoogle(cfg: SyncConfig) {
  return callGoogle<{ ok: boolean }>(cfg.serverUrl, { accion: 'exportar', clave: cfg.token });
}

/* --------------------------------- Comun ------------------------------------ */

/** Envia el documento, recibe el mezclado y el cliente lo adopta. */
export async function pushSync(cfg: SyncConfig, doc: Doc): Promise<Doc> {
  if (cfg.kind === 'google') {
    const res = await callGoogle<{ doc: Doc }>(cfg.serverUrl, {
      accion: 'sync',
      clave: cfg.token,
      doc,
    });
    return res.doc;
  }
  const res = await request<{ doc: Doc }>(`${normalize(cfg.serverUrl)}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({ doc }),
  });
  return res.doc;
}
