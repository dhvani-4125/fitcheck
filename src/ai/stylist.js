// The FitCheck stylist: understands a request, retrieves pieces from the user's own wardrobe,
// and assembles coordinated outfits using colour, style, silhouette, pattern, weather and
// learned-preference scoring. Pure JS so it is unit-testable in Node.
import { paletteScore, colorFamily, isNeutral, hexForName } from './colors.js';
import { OCCASION_BY_ID, STYLIST_OCCASIONS, AESTHETICS, SLOT_LABELS } from './attributes.js';

export const MOODS = ['Confident', 'Relaxed', 'Playful', 'Romantic', 'Low-key', 'Bold'];
export { STYLIST_OCCASIONS, AESTHETICS };

// ---------------------------------------------------------------- request understanding
const OCCASION_WORDS = [
  ['Haldi', /\b(haldi|pithi)\b/],
  ['Mehndi', /\b(mehndi|mehendi|henna)\b/],
  ['Sangeet', /\b(sangeet|garba|dandiya|cocktail night)\b/],
  ['Reception', /\b(reception)\b/],
  ['Wedding', /\b(wedding|shaadi|pheras|nikah|baraat)\b/],
  ['Festive', /\b(festive|diwali|eid|puja|pooja|navratri|holi|rakhi|raksha bandhan|karva chauth|onam|pongal|lohri|durga)\b/],
  ['Office', /\b(office|work|meeting|interview|boardroom|presentation|corporate|client|professional|business)\b/],
  ['Date Night', /\b(date|dinner date|anniversary|romantic)\b/],
  ['Party', /\b(party|birthday|club|clubbing|cocktail|celebration)\b/],
  ['Going Out', /\b(night out|going out|drinks|bar|concert|gig|chic outfit for a night)\b/],
  ['Brunch', /\b(brunch|lunch|cafe|café|coffee)\b/],
  ['Road Trip', /\b(road ?trip|ride|bike|drive|driving)\b/],
  ['Travel', /\b(travel|flight|airport|trip|vacation|holiday|sightseeing)\b/],
  ['Formal', /\b(formal|gala|black tie|ceremony|graduation)\b/],
  ['Gym', /\b(gym|workout|run|running|yoga|pilates|training|sport|hike|hiking)\b/],
  ['College', /\b(college|class|campus|school|university|lecture|everyday)\b/],
  ['Casual', /\b(casual|weekend|relaxed|errands|chill|lounge|home|comfortable|comfy)\b/],
];
const AESTHETIC_WORDS = [
  ['Old Money', /\bold money|quiet luxury|preppy|classic\b/],
  ['Streetwear', /\bstreet ?wear|street|urban|sneakerhead\b/],
  ['Minimalist', /\bminimal(ist)?|clean|simple|understated\b/],
  ['Chic', /\bchic|sleek|polished|elegant|sophisticated\b/],
  ['Feminine', /\bfeminine|girly|soft|pretty|romantic\b/],
  ['Casual Luxe', /\bcasual luxe|elevated casual|luxe|cosy|cozy\b/],
  ['Sporty', /\bsporty|athleisure|active\b/],
  ['Ethnic', /\bethnic|traditional|desi|indian wear|indo-?western\b/],
];
const MOOD_WORDS = [
  ['Confident', /\bconfident|powerful|boss|strong\b/], ['Relaxed', /\brelaxed|easy|comfortable|comfy|chill\b/],
  ['Playful', /\bplayful|fun|quirky\b/], ['Romantic', /\bromantic|dreamy\b/], ['Low-key', /\blow-?key|subtle|quiet|tired\b/],
  ['Bold', /\bbold|statement|stand out|loud|colou?rful\b/],
];
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

export function parseRequest(text = '') {
  const t = ` ${String(text).toLowerCase()} `;
  const pick = (rules) => (rules.find(([, re]) => re.test(t)) || [null])[0];
  let count = 5;
  const num = t.match(/\b(\d{1,2})\s+(outfits?|looks?|options?|ideas?)/) || t.match(/\b(one|two|three|four|five|six|seven|eight)\s+(outfits?|looks?|options?|ideas?)/);
  if (num) count = Math.max(1, Math.min(8, Number(num[1]) || NUMBER_WORDS[num[1]] || 5));
  const colourWords = ['black', 'white', 'navy', 'beige', 'red', 'pink', 'blue', 'green', 'brown', 'grey', 'cream', 'wine', 'sage', 'olive', 'camel', 'yellow', 'gold', 'orange', 'purple', 'lilac', 'teal', 'mustard', 'ivory', 'silver'];
  const avoid = colourWords.filter(c => new RegExp(`\\b(no|not|avoid|without)\\s+(\\w+\\s+)?${c}\\b`).test(t));
  const want = colourWords.filter(c => new RegExp(`\\b${c}\\b`).test(t) && !avoid.includes(c));
  return {
    occasion: pick(OCCASION_WORDS),
    aesthetic: pick(AESTHETIC_WORDS),
    mood: pick(MOOD_WORDS),
    count,
    comfortable: /\b(comfortable|comfy|easy|relaxed|cosy|cozy)\b/.test(t),
    formalShift: /\b(dressy|dressed up|smart|sharp)\b/.test(t) ? 0.5 : /\b(dressed down|laid-?back|lazy)\b/.test(t) ? -0.5 : 0,
    wantColours: want,
    avoidColours: avoid,
  };
}

