// v22 PANGEA revamp — the promise interstitial. Server component, Atlas-Card
// pattern: one full-bleed photograph under a dark scrim, one centred Space
// Grotesk line whose last word turns Fraunces italic gold, and a single mono
// location tag beneath it. No CTA — a pure register moment between sections.
// CSS-keyframe entrances only — static under reduced motion.
import type { ReactNode } from "react";

type PromiseInterstitialProps = {
  image: string;
  alt: string;
  line: string;
  tag: string;
};

/** Split the line so the last word can carry the Fraunces italic gold accent. */
function renderLine(line: string): ReactNode {
  const words = line.trim().split(/\s+/);
  const last = words.pop() ?? "";
  const head = words.join(" ");
  return (
    <>
      {head ? `${head} ` : null}
      <em className="pmi__accent">{last}</em>
    </>
  );
}

export default function PromiseInterstitial({ image, alt, line, tag }: PromiseInterstitialProps) {
  return (
    <section id="the-promise" data-register="dark" className="pmi" aria-label="The promise">
      {/* Backdrop — one real photograph under the register scrim */}
      <div className="pmi__bg" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={alt} className="pmi__img" />
        <div className="pmi__scrim" />
      </div>

      <div className="pmi__inner">
        <h2 className="pmi__line pmi-rise" style={{ animationDelay: "80ms" }}>
          {renderLine(line)}
        </h2>
        <p className="pmi__tag pmi-rise" style={{ animationDelay: "200ms" }}>
          {tag}
        </p>
      </div>

      <style>{`
        .pmi {
          position: relative; min-height: 68svh;
          display: flex; align-items: center; justify-content: center;
          background: #141414; color: #F2EEE7; overflow: hidden;
          text-align: center;
        }
        .pmi__bg { position: absolute; inset: 0; }
        .pmi__img {
          width: 100%; height: 100%; object-fit: cover;
          filter: saturate(0.85);
        }
        .pmi__scrim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(20,20,20,0.55) 0%, rgba(20,20,20,0.85) 100%);
        }
        .pmi__inner {
          position: relative; width: 100%; max-width: 920px;
          margin: 0 auto; padding: 96px clamp(20px, 4vw, 48px);
        }
        .pmi__line {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(1.6rem, 3.4vw, 2.8rem); font-weight: 500;
          line-height: 1.18; letter-spacing: -0.02em;
          color: #F2EEE7; margin: 0;
        }
        .pmi__accent {
          font-family: var(--font-fraunces), serif; font-style: italic;
          font-weight: 400; color: #C9A961;
        }
        .pmi__tag {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.55); margin: 22px 0 0;
        }
        @keyframes pmiRise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pmi-rise { opacity: 0; animation: pmiRise 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .pmi-rise { opacity: 1; animation: none; }
        }
      `}</style>
    </section>
  );
}
