// CPU decisions for single-player (default enemies) and ghost mode (a clone of
// a friend's card). Trade mode is fully human, so the AI is unused there.
//
// The CPU plays by the same wheel it is shown: sampleStopFrac draws from its own
// region sizes, with a single `difficulty` knob biasing it away from misses.
// Ability timing is a handful of per-archetype heuristics.

import { resolveSpin } from './wheel';
import { abilityFor } from './abilities';

// Draw a stop position. With probability `difficulty` the CPU lands inside the
// hit+crit arc (no miss); otherwise it spins honestly and may miss.
export function sampleStopFrac(wheel, difficulty = 0.6, rng = Math.random) {
  if (rng() < difficulty) return wheel.miss + rng() * (wheel.hit + wheel.crit);
  return rng();
}

function ratio(actor) {
  return actor.hp / actor.maxHP;
}
function has(actor, type) {
  return actor.statuses.some((s) => s.type === type && (s.charges === undefined || s.charges > 0));
}

// Pick this turn's action for the acting side. Returns a dispatchable action.
export function chooseAction(state, opts = {}) {
  const { rng = Math.random } = opts;
  const side = state.turn;
  const foe = side === 'player' ? 'enemy' : 'player';
  const me = state.actors[side];
  const enemy = state.actors[foe];
  const ab = abilityFor(me.card.aid);
  const ready = ab && (me.cooldowns[ab.key] ?? 0) <= 0;

  if (ready) {
    const myHp = ratio(me);
    switch (me.card.aid) {
      case 3: // Survivalist — Last Reserve: save it for when death is near
        if (myHp <= 0.35 && !has(me, 'lastStand')) return { type: 'CHOOSE_ABILITY' };
        break;
      case 1: // Anxious — Contingency Fund: shield up when hurt
        if (myHp <= 0.5 && !has(me, 'shield')) return { type: 'CHOOSE_ABILITY' };
        break;
      case 2: // Blind — All In: gamble for a kill, or when comfortably ahead
        if (enemy.hp <= me.power * 2 || (myHp > 0.6 && rng() < 0.4)) return { type: 'CHOOSE_ABILITY' };
        break;
      case 0: // Impulse — Splurge: burst when it could finish, else stay aggressive
        if (enemy.hp <= me.power * 3 || rng() < 0.3) return { type: 'CHOOSE_ABILITY' };
        break;
      default:
        break;
    }
  }
  return { type: 'CHOOSE_ATTACK' };
}

// Convenience for a driver loop: given the enemy's turn, return the next action
// to dispatch (choose, then resolve the spin), or null when it isn't the CPU's
// move. UI/tests loop: while ((a = stepEnemy(state, opts))) state = reducer(state, a).
export function stepEnemy(state, opts = {}) {
  const { difficulty = 0.6, rng = Math.random } = opts;
  if (state.turn !== 'enemy' || state.phase === 'ended') return null;
  if (state.phase === 'spin') {
    return { type: 'RESOLVE_SPIN', stopFrac: sampleStopFrac(state.pending.wheel, difficulty, rng) };
  }
  return chooseAction(state, { rng });
}

// Re-exported so a difficulty-tuned preview of CPU odds is available if needed.
export { resolveSpin };
