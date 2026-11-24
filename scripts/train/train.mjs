// Step 3: train a classifier head on FashionCLIP embeddings and measure precision.
// The head starts from the zero-shot text embeddings (so classes without photos keep working)
// and is pulled towards them with an L2 penalty: logits = scale * (W·e) + b.
// Usage: node scripts/train/train.mjs <dataDir> [--write]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dataDir = process.argv[2];
const WRITE = process.argv.includes('--write');
const labelsPath = new URL('../../src/ai/clipLabels.json', import.meta.url);
const base = JSON.parse(readFileSync(labelsPath, 'utf8'));
const ZS = base.zeroShot || base.categories; // keep the original text embeddings as the prior
const classes = ZS.map(c => `${c.slot}|${c.sub}`);
const C = classes.length, D = base.dim, SCALE = 100;

const rows = [];
for (const f of readdirSync(dataDir).filter(n => /^embeddings.*\.jsonl$/.test(n))) {
  for (const l of readFileSync(`${dataDir}/${f}`, 'utf8').split('\n')) { if (!l) continue; try { rows.push(JSON.parse(l)); } catch { /* partial line */ } }
}
const idx = Object.fromEntries(classes.map((c, i) => [c, i]));
const data = rows.filter(r => idx[`${r.slot}|${r.sub}`] !== undefined).map(r => ({ ...r, y: idx[`${r.slot}|${r.sub}`], x: Float32Array.from(r.e) }));
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const trainAll = data.filter(r => r.split === 'train');
const val = trainAll.filter(r => hash(r.id + 'val') < 0.15);
const train = trainAll.filter(r => hash(r.id + 'val') >= 0.15);
const test = data.filter(r => r.split === 'test');
console.log(`train ${train.length}, val ${val.length}, test ${test.length} embeddings over ${new Set(data.map(r => r.y)).size}/${C} classes`);

const prior = ZS.map(c => Float32Array.from(c.e));

function logits(W, b, x) {
  const out = new Float32Array(C);
  for (let c = 0; c < C; c++) { let s = 0; const w = W[c]; for (let d = 0; d < D; d++) s += w[d] * x[d]; out[c] = SCALE * s + b[c]; }
  return out;
}
const predict = (W, b, x) => { const l = logits(W, b, x); let best = 0; for (let c = 1; c < C; c++) if (l[c] > l[best]) best = c; return best; };

function evaluate(W, b, set) {
  const tp = new Array(C).fill(0), fp = new Array(C).fill(0), fn = new Array(C).fill(0);
  let correct = 0, slotCorrect = 0;
  for (const r of set) {
    const p = predict(W, b, r.x);
    if (p === r.y) { correct++; tp[p]++; } else { fp[p]++; fn[r.y]++; }
    if (classes[p].split('|')[0] === classes[r.y].split('|')[0]) slotCorrect++;
  }
  const present = [...new Set(set.map(r => r.y))];
  const prec = present.map(c => (tp[c] + fp[c] ? tp[c] / (tp[c] + fp[c]) : 0));
  const rec = present.map(c => tp[c] / (tp[c] + fn[c] || 1));
  const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  return { acc: correct / set.length, slotAcc: slotCorrect / set.length, macroP: mean(prec), macroR: mean(rec), perClass: present.map((c, i) => ({ c: classes[c], p: prec[i], r: rec[i], n: tp[c] + fn[c] })) };
}

function fit(lambda, epochs = 50, lr = 0.002) {
  const W = prior.map(w => Float32Array.from(w));
  const b = new Float32Array(C);
  const counts = new Array(C).fill(0); train.forEach(r => counts[r.y]++);
  const cw = counts.map(n => (n ? Math.sqrt(Math.max(...counts) / n) : 0)); // class-balance weights
  // Adam state
  const mW = W.map(() => new Float32Array(D)), vW = W.map(() => new Float32Array(D));
  const mb = new Float32Array(C), vb = new Float32Array(C);
  let t = 0, best = { score: -1 };
  const order = train.map((_, i) => i);
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let s = 0; s < order.length; s += 64) {
      const gW = W.map(() => new Float32Array(D)), gb = new Float32Array(C);
      const batch = order.slice(s, s + 64);
      for (const k of batch) {
        const r = train[k];
        const l = logits(W, b, r.x);
        let mx = -Infinity; for (let c = 0; c < C; c++) if (l[c] > mx) mx = l[c];
        let z = 0; const p = new Float32Array(C); for (let c = 0; c < C; c++) { p[c] = Math.exp(l[c] - mx); z += p[c]; }
        for (let c = 0; c < C; c++) {
          const g = (p[c] / z - (c === r.y ? 1 : 0)) * cw[r.y] / batch.length;
          if (Math.abs(g) < 1e-7) continue;
          gb[c] += g;
          const gw = gW[c], x = r.x;
          for (let d = 0; d < D; d++) gw[d] += g * SCALE * x[d];
        }
      }
      t++;
      const b1 = 0.9, b2 = 0.999, eps = 1e-8;
      for (let c = 0; c < C; c++) {
        for (let d = 0; d < D; d++) {
          const g = gW[c][d] + 2 * lambda * (W[c][d] - prior[c][d]);
          mW[c][d] = b1 * mW[c][d] + (1 - b1) * g; vW[c][d] = b2 * vW[c][d] + (1 - b2) * g * g;
          W[c][d] -= lr * (mW[c][d] / (1 - b1 ** t)) / (Math.sqrt(vW[c][d] / (1 - b2 ** t)) + eps);
        }
        mb[c] = b1 * mb[c] + (1 - b1) * gb[c]; vb[c] = b2 * vb[c] + (1 - b2) * gb[c] * gb[c];
        b[c] -= lr * 10 * (mb[c] / (1 - b1 ** t)) / (Math.sqrt(vb[c] / (1 - b2 ** t)) + eps);
      }
    }
    const v = evaluate(W, b, val);
    const score = v.macroP * 0.5 + v.acc * 0.5;
    if (score > best.score) best = { score, ep, W: W.map(w => Float32Array.from(w)), b: Float32Array.from(b), val: v };
  }
  return best;
}

