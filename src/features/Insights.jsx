import React, { useMemo } from 'react';
import { computeInsights, gapAnalysis } from '../ai/insights.js';
import { GROUP_ORDER } from '../ai/attributes.js';
import { Img, PageHeading, fmtMoney } from './shared.jsx';

export default function Insights({ items, history, srcOf, audience, onEdit, onOpenStylist }) {
  const pool = useMemo(() => items.filter(i => audience === 'Everyone' || !i.audience || i.audience === 'Everyone' || i.audience === audience), [items, audience]);
  const ins = useMemo(() => computeInsights(pool, history), [pool, history]);
  const gaps = useMemo(() => gapAnalysis(items, audience), [items, audience]);
  const maxGroup = Math.max(1, ...Object.values(ins.byGroup));
  const maxColour = Math.max(1, ...ins.colours.map(c => c.count));
  const byId = new Map(items.map(i => [i.id, i]));

  return (
    <main className="fc-page">
      <PageHeading kicker="PHASE 7 · WARDROBE INSIGHTS" title="Know your" em="wardrobe."
        text={`What you own, what you wear, and what would make your wardrobe go further. Showing ${audience === 'Everyone' ? 'all pieces' : `${audience.toLowerCase()}'s pieces`}.`}>
        <button className="fc-btn dark" onClick={onOpenStylist}>Open the stylist ↗</button>
      </PageHeading>

      <section className="fc-metrics fx-metrics">
        <div><strong>{String(ins.total).padStart(2, '0')}</strong><span>PIECES</span></div>
        <div><strong>{ins.possibleOutfits.toLocaleString()}</strong><span>COORDINATED OUTFITS POSSIBLE</span></div>
        <div><strong>{String(ins.wornOutfits).padStart(2, '0')}</strong><span>OUTFITS WORN & LOGGED</span></div>
        <div><strong>{ins.totalValue ? fmtMoney(ins.totalValue) : '—'}</strong><span>WARDROBE VALUE ENTERED</span></div>
      </section>

      <div className="fx-insight-grid">
        <section className="fx-panel">
          <p className="fc-kicker">BY CATEGORY</p>
          <ul className="fx-bars">
            {GROUP_ORDER.map(g => <li key={g}><span>{g}</span><div><i style={{ width: `${(ins.byGroup[g] || 0) / maxGroup * 100}%` }} /></div><strong>{ins.byGroup[g] || 0}</strong></li>)}
          </ul>
        </section>
        <section className="fx-panel">
          <p className="fc-kicker">YOUR COLOURS</p>
          <ul className="fx-bars">
            {ins.colours.slice(0, 8).map(c => <li key={c.name}><span><i className="fx-dot" style={{ background: c.hex }} />{c.name}</span><div><i style={{ width: `${c.count / maxColour * 100}%`, background: c.hex }} /></div><strong>{c.count}</strong></li>)}
          </ul>
        </section>

        <section className="fx-panel">
          <p className="fc-kicker">MOST VERSATILE PIECES</p>
          <p className="fc-muted">Pieces with the most compatible partners in your wardrobe.</p>
          <ul className="fx-rank">{ins.versatile.map(({ item, partners }) => <li key={item.id}><Img src={srcOf(item)} alt="" /><span>{item.name}</span><strong>{partners} matches</strong></li>)}</ul>
        </section>
        <section className="fx-panel">
          <p className="fc-kicker">MOST & LEAST WORN</p>
          {ins.mostWorn.length ? <ul className="fx-rank">{ins.mostWorn.map(i => <li key={i.id}><Img src={srcOf(i)} alt="" /><span>{i.name}</span><strong>{i.totalWears}×</strong></li>)}</ul> : <p className="fc-muted">Tap “Wearing it” on a stylist look to start tracking.</p>}
          <p className="fx-label">Waiting for a wear</p>
          <ul className="fx-rank">{ins.leastWorn.slice(0, 3).map(i => <li key={i.id}><Img src={srcOf(i)} alt="" /><span>{i.name}</span><strong>{i.totalWears}×</strong></li>)}</ul>
        </section>

        <section className="fx-panel fx-span">
          <p className="fc-kicker">WARDROBE GAP ANALYSIS</p>
          <h2>Pieces that would unlock the most outfits</h2>
          {gaps.length ? (
            <ul className="fx-gaps">
              {gaps.slice(0, 6).map(g => (
                <li key={g.id}>
                  <strong>{g.label}</strong>
                  <span>e.g. {g.example.toLowerCase()}</span>
                  <em>{g.unlocked > 0 ? `+${g.unlocked} new outfit${g.unlocked === 1 ? '' : 's'}` : `pairs with ${g.partners} pieces`}</em>
                </li>
              ))}
            </ul>
          ) : <p className="fc-muted">Your wardrobe covers all the versatile essentials. Nicely done.</p>}
        </section>

        <section className="fx-panel fx-span">
          <p className="fc-kicker">COST PER WEAR</p>
          {ins.costPerWear.length ? (
            <table className="fx-table">
              <thead><tr><th>Piece</th><th>Paid</th><th>Wears</th><th>Cost / wear</th><th /></tr></thead>
              <tbody>{ins.costPerWear.map(({ item, price, wears, cpw }) => <tr key={item.id}><td>{item.name}</td><td>{fmtMoney(price)}</td><td>{wears}</td><td>{fmtMoney(cpw)}</td><td><button className="fc-textbtn" onClick={() => onEdit(item.id)}>Edit</button></td></tr>)}</tbody>
            </table>
          ) : <p className="fc-muted">Add a purchase price to pieces (Wardrobe → Edit) to see their cost per wear fall each time you wear them.</p>}
        </section>

        <section className="fx-panel fx-span">
          <p className="fc-kicker">OUTFIT HISTORY</p>
          {history.length ? (
            <ul className="fx-history">
              {history.slice(0, 12).map(h => (
                <li key={h.id}>
                  <div className="fx-history-imgs">{(h.items || []).slice(0, 4).map(id => byId.get(id)).filter(Boolean).map(p => <Img key={p.id} src={srcOf(p)} alt={p.name} />)}</div>
                  <div><strong>{h.worn ? 'Worn' : 'Planned'} · {h.occasion || 'Any occasion'}</strong><span>{new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}{h.fragrance ? ` · ${h.fragrance}` : ''}{h.hair ? ` · ${h.hair}` : ''}</span></div>
                </li>
              ))}
            </ul>
          ) : <p className="fc-muted">Looks you wear or plan will appear here. The stylist uses this history to avoid repeating outfits.</p>}
        </section>
      </div>
    </main>
  );
}
