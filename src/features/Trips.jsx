import React, { useMemo, useState } from 'react';
import { ACTIVITIES, planTrip, tripDates } from '../ai/trips.js';
import { cityStyle } from '../ai/shopping.js';
import { swapPiece } from '../ai/stylist.js';
import { AESTHETICS } from '../ai/attributes.js';
import { fetchRangeWeather } from '../ai/weather.js';
import { OutfitCard } from './Stylist.jsx';
import CityPicker from './CityPicker.jsx';
import { Img, Chips, PageHeading } from './shared.jsx';

const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export default function Trips({ items, srcOf, trips, setTrips, prefs, history, profile, audience, onAskFriends, onSaveLook, notify, onUpload }) {
  const [draft, setDraft] = useState({ place: null, startDate: plusDays(14), nights: 4, aesthetic: null, activities: {} });
  const [activeId, setActiveId] = useState(trips[0]?.id || null);
  const [busy, setBusy] = useState(false);
  const active = trips.find(t => t.id === activeId) || null;
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const dates = tripDates(draft.startDate, draft.nights);
  const city = cityStyle(draft.place?.name || '');

  const run = async (e) => {
    e?.preventDefault?.();
    if (!draft.place) { notify('Pick your destination first.'); return; }
    if (!items.length) { notify('Upload your wardrobe first.'); return; }
    setBusy(true);
    let weatherDays = [];
    try { weatherDays = await fetchRangeWeather(draft.place, dates[0], dates[dates.length - 1]); } catch { notify('Couldn’t fetch the weather, so planning without it.'); }
    const destination = `${draft.place.name}${draft.place.region ? `, ${draft.place.region}` : ''}`;
    const plan = planTrip(items, { destination, startDate: draft.startDate, nights: draft.nights, activities: draft.activities }, { weatherDays, prefs, history, audience, aesthetic: draft.aesthetic, seed: Date.now() % 100000 });
    const trip = { id: `trip-${Date.now()}`, destination, place: draft.place, startDate: draft.startDate, nights: draft.nights, aesthetic: draft.aesthetic, activities: draft.activities, plan, created: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setTrips(list => [trip, ...list]);
    setActiveId(trip.id);
    setBusy(false);
  };
  const setDay = (date, patch) => setTrips(list => list.map(t => t.id !== active.id ? t : { ...t, updatedAt: new Date().toISOString(), plan: { ...t.plan, days: t.plan.days.map(d => d.date === date ? { ...d, ...patch } : d) } }));

  return (
    <main className="fc-page">
      <PageHeading kicker="TRIPS" title="Pack light," em="look great."
        text="Tell FitCheck where you're going. It checks the weather for your dates, plans a look for every day from your own wardrobe, re-uses pieces so you pack less, and suggests the one or two things worth buying before you go." />

      <div className="fx-planner-grid">
        <aside className="fx-brief">
          <form onSubmit={run}>
            <CityPicker value={draft.place} onPick={p => setDraft(d => ({ ...d, place: p }))} label="Destination" placeholder="e.g. Paris, Goa, Dubai" />
            {city && <p className="fx-city-vibe">✦ {city.name}: {city.vibe}</p>}
            <div className="fc-form-grid">
              <label className="fc-field">Leaving<input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label>
              <label className="fc-field">Nights<input type="number" min="1" max="14" value={draft.nights} onChange={e => setDraft({ ...draft, nights: Math.max(1, Math.min(14, Number(e.target.value) || 1)) })} /></label>
            </div>
            <p className="fx-label">Style for this trip <span className="fx-optional">(optional)</span></p>
            <Chips options={AESTHETICS.filter(a => a !== 'Sporty')} value={draft.aesthetic} onChange={v => setDraft({ ...draft, aesthetic: v })} />
            <p className="fx-label">What are you doing each day?</p>
            <ul className="fx-day-activities">
              {dates.map((d, i) => (
                <li key={d}>
                  <span>{fmt(d)}</span>
                  <select value={draft.activities[d] || (i === 0 || i === dates.length - 1 ? 'Travel day' : 'Sightseeing')} onChange={e => setDraft({ ...draft, activities: { ...draft.activities, [d]: e.target.value } })}>
                    {Object.keys(ACTIVITIES).map(a => <option key={a}>{a}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            <button className="fc-btn dark fx-full-btn" type="submit" disabled={busy}>{busy ? 'Planning…' : '✈ Plan my trip'}</button>
          </form>
          {trips.length > 0 && (
            <>
              <p className="fx-label">Your trips</p>
              <ul className="fx-event-list">
                {trips.map(t => <li key={t.id}><button type="button" className={t.id === activeId ? 'on' : ''} onClick={() => setActiveId(t.id)}><strong>{t.destination.split(',')[0]}</strong><span>{fmt(t.startDate)} · {t.nights} night{t.nights === 1 ? '' : 's'}</span></button></li>)}
              </ul>
            </>
          )}
        </aside>

        <section className="fx-results">
          {!items.length && <div className="fx-empty-results"><h2>Add your wardrobe first.</h2><p className="fc-muted">The trip planner packs from clothes you own.</p><button className="fc-btn dark" onClick={onUpload}>⇪ Upload photos</button></div>}
          {items.length > 0 && !active && <div className="fx-empty-results"><p className="fc-kicker">WHERE TO?</p><h2>Plan your first trip.</h2><p className="fc-muted">Try “Paris” for five nights. You'll get daily outfits, a packing list and Paris essentials to shop.</p></div>}
          {active && (
            <>
              <div className="fx-event-head">
                <div>
                  <p className="fc-kicker">{fmt(active.startDate)} · {active.nights} NIGHTS{active.plan.city ? ` · ${active.plan.city.vibe.toUpperCase()}` : ''}</p>
                  <h2>{active.destination}</h2>
                  <p className="fc-muted">{active.plan.weatherKind === 'typical' ? 'Your dates are more than two weeks away, so this uses last year’s weather for the same dates as a guide.' : 'Based on the live forecast for your dates.'}</p>
                </div>
                <button className="fc-textbtn" onClick={() => { if (window.confirm('Delete this trip?')) { setTrips(l => l.filter(t => t.id !== active.id)); setActiveId(null); } }}>Delete</button>
              </div>

              {active.plan.city && (
                <div className="fx-trip-tips">
                  <p className="fx-label">Dressing for {active.plan.city.name}</p>
                  <ul>{active.plan.city.tips.map(t => <li key={t}>{t}</li>)}</ul>
                </div>
              )}

              <div className="fx-trip-weather">
                {active.plan.days.map(d => d.weather && <div key={d.date}><span>{fmt(d.date)}</span><strong>{Math.round(d.weather.high)}° / {Math.round(d.weather.low)}°</strong><em>{d.weather.summary}{d.weather.rainChance >= 50 ? ' · ☔' : ''}</em></div>)}
              </div>

              <div className="fx-packing">
                <p className="fx-label">Packing list · {active.plan.packing.length} pieces for {active.plan.days.length} days</p>
                <div className="fx-packing-grid">
                  {active.plan.packing.map(({ item, days }) => (
                    <figure key={item.id}><Img src={srcOf(item)} alt={item.name} /><figcaption>{item.name}<span>worn {days}×</span></figcaption></figure>
                  ))}
                </div>
              </div>

              {active.plan.buys.length > 0 && (
                <div className="fx-trip-buys">
                  <p className="fx-label">Worth buying before you go</p>
                  {active.plan.buys.map(b => (
                    <div className="fx-shop" key={b.query}>
                      <div><h4>{b.title}</h4><p>{b.why}</p></div>
                      <div className="fx-shop-links">{b.links.map(l => <a key={l.store} href={l.url} target="_blank" rel="noopener noreferrer">{l.store} ↗</a>)}</div>
                    </div>
                  ))}
                </div>
              )}

              {active.plan.days.map((d, i) => d.outfit ? (
                <OutfitCard key={d.date} index={i} outfit={d.outfit} byId={byId} srcOf={srcOf} profile={profile} prefs={prefs}
                  ctx={{ occasion: d.occasion, weather: d.weather, audience, destination: active.destination, aesthetic: active.aesthetic || active.plan.city?.aesthetic }}
                  kicker={`DAY ${i + 1} · ${fmt(d.date).toUpperCase()} · ${d.activity.toUpperCase()}`} hidePlan
                  onSwap={(slot) => { const next = swapPiece(d.outfit, slot, items, { occasion: d.occasion, weather: d.weather, audience, prefs }); if (next.notice) notify(next.notice); else setDay(d.date, { outfit: next }); }}
                  onAskFriends={onAskFriends ? (meta) => onAskFriends(d.outfit, { ...meta, occasion: d.occasion, label: `${active.destination.split(',')[0]} · day ${i + 1}` }) : null}
                  onSave={(meta) => { onSaveLook(d.outfit, { ...meta, occasion: d.occasion }); setDay(d.date, { outfit: { ...d.outfit, saved: true } }); }}
                />
              ) : <p key={d.date} className="fx-results-msg">{fmt(d.date)}: not enough pieces for a full look.</p>)}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
