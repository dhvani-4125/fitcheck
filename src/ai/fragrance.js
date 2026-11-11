// Fragrance recommendations: matches scent families to occasion, weather, mood, aesthetic and the
// user's preferences, prioritising bottles they already own.
import { weatherProfile } from './stylist.js';

export const FRAGRANCE_FAMILIES = [
  { id: 'citrus', name: 'Fresh citrus', notes: ['bergamot', 'lemon', 'neroli', 'grapefruit', 'mandarin'], temp: [20, 45], intensity: 1, evening: false, occasions: ['Office', 'College', 'Casual', 'Brunch', 'Travel', 'Road Trip', 'Gym'], aesthetics: ['Minimalist', 'Sporty', 'Old Money'], moods: ['Relaxed', 'Playful', 'Confident'] },
  { id: 'aquatic', name: 'Aquatic & ozonic', notes: ['sea salt', 'marine accord', 'cucumber', 'mint', 'rain accord'], temp: [22, 45], intensity: 1, evening: false, occasions: ['Gym', 'Casual', 'Travel', 'Road Trip', 'College'], aesthetics: ['Sporty', 'Streetwear', 'Minimalist'], moods: ['Relaxed', 'Low-key'] },
  { id: 'green', name: 'Green & tea', notes: ['fig leaf', 'green tea', 'galbanum', 'basil', 'vetiver'], temp: [14, 32], intensity: 1, evening: false, occasions: ['Office', 'College', 'Brunch', 'Travel'], aesthetics: ['Minimalist', 'Casual Luxe'], moods: ['Low-key', 'Relaxed'] },
  { id: 'musk', name: 'Clean musk & skin', notes: ['white musk', 'iris', 'cashmeran', 'ambrette', 'clean cotton'], temp: [0, 35], intensity: 1, evening: false, occasions: ['Office', 'College', 'Casual', 'Brunch', 'Travel'], aesthetics: ['Minimalist', 'Old Money', 'Casual Luxe'], moods: ['Low-key', 'Relaxed', 'Romantic'] },
  { id: 'floral', name: 'Soft floral', notes: ['peony', 'rose', 'jasmine', 'magnolia', 'lily of the valley'], temp: [12, 30], intensity: 2, evening: false, occasions: ['Brunch', 'Date Night', 'Office', 'Formal', 'Party'], aesthetics: ['Feminine', 'Chic', 'Old Money'], moods: ['Romantic', 'Playful'] },
  { id: 'fruity', name: 'Juicy fruity', notes: ['pear', 'blackcurrant', 'peach', 'raspberry', 'lychee'], temp: [15, 32], intensity: 2, evening: false, occasions: ['Party', 'Brunch', 'College', 'Going Out'], aesthetics: ['Feminine', 'Streetwear'], moods: ['Playful', 'Bold'] },
  { id: 'aromatic', name: 'Aromatic herbal', notes: ['lavender', 'sage', 'rosemary', 'geranium', 'cardamom'], temp: [8, 26], intensity: 2, evening: false, occasions: ['Office', 'Travel', 'Casual', 'Road Trip'], aesthetics: ['Old Money', 'Minimalist', 'Casual Luxe'], moods: ['Confident', 'Relaxed'] },
  { id: 'woody', name: 'Warm woods', notes: ['sandalwood', 'cedarwood', 'vetiver', 'guaiac wood', 'patchouli'], temp: [0, 24], intensity: 2, evening: true, occasions: ['Office', 'Formal', 'Date Night', 'Going Out'], aesthetics: ['Old Money', 'Chic', 'Casual Luxe', 'Minimalist'], moods: ['Confident', 'Low-key'] },
  { id: 'amber', name: 'Amber & resin', notes: ['amber', 'labdanum', 'benzoin', 'vanilla', 'incense'], temp: [-10, 18], intensity: 3, evening: true, occasions: ['Date Night', 'Party', 'Formal', 'Going Out'], aesthetics: ['Chic', 'Casual Luxe'], moods: ['Romantic', 'Bold', 'Confident'] },
  { id: 'gourmand', name: 'Gourmand', notes: ['vanilla', 'tonka bean', 'caramel', 'coffee', 'praline'], temp: [-10, 16], intensity: 3, evening: true, occasions: ['Date Night', 'Party', 'Going Out', 'Casual'], aesthetics: ['Feminine', 'Streetwear', 'Casual Luxe'], moods: ['Playful', 'Romantic'] },
  { id: 'spicy', name: 'Spice & leather', notes: ['leather', 'saffron', 'pink pepper', 'oud', 'tobacco'], temp: [-10, 20], intensity: 3, evening: true, occasions: ['Formal', 'Going Out', 'Party', 'Date Night'], aesthetics: ['Chic', 'Old Money', 'Streetwear'], moods: ['Bold', 'Confident'] },
];
export const FAMILY_BY_ID = Object.fromEntries(FRAGRANCE_FAMILIES.map(f => [f.id, f]));
const INTENSITY_WORD = ['', 'light', 'moderate', 'rich'];

const OCCASION_INTENSITY = { Office: 1, College: 1, Gym: 1, Travel: 1.3, 'Road Trip': 1.3, Casual: 1.5, Brunch: 1.6, 'Going Out': 2.4, 'Date Night': 2.4, Party: 2.7, Formal: 2.5 };

