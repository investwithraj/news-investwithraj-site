"use client";

/* ────────────────────────────────────────────────────────────────────────
   V17BodyFlag · sets `data-v17-route="true"` on <body> while the /v17
   subtree is mounted, and removes it on unmount. The v17 layout uses
   this attribute to scope an override CSS block that hides root chrome
   (DldTicker top strip + any other root widgets that clash with v17).
   ──────────────────────────────────────────────────────────────────── */

import { useEffect } from "react";

export default function V17BodyFlag() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    body.setAttribute("data-v17-route", "true");
    return () => {
      body.removeAttribute("data-v17-route");
    };
  }, []);

  return null;
}
