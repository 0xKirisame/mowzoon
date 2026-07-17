import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TYPE_TINTS } from './data';
import { Glyph, screen, item, spring } from './ui';
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

// Timeline strip: upcoming items as dots sized by cost, today at the left
// edge. Decorative (aria-hidden); the list below carries the details.
function TimelineViz({ items, i }) {
  const W = 600;
  const H = 72;
  const PX = 18;
  const BASE = 40;
  const horizon = Math.max(60, Math.min(Math.max(...items.map((x) => x.days)) + 12, 130));
  const maxAmt = Math.max(...items.map((x) => x.amount || 0), 1);
  const x = (d) => PX + (Math.min(d, horizon) / horizon) * (W - PX * 2);
  const r = (a) => (a ? 5 + Math.sqrt(a / maxAmt) * 5.5 : 5);
  const ticks = [30, 60, 90, 120].filter((t) => t <= horizon - 8);
  return (
    <div className="tl-viz" dir="ltr" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line className="tlv-axis" x1={PX} y1={BASE} x2={W - PX} y2={BASE} />
        <line className="tlv-today" x1={PX} y1={BASE - 14} x2={PX} y2={BASE + 8} />
        <text className="tlv-lab tlv-now" x={PX} y={BASE + 24}>{i.fmtDays(0)}</text>
        {ticks.map((t) => (
          <g key={t}>
            <line className="tlv-tick" x1={x(t)} y1={BASE - 4} x2={x(t)} y2={BASE + 4} />
            <text className="tlv-lab" x={x(t)} y={BASE + 24}>{i.fmtNum(t)}</text>
          </g>
        ))}
        {(() => {
          // items past the horizon pin at the edge; spread and dim them
          // so far-off dates don't stack into one blob
          let pinned = 0;
          return items.map((it) => {
            const beyond = it.days > horizon;
            const cx = beyond ? W - PX - 13 * pinned++ : x(it.days);
            const rr = r(it.amount);
            const ring = rr + 4;
            const C = 2 * Math.PI * ring;
            return (
              <g key={it.key} opacity={beyond ? 0.4 : 1}>
                {it.kind === 'plan' && (
                  <>
                    <circle className="tlv-ring-track" cx={cx} cy={BASE} r={ring} />
                    <circle
                      className="tlv-ring"
                      cx={cx}
                      cy={BASE}
                      r={ring}
                      style={{ stroke: it.tint }}
                      strokeDasharray={`${(it.funding || 0) * C} ${C}`}
                      transform={`rotate(-90 ${cx} ${BASE})`}
                    />
                  </>
                )}
                <circle className={`tlv-dot ${it.days <= 7 ? 'near' : ''}`} cx={cx} cy={BASE} r={rr} style={{ fill: it.tint }} />
              </g>
            );
          });
        })()}
      </svg>
    </div>
  );
}

// Ahead: spike forecast, tracked subscriptions, and plans merged into
// one dated timeline. Set-aside is derived from logged savings.
export default function Horizon({ profile, app, setApp }) {
  const i = useI18n();
  const id = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const [data, setData] = useState(() => (app.nudge?.spikes ? { spikes: app.nudge.spikes } : null));
  const [adding, setAdding] = useState(null); // 'plan' | 'sub' | null
  const blankForm = { name: '', amount: '', date: '', due: '', cycle: 'monthly' };
  const [f, setF] = useState(blankForm);

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
    const target = Math.round(Number(f.amount));
    if (!f.name.trim() || !target || !f.date) return;
    setApp((s) => ({ ...s, plans: [...(s.plans || []), { id: 'p' + s.nextId, name: f.name.trim(), target, date: f.date, icon: 'peak', setAside: { weekly: weeklyFor(target, f.date), startedISO: todayISO() } }], nextId: s.nextId + 1 }));
    setAdding(null); setF(blankForm);
  };
  const saveSub = () => {
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
              <button className="add-row" onClick={() => { setF(blankForm); setAdding('plan'); }}>
                <span className="add-row-ic" style={{ background: 'color-mix(in srgb, #0fa38f 13%, var(--surface))', color: '#0fa38f' }}>
                  <Glyph id="peak" size={18} strokeWidth={2} />
                </span>
                <span className="add-row-meta">
                  <b>{i.t('ahead.addplan')}</b>
                  <em>{i.t('ahead.addplan.cap')}</em>
                </span>
                <svg className="add-row-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </button>
              <button className="add-row" onClick={() => { setF(blankForm); setAdding('sub'); }}>
                <span className="add-row-ic" style={{ background: `color-mix(in srgb, ${TYPE_TINTS.fixed} 13%, var(--surface))`, color: TYPE_TINTS.fixed }}>
                  <Glyph id="calendar" size={18} strokeWidth={2} />
                </span>
                <span className="add-row-meta">
                  <b>{i.t('ahead.addsub')}</b>
                  <em>{i.t('ahead.addsub.cap')}</em>
                </span>
                <svg className="add-row-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </button>
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
