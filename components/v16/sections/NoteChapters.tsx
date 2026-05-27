"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CTAPill from "@/components/v16/CTAPill";
import HolographicRadial from "@/components/v16/HolographicRadial";
import DataPanel from "@/components/v16/DataPanel";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * v16 NoteChapters — pinned chapter scroll-pin sequence.
 *
 * v15 had 6 chapters with photo backdrops; v16 keeps the scroll-pin pattern
 * but swaps the visuals to HolographicRadial backdrops + DataPanel overlays.
 * 4 chapters (condensed from 6) to keep total scroll-budget tight.
 *
 * Light register throughout. Each chapter pins for 50% viewport height.
 */
type Chapter = {
  number: string;
  title: string;
  italic?: string;
  body: string;
  panels?: Array<{ eyebrow: string; value: string; delta?: { value: string; trend: "up" | "down" | "flat" } }>;
  cta?: { label: string; href: string };
};

const CHAPTERS: Chapter[] = [
  {
    number: "01",
    title: "The thesis is",
    italic: "Hudayriyat",
    body:
      "Modon priced phase one between AED 2,800 and AED 4,200 per square foot. Saadiyat Reserve villas, when they last traded in late 2024, hit AED 5,800. That gap is the entire thesis.",
    panels: [
      { eyebrow: "Discount vs Saadiyat", value: "32%", delta: { value: "Per sqft", trend: "down" } },
      { eyebrow: "Q1 2026 absorption", value: "AED 11.97B", delta: { value: "+12.4%", trend: "up" } },
      { eyebrow: "Phase 1 villas", value: "474", delta: { value: "Modon", trend: "flat" } },
    ],
  },
  {
    number: "02",
    title: "The mispricing —",
    italic: "Frond C to F",
    body:
      "Same coastline. Twenty minutes apart. Half the entry price. The market hasn't repriced because the comparable trade hasn't happened — yet. Hold four to six years. The catalyst arrives by 2028.",
    panels: [
      { eyebrow: "Frond entry", value: "8,500 sqft", delta: { value: "Signature", trend: "flat" } },
      { eyebrow: "Hold period", value: "4-6 yrs", delta: { value: "Target", trend: "up" } },
      { eyebrow: "Catalyst", value: "2028", delta: { value: "Repricing", trend: "up" } },
    ],
  },
  {
    number: "03",
    title: "The honest counter —",
    italic: "the risk",
    body:
      "If absorption stalls and Modon's phase two launches at higher prices, phase one secondary suddenly looks expensive. Cycle timing matters more than the spread. The full Note prices both sides.",
    panels: [
      { eyebrow: "Cycle stage", value: "Mid", delta: { value: "2026 EOY", trend: "flat" } },
      { eyebrow: "Modon Phase 2", value: "TBD", delta: { value: "Watching", trend: "flat" } },
    ],
  },
  {
    number: "04",
    title: "The ask —",
    italic: "request the Note",
    body:
      "Twelve pages. Per-frond price ladder. Absorption chart since launch. Developer track record. Two exit scenarios. No marketing list — Raj responds personally within two hours during Dubai business hours.",
    cta: { label: "Request the current Note", href: "#engage" },
  },
];

