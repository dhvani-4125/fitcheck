import assert from 'node:assert/strict';
import { SEED_ITEMS } from './fixtures/seed.js';
import { enrichItem } from './attributes.js';
import { generateOutfits, parseRequest, matchesTheme } from './stylist.js';
import { makeEvent, planEvent, repeatsAcrossFunctions } from './events.js';
import { planTrip, tripDates } from './trips.js';
import { suggestBuy, shopLinks, cityStyle } from './shopping.js';
import { recommendFragrance } from './fragrance.js';
import { recommendHair } from './hair.js';

const ethnic = [
  { id: 'e1', name: 'Mustard yellow chikankari kurta set', audience: 'Women', color: 'Mustard' },
  { id: 'e2', name: 'Green georgette sharara set', audience: 'Women', color: 'Green' },
  { id: 'e3', name: 'Pink silk lehenga', audience: 'Women', color: 'Pink' },
  { id: 'e4', name: 'Ivory anarkali', audience: 'Women', color: 'Ivory' },
  { id: 'e5', name: 'Wine banarasi saree', audience: 'Women', color: 'Wine' },
  { id: 'e6', name: 'Gold jhumkas', audience: 'Women', color: 'Gold' },
  { id: 'e7', name: 'Gold embroidered juttis', audience: 'Women', color: 'Gold' },
  { id: 'e8', name: 'Kundan choker jewellery set', audience: 'Women', color: 'Gold' },
  { id: 'e9', name: 'Gold potli bag', audience: 'Women', color: 'Gold' },
];
const items = [...SEED_ITEMS, ...ethnic].map(enrichItem);
const byId = Object.fromEntries(items.map(i => [i.id, i]));
let passed = 0;
const check = (name, fn) => { fn(); passed++; };

check('Indian items are recognised', () => {
  assert.equal(byId.e1.slot, 'dress'); assert.equal(byId.e1.subcategory, 'Kurta set'); assert.ok(byId.e1.ethnic);
  assert.equal(byId.e3.subcategory, 'Lehenga'); assert.ok(byId.e3.formality >= 4.5);
  assert.equal(byId.e5.subcategory, 'Saree');
  assert.equal(byId.e6.slot, 'accessory'); assert.equal(byId.e6.subcategory, 'Jhumkas');
  assert.equal(byId.e7.slot, 'shoes'); assert.equal(byId.e9.slot, 'bag');
  assert.ok(!byId.i1.ethnic, 'western shirt is not ethnic');
  assert.ok(byId.e1.occasions.includes('Haldi'));
});

check('requests understand Indian occasions', () => {
  assert.equal(parseRequest('what should I wear to my cousin\'s haldi').occasion, 'Haldi');
  assert.equal(parseRequest('mehendi function tomorrow').occasion, 'Mehndi');
  assert.equal(parseRequest('outfit for a wedding').occasion, 'Wedding');
  assert.equal(parseRequest('diwali party at office').occasion, 'Festive');
});

check('haldi picks traditional wear in the yellow theme', () => {
  const [o] = generateOutfits(items, { occasion: 'Haldi', theme: ['Yellow', 'Mustard'], audience: 'Women', count: 1, seed: 4 });
  const main = o.items.map(id => byId[id]).find(p => p.slot === 'dress');
  assert.equal(main.id, 'e1');
  assert.ok(matchesTheme(main, ['Yellow']));
});

check('wedding planner: one look per function, no repeated outfits, guest etiquette', () => {
  const ev = makeEvent({ type: 'wedding', title: "Riya's wedding", startDate: '2026-12-10', role: 'Guest' });
  assert.equal(ev.functions.length, 5);
  assert.deepEqual(ev.functions.find(f => f.occasion === 'Wedding').avoid, ['Red', 'White']);
  const planned = planEvent(items, ev, { audience: 'Women', seed: 5 });
  assert.ok(planned.functions.every(f => f.plan?.outfit), 'every function gets a look');
  assert.deepEqual(repeatsAcrossFunctions(planned, items), [], 'no main piece repeats');
  const wedding = planned.functions.find(f => f.occasion === 'Wedding');
  const weddingMain = wedding.plan.outfit.items.map(id => byId[id]).filter(p => ['dress', 'top'].includes(p.slot));
  assert.ok(weddingMain.every(p => !['Red', 'White'].includes(p.colors[0].name)));
});

check('missing traditional wear produces a shopping suggestion with store links', () => {
  const western = SEED_ITEMS.map(enrichItem);
  const b = suggestBuy([western.find(i => i.id === 'i1'), western.find(i => i.id === 'i2')], { occasion: 'Wedding', audience: 'Women' });
  assert.match(b.query, /lehenga/);
  assert.equal(b.links.length, 4);
  assert.ok(b.links[0].url.startsWith('https://www.myntra.com/women-'));
  assert.ok(shopLinks('beige trench coat')[3].url.includes('amazon.in/s?k=beige%20trench%20coat'));
});

check('trip to Paris: daily looks, pieces re-used, packing list, Paris buys', () => {
  const western = SEED_ITEMS.map(enrichItem);
  const trip = { destination: 'Paris, France', startDate: '2026-12-01', nights: 4, activities: { '2026-12-03': 'Dinner out' } };
  const weatherDays = tripDates(trip.startDate, trip.nights).map(date => ({ date, feels: 6, rainChance: 60, humidity: 80, wind: 15 }));
  const plan = planTrip(western, trip, { weatherDays, audience: 'Women', seed: 2 });
  assert.equal(plan.days.length, 5);
  assert.ok(plan.days.every(d => d.outfit));
  assert.equal(plan.city.name, 'Paris');
  const totalSlots = plan.days.reduce((n, d) => n + d.outfit.items.length, 0);
  assert.ok(plan.packing.length < totalSlots, 'packing re-uses pieces across days');
  assert.ok(plan.days.filter(d => d.outfit.items.some(id => western.find(i => i.id === id).slot === 'outer')).length >= 3, 'cold days get a layer');
  assert.ok(plan.buys.length >= 1 && plan.buys[0].links.length === 4);
  assert.ok(cityStyle('a week in PARIS'));
});

check('attar and wedding hairstyles appear for Indian occasions only', () => {
  const f = recommendFragrance({ occasion: 'Wedding', weather: { feels: 22, humidity: 50, rainChance: 0, wind: 5 } });
  assert.ok(f.profiles.some(p => p.family.id === 'attar'));
  const pieces = [byId.e3, byId.e6];
  const hair = recommendHair({ pieces, occasion: 'Wedding', profile: { length: 'long', texture: 'straight' } });
  assert.ok(hair.some(h => h.style.id === 'gajra-bun'));
  const office = recommendHair({ pieces: [byId.i1, byId.i2], occasion: 'Office', profile: { length: 'long' } });
  assert.ok(!office.some(h => h.style.indian));
});

console.log(`PASS: ${passed} wedding, trip and shopping checks passed.`);