function scoreFamily(fam, ctx, notes = fam.notes) {
  const why = [];
  let s = 0.4;
  const wp = ctx.wp;
  if (wp) {
    const t = wp.feels;
    if (t >= fam.temp[0] && t <= fam.temp[1]) { s += 0.25; why.push(t >= 24 ? 'stays fresh in the heat' : t <= 14 ? 'warmth blooms in cool air' : 'balanced for mild weather'); }
    else s -= 0.25;
    if (wp.humid && fam.intensity >= 3) { s -= 0.15; }
  }
  const desired = ctx.occasion ? OCCASION_INTENSITY[ctx.occasion] ?? 1.8 : 1.8;
  const intensityTarget = ctx.prefs?.intensity === 'soft' ? Math.min(desired, 1.4) : ctx.prefs?.intensity === 'strong' ? Math.max(desired, 2.4) : desired;
  s += 0.2 - Math.abs(fam.intensity - intensityTarget) * 0.14;
  if (ctx.occasion && fam.occasions.includes(ctx.occasion)) { s += 0.2; why.push(`${INTENSITY_WORD[fam.intensity]} projection suits ${ctx.occasion.toLowerCase()}`); }
  if (ctx.aesthetic && fam.aesthetics.includes(ctx.aesthetic)) { s += 0.08; why.push(`echoes the ${ctx.aesthetic.toLowerCase()} look`); }
  if (ctx.mood && fam.moods.includes(ctx.mood)) { s += 0.07; why.push(`fits a ${ctx.mood.toLowerCase()} mood`); }
  if (ctx.outfitAesthetic && !ctx.aesthetic && fam.aesthetics.includes(ctx.outfitAesthetic)) s += 0.05;
  if (ctx.prefs?.longevity === 'long' && fam.intensity >= 2) s += 0.06;
  const disliked = (ctx.prefs?.dislikedNotes || []).map(n => n.toLowerCase().trim()).filter(Boolean);
  const clash = notes.filter(n => disliked.some(d => n.toLowerCase().includes(d)));
  if (clash.length) s -= 0.35 * clash.length;
  const liked = ctx.prefs?.families || [];
  if (liked.includes(fam.id)) s += 0.1;
  s += Math.max(-0.12, Math.min(0.12, (ctx.learned?.[fam.id] || 0) * 0.03));
  return { score: Math.max(0, Math.min(1, s)), why, clash };
}

function applicationTip(fam, ctx) {
  const wp = ctx.wp;
  const sprays = fam.intensity >= 3 || ctx.occasion === 'Office' || ctx.occasion === 'College' ? '1–2 sprays' : '2–3 sprays';
  const where = fam.intensity >= 3 ? 'on the wrists and behind the ears' : 'on the neck and wrists';
  const heat = wp && wp.feels >= 26 ? ' Heat makes scent project more, so go lighter than usual.' : wp && wp.feels <= 10 ? ' Spritz your scarf or collar too, because cold air mutes scent.' : '';
  const lasting = ctx.prefs?.longevity === 'long' ? ' Choose an eau de parfum or apply over unscented moisturiser so it lasts longer.' : '';
  return `${sprays} ${where}.${heat}${lasting}`;
}

/**
 * @returns {{ owned: Array, profiles: Array }}
 * ctx: { occasion, aesthetic, mood, weather|wp, prefs: {dislikedNotes, intensity, longevity, families}, collection, learned, outfitAesthetic }
 */
export function recommendFragrance(input = {}) {
  const ctx = { ...input, wp: input.wp !== undefined ? input.wp : weatherProfile(input.weather) };
  const owned = (ctx.collection || []).map(f => {
    const fam = FAMILY_BY_ID[f.family] || FAMILY_BY_ID.musk;
    const notes = String(f.notes || '').split(',').map(n => n.trim()).filter(Boolean);
    const famLike = { ...fam, intensity: f.intensity ? Number(f.intensity) : fam.intensity };
    const r = scoreFamily(famLike, ctx, notes.length ? notes : fam.notes);
    return { fragrance: f, family: fam, score: Math.round(Math.min(1, r.score + 0.12) * 100), why: r.why, clash: r.clash, tip: applicationTip(famLike, ctx) };
  }).sort((a, b) => b.score - a.score);
  const profiles = FRAGRANCE_FAMILIES.map(fam => {
    const r = scoreFamily(fam, ctx);
    return { family: fam, score: Math.round(r.score * 100), why: r.why, clash: r.clash, tip: applicationTip(fam, ctx) };
  }).filter(p => !p.clash.length).sort((a, b) => b.score - a.score).slice(0, 3);
  return { owned, profiles };
}

export function fragranceSentence(rec, ctx = {}) {
  if (!rec) return '';
  const name = rec.fragrance ? `${rec.fragrance.name}${rec.fragrance.brand ? ` by ${rec.fragrance.brand}` : ''}` : `a ${rec.family.name.toLowerCase()} scent`;
  const reasons = rec.why.slice(0, 2).join(' and ');
  return `Wear ${name}: ${reasons || 'a versatile choice for today'}.`;
}
