// Shared motion primitives and small components.

import { useEffect, useId, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { useI18n } from './i18n';

export const spring = { type: 'spring', stiffness: 320, damping: 26, mass: 0.9 };
export const springSoft = { type: 'spring', stiffness: 210, damping: 24 };
export const springBounce = { type: 'spring', stiffness: 380, damping: 16 };
export const gel = { type: 'spring', stiffness: 650, damping: 30 };
// slower spring with a bit of overshoot, for hero moments
export const liquid = { type: 'spring', stiffness: 250, damping: 20, mass: 1.05 };

// Screen-level enter/exit uses transforms only. An ancestor whose
// opacity is mid-animation (even 0.99) becomes a backdrop root:
// every glass panel inside loses sight of the aurora and renders
// as flat default frost until the animation ends, then snaps to
// the real material. Elements fade themselves via `item` instead;
// an element's own opacity does not gate its backdrop sampling.
export const screen = {
  initial: { y: 26, scale: 0.985 },
  animate: {
    y: 0, scale: 1,
    transition: { ...liquid, staggerChildren: 0.06, delayChildren: 0.04 },
  },
  exit: { y: -16, scale: 0.99, transition: { duration: 0.16, ease: 'easeIn' } },
};

export const item = {
  initial: { opacity: 0, y: 18, scale: 0.975 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22, mass: 0.9 } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } },
};

// logo mark
export function LogoMark({ size = 22, strokeWidth = 1.9 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.6" />
      <path d="M4.3 12c2.6-2.6 5.1 2.6 7.7 0s5.1-2.6 7.7 0" />
    </svg>
  );
}

// Orb: fill 0..1 raises the water line; two drifting waves give it
// depth. Springs move the level, CSS drifts the surface (paused under
// reduced motion).
const WAVE_D = 'M-24 1.6 Q-18 -1.6 -12 0 T0 0 T12 0 T24 0 T36 0 T48 0 V30 H-24 Z';

export function LiquidOrb({ size = 44, fill = 0, tint = 'var(--tint)' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const y = 22 - Math.max(0, Math.min(1, fill)) * 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="orb" aria-hidden="true">
      <defs>
        <clipPath id={`orb${uid}`}>
          <circle cx="12" cy="12" r="10.2" />
        </clipPath>
      </defs>
      <circle cx="12" cy="12" r="10.2" className="orb-bg" />
      <g clipPath={`url(#orb${uid})`} style={{ color: tint }}>
        <motion.g initial={false} animate={{ y }} transition={springSoft}>
          <path className="orb-wave orb-wave-back" d={WAVE_D} fill="currentColor" fillOpacity="0.3" />
          <path className="orb-wave" d={WAVE_D} fill="currentColor" fillOpacity="0.85" />
        </motion.g>
      </g>
      <circle cx="12" cy="12" r="10.2" className="orb-rim" fill="none" stroke="currentColor" style={{ color: tint }} />
    </svg>
  );
}

