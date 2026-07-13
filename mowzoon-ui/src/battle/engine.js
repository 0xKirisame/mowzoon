// Turn-based battle state machine. Pure reducer (drives a useReducer in the UI
// later; fully testable headless now). Two player options per turn: attack, or
// the archetype affinity-ability.
//
//   state = {
//     mode, ranked,
//     actors: { player: Actor, enemy: Actor },
//     turn: 'player' | 'enemy',
//     phase: 'choose' | 'spin' | 'ended',
//     pending: null | { spinsLeft, speed, dmgMult, missMult, wheel },
//     winner: null | 'player' | 'enemy',
//     log: [string],
//   }
//   Actor = { card, maxHP, hp, power, statuses:[], cooldowns:{ [abilityKey]: n } }
//
// All combat routes through applyDamage(), so Contingency Fund (shield) and
// Last Reserve (lastStand) can never be bypassed by a new damage source.

import { deriveStats } from './character';
import { computeWheel, resolveSpin } from './wheel';
import { ABILITIES, abilityFor } from './abilities';

const other = (side) => (side === 'player' ? 'enemy' : 'player');

function makeActor(card) {
  const st = deriveStats(card.aid, card.level);
  return { card, maxHP: st.maxHP, hp: st.maxHP, power: st.power, statuses: [], cooldowns: {} };
}

export function initBattle({ mode = 'single', player, enemy }) {
  return {
    mode,
    ranked: mode !== 'single', // only ghost/trade affect Rank Score
    actors: { player: makeActor(player), enemy: makeActor(enemy) },
    turn: 'player',
    phase: 'choose',
    pending: null,
    winner: null,
    log: [],
  };
}

// --- damage pipeline (the single choke point) -----------------------------

function applyDamage(actor, rawDmg) {
  const statuses = actor.statuses.map((s) => ({ ...s }));
  let dmg = rawDmg;

  // Contingency Fund: halve, spending one charge — but only on a real hit, so a
  // miss (0 dmg) never wastes the shield.
  if (dmg > 0) {
    const shield = statuses.find((s) => s.type === 'shield' && s.charges > 0);
    if (shield) {
      dmg = Math.round(dmg * shield.mult);
      shield.charges -= 1;
    }
  }

  let hp = actor.hp - dmg;

  // Last Reserve: convert the first otherwise-fatal hit into 1 HP.
  if (hp <= 0) {
    const ls = statuses.find((s) => s.type === 'lastStand' && s.charges > 0);
    if (ls) {
      hp = 1;
      ls.charges -= 1;
    }
  }
  hp = Math.max(0, hp);

  const kept = statuses.filter((s) => s.charges === undefined || s.charges > 0);
  return { actor: { ...actor, hp, statuses: kept }, dealt: actor.hp - hp };
}

// Consume a queued "All In" buff (if any) when an attack is built.
function consumeAllIn(actor, base) {
  const allIn = actor.statuses.find((s) => s.type === 'allIn');
  if (!allIn) return { actor, mods: base };
  return {
    actor: { ...actor, statuses: actor.statuses.filter((s) => s !== allIn) },
    mods: { ...base, dmgMult: base.dmgMult * allIn.dmgMult, missMult: base.missMult * allIn.missMult },
  };
}

// --- turn transitions ------------------------------------------------------

// End the acting side's turn: tick down their cooldowns, then hand over.
function endTurn(state, actedSide, actors) {
  const acted = actors[actedSide];
  const cooldowns = {};
  for (const k of Object.keys(acted.cooldowns)) cooldowns[k] = Math.max(0, acted.cooldowns[k] - 1);
  const next = { ...actors, [actedSide]: { ...acted, cooldowns } };
  return { ...state, actors: next, turn: other(actedSide), phase: 'choose', pending: null };
}

function checkWin(state, actors) {
  if (actors.player.hp <= 0) return { ...state, actors, phase: 'ended', winner: 'enemy' };
  if (actors.enemy.hp <= 0) return { ...state, actors, phase: 'ended', winner: 'player' };
  return null;
}

// --- reducer ---------------------------------------------------------------

export function battleReducer(state, action) {
  if (state.phase === 'ended') return state;
  const side = state.turn;
  const foe = other(side);
  const attacker = state.actors[side];
  const defender = state.actors[foe];

  switch (action.type) {
    case 'CHOOSE_ATTACK': {
      if (state.phase !== 'choose') return state;
      const { actor: atk, mods } = consumeAllIn(attacker, { spinsLeft: 1, speed: 1, dmgMult: 1, missMult: 1 });
      const wheel = computeWheel(atk, defender, { speed: mods.speed, missMult: mods.missMult });
      const actors = { ...state.actors, [side]: atk };
      return { ...state, actors, phase: 'spin', pending: { ...mods, wheel } };
    }

    case 'CHOOSE_ABILITY': {
      if (state.phase !== 'choose') return state;
      const ab = abilityFor(attacker.card.aid);
      if (!ab || (attacker.cooldowns[ab.key] ?? 0) > 0) return state; // unavailable
      const onCd = { ...attacker.cooldowns, [ab.key]: ab.cooldown };

      if (ab.kind === 'attack') {
        // Splurge: an offensive ability that leads straight into spinning.
        const base = ab.setup(); // { spinsLeft, speed, dmgMult, missMult }
        const withCd = { ...attacker, cooldowns: onCd };
        const { actor: atk, mods } = consumeAllIn(withCd, base);
        const wheel = computeWheel(atk, defender, { speed: mods.speed, missMult: mods.missMult });
        const actors = { ...state.actors, [side]: atk };
        return { ...state, actors, phase: 'spin', pending: { ...mods, wheel }, log: [...state.log, `${side} uses ${ab.name}`] };
      }

      // Buff ability: apply status, then it is this turn's whole action.
      const buffed = { ...attacker, statuses: [...attacker.statuses, ab.status()], cooldowns: onCd };
      const actors = { ...state.actors, [side]: buffed };
      return endTurn({ ...state, log: [...state.log, `${side} uses ${ab.name}`] }, side, actors);
    }

    case 'RESOLVE_SPIN': {
      if (state.phase !== 'spin' || !state.pending) return state;
      const p = state.pending;
      const { region, damage } = resolveSpin(action.stopFrac, p.wheel, attacker.power, p.dmgMult);
      const { actor: hitFoe, dealt } = applyDamage(defender, damage);
      let actors = { ...state.actors, [foe]: hitFoe };
      const log = [...state.log, `${side} ${region}${dealt ? ` for ${dealt}` : ''}`];

      const won = checkWin({ ...state, log }, actors);
      if (won) return won;

      const spinsLeft = p.spinsLeft - 1;
      if (spinsLeft > 0) {
        // Splurge's second swing — same wheel, still the attacker's turn.
        return { ...state, actors, log, pending: { ...p, spinsLeft } };
      }
      return endTurn({ ...state, log }, side, actors);
    }

    default:
      return state;
  }
}
