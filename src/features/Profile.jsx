import React, { useRef, useState } from 'react';
import { HAIRSTYLES, HAIR_LENGTHS, HAIR_TEXTURES, HAIR_BY_ID } from '../ai/hair.js';
import { FRAGRANCE_FAMILIES, FAMILY_BY_ID } from '../ai/fragrance.js';
import { summarisePrefs, emptyPrefs } from '../ai/stylist.js';
import { fileToDataUrl } from '../ai/vision.js';
import { Chips, HairGlyph, PageHeading } from './shared.jsx';
import { GENDERS, STYLE_FOR } from './Onboarding.jsx';
import AccountPanel from './AccountPanel.jsx';

const emptyFragrance = { name: '', brand: '', family: 'citrus', notes: '', intensity: '' };

export default function Profile({ profile, setProfile, prefs, setPrefs, notify, onStyleFor, sync }) {
  const [f, setF] = useState(emptyFragrance);
  const photoRef = useRef(null);
  const hair = profile.hair || {};
  const fp = profile.fragrancePrefs || {};
  const setHair = (patch) => setProfile(p => ({ ...p, hair: { ...p.hair, ...patch } }));
  const setFp = (patch) => setProfile(p => ({ ...p, fragrancePrefs: { ...p.fragrancePrefs, ...patch } }));
  const toggleIn = (list = [], v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const learned = summarisePrefs(prefs);

  const addFragrance = (e) => {
    e.preventDefault();
    if (!f.name.trim()) { notify('Give the fragrance a name.'); return; }
    setProfile(p => ({ ...p, fragrances: [{ ...f, id: `frag-${Date.now()}`, notes: f.notes.trim() || FAMILY_BY_ID[f.family].notes.slice(0, 3).join(', ') }, ...(p.fragrances || [])] }));
    setF(emptyFragrance);
    notify('Added to your fragrance collection.');
  };

  return (
    <main className="fc-page">
      <PageHeading kicker="PHASES 5–6 · COMPLETE LOOK & PERSONALISATION" title="Your style" em="profile."
        text="Tell FitCheck about your hair and fragrances, and see what it has learned from your likes, ratings and the outfits you wear." />

      <div className="fx-profile-grid">
        {sync && (
          <section className="fx-panel fx-span fx-account-section">
            <p className="fc-kicker">ACCOUNT & SYNC</p>
            <h2>{sync.user ? 'Synced across your devices' : 'Use FitCheck on every device'}</h2>
            <AccountPanel sync={sync} notify={notify} />
          </section>
        )}
        <section className="fx-panel fx-span">
          <p className="fc-kicker">ABOUT YOU</p>
          <h2>{profile.name ? `${profile.name}'s profile` : 'Your profile'}</h2>
          <div className="fc-form-grid">
            <label className="fc-field">Name<input value={profile.name || ''} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Optional" /></label>
            <div />
          </div>
          <p className="fx-label">Gender</p>
          <Chips options={GENDERS} value={profile.gender} allowNone={false} onChange={g => setProfile(p => ({ ...p, gender: g }))} />
          <p className="fx-label">Clothes FitCheck styles</p>
          <Chips options={STYLE_FOR.map(s => s.id)} labels={Object.fromEntries(STYLE_FOR.map(s => [s.id, s.label]))} value={profile.styleFor} allowNone={false}
            onChange={s => { setProfile(p => ({ ...p, styleFor: s })); onStyleFor?.(s); }} />
        </section>

        <section className="fx-panel">
          <p className="fc-kicker">HAIR</p>
          <h2>Hair characteristics</h2>
          <p className="fx-label">Length</p>
          <Chips options={HAIR_LENGTHS} value={hair.length} onChange={v => setHair({ length: v })} />
          <p className="fx-label">Texture</p>
          <Chips options={HAIR_TEXTURES} value={hair.texture} onChange={v => setHair({ texture: v })} />
          <p className="fx-label">Styles you love (recommended more often) · tap again to avoid</p>
          <div className="fx-hair-grid">
            {HAIRSTYLES.map(s => {
              const state = (hair.preferred || []).includes(s.id) ? 'love' : (hair.avoid || []).includes(s.id) ? 'avoid' : '';
              const cycle = () => {
                if (!state) setHair({ preferred: [...(hair.preferred || []), s.id] });
                else if (state === 'love') setHair({ preferred: (hair.preferred || []).filter(x => x !== s.id), avoid: [...(hair.avoid || []), s.id] });
                else setHair({ avoid: (hair.avoid || []).filter(x => x !== s.id) });
              };
              return (
                <button type="button" key={s.id} className={`fx-hair-option ${state}`} onClick={cycle}>
                  <HairGlyph icon={s.icon} /><span>{s.name}</span>{state && <em>{state === 'love' ? '♥ love' : '✕ avoid'}</em>}
                </button>
              );
            })}
          </div>
          <p className="fx-label">Reference photo (optional, stays on this device)</p>
          <div className="fx-ref-photo">
            {hair.photo ? <img src={hair.photo} alt="Your hair reference" /> : <div className="fx-ref-empty">No photo</div>}
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={async e => { const file = e.target.files?.[0]; if (file) setHair({ photo: await shrink(await fileToDataUrl(file)) }); }} />
            <div className="fx-row">
              <button type="button" className="fc-btn light" onClick={() => photoRef.current?.click()}>{hair.photo ? 'Replace' : 'Upload'}</button>
              {hair.photo && <button type="button" className="fc-textbtn" onClick={() => setHair({ photo: null })}>Remove</button>}
            </div>
          </div>
        </section>

        <section className="fx-panel">
          <p className="fc-kicker">FRAGRANCE</p>
          <h2>Your collection</h2>
          <p className="fc-muted">The stylist suggests bottles you already own first, then fragrance profiles to try.</p>
          <form className="fx-frag-form" onSubmit={addFragrance}>
            <div className="fc-form-grid">
              <label className="fc-field">Name<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Neroli Portofino" /></label>
              <label className="fc-field">Brand<input value={f.brand} onChange={e => setF({ ...f, brand: e.target.value })} placeholder="Optional" /></label>
              <label className="fc-field">Scent family<select value={f.family} onChange={e => setF({ ...f, family: e.target.value })}>{FRAGRANCE_FAMILIES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="fc-field">Strength<select value={f.intensity} onChange={e => setF({ ...f, intensity: e.target.value })}><option value="">Typical for family</option><option value="1">Light</option><option value="2">Moderate</option><option value="3">Rich</option></select></label>
            </div>
            <label className="fc-field">Key notes (comma separated)<input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder={FAMILY_BY_ID[f.family].notes.slice(0, 3).join(', ')} /></label>
            <button className="fc-btn dark" type="submit">＋ Add fragrance</button>
          </form>
          <ul className="fx-frag-list">
            {(profile.fragrances || []).map(x => (
              <li key={x.id}>
                <div><strong>{x.name}</strong>{x.brand && <span> — {x.brand}</span>}<p>{FAMILY_BY_ID[x.family]?.name} · {x.notes}</p></div>
                <button type="button" className="fc-textbtn" onClick={() => setProfile(p => ({ ...p, fragrances: p.fragrances.filter(y => y.id !== x.id) }))}>Remove</button>
              </li>
            ))}
            {!(profile.fragrances || []).length && <li className="fc-muted">No fragrances yet.</li>}
          </ul>
          <p className="fx-label">Families you like</p>
          <div className="fx-chips small">{FRAGRANCE_FAMILIES.map(x => <button type="button" key={x.id} className={(fp.families || []).includes(x.id) ? 'on' : ''} onClick={() => setFp({ families: toggleIn(fp.families, x.id) })}>{x.name}</button>)}</div>
          <div className="fc-form-grid">
            <label className="fc-field">Preferred strength<select value={fp.intensity || ''} onChange={e => setFp({ intensity: e.target.value })}><option value="">Depends on occasion</option><option value="soft">Soft, close to skin</option><option value="strong">Noticeable</option></select></label>
            <label className="fc-field">Longevity<select value={fp.longevity || ''} onChange={e => setFp({ longevity: e.target.value })}><option value="">No preference</option><option value="long">Long-lasting</option></select></label>
          </div>
          <label className="fc-field">Notes you dislike<input value={(fp.dislikedNotes || []).join(', ')} onChange={e => setFp({ dislikedNotes: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} placeholder="e.g. vanilla, oud" /></label>
        </section>

        <section className="fx-panel fx-learned">
          <p className="fc-kicker">PERSONAL STYLE LEARNING</p>
          <h2>What FitCheck has learned</h2>
          <p className="fc-muted">Learned from {learned.signals} pieces you've liked or disliked, plus your ratings and the outfits you've marked as worn. Future suggestions lean towards these.</p>
          <dl>
            <dt>Favourite colours</dt><dd>{learned.colours.join(', ') || '—'}</dd>
            <dt>Colours you skip</dt><dd>{learned.avoidColours.join(', ') || '—'}</dd>
            <dt>Aesthetics</dt><dd>{learned.aesthetics.join(', ') || '—'}</dd>
            <dt>Fits</dt><dd>{learned.fits.join(', ') || '—'}</dd>
            <dt>Frequent occasions</dt><dd>{learned.occasions.join(', ') || '—'}</dd>
            <dt>Fragrance families</dt><dd>{learned.fragranceFamilies.map(x => FAMILY_BY_ID[x]?.name || x).join(', ') || '—'}</dd>
            <dt>Hairstyles</dt><dd>{learned.hairStyles.map(x => HAIR_BY_ID[x]?.name || x).join(', ') || '—'}</dd>
            <dt>Combinations avoided</dt><dd>{learned.dislikedCombos}</dd>
          </dl>
          <button type="button" className="fc-textbtn" onClick={() => { if (window.confirm('Reset everything FitCheck has learned about your style?')) { setPrefs(emptyPrefs()); notify('Style learning reset.'); } }}>Reset learning</button>
        </section>
      </div>
    </main>
  );
}

async function shrink(dataUrl, max = 420) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = img.width * k; c.height = img.height * k;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
