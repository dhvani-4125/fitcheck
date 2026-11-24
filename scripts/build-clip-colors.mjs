// Pre-computes FashionCLIP text embeddings for garment colours, so the browser can read the colour
// of the clothing itself (not the room behind it). Run: node scripts/build-clip-colors.mjs
import { AutoTokenizer, CLIPTextModelWithProjection } from '@huggingface/transformers';
import { writeFileSync } from 'node:fs';
import { NAMED_COLORS } from '../src/ai/colors.js';

const MODEL = 'Marqo/marqo-fashionCLIP';
const PHRASE = {
  Black: 'black', Charcoal: 'charcoal grey', Grey: 'grey', Silver: 'silver metallic', White: 'white', Ivory: 'ivory off-white', Cream: 'cream',
  Beige: 'beige', Camel: 'camel tan brown', Tan: 'tan', Brown: 'brown', Coffee: 'dark coffee brown', Navy: 'navy blue', Denim: 'denim blue',
  Blue: 'blue', 'Light blue': 'light sky blue', Teal: 'teal', Green: 'green', Olive: 'olive green', Sage: 'sage green', Khaki: 'khaki',
  Yellow: 'yellow', Mustard: 'mustard yellow', Orange: 'orange', Rust: 'rust orange', Red: 'red', Burgundy: 'burgundy maroon', Wine: 'wine',
  Pink: 'pink', Blush: 'pale blush pink', Lilac: 'lilac lavender', Purple: 'purple', Gold: 'gold metallic',
};
const TEMPLATES = ['a photo of a {} garment', 'a {} coloured piece of clothing', 'clothing in {} colour'];

const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' });
const colors = [];
for (const [name] of NAMED_COLORS) {
  const texts = TEMPLATES.map(t => t.replace('{}', PHRASE[name] || name.toLowerCase()));
  const { text_embeds } = await model(tokenizer(texts, { padding: 'max_length', max_length: 77, truncation: true }));
  const dim = text_embeds.dims[1];
  const avg = new Array(dim).fill(0);
  for (let r = 0; r < texts.length; r++) {
    const row = Array.from(text_embeds.data.slice(r * dim, (r + 1) * dim)); const n = Math.hypot(...row);
    row.forEach((v, i) => { avg[i] += v / n; });
  }
  const n = Math.hypot(...avg);
  colors.push({ name, e: avg.map(v => Math.round((v / n) * 10000) / 10000) });
}
writeFileSync(new URL('../src/ai/clipColors.json', import.meta.url), JSON.stringify({ model: MODEL, colors }));
console.log(`Wrote ${colors.length} colour embeddings.`);
