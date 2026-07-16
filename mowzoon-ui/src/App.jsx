import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { determineArchetype, calculateLedgerMetrics } from './scoring';
import { ARCHETYPE_META, DEFAULT_TINT, METRIC_LABELS } from './data';
import { Seg, Glyph, LogoMark, LiquidMark, LiquidOrb, Meter, spring } from './ui';
import { classify, getPopulation, getEngineInsights } from './api';
import { DROPS, levelOf, issueQuest, questProgress, newlyEarned } from './game';
import { useAppState, thisMonthTx, todayISO, monthKey, sampleMonth, streakOf } from './store';
import { I18nProvider, i18nFor, useI18n, nudgeAr } from './i18n';
import Onboarding from './Onboarding';
import Home from './Home';
import Ledger from './Ledger';
import Horizon from './Horizon';
import Arena from './Arena';
import ProfileSheet from './ProfileSheet';
import { consumeAddParamFromUrl } from './arena/friends';
import { useOverlayScrollbar } from './Scrollbar';
import previewImg from './assets/glass-preview.jpg';
import './index.css';

function GlassSettings({ t, setT, onClose, onLoadSample, onReset, hasDemo, onClearDemo, hiddenSpikes, onRestoreSpikes, theme, setTheme, lang, setLang, anchor }) {
  const i = useI18n();
  const scrollRef = useRef(null);
  const barRef = useRef(null);
  const thumbRef = useRef(null);
  useOverlayScrollbar(barRef, thumbRef, scrollRef);
  return (
    <>
      <div className="pop-backdrop" onClick={onClose} />
      <motion.div
        className="glass settings-pop"
        style={anchor ?? undefined}
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.15 } }}
        transition={spring}
      >
        <div className="settings-pop-scroll" ref={scrollRef}>
        <p className="pop-title">
          {i.t('settings.glass')}
          <button className="pop-reset" onClick={() => setT(0.5)}>{i.t('settings.default')}</button>
        </p>

        <div className="pv">
          <img src={previewImg} alt="" />
          <div className="pv-ui">
            <span className="glass pv-btn">
              <Glyph id="sliders" size={15} strokeWidth={2} />
            </span>
            <span className="glass pv-search">
              <Glyph id="search" size={15} strokeWidth={2} />
              {i.t('settings.search')}
            </span>
          </div>
        </div>

        <div className="lg-pill">
          <button className="lg-end" aria-label="Clear" onClick={() => setT(0)}>
            <Glyph id="layers" size={15} strokeWidth={2} />
          </button>
          <input
            className="lg-range"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={t}
            aria-label="Glass appearance"
            style={{ '--p': `${t * 100}%` }}
            onChange={(e) => setT(Number(e.target.value))}
          />
          <button className="lg-end" aria-label="Tinted" onClick={() => setT(1)}>
            <Glyph id="layersFill" size={15} strokeWidth={2} />
          </button>
        </div>

        <p className="lg-cap">{i.t('settings.glass.cap')}</p>

        <p className="pop-title pop-title-gap">{i.t('settings.appearance')}</p>
        <Seg
          options={[
            { id: 'auto', label: i.t('settings.auto') },
            { id: 'light', label: i.t('settings.light') },
            { id: 'dark', label: i.t('settings.dark') },
          ]}
          value={theme}
          onChange={setTheme}
        />

        <p className="pop-title pop-title-gap">{i.t('settings.language')}</p>
        <Seg
          options={[
            { id: 'en', label: 'English' },
            { id: 'ar', label: 'العربية' },
          ]}
          value={lang}
          onChange={setLang}
        />

        <p className="pop-title pop-title-gap">{i.t('settings.data')}</p>
        <div className="data-actions">
          {hasDemo ? (
            <button className="data-btn" onClick={onClearDemo}>{i.t('settings.removeSample')}</button>
          ) : (
            <button className="data-btn" onClick={onLoadSample}>{i.t('settings.loadSample')}</button>
          )}
          {hiddenSpikes > 0 && (
            <button className="data-btn" onClick={onRestoreSpikes}>{i.t('settings.restoreSpikes', { n: i.fmtNum(hiddenSpikes) })}</button>
          )}
          <button className="data-btn danger" onClick={onReset}>{i.t('settings.reset')}</button>
        </div>
        <p className="lg-cap">{i.t('settings.data.cap')}</p>
        </div>
        <div ref={barRef} className="page-sb is-inner" aria-hidden="true">
          <div ref={thumbRef} className="page-sb-thumb" />
        </div>
      </motion.div>
    </>
  );
}

