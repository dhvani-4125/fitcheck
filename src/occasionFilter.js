export const OCCASIONS = [
  'Everyday', 'Work', 'Athleisure', 'Date Night', 'Party',
  'Wedding', 'Formal', 'Festive', 'Graduation', 'Travel',
];

export const EVENT_OCCASIONS = [
  'Wedding', 'Formal', 'Date Night', 'Party', 'Festive', 'Graduation',
];

const ALIASES = {
  'wedding guest': 'wedding',
  weddings: 'wedding',
  'black tie': 'formal',
  'formal event': 'formal',
  'office': 'work',
  'workwear': 'work',
  'date-night': 'date night',
  'night out': 'party',
  celebrations: 'festive',
  'college event': 'graduation',
  'every day': 'everyday',
};

export function normalizeOccasion(value) {
  const cleaned = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[&/]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES[cleaned] || cleaned;
}

/**
 * Filter saved outfit combinations (not individual wardrobe pieces).
 * `eventOnly` limits the unfiltered Event Edit to occasion-based looks.
 */
export function filterOutfitsByOccasion(
  looks,
  selectedOccasion = 'All occasions',
  { eventOnly = false, audience = 'Everyone', search = '', items = [] } = {},
) {
  const selected = normalizeOccasion(selectedOccasion);
  const allOccasions = selected === 'all occasions' || selected === 'all';
  const eventSet = new Set(EVENT_OCCASIONS.map(normalizeOccasion));
  const query = String(search || '').trim().toLowerCase();
  const safeLooks = Array.isArray(looks) ? looks : [];
  const safeItems = Array.isArray(items) ? items : [];

  return safeLooks.filter((look) => {
    const occasion = normalizeOccasion(
      look?.occasion ?? look?.eventOccasion ?? look?.event ?? 'Everyday',
    ) || 'everyday';

    if (eventOnly && allOccasions && !eventSet.has(occasion)) return false;
    if (!allOccasions && occasion !== selected) return false;

    const lookAudience = String(look?.audience || 'Everyone').trim().toLowerCase();
    const audienceFilter = String(audience || 'Everyone').trim().toLowerCase();
    if (audienceFilter !== 'everyone' && lookAudience !== 'everyone' && lookAudience !== audienceFilter) {
      return false;
    }

    const itemIds = Array.isArray(look?.items) ? look.items : [];
    const pieceNames = itemIds.map((entry) => {
      // Support both the current ID-based format and older object-based saved looks.
      if (entry && typeof entry === 'object') return entry.name || '';
      return safeItems.find((item) => item.id === entry)?.name || '';
    }).join(' ');
    const searchable = `${look?.name || ''} ${occasion} ${lookAudience} ${pieceNames}`.toLowerCase();
    return searchable.includes(query);
  });
}
