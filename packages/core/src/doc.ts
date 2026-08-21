import { COLLECTIONS } from './types.js';
import type { CollectionName, Doc, ID, Profile, Record_ } from './types.js';

export const SCHEMA_VERSION = 1;

export function defaultProfile(now = Date.now()): Profile {
  return {
    id: 'profile',
    updatedAt: now,
    name: '',
    dayCutoff: '04:00',
    wakeTime: '07:00',
    sleepTime: '23:30',
    freezeTokens: 2,
    freezeTokensUsedThisMonth: 0,
    freezeMonth: new Date(now).toISOString().slice(0, 7),
    xp: 0,
    strictMode: true,
    studyMinutesClassDay: 90,
    studyMinutesFreeDay: 180,
    pomodoroMinutes: 50,
    breakMinutes: 10,
    onboarded: false,
    theme: 'dark',
    createdAt: now,
  };
}

export function emptyDoc(now = Date.now()): Doc {
  const doc = {
    schema: SCHEMA_VERSION,
    profile: defaultProfile(now),
  } as Doc;
  for (const c of COLLECTIONS) (doc as unknown as Record<string, unknown>)[c] = {};
  return doc;
}

export function cloneDoc(doc: Doc): Doc {
  return JSON.parse(JSON.stringify(doc)) as Doc;
}

/** Normaliza documentos venidos de disco/red: rellena colecciones que falten. */
export function ensureDoc(input: unknown): Doc {
  const base = emptyDoc();
  if (!input || typeof input !== 'object') return base;
  const raw = input as Partial<Doc> & Record<string, unknown>;
  const doc: Doc = { ...base, schema: SCHEMA_VERSION };
  doc.profile = { ...base.profile, ...(raw.profile ?? {}) } as Profile;
  for (const c of COLLECTIONS) {
    const value = raw[c];
    (doc as unknown as Record<string, unknown>)[c] =
      value && typeof value === 'object' ? { ...(value as object) } : {};
  }
  return doc;
}

export function list<T extends Record_>(collection: Record<ID, T>): T[] {
  return Object.values(collection).filter((r) => !r.deleted);
}

export function put<C extends CollectionName>(
  doc: Doc,
  collection: C,
  record: Doc[C][string],
): Doc {
  const rec = record as unknown as Record_;
  return {
    ...doc,
    [collection]: {
      ...doc[collection],
      [rec.id]: { ...rec, updatedAt: Date.now() },
    },
  } as Doc;
}

export function putMany<C extends CollectionName>(
  doc: Doc,
  collection: C,
  records: Array<Doc[C][string]>,
): Doc {
  const now = Date.now();
  const next = { ...doc[collection] } as Record<string, Record_>;
  for (const r of records) {
    const rec = r as unknown as Record_;
    next[rec.id] = { ...rec, updatedAt: now };
  }
  return { ...doc, [collection]: next } as Doc;
}

/** Borrado logico: deja lapida para que la sincronizacion no lo resucite. */
export function softDelete<C extends CollectionName>(doc: Doc, collection: C, id: ID): Doc {
  const existing = (doc[collection] as Record<string, Record_>)[id];
  if (!existing) return doc;
  return {
    ...doc,
    [collection]: {
      ...doc[collection],
      [id]: { ...existing, deleted: true, updatedAt: Date.now() },
    },
  } as Doc;
}

export function patchProfile(doc: Doc, patch: Partial<Profile>): Doc {
  return { ...doc, profile: { ...doc.profile, ...patch, updatedAt: Date.now() } };
}
