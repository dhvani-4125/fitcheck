import assert from 'node:assert/strict';
import { mergeWardrobe } from './mergeWardrobe.js';

const t = (min) => new Date(Date.UTC(2026, 10, 11, 10, min)).toISOString();
const local = {
  version: 1, updatedAt: t(30),
  items: [
    { id: 'a', name: 'Shirt (edited on phone)', updatedAt: t(20) },
    { id: 'b', name: 'Jeans', updatedAt: t(5) },
    { id: 'phone-only', name: 'New jacket', updatedAt: t(25), image: 'idb:phone-only' },
  ],
  looks: [{ id: 'L1', items: ['a', 'b'], updatedAt: t(10) }],
  plans: { Monday: 'L1' },
  history: [{ id: 'h1', date: t(1), items: ['a'] }],
  profile: { gender: 'Woman', registeredAt: t(0), fragrances: [{ id: 'f1', name: 'Citrus' }] },
  prefs: { colours: { Black: 2 } },
  deleted: { items: [], looks: [] },
};
const remote = {
  version: 1, updatedAt: t(15),
  items: [
    { id: 'a', name: 'Shirt (old)', updatedAt: t(2), cloudPath: 'u/a.jpg' },
    { id: 'b', name: 'Jeans', updatedAt: t(5) },
    { id: 'laptop-only', name: 'Loafers', updatedAt: t(12) },
    { id: 'gone', name: 'Deleted on phone', updatedAt: t(1) },
  ],
  looks: [{ id: 'L2', items: ['laptop-only', 'gone'], updatedAt: t(12) }],
  plans: { Tuesday: 'L2' },
  history: [{ id: 'h2', date: t(14), items: ['b'] }],
  profile: { gender: 'Woman', registeredAt: t(0), fragrances: [{ id: 'f2', name: 'Amber' }] },
  prefs: { colours: { Red: 1 } },
  deleted: { items: [], looks: [] },
};
local.deleted.items.push('gone');

const m = mergeWardrobe(local, remote);
assert.deepEqual(m.items.map(i => i.id).sort(), ['a', 'b', 'laptop-only', 'phone-only']);
assert.equal(m.items.find(i => i.id === 'a').name, 'Shirt (edited on phone)', 'newer edit wins');
assert.equal(m.items.find(i => i.id === 'a').cloudPath, 'u/a.jpg', 'uploaded photo path is kept');
assert.deepEqual(m.looks.find(l => l.id === 'L2').items, ['laptop-only'], 'deleted item removed from looks');
assert.deepEqual(m.plans, { Monday: 'L1', Tuesday: 'L2' });
assert.deepEqual(m.history.map(h => h.id), ['h2', 'h1']);
assert.deepEqual(m.profile.fragrances.map(f => f.id).sort(), ['f1', 'f2']);
assert.deepEqual(m.prefs, local.prefs, 'newer document prefs win');
assert.ok(m.deleted.items.includes('gone'));

// a fresh device with nothing local takes the cloud copy, including the registered profile
const fresh = mergeWardrobe({ version: 1, items: [], looks: [], plans: {}, history: [], profile: { registeredAt: null }, updatedAt: t(59) }, remote);
assert.equal(fresh.items.length, 4);
assert.equal(fresh.profile.gender, 'Woman');

// first sign-in with an empty cloud keeps local data
const first = mergeWardrobe(local, null);
assert.equal(first.items.length, 3);

console.log('PASS: wardrobe sync merge checks passed.');