// ---------------------------------------------------------------- weather → styling profile
export function weatherProfile(w) {
  if (!w || typeof w.feels !== 'number') return null;
  const t = w.feels;
  const band = t >= 29 ? 'hot' : t >= 23 ? 'warm' : t >= 16 ? 'mild' : t >= 9 ? 'cool' : 'cold';
  const target = { hot: [0, 1.6], warm: [1, 2.4], mild: [1.8, 3], cool: [2.6, 3.8], cold: [3.4, 5] }[band];
  return {
    band,
    target,
    rainy: (w.rainChance ?? 0) >= 50,
    humid: (w.humidity ?? 0) >= 70 && t >= 22,
    windy: (w.wind ?? 0) >= 28,
    needsLayer: band === 'cool' || band === 'cold' || ((w.wind ?? 0) >= 28 && t < 22),
    feels: t,
  };
}

// ---------------------------------------------------------------- per-item suitability
function occasionFit(item, occ, shift = 0) {
  if (!occ) return 0.75;
  if (occ.id === 'Gym') {
    if (['top', 'bottom', 'outer'].includes(item.slot)) return item.aesthetics?.includes('Sporty') ? 1 : 0;
    if (item.slot === 'shoes') return /sneaker|trainer|running/i.test(`${item.subcategory} ${item.name}`) ? 1 : 0.05;
    if (item.slot === 'dress') return 0;
    return 0.4;
  }
  const base = rangeFit(item, occ, shift);
  if (!occ.ethnic) return base;
  // Indian occasions: traditional pieces lead; western pieces only as a fallback (or indo-western where allowed)
  if (item.aesthetics?.includes('Sporty')) return 0;
  if (['top', 'bottom', 'dress', 'outer'].includes(item.slot)) return item.ethnic ? Math.max(base, 0.6) : base * (occ.ethnic === true ? 0.2 : 0.7);
  if (item.ethnic) return Math.min(1, Math.max(base, 0.7) + 0.15);
  return base * 0.85;
}

function rangeFit(item, occ, shift) {
  const [lo, hi] = [occ.range[0] + shift, occ.range[1] + shift];
  const f = item.formality ?? 3;
  if (item.slot === 'accessory' || item.slot === 'bag') return f >= lo - 1.5 && f <= hi + 1 ? 0.9 : 0.4;
  if (f >= lo && f <= hi) return 1;
  const gap = f < lo ? lo - f : f - hi;
  if (item.aesthetics?.includes('Sporty') && occ.id !== 'Casual' && occ.id !== 'Road Trip' && occ.id !== 'Travel') return 0;
  return gap <= 0.5 ? 0.6 : gap <= 1 ? 0.3 : 0;
}

// Does the item's colour belong to a theme like ['Yellow', 'Mustard'] (haldi) or ['Green'] (mehndi)?
export function matchesTheme(item, theme = []) {
  if (!theme?.length) return false;
  const fams = new Set(theme.map(n => colorFamily({ name: n, hex: hexForName(n) || '#888888' })));
  return (item.colors || []).some(c => theme.includes(c.name) || (!isNeutral(c) && fams.has(colorFamily(c))));
}

function weatherFit(item, wp) {
  if (!wp) return { score: 0.75, note: null };
  let s = 0.8;
  if (item.slot === 'outer') {
    if (wp.needsLayer) s = 1;
    else if (wp.band === 'hot') s = 0.2;
    else if (wp.band === 'warm') s = 0.45;
  }
  if (['top', 'bottom', 'dress'].includes(item.slot)) {
    const w = item.warmth ?? 2;
    if (wp.band === 'hot' || wp.band === 'warm') s = w <= 2 ? 1 : w <= 3 ? 0.55 : 0.2;
    if (wp.band === 'cold' || wp.band === 'cool') s = w >= 3 ? 1 : w >= 2 ? 0.7 : 0.35;
    if ((wp.humid || wp.band === 'hot') && item.breathable) s = Math.min(1, s + 0.15);
  }
  if (item.slot === 'shoes' && wp.rainy) s = item.rainSafe ? 1 : 0.35;
  if (item.slot === 'shoes' && wp.band === 'cold' && /sandal/i.test(item.subcategory)) s = 0.15;
  if (wp.rainy && !item.rainSafe && ['dress', 'bottom'].includes(item.slot)) s -= 0.15;
  if (wp.windy && item.slot === 'dress' && /skirt|maxi|slip/i.test(item.name)) s -= 0.1;
  return { score: Math.max(0, Math.min(1, s)) };
}

