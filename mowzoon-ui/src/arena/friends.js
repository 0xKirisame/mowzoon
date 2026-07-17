// Friends: add via a share URL or QR code (both encode the SAME link, so the
// logic is identical - a QR is just a render of the URL string). A friend is a
// followed arena handle; one-way follow, no accept flow for the hackathon.

import { getArenaCharacter } from '../api';

const shareBase = () =>
  (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');

// The string shown as a copyable link AND encoded into the QR.
export function shareLink(handle) {
  return `${shareBase()}?add=${encodeURIComponent(handle)}`;
}

// Read the add-friend handle off a URL query string. Returns handle | null.
export function parseAddParam(search) {
  try {
    return new URLSearchParams(search).get('add');
  } catch {
    return null;
  }
}

// Resolve a handle to a character and store it. Ignores self and duplicates.
// Returns the cached card, or null (unknown handle / server offline).
export async function addFriend(app, setApp, handle) {
  if (!handle) return null;
  // the server stores handles lowercased; normalize here so hand-typed
  // ?add= links can't cache a card the roster refresh never matches
  handle = handle.toLowerCase();
  const a = app.arena || {};
  if (handle === app.profile?.handle) return null; // don't follow yourself
  if ((a.friends || []).includes(handle)) return a.friendCards?.[handle] ?? null; // already added

  const c = await getArenaCharacter(handle);
  if (!c) return null;

  const entry = {
    name: c.name || handle,
    archetype: c.archetype ?? 0,
    level: c.level ?? 1,
    rankScore: c.rankScore ?? 0,
    updatedAt: Date.now(),
  };
  setApp((s) => ({
    ...s,
    arena: {
      ...s.arena,
      friends: [...(s.arena.friends || []), handle],
      friendCards: { ...(s.arena.friendCards || {}), [handle]: entry },
    },
  }));
  return entry;
}

// Call once on app load: if the URL carries ?add=<handle>, follow it, then
// strip the param so a refresh doesn't re-add.
export async function consumeAddParamFromUrl(app, setApp) {
  if (typeof window === 'undefined') return null;
  const handle = parseAddParam(window.location.search);
  if (!handle) return null;
  const res = await addFriend(app, setApp, handle);
  const url = new URL(window.location.href);
  url.searchParams.delete('add');
  window.history.replaceState({}, '', url.toString());
  return res;
}

// Build the friends leaderboard rows from the local cache (plus me), sorted by
// rankScore desc. `me` = { handle, name, archetype, level, rankScore }.
export function friendsLeaderboard(app, me) {
  const a = app.arena || {};
  const rows = Object.entries(a.friendCards || {}).map(([handle, c]) => ({ handle, ...c }));
  if (me) rows.push({ ...me, isMe: true });
  rows.sort((x, z) => (z.rankScore ?? 0) - (x.rankScore ?? 0));
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}
