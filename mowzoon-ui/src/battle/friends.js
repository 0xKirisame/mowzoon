// Friends: add via a share URL or QR code (both encode the SAME link, so the
// logic is identical — a QR is just a render of the URL string). A friend is a
// followed registry code; one-way follow, no accept flow for the hackathon.

import { fetchCharacter } from '../api';

const shareBase = () =>
  (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');

// The string shown as a copyable link AND encoded into the QR.
export function shareLink(code) {
  return `${shareBase()}?add=${encodeURIComponent(code)}`;
}

// Read the add-friend code off a URL query string. Returns code | null.
export function parseAddParam(search) {
  try {
    return new URLSearchParams(search).get('add');
  } catch {
    return null;
  }
}

// Resolve a code to a card and store it. Ignores self and duplicates. Returns
// the fetched card, or null (unknown code / server offline).
export async function addFriend(app, setApp, code) {
  if (!code) return null;
  const b = app.battle || {};
  if (code === b.code) return null; // don't follow yourself
  if ((b.friends || []).includes(code)) return b.friendCards?.[code] ?? null; // already added

  const card = await fetchCharacter(code);
  if (!card) return null;

  const entry = {
    name: card.name,
    aid: card.aid ?? card.archetype,
    level: card.level,
    rankScore: card.rankScore ?? card.rank_score ?? 0,
    updatedAt: Date.now(),
  };
  setApp((s) => ({
    ...s,
    battle: {
      ...s.battle,
      friends: [...(s.battle.friends || []), code],
      friendCards: { ...(s.battle.friendCards || {}), [code]: entry },
    },
  }));
  return entry;
}

// Call once on app load: if the URL carries ?add=<code>, follow it, then strip
// the param so a refresh doesn't re-add.
export async function consumeAddParamFromUrl(app, setApp) {
  if (typeof window === 'undefined') return null;
  const code = parseAddParam(window.location.search);
  if (!code) return null;
  const res = await addFriend(app, setApp, code);
  const url = new URL(window.location.href);
  url.searchParams.delete('add');
  window.history.replaceState({}, '', url.toString());
  return res;
}

// Build the friends leaderboard rows from the local cache (plus me), sorted by
// rankScore desc. `me` = { code, name, aid, level, rankScore }.
export function friendsLeaderboard(app, me) {
  const b = app.battle || {};
  const rows = Object.entries(b.friendCards || {}).map(([code, c]) => ({ code, ...c }));
  if (me) rows.push({ ...me, isMe: true });
  rows.sort((a, z) => (z.rankScore ?? 0) - (a.rankScore ?? 0));
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}
