// Transfer / Payments / Store / Services views, the action sheets, and the
// small shared pieces. Every money action confirms into the shared ledger,
// which is what makes the Mowzoon integration real: the coach re-reads the
// account the moment something happens here.

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Glyph, LiquidMark, screen, item, spring } from '../ui';
import { BIcon, Riyal, SadadWord } from './inma';
import { recentActivity, currentBalance, ACCOUNT_NO, IBAN, fmtIban, FX } from './bankData';

export function Chev() {
  return (
    <span className="bk-row-chev bk-chev-flip">
      <BIcon id="chev" size={15} strokeWidth={2.3} />
    </span>
  );
}

export function CardLink({ onClick, label }) {
  return (
    <button className="bk-card-link" onClick={onClick}>
      {label}
      <span className="bk-chev-flip"><BIcon id="chev" size={13} strokeWidth={2.6} /></span>
    </button>
  );
}

// ── activity feed (the ledger, seen from the bank side) ──────────

export function ActivityCard({ app, i, onOpenMowzoon, title }) {
  const rows = recentActivity(app, 6);
  const dayLabel = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(i.locale, { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d));
  };
  return (
    <div className="bk-card">
      <span className="bk-card-kick"><BIcon id="history" size={13} strokeWidth={2.4} />{title || i.t('bank.act.title')}</span>
      {rows.length === 0 ? (
        <p className="bk-act-empty">{i.t('bank.act.empty')}</p>
      ) : (
        <div className="bk-act-rows">
          {rows.map((t) => (
            <button className="bk-act-row" key={t.id} onClick={() => onOpenMowzoon('spending')}>
              <span className="bk-act-ic"><Glyph id={t.icon || 'cart'} size={17} strokeWidth={2} /></span>
              <span className="bk-act-meta">
                <b>{i.desc(t.desc)}</b>
                <em>{dayLabel(t.date)}{t.demo ? ` · ${i.t('bank.act.demoTag')}` : ''}</em>
              </span>
              <span className={`bk-act-amt ${t.type === 'savings' ? 'save' : ''}`} dir="ltr">
                {t.type === 'savings' ? '' : '-'}{i.fmtNum(t.amount)}
              </span>
            </button>
          ))}
        </div>
      )}
      <CardLink onClick={() => onOpenMowzoon('spending')} label={i.t('bank.act.link')} />
    </div>
  );
}

// ── Transfer ─────────────────────────────────────────────────────

