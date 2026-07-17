import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUICK_ADDS, TYPE_TINTS } from './data';
import { DROPS } from './game';
import { isPlus } from './plus';
import { PlusLock, PlusChip } from './PlusSheet';
import { Glyph, NumberFlow, screen, item, spring, gel } from './ui';
import { todayISO, monthKey } from './store';
import { useI18n } from './i18n';
import { ScrollArea } from './Scrollbar';
import { getCategoryCohort } from './api';

const TYPES = [
  { id: 'fixed', icon: 'home' },
  { id: 'discretionary', icon: 'cup' },
  { id: 'savings', icon: 'trend' },
  { id: 'spike', icon: 'peak' },
];
const CATS = ['fixed', 'discretionary', 'savings', 'spike'];
// Only these two categories map to an honest Berka cohort baseline: fixed =
// tagged fixed costs, savings = income kept. The discretionary "Lifestyle"
// share is a residual proxy (untagged withdrawals), so it gets no cohort bar.
const COHORT_KEY = { fixed: 'essential', savings: 'savings' };
const typeIcon = (id) => TYPES.find((t) => t.id === id)?.icon ?? 'home';

const addMonth = (key, delta) => {
  let [y, m] = key.split('-').map(Number);
  m += delta;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
};
const dayGap = (a, b) => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};
const catSums = (list) => {
  const s = { fixed: 0, discretionary: 0, savings: 0, spike: 0 };
  for (const t of list) if (s[t.type] != null) s[t.type] += t.amount;
  return s;
};

// Spot repeating transactions: >=3 of the same desc+type, amounts within
// ~15% of the median, on a monthly/weekly cadence, still active. Honest
// pattern-matching, not "AI".
function detectRecurring(tx) {
  const groups = {};
  for (const t of tx) {
    const key = (t.desc || '').trim().toLowerCase() + '|' + t.type;
    (groups[key] ||= []).push(t);
  }
  const out = [];
  const today = todayISO();
  for (const key in groups) {
    const items = groups[key].slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (items.length < 3) continue;
    const amts = items.map((t) => t.amount).slice().sort((a, b) => a - b);
    const med = amts[Math.floor(amts.length / 2)];
    if (!items.every((t) => Math.abs(t.amount - med) <= med * 0.15)) continue;
    const gaps = [];
    for (let k = 1; k < items.length; k++) gaps.push(dayGap(items[k - 1].date, items[k].date));
    const g = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    const cadence = g >= 26 && g <= 35 ? 'monthly' : g >= 6 && g <= 8 ? 'weekly' : null;
    if (!cadence) continue;
    const last = items[items.length - 1];
    if (dayGap(last.date, today) > g * 1.6) continue; // lapsed
    out.push({ id: 'r|' + key, desc: last.desc, amount: med, cadence, type: last.type, icon: last.icon, lastDate: last.date, count: items.length });
  }
  return out.sort((a, b) => b.count - a.count);
}

