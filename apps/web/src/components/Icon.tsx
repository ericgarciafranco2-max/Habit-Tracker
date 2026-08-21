/**
 * Iconos de trazo, dibujados a mano en SVG.
 *
 * Una libreria de iconos serian cientos de kilobytes para usar quince. Estos
 * comparten grosor, tamaño de rejilla y remates redondeados, que es lo que
 * hace que un set de iconos parezca un set y no un collage.
 */
export type IconName =
  | 'today'
  | 'calendar'
  | 'chart'
  | 'school'
  | 'target'
  | 'scale'
  | 'idea'
  | 'gear'
  | 'more'
  | 'chevron'
  | 'close'
  | 'plus'
  | 'share'
  | 'flame'
  | 'snow'
  | 'lock'
  | 'unlock'
  | 'clock'
  | 'quote'
  | 'check'
  | 'back'
  | 'forward'
  | 'sun'
  | 'moon';

const PATHS: Record<IconName, string> = {
  today: 'M4 12.5l5 5L20 6.5',
  calendar: 'M4 8h16M7 3v3M17 3v3M5 6h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  school: 'M2 8.5L12 4l10 4.5-10 4.5L2 8.5zM6 11v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V11',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  scale: 'M12 3v18M7 21h10M3 8l4-3 4 3M3 8c0 2 1.8 3.5 4 3.5S11 10 11 8M13 8l4-3 4 3M13 8c0 2 1.8 3.5 4 3.5S21 10 21 8M7 5h10',
  idea: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5.9 1.1.9 1.8v.3h5.2v-.3c0-.7.3-1.3.9-1.8A6 6 0 0012 3z',
  gear: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2.9a2 2 0 110-4H3a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V2.9a2 2 0 114 0V3a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.2a2 2 0 110 4H21a1.7 1.7 0 00-1.5 1z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  share: 'M12 16V4M8 8l4-4 4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4',
  flame: 'M12 22c3.9 0 6.5-2.4 6.5-6 0-4.5-4.5-6.2-4-11-2.6 1.3-4 4-4 6.2 0 1.3-.8 1.9-1.6 1.2-.7-.6-1-1.6-1-2.6C6.4 11.6 5.5 13.6 5.5 16c0 3.6 2.6 6 6.5 6z',
  snow: 'M12 2v20M4 7l16 10M20 7L4 17M9 4l3 2 3-2M9 20l3-2 3 2',
  lock: 'M7 11V8a5 5 0 0110 0v3M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z',
  unlock: 'M7 11V8a5 5 0 019.5-2M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2',
  quote: 'M9 7c-2.5 0-4 1.8-4 4s1.6 3.5 3.5 3.5c.4 0 .8 0 1.1-.2-.5 1.6-1.8 2.8-3.6 3.2M19 7c-2.5 0-4 1.8-4 4s1.6 3.5 3.5 3.5c.4 0 .8 0 1.1-.2-.5 1.6-1.8 2.8-3.6 3.2',
  check: 'M5 13l4 4L19 7',
  back: 'M15 6l-6 6 6 6',
  forward: 'M9 6l6 6-6 6',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
};

export function Icon({
  name,
  size = 20,
  stroke = 1.7,
  className,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
