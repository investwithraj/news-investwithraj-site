"use client";

// DailyAnchorPane — the homepage F1 showpiece. Fetches /api/anchor on mount
// and renders either:
//   - A polished video player (when videoUrl present)
//   - A still-of-Raj + waveform + audio player (when only audioUrl)
//   - A "coming first morning cron" hero placeholder (initial Day-1 state)

import { useEffect, useRef, useState } from "react";
import type { DailyAnchor } from "@/content/daily-anchor/types";

export function DailyAnchorPane() {
  const [anchor, setAnchor] = useState<DailyAnchor | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchAnchor() {
      try {
        const res = await fetch("/api/anchor");
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; anchor?: DailyAnchor };
          if (mounted && data.ok && data.anchor) setAnchor(data.anchor);
        }
      } catch {
        // silent — pane shows placeholder
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAnchor();
    return () => {
      mounted = false;
    };
  }, []);

  function play() {
    if (videoRef.current) {
      videoRef.current.play();
      setPlaying(true);
      return;
    }
    if (audioRef.current) {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  function pause() {
    videoRef.current?.pause();
    audioRef.current?.pause();
    setPlaying(false);
  }

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: "var(--ink)",
        color: "var(--paper)",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 py-16 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* LEFT — masthead text */}
        <div className="lg:col-span-5 order-2 lg:order-1">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.22em]"
            style={{
              background: "rgba(201, 169, 97, 0.18)",
              color: "var(--gold-bright, #E0C076)",
              border: "1px solid rgba(201, 169, 97, 0.35)",
            }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{
                background: anchor?.state === "ready" ? "#22c55e" : "var(--gold-bright, #E0C076)",
                animation: anchor?.state === "ready" ? "anchor-pulse 1.4s infinite" : "none",
              }}
            />
            {anchor?.state === "ready" ? "Live · today" : "Daily anchor"}
          </span>

          <h2
            className="mt-6 leading-[1.05] tracking-[-0.025em]"
            style={{
              color: "var(--paper)",
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: "clamp(1.875rem, 4vw, 3rem)",
              fontWeight: 500,
              fontVariationSettings: '"SOFT" 80, "opsz" 144',
            }}
          >
            {anchor?.headline ||
              "The daily read, from the desk — every morning, 07:00 GST."}
          </h2>

          <p
            className="mt-5 text-base md:text-lg leading-[1.65] max-w-[44ch]"
            style={{ color: "rgba(248, 250, 252, 0.78)" }}
          >
            {anchor?.state === "ready"
              ? "A 90-second open from Raj — script generated from the day's lead story, voiced in his own voice, ready before you've had coffee."
              : "An AI-anchored open from Raj — script, voice, and (when wired) lip-synced video, fresh with every morning cron."}
          </p>

          {anchor?.script && (
            <details
              className="mt-6 rounded-2xl border p-4 text-sm leading-[1.65]"
              style={{
                borderColor: "rgba(201,169,97,0.25)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <summary
                className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--gold-bright, #E0C076)" }}
              >
                Read the transcript
              </summary>
              <div className="mt-3 whitespace-pre-wrap" style={{ color: "rgba(248,250,252,0.85)" }}>
                {anchor.script}
              </div>
            </details>
          )}
        </div>

        {/* RIGHT — media surface */}
        <div className="lg:col-span-7 order-1 lg:order-2">
          <div
            className="relative aspect-video rounded-2xl overflow-hidden"
            style={{
              background:
                "radial-gradient(ellipse at top, #1a2540, #05081A 70%)",
              border: "1px solid rgba(201, 169, 97, 0.25)",
              boxShadow:
                "0 30px 80px -30px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,169,97,0.1) inset",
            }}
          >
            {anchor?.videoUrl ? (
              <video
                ref={videoRef}
                src={anchor.videoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted={!playing}
                controls={playing}
              />
            ) : anchor?.audioUrl ? (
              <>
                {/* Placeholder portrait + audio */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    aria-hidden
                    className="leading-none"
                    style={{
                      color: "var(--gold-bright, #E0C076)",
                      fontFamily: "var(--font-fraunces), Georgia, serif",
                      fontSize: "clamp(6rem, 14vw, 12rem)",
                      fontWeight: 400,
                      fontStyle: "italic",
                      fontVariationSettings: '"SOFT" 100, "opsz" 144',
                      opacity: 0.55,
                    }}
                  >
                    RT
                  </span>
                </div>
                <audio
                  ref={audioRef}
                  src={anchor.audioUrl}
                  onEnded={() => setPlaying(false)}
                  preload="metadata"
                />
                {/* Animated equalizer when playing */}
                {playing && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1 h-12">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-t-sm"
                        style={{
                          background: "var(--gold-bright, #E0C076)",
                          height: `${20 + Math.abs(Math.sin(i * 0.7 + Date.now() / 200)) * 80}%`,
                          animation: `anchor-eq 0.${(i % 9) + 2}s ease-in-out infinite alternate`,
                          animationDelay: `${i * 30}ms`,
                          opacity: 0.85,
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              // Placeholder hero — no anchor generated yet
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                <span
                  aria-hidden
                  className="leading-none mb-6"
                  style={{
                    color: "var(--gold-bright, #E0C076)",
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    fontSize: "clamp(5rem, 10vw, 9rem)",
                    fontWeight: 400,
                    fontStyle: "italic",
                    fontVariationSettings: '"SOFT" 100, "opsz" 144',
                    opacity: 0.45,
                  }}
                >
                  RT
                </span>
                <div className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: "rgba(248,250,252,0.55)" }}>
                  {loading
                    ? "Anchor loading…"
                    : "First Anchor generates with the morning cron · 07:00 GST"}
                </div>
              </div>
            )}

            {/* Play overlay (audio-only mode) */}
            {anchor?.audioUrl && !anchor?.videoUrl && (
              <button
                onClick={playing ? pause : play}
                aria-label={playing ? "Pause anchor" : "Play anchor"}
                data-magnetic
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, #E0C076, #A88945)",
                  boxShadow: "0 12px 36px rgba(201,169,97,0.6), 0 0 0 4px rgba(201,169,97,0.18)",
                  color: "#0A1024",
                  fontSize: "1.8rem",
                }}
              >
                {playing ? "❚❚" : "▶"}
              </button>
            )}
          </div>

          {/* Footer line */}
          <div
            className="mt-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em]"
            style={{ color: "rgba(248, 250, 252, 0.45)" }}
          >
            <span>
              {anchor?.date
                ? `Generated · ${anchor.date}`
                : "Awaiting first generation"}
            </span>
            {anchor?.provider && (
              <span style={{ color: "var(--gold-bright, #E0C076)" }}>
                Voice · ElevenLabs · {anchor.provider}
              </span>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes anchor-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes anchor-eq {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </section>
  );
}
