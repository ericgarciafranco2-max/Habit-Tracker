import type { Doc } from '@habit/core';

export interface SyncConfig {
  serverUrl: string;
  token: string;
  email: string;
}

const CONFIG_KEY = 'habit-sync-config';

export function loadConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SyncConfig) : null;
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
  if (location.port === '5173') return `${location.protocol}//${location.hostname}:4321`;
  return location.origin;
}

function normalize(url: string): string {
  return url.replace(/\/+$/, '');
}

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

export async function pushSync(cfg: SyncConfig, doc: Doc): Promise<Doc> {
  const res = await request<{ doc: Doc }>(`${normalize(cfg.serverUrl)}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({ doc }),
  });
  return res.doc;
}

export async function health(serverUrl: string) {
  return request<{ ok: boolean }>(`${normalize(serverUrl)}/api/health`, { method: 'GET' });
}
