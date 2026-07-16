import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENTS, ARCHETYPE_META, METRIC_LABELS } from './data';
import { BADGES, DROPS, levelOf } from './game';
import { streakOf } from './store';
import { Glyph, LiquidMark, LiquidOrb, Meter, spring, springSoft } from './ui';
import { useI18n } from './i18n';
import Population from './Population';

const Chevron = ({ dir = 'right' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);
const CameraMark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8.5h3l1.4-2h7.2L20 8.5h0a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V10A1.5 1.5 0 0 1 4 8.5Z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

function initialsOf(name) {
  return (name || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// Downscale an uploaded image to a small square data URL so localStorage stays light.
function fileToAvatar(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const S = 256;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const ctx = c.getContext('2d');
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
      cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function AvatarInner({ p, meta, size }) {
  const initials = initialsOf(p.name);
  if (p.avatar?.kind === 'photo' && p.avatar.photo) return <img src={p.avatar.photo} alt="" />;
  if (initials) return <b style={{ fontSize: Math.round(size * 0.36) }}>{initials}</b>;
  if (meta) return <Glyph id={meta.glyph} size={Math.round(size * 0.42)} strokeWidth={2} />;
  return <LiquidMark size={Math.round(size * 0.5)} />;
}

export default function ProfileSheet({ app, setApp, profile, source, onClose, onRetake, onSettings, initialPanel }) {
  const i = useI18n();
  // root | read | scores | standing | population | customize
  const [panel, setPanel] = useState(initialPanel || 'root');
  const fileRef = useRef(null);
  const p = app.profile ?? {};
  const rtl = i.dir === 'rtl';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const id = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const meta = id != null ? ARCHETYPE_META[id] : null;
  const voice = id != null ? i.arch(id) : null;
  const confidence = profile?.model ? Math.round(profile.model.probs[profile.model.id] * 100) : null;
  const standing = profile?.model?.cohort_percentiles;
  const accent = p.accent || meta?.tint || 'var(--tint)';
  const gm = app.game || { drops: 0, badges: {} };
  const lvl = levelOf(gm.drops);

  // seeing the map earns the Cartographer badge (flagged once)
  useEffect(() => {
    if (panel === 'population' && !app.game?.flags?.map) {
      setApp((s) => ({ ...s, game: { ...s.game, flags: { ...s.game.flags, map: true } } }));
    }
  }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (fields) => setApp((s) => ({ ...s, profile: { ...s.profile, ...fields } }));
  const t = (en, ar) => (i.lang === 'ar' ? ar : en);

  const TITLES = {
    read: t('Your read', 'قراءتك'),
    signals: t('Your read in numbers', 'قراءتك بالأرقام'),
    progress: i.t('progress.title'),
    scores: i.t('results.profile'),
    standing: profile?.model ? i.t('home.cohort', { n: i.fmtNum(profile.model.cohort_size) }) : t('Standing', 'موقعك'),
    population: i.t('room.pop.title'),
    customize: t('Personalize', 'تخصيص'),
  };

  const Row = ({ to, glyph, label, tint }) => (
    <button className="pf-row" onClick={() => setPanel(to)}>
      <span className="pf-row-ic" style={{ background: `color-mix(in srgb, ${tint} 15%, var(--surface))`, color: tint }}>
        <Glyph id={glyph} size={17} strokeWidth={2} />
      </span>
      <span className="pf-row-label">{label}</span>
      <span className="pf-row-chev"><Chevron /></span>
    </button>
  );

  return (
    <motion.div
      className="sheet-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="pf-sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16 } }}
        transition={spring}
      >
        <div className="sheet-top">
          {panel !== 'root' ? (
            <button className="sheet-back" onClick={() => setPanel('root')} aria-label="Back">
              <Chevron dir="left" />
            </button>
          ) : <span className="sheet-corner" />}
          <span className="sheet-title">{panel === 'root' ? '' : TITLES[panel]}</span>
          <button className="sheet-close" onClick={onClose} aria-label="Done">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="sheet-scroll">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={panel}
              initial={{ opacity: 0, x: (panel === 'root' ? -14 : 14) * (rtl ? -1 : 1) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: (panel === 'root' ? 14 : -14) * (rtl ? -1 : 1), transition: { duration: 0.12 } }}
              transition={springSoft}
            >
              {panel === 'root' && (
                <>
                  <div className="pf-head">
                    <button className="pf-avatar" style={{ '--ar': accent, width: 96, height: 96 }} onClick={() => setPanel('customize')} aria-label={t('Edit picture', 'تعديل الصورة')}>
                      <AvatarInner p={p} meta={meta} size={96} />
                      <span className="pf-avatar-cam"><CameraMark /></span>
                    </button>
                    <p className="pf-name">{p.name || t('Add your name', 'أضف اسمك')}</p>
                  </div>

                  {profile && (
                    <div className="pf-group">
                      <Row to="read" glyph={meta.glyph} label={t('Your read', 'قراءتك')} tint={meta.tint} />
                      <button className="pf-row" onClick={() => setPanel('progress')}>
                        <span className="pf-row-ic pf-row-orb">
                          <LiquidOrb size={22} fill={lvl.pct} tint={accent} />
                        </span>
                        <span className="pf-row-label">{i.t('progress.title')}</span>
                        <span className="pf-row-meta">{i.t(`game.lv.${lvl.n}`)}</span>
                        <span className="pf-row-chev"><Chevron /></span>
                      </button>
                      <Row to="scores" glyph="trend" label={t('Your scores', 'درجاتك')} tint="#5e5ce6" />
                      {profile.model && <Row to="standing" glyph="people" label={t('Standing', 'موقعك')} tint="#0fa38f" />}
                      {profile.model && <Row to="population" glyph="compass" label={i.t('room.pop.title')} tint="#e8890b" />}
                    </div>
                  )}

                  <div className="pf-group">
                    <button className="pf-row" onClick={() => { onRetake(); onClose(); }}>
                      <span className="pf-row-ic" style={{ background: 'color-mix(in srgb, var(--tint) 15%, var(--surface))', color: 'var(--tint)' }}>
                        <Glyph id="redo" size={17} strokeWidth={2} />
                      </span>
                      <span className="pf-row-label">{profile ? i.t('room.cal.retake') : i.t('hero.begin')}</span>
                      <span className="pf-row-chev"><Chevron /></span>
                    </button>
                    {/* on phones the sidebar gear is gone, settings live here */}
                    {onSettings && (
                      <button className="pf-row pf-row-phone" onClick={onSettings}>
                        <span className="pf-row-ic" style={{ background: 'color-mix(in srgb, var(--ink-2) 16%, var(--surface))', color: 'var(--ink-2)' }}>
                          <Glyph id="sliders" size={17} strokeWidth={2} />
                        </span>
                        <span className="pf-row-label">{t('Settings', 'الإعدادات')}</span>
                        <span className="pf-row-chev"><Chevron /></span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {panel === 'customize' && (
                <div className="pf-customize">
                  <div className="pf-head">
                    <span className="pf-avatar pf-avatar-static" style={{ '--ar': accent, width: 88, height: 88 }}>
                      <AvatarInner p={p} meta={meta} size={88} />
                    </span>
                  </div>

                  <label className="pf-field-label">{t('Name', 'الاسم')}</label>
                  <input
                    className="pf-input"
                    defaultValue={p.name || ''}
                    placeholder={i.t('profile.name.ph')}
                    onBlur={(e) => patch({ name: e.target.value.trim() })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { patch({ name: e.target.value.trim() }); e.currentTarget.blur(); } }}
                  />

                  <label className="pf-field-label">{t('Color', 'اللون')}</label>
                  <div className="pf-swatches">
                    <button
                      className={`pf-swatch ${!p.accent ? 'on' : ''}`}
                      style={{ background: meta?.tint || 'var(--tint)' }}
                      onClick={() => patch({ accent: null })}
                      aria-label={t('Follow your archetype', 'اتبع نمطك')}
                      title={t('Auto', 'تلقائي')}
                    >
                      <Glyph id="layers" size={13} strokeWidth={2.2} />
                    </button>
                    {ACCENTS.map((hex) => (
                      <button
                        key={hex}
                        className={`pf-swatch ${p.accent === hex ? 'on' : ''}`}
                        style={{ background: hex }}
                        onClick={() => patch({ accent: hex })}
                        aria-label={hex}
                      />
                    ))}
                  </div>

                  <label className="pf-field-label">{t('Picture', 'الصورة')}</label>
                  <div className="pf-photo-actions">
                    <button className="pf-photo-btn" onClick={() => fileRef.current?.click()}>
                      <CameraMark />{t('Upload or take a photo', 'ارفع صورة أو التقطها')}
                    </button>
                    {p.avatar?.kind === 'photo' && p.avatar.photo && (
                      <button className="pf-photo-remove" onClick={() => patch({ avatar: { kind: 'initials' } })}>
                        {t('Remove photo', 'أزل الصورة')}
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) fileToAvatar(f, (photo) => patch({ avatar: { kind: 'photo', photo } }));
                      e.target.value = '';
                    }}
                  />
                </div>
              )}

              {panel === 'read' && profile && (
                <div className="pf-panel">
                  <div className="prof-arch">
                    <span className="prof-arch-glyph" style={{ background: `color-mix(in srgb, ${meta.tint} 14%, var(--surface))`, color: meta.tint }}>
                      <Glyph id={meta.glyph} size={26} strokeWidth={2} />
                    </span>
                    <div className="prof-arch-meta">
                      <p className="prof-arch-name">{voice.name}</p>
                      <p className="prof-arch-tag">{voice.tagline}</p>
                    </div>
                    <span className="prof-src">{i.t(source === 'ledger' ? 'home.src.ledger' : 'home.src.survey')}</span>
                  </div>
                  <p className="prof-desc">{voice.desc}</p>
                  {profile.model && (
                    <>
                      <div className="conf-bar prof-mix">
                        {profile.model.probs.map((pr, idx) => (
                          <span key={idx} style={{ width: `${pr * 100}%`, background: ARCHETYPE_META[idx].tint }} />
                        ))}
                      </div>
                      <p className="prof-mix-cap">{i.t('results.conf', { p: i.fmtPct(confidence), n: i.fmtNum(profile.model.population) })}</p>
                    </>
                  )}
                </div>
              )}

              {panel === 'signals' && profile && (() => {
                const eng = app.insights && app.insights.aid === id ? app.insights : null;
                const sigs = eng?.signals || [];
                if (!sigs.length) {
                  return (
                    <div className="pf-panel">
                      <p className="prof-desc">{t(
                        'Not enough history yet. Log a few weeks of spending and your numbers show up here.',
                        'لا يوجد سجل كافٍ بعد. سجّل بضعة أسابيع من الإنفاق لتظهر أرقامك هنا.',
                      )}</p>
                    </div>
                  );
                }
                const byName = Object.fromEntries(sigs.map((s) => [s.name, s]));
                const order = ['savings_rate', 'runway', 'lifestyle_share', 'weekend_ratio', 'momentum', 'anomaly', 'landmark'];
                const BAND = { calm: t('Calm', 'هادئ'), note: t('Worth a note', 'يستحق ملاحظة'), elevated: t('Elevated', 'مرتفع'), high: t('High', 'عالٍ') };
                const months = (v) => (v < 1 ? t('less than a month', 'أقل من شهر') : `${i.fmtNum(Math.round(v * 10) / 10)} ${t('months', 'أشهر')}`);
                const times = (v) => `${i.fmtNum(Math.round(v * 10) / 10)}×`;
                const META = {
                  savings_rate: { label: t('Savings rate', 'معدل الادخار'), val: (s) => i.fmtPct(Math.round(s.value * 100)), cap: t('The share of income you keep. Around 20% is a healthy target.', 'نسبة ما تحتفظ به من دخلك. نحو ٢٠٪ هدف صحي.') },
                  runway: { label: t('Savings coverage', 'تغطية المدخرات'), val: (s) => months(s.value), cap: t('How long your savings would cover your spending. A healthy range is 3 to 6 months.', 'كم تغطي مدخراتك من إنفاقك. النطاق الصحي من ٣ إلى ٦ أشهر.') },
                  lifestyle_share: { label: t('Lifestyle spending', 'إنفاق نمط الحياة'), val: (s) => i.fmtPct(Math.round(s.value * 100)), cap: t('The share of income going to lifestyle and fun.', 'نسبة الدخل التي تذهب للترفيه ونمط الحياة.') },
                  weekend_ratio: { label: t('Weekend spending', 'إنفاق نهاية الأسبوع'), val: (s) => times(s.value), cap: t('Weekend spending against an even split. 1x means weekends match the rest of the week.', 'إنفاق نهاية الأسبوع مقابل توزيع متساوٍ. ١× يعني أنها كبقية الأسبوع.') },
                  momentum: { label: t('This week’s pace', 'إيقاع هذا الأسبوع'), val: (s) => times(s.value), cap: t('This week’s spending against your typical week.', 'إنفاق هذا الأسبوع مقابل أسبوعك المعتاد.') },
                  anomaly: { label: t('Unusual purchases', 'مشتريات غير معتادة'), val: (s) => (s.value > 0 ? i.fmtNum(s.value) : t('None', 'لا شيء')), cap: t('Purchases above your usual range in the last 7 days.', 'مشتريات أعلى من مداك المعتاد في آخر ٧ أيام.') },
                };
                return (
                  <div className="pf-panel">
                    <div className="sig-list">
                      {order.map((name) => {
                        const s = byName[name];
                        if (!s) return null;
                        if (name === 'landmark') {
                          const nx = (s.evidence && s.evidence.nearest) || {};
                          const evName = nx.event === 'New month' ? t('New month', 'شهر جديد') : i.spikeName(nx.event || '');
                          return (
                            <div className="sig-card" key={name}>
                              <div className="sig-top"><span className="sig-label">{t('Coming up', 'قادم')}</span></div>
                              <div className="sig-val">{evName}</div>
                              <p className="sig-cap">{i.fmtDays(nx.days ?? s.value)}</p>
                            </div>
                          );
                        }
                        const m = META[name];
                        if (!m) return null;
                        return (
                          <div className="sig-card" key={name}>
                            <div className="sig-top">
                              <span className="sig-label">{m.label}</span>
                              <span className={`sig-band sig-band--${s.band}`}>{BAND[s.band] || s.band}</span>
                            </div>
                            <div className="sig-val">{m.val(s)}</div>
                            <p className="sig-cap">{m.cap}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {panel === 'scores' && profile && (
                <div className="pf-panel">
                  <div className="meters">
                    {METRIC_LABELS.map(([key], idx) => (
                      <Meter key={key} label={i.t(`metric.${key}`)} caption={i.t(`metric.${key}.cap`)} value={profile.metrics[key]} delay={0.1 + idx * 0.1} />
                    ))}
                  </div>
                </div>
              )}

              {panel === 'standing' && profile && standing && (
                <div className="pf-panel">
                  <div className="vs-rows">
                    {METRIC_LABELS.map(([key]) => {
                      const pct = standing[key];
                      // above the median show "top N%", below it a
                      // plain percentile ("top 89%" reads wrong)
                      const ordinal = (n) => {
                        if (i.lang === 'ar') return i.fmtNum(n);
                        const s = ['th', 'st', 'nd', 'rd'];
                        const v = n % 100;
                        return n + (s[(v - 20) % 10] || s[v] || s[0]);
                      };
                      const chip = pct >= 50
                        ? i.t('home.top', { p: i.fmtPct(Math.max(1, 100 - pct)) })
                        : i.t('home.pctile', { p: ordinal(Math.max(1, pct)) });
                      return (
                        <div className="vs-row" key={key}>
                          <div className="vs-top">
                            <span>{i.t(`metric.${key}`)}</span>
                            <span className={`vs-delta ${pct >= 50 ? 'pos' : 'neg'}`}>{chip}</span>
                          </div>
                          <div className="vs-bar"><motion.i className="vs-you" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={springSoft} /></div>
                          <p className="vs-cap">{i.t('home.higher', { p: i.fmtPct(pct) })}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {panel === 'population' && profile && (
                <div className="pf-panel pf-pop"><Population profile={profile} embedded /></div>
              )}

              {panel === 'progress' && (
                <div className="pf-panel pf-progress">
                  <div className="prg-hero">
                    <LiquidOrb size={88} fill={lvl.pct} tint={accent} />
                    <p className="prg-level">{i.t(`game.lv.${lvl.n}`)}</p>
                    <p className="prg-drops">{i.t('progress.drops', { n: i.fmtNum(gm.drops) })}</p>
                    <p className="prg-next">
                      {lvl.ceil
                        ? i.t('game.next', { n: i.fmtNum(lvl.ceil - gm.drops), lv: i.t(`game.lv.${lvl.n + 1}`) })
                        : i.t('game.max')}
                    </p>
                    <p className="prg-cap">{i.t('progress.cap')}</p>
                  </div>

                  {/* streak */}
                  <div className="prg-streak">
                    <span className="prg-streak-ic"><Glyph id="flame" size={18} strokeWidth={2} /></span>
                    <span className="prg-streak-meta">
                      <b>{i.fmtStreak(Math.max(1, streakOf(app.visits)))}</b>
                      <em>{i.t('progress.streak.cap')}</em>
                    </span>
                  </div>

                  {/* how drops are earned */}
                  <label className="pf-field-label">{i.t('progress.earn')}</label>
                  <div className="earn-rows">
                    {[
                      ['plus', 'earn.log', DROPS.log],
                      ['flame', 'earn.daily', DROPS.daily],
                      ['spark', 'earn.quest', DROPS.quest],
                      ['shield', 'earn.badge', DROPS.badge],
                    ].map(([g, k, n]) => (
                      <div className="earn-row" key={k}>
                        <span className="earn-ic"><Glyph id={g} size={14} strokeWidth={2.2} /></span>
                        <span className="earn-name">{i.t(k)}</span>
                        <span className="earn-amt">{i.t('toast.drops', { n: i.fmtNum(n) })}</span>
                      </div>
                    ))}
                  </div>

                  <label className="pf-field-label">{i.t('progress.badges')}</label>
                  <div className="badge-grid">
                    {BADGES.map((b) => {
                      const got = gm.badges?.[b.id];
                      return (
                        <div className={`badge ${got ? 'got' : ''}`} key={b.id}>
                          <span className="badge-ic" style={got ? { background: `color-mix(in srgb, ${accent} 14%, var(--surface))`, color: accent } : undefined}>
                            <Glyph id={b.glyph} size={17} strokeWidth={2} />
                          </span>
                          <span className="badge-meta">
                            <b className="badge-name">{i.t(`badge.${b.id}`)}</b>
                            <em className="badge-desc">{i.t(`badge.${b.id}.d`)}</em>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
