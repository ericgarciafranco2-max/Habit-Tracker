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
  if (v === 'perfecto') return 'var(--accent)';
  if (v === 'aprobado') return 'var(--warn)';
  if (v === 'suspenso') return 'var(--danger)';
  return 'var(--text-faint)';
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