function personalFit(item, prefs) {
  if (!prefs) return 0.5;
  let s = 0.5;
  s += Math.min(0.3, (prefs.likedItems?.[item.id] || 0) * 0.08);
  s -= Math.min(0.45, (prefs.dislikedItems?.[item.id] || 0) * 0.15);
  const c = item.colors?.[0]?.name;
  if (c && prefs.colours?.[c]) s += Math.max(-0.2, Math.min(0.2, prefs.colours[c] * 0.04));
  for (const a of item.aesthetics || []) if (prefs.aesthetics?.[a]) s += Math.max(-0.1, Math.min(0.1, prefs.aesthetics[a] * 0.02));
  if (item.fit && prefs.fits?.[item.fit]) s += Math.max(-0.1, Math.min(0.1, prefs.fits[item.fit] * 0.03));
  return Math.max(0, Math.min(1, s));
}

function itemScore(item, ctx) {
  const occ = ctx.occasion ? OCCASION_BY_ID[ctx.occasion] : null;
  const o = occasionFit(item, occ, ctx.formalShift || 0);
  const w = weatherFit(item, ctx.wp).score;
  const a = ctx.aesthetic ? (item.aesthetics?.includes(ctx.aesthetic) ? 1 : 0.45) : 0.75;
  const p = personalFit(item, ctx.prefs);
  let colour = 0.7;
  const name = item.colors?.[0]?.name?.toLowerCase();
  const main = ['top', 'bottom', 'dress', 'outer'].includes(item.slot);
  const avoid = (ctx.avoidColours || []).map(x => x.toLowerCase());
  if (avoid.length && main && item.colors?.some(c => avoid.includes(c.name.toLowerCase()))) colour = 0;
  else if (ctx.theme?.length && main) colour = matchesTheme(item, ctx.theme) ? 1 : 0.35;
  else if (ctx.wantColours?.length && name && ctx.wantColours.includes(name)) colour = 1;
  const cw = ctx.theme?.length || avoid.length ? 0.2 : 0.08;
  const prefer = ctx.prefer?.has?.(item.id) ? 0.1 : 0;
  return { total: o * 0.36 + w * 0.18 + a * (0.26 - cw) + p * 0.12 + colour * cw + prefer, occasion: o, weather: w };
}

// ---------------------------------------------------------------- outfit scoring
function silhouetteScore(pieces) {
  const core = pieces.filter(p => ['top', 'bottom', 'outer'].includes(p.slot));
  const fits = core.map(p => p.fit || 'Regular');
  const over = fits.filter(f => f === 'Oversized').length, fitted = fits.filter(f => f === 'Fitted').length;
  if (core.length < 2) return { score: 0.8, note: null };
  if (over >= 2 && !fitted) return { score: 0.4, note: 'two relaxed shapes — consider tucking the top' };
  if (over >= 1 && fitted >= 1) return { score: 1, note: 'relaxed and fitted shapes balance the proportions' };
  if (fitted >= 2) return { score: 0.8, note: 'a streamlined, close-fitting line' };
  return { score: 0.75, note: null };
}

function patternScore(pieces) {
  const loud = pieces.filter(p => p.pattern && !['Solid', 'Textured'].includes(p.pattern));
  if (!loud.length) return { score: 0.85, note: null };
  if (loud.length === 1) return { score: 1, note: `the ${loud[0].pattern.toLowerCase()} piece is the single focal point` };
  if (loud.length === 2 && loud[0].pattern !== loud[1].pattern) return { score: 0.45, note: 'pattern mixing — keep the rest quiet' };
  return { score: 0.25, note: null };
}

function styleScore(pieces, ctx) {
  const tally = {};
  pieces.forEach(p => (p.aesthetics || []).forEach(a => { tally[a] = (tally[a] || 0) + 1; }));
  const [top, n] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0] || ['Minimalist', 0];
  const leading = ctx.aesthetic && tally[ctx.aesthetic] ? ctx.aesthetic : top;
  const share = (tally[leading] || n) / pieces.length;
  const fs = pieces.filter(p => !['accessory', 'bag'].includes(p.slot)).map(p => p.formality ?? 3);
  const spread = fs.length ? Math.max(...fs) - Math.min(...fs) : 0;
  let s = 0.45 + share * 0.55 - Math.max(0, spread - 1.5) * 0.25;
  if (ctx.aesthetic && !tally[ctx.aesthetic]) s -= 0.15;
  const sporty = pieces.filter(p => p.aesthetics?.includes('Sporty')).length;
  if (sporty && sporty < pieces.filter(p => ['top', 'bottom'].includes(p.slot)).length && ctx.occasion !== 'Casual') s -= 0.2;
  return { score: Math.max(0, Math.min(1, s)), leading, spread };
}

