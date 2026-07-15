// The attack wheel. 360° laid out in fixed order so the crit sweet-spot sits at
// the risky trailing edge of the hit zone (overshoot crit → wraps into miss):
//
//   frac 0 ─ [ MISS ] ─ [ HIT ] ─ [ CRIT ] ─ 1  (wraps to MISS)
//
// Region sizes come from base + level + affinity. Higher level always grows
// hit+crit and shrinks miss; affinity shifts the hit arc ±0.10. All the tuning
// lives in the constants below.

import { matchup } from './affinity';

export const HIT_BASE = 0.30;
export const CRIT_BASE = 0.06;
export const HIT_PER_LVL = 0.035;
export const CRIT_PER_LVL = 0.015;
export const AFFINITY_HIT = { strong: +0.1, weak: -0.1, even: 0 };
export const MIN_MISS = 0.1; // always keep some risk, even on a maxed wheel
export const HIT_CLAMP = [0.15, 0.62];
export const CRIT_CLAMP = [0.04, 0.16];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Returns { miss, hit, crit, speed } as fractions of the circle summing to 1.
// opts: { speed } spin-speed multiplier (Splurge), { missMult } miss-arc
// multiplier (Blind Investor "All In").
export function computeWheel(attacker, defender, opts = {}) {
  const m = defender ? matchup(attacker.aid, defender.aid) : 'even';
  const lvlUp = (attacker.level || 1) - 1;

  let crit = clamp(CRIT_BASE + CRIT_PER_LVL * lvlUp, CRIT_CLAMP[0], CRIT_CLAMP[1]);
  let hit = clamp(HIT_BASE + HIT_PER_LVL * lvlUp + AFFINITY_HIT[m], HIT_CLAMP[0], HIT_CLAMP[1]);
  let miss = 1 - hit - crit;

  // reserve a minimum miss arc by scaling hit+crit down proportionally
  if (miss < MIN_MISS) {
    const scale = (1 - MIN_MISS) / (hit + crit);
    hit *= scale;
    crit *= scale;
    miss = MIN_MISS;
  }

  // "All In": double the miss arc, giving hit/crit back the remainder
  if (opts.missMult && opts.missMult !== 1) {
    const newMiss = Math.min(0.85, miss * opts.missMult);
    const scale = (1 - newMiss) / (hit + crit);
    hit *= scale;
    crit *= scale;
    miss = newMiss;
  }

  return { miss, hit, crit, speed: opts.speed ?? 1 };
}

// Map where the pointer stopped (frac 0..1) to an outcome. Pure, so the UI just
// reports the stop position and the AI reuses it by sampling stopFrac.
export function resolveSpin(stopFrac, wheel, power, dmgMult = 1) {
  const f = (((stopFrac % 1) + 1) % 1); // normalise into [0,1)
  let region;
  if (f < wheel.miss) region = 'miss';
  else if (f < wheel.miss + wheel.hit) region = 'hit';
  else region = 'crit';
  const mult = region === 'miss' ? 0 : region === 'crit' ? 2 : 1;
  return { region, damage: Math.round(power * mult * dmgMult) };
}
