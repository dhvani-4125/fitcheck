// Step 5: measure and train COLOUR and PATTERN recognition.
// Labels come from the product titles of the free datasets ("Navy Blue Striped Shirt", "Solid ... in Maroon").
// Compares: pixel colours, zero-shot FashionCLIP, the old 60/40 blend, and newly trained heads (+ blends).
// Usage: node scripts/train/attrs.mjs <dataDir> [--write]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { NAMED_COLORS, nearestColorName, colorFamily, isNeutral } from '../../src/ai/colors.js';

const dataDir = process.argv[2];
const WRITE = process.argv.includes('--write');
const colorsPath = new URL('../../src/ai/clipColors.json', import.meta.url);
const labelsPath = new URL('../../src/ai/clipLabels.json', import.meta.url);
const COL = JSON.parse(readFileSync(colorsPath, 'utf8'));
const LAB = JSON.parse(readFileSync(labelsPath, 'utf8'));
const NAMES = NAMED_COLORS.map(([n]) => n);

// ---------- labels from titles
const COLOUR_WORDS = [
  ['navy blue', 'Navy'], ['dark blue', 'Navy'], ['midnight blue', 'Navy'], ['navy', 'Navy'], ['sky blue', 'Light blue'], ['light blue', 'Light blue'], ['powder blue', 'Light blue'], ['baby blue', 'Light blue'],
  ['royal blue', 'Blue'], ['cobalt', 'Blue'], ['blue', 'Blue'], ['off white', 'Ivory'], ['off-white', 'Ivory'], ['ivory', 'Ivory'], ['cream', 'Cream'], ['white', 'White'], ['black', 'Black'],
  ['charcoal', 'Charcoal'], ['dark grey', 'Charcoal'], ['grey melange', 'Grey'], ['grey', 'Grey'], ['gray', 'Grey'], ['silver', 'Silver'], ['beige', 'Beige'], ['nude', 'Beige'], ['khaki', 'Khaki'],
  ['camel', 'Camel'], ['tan', 'Tan'], ['coffee', 'Coffee'], ['dark brown', 'Coffee'], ['brown', 'Brown'], ['maroon', 'Burgundy'], ['burgundy', 'Burgundy'], ['wine', 'Wine'], ['rust', 'Rust'],
  ['red', 'Red'], ['orange', 'Orange'], ['coral', 'Orange'], ['baby pink', 'Blush'], ['light pink', 'Blush'], ['pastel pink', 'Blush'], ['peach', 'Blush'], ['blush', 'Blush'], ['magenta', 'Pink'],
  ['fuchsia', 'Pink'], ['pink', 'Pink'], ['lavender', 'Lilac'], ['lilac', 'Lilac'], ['mauve', 'Lilac'], ['purple', 'Purple'], ['violet', 'Purple'], ['mustard', 'Mustard'], ['yellow', 'Yellow'],
  ['golden', 'Gold'], ['gold', 'Gold'], ['olive', 'Olive'], ['sea green', 'Sage'], ['mint', 'Sage'], ['sage', 'Sage'], ['pista', 'Sage'], ['light green', 'Sage'], ['bottle green', 'Green'], ['dark green', 'Green'],
  ['green', 'Green'], ['teal', 'Teal'], ['turquoise', 'Teal'],
];
function colourLabel(text, sub) {
  let t = ` ${String(text).toLowerCase().replace(/[^a-z\- ]/g, ' ')} `;
  if (/multi|colou?r ?block|\band\b.*\b(red|blue|green|pink|black|white|yellow|orange|purple|grey)\b/.test(t) && /\band\b/.test(t)) return null;
  const found = new Set();
  for (const [w, name] of COLOUR_WORDS) {
    const re = new RegExp(`\\b${w.replace('-', '\\-')}\\b`);
    if (re.test(t)) { found.add(name); t = t.replace(re, ' '); }
  }
  if (found.size !== 1) return null;
  let c = [...found][0];
  if (sub === 'Jeans' && c === 'Blue') c = 'Denim';
  return c;
}
function patternLabel(text) {
  const t = String(text).toLowerCase();
  const hits = new Set();
  if (/strip/.test(t)) hits.add('Stripes');
  if (/\bcheck|plaid|gingham|tartan/.test(t)) hits.add('Checks');
  if (/print|floral|paisley|polka|abstract|geometric|bandhani|ikat|kalamkari/.test(t)) hits.add('Floral / print');
  if (/embroider|sequin|zari|self design|textured|woven|lace|cable|chikan|mirror work|brocade|banarasi/.test(t)) hits.add('Textured');
  if (/\bsolid\b|\bplain\b/.test(t)) hits.add('Solid');
  return hits.size === 1 ? [...hits][0] : null;
}