function outfitWeather(pieces, wp) {
  if (!wp) return { score: 0.75, notes: [] };
  const notes = [];
  const clothing = pieces.filter(p => ['top', 'bottom', 'dress', 'outer'].includes(p.slot));
  const warmth = clothing.reduce((s, p) => s + (p.warmth ?? 2), 0) / Math.max(1, clothing.length) + (pieces.some(p => p.slot === 'outer') ? 0.6 : 0);
  let s = warmth >= wp.target[0] && warmth <= wp.target[1] + 0.6 ? 1 : Math.max(0.2, 1 - Math.min(Math.abs(warmth - wp.target[0]), Math.abs(warmth - wp.target[1])) * 0.35);
  const hasLayer = pieces.some(p => p.slot === 'outer');
  if (wp.needsLayer && !hasLayer) s -= 0.3;
  if (wp.band === 'hot' && hasLayer) s -= 0.25;
  const shoes = pieces.find(p => p.slot === 'shoes');
  if (wp.rainy && shoes && !shoes.rainSafe) s -= 0.2;
  const feels = `feels like ${Math.round(wp.feels)}°C`;
  if (wp.band === 'hot' || wp.band === 'warm') notes.push(`It ${feels}, so the pieces stay light${pieces.some(p => p.breathable) ? ' with breathable fabrics' : ''}${hasLayer ? '' : ' and there is no extra layer'}.`);
  else if (wp.needsLayer) notes.push(hasLayer ? `It ${feels}${wp.windy ? ' and windy' : ''}, so there is a layer on top.` : `It ${feels}; add a coat on the way out.`);
  else notes.push(`It ${feels}, comfortable for this weight of clothing.`);
  if (wp.rainy) notes.push(shoes?.rainSafe ? `Rain is likely, so the ${shoes.subcategory?.toLowerCase() || 'shoes'} were picked because they cope with wet streets.` : 'Rain is likely: carry an umbrella and skip delicate fabrics.');
  if (wp.humid) notes.push('It is humid, so the fabrics are lighter.');
  return { score: Math.max(0, Math.min(1, s)), notes };
}

const signatureOf = (ids) => [...ids].sort().join('|');

export function scoreOutfit(pieces, ctx) {
  const palette = paletteScore(pieces);
  const style = styleScore(pieces, ctx);
  const sil = silhouetteScore(pieces);
  const pat = patternScore(pieces);
  const weather = outfitWeather(pieces, ctx.wp);
  const items = pieces.map(p => itemScore(p, ctx));
  const occasion = items.reduce((s, x) => s + x.occasion, 0) / Math.max(1, items.length);
  let personal = pieces.reduce((s, p) => s + personalFit(p, ctx.prefs), 0) / Math.max(1, pieces.length);
  const pairs = ctx.prefs?.dislikedPairs || {};
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    if (pairs[signatureOf([pieces[i].id, pieces[j].id])]) personal -= 0.15 * pairs[signatureOf([pieces[i].id, pieces[j].id])];
  }
  personal = Math.max(0, Math.min(1, personal));
  let moodAdj = 0;
  const accents = pieces.filter(p => p.colors?.[0] && !isNeutral(p.colors[0])).length;
  if (ctx.mood === 'Bold' || ctx.mood === 'Playful') moodAdj = accents ? 0.04 : -0.04;
  if (ctx.mood === 'Low-key' || ctx.mood === 'Relaxed') moodAdj = accents > 1 ? -0.04 : 0.03;
  if (ctx.mood === 'Romantic') moodAdj = pieces.some(p => p.aesthetics?.includes('Feminine')) ? 0.04 : 0;
  if (ctx.comfortable) moodAdj += pieces.some(p => p.fit === 'Fitted' && ['bottom', 'dress'].includes(p.slot)) ? -0.04 : 0.03;
  const sig = signatureOf(pieces.map(p => p.id));
  const recent = (ctx.history || []).slice(0, 20).filter(h => signatureOf(h.items || []) === sig).length;
  const freshness = recent ? -0.12 * recent : 0;
  // colour theme (haldi yellow, mehndi green...) and colours to avoid (e.g. red as a wedding guest)
  const mainPieces = pieces.filter(p => ['dress', 'top', 'bottom', 'outer'].includes(p.slot));
  let themeAdj = 0;
  if (ctx.theme?.length) themeAdj += mainPieces.some(p => matchesTheme(p, ctx.theme)) ? 0.12 : -0.06;
  const avoid = (ctx.avoidColours || []).map(c => c.toLowerCase());
  if (avoid.length && mainPieces.some(p => avoid.includes(p.colors?.[0]?.name?.toLowerCase()))) themeAdj -= 0.25;
  // Indian occasions: juttis, potlis and jewellery finish the look; casual totes and trainers don't
  const occInfo = ctx.occasion ? OCCASION_BY_ID[ctx.occasion] : null;
  if (occInfo?.ethnic) {
    for (const p of pieces.filter(x => ['shoes', 'bag', 'accessory'].includes(x.slot))) {
      if (p.ethnic) themeAdj += 0.05;
      else if ((p.formality ?? 3) < occInfo.range[0] - 0.5) themeAdj -= 0.06;
    }
    if (mainPieces.some(p => p.ethnic) && !pieces.some(p => p.slot === 'accessory')) themeAdj -= 0.03;
  } else if (ctx.aesthetic !== 'Ethnic') {
    // western occasion: traditional juttis/jhumkas with a western outfit are a deliberate fusion, not the default
    const westernMain = mainPieces.length && mainPieces.every(p => !p.ethnic);
    if (westernMain) themeAdj -= 0.06 * pieces.filter(p => p.ethnic && ['shoes', 'bag', 'accessory'].includes(p.slot)).length;
  }
  const total = occasion * 0.25 + palette.score * 0.2 + style.score * 0.15 + sil.score * 0.07 + pat.score * 0.07 + weather.score * 0.14 + personal * 0.12 + moodAdj + freshness + themeAdj;
  return { total, palette, style, silhouette: sil, pattern: pat, weather, occasion, personal, freshness, recent };
}

