// The Arena: your battle character, the three modes (practice, pass-&-play,
// ghost), friends (add via link / QR / code), and the leaderboards. Battle
// rules live in src/battle/; the fight itself renders in Battle.jsx.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ARCHETYPE_META } from './data';
import { Glyph, LiquidMark, LiquidOrb, NumberFlow, Seg, screen, item, gel } from './ui';
import { useI18n } from './i18n';
import { publishCharacter, getLeaderboard, getCharacters } from './api';
import { DROPS, applyBattleOutcome } from './game';
import { todayISO } from './store';
import { makeCard, decodeCard } from './battle/character';
import { BEATS } from './battle/affinity';
import { healthOf, applyMatchResult } from './battle/rank';
import { pickEnemy } from './battle/enemies';
import { shareLink, addFriend, friendsLeaderboard } from './battle/friends';
import { qrMatrix, qrPath } from './battle/qr';
import Battle from './Battle';

const QUIET = 4; // QR quiet-zone modules

function QrCard({ url }) {
  const m = useMemo(() => qrMatrix(url), [url]);
  if (!m) return null;
  const side = m.size + QUIET * 2;
  return (
    <div className="ar-qr" dir="ltr">
      <svg viewBox={`${-QUIET} ${-QUIET} ${side} ${side}`} shapeRendering="crispEdges" aria-label={url}>
        <rect x={-QUIET} y={-QUIET} width={side} height={side} fill="#fff" />
        <path d={qrPath(m)} fill="#111" />
      </svg>
    </div>
  );
}