// ---------- data
const manifest = Object.fromEntries(JSON.parse(readFileSync(`${dataDir}/manifest.json`, 'utf8')).map(m => [m.id, m]));
const rows = [];
for (const f of readdirSync(dataDir).filter(n => /^embeddings.*\.jsonl$/.test(n))) for (const l of readFileSync(`${dataDir}/${f}`, 'utf8').split('\n')) { if (!l) continue; try { rows.push(JSON.parse(l)); } catch { /* partial */ } }
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
for (const r of rows) { const m = manifest[r.id]; r.colour = m ? colourLabel(m.text, r.sub) : null; r.pattern = m ? patternLabel(m.text) : null; r.x = Float32Array.from(r.e); }

// ---------- pixel colours (garment pixels = not the white studio background), like the app's segmentation
async function pixelColours(id) {
  const { data } = await sharp(`${dataDir}/img/${id}.jpg`).resize(96, 96, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += 3) if (!(data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232)) px.push([data[i], data[i + 1], data[i + 2]]);
  if (px.length < 30) return [];
  // simple k-means (k=3)
  let cen = [px[0], px[Math.floor(px.length / 2)], px[px.length - 1]].map(c => [...c]);
  let asg = new Array(px.length).fill(0);
  for (let it = 0; it < 8; it++) {
    const sums = cen.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => { let b = 0, bd = Infinity; cen.forEach((c, k) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = k; } }); asg[i] = b; const s = sums[b]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    cen = sums.map((s, k) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cen[k]));
  }
  const out = {};
  cen.forEach((c, k) => { const share = asg.filter(a => a === k).length / px.length; const n = nearestColorName(c).name; out[n] = (out[n] || 0) + share; });
  return Object.entries(out).map(([name, share]) => ({ name, share })).sort((a, b) => b.share - a.share);
}

// ---------- softmax regression head with a pull towards the zero-shot prior
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
function softmax(s) { let m = -Infinity; for (const v of s) if (v > m) m = v; let z = 0; const p = s.map(v => { const e = Math.exp(v - m); z += e; return e; }); return p.map(v => v / z); }
function fitHead(prior, train, val, { lambda = 0.1, epochs = 40, lr = 0.002, scale = 100 } = {}) {
  const C = prior.length, D = prior[0].length;
  const W = prior.map(w => Float32Array.from(w)), b = new Float32Array(C);
  const mW = W.map(() => new Float32Array(D)), vW = W.map(() => new Float32Array(D)), mb = new Float32Array(C), vb = new Float32Array(C);
  const counts = new Array(C).fill(0); train.forEach(r => counts[r.y]++);
  const cw = counts.map(n => (n ? Math.min(4, Math.sqrt(Math.max(...counts) / n)) : 0));
  let t = 0, best = { acc: -1 };
  const order = train.map((_, i) => i);
  const accOn = (set) => set.filter(r => { const l = W.map((w, c) => dot(w, r.x) * scale + b[c]); return l.indexOf(Math.max(...l)) === r.y; }).length / (set.length || 1);
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let s = 0; s < order.length; s += 64) {
      const batch = order.slice(s, s + 64);
      const gW = W.map(() => new Float32Array(D)), gb = new Float32Array(C);
      for (const k of batch) {
        const r = train[k];
        const p = softmax(W.map((w, c) => dot(w, r.x) * scale + b[c]));
        for (let c = 0; c < C; c++) { const g = (p[c] - (c === r.y ? 1 : 0)) * cw[r.y] / batch.length; if (Math.abs(g) < 1e-7) continue; gb[c] += g; for (let d = 0; d < D; d++) gW[c][d] += g * scale * r.x[d]; }
      }
      t++;
      for (let c = 0; c < C; c++) {
        for (let d = 0; d < D; d++) {
          const g = gW[c][d] + 2 * lambda * (W[c][d] - prior[c][d]);
          mW[c][d] = 0.9 * mW[c][d] + 0.1 * g; vW[c][d] = 0.999 * vW[c][d] + 0.001 * g * g;
          W[c][d] -= lr * (mW[c][d] / (1 - 0.9 ** t)) / (Math.sqrt(vW[c][d] / (1 - 0.999 ** t)) + 1e-8);
        }
        mb[c] = 0.9 * mb[c] + 0.1 * gb[c]; vb[c] = 0.999 * vb[c] + 0.001 * gb[c] * gb[c];
        b[c] -= lr * 10 * (mb[c] / (1 - 0.9 ** t)) / (Math.sqrt(vb[c] / (1 - 0.999 ** t)) + 1e-8);
      }
    }
    const a = accOn(val);
    if (a > best.acc) best = { acc: a, ep, W: W.map(w => Float32Array.from(w)), b: Float32Array.from(b) };
  }
  return best;
}

