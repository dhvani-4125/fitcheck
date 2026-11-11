// Wardrobe analytics, versatility, cost-per-wear and gap analysis.
import { colorRelation, parseColorText } from './colors.js';
import { GROUP_ORDER, enrichItem } from './attributes.js';

const compatible = (a, b) => Math.abs((a.formality ?? 3) - (b.formality ?? 3)) <= 1.25 && colorRelation(a.colors?.[0], b.colors?.[0]).score >= 0.6
  && !(a.aesthetics?.includes('Sporty') !== b.aesthetics?.includes('Sporty') && Math.abs((a.formality ?? 3) - (b.formality ?? 3)) > 0.5);

const PARTNERS = { top: ['bottom', 'shoes', 'outer'], bottom: ['top', 'shoes', 'outer'], dress: ['shoes', 'outer', 'bag'], outer: ['top', 'bottom', 'dress'], shoes: ['top', 'bottom', 'dress'], bag: ['dress', 'top', 'bottom'], accessory: ['top', 'dress'] };

export function versatility(item, items) {
  const partners = PARTNERS[item.slot] || [];
  return items.filter(o => o.id !== item.id && partners.includes(o.slot) && compatible(item, o)).length;
}

export function countOutfits(items) {
  const tops = items.filter(i => i.slot === 'top'), bottoms = items.filter(i => i.slot === 'bottom');
  const dresses = items.filter(i => i.slot === 'dress'), shoes = items.filter(i => i.slot === 'shoes');
  let n = 0;
  for (const t of tops) for (const b of bottoms) {
    if (!compatible(t, b)) continue;
    const s = shoes.filter(x => compatible(x, t) && compatible(x, b)).length;
    n += shoes.length ? s : 1;
  }
  for (const d of dresses) n += shoes.length ? shoes.filter(x => compatible(x, d)).length : 1;
  return n;
}

const ESSENTIALS = [
  { id: 'white-top', label: 'A plain white or ivory top', item: { name: 'White cotton shirt', color: 'White', formality: 3 }, has: i => i.slot === 'top' && ['White', 'Ivory', 'Cream'].includes(i.colors?.[0]?.name) },
  { id: 'black-top', label: 'A black fitted top', item: { name: 'Black fitted tee', color: 'Black', formality: 2.5, fit: 'Fitted' }, has: i => i.slot === 'top' && ['Black', 'Charcoal'].includes(i.colors?.[0]?.name) },
  { id: 'neutral-trousers', label: 'Neutral tailored trousers', item: { name: 'Beige tailored trousers', color: 'Beige', formality: 3.5 }, has: i => i.slot === 'bottom' && i.formality >= 3 && ['Black', 'Beige', 'Camel', 'Grey', 'Navy', 'Charcoal', 'Cream', 'Ivory', 'Tan', 'Khaki'].includes(i.colors?.[0]?.name) },
  { id: 'jeans', label: 'Well-fitting blue jeans', item: { name: 'Blue straight-leg jeans', color: 'Denim', formality: 2 }, has: i => i.slot === 'bottom' && /jean|denim/i.test(`${i.subcategory} ${i.name}`) },
  { id: 'white-sneakers', label: 'Clean white sneakers', item: { name: 'White leather sneakers', color: 'White', formality: 2.5 }, has: i => i.slot === 'shoes' && /sneaker/i.test(i.subcategory || i.name) && ['White', 'Ivory', 'Cream'].includes(i.colors?.[0]?.name) },
  { id: 'smart-shoes', label: 'Smart shoes (loafers or simple heels)', item: { name: 'Black leather loafers', color: 'Black', formality: 3.5 }, has: i => i.slot === 'shoes' && i.formality >= 3 },
  { id: 'rain-shoes', label: 'Shoes that can handle the rain', item: { name: 'Black leather ankle boots', color: 'Black', formality: 3 }, has: i => i.slot === 'shoes' && i.rainSafe },
  { id: 'blazer', label: 'A neutral blazer or structured jacket', item: { name: 'Navy blazer', color: 'Navy', formality: 3.5 }, has: i => i.slot === 'outer' && i.formality >= 3 },
  { id: 'warm-layer', label: 'A warm layer (knit or coat)', item: { name: 'Camel wool coat', color: 'Camel', formality: 3.5 }, has: i => (i.slot === 'outer' || i.slot === 'top') && i.warmth >= 3.5 },
  { id: 'neutral-bag', label: 'A neutral everyday bag', item: { name: 'Tan leather tote', color: 'Tan', formality: 3 }, has: i => i.slot === 'bag' && ['Black', 'Tan', 'Brown', 'Camel', 'Beige', 'Cream', 'Coffee'].includes(i.colors?.[0]?.name) },
  { id: 'dress', label: 'A versatile dress or one-piece', item: { name: 'Black midi slip dress', color: 'Black', formality: 3.5 }, has: i => i.slot === 'dress' },
];

export function gapAnalysis(items, audience = 'Everyone') {
  const pool = items.filter(i => audience === 'Everyone' || !i.audience || i.audience === 'Everyone' || i.audience === audience);
  const base = countOutfits(pool);
  return ESSENTIALS.filter(e => !pool.some(e.has)).map(e => {
    const virtual = enrichItem({ id: `gap-${e.id}`, ...e.item, colors: parseColorText(e.item.color) });
    const unlocked = countOutfits([...pool, virtual]) - base;
    return { id: e.id, label: e.label, example: e.item.name, unlocked: Math.max(0, unlocked), partners: versatility(virtual, pool) };
  }).sort((a, b) => b.unlocked - a.unlocked || b.partners - a.partners);
}

export function computeInsights(items, history = []) {
  const byGroup = Object.fromEntries(GROUP_ORDER.map(g => [g, 0]));
  items.forEach(i => { byGroup[i.group] = (byGroup[i.group] || 0) + 1; });
  const colours = {};
  items.forEach(i => { const c = i.colors?.[0]; if (c) { colours[c.name] ||= { name: c.name, hex: c.hex, count: 0 }; colours[c.name].count++; } });
  const wearCounts = {};
  history.filter(h => h.worn).forEach(h => (h.items || []).forEach(id => { wearCounts[id] = (wearCounts[id] || 0) + 1; }));
  const withWears = items.map(i => ({ ...i, totalWears: (i.wears || 0) }));
  const sortedWear = [...withWears].sort((a, b) => b.totalWears - a.totalWears);
  const vers = items.map(i => ({ item: i, partners: versatility(i, items) })).sort((a, b) => b.partners - a.partners);
  const priced = withWears.filter(i => i.price > 0).map(i => ({ item: i, price: i.price, wears: i.totalWears, cpw: i.totalWears ? i.price / i.totalWears : i.price })).sort((a, b) => b.cpw - a.cpw);
  const totalValue = priced.reduce((s, p) => s + p.price, 0);
  return {
    total: items.length,
    byGroup,
    colours: Object.values(colours).sort((a, b) => b.count - a.count),
    mostWorn: sortedWear.filter(i => i.totalWears > 0).slice(0, 5),
    leastWorn: [...withWears].sort((a, b) => a.totalWears - b.totalWears).slice(0, 5),
    versatile: vers.slice(0, 5),
    possibleOutfits: countOutfits(items),
    costPerWear: priced,
    totalValue,
    wornOutfits: history.filter(h => h.worn).length,
    wearCounts,
  };
}