function explain(pieces, s, ctx) {
  const occ = ctx.occasion ? OCCASION_BY_ID[ctx.occasion] : null;
  const lines = [];
  const names = s.palette.names.slice(0, 3).map(n => n.toLowerCase());
  const cap = (t) => t[0].toUpperCase() + t.slice(1);
  lines.push(names.length > 1
    ? `${cap(names.slice(0, -1).join(', '))} and ${names.at(-1)} make ${s.palette.story}.`
    : `Head-to-toe ${names[0] || 'neutrals'} makes ${s.palette.story}.`);
  const anchor = pieces.find(p => p.slot === 'dress')
    || [...pieces].filter(p => ['top', 'bottom', 'outer'].includes(p.slot)).sort((a, b) => (b.formality ?? 3) - (a.formality ?? 3))[0] || pieces[0];
  if (occ) {
    const formal = pieces.filter(p => !['bag', 'accessory'].includes(p.slot)).map(p => p.formality ?? 3);
    const avg = formal.reduce((a, b) => a + b, 0) / Math.max(1, formal.length);
    const tone = avg >= 4.2 ? 'dressed-up' : avg >= 3.2 ? 'polished' : avg >= 2.2 ? 'smart-casual' : 'relaxed';
    lines.push(`The ${anchor.name.replace(/^the\s+/i, '')} sets a ${tone} tone, which suits ${occ.label.toLowerCase()}.`);
  }
  if (occ?.ethnic) {
    const trad = pieces.filter(p => p.ethnic && ['dress', 'top', 'bottom', 'outer'].includes(p.slot));
    lines.push(trad.length ? `Traditional wear, just right for the ${occ.label.toLowerCase()}.` : `No traditional piece fits yet, so this is the closest western option. See "Complete the look" for an ethnic piece to add.`);
    const jewels = pieces.filter(p => p.slot === 'accessory' && p.ethnic);
    if (jewels.length) lines.push(`${jewels[0].name} adds the festive finish.`);
  }
  if (ctx.theme?.length) {
    const hit = pieces.some(p => ['dress', 'top', 'bottom', 'outer'].includes(p.slot) && matchesTheme(p, ctx.theme));
    lines.push(hit ? `Matches the ${ctx.theme.slice(0, 2).join(' / ').toLowerCase()} colour theme.` : `Nothing in your wardrobe matches the ${ctx.theme[0].toLowerCase()} theme. Add a dupatta or accessory in that colour.`);
  }
  const extras = [s.silhouette.note, s.pattern.note].filter(Boolean);
  if (extras.length) lines.push(extras.map((e, i) => (i ? e : e[0].toUpperCase() + e.slice(1))).join('; ') + '.');
  if (ctx.aesthetic) lines.push(s.style.leading === ctx.aesthetic ? `Reads clearly as ${ctx.aesthetic.toLowerCase()}.` : `A ${s.style.leading.toLowerCase()} take on ${ctx.aesthetic.toLowerCase()} using what you own.`);
  lines.push(...s.weather.notes);
  if (s.recent) lines.push('You have worn this exact combination recently.');
  return lines;
}

// ---------------------------------------------------------------- generation
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function weightedPick(list, rand) {
  const total = list.reduce((s, x) => s + x.w, 0);
  let r = rand() * total;
  for (const x of list) { r -= x.w; if (r <= 0) return x.item; }
  return list[list.length - 1]?.item;
}