// Insights+ : the deeper analytics that ship with Mowzoon+. Everything is
// computed locally from the ledger; the free plan sees it frosted under a
// lock. Module-level so re-renders don't remount the panel.
function InsightsPlus({ app, i, onPlus }) {
  const currentKey = monthKey(todayISO());
  const keys = [...Array(6)].map((_, k) => addMonth(currentKey, k - 5));
  const months = keys.map((key) => {
    const sums = catSums(app.tx.filter((t) => monthKey(t.date) === key));
    return { key, sums, total: sums.fixed + sums.discretionary + sums.savings + sums.spike };
  });
  const maxTotal = Math.max(...months.map((m) => m.total), 1);
  const monthShort = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Intl.DateTimeFormat(i.locale, { month: 'short' }).format(new Date(y, m - 1, 1));
  };

  const cur = months[5].sums;
  const prior = months.slice(2, 5); // the three months before this one
  const avgOf = (c) => {
    const vals = prior.map((m) => m.sums[c]).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
  };

  // next month, projected: the recent average of real spending. When the
  // ledger is younger than a month it falls back to this month's pace.
  const spentOf = (s) => s.fixed + s.discretionary + s.spike;
  const withData = prior.filter((m) => spentOf(m.sums) > 0);
  const proj = withData.length
    ? Math.round(withData.reduce((a, m) => a + spentOf(m.sums), 0) / withData.length)
    : spentOf(cur);
  const subsMonthly = (app.subs || [])
    .filter((s) => s.tracked && s.state !== 'cancelled')
    .reduce((a, s) => a + (s.cycle === 'weekly' ? s.amount * 4 : s.amount), 0);

  const body = (
    <>
      <span className="lbl">{i.t('insplus.trend')}</span>
      <div className="ip-bars" dir="ltr" aria-hidden="true">
        {months.map((m) => (
          <div className="ip-col" key={m.key}>
            <div className="ip-stack">
              {CATS.map((c) => m.sums[c] > 0 && (
                <i key={c} style={{ height: `${Math.max(3, (m.sums[c] / maxTotal) * 100)}%`, background: TYPE_TINTS[c] }} />
              ))}
            </div>
            <span className="ip-mon">{monthShort(m.key)}</span>
          </div>
        ))}
      </div>

      <span className="lbl">{i.t('insplus.momentum')}</span>
      <div className="ip-rows">
        {CATS.map((c) => {
          const avg = avgOf(c);
          const v = cur[c];
          if (!avg && !v) return null;
          const d = avg > 0 ? Math.round(((v - avg) / avg) * 100) : null;
          const good = c === 'savings' ? (d ?? 0) >= 0 : (d ?? 0) <= 0;
          return (
            <div className="ip-row" key={c}>
              <span className="cat-dot" style={{ background: TYPE_TINTS[c] }} />
              <span className="ip-row-name">{i.t(`type.${c}`)}</span>
              <span className="ip-row-avg">{i.t('insplus.avg', { a: i.fmtMoney(Math.round(avg || v)) })}</span>
              {d != null && d !== 0 ? (
                <b className={`ip-row-delta ${good ? 'pos' : 'neg'}`}>{d > 0 ? '↑' : '↓'} {i.fmtPct(Math.abs(d))}</b>
              ) : (
                <b className="ip-row-delta">–</b>
              )}
            </div>
          );
        })}
      </div>

      <div className="ip-forecast">
        <span className="ip-fc-meta">
          <b>{i.t('insplus.forecast')}</b>
          <em>{i.t('insplus.forecast.cap')}</em>
        </span>
        <b className="ip-fc-amt">{i.fmtMoney(proj)}</b>
      </div>
      {subsMonthly > 0 && <p className="ip-fc-subs">{i.t('insplus.forecast.subs', { a: i.fmtMoney(subsMonthly) })}</p>}
    </>
  );

  return (
    <motion.div className="glass panel ip-panel" variants={item}>
      <div className="panel-h">
        <p className="panel-title ip-title" style={{ margin: 0 }}>{i.t('insplus.title')}<i>+</i></p>
        {!isPlus(app) && <PlusChip onClick={onPlus} />}
      </div>
      {isPlus(app) ? body : <PlusLock label={i.t('plus.lock.insights')} onPlus={onPlus}>{body}</PlusLock>}
    </motion.div>
  );
}

