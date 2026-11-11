// On-device computer vision for wardrobe photos. Runs entirely in the browser with <canvas>;
// no photo leaves the device.
//
// Pipeline per photo:
//   1. estimate the backdrop colour from the image border
//   2. build a foreground mask (pixels that differ from the backdrop), clean it with morphology
//   3. split it into garments: connected components, then XY-cuts to separate items that touch
//   4. crop each garment, extract its palette (k-means), pattern, a shape-based category guess
//      and a perceptual hash for duplicate detection
import { colorDistance, nearestColorName, rgbToHex } from './colors.js';
import { inferSlot, inferSubcategory } from './attributes.js';

const WORK_SIZE = 560; // analysis resolution (longest edge)
const CELL = 4;        // mask grid cell in px

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This file could not be read as an image.'));
    img.src = src;
  });
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function canvasFor(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

function estimateBackground(data, w, h) {
  const samples = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 80));
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const take = (x, y) => { const i = (y * w + x) * 4; samples.push([data[i], data[i + 1], data[i + 2]]); };
  for (let x = 0; x < w; x += step) for (let b = 0; b < band; b += 2) { take(x, b); take(x, h - 1 - b); }
  for (let y = 0; y < h; y += step) for (let b = 0; b < band; b += 2) { take(b, y); take(w - 1 - b, y); }
  const bg = [median(samples.map(s => s[0])), median(samples.map(s => s[1])), median(samples.map(s => s[2]))];
  const dists = samples.map(s => colorDistance(s, bg)).sort((a, b) => a - b);
  const spread = dists[Math.floor(dists.length * 0.8)] || 0;
  return { bg, spread };
}

function buildMask(data, w, h, bg, threshold) {
  const gw = Math.ceil(w / CELL), gh = Math.ceil(h / CELL);
  const grid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let fg = 0, n = 0;
      for (let y = gy * CELL; y < Math.min(h, gy * CELL + CELL); y++) {
        for (let x = gx * CELL; x < Math.min(w, gx * CELL + CELL); x++) {
          const i = (y * w + x) * 4;
          if (colorDistance([data[i], data[i + 1], data[i + 2]], bg) > threshold) fg++;
          n++;
        }
      }
      grid[gy * gw + gx] = fg / n > 0.4 ? 1 : 0;
    }
  }
  return { grid, gw, gh };
}

function morph(grid, gw, gh, dilate) {
  const out = new Uint8Array(grid.length);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let v = dilate ? 0 : 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        const cell = nx < 0 || ny < 0 || nx >= gw || ny >= gh ? 0 : grid[ny * gw + nx];
        if (dilate && cell) v = 1;
        if (!dilate && !cell) v = 0;
      }
      out[y * gw + x] = v;
    }
  }
  return out;
}

function components(grid, gw, gh) {
  const label = new Int32Array(grid.length).fill(-1);
  const boxes = [];
  const queue = new Int32Array(grid.length);
  for (let start = 0; start < grid.length; start++) {
    if (!grid[start] || label[start] >= 0) continue;
    let head = 0, tail = 0;
    queue[tail++] = start; label[start] = boxes.length;
    const box = { x0: gw, y0: gh, x1: 0, y1: 0, area: 0 };
    while (head < tail) {
      const p = queue[head++];
      const x = p % gw, y = (p - x) / gw;
      box.area++;
      if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y; if (y > box.y1) box.y1 = y;
      const nbrs = [x > 0 ? p - 1 : -1, x < gw - 1 ? p + 1 : -1, y > 0 ? p - gw : -1, y < gh - 1 ? p + gw : -1];
      for (const q of nbrs) if (q >= 0 && grid[q] && label[q] < 0) { label[q] = boxes.length; queue[tail++] = q; }
    }
    boxes.push(box);
  }
  return boxes;
}

// Split a box along low-density valleys of the mask (items laid out in a row or grid that touch).
function xyCut(grid, gw, box, depth = 0) {
  if (depth > 4) return [box];
  const tight = shrink(grid, gw, box);
  if (!tight) return [];
  for (const axis of ['x', 'y']) {
    const len = axis === 'x' ? tight.x1 - tight.x0 + 1 : tight.y1 - tight.y0 + 1;
    const across = axis === 'x' ? tight.y1 - tight.y0 + 1 : tight.x1 - tight.x0 + 1;
    if (len < 12) continue;
    const prof = new Array(len).fill(0);
    for (let y = tight.y0; y <= tight.y1; y++) for (let x = tight.x0; x <= tight.x1; x++) {
      if (grid[y * gw + x]) prof[axis === 'x' ? x - tight.x0 : y - tight.y0]++;
    }
    const peak = Math.max(...prof);
    const low = Math.max(1, Math.min(peak * 0.12, across * 0.06));
    const minPart = Math.max(5, Math.round(len * 0.12));
    // find the deepest valley away from the edges
    let best = -1, bestVal = Infinity;
    for (let i = minPart; i < len - minPart; i++) {
      if (prof[i] <= low && prof[i] < bestVal) { bestVal = prof[i]; best = i; }
    }
    if (best >= 0) {
      const a = { ...tight }, b = { ...tight };
      if (axis === 'x') { a.x1 = tight.x0 + best - 1; b.x0 = tight.x0 + best + 1; }
      else { a.y1 = tight.y0 + best - 1; b.y0 = tight.y0 + best + 1; }
      return [...xyCut(grid, gw, a, depth + 1), ...xyCut(grid, gw, b, depth + 1)];
    }
  }
  return [tight];
}