function audienceOk(item, audience) {
  return !audience || audience === 'Everyone' || !item.audience || item.audience === 'Everyone' || item.audience === audience;
}

export function buildContext(input = {}) {
  return { ...input, wp: input.wp !== undefined ? input.wp : weatherProfile(input.weather) };
}

function candidatesBySlot(items, ctx) {
  const by = {};
  const exclude = ctx.exclude instanceof Set ? ctx.exclude : new Set(ctx.exclude || []);
  for (const item of items) {
    if (!audienceOk(item, ctx.audience)) continue;
    if (exclude.has(item.id)) continue;
    const sc = itemScore(item, ctx);
    (by[item.slot] ||= []).push({ item, w: Math.max(0.001, sc.total ** 3), sc });
  }
  for (const slot of Object.keys(by)) {
    by[slot].sort((a, b) => b.w - a.w);
    const strong = by[slot].filter(c => c.sc.occasion >= 0.5);
    by[slot] = (strong.length ? strong : by[slot]).slice(0, 18);
  }
  return by;
}

function finish(pieces, ctx, extra = {}) {
  const s = scoreOutfit(pieces, ctx);
  const slots = {};
  pieces.forEach(p => { slots[p.slot] = p.id; });
  return {
    id: `fit-${signatureOf(pieces.map(p => p.id)).replace(/[^a-z0-9|]/gi, '').slice(0, 40)}-${Math.round(s.total * 1000)}`,
    items: pieces.map(p => p.id),
    slots,
    score: Math.round(s.total * 100),
    breakdown: {
      occasion: Math.round(s.occasion * 100), colour: Math.round(s.palette.score * 100), style: Math.round(s.style.score * 100),
      silhouette: Math.round(s.silhouette.score * 100), pattern: Math.round(s.pattern.score * 100), weather: Math.round(s.weather.score * 100), personal: Math.round(s.personal * 100),
    },
    harmony: s.palette.type,
    aesthetic: s.style.leading,
    explanation: explain(pieces, s, ctx),
    ...extra,
  };
}

const SLOT_ORDER = ['outer', 'top', 'dress', 'bottom', 'shoes', 'bag', 'accessory'];
export const orderPieces = (pieces) => [...pieces].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

/**
 * Generate `count` distinct outfits from the wardrobe.
 * ctx: { occasion, aesthetic, mood, weather|wp, audience, prefs, history, count, seed, fixed: {slot: id}, formalShift, wantColours, avoidColours, comfortable }
 */
export function generateOutfits(allItems, input = {}) {
  // With "all pieces" selected, never mix women's and men's items in one outfit:
  // style each wardrobe lane separately and interleave the best results.
  if (!input.audience || input.audience === 'Everyone') {
    const lanes = ['Women', 'Men'].filter(a => allItems.some(i => i.audience === a));
    if (lanes.length > 1) {
      const count = input.count || 5;
      const fixedIds = Object.values(input.fixed || {});
      const fixedLane = allItems.find(i => fixedIds.includes(i.id) && lanes.includes(i.audience))?.audience;
      const runs = (fixedLane ? [fixedLane] : lanes).map(a => generateOutfits(allItems, { ...input, audience: a, count }));
      const merged = [];
      for (let i = 0; merged.length < count && i < count; i++) {
        runs.map(r => r[i]).filter(Boolean).sort((a, b) => b.score - a.score).forEach(o => { if (merged.length < count) merged.push(o); });
      }
      return merged;
    }
  }
  const ctx = buildContext(input);
  const count = ctx.count || 5;
  const rand = rng(ctx.seed ?? 7);
  const byId = new Map(allItems.map(i => [i.id, i]));
  const fixed = Object.entries(ctx.fixed || {}).map(([, id]) => byId.get(id)).filter(Boolean);
  const fixedSlots = new Set(fixed.map(p => p.slot));
  const cands = candidatesBySlot(allItems, ctx);
  const has = (slot) => fixedSlots.has(slot) || (cands[slot] || []).length > 0;
  const canSeparates = has('top') && has('bottom');
  const canDress = has('dress');
  if (!canSeparates && !canDress) return [];
  const seen = new Map();
  const occ = ctx.occasion;
  const tries = Math.min(900, 120 + allItems.length * 12);
  for (let i = 0; i < tries; i++) {
    const useDress = fixedSlots.has('dress') || (!fixedSlots.has('top') && !fixedSlots.has('bottom') && canDress && (!canSeparates || rand() < (OCCASION_BY_ID[occ]?.ethnic ? 0.8 : occ === 'Formal' || occ === 'Party' || occ === 'Date Night' ? 0.5 : 0.28)));
    const plan = useDress ? ['dress'] : ['top', 'bottom'];
    if (has('shoes')) plan.push('shoes');
    const layerP = ctx.wp?.needsLayer ? 0.92 : ctx.wp?.band === 'hot' ? 0.05 : occ === 'Office' ? 0.55 : 0.35;
    if (has('outer') && (fixedSlots.has('outer') || rand() < layerP)) plan.push('outer');
    if (has('bag') && occ !== 'Gym' && (fixedSlots.has('bag') || rand() < 0.75)) plan.push('bag');
    if (has('accessory') && (fixedSlots.has('accessory') || rand() < (OCCASION_BY_ID[occ]?.ethnic ? 0.9 : 0.5))) plan.push('accessory');
    const pieces = plan.map(slot => fixed.find(f => f.slot === slot) || weightedPick(cands[slot] || [], rand)).filter(Boolean);
    if (pieces.length < 2) continue;
    const sig = signatureOf(pieces.map(p => p.id));
    if (!seen.has(sig)) seen.set(sig, { pieces, s: scoreOutfit(pieces, ctx).total });
  }
  const ranked = [...seen.values()].sort((a, b) => b.s - a.s);
  const chosen = [];
  for (const maxOverlap of [0.34, 0.5, 0.67, 0.8, 1.01]) {
    for (const r of ranked) {
      if (chosen.length >= count) break;
      if (chosen.includes(r)) continue;
      const ids = new Set(r.pieces.map(p => p.id));
      const ok = chosen.every(c => {
        const shared = c.pieces.filter(p => ids.has(p.id) && !fixed.includes(p)).length;
        const union = new Set([...c.pieces.map(p => p.id), ...ids]).size - fixed.length;
        return union <= 0 || shared / union < maxOverlap;
      });
      if (ok) chosen.push(r);
    }
    if (chosen.length >= count) break;
  }
  return chosen.map(c => finish(orderPieces(c.pieces), ctx));
}