const zeroB = new Float32Array(C);
const zsTest = evaluate(prior, zeroB, test);
const zsWard = evaluate(prior, zeroB, test.filter(r => r.v !== 'orig'));
let best = null;
for (const lambda of [0.1, 0.3]) {
  const r = fit(lambda);
  console.log(`lambda ${lambda}: best epoch ${r.ep}, val acc ${(r.val.acc * 100).toFixed(1)}%, val macro-precision ${(r.val.macroP * 100).toFixed(1)}%`);
  if (!best || r.score > best.score) best = { ...r, lambda };
}
const trTest = evaluate(best.W, best.b, test);
const trWard = evaluate(best.W, best.b, test.filter(r => r.v !== 'orig'));
const pct = v => `${(v * 100).toFixed(1)}%`;
console.log('\n=== Held-out test set (photos never seen in training) ===');
console.log(`                      accuracy   macro-precision   macro-recall   right slot`);
console.log(`Before (zero-shot)    ${pct(zsTest.acc).padEnd(10)} ${pct(zsTest.macroP).padEnd(17)} ${pct(zsTest.macroR).padEnd(14)} ${pct(zsTest.slotAcc)}`);
console.log(`After  (trained)      ${pct(trTest.acc).padEnd(10)} ${pct(trTest.macroP).padEnd(17)} ${pct(trTest.macroR).padEnd(14)} ${pct(trTest.slotAcc)}`);
console.log(`Wardrobe-style photos only: before ${pct(zsWard.acc)} → after ${pct(trWard.acc)} accuracy, precision ${pct(zsWard.macroP)} → ${pct(trWard.macroP)}`);
function confidenceReport(W, b, set) {
  const out = [];
  for (const th of [0.5, 0.7, 0.85]) {
    let kept = 0, right = 0;
    for (const r of set) {
      const l = logits(W, b, r.x); let mx = -Infinity, arg = 0; for (let c = 0; c < C; c++) if (l[c] > mx) { mx = l[c]; arg = c; }
      let z = 0; for (let c = 0; c < C; c++) z += Math.exp(l[c] - mx);
      if (1 / z >= th) { kept++; if (arg === r.y) right++; }
    }
    out.push({ th, coverage: kept / set.length, precision: kept ? right / kept : 0 });
  }
  return out;
}
const conf = confidenceReport(best.W, best.b, test);
console.log('\nWhen the app shows a confidence of at least:');
conf.forEach(c => console.log(`  ${Math.round(c.th * 100)}% sure → right ${pct(c.precision)} of the time (${pct(c.coverage)} of photos)`));
console.log('\nPer class (after):');
trTest.perClass.sort((a, b) => a.p - b.p).forEach(x => console.log(`  ${x.c.padEnd(30)} precision ${pct(x.p).padStart(6)}  recall ${pct(x.r).padStart(6)}  (n=${x.n})`));
writeFileSync(`${dataDir}/report.json`, JSON.stringify({ lambda: best.lambda, zsTest, trTest, zsWard, trWard }, null, 1));

if (WRITE) {
  const r4 = v => Math.round(v * 10000) / 10000;
  const out = {
    model: base.model, dim: D, scale: SCALE, trained: { date: new Date().toISOString().slice(0, 10), datasets: ['Marqo/atlas (MIT)', 'Marqo/KAGL (MIT)'], images: new Set(data.map(r => r.id)).size, testAccuracy: r4(trTest.acc), testMacroPrecision: r4(trTest.macroP) },
    categories: ZS.map((c, i) => ({ slot: c.slot, sub: c.sub, e: Array.from(best.W[i], r4), b: r4(best.b[i]) })),
    zeroShot: ZS,
    patterns: base.patterns,
  };
  writeFileSync(labelsPath, JSON.stringify(out));
  console.log('\nWrote trained head to src/ai/clipLabels.json');
}
