import React, { useMemo, useRef, useState } from 'react';
import { parseRequest, generateOutfits, swapPiece, restyle, randomOutfit, matchInspiration, MOODS, recordFeedback } from '../ai/stylist.js';
import { STYLIST_OCCASIONS, AESTHETICS, SLOT_LABELS, OCCASION_BY_ID } from '../ai/attributes.js';
import { recommendFragrance } from '../ai/fragrance.js';
import { recommendHair } from '../ai/hair.js';
import { analyzeInspiration } from '../ai/vision.js';
import WeatherCard from './WeatherCard.jsx';
import { Img, Chips, HairGlyph, PageHeading, Swatches } from './shared.jsx';

const EXAMPLES = [
  'Suggest five outfits for an office meeting',
  "I'm going on a coffee date. What should I wear?",
  'Something comfortable for college',
  'A chic outfit for a night out',
  'Casual for a road trip',
  'Relaxed weekend, no black',
];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Stylist({ items, srcOf, prefs, setPrefs, history, profile, weather, audience, setAudience, onSaveLook, onPlan, onWear, notify, preset, onUpload }) {
  const [prompt, setPrompt] = useState('');
  const [occasion, setOccasion] = useState(preset?.occasion || null);
  const [aesthetic, setAesthetic] = useState(null);
  const [mood, setMood] = useState(null);
  const [outfits, setOutfits] = useState([]);
  const [ctx, setCtx] = useState(null);
  const [message, setMessage] = useState('');
  const [inspo, setInspo] = useState(null);
  const inspoRef = useRef(null);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const baseCtx = (extra = {}) => ({
    occasion, aesthetic, mood, audience, prefs, history,
    weather: weather.day, count: 5, seed: Date.now() % 1e9, ...extra,
  });

  const run = (e) => {
    e?.preventDefault?.();
    const parsed = parseRequest(prompt);
    const occ = parsed.occasion || occasion;
    const aes = parsed.aesthetic || aesthetic;
    const md = parsed.mood || mood;
    if (parsed.occasion) setOccasion(parsed.occasion);
    if (parsed.aesthetic) setAesthetic(parsed.aesthetic);
    if (parsed.mood) setMood(parsed.mood);
    const c = baseCtx({ occasion: occ, aesthetic: aes, mood: md, count: parsed.count, comfortable: parsed.comfortable, formalShift: parsed.formalShift, wantColours: parsed.wantColours, avoidColours: parsed.avoidColours });
    const res = generateOutfits(items, c);
    setCtx(c); setOutfits(res); setInspo(null);
    if (!res.length) setMessage('Your wardrobe needs at least a top and a bottom (or a dress) for this audience. Upload a few more pieces.');
    else setMessage(`${res.length} look${res.length === 1 ? '' : 's'} for ${occ ? OCCASION_BY_ID[occ].label.toLowerCase() : 'any occasion'}${aes ? ` · ${aes}` : ''}${md ? ` · ${md.toLowerCase()} mood` : ''}${weather.day ? ` · ${Math.round(weather.day.feels)}°C ${weather.day.label.toLowerCase()}` : ''}, built from ${items.length} pieces you own.`);
  };

  const surprise = () => {
    const c = baseCtx();
    const o = randomOutfit(items, c);
    setCtx(c); setInspo(null);
    setOutfits(o ? [o] : []);
    setMessage(o ? 'An unexpected but coordinated combination from your wardrobe.' : 'Add more pieces to unlock surprise outfits.');
  };

  const runInspiration = async (file) => {
    if (!file) return;
    setMessage('Reading the inspiration photo…');
    try {
      const res = await analyzeInspiration(file);
      const c = baseCtx({ count: 3 });
      const m = matchInspiration(res.detections, items, c);
      setInspo({ src: URL.createObjectURL(file), ...m, detections: res.detections });
      setCtx(c); setOutfits(m.outfits);
      setMessage(m.matches.length ? `Matched ${m.matches.length} piece${m.matches.length === 1 ? '' : 's'} from the photo to your wardrobe, then completed the look.` : 'No close matches in your wardrobe, so here are looks in a similar palette.');
    } catch (err) { setMessage(err.message); }
  };

  const replace = (index, next) => {
    if (next.notice) { notify(next.notice); return; }
    setOutfits(os => os.map((o, i) => i === index ? next : o));
  };

  const feedback = (outfit, value, extra = {}) => {
    const pieces = outfit.items.map(id => byId.get(id)).filter(Boolean);
    setPrefs(p => recordFeedback(p, pieces, value, { occasion: ctx?.occasion, aesthetic: ctx?.aesthetic, ...extra }));
    setOutfits(os => os.map(o => o.id === outfit.id ? { ...o, vote: value > 0 ? 'up' : value < 0 ? 'down' : o.vote, rating: extra.rating || o.rating } : o));
    if (!extra.rating) notify(value > 0 ? 'Noted: more looks like this.' : 'Noted: fewer looks like this.');
  };

  return (
    <main className="fc-page">
      <PageHeading kicker="PHASE 3 · YOUR AI STYLIST" title="Your personal" em="stylist."
        text="Ask in your own words or pick an occasion. FitCheck builds complete looks only from the pieces you own, checks the weather, and suggests a fragrance and hairstyle to finish each one." />

      <div className="fx-stylist">
        <aside className="fx-brief">
          <form onSubmit={run} className="fx-ask">
            <label htmlFor="fx-prompt" className="fx-label">What are you dressing for?</label>
            <textarea id="fx-prompt" rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. I have a client lunch, then drinks. Something polished but not stiff."
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }} />
            <div className="fx-examples">{EXAMPLES.map(x => <button type="button" key={x} onClick={() => setPrompt(x)}>{x}</button>)}</div>
          </form>
          <p className="fx-label">Occasion</p>
          <Chips options={STYLIST_OCCASIONS.map(o => o.id)} value={occasion} onChange={setOccasion} />
          <p className="fx-label">Aesthetic</p>
          <Chips options={AESTHETICS} value={aesthetic} onChange={setAesthetic} />
          <p className="fx-label">Mood</p>
          <Chips options={MOODS} value={mood} onChange={setMood} />
          <p className="fx-label">Dressing</p>
          <Chips options={['Everyone', 'Women', 'Men']} value={audience} onChange={v => setAudience(v || 'Everyone')} allowNone={false} labels={{ Everyone: 'All pieces' }} />
          <WeatherCard weather={weather} />
          <div className="fx-brief-actions">
            <button className="fc-btn dark" onClick={run}>✦ Style me</button>
            <button className="fc-btn light" onClick={surprise}>⟳ Surprise me</button>
            <button className="fc-btn light" onClick={() => inspoRef.current?.click()}>⇪ Match an inspiration photo</button>
            <input ref={inspoRef} type="file" accept="image/*" hidden onChange={e => { runInspiration(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </aside>

        <section className="fx-results">
          {message && <p className="fx-results-msg">{message}</p>}
          {inspo && (
            <div className="fx-inspo">
              <img src={inspo.src} alt="Inspiration" />
              <div>
                <p className="fc-kicker">INSPIRATION PALETTE</p>
                <Swatches colors={inspo.palette} size={18} />
                <ul>{inspo.matches.map(m => <li key={m.item}>{byId.get(m.item)?.name} <span>{m.similarity}% match</span></li>)}</ul>
              </div>
            </div>
          )}
          {!items.length && (
            <div className="fx-empty-results">
              <p className="fc-kicker">FIRST, YOUR WARDROBE</p>
              <h2>Upload your clothes to begin.</h2>
              <p className="fc-muted">The stylist only uses pieces you own. Add a few tops, bottoms and shoes (or dresses) and it will start putting looks together.</p>
              <button className="fc-btn dark" onClick={onUpload}>⇪ Upload photos</button>
            </div>
          )}
          {items.length > 0 && !outfits.length && !message && (
            <div className="fx-empty-results">
              <p className="fc-kicker">READY WHEN YOU ARE</p>
              <h2>Tell me where you're going.</h2>
              <p className="fc-muted">You'll get five complete looks using your own photos, each with a short note on why it works, a fragrance and a hairstyle.</p>
            </div>
          )}
          {outfits.map((o, i) => (
            <OutfitCard key={o.id + i} index={i} outfit={o} byId={byId} srcOf={srcOf} ctx={ctx} profile={profile} prefs={prefs}
              onSwap={(slot) => replace(i, swapPiece(o, slot, items, ctx))}
              onRestyle={(dir) => replace(i, restyle(o, items, ctx, dir))}
              onVote={(v) => feedback(o, v)}
              onRate={(r) => feedback(o, r >= 4 ? 1 : r <= 2 ? -1 : 0, { rating: r })}
              onSave={(meta) => { onSaveLook(o, { ...meta, occasion: ctx?.occasion }); setOutfits(os => os.map(x => x === o ? { ...x, saved: true } : x)); }}
              onPlan={(day, meta) => onPlan(day, o, { ...meta, occasion: ctx?.occasion })}
              onWear={(meta) => { onWear(o, { ...meta, occasion: ctx?.occasion }); feedback(o, 1); }}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

function OutfitCard({ index, outfit, byId, srcOf, ctx, profile, prefs, onSwap, onRestyle, onVote, onRate, onSave, onPlan, onWear }) {
  const pieces = outfit.items.map(id => byId.get(id)).filter(Boolean);
  const [day, setDay] = useState('');
  const fragrance = useMemo(() => recommendFragrance({
    occasion: ctx?.occasion, aesthetic: ctx?.aesthetic, mood: ctx?.mood, weather: ctx?.weather, outfitAesthetic: outfit.aesthetic,
    prefs: profile.fragrancePrefs, collection: profile.fragrances, learned: prefs?.fragranceFamilies,
  }), [ctx, outfit.aesthetic, profile, prefs?.fragranceFamilies]);
  const hair = useMemo(() => recommendHair({ pieces, occasion: ctx?.occasion, aesthetic: ctx?.aesthetic, weather: ctx?.weather, profile: profile.hair, gender: profile.gender, learned: prefs?.hairStyles }), [outfit.items.join(), ctx, profile.hair, profile.gender, prefs?.hairStyles]); // eslint-disable-line react-hooks/exhaustive-deps
  const scent = fragrance.owned[0] && fragrance.owned[0].score >= (fragrance.profiles[0]?.score ?? 0) - 15 ? fragrance.owned[0] : fragrance.profiles[0];
  const altScent = scent === fragrance.owned[0] ? fragrance.profiles[0] : fragrance.owned[0] || fragrance.profiles[1];
  const style = hair[0];
  const meta = { fragrance: scent ? (scent.fragrance?.name || scent.family.name) : null, fragranceFamily: scent?.family?.id, hair: style?.style.name, hairStyle: style?.style.id };

  return (
    <article className="fx-outfit">
      <header className="fx-outfit-head">
        <div>
          <p className="fc-kicker">{outfit.surprise ? 'SURPRISE LOOK' : `LOOK ${String(index + 1).padStart(2, '0')}`} · {outfit.aesthetic}</p>
          <h3>{titleFor(pieces, ctx)}</h3>
        </div>
        <div className="fx-score" title={Object.entries(outfit.breakdown).map(([k, v]) => `${k} ${v}`).join(' · ')}><strong>{outfit.score}</strong><span>MATCH</span></div>
      </header>

      <div className="fx-pieces">
        {pieces.map(p => (
          <figure key={p.id} className={`fx-piece slot-${p.slot}`}>
            <Img src={srcOf(p)} alt={p.name} />
            <figcaption><span>{SLOT_LABELS[p.slot]}</span>{p.name}</figcaption>
            <button type="button" className="fx-swap" onClick={() => onSwap(p.slot)} title={`Swap ${SLOT_LABELS[p.slot].toLowerCase()} and keep the rest`}>↻ Swap</button>
          </figure>
        ))}
      </div>

      <ul className="fx-why">{outfit.explanation.map(l => <li key={l}>{l}</li>)}</ul>

      <div className="fx-complete">
        {scent && (
          <div className="fx-complete-card">
            <p className="fx-label">Fragrance {scent.fragrance ? '· from your collection' : '· profile'}</p>
            <h4>{scent.fragrance ? `${scent.fragrance.name}${scent.fragrance.brand ? ` — ${scent.fragrance.brand}` : ''}` : scent.family.name}</h4>
            <p>{scent.why.length ? `${scent.why.slice(0, 2).join(', ')}.` : 'A versatile pick for today.'}</p>
            <p className="fx-notes">Notes: {(scent.fragrance?.notes ? scent.fragrance.notes.split(',').map(n => n.trim()) : scent.family.notes).slice(0, 4).join(' · ')}</p>
            <p className="fx-tip">{scent.tip}</p>
            {altScent && <p className="fx-alt">Or: {altScent.fragrance?.name || altScent.family.name}</p>}
          </div>
        )}
        {style && (
          <div className="fx-complete-card fx-hair">
            <HairGlyph icon={style.style.icon} />
            <div>
              <p className="fx-label">Hairstyle</p>
              <h4>{style.style.name}</h4>
              <p>{style.why.length ? `${style.why.slice(0, 2).join(', ')}.` : 'Easy and in keeping with the look.'}</p>
              <p className="fx-tip">{style.style.how}</p>
              {hair[1] && <p className="fx-alt">Or: {hair[1].style.name}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="fx-restyle">
        <span>Adjust:</span>
        <button type="button" onClick={() => onRestyle('formal')}>More formal</button>
        <button type="button" onClick={() => onRestyle('casual')}>More casual</button>
        <button type="button" onClick={() => onRestyle('colour')}>Different colours</button>
        {pieces.some(p => p.slot === 'shoes') && <button type="button" onClick={() => onSwap('shoes')}>Other shoes</button>}
        {pieces.some(p => p.slot === 'bag') && <button type="button" onClick={() => onSwap('bag')}>Another bag</button>}
      </div>

      <footer className="fx-outfit-foot">
        <div className="fx-feedback">
          <button type="button" className={outfit.vote === 'up' ? 'on' : ''} onClick={() => onVote(1)} aria-label="Like this outfit">♥ Love it</button>
          <button type="button" className={outfit.vote === 'down' ? 'on' : ''} onClick={() => onVote(-1)} aria-label="Dislike this outfit">✕ Not for me</button>
          <span className="fx-stars" role="group" aria-label="Rate this outfit">
            {[1, 2, 3, 4, 5].map(n => <button type="button" key={n} className={(outfit.rating || 0) >= n ? 'on' : ''} onClick={() => onRate(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>)}
          </span>
        </div>
        <div className="fx-row">
          <select value={day} onChange={e => { setDay(e.target.value); if (e.target.value) onPlan(e.target.value, meta); }} aria-label="Plan for a day">
            <option value="">Plan for…</option>
            {DAYS.map(d => <option key={d}>{d}</option>)}
          </select>
          <button type="button" className="fc-btn light" onClick={() => onWear(meta)}>✓ Wearing it</button>
          <button type="button" className="fc-btn dark" disabled={outfit.saved} onClick={() => onSave(meta)}>{outfit.saved ? 'Saved ♥' : 'Save look'}</button>
        </div>
      </footer>
    </article>
  );
}

function titleFor(pieces, ctx) {
  const lead = pieces.find(p => p.slot === 'dress') || pieces.find(p => p.slot === 'outer') || pieces.find(p => p.slot === 'top') || pieces[0];
  const colour = lead?.colors?.[0]?.name || '';
  const occ = ctx?.occasion ? OCCASION_BY_ID[ctx.occasion].id : 'Anywhere';
  const words = { Office: 'for the office', College: 'for campus', Casual: 'off duty', 'Going Out': 'after dark', 'Date Night': 'for date night', Party: 'for the party', Brunch: 'for brunch', Travel: 'in transit', 'Road Trip': 'for the open road', Formal: 'for the occasion', Gym: 'in motion', Anywhere: 'for any day' };
  return `${colour} ${(lead?.subcategory || 'look').toLowerCase()}, ${words[occ]}`.trim();
}
