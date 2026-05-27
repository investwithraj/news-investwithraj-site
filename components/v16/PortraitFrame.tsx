"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";

/**
 * v16 PortraitFrame — rounded portrait video/image card with chrome
 * hairline outline + soft drop-shadow.
 *
 * Reference: Brandly centered hero portrait. The card sits in the middle
 * of the hero composition with H1 left and stat cards right.
 *
 * Supports both <video> and <img> sources. Video gets autoplay+loop+muted.
 * Image gets standard rendering. Poster fallback shown while video loads.
 *
 * Optional caption renders inside the frame at the bottom (Brandly pattern).
 */
type AspectRatio = "4:5" | "3:4" | "1:1" | "16:9" | "9:16";

interface Props {
  src: string;
  type?: "video" | "image";    // auto-inferred from extension if omitted
  poster?: string;              // for video; or fallback image
  aspect?: AspectRatio;
  caption?: string;
  captionItalic?: boolean;
  variant?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

const ASPECT_MAP: Record<AspectRatio, string> = {
  "4:5":  "4 / 5",
  "3:4":  "3 / 4",
  "1:1":  "1 / 1",
  "16:9": "16 / 9",
  "9:16": "9 / 16",
};

function inferType(src: string): "video" | "image" {
  if (/\.(mp4|webm|mov)$/i.test(src)) return "video";
  return "image";
}

export default function PortraitFrame({
  src,
  type,
  poster,
  aspect = "4:5",
  caption,
  captionItalic = true,
  variant = "light",
  className,
  style,
  alt = "",
}: Props) {
  const mediaType = type ?? inferType(src);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  // Autoplay-policy fallback — retry play() on first user gesture
  useEffect(() => {
    if (mediaType !== "video") return;
    const v = videoRef.current;
    if (!v) return;

    const retryPlay = () => {
      v.play().catch(() => undefined);
      window.removeEventListener("pointerdown", retryPlay);
      window.removeEventListener("keydown", retryPlay);
      window.removeEventListener("scroll", retryPlay);
    };

    v.play()
      .then(() => setVideoReady(true))
      .catch(() => {
        window.addEventListener("pointerdown", retryPlay, { once: true, passive: true });
        window.addEventListener("keydown", retryPlay, { once: true });
        window.addEventListener("scroll", retryPlay, { once: true, passive: true });
      });

    return () => {
      window.removeEventListener("pointerdown", retryPlay);
      window.removeEventListener("keydown", retryPlay);
      window.removeEventListener("scroll", retryPlay);
    };
  }, [mediaType, src]);

  const frameStyle: CSSProperties = {
    position: "relative",
    aspectRatio: ASPECT_MAP[aspect],
    borderRadius: "var(--v16-radius-lg)",
    overflow: "hidden",
    border: `1px solid ${variant === "dark" ? "var(--v16-ink-card-border)" : "var(--v16-chrome)"}`,
    boxShadow:
      variant === "dark"
        ? "var(--v16-shadow-portrait-dark)"
        : "var(--v16-shadow-portrait)",
    background: variant === "dark" ? "var(--v16-ink-card)" : "var(--v16-paper-cool)",
    ...style,
  };

  const mediaStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    opacity: mediaType === "video" && !videoReady && poster ? 0.99 : 1,
    transition: "opacity 400ms var(--v16-ease-out)",
  };

  return (
    <div className={`v16-portrait-frame ${className ?? ""}`} style={frameStyle}>
      {mediaType === "video" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden={!caption}
          style={mediaStyle}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} style={mediaStyle} />
      )}

      {caption && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "12px 16px",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
            color: "var(--v16-paper)",
            fontFamily: captionItalic
              ? "var(--v16-font-display), Georgia, serif"
              : "var(--v16-font-mono), monospace",
            fontStyle: captionItalic ? "italic" : "normal",
            fontSize: captionItalic ? "0.9rem" : "0.6875rem",
            fontWeight: captionItalic ? 400 : 500,
            letterSpacing: captionItalic ? "-0.01em" : "0.22em",
            textTransform: captionItalic ? "none" : "uppercase",
            fontVariationSettings: captionItalic
              ? '"SOFT" 30, "opsz" 36, "WONK" 1'
              : undefined,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