export default function Arena({ app, setApp, profile, level, onJourney }) {
  const i = useI18n();
  const aid = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const meta = aid != null ? ARCHETYPE_META[aid] : null;
  const b = app.battle;
  const pname = (app.profile?.name || '').trim();

  // my published card (name falls back to the archetype's voice)
  const myName = pname || (aid != null ? i.arch(aid).name : '');
  const payload = aid != null
    ? {
        name: myName,
        archetype: aid,
        level: level.n,
        accent: app.profile?.accent || meta.tint,
        rankScore: b.rankScore,
        code: b.code || undefined,
      }
    : null;

  // publish / refresh my card whenever identity, level, or standing move
  const [online, setOnline] = useState(null); // null = unknown, false = offline
  useEffect(() => {
    if (!payload) return undefined;
    let alive = true;
    publishCharacter(payload).then((r) => {
      if (!alive) return;
      setOnline(!!r);
      if (r?.code && r.code !== b.code) setApp((s) => ({ ...s, battle: { ...s.battle, code: r.code } }));
    });
    return () => { alive = false; };
  }, [aid, level.n, b.rankScore]); // eslint-disable-line react-hooks/exhaustive-deps

  // global leaderboard; refetches after ranked matches move my score
  const [board, setBoard] = useState(null);
  useEffect(() => {
    let alive = true;
    getLeaderboard(20).then((d) => alive && setBoard(d?.leaderboard ?? null));
    return () => { alive = false; };
  }, [b.rankScore, b.code]);

  // refresh cached friend cards once per visit
  useEffect(() => {
    if (!b.friends?.length) return undefined;
    let alive = true;
    getCharacters(b.friends).then((d) => {
      if (!alive || !d?.characters) return;
      setApp((s) => {
        const cards = { ...s.battle.friendCards };
        for (const c of d.characters) {
          cards[c.code] = { name: c.name, aid: c.archetype, level: c.level, rankScore: c.rankScore ?? 0, updatedAt: Date.now() };
        }
        return { ...s, battle: { ...s.battle, friendCards: cards } };
      });
    });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- battle launching -----------------------------------------------------
  const [fight, setFight] = useState(null); // { mode, enemy, difficulty }
  const [rewards, setRewards] = useState(null);
  const [ghostOpen, setGhostOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [p2Aid, setP2Aid] = useState(0);
  const [p2Name, setP2Name] = useState('');
  const [p2Code, setP2Code] = useState('');

  const myCard = aid != null ? makeCard({ aid, level: level.n, name: myName, accent: app.profile?.accent }) : null;

  const startPractice = () => {
    const enemy = pickEnemy(level.n);
    setRewards(null);
    setFight({ mode: 'single', enemy, difficulty: 0.3 + enemy.level * 0.06 });
  };
  const startGhost = (code) => {
    const f = b.friendCards[code];
    if (!f) return;
    setRewards(null);
    setGhostOpen(false);
    setFight({ mode: 'ghost', enemy: makeCard({ aid: f.aid, level: f.level, name: f.name }), difficulty: 0.55 });
  };
  const startTrade = () => {
    const pasted = p2Code.trim() ? decodeCard(p2Code.trim()) : null;
    const enemy = pasted || makeCard({ aid: p2Aid, level: level.n, name: p2Name.trim() || i.t('arena.p2') });
    setRewards(null);
    setTradeOpen(false);
    setFight({ mode: 'trade', enemy });
  };

  const onBattleDone = (won) => {
    if (!fight) return;
    const ranked = fight.mode !== 'single';
    const health = healthOf(profile?.metrics);
    const next = ranked
      ? applyMatchResult(b.rankScore, { won, health, myLevel: level.n, oppLevel: fight.enemy.level })
      : b.rankScore;
    applyBattleOutcome(setApp, {
      mode: fight.mode, ranked, won, health,
      myLevel: level.n, oppLevel: fight.enemy.level, at: todayISO(),
    });
    setRewards({ won, drops: won ? DROPS.battleWin : 0, rankDelta: next - b.rankScore, ranked });
  };

  // ---- friends --------------------------------------------------------------
  const [addVal, setAddVal] = useState('');
  const [addState, setAddState] = useState(null); // 'busy' | 'ok' | 'err'
  const addTimer = useRef(null);
  const doAdd = async () => {
    let code = addVal.trim();
    const m = code.match(/[?&]add=([A-Za-z0-9]+)/);
    if (m) code = m[1];
    if (!code) return;
    setAddState('busy');
    const res = await addFriend(app, setApp, code.toUpperCase());
    setAddState(res ? 'ok' : 'err');
    if (res) setAddVal('');
    clearTimeout(addTimer.current);
    addTimer.current = setTimeout(() => setAddState(null), 2600);
  };

  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const link = b.code ? shareLink(b.code) : null;
  const copyLink = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---- leaderboard ----------------------------------------------------------
  const [lbTab, setLbTab] = useState('friends');
  const me = myCard ? { code: b.code, name: myName, aid, level: level.n, rankScore: b.rankScore } : null;
  const friendRows = friendsLeaderboard(app, me);
  const globalRows = (board ?? []).map((r) => ({ ...r, aid: r.aid ?? r.archetype, isMe: b.code && r.code === b.code }));
  const rows = lbTab === 'friends' ? friendRows : globalRows;

  const LbRow = ({ r }) => {
    const rMeta = ARCHETYPE_META[r.aid] ?? ARCHETYPE_META[0];
    return (
      <div className={`lb-row ${r.isMe ? 'me' : ''}`}>
        <span className="lb-rank">{i.fmtNum(r.rank)}</span>
        <span className="lb-glyph" style={{ background: `color-mix(in srgb, ${rMeta.tint} 14%, var(--surface))`, color: rMeta.tint }}>
          <Glyph id={rMeta.glyph} size={15} strokeWidth={2.1} />
        </span>
        <span className="lb-name">
          {r.name || i.arch(r.aid).name}
          {r.isMe && <i>{i.t('arena.you')}</i>}
        </span>
        <span className="lb-lv">{i.t('battle.lv', { n: i.fmtNum(r.level) })}</span>
        <b className="lb-score">{i.fmtNum(Math.round(r.rankScore ?? 0))}</b>
      </div>
    );
  };

  // ---- empty state (no archetype yet) ----------------------------------------
  if (!profile) {
    return (
      <motion.section className="arena" variants={screen} initial="initial" animate="animate" exit="exit">
        <motion.div className="glass home-empty" variants={item}>
          <span className="home-empty-mark"><LiquidMark size={46} /></span>
          <h2>{i.t('arena.empty.title')}</h2>
          <p>{i.t('arena.empty.body')}</p>
          <div className="hero-cta">
            <motion.button className="btn-ink" whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }} transition={gel} onClick={onJourney}>
              {i.t('hero.begin')}
            </motion.button>
          </div>
        </motion.div>
      </motion.section>
    );
  }

  const strongVs = BEATS[aid];
  const weakVs = Number(Object.keys(BEATS).find((k) => BEATS[k] === aid));

  return (
    <motion.section className="arena" variants={screen} initial="initial" animate="animate" exit="exit">
      <motion.header className="home-head" variants={item}>
        <div>
          <p className="home-date">{i.t('arena.kicker')}</p>
          <h1>{i.t('arena.title')}</h1>
        </div>
        <div className="home-chips">
          <span className="streak glass-lite">
            <Glyph id="trophy" size={15} strokeWidth={2} />
            <NumberFlow value={Math.round(b.rankScore)} duration={0.6} format={i.fmtNum} />
          </span>
          <span className="streak glass-lite ar-record">
            {i.t('arena.record', { w: i.fmtNum(b.record.wins), l: i.fmtNum(b.record.losses) })}
          </span>
        </div>
      </motion.header>

      {/* my character */}
      <motion.div className="glass panel ar-card" variants={item} style={{ '--ft': meta.tint }}>
        <span className="ar-glyph"><Glyph id={meta.glyph} size={34} strokeWidth={1.9} /></span>
        <div className="ar-id">
          <b className="ar-name">{myName}</b>
          <em className="ar-arch">{i.arch(aid).name}</em>
          <span className="ar-lv">
            <LiquidOrb size={18} fill={level.pct} tint={meta.tint} />
            {i.t('battle.lv', { n: i.fmtNum(level.n) })} · {i.t(`game.lv.${level.n}`)}
          </span>
        </div>
        <div className="ar-traits">
          <span className="ar-trait">
            <Glyph id="spark" size={13} strokeWidth={2.2} />
            {i.t(`ability.${aid}.name`)}
            <em>{i.t(`ability.${aid}.d`)}</em>
          </span>
          <span className="ar-trait up">
            <Glyph id={ARCHETYPE_META[strongVs].glyph} size={13} strokeWidth={2.2} />
            {i.t('arena.strong', { name: i.arch(strongVs).name })}
          </span>
          <span className="ar-trait down">
            <Glyph id={ARCHETYPE_META[weakVs].glyph} size={13} strokeWidth={2.2} />
            {i.t('arena.weak', { name: i.arch(weakVs).name })}
          </span>
        </div>
      </motion.div>

      {/* modes */}
      <motion.div className="glass panel" variants={item}>
        <p className="panel-title">{i.t('arena.modes')}</p>
        <div className="ar-modes">
          <motion.button className="mode-btn" whileTap={{ scale: 0.97 }} transition={gel} onClick={startPractice}>
            <span className="mode-ic"><Glyph id="gamepad" size={20} strokeWidth={2} /></span>
            <b>{i.t('arena.mode.practice')}</b>
            <em>{i.t('arena.mode.practice.d')}</em>
          </motion.button>
          <motion.button className={`mode-btn ${tradeOpen ? 'on' : ''}`} whileTap={{ scale: 0.97 }} transition={gel} onClick={() => { setTradeOpen((o) => !o); setGhostOpen(false); }}>
            <span className="mode-ic"><Glyph id="people" size={20} strokeWidth={2} /></span>
            <b>{i.t('arena.mode.trade')}</b>
            <em>{i.t('arena.mode.trade.d')}</em>
          </motion.button>
          <motion.button className={`mode-btn ${ghostOpen ? 'on' : ''}`} whileTap={{ scale: 0.97 }} transition={gel} onClick={() => { setGhostOpen((o) => !o); setTradeOpen(false); }}>
            <span className="mode-ic"><Glyph id="ghost" size={20} strokeWidth={2} /></span>
            <b>{i.t('arena.mode.ghost')}</b>
            <em>{i.t('arena.mode.ghost.d')}</em>
          </motion.button>
        </div>

        {/* pass-&-play setup */}
        <AnimatePresence>
          {tradeOpen && (
            <motion.div className="ar-setup" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
              <p className="ar-setup-cap">{i.t('arena.trade.sub')}</p>
              <div className="ar-p2-archs">
                {[0, 1, 2, 3].map((a) => (
                  <button
                    key={a}
                    className={`ar-p2-arch ${p2Aid === a ? 'on' : ''}`}
                    style={{ '--ft': ARCHETYPE_META[a].tint }}
                    onClick={() => setP2Aid(a)}
                  >
                    <Glyph id={ARCHETYPE_META[a].glyph} size={17} strokeWidth={2} />
                    <span>{i.arch(a).name}</span>
                  </button>
                ))}
              </div>
              <div className="ar-add-row">
                <input
                  className="ar-input"
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  placeholder={i.t('arena.trade.name.ph')}
                  maxLength={20}
                />
                <input
                  className="ar-input"
                  value={p2Code}
                  onChange={(e) => setP2Code(e.target.value)}
                  placeholder={i.t('arena.trade.code.ph')}
                />
              </div>
              <motion.button className="btn-ink ar-start" whileTap={{ scale: 0.96 }} onClick={startTrade}>
                <Glyph id="swords" size={16} strokeWidth={2.2} />
                {i.t('arena.trade.start')}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ghost chooser */}
        <AnimatePresence>
          {ghostOpen && (
            <motion.div className="ar-setup" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
              {b.friends.length === 0 ? (
                <p className="ar-setup-cap">{i.t('arena.ghost.none')}</p>
              ) : (
                <>
                  <p className="ar-setup-cap">{i.t('arena.ghost.pick')}</p>
                  <div className="ar-friend-rows">
                    {b.friends.map((code) => {
                      const f = b.friendCards[code];
                      if (!f) return null;
                      const fMeta = ARCHETYPE_META[f.aid] ?? ARCHETYPE_META[0];
                      return (
                        <button key={code} className="ar-friend" onClick={() => startGhost(code)}>
                          <span className="lb-glyph" style={{ background: `color-mix(in srgb, ${fMeta.tint} 14%, var(--surface))`, color: fMeta.tint }}>
                            <Glyph id={fMeta.glyph} size={15} strokeWidth={2.1} />
                          </span>
                          <span className="lb-name">{f.name || i.arch(f.aid).name}</span>
                          <span className="lb-lv">{i.t('battle.lv', { n: i.fmtNum(f.level) })}</span>
                          <span className="ar-duel"><Glyph id="swords" size={14} strokeWidth={2.2} /></span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* friends */}
      <motion.div className="glass panel" variants={item}>
        <div className="panel-h">
          <p className="panel-title" style={{ margin: 0 }}>{i.t('arena.friends')}</p>
          {online === false && <span className="ar-offline">{i.t('arena.offline')}</span>}
        </div>

        {link ? (
          <div className="ar-share">
            <span className="ar-code glass-lite" dir="ltr">{b.code}</span>
            <button className="ar-share-btn glass-lite" onClick={copyLink}>
              <Glyph id="link" size={15} strokeWidth={2.1} />
              {copied ? i.t('arena.copied') : i.t('arena.copy')}
            </button>
            <button className={`ar-share-btn glass-lite ${showQr ? 'on' : ''}`} onClick={() => setShowQr((o) => !o)}>
              <Glyph id="qr" size={15} strokeWidth={2.1} />
              {i.t('arena.qr')}
            </button>
          </div>
        ) : (
          <p className="ar-setup-cap">{i.t('arena.share.offline')}</p>
        )}

        <AnimatePresence>
          {showQr && link && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
              <QrCard url={link} />
              <p className="ar-setup-cap ar-qr-cap">{i.t('arena.qr.cap')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="ar-add-row">
          <input
            className="ar-input"
            value={addVal}
            onChange={(e) => setAddVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doAdd()}
            placeholder={i.t('arena.add.ph')}
          />
          <motion.button className="ar-add-btn" whileTap={{ scale: 0.95 }} onClick={doAdd} disabled={addState === 'busy'}>
            <Glyph id="plus" size={15} strokeWidth={2.4} />
            {i.t('arena.add')}
          </motion.button>
        </div>
        <AnimatePresence>
          {addState === 'err' && (
            <motion.p className="ar-add-note err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {i.t('arena.add.err')}
            </motion.p>
          )}
          {addState === 'ok' && (
            <motion.p className="ar-add-note ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {i.t('arena.add.done')}
            </motion.p>
          )}
        </AnimatePresence>

        {b.friends.length === 0 ? (
          <p className="ar-setup-cap ar-friends-empty">{i.t('arena.friends.empty')}</p>
        ) : (
          <div className="ar-friend-rows">
            {b.friends.map((code) => {
              const f = b.friendCards[code];
              if (!f) return null;
              const fMeta = ARCHETYPE_META[f.aid] ?? ARCHETYPE_META[0];
              return (
                <div key={code} className="ar-friend">
                  <span className="lb-glyph" style={{ background: `color-mix(in srgb, ${fMeta.tint} 14%, var(--surface))`, color: fMeta.tint }}>
                    <Glyph id={fMeta.glyph} size={15} strokeWidth={2.1} />
                  </span>
                  <span className="lb-name">{f.name || i.arch(f.aid).name}<i className="ar-friend-code" dir="ltr">{code}</i></span>
                  <span className="lb-lv">{i.t('battle.lv', { n: i.fmtNum(f.level) })}</span>
                  <b className="lb-score">{i.fmtNum(Math.round(f.rankScore ?? 0))}</b>
                  <motion.button className="ar-challenge" whileTap={{ scale: 0.94 }} onClick={() => startGhost(code)}>
                    <Glyph id="swords" size={13} strokeWidth={2.3} />
                    {i.t('arena.challenge')}
                  </motion.button>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* leaderboard */}
      <motion.div className="glass panel" variants={item}>
        <div className="panel-h">
          <p className="panel-title" style={{ margin: 0 }}>{i.t('arena.lb')}</p>
          <div className="ar-lb-seg">
            <Seg
              options={[
                { id: 'friends', label: i.t('arena.lb.friends') },
                { id: 'global', label: i.t('arena.lb.global') },
              ]}
              value={lbTab}
              onChange={setLbTab}
            />
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="ar-setup-cap">{lbTab === 'global' && board === null ? i.t('arena.lb.offline') : i.t('arena.lb.empty')}</p>
        ) : (
          <div className="lb-rows">
            {rows.map((r) => <LbRow key={`${lbTab}-${r.code ?? r.rank}`} r={r} />)}
          </div>
        )}
        <p className="ar-setup-cap ar-lb-cap">{i.t('arena.lb.cap')}</p>
      </motion.div>

      {/* the fight itself */}
      <AnimatePresence>
        {fight && myCard && (
          <Battle
            mode={fight.mode}
            player={myCard}
            enemy={fight.enemy}
            difficulty={fight.difficulty}
            rewards={rewards}
            onDone={onBattleDone}
            onClose={() => { setFight(null); setRewards(null); }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