// stroke icons on a 24px grid
const ICON_PATHS = {
  bolt: <path d="M13 2 6 13.5h5L9.5 22 18 10.5h-5L13 2Z" />,
  shield: (
    <>
      <path d="M12 3l7 2.6v5.2c0 4.6-3 7.7-7 9.2-4-1.5-7-4.6-7-9.2V5.6L12 3Z" />
      <path d="M9 11.6l2.2 2.2 4.3-4.6" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 3.5 3.5L20 7" />
      <path d="M14.5 7H20v5.5" />
    </>
  ),
  peak: <path d="M3 20 9.5 8l4 6.5L16 11l5 9H3Z" />,
  swords: (
    <>
      <path d="M19.5 4.5 8.2 15.8" />
      <path d="M4.5 4.5 15.8 15.8" />
      <path d="M5.6 14.4l4 4" />
      <path d="M18.4 14.4l-4 4" />
      <path d="M7.6 16.4 5 19" />
      <path d="M16.4 16.4 19 19" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.2 12 4.5l8 6.7" />
      <path d="M6 9.8V19a.8.8 0 0 0 .8.8h10.4a.8.8 0 0 0 .8-.8V9.8" />
      <path d="M10.2 19.8v-5.4h3.6v5.4" />
    </>
  ),
  gamepad: (
    <>
      <path d="M6.8 8.5h10.4a4.2 4.2 0 0 1 4.1 5.1l-.6 2.9a2.6 2.6 0 0 1-4.6 1L14.7 15H9.3l-1.4 2.5a2.6 2.6 0 0 1-4.6-1l-.6-2.9a4.2 4.2 0 0 1 4.1-5.1Z" />
      <path d="M8.2 11v3M6.7 12.5h3M15.5 11.4h.01M17.3 13h.01" />
    </>
  ),
  moon: <path d="M19.5 13.8A7.8 7.8 0 1 1 10.2 4.5a6.2 6.2 0 0 0 9.3 9.3Z" />,
  car: (
    <>
      <path d="M3.5 16.5V12l2-4.5h9L18 12h1.5a1 1 0 0 1 1 1v3.5h-1.9M9.1 16.5h5.3M3.5 12H18" />
      <circle cx="7.3" cy="16.5" r="1.7" />
      <circle cx="16.3" cy="16.5" r="1.7" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="14.2" r="5.6" />
      <path d="M9.4 8.8 12 5.4l2.6 3.4" />
    </>
  ),
  bell: (
    <>
      <path d="M12 3c-3.3 0-5.5 2.4-5.5 5.6 0 4-1.8 5.2-2.5 6.4h16c-.7-1.2-2.5-2.4-2.5-6.4C17.5 5.4 15.3 3 12 3Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3.2" />
      <path d="M4 10.2h16M8.4 3.4v3.4M15.6 3.4v3.4" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.4" r="3.3" />
      <path d="M3.4 19.6c.5-3.1 2.7-4.9 5.6-4.9s5.1 1.8 5.6 4.9" />
      <path d="M15.2 5.6a3.3 3.3 0 0 1 0 5.6" />
      <path d="M17.6 14.9c1.7.9 2.8 2.5 3 4.7" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M15.6 8.4l-1.9 5.3-5.3 1.9 1.9-5.3 5.3-1.9Z" />
    </>
  ),
  cart: (
    <>
      <path d="M3.5 4.5h2.1l2.1 10.6h10.4l2.4-7.8H6.2" />
      <circle cx="9.4" cy="19.2" r="1.6" />
      <circle cx="16.8" cy="19.2" r="1.6" />
    </>
  ),
  cup: (
    <>
      <path d="M5.2 8.5h10.6v5.7a4.8 4.8 0 0 1-4.8 4.8h-1a4.8 4.8 0 0 1-4.8-4.8V8.5Z" />
      <path d="M15.8 9.7h1.6a2.4 2.4 0 0 1 0 4.8h-1.6" />
      <path d="M8.7 3.6v1.9M12.3 3.6v1.9" />
    </>
  ),
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  flame: (
    <path d="M12 3.5c3.4 3 5.4 5.9 5.4 8.9a5.4 5.4 0 0 1-10.8 0c0-1.9.75-3.7 2-5.3.4 1 1 1.7 1.8 2.3.05-2 .7-3.9 1.6-5.9Z" />
  ),
  sliders: (
    <>
      <path d="M4 7h9.3M18.2 7H20" />
      <circle cx="15.9" cy="7" r="2.3" />
      <path d="M4 12h2.4M11.1 12H20" />
      <circle cx="8.8" cy="12" r="2.3" />
      <path d="M4 17h9.3M18.2 17H20" />
      <circle cx="15.9" cy="17" r="2.3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.9 15.9 20 20" />
    </>
  ),
  redo: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20.2 3.6v3.9a.9.9 0 0 1-.9.9h-3.9" />
    </>
  ),
  spark: (
    <path d="M12 3.5v3.4M12 17.1v3.4M3.5 12h3.4M17.1 12h3.4M6 6l2.4 2.4M15.6 15.6 18 18M18 6l-2.4 2.4M8.4 15.6 6 18" />
  ),
  layers: (
    <>
      <rect x="4" y="7.5" width="12.5" height="12.5" rx="3.2" />
      <path d="M8.2 4.5h8.6a2.7 2.7 0 0 1 2.7 2.7v8.6" />
    </>
  ),
  layersFill: (
    <>
      <rect x="4" y="7.5" width="12.5" height="12.5" rx="3.2" fill="currentColor" stroke="none" />
      <path d="M8.2 4.5h8.6a2.7 2.7 0 0 1 2.7 2.7v8.6" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4.5h10v5.7a5 5 0 0 1-10 0V4.5Z" />
      <path d="M7 6.2H4.4v.6a3 3 0 0 0 3 3M17 6.2h2.6v.6a3 3 0 0 1-3 3" />
      <path d="M12 15.2v2.6M8.6 20.5h6.8M10 17.8h4v2.7h-4z" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.24 4.24 0 0 0-6-6l-1.2 1.2" />
      <path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.24 4.24 0 0 0 6 6l1.2-1.2" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6.2" height="6.2" rx="1.4" />
      <rect x="13.8" y="4" width="6.2" height="6.2" rx="1.4" />
      <rect x="4" y="13.8" width="6.2" height="6.2" rx="1.4" />
      <path d="M13.8 13.8h2.6v2.6h-2.6zM17.4 17.4h2.6v2.6h-2.6z" />
    </>
  ),
  ghost: (
    <>
      <path d="M5.5 20V11a6.5 6.5 0 0 1 13 0v9l-2.2-1.8-2.1 1.8-2.2-1.8-2.1 1.8-2.2-1.8L5.5 20Z" />
      <path d="M9.6 10.4h.01M14.4 10.4h.01" />
    </>
  ),
  help: (
    <>
      <path d="M9.1 9.4a3 3 0 1 1 4.6 2.5c-1 .7-1.7 1.3-1.7 2.6" />
      <path d="M12 18.2h.01" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.4 12h17.2" />
      <ellipse cx="12" cy="12" rx="3.9" ry="8.6" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.6h15" />
      <path d="M9.2 6.6V5a1.3 1.3 0 0 1 1.3-1.3h3A1.3 1.3 0 0 1 14.8 5v1.6" />
      <path d="M6.4 6.6l.8 12.2a1.6 1.6 0 0 0 1.6 1.5h6.4a1.6 1.6 0 0 0 1.6-1.5l.8-12.2" />
      <path d="M10.1 10.6v5.6M13.9 10.6v5.6" />
    </>
  ),
};

