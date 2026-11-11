// Indian wedding & festive planner: one look per function, no repeats across functions,
// colour themes, guest etiquette, weather per day, and a shopping suggestion where needed.
import { generateOutfits } from './stylist.js';
import { suggestBuy } from './shopping.js';
import { OCCASION_BY_ID } from './attributes.js';

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, n) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };

export const EVENT_TYPES = {
  wedding: { label: 'Indian wedding', functions: [
    { name: 'Haldi', occasion: 'Haldi', day: 0, theme: ['Yellow', 'Mustard'], outdoor: true },
    { name: 'Mehndi', occasion: 'Mehndi', day: 0, theme: ['Green', 'Pink'], outdoor: true },
    { name: 'Sangeet', occasion: 'Sangeet', day: 1, theme: [], outdoor: false },
    { name: 'Wedding', occasion: 'Wedding', day: 2, theme: [], outdoor: false },
    { name: 'Reception', occasion: 'Reception', day: 3, theme: [], outdoor: false },
  ] },
  diwali: { label: 'Diwali', functions: [
    { name: 'Dhanteras', occasion: 'Festive', day: 0, theme: ['Gold', 'Yellow'], outdoor: false },
    { name: 'Diwali puja', occasion: 'Festive', day: 2, theme: ['Red', 'Gold', 'Pink'], outdoor: false },
    { name: 'Diwali party', occasion: 'Sangeet', day: 2, theme: [], outdoor: false },
  ] },
  eid: { label: 'Eid', functions: [{ name: 'Eid prayers & lunch', occasion: 'Festive', day: 0, theme: ['White', 'Ivory', 'Green'], outdoor: false }, { name: 'Eid dinner', occasion: 'Festive', day: 0, theme: [], outdoor: false }] },
  navratri: { label: 'Navratri / Garba', functions: [
    { name: 'Garba night 1', occasion: 'Sangeet', day: 0, theme: ['Yellow'], outdoor: true },
    { name: 'Garba night 2', occasion: 'Sangeet', day: 1, theme: ['Green'], outdoor: true },
    { name: 'Garba night 3', occasion: 'Sangeet', day: 2, theme: ['Orange'], outdoor: true },
  ] },
  custom: { label: 'Custom event', functions: [{ name: 'Main event', occasion: 'Festive', day: 0, theme: [], outdoor: false }] },
};

export const ROLES = ['Guest', 'Family', 'Bride', 'Groom', 'Bridesmaid / groomsman'];

export function makeEvent({ type = 'wedding', title, city = '', startDate, role = 'Guest' }) {
  const t = EVENT_TYPES[type] || EVENT_TYPES.custom;
  const start = startDate || iso(new Date());
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type, title: title || t.label, city, role, startDate: start,
    functions: t.functions.map((f, i) => ({ id: `fn-${i}-${Math.random().toString(36).slice(2, 6)}`, name: f.name, occasion: f.occasion, date: addDays(start, f.day), theme: [...f.theme], outdoor: f.outdoor, avoid: guestAvoid(role, f.occasion), plan: null })),
    created: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

// Common etiquette: guests avoid the bride's red and all-white at the ceremony.
export function guestAvoid(role, occasion) {
  if (role !== 'Guest') return [];
  if (occasion === 'Wedding') return ['Red', 'White'];
  return [];
}

const MAIN = ['dress', 'top', 'bottom', 'outer'];

/**
 * Plan every function. weatherByDate: { 'YYYY-MM-DD': dayWeather }.
 * Returns the event with a fresh `plan` on each function (locked plans are kept).
 */
export function planEvent(items, event, { weatherByDate = {}, prefs, history, audience, seed = 1 } = {}) {
  const used = new Set();
  const fns = [...event.functions].sort((a, b) => a.date.localeCompare(b.date));
  for (const fn of fns) if (fn.plan?.locked) fn.plan.outfit.items.forEach(id => { const it = items.find(i => i.id === id); if (it && MAIN.includes(it.slot)) used.add(id); });
  const planned = fns.map((fn, i) => {
    if (fn.plan?.locked) return fn;
    const real = weatherByDate[fn.date] || null;
    const weather = real ? (fn.outdoor ? real : { ...real, feels: 24, wind: 0, humidity: 50 }) : null;
    const ctx = { occasion: fn.occasion, theme: fn.theme, avoidColours: fn.avoid, weather, audience, prefs, history, count: 3, seed: seed + i * 97, exclude: used };
    const options = generateOutfits(items, ctx);
    const chosen = options[0] || null;
    if (chosen) chosen.items.forEach(id => { const it = items.find(x => x.id === id); if (it && MAIN.includes(it.slot)) used.add(id); });
    const pieces = chosen ? chosen.items.map(id => items.find(x => x.id === id)).filter(Boolean) : [];
    const buy = suggestBuy(pieces, { occasion: fn.occasion, theme: fn.theme, weather, audience });
    const notes = [];
    if (fn.avoid?.length) notes.push(`As a guest, skip ${fn.avoid.join(' and ').toLowerCase()} at the ceremony. Those are traditionally for the bride.`);
    if (fn.outdoor && real?.rainChance >= 50) notes.push('Outdoor function and rain is likely. Pick shoes you can walk on wet grass in.');
    if (fn.outdoor && real?.feels >= 30) notes.push('It will be hot outdoors, so go for lighter fabrics like cotton, georgette or chiffon.');
    if (!chosen) notes.push('Not enough pieces in your wardrobe for this function yet.');
    return { ...fn, plan: chosen ? { outfit: chosen, alternates: options.slice(1), buy, notes, weather: real, locked: false } : { outfit: null, alternates: [], buy, notes, weather: real, locked: false } };
  });
  return { ...event, functions: event.functions.map(f => planned.find(p => p.id === f.id) || f), updatedAt: new Date().toISOString() };
}

export function repeatsAcrossFunctions(event, items) {
  const seen = new Map();
  const repeats = [];
  for (const fn of event.functions) {
    for (const id of fn.plan?.outfit?.items || []) {
      const it = items.find(x => x.id === id);
      if (!it || !MAIN.includes(it.slot)) continue;
      if (seen.has(id)) repeats.push({ item: it.name, functions: [seen.get(id), fn.name] });
      else seen.set(id, fn.name);
    }
  }
  return repeats;
}

export { OCCASION_BY_ID };
