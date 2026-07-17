import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TYPE_TINTS } from './data';
import { Glyph, screen, item, spring } from './ui';
import { isPlus, aheadCount, aheadFull, LIMITS } from './plus';
import { PlusChip } from './PlusSheet';
import { getInsights } from './api';
import { todayISO } from './store';
import { useI18n } from './i18n';

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function daysUntil(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const n = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
}
function subDaysUntil(sub) {
  const n = new Date();
  if (sub.cycle === 'weekly') {
    if (typeof sub.dueDay === 'string') { const since = -daysUntil(sub.dueDay); return since >= 0 ? (7 - (since % 7)) % 7 : Math.max(0, daysUntil(sub.dueDay)); }
    return 7;
  }
  const day = Number(sub.dueDay) || 1;
  let dt = new Date(n.getFullYear(), n.getMonth(), day);
  if (dt < new Date(n.getFullYear(), n.getMonth(), n.getDate())) dt = new Date(n.getFullYear(), n.getMonth() + 1, day);
  return daysUntil(isoOf(dt));
}

function useMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

// Timeline strip: glass orbs on an HTML rail (from refactor/ahead-page).
// Same-day items group into one orb with a count badge; hover or
// press-and-hold an orb and it swells while a tooltip lists the details.
function TimelineViz({ items, i }) {
  const [active, setActive] = useState(null); // hovered or held group key
  const [held, setHeld] = useState(null);     // pressed - deeper swell + sheen
  const isMobile = useMobile();

  // Dynamic horizon: 14 days on phones, 30 on desktop, shrinking to the
  // latest event (min 7 for visual balance). Farther items pin to the edge.
  const MAX_HORIZON = isMobile ? 14 : 30;
  const latestDays = items.length > 0 ? Math.max(...items.map((it) => it.days)) : 0;
  const HORIZON = Math.max(7, Math.min(latestDays, MAX_HORIZON));

  // group items that land on the same spot (clamped to HORIZON)
  const groups = useMemo(() => {
    const res = [];
    items.forEach((it) => {
      const d = Math.min(it.days, HORIZON);
      let g = res.find((x) => x.days === d);
      if (!g) {
        g = { days: d, items: [], key: 'g' + d };
        res.push(g);
      }
      g.items.push(it);
    });
    return res;
  }, [items, HORIZON]);

  const ticks = useMemo(() => {
    if (HORIZON <= 7) return Array.from({ length: HORIZON + 1 }, (_, idx) => idx);
    if (HORIZON <= 14) return [0, 3, 7, 10, HORIZON];
    const res = [];
    for (let j = 0; j < HORIZON; j += 5) res.push(j);
    res.push(HORIZON);
    return res;
  }, [HORIZON]);

  return (
    <div className="tlv" dir="ltr">
      {/* remount the rail when items change so the pulse animations sync */}
      <div className="tlv-rail glass-lite" key={items.length}>
        <div className="tlv-today-mark" />

        {ticks.map((t) => (
          <span key={t} className={`tlv-tick-label ${t === 0 ? 'now' : ''}`} style={{ left: `${(t / HORIZON) * 100}%` }}>
            {t === 0 ? i.fmtDays(0) : i.fmtNum(t)}
          </span>
        ))}

        {groups.map((g, idx) => {
          const pct = (g.days / HORIZON) * 100;
          const isActive = active === g.key;
          const beyond = g.days >= HORIZON && latestDays > HORIZON;
          return (
            <div
              key={g.key}
              className={`tlv-orb glass-lite${isActive ? ' active' : ''}${held === g.key ? ' held' : ''}${beyond ? '' : ' near'}`}
              style={{
                left: `${pct}%`,
                '--orb-color': g.items[0].tint,
                opacity: beyond ? 0.6 : 1,
                zIndex: isActive ? 50 : groups.length - idx,
                animationDelay: `${idx * 0.3}s`,
              }}
              role="img"
              aria-label={g.items.map((x) => `${x.name} · ${i.fmtDays(x.days)}`).join(', ')}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActive(g.key); }}
              onPointerLeave={() => {
                setActive((a) => (a === g.key ? null : a));
                setHeld((h) => (h === g.key ? null : h));
              }}
              onPointerDown={(e) => {
                setActive(g.key);
                setHeld(g.key);
                // capture can throw for already-released pointers; never let it
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  /* press continues uncaptured */
                }
              }}
              onPointerUp={(e) => {
                setHeld(null);
                // touch has no hover to fall back on - release closes the tip
                if (e.pointerType !== 'mouse') setActive(null);
              }}
              onPointerCancel={() => {
                setHeld(null);
                setActive(null);
              }}
            >
              {/* funding ring for plans; full ring when items overlap */}
              <svg className="tlv-orb-ring" viewBox="0 0 64 64">
                {(() => {
                  const it = g.items[0];
                  const c = 2 * Math.PI * 16;
                  const count = g.items.length;
                  if (it.kind !== 'plan' && count <= 1) return null;
                  return (
                    <g>
                      <circle cx="32" cy="32" r="16" fill="none" stroke="var(--fill-2)" strokeWidth="2.5" />
                      <circle
                        cx="32" cy="32" r="16"
                        fill="none" stroke={it.tint} strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={it.kind === 'plan' ? `${(it.funding || 0) * c} ${c}` : `${c} ${c}`}
                        transform="rotate(-90 32 32)"
                      />
                    </g>
                  );
                })()}
              </svg>

              <span className="tlv-orb-dot" style={{ background: g.items[0].tint }} />

              {g.items.length > 1 && (
                <div className="tlv-orb-badge glass-lite">{i.fmtNum(g.items.length)}</div>
              )}

              {isActive && (
                <div className={`tlv-tip glass ${pct < 20 ? 'align-left' : pct > 80 ? 'align-right' : ''}`}>
                  {g.items.map((it, k) => (
                    <div key={it.key} className={`tlv-tip-row${k < g.items.length - 1 ? ' sep' : ''}`}>
                      <span className="tlv-tip-dot" style={{ background: it.tint }} />
                      <strong>{it.name}</strong>
                      <span>{i.fmtDays(it.days)}</span>
                      {it.amount != null && <span>{i.fmtMoney(it.amount)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Ahead: spike forecast, tracked subscriptions, and plans merged into
// one dated timeline. Set-aside is derived from logged savings.
export default function Horizon({ profile, app, setApp, onPlus }) {
  const i = useI18n();
  const id = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const [data, setData] = useState(() => (app.nudge?.spikes ? { spikes: app.nudge.spikes } : null));
  const [adding, setAdding] = useState(null); // 'plan' | 'sub' | null
  const blankForm = { name: '', amount: '', date: '', due: '', cycle: 'monthly' };
  const [f, setF] = useState(blankForm);

  // Mowzoon+ gate: the free plan tracks LIMITS.aheadItems in total
  const tracked = aheadCount(app);
  const full = aheadFull(app);

  useEffect(() => {
    if (id == null) return undefined;
    let alive = true;
    getInsights(id, profile.metrics).then((d) => { if (alive && d) setData(d); });
    return () => { alive = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The engine forecasts the same spikes for everyone; relevance is
  // personal, and dismissed names stay hidden.
  const spikes = (data?.spikes ?? []).filter((s) => !(app.spikeHidden || []).includes(s.name));
  const savedSince = (isoStr) => app.tx.filter((t) => t.type === 'savings' && t.date >= isoStr).reduce((a, t) => a + t.amount, 0);

  const items = useMemo(() => {
    const out = [];
    spikes.forEach((s) => out.push({
      key: 'spike' + s.name, kind: 'spike', name: i.spikeName(s.name), days: s.days, glyph: 'spark', tag: i.t('ahead.tag.forecast'), tint: 'var(--tint)',
      remove: () => setApp((st) => ({ ...st, spikeHidden: [...(st.spikeHidden || []), s.name] })),
    }));
    (app.subs || []).filter((s) => s.tracked && s.state !== 'cancelled').forEach((s) => out.push({
      key: 'sub' + s.id, kind: 'sub', name: s.name, days: subDaysUntil(s), glyph: s.icon || 'calendar', amount: s.amount,
      tag: i.t(s.source === 'detected' ? 'ahead.tag.detected' : 'ahead.tag.sub'), tint: TYPE_TINTS.fixed,
      remove: () => setApp((st) => ({ ...st, subs: (st.subs || []).filter((x) => x.id !== s.id) })),
    }));
    (app.plans || []).forEach((pl) => {
      const funded = Math.min(savedSince(pl.setAside?.startedISO || pl.date), pl.target);
      out.push({
        key: 'plan' + pl.id, kind: 'plan', name: pl.name, days: daysUntil(pl.date), glyph: pl.icon || 'peak', amount: pl.target,
        funding: pl.target > 0 ? funded / pl.target : 0, tag: i.t('ahead.tag.plan'), tint: '#0fa38f',
        remove: () => setApp((st) => ({ ...st, plans: (st.plans || []).filter((x) => x.id !== pl.id) })),
      });
    });
    return out.filter((x) => x.days >= 0 && x.days <= 400).sort((a, b) => a.days - b.days);
  }, [spikes, app.subs, app.plans, app.tx, i.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const plans = app.plans || [];
  const targetTotal = plans.reduce((a, p) => a + p.target, 0);
  const fundedTotal = plans.reduce((a, p) => a + Math.min(savedSince(p.setAside?.startedISO || p.date), p.target), 0);
  const pctFunded = targetTotal > 0 ? Math.round((fundedTotal / targetTotal) * 100) : 0;
  // remaining money over remaining weeks
  const weeklyNeeded = plans.reduce((a, p) => {
    const funded = Math.min(savedSince(p.setAside?.startedISO || p.date), p.target);
    const remaining = Math.max(0, p.target - funded);
    const weeks = Math.max(1, Math.ceil(Math.max(1, daysUntil(p.date)) / 7));
    return a + Math.round(remaining / weeks);
  }, 0);
  const in60 = items.filter((x) => x.days <= 60).length;

  const weeklyFor = (target, date) => Math.round(target / Math.max(1, Math.ceil(Math.max(1, daysUntil(date)) / 7)));
  const planHint = f.amount && f.date ? i.fmtMoney(weeklyFor(Math.round(Number(f.amount)), f.date)) : null;

  const savePlan = () => {
    if (aheadFull(app)) {
      onPlus();
      return;
    }
    const target = Math.round(Number(f.amount));
    if (!f.name.trim() || !target || !f.date) return;
    setApp((s) => ({ ...s, plans: [...(s.plans || []), { id: 'p' + s.nextId, name: f.name.trim(), target, date: f.date, icon: 'peak', setAside: { weekly: weeklyFor(target, f.date), startedISO: todayISO() } }], nextId: s.nextId + 1 }));
    setAdding(null); setF(blankForm);
  };
  const saveSub = () => {
    if (aheadFull(app)) {
      onPlus();
      return;
    }
    const amt = Math.round(Number(f.amount));
    if (!f.name.trim() || !amt) return;
    setApp((s) => ({ ...s, subs: [...(s.subs || []), { id: 'm' + s.nextId, name: f.name.trim(), amount: amt, cycle: f.cycle, dueDay: Number(f.due) || 1, state: 'keep', source: 'manual', icon: 'calendar', tracked: true }], nextId: s.nextId + 1 }));
    setAdding(null); setF(blankForm);
  };

  return (
    <motion.section className="room ahead" variants={screen} initial="initial" animate="animate" exit="exit">
      <motion.header className="room-head" variants={item}>
        <h1>{i.t('nav.ahead')}</h1>
        <p>{i.t('ahead.sub2')}</p>
      </motion.header>

      <motion.div className="readiness" variants={item}>
        <p className="rd-eyebrow">{i.t('ahead.readiness')}</p>
        <p className="rd-line">
          {in60 === 0
            ? i.t('ahead.clear')
            : plans.length > 0 && weeklyNeeded > 0
              ? i.t('ahead.needs', { w: i.fmtMoney(weeklyNeeded), p: i.fmtPct(pctFunded) })
              : i.t('ahead.coming', { n: i.fmtNum(in60) })}
        </p>
        {plans.length > 0 && <div className="rd-track"><i style={{ width: `${pctFunded}%` }} /></div>}
      </motion.div>

      {items.length > 0 ? (
        <motion.div className="glass panel" variants={item}>
          <TimelineViz items={items} i={i} />
          <div className="timeline">
            {items.map((x) => (
              <div className={`tl-row ${x.days <= 7 ? 'near' : ''}`} key={x.key}>
                <span className="tl-icon" style={{ background: `color-mix(in srgb, ${x.tint} ${x.days <= 7 ? 16 : 10}%, var(--surface))`, color: x.tint }}>
                  <Glyph id={x.glyph} size={18} strokeWidth={2} />
                </span>
                <div className="tl-body">
                  <p className="tl-name">{x.name}<em className="tl-tag">{x.tag}</em></p>
                  {x.kind === 'plan' && (
                    <div className="tl-fund"><span style={{ width: `${Math.round((x.funding || 0) * 100)}%`, background: x.tint }} /></div>
                  )}
                </div>
                <div className="tl-right">
                  {x.amount != null && <span className="tl-amt">{i.fmtMoney(x.amount)}</span>}
                  <span className={`tl-days ${x.days <= 7 ? 'near' : ''}`}>{i.fmtDays(x.days)}</span>
                </div>
                {x.remove && <button className="tl-x" onClick={x.remove} aria-label="Remove">×</button>}
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.p className="panel-note ahead-empty" variants={item}>{i.t('ahead.nothing')}</motion.p>
      )}

      {/* Adding something is a first-class room, not an afterthought: two
          described choices; picking one swaps the panel into a labeled form. */}
      <motion.div className="glass panel add-panel" variants={item}>
        <AnimatePresence mode="wait" initial={false}>
          {adding === null ? (
            <motion.div key="choose" className="add-rows" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
              <button className={`add-row${full ? ' add-row-locked' : ''}`} onClick={() => { if (full) { onPlus(); return; } setF(blankForm); setAdding('plan'); }}>
                <span className="add-row-ic" style={full ? undefined : { background: 'color-mix(in srgb, #0fa38f 13%, var(--surface))', color: '#0fa38f' }}>
                  <Glyph id={full ? 'lock' : 'peak'} size={18} strokeWidth={2} />
                </span>
                <span className="add-row-meta">
                  <b>{i.t('ahead.addplan')}</b>
                  <em>{i.t(full ? 'plus.ahead.full' : 'ahead.addplan.cap')}</em>
                </span>
                {full ? <PlusChip /> : <svg className="add-row-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>}
              </button>
              <button className={`add-row${full ? ' add-row-locked' : ''}`} onClick={() => { if (full) { onPlus(); return; } setF(blankForm); setAdding('sub'); }}>
                <span className="add-row-ic" style={full ? undefined : { background: `color-mix(in srgb, ${TYPE_TINTS.fixed} 13%, var(--surface))`, color: TYPE_TINTS.fixed }}>
                  <Glyph id={full ? 'lock' : 'calendar'} size={18} strokeWidth={2} />
                </span>
                <span className="add-row-meta">
                  <b>{i.t('ahead.addsub')}</b>
                  <em>{i.t(full ? 'plus.ahead.full' : 'ahead.addsub.cap')}</em>
                </span>
                {full ? <PlusChip /> : <svg className="add-row-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>}
              </button>
              {!isPlus(app) && (
                <p className="ahead-cap-note">
                  {i.t('plus.ahead.count', { n: i.fmtNum(Math.min(tracked, LIMITS.aheadItems)), t: i.fmtNum(LIMITS.aheadItems) })}
                </p>
              )}
            </motion.div>
          ) : adding === 'plan' ? (
            <motion.div key="plan" className="add-form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
              <p className="af-title">{i.t('ahead.addplan')}</p>
              <label className="lbl">{i.t('ahead.plan.name')}</label>
              <input className="af-input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <div className="af-row">
                <div className="af-col">
                  <label className="lbl">{i.t('ahead.plan.target')}</label>
                  <div className="af-amt"><span>{i.lang === 'ar' ? 'ر.س' : 'SAR'}</span><input type="number" inputMode="numeric" min="0" placeholder="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
                </div>
                <div className="af-col">
                  <label className="lbl">{i.t('ahead.plan.date')}</label>
                  <input className="af-date" type="date" min={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
                </div>
              </div>
              {planHint && <p className="af-hint">{i.t('ahead.plan.hint', { a: planHint })}</p>}
              <div className="af-actions">
                <button className="af-cancel" onClick={() => setAdding(null)}>{i.t('ahead.cancel')}</button>
                <button className="af-save" disabled={!f.name.trim() || !Number(f.amount) || !f.date} onClick={savePlan}>{i.t('ahead.save')}</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="sub" className="add-form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
              <p className="af-title">{i.t('ahead.addsub')}</p>
              <label className="lbl">{i.t('ahead.sub.name')}</label>
              <input className="af-input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <div className="af-row">
                <div className="af-col">
                  <label className="lbl">{i.t('ahead.sub.amount')}</label>
                  <div className="af-amt"><span>{i.lang === 'ar' ? 'ر.س' : 'SAR'}</span><input type="number" inputMode="numeric" min="0" placeholder="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
                </div>
                <div className="af-col">
                  <label className="lbl">{i.t('ahead.sub.due')}</label>
                  <input className="af-date" type="number" inputMode="numeric" min="1" max="31" placeholder="1-31" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
                </div>
              </div>
              <div className="af-actions">
                <button className="af-cancel" onClick={() => setAdding(null)}>{i.t('ahead.cancel')}</button>
                <button className="af-save" disabled={!f.name.trim() || !Number(f.amount)} onClick={saveSub}>{i.t('ahead.save')}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}
