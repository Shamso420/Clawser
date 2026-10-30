'use client';
import { useEffect, useRef } from 'react';
import { channelById, stageById } from '@/lib/constants';

export function Logo({ size = 36 }) {
  return (
    <span className="logo" style={{ width: size, height: size, fontSize: size * 0.56, borderRadius: size * 0.26 }} aria-hidden>
      C
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Logo size={28} />
      <span>Clawser</span>
    </span>
  );
}

export function ChannelTag({ id }) {
  const c = channelById[id] || channelById.other;
  return (
    <span className="chan">
      <i style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

export function StagePill({ id }) {
  return <span className={`stage stage-${id}`}>{stageById[id]?.label || id}</span>;
}

export function Initials({ name, title }) {
  const s = (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="initials" title={title || name}>
      {s}
    </span>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.focus(), 10);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  today: 'M4 7h16M8 3v4M16 3v4M5 5h14v15H5zM9 13l2 2 4-4',
  pipeline: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z',
  leads: 'M4 6h16M4 12h16M4 18h10',
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.5a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  chevron: 'M9 6l6 6-6 6',
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