export function Glyph({ id, size = 26, strokeWidth = 1.9 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[id]}
    </svg>
  );
}

// Animates a number to its new value. Writes to the text node directly;
// setState would re-render React 60 times a second per live number.
// `format` localizes the rendered digits (defaults to en-US).
export function NumberFlow({ value, duration = 0.9, delay = 0, from, format }) {
  const fmt = format ?? ((v) => v.toLocaleString('en-US'));
  const ref = useRef(null);
  const prev = useRef(from ?? value);
  const initial = useRef(from ?? value);
  // a language flip makes React reconcile the text node back to the mount
  // value; keying the effect on lang re-writes the real one right after
  const lang = useI18n()?.lang;
  useEffect(() => {
    const node = ref.current;
    const start = prev.current;
    prev.current = value;
    if (!node) return undefined;
    if (start === value) {
      node.textContent = fmt(value);
      return undefined;
    }
    const controls = animate(start, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { node.textContent = fmt(Math.round(v)); },
    });
    return () => controls.stop();
  }, [value, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{fmt(initial.current)}</span>;
}

// Score meter with springy fill + counting value.
// Pass `caption` for the detailed variant (adds explainer + verdict chip).
export function Meter({ label, value, delay = 0, caption }) {
  const i = useI18n();
  const verdict = value < 40 ? i.t('verdict.low') : value < 70 ? i.t('verdict.mid') : i.t('verdict.high');
  return (
    <div>
      <div className="meter-top">
        <span className="meter-label">
          {label}
          {caption && <span className="verdict">{verdict}</span>}
        </span>
        <span className="meter-val">
          <NumberFlow value={value} from={0} delay={delay} format={i.fmtNum} />
          <em> /{i.fmtNum(100)}</em>
        </span>
      </div>
      <div className="meter">
        <motion.div
          className="meter-fill"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ ...springSoft, delay }}
        />
      </div>
      {caption && <p className="meter-cap">{caption}</p>}
    </div>
  );
}