function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <i className="a1" /><i className="a2" /><i className="a3" /><i className="a4" />
    </div>
  );
}

function WelcomeCoach({ app, profile, lvl, onClose }) {
  const i = useI18n();
  const { accent, pname } = avatarOf(app, profile);
  const nm = pname ? (i.lang === 'ar' ? ` يا ${pname}` : `, ${pname}`) : '';
  const ROWS = [
    { glyph: 'spark', k: 'welcome.quest' },
    { glyph: 'layersFill', k: 'welcome.orb', orb: true },
    { glyph: 'flame', k: 'welcome.streak' },
  ];
  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="wc-card"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.16 } }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <span className="wc-orb"><LiquidOrb size={64} fill={lvl.pct} tint={accent || 'var(--tint)'} /></span>
        <h2 className="wc-title">{i.t('welcome.title', { name: nm })}</h2>
        <p className="wc-sub">{i.t('welcome.sub')}</p>
        <div className="wc-rows">
          {ROWS.map((r, idx) => (
            <motion.div
              className="wc-row"
              key={r.k}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.25 + idx * 0.12 }}
            >
              <span className="wc-ic">
                {r.orb ? <LiquidOrb size={22} fill={0.55} tint={accent || 'var(--tint)'} /> : <Glyph id={r.glyph} size={17} strokeWidth={2} />}
              </span>
              <span className="wc-meta">
                <b>{i.t(r.k)}</b>
                <em>{i.t(`${r.k}.d`)}</em>
              </span>
            </motion.div>
          ))}
        </div>
        <motion.button
          className="btn-ink wc-cta"
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
        >
          {i.t('welcome.cta')}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function Toast({ t, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 4600);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <motion.div
      className="toast"
      layout
      initial={{ opacity: 0, y: -22, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.94, transition: { duration: 0.18 } }}
      transition={spring}
    >
      <span className="toast-ic"><Glyph id={t.glyph} size={15} strokeWidth={2.2} /></span>
      <span className="toast-txt">{t.text}</span>
    </motion.div>
  );
}

function avatarOf(app, profile) {
  const id = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const meta = id != null ? ARCHETYPE_META[id] : null;
  const pa = app.profile ?? {};
  const pname = (pa.name || '').trim();
  return {
    meta,
    accent: pa.accent || meta?.tint,
    photo: pa.avatar?.kind === 'photo' ? pa.avatar.photo : null,
    pname,
    initials: pname.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
  };
}

function AvatarCircle({ app, profile, className, glyphSize = 16, markSize = 18 }) {
  const { meta, accent, photo, initials } = avatarOf(app, profile);
  return (
    <span className={className} style={accent ? { '--ar': accent } : undefined}>
      {photo ? <img src={photo} alt="" /> : initials ? <b>{initials}</b> : meta ? <Glyph id={meta.glyph} size={glyphSize} strokeWidth={2} /> : <LiquidMark size={markSize} />}
    </span>
  );
}

// module-level on purpose: an inline component type remounts every render
// and the layoutId pill snaps to its first position instead of sliding
function SrcRow({ v, view, setView, glyph, label }) {
  return (
    <button className={`src-row ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
      {view === v && <motion.span layoutId="src-pill" className="src-pill" transition={spring} aria-hidden="true" />}
      <Glyph id={glyph} size={18} strokeWidth={2} />
      <span className="src-label">{label}</span>
    </button>
  );
}

function Sidebar({ view, setView, i, app, profile, profileOpen, settingsBtnRef, onSettings, onProfile }) {
  const { pname } = avatarOf(app, profile);
  return (
    <aside className="sidebar">
      <button className="sidebar-brand" onClick={() => setView('home')}>
        <LogoMark size={21} strokeWidth={2} />
        <span>{i.lang === 'ar' ? 'موزون' : 'Mowzoon'}</span>
      </button>
      <nav className="source-list">
        <SrcRow v="home" view={view} setView={setView} glyph="home" label={i.t('nav.home')} />
        <SrcRow v="ahead" view={view} setView={setView} glyph="calendar" label={i.t('nav.ahead')} />
        <SrcRow v="spending" view={view} setView={setView} glyph="cart" label={i.t('nav.spending')} />
        <SrcRow v="arena" view={view} setView={setView} glyph="swords" label={i.t('nav.arena')} />
      </nav>
      <div className="sidebar-foot">
        <button
          className={`avatar-btn ${profileOpen ? 'on' : ''}`}
          onClick={onProfile}
          aria-label={i.t('nav.profile')}
        >
          <AvatarCircle className="avatar-circle" app={app} profile={profile} />
          <span className="avatar-name">{pname}</span>
        </button>
        <button ref={settingsBtnRef} className="foot-gear" aria-label="Settings" onClick={onSettings}>
          <Glyph id="sliders" size={17} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}

// module-level for the same reason as SrcRow
function TabItem({ v, view, setView, glyph, label }) {
  return (
    <button className={`tab ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
      {view === v && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring} aria-hidden="true" />}
      <Glyph id={glyph} size={21} strokeWidth={2} />
      <span className="tab-label">{label}</span>
    </button>
  );
}

