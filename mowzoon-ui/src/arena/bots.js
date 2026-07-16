// Demo opponents for the Arena. Also the offline fallback roster when the
// API is unreachable, and the seed data mirrored by the backend. Shapes
// match what /arena/roster returns.

// Arabic display names for the seeded roster; real players keep whatever
// name they typed. Keyed by handle so server rows localize too.
const BOT_NAMES_AR = {
  noura: 'نورة', salem: 'سالم', rakan: 'راكان', layla: 'ليلى', dana: 'دانة', faisal: 'فيصل',
};

export const botName = (c, lang) =>
  (lang === 'ar' && c?.bot && BOT_NAMES_AR[c.handle]) || c?.name || c?.handle || '';

export const BOTS = [
  {
    handle: 'noura', name: 'Noura', rankScore: 74, archetype: 0, bot: true,
    metrics: { efficiency: 82, resilience: 28, eq: 45 },
    level: 3, // glass cannon: hits hard, folds fast
    loadout: { effects: ['compound'], ability: 'splurge' },
  },
  {
    handle: 'salem', name: 'Salem', rankScore: 121, archetype: 3, bot: true,
    metrics: { efficiency: 40, resilience: 90, eq: 55 },
    level: 4, // tank: outlasts everything
    loadout: { effects: ['cashback', 'compound'], ability: 'rationing' },
  },
  {
    handle: 'rakan', name: 'Rakan', rankScore: 158, archetype: 2, bot: true,
    metrics: { efficiency: 60, resilience: 45, eq: 88 },
    level: 5, // crit fisher: lives and dies by the wheel
    loadout: { effects: ['highyield', 'compound'], ability: 'allin' },
  },
  {
    handle: 'layla', name: 'Layla', rankScore: 63, archetype: 1, bot: true,
    metrics: { efficiency: 55, resilience: 70, eq: 62 },
    level: 3, // attrition: guards and heals through long fights
    loadout: { effects: ['cashback'], ability: 'contingency' },
  },
  {
    handle: 'dana', name: 'Dana', rankScore: 97, archetype: 1, bot: true,
    metrics: { efficiency: 68, resilience: 50, eq: 75 },
    level: 4, // control: debuffs your wheel and picks you apart
    loadout: { effects: ['highyield', 'cashback'], ability: 'overplan' },
  },
  {
    handle: 'faisal', name: 'Faisal', rankScore: 28, archetype: 3, bot: true,
    metrics: { efficiency: 50, resilience: 60, eq: 50 },
    level: 2, // the friendly first opponent
    loadout: { effects: ['cashback'], ability: 'reserve' },
  },
];
