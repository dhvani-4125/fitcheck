import React, { useState } from 'react';
import { signIn, signUp, signOut, sendPasswordReset, setNewPassword } from '../lib/cloud.js';
import { GENDERS, STYLE_FOR, defaultStyleFor } from './Onboarding.jsx';

const STATUS_COPY = { synced: 'Synced', syncing: 'Syncing…', error: 'Sync problem', 'signed-out': 'Not signed in', off: 'Offline only' };

// Sign in / create account / sign out, plus sync status. Used in Profile and from onboarding.
export default function AccountPanel({ sync, notify, compact = false, onSignedIn, profile }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newPw, setNewPw] = useState('');
  const [gender, setGender] = useState(profile?.gender || null);
  const [styleFor, setStyleFor] = useState(profile?.styleFor || null);
  const [name, setName] = useState(profile?.name || '');

  if (!sync.enabled) {
    return (
      <div className="fx-account">
        <p className="fc-muted">Cloud sync isn't set up for this copy of FitCheck, so your wardrobe is saved in this browser only. To turn it on, the site owner adds the free Supabase keys (see README → Accounts & sync).</p>
      </div>
    );
  }

  if (sync.recovery) {
    return (
      <form className="fx-account" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await setNewPassword(newPw); sync.clearRecovery(); notify('Password updated.'); } catch (err) { setError(err.message); } setBusy(false); }}>
        <p className="fx-label">Choose a new password</p>
        <input type="password" minLength={6} required value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" aria-label="New password" />
        <button className="fc-btn dark" disabled={busy}>Save password</button>
        {error && <p className="fx-account-error">{error}</p>}
      </form>
    );
  }

  if (sync.user) {
    return (
      <div className="fx-account">
        <div className="fx-account-status">
          <span className={`fx-sync-dot ${sync.status}`} />
          <div>
            <strong>{sync.user.email}</strong>
            <span>{STATUS_COPY[sync.status]}{sync.lastSynced && sync.status === 'synced' ? ` · ${new Date(sync.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
          </div>
        </div>
        {sync.message && <p className="fx-account-error">{sync.message}</p>}
        <p className="fc-muted">Your profile, wardrobe, looks, plans and photos sync to every device you sign in on.</p>
        <button type="button" className="fc-btn light" onClick={async () => { await signOut(); notify('Signed out. Your wardrobe stays on this device.'); }}>Sign out</button>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'reset') { await sendPasswordReset(email); notify('Check your email for a reset link.'); setMode('signin'); }
      else if (mode === 'signup') {
        if (!gender) { setError('Please choose how you identify. It sets up your profile.'); setBusy(false); return; }
        const { needsConfirmation } = await signUp(email, password, { gender, styleFor: styleFor || defaultStyleFor(gender), name: name.trim() });
        notify(needsConfirmation ? 'Check your email to confirm your account, then sign in.' : 'Account created. Syncing your wardrobe…');
        if (!needsConfirmation) onSignedIn?.();
        if (needsConfirmation) setMode('signin');
      } else { await signIn(email, password); notify('Signed in. Syncing your wardrobe…'); onSignedIn?.(); }
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <form className={`fx-account ${compact ? 'compact' : ''}`} onSubmit={submit}>
      <div className="fx-account-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Create account</button>
      </div>
      <label className="fc-field">Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      {mode === 'signup' && (
        <>
          <p className="fx-label">How do you identify?</p>
          <div className="fx-chips small">{GENDERS.map(g => <button type="button" key={g} className={gender === g ? 'on' : ''} onClick={() => { setGender(g); setStyleFor(defaultStyleFor(g)); }}>{g}</button>)}</div>
          <p className="fx-label">Clothes to style</p>
          <div className="fx-chips small">{STYLE_FOR.map(s => <button type="button" key={s.id} className={styleFor === s.id ? 'on' : ''} onClick={() => setStyleFor(s.id)}>{s.label}</button>)}</div>
          <label className="fc-field">Name <span className="fx-optional">(optional)</span><input value={name} onChange={e => setName(e.target.value)} autoComplete="given-name" /></label>
        </>
      )}
      {mode !== 'reset' && (
        <label className="fc-field">Password<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
      )}
      <button className="fc-btn dark" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account & sync' : mode === 'reset' ? 'Send reset link' : 'Sign in & sync'}</button>
      {mode === 'signin' && <button type="button" className="fc-textbtn" onClick={() => setMode('reset')}>Forgot password?</button>}
      {mode === 'reset' && <button type="button" className="fc-textbtn" onClick={() => setMode('signin')}>← Back to sign in</button>}
      {error && <p className="fx-account-error">{error}</p>}
      {!compact && <p className="fc-muted">Optional. Without an account, everything stays in this browser.</p>}
    </form>
  );
}
