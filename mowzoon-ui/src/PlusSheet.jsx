// Mowzoon+ : the subscribe sheet, the fake Apple Pay checkout, and the
// small lock/chip pieces every gate in the app reuses. The "payment" is
// pure theatre - nothing leaves the device (see plus.js for what flips).

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Glyph, spring } from './ui';
import { useI18n } from './i18n';
import { AlinmaMark } from './bank/inma';
import { PLUS_PRICE, LIMITS, isPlus, subscribePlus, cancelPlus } from './plus';

/* --------------------------------- marks ---------------------------------- */

// The Apple Pay lockup, inlined so it inherits currentColor (white on the
// pay button, ink on the sheet header).
export function ApplePayMark({ height = 18 }) {
  return (
    <svg
      height={height}
      viewBox="-76.79115 -52.55 665.5233 315.3"
      fill="currentColor"
      aria-label="Apple Pay"
      role="img"
    >
      <path d="M93.541 27.1c-6 7.1-15.6 12.7-25.2 11.9-1.2-9.6 3.5-19.8 9-26.1 6-7.3 16.5-12.5 25-12.9 1 10-2.9 19.8-8.8 27.1m8.7 13.8c-13.9-.8-25.8 7.9-32.4 7.9-6.7 0-16.8-7.5-27.8-7.3-14.3.2-27.6 8.3-34.9 21.2-15 25.8-3.9 64 10.6 85 7.1 10.4 15.6 21.8 26.8 21.4 10.6-.4 14.8-6.9 27.6-6.9 12.9 0 16.6 6.9 27.8 6.7 11.6-.2 18.9-10.4 26-20.8 8.1-11.8 11.4-23.3 11.6-23.9-.2-.2-22.4-8.7-22.6-34.3-.2-21.4 17.5-31.6 18.3-32.2-10-14.8-25.6-16.4-31-16.8m80.3-29v155.9h24.2v-53.3h33.5c30.6 0 52.1-21 52.1-51.4s-21.1-51.2-51.3-51.2zm24.2 20.4h27.9c21 0 33 11.2 33 30.9s-12 31-33.1 31h-27.8zm129.8 136.7c15.2 0 29.3-7.7 35.7-19.9h.5v18.7h22.4V90.2c0-22.5-18-37-45.7-37-25.7 0-44.7 14.7-45.4 34.9h21.8c1.8-9.6 10.7-15.9 22.9-15.9 14.8 0 23.1 6.9 23.1 19.6v8.6l-30.2 1.8c-28.1 1.7-43.3 13.2-43.3 33.2 0 20.2 15.7 33.6 38.2 33.6zm6.5-18.5c-12.9 0-21.1-6.2-21.1-15.7 0-9.8 7.9-15.5 23-16.4l26.9-1.7v8.8c0 14.6-12.4 25-28.8 25zm82 59.7c23.6 0 34.7-9 44.4-36.3l42.5-119.2h-24.6l-28.5 92.1h-.5l-28.5-92.1h-25.3l41 113.5-2.2 6.9c-3.7 11.7-9.7 16.2-20.4 16.2-1.9 0-5.6-.2-7.1-.4v18.7c1.4.4 7.4.6 9.2.6z" />
    </svg>
  );
}

// "Mowzoon+" as a wordmark; the plus rides the tint
export function PlusWord({ className }) {
  const i = useI18n();
  return (
    <span className={`plus-word${className ? ` ${className}` : ''}`}>
      {i.lang === 'ar' ? 'موزون' : 'Mowzoon'}
      <i>+</i>
    </span>
  );
}

// small pill used wherever locked content shows its price of entry
export function PlusChip({ onClick }) {
  const body = (
    <>
      <Glyph id="lock" size={11} strokeWidth={2.4} />
      <PlusWord />
    </>
  );
  return onClick ? (
    <button className="plus-chip" onClick={onClick}>{body}</button>
  ) : (
    <span className="plus-chip">{body}</span>
  );
}

