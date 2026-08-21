import { COLLECTIONS } from './types.js';
import { ensureDoc } from './doc.js';
import type { Doc, Record_ } from './types.js';

/**
 * Mezcla dos documentos registro a registro: gana el `updatedAt` mas alto.
 *
 * Es un CRDT de tipo last-write-wins por registro. Basta porque un mismo
 * usuario rara vez edita el mismo registro en dos dispositivos a la vez, y
 * las claves de `entries` son deterministas (`habitId:fecha`), asi que marcar
 * un habito en el movil y en el PC produce el mismo registro, no duplicados.
 *
 * Los empates se resuelven de forma determinista (comparando el JSON) para
 * que ambos dispositivos converjan al mismo resultado sin hablar entre si.
 */
export function mergeDocs(a: unknown, b: unknown): Doc {
  const left = ensureDoc(a);
  const right = ensureDoc(b);
  const out = ensureDoc({ schema: Math.max(left.schema, right.schema) });

  out.profile = pick(left.profile, right.profile);

  for (const c of COLLECTIONS) {
    const target: Record<string, Record_> = {};
    const l = left[c] as Record<string, Record_>;
    const r = right[c] as Record<string, Record_>;
    for (const key of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const lv = l[key];
      const rv = r[key];
      if (lv && rv) target[key] = pick(lv, rv);
      else target[key] = (lv ?? rv) as Record_;
    }
    (out as unknown as Record<string, unknown>)[c] = target;
  }
  return out;
}

function pick<T extends Record_>(a: T, b: T): T {
  const at = a.updatedAt ?? 0;
  const bt = b.updatedAt ?? 0;
  if (at > bt) return a;
  if (bt > at) return b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/** Elimina lapidas antiguas para que el documento no crezca sin fin. */
export function compact(doc: Doc, olderThanMs = 1000 * 60 * 60 * 24 * 90): Doc {
  const cutoff = Date.now() - olderThanMs;
  const out = { ...doc };
  for (const c of COLLECTIONS) {
    const src = doc[c] as Record<string, Record_>;
    const target: Record<string, Record_> = {};
    for (const [k, v] of Object.entries(src)) {
      if (v.deleted && v.updatedAt < cutoff) continue;
      target[k] = v;
    }
    (out as unknown as Record<string, unknown>)[c] = target;
  }
  return out;
}
