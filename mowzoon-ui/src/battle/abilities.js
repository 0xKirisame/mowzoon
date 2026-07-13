// One affinity-ability per archetype. Each is either 'attack' (an offensive
// variant that leads straight into spinning) or 'buff' (applies a status and
// ends the turn). Cooldowns are archetype-specific, tuned to each ability's
// power — a fresh battle starts every ability ready.
//
// The engine reads these descriptors; the actual state changes (statuses,
// pending spins, the damage pipeline) happen in engine.js so there is a single
// place that honours shields and last-stand.

export const ABILITIES = {
  // Impulse Spender — attack twice this turn, wheel 1.5x speed (harder timing)
  0: {
    key: 'splurge',
    name: 'Splurge',
    kind: 'attack',
    cooldown: 3,
    // pending attack descriptor merged into the turn
    setup: () => ({ spinsLeft: 2, speed: 1.5, dmgMult: 1, missMult: 1 }),
  },
  // Anxious Planner — incoming damage halved for the next 2 enemy hits
  1: {
    key: 'contingency',
    name: 'Contingency Fund',
    kind: 'buff',
    cooldown: 4,
    status: () => ({ type: 'shield', mult: 0.5, charges: 2 }),
  },
  // Blind Investor — next attack 2x damage but miss arc doubles
  2: {
    key: 'allIn',
    name: 'All In',
    kind: 'buff',
    cooldown: 3,
    status: () => ({ type: 'allIn', dmgMult: 2, missMult: 2 }),
  },
  // Survivalist — first otherwise-fatal hit leaves you at 1 HP
  3: {
    key: 'lastReserve',
    name: 'Last Reserve',
    kind: 'buff',
    cooldown: 5,
    status: () => ({ type: 'lastStand', charges: 1 }),
  },
};

export function abilityFor(aid) {
  return ABILITIES[aid] ?? null;
}

// Is the actor's ability available (not on cooldown)?
export function abilityReady(actor) {
  const ab = abilityFor(actor.card.aid);
  return !!ab && (actor.cooldowns[ab.key] ?? 0) <= 0;
}
