// A CharacterCard is the small, serialisable identity used everywhere: the
// local player, default enemies, traded friends, and DB rows all share it.
//
//   { aid: 0..3, level: 1..5, name: string, accent: hex|null }
//
// Base stats are uniform across archetypes on purpose — differentiation comes
// from affinity (wheel) and abilities, which keeps matchups readable. Level is
// the scaling lever, and it also widens the wheel in wheel.js.

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

export function clampLevel(level) {
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(level || 1)));
}

// Derive the combat stat block from a card's archetype + level.
export function deriveStats(aid, level) {
  const lv = clampLevel(level);
  return {
    aid,
    level: lv,
    maxHP: 60 + 15 * (lv - 1), // L1 60 → L5 120
    power: 12 + 3 * (lv - 1),  // L1 12 → L5 24  (base hit damage)
  };
}

// Build a normalised card from loose input (profile, DB row, etc.).
export function makeCard({ aid, level, name = '', accent = null } = {}) {
  return { aid, level: clampLevel(level), name: (name || '').trim(), accent: accent || null };
}

// Compact, URL/QR-safe serialisation. Reused as both the offline share string
// and (field-for-field) the DB payload, so trade/ghost keep working with the
// server down. base64url avoids '+' '/' '=' that break in query strings.
export function encodeCard(card) {
  const json = JSON.stringify([card.aid, card.level, card.name, card.accent]);
  const b64 = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf-8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCard(str) {
  try {
    const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function'
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, 'base64').toString('utf-8');
    const [aid, level, name, accent] = JSON.parse(json);
    return makeCard({ aid, level, name, accent });
  } catch {
    return null;
  }
}
