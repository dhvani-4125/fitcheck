// AI clothing recognition with FashionCLIP, running entirely in the browser (free, private).
// - The image model (~87 MB) downloads once from Hugging Face and is cached by the browser.
// - Category/pattern text embeddings are pre-computed (scripts/build-clip-labels.mjs).
// - It learns from you: every piece you confirm or correct is remembered, and new uploads that
//   look like a remembered piece get that piece's category.
let LABELS = null; // loaded with the model, so it doesn't weigh down page load
let COLORS = null;

let modelPromise = null;
let status = 'idle';
const listeners = new Set();
const setStatus = (s, info = {}) => { status = s; listeners.forEach(fn => fn(s, info)); };
export const onClipStatus = (fn) => { listeners.add(fn); fn(status, {}); return () => listeners.delete(fn); };
export const clipStatus = () => status;

function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      setStatus('loading', { progress: 0 });
      const { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      LABELS = (await import('./clipLabels.json')).default;
      COLORS = (await import('./clipColors.json')).default;
      const files = {};
      const onProgress = (p) => {
        if (p.status === 'progress' && p.file) {
          files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
          const t = Object.values(files).reduce((a, f) => a + f.total, 0), l = Object.values(files).reduce((a, f) => a + f.loaded, 0);
          setStatus('loading', { progress: t ? l / t : 0 });
        }
      };
      const processor = await AutoProcessor.from_pretrained(LABELS.model);
      const vision = await CLIPVisionModelWithProjection.from_pretrained(LABELS.model, { dtype: 'q8', progress_callback: onProgress });
      setStatus('ready');
      return { processor, vision, RawImage };
    })().catch(err => { modelPromise = null; setStatus('error', { message: err.message }); throw err; });
  }
  return modelPromise;
}
export const warmUpClip = () => loadModel().catch(() => null);

function normalise(arr) { const n = Math.hypot(...arr) || 1; return Array.from(arr, v => v / n); }
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

export async function embedImage(dataUrl) {
  const { processor, vision, RawImage } = await loadModel();
  const image = await RawImage.fromURL(dataUrl);
  const { image_embeds } = await vision(await processor(image));
  return normalise(image_embeds.data);
}

function softmaxTop(scored) {
  const max = Math.max(...scored.map(x => x.s));
  const z = scored.reduce((a, x) => a + Math.exp(x.s - max), 0);
  return scored.map(x => ({ ...x, p: Math.exp(x.s - max) / z })).sort((a, b) => b.p - a.p);
}

/**
 * Classify one embedding. memory: [{ id, slot, sub, e }] from pieces the user confirmed.
 * Returns { slot, subcategory, pattern, confidence, reason, alternatives }.
 */
export function classifyEmbedding(e, memory = []) {
  // categories: classifier head trained on real Indian + western clothing photos (scripts/train),
  // blended with zero-shot FashionCLIP for robustness on unusual photos (blend tuned for precision)
  const scale = LABELS.scale || 100;
  const trained = softmaxTop(LABELS.categories.map(c => ({ slot: c.slot, sub: c.sub, s: dot(c.e, e) * scale + (c.b || 0) })));
  let cats = trained;
  if (LABELS.zeroShot && LABELS.blend != null && LABELS.blend < 1) {
    const zs = Object.fromEntries(softmaxTop(LABELS.zeroShot.map(c => ({ k: `${c.slot}|${c.sub}`, s: dot(c.e, e) * 100 }))).map(x => [x.k, x.p]));
    cats = trained.map(c => ({ ...c, p: LABELS.blend * c.p + (1 - LABELS.blend) * (zs[`${c.slot}|${c.sub}`] || 0) })).sort((a, b) => b.p - a.p);
  }
  const pats = softmaxTop(LABELS.patterns.map(c => ({ pattern: c.pattern, s: dot(c.e, e) * 100 + (c.b || 0) })));
  // personal memory: nearest pieces you've already labelled
  const near = memory.map(m => ({ ...m, sim: dot(m.e, e) })).sort((a, b) => b.sim - a.sim).slice(0, 5);
  if (near[0] && near[0].sim >= 0.9) {
    return { slot: near[0].slot, subcategory: near[0].sub, pattern: pats[0].pattern, confidence: Math.min(0.99, near[0].sim), reason: 'looks like a piece you labelled before', alternatives: cats.slice(0, 3) };
  }
  const votes = {};
  for (const n of near.filter(x => x.sim >= 0.8)) votes[`${n.slot}|${n.sub}`] = (votes[`${n.slot}|${n.sub}`] || 0) + n.sim;
  const blended = cats.map(c => ({ ...c, p: c.p + (votes[`${c.slot}|${c.sub}`] || 0) * 0.25 })).sort((a, b) => b.p - a.p);
  const top = blended[0];
  const learned = votes[`${top.slot}|${top.sub}`];
  return {
    // most wardrobe pieces are plain: only call a pattern when the model is fairly sure
    slot: top.slot, subcategory: top.sub, pattern: pickPattern(pats),
    confidence: Math.min(0.99, top.p), reason: learned ? 'AI + what you taught it' : 'AI recognition',
    alternatives: blended.slice(1, 3).map(a => `${a.sub}`),
  };
}

