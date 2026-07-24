"use client";

// v22 PANGEA revamp — the terminal's top chrome. Mirrors the main site's
// PangeaNav grammar (wordmark · slim mono links · gold door) adapted to the
// news property: the real brand lockup + a mono NEWS chip, the six desks, and
// the one outbound door to the practice (UTM-tagged). Self-contained,
// literal-coloured so it holds in any register context.
import Link from "next/link";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL ?? "https://investwithraj.com";

const PRACTICE_HREF = `${MAIN_URL}/?utm_source=news.investwithraj.com&utm_medium=nav&utm_content=the-practice`;

const DESKS = [
  { href: "/news", label: "News" },
  { href: "/pulse", label: "Pulse" },
  { href: "/closing-bell", label: "Closing Bell" },
  { href: "/power-list/2026", label: "Power List" },
  { href: "/areas", label: "Areas" },
  { href: "/developers", label: "Developers" },
];

export default function NewsNav() {
  return (
    <header className="pnav" role="banner">
      <Link href="/" className="pnav__mark" aria-label="The Terminal — home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/lockup.png"
          alt="Invest with Raj"
          className="pnav__mark-img"
          style={{ height: 15, width: "auto" }}
        />
        <span className="pnav__mark-chip">NEWS</span>
      </Link>

      <nav className="pnav__links" aria-label="The desks">
        {DESKS.map((d) => (
          <Link key={d.href} href={d.href} className="pnav__link">
            {d.label}
          </Link>
        ))}
      </nav>

      <a
        href={PRACTICE_HREF}
        className="pnav__door"
        target="_blank"
        rel="noopener"
      >
        The Practice <span aria-hidden>↗</span>
      </a>

      <style>{`
        .pnav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 60;
          display: flex; align-items: center; gap: 20px;
          padding: 14px clamp(16px, 3vw, 40px);
          background: rgba(20, 20, 20, 0.62);
          backdrop-filter: blur(14px) saturate(130%);
          -webkit-backdrop-filter: blur(14px) saturate(130%);
          border-bottom: 1px solid rgba(242, 238, 231, 0.1);
        }
        .pnav__mark {
          display: inline-flex; align-items: center; gap: 9px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 12px; font-weight: 700; letter-spacing: 0.22em;
          text-decoration: none; white-space: nowrap;
        }
        .pnav__mark-img { display: block; width: auto; }
        .pnav__mark-chip {
          font-size: 9px; letter-spacing: 0.22em; line-height: 1;
          text-transform: uppercase; color: #C9A961;
          border: 1px solid rgba(201, 169, 97, 0.5);
          border-radius: 3px; padding: 3px 6px;
        }
        .pnav__links {
          display: flex; align-items: center; gap: clamp(10px, 1.6vw, 22px);
          margin-left: auto; overflow-x: auto; scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .pnav__links::-webkit-scrollbar { display: none; }
        .pnav__link {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.62); text-decoration: none;
          white-space: nowrap; padding: 4px 0;
          border-bottom: 1px solid transparent;
          transition: color 180ms ease, border-color 180ms ease;
        }
        .pnav__link:hover, .pnav__link:focus-visible {
          color: #F2EEE7; border-bottom-color: #B2924F;
        }
        .pnav__door {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
          text-transform: uppercase; white-space: nowrap;
          color: #141414; background: #C9A961;
          padding: 8px 16px; border-radius: 999px; text-decoration: none;
          transition: background 180ms ease, transform 180ms ease;
        }
        .pnav__door:hover, .pnav__door:focus-visible {
          background: #D8C089; transform: translateY(-1px);
        }
        @media (max-width: 760px) {
          .pnav { gap: 12px; }
          .pnav__door { display: none; }
        }
      `}</style>
    </header>
  );
}
