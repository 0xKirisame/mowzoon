import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ARCHETYPE_META, TYPE_TINTS } from './data';
import { Glyph, LiquidMark, LiquidOrb, NumberFlow, screen, item, gel, spring, springBounce } from './ui';
import { DROPS } from './game';
import { getInsights } from './api';
import { todayISO, streakOf } from './store';
import { useI18n } from './i18n';

const TIER = (p) => (p < 50 ? 0 : p < 70 ? 1 : p < 90 ? 2 : 3);
const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const subDueToday = (s, now) => {
  if (typeof s.dueDay === 'string') {
    const [y, m, d] = s.dueDay.split('-').map(Number);
    if (s.cycle === 'weekly') {
      // weekly subs store their last seen date; due every 7 days from it
      const days = Math.round((now - new Date(y, m - 1, d)) / 86400000);
      return days >= 0 && days % 7 === 0;
    }
    return m === now.getMonth() + 1 && d === now.getDate();
  }
  return Number(s.dueDay) === now.getDate();
};

export default function Home({ profile, app, setApp, monthTx, level, questProg, onCollect, onLedger, onJourney, onAhead, onProfile }) {
  const i = useI18n();
  const id = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const today = todayISO();
  const now = new Date();

  // insights fetched once per day, cached in app.nudge
  const cache = app.nudge;
  const cacheValid = cache && cache.date === today && cache.archetypeId === id;
  useEffect(() => {
    if (id == null || cacheValid) return undefined;
    let alive = true;
    getInsights(id, profile.metrics).then((d) => {
      if (!alive || !d?.nudge) return;
      setApp((s) => ({ ...s, nudge: { date: today, archetypeId: id, text: d.nudge, spikes: d.spikes ?? [] } }));
    });
    return () => { alive = false; };
  }, [id, cacheValid, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // a stale same-archetype cache still shows (day counts refresh with the
  // next fetch); a different archetype's forecast doesn't
  const spikes = ((cache?.archetypeId === id ? cache.spikes : []) ?? []).filter(
    (s) => !(app.spikeHidden || []).includes(s.name),
  );
  const streak = streakOf(app.visits);

  const spent = monthTx.reduce((a, t) => a + (t.type !== 'savings' ? t.amount : 0), 0);
  const saved = monthTx.reduce((a, t) => a + (t.type === 'savings' ? t.amount : 0), 0);
  const left = app.income - spent - saved;

  // trailing 30 days of spending
  const dayBars = useMemo(() => {
    const out = [];
    const idx = new Map();
    for (let n = 29; n >= 0; n--) {
      const iso = daysAgoISO(n);
      idx.set(iso, out.length);
      out.push({ iso, sum: 0 });
    }
    for (const t of app.tx) {
      if (t.type === 'savings') continue;
      const at = idx.get(t.date);
      if (at != null) out[at].sum += t.amount;
    }
    return out;
  }, [app.tx]);
  const dayMax = Math.max(...dayBars.map((d) => d.sum), 1);

  const recent = useMemo(
    () => [...app.tx].sort((a, b) => (a.date === b.date ? b.id - a.id : b.date > a.date ? 1 : -1)).slice(0, 3),
    [app.tx],
  );
  const dayLabel = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(i.locale, { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d));
  };

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPct = Math.round((now.getDate() / daysInMonth) * 100);
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
  const paceOver = left < 0;
  const pace = Math.round(Math.abs(left) / daysLeft);

  const hour = now.getHours();
  const nm = (app.profile?.name || '').trim();
  const greetBase = hour < 5 ? i.t('home.late') : hour < 12 ? i.t('home.morning') : hour < 18 ? i.t('home.afternoon') : i.t('home.evening');
  const greeting = nm ? `${greetBase.replace(/[.．。]\s*$/, '')}${i.lang === 'ar' ? '، ' : ', '}${nm}.` : greetBase;
  const dateLine = new Intl.DateTimeFormat(i.locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);

  const brief = useMemo(() => {
    if (!profile) return null;
    const spike = spikes[0];
    const lifestyleWk = monthTx.filter((t) => t.type === 'discretionary' && t.date >= daysAgoISO(7)).length;
    if (spike && spike.days <= 30) {
      return {
        reason: i.t('home.reason.spike', { s: i.spikeName(spike.name), d: i.fmtDays(spike.days) }),
        text: i.t('brief.spike'),
        actionKey: 'ahead',
      };
    }
    if (lifestyleWk >= 3) {
      return {
        reason: i.t('home.reason.lifestyle', { n: i.fmtNum(lifestyleWk) }),
        text: i.t('brief.lifestyle'),
        actionKey: 'spending',
      };
    }
    if (paceOver && monthTx.length > 0) {
      return {
        reason: i.t('home.reason.pace', { a: i.fmtMoney(Math.abs(left)) }),
        text: i.t('brief.pace', { b: i.fmtMoney(pace) }),
        actionKey: 'spending',
      };
    }
    return null;
  }, [profile, spikes, monthTx, paceOver, left, pace, i.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dismissed, setDismissed] = useState(false);

  const agenda = [
    ...(app.subs || [])
      .filter((s) => s.tracked && s.state !== 'cancelled' && subDueToday(s, now))
      .map((s) => ({ key: 'sub' + s.id, glyph: s.icon || 'calendar', name: s.name, meta: i.fmtMoney(s.amount), sub: s })),
    ...(app.plans || [])
      .filter((pl) => pl.date === today)
      .map((pl) => ({ key: 'plan' + pl.id, glyph: pl.icon || 'peak', name: pl.name, meta: i.t('home.today.now') })),
    ...spikes.filter((s) => s.days <= 7).map((s) => ({ key: 'spike' + s.name, glyph: 'calendar', name: i.spikeName(s.name), meta: i.fmtDays(s.days), near: true })),
  ];
  const subLoggedToday = (sub) => app.tx.some((t) => t.recurringId === sub.id && t.date === today);
  const logSub = (sub) => setApp((s) => {
    if (s.tx.some((t) => t.recurringId === sub.id && t.date === today)) return s;
    return {
      ...s,
      tx: [{ id: s.nextId, desc: sub.name, amount: sub.amount, type: 'fixed', icon: sub.icon || 'home', date: today, recurringId: sub.id }, ...s.tx],
      nextId: s.nextId + 1,
      game: { ...s.game, drops: s.game.drops + DROPS.log },
    };
  });

  const quest = app.game?.quest;
  const QUEST_GLYPHS = { mindful: 'calendar', treat: 'cup', buffer: 'shield', setaside: 'peak' };
  const questText = quest
    ? i.t(`quest.${quest.key}`, {
        t: questProg?.kind === 'money' ? i.fmtMoney(questProg.target) : i.fmtNum(questProg?.target ?? 0),
      })
    : '';
  const questLabel = questProg
    ? i.t(`quest.progress.${questProg.kind === 'days' ? 'days' : questProg.kind === 'money' ? 'money' : 'count'}`, {
        v: questProg.kind === 'money' ? i.fmtMoney(questProg.value) : i.fmtNum(questProg.value),
        t: questProg.kind === 'money' ? i.fmtMoney(questProg.target) : i.fmtNum(questProg.target),
      })
    : '';
  const questDone = questProg && questProg.value >= questProg.target;
  // reissues start tomorrow (the farm guard), so the fresh bar sitting at
  // 0% today is expected - say so instead of looking stuck
  const questFresh = quest && quest.startedISO > today;
  // Collected today: the reissue shares the old quest's key, so the panel
  // keeps showing the finished quest at rest ("that's everything this
  // week") instead of revealing tomorrow's quest early.
  const questCollected = questFresh && app.game?.lastQuestCollect === today;

  // Collecting plays a short celebration beat, then the fresh quest slides
  // in; without it the panel snapped to 0% and read as a silent reset.
  const [claiming, setClaiming] = useState(false);
  const claimTimer = useRef(null);
  useEffect(() => () => clearTimeout(claimTimer.current), []);
  const claim = () => {
    if (claiming) return;
    setClaiming(true);
    claimTimer.current = setTimeout(() => {
      onCollect();
      setClaiming(false);
    }, 1050);
  };

  // The engine's suggested focus (display-only): a themed card under the
  // weekly quest. Text is localized from the tied insight's signal when we
  // have it. A quest without an insight_key is the engine's "fresh start"
  // opportunity (its rationale arrives as raw English), so that card is
  // rendered from a local key instead - days-to-month-start recomputed here.
  const eng = app.insights && app.insights.aid === id ? app.insights : null;
  const focus = eng?.quest || null;
  const focusInsight = focus ? (eng.list || []).find((x) => x.insight_key === focus.insight_key) : null;
  const nowD = new Date();
  const daysToMonth = Math.ceil((new Date(nowD.getFullYear(), nowD.getMonth() + 1, 1) - nowD) / 86400000);
  const focusText = focus
    ? (focusInsight
        ? i.insight(focusInsight.insight_key, focusInsight.signal)
        : i.t('focus.freshstart', { n: i.fmtNum(Math.max(1, daysToMonth)) }))
    : null;

  // cohort chip only fires when a percentile crosses a tier boundary
  const standing = profile?.model?.cohort_percentiles;
  const [moved, setMoved] = useState(null);
  const cohortKey = standing ? `${standing.efficiency}|${standing.resilience}|${standing.eq}|${id}` : null;
  useEffect(() => {
    if (!standing) return;
    const seen = app.seen;
    if (seen && seen.archetypeId === id && seen.cohort_percentiles) {
      for (const k of ['efficiency', 'resilience', 'eq']) {
        if (TIER(standing[k]) > TIER(seen.cohort_percentiles[k])) { setMoved({ metric: k, pct: standing[k] }); break; }
      }
    }
    setApp((s) => ({ ...s, seen: { cohort_percentiles: standing, archetypeId: id, day: today } }));
  }, [cohortKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.section className="home" variants={screen} initial="initial" animate="animate" exit="exit">
      <motion.header className="home-head" variants={item}>
        <div>
          <p className="home-date">{dateLine}</p>
          <h1>{greeting}</h1>
        </div>
        <div className="home-chips">
          <button className="streak glass-lite streak-chip" onClick={() => onProfile('progress')}>
            <Glyph id="flame" size={15} strokeWidth={2} />
            {i.fmtNum(Math.max(1, streak))}
          </button>
          <button className="streak glass-lite drops-chip" onClick={() => onProfile('progress')}>
            <LiquidOrb size={17} fill={level?.pct ?? 0} />
            <NumberFlow value={app.game?.drops ?? 0} duration={0.6} format={i.fmtNum} />
          </button>
        </div>
      </motion.header>

      {!profile ? (
        <motion.div className="glass home-empty" variants={item}>
          <span className="home-empty-mark"><LiquidMark size={46} /></span>
          <h2>{i.t('home.empty.title')}</h2>
          <p>{i.t('home.empty.body')}</p>
          <div className="hero-cta">
            <motion.button className="btn-ink" whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }} transition={gel} onClick={onJourney}>{i.t('hero.begin')}</motion.button>
            <motion.button className="btn-ghost" whileTap={{ scale: 0.96 }} transition={gel} onClick={onLedger}>{i.t('home.empty.ledger')}</motion.button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* pocket coach card; CSS shows it only under 1080px */}
          <motion.button className="coach-card" variants={item} onClick={() => onProfile()} whileTap={{ scale: 0.98 }} transition={gel}>
            <span className="cc-glyph" style={{ background: `color-mix(in srgb, ${ARCHETYPE_META[id].tint} 15%, var(--surface))`, color: ARCHETYPE_META[id].tint }}>
              <Glyph id={ARCHETYPE_META[id].glyph} size={20} strokeWidth={2} />
            </span>
            <span className="cc-meta">
              <b>{i.arch(id).name}</b>
              <em>{i.arch(id).tagline}</em>
            </span>
            {profile.model ? (
              <span className="cc-conf">{i.t('home.match', { p: i.fmtPct(Math.round(profile.model.probs[profile.model.id] * 100)) })}</span>
            ) : profile.asked ? (
              <span className="cc-conf cc-off">{i.t('home.estimate')}</span>
            ) : null}
            <svg className="cc-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </motion.button>

          {/* money this month */}
          <motion.div className="glass panel month-panel" variants={item}>
            <div className="month-head">
              <p className="panel-title">{i.t('home.month')}</p>
              <span className="month-prog" aria-hidden="true"><i style={{ width: `${monthPct}%` }} /></span>
            </div>
            <div className="stats home-stats">
              <button className="stat glass-lite stat-tap" onClick={onLedger}>
                <b style={{ color: 'var(--neg)' }}><NumberFlow value={spent} duration={0.5} format={i.fmtMoney} /></b>
                <span>{i.t('home.spent')}</span>
              </button>
              <button className="stat glass-lite stat-tap" onClick={onLedger}>
                <b style={{ color: 'var(--pos)' }}><NumberFlow value={saved} duration={0.5} format={i.fmtMoney} /></b>
                <span>{i.t('home.saved')}</span>
              </button>
              <button className={`stat glass-lite stat-tap ${left < 0 ? 'neg' : ''}`} onClick={onLedger}>
                <b>{left < 0 && '-'}<NumberFlow value={Math.abs(left)} duration={0.5} format={i.fmtMoney} /></b>
                <span>{i.t('home.left')}</span>
              </button>
            </div>
            {/* Charts read left-to-right in both languages, like the map.
                Bars surface in a small ripple, oldest to today. */}
            <div className="day-bars" dir="ltr" aria-hidden="true">
              {dayBars.map((d, idx) => (
                <motion.i
                  key={d.iso}
                  className={d.iso === today ? 'db-today' : d.sum === 0 ? 'db-zero' : ''}
                  style={{ height: `${d.sum === 0 ? 0 : Math.max(10, Math.round((d.sum / dayMax) * 100))}%`, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.2 + idx * 0.014 }}
                />
              ))}
            </div>
            <p className="pace-line">
              {monthTx.length === 0
                ? i.t('home.pulse.note')
                : paceOver
                  ? i.t('home.pace.over', { a: i.fmtMoney(Math.abs(left)), b: i.fmtMoney(pace) })
                  : i.t('home.pace', { a: i.fmtMoney(pace), d: i.fmtNum(daysLeft) })}
            </p>
            <motion.button className="add-btn" whileTap={{ scale: 0.97 }} transition={gel} onClick={onLedger}>
              <Glyph id="plus" size={16} strokeWidth={2.2} />{i.t('home.add')}
            </motion.button>
          </motion.div>

          {/* coach brief, shown only when there's a dated reason */}
          <AnimatePresence>
            {brief && !dismissed && (
              <motion.div
                className="coach-brief"
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 280, damping: 20 } }}
                exit={{ opacity: 0, height: 0, marginTop: -18, transition: { duration: 0.2 } }}
              >
                <div className="cb-icon"><Glyph id="bell" size={18} /></div>
                <div className="cb-body">
                  <p className="cb-reason">{brief.reason}</p>
                  <p className="cb-text">{brief.text}</p>
                  {brief.actionKey && (
                    <button className="cb-chip" onClick={() => (brief.actionKey === 'ahead' ? onAhead() : onLedger())}>
                      {i.t(brief.actionKey === 'ahead' ? 'home.brief.ahead' : 'home.brief.spending')}
                      <Glyph id="compass" size={13} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
                <button className="cb-x" onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* weekly quest, measured from the ledger */}
          {quest && questProg && (
            <motion.div className="glass panel quest-panel" variants={item}>
              <div className="panel-h">
                <p className="panel-title" style={{ margin: 0 }}>{i.t('quest.title')}</p>
                {!questCollected && (
                  <span className="quest-bounty">{i.t('toast.drops', { n: i.fmtNum(DROPS.quest) })}</span>
                )}
              </div>
              {/* Keyed by quest key only: collecting keeps this row mounted
                  and settles it into the "collected" resting state in place.
                  Tomorrow's quest simply takes over when its day arrives. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={quest.key}
                  className={`quest-row${questDone || questCollected ? ' done' : ''}${questCollected ? ' collected' : ''}`}
                  style={{ '--qt': ARCHETYPE_META[id].tint }}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.18 } }}
                  transition={spring}
                >
                  <span
                    className="quest-ic"
                    style={questDone || questCollected
                      ? { background: ARCHETYPE_META[id].tint, color: '#fff' }
                      : { background: `color-mix(in srgb, ${ARCHETYPE_META[id].tint} 14%, var(--surface))`, color: ARCHETYPE_META[id].tint }}
                  >
                    {questDone || questCollected ? (
                      <motion.svg
                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                        initial={{ scale: 0, rotate: -24 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={springBounce}
                        aria-hidden="true"
                      >
                        <path d="M5 12.8l4.2 4.2L19 7.4" />
                      </motion.svg>
                    ) : (
                      <Glyph id={QUEST_GLYPHS[quest.key] || 'spark'} size={19} strokeWidth={2} />
                    )}
                  </span>
                  <div className="quest-body">
                    <p className="quest-text">{questText}</p>
                    <div className="quest-track">
                      <motion.i
                        initial={false}
                        animate={{ width: `${questCollected ? 100 : Math.round(questProg.pct * 100)}%` }}
                        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                        style={{ background: ARCHETYPE_META[id].tint }}
                      />
                    </div>
                    {/* the collected chip says it all - no sub-line clutter */}
                    {!questCollected && (
                      <p className={`quest-sub${questDone ? ' good' : questFresh ? ' fresh' : ''}`}>
                        {questDone ? i.t('quest.done') : questFresh ? i.t('quest.tomorrow') : questLabel}
                      </p>
                    )}
                  </div>
                  {questCollected ? (
                    <motion.span
                      className="quest-claimed-chip"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={springBounce}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.8l4.2 4.2L19 7.4" /></svg>
                      {i.t('quest.claimed', { n: i.fmtNum(DROPS.quest) })}
                    </motion.span>
                  ) : questDone && (
                    <motion.button
                      className={`quest-collect${claiming ? ' claimed' : ''}`}
                      onClick={claim}
                      disabled={claiming}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.94 }}
                      transition={gel}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {claiming ? (
                          <motion.span
                            key="got"
                            className="qc-in"
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={springBounce}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.8l4.2 4.2L19 7.4" /></svg>
                            {i.t('quest.collected')}
                          </motion.span>
                        ) : (
                          <motion.span
                            key="cta"
                            className="qc-in"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          >
                            {i.t('quest.collect', { n: i.fmtNum(DROPS.quest) })}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {/* coach's focus: the engine's suggestion, under the weekly quest */}
          {focus && focusText && (
            <motion.div className="glass panel focus-panel" variants={item}>
              <div className="panel-h">
                <p className="panel-title" style={{ margin: 0 }}>{i.t('focus.title')}</p>
                {focus.moment && focus.moment !== 'neutral' && (
                  <span className={`focus-chip ${focus.moment}`}>{i.t(`focus.${focus.moment}`)}</span>
                )}
              </div>
              <div className="quest-row">
                <span className="quest-ic" style={{ background: `color-mix(in srgb, ${ARCHETYPE_META[id].tint} 14%, var(--surface))`, color: ARCHETYPE_META[id].tint }}>
                  <Glyph id={QUEST_GLYPHS[focus.key] || 'spark'} size={19} strokeWidth={2} />
                </span>
                <div className="quest-body">
                  <p className="focus-text">{focusText}</p>
                  <p className="focus-sub">{i.t('focus.sub')}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* On today */}
          <motion.div className="glass panel" variants={item}>
            <p className="panel-title">{i.t('home.today.title')}</p>
            {agenda.length === 0 ? (
              <p className="panel-note today-empty">{i.t('home.today.empty')}</p>
            ) : (
              <div className="agenda">
                {agenda.map((a) => (
                  <div className="ag-row" key={a.key}>
                    <span className="ag-icon"><Glyph id={a.glyph} size={17} strokeWidth={2} /></span>
                    <span className="ag-name">{a.name}</span>
                    <span className={`ag-meta ${a.near ? 'near' : ''}`}>{a.meta}</span>
                    {a.sub && !subLoggedToday(a.sub) && (
                      <button className="ag-log" onClick={() => logSub(a.sub)}>{i.t('home.today.log')}</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* latest activity */}
          {recent.length > 0 && (
            <motion.div className="glass panel" variants={item}>
              <div className="panel-h">
                <p className="panel-title" style={{ margin: 0 }}>{i.t('home.recent')}</p>
                <button className="see-all" onClick={onLedger}>{i.t('home.recent.all')}</button>
              </div>
              <div className="recent-rows">
                {recent.map((t) => (
                  <button className="rc-row" key={t.id} onClick={onLedger}>
                    <span className="rc-icon" style={{ background: `color-mix(in srgb, ${TYPE_TINTS[t.type]} 11%, var(--surface))`, color: TYPE_TINTS[t.type] }}>
                      <Glyph id={t.icon} size={14} strokeWidth={2.1} />
                    </span>
                    <span className="rc-name">{t.desc}<em>{dayLabel(t.date)}</em></span>
                    <span className="rc-amt" style={{ color: TYPE_TINTS[t.type] }}>{t.type === 'savings' ? '+' : '-'}{i.fmtMoney(t.amount)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Change-driven cohort chip */}
          <AnimatePresence>
            {moved && (
              <motion.button
                className="cohort-chip"
                onClick={() => onProfile()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                whileTap={{ scale: 0.98 }}
              >
                <Glyph id="trend" size={15} strokeWidth={2.2} />
                {i.t('home.moved', { p: i.fmtPct(Math.max(1, 100 - moved.pct)), m: i.t(`metric.${moved.metric}`) })}
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.section>
  );
}
