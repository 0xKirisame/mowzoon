// Rank Score — the leaderboard ladder. Separate from `drops` (which already
// accumulates healthy behaviour and powers levels). This is the competitive
// layer: an uncapped points ladder driven by gameplay, where financial health
// is a live MULTIPLIER on gains and losses.
//
//   healthy habits  → gains up to x1.5, losses softened
//   unhealthy habits → gains shrunk,     losses amplified
//
// Ghost battles are ranked; pass-&-play is casual and leaves rank untouched.
// Farming weak bots doesn't pay: oppFactor shrinks gains against opponents
// below your level.

export const BASE_WIN = 25;
export const BASE_LOSS = 20;
export const HEALTH_SPREAD = 0.5; // multiplier range 0.5x…1.5x
export const LEVEL_STEP = 0.15;   // opponent-strength sensitivity
export const HEALTH_MULT_CLAMP = [0.5, 1.5];
export const OPP_FACTOR_CLAMP = [0.3, 1.8];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Mean of the three live metrics (0..100) → the standing of a healthy player.
export function healthOf(metrics) {
  if (!metrics) return 50; // neutral if we have no read yet
  return (metrics.efficiency + metrics.resilience + metrics.eq) / 3;
}

// health 0..100 → multiplier centred on 1.0 at average (50).
export function healthMult(health) {
  return clamp(1 + ((health - 50) / 50) * HEALTH_SPREAD, HEALTH_MULT_CLAMP[0], HEALTH_MULT_CLAMP[1]);
}

// Anti-farm: reward beating stronger opponents, punish losing to weaker ones.
export function oppFactor(myLevel, oppLevel) {
  return clamp(1 + (oppLevel - myLevel) * LEVEL_STEP, OPP_FACTOR_CLAMP[0], OPP_FACTOR_CLAMP[1]);
}

// Apply one ranked match result to the current score. Uncapped upward, floored
// at 0. Returns the new score (rounded).
export function applyMatchResult(score, { won, health, myLevel, oppLevel }) {
  const hm = healthMult(health);
  const of = oppFactor(myLevel, oppLevel);
  if (won) return Math.round(score + BASE_WIN * of * hm);
  // healthy players lose less: (2 - hm) < 1 when hm > 1
  return Math.max(0, Math.round(score - BASE_LOSS * of * (2 - hm)));
}