// The article's slider: a thin track with a lozenge grabber that is a solid
// white pill at rest and, while held, grows into a CLEAR glass lens - the
// track and fill visibly magnify and bend through it ("you can see the
// current level through the glass, while the sides refract the background").
// Convex bezel, blur 0. The held state changes the element's real size, so
// the engine rebuilds the map for the grown lens.
export function LiquidSlider({ value, onChange, min = 0, max = 1, step = 0.05, label }) {
  const { dir } = useI18n();
  const trackRef = useRef(null);
  const [held, setHeld] = useState(false);
  const rtl = dir === 'rtl';
  const pct = ((value - min) / (max - min)) * 100;
  const fromPointer = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    let f = (clientX - r.left) / r.width;
    if (rtl) f = 1 - f;
    onChange(min + Math.min(1, Math.max(0, f)) * (max - min));
  };
  const nudge = (e) => {
    const d =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1
      : 0;
    if (!d) return;
    e.preventDefault();
    // horizontal arrows are physical; vertical ones aren't
    const flip = rtl && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') ? -1 : 1;
    onChange(Math.min(max, Math.max(min, value + d * flip * step)));
  };
  return (
    <div
      className="lsl"
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value * 100) / 100}
      onPointerDown={(e) => {
        setHeld(true);
        fromPointer(e.clientX);
        // capture can throw for already-released pointers; never let it
        // take the state update down with it
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* gesture continues uncaptured */
        }
      }}
      onPointerMove={(e) => e.buttons & 1 && fromPointer(e.clientX)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onKeyDown={nudge}
    >
      <span className="lsl-track" aria-hidden="true">
        <span className="lsl-fill" style={{ width: `${pct}%` }} />
      </span>
      <span
        className={`lsl-thumb lg-spec${held ? ' held' : ''}`}
        data-liquid
        data-liquid-bezel="16"
        data-liquid-blur="0"
        aria-hidden="true"
        style={{ left: `${rtl ? 100 - pct : pct}%` }}
      />
    </div>
  );
}

// Segmented control. Equal-width segments with a CSS-sprung thumb, no
// shared-layout measurement, so it can't mis-track on scroll jumps.
export function Seg({ options, value, onChange }) {
  const { dir } = useI18n();
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  // translateX is physical; in RTL the segments flow right-to-left,
  // so the thumb walks the other way.
  const step = dir === 'rtl' ? -100 : 100;
  return (
    <div className="seg" role="tablist">
      {/* no lens here: the thumb rides a flat track - there is nothing for
          refraction to bend, it only made the thumb look washed out */}
      <span
        className="seg-thumb"
        aria-hidden="true"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${idx * step}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// The logo mark, alive: the wave flows continuously through the
// circle, clipped like liquid seen through a lens.
export function LiquidMark({ size = 44 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.6" />
      <g clipPath="url(#mz-lens)">
        <motion.path
          d="M-18.8 12q3.85-4 7.7 0t7.7 0t7.7 0t7.7 0t7.7 0t7.7 0t7.7 0"
          animate={{ x: [0, 15.4] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
        />
      </g>
      <defs>
        <clipPath id="mz-lens">
          <circle cx="12" cy="12" r="7.9" />
        </clipPath>
      </defs>
    </svg>
  );
}
