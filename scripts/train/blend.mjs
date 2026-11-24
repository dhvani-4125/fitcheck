// Step 4: choose how much to blend the trained head with zero-shot FashionCLIP (more robust on
// unusual photos). Picks alpha on the validation split, reports the held-out test set.
// Usage: node scripts/train/blend.mjs <dataDir> [--write]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dataDir = process.argv[2];
const labelsPath = new URL('../../src/ai/clipLabels.json', import.meta.url);
const L = JSON.parse(readFileSync(labelsPath, 'utf8'));
const classes = L.categories.map(c => `${c.slot}|${c.sub}`), C = classes.length;
const idx = Object.fromEntries(classes.map((c, i) => [c, i]));
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const rows = [];
for (const f of readdirSync(dataDir).filter(n => /^embeddings.*\.jsonl$/.test(n))) for (const l of readFileSync(`${dataDir}/${f}`, 'utf8').split('\n')) { if (!l) continue; try { const r = JSON.parse(l); if (idx[`${r.slot}|${r.sub}`] !== undefined) rows.push({ ...r, y: idx[`${r.slot}|${r.sub}`] }); } catch { /* partial */ } }
const val = rows.filter(r => r.split === 'train' && hash(r.id + 'val') < 0.15), test = rows.filter(r => r.split === 'test');

const softmax = (s) => { let m = -Infinity; for (const v of s) if (v > m) m = v; let z = 0; const p = s.map(v => { const e = Math.exp(v - m); z += e; return e; }); return p.map(v => v / z); };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const probs = (r) => ({
  t: softmax(L.categories.map(c => dot(c.e, r.e) * L.scale + c.b)),
  z: softmax(L.zeroShot.map(c => dot(c.e, r.e) * 100)),
});
const cache = new Map();
const P = (r) => { if (!cache.has(r.key)) cache.set(r.key, probs(r)); return cache.get(r.key); };

function evaluate(set, alpha) {
  let right = 0; const tp = new Array(C).fill(0), fp = new Array(C).fill(0);
  let conf85 = 0, right85 = 0;
  for (const r of set) {
    const { t, z } = P(r);
    const p = t.map((v, i) => alpha * v + (1 - alpha) * z[i]);
    let arg = 0; for (let c = 1; c < C; c++) if (p[c] > p[arg]) arg = c;
    if (arg === r.y) { right++; tp[arg]++; } else fp[arg]++;
    if (p[arg] >= 0.85) { conf85++; if (arg === r.y) right85++; }
  }
  const present = [...new Set(set.map(r => r.y))];
  const macroP = present.reduce((s, c) => s + (tp[c] + fp[c] ? tp[c] / (tp[c] + fp[c]) : 0), 0) / present.length;
  return { acc: right / set.length, macroP, prec85: conf85 ? right85 / conf85 : 0, cov85: conf85 / set.length };
}
const pct = v => `${(v * 100).toFixed(1)}%`;
let best = null;
for (const alpha of [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
  const v = evaluate(val, alpha), t = evaluate(test, alpha), tw = evaluate(test.filter(r => r.v !== 'orig'), alpha);
  console.log(`alpha ${alpha.toFixed(1)}  val acc ${pct(v.acc)} | test acc ${pct(t.acc)}  macro-P ${pct(t.macroP)}  wardrobe ${pct(tw.acc)}  85%-sure→right ${pct(t.prec85)} (${pct(t.cov85)} of photos)`);
  const score = v.acc + v.macroP;
  if (!best || score > best.score) best = { alpha, score, t, tw };
}
console.log(`\nChosen blend: ${best.alpha} trained + ${(1 - best.alpha).toFixed(1)} zero-shot`);
if (process.argv.includes('--write')) {
  L.blend = best.alpha;
  L.trained = { ...L.trained, blend: best.alpha, testAccuracy: Math.round(best.t.acc * 1e4) / 1e4, testMacroPrecision: Math.round(best.t.macroP * 1e4) / 1e4, wardrobeAccuracy: Math.round(best.tw.acc * 1e4) / 1e4 };
  writeFileSync(labelsPath, JSON.stringify(L));
  console.log('Saved blend into src/ai/clipLabels.json');
}
