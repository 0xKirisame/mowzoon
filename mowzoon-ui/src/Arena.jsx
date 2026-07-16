// Arena: turn-based archetype battles. Your fighter's stats come from your
// real financial metrics; outcomes come from the luck wheel (arc sizes are
// the probabilities). The engine lives in arena/engine.js — this file is UI.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
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
import { BOTS, botName } from './arena/bots';
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
    <div className={`wheel${spin ? ' spinning' : ''}`} dir="ltr" style={{ '--wt': tint }}>
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
  const strikeAt = useRef(0); // when the last attack resolved (drives the one-shot strike)

  // 1s heartbeat that drives the bored "idle2" windows, staggered per side
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  // while the wheel spins the attacker holds an anticipation pose; the
  // strike itself plays ONCE, on the remount that lands the damage
  const animFor = (side) => {
    if (st.winner) return st.winner === side ? 'cheer' : null; // loser lies still
    if (spin?.side === side) return 'windup';
    const l = st.log[st.log.length - 1];
    if (l?.kind === 'attack' && l.actor === side && Date.now() - strikeAt.current < 900) return 'strike';
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
    strikeAt.current = Date.now();
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
  // the attacker springs back from a lunge, the defender from a knockback.
  // On round one the fighters walk in from their own side instead.
  const last = st.log[st.log.length - 1];
  const entering = st.log.length === 0 && !st.winner;
  const spriteInitial = (side) => {
    const dir = side === 'A' ? 1 : -1; // A lunges up-right, B down-left
    if (entering) return { x: dir * -72, y: dir * 18, opacity: 0, scale: 0.85 };
    if (last?.kind === 'attack' && last.actor === side && last.outcome !== 'miss')
      return { x: dir * 26, y: dir * -14 };
    if (last?.kind === 'attack' && last.actor !== side && last.dmg > 0)
      return { x: dir * -12, opacity: 0.35 };
    return { x: 0, y: 0, opacity: 1 };
  };
  const spriteTarget = (side) =>
    st.winner && st.winner !== side
      ? { x: 0, y: 30, opacity: 0, rotate: side === 'A' ? -10 : 10 }
      : { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 };
  // entrance gait matches temperament: the raccoon bounds in, the camel plods
  const ENTER_SPRING = {
    0: { type: 'spring', stiffness: 260, damping: 11 },
    1: { type: 'spring', stiffness: 320, damping: 17 },
    2: { type: 'spring', stiffness: 150, damping: 19 },
    3: { type: 'spring', stiffness: 130, damping: 20 },
  };
  const spriteSpring = (side, arch) =>
    entering
      ? { ...(ENTER_SPRING[arch] || ENTER_SPRING[0]), delay: side === 'A' ? 0.28 : 0.08 }
      : { type: 'spring', stiffness: 280, damping: 17 };

  // floating outcome pop over whoever just got hit (or healed)
  const pop = useMemo(() => {
    if (!last) return null;
    if (last.kind === 'attack') {
      return {
        key: st.log.length,
        side: last.actor === 'A' ? 'B' : 'A',
        kind: last.outcome, // 'miss' | 'hit' | 'crit'
        text: last.outcome === 'miss' ? i.t('arena.miss') : `−${i.fmtNum(last.dmg)}`,
      };
    }
    if (last.kind === 'heal' || (last.kind === 'ability' && last.heal))
      return { key: st.log.length, side: last.actor, kind: 'heal', text: `+${i.fmtNum(last.heal)}` };
    return null;
  }, [st.log.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const hitSide = last?.kind === 'attack' && last.dmg > 0 ? (last.actor === 'A' ? 'B' : 'A') : null;

  // a crit rattles the whole field for a beat
  const shakeCtl = useAnimationControls();
  useEffect(() => {
    if (last?.kind === 'attack' && last.outcome === 'crit') {
      shakeCtl.start({ x: [0, -8, 7, -4, 2, 0], transition: { duration: 0.42, ease: 'easeOut' } });
    }
  }, [st.log.length]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <motion.div className="field-inner" animate={shakeCtl}>
          <InfoBox f={oppF} mine={false} active={st.turn === 'B' && !st.winner} i={i} />
          <motion.div
            className={`sprite foe-sprite${hitSide === 'B' ? ' sprite-hit' : ''}`}
            key={`foe-${st.log.length}`}
            initial={spriteInitial('B')}
            animate={spriteTarget('B')}
            transition={spriteSpring('B', oppF.archetype)}
          >
            <ArchSprite archetype={oppF.archetype} view="front" tint={foeTint} size={132} anim={animFor('B')} />
          </motion.div>
          <motion.div
            className={`sprite me-sprite${hitSide === 'A' ? ' sprite-hit' : ''}`}
            key={`me-${st.log.length}`}
            initial={spriteInitial('A')}
            animate={spriteTarget('A')}
            transition={spriteSpring('A', meF.archetype)}
          >
            <ArchSprite archetype={meF.archetype} view="back" tint={meTint} size={148} anim={animFor('A')} />
          </motion.div>
          <InfoBox f={meF} mine active={st.turn === 'A' && !st.winner} i={i} />
        </motion.div>
        <AnimatePresence>
          {pop && (
            <motion.span
              key={pop.key}
              className={`dmg-pop ${pop.side === 'B' ? 'pop-foe' : 'pop-me'} pop-${pop.kind}`}
              initial={{ opacity: 0, y: 10, scale: pop.kind === 'crit' ? 0.4 : 0.7 }}
              animate={{ opacity: 1, y: -24, scale: pop.kind === 'crit' ? 1.3 : 1 }}
              exit={{ opacity: 0, y: -44, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            >
              {pop.text}
            </motion.span>
          )}
        </AnimatePresence>
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
              <motion.span
                className="result-sprite"
                initial={{ scale: 0.5, y: 14, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.15 }}
              >
                <ArchSprite
                  archetype={st.fighters[st.winner].archetype}
                  view="front"
                  tint={st.winner === 'A' ? meTint : foeTint}
                  size={96}
                  anim="cheer"
                />
              </motion.span>
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

function LoadoutPanel({ me, loadout, level, setApp, i, bare }) {
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
    <motion.div className={bare ? 'loadout' : 'glass panel loadout'} variants={bare ? undefined : item}>
      {!bare && <div className="panel-title">{i.t('arena.loadout')}</div>}
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
              <ArchSprite archetype={Number(id)} view="front" tint={m.tint} size={34} anim={arch === Number(id) ? 'idle' : null} />
              <span>{i.arch(Number(id)).name}</span>
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

/* ---------------------------------- sheets --------------------------------- */

function ArenaSheet({ open, title, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="arena-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass arena-sheet"
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="arena-sheet-head">
              <b>{title}</b>
              <button className="arena-sheet-x" onClick={onClose} aria-label={title}>
                <Glyph id="plus" size={16} strokeWidth={2.3} />
              </button>
            </div>
            <div className="arena-sheet-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------- matchmaking ------------------------------- */

// The FIGHT theatre. 'search' cycles silhouettes in the rival slot, 'found'
// pops the real opponent in, 'load' runs a progress bar of made-up chores.
function MatchOverlay({ match, me, meTint, i, onCancel }) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBeat((x) => x + 1), match.phase === 'search' ? 240 : 700);
    return () => clearInterval(t);
  }, [match.phase]);
  const opp = match.opp;
  const oppMeta = opp ? ARCHETYPE_META[opp.archetype] : null;
  const statusKey =
    match.phase === 'search'
      ? `arena.search.${(Math.floor(beat / 3) % 3) + 1}`
      : `arena.load.${(beat % 3) + 1}`;
  return (
    <motion.div
      className="arena-scrim match-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="glass battle-card match-card">
        <div className="match-slots" dir="ltr">
          <div className="match-slot">
            <ArchSprite archetype={me.archetype} view="front" tint={meTint} size={92} anim="idle" />
            <b>{me.name}</b>
          </div>
          <span className={`match-vs ${match.phase !== 'search' ? 'on' : ''}`}>
            {match.phase === 'search' ? '?' : i.t('arena.vs')}
          </span>
          <div className={`match-slot ${match.phase === 'search' ? 'seeking' : ''}`}>
            {match.phase === 'search' ? (
              <span className="match-cycler">
                <ArchSprite archetype={beat % 4} view="front" tint={ARCHETYPE_META[beat % 4].tint} size={92} />
              </span>
            ) : (
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 15 }}
              >
                <ArchSprite
                  archetype={opp.archetype}
                  view="front"
                  tint={opp.accent || oppMeta.tint}
                  size={92}
                  anim={match.phase === 'found' ? 'idle2' : 'idle'}
                />
              </motion.span>
            )}
            {match.phase !== 'search' && <b>{botName(opp, i.lang)}</b>}
          </div>
        </div>

        <h2>{i.t(match.phase === 'search' ? 'arena.search' : match.phase === 'found' ? 'arena.found' : 'arena.loading')}</h2>
        {match.phase === 'found' ? (
          <p className="match-status">
            {i.arch(opp.archetype).name} · {i.t('arena.lv', { n: i.fmtNum(opp.level) })}
            {(opp.rankScore ?? 0) > 0 ? ` · ${i.fmtNum(opp.rankScore)}` : ''}
          </p>
        ) : (
          <p className="match-status" key={statusKey}>{i.t(statusKey)}</p>
        )}

        {match.phase === 'load' && (
          <span className="match-bar">
            <motion.i initial={{ width: '4%' }} animate={{ width: '100%' }} transition={{ duration: 1.55, ease: 'easeInOut' }} />
          </span>
        )}
        {match.phase === 'search' && (
          <button className="btn-ability match-cancel" onClick={onCancel}>{i.t('arena.cancel')}</button>
        )}
      </div>
    </motion.div>
  );
}

/* ---------------------------------- lobby --------------------------------- */

function LbRow({ r, i, onChallenge }) {
  const meta = ARCHETYPE_META[r.archetype] ?? ARCHETYPE_META[0];
  return (
    <div className={`lb-row ${r.isMe ? 'me' : ''}`}>
      <span className="lb-rank">{i.fmtNum(r.rank)}</span>
      <span className="lb-glyph" style={{ background: `color-mix(in srgb, ${meta.tint} 14%, var(--surface))` }}>
        <ArchSprite archetype={r.archetype ?? 0} view="front" tint={meta.tint} size={26} />
      </span>
      <span className="lb-name">
        {botName(r, i.lang)}
        {r.isMe && <i>{i.t('arena.lb.you')}</i>}
      </span>
      <span className="lb-lv">{i.t('arena.lv', { n: i.fmtNum(r.level) })}</span>
      <b className="lb-score">{i.fmtNum(Math.round(r.rankScore ?? 0))}</b>
      {!r.isMe && r.handle && onChallenge && (
        <motion.button
          className="ar-challenge lb-duel"
          whileTap={{ scale: 0.94 }}
          onClick={() => onChallenge(r.handle)}
          title={i.t('arena.challenge')}
        >
          <Glyph id="swords" size={13} strokeWidth={2.3} />
        </motion.button>
      )}
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
  const [lobbyTick, setLobbyTick] = useState(0); // drives the hero's bored special
  const [sheet, setSheet] = useState(null); // 'loadout' | 'friends' | 'lb' | null
  const [match, setMatch] = useState(null); // { phase: 'search' | 'found' | 'load', opp? }
  const matchTimers = useRef([]);
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

  // global ladder, refetched after every battle (rank may have moved). The
  // second, delayed fetch lands after the debounced register upsert, so my
  // own row shows on the very first visit too.
  useEffect(() => {
    if (battle) return undefined;
    let alive = true;
    const grab = () => getArenaLeaderboard(20).then((d) => alive && d?.leaderboard && setBoard(d.leaderboard));
    getArenaLeaderboard(20).then((d) => alive && setBoard(d?.leaderboard ?? null));
    const t = setTimeout(grab, 1600);
    return () => { alive = false; clearTimeout(t); };
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

  // heartbeat for the lobby fighter: mostly idle, occasionally the bored special
  useEffect(() => {
    if (battle) return undefined;
    const t = setInterval(() => setLobbyTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [battle]);
  const lobbyAnim = lobbyTick % 10 >= 8 ? 'idle2' : 'idle';
  useEffect(() => () => matchTimers.current.forEach(clearTimeout), []);

  if (!profile) {
    return (
      <motion.section className="arena" variants={screen} initial="initial" animate="animate" exit="exit">
        <motion.header className="home-head" variants={item}>
          <h1>{i.t('arena.title')}</h1>
        </motion.header>
        <motion.div className="glass home-empty arena-empty" variants={item}>
          <div className="arena-empty-cast" aria-hidden="true">
            {[0, 1, 2, 3].map((a) => (
              <span key={a} className="arena-empty-slot">
                <ArchSprite archetype={a} view="front" tint={ARCHETYPE_META[a].tint} size={72} anim="idle" />
              </span>
            ))}
          </div>
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
    if (c) setBattle({ opp: { ...c, name: botName(c, i.lang) }, mode: 'ghost', key: `${handle}-${Date.now()}` });
  };

  // FIGHT: the opponent is picked instantly (level-neighbours first), the
  // search / found / loading beats are pure theatre
  const startMatchmaking = () => {
    const pool = rivals.filter((c) => c.handle !== myHandle);
    if (!pool.length || match) return;
    const near = pool.filter((c) => Math.abs((c.level || 1) - lvl.n) <= 1);
    const from = near.length ? near : pool;
    const opp = from[Math.floor(Math.random() * from.length)];
    setSheet(null);
    setMatch({ phase: 'search' });
    matchTimers.current = [
      setTimeout(() => setMatch({ phase: 'found', opp }), 2300),
      setTimeout(() => setMatch({ phase: 'load', opp }), 3800),
      setTimeout(() => {
        setMatch(null);
        setBattle({ opp: { ...opp, name: botName(opp, i.lang) }, mode: 'ghost', key: `${opp.handle}-${Date.now()}` });
      }, 5450),
    ];
  };
  const cancelMatch = () => {
    matchTimers.current.forEach(clearTimeout);
    setMatch(null);
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
        <button className="streak glass-lite arena-rank-chip" title={i.t('arena.lb')} onClick={() => setSheet('lb')}>
          <Glyph id="trophy" size={15} strokeWidth={2} />
          <NumberFlow value={Math.round(app.arena.rankScore || 0)} duration={0.6} format={i.fmtNum} />
        </button>
      </motion.header>

      {/* the stage: stats+items | hero | actions */}
      <motion.div className="glass stage" variants={item} style={{ '--ft': meta.tint }}>
        <div className="stage-id">
          <b className="stage-name">{meF.name}</b>
          <span className="stage-sub">
            {i.arch(aid).name} · {i.t('arena.lv', { n: i.fmtNum(meF.level) })} · {i.t(`game.lv.${lvl.n}`)}
          </span>
          {(rec.wins > 0 || rec.losses > 0) && (
            <span className="stage-record">{i.t('arena.record', { w: i.fmtNum(rec.wins), l: i.fmtNum(rec.losses) })}</span>
          )}
        </div>

        <aside className="stage-stats">
          <div className="stat-row">
            <span>{i.t('arena.stat.hp')}</span>
            <i className="stat-meter"><b style={{ width: `${Math.min(100, (meF.maxHp / 130) * 100)}%` }} /></i>
            <b className="stat-val">{i.fmtNum(meF.maxHp)}</b>
          </div>
          <div className="stat-row">
            <span>{i.t('arena.stat.atk')}</span>
            <i className="stat-meter"><b style={{ width: `${Math.min(100, (meF.atk / 40) * 100)}%` }} /></i>
            <b className="stat-val">{i.fmtNum(meF.atk)}</b>
          </div>
          <div className="stat-row">
            <span>{i.t('arena.stat.crit')}</span>
            <i className="stat-meter"><b style={{ width: `${Math.min(100, Math.round((meF.critDeg / 360) * 100) * 2)}%` }} /></i>
            <b className="stat-val">{Math.round((meF.critDeg / 360) * 100)}%</b>
          </div>

          <div className="stage-items-cap">
            <span>{i.t('arena.loadout')}</span>
            <button className="stage-edit" onClick={() => setSheet('loadout')}>{i.t('arena.edit')}</button>
          </div>
          <div className="stage-items">
            <button className="stage-item" onClick={() => setSheet('loadout')} title={i.t(`arena.ab.${meF.ability}.d`)}>
              <Glyph id={ABILITY_GLYPH[meF.ability]} size={13} strokeWidth={2.2} />
              {i.t(`arena.ab.${meF.ability}`)}
            </button>
            {app.arena.loadout.effects.filter((x) => EFFECTS.includes(x)).map((id) => (
              <button key={id} className="stage-item" onClick={() => setSheet('loadout')} title={i.t(`arena.fx.${id}.d`)}>
                <Glyph id={EFFECT_GLYPH[id]} size={13} strokeWidth={2.2} />
                {i.t(`arena.fx.${id}`)}
              </button>
            ))}
          </div>

          <div className="ar-traits stage-traits">
            <span className="ar-trait up">
              <Glyph id={ARCHETYPE_META[BEATS[aid]].glyph} size={13} strokeWidth={2.2} />
              {i.t('arena.strong', { name: i.arch(BEATS[aid]).name })}
            </span>
            <span className="ar-trait down">
              <Glyph id={ARCHETYPE_META[weakVs].glyph} size={13} strokeWidth={2.2} />
              {i.t('arena.weak', { name: i.arch(weakVs).name })}
            </span>
          </div>
        </aside>

        <div className="stage-hero">
          <ArchSprite archetype={aid} view="front" tint={app.profile.accent || meta.tint} size={208} anim={lobbyAnim} />
        </div>

        <div className="stage-actions">
          <motion.button
            className="fight-btn"
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            transition={gel}
            onClick={startMatchmaking}
            disabled={!!match}
          >
            <Glyph id="swords" size={19} strokeWidth={2.2} />
            {i.t('arena.fight')}
          </motion.button>
          <button className="stage-btn glass-lite" onClick={() => setSheet('friends')}>
            <Glyph id="people" size={16} strokeWidth={2.1} />
            {i.t('arena.friends')}
          </button>
          <button className="stage-btn glass-lite" onClick={() => setPassOpen(true)}>
            <Glyph id="redo" size={16} strokeWidth={2.1} />
            {i.t('arena.pass')}
          </button>
        </div>
      </motion.div>

      {roster === null && (
        <motion.p className="arena-offline" variants={item}>{i.t('arena.offline')}</motion.p>
      )}

      {/* friends sheet: share my handle (code / link / QR), follow theirs */}
      <ArenaSheet open={sheet === 'friends'} title={i.t('arena.friends')} onClose={() => setSheet(null)}>

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
                  <span className="lb-glyph" style={{ background: `color-mix(in srgb, ${fMeta.tint} 14%, var(--surface))` }}>
                    <ArchSprite archetype={f.archetype ?? 0} view="front" tint={fMeta.tint} size={26} />
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
      </ArenaSheet>

      {/* leaderboard sheet */}
      <ArenaSheet open={sheet === 'lb'} title={i.t('arena.lb')} onClose={() => setSheet(null)}>
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
        {lbRows.length === 0 ? (
          <p className="ar-setup-cap">{lbTab === 'global' && board === null ? i.t('arena.lb.offline') : i.t('arena.lb.empty')}</p>
        ) : (
          <div className="lb-rows">
            {lbRows.map((r) => (
              <LbRow key={`${lbTab}-${r.handle ?? r.rank}`} r={r} i={i} onChallenge={challengeHandle} />
            ))}
          </div>
        )}
        <p className="ar-setup-cap ar-lb-cap">{i.t('arena.lb.cap')}</p>
      </ArenaSheet>

      {/* loadout sheet */}
      <ArenaSheet open={sheet === 'loadout'} title={i.t('arena.loadout')} onClose={() => setSheet(null)}>
        <LoadoutPanel me={meChar} loadout={app.arena.loadout} level={lvl.n} setApp={setApp} i={i} bare />
      </ArenaSheet>

      {/* matchmaking theatre */}
      <AnimatePresence>
        {match && (
          <MatchOverlay
            match={match}
            me={{ archetype: aid, name: meF.name }}
            meTint={app.profile.accent || meta.tint}
            i={i}
            onCancel={cancelMatch}
          />
        )}
      </AnimatePresence>

      {inbox && inbox.length > 0 && (
        <>
          <motion.div className="arena-rivals-head" variants={item}>
            <span className="panel-title">{i.t('arena.inbox')}</span>
          </motion.div>
          <motion.div className="glass panel arena-inbox" variants={item}>
            {inbox.slice(0, 6).map((b) => {
              const challengedMe = b.defender === myHandle;
              const otherHandle = challengedMe ? b.challenger : b.defender;
              const other = rivals.find((c) => c.handle === otherHandle);
              const otherName = other ? botName(other, i.lang) : otherHandle;
              const iWon = b.winner === myHandle;
              return (
                <div key={b.id} className={`inbox-row ${b.unseen ? 'unseen' : ''}`}>
                  {other && (
                    <span
                      className="inbox-sprite"
                      style={{ background: `color-mix(in srgb, ${ARCHETYPE_META[other.archetype].tint} 12%, var(--surface))` }}
                    >
                      <ArchSprite
                        archetype={other.archetype}
                        view="front"
                        tint={other.accent || ARCHETYPE_META[other.archetype].tint}
                        size={26}
                      />
                    </span>
                  )}
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
