// Onboarding flow, lives outside the app shell. Steps mount enter-only
// (no exit AnimatePresence) so a step can't hang on a frozen exit animation.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ACCENTS, ARCHETYPE_META, TYPE_TINTS } from './data';
import { DROPS } from './game';
import { todayISO } from './store';
import { Glyph, LogoMark, LiquidMark, LiquidOrb, screen, item, spring, gel } from './ui';
import { AlinmaMark } from './bank/inma';
import { useI18n, SURVEY_AR } from './i18n';
import { SURVEY, scoreSurvey } from './survey';
import { determineArchetype } from './scoring';
import { classify } from './api';

const SPIKES = [
  { name: 'Eid al-Fitr', glyph: 'spark' },
  { name: 'Eid al-Adha', glyph: 'moon' },
  { name: 'Back to School', glyph: 'calendar' },
  { name: 'Car Insurance Renewal', glyph: 'car' },
];

const METRIC_KEYS = ['efficiency', 'resilience', 'eq'];
// clamp bad server ids so the reveal can't white-screen
const CLAMP_ID = (n) => (Number.isInteger(n) && n >= 0 && n < 4 ? n : null);

// plan set-aside math, same as the Ahead room's
const daysUntil = (isoStr) => {
  const [y, m, d] = isoStr.split('-').map(Number);
  const n = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
};
const weeklyFor = (target, date) => Math.round(target / Math.max(1, Math.ceil(Math.max(1, daysUntil(date)) / 7)));

