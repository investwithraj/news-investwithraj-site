"use client";

// v22 PANGEA revamp — the KOBU-style drift gallery for area coverage.
// Client component: a horizontal strip of area cards at staggered vertical
// offsets that translateX-drifts subtly as the page scrolls (scroll listener
// driving a CSS custom property, transform only, rAF-throttled, disconnected
// on unmount). Under prefers-reduced-motion — and below 768px — the drift is
// skipped entirely and the strip renders as a static scrollable row.
// Real data only: areas come from the same registry that builds /areas.
// Registry hero images are Day-1 placeholders that do not exist on disk, so
// cards render as typographic tiles until a real (non-placeholder) source
// lands — at which point the image branch lights up automatically.
import { useEffect, useRef } from "react";
import Link from "next/link";
import { AREAS, sortAreas } from "@/content/areas";

const FEATURED = sortAreas(AREAS).slice(0, 8);

const MAX_DRIFT_PX = 120;

function hasRealImage(src: string | undefined): src is string {
  return !!src && !src.includes("placeholder");
}

export default function AreasDrift() {
  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 767px)");
    // Reduced motion at mount — skip the drift entirely, no listener attached.
    if (reduced.matches) return;

    let raf: number | null = null;

    const update = () => {
      raf = null;
      // Re-check on every frame so a viewport resize across 768px, or a
      // mid-session motion-preference change, degrades to the static row.
      if (reduced.matches || narrow.matches) {
        strip.style.removeProperty("--adrift-x");
        return;
      }
      const rect = strip.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 → 1 as the strip travels from below the fold to above it.
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
      strip.style.setProperty("--adrift-x", `${(progress * MAX_DRIFT_PX).toFixed(2)}px`);
    };

    const schedule = () => {
      if (raf === null) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="ground-coverage" data-register="dark" className="adrift" aria-label="Coverage by community">
      <div className="adrift__inner">
        <p className="adrift__eyebrow ad-rise" style={{ animationDelay: "40ms" }}>
          The ground · Coverage by community
        </p>

        <h2 className="adrift__title ad-rise" style={{ animationDelay: "120ms" }}>
          The ground behind <span className="adrift__it">the headlines.</span>
        </h2>

        {/* Opacity-only entrance — a transform keyframe with forwards fill
            would permanently override the drift translate3d. The scroller
            wrapper gives every viewport native horizontal scroll (the drift
            capped at 120px is parallax flavour, not the navigation), so all
            eight cards stay reachable by wheel, touch and keyboard. */}
        <div className="adrift__scroller">
        <div ref={stripRef} className="adrift__strip ad-fade" style={{ animationDelay: "220ms" }}>
          {FEATURED.map((area, i) => (
            <Link key={area.slug} href={`/areas/${area.slug}`} className="adrift__card">
              {hasRealImage(area.heroImage?.src) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={area.heroImage.src} alt={area.heroImage.alt} className="adrift__img" />
              ) : null}
              <span className="adrift__body">
                <span className="adrift__top">
                  <span className="adrift__index">{String(i + 1).padStart(2, "0")}</span>
                  <span className="adrift__kind">{area.kind.replace(/-/g, " ")}</span>
                </span>
                <span className="adrift__name">{area.name}</span>
                <span className="adrift__line">{area.oneLiner}</span>
                <span className="adrift__meta">
                  <span>{area.emirate}</span>
                  <span className="adrift__arrow" aria-hidden>
                    →
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
        </div>

        <p className="adrift__all ad-rise" style={{ animationDelay: "300ms" }}>
          <Link href="/areas" className="adrift__all-link">
            All {AREAS.length} areas, mapped <span aria-hidden>→</span>
          </Link>
        </p>
      </div>

      <style>{`
        .adrift {
          background: #141414; color: #F2EEE7;
          border-top: 1px solid rgba(242, 238, 231, 0.1);
          overflow: hidden;
        }
        .adrift__inner {
          max-width: 1240px; margin: 0 auto;
          padding: 96px clamp(20px, 4vw, 48px) 104px;
        }
        .adrift__eyebrow {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
          color: #C9A961; margin: 0 0 18px;
        }
        .adrift__title {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(1.9rem, 3.8vw, 3.1rem); font-weight: 500;
          line-height: 1.05; letter-spacing: -0.02em; margin: 0; max-width: 22ch;
        }
        .adrift__it {
          font-family: var(--font-fraunces), serif; font-style: italic;
          font-weight: 500; color: #C9A961;
        }
        .adrift__scroller {
          margin-top: 56px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .adrift__scroller::-webkit-scrollbar { display: none; }
        .adrift__strip {
          display: flex; gap: 20px; width: max-content;
          padding-bottom: 8px;
          transform: translate3d(calc(var(--adrift-x, 0px) * -1), 0, 0);
          will-change: transform;
        }
        .adrift__card {
          display: flex; flex-direction: column;
          width: 282px; min-height: 330px;
          background: #181818;
          border: 1px solid rgba(242, 238, 231, 0.1);
          border-radius: 10px; overflow: hidden;
          text-decoration: none; color: #F2EEE7;
          transition: border-color 200ms ease, transform 200ms ease, background 200ms ease;
        }
        /* KOBU stagger — every second card sits 48px lower */
        .adrift__card:nth-child(even) { margin-top: 48px; }
        .adrift__card:hover {
          border-color: rgba(178, 146, 79, 0.55);
          background: #1C1C1E;
          transform: translateY(-4px);
        }
        .adrift__img {
          width: 100%; height: 148px; object-fit: cover;
          filter: saturate(0.85) brightness(0.9);
          border-bottom: 1px solid rgba(242, 238, 231, 0.1);
        }
        .adrift__body {
          display: flex; flex-direction: column; flex: 1;
          padding: 22px 22px 20px;
        }
        .adrift__top {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 16px;
        }
        .adrift__index {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.18em;
          color: rgba(242, 238, 231, 0.42);
          font-variant-numeric: tabular-nums;
        }
        .adrift__kind {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.45);
        }
        .adrift__name {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.28rem; font-weight: 500;
          line-height: 1.15; letter-spacing: -0.015em; color: #F2EEE7;
        }
        .adrift__line {
          margin-top: 10px;
          font-size: 0.84rem; line-height: 1.55;
          color: rgba(242, 238, 231, 0.62);
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .adrift__meta {
          margin-top: auto; padding-top: 18px;
          display: flex; align-items: center; justify-content: space-between;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.45);
        }
        .adrift__arrow { color: #C9A961; transition: transform 200ms ease; }
        .adrift__card:hover .adrift__arrow { transform: translateX(4px); }
        .adrift__all { margin: 44px 0 0; }
        .adrift__all-link {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          text-decoration: none; color: rgba(242, 238, 231, 0.85);
          border-bottom: 1px solid #B2924F; padding-bottom: 3px;
          transition: color 180ms ease;
        }
        .adrift__all-link:hover { color: #C9A961; }
        @keyframes adRise {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ad-rise { opacity: 0; animation: adRise 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes adFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .ad-fade { opacity: 0; animation: adFade 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        /* Below 768px — the scroller still owns the scrolling; the strip
           just loses the drift and the stagger. */
        @media (max-width: 767px) {
          .adrift__scroller { scroll-snap-type: x proximity; }
          .adrift__strip { transform: none; will-change: auto; }
          .adrift__card { flex: 0 0 246px; min-height: 300px; scroll-snap-align: start; }
          .adrift__card:nth-child(even) { margin-top: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ad-rise, .ad-fade { opacity: 1; animation: none; }
          .adrift__strip { transform: none; will-change: auto; }
          .adrift__card, .adrift__arrow, .adrift__all-link { transition: none; }
        }
      `}</style>
    </section>
  );
}
