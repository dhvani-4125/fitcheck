// Trip planner: day-by-day outfits for a destination, built to pack light (pieces get re-used),
// with destination style notes, a packing list and what's worth buying before you go.
import { generateOutfits } from './stylist.js';
import { suggestBuy, cityStyle, shopLinks } from './shopping.js';

export const ACTIVITIES = {
  Sightseeing: 'Travel', 'Museums & cafés': 'Brunch', Beach: 'Casual', Hiking: 'Road Trip', 'Dinner out': 'Date Night',
  'Night out': 'Going Out', 'Business meetings': 'Office', 'Wedding / function': 'Wedding', 'Travel day': 'Travel',
};

const iso = (d) => d.toISOString().slice(0, 10);
export function tripDates(startDate, nights) {
  const out = [];
  const n = Math.max(1, Math.min(14, Number(nights) || 1));
  for (let i = 0; i <= n; i++) { const d = new Date(`${startDate}T12:00:00`); d.setDate(d.getDate() + i); out.push(iso(d)); }
  return out;
}

/**
 * trip: { destination, startDate, nights, activities: { 'YYYY-MM-DD': activityName } }
 * weatherDays: [{ date, ... }]
 */
export function planTrip(items, trip, { weatherDays = [], prefs, history, audience, aesthetic, seed = 3 } = {}) {
  const city = cityStyle(trip.destination);
  const dates = tripDates(trip.startDate, trip.nights);
  const prefer = new Set();
  let lastMain = [];
  const days = dates.map((date, i) => {
    const activity = trip.activities?.[date] || (i === 0 || i === dates.length - 1 ? 'Travel day' : 'Sightseeing');
    const occasion = ACTIVITIES[activity] || 'Travel';
    const weather = weatherDays.find(w => w.date === date) || null;
    const ctx = { occasion, aesthetic: aesthetic || city?.aesthetic || null, weather, audience, prefs, history, count: 2, seed: seed + i * 31, prefer, exclude: lastMain, destination: trip.destination };
    let options = generateOutfits(items, ctx);
    if (!options.length) options = generateOutfits(items, { ...ctx, exclude: [] });
    const outfit = options[0] || null;
    if (outfit) {
      outfit.items.forEach(id => prefer.add(id));
      lastMain = outfit.items.filter(id => { const it = items.find(x => x.id === id); return it && ['top', 'dress'].includes(it.slot); });
    }
    return { date, activity, occasion, weather, outfit, alternates: options.slice(1) };
  });
  const packedIds = [...new Set(days.flatMap(d => d.outfit?.items || []))];
  const packing = packedIds.map(id => items.find(x => x.id === id)).filter(Boolean)
    .map(it => ({ item: it, days: days.filter(d => d.outfit?.items.includes(it.id)).length }))
    .sort((a, b) => a.item.group.localeCompare(b.item.group) || b.days - a.days);
  const buys = [];
  const seen = new Set();
  const coldest = [...weatherDays].sort((a, b) => a.feels - b.feels)[0];
  const wettest = [...weatherDays].sort((a, b) => (b.rainChance || 0) - (a.rainChance || 0))[0];
  const packedPieces = packing.map(p => p.item);
  for (const w of [coldest, wettest, null]) {
    const b = suggestBuy(packedPieces, { weather: w, audience, destination: trip.destination, aesthetic: ctxAesthetic(aesthetic, city) });
    if (b && !seen.has(b.query)) { seen.add(b.query); buys.push(b); }
  }
  for (const b of city?.buys || []) {
    if (buys.length >= 3) break;
    if (packedPieces.some(p => p.slot === b.slot)) continue;
    const query = `${audience === 'Men' ? 'men ' : audience === 'Women' ? 'women ' : ''}${b.text}`;
    if (!seen.has(query)) { seen.add(query); buys.push({ title: b.text.charAt(0).toUpperCase() + b.text.slice(1), query, why: `A ${city.name} essential for ${city.vibe}.`, links: shopLinks(query) }); }
  }
  return { destination: trip.destination, city, days, packing, buys: buys.slice(0, 3), weatherKind: weatherDays[0]?.typical ? 'typical' : 'forecast' };
}

const ctxAesthetic = (a, city) => a || city?.aesthetic || null;
