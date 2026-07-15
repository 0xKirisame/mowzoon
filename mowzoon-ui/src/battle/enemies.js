// Default single-player opponents. A themed name per archetype; the level is
// scaled to the player so single-player stays matched (and it's practice only —
// single-player never touches Rank Score, see rank.js).

import { makeCard, clampLevel } from './character';

// name + archetype id; level is filled in by pickEnemy relative to the player.
export const ENEMY_ROSTER = [
  { name: 'Sable the Splurger', aid: 0, accent: '#ff375f' },
  { name: 'Wary Wren', aid: 1, accent: '#5e5ce6' },
  { name: 'Moonshot Musa', aid: 2, accent: '#e8890b' },
  { name: 'Old Guard Gamal', aid: 3, accent: '#0fa38f' },
];

// Deterministic small PRNG so a given seed reproduces the same opponent.
function pick(arr, seed) {
  const i = Math.abs(Math.floor(seed)) % arr.length;
  return arr[i];
}

// Choose an opponent card near the player's level. seed (optional) makes it
// reproducible; otherwise it's random. Enemy level jitters ±1 around the player.
export function pickEnemy(playerLevel = 1, seed = Math.floor(Math.random() * 1e9)) {
  const base = pick(ENEMY_ROSTER, seed);
  const jitter = (Math.abs(Math.floor(seed / 7)) % 3) - 1; // -1, 0, +1
  return makeCard({ ...base, level: clampLevel(playerLevel + jitter) });
}
