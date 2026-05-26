"use client";

/**
 * v13 SOTY material divider — 64px section break that evokes a physical
 * material (cashmere weave, brass strip, marble vein, satin sheen).
 *
 * Used between major sections to give the page a luxury-magazine rhythm.
 * Lazy-loaded — placement is decorative, not informational.
 *
 * Each variant uses CSS-only gradients (no image dependency) so they load
 * instantly. The 4% film grain in the overlay (site-wide via .film-grain)
 * sits on top and adds material texture.
 */

type Material =
  | "cream-fade"      /* cream → taupe vertical gradient */
  | "brass-strip"     /* thin brass hairline + cream */
  | "cashmere"        /* warm cream with horizontal weave illusion */
  | "marble-vein"     /* cream with a faint vein curve */
  | "ink-cream"       /* dark transition into cream */
  | "satin-band";     /* satin-sheen horizontal band */

export default function MaterialDivider({
  material = "cream-fade",
  height = 64,
}: {
  material?: Material;
  height?: number;
}) {
  const variants: Record<Material, React.CSSProperties> = {
    "cream-fade": {
      background:
        "linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%)",
    },
    "brass-strip": {
      background: "var(--paper)",
      position: "relative",
    },
    cashmere: {
      background: `
        linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%),
        repeating-linear-gradient(0deg,
          rgba(155, 139, 126, 0.04) 0px,
          rgba(155, 139, 126, 0.04) 1px,
          transparent 1px,
          transparent 3px)
      `,
    },
    "marble-vein": {
      background: "var(--paper)",
      position: "relative",
      overflow: "hidden",
    },
    "ink-cream": {
      background:
        "linear-gradient(180deg, var(--ink) 0%, var(--paper) 100%)",
    },
    "satin-band": {
      background: `
        linear-gradient(90deg,
          var(--paper-warm) 0%,
          var(--paper-pure) 30%,
          var(--paper-warm) 50%,
          var(--paper-pure) 70%,
          var(--paper-warm) 100%)
      `,
    },
  };

  return (
    <div
      aria-hidden="true"
      style={{
        width: "100%",
        height: `${height}px`,
        ...variants[material],
      }}
    >
      {material === "brass-strip" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "max(1.5rem, calc((100vw - 1280px) / 2 + 3rem))",
            right: "max(1.5rem, calc((100vw - 1280px) / 2 + 3rem))",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent 0%, var(--gold) 20%, var(--gold) 80%, transparent 100%)",
          }}
        />
      )}
      {material === "marble-vein" && (
        <svg
          viewBox="0 0 1200 64"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.18,
          }}
        >
          <path
            d="M 0 32 Q 200 8, 400 28 T 800 32 T 1200 28"
            stroke="var(--ink-muted)"
            strokeWidth="0.8"
            fill="none"
          />
          <path
            d="M 0 44 Q 300 24, 600 36 T 1200 40"
            stroke="var(--ink-faint)"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>
      )}
    </div>
  );
}
