// Bank numbers derive from the same store the Mowzoon ledger reads, so the
// two apps can never disagree. The only invented figure is a stable
// carryover seeded from income (a demo stand-in for prior-month history).

import { monthKey, todayISO } from '../store';

// deterministic "balance brought forward" so the account doesn't start at 0
export const carryover = (income) => Math.round((income * 0.65) / 10) * 10;
export const savingsBase = (income) => Math.round((income * 1.4) / 10) * 10;

const mkNow = () => monthKey(todayISO());

export function monthSpend(app, mk = mkNow()) {
  let sum = 0;
  for (const t of app.tx) if (monthKey(t.date) === mk) sum += t.amount;
  return sum;
}

// current account: carryover + this month's salary - everything that left
// (savings transfers leave the current account too - they land in the pot)
export function currentBalance(app) {
  const mk = mkNow();
  const income = app.incomeByMonth?.[mk] ?? app.income;
  return carryover(income) + income - monthSpend(app, mk);
}

// savings pot: base + every savings transfer ever logged
export function savingsBalance(app) {
  let saved = 0;
  for (const t of app.tx) if (t.type === 'savings') saved += t.amount;
  return savingsBase(app.income) + saved;
}

// spend delta vs last month, for the insights card. Savings transfers are
// moves, not spend (Home excludes them too), so they don't count here.
// prev === 0 means there is no history to compare against.
export function insightDelta(app) {
  const mk = mkNow();
  const [y, m] = mk.split('-').map(Number);
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const spend = (key) => {
    let sum = 0;
    for (const t of app.tx) if (t.type !== 'savings' && monthKey(t.date) === key) sum += t.amount;
    return sum;
  };
  const cur = spend(mk);
  const prev = spend(prevKey);
  return { cur, prev, less: cur <= prev };
}

// newest-first ledger slice for the activity feed
export function recentActivity(app, n = 5) {
  return app.tx
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
    .slice(0, n);
}

// demo account identifiers (from the real app's masked screenshots)
export const ACCOUNT_NO = '68204714841000';
export const IBAN = 'SA3705000068204714841000';
export const fmtIban = (iban) => iban.replace(/(.{4})/g, '$1 ').trim();

// static demo FX (SAR is USD-pegged; others indicative)
export const FX = [
  { code: 'USD', rate: 3.75 },
  { code: 'EUR', rate: 4.09 },
  { code: 'GBP', rate: 4.72 },
  { code: 'AED', rate: 1.02 },
  { code: 'KWD', rate: 12.24 },
  { code: 'EGP', rate: 0.076 },
];
