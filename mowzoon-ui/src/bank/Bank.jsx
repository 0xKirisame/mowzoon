// The Alinma app shell. Desktop is designed up from the mobile app's design
// language (navy, peach, big rounded cards) rather than the legacy web
// portal: sidebar + content grid on wide screens, the app's own 5-tab bar
// on phones. Mowzoon is woven in as a first-class service; every payment
// made here lands in the shared ledger the coach reads.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ARCHETYPE_META, METRIC_LABELS } from '../data';
import { Glyph, LiquidMark, NumberFlow, screen, item, spring } from '../ui';
import { useI18n } from '../i18n';
import { todayISO } from '../store';
import { AlinmaLogo, BIcon, Riyal } from './inma';
import { currentBalance, savingsBalance, insightDelta, fmtIban, IBAN } from './bankData';
import {
  TransferView, PaymentsView, StoreView, ServicesView,
  ActivityCard, BankSheet, NotifPop, CardLink,
} from './BankViews';
import './bank.css';

const TABS = [
  { id: 'home', icon: 'alinma' },
  { id: 'transfer', icon: 'arrows' },
  { id: 'payments', icon: 'receipt' },
  { id: 'store', icon: 'storefront' },
  { id: 'services', icon: 'grid' },
];

function BankToast({ t, onDone }) {
  // onDone is a fresh closure each Bank render; hold it in a ref so parent
  // re-renders don't restart the 4.2s clock
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => done.current(), 4200);
    return () => clearTimeout(id);
  }, []);
  return (
    <motion.div
      className="bk-toast"
      layout
      initial={{ opacity: 0, y: -20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95, transition: { duration: 0.16 } }}
      transition={spring}
    >
      <BIcon id={t.icon} size={15} strokeWidth={2.2} />
      <span>{t.text}</span>
    </motion.div>
  );
}

// the account hero: balance derives from the shared store, so paying a bill
// here or logging a spend in Mowzoon moves the same number
function Hero({ app, i }) {
  const [hidden, setHidden] = useState(false);
  const [acct, setAcct] = useState('current');
  const bal = acct === 'current' ? currentBalance(app) : savingsBalance(app);
  const c = Math.round(Math.max(0, bal) * 100);
  const whole = Math.floor(c / 100);
  const cents = c % 100;
  return (
    <section className="bk-hero bkh-hero">
      <div className="bk-hero-top">
        <span className="bk-hero-label">
          {i.t(acct === 'current' ? 'bank.acct.current' : 'bank.acct.savings')} ··· 1000
        </span>
        <button className="bk-hero-eye" onClick={() => setHidden((h) => !h)} aria-label={i.t('bank.acct.toggle')} aria-pressed={hidden}>
          <BIcon id={hidden ? 'eyeOff' : 'eye'} size={19} strokeWidth={2} />
        </button>
      </div>
      <div className="bk-hero-balance" dir="ltr" style={{ justifyContent: i.dir === 'rtl' ? 'flex-end' : 'flex-start' }}>
        {hidden ? (
          <span className="bk-hero-hidden">••••••</span>
        ) : (
          <>
            <Riyal size={24} />
            <span><NumberFlow value={whole} format={i.fmtNum} /></span>
            <em>.{String(cents).padStart(2, '0')}</em>
          </>
        )}
      </div>
      <p className="bk-hero-iban">{hidden ? '•••• •••• •••• ••••' : fmtIban(IBAN)}</p>
      <div className="bk-hero-foot">
        <div className="bk-hero-seg" role="tablist">
          <button role="tab" aria-selected={acct === 'current'} className={acct === 'current' ? 'on' : ''} onClick={() => setAcct('current')}>
            {i.t('bank.acct.currentShort')}
          </button>
          <button role="tab" aria-selected={acct === 'savings'} className={acct === 'savings' ? 'on' : ''} onClick={() => setAcct('savings')}>
            {i.t('bank.acct.savingsShort')}
          </button>
        </div>
        <div className="bk-hero-dots" aria-hidden="true">
          <i className={acct === 'current' ? 'on' : ''} />
          <i className={acct === 'savings' ? 'on' : ''} />
        </div>
      </div>
    </section>
  );
}

