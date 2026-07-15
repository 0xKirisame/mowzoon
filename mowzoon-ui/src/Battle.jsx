// The battle overlay: two fighters, the timing wheel, and two actions —
// Attack or the archetype's affinity-ability. All rules live in src/battle/;
// this file only animates them. Rendered full-screen over the arena.

import { useEffect, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { ARCHETYPE_META } from './data';
import { Glyph, spring, gel } from './ui';
import { useI18n } from './i18n';
import { initBattle, battleReducer } from './battle/engine';
import { abilityFor } from './battle/abilities';
import { sampleStopFrac, chooseAction } from './battle/ai';

const REV_PER_SEC = 1.75; // base pointer speed; the wheel's speed multiplies it

const STATUS_GLYPHS = { shield: 'shield', allIn: 'bolt', lastStand: 'peak' };

function Fighter({ actor, active, mirror }) {
  const i = useI18n();
  const meta = ARCHETYPE_META[actor.card.aid];
  const pct = Math.max(0, actor.hp / actor.maxHP);
  // floating damage number when HP drops
  const prev = useRef(actor.hp);
  const [pop, setPop] = useState(null);
  useEffect(() => {
    const d = prev.current - actor.hp;
    prev.current = actor.hp;
    if (d > 0) setPop({ id: Date.now(), d });
  }, [actor.hp]);
  return (
    <div className={`bt-fighter ${active ? 'on' : ''} ${mirror ? 'mirror' : ''}`} style={{ '--ft': meta.tint }}>
      <span className="bt-glyph"><Glyph id={meta.glyph} size={21} strokeWidth={2} /></span>
      <div className="bt-meta">
        <b className="bt-name">{actor.card.name || i.arch(actor.card.aid).name}</b>
        <em className="bt-sub">{i.t('battle.lv', { n: i.fmtNum(actor.card.level) })} · {i.arch(actor.card.aid).name}</em>
        <div className="hp-track">
          <motion.i
            initial={false}
            animate={{ width: `${pct * 100}%` }}
            transition={spring}
            style={{ background: pct < 0.3 ? 'var(--neg)' : meta.tint }}
          />
        </div>
        <span className="hp-num">{i.fmtNum(actor.hp)} / {i.fmtNum(actor.maxHP)}</span>
      </div>
      {actor.statuses.length > 0 && (
        <span className="bt-statuses">
          {actor.statuses.map((s, idx) => (
            <i key={idx} className="bt-status" title={s.type}>
              <Glyph id={STATUS_GLYPHS[s.type] || 'spark'} size={11} strokeWidth={2.4} />
              {s.charges > 1 ? `×${s.charges}` : ''}
            </i>
          ))}
        </span>
      )}
      <AnimatePresence>
        {pop && (
          <motion.span
            key={pop.id}
            className="hp-pop"
            initial={{ opacity: 0, y: 4, scale: 0.7 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, y: -26, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            onAnimationComplete={() => setTimeout(() => setPop(null), 350)}
          >
            −{i.fmtNum(pop.d)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// Donut wheel: three ring segments (miss / hit / crit) starting at 12 o'clock
// clockwise, matching resolveSpin's fraction order. The needle is rotated by
// writing transforms straight to the DOM node — setState at 60fps would
// re-render the whole overlay every frame.
function Wheel({ wheel, needleRef, spinning, onTap, label }) {
  const segs = wheel
    ? [
      { key: 'miss', f0: 0, len: wheel.miss },
      { key: 'hit', f0: wheel.miss, len: wheel.hit },
      { key: 'crit', f0: wheel.miss + wheel.hit, len: wheel.crit },
    ]
    : [];
  return (
    <button className={`bt-wheel ${spinning ? 'spinning' : ''}`} onClick={onTap} dir="ltr" aria-label={label}>
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="84" className="wh-base" fill="none" strokeWidth="25" />
        <g transform="rotate(-90 100 100)">
          {segs.map((s) => (
            <circle
              key={s.key}
              className={`wh-${s.key}`}
              cx="100" cy="100" r="84"
              fill="none" strokeWidth="25"
              pathLength="1"
              strokeDasharray={`${Math.max(0, s.len - 0.006)} ${1 - Math.max(0, s.len - 0.006)}`}
              strokeDashoffset={-s.f0}
            />
          ))}
        </g>
      </svg>
      <span className="bt-needle" ref={needleRef} aria-hidden="true"><i /></span>
      <span className="bt-hub">{label}</span>
    </button>
  );
}

export default function Battle({ mode, player, enemy, difficulty = 0.55, rewards, onDone, onClose }) {
  const i = useI18n();
  const [st, dispatch] = useReducer(battleReducer, { mode, player, enemy }, initBattle);
  const trade = mode === 'trade';

  const needleRef = useRef(null);
  const angleRef = useRef(0);
  const rafRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState(null); // { id, region }
  const [handoff, setHandoff] = useState(false);
  const [abilityNotice, setAbilityNotice] = useState(null); // { side, name }
  const doneRef = useRef(false);
  const prevLogLen = useRef(0);

  const setNeedle = (deg) => {
    angleRef.current = ((deg % 360) + 360) % 360;
    if (needleRef.current) needleRef.current.style.transform = `rotate(${angleRef.current}deg)`;
  };

  const acting = st.actors[st.turn];
  const humanTurn = st.phase !== 'ended' && (st.turn === 'player' || trade);
  const ability = abilityFor(acting.card.aid);
  const cd = ability ? (acting.cooldowns[ability.key] ?? 0) : 0;

  const actorName = (side) =>
    st.actors[side].card.name || i.arch(st.actors[side].card.aid).name;

  // resolve a stopped needle: flash the region, then let the engine rule
  const settle = (frac) => {
    const w = st.pending.wheel;
    const f = ((frac % 1) + 1) % 1;
    const region = f < w.miss ? 'miss' : f < w.miss + w.hit ? 'hit' : 'crit';
    setFlash({ id: Date.now(), region });
    setTimeout(() => dispatch({ type: 'RESOLVE_SPIN', stopFrac: f }), 620);
    setTimeout(() => setFlash(null), 1500);
  };

  // human spin loop: run whenever it's a human's spin phase
  useEffect(() => {
    if (st.phase !== 'spin' || !humanTurn || !st.pending) return undefined;
    setSpinning(true);
    let last = performance.now();
    const speed = REV_PER_SEC * (st.pending.wheel.speed || 1);
    const step = (t) => {
      setNeedle(angleRef.current + (t - last) * 0.001 * speed * 360);
      last = t;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [st.phase, st.pending, st.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapWheel = () => {
    if (!spinning || !humanTurn) return;
    cancelAnimationFrame(rafRef.current);
    setSpinning(false);
    settle(angleRef.current / 360);
  };

  // CPU turns (single & ghost): think, then spin with a decelerating needle
  useEffect(() => {
    if (st.phase === 'ended' || trade || st.turn !== 'enemy') return undefined;
    if (st.phase === 'choose') {
      const id = setTimeout(() => dispatch(chooseAction(st)), 950);
      return () => clearTimeout(id);
    }
    if (st.phase === 'spin' && st.pending) {
      const frac = sampleStopFrac(st.pending.wheel, difficulty);
      const from = angleRef.current;
      const target = from + 720 + ((frac * 360 - from) % 360 + 360) % 360;
      const controls = animate(from, target, {
        duration: 1.5,
        ease: [0.25, 0.7, 0.25, 1],
        onUpdate: setNeedle,
        onComplete: () => settle(frac),
      });
      return () => controls.stop();
    }
    return undefined;
  }, [st.turn, st.phase, st.pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect ability usage from log entries
  useEffect(() => {
    if (st.log.length > prevLogLen.current) {
      const newest = st.log.slice(prevLogLen.current);
      for (const entry of newest) {
        const m = entry.match(/^(player|enemy) uses (.+)$/);
        if (m) {
          const side = m[1];
          const abName = m[2];
          const ab = abilityFor(st.actors[side].card.aid);
          // buff abilities skip the turn — show a notice
          if (ab && ab.kind === 'buff') {
            setAbilityNotice({ side, name: abName, actorName: actorName(side) });
          }
        }
      }
    }
    prevLogLen.current = st.log.length;
  }, [st.log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // trade mode: announce the hand-off whenever the turn flips
  const prevTurn = useRef(st.turn);
  useEffect(() => {
    if (trade && st.phase === 'choose' && st.turn !== prevTurn.current) setHandoff(true);
    prevTurn.current = st.turn;
  }, [st.turn, st.phase, trade]);

  // Non-trade mode: clear ability notice after a short delay
  useEffect(() => {
    if (!trade && abilityNotice) {
      const id = setTimeout(() => setAbilityNotice(null), 2200);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [abilityNotice, trade]);

  // report the outcome exactly once
  useEffect(() => {
    if (st.phase === 'ended' && !doneRef.current) {
      doneRef.current = true;
      onDone?.(st.winner === 'player');
    }
  }, [st.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const banner = st.phase === 'ended'
    ? null
    : flash
      ? i.t(`battle.${flash.region}`)
      : humanTurn
        ? (trade ? i.t('battle.move.of', { name: actorName(st.turn) }) : i.t('battle.your-move'))
        : i.t('battle.thinking', { name: actorName('enemy') });

  return (
    <motion.div className="bt-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="bt-stage"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.16 } }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <button className="bt-x" onClick={onClose} aria-label={i.t('battle.forfeit')}>×</button>

        <div className="bt-fighters">
          <Fighter actor={st.actors.player} active={st.turn === 'player' && st.phase !== 'ended'} />
          <span className="bt-vs" aria-hidden="true">{i.t('battle.vs')}</span>
          <Fighter actor={st.actors.enemy} active={st.turn === 'enemy' && st.phase !== 'ended'} mirror />
        </div>

        <div className="bt-arena-mid">
          <Wheel
            wheel={st.pending?.wheel ?? null}
            needleRef={needleRef}
            spinning={spinning}
            onTap={tapWheel}
            label={spinning ? i.t('battle.tap') : ''}
          />
          <AnimatePresence mode="wait">
            <motion.p
              key={banner}
              className={`bt-banner ${flash && banner === i.t(`battle.${flash.region}`) ? `is-${flash.region}` : ''}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={spring}
            >
              {banner}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* actions: attack or affinity-ability */}
        <div className="bt-actions">
          <motion.button
            className="bt-act bt-attack"
            disabled={!humanTurn || st.phase !== 'choose'}
            whileTap={{ scale: 0.95 }}
            transition={gel}
            onClick={() => dispatch({ type: 'CHOOSE_ATTACK' })}
          >
            <Glyph id="swords" size={18} strokeWidth={2} />
            {i.t('battle.attack')}
          </motion.button>
          <motion.button
            className="bt-act bt-ability"
            disabled={!humanTurn || st.phase !== 'choose' || cd > 0}
            whileTap={{ scale: 0.95 }}
            transition={gel}
            onClick={() => dispatch({ type: 'CHOOSE_ABILITY' })}
          >
            <Glyph id="spark" size={18} strokeWidth={2} />
            <span className="bt-act-meta">
              {i.t(`ability.${acting.card.aid}.name`)}
              <em>{cd > 0 ? i.t('battle.cooldown', { n: i.fmtNum(cd) }) : i.t(`ability.${acting.card.aid}.d`)}</em>
            </span>
          </motion.button>
        </div>

        {/* trade-mode hand-off card */}
        <AnimatePresence>
          {handoff && st.phase !== 'ended' && (
            <motion.div className="bt-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {(() => {
                const turnMeta = ARCHETYPE_META[st.actors[st.turn].card.aid];
                return (
                  <span className="bt-handoff-glyph" style={{ '--ft': turnMeta.tint }}>
                    <Glyph id={turnMeta.glyph} size={28} strokeWidth={1.9} />
                  </span>
                );
              })()}
              {abilityNotice && (
                <p className="bt-ability-notice">
                  <Glyph id="spark" size={14} strokeWidth={2.2} />
                  {i.t('battle.ability.used', { name: abilityNotice.actorName, ability: abilityNotice.name })}
                </p>
              )}
              <p className="bt-pass">{i.t('battle.pass', { name: actorName(st.turn) })}</p>
              <motion.button className="btn-ink" whileTap={{ scale: 0.96 }} onClick={() => { setHandoff(false); setAbilityNotice(null); }}>
                {i.t('battle.ready')}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* end card */}
        <AnimatePresence>
          {st.phase === 'ended' && (
            <motion.div className="bt-cover" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.5 } }} exit={{ opacity: 0 }}>
              <motion.span
                className={`bt-end-mark ${st.winner === 'player' ? 'win' : 'loss'}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: { ...gel, delay: 0.62 } }}
              >
                <Glyph id={st.winner === 'player' ? 'trophy' : 'moon'} size={30} strokeWidth={1.8} />
              </motion.span>
              <h3 className="bt-end-title">
                {trade
                  ? i.t('battle.wins', { name: actorName(st.winner) })
                  : st.winner === 'player' ? i.t('battle.victory') : i.t('battle.defeat')}
              </h3>
              {rewards && (
                <div className="bt-rewards">
                  {rewards.drops > 0 && <span className="bt-reward">{i.t('toast.drops', { n: i.fmtNum(rewards.drops) })}</span>}
                  {rewards.ranked && (
                    <span className={`bt-reward ${rewards.rankDelta >= 0 ? 'up' : 'down'}`}>
                      {rewards.rankDelta >= 0
                        ? i.t('battle.rank.up', { n: i.fmtNum(rewards.rankDelta) })
                        : i.t('battle.rank.down', { n: i.fmtNum(Math.abs(rewards.rankDelta)) })}
                    </span>
                  )}
                  {!rewards.ranked && <span className="bt-reward dim">{i.t('battle.practice.note')}</span>}
                </div>
              )}
              <motion.button className="btn-ink bt-done" whileTap={{ scale: 0.96 }} onClick={onClose}>
                {i.t('battle.done')}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ability notice for non-trade mode */}
      <AnimatePresence>
        {!trade && abilityNotice && st.phase !== 'ended' && (
          <motion.div
            className="bt-ability-toast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            transition={spring}
          >
            <Glyph id="spark" size={14} strokeWidth={2.2} />
            {i.t('battle.ability.used', { name: abilityNotice.actorName, ability: abilityNotice.name })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
