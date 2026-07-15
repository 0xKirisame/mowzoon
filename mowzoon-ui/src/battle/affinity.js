// Affinity (type advantage) between the four archetypes, Pokémon-style.
// A clean 4-cycle: each archetype is STRONG against exactly one other, WEAK
// against exactly one, and EVEN against the remaining (opposite) one.
//
//   3 Survivalist → 0 Impulse → 1 Anxious → 2 Blind → 3 Survivalist
//
// Rationale: discipline tames impulse; chaos overwhelms the over-cautious
// planner; caution exposes reckless bets; bold growth outpaces bare survival.
//
// Advantage manifests ONLY as a wider/narrower hit arc on the wheel (see
// wheel.js), never as a raw damage multiplier.

// attacker aid -> the defender aid it is STRONG against
export const BEATS = { 3: 0, 0: 1, 1: 2, 2: 3 };

// 'strong' | 'weak' | 'even'
export function matchup(attackerAid, defenderAid) {
  if (BEATS[attackerAid] === defenderAid) return 'strong';
  if (BEATS[defenderAid] === attackerAid) return 'weak';
  return 'even';
}