// "close enough" colour groups (what a person would call the same colour)
const GROUP = { White: 'white', Ivory: 'white', Cream: 'white', Black: 'black', Charcoal: 'black', Grey: 'grey', Silver: 'grey', Beige: 'beige', Camel: 'beige', Tan: 'beige', Khaki: 'beige', Brown: 'brown', Coffee: 'brown', Navy: 'navy', Blue: 'blue', Denim: 'blue', 'Light blue': 'lightblue', Teal: 'teal', Green: 'green', Olive: 'olive', Sage: 'sage', Yellow: 'yellow', Mustard: 'yellow', Gold: 'yellow', Orange: 'orange', Rust: 'orange', Red: 'red', Burgundy: 'wine', Wine: 'wine', Pink: 'pink', Blush: 'pink', Lilac: 'purple', Purple: 'purple' };
const pct = v => `${(v * 100).toFixed(1)}%`;

// ================= COLOUR =================
const colourRows = rows.filter(r => r.colour);
const cIdx = Object.fromEntries(NAMES.map((n, i) => [n, i]));
colourRows.forEach(r => { r.y = cIdx[r.colour]; });
const cTrainAll = colourRows.filter(r => r.split === 'train');
const cVal = cTrainAll.filter(r => hash(r.id + 'cval') < 0.15), cTrain = cTrainAll.filter(r => hash(r.id + 'cval') >= 0.15);
const cTest = colourRows.filter(r => r.split === 'test');
console.log(`COLOUR: ${new Set(colourRows.map(r => r.id)).size} labelled photos; train ${cTrain.length}, val ${cVal.length}, test ${cTest.length} (embeddings incl. wardrobe-style variants)`);
const cPrior = COL.zeroShot ? COL.zeroShot.map(c => Float32Array.from(c.e)) : COL.colors.map(c => Float32Array.from(c.e));
console.log('  computing pixel colours for test photos…');
const pix = {};
for (const id of new Set(cTest.map(r => r.id))) pix[id] = await pixelColours(id);
const zsProbs = (r) => softmax(cPrior.map(w => dot(w, r.x) * 100));
const blendTop2 = (probs, r, pw) => { const score = {}; probs.forEach((p, i) => { score[NAMES[i]] = (1 - pw) * p; }); if (r.v === 'orig') (pix[r.id] || []).forEach(c => { score[c.name] = (score[c.name] || 0) + pw * c.share; }); return Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]); };
const blendPred = (probs, r, pw) => {
  const score = {};
  probs.forEach((p, i) => { score[NAMES[i]] = (1 - pw) * p; });
  if (r.v === 'orig') (pix[r.id] || []).forEach(c => { score[c.name] = (score[c.name] || 0) + pw * c.share; });
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
};
function colourEval(name, predict, set = cTest) {
  let exact = 0, group = 0;
  for (const r of set) { const p = predict(r); if (p === r.colour) exact++; if (GROUP[p] === GROUP[r.colour]) group++; }
  return { name, exact: exact / set.length, group: group / set.length };
}
const cOrig = cTest.filter(r => r.v === 'orig'), cWard = cTest.filter(r => r.v !== 'orig');
const cRes = [];
cRes.push({ ...colourEval('Pixels only (old method)', r => (pix[r.id]?.[0]?.name || 'White'), cOrig), set: 'catalogue' });
cRes.push({ ...colourEval('AI zero-shot only', r => NAMES[zsProbs(r).indexOf(Math.max(...zsProbs(r)))], cOrig), set: 'catalogue' });
cRes.push({ ...colourEval('Current: 60% AI + 40% pixels', r => blendPred(zsProbs(r), r, 0.4), cOrig), set: 'catalogue' });
console.log('  training colour head…');
let bestC = null;
for (const lambda of [0.05, 0.2]) { const h = fitHead(cPrior, cTrain, cVal, { lambda }); console.log(`   lambda ${lambda}: val acc ${pct(h.acc)} (epoch ${h.ep})`); if (!bestC || h.acc > bestC.acc) bestC = { ...h, lambda }; }
const headProbs = (r) => softmax(bestC.W.map((w, c) => dot(w, r.x) * 100 + bestC.b[c]));
const headPred = (r) => { const p = headProbs(r); return NAMES[p.indexOf(Math.max(...p))]; };
cRes.push({ ...colourEval('Trained AI colour head', headPred, cOrig), set: 'catalogue' });
let bestPW = { pw: 0, exact: -1 };
for (const pw of [0, 0.1, 0.2, 0.3]) { const e = colourEval('', r => blendPred(headProbs(r), r, pw), cOrig); if (e.exact > bestPW.exact) bestPW = { pw, ...e }; }
cRes.push({ name: `Trained head + ${Math.round(bestPW.pw * 100)}% pixels`, exact: bestPW.exact, group: bestPW.group, set: 'catalogue' });
cRes.push({ ...colourEval('AI zero-shot only', r => NAMES[zsProbs(r).indexOf(Math.max(...zsProbs(r)))], cWard), set: 'wardrobe-style' });
cRes.push({ ...colourEval('Trained AI colour head', headPred, cWard), set: 'wardrobe-style' });
console.log('\n=== COLOUR on held-out photos ===  (exact = same named colour; close = same colour family, e.g. ivory vs cream)');
cRes.forEach(r => console.log(`  [${r.set.padEnd(14)}] ${r.name.padEnd(34)} exact ${pct(r.exact).padStart(6)}   close ${pct(r.group).padStart(6)}`));

