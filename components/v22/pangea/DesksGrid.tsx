// v22 PANGEA revamp — the six desks. Server component: the terminal's
// product doors as raised Pangea panels (mono index · display title · read
// line · arrow), gold hairline on hover. Typographic by design — the data
// pages carry their own imagery.
import Link from "next/link";

const DESKS = [
  {
    href: "/pulse",
    index: "01",
    title: "Pulse",
    read: "Live sentiment across Reddit, X, Telegram, trade press — scraped, scored, plotted.",
  },
  {
    href: "/closing-bell",
    index: "02",
    title: "Closing Bell",
    read: "The day's DLD print, called at the close — volume, movers, the one-line read.",
  },
  {
    href: "/power-list/2026",
    index: "03",
    title: "Power List",
    read: "The people and desks actually moving UAE real estate this year.",
  },
  {
    href: "/map",
    index: "04",
    title: "The Map",
    read: "Every story pinned to the ground it stands on.",
  },
  {
    href: "/areas",
    index: "05",
    title: "Areas",
    read: "The markets behind the headlines — coverage by community.",
  },
  {
    href: "/developers",
    index: "06",
    title: "Developers",
    read: "The desks behind the launches — tracked by name.",
  },
];

export default function DesksGrid() {
  return (
    <section id="the-desks" data-register="dark" className="desks" aria-label="The desks">
      <div className="desks__inner">
        <p className="desks__eyebrow">The desks</p>
        <h2 className="desks__title">
          One terminal, <span className="desks__it">six reads.</span>
        </h2>

        <div className="desks__grid">
          {DESKS.map((d) => (
            <Link key={d.href} href={d.href} className="desks__card">
              <span className="desks__index">{d.index}</span>
              <span className="desks__card-title">{d.title}</span>
              <span className="desks__card-read">{d.read}</span>
              <span className="desks__card-arrow" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .desks { background: #141414; color: #F2EEE7; border-top: 1px solid rgba(242,238,231,0.1); }
        .desks__inner { max-width: 1240px; margin: 0 auto; padding: 88px clamp(20px, 4vw, 48px); }
        .desks__eyebrow {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
          color: #C9A961; margin: 0 0 14px;
        }
        .desks__title {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(1.9rem, 4vw, 3.2rem); font-weight: 500;
          letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 44px;
        }
        .desks__it { font-family: var(--font-fraunces), serif; font-style: italic; font-weight: 400; color: #C9A961; }
        .desks__grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
          background: rgba(242, 238, 231, 0.1);
          border: 1px solid rgba(242, 238, 231, 0.1);
        }
        .desks__card {
          position: relative; display: flex; flex-direction: column;
          min-height: 210px; padding: 26px; text-decoration: none;
          background: #181818;
          transition: background 220ms ease;
        }
        .desks__card:hover { background: #1F1F1D; }
        .desks__card::after {
          content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
          background: #B2924F; transform: scaleX(0); transform-origin: left;
          transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .desks__card:hover::after { transform: scaleX(1); }
        .desks__index {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.2em; color: rgba(242, 238, 231, 0.35);
        }
        .desks__card-title {
          margin-top: 18px;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.45rem; font-weight: 500; letter-spacing: -0.015em; color: #F2EEE7;
        }
        .desks__card-read {
          margin-top: 10px; font-size: 0.85rem; line-height: 1.55;
          color: rgba(242, 238, 231, 0.55); max-width: 34ch;
        }
        .desks__card-arrow {
          margin-top: auto; align-self: flex-end;
          color: #C9A961; font-size: 1.1rem;
          transition: transform 220ms ease;
        }
        .desks__card:hover .desks__card-arrow { transform: translateX(4px); }
        @media (max-width: 900px) { .desks__grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .desks__grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
