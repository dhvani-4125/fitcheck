// Colour knowledge shared by the vision pipeline, the matching engine and insights.
// Pure functions only, so they run in the browser and in Node tests.

export const NAMED_COLORS = [
  ['Black', '#1c1c1c'], ['Charcoal', '#3c3d3f'], ['Grey', '#8a8a8a'], ['Silver', '#c0c0c0'],
  ['White', '#f5f5f2'], ['Ivory', '#efe8d8'], ['Cream', '#eadfc8'], ['Beige', '#d6c4a5'],
  ['Camel', '#b98f5e'], ['Tan', '#c19a6b'], ['Brown', '#6b4a32'], ['Coffee', '#5a3e2b'],
  ['Navy', '#1f2a44'], ['Denim', '#4f6d8f'], ['Blue', '#3b6db3'], ['Light blue', '#a9c6e8'],
  ['Teal', '#2f7f7a'], ['Green', '#3f7d4a'], ['Olive', '#6b6b3a'], ['Sage', '#a3b18a'],
  ['Khaki', '#b5a77a'], ['Yellow', '#e7c64a'], ['Mustard', '#c99a2e'], ['Orange', '#e07b39'],
  ['Rust', '#a5482a'], ['Red', '#c0392b'], ['Burgundy', '#6d1f2f'], ['Wine', '#6e2236'],
  ['Pink', '#e8a5b8'], ['Blush', '#efc9c3'], ['Lilac', '#b9a3cf'], ['Purple', '#6c3f8f'],
  ['Gold', '#c9a54a'],
];

// Colours that behave as neutrals when styling, even if they carry some saturation.
const FASHION_NEUTRALS = new Set([
  'black', 'charcoal', 'grey', 'silver', 'white', 'ivory', 'cream', 'beige', 'camel', 'tan',
  'brown', 'coffee', 'navy', 'denim', 'khaki', 'gold', // gold reads as a metallic neutral, especially in Indian wear
]);

const ALIASES = { gray: 'Grey', 'off white': 'Ivory', 'off-white': 'Ivory', maroon: 'Burgundy', fossil: 'Beige', lacquer: 'Brown', 'baby pink': 'Pink', chocolate: 'Brown', nude: 'Beige', stone: 'Beige', ecru: 'Ivory', oatmeal: 'Beige', forest: 'Green', emerald: 'Green', mint: 'Sage', lavender: 'Lilac', mauve: 'Lilac', coral: 'Orange', terracotta: 'Rust', indigo: 'Navy', 'dawn': 'Grey' };

export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