function shrink(grid, gw, box) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, area = 0;
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    if (grid[y * gw + x]) { area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return area ? { x0, y0, x1, y1, area } : null;
}

function overlapRatio(a, b) {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1);
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1);
  const inter = ix * iy;
  const small = Math.min((a.x1 - a.x0 + 1) * (a.y1 - a.y0 + 1), (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1));
  return inter / small;
}

function mergeBoxes(boxes) {
  const out = [...boxes];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      if (overlapRatio(out[i], out[j]) > 0.5) {
        const a = out[i], b = out[j];
        out[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), area: a.area + b.area };
        out.splice(j, 1); merged = true; break outer;
      }
    }
  }
  return out;
}

function kmeans(pixels, k = 3, iters = 9) {
  if (!pixels.length) return [];
  const centers = [];
  for (let i = 0; i < k; i++) centers.push([...pixels[Math.floor((i + 0.5) * pixels.length / k)]]);
  let assign = new Array(pixels.length).fill(0);
  for (let it = 0; it < iters; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    pixels.forEach((p, idx) => {
      let best = 0, bd = Infinity;
      centers.forEach((c, ci) => { const d = colorDistance(p, c); if (d < bd) { bd = d; best = ci; } });
      assign[idx] = best;
      const s = sums[best]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    });
    sums.forEach((s, ci) => { if (s[3]) centers[ci] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const counts = centers.map((_, ci) => assign.filter(a => a === ci).length);
  return centers.map((c, ci) => ({ rgb: c, share: counts[ci] / pixels.length })).sort((a, b) => b.share - a.share);
}

function analyseRegion(data, w, h, box, mask) {
  const pixels = [];
  let gx = 0, gy = 0, lumSum = 0, lumSq = 0, n = 0;
  const x0 = box.x0 * CELL, y0 = box.y0 * CELL, x1 = Math.min(w - 1, box.x1 * CELL + CELL - 1), y1 = Math.min(h - 1, box.y1 * CELL + CELL - 1);
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
  const lum = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  for (let y = y0 + 1; y < y1; y += step) {
    for (let x = x0 + 1; x < x1; x += step) {
      if (!mask.grid[Math.floor(y / CELL) * mask.gw + Math.floor(x / CELL)]) continue;
      const i = (y * w + x) * 4;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
      const L = lum(i);
      lumSum += L; lumSq += L * L; n++;
      gx += Math.abs(L - lum(i + 4));
      gy += Math.abs(L - lum(i + w * 4));
    }
  }
  const clusters = kmeans(pixels, 3).filter(c => c.share >= 0.1);
  const colors = [];
  for (const c of clusters) {
    const named = nearestColorName(c.rgb);
    const existing = colors.find(x => x.name === named.name);
    if (existing) existing.share += c.share;
    else colors.push({ name: named.name, hex: rgbToHex(c.rgb), share: c.share });
  }
  colors.sort((a, b) => b.share - a.share);
  const std = n ? Math.sqrt(Math.max(0, lumSq / n - (lumSum / n) ** 2)) : 0;
  const ratio = (gx + 1) / (gy + 1);
  const edge = n ? (gx + gy) / n : 0;
  const strong = colors.filter(c => c.share > 0.2).length;
  let pattern = 'Solid';
  if (edge > 9 && (ratio > 1.9 || ratio < 0.53)) pattern = 'Stripes';
  else if (edge > 11 && strong >= 2 && std > 30) pattern = 'Checks';
  else if (strong >= 3 && std > 34) pattern = 'Floral / print';
  else if (edge > 8 && std > 22) pattern = 'Textured';
  return { colors: colors.slice(0, 3).map(c => ({ ...c, share: Math.round(c.share * 100) / 100 })), pattern };
}

// Shape-based category guess. Deliberately reported with low confidence: the user confirms it.
function guessSlot(box, imgW, imgH, filename) {
  const fromName = inferSlot(filename.replace(/[_\-.]+/g, ' '));
  if (fromName) return { slot: fromName, confidence: 0.75, reason: 'file name' };
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  const r = bh / bw;
  const areaShare = (bw * bh) / (imgW * imgH);
  if (r > 2.1) return { slot: 'bottom', confidence: 0.45, reason: 'long, narrow silhouette' };
  if (r > 1.45) return { slot: 'dress', confidence: 0.35, reason: 'tall silhouette' };
  if (r < 0.62 && areaShare < 0.25) return { slot: 'shoes', confidence: 0.4, reason: 'low, wide silhouette' };
  if (r < 0.95 && areaShare < 0.12) return { slot: 'bag', confidence: 0.3, reason: 'compact shape' };
  return { slot: 'top', confidence: 0.4, reason: 'shoulder-width silhouette' };
}

function dHash(canvas) {
  const c = canvasFor(9, 8);
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0, 9, 8);
  const d = ctx.getImageData(0, 0, 9, 8).data;
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const i = (y * 9 + x) * 4, j = i + 4;
    bits += (d[i] + d[i + 1] + d[i + 2]) > (d[j] + d[j + 1] + d[j + 2]) ? '1' : '0';
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hashDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

export function findDuplicate(hash, items, maxDistance = 7) {
  let best = null;
  for (const it of items) {
    if (!it.hash) continue;
    const d = hashDistance(hash, it.hash);
    if (d <= maxDistance && (!best || d < best.distance)) best = { id: it.id, name: it.name, distance: d };
  }
  return best;
}

function cropToDataUrl(img, scale, box, maxEdge = 520) {
  const padX = (box.x1 - box.x0 + 1) * CELL * 0.06, padY = (box.y1 - box.y0 + 1) * CELL * 0.06;
  const sx = Math.max(0, (box.x0 * CELL - padX) / scale);
  const sy = Math.max(0, (box.y0 * CELL - padY) / scale);
  const sw = Math.min(img.naturalWidth - sx, ((box.x1 - box.x0 + 1) * CELL + padX * 2) / scale);
  const sh = Math.min(img.naturalHeight - sy, ((box.y1 - box.y0 + 1) * CELL + padY * 2) / scale);
  const k = Math.min(1, maxEdge / Math.max(sw, sh));
  const c = canvasFor(sw * k, sh * k);
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL('image/jpeg', 0.84), canvas: c };
}

/**
 * Analyse one photo. Returns one detection per garment found.
 * @param {File|string} source  a File from the gallery picker, or an image URL / data URL
 */
export async function analyzePhoto(source, { filename = '', existingItems = [] } = {}) {
  const src = typeof source === 'string' ? source : await fileToDataUrl(source);
  const name = filename || (typeof source === 'string' ? '' : source.name || '');
  const img = await loadImage(src);
  const scale = Math.min(1, WORK_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const work = canvasFor(w, h);
  const ctx = work.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const { bg, spread } = estimateBackground(data, w, h);
  const busyBackdrop = spread > 70;
  const threshold = Math.max(30, spread * 1.6 + 12);
  const mask = buildMask(data, w, h, bg, threshold);
  let grid = morph(mask.grid, mask.gw, mask.gh, true);
  grid = morph(grid, mask.gw, mask.gh, false);
  grid = morph(grid, mask.gw, mask.gh, false);
  grid = morph(grid, mask.gw, mask.gh, true);
  mask.grid = grid;

  const total = mask.gw * mask.gh;
  const minArea = Math.max(24, total * 0.008);
  let boxes = [];
  if (!busyBackdrop) {
    for (const comp of components(grid, mask.gw, mask.gh)) {
      if (comp.area < minArea) continue;
      boxes.push(...xyCut(grid, mask.gw, comp).filter(b => b.area >= minArea));
    }
    boxes = mergeBoxes(boxes);
  }
  const fullBox = { x0: 0, y0: 0, x1: mask.gw - 1, y1: mask.gh - 1, area: total };
  const single = boxes.length <= 1;
  if (boxes.length === 0) boxes = [fullBox];
  if (boxes.length === 1) {
    const b = boxes[0];
    if ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) > total * 0.88) boxes = [fullBox];
  }
  // reading order: rows top-to-bottom, then left-to-right
  const rowH = mask.gh / 3;
  const rowOf = (b) => Math.floor(((b.y0 + b.y1) / 2) / rowH);
  boxes.sort((a, b) => rowOf(a) - rowOf(b) || a.x0 - b.x0);

  const fullMask = boxes[0] === fullBox ? { ...mask, grid: new Uint8Array(total).fill(1) } : mask;
  const detections = boxes.slice(0, 24).map((box, index) => {
    const { dataUrl, canvas } = cropToDataUrl(img, scale, box);
    const region = analyseRegion(data, w, h, box, box === fullBox ? fullMask : mask);
    const guess = guessSlot(box, mask.gw, mask.gh, name);
    const hash = dHash(canvas);
    return {
      key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${index}`,
      dataUrl,
      colors: region.colors,
      pattern: region.pattern,
      slot: guess.slot,
      subcategory: inferSubcategory(name, guess.slot),
      confidence: guess.confidence,
      reason: guess.reason,
      hash,
      duplicateOf: findDuplicate(hash, existingItems),
    };
  });
  // flag duplicates within the same batch too
  detections.forEach((d, i) => {
    if (d.duplicateOf) return;
    const twin = detections.slice(0, i).find(o => hashDistance(o.hash, d.hash) <= 5);
    if (twin) d.duplicateOf = { id: twin.key, name: 'another photo in this upload', distance: hashDistance(twin.hash, d.hash) };
  });
  return { detections, single: single && boxes.length === 1, busyBackdrop, backdrop: rgbToHex(bg) };
}

// Palette-only read of an inspiration photo (Pinterest / Instagram screenshot).
export async function analyzeInspiration(file) {
  const result = await analyzePhoto(file, { filename: '' });
  return result;
}
