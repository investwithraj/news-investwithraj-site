"use client";

import { useEffect, useState } from "react";
import HolographicRadial from "@/components/v16/HolographicRadial";
import DataPanel from "@/components/v16/DataPanel";
import TickerStrip from "@/components/v16/TickerStrip";
import CTAPill from "@/components/v16/CTAPill";

/**
 * v16 HolographicTerminal — news subdomain hero.
 * Reference: futuristic-office-stockcake.webp Bloomberg-monitor moodboard.
 * Pure white with curved-monitor backdrop showing radial network-node viz.
 */
export default function HolographicTerminal() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const update = () =>
      setNow(
        new Date().toLocaleString("en-GB", {
          timeZone: "Asia/Dubai",
          dateStyle: "medium",
          timeStyle: "short",
        })
      );
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      style={{
        minHeight: "100svh",
        background: "var(--v16-paper)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top ticker */}
      <div style={{ position: "relative", zIndex: 2, paddingTop: "100px" }}>
        <TickerStrip
          items={[
            { label: "DLD VOL", value: "AED 3B", trend: "down", delta: "1.4%" },
            { label: "TXNS", value: "582" },
            { label: "AVG TKT", value: "AED 4M" },
            { label: "PPSF", value: "AED 1,662" },
            { label: "HOTTEST", value: "Saadiyat Island · 256.1M" },
            { label: "TOP DEV", value: "Emaar · 68 txns" },
            { label: "AS OF", value: now || "loading…" },
          ]}
        />
      </div>

      {/* Main grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
          gap: "64px",
          padding: "80px 24px",
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
        className="v16-terminal-grid"
      >
        {/* Left — copy */}
        <div>
          <p
            className="v16-mono"
            style={{ marginBottom: "20px", color: "var(--v16-electric)" }}
          >
            news.investwithraj.com · LIVE
          </p>
          <h1
            className="v16-h1"
            style={{
              marginBottom: "32px",
              fontSize: "clamp(3rem, 8vw, 7rem)",
            }}
          >
            The daily{" "}
            <span className="v16-h1-italic">UAE</span> read.
          </h1>
          <p
            className="v16-body"
            style={{
              maxWidth: "52ch",
              fontSize: "1.15rem",
              marginBottom: "32px",
              color: "var(--v16-ink-soft)",
            }}
          >
            Independent intelligence on Dubai, Abu Dhabi, and Ras Al Khaimah.
            5-15 verified-source articles a day. Every piece cites DLD, RERA,
            Knight Frank, JLL, Khaleej Times, Arabian Business. Written for
            serious investors.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "48px" }}>
            <CTAPill variant="graphite" size="lg" href="/v16/articles">
              Today&apos;s articles
            </CTAPill>
            <CTAPill variant="paper" size="lg" href="/v16/terminal">
              Open the terminal
            </CTAPill>
          </div>

          {/* Live stats row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              maxWidth: "560px",
            }}
          >
            <DataPanel
              eyebrow="DLD Q1 2026"
              value="AED 11.97B"
              delta={{ value: "+12.4%", trend: "up" }}
              sparkline={[12, 18, 15, 22, 19, 26, 24, 31, 28, 34, 32, 38]}
              variant="holo"
              size="sm"
            />
            <DataPanel
              eyebrow="Median PSF"
              value="AED 1,662"
              delta={{ value: "+3.2%", trend: "up" }}
              variant="light"
              size="sm"
            />
            <DataPanel
              eyebrow="Articles today"
              value="11"
              delta={{ value: "5 verified", trend: "flat" }}
              variant="light"
              size="sm"
            />
          </div>
        </div>

        {/* Right — HolographicRadial in a glass frame */}
        <div
          style={{
            borderRadius: "var(--v16-radius-lg)",
            padding: "32px",
            background: "var(--v16-paper-pure)",
            border: "1px solid var(--v16-chrome)",
            boxShadow: "var(--v16-shadow-portrait)",
            position: "relative",
          }}
        >
          {/* Curved-screen inner shell */}
          <div
            style={{
              borderRadius: "var(--v16-radius-md)",
              background:
                "linear-gradient(135deg, rgba(0,102,255,0.04), rgba(0,217,255,0.06))",
              padding: "16px",
              border: "1px solid var(--v16-electric-soft)",
            }}
          >
            <HolographicRadial density="high" variant="light" />
          </div>

          {/* Corner badges — mimicking terminal screen affordances */}
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "16px",
              display: "flex",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--v16-neon)",
                boxShadow: "0 0 8px var(--v16-neon-glow)",
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: "var(--v16-font-mono), monospace",
                fontSize: "0.625rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--v16-electric)",
                fontWeight: 500,
              }}
            >
              ENGINE LIVE
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .v16-terminal-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </section>
  );
}
