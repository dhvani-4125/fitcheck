import React from 'react';

const BELIEFS = [
  ['Shop your own wardrobe first', 'The best outfit is usually already hanging in your closet. FitCheck helps you see it.'],
  ['Style should feel personal', 'No generic lookbooks. Every suggestion is built from the clothes you actually own and the way you like to dress.'],
  ['Getting dressed should be fun', 'Less staring at a full closet with "nothing to wear", more confidence walking out the door.'],
  ['Your wardrobe is yours', 'Your photos are analysed right in your browser. We never sell your data or show you ads.'],
];

export default function AboutUs({ onStart }) {
  return (
    <main className="fc-page fx-about">
      <section className="fx-about-hero">
        <p className="fc-kicker">ABOUT US</p>
        <h1>From Dhvani &amp; Rhea, <em>with love.</em></h1>
        <p className="fx-about-lead">
          Two fashion-obsessed individuals fuelled by cranberry cold brew, who came together to make FitCheck
          for their mutual love of tech and fashion.
        </p>
        <span className="fx-about-badge">☕ Powered by cranberry cold brew</span>
      </section>

      <section className="fx-about-story">
        <div>
          <p className="fc-kicker">HOW IT STARTED</p>
          <h2>A closet full of clothes, <em>and nothing to wear.</em></h2>
        </div>
        <div className="fx-about-copy">
          <p>
            It started the way most good ideas do: over cold brew, scrolling through outfit inspiration and complaining
            that we never knew what to wear. Our wardrobes were full, but every morning felt like starting from scratch.
            Half our favourite pieces sat forgotten at the back of the closet.
          </p>
          <p>
            One of us couldn't stop thinking about colour palettes and silhouettes. The other couldn't stop
            thinking about code. So we asked: what if your wardrobe could style itself? What if an app actually knew
            every piece you owned, checked the weather, and helped you put together a complete look, right down to
            the perfume and the hairstyle?
          </p>
          <p>
            FitCheck is our answer. We built it for anyone who loves fashion but doesn't love the morning
            panic, and for everyone who wants to wear what they own more often, buy a little less, and feel great doing it.
          </p>
        </div>
      </section>

      <section className="fx-about-beliefs">
        <p className="fc-kicker">WHAT WE BELIEVE</p>
        <div className="fx-about-belief-grid">
          {BELIEFS.map(([title, text], i) => (
            <article key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="fx-about-founders">
        <p className="fc-kicker">THE TWO OF US</p>
        <div className="fx-about-founder-grid">
          <article className="fx-about-zodiac-card">
            <div className="fx-about-zodiac" aria-hidden="true">{'♐︎'}</div>
            <h3>Dhvani</h3>
            <p className="fx-about-role">Sagittarius · Co-creator</p>
            <p>Fashion lover, outfit planner and firm believer that the right look can change your whole day. Can usually be found with a cranberry cold brew in hand.</p>
          </article>
          <article className="fx-about-zodiac-card">
            <div className="fx-about-zodiac" aria-hidden="true">{'♏︎'}</div>
            <h3>Rhea</h3>
            <p className="fx-about-role">Scorpio · Co-creator</p>
            <p>Fashion lover and tech enthusiast who turns late-night "what if" ideas into real features. Also running on cranberry cold brew.</p>
          </article>
        </div>
      </section>

      <section className="fx-about-cta">
        <p>“Getting dressed should be the easiest, most fun part of your day. We hope FitCheck makes it that way.”</p>
        <span>— Dhvani &amp; Rhea</span>
        <button className="fc-btn dark" onClick={onStart}>✦ Start styling</button>
      </section>
    </main>
  );
}
