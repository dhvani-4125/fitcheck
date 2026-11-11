import assert from 'node:assert/strict';
import { SEED_ITEMS } from './fixtures/seed.js';
import { enrichItem } from './attributes.js';
import { parseColorText, colorRelation, paletteScore } from './colors.js';
import { parseRequest, generateOutfits, swapPiece, restyle, recordFeedback, emptyPrefs, weatherProfile, randomOutfit, matchInspiration } from './stylist.js';
import { recommendFragrance } from './fragrance.js';
import { recommendHair } from './hair.js';
import { computeInsights, gapAnalysis } from './insights.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; };
const items = SEED_ITEMS.map(enrichItem);
const byId = Object.fromEntries(items.map(i => [i.id, i]));

check('slot inference on seed wardrobe', () => {
  assert.equal(byId.i1.slot, 'top');
  assert.equal(byId.i2.slot, 'bottom');
  assert.equal(byId.i9.slot, 'shoes');
  assert.equal(byId.i13.slot, 'outer');
  assert.equal(byId.ath2.slot, 'bottom');
  assert.equal(byId.glam1.slot, 'dress');
  assert.equal(byId.glam8.slot, 'bag');
  assert.equal(byId.event1.slot, 'dress');
  assert.equal(byId.event4.slot, 'outer');
  assert.ok(byId.glam4.formality >= 4, 'tuxedo shirt is formal');
  assert.equal(byId.ath1.formality, 1);
  assert.ok(byId.ath1.aesthetics.includes('Sporty'));
});

check('colour parsing and relations', () => {
  assert.deepEqual(parseColorText('Fossil beige').map(c => c.name), ['Beige']);
  assert.deepEqual(parseColorText('White / black').map(c => c.name), ['White', 'Black']);
  assert.equal(colorRelation({ name: 'Black', hex: '#1c1c1c' }, { name: 'White', hex: '#f5f5f2' }).type, 'neutral');
  assert.equal(colorRelation({ name: 'Blue', hex: '#3b6db3' }, { name: 'Orange', hex: '#e07b39' }).type, 'complementary');
  assert.ok(paletteScore([byId.i1, byId.i2, byId.i9]).score > 0.85);
});

check('natural-language request parsing', () => {
  const r = parseRequest('Suggest five outfits for an office meeting');
  assert.equal(r.occasion, 'Office'); assert.equal(r.count, 5);
  assert.equal(parseRequest("I'm going on a coffee date. What should I wear?").occasion, 'Date Night');
  assert.equal(parseRequest('Suggest something comfortable for college').occasion, 'College');
  assert.equal(parseRequest('Give me a chic outfit for a night out').aesthetic, 'Chic');
  assert.equal(parseRequest('Give me a chic outfit for a night out').occasion, 'Going Out');
  assert.equal(parseRequest('Recommend something casual for a road trip').occasion, 'Road Trip');
  assert.equal(parseRequest('3 looks for the gym, no pink').count, 3);
  assert.deepEqual(parseRequest('3 looks for the gym, no pink').avoidColours, ['pink']);
});

check('office generates five distinct, office-appropriate outfits from the wardrobe', () => {
  const outfits = generateOutfits(items, { occasion: 'Office', audience: 'Women', count: 5, seed: 3 });
  assert.equal(outfits.length, 5);
  const sigs = new Set(outfits.map(o => o.items.slice().sort().join('|')));
  assert.equal(sigs.size, 5);
  for (const o of outfits) {
    assert.ok(o.items.every(id => byId[id]), 'only wardrobe items');
    assert.ok(!o.items.some(id => byId[id].aesthetics.includes('Sporty') && byId[id].slot !== 'shoes'), 'no gym wear at the office');
    assert.ok(o.explanation.length >= 2);
    const slots = o.items.map(id => byId[id].slot);
    assert.ok(slots.includes('dress') || (slots.includes('top') && slots.includes('bottom')), 'complete outfit');
  }
});

check('gym picks sporty pieces only', () => {
  const outfits = generateOutfits(items, { occasion: 'Gym', audience: 'Women', count: 2, seed: 5 });
  assert.ok(outfits.length >= 1);
  for (const o of outfits) for (const id of o.items) if (['top', 'bottom'].includes(byId[id].slot)) assert.ok(byId[id].aesthetics.includes('Sporty'));
});

check('weather shifts layering without overriding occasion', () => {
  const cold = { feels: 3, rainChance: 80, humidity: 60, wind: 35 };
  const wp = weatherProfile(cold);
  assert.equal(wp.band, 'cold'); assert.ok(wp.rainy && wp.needsLayer);
  const outfits = generateOutfits(items, { occasion: 'Office', audience: 'Everyone', weather: cold, count: 5, seed: 11 });
  const layered = outfits.filter(o => o.items.some(id => byId[id].slot === 'outer')).length;
  assert.ok(layered >= 3, `expected layers in the cold, got ${layered}`);
  const hot = generateOutfits(items, { occasion: 'Office', audience: 'Everyone', weather: { feels: 34, rainChance: 0, humidity: 40, wind: 5 }, count: 5, seed: 11 });
  assert.ok(hot.filter(o => o.items.some(id => byId[id].slot === 'outer')).length < layered);
  assert.ok(outfits[0].explanation.some(l => /°C/.test(l)));
});