export default function NoteChapters() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 768px)").matches) return;

    const ctx = gsap.context(() => {
      const chapters = sectionRef.current?.querySelectorAll<HTMLElement>(
        "[data-v16-chapter]"
      );
      if (!chapters) return;

      chapters.forEach((chapter, i) => {
        const heading = chapter.querySelector<HTMLElement>("[data-v16-heading]");
        const body = chapter.querySelector<HTMLElement>("[data-v16-body]");
        const panels = chapter.querySelector<HTMLElement>("[data-v16-panels]");
        const number = chapter.querySelector<HTMLElement>("[data-v16-number]");

        if (number) gsap.set(number, { opacity: 0, x: -16 });
        if (heading) gsap.set(heading, { opacity: 0, y: 24 });
        if (body) gsap.set(body, { opacity: 0, y: 16 });
        if (panels) gsap.set(panels, { opacity: 0, y: 24 });

        ScrollTrigger.create({
          trigger: chapter,
          start: "top top",
          end: "+=50%",
          pin: true,
          pinSpacing: i === chapters.length - 1,
          scrub: false,
          anticipatePin: 1,
        });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: chapter,
            start: "top 75%",
            end: "top top",
            scrub: 0.4,
          },
        });

        if (number) tl.to(number, { opacity: 1, x: 0, ease: "expo.out" }, 0);
        if (heading) tl.to(heading, { opacity: 1, y: 0, ease: "expo.out" }, 0.05);
        if (body) tl.to(body, { opacity: 1, y: 0, ease: "expo.out" }, 0.15);
        if (panels) tl.to(panels, { opacity: 1, y: 0, ease: "expo.out" }, 0.25);
      });

      ScrollTrigger.refresh();
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="the-note"
      style={{
        position: "relative",
        background: "var(--v16-paper)",
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: "120px 24px 80px",
          textAlign: "center",
        }}
      >
        <p className="v16-mono" style={{ marginBottom: "16px", display: "inline-flex", justifyContent: "center" }}>
          02 · The Note
        </p>
        <h2
          className="v16-h2"
          style={{
            maxWidth: "16ch",
            margin: "0 auto",
            fontSize: "clamp(2.5rem, 5vw, 5.5rem)",
          }}
        >
          The current{" "}
          <span className="v16-h1-italic" style={{ color: "var(--v16-brass)" }}>
            edition
          </span>{" "}
          — in four scrolls.
        </h2>
      </div>

      {/* Pinned chapters */}
      {CHAPTERS.map((ch, i) => (
        <div
          key={ch.number}
          data-v16-chapter
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            background:
              i % 2 === 0 ? "var(--v16-paper)" : "var(--v16-paper-cool)",
          }}
        >
          {/* Holographic backdrop */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "min(60vw, 700px)",
              height: "min(60vw, 700px)",
              transform: "translate(-50%, -50%)",
              opacity: 0.45,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            <HolographicRadial density={i === 0 ? "high" : i === 1 ? "medium" : "low"} />
          </div>

          {/* Chapter content */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: "1280px",
              padding: "0 24px",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
              gap: "64px",
              alignItems: "center",
              width: "100%",
            }}
            className="v16-chapter-grid"
          >
            {/* Left column — copy */}
            <div>
              <span
                data-v16-number
                className="v16-mono"
                style={{
                  display: "block",
                  marginBottom: "16px",
                  color: "var(--v16-brass)",
                }}
              >
                CHAPTER {ch.number} / 04
              </span>
              <h3
                data-v16-heading
                className="v16-h2"
                style={{
                  marginBottom: "24px",
                  fontSize: "clamp(2rem, 4.5vw, 4rem)",
                }}
              >
                {ch.title}{" "}
                {ch.italic && (
                  <span className="v16-h1-italic" style={{ color: "var(--v16-brass)" }}>
                    {ch.italic}.
                  </span>
                )}
              </h3>
              <p
                data-v16-body
                className="v16-body"
                style={{
                  maxWidth: "48ch",
                  fontSize: "1.075rem",
                  color: "var(--v16-ink-soft)",
                }}
              >
                {ch.body}
              </p>

              {ch.cta && (
                <div style={{ marginTop: "32px" }}>
                  <CTAPill variant="graphite" size="lg" href={ch.cta.href}>
                    {ch.cta.label}
                  </CTAPill>
                </div>
              )}
            </div>

            {/* Right column — data panels */}
            {ch.panels && (
              <div
                data-v16-panels
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {ch.panels.map((p, j) => (
                  <DataPanel
                    key={j}
                    eyebrow={p.eyebrow}
                    value={p.value}
                    delta={p.delta}
                    variant={j === 0 ? "holo" : "light"}
                    size="md"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      <style jsx>{`
        @media (max-width: 1024px) {
          .v16-chapter-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </section>
  );
}