// Blur-and-lock wrapper: the content stays visible underneath (that's the
// upsell), a single button floats over it.
export function PlusLock({ label, onPlus, children }) {
  const i = useI18n();
  return (
    <div className="plus-lock">
      <div className="plus-lock-under" aria-hidden="true" inert>
        {children}
      </div>
      <button className="plus-lock-cta" onClick={onPlus}>
        <span className="plus-lock-ic"><Glyph id="lock" size={16} strokeWidth={2.2} /></span>
        <PlusWord />
        <em>{label || i.t('plus.lock.generic')}</em>
      </button>
    </div>
  );
}

/* ----------------------------- fake Apple Pay ----------------------------- */

// side-button pictogram from the real sheet: a rounded rect with an arrow
function SideButtonMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.4" />
      <path d="M14.6 7.6a5.1 5.1 0 1 0 1.9 4" />
      <path d="M16.9 9.2l-.4 2.4-2.4-.4" />
    </svg>
  );
}

// The Apple Pay bottom sheet, faked to the pixel-mood of the real one:
// card row, recurring line, "Due today", confirm-with-side-button footer,
// and the little "Double Click to Pay" flag hugging the edge.
function ApplePaySheet({ app, onConfirm, onClose }) {
  const i = useI18n();
  const [stage, setStage] = useState('idle'); // idle | busy | done
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const confirm = () => {
    if (stage !== 'idle') return;
    setStage('busy');
    timers.current.push(
      setTimeout(() => setStage('done'), 1500),
      setTimeout(() => onConfirm(), 2450),
    );
  };

  const day = new Date().getDate();

  return (
    <motion.div className="pay-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* the phone's side button, flagged like the real prompt */}
      <motion.div
        className="pay-flag"
        dir="ltr"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ ...spring, delay: 0.25 }}
      >
        <span className="pay-flag-txt">{i.t('pay.dbl')}</span>
        <motion.span
          className="pay-flag-bar"
          animate={stage === 'idle' ? { scaleY: [1, 0.82, 1] } : { scaleY: 1 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.div
        className="pay-sheet"
        dir="ltr"
        role="dialog"
        aria-modal="true"
        aria-label="Apple Pay"
        initial={{ y: '105%' }}
        animate={{ y: 0 }}
        exit={{ y: '105%', transition: { duration: 0.22, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="pay-head">
          <ApplePayMark height={20} />
          <button className="pay-x" onClick={stage === 'idle' ? onClose : undefined} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="pay-row pay-card-row">
          <span className="pay-card-art"><AlinmaMark size={15} /></span>
          <span className="pay-card-meta">
            <b>{i.t('pay.card')}</b>
            <em>{i.t('pay.card.type')}</em>
          </span>
          <span className="pay-card-num">•••• 4821</span>
          <svg className="pay-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </div>

        <div className="pay-row pay-item-row">
          <span className="pay-item-ic"><Glyph id="spark" size={15} strokeWidth={2} /></span>
          <span className="pay-card-meta">
            <b>{i.t('pay.item')}</b>
            <em>{i.t('pay.monthly', { a: i.fmtMoney(PLUS_PRICE), n: i.fmtNum(day) })}</em>
          </span>
          <svg className="pay-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </div>

        <div className="pay-due">
          <span className="pay-due-cap">{i.t('pay.due')}</span>
          <b className="pay-due-amt">{i.fmtMoney(PLUS_PRICE)}</b>
        </div>

        <button className="pay-confirm" onClick={confirm} disabled={stage !== 'idle'}>
          <AnimatePresence mode="wait" initial={false}>
            {stage === 'idle' ? (
              <motion.span key="idle" className="pay-confirm-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                <SideButtonMark />
                <span>{i.t('pay.confirm')}</span>
              </motion.span>
            ) : stage === 'busy' ? (
              <motion.span key="busy" className="pay-confirm-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                <span className="pay-spin" aria-hidden="true" />
                <span>{i.t('pay.processing')}</span>
              </motion.span>
            ) : (
              <motion.span key="done" className="pay-confirm-in pay-done" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.6" />
                  <path d="M8 12.4l2.8 2.8L16.4 9" />
                </svg>
                <span>{i.t('pay.done')}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------ the Plus sheet ----------------------------- */

const FEATURES = [
  { glyph: 'trend', k: 'plus.f.analytics' },
  { glyph: 'swords', k: 'plus.f.arena' },
  { glyph: 'spark', k: 'plus.f.quests' },
  { glyph: 'calendar', k: 'plus.f.ahead' },
];

export default function PlusSheet({ app, setApp, onClose, toast }) {
  const i = useI18n();
  const active = isPlus(app);
  const [paying, setPaying] = useState(false);
  // cancel arms on the first tap, fires on the second (same as reset)
  const [armed, setArmed] = useState(false);
  const armTimer = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(armTimer.current); };
  }, [onClose]);

  const subscribe = () => {
    setApp(subscribePlus);
    setPaying(false);
    toast?.('spark', i.t('plus.toast'));
  };
  const cancel = () => {
    if (!armed) {
      setArmed(true);
      clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(false), 3200);
      return;
    }
    setApp(cancelPlus);
    setArmed(false);
    toast?.('spark', i.t('plus.cancelled.toast'));
  };

  const sinceLabel = app.plus?.since
    ? new Intl.DateTimeFormat(i.locale, { month: 'long', day: 'numeric' }).format(new Date(app.plus.since))
    : '';

  return (
    <motion.div className="sheet-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="pf-sheet plus-sheet lg-spec"
        data-liquid
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16 } }}
        transition={spring}
      >
        <div className="sheet-top">
          <span className="sheet-corner" />
          <span className="sheet-title" />
          <button className="sheet-close" onClick={onClose} aria-label="Done">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="sheet-scroll">
          <div className="plus-hero">
            <span className="plus-hero-mark" aria-hidden="true">
              <Glyph id="spark" size={26} strokeWidth={1.9} />
            </span>
            <h2 className="plus-title"><PlusWord /></h2>
            <p className="plus-tag">{active ? i.t('plus.active') : i.t('plus.tagline')}</p>
            {active && (
              <span className="plus-since">{i.t('plus.active.since', { d: sinceLabel })}</span>
            )}
          </div>

          <div className="plus-rows">
            {FEATURES.map((f, idx) => (
              <motion.div
                className="plus-row"
                key={f.k}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.12 + idx * 0.07 }}
              >
                <span className={`plus-row-ic${active ? ' on' : ''}`}>
                  {active
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.8l4.2 4.2L19 7.4" /></svg>
                    : <Glyph id={f.glyph} size={16} strokeWidth={2} />}
                </span>
                <span className="plus-row-meta">
                  <b>{i.t(f.k)}</b>
                  <em>{i.t(`${f.k}.d`)}</em>
                </span>
              </motion.div>
            ))}
          </div>

          {active ? (
            <>
              <p className="plus-renews">
                {i.t('plus.active.renews', { n: i.fmtNum(app.plus?.renewDay ?? 1), a: i.fmtMoney(PLUS_PRICE) })}
              </p>
              <button className={`plus-cancel${armed ? ' armed' : ''}`} onClick={cancel}>
                {i.t(armed ? 'plus.cancel.confirm' : 'plus.cancel')}
              </button>
            </>
          ) : (
            <>
              <p className="plus-price">
                <b>{i.t('plus.price', { a: i.fmtMoney(PLUS_PRICE) })}</b>
                <em>{i.t('plus.cancel.note')}</em>
              </p>
              <motion.button className="pay-btn" whileTap={{ scale: 0.97 }} onClick={() => setPaying(true)}>
                <span>{i.t('plus.subscribe')}</span>
                <ApplePayMark height={19} />
              </motion.button>
              <p className="plus-foot">{i.t('plus.foot', { n: i.fmtNum(LIMITS.aheadItems), p: i.fmtNum(LIMITS.arenaPlays) })}</p>
            </>
          )}
        </div>

        <AnimatePresence>
          {paying && (
            <ApplePaySheet app={app} onConfirm={subscribe} onClose={() => setPaying(false)} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