function ReadStrip({ metrics, i }) {
  return (
    <div className="ob-read">
      <span className="ob-read-label">{i.t('ob.cal.reading')}</span>
      {METRIC_KEYS.map((k) => (
        <div className="ob-read-metric" key={k}>
          <span>{i.t(`metric.${k}`)}</span>
          <div className="ob-read-track">
            <motion.i animate={{ width: `${metrics[k]}%` }} transition={spring} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MixBar({ probs }) {
  return (
    <div className="ob-mix-bar">
      {probs.slice(0, 4).map((p, idx) => (
        <motion.span
          key={idx}
          className="ob-mix-seg"
          style={{ background: ARCHETYPE_META[idx].tint }}
          initial={{ flexGrow: 0 }}
          animate={{ flexGrow: Math.max(p, 0.02) }}
          transition={spring}
        />
      ))}
    </div>
  );
}

// retake mode re-enters at the calibration step and hands straight back to the app
export default function Onboarding({ onDone, onSkip, setTint, mode = 'first' }) {
  const i = useI18n();
  const retake = mode === 'retake';
  const [step, setStep] = useState(retake ? 'cal' : 'cover'); // cover | name | cal | reveal | spikes | setup | bridge | start
  const [name, setName] = useState('');
  const [accent, setAccent] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [model, setModel] = useState(undefined); // undefined = still reading, object = model, null = offline
  const [income, setIncome] = useState('5000');
  const [seed, setSeed] = useState(true);
  const [spikeOn, setSpikeOn] = useState(() => Object.fromEntries(SPIKES.map((s) => [s.name, true])));
  // plans/subs added on the calendar step, handed to the Ahead room on finish
  const [aheadAdding, setAheadAdding] = useState(null); // 'plan' | 'sub' | null
  const [af, setAf] = useState({ name: '', amount: '', date: '', due: '' });
  const [obPlans, setObPlans] = useState([]);
  const [obSubs, setObSubs] = useState([]);
  const [flights, setFlights] = useState([]);
  const flightId = useRef(0);
  const orbRef = useRef(null);
  const settledRef = useRef(false);
  const obRef = useRef(null);

  const q = answers.length;
  const liveMetrics = scoreSurvey(answers);
  const arQ = i.lang === 'ar' ? SURVEY_AR : null;

  // move focus on step change so keyboard/screen-reader users aren't left on an unmounted button
  useEffect(() => {
    const root = obRef.current;
    if (!root) return;
    // a tall step may have been scrolled; the next one starts at the top
    root.scrollTo?.(0, 0);
    const t =
      root.querySelector('.ob-nameinput') ||
      root.querySelector('.ob-q') ||
      root.querySelector('.ob-arch-name') ||
      root.querySelector('.ob-arch-kick') ||
      root.querySelector('.ob-title');
    if (t) {
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }
  }, [step, q, model]);

  const pick = (idx, e) => {
    if (picked !== null) return;
    const from = e?.currentTarget?.getBoundingClientRect();
    const to = orbRef.current?.getBoundingClientRect();
    if (from && to) {
      setFlights((f) => [
        ...f.slice(-3),
        {
          id: ++flightId.current,
          x0: from.left + from.width / 2,
          y0: from.top + from.height / 2,
          x1: to.left + to.width / 2,
          y1: to.top + to.height / 2,
        },
      ]);
    }
    setPicked(idx);
    setTimeout(() => {
      const next = [...answers, idx];
      setPicked(null);
      if (next.length === SURVEY.length) finishCalibration(next);
      else setAnswers(next);
    }, 300);
  };

  // classify() is capped at 1.6s; slow or offline falls back to the local read
  const finishCalibration = (full) => {
    const m = scoreSurvey(full);
    setAnswers(full);
    setMetrics(m);
    setModel(undefined);
    settledRef.current = false;
    setStep('reveal');
    const settle = (res) => {
      if (settledRef.current) return;
      settledRef.current = true;
      setModel(res);
      const id = CLAMP_ID(res?.id) ?? determineArchetype(m).id;
      setTint(ARCHETYPE_META[id].tint);
    };
    classify(m).then((res) => settle(res ?? null));
    setTimeout(() => settle(null), 1600);
  };

  const calBack = () => {
    if (answers.length > 0) setAnswers((a) => a.slice(0, -1));
    else if (retake) onSkip();
    else setStep('name');
  };

  const finish = (start) =>
    onDone({
      name: name.trim(),
      accent,
      answers,
      metrics,
      income: Math.max(0, Math.round(Number(income)) || 0),
      seed,
      spikeHidden: SPIKES.filter((s) => !spikeOn[s.name]).map((s) => s.name),
      plans: obPlans,
      subs: obSubs,
      start: start === 'bank' ? 'bank' : 'mz',
    });

  const saveAheadItem = () => {
    const amt = Math.round(Number(af.amount));
    if (!af.name.trim() || !amt) return;
    if (aheadAdding === 'plan') {
      if (!af.date) return;
      setObPlans((p) => [...p, {
        name: af.name.trim(),
        target: amt,
        date: af.date,
        icon: 'peak',
        setAside: { weekly: weeklyFor(amt, af.date), startedISO: todayISO() },
      }]);
    } else {
      setObSubs((s) => [...s, {
        name: af.name.trim(),
        amount: amt,
        cycle: 'monthly',
        dueDay: Math.min(31, Math.max(1, Math.round(Number(af.due)) || 1)),
        state: 'keep',
        source: 'manual',
        icon: 'calendar',
        tracked: true,
      }]);
    }
    setAheadAdding(null);
    setAf({ name: '', amount: '', date: '', due: '' });
  };

  const revealId = CLAMP_ID(model?.id) ?? (metrics ? determineArchetype(metrics).id : 0);
  const revealMeta = ARCHETYPE_META[revealId];
  const reading = model === undefined;
  const showMix = !!model && Array.isArray(model.probs);

  // single back button mounted at the root; inside the steps it rode each entrance animation
  const backFor = {
    name: () => setStep('cover'),
    cal: calBack,
    spikes: () => setStep('reveal'),
    setup: () => setStep('spikes'),
    bridge: () => setStep('setup'),
    start: () => setStep('bridge'),
  }[step];

  return (
    <div className="ob" ref={obRef}>
      <AnimatePresence>
        {backFor && (
          <motion.button
            key="ob-back"
            className="ob-back"
            aria-label={i.t('ob.back')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            onClick={backFor}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </motion.button>
        )}
      </AnimatePresence>
      {flights.map((f) => (
        <motion.span
          key={f.id}
          className="ob-flight"
          aria-hidden="true"
          initial={{ x: f.x0, y: f.y0, scale: 1, opacity: 0.95 }}
          animate={{ x: f.x1, y: f.y1, scale: 0.35, opacity: 0.8 }}
          transition={{ duration: 0.5, ease: [0.3, 0, 0.35, 1] }}
          onAnimationComplete={() => setFlights((s) => s.filter((x) => x.id !== f.id))}
        />
      ))}

      {step === 'cover' && (
        <motion.div key="cover" className="ob-inner" variants={screen} initial="initial" animate="animate">
          <motion.div className="ob-mark" variants={item}><LogoMark size={38} strokeWidth={1.8} /></motion.div>
          <motion.span className="ob-word" variants={item}>
            موزون&thinsp;·&thinsp;mowzoon: <b>{i.t('ob.cover.meaning')}</b>
          </motion.span>
          <motion.h1 className="ob-title" variants={item}>{i.t('ob.cover.title')}</motion.h1>
          <motion.p className="ob-sub" variants={item}>{i.t('ob.cover.sub')}</motion.p>
          <motion.div className="ob-archrow" variants={item}>
            {Object.entries(ARCHETYPE_META).map(([id, m]) => (
              <span className="ob-archchip" key={id}>
                <i style={{ background: `color-mix(in srgb, ${m.tint} 16%, var(--surface))`, color: m.tint }}>
                  <Glyph id={m.glyph} size={12} strokeWidth={2.2} />
                </i>
                {i.arch(id).name.replace('The ', '')}
              </span>
            ))}
          </motion.div>
          <motion.div className="ob-cta" variants={item}>
            <motion.button className="btn-ink" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={gel} onClick={() => setStep('name')}>
              {i.t('ob.cover.start')}
            </motion.button>
            <button className="ob-ghost" onClick={onSkip}>{i.t('ob.cover.skip')}</button>
          </motion.div>
        </motion.div>
      )}

      {step === 'name' && (
        <motion.div key="name" className="ob-inner" variants={screen} initial="initial" animate="animate">
          <motion.h1 className="ob-title" variants={item}>{i.t('ob.name.title')}</motion.h1>
          <motion.p className="ob-sub" variants={item}>{i.t('ob.name.sub')}</motion.p>
          <motion.div className="ob-namefield" variants={item}>
            <input
              className="ob-nameinput"
              type="text"
              autoFocus
              maxLength={40}
              placeholder={i.t('ob.name.ph')}
              aria-label={i.t('ob.name.ph')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setStep('cal'); }}
            />
          </motion.div>
          <motion.div className="ob-colorrow" variants={item}>
            <p className="ob-lbl">{i.t('ob.name.color')}</p>
            <div className="pf-swatches ob-swatches">
              {ACCENTS.map((hex) => (
                <button
                  key={hex}
                  className={`pf-swatch ${accent === hex ? 'on' : ''}`}
                  style={{ background: hex }}
                  onClick={() => { setAccent(hex); setTint(hex); }}
                  aria-label={hex}
                  aria-pressed={accent === hex}
                />
              ))}
            </div>
          </motion.div>
          <motion.div className="ob-cta" variants={item}>
            <motion.button className="btn-ink" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={gel} onClick={() => setStep('cal')}>
              {i.t('ob.continue')}
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* Calibration */}
      {step === 'cal' && (
        <motion.div key="cal" className="ob-cal" variants={screen} initial="initial" animate="animate">
          {/* the orb doubles as the progress bar */}
          <motion.div className="ob-cal-top ob-cal-orb" variants={item}>
            <span className="ob-orb" ref={orbRef}>
              <LiquidOrb size={46} fill={q / SURVEY.length} />
            </span>
            <span className="ob-prog-num">{i.t('ob.cal.progress', { a: i.fmtNum(q + 1), b: i.fmtNum(SURVEY.length) })}</span>
          </motion.div>

          <motion.div key={q} className="glass ob-qcard" initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring}>
            <p className="ob-qkick">{arQ ? arQ[q].category : SURVEY[q].category}</p>
            <p className="ob-q">{arQ ? arQ[q].text : SURVEY[q].text}</p>
            <div className="ob-opts" role="group" aria-label={arQ ? arQ[q].text : SURVEY[q].text}>
              {SURVEY[q].options.map((opt, idx) => (
                <motion.button
                  key={idx}
                  className={`ob-opt ${picked === idx ? 'picked' : ''}`}
                  whileTap={{ scale: 0.985 }}
                  transition={gel}
                  onClick={(e) => pick(idx, e)}
                >
                  <span className="ob-opt-dot" />
                  {arQ ? arQ[q].options[idx] : opt.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {q > 0 && (
            <motion.div variants={item}>
              <ReadStrip metrics={liveMetrics} i={i} />
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Reveal */}
      {step === 'reveal' && (
        <motion.div key="reveal" className="ob-inner" variants={screen} initial="initial" animate="animate" aria-live="polite">
          {reading ? (
            <>
              <motion.div className="ob-arch-glyph" variants={item} animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
                <LogoMark size={40} strokeWidth={1.8} />
              </motion.div>
              <motion.p className="ob-arch-kick" variants={item}>{i.t('ob.cal.reading')}...</motion.p>
              <motion.div className="ob-mix" variants={item}>
                <ReadStrip metrics={metrics || liveMetrics} i={i} />
              </motion.div>
            </>
          ) : (
            <div className="ob-reveal">
              <motion.div className="ob-arch-glyph" initial={{ scale: 0.4, opacity: 0, filter: 'blur(8px)' }} animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                <Glyph id={revealMeta.glyph} size={44} strokeWidth={1.9} />
              </motion.div>
              <motion.p className="ob-arch-kick" variants={item} initial="initial" animate="animate">{i.t('ob.reveal.kicker')}</motion.p>
              <motion.h1 className="ob-arch-name" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}>{i.arch(revealId).name}</motion.h1>
              <motion.p className="ob-arch-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>{i.t(`ob.reveal.line.${revealId}`)}</motion.p>
              {showMix ? (
                <motion.div className="ob-mix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <MixBar probs={model.probs} />
                  <p className="ob-mix-label">{i.t('ob.reveal.mix')}</p>
                </motion.div>
              ) : (
                <p className="ob-offline">{i.t('ob.reveal.offline')}</p>
              )}
              {/* first payout */}
              <motion.div className="ob-rewards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.42 }}>
                <span className="ob-reward"><Glyph id="flame" size={13} strokeWidth={2.2} />{i.t('toast.drops', { n: i.fmtNum(DROPS.calibrate) })}</span>
                <span className="ob-reward"><Glyph id="sliders" size={13} strokeWidth={2.2} />{i.t('badge.calibrated')}</span>
                <span className="ob-reward"><Glyph id="spark" size={13} strokeWidth={2.2} />{i.t('ob.reveal.quest')}</span>
              </motion.div>
              <motion.div className="ob-cta" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <motion.button
                  className="btn-ink"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={gel}
                  onClick={() => (retake ? onDone({ answers, metrics }) : setStep('spikes'))}
                >
                  {i.t('ob.reveal.continue')}
                </motion.button>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}

      {/* Your calendar */}
      {step === 'spikes' && (
        <motion.div key="spikes" className="ob-inner" variants={screen} initial="initial" animate="animate">
          <motion.h1 className="ob-title" variants={item}>{i.t('ob.spikes.title')}</motion.h1>
          <motion.p className="ob-sub" variants={item}>{i.t('ob.spikes.sub')}</motion.p>
          <motion.div className="ob-spikes" variants={item}>
            {SPIKES.map((s) => (
              <button
                key={s.name}
                className={`ob-spike ${spikeOn[s.name] ? 'on' : ''}`}
                aria-pressed={!!spikeOn[s.name]}
                onClick={() => setSpikeOn((m) => ({ ...m, [s.name]: !m[s.name] }))}
              >
                <span className="ob-spike-ic"><Glyph id={s.glyph} size={16} strokeWidth={2} /></span>
                {i.spikeName(s.name)}
                <span className="ob-spike-dot" aria-hidden="true" />
              </button>
            ))}
          </motion.div>

          {/* your own dates: plans and subscriptions, same forms as the Ahead room */}
          <motion.div className="ob-ahead" variants={item}>
            <p className="ob-lbl">{i.t('ob.ahead.h')}</p>
            {(obPlans.length > 0 || obSubs.length > 0) && (
              <div className="ob-added">
                {obPlans.map((p, idx) => (
                  <div className="ob-added-row" key={`p${idx}`}>
                    <span className="ob-added-ic" style={{ background: 'color-mix(in srgb, #0fa38f 13%, var(--surface))', color: '#0fa38f' }}>
                      <Glyph id="peak" size={14} strokeWidth={2.2} />
                    </span>
                    <span className="ob-added-meta">
                      <b>{p.name}</b>
                      <em>{i.fmtMoney(p.target)} · {p.date}</em>
                    </span>
                    <button className="ob-added-x" aria-label={i.t('ahead.cancel')} onClick={() => setObPlans((s) => s.filter((_, j) => j !== idx))}>×</button>
                  </div>
                ))}
                {obSubs.map((s, idx) => (
                  <div className="ob-added-row" key={`s${idx}`}>
                    <span className="ob-added-ic" style={{ background: `color-mix(in srgb, ${TYPE_TINTS.fixed} 13%, var(--surface))`, color: TYPE_TINTS.fixed }}>
                      <Glyph id="calendar" size={14} strokeWidth={2.2} />
                    </span>
                    <span className="ob-added-meta">
                      <b>{s.name}</b>
                      <em>{i.fmtMoney(s.amount)} · {i.t('ahead.sub.due')} {i.fmtNum(s.dueDay)}</em>
                    </span>
                    <button className="ob-added-x" aria-label={i.t('ahead.cancel')} onClick={() => setObSubs((st) => st.filter((_, j) => j !== idx))}>×</button>
                  </div>
                ))}
              </div>
            )}
            {aheadAdding === null ? (
              <div className="add-rows">
                <button className="add-row" onClick={() => { setAf({ name: '', amount: '', date: '', due: '' }); setAheadAdding('plan'); }}>
                  <span className="add-row-ic" style={{ background: 'color-mix(in srgb, #0fa38f 13%, var(--surface))', color: '#0fa38f' }}>
                    <Glyph id="peak" size={18} strokeWidth={2} />
                  </span>
                  <span className="add-row-meta">
                    <b>{i.t('ahead.addplan')}</b>
                    <em>{i.t('ahead.addplan.cap')}</em>
                  </span>
                  <svg className="add-row-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                </button>
                <button className="add-row" onClick={() => { setAf({ name: '', amount: '', date: '', due: '' }); setAheadAdding('sub'); }}>
                  <span className="add-row-ic" style={{ background: `color-mix(in srgb, ${TYPE_TINTS.fixed} 13%, var(--surface))`, color: TYPE_TINTS.fixed }}>
                    <Glyph id="calendar" size={18} strokeWidth={2} />
                  </span>
                  <span className="add-row-meta">
                    <b>{i.t('ahead.addsub')}</b>
                    <em>{i.t('ahead.addsub.cap')}</em>
                  </span>
                  <svg className="add-row-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            ) : (
              <div className="add-form">
                <label className="lbl">{i.t(aheadAdding === 'plan' ? 'ahead.plan.name' : 'ahead.sub.name')}</label>
                <input className="af-input" autoFocus value={af.name} onChange={(e) => setAf({ ...af, name: e.target.value })} />
                <div className="af-row">
                  <div className="af-col">
                    <label className="lbl">{i.t(aheadAdding === 'plan' ? 'ahead.plan.target' : 'ahead.sub.amount')}</label>
                    <div className="af-amt">
                      <span>{i.lang === 'ar' ? 'ر.س' : 'SAR'}</span>
                      <input type="number" inputMode="numeric" min="0" placeholder="0" value={af.amount} onChange={(e) => setAf({ ...af, amount: e.target.value })} />
                    </div>
                  </div>
                  <div className="af-col">
                    <label className="lbl">{i.t(aheadAdding === 'plan' ? 'ahead.plan.date' : 'ahead.sub.due')}</label>
                    {aheadAdding === 'plan' ? (
                      <input className="af-date" type="date" min={todayISO()} value={af.date} onChange={(e) => setAf({ ...af, date: e.target.value })} />
                    ) : (
                      <input className="af-date" type="number" inputMode="numeric" min="1" max="31" placeholder="1-31" value={af.due} onChange={(e) => setAf({ ...af, due: e.target.value })} />
                    )}
                  </div>
                </div>
                {aheadAdding === 'plan' && af.amount && af.date && (
                  <p className="af-hint">{i.t('ahead.plan.hint', { a: i.fmtMoney(weeklyFor(Math.round(Number(af.amount)), af.date)) })}</p>
                )}
                <div className="af-actions">
                  <button className="af-cancel" onClick={() => setAheadAdding(null)}>{i.t('ahead.cancel')}</button>
                  <button
                    className="af-save"
                    disabled={!af.name.trim() || !Number(af.amount) || (aheadAdding === 'plan' && !af.date)}
                    onClick={saveAheadItem}
                  >
                    {i.t('ahead.save')}
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          <motion.div className="ob-cta" variants={item}>
            <motion.button className="btn-ink" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={gel} onClick={() => setStep('setup')}>
              {i.t('ob.continue')}
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* Setup */}
      {step === 'setup' && (
        <motion.div key="setup" className="ob-inner" variants={screen} initial="initial" animate="animate">
          <motion.h1 className="ob-title" variants={item}>{i.t('ob.setup.title')}</motion.h1>
          <motion.p className="ob-sub" variants={item}>{i.t('ob.setup.sub')}</motion.p>
          <motion.div className="ob-setup" variants={item}>
            <div>
              <label className="ob-lbl" htmlFor="ob-income">{i.t('ob.setup.income')}</label>
              <div className="ob-income">
                <span>{i.lang === 'ar' ? 'ر.س' : 'SAR'}</span>
                <input id="ob-income" type="number" inputMode="numeric" min="0" value={income} onChange={(e) => setIncome(e.target.value)} aria-label={i.t('ob.setup.income')} />
              </div>
            </div>
            <button className={`ob-toggle ${seed ? 'on' : ''}`} onClick={() => setSeed((s) => !s)} aria-pressed={seed}>
              <div className="ob-toggle-body">
                <div className="ob-toggle-title">{i.t('ob.setup.seed')}</div>
                <div className="ob-toggle-cap">{i.t('ob.setup.seedcap')}</div>
              </div>
              <span className={`ob-switch ${seed ? 'on' : ''}`}><i /></span>
            </button>
          </motion.div>
          <motion.div className="ob-cta" variants={item}>
            <motion.button className="btn-ink" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={gel} disabled={!Number(income)} onClick={() => setStep('bridge')}>
              {i.t('ob.continue')}
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* The alinma bridge: what being part of the bank means */}
      {step === 'bridge' && (
        <motion.div key="bridge" className="ob-inner" variants={screen} initial="initial" animate="animate">
          <motion.div className="ob-marks" variants={item} aria-hidden="true">
            <span className="ob-mark-chip ob-mark-alinma"><AlinmaMark size={26} /></span>
            <span className="ob-mark-link"><Glyph id="link" size={15} strokeWidth={2.2} /></span>
            <span className="ob-mark-chip"><LiquidMark size={26} /></span>
          </motion.div>
          <motion.h1 className="ob-title" variants={item}>{i.t('ob.bridge.title')}</motion.h1>
          <motion.p className="ob-sub" variants={item}>{i.t('ob.bridge.sub')}</motion.p>
          <motion.div className="ob-eco" variants={item}>
            {['live', 'agree', 'private'].map((k) => (
              <div className="ob-eco-row" key={k}>
                <span className="ob-eco-ic">
                  <Glyph id={{ live: 'bolt', agree: 'trend', private: 'shield' }[k]} size={16} strokeWidth={2} />
                </span>
                <span className="ob-eco-meta">
                  <b>{i.t(`ob.bridge.${k}`)}</b>
                  <em>{i.t(`ob.bridge.${k}.d`)}</em>
                </span>
              </div>
            ))}
          </motion.div>
          <motion.div className="ob-cta" variants={item}>
            <motion.button className="btn-ink" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={gel} onClick={() => setStep('start')}>
              {i.t('ob.continue')}
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* Where to begin: the bank, or straight to the coach */}
      {step === 'start' && (
        <motion.div key="start" className="ob-inner" variants={screen} initial="initial" animate="animate">
          <motion.h1 className="ob-title" variants={item}>{i.t('ob.start.title')}</motion.h1>
          <motion.p className="ob-sub" variants={item}>{i.t('ob.start.sub')}</motion.p>
          <motion.div className="ob-startcards" variants={item}>
            <motion.button className="ob-startcard ob-startcard-bank" whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={gel} onClick={() => finish('bank')}>
              <span className="ob-start-ic"><AlinmaMark size={30} /></span>
              <b>{i.t('ob.start.bank')}</b>
              <em>{i.t('ob.start.bank.d')}</em>
            </motion.button>
            <motion.button className="ob-startcard" whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={gel} onClick={() => finish('mz')}>
              <span className="ob-start-ic ob-start-ic-mz"><LiquidOrb size={34} fill={0.62} /></span>
              <b>{i.t('ob.start.mz')}</b>
              <em>{i.t('ob.start.mz.d')}</em>
            </motion.button>
          </motion.div>
          <motion.p className="ob-start-note" variants={item}>{i.t('ob.start.note')}</motion.p>
        </motion.div>
      )}
    </div>
  );
}