// Mowzoon, embedded: the live read from the coach, inside the bank
function CoachCard({ app, profile, i, onOpenMowzoon }) {
  if (!profile) {
    return (
      <section className="bk-coach bkh-coach">
        <div className="bk-coach-head">
          <span className="bk-mz-mark"><LiquidMark size={22} /></span>
          <span>{i.lang === 'ar' ? 'موزون' : 'Mowzoon'}</span>
          <span className="bk-mzword">{i.t('bank.coach.by')}</span>
        </div>
        <div className="bk-coach-empty">
          <span className="bk-mz-mark"><LiquidMark size={44} /></span>
          <p>{i.t('bank.coach.emptyBody')}</p>
        </div>
        <button className="bk-btn" onClick={() => onOpenMowzoon()}>{i.t('bank.coach.meet')}</button>
      </section>
    );
  }
  const id = profile.model?.id ?? profile.archetype.id;
  const meta = ARCHETYPE_META[id];
  const voice = i.arch(id);
  const eng = app.insights && app.insights.aid === id ? app.insights : null;
  const headline = eng?.list?.length
    ? i.insight(eng.list[0].insight_key, eng.list[0].signal)
    : voice.desc;
  return (
    <section className="bk-coach bkh-coach" style={{ '--bk-mz-tint': meta.tint }}>
      <div className="bk-coach-head">
        <span className="bk-mz-mark"><LiquidMark size={22} /></span>
        <span>{i.lang === 'ar' ? 'موزون' : 'Mowzoon'}</span>
        <span className="bk-coach-live">{i.t('bank.coach.live')}</span>
      </div>
      <div className="bk-coach-arch">
        <span className="bk-coach-glyph"><Glyph id={meta.glyph} size={26} strokeWidth={2} /></span>
        <div>
          <b>{voice.name}</b>
          <em>{voice.tagline}</em>
        </div>
      </div>
      <p className="bk-coach-note">{headline}</p>
      <div className="bk-coach-meters">
        {METRIC_LABELS.map(([key]) => (
          <div className="bk-coach-meter" key={key}>
            <span>{i.t(`metric.${key}`)}</span>
            <div className="bar"><i style={{ width: `${Math.round(profile.metrics[key])}%` }} /></div>
          </div>
        ))}
      </div>
      <button className="bk-btn" onClick={() => onOpenMowzoon()}>{i.t('bank.coach.open')}</button>
    </section>
  );
}

