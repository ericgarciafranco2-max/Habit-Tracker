import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createStarterDoc, list, logHabit, mergeDocs, softDelete, type Doc } from '../src/index.js';

/**
 * El servidor de Apps Script no puede importar este paquete, asi que lleva su
 * propia copia de la mezcla escrita en .gs. Si las dos se separan, los
 * dispositivos dejan de converger y la sincronizacion pierde datos en
 * silencio. Estas pruebas cargan el fichero real y comparan las dos.
 */
const codigo = readFileSync(new URL('../../../google/Codigo.gs', import.meta.url), 'utf8');
const { mezclar } = new Function(`${codigo}\n; return { mezclar };`)() as {
  mezclar: (a: unknown, b: unknown) => Doc;
};

/** El orden de las claves depende de en que orden se mezclo; el dato, no. */
function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const k of Object.keys(valor as object).sort()) {
      salida[k] = canonico((valor as Record<string, unknown>)[k]);
    }
    return salida;
  }
  return valor;
}
const huella = (v: unknown) => JSON.stringify(canonico(v));

const base = createStarterDoc('Test');
const habits = list(base.habits);
const gym = habits.find((h) => h.name === 'Entrenar')!;
const leer = habits.find((h) => h.name === 'Leer')!;
const agua = habits.find((h) => h.name === 'Agua')!;

const casos: Array<[string, Doc, Doc]> = [
  [
    'ediciones distintas en cada dispositivo',
    logHabit(base, leer.id, '2026-08-21', 20, { now: 1000 }),
    logHabit(base, gym.id, '2026-08-21', 1, { now: 2000 }),
  ],
  [
    'conflicto sobre el mismo registro',
    logHabit(base, leer.id, '2026-08-21', 5, { now: 5000 }),
    logHabit(base, leer.id, '2026-08-21', 40, { now: 9000 }),
  ],
  [
    'empate exacto de reloj',
    logHabit(base, agua.id, '2026-08-21', 3, { now: 7000 }),
    logHabit(base, agua.id, '2026-08-21', 8, { now: 7000 }),
  ],
  ['borrado contra edicion', softDelete(base, 'habits', gym.id), logHabit(base, gym.id, '2026-08-21', 1, { now: 3000 })],
  ['documento intacto contra editado', base, logHabit(base, leer.id, '2026-08-20', 12, { now: 4000 })],
];

describe('mezcla de Apps Script', () => {
  it.each(casos)('%s: coincide con el core', (_nombre, a, b) => {
    expect(huella(mezclar(a, b))).toBe(huella(mergeDocs(a, b)));
  });

  it.each(casos)('%s: converge en los dos sentidos', (_nombre, a, b) => {
    expect(huella(mezclar(a, b))).toBe(huella(mezclar(b, a)));
  });

  it('mezclar dos veces no cambia nada', () => {
    const una = mezclar(casos[1]![1], casos[1]![2]);
    expect(huella(mezclar(una, una))).toBe(huella(una));
  });

  it('un documento incompleto sale con todas las colecciones', () => {
    const salida = mezclar({ habits: {} }, {});
    for (const c of ['habits', 'entries', 'days', 'sessions', 'ledger']) {
      expect(salida[c as keyof Doc]).toBeTypeOf('object');
    }
  });
});