check('swap keeps other pieces and restyle changes formality', () => {
  const [o] = generateOutfits(items, { occasion: 'Office', audience: 'Women', count: 1, seed: 2 });
  const slot = o.items.map(id => byId[id].slot).find(s => s === 'shoes' || s === 'top');
  const swapped = swapPiece(o, slot, items, { occasion: 'Office', audience: 'Women' });
  const before = o.items.filter(id => byId[id].slot !== slot).sort();
  const after = swapped.items.filter(id => byId[id].slot !== slot).sort();
  assert.deepEqual(after, before);
  assert.notEqual(swapped.slots[slot], o.slots[slot]);
  const casual = restyle(o, items, { occasion: 'Office', audience: 'Women' }, 'casual');
  const avg = x => x.items.map(id => byId[id].formality).reduce((a, b) => a + b, 0) / x.items.length;
  assert.ok(casual.notice || avg(casual) <= avg(o));
});

check('feedback learning demotes disliked combinations', () => {
  const ctx = { occasion: 'Office', audience: 'Women', count: 5, seed: 9 };
  const first = generateOutfits(items, ctx)[0];
  let prefs = emptyPrefs();
  prefs = recordFeedback(prefs, first.items.map(id => byId[id]), -1);
  prefs = recordFeedback(prefs, first.items.map(id => byId[id]), -1);
  const again = generateOutfits(items, { ...ctx, prefs });
  assert.notDeepEqual(again[0].items.slice().sort(), first.items.slice().sort());
});

check('fragrance: owned bottles first, light for hot office, respects disliked notes', () => {
  const hotOffice = recommendFragrance({ occasion: 'Office', weather: { feels: 32, humidity: 50, rainChance: 0, wind: 5 } });
  assert.ok(['citrus', 'aquatic', 'green', 'musk'].includes(hotOffice.profiles[0].family.id), hotOffice.profiles[0].family.id);
  const date = recommendFragrance({ occasion: 'Date Night', weather: { feels: 8, humidity: 50, rainChance: 0, wind: 5 }, prefs: { dislikedNotes: ['vanilla'] } });
  assert.ok(!date.profiles.some(p => p.family.notes.includes('vanilla')));
  const owned = recommendFragrance({ occasion: 'Office', collection: [{ id: 'f1', name: 'My Citrus', family: 'citrus', notes: 'bergamot, neroli' }] });
  assert.equal(owned.owned[0].fragrance.name, 'My Citrus');
});

check('hair: respects length/texture and favours humidity-proof styles', () => {
  const pieces = [byId.glam1, byId.glam6];
  const recs = recommendHair({ pieces, occasion: 'Party', weather: { feels: 30, humidity: 85, rainChance: 10, wind: 5 }, profile: { length: 'long', texture: 'wavy' } });
  assert.ok(recs.length === 3);
  assert.ok(recs[0].style.humidity >= 0.8, recs[0].style.name);
  const short = recommendHair({ pieces, occasion: 'Party', profile: { length: 'short', texture: 'straight' } });
  assert.ok(short.every(r => r.style.lengths.includes('short')));
});

check('surprise, inspiration matching, insights and gaps', () => {
  assert.ok(randomOutfit(items, { audience: 'Women', seed: 4 }));
  const det = [{ key: 'a', slot: 'dress', colors: [{ name: 'Wine', hex: '#6e2236' }], pattern: 'Solid' }];
  const m = matchInspiration(det, items, { audience: 'Women' });
  assert.ok(m.matches.length === 1 && byId[m.matches[0].item].colors[0].name === 'Wine');
  assert.ok(m.outfits.every(o => o.items.includes(m.matches[0].item)));
  const ins = computeInsights(items, []);
  assert.equal(ins.total, items.length);
  assert.ok(ins.possibleOutfits > 0);
  const gaps = gapAnalysis(items.filter(i => i.slot !== 'shoes'));
  assert.ok(gaps.some(g => g.id === 'white-sneakers'));
});

console.log(`PASS: ${passed} stylist engine checks passed.`);

{
  const mixed = generateOutfits(items, { occasion: 'Office', audience: 'Everyone', count: 5, seed: 21 });
  assert.equal(mixed.length, 5);
  for (const o of mixed) {
    const lanes = new Set(o.items.map(id => byId[id].audience).filter(a => a !== 'Everyone'));
    assert.ok(lanes.size <= 1, `mixed audiences in ${o.items.join(',')}`);
  }
  console.log('PASS: outfits never mix women\'s and men\'s pieces.');
}