// ================= PATTERN =================
const PATS = LAB.patterns.map(p => p.pattern);
const pIdx = Object.fromEntries(PATS.map((n, i) => [n, i]));
const patRows = rows.filter(r => r.pattern && pIdx[r.pattern] !== undefined);
patRows.forEach(r => { r.y = pIdx[r.pattern]; });
const pTrainAll = patRows.filter(r => r.split === 'train');
const pVal = pTrainAll.filter(r => hash(r.id + 'pval') < 0.15), pTrain = pTrainAll.filter(r => hash(r.id + 'pval') >= 0.15);
const pTest = patRows.filter(r => r.split === 'test');
const counts = {}; patRows.forEach(r => { counts[r.pattern] = (counts[r.pattern] || 0) + 1; });
console.log(`\nPATTERN: ${new Set(patRows.map(r => r.id)).size} labelled photos (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
const pPrior = (LAB.patternsZeroShot || LAB.patterns).map(p => Float32Array.from(p.e));
function patEval(name, predict, set) {
  let right = 0; const tp = {}, fp = {};
  for (const r of set) { const p = predict(r); if (p === r.pattern) { right++; tp[p] = (tp[p] || 0) + 1; } else fp[p] = (fp[p] || 0) + 1; }
  const ps = PATS.filter(p => set.some(r => r.pattern === p)).map(p => ((tp[p] || 0) + (fp[p] || 0) ? (tp[p] || 0) / ((tp[p] || 0) + (fp[p] || 0)) : 0));
  return { name, acc: right / set.length, macroP: ps.reduce((a, b) => a + b, 0) / ps.length };
}
const pzs = (r) => { const p = softmax(pPrior.map(w => dot(w, r.x) * 100)); return PATS[p.indexOf(Math.max(...p))]; };
const pRes = [patEval('AI zero-shot (current)', pzs, pTest)];
console.log('  training pattern head…');
let bestP = null;
for (const lambda of [0.05, 0.2]) { const h = fitHead(pPrior, pTrain, pVal, { lambda }); console.log(`   lambda ${lambda}: val acc ${pct(h.acc)} (epoch ${h.ep})`); if (!bestP || h.acc > bestP.acc) bestP = { ...h, lambda }; }
const ph = (r) => { const p = softmax(bestP.W.map((w, c) => dot(w, r.x) * 100 + bestP.b[c])); return PATS[p.indexOf(Math.max(...p))]; };
pRes.push(patEval('Trained AI pattern head', ph, pTest));
pRes.push(patEval('Trained head, wardrobe-style photos', ph, pTest.filter(r => r.v !== 'orig')));
console.log('\n=== PATTERN on held-out photos ===');
pRes.forEach(r => console.log(`  ${r.name.padEnd(38)} accuracy ${pct(r.acc).padStart(6)}   macro-precision ${pct(r.macroP).padStart(6)}`));

if (WRITE) {
  const r4 = v => Math.round(v * 10000) / 10000;
  const zsC = COL.zeroShot || COL.colors;
  writeFileSync(colorsPath, JSON.stringify({ model: COL.model, scale: 100, pixelWeight: bestPW.pw, colors: NAMES.map((n, i) => ({ name: n, e: Array.from(bestC.W[i], r4), b: r4(bestC.b[i]) })), zeroShot: zsC, trained: { date: new Date().toISOString().slice(0, 10), exact: r4(bestPW.exact), close: r4(bestPW.group) } }));
  const zsP = LAB.patternsZeroShot || LAB.patterns;
  LAB.patternsZeroShot = zsP;
  LAB.patterns = PATS.map((p, i) => ({ pattern: p, e: Array.from(bestP.W[i], r4), b: r4(bestP.b[i]) }));
  writeFileSync(labelsPath, JSON.stringify(LAB));
  console.log('\nWrote trained colour head (src/ai/clipColors.json) and pattern head (src/ai/clipLabels.json)');
}
