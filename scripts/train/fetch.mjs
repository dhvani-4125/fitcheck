// Step 1: download a balanced, labelled image set from free (MIT) Hugging Face datasets.
// Usage: node scripts/train/fetch.mjs <dataDir> [perClass=320]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { SOURCES } from './mapping.mjs';

const dataDir = process.argv[2];
const PER_CLASS = Number(process.argv[3] || 320);
if (!dataDir) throw new Error('usage: node fetch.mjs <dataDir> [perClass]');
mkdirSync(`${dataDir}/img`, { recursive: true });

const API = 'https://datasets-server.huggingface.co/filter';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// The dataset server answers 503 "index is loading" on first use; keep waiting (up to ~6 min).
async function getJSON(url, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      if (r.status !== 503 && r.status !== 429 && r.status < 500) { console.log(`  HTTP ${r.status} for ${url.slice(0, 120)}`); return null; }
    } catch { /* retry */ }
    await sleep(Math.min(15000, 3000 + i * 1000));
  }
  console.log(`  gave up on ${url.slice(0, 120)}`);
  return null;
}

const perClass = {};
const manifest = [];
for (const src of SOURCES) {
  let offset = 0, taken = 0;
  const where = `"${src.col}"='${src.val.replace(/'/g, "''")}'`;
  while (offset < 3000) {
    const url = `${API}?dataset=${encodeURIComponent(src.ds)}&config=default&split=data&where=${encodeURIComponent(where)}&offset=${offset}&length=100`;
    const j = await getJSON(url);
    if (!j?.rows?.length) break;
    for (const { row } of j.rows) {
      const label = src.rule(row.text || '');
      if (!label) continue;
      const key = label.join('|');
      if ((perClass[key] || 0) >= PER_CLASS) continue;
      perClass[key] = (perClass[key] || 0) + 1; taken++;
      manifest.push({ id: `${src.ds.split('/')[1]}-${row.item_ID}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120), src: row.image.src, slot: label[0], sub: label[1], ds: src.ds, text: row.text, gender: row.gender });
    }
    offset += 100;
    if (j.rows.length < 100) break;
    const keys = new Set(j.rows.map(r => (src.rule(r.row.text || '') || []).join('|')).filter(Boolean));
    if ([...keys].every(k => (perClass[k] || 0) >= PER_CLASS)) break;
  }
  console.log(`${src.ds} ${src.val}: +${taken}`);
}

// download + shrink to 320px (CLIP sees 224px anyway)
let done = 0, failed = 0;
const queue = [...manifest];
async function worker() {
  while (queue.length) {
    const m = queue.shift();
    const out = `${dataDir}/img/${m.id}.jpg`;
    if (existsSync(out)) { done++; continue; }
    try {
      const r = await fetch(m.src);
      if (!r.ok) throw new Error(r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      await sharp(buf).resize(320, 320, { fit: 'inside' }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toFile(out);
      done++;
    } catch { m.failed = true; failed++; }
    if ((done + failed) % 250 === 0) console.log(`downloaded ${done}, failed ${failed} / ${manifest.length}`);
  }
}
await Promise.all(Array.from({ length: 10 }, worker));
const ok = manifest.filter(m => !m.failed);
writeFileSync(`${dataDir}/manifest.json`, JSON.stringify(ok));
const counts = {};
ok.forEach(m => { counts[`${m.slot}|${m.sub}`] = (counts[`${m.slot}|${m.sub}`] || 0) + 1; });
console.log(`\nDone: ${ok.length} images, ${Object.keys(counts).length} classes`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join('\n'));
