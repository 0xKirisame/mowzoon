// Game layer. Drops are earned by logging, opening the app, calibrating,
// and finishing quests. Progress is computed from the ledger; reward
// amounts live in DROPS.

import { streakOf } from './store';

export const DROPS = {
  log: 5,       // logging one transaction
  daily: 5,     // first open of the day
  calibrate: 25, // finishing (or retaking) the assessment
  badge: 15,    // each badge earned
  quest: 40,    // collecting a finished quest
  arenaWin: 25, // winning a ghost battle in the arena (losses pay nothing)
};

// level thresholds
export const LEVELS = [0, 80, 200, 400, 700];

export function levelOf(drops) {
  let n = 1;
  for (let k = 1; k < LEVELS.length; k++) if (drops >= LEVELS[k]) n = k + 1;
  const floor = LEVELS[n - 1];
  const ceil = LEVELS[n] ?? null; // null means max level, orb stays full
  return {
    n,
    floor,
    ceil,
    pct: ceil ? Math.min(1, (drops - floor) / (ceil - floor)) : 1,
  };
}

// Weekly quests, keyed by archetype. Progress counts up from logged
// behaviour since the quest was issued.
const sinceDays = (tx, iso) => {
  const days = new Set();
  for (const t of tx) if (!t.demo && t.date >= iso) days.add(t.date);
  return days.size;
};
const sinceSum = (tx, iso, type) =>
  tx.reduce((a, t) => a + (!t.demo && t.date >= iso && t.type === type ? t.amount : 0), 0);
const sinceCount = (tx, iso, type) =>
  tx.reduce((a, t) => a + (!t.demo && t.date >= iso && t.type === type ? 1 : 0), 0);

export const QUESTS = {
  // Impulse Spender: log spending on 4 different days
  0: { key: 'mindful', target: 4, kind: 'days', measure: (tx, iso) => sinceDays(tx, iso) },
  // Anxious Planner: log one treat for yourself
  1: { key: 'treat', target: 1, kind: 'count', measure: (tx, iso) => sinceCount(tx, iso, 'discretionary') },
  // Blind Investor: move money into savings
  2: { key: 'buffer', target: 100, kind: 'money', measure: (tx, iso) => sinceSum(tx, iso, 'savings') },
  // Survivalist: set a little aside
  3: { key: 'setaside', target: 20, kind: 'money', measure: (tx, iso) => sinceSum(tx, iso, 'savings') },
};

export function issueQuest(aid, todayIso) {
  const q = QUESTS[aid] ?? QUESTS[0];
  return { key: q.key, aid, startedISO: todayIso, done: false };
}

export function questProgress(app, quest) {
  if (!quest) return null;
  const spec = QUESTS[quest.aid] ?? QUESTS[0];
  const value = Math.min(spec.target, spec.measure(app.tx, quest.startedISO));
  return { value, target: spec.target, kind: spec.kind, pct: value / spec.target };
}

// Badges. Glyphs come from the icon set; copy lives in i18n.
export const BADGES = [
  { id: 'first-log', glyph: 'plus', check: (app) => app.tx.some((t) => !t.demo) },
  { id: 'calibrated', glyph: 'sliders', check: (app) => !!app.survey },
  { id: 'streak-3', glyph: 'flame', check: (app) => streakOf(app.visits) >= 3 },
  { id: 'streak-7', glyph: 'flame', check: (app) => streakOf(app.visits) >= 7 },
  { id: 'saver-500', glyph: 'shield', check: (app) => app.tx.reduce((a, t) => a + (!t.demo && t.type === 'savings' ? t.amount : 0), 0) >= 500 },
  { id: 'planner', glyph: 'peak', check: (app) => (app.plans || []).length >= 1 },
  { id: 'tracker', glyph: 'calendar', check: (app) => (app.subs || []).length >= 1 },
  { id: 'cartographer', glyph: 'compass', check: (app) => !!app.game?.flags?.map },
  { id: 'quest-1', glyph: 'spark', check: (app) => (app.game?.questsDone || 0) >= 1 },
  { id: 'week-5', glyph: 'trend', check: (app) => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return sinceDays(app.tx, iso) >= 5;
    } },
  { id: 'arena-first', glyph: 'swords', check: (app) => (app.arena?.wins || 0) >= 1 },
  { id: 'arena-streak-3', glyph: 'swords', check: (app) => (app.arena?.bestStreak || 0) >= 3 },
];

export function newlyEarned(app) {
  const owned = app.game?.badges || {};
  return BADGES.filter((b) => !owned[b.id] && b.check(app));
}
