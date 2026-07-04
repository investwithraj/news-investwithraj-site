/**
 * WordmarkSignoff — the GiantWordmark "INVEST WITH RAJ" page-end sign-off,
 * exactly the band the Terminal home already closes with (app/page.tsx):
 * the three words spread edge-to-edge, each with the tracking-breathe
 * scroll-in inside its own clip mask. Server-component-safe wrapper (the
 * GiantWordmark island handles the client motion).
 *
 * Mount ONCE at the very end of a page that lacks a footer sign-off.
 * Decorative — the accessible brand name lives in the page content.
 */

import GiantWordmark from "./GiantWordmark";

export default function WordmarkSignoff({ color }: { color?: string }) {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-[1240px] items-end justify-between px-6 pb-10 pt-4 md:px-10"
      style={{ gap: "clamp(8px, 2vw, 40px)", lineHeight: 0.72 }}
    >
      {"INVEST WITH RAJ".split(" ").map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="block overflow-hidden"
          style={{ paddingBottom: "0.06em", marginBottom: "-0.06em" }}
        >
          <GiantWordmark
            text={word}
            sizeClamp="clamp(2.25rem, 9.5vw, 9.5rem)"
            trackingBreathe
            decorative
            style={color ? { color } : undefined}
          />
        </span>
      ))}
    </div>
  );
}
