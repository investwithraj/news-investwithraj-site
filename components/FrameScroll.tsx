"use client";

import { useEffect, useRef, useState } from "react";

/**
 * v14 Draftly FrameScroll — zero-GPU cinematic scroll engine.
 *
 * The core technique: scroll position drives the displayed frame of a
 * pre-rendered video sequence. Apple's iPhone product pages do this with
 * 100KB+ JPGs; we use 240-400 WebP frames per section at desktop+mobile
 * resolutions for a 60fps interpolated cinematic feel without any 3D
 * library dependency.
 *
 *   Hero (240 frames, full viewport-locked) — 8s base video at 30fps
 *   Backdrop (240 frames, behind content) — used for atmosphere on other sections
 *
 * Performance:
 *   - All frames preload on mount (Image objects, browser caches them)
 *   - draw() runs in RAF, never re-renders React
 *   - Canvas redraw is GPU-accelerated by browser (no canvas filter ops)
 *   - Mobile gets a 480p variant to keep payload <500KB per section
 *
 * Replaces R3F HeroCenterpiece3D + DubaiSkyline3DLoader + CapitalFlowGlobeLoader.
 */

export interface FrameManifest {
  /** Total frame count */
  frames: number;
  /** Path prefix to desktop frames — e.g. "/draftly-frames/hero/desktop/" */
  desktopPath: string;
  /** Path prefix to mobile frames — e.g. "/draftly-frames/hero/mobile/" */
  mobilePath: string;
  /** File extension — usually "webp" */
  ext: string;
  /** Aspect ratio (width / height) — informs the canvas */
  aspect?: number;
}

interface FrameScrollProps {
  manifest: FrameManifest;
  className?: string;
  children?: React.ReactNode;
  /** How tall the scroll container is, in viewport heights. Default 3 (3vh) */
  scrollHeight?: number;
  /** Object-fit for the canvas. Default "cover" */
  fit?: "cover" | "contain";
}

export default function FrameScroll({
  manifest,
  className,
  children,
  scrollHeight = 3,
  fit = "cover",
}: FrameScrollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [allLoaded, setAllLoaded] = useState(false);

  // Preload frame sequence
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const path = isMobile ? manifest.mobilePath : manifest.desktopPath;
    const imgs: HTMLImageElement[] = [];
    let loadedCount = 0;

    for (let i = 1; i <= manifest.frames; i++) {
      const img = new Image();
      img.src = `${path}${String(i).padStart(4, "0")}.${manifest.ext}`;
      img.onload = () => {
        loadedCount++;
        setLoaded(loadedCount);
        if (loadedCount === manifest.frames) setAllLoaded(true);
      };
      img.onerror = () => {
        // Count errored frames too so we don't hang on first paint
        loadedCount++;
        setLoaded(loadedCount);
        if (loadedCount === manifest.frames) setAllLoaded(true);
      };
      imgs.push(img);
    }
    framesRef.current = imgs;
  }, [manifest]);

  // Scroll-driven canvas redraw
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastIdx = -1;

    function draw() {
      const rect = container!.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const progress = total > 0 ? Math.min(1, scrolled / total) : 0;
      const idx = Math.min(
        manifest.frames - 1,
        Math.floor(progress * manifest.frames)
      );
      if (idx !== lastIdx) {
        const img = framesRef.current[idx];
        if (img && img.complete && img.naturalWidth > 0) {
          // Resize canvas to match image — only on first frame or size change
          if (
            canvas!.width !== img.naturalWidth ||
            canvas!.height !== img.naturalHeight
          ) {
            canvas!.width = img.naturalWidth;
            canvas!.height = img.naturalHeight;
          }
          ctx!.drawImage(img, 0, 0);
          lastIdx = idx;
        }
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, [manifest.frames]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: `${scrollHeight * 100}vh`, position: "relative" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: fit,
            // Show a soft loading state until first frame paints
            opacity: loaded > 0 ? 1 : 0,
            transition: "opacity 320ms var(--ease-out, ease-out)",
          }}
          aria-hidden="true"
        />

        {/* Loading shimmer — visible only while frames preload */}
        {!allLoaded && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, var(--paper-warm) 0%, var(--paper) 50%, var(--paper-warm) 100%)",
              opacity: 1 - loaded / manifest.frames,
              transition: "opacity 200ms linear",
            }}
          />
        )}

        {/* Content overlay — captured-by-children layout */}
        <div className="relative z-10 h-full">{children}</div>
      </div>
    </div>
  );
}
