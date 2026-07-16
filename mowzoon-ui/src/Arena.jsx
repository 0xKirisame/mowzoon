// Arena: turn-based archetype battles. Your fighter's stats come from your
// real financial metrics; outcomes come from the luck wheel (arc sizes are
// the probabilities). The engine lives in arena/engine.js — this file is UI.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ARCHETYPE_META } from './data';
import { Glyph, NumberFlow, Seg, screen, item, gel } from './ui';
import { DROPS } from './game';
import { todayISO } from './store';
import { useI18n } from './i18n';
import {
  registerArenaCharacter, getArenaRoster, getArenaCharacter, postArenaBattle, getArenaInbox,
  getArenaLeaderboard,
} from './api';
import {
  BEATS, ABILITIES, EFFECTS, PASSIVE_ABILITIES, slotsFor,
  makeFighter, initBattle, arcsFor, rollOutcome,
  castAbility, resolveAttack, ghostDecide,
} from './arena/engine';
import { BOTS } from './arena/bots';
import { ArchSprite } from './arena/sprites';
import { healthOf, applyMatchResult } from './arena/rank';
import { shareLink, addFriend, friendsLeaderboard } from './arena/friends';
import { qrMatrix, qrPath } from './arena/qr';

const ABILITY_GLYPH = {
  splurge: 'bolt', retail: 'cart', contingency: 'shield', overplan: 'compass',
  allin: 'trend', diversify: 'layers', reserve: 'peak', rationing: 'cup',
};
const EFFECT_GLYPH = { compound: 'trend', cashback: 'redo', highyield: 'flame' };

// +1 me over them, -1 them over me, 0 even
const matchup = (mine, theirs) =>
  BEATS[mine] === theirs ? 1 : BEATS[theirs] === mine ? -1 : 0;

/* ----------------------------------- QR ----------------------------------- */

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

/* ---------------------------------- wheel --------------------------------- */

// Stroke-dash donut: three arcs starting at 12 o'clock, clockwise, in the
// engine's order miss → crit → hit. The pointer div rotates to spin.angle
// (plus full turns), so the pointer always lands exactly where the roll said.
const SPIN_S = 1.6;

function Wheel({ arcs, spin, onDone, tint }) {
  const rotRef = useRef(0);
  const [target, setTarget] = useState(0);
  const spinId = spin?.id;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (spinId == null) return undefined;
    const prev = rotRef.current;
    const next = prev + 720 + ((spin.angle - (prev % 360)) % 360 + 360) % 360;
    rotRef.current = next;
    setTarget(next);
    // resolve by clock, not just by animation callback: a backgrounded tab
    // freezes rAF mid-spin and onAnimationComplete would never fire. The
    // resolver in BattleScreen is idempotent, so double-firing is safe.
    const t = setTimeout(() => onDoneRef.current(), SPIN_S * 1000 + 500);
    return () => clearTimeout(t);
  }, [spinId]); // eslint-disable-line react-hooks/exhaustive-deps

  const seg = (deg, start, color, key) =>
    deg > 0 && (
      <circle
        key={key}
        cx="100" cy="100" r="72" fill="none"
        stroke={color} strokeWidth="24" pathLength="360"
        strokeDasharray={`${Math.max(0, deg - 1.5)} ${360 - Math.max(0, deg - 1.5)}`}
        strokeDashoffset={-start - 0.75}
      />
    );

  return (
    // rotation math must not flip under RTL
    <div className="wheel" dir="ltr" style={{ '--wt': tint }}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <g transform="rotate(-90 100 100)">
          <circle cx="100" cy="100" r="72" fill="none" stroke="var(--fill-2)" strokeWidth="24" />
          {seg(arcs.missDeg, 0, 'var(--arc-miss)', 'm')}
          {seg(arcs.critDeg, arcs.missDeg, 'var(--wt)', 'c')}
          {seg(arcs.hitDeg, arcs.missDeg + arcs.critDeg, 'var(--arc-hit)', 'h')}
        </g>
      </svg>
      <motion.div
        className="wheel-hand"
        animate={{ rotate: target }}
        transition={spin ? { duration: SPIN_S, ease: [0.12, 0.8, 0.15, 1] } : { duration: 0 }}
        onAnimationComplete={() => spin && onDone()}
      >
        <span />
      </motion.div>
      <div className="wheel-hub" />
    </div>
  );
}

function WheelLegend({ arcs, i, tint }) {
  const pct = (d) => `${Math.round((d / 360) * 100)}%`;
  return (
    <div className="wheel-legend" style={{ '--wt': tint }}>
      <span className="wl wl-miss">{i.t('arena.miss')} {pct(arcs.missDeg)}</span>
      <span className="wl wl-crit">{i.t('arena.crit')} {pct(arcs.critDeg)}</span>
      <span className="wl wl-hit">{i.t('arena.hit')} {pct(arcs.hitDeg)}</span>
    </div>
  );
}

/* ------------------------------ fighter card ------------------------------ */