export function randomOutfit(items, input = {}) {
  const seed = input.seed ?? Math.floor(Math.random() * 1e9);
  const pool = generateOutfits(items, { ...input, occasion: input.occasion || null, aesthetic: null, count: 6, seed });
  if (!pool.length) return null;
  const pick = pool[Math.floor(rng(seed + 1)() * pool.length)];
  return { ...pick, surprise: true };
}

/** Replace one slot, keeping every other piece. mode: 'next' | 'formal' | 'casual' | 'colour' */
export function swapPiece(outfit, slot, allItems, input = {}, mode = 'next') {
  const ctx = buildContext(input);
  const byId = new Map(allItems.map(i => [i.id, i]));
  const pieces = outfit.items.map(id => byId.get(id)).filter(Boolean);
  const current = pieces.find(p => p.slot === slot);
  const rest = pieces.filter(p => p !== current);
  const tried = new Set([...(outfit.tried?.[slot] || []), current?.id].filter(Boolean));
  // keep swaps in the same wardrobe lane as the rest of the outfit
  const lane = (!ctx.audience || ctx.audience === 'Everyone') ? rest.find(p => p.audience === 'Women' || p.audience === 'Men')?.audience : ctx.audience;
  let pool = allItems.filter(i => i.slot === slot && !tried.has(i.id) && audienceOk(i, lane));
  if (!pool.length) pool = allItems.filter(i => i.slot === slot && i.id !== current?.id && audienceOk(i, lane));
  if (!pool.length) return { ...outfit, notice: `No other ${SLOT_LABELS[slot]?.toLowerCase() || slot} in your wardrobe yet.` };
  if (mode === 'formal' && current) pool = pool.filter(i => (i.formality ?? 3) > (current.formality ?? 3)).concat([]);
  if (mode === 'casual' && current) pool = pool.filter(i => (i.formality ?? 3) < (current.formality ?? 3));
  if (mode === 'colour' && current) pool = pool.filter(i => colorFamily(i.colors?.[0]) !== colorFamily(current.colors?.[0]) || i.colors?.[0]?.name !== current.colors?.[0]?.name);
  if (!pool.length) return { ...outfit, notice: `Nothing ${mode === 'formal' ? 'dressier' : mode === 'casual' ? 'more casual' : 'different'} in that category.` };
  const best = pool.map(i => ({ i, s: scoreOutfit([...rest, i], ctx).total })).sort((a, b) => b.s - a.s)[0].i;
  const next = finish(orderPieces([...rest, best]), ctx, {
    tried: { ...(outfit.tried || {}), [slot]: [...tried, best.id] },
    fragrance: undefined, hair: undefined,
  });
  return { ...next, saved: false };
}

