import React from 'react';
import { PLACEHOLDER } from '../data/placeholder.js';

export function Img({ src, alt = '', className, ...rest }) {
  return (
    <img
      src={src || PLACEHOLDER}
      alt={alt}
      className={className}
      loading="lazy"
      onError={e => { if (!e.currentTarget.dataset.fallback) { e.currentTarget.dataset.fallback = '1'; e.currentTarget.src = PLACEHOLDER; } }}
      {...rest}
    />
  );
}

export function Swatches({ colors = [], size = 12 }) {
  return (
    <span className="fx-swatches">
      {colors.slice(0, 3).map(c => <i key={c.name + c.hex} title={c.name} style={{ background: c.hex, width: size, height: size }} />)}
    </span>
  );
}

export function Chips({ options, value, onChange, allowNone = true, labels = {} }) {
  return (
    <div className="fx-chips">
      {options.map(o => (
        <button type="button" key={o} className={value === o ? 'on' : ''} onClick={() => onChange(value === o && allowNone ? null : o)}>
          {labels[o] || o}
        </button>
      ))}
    </div>
  );
}

export function PageHeading({ kicker, title, em, text, children }) {
  return (
    <div className="fc-page-heading">
      <div>
        <p className="fc-kicker">{kicker}</p>
        <h1>{title} <em>{em}</em></h1>
        {text && <p>{text}</p>}
      </div>
      {children}
    </div>
  );
}

// Simple line-art hairstyle glyphs for visual inspiration.
export function HairGlyph({ icon }) {
  const face = <ellipse cx="32" cy="36" rx="11" ry="13" fill="var(--fx-skin)" stroke="currentColor" strokeWidth="1.4" />;
  const shapes = {
    waves: <path d="M18 34c-4-16 6-24 14-24s18 8 14 24c2 6 0 14-2 20M18 34c-2 6 0 14 2 20M22 22c3 4 2 9 0 12M42 22c-3 4-2 9 0 12" />,
    pony: <><path d="M20 32c-1-13 5-20 12-20s13 7 12 20" /><path d="M44 20c8 2 10 12 8 22-1 5-4 8-6 10" /><circle cx="45" cy="20" r="2" /></>,
    bun: <><path d="M20 33c-1-12 5-19 12-19s13 7 12 19" /><circle cx="32" cy="9" r="6" /><path d="M27 7c2 3 8 3 10 0" /></>,
    lowbun: <><path d="M20 33c-1-12 5-19 12-19s13 7 12 19" /><circle cx="32" cy="52" r="5" /></>,
    straight: <path d="M19 52V30c0-11 6-18 13-18s13 7 13 18v22M24 20v30M40 20v30" />,
    halfup: <><path d="M19 50V31c0-11 6-18 13-18s13 7 13 18v19" /><path d="M24 22c4 3 12 3 16 0" /><circle cx="32" cy="23" r="2" /></>,
    braid: <><path d="M20 32c-1-12 5-19 12-19s13 7 12 19" /><path d="M20 34l-2 6 3 4-3 5 3 4M44 34l2 6-3 4 3 5-3 4" /></>,
    updo: <><path d="M20 33c-1-12 5-21 12-21s13 9 12 21" /><path d="M24 12c2-6 14-6 16 0-2 4-14 4-16 0z" /></>,
    everyday: <path d="M19 44V31c0-11 6-18 13-18s13 7 13 18v13M23 18c4 4 14 4 18 0" />,
    curls: <><path d="M17 40c-4-6-2-16 2-20 2-6 8-10 13-10s11 4 13 10c4 4 6 14 2 20" /><circle cx="18" cy="44" r="3" /><circle cx="46" cy="44" r="3" /><circle cx="22" cy="14" r="3" /><circle cx="42" cy="14" r="3" /></>,
    short: <path d="M20 30c0-10 5-16 12-16s12 6 12 16c-2-4-6-7-12-7s-10 3-12 7z" />,
    bob: <path d="M18 42V30c0-11 6-17 14-17s14 6 14 17v12c-3 1-5 0-6-2M18 42c3 1 5 0 6-2" />,
  };
  return (
    <svg viewBox="0 0 64 64" className="fx-hair-glyph" aria-hidden="true">
      {face}
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{shapes[icon] || shapes.everyday}</g>
    </svg>
  );
}

export const fmtMoney = (n) => (n == null || Number.isNaN(n) ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);
