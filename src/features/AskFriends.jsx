import React, { useCallback, useEffect, useState } from 'react';
import { drawOption, drawPoll, dataUrlToFile } from '../lib/collage.js';
import { createPoll, listMyPolls, deletePoll, pollLink } from '../lib/cloud.js';
import { Img, PageHeading } from './shared.jsx';

const MAX = 4;

export default function AskFriends({ tray, setTray, looks, items, srcOf, sync, notify, onOpenStylist, onShowAccount }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState(null);
  const [link, setLink] = useState('');
  const [polls, setPolls] = useState([]);
  const byId = new Map(items.map(i => [i.id, i]));
  const piecesOf = (opt) => (opt.items || []).map(id => byId.get(id)).filter(Boolean);
  const defaultQ = tray[0]?.occasion ? `Which one should I wear to the ${String(tray[0].occasion).toLowerCase()}?` : 'Which outfit should I wear?';

  const refresh = useCallback(async () => {
    if (!sync.user) return;
    try { setPolls(await listMyPolls(sync.user.id)); } catch { /* table not created yet */ }
  }, [sync.user]);
  useEffect(() => { refresh(); }, [refresh]);

  const addLook = (lookId) => {
    const look = looks.find(l => l.id === lookId);
    if (!look) return;
    if (tray.length >= MAX) { notify(`Up to ${MAX} options per poll.`); return; }
    setTray(t => [...t, { id: `opt-${Date.now()}`, items: look.items.filter(x => typeof x === 'string'), label: look.name, occasion: look.occasion }]);
  };

  const buildImage = async () => {
    const opts = tray.map(o => ({ srcs: piecesOf(o).map(srcOf), label: o.label }));
    const url = await drawPoll(question || defaultQ, opts);
    if (!url) throw new Error('One of the photos can’t be used in an image (it comes from another website). Remove that look and try again.');
    return url;
  };

  const shareImage = async () => {
    if (tray.length < 2) { notify('Add at least two options.'); return; }
    setBusy(true);
    try {
      const url = await buildImage();
      setImage(url);
      const file = await dataUrlToFile(url, 'fitcheck-poll.jpg');
      const text = `${question || defaultQ} Reply with ${tray.map((_, i) => i + 1).join(', ')} 💬`;
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else notify('Image ready. Save it below and send it on WhatsApp.');
    } catch (e) { if (e?.name !== 'AbortError') notify(e.message || 'Couldn’t share the image.'); }
    setBusy(false);
  };

  const makeLink = async () => {
    if (tray.length < 2) { notify('Add at least two options.'); return; }
    if (!sync.user) { onShowAccount(); return; }
    setBusy(true);
    try {
      const options = [];
      for (let i = 0; i < tray.length; i++) {
        const dataUrl = await drawOption(piecesOf(tray[i]).map(srcOf), tray[i].label, i + 1);
        if (!dataUrl) throw new Error('One of the photos can’t be used (it comes from another website). Remove that look and try again.');
        options.push({ label: tray[i].label || `Option ${i + 1}`, dataUrl });
      }
      const id = await createPoll(sync.user.id, { question: (question || defaultQ).slice(0, 160), options });
      const url = pollLink(id);
      setLink(url);
      try { await navigator.clipboard.writeText(url); notify('Voting link copied. Paste it in WhatsApp!'); } catch { notify('Voting link ready.'); }
      setTray([]); setQuestion('');
      refresh();
    } catch (e) { notify(/relation|does not exist|bucket/i.test(e.message) ? 'Polls aren’t set up in Supabase yet. Run the latest supabase/schema.sql.' : e.message); }
    setBusy(false);
  };

  return (
    <main className="fc-page">
      <PageHeading kicker="ASK YOUR FRIENDS" title="Can't decide?" em="Fit check it."
        text="Pick two to four looks and send them to your friends. Share a numbered image on WhatsApp straight away, or create a voting link where friends tap their favourite and you see the results live." />

      <div className="fx-planner-grid">
        <aside className="fx-brief">
          <p className="fx-label">Your question</p>
          <input className="fx-input" value={question} onChange={e => setQuestion(e.target.value)} placeholder={defaultQ} maxLength={160} />
          <p className="fx-label">Options ({tray.length}/{MAX})</p>
          <p className="fc-muted">Tap “💬 Ask friends” on any stylist, wedding or trip look to add it here, or pick a saved look:</p>
          <select className="fx-input" value="" onChange={e => addLook(e.target.value)} disabled={!looks.length}>
            <option value="">{looks.length ? '＋ Add a saved look…' : 'No saved looks yet'}</option>
            {looks.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <div className="fx-brief-actions">
            <button className="fc-btn dark" onClick={shareImage} disabled={busy || tray.length < 2}>📲 Share image</button>
            <button className="fc-btn light" onClick={makeLink} disabled={busy || tray.length < 2}>🔗 {sync.user ? 'Create voting link' : sync.enabled ? 'Sign in for a voting link' : 'Voting link (needs accounts)'}</button>
            {!tray.length && <button className="fc-btn light" onClick={onOpenStylist}>✦ Get looks from the stylist</button>}
          </div>
          {!sync.enabled && <p className="fc-muted">Live voting links need accounts turned on (Supabase). Sharing the image works now.</p>}
        </aside>

        <section className="fx-results">
          {!tray.length && !image && !link && <div className="fx-empty-results"><p className="fc-kicker">TWO OR MORE LOOKS</p><h2>Nothing to vote on yet.</h2><p className="fc-muted">Add looks with the “💬 Ask friends” button on any outfit.</p></div>}
          {tray.length > 0 && (
            <div className="fx-poll-options">
              {tray.map((o, i) => (
                <article key={o.id} className="fx-poll-option">
                  <span className="fx-poll-num">{i + 1}</span>
                  <div className="fx-poll-imgs">{piecesOf(o).slice(0, 4).map(p => <Img key={p.id} src={srcOf(p)} alt={p.name} />)}</div>
                  <input value={o.label || ''} onChange={e => setTray(t => t.map(x => x.id === o.id ? { ...x, label: e.target.value } : x))} placeholder={`Option ${i + 1}`} aria-label={`Name option ${i + 1}`} />
                  <button className="fc-textbtn" onClick={() => setTray(t => t.filter(x => x.id !== o.id))}>Remove</button>
                </article>
              ))}
            </div>
          )}
          {link && (
            <div className="fx-poll-link">
              <p className="fx-label">Your voting link</p>
              <input readOnly value={link} onFocus={e => e.target.select()} />
              <div className="fx-row">
                <a className="fc-btn dark" href={`https://wa.me/?text=${encodeURIComponent(`Help me pick! Vote here 👉 ${link}`)}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
                <button className="fc-btn light" onClick={() => navigator.clipboard?.writeText(link).then(() => notify('Copied!'))}>Copy link</button>
              </div>
            </div>
          )}
          {image && (
            <div className="fx-poll-image">
              <img src={image} alt="Poll collage to share" />
              <div className="fx-row">
                <a className="fc-btn dark" href={image} download="fitcheck-poll.jpg">⬇ Save image</a>
                <a className="fc-btn light" href={`https://wa.me/?text=${encodeURIComponent(`${question || defaultQ} Reply with ${tray.map((_, i) => i + 1).join(', ') || 'your pick'}!`)}`} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
              </div>
              <p className="fc-muted">On a computer, save the image, then attach it in the WhatsApp chat.</p>
            </div>
          )}
          {sync.user && polls.length > 0 && (
            <div className="fx-my-polls">
              <div className="fx-row fx-space"><p className="fx-label">Your polls</p><button className="fc-textbtn" onClick={refresh}>↻ Refresh results</button></div>
              {polls.map(p => <PollResults key={p.id} poll={p} votes={p.poll_votes || []} onDelete={async () => { await deletePoll(p.id); refresh(); }} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export function PollResults({ poll, votes, onDelete }) {
  const total = votes.length;
  const counts = poll.options.map((_, i) => votes.filter(v => v.option_index === i).length);
  const top = Math.max(...counts);
  return (
    <article className="fx-poll-result">
      <div className="fx-row fx-space"><h4>{poll.question}</h4>{onDelete && <button className="fc-textbtn" onClick={onDelete}>Delete</button>}</div>
      <p className="fc-muted">{total} vote{total === 1 ? '' : 's'}{onDelete ? <> · <a href={pollLink(poll.id)} target="_blank" rel="noopener noreferrer">open poll ↗</a></> : null}</p>
      <div className="fx-poll-bars">
        {poll.options.map((o, i) => (
          <div key={i} className={counts[i] === top && total ? 'win' : ''}>
            <img src={o.image} alt={o.label} />
            <div><strong>{i + 1}. {o.label}</strong><span className="fx-bar"><i style={{ width: `${total ? (counts[i] / total) * 100 : 0}%` }} /></span><em>{counts[i]} · {total ? Math.round((counts[i] / total) * 100) : 0}%</em></div>
          </div>
        ))}
      </div>
      {votes.some(v => v.comment || v.voter_name) && (
        <ul className="fx-poll-comments">{votes.filter(v => v.comment || v.voter_name).slice(0, 8).map((v, i) => <li key={i}><strong>{v.voter_name || 'A friend'}</strong> picked {v.option_index + 1}{v.comment ? `: “${v.comment}”` : ''}</li>)}</ul>
      )}
    </article>
  );
}
