"use client";

/**
 * v17 cinematic grade for the NEWS persistent world — a zero-dependency DOM
 * film pass (the MAIN repo uses @react-three/postprocessing, which is NOT a
 * NEWS dependency, so we reproduce the look with composited fixed overlays
 * instead of a GPU EffectComposer). Layers:
 *   • a soft radial vignette (darkens the frame edges toward the true-black void)
 *   • a faint cobalt "bloom" lift over the core so the WebGL embers feel like
 *     they glow into the glass above them.
 * Rendered as a sibling of the <Canvas> (NOT inside it), fixed · z-0 ·
 * pointer-events:none, so it sits with the world behind all DOM content.
 */
export default function PostFX() {
  return (
    <>
      {/* Cobalt core bloom — additive lift over the ember field */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          mixBlendMode: "screen",
          background:
            "radial-gradient(60% 45% at 50% 30%, rgba(37,99,235,0.20) 0%, rgba(37,99,235,0.06) 38%, transparent 70%)",
        }}
      />
      {/* Vignette — seats the frame into the void */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(115% 90% at 50% 42%, transparent 52%, rgba(3,4,10,0.55) 100%)",
        }}
      />
    </>
  );
}
