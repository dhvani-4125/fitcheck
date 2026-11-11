// Hairstyle recommendations based on outfit neckline/silhouette, occasion formality, weather and the
// user's hair length, texture and preferences.
import { weatherProfile } from './stylist.js';

const ALL_TEX = ['straight', 'wavy', 'curly', 'coily'];
export const HAIR_LENGTHS = ['short', 'medium', 'long'];
export const HAIR_TEXTURES = ALL_TEX;

export const HAIRSTYLES = [
  { id: 'waves', name: 'Open hair with soft waves', icon: 'waves', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [2, 5], humidity: 0.2, wind: 0.3, necklines: ['v-neck', 'off-shoulder', 'halter', 'crew'], aesthetics: ['Feminine', 'Chic', 'Casual Luxe'], how: 'Loose curls with a large barrel or braid damp hair overnight, then brush them out with your fingers.' },
  { id: 'sleek-pony', name: 'Sleek ponytail', icon: 'pony', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [2, 5], humidity: 0.9, wind: 0.9, necklines: ['high', 'crew', 'halter', 'collared', 'off-shoulder'], aesthetics: ['Chic', 'Minimalist', 'Sporty', 'Old Money'], how: 'Smooth with a little gel or cream, tie it at the crown and wrap a strand around the elastic.' },
  { id: 'messy-bun', name: 'Messy bun', icon: 'bun', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [1, 3], humidity: 0.9, wind: 0.8, necklines: ['crew', 'high', 'v-neck', 'collared'], aesthetics: ['Streetwear', 'Casual Luxe', 'Sporty'], how: 'Twist it loosely on top of your head, pin it, and pull out a few face-framing pieces.' },
  { id: 'low-bun', name: 'Low bun', icon: 'lowbun', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [3, 5], humidity: 0.85, wind: 0.85, necklines: ['off-shoulder', 'halter', 'high', 'collared', 'v-neck'], aesthetics: ['Old Money', 'Minimalist', 'Chic'], how: 'Side or centre part, gather it at the nape, twist into a neat knot and pin it flat.' },
  { id: 'straight', name: 'Sleek straight hair', icon: 'straight', lengths: HAIR_LENGTHS, textures: ['straight', 'wavy'], formality: [2, 4.5], humidity: 0.15, wind: 0.4, necklines: ['crew', 'high', 'collared', 'v-neck'], aesthetics: ['Minimalist', 'Chic'], how: 'Blow-dry with a paddle brush, use heat protectant, and finish with a drop of serum.' },
  { id: 'half-up', name: 'Half-up, half-down', icon: 'halfup', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [2, 4], humidity: 0.5, wind: 0.6, necklines: ['crew', 'v-neck', 'high', 'collared'], aesthetics: ['Feminine', 'Casual Luxe', 'Old Money'], how: 'Gather the top section from temple to temple and secure it with a clip or small bow.' },
  { id: 'braids', name: 'Braids', icon: 'braid', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [1, 4], humidity: 1, wind: 1, necklines: ['crew', 'high', 'v-neck', 'collared', 'halter'], aesthetics: ['Sporty', 'Streetwear', 'Feminine'], how: 'Two Dutch braids hold up to wind and humidity. A single side braid looks softer.' },
  { id: 'updo', name: 'Elegant updo', icon: 'updo', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [4, 5], humidity: 0.8, wind: 0.85, necklines: ['off-shoulder', 'halter', 'v-neck', 'high'], aesthetics: ['Chic', 'Old Money', 'Feminine'], how: 'Add texture spray, make a French twist or chignon, and pin it securely. Leave tendrils loose if you like.' },
  { id: 'everyday', name: 'Casual everyday', icon: 'everyday', lengths: HAIR_LENGTHS, textures: ALL_TEX, formality: [1, 3], humidity: 0.5, wind: 0.5, necklines: ['crew', 'high', 'collared', 'v-neck'], aesthetics: ['Minimalist', 'Streetwear', 'Casual Luxe'], how: 'Wear your natural texture with a light leave-in, or tuck it behind your ears.' },
  { id: 'defined-curls', name: 'Defined natural curls', icon: 'curls', lengths: HAIR_LENGTHS, textures: ['curly', 'coily'], formality: [1, 5], humidity: 0.6, wind: 0.5, necklines: ['off-shoulder', 'v-neck', 'crew', 'halter', 'high'], aesthetics: ['Feminine', 'Casual Luxe', 'Chic', 'Streetwear'], how: 'Apply curl cream to soaking-wet hair, scrunch it, then diffuse or air-dry without touching.' },
  { id: 'gajra-bun', name: 'Low bun with gajra', icon: 'lowbun', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [3.5, 5], humidity: 0.9, wind: 0.9, necklines: ['off-shoulder', 'halter', 'high', 'v-neck', 'crew', 'collared'], aesthetics: ['Ethnic', 'Old Money', 'Feminine'], indian: true, how: 'Make a sleek low bun at the nape, then wrap a fresh mogra gajra around it and pin it in place.' },
  { id: 'flower-braid', name: 'Side braid with flowers', icon: 'braid', lengths: ['medium', 'long'], textures: ALL_TEX, formality: [2.5, 4.5], humidity: 1, wind: 1, necklines: ['crew', 'v-neck', 'high', 'off-shoulder', 'collared'], aesthetics: ['Ethnic', 'Feminine'], indian: true, how: 'Loosen a side braid by gently pulling its edges, then tuck in small fresh flowers or pins along it.' },
  { id: 'textured-crop', name: 'Textured crop', icon: 'short', lengths: ['short'], textures: ALL_TEX, formality: [1, 3.5], humidity: 0.85, wind: 0.85, necklines: ['crew', 'high', 'collared', 'v-neck'], aesthetics: ['Streetwear', 'Minimalist', 'Sporty'], how: 'Work a matte clay through towel-dried hair and push it forward with your fingers.' },
  { id: 'side-part', name: 'Polished side part', icon: 'short', lengths: ['short', 'medium'], textures: ['straight', 'wavy'], formality: [3, 5], humidity: 0.6, wind: 0.6, necklines: ['collared', 'high', 'crew'], aesthetics: ['Old Money', 'Chic', 'Minimalist'], how: 'Make a clean side part with a comb and set it with a light pomade.' },
  { id: 'slick-back', name: 'Slicked back', icon: 'short', lengths: ['short', 'medium'], textures: ALL_TEX, formality: [3.5, 5], humidity: 0.75, wind: 0.9, necklines: ['collared', 'off-shoulder', 'halter', 'v-neck'], aesthetics: ['Chic', 'Old Money'], how: 'Comb gel or pomade back from the hairline. A wet-look finish suits evenings.' },
  { id: 'sleek-bob', name: 'Sleek tucked bob', icon: 'bob', lengths: ['short'], textures: ['straight', 'wavy'], formality: [2, 5], humidity: 0.35, wind: 0.5, necklines: ['high', 'crew', 'v-neck', 'off-shoulder'], aesthetics: ['Chic', 'Minimalist'], how: 'Smooth it with a round brush and tuck one side behind your ear.' },
];
export const HAIR_BY_ID = Object.fromEntries(HAIRSTYLES.map(h => [h.id, h]));