export default function Ledger({ app, setApp, monthTx, profile, onLoadSample, onPlus }) {
  const i = useI18n();
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('discretionary');
  const [icon, setIcon] = useState(null);
  const [noteFor, setNoteFor] = useState(null);

  // Typical income mix for the user's archetype, from the real Berka cohort.
  // Only used when the model has actually classified them (profile.model);
  // null (server offline) just hides the comparison
  const [cohort, setCohort] = useState(null);
  useEffect(() => {
    let alive = true;
    getCategoryCohort().then((d) => alive && setCohort(d));
    return () => { alive = false; };
  }, []);
  const cohortRow = cohort && profile?.model ? cohort.cohorts?.[String(profile.model.id)] : null;

  const currentKey = monthKey(todayISO());
  const [sel, setSel] = useState(currentKey);

  const dayLabel = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(i.locale, { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d));
  };
  const monthLabel = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Intl.DateTimeFormat(i.locale, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  };

  const hasDemo = app.tx.some((t) => t.demo);
  const earliest = app.tx.length ? app.tx.reduce((min, t) => (monthKey(t.date) < min ? monthKey(t.date) : min), currentKey) : currentKey;

  // selected month
  const selTx = useMemo(() => app.tx.filter((t) => monthKey(t.date) === sel), [app.tx, sel]);
  const sums = catSums(selTx);
  const prevSums = catSums(app.tx.filter((t) => monthKey(t.date) === addMonth(sel, -1)));
  const income = app.incomeByMonth?.[sel] ?? app.income;
  const spent = sums.fixed + sums.discretionary + sums.spike;
  const saved = sums.savings;
  const allocated = spent + saved;
  const left = income - allocated;
  const unspent = Math.max(0, left);
  const denom = Math.max(income, allocated, 1);

  const discShare = income > 0 ? sums.discretionary / income : 0;
  const insight = profile && discShare > 0.25
    ? i.t('spend.insight', { cat: i.t('type.discretionary'), p: i.fmtPct(Math.round(discShare * 100)), metric: i.t('metric.eq'), v: i.fmtNum(Math.round(profile.metrics.eq)) })
    : null;

  // recurring detection
  const recurring = useMemo(() => detectRecurring(app.tx), [app.tx]);
  const trackedNames = new Set((app.subs || []).map((x) => (x.name || '').toLowerCase()));
  const dismissed = new Set(app.recurring?.dismissed || []);
  const offer = recurring.find((r) => !trackedNames.has(r.desc.toLowerCase()) && !dismissed.has(r.id));

  const trackSub = (r) => setApp((s) => {
    const dueDay = r.cadence === 'monthly' ? Number(r.lastDate.split('-')[2]) : r.lastDate;
    const sub = { id: 'sub-' + r.type + '-' + Date.parse(r.lastDate) + '-' + r.desc.toLowerCase(), name: r.desc, amount: r.amount, cycle: r.cadence, dueDay, state: 'keep', source: 'detected', icon: r.icon, tracked: true };
    return { ...s, subs: [sub, ...(s.subs || [])] };
  });
  const dismissRec = (r) => setApp((s) => ({ ...s, recurring: { ...(s.recurring || {}), dismissed: [...((s.recurring && s.recurring.dismissed) || []), r.id] } }));

  const add = (e) => {
    e?.preventDefault();
    const amt = Math.round(Number(amount));
    if (!amt || amt <= 0) return;
    setApp((s) => ({
      ...s,
      tx: [{ desc: desc.trim() || i.t(`type.${type}`), amount: amt, type, icon: icon ?? typeIcon(type), date: todayISO(), id: s.nextId }, ...s.tx],
      nextId: s.nextId + 1,
      // every entry pays a few drops
      game: { ...s.game, drops: s.game.drops + DROPS.log },
    }));
    setDesc(''); setAmount(''); setIcon(null); setSel(currentKey);
  };
  const prefill = (q) => { setDesc(i.desc(q.desc)); setAmount(String(q.amount)); setType(q.type); setIcon(q.icon); };
  const remove = (id) => setApp((s) => ({ ...s, tx: s.tx.filter((t) => t.id !== id) }));
  const setNote = (id, note) => setApp((s) => ({ ...s, tx: s.tx.map((t) => (t.id === id ? { ...t, note: note.trim() } : t)) }));

  const selSorted = [...selTx].sort((a, b) => (a.date === b.date ? b.id - a.id : b.date > a.date ? 1 : -1));

  const deltaFor = (key) => {
    const prev = prevSums[key];
    if (!prev) return null;
    const d = Math.round(((sums[key] - prev) / prev) * 100);
    if (d === 0) return null;
    const good = key === 'savings' ? d > 0 : d < 0;
    return { d, good };
  };

  return (
    <motion.section className="sim spend" variants={screen} initial="initial" animate="animate" exit="exit">
      <motion.header className="sim-head spend-head" variants={item}>
        <div>
          <h1>{i.t('spend.title')}</h1>
          <p>{i.t('spend.sub')}</p>
        </div>
        <div className="month-switch">
          <button className="ms-btn" disabled={sel <= earliest} onClick={() => setSel((k) => addMonth(k, -1))} aria-label="Previous month">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <span className="ms-label">{sel === currentKey ? i.t('ledger.month') : monthLabel(sel)}</span>
          <button className="ms-btn" disabled={sel >= currentKey} onClick={() => setSel((k) => addMonth(k, 1))} aria-label="Next month">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </motion.header>

      {hasDemo && (
        <motion.div className="demo-note glass-lite" variants={item}>
          <span className="demo-dot" aria-hidden="true" />
          {i.t('ledger.demo')}
          <button onClick={() => setApp((s) => ({ ...s, tx: s.tx.filter((t) => !t.demo) }))}>{i.t('ledger.demo.remove')}</button>
        </motion.div>
      )}

      <motion.div className="stats sim-stats" variants={item}>
        <div className="stat glass-lite"><b style={{ color: 'var(--neg)' }}><NumberFlow value={spent} duration={0.5} format={i.fmtMoney} /></b><span>{i.t('home.spent')}</span></div>
        <div className="stat glass-lite"><b style={{ color: 'var(--pos)' }}><NumberFlow value={saved} duration={0.5} format={i.fmtMoney} /></b><span>{i.t('home.saved')}</span></div>
        <div className={`stat glass-lite ${left < 0 ? 'neg' : ''}`}><b>{left < 0 && '-'}<NumberFlow value={Math.abs(left)} duration={0.5} format={i.fmtMoney} /></b><span>{i.t('home.left')}</span></div>
      </motion.div>

      {/* income breakdown */}
      <motion.div className="glass panel" variants={item}>
        <div className="panel-h">
          <p className="panel-title" style={{ margin: 0 }}>{i.t('spend.breakdown')}</p>
          <span className="of-income">{i.t('spend.of', { a: i.fmtMoney(income) })}</span>
        </div>
        <div className="stacked" role="img" aria-label="Spending by category as a share of income">
          {CATS.map((k) => sums[k] > 0 && (
            <span key={k} className="stk-seg" style={{ width: `${(sums[k] / denom) * 100}%`, background: TYPE_TINTS[k] }} title={i.t(`type.${k}`)} />
          ))}
          {unspent > 0 && <span className="stk-seg stk-unspent" style={{ width: `${(unspent / denom) * 100}%` }} title={i.t('spend.unspent')} />}
        </div>
        <div className="cat-rows">
          {CATS.map((k) => {
            const delta = deltaFor(k);
            const pct = income > 0 ? Math.round((sums[k] / income) * 100) : 0;
            const ck = COHORT_KEY[k];
            const cPct = ck && cohortRow && cohortRow[ck] != null ? Math.round(cohortRow[ck] * 100) : null;
            const showCohort = cPct != null && income > 0;
            return (
              <div className={`cat-row ${sums[k] === 0 ? 'zero' : ''}`} key={k}>
                <div className="cat-line">
                  <span className="cat-dot" style={{ background: TYPE_TINTS[k] }} />
                  <span className="cat-name">{i.t(`type.${k}`)}<em>{i.fmtPct(pct)}</em></span>
                  {delta && <span className={`cat-delta ${delta.good ? 'pos' : 'neg'}`}>{delta.d > 0 ? '↑' : '↓'} {i.fmtPct(Math.abs(delta.d))}</span>}
                  <span className="cat-amt" style={{ color: sums[k] ? TYPE_TINTS[k] : 'var(--ink-3)' }}>{i.fmtMoney(sums[k])}</span>
                </div>
                {showCohort && (
                  <div className="cohort-line" aria-label={i.t('spend.cohort.aria', { u: i.fmtPct(pct), c: i.fmtPct(cPct) })}>
                    <div className="cohort-track" aria-hidden="true">
                      <span className="cohort-fill" style={{ width: `${Math.min(100, pct)}%`, background: TYPE_TINTS[k] }} />
                      <span className="cohort-mark" style={{ insetInlineStart: `${Math.min(100, Math.max(0, cPct))}%` }} />
                    </div>
                    <span className="cohort-cap">{i.t('spend.cohort', { p: i.fmtPct(cPct) })}</span>
                  </div>
                )}
              </div>
            );
          })}
          {unspent > 0 && (
            <div className="cat-row">
              <div className="cat-line">
                <span className="cat-dot cat-dot-unspent" />
                <span className="cat-name">{i.t('spend.unspent')}</span>
                <span className="cat-amt" style={{ color: 'var(--ink-2)' }}>{i.fmtMoney(unspent)}</span>
              </div>
            </div>
          )}
        </div>
        {insight && <p className="spend-insight"><Glyph id="bell" size={15} />{insight}</p>}
      </motion.div>

      {/* deeper analytics, part of Mowzoon+ */}
      <InsightsPlus app={app} i={i} onPlus={onPlus} />

      {/* Log */}
      <motion.div className="glass panel" variants={item}>
        <label className="lbl" htmlFor="income">{i.t('ledger.income')}</label>
        <div className="field">
          <span>{i.lang === 'ar' ? 'ر.س' : 'SAR'}</span>
          <input id="income" type="number" inputMode="numeric" min="0" value={app.income} onChange={(e) => setApp((s) => {
            // keep the current month's entry in step, like onboarding does;
            // Ledger/engine/bank all read incomeByMonth first
            const inc = Number(e.target.value);
            return { ...s, income: inc, incomeByMonth: { ...s.incomeByMonth, [monthKey(todayISO())]: inc } };
          })} />
        </div>

        <span className="lbl">{i.t('spend.log')}</span>
        <form className="lform" onSubmit={add}>
          <div className="lform-row">
            <input className="lform-desc" type="text" placeholder={i.t('ledger.what')} aria-label="Description" value={desc} onChange={(e) => { setDesc(e.target.value); setIcon(null); }} />
            <div className="lform-amt">
              <span>{i.lang === 'ar' ? 'ر.س' : 'SAR'}</span>
              <input type="number" inputMode="numeric" min="0" placeholder="0" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="tchips" role="radiogroup" aria-label="Category">
            {TYPES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={type === t.id}
                className={`tchip ${type === t.id ? 'on' : ''}`}
                style={type === t.id ? { background: `color-mix(in srgb, ${TYPE_TINTS[t.id]} 13%, var(--surface))`, color: TYPE_TINTS[t.id], borderColor: `color-mix(in srgb, ${TYPE_TINTS[t.id]} 35%, transparent)` } : undefined}
                onClick={() => { setType(t.id); setIcon(null); }}>
                <i style={{ background: TYPE_TINTS[t.id] }} />{i.t(`type.${t.id}`)}
              </button>
            ))}
          </div>
          <motion.button type="submit" className="lform-add" whileTap={{ scale: 0.97 }} transition={gel} disabled={!Number(amount)}>
            <Glyph id="plus" size={15} strokeWidth={2.3} />{i.t('ledger.add')}
          </motion.button>
        </form>

        {offer && (
          <div className="rec-offer">
            <Glyph id="calendar" size={17} strokeWidth={2} />
            <span className="rec-text">{i.t('spend.recurring.offer', { name: offer.desc, a: i.fmtMoney(offer.amount), cycle: i.t(`cycle.${offer.cadence}`) })}</span>
            <button className="rec-track" onClick={() => trackSub(offer)}>{i.t('spend.recurring.track')}</button>
            <button className="rec-no" onClick={() => dismissRec(offer)}>{i.t('spend.recurring.no')}</button>
          </div>
        )}

        <span className="lbl">{i.t('ledger.quick')}</span>
        <div className="chips">
          {recurring.slice(0, 3).map((r) => (
            <motion.button key={r.id} className="chip chip-rec" whileTap={{ scale: 0.93 }} whileHover={{ y: -2 }} transition={gel} onClick={() => prefill({ desc: r.desc, amount: r.amount, type: r.type, icon: r.icon })}>
              <span className="chip-icon" style={{ background: `color-mix(in srgb, ${TYPE_TINTS[r.type]} 12%, var(--surface))`, color: TYPE_TINTS[r.type] }}>
                <Glyph id="calendar" size={16} strokeWidth={2} />
              </span>
              <span className="chip-name">{r.desc}<em>{i.t('spend.repeating')}</em></span>
              <span className="chip-amt">{i.fmtMoney(r.amount)}</span>
            </motion.button>
          ))}
          {QUICK_ADDS.map((q) => (
            <motion.button key={q.desc} className="chip" whileTap={{ scale: 0.93 }} whileHover={{ y: -2 }} transition={gel} onClick={() => prefill(q)}>
              <span className="chip-icon" style={{ background: `color-mix(in srgb, ${TYPE_TINTS[q.type]} 12%, var(--surface))`, color: TYPE_TINTS[q.type] }}>
                <Glyph id={q.icon} size={17} strokeWidth={2} />
              </span>
              <span className="chip-name">{i.desc(q.desc)}</span>
              <span className="chip-amt">{i.fmtMoney(q.amount)}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* History for the selected month */}
      <motion.div className="glass panel" variants={item}>
        <span className="lbl">{i.t('ledger.history')} · {sel === currentKey ? i.t('ledger.month') : monthLabel(sel)}</span>
        <ScrollArea className="ledger">
          {selSorted.length === 0 && (
            <div className="ledger-blank">
              <p className="ledger-empty">{i.t('ledger.empty')}</p>
              {app.tx.length === 0 && <button className="ledger-sample" onClick={onLoadSample}>{i.t('ledger.sample')}</button>}
            </div>
          )}
          <AnimatePresence initial={false}>
            {selSorted.map((t) => (
              <motion.div layout="position" key={t.id} className="ledger-item"
                initial={{ opacity: 0, y: -14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 28, transition: { duration: 0.18 } }}
                transition={{ ...spring, layout: { duration: 0.22, ease: 'easeOut' } }}>
                <span className="ledger-ico" style={{ background: `color-mix(in srgb, ${TYPE_TINTS[t.type]} 11%, var(--surface))`, color: TYPE_TINTS[t.type] }}>
                  <Glyph id={t.icon} size={14} strokeWidth={2.1} />
                </span>
                <span className="ledger-desc">
                  {t.desc}
                  {t.recurringId && <span className="rec-badge" title={i.t('spend.repeating')}><Glyph id="calendar" size={11} strokeWidth={2.2} /></span>}
                  <em>{dayLabel(t.date)}{t.note ? ` · ${t.note}` : ''}</em>
                </span>
                <button className="note-btn" aria-label={i.t('spend.note')} onClick={() => setNoteFor(noteFor === t.id ? null : t.id)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M13.5 7.5l3 3" /></svg>
                </button>
                <span className="amt" style={{ color: TYPE_TINTS[t.type] }}>{t.type === 'savings' ? '+' : '-'}{i.fmtMoney(t.amount)}</span>
                <button className="x-btn" aria-label={`Remove ${t.desc}`} onClick={() => remove(t.id)}>×</button>
                {noteFor === t.id && (
                  <input className="note-input" autoFocus defaultValue={t.note || ''} placeholder={i.t('spend.note')}
                    onBlur={(e) => { setNote(t.id, e.target.value); setNoteFor(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setNote(t.id, e.target.value); setNoteFor(null); } }} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>
      </motion.div>
    </motion.section>
  );
}
