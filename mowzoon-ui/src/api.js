// Client for the model API (api.py). Every call resolves to null on
// failure so callers fall back to the on-device heuristics in scoring.js.

const BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

async function get(path, timeout = 3500) {
  try {
    const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// { id, name, description, probs[4], percentiles{efficiency,resilience,eq}, population }
export async function classify(metrics) {
  try {
    const res = await fetch(`${BASE}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// { points: [{e,r,q,a}], cohorts: {id: {count, efficiency, resilience, eq}}, total }
let populationCache = null;
export async function getPopulation() {
  if (populationCache) return populationCache;
  const data = await get('/population', 6000);
  if (data) populationCache = data;
  return data;
}

// { cohorts: {id: {count, essential, lifestyle, savings}}, total }
// Typical income allocation per archetype over the real Berka accounts.
// null on failure (server offline), the breakdown just hides the
// cohort comparison, same as every other model claim in the app.
let cohortCache = null;
export async function getCategoryCohort() {
  if (cohortCache) return cohortCache;
  const data = await get('/category-cohort', 6000);
  if (data) cohortCache = data;
  return data;
}

// { nudge, spikes: [{name, days}] }
export function getInsights(archetypeId, metrics) {
  const qs = new URLSearchParams({
    archetype: archetypeId,
    efficiency: metrics.efficiency,
    resilience: metrics.resilience,
    eq: metrics.eq,
  });
  return get(`/insights?${qs}`);
}

// --- Arena (arena.py). Same contract: null on failure, the Arena falls
// back to the local training-bot roster and keeps results on-device.

async function post(path, body, timeout = 3500) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// upsert your character snapshot; returns the stored character
export function registerArenaCharacter(character) {
  return post('/arena/register', character);
}

// { characters: [{handle, name, archetype, metrics, level, loadout, wins, losses, bot}] }
export function getArenaRoster(exclude) {
  const qs = new URLSearchParams({ exclude: exclude || '' });
  return get(`/arena/roster?${qs}`, 6000);
}

export function getArenaCharacter(handle) {
  return get(`/arena/character/${encodeURIComponent(handle)}`);
}

// { ok, id }
export function postArenaBattle(result) {
  return post('/arena/battle', result);
}

// { battles: [{id, challenger, defender, winner, rounds, unseen, createdAt}] }
export function getArenaInbox(handle, markSeen = false) {
  return get(`/arena/inbox/${encodeURIComponent(handle)}${markSeen ? '?markSeen=1' : ''}`);
}
