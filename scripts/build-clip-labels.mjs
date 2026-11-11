// Pre-computes FashionCLIP text embeddings for every wardrobe category and pattern, so the
// browser only needs the (cached) image model. Run: node scripts/build-clip-labels.mjs
import { AutoTokenizer, CLIPTextModelWithProjection } from '@huggingface/transformers';
import { writeFileSync } from 'node:fs';

export const MODEL = 'Marqo/marqo-fashionCLIP';

const CATEGORIES = {
  top: { Shirt: 'a button-up collared shirt', 'T-shirt': 'a plain t-shirt', Blouse: "a women's blouse top", Sweater: 'a knitted sweater', Polo: 'a polo shirt', Tank: 'a sleeveless tank top', 'Activewear top': 'a sports bra gym top', Kurta: 'a long Indian kurta tunic', Kurti: 'a short Indian kurti tunic', 'Ethnic blouse': 'an Indian saree blouse choli' },
  bottom: { Jeans: 'blue denim jeans', Trousers: 'tailored trousers pants', Skirt: 'a skirt', Shorts: 'shorts', Leggings: 'leggings tights', Joggers: 'jogger sweatpants', 'Salwar / churidar': 'Indian salwar churidar pants', 'Dhoti / patiala': 'patiala dhoti pants', Palazzo: 'wide leg palazzo pants' },
  outer: { Hoodie: 'a hoodie sweatshirt', Jacket: 'a jacket', Coat: 'a long overcoat', Blazer: 'a tailored blazer', Cardigan: 'a cardigan', 'Nehru jacket': 'a sleeveless Nehru jacket waistcoat', Shrug: 'a sheer shrug cover-up' },
  dress: { Dress: 'a dress', Jumpsuit: 'a jumpsuit', Gown: 'a long evening gown', 'Co-ord set': 'a matching two-piece co-ord set', Suit: "a men's two-piece suit", Lehenga: 'an Indian bridal lehenga choli with a flared embroidered skirt', Saree: 'an Indian saree drape', Anarkali: 'an Indian anarkali suit with a flared long kurta', 'Kurta set': 'an Indian salwar kameez kurta set with dupatta', 'Sharara set': 'an Indian sharara suit with flared pants', Sherwani: "a men's Indian sherwani", 'Indo-western': 'an indo-western fusion outfit' },
  shoes: { Sneakers: 'sneakers trainers', Heels: 'high heel shoes', Boots: 'boots', Sandals: 'sandals', Loafers: 'loafers', Flats: 'ballet flat shoes', 'Formal shoes': "men's leather dress shoes", 'Juttis / mojaris': 'embroidered Indian jutti mojari shoes', Kolhapuris: 'kolhapuri leather chappals' },
  bag: { Handbag: 'a handbag', Tote: 'a large tote bag', Clutch: 'an evening clutch bag', Backpack: 'a backpack', Crossbody: 'a small crossbody bag', Potli: 'an Indian embroidered potli pouch bag' },
  accessory: { Watch: 'a wrist watch', Jewellery: 'a necklace', Belt: 'a leather belt', Scarf: 'a scarf', Sunglasses: 'sunglasses', Hat: 'a hat or cap', 'Jewellery set': 'an Indian kundan necklace and earrings jewellery set', Jhumkas: 'Indian jhumka earrings', Bangles: 'bangles bracelets', Dupatta: 'a dupatta stole draped fabric', 'Maang tikka': 'an Indian maang tikka head jewellery' },
};
const PATTERNS = { Solid: 'a plain solid colour garment', Stripes: 'a striped garment', Checks: 'a checked plaid garment', 'Floral / print': 'a floral printed garment', Textured: 'an embroidered or textured garment' };
const TEMPLATES = ['a product photo of {}', 'a photo of {}, clothing'];

const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' });

async function embed(phrase) {
  const texts = TEMPLATES.map(t => t.replace('{}', phrase));
  const inputs = tokenizer(texts, { padding: 'max_length', max_length: 77, truncation: true });
  const { text_embeds } = await model(inputs);
  const dim = text_embeds.dims[1];
  const avg = new Array(dim).fill(0);
  for (let r = 0; r < texts.length; r++) {
    const row = text_embeds.data.slice(r * dim, (r + 1) * dim);
    const n = Math.hypot(...row);
    row.forEach((v, i) => { avg[i] += v / n; });
  }
  const n = Math.hypot(...avg);
  return avg.map(v => Math.round((v / n) * 10000) / 10000);
}

const categories = [];
for (const [slot, subs] of Object.entries(CATEGORIES)) for (const [sub, phrase] of Object.entries(subs)) categories.push({ slot, sub, e: await embed(phrase) });
const patterns = [];
for (const [pattern, phrase] of Object.entries(PATTERNS)) patterns.push({ pattern, e: await embed(phrase) });
writeFileSync(new URL('../src/ai/clipLabels.json', import.meta.url), JSON.stringify({ model: MODEL, dim: categories[0].e.length, categories, patterns }));
console.log(`Wrote ${categories.length} categories and ${patterns.length} patterns (dim ${categories[0].e.length}).`);
