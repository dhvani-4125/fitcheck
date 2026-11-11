// Infers styling attributes (slot, formality, warmth, aesthetic, fit, neckline...) for a wardrobe item.
// Values the user has set explicitly are never overwritten.
import { parseColorText } from './colors.js';

export const SLOTS = ['top', 'bottom', 'outer', 'dress', 'shoes', 'bag', 'accessory'];

export const SLOT_GROUPS = {
  top: 'Tops', bottom: 'Bottoms', outer: 'Outerwear', dress: 'Dresses & sets',
  shoes: 'Footwear', bag: 'Accessories', accessory: 'Accessories',
};
export const GROUP_ORDER = ['Tops', 'Bottoms', 'Outerwear', 'Dresses & sets', 'Footwear', 'Accessories'];

export const SLOT_LABELS = {
  top: 'Top', bottom: 'Bottom', outer: 'Layer', dress: 'Dress / set', shoes: 'Footwear', bag: 'Bag', accessory: 'Accessory',
};

export const SUBCATEGORIES = {
  top: ['Shirt', 'T-shirt', 'Blouse', 'Sweater', 'Polo', 'Tank', 'Activewear top'],
  bottom: ['Jeans', 'Trousers', 'Skirt', 'Shorts', 'Leggings', 'Joggers'],
  outer: ['Hoodie', 'Jacket', 'Coat', 'Blazer', 'Cardigan'],
  dress: ['Dress', 'Jumpsuit', 'Gown', 'Co-ord set', 'Suit', 'Ethnic set'],
  shoes: ['Sneakers', 'Heels', 'Boots', 'Sandals', 'Loafers', 'Flats', 'Formal shoes'],
  bag: ['Handbag', 'Tote', 'Clutch', 'Backpack', 'Crossbody'],
  accessory: ['Watch', 'Jewellery', 'Belt', 'Scarf', 'Sunglasses', 'Hat'],
};

export const PATTERNS = ['Solid', 'Stripes', 'Checks', 'Floral / print', 'Textured'];
export const FITS = ['Fitted', 'Regular', 'Oversized'];
export const AESTHETICS = ['Minimalist', 'Old Money', 'Streetwear', 'Chic', 'Feminine', 'Casual Luxe', 'Sporty'];

const SLOT_RULES = [
  ['outer', /\b(jacket|coat|blazer|hoodie|cardigan|parka|trench|gilet|shacket|windbreaker|puffer)\b/],
  ['dress', /\b(dress|gown|jumpsuit|playsuit|romper|lehenga|saree|sari|anarkali|suit|co-?ord|set)\b/],
  ['shoes', /\b(shoes?|sneakers?|trainers?|loafers?|heels?|pumps?|boots?|sandals?|footwear|mules?|flats?|lace-up|slides?|espadrilles?)\b/],
  ['bag', /\b(bag|handbag|tote|clutch|backpack|purse|crossbody|satchel)\b/],
  ['bottom', /\b(trousers?|pants?|jeans?|skirts?|shorts|leggings?|tights?|joggers?|chinos?|bottoms|culottes|palazzo)\b/],
  ['top', /\b(shirt|tee|t-shirt|top|blouse|sweater|knit|crewneck|jumper|polo|bra|tank|camisole|cami|turtleneck|sweatshirt|kurta|bodysuit|vest)\b/],
  ['accessory', /\b(watch|belt|necklace|earrings?|bracelet|ring|scarf|hat|cap|sunglasses|jewell?ery|tie)\b/],
];

