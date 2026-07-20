"use client";

/* ────────────────────────────────────────────────────────────────────────
   V17EdgeNav · v17 3.0 corner-only chrome (Wave-A3 · NEWS repo)
   ─────────────────────────────────────────────────────────────────────
   Replaces the root <DldTicker/> top strip for the /v17 immersive terminal
   route. Four pinned corners, never crossing the centre:
     • TL — wordmark linking to /v17
     • TR — tiny links: Operator · Note · Map · Engage
     • BR — floating cobalt pill "Talk to Raj" → #engage
   All translucent dark glass, .v17-cobalt accent. Pointer-events scoped
   to the chrome so the WebGL world + page scroll stay interactive.

   Cross-domain note: NEWS lives on news.investwithraj.com but the
   "Operator / Engage" anchors live on the MAIN site. The links use
   absolute URLs to the main domain so the chrome works across the brand
   family — Note + Map are local hash anchors on /v17.
   ──────────────────────────────────────────────────────────────────── */

import Link from "next/link";

const MAIN_URL =
  process.env.NEXT_PUBLIC_MAIN_URL ?? "https://investwithraj.com";

/** The main practice home, tagged so it can attribute nav traffic sent over
 *  from the news terminal (source=news.investwithraj.com · medium=nav). */
const PRACTICE_HREF = (() => {
  const params = new URLSearchParams({
    utm_source: "news.investwithraj.com",
    utm_medium: "nav",
    utm_content: "the-practice",
  });
  return `${MAIN_URL}/?${params.toString()}`;
})();

type EdgeLink = {
  href: string;
  label: string;
  external: boolean;
  /** The cross-property hand-off to the main practice — rendered with a ↗. */
  corner?: boolean;
};

const LINKS: EdgeLink[] = [
  { href: `${MAIN_URL}/#operator`, label: "Operator", external: true },
  { href: "#note", label: "Note", external: false },
  { href: "#map", label: "Map", external: false },
  { href: `${MAIN_URL}/#engage`, label: "Engage", external: true },
  { href: PRACTICE_HREF, label: "The Practice", external: true, corner: true },
];

export default function V17EdgeNav() {
  return (
    <>
      {/* TL — wordmark */}
      <Link
        href="/"
        aria-label="Invest With Raj News — terminal home"
        data-cursor-label="TERMINAL"
        style={{
          position: "fixed",
          top: 20,
          left: 24,
          zIndex: 80,
          padding: "8px 14px",
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#F2EEE7",
          background: "rgba(20, 20, 20, 0.55)",
          border: "1px solid rgba(242, 238, 231, 0.12)",
          borderRadius: 999,
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
          textDecoration: "none",
          pointerEvents: "auto",
          transition: "border-color 220ms ease, color 220ms ease",
        }}
      >
        <span style={{ color: "#C9A961" }}>IWR</span>
        <span style={{ opacity: 0.55, marginLeft: 8 }}>/ news</span>
      </Link>

      {/* TR — tiny anchor links */}
      <nav
        aria-label="v17 section navigation"
        style={{
          position: "fixed",
          top: 22,
          right: 24,
          zIndex: 80,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 8px",
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          background: "rgba(20, 20, 20, 0.55)",
          border: "1px solid rgba(242, 238, 231, 0.12)",
          borderRadius: 999,
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
          pointerEvents: "auto",
        }}
      >
        {LINKS.map((l, i) => {
          // "The Practice" (corner) sits a touch brighter so the cross-property
          // hand-off reads as distinct from the local section anchors.
          const base = l.corner
            ? "rgba(201, 169, 97, 0.95)"
            : "rgba(242, 238, 231, 0.78)";
          return (
            <span key={l.href} style={{ display: "inline-flex", alignItems: "center" }}>
              {i > 0 && (
                <span
                  aria-hidden
                  style={{
                    width: 1,
                    height: 12,
                    background: "rgba(242, 238, 231, 0.12)",
                    margin: "0 2px",
                  }}
                />
              )}
              <a
                href={l.href}
                {...(l.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                data-cursor-label={l.label.toUpperCase()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 10px",
                  color: base,
                  textDecoration: "none",
                  borderRadius: 999,
                  transition: "color 220ms ease, background 220ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#F2EEE7";
                  e.currentTarget.style.background = "rgba(178, 146, 79, 0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = base;
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {l.label}
                {l.corner && (
                  <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>
                    ↗
                  </span>
                )}
              </a>
            </span>
          );
        })}
      </nav>

      {/* BR — Talk to Raj pill (cross-domain to MAIN /#engage) */}
      <a
        href={`${MAIN_URL}/#engage`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Talk to Raj — opens engagement section on the main site"
        data-cursor-label="TALK TO RAJ"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 80,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 20px",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "#F2EEE7",
          background:
            "linear-gradient(135deg, rgba(42, 42, 43, 0.92), rgba(26, 26, 27, 0.92))",
          border: "1px solid rgba(178, 146, 79, 0.5)",
          borderRadius: 999,
          boxShadow:
            "0 8px 28px rgba(178, 146, 79, 0.32), 0 0 0 1px rgba(178, 146, 79, 0.18) inset",
          textDecoration: "none",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          pointerEvents: "auto",
          transition: "transform 220ms ease, box-shadow 220ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 12px 36px rgba(178, 146, 79, 0.42), 0 0 0 1px rgba(178, 146, 79, 0.28) inset";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow =
            "0 8px 28px rgba(178, 146, 79, 0.32), 0 0 0 1px rgba(178, 146, 79, 0.18) inset";
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#C9A961",
            boxShadow: "0 0 12px #C9A961",
            animation: "v17-pulse 2.2s ease-in-out infinite",
          }}
        />
        Talk to Raj
      </a>

      <style>{`
        @keyframes v17-pulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(0.82); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes v17-pulse {
            0%, 100% { opacity: 0.9; transform: scale(1); }
          }
        }
      `}</style>
    </>
  );
}
