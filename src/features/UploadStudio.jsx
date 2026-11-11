import React, { useEffect, useRef, useState } from 'react';
import { analyzePhoto } from '../ai/vision.js';
import { embedImage, classifyEmbedding, findSimilar, loadMemory, onClipStatus } from '../ai/clip.js';
import { SLOTS, SLOT_LABELS, SUBCATEGORIES, PATTERNS, SLOT_GROUPS } from '../ai/attributes.js';
import { NAMED_COLORS, hexForName } from '../ai/colors.js';
import { PageHeading, Swatches } from './shared.jsx';

const COLLECTIONS = ['Basics', 'Athleisure', 'Glam / Party', 'The Event Edit'];

function defaultName(d) {
  const colour = d.colors?.[0]?.name || '';
  const pattern = d.pattern && d.pattern !== 'Solid' ? `${d.pattern.split(' ')[0].toLowerCase()} ` : '';
  return `${colour} ${pattern}${(d.subcategory || SLOT_LABELS[d.slot]).toLowerCase()}`.trim();
}

export default function UploadStudio({ items, onSave, notify, audience }) {
  const inputRef = useRef(null);
  const [batches, setBatches] = useState([]); // {id, file, status, error, single, busy}
  const [drafts, setDrafts] = useState([]);   // editable detections
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState({ status: 'idle', progress: 0 });
  const memory = useRef([]);
  useEffect(() => { loadMemory().then(m => { memory.current = m; }); return onClipStatus((status, info) => setAi(a => ({ ...a, status, ...info }))); }, []);

  // Run FashionCLIP on each detected piece; never overwrite what the user already changed.
  const recognise = async (fresh) => {
    for (const d of fresh) {
      try {
        const e = await embedImage(d.dataUrl);
        const r = classifyEmbedding(e, memory.current);
        const twin = findSimilar(e, memory.current.filter(m => items.some(i => i.id === m.id)));
        setDrafts(ds => ds.map(x => {
          if (x.key !== d.key) return x;
          const next = { ...x, emb: e, aiAlternatives: r.alternatives, reason: r.reason, confidence: r.confidence };
          if (!x.touched?.slot) { next.slot = r.slot; next.subcategory = r.subcategory; }
          if (!x.touched?.pattern && r.pattern) next.pattern = r.pattern;
          if (!x.touched?.name) next.name = defaultName(next);
          if (!x.duplicateOf && twin) { const it = items.find(i => i.id === twin.id); next.duplicateOf = { id: twin.id, name: it?.name || 'a saved piece', distance: 0 }; next.include = false; }
          if (!x.touched?.collection) next.collection = next.slot === 'dress' && !['Lehenga', 'Saree', 'Sherwani', 'Anarkali', 'Kurta set', 'Sharara set'].includes(next.subcategory) ? 'Glam / Party' : ['Lehenga', 'Saree', 'Sherwani'].includes(next.subcategory) ? 'The Event Edit' : next.aesthetics?.includes?.('Sporty') ? 'Athleisure' : x.collection;
          return next;
        }));
      } catch { /* model unavailable (offline): keep the shape-based guess */ }
    }
  };

  const process = async (fileList) => {
    const files = [...fileList].filter(f => f.type.startsWith('image/'));
    if (!files.length) { notify('Choose image files (JPG, PNG, HEIC exported as JPG, WebP).'); return; }
    setBusy(true);
    for (const file of files) {
      const id = `${file.name}-${file.size}-${Date.now()}`;
      setBatches(b => [...b, { id, name: file.name, status: 'Analysing…' }]);
      try {
        const known = [...items, ...drafts.map(d => ({ id: d.key, name: d.name, hash: d.hash }))];
        const res = await analyzePhoto(file, { filename: file.name, existingItems: known });
        const fresh = res.detections.map(d => ({
          ...d,
          source: file.name,
          include: !d.duplicateOf,
          name: defaultName(d),
          collection: d.slot === 'dress' ? 'Glam / Party' : 'Basics',
          audience: audience || 'Everyone',
          brand: '',
          price: '',
        }));
        setDrafts(prev => [...prev, ...fresh]);
        recognise(fresh);
        setBatches(b => b.map(x => x.id === id ? {
          ...x,
          status: res.detections.length > 1 ? `${res.detections.length} pieces separated` : res.busyBackdrop ? '1 piece (busy background, kept whole)' : '1 piece found',
        } : x));
      } catch (err) {
        setBatches(b => b.map(x => x.id === id ? { ...x, status: 'Failed', error: err.message } : x));
      }
    }
    setBusy(false);
  };

  const update = (key, patch) => setDrafts(ds => ds.map(d => d.key === key ? { ...d, ...patch, touched: { ...(d.touched || {}), ...Object.fromEntries(Object.keys(patch).map(k => [k === 'subcategory' ? 'slot' : k, true])) } } : d));
  const setColour = (d, index, name) => {
    const colors = [...(d.colors || [])];
    if (!name) colors.splice(index, 1);
    else colors[index] = { name, hex: hexForName(name), share: colors[index]?.share ?? 0.3 };
    update(d.key, { colors });
  };
  const included = drafts.filter(d => d.include);

  const save = async () => {
    if (!included.length) { notify('Select at least one detected piece to save.'); return; }
    await onSave(included);
    setDrafts(ds => ds.filter(d => !d.include));
    setBatches([]);
  };

  return (
    <main className="fc-page">
      <PageHeading kicker="PHASE 1 · DIGITAL WARDROBE" title="Upload your" em="wardrobe."
        text="Add photos from your gallery: one garment per photo, or many laid out together. FitCheck finds each piece, crops it, and reads its colours and pattern on your device, so your photos never leave this browser.">
        <button className="fc-btn dark" onClick={() => inputRef.current?.click()}>＋ Choose photos</button>
      </PageHeading>

      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { process(e.target.files); e.target.value = ''; }} />
      <button
        type="button"
        className={`fx-dropzone ${dragging ? 'drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files); }}
      >
        <span className="fx-drop-icon">⇪</span>
        <strong>{busy ? 'Reading your photos…' : 'Drop photos here or tap to open your gallery'}</strong>
        <span>Select as many photos as you like. For best separation, lay pieces flat on a plain bed sheet, floor or wall with a little space between them.</span>
      </button>

      {ai.status !== 'idle' && (
        <p className={`fx-ai-status ${ai.status}`}>
          {ai.status === 'loading' && <>✦ Loading the clothing-recognition AI… {Math.round((ai.progress || 0) * 100)}% <span>(about 87 MB, first time only, then it's saved in your browser)</span></>}
          {ai.status === 'ready' && <>✦ AI recognition is on. It learns from every category you correct.</>}
          {ai.status === 'error' && <>AI recognition couldn't load (are you offline?), so categories are a rough guess from shape. Please check them.</>}
        </p>
      )}

      {batches.length > 0 && (
        <ul className="fx-batch-list">
          {batches.map(b => <li key={b.id} className={b.error ? 'err' : ''}><span>{b.name}</span><strong>{b.error || b.status}</strong></li>)}
        </ul>
      )}

      {drafts.length > 0 && (
        <section className="fx-review">
          <div className="fx-review-head">
            <div>
              <p className="fc-kicker">REVIEW BEFORE SAVING</p>
              <h2>{drafts.length} piece{drafts.length === 1 ? '' : 's'} detected</h2>
              <p className="fc-muted">The AI suggests each category. Correct anything it gets wrong and it will remember for next time.</p>
            </div>
            <div className="fx-review-actions">
              <button className="fc-textbtn" onClick={() => setDrafts(ds => ds.map(d => ({ ...d, include: true })))}>Select all</button>
              <button className="fc-textbtn" onClick={() => setDrafts([])}>Discard all</button>
              <button className="fc-btn dark" disabled={!included.length} onClick={save}>Save {included.length} to wardrobe ↗</button>
            </div>
          </div>
          <div className="fx-review-grid">
            {drafts.map(d => (
              <article key={d.key} className={`fx-draft ${d.include ? '' : 'off'}`}>
                <div className="fx-draft-img">
                  <img src={d.dataUrl} alt={d.name} />
                  <label className="fx-include"><input type="checkbox" checked={d.include} onChange={e => update(d.key, { include: e.target.checked })} /> Keep</label>
                  <span className="fx-confidence" title={d.reason}>{d.emb ? '✦ ' : ''}{Math.round(d.confidence * 100)}% sure</span>
                </div>
                {d.duplicateOf && <p className="fx-dup">Looks like a duplicate of “{d.duplicateOf.name}”</p>}
                {!d.emb && ai.status === 'loading' && <p className="fx-ai-pending">✦ AI is still recognising this…</p>}
                {d.aiAlternatives?.length > 0 && !d.touched?.slot && <p className="fx-ai-alt">Or maybe: {d.aiAlternatives.join(', ')}</p>}
                <label className="fc-field">Name<input value={d.name} onChange={e => update(d.key, { name: e.target.value })} /></label>
                <div className="fc-form-grid">
                  <label className="fc-field">Category
                    <select value={d.slot} onChange={e => update(d.key, { slot: e.target.value, subcategory: SUBCATEGORIES[e.target.value][0] })}>
                      {SLOTS.map(s => <option key={s} value={s}>{SLOT_GROUPS[s]}: {SLOT_LABELS[s]}</option>)}
                    </select>
                  </label>
                  <label className="fc-field">Type
                    <select value={d.subcategory} onChange={e => update(d.key, { subcategory: e.target.value })}>
                      {SUBCATEGORIES[d.slot].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="fc-field">Pattern
                    <select value={d.pattern} onChange={e => update(d.key, { pattern: e.target.value })}>{PATTERNS.map(p => <option key={p}>{p}</option>)}</select>
                  </label>
                  <label className="fc-field">Collection
                    <select value={d.collection} onChange={e => update(d.key, { collection: e.target.value })}>{COLLECTIONS.map(c => <option key={c}>{c}</option>)}</select>
                  </label>
                </div>
                <div className="fx-colour-row">
                  <Swatches colors={d.colors} size={16} />
                  {[0, 1].map(i => (
                    <select key={i} aria-label={i ? 'Secondary colour' : 'Primary colour'} value={d.colors?.[i]?.name || ''} onChange={e => setColour(d, i, e.target.value)}>
                      <option value="">{i ? 'No 2nd colour' : 'Colour'}</option>
                      {NAMED_COLORS.map(([n]) => <option key={n}>{n}</option>)}
                    </select>
                  ))}
                </div>
                <div className="fc-form-grid">
                  <label className="fc-field">Brand<input value={d.brand} onChange={e => update(d.key, { brand: e.target.value })} placeholder="Optional" /></label>
                  <label className="fc-field">Price paid<input type="number" min="0" value={d.price} onChange={e => update(d.key, { price: e.target.value })} placeholder="For cost-per-wear" /></label>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