// Perceptual-ish distance (redmean approximation), cheap enough for per-pixel use.
export function colorDistance(a, b) {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const NAMED_RGB = NAMED_COLORS.map(([name, hex]) => ({ name, hex, rgb: hexToRgb(hex) }));

export function nearestColorName(rgb) {
  let best = NAMED_RGB[0], bestD = Infinity;
  for (const c of NAMED_RGB) {
    const d = colorDistance(rgb, c.rgb);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function hexForName(name) {
  const hit = NAMED_RGB.find(c => c.name.toLowerCase() === String(name).toLowerCase());
  return hit ? hit.hex : null;
}

// Turn a free-text colour such as "Fossil beige" or "White / black" into named colours.
export function parseColorText(text) {
  const raw = String(text || '').toLowerCase();
  if (!raw.trim()) return [];
  const found = [];
  const push = (name, at) => { if (!found.some(f => f.name === name)) found.push({ name, at }); };
  for (const [alias, name] of Object.entries(ALIASES)) {
    const at = raw.indexOf(alias);
    if (at >= 0) push(name, at);
  }
  const sorted = [...NAMED_COLORS].sort((a, b) => b[0].length - a[0].length);
  let scrub = raw;
  for (const [name] of sorted) {
    const key = name.toLowerCase();
    const at = scrub.indexOf(key);
    if (at >= 0) {
      push(name, at);
      scrub = scrub.slice(0, at) + ' '.repeat(key.length) + scrub.slice(at + key.length);
    }
  }
  // Prefer the colour mentioned last in phrases like "fossil beige" (beige is the hue),
  // but keep "white / black" order when separated by a slash.
  const parts = raw.includes('/') ? found.sort((a, b) => a.at - b.at) : found.sort((a, b) => b.at - a.at);
  return parts.map(({ name }) => ({ name, hex: hexForName(name) }));
}

export function isNeutral(color) {
  if (!color) return true;
  if (FASHION_NEUTRALS.has(String(color.name || '').toLowerCase())) return true;
  const [, s, l] = rgbToHsl(hexToRgb(color.hex || '#888888'));
  return s < 0.14 || l < 0.12 || l > 0.93;
}

function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Relationship between two colours, used to explain and score outfits.
export function colorRelation(a, b) {
  if (!a || !b) return { type: 'neutral', score: 0.8 };
  const na = isNeutral(a), nb = isNeutral(b);
  if (na && nb) return { type: 'neutral', score: 0.9 };
  if (na || nb) return { type: 'neutral-base', score: 0.86 };
  const [ha, , la] = rgbToHsl(hexToRgb(a.hex));
  const [hb, , lb] = rgbToHsl(hexToRgb(b.hex));
  const gap = hueGap(ha, hb);
  if (gap < 16) return Math.abs(la - lb) > 0.14 ? { type: 'monochrome', score: 0.88 } : { type: 'tonal', score: 0.74 };
  if (gap < 48) return { type: 'analogous', score: 0.8 };
  if (gap >= 150) return { type: 'complementary', score: 0.76 };
  if (gap >= 105 && gap < 135) return { type: 'contrast', score: 0.6 };
  return { type: 'clash', score: 0.34 };
}

const RELATION_COPY = {
  neutral: 'an all-neutral palette that always reads polished',
  'neutral-base': 'a neutral base that lets one colour lead',
  monochrome: 'a monochrome palette with depth from light and dark shades',
  tonal: 'tonal dressing in closely related shades',
  analogous: 'analogous colours that sit side by side on the wheel',
  complementary: 'complementary colours that make each other pop',
  contrast: 'a deliberate contrast that keeps it lively',
  clash: 'a bolder colour pairing',
};

// Score an outfit's palette. Each piece contributes its primary colour.
export function paletteScore(pieces) {
  const colors = pieces.map(p => (p.colors && p.colors[0]) || null).filter(Boolean);
  if (colors.length < 2) return { score: 0.8, type: 'neutral', story: RELATION_COPY.neutral, names: colors.map(c => c.name) };
  let total = 0, n = 0;
  const tally = {};
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const rel = colorRelation(colors[i], colors[j]);
      total += rel.score; n++;
      tally[rel.type] = (tally[rel.type] || 0) + 1;
    }
  }
  let score = total / n;
  const accents = new Set(colors.filter(c => !isNeutral(c)).map(c => c.name));
  if (accents.size > 2) score -= 0.12 * (accents.size - 2); // colour balance: too many competing hues
  const accentType = Object.entries(tally).filter(([t]) => t !== 'neutral' && t !== 'neutral-base').sort((a, b) => b[1] - a[1])[0]?.[0];
  const dominant = accents.size === 0 ? 'neutral' : accents.size === 1 ? 'neutral-base' : (tally.clash ? 'clash' : accentType || 'neutral-base');
  return {
    score: Math.max(0, Math.min(1, score)),
    type: dominant,
    story: RELATION_COPY[dominant] || RELATION_COPY.neutral,
    names: [...new Set(colors.map(c => c.name))],
  };
}

export function colorFamily(color) {
  if (!color) return 'neutral';
  if (isNeutral(color)) return 'neutral';
  const [h] = rgbToHsl(hexToRgb(color.hex));
  if (h < 20 || h >= 330) return 'red';
  if (h < 38) return 'orange'; // mustard (~42°) and gold count as yellow
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 255) return 'blue';
  return 'purple';
}
