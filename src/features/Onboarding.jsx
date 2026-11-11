import React, { useState } from 'react';
import { HAIR_LENGTHS, HAIR_TEXTURES } from '../ai/hair.js';

export const GENDERS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];
export const STYLE_FOR = [
  { id: 'Women', label: 'Womenswear' },
  { id: 'Men', label: 'Menswear' },
  { id: 'Everyone', label: 'Both / gender-neutral' },
];
export const defaultStyleFor = (gender) => (gender === 'Woman' ? 'Women' : gender === 'Man' ? 'Men' : 'Everyone');

// First-run registration. Gender comes first; nothing is saved until it is chosen.
export default function Onboarding({ onComplete, onSignIn }) {
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState(null);
  const [styleFor, setStyleFor] = useState(null);
  const [name, setName] = useState('');
  const [length, setLength] = useState(null);
  const [texture, setTexture] = useState(null);

  const pickGender = (g) => { setGender(g); setStyleFor(defaultStyleFor(g)); };
  const finish = (e) => {
    e?.preventDefault?.();
    onComplete({ gender, styleFor: styleFor || defaultStyleFor(gender), name: name.trim(), hair: { length, texture } });
  };

  return (
    <div className="fc-modal-backdrop fx-onboard-backdrop">
      <form className="fc-modal fx-onboard" onSubmit={finish} aria-labelledby="fx-onboard-title">
        <p className="fc-kicker">WELCOME TO FITCHECK · STEP {step + 1} OF 2</p>
        {step === 0 ? (
          <>
            <h2 id="fx-onboard-title">First, <em>how do you identify?</em></h2>
            <p className="fc-muted">This sets up your profile so suggestions, from silhouettes to hairstyles, suit you. You can change it later in Profile.</p>
            <div className="fx-onboard-options" role="radiogroup" aria-label="Gender">
              {GENDERS.map(g => (
                <button type="button" role="radio" aria-checked={gender === g} key={g} className={gender === g ? 'on' : ''} onClick={() => pickGender(g)}>{g}</button>
              ))}
            </div>
            <div className="fc-modal-actions">
              <span className="fc-muted">Required to create your profile</span>
              <button type="button" className="fc-btn dark" disabled={!gender} onClick={() => setStep(1)}>Continue ↗</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="fx-onboard-title">A little more <em>about you.</em></h2>
            <label className="fc-field">What should we call you? <span className="fx-optional">(optional)</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your first name" autoFocus />
            </label>
            <p className="fx-label">Which clothes should FitCheck style?</p>
            <div className="fx-chips">
              {STYLE_FOR.map(s => <button type="button" key={s.id} className={styleFor === s.id ? 'on' : ''} onClick={() => setStyleFor(s.id)}>{s.label}</button>)}
            </div>
            <p className="fx-label">Hair length <span className="fx-optional">(optional, for hairstyle ideas)</span></p>
            <div className="fx-chips">{HAIR_LENGTHS.map(l => <button type="button" key={l} className={length === l ? 'on' : ''} onClick={() => setLength(length === l ? null : l)}>{l}</button>)}</div>
            <p className="fx-label">Hair texture <span className="fx-optional">(optional)</span></p>
            <div className="fx-chips">{HAIR_TEXTURES.map(t => <button type="button" key={t} className={texture === t ? 'on' : ''} onClick={() => setTexture(texture === t ? null : t)}>{t}</button>)}</div>
            <div className="fc-modal-actions">
              <button type="button" className="fc-textbtn" onClick={() => setStep(0)}>← Back</button>
              <button type="submit" className="fc-btn dark">Create my profile ↗</button>
            </div>
          </>
        )}
        {onSignIn && step === 0 && <p className="fx-onboard-signin">Already set up FitCheck on another device? <button type="button" className="fc-textbtn" onClick={onSignIn}>Sign in to restore it</button></p>}
        <p className="fx-onboard-privacy">{onSignIn ? 'Saved in this browser. Create a free account later to sync across devices.' : 'Your profile and wardrobe are saved only in this browser.'}</p>
      </form>
    </div>
  );
}
