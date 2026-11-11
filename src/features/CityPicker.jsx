import React, { useState } from 'react';
import { geocodeCity } from '../ai/weather.js';

// Search a city (Open-Meteo geocoding, free) and pick one result.
export default function CityPicker({ value, onPick, placeholder = 'Search a city…', label = 'City' }) {
  const [q, setQ] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = async () => {
    if (!q.trim()) return;
    setBusy(true); setError('');
    try { const r = await geocodeCity(q); setResults(r); if (!r.length) setError('No places found. Try another spelling.'); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <div className="fx-citypicker">
      <span className="fx-citypicker-label">{label}</span>
      <div className="fx-city-search">
        <input value={q} onChange={e => { setQ(e.target.value); if (value) onPick(null); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} placeholder={placeholder} aria-label={label} />
        <button type="button" className="fc-btn dark" onClick={search} disabled={busy}>{busy ? '…' : 'Find'}</button>
      </div>
      {value && <p className="fx-city-chosen">📍 {value.name}{value.region ? `, ${value.region}` : ''}</p>}
      {!value && results.length > 0 && (
        <ul className="fx-city-results">
          {results.map(r => <li key={`${r.lat},${r.lon}`}><button type="button" onClick={() => { onPick(r); setQ(r.name); setResults([]); }}>{r.name}<span>{r.region}</span></button></li>)}
        </ul>
      )}
      {error && <p className="fx-weather-status">{error}</p>}
    </div>
  );
}
