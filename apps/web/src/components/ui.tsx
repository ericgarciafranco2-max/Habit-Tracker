import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/* ------------------------------ Modal ------------------------------ */

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Toast ------------------------------ */

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* --------------------------- Indicadores --------------------------- */

export function Stat({
  k,
  v,
  s,
  color,
}: {
  k: string;
  v: ReactNode;
  s?: ReactNode;
  color?: string;
}) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v" style={color ? { color } : undefined}>
        {v}
      </div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <span
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: color ?? 'var(--accent)',
        }}
      />
    </div>
  );
}

export function Ring({
  value,
  size = 92,
  stroke = 9,
  label,
  sub,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.4s' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeContent: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: size / 4.2, fontWeight: 700, lineHeight: 1 }}>
          {label ?? `${Math.round(pct * 100)}%`}
        </div>
        {sub && <div className="tiny faint">{sub}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Graficas --------------------------- */
/* SVG a mano: pesa cero y encaja con el resto del diseno. */

export function Sparkline({
  values,
  height = 46,
  color = 'var(--accent)',
  fill = true,
}: {
  values: number[];
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  if (!values.length) return <div className="empty tiny">Sin datos</div>;
  const w = 100;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
    const y = height - ((v - min) / span) * (height - 6) - 3;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      {fill && (
        <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={color} opacity={0.14} />
      )}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function BarChart({
  values,
  labels,
  height = 90,
  color = 'var(--accent)',
}: {
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(...values, 0.0001);
  return (
    // El maxWidth evita que un mes con dos dias de datos pinte dos columnas
    // gigantes: las barras crecen hasta un ancho razonable y se centran.
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            maxWidth: 46,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            height: '100%',
          }}
        >
          <div
            title={labels?.[i]}
            style={{
              height: `${Math.max(2, (v / max) * 100)}%`,
              background: color,
              borderRadius: 3,
              opacity: v === 0 ? 0.18 : 1,
            }}
          />
          {labels && <div className="tiny faint center" style={{ marginTop: 3 }}>{labels[i]}</div>}
        </div>
      ))}
    </div>
  );
}

export function Heatmap({
  data,
  onSelect,
}: {
  data: Array<{ date: string; rate: number }>;
  onSelect?: (date: string) => void;
}) {
  const color = (r: number) => {
    if (r <= 0) return 'var(--surface-3)';
    if (r < 0.4) return 'color-mix(in srgb, var(--accent) 25%, var(--surface-3))';
    if (r < 0.7) return 'color-mix(in srgb, var(--accent) 50%, var(--surface-3))';
    if (r < 1) return 'color-mix(in srgb, var(--accent) 75%, var(--surface-3))';
    return 'var(--accent)';
  };
  return (
    <div className="grid-wrap">
      <div className="heat">
        {data.map((d) => (
          <i
            key={d.date}
            title={`${d.date} — ${Math.round(d.rate * 100)}%`}
            style={{ background: color(d.rate), cursor: onSelect ? 'pointer' : undefined }}
            onClick={() => onSelect?.(d.date)}
          />
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Confirmacion -------------------------- */

export function useConfirm() {
  const [state, setState] = useState<{
    title: string;
    body: string;
    confirmText: string;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (title: string, body: string, confirmText = 'Confirmar') =>
      new Promise<boolean>((resolve) => setState({ title, body, confirmText, resolve })),
    [],
  );

  const node = state ? (
    <Sheet
      title={state.title}
      onClose={() => {
        state.resolve(false);
        setState(null);
      }}
      footer={
        <div className="row">
          <button
            className="btn ghost"
            onClick={() => {
              state.resolve(false);
              setState(null);
            }}
          >
            Cancelar
          </button>
          <div className="spacer" />
          <button
            className="btn primary"
            onClick={() => {
              state.resolve(true);
              setState(null);
            }}
          >
            {state.confirmText}
          </button>
        </div>
      }
    >
      <p className="muted">{state.body}</p>
    </Sheet>
  ) : null;

  return useMemo(() => ({ confirm, node }), [confirm, node]);
}

/* ------------------------------ Varios ----------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs">
      {options.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div>{text}</div>
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