// phone tab bar, shown under 720px
function TabBar({ view, setView, i, app, profile, profileOpen, onProfile }) {
  return (
    <nav className="tabbar" aria-label="Primary">
      <TabItem v="home" view={view} setView={setView} glyph="home" label={i.t('nav.home')} />
      <TabItem v="ahead" view={view} setView={setView} glyph="calendar" label={i.t('nav.ahead')} />
      <TabItem v="spending" view={view} setView={setView} glyph="cart" label={i.t('nav.spending')} />
      <TabItem v="arena" view={view} setView={setView} glyph="swords" label={i.t('nav.arena')} />
      <button className={`tab tab-you ${profileOpen ? 'on' : ''}`} onClick={onProfile}>
        <AvatarCircle className="avatar-circle tab-avatar" app={app} profile={profile} glyphSize={13} markSize={15} />
        <span className="tab-label">{i.t('nav.profile')}</span>
      </button>
    </nav>
  );
}

// mini population map; renders every second dot to keep the always-mounted SVG light
function RailMap({ profile, onOpen }) {
  const i = useI18n();
  const [pop, setPop] = useState(null);
  useEffect(() => {
    let alive = true;
    getPopulation().then((d) => alive && setPop(d));
    return () => { alive = false; };
  }, []);
  const you = profile?.model?.point ?? null;
  if (!pop || !you) return null;
  const id = profile.model?.id ?? profile.archetype.id;
  const tint = ARCHETYPE_META[id].tint;
  const W = 288;
  const H = 124;
  const PAD = 10;
  const x = (v) => PAD + (v / 100) * (W - PAD * 2);
  const y = (v) => H - PAD - (v / 100) * (H - PAD * 2);
  return (
    <button className="rail-map" onClick={onOpen}>
      <span className="rail-map-plot" dir="ltr" aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`}>
          {pop.points.filter((_, idx) => idx % 2 === 0).map((p, idx) => (
            <circle key={idx} cx={x(p.e)} cy={y(p.r)} r="1.7" fill={ARCHETYPE_META[p.a].tint} fillOpacity="0.35" />
          ))}
          <circle cx={x(you.e)} cy={y(you.r)} r="8" fill={tint} fillOpacity="0.22" />
          <circle cx={x(you.e)} cy={y(you.r)} r="4.5" fill={tint} stroke="var(--surface)" strokeWidth="2" />
        </svg>
      </span>
      <span className="rail-map-cap">{i.t('results.pop.title', { n: i.fmtNum(pop.total) })}</span>
    </button>
  );
}

function CoachRail({ profile, app, lvl, questProg, onOpenMap, onOpenProgress, onQuest, onOpenRead }) {
  const i = useI18n();
  const title = i.lang === 'ar' ? 'قراءتك' : 'Your read';
  const live = i.lang === 'ar' ? 'مباشر' : 'live';
  if (!profile) {
    return (
      <aside className="rail">
        <div className="rail-head">
          <span className="rail-mk"><LiquidMark size={22} /></span>
          <span className="rail-title">{title}</span>
          <span className="rail-live">{live}</span>
        </div>
        <div className="rail-empty">
          <span className="rail-empty-mk"><LiquidMark size={42} /></span>
          <h4>{i.t('home.empty.title')}</h4>
          <p>{i.t('home.empty.body')}</p>
        </div>
      </aside>
    );
  }
  const id = profile.model?.id ?? profile.archetype.id;
  const meta = ARCHETYPE_META[id];
  const voice = i.arch(id);
  const confidence = profile.model ? Math.round(profile.model.probs[profile.model.id] * 100) : null;
  // Rail read: the engine's ranked insights when it has answered for this
  // archetype, localized from each insight's signal. The top insight is the
  // headline; the rest stack below. Falls back to the legacy nudge, then the
  // archetype description, exactly as before when the engine is quiet.
  const nd = app.nudge && app.nudge.archetypeId === id ? app.nudge : null;
  const visSpike = (nd?.spikes || []).filter((s) => !(app.spikeHidden || []).includes(s.name))[0];
  const eng = app.insights && app.insights.aid === id ? app.insights : null;
  const engList = eng?.list || [];
  const headline = engList.length ? i.insight(engList[0].insight_key, engList[0].signal) : null;
  const restInsights = engList.slice(1);
  const note = headline
    || (i.lang === 'ar'
      ? (nd ? nudgeAr(id, profile.metrics, visSpike, i.fmtNum, i.fmtDays) : voice.desc)
      : (nd?.text || voice.desc));
  const dotColor = (ins) =>
    ins.kind === 'praise'
      ? 'var(--pos)'
      : ins.signal?.band === 'high' || ins.signal?.band === 'elevated'
        ? 'var(--neg)'
        : meta.tint;
  return (
    <aside className="rail">
      <div className="rail-head">
        <span className="rail-mk"><LiquidMark size={22} /></span>
        <span className="rail-title">{title}</span>
        <span className="rail-live">{live}</span>
      </div>
      <div className="rail-verdict">
        <span className="rail-glyph"><Glyph id={meta.glyph} size={32} strokeWidth={2} /></span>
        <AnimatePresence mode="wait">
          <motion.h2
            key={id}
            className="rail-name"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={spring}
          >
            {voice.name}
          </motion.h2>
        </AnimatePresence>
        <p className="rail-tag">{voice.tagline}</p>
      </div>

      {profile.model ? (
        <div className="conf">
          <div className="conf-bar">
            {profile.model.probs.map((p, idx) => (
              <span key={idx} style={{ width: `${p * 100}%`, background: ARCHETYPE_META[idx].tint }} />
            ))}
          </div>
          <p className="rail-conf-cap">
            {i.t('ledger.conf', {
              p: i.fmtPct(confidence),
              src: i.t(profile.source === 'ledger' ? 'ledger.src.ledger' : 'ledger.src.survey'),
              n: i.fmtNum(profile.model.population),
            })}
          </p>
        </div>
      ) : profile.asked ? (
        <p className="rail-offline">{i.t('ledger.offline')}</p>
      ) : null}

      <div className="meters">
        {METRIC_LABELS.map(([key]) => (
          <Meter key={key} label={i.t(`metric.${key}`)} value={profile.metrics[key]} />
        ))}
      </div>

      <div className="rail-note">{note}</div>

      {/* the rest of the engine's ranked read; risks first, praise last */}
      {restInsights.length > 0 && (
        <div className="rail-insights">
          <span className="rail-insights-h">{i.t('insight.more')}</span>
          {restInsights.map((ins) => (
            <div key={ins.insight_key} className="rail-insight">
              <span className="ri-dot" style={{ background: dotColor(ins) }} />
              <p>{i.insight(ins.insight_key, ins.signal)}</p>
            </div>
          ))}
        </div>
      )}

      {/* opens the full "read in numbers" panel, like the map opens the full map */}
      {eng && (eng.signals || []).length > 0 && (
        <button className="rail-read" onClick={onOpenRead}>
          <Glyph id="trend" size={15} strokeWidth={2.2} />
          <span>{i.lang === 'ar' ? 'قراءتك بالأرقام' : 'Your read in numbers'}</span>
          <svg className="rr-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* quest summary; details and Collect live on Home */}
      {questProg && app.game?.quest && (
        <button className="rail-quest" onClick={onQuest}>
          <div className="rq-top">
            <span className="rq-title">{i.t('quest.title')}</span>
            <span className="rq-amt">{i.t('toast.drops', { n: i.fmtNum(DROPS.quest) })}</span>
          </div>
          <div className="quest-track rq-track">
            <i style={{ width: `${Math.round(questProg.pct * 100)}%`, background: meta.tint }} />
          </div>
        </button>
      )}

      <button className="rail-game" onClick={onOpenProgress}>
        <LiquidOrb size={34} fill={lvl.pct} />
        <span className="rg-meta">
          <b>{i.t(`game.lv.${lvl.n}`)}</b>
          <em>{i.t('progress.drops', { n: i.fmtNum(app.game?.drops ?? 0) })}</em>
        </span>
        <span className="rg-streak">
          <Glyph id="flame" size={14} strokeWidth={2.2} />
          {i.fmtNum(Math.max(1, streakOf(app.visits)))}
        </span>
      </button>

      <RailMap profile={profile} onOpen={onOpenMap} />
    </aside>
  );
}

export default function App() {
  const [app, setApp] = useAppState();

  const hasData = !!(app.survey || app.tx.length);
  // 'home' | 'ahead' | 'spending' | 'arena' — ?view= deep-links a tab
  const [view, setView] = useState(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('view');
      return ['home', 'ahead', 'spending', 'arena'].includes(v) ? v : 'home';
    } catch {
      return 'home';
    }
  });
  // a retake reuses the onboarding survey UI
  const [retaking, setRetaking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // which panel the profile sheet opens on
  const [profilePanel, setProfilePanel] = useState('root');
  const openProfile = (panel = 'root') => {
    setProfilePanel(panel);
    setProfileOpen(true);
  };
  const [obTint, setObTint] = useState(DEFAULT_TINT); // accent while onboarding is on screen
  // the settings popover renders outside the nav (see below), so it's
  // positioned against the trigger button's viewport rect
  const settingsBtnRef = useRef(null);
  const contentRef = useRef(null);
  const [anchor, setAnchor] = useState(null);
  const [glassT, setGlassT] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('mz-glass') || '{}');
      return typeof s.t === 'number' ? s.t : 0.5;
    } catch {
      return 0.5;
    }
  });

  // Set lang/dir in a layout effect declared before the anchor effect below,
  // so <html dir> is already flipped when the settings button gets measured.
  // As a plain effect it lagged a frame on language switch.
  const i = i18nFor(app.lang);
  useLayoutEffect(() => {
    document.documentElement.lang = app.lang;
    document.documentElement.dir = i.dir;
    document.title = i.t('app.title');
  }, [app.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // anchor the popover to the settings button while open; side-aware for RTL
  useLayoutEffect(() => {
    if (!settingsOpen) return undefined;
    const POPW = 274;
    const MARGIN = 12;
    const place = () => {
      const btn = settingsBtnRef.current;
      // gear hidden (phone layout): no anchor, CSS docks it as a bottom sheet
      if (!btn || !btn.offsetParent) {
        setAnchor(null);
        return;
      }
      const r = btn.getBoundingClientRect();
      const rtl = i.dir === 'rtl';
      let left = rtl ? r.right - POPW : r.left;
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - POPW - MARGIN));
      // open upward from the sidebar footer so the tall popover stays on screen
      setAnchor({ bottom: Math.round(window.innerHeight - r.top + 8), left: Math.round(left) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [settingsOpen, app.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem('mz-glass', JSON.stringify({ t: glassT }));
  }, [glassT]);

  // Appearance: auto follows the system setting
  const [sysDark, setSysDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSysDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const dark = app.theme === 'dark' || (app.theme === 'auto' && sysDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#0c0c0f' : '#eef0f4');
  }, [dark]);

  // Ledger metrics take over from the survey once the month has enough
  // entries (3+); until then the assessment is the baseline.
  const monthTx = useMemo(() => thisMonthTx(app.tx), [app.tx]);
  // demo transactions never feed the classification
  const realMonthTx = useMemo(() => monthTx.filter((t) => !t.demo), [monthTx]);
  const ledgerMetrics = useMemo(
    () => (realMonthTx.length >= 3 ? calculateLedgerMetrics(Math.max(app.income, 1), realMonthTx) : null),
    [app.income, realMonthTx],
  );
  const activeMetrics = ledgerMetrics ?? app.survey?.metrics ?? null;
  const source = ledgerMetrics ? 'ledger' : app.survey ? 'survey' : null;

  const [model, setModel] = useState(null);
  const [asked, setAsked] = useState(false);
  const reqRef = useRef(0);
  const metricsKey = activeMetrics
    ? `${activeMetrics.efficiency}|${activeMetrics.resilience}|${activeMetrics.eq}`
    : null;
  useEffect(() => {
    if (!activeMetrics) {
      setModel(null);
      return undefined;
    }
    const req = ++reqRef.current;
    let timer;
    // retry with backoff (the server may still be starting), then show
    // the offline pill instead of failing silently
    const attempt = (delay, tries) => {
      timer = setTimeout(async () => {
        const res = await classify(activeMetrics);
        if (reqRef.current !== req) return; // superseded
        if (res) {
          setModel(res);
          setAsked(true);
        } else if (tries < 6) {
          setAsked(true);
          attempt(Math.min(delay * 3, 12000), tries + 1);
        } else {
          setAsked(true);
        }
      }, delay);
    };
    attempt(400, 0);
    return () => clearTimeout(timer);
  }, [metricsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const profile = activeMetrics
    ? { metrics: activeMetrics, archetype: determineArchetype(activeMetrics), model, source, asked }
    : null;

  // tint follows the active archetype
  const profileId = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const tint = profileId != null ? ARCHETYPE_META[profileId].tint : DEFAULT_TINT;

  // Game loop: payouts and quest issuing
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const toast = (glyph, text) => {
    const id = ++toastId.current;
    setToasts((s) => [...s.slice(-2), { id, glyph, text }]);
  };
  const gm = app.game;
  const lvl = levelOf(gm.drops);
  const today = todayISO();

  // First open of the day pays out. Award effects double-fire under
  // StrictMode, so re-check inside the functional update and keep a ref
  // so the toast only fires once.
  const dailyRef = useRef(null);
  useEffect(() => {
    if (gm.lastDaily === today || dailyRef.current === today) return;
    dailyRef.current = today;
    setApp((s) =>
      s.game.lastDaily === today
        ? s
        : { ...s, game: { ...s.game, drops: s.game.drops + DROPS.daily, lastDaily: today } },
    );
    toast('flame', i.t('toast.drops', { n: i.fmtNum(DROPS.daily) }));
  }, [gm.lastDaily, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // award new badges once
  const toastedBadges = useRef(new Set());
  useEffect(() => {
    const fresh = newlyEarned(app);
    if (!fresh.length) return;
    setApp((s) => {
      const news = fresh.filter((b) => !s.game.badges[b.id]);
      if (!news.length) return s;
      const badges = { ...s.game.badges };
      for (const b of news) badges[b.id] = today;
      return { ...s, game: { ...s.game, badges, drops: s.game.drops + DROPS.badge * news.length } };
    });
    for (const b of fresh) {
      if (toastedBadges.current.has(b.id)) continue;
      toastedBadges.current.add(b.id);
      toast(b.glyph, i.t('toast.badge', { name: i.t(`badge.${b.id}`) }));
    }
  }, [app]); // eslint-disable-line react-hooks/exhaustive-deps

  // arriving on a friend's share link (?add=CODE) follows them once, then
  // lands on the arena. Ref-guarded: StrictMode double-fires effects.
  const addedRef = useRef(false);
  useEffect(() => {
    if (addedRef.current) return;
    addedRef.current = true;
    consumeAddParamFromUrl(app, setApp).then((res) => {
      if (!res) return;
      toast('people', i.t('arena.add.toast', { name: res.name }));
      setView('arena');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // toast only when the level actually increases
  const prevLvl = useRef(lvl.n);
  useEffect(() => {
    if (lvl.n > prevLvl.current) toast('trend', i.t('toast.level', { lv: i.t(`game.lv.${lvl.n}`) }));
    prevLvl.current = lvl.n;
  }, [lvl.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Engine read (POST /insights): feeds the rail's insights and the coach's-
  // focus panel on Home. Refetched (debounced) whenever the ledger moves so
  // the read stays live; cached in app.insights. Display-only, so a mid-day
  // change is harmless — the reward quest above owns its own lifecycle.
  const ledgerSig = useMemo(() => {
    let n = 0;
    let sum = 0;
    let last = '';
    for (const t of app.tx) {
      n += 1;
      sum += t.amount;
      if (t.date > last) last = t.date;
    }
    return `${n}|${sum}|${last}|${app.income}`;
  }, [app.tx, app.income]);

  useEffect(() => {
    if (profileId == null || !profile) return undefined;
    const cur = app.insights;
    if (cur && cur.day === today && cur.aid === profileId && cur.sig === ledgerSig) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      const ledger = app.tx.map((t) => ({ type: t.type, amount: t.amount, date: t.date }));
      // same income basis as the Ledger month view, so percentages agree
      const engIncome = app.incomeByMonth?.[monthKey(today)] ?? app.income;
      getEngineInsights(profileId, engIncome, ledger, profile.metrics, today).then((d) => {
        if (!alive || !d) return;
        setApp((s) => ({
          ...s,
          insights: {
            day: today,
            aid: profileId,
            sig: ledgerSig,
            nudge: d.nudge,
            list: d.insights || [],
            quest: d.quest || null,
            signals: d.signals || [],
          },
        }));
      });
    }, 900);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [profileId, today, ledgerSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // issue a quest; reissue when the archetype changes or the week runs out
  useEffect(() => {
    if (profileId == null) return;
    const q = gm.quest;
    const expired = q && !q.done && (Date.parse(today) - Date.parse(q.startedISO)) / 86400000 >= 7;
    if (!q || q.aid !== profileId || expired) {
      setApp((s) => ({ ...s, game: { ...s.game, quest: issueQuest(profileId, today) } }));
    }
  }, [profileId, gm.quest, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const collectQuest = () => {
    const q = gm.quest;
    if (!q) return;
    // next quest starts tomorrow, otherwise today's logs would complete
    // the reissued quest instantly and drops become farmable
    const nxt = new Date();
    nxt.setDate(nxt.getDate() + 1);
    const tomorrow = `${nxt.getFullYear()}-${String(nxt.getMonth() + 1).padStart(2, '0')}-${String(nxt.getDate()).padStart(2, '0')}`;
    setApp((s) => {
      // a double tap must not pay twice
      if (s.game.quest !== q) return s;
      return {
        ...s,
        game: {
          ...s.game,
          drops: s.game.drops + DROPS.quest,
          questsDone: (s.game.questsDone || 0) + 1,
          quest: issueQuest(profileId ?? q.aid, tomorrow),
        },
      };
    });
    toast('spark', `${i.t('toast.quest')} · ${i.t('toast.drops', { n: i.fmtNum(DROPS.quest) })}`);
  };

  // glass material values derived from the Clear/Tinted dial
  const ga = 0.04 + glassT * 0.6;
  const gb = Math.round(glassT * 40 * 10) / 10;
  const disp = glassT < 0.35 ? Math.round(((0.35 - glassT) / 0.35) * 70) : 0;

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [view]);

  const begin = () => setRetaking(true);
  const finishRetake = ({ answers, metrics }) => {
    if (metrics) {
      setApp((s) => ({
        ...s,
        survey: { metrics, answers, date: todayISO() },
        game: { ...s.game, drops: s.game.drops + DROPS.calibrate },
      }));
      toast('sliders', i.t('toast.drops', { n: i.fmtNum(DROPS.calibrate) }));
    }
    setRetaking(false);
    setView('home');
  };

  const hasDemo = app.tx.some((t) => t.demo);
  const loadSample = () => {
    setApp((s) => {
      const fresh = sampleMonth().map((t, idx) => ({
        ...t,
        desc: i.desc(t.desc),
        id: s.nextId + idx,
      }));
      return { ...s, tx: [...fresh, ...s.tx], nextId: s.nextId + fresh.length };
    });
    setSettingsOpen(false);
    setView('spending');
  };
  const clearDemo = () => setApp((s) => ({ ...s, tx: s.tx.filter((t) => !t.demo) }));
  const resetApp = () => {
    localStorage.removeItem('mz-app-v1');
    window.location.reload();
  };

  // finish or skip onboarding
  const finishOnboarding = ({ name, accent, answers, metrics, income, seed, spikeHidden }) => {
    const day = todayISO();
    const mk = monthKey(day);
    const inc = income || app.income;
    setApp((s) => {
      const seedTx = seed
        ? sampleMonth().map((t, idx) => ({ ...t, desc: i.desc(t.desc), id: s.nextId + idx }))
        : [];
      return {
        ...s,
        profile: { ...s.profile, name: (name || '').trim(), accent: accent || s.profile.accent },
        survey: metrics ? { metrics, answers, date: day } : s.survey,
        income: inc,
        incomeByMonth: { ...s.incomeByMonth, [mk]: inc },
        tx: [...seedTx, ...s.tx],
        nextId: s.nextId + seedTx.length,
        spikeHidden: spikeHidden ?? s.spikeHidden,
        onboarded: true,
        // pay the calibration drops promised on the reveal step
        game: metrics ? { ...s.game, drops: s.game.drops + DROPS.calibrate } : s.game,
      };
    });
    setView('home');
  };
  const skipOnboarding = () => {
    setApp((s) => ({ ...s, onboarded: true }));
    setView('home');
  };

  // first runs and retakes render the onboarding flow outside the app shell
  if (!(app.onboarded || hasData) || retaking) {
    return (
      <I18nProvider value={app.lang}>
        <MotionConfig reducedMotion="user">
          <div className="app macos ob-app" style={{ '--tint': obTint, '--ga': ga, '--gb': `${gb}px`, '--gs': 1.85 }}>
            <Aurora />
            {retaking ? (
              <Onboarding mode="retake" onDone={finishRetake} onSkip={() => setRetaking(false)} setTint={setObTint} />
            ) : (
              <Onboarding onDone={finishOnboarding} onSkip={skipOnboarding} setTint={setObTint} />
            )}
          </div>
        </MotionConfig>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider value={app.lang}>
    <MotionConfig reducedMotion="user">
      <div
        className={disp > 0 ? 'app macos lensing' : 'app macos'}
        style={{
          '--tint': tint,
          '--ga': ga,
          '--gb': `${gb}px`,
          '--gs': 1.85,
        }}
      >
        {/* backdrop displacement filter for the glass lensing effect */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <filter id="mz-liquid" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="1" seed="7" result="n" />
            <feGaussianBlur in="n" stdDeviation="1.6" result="nb" />
            <feDisplacementMap in="SourceGraphic" in2="nb" scale={disp} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <Aurora />

        {/* toast queue */}
        <div className="toasts">
          <AnimatePresence>
            {toasts.map((t) => (
              <Toast key={t.id} t={t} onDone={() => setToasts((s) => s.filter((x) => x.id !== t.id))} />
            ))}
          </AnimatePresence>
        </div>

        {/* sidebar stays mounted so the pill animation never resets */}
        <Sidebar
          view={view}
          setView={setView}
          i={i}
          app={app}
          profile={profile}
          profileOpen={profileOpen}
          settingsBtnRef={settingsBtnRef}
          onSettings={() => setSettingsOpen((o) => !o)}
          onProfile={() => openProfile()}
        />

        {/* Rendered outside the nav: the nav's backdrop-filter is a backdrop
            root, so a popover extending past it can't sample the page behind
            it. As a child of .app it still inherits the glass variables. */}
        <AnimatePresence>
          {settingsOpen && (
            <GlassSettings
              t={glassT}
              setT={setGlassT}
              anchor={anchor}
              onClose={() => setSettingsOpen(false)}
              onLoadSample={loadSample}
              onClearDemo={clearDemo}
              onReset={resetApp}
              hasDemo={hasDemo}
              hiddenSpikes={(app.spikeHidden || []).length}
              onRestoreSpikes={() => setApp((s) => ({ ...s, spikeHidden: [] }))}
              theme={app.theme}
              setTheme={(v) => setApp((s) => ({ ...s, theme: v }))}
              lang={app.lang}
              setLang={(v) => setApp((s) => ({ ...s, lang: v }))}
            />
          )}
        </AnimatePresence>

        {/* one-time welcome card */}
        <AnimatePresence>
          {profile && !gm.flags?.welcomed && (
            <WelcomeCoach
              app={app}
              profile={profile}
              lvl={lvl}
              onClose={() => setApp((s) => ({ ...s, game: { ...s.game, flags: { ...s.game.flags, welcomed: true } } }))}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {profileOpen && (
            <ProfileSheet
              app={app}
              setApp={setApp}
              profile={profile}
              source={source}
              initialPanel={profilePanel}
              onClose={() => setProfileOpen(false)}
              onRetake={begin}
              onSettings={() => {
                setProfileOpen(false);
                setSettingsOpen(true);
              }}
            />
          )}
        </AnimatePresence>

        <TabBar
          view={view}
          setView={setView}
          i={i}
          app={app}
          profile={profile}
          profileOpen={profileOpen}
          onProfile={() => openProfile()}
        />

        <main className="content" ref={contentRef}>
          <div className="content-inner">
          <AnimatePresence mode="wait">
            {view === 'home' ? (
              <Home
                key="home"
                profile={profile}
                app={app}
                setApp={setApp}
                monthTx={monthTx}
                level={lvl}
                questProg={questProgress(app, gm.quest)}
                onCollect={collectQuest}
                onLedger={() => setView('spending')}
                onJourney={begin}
                onAhead={() => setView('ahead')}
                onProfile={openProfile}
              />
            ) : view === 'spending' ? (
              <Ledger
                key="ledger"
                app={app}
                setApp={setApp}
                monthTx={monthTx}
                profile={profile}
                onLoadSample={loadSample}
              />
            ) : view === 'arena' ? (
              <Arena
                key="arena"
                profile={profile}
                app={app}
                setApp={setApp}
                lvl={lvl}
                toast={toast}
                onCalibrate={begin}
              />
            ) : (
              <Horizon key="ahead" profile={profile} app={app} setApp={setApp} />
            )}
          </AnimatePresence>
          </div>
        </main>

        <CoachRail
          profile={profile}
          app={app}
          lvl={lvl}
          questProg={questProgress(app, gm.quest)}
          onOpenMap={() => openProfile('population')}
          onOpenProgress={() => openProfile('progress')}
          onOpenRead={() => openProfile('signals')}
          onQuest={() => setView('home')}
        />
      </div>
    </MotionConfig>
    </I18nProvider>
  );
}
