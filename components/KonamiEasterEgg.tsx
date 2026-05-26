"use client";

import { useEffect, useState } from "react";

/**
 * v13 SOTY easter egg — Konami code listener.
 *
 * Up, Up, Down, Down, Left, Right, Left, Right, B, A
 *
 * Triggers the Bulgari emerald palette swap for 6 seconds, plus a brief
 * "Eclettica unlocked" toast. Silent on touch + reduced-motion.
 *
 * Lives in the root layout so it works on every page.
 */
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export default function KonamiEasterEgg() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let idx = 0;
    function onKey(e: KeyboardEvent) {
      const expected = KONAMI[idx];
      if (
        e.key === expected ||
        e.key.toLowerCase() === expected.toLowerCase()
      ) {
        idx++;
        if (idx === KONAMI.length) {
          idx = 0;
          activate();
        }
      } else {
        idx = 0;
      }
    }

    function activate() {
      const root = document.documentElement;
      root.style.setProperty("--paper", "#EDE5D6");
      root.style.setProperty("--ink", "#0B3A2E");
      root.style.setProperty("--gold-deep", "#B58A4E");
      root.style.setProperty("--gold", "#C9A55A");
      setActive(true);
      setTimeout(() => {
        root.style.removeProperty("--paper");
        root.style.removeProperty("--ink");
        root.style.removeProperty("--gold-deep");
        root.style.removeProperty("--gold");
        setActive(false);
      }, 6000);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[8900] px-4 py-2"
      style={{
        background: "var(--paper-pure)",
        border: "1px solid var(--gold)",
        borderRadius: "2px",
        fontFamily: "var(--font-mono), monospace",
        fontSize: "0.625rem",
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: "var(--gold-deep)",
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block mr-2"
        style={{
          width: "16px",
          height: "1px",
          background: "var(--gold)",
          verticalAlign: "middle",
        }}
      />
      Eclettica unlocked · 6s
    </div>
  );
}
