import React, { useRef, useState } from 'react';
import { SLOTS, SLOT_LABELS, SLOT_GROUPS, SUBCATEGORIES, PATTERNS, FITS, AESTHETICS, STYLIST_OCCASIONS } from '../ai/attributes.js';
import { NAMED_COLORS, hexForName } from '../ai/colors.js';
import { fileToDataUrl } from '../ai/vision.js';
import { Img, Swatches } from './shared.jsx';

const COLLECTIONS = ['Basics', 'Athleisure', 'Glam / Party', 'The Event Edit'];

export default function ItemEditor({ item, src, onSave, onClose, onDelete }) {
  const [draft, setDraft] = useState({ ...item, price: item.price ?? '' });
  const [newImage, setNewImage] = useState(null);
  const fileRef = useRef(null);
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const toggle = (key, value) => set({ [key]: (draft[key] || []).includes(value) ? draft[key].filter(x => x !== value) : [...(draft[key] || []), value] });
  const setColour = (i, name) => {
    const colors = [...(draft.colors || [])];
    if (!name) colors.splice(i, 1); else colors[i] = { name, hex: hexForName(name) };
    set({ colors, color: colors.map(c => c.name).join(' / ') });
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({ ...draft, price: draft.price === '' ? null : Number(draft.price), formality: Number(draft.formality), warmth: Number(draft.warmth), wears: Number(draft.wears) || 0 }, newImage);
  };

  return (
    <div className="fc-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="fc-modal fx-editor" onSubmit={submit}>
        <div className="fc-modal-head">
          <div><p className="fc-kicker">EDIT, RECATEGORISE OR REPLACE</p><h2>Edit <em>piece.</em></h2></div>
          <button type="button" className="fc-close" onClick={onClose}>×</button>
        </div>
        <div className="fx-editor-body">
          <div className="fx-editor-img">
            <Img src={newImage || src} alt={draft.name} />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setNewImage(await fileToDataUrl(f)); }} />
            <button type="button" className="fc-btn light" onClick={() => fileRef.current?.click()}>Replace photo</button>
          </div>
          <div>
            <label className="fc-field">Name<input required value={draft.name} onChange={e => set({ name: e.target.value })} /></label>
            <div className="fc-form-grid">
              <label className="fc-field">Category
                <select value={draft.slot} onChange={e => set({ slot: e.target.value, group: SLOT_GROUPS[e.target.value], subcategory: SUBCATEGORIES[e.target.value][0] })}>
                  {SLOTS.map(s => <option key={s} value={s}>{SLOT_GROUPS[s]}: {SLOT_LABELS[s]}</option>)}
                </select>
              </label>
              <label className="fc-field">Type
                <select value={draft.subcategory} onChange={e => set({ subcategory: e.target.value })}>
                  {[...new Set([draft.subcategory, ...SUBCATEGORIES[draft.slot]])].map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="fc-field">Collection<select value={draft.category} onChange={e => set({ category: e.target.value })}>{COLLECTIONS.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="fc-field">Audience<select value={draft.audience} onChange={e => set({ audience: e.target.value })}>{['Everyone', 'Women', 'Men'].map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="fc-field">Pattern<select value={draft.pattern} onChange={e => set({ pattern: e.target.value })}>{PATTERNS.map(p => <option key={p}>{p}</option>)}</select></label>
              <label className="fc-field">Fit<select value={draft.fit} onChange={e => set({ fit: e.target.value })}>{FITS.map(p => <option key={p}>{p}</option>)}</select></label>
              <label className="fc-field">Material<input value={draft.material || ''} onChange={e => set({ material: e.target.value })} placeholder="e.g. Linen" /></label>
              <label className="fc-field">Brand<input value={draft.brand || ''} onChange={e => set({ brand: e.target.value })} /></label>
            </div>
            <div className="fx-colour-row">
              <Swatches colors={draft.colors} size={16} />
              {[0, 1].map(i => (
                <select key={i} aria-label={i ? 'Secondary colour' : 'Primary colour'} value={draft.colors?.[i]?.name || ''} onChange={e => setColour(i, e.target.value)}>
                  <option value="">{i ? 'No 2nd colour' : 'Colour'}</option>
                  {NAMED_COLORS.map(([n]) => <option key={n}>{n}</option>)}
                </select>
              ))}
            </div>
            <div className="fc-form-grid">
              <label className="fc-field">Formality: {draft.formality}<input type="range" min="1" max="5" step="0.5" value={draft.formality} onChange={e => set({ formality: Number(e.target.value) })} /></label>
              <label className="fc-field">Warmth: {draft.warmth}<input type="range" min="0" max="5" step="0.5" value={draft.warmth} onChange={e => set({ warmth: Number(e.target.value) })} /></label>
              <label className="fc-field">Price paid<input type="number" min="0" value={draft.price} onChange={e => set({ price: e.target.value })} /></label>
              <label className="fc-field">Times worn<input type="number" min="0" value={draft.wears} onChange={e => set({ wears: e.target.value })} /></label>
            </div>
            <p className="fx-label">Aesthetics</p>
            <div className="fx-chips small">{AESTHETICS.map(a => <button type="button" key={a} className={(draft.aesthetics || []).includes(a) ? 'on' : ''} onClick={() => toggle('aesthetics', a)}>{a}</button>)}</div>
            <p className="fx-label">Suitable occasions</p>
            <div className="fx-chips small">{STYLIST_OCCASIONS.map(o => <button type="button" key={o.id} className={(draft.occasions || []).includes(o.id) ? 'on' : ''} onClick={() => toggle('occasions', o.id)}>{o.id}</button>)}</div>
            <label className="fx-check"><input type="checkbox" checked={!!draft.rainSafe} onChange={e => set({ rainSafe: e.target.checked })} /> Fine in the rain</label>
            <label className="fx-check"><input type="checkbox" checked={!!draft.breathable} onChange={e => set({ breathable: e.target.checked })} /> Breathable / good in heat</label>
          </div>
        </div>
        <div className="fc-modal-actions">
          <button type="button" className="fc-textbtn" onClick={() => onDelete(item.id)}>Delete piece</button>
          <div className="fx-row"><button type="button" className="fc-btn light" onClick={onClose}>Cancel</button><button className="fc-btn dark" type="submit">Save changes ↗</button></div>
        </div>
      </form>
    </div>
  );
}
