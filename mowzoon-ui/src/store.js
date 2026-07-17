// all app state lives in one localStorage doc; clearing it resets to first-run

import { useEffect, useRef, useState } from 'react';

const KEY = 'mz-app-v1';

const EMPTY = {
  income: 5000,
  tx: [],            // { id, desc, amount, type, date: 'yyyy-mm-dd', icon, demo?, note?, recurringId? }
  survey: null,      // { metrics, answers, date }
  nudge: null,       // { date, archetypeId, text, spikes }, stable for the day
  visits: [],        // ISO days, most recent last (capped)
  nextId: 1,
  lang: 'en',        // 'en' | 'ar'
  theme: 'auto',     // 'auto' | 'light' | 'dark'
  onboarded: false,  // set once onboarding finishes or is skipped
  surface: 'mz',     // 'mz' | 'bank' - which app shell is on screen (alinma integration)

  // newer fields, all optional; old docs merge via {...EMPTY, ...raw}
  profile: {
    name: '', handle: '', avatar: { kind: 'initials' },
    accent: null,    // null = follow archetype tint, else a hex
    createdAt: null, // ISO day, set once on first run
    coaching: 'active', // 'active' | 'quiet'
    currency: 'SAR',
  },
  brief: null,       // { date, archetypeId, text, reason, actionKey, changeStamp, dismissed }
  seen: null,        // { cohort_percentiles, archetypeId, day }
  nudgeLog: [],      // ring buffer [{ day, surface, topic, archetypeId }] for the NudgeBus
  subs: [],          // subscriptions { id, name, amount, cycle, dueDay, state, source, icon, tracked }
  plans: [],         // user plans { id, name, target, date, icon, setAside }
  buffers: [],       // free-standing set-asides { id, label, weekly, forSpike, startedISO }
  monthNotes: {},    // { [monthKey]: string }
  incomeByMonth: {}, // { [monthKey]: number }
  recurring: null,   // memoized detection { series, scannedAt }
  insights: null,    // cached engine read { aid, list, quest, day }, see App.jsx
  spikeHidden: [],   // forecast names the user marked "not mine"

  // arena battles, see arena/engine.js. Combat state is ephemeral (lives in
  // the battle screen); only this meta persists.
  arena: {
    wins: 0,
    losses: 0,
    streak: 0,     // current win streak
    bestStreak: 0,
    history: [],   // last 10 results { opp, oppArch, won, rounds, dateISO }
    loadout: { effects: [], ability: null }, // chosen effects + affinity ability
    rankScore: 0,  // ladder standing (see arena/rank.js)
    friends: [],   // followed rivals' handles ['sara-4821', ...]
    friendCards: {}, // cache { [handle]: { name, archetype, level, rankScore, updatedAt } }
    introSeen: false, // the how-it-works sheet auto-opens until dismissed once
  },

  // game layer, see game.js
  game: {
    drops: 0,        // lifetime total; levels derive from it
    lastDaily: null, // ISO day of the last daily-open award
    quest: null,     // { key, aid, startedISO, done }
    questsDone: 0,
    lastQuestCollect: null, // ISO day of the last quest payout; reissues start after it
    badges: {},      // { [badgeId]: ISO day earned }
    flags: {},       // one-shot event flags (e.g. opened the map)
  },

};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const monthKey = (iso) => iso.slice(0, 7);

export const dayAfter = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const n = new Date(y, m - 1, d + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    // deep-merge profile/game/battle so new sub-fields land on older saved docs
    return {
      ...EMPTY,
      ...raw,
      profile: { ...EMPTY.profile, ...(raw.profile || {}) },
      game: { ...EMPTY.game, ...(raw.game || {}) },
      arena: {
        ...EMPTY.arena,
        ...(raw.arena || {}),
        loadout: { ...EMPTY.arena.loadout, ...(raw.arena?.loadout || {}) },
      },
    };
  } catch {
    return { ...EMPTY };
  }
}

// consecutive visit days ending today
export function streakOf(visits) {
  const seen = new Set(visits);
  let count = 0;
  const d = new Date();
  for (;;) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!seen.has(iso)) break;
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export function useAppState() {
  const [state, setState] = useState(load);
  const first = useRef(true);

  // Record today's visit once per session
  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    const today = todayISO();
    setState((s) => {
      let next = s;
      if (!s.visits.includes(today)) next = { ...next, visits: [...next.visits, today].slice(-90) };
      if (!next.profile.createdAt) next = { ...next, profile: { ...next.profile, createdAt: today } };
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage full or blocked
    }
  }, [state]);

  return [state, setState];
}

export const thisMonthTx = (tx) =>
  tx.filter((t) => monthKey(t.date) === monthKey(todayISO()));

// Demo-mode sample ledger: three months ending today, so history-hungry
// reads (signals, trends, recurring detection) have something to chew on.
// Amounts vary per month but stay inside the recurring detector's 15%
// band, and the current month stops at today - nothing is post-dated.
export function sampleMonth() {
  const base = new Date();
  const out = [];
  // one row per line: [desc, [amount m-2, m-1, m0], type, icon, day]
  // (0 in an amount slot skips that month)
  const SCRIPT = [
    ['Rent',             [1500, 1500, 1500], 'fixed',         'home',    1],
    ['Electricity bill', [148, 172, 155],    'fixed',         'home',    2],
    ['Groceries',        [215, 195, 205],    'fixed',         'cart',    3],
    ['Index fund',       [400, 400, 400],    'savings',       'trend',   3],
    ['Water bill',       [42, 45, 44],       'fixed',         'home',    4],
    ['Internet bill',    [249, 249, 249],    'fixed',         'home',    5],
    ['Mobile bill',      [89, 89, 89],       'fixed',         'home',    6],
    ['Coffee runs',      [45, 52, 38],       'discretionary', 'cup',     7],
    ['Dinner out',       [85, 120, 95],      'discretionary', 'moon',    8],
    ['Videogame',        [60, 0, 79],        'discretionary', 'gamepad', 9],
    ['Groceries',        [190, 210, 185],    'fixed',         'cart',    10],
    ['Late-night order', [30, 42, 35],       'discretionary', 'moon',    13],
    ['Doctor visit',     [220, 0, 0],        'spike',         'plus',    15],
    ['Car repair',       [0, 450, 0],        'spike',         'car',     15],
    ['Traffic violation', [0, 0, 180],       'spike',         'car',     12],
    ['Groceries',        [225, 205, 210],    'fixed',         'cart',    17],
    ['Emergency fund',   [250, 200, 300],    'savings',       'shield',  20],
    ['Coffee runs',      [40, 48, 44],       'discretionary', 'cup',     21],
    ['Groceries',        [200, 185, 220],    'fixed',         'cart',    24],
    ['Dinner out',       [0, 110, 90],       'discretionary', 'moon',    27],
  ];
  for (let m = 2; m >= 0; m--) {
    const anchor = new Date(base.getFullYear(), base.getMonth() - m, 1);
    const daysIn = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    // past months render in full; the current month stops at today
    const cap = m === 0 ? base.getDate() : daysIn;
    for (const [desc, amounts, type, icon, n] of SCRIPT) {
      const amount = amounts[2 - m];
      if (!amount || n > cap) continue;
      const d = Math.min(n, daysIn);
      out.push({
        desc, amount, type, icon,
        date: `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
  }
  return out.map((t) => ({ ...t, demo: true }));
}
