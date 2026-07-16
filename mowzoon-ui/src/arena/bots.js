// Demo opponents for the Arena. Also the offline fallback roster when the
// API is unreachable, and the seed data mirrored by the backend. Shapes
// match what /arena/roster returns.

export const BOTS = [
  {
    handle: 'noura', name: 'Noura', archetype: 0, bot: true,
    metrics: { efficiency: 82, resilience: 28, eq: 45 },
    level: 3, // glass cannon: hits hard, folds fast
    loadout: { effects: ['compound'], ability: 'splurge' },
  },
  {
    handle: 'salem', name: 'Salem', archetype: 3, bot: true,
    metrics: { efficiency: 40, resilience: 90, eq: 55 },
    level: 4, // tank: outlasts everything
    loadout: { effects: ['cashback', 'compound'], ability: 'rationing' },
  },
  {
    handle: 'rakan', name: 'Rakan', archetype: 2, bot: true,
    metrics: { efficiency: 60, resilience: 45, eq: 88 },
    level: 5, // crit fisher: lives and dies by the wheel
    loadout: { effects: ['highyield', 'compound'], ability: 'allin' },
  },
  {
    handle: 'layla', name: 'Layla', archetype: 1, bot: true,
    metrics: { efficiency: 55, resilience: 70, eq: 62 },
    level: 3, // attrition: guards and heals through long fights
    loadout: { effects: ['cashback'], ability: 'contingency' },
  },
  {
    handle: 'dana', name: 'Dana', archetype: 1, bot: true,
    metrics: { efficiency: 68, resilience: 50, eq: 75 },
    level: 4, // control: debuffs your wheel and picks you apart
    loadout: { effects: ['highyield', 'cashback'], ability: 'overplan' },
  },
  {
    handle: 'faisal', name: 'Faisal', archetype: 3, bot: true,
    metrics: { efficiency: 50, resilience: 60, eq: 50 },
    level: 2, // the friendly first opponent
    loadout: { effects: ['cashback'], ability: 'reserve' },
  },
];