function HpBar({ f }) {
  const pct = Math.max(0, f.hp / f.maxHp);
  return (
    <div className="hpbar">
      <motion.span
        className="hpbar-fill"
        animate={{ width: `${pct * 100}%` }}
        transition={{ type: 'spring', stiffness: 170, damping: 24 }}
        style={{ background: pct > 0.5 ? 'var(--arc-hit)' : pct > 0.25 ? '#e8890b' : 'var(--neg, #ff453a)' }}
      />
    </div>
  );
}

const fxChips = (f, i) => {
  const chips = [];
  if (f.fx.guard > 0) chips.push(i.t('arena.ab.contingency'));
  if (f.fx.reserve) chips.push(i.t('arena.ab.reserve'));
  if (f.fx.retailArmed) chips.push(i.t('arena.ab.retail'));
  if (f.fx.allin) chips.push(i.t('arena.ab.allin'));
  if (f.fx.diversify > 0) chips.push(i.t('arena.ab.diversify'));
  if (f.fx.shaken > 0) chips.push(i.t('arena.ab.overplan'));
  return chips;
};

// Pokémon-style info box, anchored near its fighter on the field
function InfoBox({ f, mine, active, i }) {
  const meta = ARCHETYPE_META[f.archetype];
  const chips = fxChips(f, i);
  return (
    <div className={`info-box ${mine ? 'me-box' : 'foe-box'} ${active ? 'on' : ''}`} style={{ '--ft': meta.tint }}>
      <div className="info-row">
        <b className="info-name">{f.name}</b>
        <span className="info-lv">{i.t('arena.lv', { n: i.fmtNum(f.level) })}</span>
      </div>
      <HpBar f={f} />
      <div className="info-row info-sub">
        <span className="info-hp">{i.fmtNum(Math.max(0, f.hp))}/{i.fmtNum(f.maxHp)}</span>
        {chips.length > 0 && (
          <span className="info-chips">{chips.map((c) => <em key={c}>{c}</em>)}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ battle screen ----------------------------- */

function logLine(l, st, i) {
  const name = st.fighters[l.actor].name;
  if (l.kind === 'attack') {
    if (l.outcome === 'miss') return i.t('arena.log.miss', { name });
    const base = i.t('arena.log.attack', { name, outcome: i.t(`arena.${l.outcome}`), n: i.fmtNum(l.dmg) });
    return l.saved ? `${base} — ${i.t('arena.log.saved', { name: st.fighters[l.actor === 'A' ? 'B' : 'A'].name })}` : base;
  }
  if (l.kind === 'heal') return i.t('arena.log.heal', { name, n: i.fmtNum(l.heal) });
  if (l.kind === 'ability') {
    const line = i.t('arena.log.ability', { name, ability: i.t(`arena.ab.${l.ability}`) });
    return l.heal ? `${line} — ${i.t('arena.log.heal', { name, n: i.fmtNum(l.heal) })}` : line;
  }
  return '';
}

let spinSeq = 0;

function BattleScreen({ meChar, oppChar, mode, rankDelta, onEnd, onExit }) {
  const i = useI18n();
  const [st, setSt] = useState(() =>
    initBattle(meChar, oppChar, mode, mode === 'pass' && Math.random() < 0.5 ? 'B' : 'A'),
  );
  const [spin, setSpin] = useState(null); // { side, angle, outcome, arcs, id }
  const [handoff, setHandoff] = useState(mode === 'pass');
  const human = (side) => side === 'A' || mode === 'pass';
  const endedRef = useRef(false);

  // 1s heartbeat that drives the bored "idle2" windows, staggered per side
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const animFor = (side) => {
    if (st.winner) return st.winner === side ? 'idle' : null; // loser lies still
    if (spin?.side === side) return 'attack';
    return (tick + (side === 'A' ? 0 : 5)) % 11 >= 8 ? 'idle2' : 'idle';
  };

  const doAttack = (side) => {
    const arcs = arcsFor(st, side);
    const roll = rollOutcome(arcs);
    setSpin({ side, ...roll, arcs, id: ++spinSeq });
  };

  const onSpinDone = () => {
    if (!spin) return;
    const next = resolveAttack(st, spin.side, spin.outcome);
    setSt(next);
    setSpin(null);
    if (mode === 'pass' && !next.winner && next.turn !== spin.side) setHandoff(true);
  };

  // ghost turns think for a beat, then act through the same engine calls
  useEffect(() => {
    if (st.winner || spin || handoff || human(st.turn)) return undefined;
    const t = setTimeout(() => {
      const move = ghostDecide(st, st.turn);
      if (move.kind === 'ability') setSt(castAbility(st, st.turn));
      else doAttack(st.turn);
    }, 900);
    return () => clearTimeout(t);
  }, [st, spin, handoff]); // eslint-disable-line react-hooks/exhaustive-deps

  // report the result exactly once
  useEffect(() => {
    if (!st.winner || endedRef.current) return;
    endedRef.current = true;
    onEnd({
      winner: st.winner,
      rounds: st.round,
      hpA: Math.max(0, st.fighters.A.hp),
      hpB: Math.max(0, st.fighters.B.hp),
    });
  }, [st.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  const turnF = st.fighters[st.turn];
  const meF = st.fighters.A;
  const oppF = st.fighters.B;
  const arcs = spin ? spin.arcs : arcsFor(st, st.turn);
  const tint = ARCHETYPE_META[turnF.archetype].tint;
  const meTint = meChar.accent || ARCHETYPE_META[meF.archetype].tint;
  const foeTint = oppChar.accent || ARCHETYPE_META[oppF.archetype].tint;
  const adv = matchup(meF.archetype, oppF.archetype);
  const myTurn = human(st.turn) && !spin && !st.winner;
  const abilityUsable =
    myTurn && !turnF.abilityUsed && !PASSIVE_ABILITIES.has(turnF.ability) && !st.mustAttack;

  // one-shot sprite reactions, replayed by remounting on each log entry:
  // the attacker springs back from a lunge, the defender from a knockback
  const last = st.log[st.log.length - 1];
  const spriteInitial = (side) => {
    const dir = side === 'A' ? 1 : -1; // A lunges up-right, B down-left
    if (last?.kind === 'attack' && last.actor === side && last.outcome !== 'miss')
      return { x: dir * 26, y: dir * -14 };
    if (last?.kind === 'attack' && last.actor !== side && last.dmg > 0)
      return { x: dir * -12, opacity: 0.35 };
    return { x: 0, y: 0, opacity: 1 };
  };
  const spriteTarget = (side) =>
    st.winner && st.winner !== side
      ? { x: 0, y: 30, opacity: 0, rotate: side === 'A' ? -10 : 10 }
      : { x: 0, y: 0, opacity: 1, rotate: 0 };
  const message = st.winner
    ? ''
    : myTurn
      ? i.t('arena.turn.you')
      : spin || human(st.turn)
        ? ''
        : i.t('arena.turn.them', { name: turnF.name });

  return (
    <motion.section className="arena battle" variants={screen} initial="initial" animate="animate" exit="exit">
      <motion.div variants={item} className="battle-meta">
        <button className="battle-exit" onClick={onExit} aria-label={i.t('arena.back')}>
          <Glyph id="redo" size={15} strokeWidth={2.2} />
          <span>{i.t('arena.back')}</span>
        </button>
        <span className="battle-round">{i.t('arena.round', { n: i.fmtNum(st.round) })}</span>
        <span className={`battle-adv ${adv > 0 ? 'good' : adv < 0 ? 'bad' : ''}`}>
          {i.t(adv > 0 ? 'arena.advantage' : adv < 0 ? 'arena.disadvantage' : 'arena.neutral')}
        </span>
      </motion.div>

      {/* the field: foe top-right facing you, your fighter bottom-left
          looking ahead — dir=ltr so the staging never mirrors under RTL */}
      <motion.div variants={item} className="glass field" dir="ltr">
        <InfoBox f={oppF} mine={false} active={st.turn === 'B' && !st.winner} i={i} />
        <motion.div
          className="sprite foe-sprite"
          key={`foe-${st.log.length}`}
          initial={spriteInitial('B')}
          animate={spriteTarget('B')}
          transition={{ type: 'spring', stiffness: 280, damping: 17 }}
        >
          <ArchSprite archetype={oppF.archetype} view="front" tint={foeTint} size={132} anim={animFor('B')} />
        </motion.div>
        <motion.div
          className="sprite me-sprite"
          key={`me-${st.log.length}`}
          initial={spriteInitial('A')}
          animate={spriteTarget('A')}
          transition={{ type: 'spring', stiffness: 280, damping: 17 }}
        >
          <ArchSprite archetype={meF.archetype} view="back" tint={meTint} size={148} anim={animFor('A')} />
        </motion.div>
        <InfoBox f={meF} mine active={st.turn === 'A' && !st.winner} i={i} />
      </motion.div>

      {/* console: wheel + message box + actions */}
      <motion.div variants={item} className="glass console">
        <div className="console-wheel">
          <Wheel arcs={arcs} spin={spin} onDone={onSpinDone} tint={tint} />
          <WheelLegend arcs={arcs} i={i} tint={tint} />
        </div>
        <div className="console-msg" aria-live="polite">
          {message && <div className="battle-turn">{message}</div>}
          {st.log.slice(-3).reverse().map((l, k) => (
            <div key={st.log.length - k} className="battle-log-line">{logLine(l, st, i)}</div>
          ))}
        </div>
        <div className="console-actions">
          <motion.button
            className="btn-attack"
            disabled={!myTurn}
            whileTap={{ scale: 0.96 }}
            transition={gel}
            onClick={() => doAttack(st.turn)}
            style={{ '--wt': tint }}
          >
            <Glyph id="swords" size={17} strokeWidth={2.1} />
            {i.t('arena.attack')}
          </motion.button>
          <motion.button
            className="btn-ability"
            disabled={!abilityUsable}
            whileTap={{ scale: 0.96 }}
            transition={gel}
            onClick={() => setSt(castAbility(st, st.turn))}
          >
            <Glyph id={ABILITY_GLYPH[turnF.ability]} size={16} strokeWidth={2.1} />
            <span>
              {i.t(`arena.ab.${turnF.ability}`)}
              <small>
                {PASSIVE_ABILITIES.has(turnF.ability)
                  ? i.t('arena.passive')
                  : turnF.abilityUsed
                    ? i.t('arena.used')
                    : i.t(`arena.ab.${turnF.ability}.d`)}
              </small>
            </span>
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {handoff && !st.winner && (
          <motion.div
            className="battle-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="glass battle-card">
              <Glyph id="people" size={26} strokeWidth={1.9} />
              <h2>{i.t('arena.handoff', { name: turnF.name })}</h2>
              <button className="btn-attack" onClick={() => setHandoff(false)}>{i.t('arena.handoffGo')}</button>
            </div>
          </motion.div>
        )}
        {st.winner && (
          <motion.div
            className="battle-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="glass battle-card">
              <span className={`result-mark ${st.winner === 'A' ? 'good' : 'bad'}`}>
                <Glyph id={st.winner === 'A' ? 'spark' : 'moon'} size={26} strokeWidth={1.9} />
              </span>
              <h2>{i.t(st.winner === 'A' || mode === 'pass' ? 'arena.win' : 'arena.lose')}</h2>
              <p>
                {mode === 'pass'
                  ? st.fighters[st.winner].name
                  : i.t(st.winner === 'A' ? 'arena.winSub' : 'arena.loseSub', { name: oppF.name })}
              </p>
              {mode === 'ghost' && st.winner === 'A' && (
                <b className="result-drops">{i.t('toast.drops', { n: i.fmtNum(DROPS.arenaWin) })}</b>
              )}
              {mode === 'ghost' && rankDelta != null && rankDelta !== 0 && (
                <b className={`result-rank ${rankDelta > 0 ? 'good' : 'bad'}`}>
                  <Glyph id="trophy" size={14} strokeWidth={2.2} />
                  {i.t(rankDelta > 0 ? 'arena.rank.up' : 'arena.rank.down', { n: i.fmtNum(Math.abs(rankDelta)) })}
                </b>
              )}
              <div className="battle-card-btns">
                <button className="btn-ability" onClick={onExit}>{i.t('arena.back')}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/* --------------------------------- loadout -------------------------------- */

function LoadoutPanel({ me, loadout, level, setApp, i }) {
  const slots = slotsFor(level);
  const abilities = ABILITIES[me.archetype] || ABILITIES[0];
  const chosenAbility =
    slots.abilityChoice && abilities.includes(loadout.ability) ? loadout.ability : abilities[0];

  const toggleEffect = (id) => {
    setApp((s) => {
      const cur = s.arena.loadout.effects.filter((x) => EFFECTS.includes(x));
      const next = cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < slots.effectSlots
          ? [...cur, id]
          : [...cur.slice(1), id]; // full: swap out the oldest pick
      return { ...s, arena: { ...s.arena, loadout: { ...s.arena.loadout, effects: next } } };
    });
  };
  const pickAbility = (id) => {
    if (!slots.abilityChoice) return;
    setApp((s) => ({ ...s, arena: { ...s.arena, loadout: { ...s.arena.loadout, ability: id } } }));
  };

  return (
    <motion.div className="glass panel loadout" variants={item}>
      <div className="panel-title">{i.t('arena.loadout')}</div>
      <div className="loadout-sec">
        <span className="loadout-cap">
          {i.t('arena.effects')} · {i.fmtNum(Math.min(loadout.effects.length, slots.effectSlots))}/{i.fmtNum(slots.effectSlots)}
          {slots.effectSlots < 2 && <em> · {i.t('arena.unlockAt', { lv: i.t('arena.lv', { n: i.fmtNum(3) }) })}</em>}
        </span>
        <div className="loadout-row">
          {EFFECTS.map((id) => (
            <button
              key={id}
              className={`load-chip ${loadout.effects.includes(id) ? 'on' : ''}`}
              onClick={() => toggleEffect(id)}
              title={i.t(`arena.fx.${id}.d`)}
            >
              <Glyph id={EFFECT_GLYPH[id]} size={14} strokeWidth={2.1} />
              <span>{i.t(`arena.fx.${id}`)}<small>{i.t(`arena.fx.${id}.d`)}</small></span>
            </button>
          ))}
        </div>
      </div>
      <div className="loadout-sec">
        <span className="loadout-cap">
          {i.t('arena.ability')}
          {!slots.abilityChoice && <em> · {i.t('arena.unlockAt', { lv: i.t('arena.lv', { n: i.fmtNum(2) }) })}</em>}
        </span>
        <div className="loadout-row">
          {abilities.map((id, k) => {
            const locked = !slots.abilityChoice && k > 0;
            return (
              <button
                key={id}
                className={`load-chip ${chosenAbility === id ? 'on' : ''} ${locked ? 'locked' : ''}`}
                disabled={locked}
                onClick={() => pickAbility(id)}
                title={i.t(`arena.ab.${id}.d`)}
              >
                <Glyph id={ABILITY_GLYPH[id]} size={14} strokeWidth={2.1} />
                <span>{i.t(`arena.ab.${id}`)}<small>{i.t(`arena.ab.${id}.d`)}</small></span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------- pass setup ------------------------------- */

function PassSetup({ onStart, onClose, i }) {
  const [arch, setArch] = useState(0);
  const [name, setName] = useState('');
  return (
    <motion.div className="battle-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="glass battle-card pass-setup">
        <h2>{i.t('arena.pass')}</h2>
        <p>{i.t('arena.passSub')}</p>
        <input
          className="pass-name"
          value={name}
          maxLength={16}
          placeholder={i.t('arena.p2')}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="pass-archs">
          {Object.entries(ARCHETYPE_META).map(([id, m]) => (
            <button
              key={id}
              className={`load-chip ${arch === Number(id) ? 'on' : ''}`}
              style={{ '--ft': m.tint }}
              onClick={() => setArch(Number(id))}
            >
              <ArchSprite archetype={Number(id)} view="front" tint={m.tint} size={34} />
              <span>{m.name}</span>
            </button>
          ))}
        </div>
        <div className="battle-card-btns">
          <button className="btn-ability" onClick={onClose}>{i.t('arena.back')}</button>
          <button
            className="btn-attack"
            onClick={() =>
              onStart({
                handle: 'p2',
                name: name.trim() || i.t('arena.p2'),
                archetype: arch,
                metrics: { efficiency: 60, resilience: 60, eq: 60 },
                level: 3,
                loadout: { effects: ['cashback'], ability: (ABILITIES[arch] || ABILITIES[0])[0] },
              })
            }
          >
            {i.t('arena.challenge')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------- lobby --------------------------------- */

function RivalCard({ c, mine, onChallenge, i }) {
  const meta = ARCHETYPE_META[c.archetype];
  const adv = matchup(mine, c.archetype);
  return (
    <motion.div className="glass friend rival" variants={item} style={{ '--ft': meta.tint }}>
      <div className="friend-top">
        <span className="rival-sprite">
          <ArchSprite archetype={c.archetype} view="front" tint={c.accent || meta.tint} size={54} />
        </span>
        <div>
          <div className="friend-name">{c.name || c.handle}</div>
          <div className="friend-arch">{meta.name} · {i.t('arena.lv', { n: i.fmtNum(c.level) })}</div>
        </div>
        <span className={`rival-adv ${adv > 0 ? 'good' : adv < 0 ? 'bad' : ''}`}>
          {i.t(adv > 0 ? 'arena.advantage' : adv < 0 ? 'arena.disadvantage' : 'arena.neutral')}
        </span>
      </div>
      <motion.button className="btn-attack rival-btn" whileTap={{ scale: 0.97 }} transition={gel} onClick={onChallenge}>
        <Glyph id="swords" size={15} strokeWidth={2.2} />
        {i.t('arena.challenge')}
      </motion.button>
    </motion.div>
  );
}

function LbRow({ r, i }) {
  const meta = ARCHETYPE_META[r.archetype] ?? ARCHETYPE_META[0];
  return (
    <div className={`lb-row ${r.isMe ? 'me' : ''}`}>
      <span className="lb-rank">{i.fmtNum(r.rank)}</span>
      <span
        className="lb-glyph"
        style={{ background: `color-mix(in srgb, ${meta.tint} 14%, var(--surface))`, color: meta.tint }}
      >
        <Glyph id={meta.glyph} size={15} strokeWidth={2.1} />
      </span>
      <span className="lb-name">
        {r.name || r.handle}
        {r.isMe && <i>{i.t('arena.lb.you')}</i>}
      </span>
      <span className="lb-lv">{i.t('arena.lv', { n: i.fmtNum(r.level) })}</span>
      <b className="lb-score">{i.fmtNum(Math.round(r.rankScore ?? 0))}</b>
    </div>
  );
}

export default function Arena({ profile, app, setApp, lvl, toast, onCalibrate }) {
  const i = useI18n();
  const [battle, setBattle] = useState(null); // { opp, mode, key }
  const [passOpen, setPassOpen] = useState(false);
  const [roster, setRoster] = useState(null); // null = server unreachable → bots
  const [inbox, setInbox] = useState(null);
  const [board, setBoard] = useState(null); // global ladder, null = offline
  const [rankDelta, setRankDelta] = useState(null); // shown on the result card
  const [lbTab, setLbTab] = useState('global');
  const [addVal, setAddVal] = useState('');
  const [addState, setAddState] = useState(null); // 'busy' | 'ok' | 'err'
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const addTimer = useRef(null);
  const paidRef = useRef(null);

  const aid = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const myHandle = app.profile.handle;
  const meChar = useMemo(
    () =>
      profile && {
        handle: myHandle || 'you',
        name: (app.profile.name || '').trim() || i.t('arena.you'),
        archetype: aid,
        metrics: profile.metrics,
        level: lvl.n,
        loadout: app.arena.loadout,
        accent: app.profile.accent,
        rankScore: app.arena.rankScore || 0,
      },
    [profile, aid, myHandle, app.profile.name, app.profile.accent, lvl.n, app.arena.loadout, app.arena.rankScore], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const meF = useMemo(() => (meChar ? makeFighter(meChar) : null), [meChar]);

  // ghost battles need a shareable handle; mint one from the name once
  useEffect(() => {
    if (!profile || myHandle) return;
    const base =
      (app.profile.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
      'fighter';
    const gen = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    setApp((s) => (s.profile.handle ? s : { ...s, profile: { ...s.profile, handle: gen } }));
  }, [profile, myHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the server snapshot fresh (debounced; silent when offline)
  useEffect(() => {
    if (!meChar || !myHandle) return undefined;
    const t = setTimeout(() => registerArenaCharacter(meChar), 600);
    return () => clearTimeout(t);
  }, [meChar, myHandle]);

  // roster + inbox, refetched after every battle; retries cover the
  // free-tier cold start — the bot roster carries the arena meanwhile
  useEffect(() => {
    if (!myHandle || battle) return undefined;
    let alive = true;
    let attempt = 0;
    let timer;
    const load = async () => {
      const [ros, inb] = await Promise.all([getArenaRoster(myHandle), getArenaInbox(myHandle, true)]);
      if (!alive) return;
      if (ros?.characters) setRoster(ros.characters);
      if (inb?.battles) setInbox(inb.battles);
      if (!ros && attempt++ < 3) timer = setTimeout(load, 4000 * attempt);
    };
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [myHandle, battle]);

  // global ladder, refetched after every battle (rank may have moved)
  useEffect(() => {
    if (battle) return undefined;
    let alive = true;
    getArenaLeaderboard(20).then((d) => alive && setBoard(d?.leaderboard ?? null));
    return () => { alive = false; };
  }, [battle]);

  // the roster doubles as a friend-card refresh: newer snapshots of the
  // handles I follow ride along for free
  useEffect(() => {
    if (!roster) return;
    setApp((s) => {
      const follows = s.arena.friends || [];
      if (!follows.length) return s;
      let changed = false;
      const cards = { ...s.arena.friendCards };
      for (const c of roster) {
        if (!follows.includes(c.handle)) continue;
        const prev = cards[c.handle];
        if (prev && prev.level === c.level && prev.rankScore === (c.rankScore ?? 0) && prev.name === c.name) continue;
        cards[c.handle] = {
          name: c.name || c.handle,
          archetype: c.archetype ?? 0,
          level: c.level ?? 1,
          rankScore: c.rankScore ?? 0,
          updatedAt: Date.now(),
        };
        changed = true;
      }
      return changed ? { ...s, arena: { ...s.arena, friendCards: cards } } : s;
    });
  }, [roster]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) {
    return (
      <motion.section className="arena" variants={screen} initial="initial" animate="animate" exit="exit">
        <motion.header className="home-head" variants={item}>
          <h1>{i.t('arena.title')}</h1>
        </motion.header>
        <motion.div className="glass home-empty" variants={item}>
          <p>{i.t('arena.needProfile')}</p>
          <button className="btn-attack" onClick={onCalibrate}>{i.t('arena.calibrate')}</button>
        </motion.div>
      </motion.section>
    );
  }

  // one payout per battle instance, StrictMode-proof
  const onEnd = ({ winner, rounds, hpA, hpB }) => {
    if (!battle || battle.mode !== 'ghost' || paidRef.current === battle.key) return;
    paidRef.current = battle.key;
    const won = winner === 'A';
    // ghost battles are ranked: financial health multiplies the swing
    const before = app.arena.rankScore || 0;
    const after = applyMatchResult(before, {
      won,
      health: healthOf(profile.metrics),
      myLevel: lvl.n,
      oppLevel: battle.opp.level || 1,
    });
    setRankDelta(after - before);
    if (myHandle && battle.opp.handle && battle.opp.handle !== myHandle) {
      postArenaBattle({
        challenger: myHandle,
        defender: battle.opp.handle,
        winner: won ? myHandle : battle.opp.handle,
        rounds,
        challengerHpLeft: hpA,
        defenderHpLeft: hpB,
      });
    }
    setApp((s) => {
      const streak = won ? (s.arena.streak || 0) + 1 : 0;
      return {
        ...s,
        arena: {
          ...s.arena,
          wins: (s.arena.wins || 0) + (won ? 1 : 0),
          losses: (s.arena.losses || 0) + (won ? 0 : 1),
          streak,
          bestStreak: Math.max(s.arena.bestStreak || 0, streak),
          history: [
            { opp: battle.opp.name, oppArch: battle.opp.archetype, won, rounds, dateISO: todayISO() },
            ...(s.arena.history || []),
          ].slice(0, 10),
          rankScore: after,
        },
        game: won ? { ...s.game, drops: s.game.drops + DROPS.arenaWin } : s.game,
      };
    });
    if (won) toast('swords', `${i.t('toast.arenaWin')} · ${i.t('toast.drops', { n: i.fmtNum(DROPS.arenaWin) })}`);
  };

  if (battle) {
    return (
      <BattleScreen
        key={battle.key}
        meChar={meChar}
        oppChar={battle.opp}
        mode={battle.mode}
        rankDelta={rankDelta}
        onEnd={onEnd}
        onExit={() => { setBattle(null); setRankDelta(null); }}
      />
    );
  }

  const meta = ARCHETYPE_META[aid];
  const rec = app.arena;
  const rivals = roster ?? BOTS;
  const weakVs = Number(Object.keys(BEATS).find((k) => BEATS[k] === aid));

  // challenge any handle's current snapshot: revenge, or a followed friend.
  // Falls back to the cached friend card (neutral metrics) when offline.
  const challengeHandle = async (handle) => {
    const c =
      (await getArenaCharacter(handle)) ||
      rivals.find((x) => x.handle === handle) ||
      (rec.friendCards[handle] && {
        handle,
        name: rec.friendCards[handle].name,
        archetype: rec.friendCards[handle].archetype,
        metrics: { efficiency: 60, resilience: 60, eq: 60 },
        level: rec.friendCards[handle].level,
        loadout: { effects: [], ability: null },
      });
    if (c) setBattle({ opp: c, mode: 'ghost', key: `${handle}-${Date.now()}` });
  };

  // follow a pasted handle or share link
  const doAdd = async () => {
    let code = addVal.trim();
    const m = code.match(/[?&]add=([A-Za-z0-9_.-]+)/);
    if (m) code = m[1];
    if (!code) return;
    setAddState('busy');
    const res = await addFriend(app, setApp, code.toLowerCase());
    setAddState(res ? 'ok' : 'err');
    if (res) setAddVal('');
    clearTimeout(addTimer.current);
    addTimer.current = setTimeout(() => setAddState(null), 2600);
  };

  // leaderboard rows: global from the server, friends from the local cache
  const lbMe = { handle: myHandle, name: meChar.name, archetype: aid, level: lvl.n, rankScore: rec.rankScore || 0 };
  const lbRows =
    lbTab === 'friends'
      ? friendsLeaderboard(app, lbMe)
      : (board ?? []).map((r) => ({ ...r, isMe: myHandle && r.handle === myHandle }));

  return (
    <motion.section className="arena" variants={screen} initial="initial" animate="animate" exit="exit">
      <motion.header className="home-head" variants={item}>
        <div>
          <h1>{i.t('arena.title')}</h1>
          <p className="home-sub">{i.t('arena.sub')}</p>
        </div>
        <span className="streak glass-lite arena-rank-chip" title={i.t('arena.lb.cap')}>
          <Glyph id="trophy" size={15} strokeWidth={2} />
          <NumberFlow value={Math.round(app.arena.rankScore || 0)} duration={0.6} format={i.fmtNum} />
        </span>
      </motion.header>

      <motion.div className="glass panel fighter-panel" variants={item} style={{ '--ft': meta.tint }}>
        <div className="fighter-top">
          <span className="fighter-sprite">
            <ArchSprite archetype={aid} view="front" tint={app.profile.accent || meta.tint} size={84} anim="idle" />
          </span>
          <div>
            <div className="fighter-name">{meF.name}</div>
            <div className="fighter-arch">{meta.name} · {i.t('arena.lv', { n: i.fmtNum(meF.level) })}</div>
            {(rec.wins > 0 || rec.losses > 0) && (
              <div className="fighter-record">{i.t('arena.record', { w: i.fmtNum(rec.wins), l: i.fmtNum(rec.losses) })}</div>
            )}
          </div>
        </div>
        <div className="fighter-stats">
          <div><b>{i.fmtNum(meF.maxHp)}</b><span>{i.t('arena.stat.hp')}</span></div>
          <div><b>{i.fmtNum(meF.atk)}</b><span>{i.t('arena.stat.atk')}</span></div>
          <div><b>{Math.round((meF.critDeg / 360) * 100)}%</b><span>{i.t('arena.stat.crit')}</span></div>
        </div>
        <div className="ar-traits">
          <span className="ar-trait up">
            <Glyph id={ARCHETYPE_META[BEATS[aid]].glyph} size={13} strokeWidth={2.2} />
            {i.t('arena.strong', { name: i.arch(BEATS[aid]).name })}
          </span>
          <span className="ar-trait down">
            <Glyph id={ARCHETYPE_META[weakVs].glyph} size={13} strokeWidth={2.2} />
            {i.t('arena.weak', { name: i.arch(weakVs).name })}
          </span>
        </div>
        <p className="fighter-note">{i.t('arena.statNote')}</p>
      </motion.div>

      <LoadoutPanel me={meChar} loadout={app.arena.loadout} level={lvl.n} setApp={setApp} i={i} />

      <motion.div className="arena-rivals-head" variants={item}>
        <span className="panel-title">{i.t('arena.rivals')}</span>
        <button className="btn-ability pass-btn" onClick={() => setPassOpen(true)}>
          <Glyph id="people" size={15} strokeWidth={2.1} />
          {i.t('arena.pass')}
        </button>
      </motion.div>

      {roster === null && (
        <motion.p className="arena-offline" variants={item}>{i.t('arena.offline')}</motion.p>
      )}

      <div className="friends arena-roster">
        {rivals.map((c) => (
          <RivalCard
            key={c.handle}
            c={c}
            mine={aid}
            i={i}
            onChallenge={() => setBattle({ opp: c, mode: 'ghost', key: `${c.handle}-${Date.now()}` })}
          />
        ))}
      </div>

      {/* friends: share my handle (code / link / QR), follow theirs */}
      <motion.div className="glass panel" variants={item}>
        <div className="panel-h">
          <p className="panel-title" style={{ margin: 0 }}>{i.t('arena.friends')}</p>
        </div>

        {myHandle ? (
          <div className="ar-share">
            <button
              className="ar-code glass-lite"
              dir="ltr"
              onClick={() => {
                navigator.clipboard?.writeText(myHandle);
                setCopied('code');
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied === 'code' ? i.t('arena.copied') : myHandle}
            </button>
            <button
              className="ar-share-btn glass-lite"
              onClick={() => {
                navigator.clipboard?.writeText(shareLink(myHandle));
                setCopied('link');
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Glyph id="link" size={15} strokeWidth={2.1} />
              {copied === 'link' ? i.t('arena.copied') : i.t('arena.copy')}
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
          {showQr && myHandle && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
            >
              <QrCard url={shareLink(myHandle)} />
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

        {rec.friends.length === 0 ? (
          <p className="ar-setup-cap ar-friends-empty">{i.t('arena.friends.empty')}</p>
        ) : (
          <div className="ar-friend-rows">
            {rec.friends.map((handle) => {
              const f = rec.friendCards[handle];
              if (!f) return null;
              const fMeta = ARCHETYPE_META[f.archetype] ?? ARCHETYPE_META[0];
              return (
                <div key={handle} className="ar-friend">
                  <span
                    className="lb-glyph"
                    style={{ background: `color-mix(in srgb, ${fMeta.tint} 14%, var(--surface))`, color: fMeta.tint }}
                  >
                    <Glyph id={fMeta.glyph} size={15} strokeWidth={2.1} />
                  </span>
                  <span className="lb-name">
                    {f.name || handle}
                    <i className="ar-friend-code" dir="ltr">{handle}</i>
                  </span>
                  <span className="lb-lv">{i.t('arena.lv', { n: i.fmtNum(f.level) })}</span>
                  <b className="lb-score">{i.fmtNum(Math.round(f.rankScore ?? 0))}</b>
                  <motion.button className="ar-challenge" whileTap={{ scale: 0.94 }} onClick={() => challengeHandle(handle)}>
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
                { id: 'global', label: i.t('arena.lb.global') },
                { id: 'friends', label: i.t('arena.lb.friends') },
              ]}
              value={lbTab}
              onChange={setLbTab}
            />
          </div>
        </div>
        {lbRows.length === 0 ? (
          <p className="ar-setup-cap">{lbTab === 'global' && board === null ? i.t('arena.lb.offline') : i.t('arena.lb.empty')}</p>
        ) : (
          <div className="lb-rows">
            {lbRows.map((r) => <LbRow key={`${lbTab}-${r.handle ?? r.rank}`} r={r} i={i} />)}
          </div>
        )}
        <p className="ar-setup-cap ar-lb-cap">{i.t('arena.lb.cap')}</p>
      </motion.div>

      {inbox && inbox.length > 0 && (
        <>
          <motion.div className="arena-rivals-head" variants={item}>
            <span className="panel-title">{i.t('arena.inbox')}</span>
          </motion.div>
          <motion.div className="glass panel arena-inbox" variants={item}>
            {inbox.slice(0, 6).map((b) => {
              const challengedMe = b.defender === myHandle;
              const otherHandle = challengedMe ? b.challenger : b.defender;
              const otherName = rivals.find((c) => c.handle === otherHandle)?.name || otherHandle;
              const iWon = b.winner === myHandle;
              return (
                <div key={b.id} className={`inbox-row ${b.unseen ? 'unseen' : ''}`}>
                  <span className="inbox-txt">
                    {i.t(iWon ? 'arena.inbox.won' : 'arena.inbox.lost', { name: otherName, n: i.fmtNum(b.rounds) })}
                  </span>
                  {challengedMe && (
                    <button className="btn-ability inbox-revenge" onClick={() => challengeHandle(otherHandle)}>
                      <Glyph id="swords" size={13} strokeWidth={2.2} />
                      {i.t('arena.revenge')}
                    </button>
                  )}
                </div>
              );
            })}
          </motion.div>
        </>
      )}

      <AnimatePresence>
        {passOpen && (
          <PassSetup
            i={i}
            onClose={() => setPassOpen(false)}
            onStart={(p2) => {
              setPassOpen(false);
              setBattle({ opp: p2, mode: 'pass', key: `pass-${Date.now()}` });
            }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
