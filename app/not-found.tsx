"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * v13 SOTY 404 — Cartier-grade. Cream canvas, massive Fraunces "404", mono
 * caption with the brand voice, single magnetic CTA back to The Practice.
 * Subtle 3D centerpiece floats behind (low-poly torus knot, slowly rotating).
 */

export default function NotFound() {
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Subtle title pulse for craft — barely perceptible
    const el = titleRef.current;
    if (!el) return;
    let raf = 0;
    const start = performance.now();
    function tick(now: number) {
      const t = (now - start) / 1000;
      const o = 0.92 + Math.sin(t * 0.45) * 0.08;
      el!.style.opacity = String(o);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Faint chromatic gradient orb in the back */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(201, 169, 97, 0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 text-center max-w-[640px] px-6">
        <span className="editorial-eyebrow-sotm" style={{ display: "inline-flex", justifyContent: "center" }}>
          Off the record
        </span>

        <h1
          ref={titleRef}
          className="editorial-h1-italic mt-8 leading-none"
          style={{
            fontSize: "clamp(8rem, 22vw, 18rem)",
            color: "var(--gold-deep)",
            letterSpacing: "-0.06em",
          }}
        >
          404
        </h1>

        <p
          className="editorial-h2 mt-6 mx-auto"
          style={{
            fontSize: "clamp(1.25rem, 2.6vw, 1.875rem)",
            color: "var(--ink)",
            maxWidth: "22ch",
          }}
        >
          This note is no longer in circulation.
        </p>

        <p
          className="mt-6 text-base leading-relaxed mx-auto"
          style={{ color: "var(--ink-soft)", maxWidth: "44ch" }}
        >
          Either the page was archived, the URL was edited, or you typed it
          from memory. Either way — there&apos;s better material on the home page.
        </p>

        <div className="mt-10">
          <Link
            href="/"
            className="btn-graphite group inline-flex"
            data-cursor-label="HOME"
            data-magnetic
          >
            <span>Return to The Practice</span>
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>

        <p
          className="mt-12 font-mono uppercase"
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.28em",
            color: "var(--ink-faint)",
          }}
        >
          INVEST WITH RAJ · DUBAI
        </p>
      </div>
    </main>
  );
}