/**
 * ctx: { pieces, occasion, aesthetic, weather|wp, profile: {length, texture, preferred: [ids], avoid: [ids]}, learned }
 */
export function recommendHair(input = {}) {
  const ctx = { ...input, wp: input.wp !== undefined ? input.wp : weatherProfile(input.weather) };
  const pieces = ctx.pieces || [];
  const profile = { ...(ctx.profile || {}) };
  // Hair length not given: use the gender from registration (or, failing that, the outfit's wardrobe) as a starting point.
  if (!profile.length && (ctx.gender === 'Man' || (!ctx.gender && pieces.some(p => p.audience === 'Men') && !pieces.some(p => p.audience === 'Women')))) profile.length = 'short';
  const lead = pieces.find(p => p.slot === 'dress') || pieces.find(p => p.slot === 'top') || pieces.find(p => p.slot === 'outer');
  const neckline = lead?.neckline || 'crew';
  const clothing = pieces.filter(p => !['bag', 'accessory'].includes(p.slot));
  const formality = clothing.length ? clothing.reduce((s, p) => s + (p.formality ?? 3), 0) / clothing.length : 3;
  const hasLayer = pieces.some(p => p.slot === 'outer' && /hood|collar|coat|jacket/i.test(p.name));
  return HAIRSTYLES.map(style => {
    if (profile.length && !style.lengths.includes(profile.length)) return null;
    if (profile.texture && !style.textures.includes(profile.texture)) return null;
    if ((profile.avoid || []).includes(style.id)) return null;
    const why = [];
    let s = 0.4;
    if (formality >= style.formality[0] - 0.25 && formality <= style.formality[1] + 0.25) { s += 0.22; why.push(formality >= 4 ? 'polished enough for a dressed-up outfit' : formality <= 2 ? 'easy-going, like the outfit' : 'matches the outfit\'s smart-casual level'); }
    else s -= 0.2;
    if (style.necklines.includes(neckline)) {
      s += 0.15;
      const copy = { halter: 'shows off the halter neckline', 'off-shoulder': 'keeps the shoulders and neckline on show', 'v-neck': 'frames the V-neck', high: 'stays clear of the high neckline', collared: 'sits neatly above the collar', crew: 'balances the crew neckline' };
      why.push(copy[neckline]);
    }
    const wp = ctx.wp;
    if (wp) {
      if (wp.humid || wp.rainy) { s += (style.humidity - 0.5) * 0.35; if (style.humidity >= 0.8) why.push('holds up in humidity'); }
      if (wp.windy) { s += (style.wind - 0.5) * 0.3; if (style.wind >= 0.8) why.push('stays in place in the wind'); }
      if (wp.band === 'hot' && ['messy-bun', 'sleek-pony', 'braids', 'updo', 'low-bun'].includes(style.id)) { s += 0.08; why.push('keeps hair off your neck in the heat'); }
    }
    if (ctx.occasion === 'Gym' && ['sleek-pony', 'braids', 'messy-bun', 'textured-crop'].includes(style.id)) s += 0.2;
    if (ctx.occasion === 'Formal' && ['updo', 'low-bun', 'waves', 'slick-back', 'side-part'].includes(style.id)) s += 0.12;
    const indianOcc = ['Haldi', 'Mehndi', 'Sangeet', 'Wedding', 'Reception', 'Festive'].includes(ctx.occasion);
    const ethnicLook = pieces.some(p => p.ethnic && ['dress', 'top'].includes(p.slot));
    if (style.indian && !indianOcc && !ethnicLook) return null;
    if (indianOcc || ethnicLook) {
      const boosts = { Haldi: ['flower-braid', 'braids', 'messy-bun'], Mehndi: ['flower-braid', 'braids', 'messy-bun', 'half-up'], Sangeet: ['waves', 'half-up', 'sleek-pony', 'defined-curls'], Wedding: ['gajra-bun', 'updo', 'low-bun', 'waves'], Reception: ['waves', 'updo', 'sleek-pony', 'slick-back'], Festive: ['gajra-bun', 'flower-braid', 'half-up', 'low-bun'] }[ctx.occasion] || ['gajra-bun', 'flower-braid'];
      if (boosts.includes(style.id)) { s += 0.18; if (ctx.occasion === 'Mehndi' && ['flower-braid', 'braids', 'messy-bun'].includes(style.id)) why.push('keeps hair away from wet mehndi'); else if (style.indian) why.push('a traditional touch for the occasion'); }
    }
    if (hasLayer && ['low-bun', 'sleek-pony', 'updo'].includes(style.id)) s += 0.04;
    if (ctx.aesthetic && style.aesthetics.includes(ctx.aesthetic)) { s += 0.08; why.push(`in keeping with ${ctx.aesthetic.toLowerCase()}`); }
    if ((profile.preferred || []).includes(style.id)) { s += 0.15; why.push('one of your favourite styles'); }
    s += Math.max(-0.12, Math.min(0.12, (ctx.learned?.[style.id] || 0) * 0.03));
    if (profile.texture === 'curly' || profile.texture === 'coily') { if (style.id === 'straight') s -= 0.3; if (style.id === 'defined-curls') s += 0.1; }
    return { style, score: Math.round(Math.max(0, Math.min(1, s)) * 100), why: why.filter(Boolean), neckline };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 3);
}