/** Make the whole outfit more formal / casual / change colours by swapping the most out-of-line piece. */
export function restyle(outfit, allItems, input = {}, direction = 'formal') {
  const ctx = buildContext({ ...input, formalShift: (input.formalShift || 0) + (direction === 'formal' ? 1 : direction === 'casual' ? -1 : 0) });
  const byId = new Map(allItems.map(i => [i.id, i]));
  const pieces = outfit.items.map(id => byId.get(id)).filter(Boolean);
  if (direction === 'colour') {
    const accent = pieces.find(p => p.colors?.[0] && !isNeutral(p.colors[0]) && p.slot !== 'shoes') || pieces.find(p => p.slot === 'top') || pieces[0];
    return swapPiece(outfit, accent.slot, allItems, ctx, 'colour');
  }
  const wearable = pieces.filter(p => !['accessory'].includes(p.slot));
  const target = direction === 'formal' ? (a, b) => (a.formality ?? 3) - (b.formality ?? 3) : (a, b) => (b.formality ?? 3) - (a.formality ?? 3);
  for (const p of [...wearable].sort(target)) {
    const res = swapPiece(outfit, p.slot, allItems, ctx, direction);
    if (!res.notice) return res;
  }
  return { ...outfit, notice: `Your wardrobe has no ${direction === 'formal' ? 'dressier' : 'more casual'} swaps for this look.` };
}

// ---------------------------------------------------------------- inspiration matching
export function matchInspiration(detections, allItems, input = {}) {
  const fixed = {};
  const used = new Set();
  const matches = [];
  for (const d of detections) {
    const colour = d.colors?.[0];
    if (!colour) continue;
    const pool = allItems.filter(i => i.slot === d.slot && !used.has(i.id) && audienceOk(i, input.audience));
    const ranked = pool.map(i => {
      const c = i.colors?.[0];
      const sameFamily = c && colorFamily(c) === colorFamily(colour) ? 0.5 : 0;
      const sameName = c && c.name === colour.name ? 0.4 : 0;
      const pattern = (i.pattern || 'Solid') === (d.pattern || 'Solid') ? 0.1 : 0;
      return { i, s: sameFamily + sameName + pattern };
    }).sort((a, b) => b.s - a.s);
    if (ranked[0] && ranked[0].s >= 0.5 && !fixed[d.slot]) {
      fixed[d.slot] = ranked[0].i.id; used.add(ranked[0].i.id);
      matches.push({ detection: d.key, item: ranked[0].i.id, similarity: Math.round(ranked[0].s * 100) });
    }
  }
  const outfits = generateOutfits(allItems, { ...input, fixed, count: input.count || 3 });
  return { matches, outfits, palette: detections.flatMap(d => d.colors || []).slice(0, 6) };
}

// ---------------------------------------------------------------- preference learning
export const emptyPrefs = () => ({ likedItems: {}, dislikedItems: {}, colours: {}, aesthetics: {}, fits: {}, dislikedPairs: {}, occasions: {}, fragranceFamilies: {}, hairStyles: {}, ratings: [] });

export function recordFeedback(prefs, pieces, value, meta = {}) {
  const p = JSON.parse(JSON.stringify({ ...emptyPrefs(), ...(prefs || {}) }));
  const bump = (obj, key, by) => { if (key) obj[key] = Math.round(((obj[key] || 0) + by) * 100) / 100; };
  for (const item of pieces) {
    if (value > 0) bump(p.likedItems, item.id, value); else bump(p.dislikedItems, item.id, -value * 0.5);
    bump(p.colours, item.colors?.[0]?.name, value);
    (item.aesthetics || []).forEach(a => bump(p.aesthetics, a, value * 0.5));
    bump(p.fits, item.fit, value * 0.5);
  }
  if (value < 0) {
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) bump(p.dislikedPairs, signatureOf([pieces[i].id, pieces[j].id]), 1);
  }
  if (meta.occasion) bump(p.occasions, meta.occasion, value);
  if (meta.aesthetic) bump(p.aesthetics, meta.aesthetic, value);
  if (meta.fragranceFamily) bump(p.fragranceFamilies, meta.fragranceFamily, value);
  if (meta.hairStyle) bump(p.hairStyles, meta.hairStyle, value);
  if (meta.rating) p.ratings = [{ rating: meta.rating, items: pieces.map(x => x.id), at: meta.at || null }, ...p.ratings].slice(0, 100);
  return p;
}

export function summarisePrefs(prefs) {
  const top = (obj, n = 3, positive = true) => Object.entries(obj || {}).filter(([, v]) => (positive ? v > 0 : v < 0)).sort((a, b) => (positive ? b[1] - a[1] : a[1] - b[1])).slice(0, n).map(([k]) => k);
  return {
    colours: top(prefs?.colours), avoidColours: top(prefs?.colours, 3, false), aesthetics: top(prefs?.aesthetics), fits: top(prefs?.fits, 2),
    occasions: top(prefs?.occasions), fragranceFamilies: top(prefs?.fragranceFamilies), hairStyles: top(prefs?.hairStyles),
    dislikedCombos: Object.keys(prefs?.dislikedPairs || {}).length,
    signals: Object.keys(prefs?.likedItems || {}).length + Object.keys(prefs?.dislikedItems || {}).length,
  };
}
