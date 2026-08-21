export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function hm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  if (!h) return `${m}m`;
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function verdictColor(v: string): string {
  if (v === 'perfecto') return 'var(--good)';
  if (v === 'aprobado') return 'var(--warning)';
  if (v === 'suspenso') return 'var(--critical)';
  return 'var(--text-3)';
}

/** El veredicto, escrito como lo leeria una persona. */
export function verdictLabel(v: string): string {
  return (
    {
      perfecto: 'Dia perfecto',
      aprobado: 'Dia aprobado',
      suspenso: 'Dia suspenso',
      pendiente: 'En curso',
    }[v] ?? v
  );
}

export function scheduleLabel(schedule: { type: string; days?: number[]; timesPerWeek?: number }): string {
  const names = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
  switch (schedule.type) {
    case 'daily':
      return 'Todos los dias';
    case 'weekdays':
      return 'Lunes a viernes';
    case 'weekend':
      return 'Fin de semana';
    case 'classDays':
      return 'Dias con clase';
    case 'freeDays':
      return 'Dias sin clase';
    case 'timesPerWeek':
      return `${schedule.timesPerWeek}x por semana`;
    case 'custom':
      return (schedule.days ?? []).map((d) => names[d]).join(' ');
    default:
      return '';
  }
}

/** Primera letra en mayuscula, el resto tal cual (los meses van en minuscula). */
export function sentenceCase(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}
