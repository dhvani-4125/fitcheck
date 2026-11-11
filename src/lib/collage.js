// Draws outfit options into shareable images (for WhatsApp / Instagram polls).
const CREAM = '#f6f3ed', INK = '#242321', SAGE = '#5b6b4d', LINE = '#d9d1c6';

function loadImg(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(ctx, img, x, y, w, h) {
  if (!img) { ctx.fillStyle = '#e6ebdf'; ctx.fillRect(x, y, w, h); return; }
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, Math.max(0, (img.height - sh) * 0.2), sw, sh, x, y, w, h);
}

async function drawPieces(ctx, srcs, x, y, w, h) {
  const imgs = await Promise.all(srcs.slice(0, 4).map(loadImg));
  const n = Math.max(1, imgs.length), gap = 6;
  if (n === 1) { cover(ctx, imgs[0], x, y, w, h); return; }
  if (n === 2) { const cw = (w - gap) / 2; imgs.forEach((im, i) => cover(ctx, im, x + i * (cw + gap), y, cw, h)); return; }
  // big first piece left, others stacked right
  const lw = Math.round(w * 0.58), rw = w - lw - gap;
  cover(ctx, imgs[0], x, y, lw, h);
  const rest = imgs.slice(1), rh = (h - gap * (rest.length - 1)) / rest.length;
  rest.forEach((im, i) => cover(ctx, im, x + lw + gap, y + i * (rh + gap), rw, rh));
}

function canvasToDataUrl(c) {
  try { return c.toDataURL('image/jpeg', 0.88); } catch { return null; } // tainted by a cross-origin photo
}

/** One option as a square-ish card. */
export async function drawOption(srcs, label, number) {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 900;
  const ctx = c.getContext('2d');
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, c.width, c.height);
  await drawPieces(ctx, srcs, 30, 30, 660, 760);
  ctx.fillStyle = SAGE; ctx.beginPath(); ctx.arc(80, 80, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '600 36px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(number), 80, 82);
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = '500 30px Georgia, serif';
  ctx.fillText(truncate(ctx, label || `Option ${number}`, 640), 34, 850);
  return canvasToDataUrl(c);
}

/** All options side by side with the question: the image friends see on WhatsApp. */
export async function drawPoll(question, options) {
  const n = options.length;
  const colW = 520, gap = 24, pad = 48, head = 150, foot = 70;
  const c = document.createElement('canvas');
  c.width = pad * 2 + n * colW + (n - 1) * gap; c.height = head + 700 + 70 + foot;
  const ctx = c.getContext('2d');
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = SAGE; ctx.font = '700 22px Arial, sans-serif'; ctx.fillText('FITCHECK · HELP ME CHOOSE', pad, 60);
  ctx.fillStyle = INK; ctx.font = '500 46px Georgia, serif'; ctx.fillText(truncate(ctx, question, c.width - pad * 2), pad, 118);
  for (let i = 0; i < n; i++) {
    const x = pad + i * (colW + gap), y = head;
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(x, y, colW, 770);
    await drawPieces(ctx, options[i].srcs, x + 10, y + 10, colW - 20, 680);
    ctx.fillStyle = SAGE; ctx.beginPath(); ctx.arc(x + 50, y + 50, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 32px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x + 50, y + 52);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK; ctx.font = '500 26px Georgia, serif';
    ctx.fillText(truncate(ctx, options[i].label || `Option ${i + 1}`, colW - 30), x + 16, y + 740);
  }
  ctx.fillStyle = '#777067'; ctx.font = '400 22px Arial, sans-serif';
  ctx.fillText(`Reply with ${options.map((_, i) => i + 1).join(', ').replace(/, (\d)$/, ' or $1')}!`, pad, c.height - 32);
  return canvasToDataUrl(c);
}

function truncate(ctx, text, max) {
  let t = String(text);
  if (ctx.measureText(t).width <= max) return t;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export async function dataUrlToFile(dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}
