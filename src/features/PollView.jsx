import React, { useEffect, useState } from 'react';
import { cloudEnabled, fetchPoll, fetchVotes, castVote } from '../lib/cloud.js';
import { PollResults } from './AskFriends.jsx';

// The page friends open from a voting link. No account or profile needed.
export default function PollView({ id }) {
  const [poll, setPoll] = useState(null);
  const [votes, setVotes] = useState([]);
  const [state, setState] = useState('loading');
  const [choice, setChoice] = useState(null);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const key = `fitcheck-voted-${id}`;
  const [voted, setVoted] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });

  useEffect(() => {
    if (!cloudEnabled) { setState('off'); return; }
    (async () => {
      try {
        const p = await fetchPoll(id);
        if (!p) { setState('missing'); return; }
        setPoll(p); setVotes(await fetchVotes(id)); setState('ready');
      } catch { setState('error'); }
    })();
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    if (choice == null) return;
    setState('sending');
    try {
      await castVote(id, choice, name.trim(), comment.trim());
      try { localStorage.setItem(key, '1'); } catch { /* optional */ }
      setVoted(true); setVotes(await fetchVotes(id)); setState('ready');
    } catch { setState('error'); }
  };

  return (
    <div className="fc-shell fx-pollview">
      <header className="fx-pollview-head"><a className="fc-logo" href={window.location.pathname}>FITCHECK<span>®</span><small>THE PERSONAL STYLE INDEX</small></a></header>
      <main className="fc-page">
        {state === 'loading' && <p className="fc-muted">Loading the poll…</p>}
        {state === 'off' && <p className="fx-results-msg">Voting links aren’t switched on for this copy of FitCheck yet.</p>}
        {state === 'missing' && <p className="fx-results-msg">This poll doesn’t exist any more.</p>}
        {state === 'error' && <p className="fx-results-msg">Something went wrong. Please try again.</p>}
        {poll && (
          <>
            <p className="fc-kicker">A FRIEND NEEDS YOUR HELP</p>
            <h1 className="fx-pollview-q">{poll.question}</h1>
            {!voted ? (
              <form onSubmit={submit}>
                <div className="fx-pollview-options">
                  {poll.options.map((o, i) => (
                    <button type="button" key={i} className={choice === i ? 'on' : ''} onClick={() => setChoice(i)} aria-pressed={choice === i}>
                      <img src={o.image} alt={o.label} />
                      <span>{i + 1}. {o.label}</span>
                    </button>
                  ))}
                </div>
                <div className="fx-pollview-form">
                  <label className="fc-field">Your name <span className="fx-optional">(optional)</span><input value={name} onChange={e => setName(e.target.value)} maxLength={40} /></label>
                  <label className="fc-field">Comment <span className="fx-optional">(optional)</span><input value={comment} onChange={e => setComment(e.target.value)} maxLength={200} placeholder="e.g. Wear the jhumkas with it!" /></label>
                  <button className="fc-btn dark" disabled={choice == null || state === 'sending'}>{state === 'sending' ? 'Voting…' : choice == null ? 'Tap a look to vote' : `Vote for ${choice + 1} ↗`}</button>
                </div>
              </form>
            ) : (
              <>
                <p className="fx-results-msg">Thanks for voting! Here’s how it’s going:</p>
                <PollResults poll={poll} votes={votes} />
              </>
            )}
            <p className="fx-pollview-cta">Plan your own outfits from your wardrobe with <a href={window.location.pathname}>FitCheck</a> ✨</p>
          </>
        )}
      </main>
    </div>
  );
}