const SUB_RULES = [
  [/jean|denim/, 'Jeans'], [/skirt/, 'Skirt'], [/short/, 'Shorts'], [/legging|tight/, 'Leggings'], [/jogger/, 'Joggers'], [/trouser|pant|chino|palazzo/, 'Trousers'],
  [/hoodie/, 'Hoodie'], [/blazer|suit jacket/, 'Blazer'], [/coat|trench|parka/, 'Coat'], [/cardigan/, 'Cardigan'], [/jacket/, 'Jacket'],
  [/gown/, 'Gown'], [/jumpsuit|playsuit/, 'Jumpsuit'], [/lehenga|saree|kurta set|anarkali|palazzo suit/, 'Ethnic set'], [/\bsuit\b/, 'Suit'], [/\bset\b|co-?ord/, 'Co-ord set'], [/dress/, 'Dress'],
  [/sneaker|trainer|running/, 'Sneakers'], [/heel|pump/, 'Heels'], [/boot/, 'Boots'], [/sandal|slide/, 'Sandals'], [/loafer/, 'Loafers'], [/lace-up|oxford|derby|wholecut/, 'Formal shoes'], [/flat|mule/, 'Flats'],
  [/clutch/, 'Clutch'], [/tote/, 'Tote'], [/backpack/, 'Backpack'], [/crossbody/, 'Crossbody'], [/bag|purse/, 'Handbag'],
  [/watch/, 'Watch'], [/belt/, 'Belt'], [/scarf/, 'Scarf'], [/sunglass/, 'Sunglasses'], [/hat|cap/, 'Hat'], [/necklace|earring|bracelet|ring|jewel/, 'Jewellery'],
  [/blouse/, 'Blouse'], [/sweater|knit|jumper|crewneck|cardigan|sweatshirt/, 'Sweater'], [/polo/, 'Polo'], [/tank|cami/, 'Tank'], [/\bbra\b|activewear|sports/, 'Activewear top'], [/tee|t-shirt/, 'T-shirt'], [/shirt/, 'Shirt'],
];

export function inferSlot(text) {
  const t = String(text || '').toLowerCase();
  for (const [slot, re] of SLOT_RULES) if (re.test(t)) return slot;
  return null;
}

export function inferSubcategory(text, slot) {
  const t = String(text || '').toLowerCase();
  for (const [re, sub] of SUB_RULES) {
    if (re.test(t) && (!slot || SUBCATEGORIES[slot]?.includes(sub))) return sub;
  }
  return slot ? SUBCATEGORIES[slot][0] : 'Other';
}

const has = (t, re) => re.test(t);

function inferFormality(t, slot, sub) {
  let f = { top: 3, bottom: 3, outer: 3, dress: 3, shoes: 3, bag: 3, accessory: 3 }[slot] ?? 3;
  if (has(t, /tuxedo|gown|velvet|barathea|lehenga|wholecut|black-tie|chalk-stripe|hand-tailored|sequin|embroidered/)) f = 5;
  else if (has(t, /suit|satin|silk|pump|heel|charmeuse|clutch|corset|chanel|cashmere polo/)) f = Math.max(f, 4);
  else if (has(t, /tailored|trouser|oxford|loafer|blazer|blouse|poplin|wool|lambskin|cashmere|leather/)) f = Math.max(f, 3.5);
  if (has(t, /jean|denim|tee\b|t-shirt|sneaker|hoodie|sweatshirt|canvas|cargo|shorts|slide/)) f = Math.min(f, 2);
  if (has(t, /legging|\bbra\b|jogger|running|gym|mesh|tight\b|track|activewear|athletic/)) f = 1;
  if (sub === 'Ethnic set') f = Math.max(f, 4);
  return Math.round(f * 2) / 2;
}

function inferWarmth(t, slot) {
  let w = { top: 2, bottom: 2, outer: 4, dress: 2, shoes: 2, bag: 0, accessory: 0 }[slot] ?? 2;
  if (has(t, /coat|puffer|parka|down\b|shearling/)) w = 5;
  else if (has(t, /cashmere|wool|knit|sweater|jumper|velvet|fleece|hoodie|boot|merino|corduroy|tweed/)) w += 1.5;
  if (has(t, /linen|tee\b|tank|cami|shorts|sandal|halter|mesh|slip|sleeveless|crop|bra\b/)) w -= 1;
  return Math.max(0, Math.min(5, w));
}

