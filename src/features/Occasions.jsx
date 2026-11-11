import React, { useMemo, useState } from 'react';
import { EVENT_TYPES, ROLES, makeEvent, planEvent, repeatsAcrossFunctions, guestAvoid } from '../ai/events.js';
import { STYLIST_OCCASIONS, OCCASION_BY_ID } from '../ai/attributes.js';
import { swapPiece } from '../ai/stylist.js';
import { fetchRangeWeather } from '../ai/weather.js';
import { NAMED_COLORS, hexForName } from '../ai/colors.js';
import { OutfitCard } from './Stylist.jsx';
import CityPicker from './CityPicker.jsx';
import { PageHeading } from './shared.jsx';

const THEME_COLOURS = ['Yellow', 'Mustard', 'Gold', 'Orange', 'Red', 'Pink', 'Green', 'Sage', 'Teal', 'Blue', 'Navy', 'Lilac', 'Purple', 'Wine', 'White', 'Ivory', 'Silver', 'Black'];
const OCCASION_OPTIONS = STYLIST_OCCASIONS.filter(o => o.indian || ['Party', 'Formal', 'Date Night', 'Brunch'].includes(o.id));
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export default function Occasions({ items, srcOf, events, setEvents, prefs, history, profile, audience, onAskFriends, onSaveLook, notify, onUpload }) {
  const [draft, setDraft] = useState({ type: 'wedding', title: '', place: null, startDate: today(), role: 'Guest' });
  const [activeId, setActiveId] = useState(events[0]?.id || null);
  const [busy, setBusy] = useState(false);
  const active = events.find(e => e.id === activeId) || null;
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const update = (ev) => setEvents(list => list.map(e => (e.id === ev.id ? { ...ev, updatedAt: new Date().toISOString() } : e)));
  const create = (e) => {
    e.preventDefault();
    const ev = { ...makeEvent({ ...draft, city: draft.place?.name || '' }), place: draft.place };
    setEvents(list => [ev, ...list]);
    setActiveId(ev.id);
    setDraft(d => ({ ...d, title: '' }));
    notify('Event created. Check the functions below, then tap "Plan my looks".');
  };
  const setFn = (fnId, patch) => update({ ...active, functions: active.functions.map(f => (f.id === fnId ? { ...f, ...patch } : f)) });

  const plan = async () => {
    if (!items.length) { notify('Upload your wardrobe first.'); return; }
    setBusy(true);
    let weatherByDate = {};
    try {
      if (active.place) {
        const dates = active.functions.map(f => f.date).sort();
        const days = await fetchRangeWeather(active.place, dates[0], dates[dates.length - 1]);
        weatherByDate = Object.fromEntries(days.map(d => [d.date, d]));
      }
    } catch { notify('Couldn’t fetch the weather, so planning without it.'); }
    const planned = planEvent(items, active, { weatherByDate, prefs, history, audience, seed: Date.now() % 100000 });
    update(planned);
    setBusy(false);
    notify('Your looks are planned for every function.');
  };

  const ctxFor = (fn) => ({ occasion: fn.occasion, theme: fn.theme, avoidColours: fn.avoid, weather: fn.plan?.weather || null, audience });
  const repeats = active ? repeatsAcrossFunctions(active, items) : [];

  return (
    <main className="fc-page">
      <PageHeading kicker="WEDDINGS & FESTIVE" title="Every function," em="planned."
        text="Haldi, mehndi, sangeet, the wedding and the reception. Get a different look for each from your own wardrobe, matched to the colour theme and the weather, with jewellery, hair and fragrance to finish." />

      <div className="fx-planner-grid">
        <aside className="fx-brief">
          <form onSubmit={create}>
            <p className="fx-label">New event</p>
            <div className="fx-chips">
              {Object.entries(EVENT_TYPES).map(([id, t]) => <button type="button" key={id} className={draft.type === id ? 'on' : ''} onClick={() => setDraft({ ...draft, type: id })}>{t.label}</button>)}
            </div>
            <label className="fc-field">Name<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder={draft.type === 'wedding' ? "e.g. Riya & Karan's wedding" : EVENT_TYPES[draft.type].label} /></label>
            <div className="fc-form-grid">
              <label className="fc-field">First function<input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} required /></label>
              <label className="fc-field">You are<select value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></label>
            </div>
            <CityPicker value={draft.place} onPick={p => setDraft(d => ({ ...d, place: p }))} label="Where (for the weather)" placeholder="e.g. Udaipur" />
            <button className="fc-btn dark fx-full-btn" type="submit">＋ Create event</button>
          </form>
          {events.length > 0 && (
            <>
              <p className="fx-label">Your events</p>
              <ul className="fx-event-list">
                {events.map(ev => (
                  <li key={ev.id}><button type="button" className={ev.id === activeId ? 'on' : ''} onClick={() => setActiveId(ev.id)}><strong>{ev.title}</strong><span>{fmt(ev.functions[0]?.date || ev.startDate)} · {ev.functions.length} function{ev.functions.length === 1 ? '' : 's'}{ev.city ? ` · ${ev.city}` : ''}</span></button></li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <section className="fx-results">
          {!items.length && <div className="fx-empty-results"><h2>Add your wardrobe first.</h2><p className="fc-muted">Upload your lehengas, kurtas, sarees, jewellery and juttis. The planner only uses what you own.</p><button className="fc-btn dark" onClick={onUpload}>⇪ Upload photos</button></div>}
          {items.length > 0 && !active && <div className="fx-empty-results"><p className="fc-kicker">SHAADI SEASON</p><h2>Create your first event.</h2><p className="fc-muted">Pick “Indian wedding” and the functions are set up for you. You can edit dates, colour themes and indoor or outdoor for each.</p></div>}
          {active && (
            <>
              <div className="fx-event-head">
                <div>
                  <p className="fc-kicker">{EVENT_TYPES[active.type]?.label.toUpperCase()} · {active.role.toUpperCase()}</p>
                  <h2>{active.title}</h2>
                  <p className="fc-muted">{active.city ? `📍 ${active.city} · ` : ''}{active.functions.length} functions</p>
                </div>
                <div className="fx-row">
                  <button className="fc-btn dark" onClick={plan} disabled={busy}>{busy ? 'Planning…' : active.functions.some(f => f.plan) ? '↻ Re-plan unlocked looks' : '✦ Plan my looks'}</button>
                  <button className="fc-textbtn" onClick={() => { if (window.confirm(`Delete “${active.title}”?`)) { setEvents(l => l.filter(e => e.id !== active.id)); setActiveId(null); } }}>Delete</button>
                </div>
              </div>

              <div className="fx-functions">
                {[...active.functions].sort((a, b) => a.date.localeCompare(b.date)).map(fn => (
                  <details key={fn.id} className="fx-function-edit">
                    <summary><strong>{fn.name}</strong><span>{fmt(fn.date)} · {OCCASION_BY_ID[fn.occasion]?.label}{fn.theme.length ? ` · ${fn.theme.join(', ')}` : ''}{fn.outdoor ? ' · outdoor' : ''}</span><em>Edit</em></summary>
                    <div className="fc-form-grid">
                      <label className="fc-field">Name<input value={fn.name} onChange={e => setFn(fn.id, { name: e.target.value })} /></label>
                      <label className="fc-field">Date<input type="date" value={fn.date} onChange={e => setFn(fn.id, { date: e.target.value })} /></label>
                      <label className="fc-field">Type<select value={fn.occasion} onChange={e => setFn(fn.id, { occasion: e.target.value, avoid: guestAvoid(active.role, e.target.value) })}>{OCCASION_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
                      <label className="fx-check fx-check-inline"><input type="checkbox" checked={fn.outdoor} onChange={e => setFn(fn.id, { outdoor: e.target.checked })} /> Outdoor</label>
                    </div>
                    <p className="fx-label">Colour theme / dress code</p>
                    <div className="fx-theme-chips">
                      {THEME_COLOURS.map(c => (
                        <button type="button" key={c} className={fn.theme.includes(c) ? 'on' : ''} onClick={() => setFn(fn.id, { theme: fn.theme.includes(c) ? fn.theme.filter(x => x !== c) : [...fn.theme, c] })}>
                          <i style={{ background: hexForName(c) }} />{c}
                        </button>
                      ))}
                    </div>
                    {fn.avoid?.length > 0 && <p className="fc-muted">Avoiding {fn.avoid.join(' & ').toLowerCase()} (guest etiquette). <button type="button" className="fc-textbtn" onClick={() => setFn(fn.id, { avoid: [] })}>Allow anyway</button></p>}
                    <button type="button" className="fc-textbtn" onClick={() => update({ ...active, functions: active.functions.filter(f => f.id !== fn.id) })}>Remove function</button>
                  </details>
                ))}
                <button type="button" className="fc-btn light" onClick={() => update({ ...active, functions: [...active.functions, { id: `fn-${Date.now()}`, name: 'New function', occasion: 'Festive', date: active.functions.at(-1)?.date || active.startDate, theme: [], outdoor: false, avoid: [], plan: null }] })}>＋ Add function</button>
              </div>

              {repeats.length > 0 && <p className="fx-results-msg">Heads up: {repeats.map(r => `${r.item} is in both ${r.functions.join(' and ')}`).join('; ')}.</p>}

              {[...active.functions].sort((a, b) => a.date.localeCompare(b.date)).filter(fn => fn.plan).map(fn => (
                fn.plan.outfit ? (
                  <div key={fn.id} className="fx-function-look">
                    <OutfitCard index={0} outfit={fn.plan.outfit} byId={byId} srcOf={srcOf} ctx={ctxFor(fn)} profile={profile} prefs={prefs}
                      kicker={`${fn.name.toUpperCase()} · ${fmt(fn.date)}${fn.plan.weather ? ` · ${Math.round(fn.plan.weather.feels)}°C${fn.plan.weather.typical ? ' (typical)' : ''}` : ''}`}
                      notes={fn.plan.notes} buy={fn.plan.buy} hidePlan
                      onSwap={(slot) => { const next = swapPiece(fn.plan.outfit, slot, items, { ...ctxFor(fn), prefs }); if (next.notice) notify(next.notice); else setFn(fn.id, { plan: { ...fn.plan, outfit: next } }); }}
                      onAskFriends={onAskFriends ? (meta) => onAskFriends(fn.plan.outfit, { ...meta, occasion: fn.occasion, label: fn.name }) : null}
                      onSave={(meta) => { onSaveLook(fn.plan.outfit, { ...meta, occasion: fn.occasion }); setFn(fn.id, { plan: { ...fn.plan, outfit: { ...fn.plan.outfit, saved: true } } }); }}
                    />
                    <div className="fx-function-actions">
                      {fn.plan.alternates.length > 0 && <button type="button" className="fc-btn light" onClick={() => { const [next, ...rest] = fn.plan.alternates; setFn(fn.id, { plan: { ...fn.plan, outfit: next, alternates: [...rest, fn.plan.outfit] } }); }}>Show another option</button>}
                      <button type="button" className={fn.plan.locked ? 'fc-btn dark' : 'fc-btn light'} onClick={() => setFn(fn.id, { plan: { ...fn.plan, locked: !fn.plan.locked } })}>{fn.plan.locked ? '🔒 Locked in' : 'Lock this look'}</button>
                    </div>
                  </div>
                ) : (
                  <div key={fn.id} className="fx-outfit">
                    <p className="fc-kicker">{fn.name.toUpperCase()} · {fmt(fn.date)}</p>
                    <h3 className="fx-noplan">Nothing in your wardrobe fits this one yet</h3>
                    <ul className="fx-why">{fn.plan.notes.map(n => <li key={n}>{n}</li>)}</ul>
                    {fn.plan.buy && <div className="fx-shop"><div><p className="fx-label">Complete the look · shop</p><h4>{fn.plan.buy.title}</h4><p>{fn.plan.buy.why}</p></div><div className="fx-shop-links">{fn.plan.buy.links.map(l => <a key={l.store} href={l.url} target="_blank" rel="noopener noreferrer">{l.store} ↗</a>)}</div></div>}
                  </div>
                )
              ))}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
export { NAMED_COLORS };
