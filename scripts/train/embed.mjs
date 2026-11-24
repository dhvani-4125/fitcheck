// Step 2: make synthetic "wardrobe photo" variants and compute FashionCLIP image embeddings with
// exactly the model the browser uses (Marqo/marqo-fashionCLIP, q8).
// Usage: node scripts/train/embed.mjs <dataDir> [shard=0] [shards=1] [capPerClass=110]
// On a laptop CPU FashionCLIP runs at ~2 images/s, so by default each class is capped at 110 photos
// (~100 per class is near the ceiling for a linear head) with one synthetic wardrobe variant each.
import { readFileSync, appendFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from '@huggingface/transformers';

const dataDir = process.argv[2];
const MODEL = 'Marqo/marqo-fashionCLIP';
const manifest = JSON.parse(readFileSync(`${dataDir}/manifest.json`, 'utf8'));

// deterministic split: ~80% train, 20% test
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const split = (id) => (hash(id) < 0.8 ? 'train' : 'test');

// seeded RNG per image so variants are reproducible
function rng(seed) { let a = Math.floor(seed * 1e9) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Backgrounds people actually photograph clothes on: bedsheets, floors, walls, wardrobe doors.
const BACKDROPS = [[245, 243, 238], [232, 226, 214], [210, 210, 212], [190, 205, 222], [236, 214, 220], [196, 170, 140], [150, 112, 82], [92, 70, 55], [60, 62, 66], [222, 228, 214], [250, 250, 250], [178, 190, 170]];

async function wardrobePhoto(path, r) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = BACKDROPS[Math.floor(r() * BACKDROPS.length)];
  const noise = 6 + r() * 10;
  // replace the catalogue's white studio background with a textured backdrop
  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 3) {
    if (px[i] > 236 && px[i + 1] > 236 && px[i + 2] > 236) {
      const n = (r() - 0.5) * noise;
      px[i] = Math.max(0, Math.min(255, bg[0] + n)); px[i + 1] = Math.max(0, Math.min(255, bg[1] + n)); px[i + 2] = Math.max(0, Math.min(255, bg[2] + n));
    }
  }
  const pad = Math.round(Math.max(info.width, info.height) * (0.05 + r() * 0.3));
  let img = sharp(px, { raw: { width: info.width, height: info.height, channels: 3 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: bg[0], g: bg[1], b: bg[2] } })
    .rotate((r() - 0.5) * 30, { background: { r: bg[0], g: bg[1], b: bg[2] } });
  const buf = await img.png().toBuffer();
  const meta = await sharp(buf).metadata();
  const crop = 0.78 + r() * 0.22;
  const cw = Math.round(meta.width * crop), ch = Math.round(meta.height * crop);
  const left = Math.round((meta.width - cw) * r()), top = Math.round((meta.height - ch) * r());
  let out = sharp(buf).extract({ left, top, width: cw, height: ch })
    .modulate({ brightness: 0.72 + r() * 0.45, saturation: 0.75 + r() * 0.5 })
    .gamma(1 + r() * 0.8);
  if (r() < 0.55) out = out.blur(0.3 + r() * 1.2);
  const jpg = await out.resize(320, 320, { fit: 'inside' }).jpeg({ quality: Math.round(55 + r() * 30) }).toBuffer();
  return jpg;
}

async function toRaw(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
}

const SHARD = Number(process.argv[3] || 0), SHARDS = Number(process.argv[4] || 1);
const outMeta = `${dataDir}/embeddings-${SHARD}.jsonl`;
const doneKeys = new Set();
for (const f of readdirSync(dataDir).filter(n => /^embeddings.*\.jsonl$/.test(n))) {
  for (const line of readFileSync(`${dataDir}/${f}`, 'utf8').split('\n')) { try { if (line) doneKeys.add(JSON.parse(line).key); } catch { /* partial line */ } }
}

const processor = await AutoProcessor.from_pretrained(MODEL);
const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'q8', session_options: { intraOpNumThreads: 4, interOpNumThreads: 1 } });

const CAP = Number(process.argv[5] || 110);
const hasAny = (id) => doneKeys.has(`${id}:orig`) || doneKeys.has(`${id}:ward1`);
const byClass = {};
for (const m of manifest) (byClass[`${m.slot}|${m.sub}`] ||= []).push(m);
const selected = Object.values(byClass).flatMap(list => list
  .sort((a, b) => (hasAny(b.id) - hasAny(a.id)) || (hash(a.id + 'pick') - hash(b.id + 'pick')))
  .slice(0, CAP));
const jobs = [];
for (const m of selected) {
  const sp = split(m.id);
  const variants = ['orig', 'ward1'];
  for (const v of variants) {
    const key = `${m.id}:${v}`;
    if (!doneKeys.has(key) && Math.floor(hash(key + 'shard') * SHARDS) === SHARD) jobs.push({ m, v, key, sp });
  }
}
console.log(`${jobs.length} embeddings to compute (${doneKeys.size} already done)`);
const BATCH = 16;
const t0 = Date.now();
for (let i = 0; i < jobs.length; i += BATCH) {
  const batch = jobs.slice(i, i + BATCH);
  const images = [];
  const ok = [];
  for (const j of batch) {
    const path = `${dataDir}/img/${j.m.id}.jpg`;
    try {
      const input = j.v === 'orig' ? path : await wardrobePhoto(path, rng(hash(j.key)));
      images.push(await toRaw(input)); ok.push(j);
    } catch { /* unreadable image */ }
  }
  if (!images.length) continue;
  const { image_embeds } = await vision(await processor(images));
  const dim = image_embeds.dims[1];
  let lines = '';
  ok.forEach((j, k) => {
    const e = Array.from(image_embeds.data.slice(k * dim, (k + 1) * dim));
    const n = Math.hypot(...e);
    lines += JSON.stringify({ key: j.key, id: j.m.id, v: j.v, split: j.sp, slot: j.m.slot, sub: j.m.sub, ds: j.m.ds, e: e.map(x => Math.round((x / n) * 1e5) / 1e5) }) + '\n';
  });
  appendFileSync(outMeta, lines);
  if ((i / BATCH) % 10 === 0) {
    const rate = (i + ok.length) / ((Date.now() - t0) / 1000);
    console.log(`${i + ok.length}/${jobs.length}  ${rate.toFixed(1)}/s  ~${Math.round((jobs.length - i) / rate / 60)} min left`);
  }
}
console.log('embeddings done');
