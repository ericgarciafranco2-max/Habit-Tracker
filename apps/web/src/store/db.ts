import type { Doc } from '@habit/core';

const DB_NAME = 'habit-tracker';
const STORE = 'state';
const KEY = 'doc';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persistencia local. IndexedDB como principal y localStorage como red de
 * seguridad: si el navegador falla (modo privado, cuota), la app sigue viva.
 */
export async function loadLocal(): Promise<Doc | null> {
  try {
    const db = await openDb();
    const doc = await new Promise<Doc | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Doc) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (doc) return doc;
  } catch {
    /* seguimos con localStorage */
  }
  try {
    const raw = localStorage.getItem('habit-doc');
    return raw ? (JSON.parse(raw) as Doc) : null;
  } catch {
    return null;
  }
}

export async function saveLocal(doc: Doc): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(doc, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* abajo intentamos localStorage */
  }
  try {
    localStorage.setItem('habit-doc', JSON.stringify(doc));
  } catch {
    /* cuota llena: al menos IndexedDB lo tiene */
  }
}

export async function clearLocal(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* nada que limpiar */
  }
  localStorage.removeItem('habit-doc');
}
