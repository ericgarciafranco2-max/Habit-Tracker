import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon.js';

/* ================================================================
   Modal / hoja inferior
   ================================================================ */

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
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 18 }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ================================================================
   Avisos
   ================================================================ */

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2800);
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

/* ================================================================
   Controles
   ================================================================ */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <input
      type="checkbox"
      className="switch"
      role="switch"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

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
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-pressed={o.value === value}
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ListRow({
  lead,
  leadColor,
  title,
  subtitle,
  value,
  onClick,
  trailing,
}: {
  lead?: ReactNode;
  leadColor?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const inner = (
    <>
      {lead !== undefined && (
        <span className="lead" style={{ background: leadColor ?? 'var(--accent)' }}>
          {lead}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="bold" style={{ display: 'block', fontSize: 15.5 }}>
          {title}
        </span>
        {subtitle && (
          <span className="tiny faint" style={{ display: 'block' }}>
            {subtitle}
          </span>
        )}
      </span>
      {value && <span className="muted small">{value}</span>}
      {trailing}
      {onClick && <Icon name="chevron" size={16} className="chevron" />}
    </>
  );
  return onClick ? (
    <button className="list-row tap" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="list-row">{inner}</div>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div>{text}</div>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function Stat({ k, v, s, color }: { k: string; v: ReactNode; s?: ReactNode; color?: string }) {
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

/* ================================================================
   Capa de interaccion: un solo globo reutilizado por todas las
   graficas, posicionado en coordenadas de ventana.
   ================================================================ */

function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const show = useCallback((e: { clientX: number; clientY: number }, text: string) => {
    setTip({ x: e.clientX, y: e.clientY, text });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const node = tip ? (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.text}
    </div>
  ) : null;
  return { show, hide, node };
}

/* ================================================================
   Medidor radial — una razon contra su limite.
   Se usan en pequeños multiples (uno por medida), nunca concentricos:
   dos anillos de radio distinto no se comparan de forma honesta.
   ================================================================ */

export function Ring({
  value,
  size = 96,
  stroke = 9,
  label,
  caption,
  color = 'var(--accent)',
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  caption?: string;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 0.55s cubic-bezier(0.32,0.72,0,1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center' }}>
          <div style={{ fontSize: size / 3.8, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {label ?? `${Math.round(pct * 100)}%`}
          </div>
        </div>
      </div>
      {caption && (
        <div className="tiny muted" style={{ marginTop: 8, maxWidth: size + 24 }}>
          {caption}
        </div>
      )}
    </div>
  );
}

/** Barra-medidor con etiqueta y valor a la derecha. */
export function Meter({
  label,
  value,
  right,
  color,
}: {
  label?: ReactNode;
  value: number;
  right?: ReactNode;
  color?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      {(label || right) && (
        <div className="row" style={{ marginBottom: 5, gap: 8 }}>
          <span className="small" style={{ flex: 1, minWidth: 0 }}>
            {label}
          </span>
          {right && <span className="small bold num">{right}</span>}
        </div>
      )}
      <div className="meter">
        <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color ?? 'var(--accent)' }} />
      </div>
    </div>
  );
}

/* ================================================================
   Columnas — comparar magnitud a lo largo del tiempo.
   Una sola serie, un solo tono; remates redondeados anclados a la
   base y 2px de hueco entre barras.
   ================================================================ */

export function ColumnChart({
  data,
  height = 116,
  color = 'var(--accent)',
  format,
  highlightLast,
  max: fixedMax,
}: {
  data: Array<{ label: string; value: number; caption?: string }>;
  height?: number;
  color?: string;
  format?: (v: number) => string;
  highlightLast?: boolean;
  /** Tope del eje. Para porcentajes se fija a 1: escalar al maximo de la
   *  muestra haria que un mes al 1% se dibujara como una barra llena. */
  max?: number;
}) {
  const { show, hide, node } = useTooltip();
  const max = fixedMax ?? Math.max(...data.map((d) => d.value), 0.0001);
  const fmt = format ?? ((v: number) => String(Math.round(v)));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height, justifyContent: 'center' }}>
        {data.map((d, i) => {
          const active = highlightLast && i === data.length - 1;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                maxWidth: 44,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                cursor: 'default',
              }}
              onMouseMove={(e) => show(e, `${d.caption ?? d.label}: ${fmt(d.value)}`)}
              onMouseLeave={hide}
            >
              <div
                style={{
                  height: `${Math.max(1.5, (d.value / max) * 100)}%`,
                  background: active ? 'var(--accent)' : color,
                  borderRadius: '4px 4px 2px 2px',
                  opacity: d.value === 0 ? 0.22 : 1,
                  transition: 'height 0.4s cubic-bezier(0.32,0.72,0,1)',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6, justifyContent: 'center' }}>
        {data.map((d, i) => (
          <div key={i} className="tiny faint center" style={{ flex: 1, maxWidth: 44 }}>
            {d.label}
          </div>
        ))}
      </div>
      {node}
    </div>
  );
}

/* ================================================================
   Linea / area — tendencia de una sola serie, con retícula y globo.
   ================================================================ */

export function LineChart({
  data,
  height = 132,
  color = 'var(--accent)',
  format,
  yMax,
  area = true,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  format?: (v: number) => string;
  yMax?: number;
  area?: boolean;
}) {
  const { show, hide, node } = useTooltip();
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fmt = format ?? ((v: number) => String(Math.round(v)));

  if (!data.length) return <Empty text="Sin datos todavia" />;

  const W = 300;
  const H = height;
  const pad = 6;
  const max = yMax ?? Math.max(...data.map((d) => d.value), 1);
  const x = (i: number) => (data.length === 1 ? W / 2 : (i / (data.length - 1)) * (W - pad * 2) + pad);
  const y = (v: number) => H - pad - (Math.max(0, v) / max) * (H - pad * 2);
  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
    setHover(i);
    show(e, `${data[i]!.label}: ${fmt(data[i]!.value)}`);
  };

  return (
    <div
      ref={ref}
      style={{ position: 'relative' }}
      onMouseMove={onMove}
      onMouseLeave={() => {
        setHover(null);
        hide();
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={H - pad - g * (H - pad * 2)}
            y2={H - pad - g * (H - pad * 2)}
            stroke="var(--separator)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {area && (
          <polygon points={`${x(0)},${H} ${points.join(' ')} ${x(data.length - 1)},${H}`} fill={color} opacity={0.12} />
        )}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover != null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad}
              y2={H - pad}
              stroke="var(--separator-strong)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(hover)} cy={y(data[hover]!.value)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </>
        )}
      </svg>
      <div className="row tiny faint" style={{ marginTop: 4 }}>
        <span style={{ flex: 1 }}>{data[0]!.label}</span>
        <span>{data[data.length - 1]!.label}</span>
      </div>
      {node}
    </div>
  );
}

/* ================================================================
   Mapa de calor — magnitud en rejilla, rampa de un solo tono.
   ================================================================ */

export function Heatmap({
  data,
  onSelect,
}: {
  data: Array<{ date: string; rate: number; empty?: boolean }>;
  onSelect?: (date: string) => void;
}) {
  const { show, hide, node } = useTooltip();
  const step = (r: number, empty?: boolean) => {
    if (empty) return 'var(--seq-0)';
    if (r <= 0) return 'var(--seq-0)';
    if (r < 0.25) return 'var(--seq-1)';
    if (r < 0.5) return 'var(--seq-2)';
    if (r < 0.75) return 'var(--seq-3)';
    if (r < 0.95) return 'var(--seq-4)';
    if (r < 1) return 'var(--seq-5)';
    return 'var(--seq-6)';
  };
  return (
    <div>
      <div className="grid-wrap">
        <div className="heat">
          {data.map((d) => (
            <i
              key={d.date}
              style={{ background: step(d.rate, d.empty), cursor: onSelect ? 'pointer' : 'default' }}
              onMouseMove={(e) => show(e, `${d.date} · ${d.empty ? 'sin datos' : `${Math.round(d.rate * 100)}%`}`)}
              onMouseLeave={hide}
              onClick={() => onSelect?.(d.date)}
            />
          ))}
        </div>
      </div>
      <div className="row tiny faint" style={{ marginTop: 10, gap: 6 }}>
        <span>Menos</span>
        <div className="row" style={{ gap: 3 }}>
          {['var(--seq-0)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-6)'].map((c) => (
            <i key={c} style={{ width: 11, height: 11, borderRadius: 3, background: c, display: 'block' }} />
          ))}
        </div>
        <span>Mas</span>
      </div>
      {node}
    </div>
  );
}

/* ================================================================
   Barra apilada — parte respecto al todo, con leyenda que ademas
   hace de tabla de valores.
   ================================================================ */

export function StackedBar({
  parts,
  format,
}: {
  parts: Array<{ label: string; value: number; color: string }>;
  format?: (v: number) => string;
}) {
  const { show, hide, node } = useTooltip();
  const total = parts.reduce((a, p) => a + p.value, 0);
  const fmt = format ?? ((v: number) => String(Math.round(v)));
  if (total <= 0) return <Empty text="Sin datos todavia" />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 26, borderRadius: 7, overflow: 'hidden' }}>
        {parts.map((p, i) => (
          <div
            key={i}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
            onMouseMove={(e) => show(e, `${p.label}: ${fmt(p.value)} (${Math.round((p.value / total) * 100)}%)`)}
            onMouseLeave={hide}
          />
        ))}
      </div>
      <div className="legend">
        {parts.map((p, i) => (
          <span className="item" key={i}>
            <i className="swatch" style={{ background: p.color }} />
            {p.label}
            <b style={{ color: 'var(--text)' }}>{fmt(p.value)}</b>
          </span>
        ))}
      </div>
      {node}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; value?: string }> }) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <span className="item" key={i}>
          <i className="swatch" style={{ background: it.color }} />
          {it.label}
          {it.value && <b style={{ color: 'var(--text)' }}>{it.value}</b>}
        </span>
      ))}
    </div>
  );
}

/* ================================================================
   Confirmacion
   ================================================================ */

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
        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={() => {
              state.resolve(false);
              setState(null);
            }}
          >
            Cancelar
          </button>
          <button
            className="btn primary"
            style={{ flex: 1 }}
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

export type { CSSProperties };
