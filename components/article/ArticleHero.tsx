"use client";

// Blog-style inline hero figure for news articles. Renders the auto-sourced
// (or manually-set) heroImage as a captioned figure beneath the standfirst.
// Hides itself gracefully if the image 404s — older articles + research stubs
// reference a cover that was never created, and we never want a broken icon.
import { useState } from "react";

export function ArticleHero({
  src,
  alt,
  credit,
}: {
  src: string;
  alt: string;
  credit?: string;
}) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return null;
  return (
    <figure className="mb-12">
      <div
        style={{
          borderRadius: "14px",
          overflow: "hidden",
          border: "1px solid var(--hairline, rgba(10,15,26,0.08))",
          boxShadow: "0 24px 60px -34px rgba(6,12,28,0.35)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setOk(false)}
          style={{ width: "100%", height: "auto", maxHeight: "460px", objectFit: "cover", display: "block" }}
        />
      </div>
      {credit ? (
        <figcaption
          className="mt-2 font-mono uppercase"
          style={{ fontSize: "10px", letterSpacing: "0.14em", color: "var(--ink-faint)" }}
        >
          {credit}
        </figcaption>
      ) : null}
    </figure>
  );
}
