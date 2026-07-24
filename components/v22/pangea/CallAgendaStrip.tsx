// v22 PANGEA — the call-agenda strip. Sits just before the bridge to the
// practice so the terminal's one conversion door answers "what happens when
// I book" before asking for the click. Mirrors the main site's THE FIFTEEN
// MINUTES section, condensed to a single band. Self-contained; UTM-tagged.
const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL ?? "https://investwithraj.com";
const CALL_HREF = `${MAIN_URL}/start?utm_source=news.investwithraj.com&utm_medium=agenda-strip&utm_content=book-the-call#begin`;

const AGENDA = [
  { mins: "00–03", title: "Your brief", body: "Budget, horizon, end-use. Nothing to prepare." },
  { mins: "03–08", title: "The read", body: "Which markets fit, the live windows, what to avoid — with reasons." },
  { mins: "08–12", title: "The fit", body: "The shortlist logic and the buy-side checks that come first." },
  { mins: "12–15", title: "The next step", body: "Either it isn't the time — said plainly — or the work starts within 48 hours." },
];

export default function CallAgendaStrip() {
  return (
    <section id="call-agenda" data-register="dark" className="castrip" aria-label="The fifteen-minute call agenda">
      <div className="castrip__inner">
        <div className="castrip__head">
          <p className="castrip__eyebrow">The fifteen minutes</p>
          <h2 className="castrip__title">
            Before you book — <span className="castrip__it">the agenda.</span>
          </h2>
        </div>

        <div className="castrip__grid">
          {AGENDA.map((a) => (
            <div key={a.mins} className="castrip__cell">
              <span className="castrip__mins">{a.mins}</span>
              <span className="castrip__cell-title">{a.title}</span>
              <span className="castrip__cell-body">{a.body}</span>
            </div>
          ))}
        </div>

        <div className="castrip__foot">
          <p className="castrip__pledge">
            No pitch. No obligation. If the honest read is &ldquo;don&rsquo;t buy&rdquo;, that is the read.
          </p>
          <a href={CALL_HREF} className="castrip__door" target="_blank" rel="noopener">
            Book the fifteen minutes <span aria-hidden>↗</span>
          </a>
        </div>
      </div>

      <style>{`
        .castrip { background: #141414; color: #F2EEE7; border-top: 1px solid rgba(242,238,231,0.1); }
        .castrip__inner { max-width: 1240px; margin: 0 auto; padding: 80px clamp(20px, 4vw, 48px); }
        .castrip__eyebrow {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase;
          color: #C9A961; margin: 0 0 14px;
        }
        .castrip__title {
          font-family: var(--font-raleway), sans-serif;
          font-size: clamp(1.5rem, 3.2vw, 2.5rem); font-weight: 200;
          text-transform: uppercase;
          letter-spacing: 0.14em; line-height: 1.2; margin: 0 0 40px;
        }
        .castrip__it { font-family: var(--font-playfair), serif; font-style: italic; font-weight: 400; text-transform: none; letter-spacing: 0.02em; color: #C9A961; }
        .castrip__grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
          background: rgba(242, 238, 231, 0.1); border: 1px solid rgba(242, 238, 231, 0.1);
        }
        .castrip__cell { background: #181818; padding: 24px 22px; display: flex; flex-direction: column; }
        .castrip__mins {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 11px; letter-spacing: 0.18em; color: #C9A961;
          font-variant-numeric: tabular-nums;
        }
        .castrip__cell-title {
          margin-top: 12px;
          font-family: var(--font-raleway), sans-serif;
          font-size: 1.05rem; font-weight: 300; color: #F2EEE7;
        }
        .castrip__cell-body { margin-top: 8px; font-size: 0.82rem; line-height: 1.55; color: rgba(242, 238, 231, 0.58); }
        .castrip__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 22px; margin-top: 34px; }
        .castrip__pledge { margin: 0; flex: 1; min-width: 260px; font-size: 0.95rem; line-height: 1.6; color: rgba(242, 238, 231, 0.72); }
        .castrip__door {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
          text-decoration: none; color: #141414; background: #C9A961;
          padding: 13px 24px; border-radius: 999px; white-space: nowrap;
          transition: background 180ms ease, transform 180ms ease;
        }
        .castrip__door:hover { background: #D8C089; transform: translateY(-1px); }
        @media (max-width: 980px) { .castrip__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .castrip__grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
