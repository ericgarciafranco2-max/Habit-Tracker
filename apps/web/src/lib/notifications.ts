import { clockToMinutes, counts, getEntry, habitsForDate, type Doc, type ISODate } from '@habit/core';

/**
 * Recordatorios locales.
 *
 * Aviso honesto: un navegador no despierta a una web cerrada para lanzarte una
 * notificacion sin un servidor de push. Lo que si funciona, y es lo que hace
 * esto: mientras la app este abierta o instalada en segundo plano, avisa a las
 * horas que configures y ademas avisa cuando queda poco para el cierre del dia
 * y aun tienes innegociables sin marcar.
 *
 * Para avisos garantizados en el movil: instala la app (Añadir a pantalla de
 * inicio) y deja una alarma del sistema a la hora de tu ritual. La app se
 * encarga del resto.
 */
export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

export function notify(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: title });
  } catch {
    /* algunos navegadores exigen el service worker: no es critico */
  }
}

const fired = new Set<string>();

/** Se llama cada minuto: comprueba recordatorios y avisos de cierre. */
export function checkReminders(doc: Doc, today: ISODate, now = new Date()): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const habit of habitsForDate(doc, today)) {
    const entry = getEntry(doc, habit.id, today);
    if (counts(entry)) continue;
    for (const r of habit.reminders) {
      const key = `${today}:${habit.id}:${r}`;
      if (fired.has(key)) continue;
      if (Math.abs(clockToMinutes(r) - minutes) <= 1) {
        fired.add(key);
        notify(`${habit.emoji} ${habit.name}`, habit.notes || 'Toca ahora. No lo dejes para luego.');
      }
    }
  }

  // Ultimo aviso antes de que el dia se liquide solo.
  const cutoff = clockToMinutes(doc.profile.sleepTime) - 60;
  const key = `${today}:cierre`;
  if (!fired.has(key) && Math.abs(cutoff - minutes) <= 1) {
    const pending = habitsForDate(doc, today).filter(
      (h) => h.nonNegotiable && !counts(getEntry(doc, h.id, today)),
    );
    if (pending.length) {
      fired.add(key);
      notify(
        'Queda una hora',
        `Te faltan ${pending.length} innegociable(s): ${pending.map((h) => h.name).join(', ')}`,
      );
    }
  }
}
