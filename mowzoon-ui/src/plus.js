// Mowzoon+ entitlements. One place decides what the free plan covers and
// what the subscription unlocks; every gate in the app asks here.

import { todayISO } from './store';

export const PLUS_PRICE = 19.99; // SAR / month
export const PLUS_SUB_ID = 'mz-plus'; // the subscription's row in app.subs

export const LIMITS = {
  arenaPlays: 3, // battles per day on the free plan
  aheadItems: 15, // plans + subscriptions + buffers, combined
};

export const isPlus = (app) => !!app.plus?.active;

// ---- Ahead: one combined cap across everything the tab tracks ----

export const aheadCount = (app) =>
  (app.plans || []).length +
  (app.subs || []).filter((s) => s.state !== 'cancelled').length +
  (app.buffers || []).length;

export const aheadFull = (app) => !isPlus(app) && aheadCount(app) >= LIMITS.aheadItems;

// ---- Arena: plays reset daily ----

export const arenaPlaysToday = (app) => {
  const p = app.arena?.plays;
  return p && p.day === todayISO() ? p.count : 0;
};

export const arenaPlaysLeft = (app) =>
  isPlus(app) ? Infinity : Math.max(0, LIMITS.arenaPlays - arenaPlaysToday(app));

// reducer-style: hand to setApp so StrictMode double-fires stay harmless
export const spendArenaPlay = (s) => {
  const today = todayISO();
  const p = s.arena.plays;
  const count = p && p.day === today ? p.count + 1 : 1;
  return { ...s, arena: { ...s.arena, plays: { day: today, count } } };
};

// ---- Quests: the free plan runs one, Plus runs all three ----

// The two companion quests per archetype. Picks avoid doubling up the
// primary's measure (2 and 3 both count savings, so they never pair).
export const EXTRA_QUESTS = { 0: [1, 2], 1: [0, 2], 2: [0, 1], 3: [0, 1] };

// ---- Subscribe / cancel: flip the flag and keep the ledger honest ----

// Subscribing also drops Mowzoon+ into the subscription tracker, so the
// app accounts for its own price like any other recurring charge.
export function subscribePlus(s) {
  const today = todayISO();
  const day = Number(today.split('-')[2]);
  const subs = (s.subs || []).filter((x) => x.id !== PLUS_SUB_ID);
  return {
    ...s,
    plus: { active: true, since: s.plus?.since || today, renewDay: day },
    subs: [
      { id: PLUS_SUB_ID, name: 'Mowzoon+', amount: PLUS_PRICE, cycle: 'monthly', dueDay: day, state: 'keep', source: 'plus', icon: 'spark', tracked: true },
      ...subs,
    ],
  };
}

export function cancelPlus(s) {
  return {
    ...s,
    plus: { ...s.plus, active: false },
    subs: (s.subs || []).filter((x) => x.id !== PLUS_SUB_ID),
  };
}