/**
 * Garment colour: FashionCLIP's reading of the clothing ("a white shirt") blended with the pixel
 * colours from the centre of the photo, so neither a dark room nor a coloured backdrop wins.
 * pixelColors: [{ name, hex, share }] from vision.js. Returns up to two [{ name, hex, share }].
 */
export function classifyColors(e, pixelColors = [], namedHex = {}, pattern = 'Solid', cleanCutout = false) {
  if (!COLORS) return pixelColors;
  // colour head trained on labelled Indian + western clothing photos (scripts/train/attrs.mjs);
  // pixelWeight is the share given to garment pixels, tuned on held-out photos
  const ai = softmaxTop(COLORS.colors.map(c => ({ name: c.name, s: dot(c.e, e) * (COLORS.scale || 100) + (c.b || 0) })));
  const pw = COLORS.pixelWeight ?? 0.4;
  const score = {};
  ai.forEach(c => { score[c.name] = (score[c.name] || 0) + (1 - pw) * c.p; });
  pixelColors.forEach(c => { score[c.name] = (score[c.name] || 0) + pw * (c.share || 0); });
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const pick = ([name, s]) => ({ name, hex: pixelColors.find(c => c.name === name)?.hex || namedHex[name] || '#888888', share: Math.round(s * 100) / 100 });
  const out = [pick(ranked[0])];
  // Second colour: the garment's own pixels know "the other colour in the stripes" best.
  const primaryGroup = COLOUR_GROUP[ranked[0][0]];
  // Only trusted when the garment was cut out cleanly; in a photo of a person in a room the "pixels"
  // include jeans, hair and shadows. Precision first: no second colour beats a wrong one.
  const fromPixels = cleanCutout && pixelColors.find(c => COLOUR_GROUP[c.name] !== primaryGroup && (c.share || 0) >= (pattern !== 'Solid' ? 0.15 : 0.3));
  if (fromPixels) out.push({ name: fromPixels.name, hex: fromPixels.hex || namedHex[fromPixels.name] || '#888888', share: Math.round(fromPixels.share * 100) / 100 });
  else {
    const alt = ai.find(c => COLOUR_GROUP[c.name] !== primaryGroup);
    const dark = alt && COLOUR_GROUP[alt.name] === 'black';
    if (alt && pattern !== 'Solid' && alt.p >= (dark ? 0.4 : 0.2)) out.push({ name: alt.name, hex: namedHex[alt.name] || '#888888', share: Math.round(alt.p * 100) / 100 });
  }
  return out;
}

// colours a person would call "the same" (white/ivory/cream, navy/blue/denim…)
const COLOUR_GROUP = { White: 'white', Ivory: 'white', Cream: 'white', Black: 'black', Charcoal: 'black', Grey: 'grey', Silver: 'grey', Beige: 'beige', Camel: 'beige', Tan: 'beige', Khaki: 'beige', Brown: 'brown', Coffee: 'brown', Navy: 'blue', Blue: 'blue', Denim: 'blue', 'Light blue': 'blue', Teal: 'teal', Green: 'green', Olive: 'green', Sage: 'green', Yellow: 'yellow', Mustard: 'yellow', Gold: 'yellow', Orange: 'orange', Rust: 'orange', Red: 'red', Burgundy: 'wine', Wine: 'wine', Pink: 'pink', Blush: 'pink', Lilac: 'purple', Purple: 'purple' };

function pickPattern(pats) {
  const top = pats[0];
  const solid = pats.find(p => p.pattern === 'Solid');
  if (top.pattern !== 'Solid' && top.p < 0.55 && solid && solid.p >= 0.15) return 'Solid';
  return top.p > 0.3 ? top.pattern : 'Solid';
}

export function findSimilar(e, memory = [], threshold = 0.95) {
  let best = null;
  for (const m of memory) { const sim = dot(m.e, e); if (sim >= threshold && (!best || sim > best.sim)) best = { id: m.id, sim }; }
  return best;
}

// ---------- personal memory (IndexedDB, stays on this device)
const DB = 'fitcheck-ml', STORE = 'embeddings';
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(STORE, mode); const out = fn(t.objectStore(STORE)); t.oncomplete = () => { d.close(); res(out?.result); }; t.onerror = () => { d.close(); rej(t.error); }; });
}
export async function loadMemory() {
  try {
    const d = await db();
    return await new Promise((res) => {
      const out = []; const c = d.transaction(STORE).objectStore(STORE).openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out.push({ id: cur.key, ...cur.value }); cur.continue(); } else { d.close(); res(out); } };
      c.onerror = () => { d.close(); res([]); };
    });
  } catch { return []; }
}
export async function remember(id, { slot, sub, e }) {
  if (!e?.length) return;
  try { await tx('readwrite', s => s.put({ slot, sub, e: Array.from(e, v => Math.round(v * 10000) / 10000) }, id)); } catch { /* optional */ }
}
export async function relabel(id, slot, sub) {
  try {
    const all = await loadMemory(); const m = all.find(x => x.id === id);
    if (m) await tx('readwrite', s => s.put({ slot, sub, e: m.e }, id));
  } catch { /* optional */ }
}
export async function forget(id) { try { await tx('readwrite', s => s.delete(id)); } catch { /* optional */ } }
