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
  spikeHidden: [],   // forecast names the user marked "not mine"

  // game layer, see game.js
  game: {
    drops: 0,        // lifetime total; levels derive from it
    lastDaily: null, // ISO day of the last daily-open award
    quest: null,     // { key, aid, startedISO, done }
    questsDone: 0,
    badges: {},      // { [badgeId]: ISO day earned }
    flags: {},       // one-shot event flags (e.g. opened the map)
  },
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const monthKey = (iso) => iso.slice(0, 7);

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    // deep-merge profile/game so new sub-fields land on older saved docs
    return {
      ...EMPTY,
      ...raw,
      profile: { ...EMPTY.profile, ...(raw.profile || {}) },
      game: { ...EMPTY.game, ...(raw.game || {}) },
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

// demo-mode sample month; days are relative to today so it always reads current
export function sampleMonth() {
  const base = new Date();
  const day = (n) => {
    const d = new Date(base.getFullYear(), base.getMonth(), Math.max(1, Math.min(base.getDate(), n)));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return [
    { desc: 'Rent',             amount: 1500, type: 'fixed',         icon: 'home',    date: day(1) },
    { desc: 'Utilities',        amount: 140,  type: 'fixed',         icon: 'home',    date: day(2) },
    { desc: 'Groceries',        amount: 220,  type: 'fixed',         icon: 'cart',    date: day(3) },
    { desc: 'Index fund',       amount: 400,  type: 'savings',       icon: 'trend',   date: day(3) },
    { desc: 'Dinner out',       amount: 85,   type: 'discretionary', icon: 'moon',    date: day(6) },
    { desc: 'Videogame',        amount: 60,   type: 'discretionary', icon: 'gamepad', date: day(8) },
    { desc: 'Groceries',        amount: 190,  type: 'fixed',         icon: 'cart',    date: day(11) },
    { desc: 'Late-night order', amount: 30,   type: 'discretionary', icon: 'moon',    date: day(13) },
    { desc: 'Car repair',       amount: 450,  type: 'spike',         icon: 'car',     date: day(15) },
    { desc: 'Coffee runs',      amount: 45,   type: 'discretionary', icon: 'cup',     date: day(18) },
    { desc: 'Emergency fund',   amount: 250,  type: 'savings',       icon: 'shield',  date: day(20) },
    { desc: 'Groceries',        amount: 205,  type: 'fixed',         icon: 'cart',    date: day(24) },
  ].map((t) => ({ ...t, demo: true }));
}