export function TransferView({ app, i, openSheet, toast, onOpenMowzoon }) {
  const TYPES = [
    { id: 'between', icon: 'repeat', k: 'bank.tr.between', sub: 'bank.tr.betweenSub' },
    { id: 'transfer', icon: 'alinma', k: 'bank.tr.within', sub: 'bank.tr.withinSub' },
    { id: 'transfer2', icon: 'bankHouse', k: 'bank.tr.local', sub: 'bank.tr.localSub' },
    { id: 'intl', icon: 'globe', k: 'bank.tr.intl', sub: 'bank.tr.intlSub' },
    { id: 'donate', icon: 'charity', k: 'bank.tr.charity', sub: 'bank.tr.charitySub' },
  ];
  return (
    <motion.div key="transfer" variants={screen} initial="initial" animate="animate" exit="exit">
      <div className="bk-page-head">
        <h2>{i.t('bank.tab.transfer')}</h2>
        <div className="bk-top-actions">
          <button className="bk-iconbtn" aria-label={i.t('bank.a11y.history')} onClick={() => onOpenMowzoon('spending')}>
            <BIcon id="history" size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="bk-two-col">
        <div>
          <motion.div variants={item}>
            <p className="bk-list-h" style={{ marginTop: 0 }}>{i.t('bank.tr.favs')}</p>
            <div className="bk-list">
              <div className="bk-empty">
                <BIcon id="personStar" size={30} strokeWidth={1.7} />
                <b>{i.t('bank.tr.noFavs')}</b>
                <button onClick={() => toast('personStar', i.t('bank.demo'))}>{i.t('bank.tr.howAdd')}</button>
              </div>
            </div>
          </motion.div>

          <motion.div variants={item}>
            <div className="bk-list" style={{ marginTop: 14 }}>
              <button className="bk-rowbtn" onClick={() => openSheet({ kind: 'transfer' })}>
                <span className="bk-row-ic accent"><BIcon id="flash" size={21} strokeWidth={1.9} /></span>
                <span className="bk-row-meta">
                  <b>{i.t('bank.tr.quick')}</b>
                  <em>{i.t('bank.tr.quickSub')}</em>
                </span>
                <Chev />
              </button>
            </div>
          </motion.div>

          <motion.div variants={item}>
            <p className="bk-list-h">{i.t('bank.tr.types')}</p>
            <div className="bk-list">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  className="bk-rowbtn"
                  onClick={() =>
                    t.id === 'intl'
                      ? toast('globe', i.t('bank.demo'))
                      : openSheet({ kind: t.id === 'transfer2' ? 'transfer' : t.id })}
                >
                  <span className="bk-row-ic"><BIcon id={t.icon} size={20} strokeWidth={1.9} /></span>
                  <span className="bk-row-meta">
                    <b>{i.t(t.k)}</b>
                    <em>{i.t(t.sub)}</em>
                  </span>
                  <Chev />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
        <motion.div variants={item}>
          <ActivityCard app={app} i={i} onOpenMowzoon={onOpenMowzoon} title={i.t('bank.tr.recent')} />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Payments ─────────────────────────────────────────────────────

export function PaymentsView({ app, i, openSheet, toast, onOpenMowzoon }) {
  const [chip, setChip] = useState('sadad');
  const TILES = [
    { id: 'bill', icon: <BIcon id="billDoc" size={23} strokeWidth={1.8} />, k: 'bank.pay.addBill' },
    { id: 'onetime', icon: <BIcon id="cardUp" size={23} strokeWidth={1.8} />, k: 'bank.pay.oneTime' },
    { id: 'violation', icon: <Glyph id="car" size={23} strokeWidth={1.8} />, k: 'bank.pay.violations' },
    { id: 'gov', icon: <BIcon id="ksa" size={23} strokeWidth={1.8} />, k: 'bank.pay.gov' },
    { id: 'sadad', icon: <SadadWord />, k: 'bank.pay.aggregator' },
    { id: 'recurring', icon: <BIcon id="repeat" size={23} strokeWidth={1.8} />, k: 'bank.pay.recurring', mz: true },
  ];
  const onTile = (t) => {
    if (t.id === 'recurring') return onOpenMowzoon('ahead'); // subscriptions live with the coach
    if (t.id === 'sadad') return toast('receipt', i.t('bank.demo'));
    if (t.id === 'onetime' || t.id === 'bill') return openSheet({ kind: 'bill' });
    return openSheet({ kind: t.id });
  };
  return (
    <motion.div key="payments" variants={screen} initial="initial" animate="animate" exit="exit">
      <div className="bk-page-head"><h2>{i.t('bank.tab.payments')}</h2></div>

      <motion.div className="bk-chips" variants={item}>
        <button className={`bk-chip ${chip === 'sadad' ? 'on' : ''}`} onClick={() => setChip('sadad')}>
          <SadadWord /> SADAD
        </button>
        <button className={`bk-chip ${chip === 'recharge' ? 'on' : ''}`} onClick={() => { setChip('recharge'); openSheet({ kind: 'recharge' }); }}>
          <BIcon id="phone" size={15} strokeWidth={2.1} />{i.t('bank.quick.recharge')}
        </button>
        <button className={`bk-chip ${chip === 'pay' ? 'on' : ''}`} onClick={() => { setChip('pay'); toast('card', i.t('bank.demo')); }}>
          <BIcon id="alinma" size={15} strokeWidth={2.1} />alinma pay
        </button>
      </motion.div>

      <motion.div className="bk-tiles" variants={item}>
        {TILES.map((t) => (
          <button key={t.id} className="bk-tile" onClick={() => onTile(t)}>
            {t.icon}
            <span className="bk-tile-label">
              {i.t(t.k)}
              {t.mz && <em style={{ display: 'block', fontStyle: 'normal', fontSize: 10.5, color: 'var(--bk-mz-ink)', fontWeight: 600 }}>{i.t('bank.pay.inMowzoon')}</em>}
            </span>
          </button>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <div className="bk-list" style={{ marginTop: 16 }}>
          <div className="bk-empty">
            <BIcon id="billDoc" size={30} strokeWidth={1.7} />
            <b>{i.t('bank.pay.noBills')}</b>
            <span style={{ fontSize: 12.5 }}>{i.t('bank.pay.noBillsSub')}</span>
            <button onClick={() => openSheet({ kind: 'bill' })}>+ {i.t('bank.pay.firstBill')}</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Store ────────────────────────────────────────────────────────

export function StoreView({ i, toast }) {
  const CARDS = [
    { id: 'esim', icon: 'esim', k: 'bank.store.esim', sub: 'bank.store.esimSub', deep: true },
    { id: 'ins', icon: 'shieldPlus', k: 'bank.store.ins', sub: 'bank.store.insSub' },
    { id: 'devices', icon: 'phone', k: 'bank.store.devices', sub: 'bank.store.devicesSub' },
    { id: 'fantasy', icon: 'flash', k: 'bank.store.fantasy', sub: 'bank.store.fantasySub', deep: true },
  ];
  return (
    <motion.div key="store" variants={screen} initial="initial" animate="animate" exit="exit">
      <div className="bk-page-head"><h2>{i.t('bank.tab.store')}</h2></div>
      <motion.div className="bk-store-grid" variants={item}>
        {CARDS.map((c) => (
          <button key={c.id} className={`bk-store-card ${c.deep ? 'deep' : ''}`} onClick={() => toast(c.icon, i.t('bank.demo'))}>
            <span className="bk-store-ic"><BIcon id={c.icon} size={23} strokeWidth={1.8} /></span>
            <b>{i.t(c.k)}</b>
            <p>{i.t(c.sub)}</p>
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ── Services ─────────────────────────────────────────────────────

export function ServicesView({ i, openSheet, toast, onOpenMowzoon }) {
  const TILES = [
    { id: 'accounts', icon: 'person', k: 'bank.svc.accounts', sheet: 'account' },
    { id: 'cards', icon: 'card', k: 'bank.svc.cards' },
    { id: 'finance', icon: 'coins', k: 'bank.svc.finance', sheet: 'finance' },
    { id: 'saving', icon: 'moneybag', k: 'bank.svc.saving', sheet: 'between' },
    { id: 'invest', icon: 'banknote', k: 'bank.svc.invest' },
    { id: 'family', icon: 'person', mz: true, k: 'bank.svc.family' },
    { id: 'akthr', icon: 'akthr', k: 'akthr', raw: 'akthr' },
    { id: 'cert', icon: 'certificate', k: 'bank.svc.cert' },
    { id: 'tracker', icon: 'tracker', k: 'bank.svc.tracker' },
    { id: 'insurance', icon: 'shieldPlus', k: 'bank.svc.insurance' },
  ];
  const ROWS = [
    { id: 'cash', icon: 'cashOut', k: 'bank.svc.cash' },
    { id: 'converter', icon: 'repeat', k: 'bank.svc.converter', sheet: 'converter' },
    { id: 'rates', icon: 'coins', k: 'bank.svc.rates', sheet: 'rates' },
  ];
  return (
    <motion.div key="services" variants={screen} initial="initial" animate="animate" exit="exit">
      <div className="bk-page-head"><h2>{i.t('bank.tab.services')}</h2></div>

      {/* Mowzoon, as an alinma service */}
      <motion.button className="bk-mz-tile" variants={item} onClick={() => onOpenMowzoon()}>
        <span className="bk-mz-orb"><LiquidMark size={30} /></span>
        <span>
          <b>{i.lang === 'ar' ? 'موزون' : 'Mowzoon'}</b>
          <p>{i.t('bank.svc.mowzoonSub')}</p>
        </span>
        <span className="bk-mz-new">{i.t('bank.svc.new')}</span>
      </motion.button>

      <motion.div className="bk-tiles" variants={item}>
        {TILES.map((t) => (
          <button
            key={t.id}
            className="bk-tile"
            onClick={() => (t.sheet ? openSheet({ kind: t.sheet }) : toast(t.icon, i.t('bank.demo')))}
          >
            {t.mz ? <Glyph id="people" size={23} strokeWidth={1.8} /> : <BIcon id={t.icon} size={23} strokeWidth={1.8} />}
            <span className="bk-tile-label">{t.raw || i.t(t.k)}</span>
          </button>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <div className="bk-list" style={{ marginTop: 16 }}>
          {ROWS.map((r) => (
            <button key={r.id} className="bk-rowbtn" onClick={() => (r.sheet ? openSheet({ kind: r.sheet }) : toast(r.icon, i.t('bank.demo')))}>
              <span className="bk-row-ic"><BIcon id={r.icon} size={20} strokeWidth={1.9} /></span>
              <span className="bk-row-meta"><b>{i.t(r.k)}</b></span>
              <Chev />
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Notifications ────────────────────────────────────────────────

export function NotifPop({ at, app, profile, i, onClose, onOpenMowzoon }) {
  const pid = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const eng = app.insights && pid != null && app.insights.aid === pid ? app.insights : null;
  const mzLine = eng?.list?.length
    ? i.insight(eng.list[0].insight_key, eng.list[0].signal)
    : i.t('bank.notif.mzFallback');
  return (
    <>
      <div className="bk-pop-backdrop" onClick={onClose} />
      <motion.div
        className="bk-notif-pop"
        style={{ top: at.top, left: at.left }}
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.14 } }}
        transition={spring}
      >
        <p className="bk-list-h">{i.t('bank.notif.title')}</p>
        <button className="bk-notif-row" onClick={() => { onClose(); onOpenMowzoon(); }}>
          <span className="bk-act-ic" style={{ color: 'var(--bk-mz-ink)' }}><LiquidMark size={19} /></span>
          <span>
            <b>{i.lang === 'ar' ? 'موزون' : 'Mowzoon'}</b>
            <p>{mzLine}</p>
            <em>{i.t('bank.notif.now')}</em>
          </span>
        </button>
        <button className="bk-notif-row" onClick={onClose}>
          <span className="bk-act-ic"><BIcon id="akthr" size={17} /></span>
          <span>
            <b>akthr</b>
            <p>{i.t('bank.notif.akthr')}</p>
            <em>{i.t('bank.notif.today')}</em>
          </span>
        </button>
        <button className="bk-notif-row" onClick={onClose}>
          <span className="bk-act-ic"><Glyph id="shield" size={17} strokeWidth={2} /></span>
          <span>
            <b>{i.t('bank.notif.secT')}</b>
            <p>{i.t('bank.notif.sec')}</p>
            <em>{i.t('bank.notif.today')}</em>
          </span>
        </button>
      </motion.div>
    </>
  );
}

// ── Action sheets ────────────────────────────────────────────────

// per-kind config: fields, chips, and how the confirmed action lands
// in the ledger (desc key, category type, glyph)
const SHEETS = {
  transfer: {
    title: 'bank.sh.transfer', icon: 'flash',
    name: 'bank.sh.beneficiary', namePh: 'bank.sh.beneficiaryPh',
    descKey: 'bank.txd.transfer', joinName: true, type: 'discretionary', glyph: 'people',
  },
  between: {
    title: 'bank.tr.between', icon: 'repeat',
    note: 'bank.sh.betweenNote',
    descKey: 'bank.txd.tosavings', type: 'savings', glyph: 'trend',
  },
  bill: {
    title: 'bank.sh.bill', icon: 'billDoc',
    chips: [
      { id: 'elec', k: 'bank.biller.elec', glyph: 'bolt' },
      { id: 'water', k: 'bank.biller.water', glyph: 'home' },
      { id: 'net', k: 'bank.biller.net', glyph: 'link' },
      { id: 'mobile', k: 'bank.biller.mobile', glyph: 'bell' },
    ],
    descFromChip: (c) => `bank.txd.bill.${c}`, type: 'fixed',
  },
  recharge: {
    title: 'bank.quick.recharge', icon: 'sim',
    name: 'bank.sh.mobileNo', namePh: 'bank.sh.mobilePh', nameLtr: true, joinName: true,
    presets: [30, 50, 100],
    descKey: 'bank.txd.recharge', type: 'fixed', glyph: 'bolt',
  },
  violation: {
    title: 'bank.quick.violations', icon: 'car',
    name: 'bank.sh.violRef', namePh: 'bank.sh.violRefPh', nameLtr: true, joinName: true,
    descKey: 'bank.txd.violation', type: 'spike', glyph: 'car',
  },
  donate: {
    title: 'bank.tr.charity', icon: 'charity',
    chips: [
      { id: 'ehsan', k: 'bank.org.ehsan', glyph: 'spark' },
      { id: 'food', k: 'bank.org.food', glyph: 'cup' },
      { id: 'orphans', k: 'bank.org.orphans', glyph: 'people' },
    ],
    descFromChip: () => 'bank.txd.donation', type: 'discretionary', glyphFromChip: true,
  },
  gov: {
    title: 'bank.pay.gov', icon: 'ksa',
    chips: [
      { id: 'passport', k: 'bank.gov.passport', glyph: 'shield' },
      { id: 'license', k: 'bank.gov.license', glyph: 'car' },
      { id: 'iqama', k: 'bank.gov.iqama', glyph: 'shield' },
    ],
    descFromChip: (c) => `bank.txd.gov.${c}`, type: 'spike', glyphFromChip: true,
  },
};

export function BankSheet({ sheet, app, i, logTx, toast, onClose, onOpenMowzoon }) {
  const cfg = SHEETS[sheet.kind];
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [chip, setChip] = useState(cfg?.chips?.[0]?.id ?? null);
  const [done, setDone] = useState(null); // { desc, amount }

  const bal = useMemo(() => currentBalance(app), [app]);

  // info-only sheets
  if (sheet.kind === 'finance') {
    const ROWS = ['sharia', 'instant', 'amount', 'tenure', 'who', 'fee'];
    return (
      <Backdrop onClose={onClose}>
        <SheetHead i={i} icon="coins" title={i.t('bank.finance.title')} onClose={onClose} />
        <div className="bk-feature-rows">
          {ROWS.map((r) => (
            <div className="row" key={r}>
              <BIcon id="check" size={15} strokeWidth={2.6} />
              <span>{i.t(`bank.fin.${r}`)}</span>
            </div>
          ))}
        </div>
        <button className="bk-btn" onClick={() => { toast('coins', i.t('bank.demo')); onClose(); }}>{i.t('bank.fin.apply')}</button>
        <p className="bk-sheet-note">{i.t('bank.fin.note')}</p>
      </Backdrop>
    );
  }
  if (sheet.kind === 'account') {
    return (
      <Backdrop onClose={onClose}>
        <SheetHead i={i} icon="person" title={i.t('bank.svc.accounts')} onClose={onClose} />
        <AccountRow i={i} label={i.t('bank.acc.number')} value={ACCOUNT_NO} toast={toast} />
        <AccountRow i={i} label="IBAN" value={IBAN} display={fmtIban(IBAN)} toast={toast} />
        <div className="bk-field">
          <label>{i.t('bank.acc.balance')}</label>
          <div className="bk-stat" dir="ltr" style={{ fontSize: 22 }}>
            <Riyal size={14} />
            <span>{i.fmtNum(Math.floor(Math.max(0, bal)))}</span>
          </div>
        </div>
        <button className="bk-btn ghost" onClick={onClose}>{i.t('bank.sh.done')}</button>
      </Backdrop>
    );
  }
  if (sheet.kind === 'converter') {
    return <ConverterSheet i={i} onClose={onClose} />;
  }
  if (sheet.kind === 'rates') {
    return (
      <Backdrop onClose={onClose}>
        <SheetHead i={i} icon="coins" title={i.t('bank.svc.rates')} onClose={onClose} />
        <table className="bk-fx">
          <tbody>
            {FX.map((f) => (
              <tr key={f.code}>
                <td><span className="code">{f.code}</span> <span className="name">{i.t(`bank.fx.${f.code}`)}</span></td>
                <td dir="ltr">{f.rate.toLocaleString(i.locale)} <span className="name">SAR</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="bk-sheet-note">{i.t('bank.fx.note')}</p>
      </Backdrop>
    );
  }

  if (!cfg) return null;

  const amt = Math.round(Number(amount));
  const valid = Number.isFinite(amt) && amt > 0 && amt <= 9999999;

  const confirm = () => {
    if (!valid) return;
    const descKey = cfg.descFromChip ? cfg.descFromChip(chip) : cfg.descKey;
    let desc = i.t(descKey);
    if (cfg.joinName && name.trim()) desc = `${desc} · ${name.trim()}`;
    const glyph = cfg.glyphFromChip
      ? cfg.chips.find((c) => c.id === chip)?.glyph ?? 'cart'
      : cfg.chips
        ? cfg.chips.find((c) => c.id === chip)?.glyph ?? 'home'
        : cfg.glyph;
    logTx(desc, amt, cfg.type, glyph);
    setDone({ desc, amount: amt });
  };

  return (
    <Backdrop onClose={onClose}>
      {done ? (
        <div className="bk-success">
          <motion.span
            className="bk-success-ic"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <BIcon id="check" size={30} strokeWidth={2.4} />
          </motion.span>
          <b>{i.t(cfg.type === 'savings' ? 'bank.sh.moved' : 'bank.sh.sent')}</b>
          <p dir="auto">{done.desc} · {i.fmtMoney(done.amount)}</p>
          <div className="bk-mzline">
            <LiquidMark size={20} />
            <span>{i.t('bank.sh.mzline')}</span>
          </div>
          <button className="bk-btn" onClick={onClose}>{i.t('bank.sh.done')}</button>
          <button className="bk-btn ghost" style={{ marginTop: 8 }} onClick={() => { onClose(); onOpenMowzoon('spending'); }}>
            {i.t('bank.sh.viewMz')}
          </button>
        </div>
      ) : (
        <>
          <SheetHead i={i} icon={cfg.icon} title={i.t(cfg.title)} onClose={onClose} />

          {cfg.chips && (
            <div className="bk-field">
              <label>{i.t('bank.sh.pick')}</label>
              <div className="bk-chiprow">
                {cfg.chips.map((c) => (
                  <button key={c.id} className={`bk-chip ${chip === c.id ? 'on' : ''}`} onClick={() => setChip(c.id)}>
                    {i.t(c.k)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cfg.name && (
            <div className="bk-field">
              <label>{i.t(cfg.name)}</label>
              <input
                className="bk-input"
                dir={cfg.nameLtr ? 'ltr' : 'auto'}
                placeholder={i.t(cfg.namePh)}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="bk-field">
            <label>{i.t('bank.sh.amount')}</label>
            <div className="bk-amount">
              <Riyal size={16} />
              <input
                className="bk-input"
                type="number"
                inputMode="numeric"
                min="1"
                dir="ltr"
                placeholder="0"
                value={amount}
                autoFocus
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
              />
            </div>
            {cfg.presets && (
              <div className="bk-chiprow" style={{ marginTop: 8 }}>
                {cfg.presets.map((p) => (
                  <button key={p} className={`bk-chip ${amt === p ? 'on' : ''}`} onClick={() => setAmount(String(p))} dir="ltr">
                    {i.fmtNum(p)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {cfg.note && <p className="bk-sheet-note" style={{ textAlign: 'start', marginTop: 0 }}>{i.t(cfg.note)}</p>}

          <button className="bk-btn" disabled={!valid} onClick={confirm}>{i.t('bank.sh.confirm')}</button>
          <p className="bk-sheet-note">{i.t('bank.sh.balNote', { b: i.fmtMoney(Math.floor(Math.max(0, bal))) })}</p>
        </>
      )}
    </Backdrop>
  );
}

function Backdrop({ children, onClose }) {
  return (
    <motion.div
      className="bk-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bk-sheet"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98, transition: { duration: 0.15 } }}
        transition={spring}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function SheetHead({ i, icon, title, onClose }) {
  return (
    <div className="bk-sheet-head">
      <span className="bk-row-ic accent"><BIcon id={icon} size={20} strokeWidth={1.9} /></span>
      <h3>{title}</h3>
      <button className="bk-sheet-x" onClick={onClose} aria-label={i.t('bank.sh.close')}>
        <BIcon id="x" size={15} strokeWidth={2.3} />
      </button>
    </div>
  );
}

function AccountRow({ i, label, value, display, toast }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast('copy', i.t('bank.acc.copied'));
    } catch {
      toast('copy', value);
    }
  };
  return (
    <div className="bk-field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="bk-input" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display || value}
        </span>
        <button className="bk-iconbtn" style={{ flex: '0 0 auto' }} onClick={copy} aria-label={i.t('bank.acc.copy')}>
          <BIcon id="copy" size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function ConverterSheet({ i, onClose }) {
  const [amt, setAmt] = useState('100');
  const [code, setCode] = useState('USD');
  const rate = FX.find((f) => f.code === code)?.rate ?? 3.75;
  const n = Number(amt);
  const out = Number.isFinite(n) && n > 0 ? n / rate : 0;
  return (
    <Backdrop onClose={onClose}>
      <SheetHead i={i} icon="repeat" title={i.t('bank.svc.converter')} onClose={onClose} />
      <div className="bk-field">
        <label>{i.t('bank.sh.amount')} (SAR)</label>
        <div className="bk-amount">
          <Riyal size={16} />
          <input className="bk-input" type="number" inputMode="numeric" min="0" dir="ltr" value={amt} onChange={(e) => setAmt(e.target.value)} />
        </div>
      </div>
      <div className="bk-field">
        <label>{i.t('bank.fx.to')}</label>
        <div className="bk-chiprow">
          {FX.slice(0, 5).map((f) => (
            <button key={f.code} className={`bk-chip ${code === f.code ? 'on' : ''}`} onClick={() => setCode(f.code)}>{f.code}</button>
          ))}
        </div>
      </div>
      <div className="bk-stat" dir="ltr" style={{ justifyContent: 'center', margin: '6px 0 4px' }}>
        {out.toLocaleString(i.locale, { maximumFractionDigits: 2 })} <em style={{ fontSize: 15, fontStyle: 'normal', color: 'var(--bk-ink2)' }}>{code}</em>
      </div>
      <p className="bk-sheet-note">{i.t('bank.fx.note')}</p>
    </Backdrop>
  );
}