function HomeView({ app, profile, i, onOpenMowzoon, openSheet, toast }) {
  const QUICK = [
    { id: 'bill', icon: 'billDoc', k: 'bank.quick.bills' },
    { id: 'transfer', icon: 'cardUp', k: 'bank.quick.transfer' },
    { id: 'recharge', icon: 'sim', k: 'bank.quick.recharge' },
    { id: 'violation', icon: 'car', mz: true, k: 'bank.quick.violations' },
  ];
  const d = insightDelta(app);
  const now = new Date();
  // pin the Gregorian calendar: the sums are Gregorian months, and ar-SA
  // would otherwise label them with (non-adjacent) Hijri month names
  const monthFmt = new Intl.DateTimeFormat(i.locale, { month: 'long', calendar: 'gregory' });
  const monthName = monthFmt.format(now);
  const prevName = monthFmt.format(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  return (
    <motion.div key="home" className="bkh-grid" variants={screen} initial="initial" animate="animate" exit="exit">
      <Hero app={app} i={i} />
      <CoachCard app={app} profile={profile} i={i} onOpenMowzoon={onOpenMowzoon} />

      <motion.div className="bk-quick bkh-quick" variants={item}>
        {QUICK.map((q) => (
          <button key={q.id} className="bk-quick-tile" onClick={() => openSheet({ kind: q.id })}>
            <span className="bk-quick-ic">
              {q.mz ? <Glyph id="car" size={24} strokeWidth={2} /> : <BIcon id={q.icon} size={24} strokeWidth={2} />}
            </span>
            {i.t(q.k)}
          </button>
        ))}
      </motion.div>

      <motion.button className="bk-banner bkh-banner" variants={item} onClick={() => toast('flash', i.t('bank.demo'))}>
        <span className="bk-banner-art" aria-hidden="true"><i className="s1" /><i className="s2" /><i className="s3" /></span>
        <b>{i.t('bank.banner.title')}</b>
        <p>{i.t('bank.banner.sub')}</p>
        <span className="bk-banner-badge"><Glyph id="trophy" size={34} strokeWidth={1.7} /></span>
      </motion.button>

      <motion.div className="bkh-cards" variants={item}>
        <div className="bk-card">
          <span className="bk-card-kick"><Glyph id="trend" size={13} strokeWidth={2.4} />{i.t('bank.insights.kick', { month: monthName })}</span>
          <div className="bk-stat" dir="ltr">
            <Riyal size={15} />
            <NumberFlow value={Math.round(d.cur)} format={i.fmtNum} />
          </div>
          {d.prev > 0 ? (
            <span className={`bk-delta ${d.less ? 'pos' : 'neg'}`}>
              {d.less ? '↓ ' : '↑ '}
              {i.t(d.less ? 'bank.insights.less' : 'bank.insights.more')}
              <span className="bk-delta-cap">{i.t('bank.insights.than', { month: prevName })}</span>
            </span>
          ) : (
            <p className="bk-card-sub">{i.t('bank.insights.solo')}</p>
          )}
          <CardLink onClick={() => onOpenMowzoon('spending')} label={i.t('bank.insights.link')} />
        </div>

        <div className="bk-card">
          <span className="bk-card-kick"><BIcon id="coins" size={13} strokeWidth={2.4} />{i.t('bank.finance.kick')}</span>
          <h3>{i.t('bank.finance.title')}</h3>
          <p className="bk-card-sub">{i.t('bank.finance.sub')}</p>
          <CardLink onClick={() => openSheet({ kind: 'finance' })} label={i.t('bank.finance.link')} />
        </div>

        <div className="bk-card">
          <span className="bk-card-kick"><BIcon id="akthr" size={13} />akthr</span>
          <div className="bk-stat">{i.fmtNum(10)} <em style={{ fontSize: 14, fontWeight: 580, color: 'var(--bk-ink2)', fontStyle: 'normal' }}>{i.t('bank.akthr.points')}</em></div>
          <p className="bk-card-sub">{i.t('bank.akthr.expiry')}</p>
          <CardLink onClick={() => toast('akthr', i.t('bank.demo'))} label="akthr" />
        </div>

        <div className="bk-card">
          <span className="bk-card-kick"><BIcon id="bars" size={13} strokeWidth={2.4} />NAMA</span>
          <h3>{i.t('bank.nama.title')}</h3>
          <p className="bk-card-sub">{i.t('bank.nama.sub')}</p>
          <CardLink onClick={() => toast('bars', i.t('bank.demo'))} label="NAMA" />
        </div>
      </motion.div>

      <motion.div className="bkh-act" variants={item}>
        <ActivityCard app={app} i={i} onOpenMowzoon={onOpenMowzoon} />
      </motion.div>
    </motion.div>
  );
}

export default function Bank({ app, setApp, profile, dark, onOpenMowzoon }) {
  const i = useI18n();
  const [tab, setTab] = useState('home');
  // each open gets a fresh id so AnimatePresence can never hand a mid-exit
  // sheet's internal state (typed amount, success screen) to the next one
  const [sheet, setSheetRaw] = useState(null);
  const sheetSeq = useRef(0);
  const setSheet = (s) => setSheetRaw(s ? { ...s, _id: ++sheetSeq.current } : null);
  const [notifAt, setNotifAt] = useState(null); // {top,left} | null
  const bellRef = useRef(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = (icon, text) => {
    const id = ++toastId.current;
    setToasts((s) => [...s.slice(-2), { id, icon, text }]);
  };

  // bank actions write to the same ledger Mowzoon classifies from -
  // the desc is localized at insertion, matching how demo data seeds
  const logTx = (desc, amount, type, icon) => {
    const amt = Math.max(1, Math.round(Number(amount)));
    setApp((s) => ({
      ...s,
      tx: [{ id: s.nextId, desc, amount: amt, type, icon, date: todayISO() }, ...s.tx],
      nextId: s.nextId + 1,
    }));
  };

  const name = (app.profile?.name || '').trim();
  const initials = name
    ? name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'A';
  const dateLine = new Intl.DateTimeFormat(i.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const openNotifs = () => {
    if (notifAt) { setNotifAt(null); return; }
    const r = bellRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    setNotifAt({ top: Math.round(r.bottom + 10), left: Math.round(left) });
  };

  const view = { transfer: TransferView, payments: PaymentsView, store: StoreView, services: ServicesView }[tab];

  return (
    <div className="bank">
      {/* sidebar (≥720px) */}
      <aside className="bk-side">
        <span className="bk-side-logo"><AlinmaLogo height={34} /></span>
        <nav className="bk-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`bk-nav-row ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              {tab === t.id && <motion.span layoutId="bk-pill" className="bk-nav-pill" transition={spring} aria-hidden="true" />}
              <BIcon id={t.icon} size={19} strokeWidth={2} />
              <span>{i.t(`bank.tab.${t.id}`)}</span>
            </button>
          ))}
        </nav>
        <div className="bk-side-foot">
          <button className="bk-side-switch bk-mz" onClick={() => onOpenMowzoon()}>
            <span className="bk-mz-mark"><LiquidMark size={17} /></span>
            {i.t('bank.openMowzoon')}
          </button>
          {/* the real alinma web app carries its own language + appearance toggles */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="bk-side-switch"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setApp((s) => ({ ...s, lang: s.lang === 'ar' ? 'en' : 'ar' }))}
            >
              {i.lang === 'ar' ? 'English' : 'عربي'}
            </button>
            <button
              className="bk-side-switch"
              style={{ flex: 1, justifyContent: 'center' }}
              aria-label={i.t(dark ? 'settings.light' : 'settings.dark')}
              onClick={() => setApp((s) => ({ ...s, theme: dark ? 'light' : 'dark' }))}
            >
              <Glyph id={dark ? 'spark' : 'moon'} size={15} strokeWidth={2} />
            </button>
          </div>
          <div className="bk-side-user">
            <span className="bk-avatar">{initials}</span>
            <span>
              <b>{name || i.t('bank.guest')}</b>
              <em>{i.t('bank.acct.currentShort')} ··· 1000</em>
            </span>
          </div>
        </div>
      </aside>

      <div className="bk-main">
        <header className="bk-topbar">
          <span className="bk-avatar">{initials}</span>
          <div className="bk-hello">
            <h1>{i.t('bank.hello', { name: name || i.t('bank.guest') })}</h1>
            <p>{dateLine}</p>
          </div>
          <div className="bk-top-actions">
            <button className="bk-iconbtn" aria-label={i.t('bank.a11y.search')} onClick={() => toast('flash', i.t('bank.demo'))}>
              <Glyph id="search" size={18} strokeWidth={2} />
            </button>
            <button ref={bellRef} className="bk-iconbtn" aria-label={i.t('bank.a11y.notifs')} onClick={openNotifs}>
              <Glyph id="bell" size={18} strokeWidth={2} />
              <span className="bk-badge">3</span>
            </button>
            <button className="bk-iconbtn danger" aria-label={i.t('bank.a11y.logout')} onClick={() => toast('logout', i.t('bank.demo'))}>
              <BIcon id="logout" size={18} strokeWidth={2} />
            </button>
          </div>
        </header>

        <main className="bk-content">
          <AnimatePresence mode="wait">
            {tab === 'home' ? (
              <HomeView
                key="home"
                app={app}
                profile={profile}
                i={i}
                onOpenMowzoon={onOpenMowzoon}
                openSheet={setSheet}
                toast={toast}
              />
            ) : (
              view && (() => {
                const V = view;
                return <V key={tab} app={app} i={i} openSheet={setSheet} toast={toast} onOpenMowzoon={onOpenMowzoon} />;
              })()
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* phone tab bar */}
      <nav className="bk-tabbar" aria-label="Primary">
        {TABS.map((t) => (
          <button key={t.id} className={`bk-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <BIcon id={t.icon} size={22} strokeWidth={tab === t.id ? 2.2 : 1.9} />
            {i.t(`bank.tab.${t.id}`)}
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {notifAt && (
          <NotifPop
            key="notifs"
            at={notifAt}
            app={app}
            profile={profile}
            i={i}
            onClose={() => setNotifAt(null)}
            onOpenMowzoon={onOpenMowzoon}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <BankSheet
            key={sheet._id}
            sheet={sheet}
            app={app}
            i={i}
            logTx={logTx}
            toast={toast}
            onClose={() => setSheet(null)}
            onOpenMowzoon={onOpenMowzoon}
          />
        )}
      </AnimatePresence>

      <div className="bk-toasts">
        <AnimatePresence>
          {toasts.map((t) => (
            <BankToast key={t.id} t={t} onDone={() => setToasts((s) => s.filter((x) => x.id !== t.id))} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
