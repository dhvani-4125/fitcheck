// Merges the wardrobe document on this device with the one in the cloud.
// Rules: deletions win (tombstones), otherwise the most recently updated version of each
// item/look wins, history is unioned, and a registered profile beats an unregistered one.

const ts = (x) => Date.parse(x?.updatedAt || x?.created || x?.uploaded || 0) || 0;

function mergeById(a = [], b = [], deleted) {
  const out = new Map();
  for (const x of [...a, ...b]) {
    if (!x?.id || deleted.has(x.id)) continue;
    const prev = out.get(x.id);
    if (!prev) { out.set(x.id, x); continue; }
    const [winner, loser] = ts(x) > ts(prev) ? [x, prev] : [prev, x];
    // keep the uploaded-photo path from the other copy, unless the winner cleared it (photo replaced → re-upload)
    out.set(x.id, winner.cloudPath === undefined && loser.cloudPath ? { ...winner, cloudPath: loser.cloudPath } : winner);
  }
  return [...out.values()];
}

export function emptyDoc() {
  return { version: 1, items: [], looks: [], plans: {}, prefs: null, history: [], profile: null, deleted: { items: [], looks: [] }, updatedAt: null };
}

export function mergeWardrobe(local, remote) {
  if (!remote || typeof remote !== 'object' || !remote.version) return { ...emptyDoc(), ...local };
  const l = { ...emptyDoc(), ...local };
  const r = { ...emptyDoc(), ...remote };
  const localNewer = ts(l) >= ts(r);
  const newer = localNewer ? l : r, older = localNewer ? r : l;
  const delItems = new Set([...(l.deleted?.items || []), ...(r.deleted?.items || [])]);
  const delLooks = new Set([...(l.deleted?.looks || []), ...(r.deleted?.looks || [])]);
  const items = mergeById(l.items, r.items, delItems);
  const itemIds = new Set(items.map(i => i.id));
  const looks = mergeById(l.looks, r.looks, delLooks)
    .map(x => ({ ...x, items: (x.items || []).filter(id => typeof id === 'object' || itemIds.has(id)) }))
    .filter(x => x.items.length);
  const lookIds = new Set(looks.map(x => x.id));
  const plans = Object.fromEntries(Object.entries({ ...(older.plans || {}), ...(newer.plans || {}) }).filter(([, id]) => lookIds.has(id)));
  const history = [...new Map([...(r.history || []), ...(l.history || [])].filter(h => h?.id).map(h => [h.id, h])).values()]
    .sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0)).slice(0, 200);
  let profile = newer.profile || older.profile;
  if (l.profile?.registeredAt && !r.profile?.registeredAt) profile = l.profile;
  else if (r.profile?.registeredAt && !l.profile?.registeredAt) profile = r.profile;
  if (profile) {
    const frags = mergeById(l.profile?.fragrances, r.profile?.fragrances, new Set());
    profile = { ...profile, fragrances: frags };
  }
  return {
    version: 1,
    items, looks, plans, history, profile,
    prefs: newer.prefs || older.prefs,
    // wedding/festive events and trips: the most recently edited device's list wins (keeps deletions)
    events: Array.isArray(newer.events) && (newer.events.length || !older.events?.length) ? newer.events : (older.events || []),
    trips: Array.isArray(newer.trips) && (newer.trips.length || !older.trips?.length) ? newer.trips : (older.trips || []),
    deleted: { items: [...delItems].slice(-500), looks: [...delLooks].slice(-500) },
    updatedAt: new Date(Math.max(ts(l), ts(r), 0) || Date.now()).toISOString(),
  };
}
