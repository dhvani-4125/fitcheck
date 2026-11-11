// "Complete the look": suggests ONE piece worth buying to finish an outfit, with search links
// to Indian stores. Links are plain store searches (no affiliate tracking yet).
import { OCCASION_BY_ID } from './attributes.js';
import { weatherProfile, matchesTheme } from './stylist.js';
import { colorFamily, isNeutral } from './colors.js';

export const STORES = [
  { id: 'myntra', name: 'Myntra', url: q => `https://www.myntra.com/${encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, '-'))}` },
  { id: 'ajio', name: 'AJIO', url: q => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}` },
  { id: 'nykaa', name: 'Nykaa Fashion', url: q => `https://www.nykaafashion.com/catalogsearch/result/?q=${encodeURIComponent(q)}` },
  { id: 'amazon', name: 'Amazon', url: q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
];

export function shopLinks(query) {
  return STORES.map(s => ({ store: s.name, url: s.url(query) }));
}

const who = (audience) => (audience === 'Men' ? 'men' : audience === 'Women' ? 'women' : '');
const q = (audience, text) => `${who(audience)} ${text}`.trim();

// Destination signature pieces for the trip planner (and "style it for Paris").
export const CITY_STYLE = {
  paris: { name: 'Paris', vibe: 'effortless chic', aesthetic: 'Chic', tips: ['Neutrals with one accent colour', 'Comfortable flats or sneakers for cobblestones', 'A trench or tailored jacket for evenings', 'Keep athleisure for the hotel'], buys: [{ slot: 'outer', text: 'beige trench coat' }, { slot: 'accessory', text: 'silk scarf' }, { slot: 'shoes', text: 'white leather sneakers' }] },
  london: { name: 'London', vibe: 'smart layers for changeable weather', aesthetic: 'Old Money', tips: ['Always carry a layer', 'Waterproof shoes', 'Dark denim with knitwear'], buys: [{ slot: 'outer', text: 'waterproof trench coat' }, { slot: 'shoes', text: 'chelsea boots' }] },
  milan: { name: 'Milan', vibe: 'polished and tailored', aesthetic: 'Chic', tips: ['Tailoring beats casualwear', 'Quality leather accessories'], buys: [{ slot: 'outer', text: 'tailored blazer' }, { slot: 'bag', text: 'structured leather bag' }] },
  rome: { name: 'Rome', vibe: 'romantic and relaxed', aesthetic: 'Feminine', tips: ['Cover shoulders for churches', 'Comfortable walking sandals'], buys: [{ slot: 'accessory', text: 'lightweight scarf' }, { slot: 'shoes', text: 'leather walking sandals' }] },
  dubai: { name: 'Dubai', vibe: 'polished resort wear, respectfully covered', aesthetic: 'Casual Luxe', tips: ['Breathable linen for daytime', 'Cover shoulders and knees in malls and souks', 'A light layer for icy air-conditioning'], buys: [{ slot: 'dress', text: 'linen co-ord set' }, { slot: 'accessory', text: 'wide brim sun hat' }] },
  singapore: { name: 'Singapore', vibe: 'humid-city easy', aesthetic: 'Minimalist', tips: ['Breathable fabrics only', 'Sandals or breathable sneakers'], buys: [{ slot: 'top', text: 'linen shirt' }, { slot: 'shoes', text: 'breathable sneakers' }] },
  bangkok: { name: 'Bangkok', vibe: 'hot, humid and temple-ready', aesthetic: 'Casual Luxe', tips: ['Cover shoulders and knees for temples', 'Light, quick-dry fabrics'], buys: [{ slot: 'bottom', text: 'linen wide leg pants' }] },
  bali: { name: 'Bali', vibe: 'boho beach', aesthetic: 'Feminine', tips: ['Flowy dresses', 'Sarong for temples', 'Flat sandals'], buys: [{ slot: 'dress', text: 'linen maxi dress' }, { slot: 'shoes', text: 'flat sandals' }] },
  goa: { name: 'Goa', vibe: 'beach and sundowners', aesthetic: 'Casual Luxe', tips: ['Linen and cotton', 'Sandals you can get wet', 'One dressy look for dinner'], buys: [{ slot: 'top', text: 'linen shirt' }, { slot: 'shoes', text: 'flat sandals' }] },
  manali: { name: 'Manali', vibe: 'cosy mountain layers', aesthetic: 'Casual Luxe', tips: ['Layer thermals under knits', 'Waterproof boots with grip'], buys: [{ slot: 'outer', text: 'puffer jacket' }, { slot: 'shoes', text: 'waterproof hiking boots' }] },
  jaipur: { name: 'Jaipur', vibe: 'colourful heritage', aesthetic: 'Ethnic', tips: ['Block-print kurtas photograph beautifully', 'Comfortable juttis for forts'], buys: [{ slot: 'dress', text: 'block print kurta set' }, { slot: 'shoes', text: 'juttis' }] },
  udaipur: { name: 'Udaipur', vibe: 'royal and romantic', aesthetic: 'Ethnic', tips: ['Flowy ethnic wear for palaces', 'A pashmina for evening breezes'], buys: [{ slot: 'dress', text: 'anarkali kurta set' }, { slot: 'accessory', text: 'pashmina stole' }] },
  tokyo: { name: 'Tokyo', vibe: 'clean, layered street style', aesthetic: 'Streetwear', tips: ['Slip-on shoes for temples and homes', 'Neat layers'], buys: [{ slot: 'outer', text: 'oversized blazer' }, { slot: 'shoes', text: 'slip on sneakers' }] },
  'new york': { name: 'New York', vibe: 'city cool', aesthetic: 'Streetwear', tips: ['Black is always right', 'You will walk a lot: comfortable boots'], buys: [{ slot: 'outer', text: 'leather jacket' }, { slot: 'shoes', text: 'ankle boots' }] },
  switzerland: { name: 'Switzerland', vibe: 'alpine warm', aesthetic: 'Old Money', tips: ['Wool and thermals', 'Snow-proof boots'], buys: [{ slot: 'outer', text: 'wool coat' }, { slot: 'shoes', text: 'snow boots' }] },
  maldives: { name: 'Maldives', vibe: 'island resort', aesthetic: 'Casual Luxe', tips: ['Swimwear plus cover-ups', 'One dressy resort look'], buys: [{ slot: 'dress', text: 'beach cover up kaftan' }] },
};

export function cityStyle(destination = '') {
  const d = String(destination).toLowerCase();
  const key = Object.keys(CITY_STYLE).find(k => d.includes(k));
  return key ? CITY_STYLE[key] : null;
}

function themePiece(audience, theme, occ) {
  const colour = (theme?.[0] || '').toLowerCase();
  if (audience === 'Men') return q(audience, `${colour} ${occ?.id === 'Wedding' || occ?.id === 'Reception' ? 'sherwani' : 'kurta set'}`);
  return q(audience, `${colour} ${occ?.id === 'Wedding' || occ?.id === 'Reception' ? 'lehenga' : occ?.id === 'Haldi' || occ?.id === 'Mehndi' ? 'sharara set' : 'anarkali kurta set'}`);
}

/**
 * Pick the single most useful purchase for this outfit, or null.
 * ctx: { occasion, theme, weather|wp, audience, destination, aesthetic }
 */
export function suggestBuy(pieces = [], ctx = {}) {
  const wp = ctx.wp !== undefined ? ctx.wp : weatherProfile(ctx.weather);
  const occ = ctx.occasion ? OCCASION_BY_ID[ctx.occasion] : null;
  const has = (slot) => pieces.some(p => p.slot === slot);
  const main = pieces.filter(p => ['dress', 'top', 'bottom', 'outer'].includes(p.slot));
  const out = (title, text, why) => ({ title, query: q(ctx.audience, text).trim(), why, links: shopLinks(q(ctx.audience, text)) });
  const city = cityStyle(ctx.destination);

  if (occ?.ethnic === true && !main.some(p => p.ethnic)) {
    const query = themePiece(ctx.audience, ctx.theme || occ.theme, occ);
    return { title: 'A traditional outfit for this', query, why: `Your wardrobe doesn't have an ethnic piece for the ${occ.label.toLowerCase()} yet.`, links: shopLinks(query) };
  }
  if (ctx.theme?.length && !main.some(p => matchesTheme(p, ctx.theme))) {
    const t = ctx.theme[0].toLowerCase();
    return ctx.audience === 'Men' ? out(`A ${t} kurta`, `${t} kurta`, `Fits the ${t} colour theme.`) : out(`A ${t} dupatta`, `${t} dupatta`, `The easiest way to bring in the ${t} theme with what you own.`);
  }
  if (occ?.ethnic && !pieces.some(p => p.slot === 'accessory' && p.ethnic)) {
    return ctx.audience === 'Men' ? out('Embroidered mojaris', 'embroidered mojari', 'Traditional footwear finishes an ethnic look.') : out('Statement jhumkas', 'statement jhumka earrings', 'Ethnic jewellery completes the look.');
  }
  if (city) {
    const buy = city.buys.find(b => !has(b.slot));
    if (buy) return out(cap(buy.text), buy.text, `A ${city.name} essential for ${city.vibe}.`);
  }
  if (wp?.needsLayer && !has('outer')) {
    const text = wp.band === 'cold' ? 'wool coat' : ctx.aesthetic === 'Streetwear' ? 'denim jacket' : 'camel trench coat';
    return out(cap(text), text, `It feels like ${Math.round(wp.feels)}°C, so a layer makes this wearable.`);
  }
  const shoes = pieces.find(p => p.slot === 'shoes');
  if (wp?.rainy && (!shoes || !shoes.rainSafe)) return out('Waterproof ankle boots', 'waterproof ankle boots', 'Rain is likely, and these keep the look intact.');
  if (!shoes) return out('Versatile white sneakers', 'white leather sneakers', 'Goes with almost everything you own.');
  if (!has('bag') && occ?.id !== 'Gym') {
    const text = (occ?.range?.[0] ?? 3) >= 3.5 ? 'mini clutch bag' : 'tan crossbody bag';
    return out(cap(text), text, 'A bag finishes the outfit.');
  }
  const accentCount = pieces.filter(p => p.colors?.[0] && !isNeutral(p.colors[0])).length;
  if (!accentCount) {
    const fam = { Chic: 'red', Feminine: 'pink', 'Old Money': 'navy', Streetwear: 'green' }[ctx.aesthetic] || 'rust';
    return out(`A ${fam} accent piece`, `${fam} silk scarf`, 'Your look is all neutrals, so one pop of colour lifts it.');
  }
  return null;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export { colorFamily };
