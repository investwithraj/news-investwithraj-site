"use client";

// v22 PANGEA revamp — the live DLD signal band. Client component: fetches the
// same real /api/dld-pulse the ticker uses and renders the print as four big
// Pangea numerals with a short count-up (reduced-motion → instant values).
// Honest states: skeleton while loading, and if the print can't be fetched
// the band says so rather than inventing numbers.
import { useEffect, useRef, useState } from "react";
import type { DldDailyPulse } from "@/lib/dld/types";
import { formatAed } from "@/lib/dld/types";

function useCountTo(target: number, run: boolean, ms = 1100): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!run) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [target, run, ms]);
  return value;
}

export default function SignalBand() {
  const [pulse, setPulse] = useState<DldDailyPulse | null>(null);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/dld-pulse", { cache: "default" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DldDailyPulse) => {
        if (alive) setPulse(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const run = seen && !!pulse;
  const vol = useCountTo(pulse?.volumeAed ?? 0, run);
  const txn = useCountTo(pulse?.txnCount ?? 0, run);
  const avg = useCountTo(pulse?.avgPriceAed ?? 0, run);

  return (
    <section id="the-print" data-register="dark" ref={rootRef} className="sband" aria-label="The DLD print">
      <div className="sband__inner">
        <p className="sband__eyebrow">
          The print{pulse?.periodLabel ? ` · ${pulse.periodLabel}` : ""} ·{" "}
          {pulse?.source === "live" ? "Dubai Pulse · DLD open data" : pulse?.sourceNote ?? "DLD official print"}
        </p>

        {failed ? (
          <p className="sband__fallback">
            The live print is unavailable right now — the full sentiment desk is on{" "}
            <a href="/pulse">/pulse</a>.
          </p>
        ) : (
          <div className="sband__grid" data-loading={pulse ? undefined : "true"}>
            <div className="sband__cell">
              <span className="sband__num sband__num--gold">
                {pulse ? `AED ${formatAed(vol)}` : "—"}
              </span>
              <span className="sband__label">Transaction volume</span>
            </div>
            <div className="sband__cell">
              <span className="sband__num">{pulse ? Math.round(txn).toLocaleString("en-GB") : "—"}</span>
              <span className="sband__label">Transactions</span>
            </div>
            <div className="sband__cell">
              <span className="sband__num">{pulse ? `AED ${formatAed(avg)}` : "—"}</span>
              <span className="sband__label">Average ticket</span>
            </div>
            <div className="sband__cell">
              {typeof pulse?.dodVolumeChangePct === "number" ? (
                <span
                  className="sband__num"
                  style={{ color: pulse.dodVolumeChangePct >= 0 ? "#86C255" : "#E58E89" }}
                >
                  {pulse.dodVolumeChangePct >= 0 ? "+" : ""}
                  {pulse.dodVolumeChangePct.toFixed(1)}%
                </span>
              ) : (
                <span className="sband__num">{pulse?.hottestArea?.name ?? "—"}</span>
              )}
              <span className="sband__label">
                {typeof pulse?.dodVolumeChangePct === "number" ? "Volume, day on day" : "Hottest area"}
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .sband { background: #141414; color: #F2EEE7; border-top: 1px solid rgba(242,238,231,0.1); }
        .sband__inner { max-width: 1240px; margin: 0 auto; padding: 64px clamp(20px, 4vw, 48px) 72px; }
        .sband__eyebrow {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.42); margin: 0 0 34px;
        }
        .sband__grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
          background: rgba(242, 238, 231, 0.1);
          border: 1px solid rgba(242, 238, 231, 0.1);
        }
        .sband__grid[data-loading="true"] .sband__num { opacity: 0.25; }
        .sband__cell {
          background: #141414; padding: 30px 26px 26px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .sband__num {
          font-family: var(--font-raleway), sans-serif;
          font-size: clamp(1.7rem, 3.4vw, 2.9rem); font-weight: 300;
          letter-spacing: -0.02em; line-height: 1; color: #F2EEE7;
          font-variant-numeric: tabular-nums;
        }
        .sband__num--gold { color: #C9A961; }
        .sband__label {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.45);
        }
        .sband__fallback { color: rgba(242, 238, 231, 0.62); font-size: 0.95rem; }
        .sband__fallback a { color: #C9A961; }
        @media (max-width: 900px) { .sband__grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </section>
  );
}
