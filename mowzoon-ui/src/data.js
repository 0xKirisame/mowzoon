// Archetype visual identity. Survey questions live in survey.js,
// scoring in scoring.js.

export const DEFAULT_TINT = '#0a84ff';

// Curated accents (guaranteed to read on the monogram). null = follow archetype.
export const ACCENTS = ['#0a84ff', '#5e5ce6', '#ff375f', '#0fa38f', '#e8890b', '#ff2d55', '#30b0c7', '#34c759'];

// Visual identity for the four archetypes produced by the model,
// keyed by the archetype id returned from determineArchetype().
export const ARCHETYPE_META = {
  0: {
    name: 'The Impulse Spender', tint: '#ff375f', glyph: 'bolt',
    tagline: 'Feels first, spends second',
    desc: 'High emotion-driven spending, high weekend spikes, low efficiency.',
  },
  1: {
    name: 'The Anxious Planner', tint: '#5e5ce6', glyph: 'shield',
    tagline: 'Saves everything, enjoys too little',
    desc: 'High savings rate, low discretionary spend, low spending efficiency score.',
  },
  2: {
    name: 'The Blind Investor', tint: '#e8890b', glyph: 'trend',
    tagline: 'Bold bets, thin cushion',
    desc: 'High investment allocation, critical lack of cash buffer.',
  },
  3: {
    name: 'The Survivalist', tint: '#0fa38f', glyph: 'peak',
    tagline: 'Steady hands, narrow margins',
    desc: 'Income tightly consumed by fixed costs, highly vulnerable to periodic spikes.',
  },
};

export const METRIC_LABELS = [
  ['efficiency', 'Spending efficiency', 'How intentionally your money gets spent'],
  ['resilience', 'Proactive resilience', 'Your cushion when life surprises you'],
  ['eq', 'Financial EQ', 'How calm your decisions stay under emotion'],
];

// Transaction category tints (used for icons & amounts)
export const TYPE_TINTS = {
  fixed: '#5e5ce6',
  discretionary: '#ff375f',
  savings: '#248a3d',
  spike: '#c93400',
};

export const QUICK_ADDS = [
  { desc: 'Rent',             icon: 'home',    type: 'fixed',         amount: 1500 },
  { desc: 'Videogame',        icon: 'gamepad', type: 'discretionary', amount: 60 },
  { desc: 'Late-night order', icon: 'moon',    type: 'discretionary', amount: 30 },
  { desc: 'Index fund',       icon: 'trend',   type: 'savings',       amount: 500 },
  { desc: 'Car repair',       icon: 'car',     type: 'spike',         amount: 3000 },
  { desc: 'Doctor visit',     icon: 'plus',    type: 'spike',         amount: 180 },
];
