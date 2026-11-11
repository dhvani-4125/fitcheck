import React, { useEffect, useMemo, useState } from 'react';
import { generateOutfits, swapPiece } from '../ai/stylist.js';
import { STYLIST_OCCASIONS, SLOT_LABELS } from '../ai/attributes.js';
import { cityStyle, CITY_STYLE } from '../ai/shopping.js';
import { OutfitCard } from './Stylist.jsx';
import { Img, Chips } from './shared.jsx';

const DESTINATIONS = ['Paris', 'London', 'Dubai', 'Goa', 'Manali', 'Bali', 'Jaipur', 'New York'];

// "Style this piece": three ways to wear one item, optionally for a destination, plus a buy to complete it.
export default function StyleIt({ item, items, srcOf, profile, prefs, audience, onClose, onAskFriends, onSaveLook, notify }) {
  const [occasion, setOccasion] = useState(item.occasions?.[0] || 'Casual');
  const [destination, setDestination] = useState('');
  const [seed, setSeed] = useState(1);
  const lane = item.audience && item.audience !== 'Everyone' ? item.audience : audience;
  const city = cityStyle(destination);
  const ctx = useMemo(() => ({ occasion, audience: lane, prefs, destination, aesthetic: city?.aesthetic || null, fixed: { [item.slot]: item.id }, count: 3, seed }), [occasion, lane, prefs, destination, city, item, seed]);
  const [overrides, setOverrides] = useState({});
  const outfits = useMemo(() => generateOutfits(items, ctx), [items, ctx]);
  useEffect(() => { setOverrides({}); }, [outfits]);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  return (
    <div className="fc-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fc-modal fx-styleit">
        <div className="fc-modal-head">
          <div className="fx-styleit-head">
            <Img src={srcOf(item)} alt={item.name} />
            <div><p className="fc-kicker">STYLE THIS PIECE</p><h2>{item.name}</h2><p className="fc-muted">{SLOT_LABELS[item.slot]} · {item.color}</p></div>
          </div>
          <button type="button" className="fc-close" onClick={onClose}>×</button>
        </div>
        <p className="fx-label">Where are you wearing it?</p>
        <Chips options={STYLIST_OCCASIONS.map(o => o.id)} value={occasion} onChange={v => setOccasion(v || 'Casual')} allowNone={false} />
        <p className="fx-label">Travelling? <span className="fx-optional">(optional)</span></p>
        <div className="fx-chips">
          {DESTINATIONS.map(d => <button type="button" key={d} className={destination === d ? 'on' : ''} onClick={() => setDestination(destination === d ? '' : d)}>{d}</button>)}
        </div>
        {city && <p className="fx-city-vibe">✦ Styled for {city.name}: {city.vibe}</p>}
        <div className="fx-styleit-results">
          {outfits.length ? outfits.map((o, i) => {
            const shown = overrides[i] || o;
            return (
              <OutfitCard key={o.id + i} index={i} outfit={shown} byId={byId} srcOf={srcOf} ctx={ctx} profile={profile} prefs={prefs}
                kicker={`WAY ${i + 1}${city ? ` · ${city.name.toUpperCase()}` : ''}`} hidePlan
                onSwap={(slot) => { if (slot === item.slot) { notify('That’s the piece you’re styling. Swap the others.'); return; } const next = swapPiece(shown, slot, items, ctx); if (next.notice) notify(next.notice); else setOverrides(m => ({ ...m, [i]: next })); }}
                onAskFriends={onAskFriends ? (meta) => onAskFriends(shown, { ...meta, occasion, label: `${item.name} · way ${i + 1}` }) : null}
                onSave={(meta) => { onSaveLook(shown, { ...meta, occasion }); setOverrides(m => ({ ...m, [i]: { ...shown, saved: true } })); }}
              />
            );
          }) : <p className="fx-results-msg">Not enough other pieces to style this for {occasion.toLowerCase()} yet. Try another occasion or upload more clothes.</p>}
        </div>
        <div className="fc-modal-actions"><span className="fc-muted">Built from your own wardrobe{destination ? `, with ${destination} in mind` : ''}.</span><button type="button" className="fc-btn light" onClick={() => setSeed(s => s + 1)}>↻ Fresh ideas</button></div>
      </div>
    </div>
  );
}
export { CITY_STYLE };
