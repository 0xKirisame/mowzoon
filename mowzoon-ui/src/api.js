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

// --- Battle: character registry + leaderboard (see mowzoon/characters.py) ----
// All resolve to null on failure so the caller can fall back to the offline
// share-string path (decodeCard) or simply hide the online feature.

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

// Publish (or update, by passing your existing code) my character card.
// card: { name, archetype, level, accent, rankScore, code? } → { code, ...card }
export function publishCharacter(card) {
  return post('/characters', card);
}

// Resolve a friend's card by code (challenge / add-friend). → card | null
export function fetchCharacter(code) {
  return get(`/characters/${encodeURIComponent(code)}`);
}

// Batch-resolve cards for the friends leaderboard. → [card] | null
export function getCharacters(codes) {
  return post('/characters/batch', { codes });
}

// Global leaderboard, top N by rank_score. → [{rank, code, name, aid, level, rankScore}] | null
export function getLeaderboard(top = 20) {
  return get(`/leaderboard?top=${top}`);
}
