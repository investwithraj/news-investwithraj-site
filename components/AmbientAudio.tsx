"use client";

import { useEffect, useRef, useState } from "react";

/**
 * v13 SOTY ambient audio — Cartier W&W pattern.
 *
 * A muteable, low-volume ambient loop (e.g., warm piano + brass swells)
 * that lives in the top-right corner of the viewport. Muted by default
 * — never starts without user consent (browser autoplay policy + UX).
 *
 * Click the toggle once → fade in over 1.2s.
 * Click again → fade out + suspend.
 * Preference persists in localStorage so subsequent sessions remember.
 *
 * The toggle itself is the SOTY tell — Cartier, Bulgari, Aman all expose
 * an audio toggle in this exact spot. Even when off it reads as "this
 * site was designed by people who care about every dimension."
 *
 * Provide your audio file at /audio/iwr-ambient.mp3.
 * Falls back gracefully if file doesn't exist.
 */

const AMBIENT_SRC = "/audio/iwr-ambient.mp3";
const STORAGE_KEY = "iwr-ambient-pref";

export default function AmbientAudio() {
  const [isOn, setIsOn] = useState(false);
  const [available, setAvailable] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);

  // Check if file exists on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch(AMBIENT_SRC, { method: "HEAD" })
      .then((r) => setAvailable(r.ok))
      .catch(() => setAvailable(false));

    // Restore preference
    const pref = localStorage.getItem(STORAGE_KEY);
    if (pref === "on") {
      // Don't auto-start due to browser policy, but show as "on" intent —
      // user gesture will trigger play on next interaction
    }
  }, []);

  function fadeTo(targetVol: number, durationMs: number, onDone?: () => void) {
    if (!audioRef.current) return;
    if (fadeIntervalRef.current) {
      window.clearInterval(fadeIntervalRef.current);
    }
    const audio = audioRef.current;
    const startVol = audio.volume;
    const startTime = performance.now();
    fadeIntervalRef.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - startTime) / durationMs);
      audio.volume = startVol + (targetVol - startVol) * t;
      if (t >= 1) {
        if (fadeIntervalRef.current) {
          window.clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        onDone?.();
      }
    }, 30);
  }

  async function toggle() {
    if (!audioRef.current || !available) return;
    if (!isOn) {
      audioRef.current.volume = 0;
      try {
        await audioRef.current.play();
        setIsOn(true);
        fadeTo(0.22, 1200);
        localStorage.setItem(STORAGE_KEY, "on");
      } catch {
        // play() rejected (autoplay policy) — user gesture required
      }
    } else {
      fadeTo(0, 600, () => {
        audioRef.current?.pause();
        setIsOn(false);
      });
      localStorage.setItem(STORAGE_KEY, "off");
    }
  }

  if (!available) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={AMBIENT_SRC}
        loop
        preload="metadata"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={isOn ? "Mute ambient audio" : "Play ambient audio"}
        className="fixed top-5 right-5 z-[8800] flex items-center gap-2.5 px-3 py-1.5 transition-colors"
        style={{
          background: "var(--paper-pure)",
          border: "1px solid var(--chrome-deep)",
          borderRadius: "100px",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.6rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: isOn ? "var(--gold-deep)" : "var(--ink-muted)",
        }}
        data-cursor-label={isOn ? "MUTE" : "PLAY"}
        data-magnetic
      >
        {/* Sound wave bars or X icon depending on state */}
        <span
          className="flex items-center gap-[2px] h-3"
          aria-hidden="true"
          style={{ color: isOn ? "var(--gold-deep)" : "var(--ink-faint)" }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-[2px] rounded-full"
              style={{
                background: "currentColor",
                height: isOn ? "100%" : "30%",
                animation: isOn ? `aw-bar 1.2s ease-in-out infinite ${i * 0.2}s` : "none",
              }}
            />
          ))}
        </span>
        <span>{isOn ? "AMBIENCE · ON" : "AMBIENCE · OFF"}</span>
      </button>
      <style jsx>{`
        @keyframes aw-bar {
          0%, 100% { transform: scaleY(0.3); }
          50%      { transform: scaleY(1); }
        }
      `}</style>
    </>
  );
}