function inferAesthetics(t, slot, colors, formality) {
  const tags = new Set();
  const names = colors.map(c => c.name.toLowerCase());
  const neutralOnly = names.every(n => ['black', 'white', 'ivory', 'cream', 'beige', 'grey', 'charcoal', 'camel', 'navy', 'brown', 'coffee', 'tan'].includes(n));
  if (neutralOnly && !has(t, /print|floral|graphic|logo/)) tags.add('Minimalist');
  if (has(t, /cashmere|loafer|oxford|polo|tailored|tweed|cable|pleated|ralph|the row|wool|linen suit/) || (names.some(n => ['navy', 'camel', 'cream', 'ivory'].includes(n)) && formality >= 3)) tags.add('Old Money');
  if (has(t, /hoodie|sneaker|cargo|graphic|oversized|sweatshirt|cap\b|baggy|track/)) tags.add('Streetwear');
  if (has(t, /satin|heel|pump|blazer|clutch|slip|black velvet|corset|mermaid|patent/) || (names.includes('black') && formality >= 3.5)) tags.add('Chic');
  if (has(t, /dress|skirt|blouse|ruched|floral|ruffle|lace|halter|bow|gown|lehenga|georgette/) || names.some(n => ['pink', 'blush', 'lilac'].includes(n))) tags.add('Feminine');
  if (has(t, /cashmere|merino|knit|linen|leather|silk|jersey|lambskin/)) tags.add('Casual Luxe');
  if (has(t, /legging|\bbra\b|jogger|running|mesh|lululemon|nike|gym|tight\b|activewear/)) tags.add('Sporty');
  if (!tags.size) tags.add(formality >= 3.5 ? 'Chic' : 'Minimalist');
  return [...tags];
}

function inferFit(t) {
  if (has(t, /oversized|relaxed|wide|boxy|baggy|palazzo|loose|slouch|maxi skirt/)) return 'Oversized';
  if (has(t, /fitted|slim|skinny|tight\b|bodycon|corset|mermaid|halter|legging|cropped|pencil/)) return 'Fitted';
  return 'Regular';
}

function inferNeckline(t, slot) {
  if (!['top', 'dress', 'outer'].includes(slot)) return null;
  if (has(t, /halter/)) return 'halter';
  if (has(t, /one-shoulder|off-shoulder|strapless|bardot/)) return 'off-shoulder';
  if (has(t, /v-neck|wrap|plunge|tie-up/)) return 'v-neck';
  if (has(t, /turtleneck|polo neck|high neck|mock/)) return 'high';
  if (has(t, /shirt|polo|oxford|collar|tuxedo|blazer|jacket/)) return 'collared';
  return 'crew';
}

export const STYLIST_OCCASIONS = [
  { id: 'Office', label: 'Office / Professional', range: [3, 4.5], saved: 'Work' },
  { id: 'College', label: 'College / Everyday', range: [1.5, 3], saved: 'Everyday' },
  { id: 'Casual', label: 'Casual / Leisure', range: [1, 3], saved: 'Everyday' },
  { id: 'Going Out', label: 'Going Out', range: [3, 4.5], saved: 'Party' },
  { id: 'Date Night', label: 'Date Night', range: [3, 5], saved: 'Date Night' },
  { id: 'Party', label: 'Party', range: [3.5, 5], saved: 'Party' },
  { id: 'Brunch', label: 'Brunch', range: [2, 3.5], saved: 'Everyday' },
  { id: 'Travel', label: 'Travel', range: [1, 3], saved: 'Travel' },
  { id: 'Road Trip', label: 'Road Trip / Ride', range: [1, 2.5], saved: 'Travel' },
  { id: 'Formal', label: 'Formal Events', range: [4, 5], saved: 'Formal' },
  { id: 'Gym', label: 'Gym / Activewear', range: [1, 1.5], saved: 'Athleisure' },
];
export const OCCASION_BY_ID = Object.fromEntries(STYLIST_OCCASIONS.map(o => [o.id, o]));

