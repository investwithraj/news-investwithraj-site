"use client";

import { CSSProperties, useEffect, useRef } from "react";

/**
 * v16 OfficeBackdrop — atmospheric video-loop panel.
 *
 * The futuristic-office moodboard generations (user-generated via Higgsfield
 * Seedance from the 3 reference images) act as ambient backdrops for sections
 * across the site. This component renders a video loop with a configurable
 * scrim overlay so foreground type stays legible.
 *
 * Variants:
 *   • full   — full-bleed background, scrim from transparent→paper bottom 30%
 *   • right  — anchored to right half (Brandly hero pattern)
 *   • left   — anchored to left half
 *   • halo   — circular spotlight crop (Star Trek bridge moodboard pattern)
 *   • ghost  — very low opacity, sits behind all content as ambience
 */
type Variant = "full" | "right" | "left" | "halo" | "ghost";

interface Props {
  src: string;                  // path to video (mp4/webm)
  poster?: string;              // poster image for instant first paint
  variant?: Variant;
  opacity?: number;             // 0..1, default per variant
  scrim?: boolean;              // overlay a paper gradient for type legibility
  scrimColor?: "paper" | "ink"; // light scrim or dark scrim
  className?: string;
  style?: CSSProperties;
}

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  full: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  right: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "50%",
    height: "100%",
  },
  left: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "50%",
    height: "100%",
  },
  halo: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "min(80vw, 720px)",
    height: "min(80vw, 720px)",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    overflow: "hidden",
  },
  ghost: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
};

const DEFAULT_OPACITY: Record<Variant, number> = {
  full:  0.7,
  right: 0.95,
  left:  0.95,
  halo:  0.8,
  ghost: 0.25,
};

export default function OfficeBackdrop({
  src,
  poster,
  variant = "full",
  opacity,
  scrim = true,
  scrimColor = "paper",
  className,
  style,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Autoplay-policy fallback
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const retry = () => {
      v.play().catch(() => undefined);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      window.removeEventListener("scroll", retry);
    };
    v.play().catch(() => {
      window.addEventListener("pointerdown", retry, { once: true, passive: true });
      window.addEventListener("keydown", retry, { once: true });
      window.addEventListener("scroll", retry, { once: true, passive: true });
    });
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      window.removeEventListener("scroll", retry);
    };
  }, [src]);

  const op = opacity ?? DEFAULT_OPACITY[variant];

  const wrapperStyle: CSSProperties = {
    ...VARIANT_STYLES[variant],
    pointerEvents: "none",
    overflow: "hidden",
    ...style,
  };

  const videoStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: op,
  };

  const scrimGradient =
    scrimColor === "ink"
      ? "linear-gradient(180deg, rgba(10,14,20,0.0) 0%, rgba(10,14,20,0.65) 60%, rgba(10,14,20,0.95) 100%)"
      : "linear-gradient(180deg, rgba(251,251,252,0.0) 0%, rgba(251,251,252,0.6) 65%, rgba(251,251,252,0.92) 100%)";

  return (
    <div
      className={`v16-office-backdrop ${className ?? ""}`}
      style={wrapperStyle}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={videoStyle}
      />
      {scrim && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: scrimGradient,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
