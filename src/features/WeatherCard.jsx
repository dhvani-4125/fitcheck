import React, { useState } from 'react';
import { weatherProfile } from '../ai/stylist.js';

const BAND_COPY = {
  hot: 'Hot: light, breathable pieces and no extra layer.',
  warm: 'Warm: light fabrics, with an optional layer for the evening.',
  mild: 'Mild: easy layers you can take off.',
  cool: 'Cool: add a jacket or knit.',
  cold: 'Cold: warm layers and closed shoes.',
};

export default function WeatherCard({ weather, compact = false }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(!weather.place);
  const { day } = weather;
  const wp = weatherProfile(day);

  const runSearch = async (e) => {
    e.preventDefault();
    setResults(await weather.search(q));
  };

  return (
    <div className={`fx-weather ${compact ? 'compact' : ''}`}>
      <div className="fx-weather-top">
        <span>LOCAL WEATHER</span>
        {weather.place && <button type="button" className="fc-textbtn" onClick={() => setOpen(o => !o)}>{open ? 'Done' : 'Change'}</button>}
      </div>
      {day ? (
        <div className="fx-weather-now">
          <strong>{Math.round(day.temp)}°</strong>
          <div>
            <p>{weather.place?.name}{weather.place?.region ? `, ${weather.place.region}` : ''}</p>
            <span>{day.label} · {day.summary}</span>
          </div>
        </div>
      ) : <p className="fc-muted">Add your location so outfits match today's weather. This is optional: occasion and aesthetic always come first.</p>}
      {day && (
        <ul className="fx-weather-stats">
          <li><span>Feels like</span>{Math.round(day.feels)}°C</li>
          <li><span>Rain</span>{day.rainChance ?? 0}%</li>
          <li><span>Humidity</span>{day.humidity ?? '—'}%</li>
          <li><span>Wind</span>{Math.round(day.wind ?? 0)} km/h</li>
        </ul>
      )}
      {wp && <p className="fx-weather-advice">{BAND_COPY[wp.band]}{wp.rainy ? ' Rain-friendly shoes.' : ''}{wp.windy ? ' Windy, so secure layers.' : ''}{wp.humid ? ' Humid, so keep fabrics light.' : ''}</p>}
      {weather.forecast && !compact && (
        <div className="fx-day-picker">
          {weather.forecast.days.map((d, i) => (
            <button type="button" key={d.date} className={i === weather.dayIndex ? 'on' : ''} onClick={() => weather.setDayIndex(i)}>
              <span>{i < 2 ? d.label : d.label.slice(0, 3)}</span><strong>{Math.round(d.high)}°/{Math.round(d.low)}°</strong>
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="fx-weather-form">
          <button type="button" className="fc-btn light" onClick={weather.useMyLocation}>◎ Use my location</button>
          <form onSubmit={runSearch} className="fx-city-search">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="or search a city…" aria-label="City" />
            <button className="fc-btn dark" type="submit">Search</button>
          </form>
          {results.length > 0 && (
            <ul className="fx-city-results">
              {results.map(r => <li key={`${r.lat},${r.lon}`}><button type="button" onClick={() => { weather.choose(r); setResults([]); setOpen(false); }}>{r.name}<span>{r.region}</span></button></li>)}
            </ul>
          )}
          {weather.place && <button type="button" className="fc-textbtn" onClick={weather.clear}>Turn weather off</button>}
        </div>
      )}
      {weather.status && <p className="fx-weather-status">{weather.status}</p>}
    </div>
  );
}