export function occasionsForFormality(f, aesthetics = []) {
  return STYLIST_OCCASIONS.filter(o => {
    if (o.id === 'Gym') return aesthetics.includes('Sporty');
    return f >= o.range[0] - 0.5 && f <= o.range[1] + 0.5;
  }).map(o => o.id);
}

function inferSeasons(warmth) {
  if (warmth >= 4) return ['Autumn', 'Winter'];
  if (warmth <= 1.5) return ['Spring', 'Summer'];
  if (warmth >= 3) return ['Autumn', 'Winter', 'Spring'];
  return ['Spring', 'Summer', 'Autumn'];
}

function inferMaterial(t) {
  const m = t.match(/cashmere|merino|wool|linen|silk|satin|cotton|denim|leather|suede|velvet|jersey|knit|mesh|georgette|lambskin|patent|nylon|polyester/);
  return m ? m[0][0].toUpperCase() + m[0].slice(1) : '';
}

export function enrichItem(item) {
  const text = `${item.name || ''} ${item.type || ''} ${item.subcategory || ''} ${/lululemon|nike|adidas|puma|gymshark|under armour|reebok|asics/i.test(item.brand || '') ? `${item.brand} activewear` : ''}`.toLowerCase();
  const nameSlot = inferSlot(item.name);
  const slot = SLOTS.includes(item.slot) ? item.slot : (nameSlot || inferSlot(item.type) || inferSlot(item.subcategory) || 'top');
  const subcategory = item.subcategory || inferSubcategory(text, slot);
  const colors = Array.isArray(item.colors) && item.colors.length ? item.colors : parseColorText(item.color);
  const formality = typeof item.formality === 'number' ? item.formality : inferFormality(text, slot, subcategory);
  const warmth = typeof item.warmth === 'number' ? item.warmth : inferWarmth(text, slot);
  const aesthetics = Array.isArray(item.aesthetics) && item.aesthetics.length ? item.aesthetics : inferAesthetics(text, slot, colors, formality);
  const material = item.material ?? inferMaterial(text);
  return {
    ...item,
    slot,
    group: SLOT_GROUPS[slot],
    subcategory,
    colors,
    color: item.color || colors.map(c => c.name).join(' / '),
    pattern: item.pattern || (/(stripe|chalk-stripe|pinstripe)/.test(text) ? 'Stripes' : /(check|plaid|gingham|tartan)/.test(text) ? 'Checks' : /(floral|print|paisley|graphic)/.test(text) ? 'Floral / print' : /(cable|knit|embroider|lace|kashmiri|banarasi)/.test(text) ? 'Textured' : 'Solid'),
    material,
    formality,
    warmth,
    aesthetics,
    fit: item.fit || inferFit(text),
    neckline: item.neckline !== undefined ? item.neckline : inferNeckline(text, slot),
    occasions: Array.isArray(item.occasions) && item.occasions.length ? item.occasions : occasionsForFormality(formality, aesthetics),
    seasons: Array.isArray(item.seasons) && item.seasons.length ? item.seasons : inferSeasons(warmth),
    rainSafe: typeof item.rainSafe === 'boolean' ? item.rainSafe : (slot === 'shoes' ? /boot|sneaker|trainer|running|rubber/.test(text) && !/suede|satin/.test(text) : !/suede|satin|silk|velvet/.test(text)),
    breathable: typeof item.breathable === 'boolean' ? item.breathable : /linen|cotton|mesh|jersey|poplin|tee|tank|halter/.test(text),
    wears: Number(item.wears) || 0,
    price: item.price === '' || item.price == null ? null : Number(item.price),
  };
}
