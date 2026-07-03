// Semaform-style article layout — copies Semafor's named-section grammar:
//   THE FACTS         (TLDR — what happened)
//   THE TAKE          (Raj's POV)
//   THE VIEW FROM …   (stakeholder perspectives, multiple)
//   REALITY CHECK     (counter-POV / what could go wrong)
//   WHAT HAPPENS NEXT (forward look)
//   HOW I'D TRADE IT  (broker call — UHNW-specific)
//
// Each section has a distinct micro-eyebrow + serif headline + body. The
// layout is the article's spine — content can live in the structured
// `article.semaform` fields OR fall back to the legacy `body` string.

import type { NewsArticle, ViewFrom, BrokerTake } from "@/content/news/types";
import { ArticleHero } from "./ArticleHero";

interface Props {
  article: NewsArticle;
}

const ACTION_COLOR: Record<BrokerTake["action"], string> = {
  Buy: "#1F7A4D",
  Watch: "#A88945",
  Avoid: "#A03A3A",
  Trim: "#7A4D1F",
  "Re-rate": "#3A4A7A",
  Position: "#4A3A7A",
};

export function SemaformLayout({ article }: Props) {
  const s = article.semaform || {};
  const hasSemaform = Boolean(
    s.theTake || s.viewsFrom?.length || s.realityCheck || s.whatHappensNext || s.howIdTradeIt
  );

  return (
    <article className="max-w-[760px] mx-auto px-6 md:px-8 py-16 md:py-24">
      {/* Eyebrow + category */}
      <div className="flex items-center gap-3 mb-6 text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: "var(--ink-faint)" }}>
        <span style={{ color: "var(--gold-deep)" }}>{article.category}</span>
        <span aria-hidden>·</span>
        <span>{article.market.join(" + ")}</span>
        <span aria-hidden>·</span>
        <time dateTime={article.publishedAt}>{article.displayDate}</time>
      </div>

      {/* Title — v13 editorial-h1 (Fraunces variable SOFT 50 opsz 144 wt 500) */}
      <h1
        className="editorial-h1 mb-6"
        style={{
          fontSize: "clamp(2.25rem, 5.5vw, 4.5rem)",
          maxWidth: "20ch",
        }}
      >
        {article.title}
      </h1>

      {/* Subtitle */}
      <p
        className="text-lg md:text-xl leading-[1.5] mb-12"
        style={{
          color: "var(--ink-soft)",
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontVariationSettings: '"SOFT" 100, "opsz" 18',
          fontStyle: "italic",
        }}
      >
        {article.subtitle}
      </p>

      {/* Hero image — blog-style figure (auto-sourced; self-hides if missing) */}
      {article.heroImage?.src ? (
        <ArticleHero
          src={article.heroImage.src}
          alt={article.heroImage.alt}
          credit={
            article.heroImage.credit && article.heroImage.credit !== "To be set at review"
              ? article.heroImage.credit
              : undefined
          }
        />
      ) : null}

      {/* THE FACTS — TLDR */}
      <Section eyebrow="The Facts" idx={1}>
        <ul className="space-y-3">
          {article.tldr.map((bullet, i) => (
            <li
              key={i}
              className="pl-6 relative text-base md:text-lg leading-[1.55]"
              style={{ color: "var(--ink-soft)" }}
            >
              <span
                className="absolute left-0 top-[0.65em] w-3 h-px"
                style={{ background: "var(--gold-deep)" }}
                aria-hidden
              />
              {bullet}
            </li>
          ))}
        </ul>
      </Section>

      {/* THE TAKE */}
      {s.theTake && (
        <Section eyebrow="The Take" idx={2}>
          <Prose text={s.theTake} />
        </Section>
      )}

      {/* THE VIEW FROM ... */}
      {s.viewsFrom && s.viewsFrom.length > 0 && (
        <Section eyebrow="The View From" idx={3}>
          <div className="space-y-6">
            {s.viewsFrom.map((v, i) => (
              <ViewCard key={i} view={v} />
            ))}
          </div>
        </Section>
      )}

      {/* REALITY CHECK */}
      {s.realityCheck && (
        <Section eyebrow="Reality Check" idx={4} accent="warm">
          <Prose text={s.realityCheck} />
        </Section>
      )}

      {/* WHAT HAPPENS NEXT */}
      {s.whatHappensNext && (
        <Section eyebrow="What Happens Next" idx={5}>
          <Prose text={s.whatHappensNext} />
        </Section>
      )}

      {/* HOW I'D TRADE IT */}
      {s.howIdTradeIt && (
        <Section eyebrow="How I'd Trade It" idx={6} accent="trade">
          <BrokerCard call={s.howIdTradeIt} />
        </Section>
      )}

      {/* FEATURE BODY — flat-body articles (the daily auto-drafts) render as a
          premium feature read: drop-cap, larger measure, flowing prose. */}
      {!hasSemaform && article.body && (
        <div className="my-12 md:my-14">
          <FeatureProse text={article.body} />
        </div>
      )}

      {/* FAQ — if present */}
      {article.faq && article.faq.length > 0 && (
        <Section eyebrow="Asked & Answered" idx={7}>
          <dl className="space-y-5">
            {article.faq.map((q, i) => (
              <div key={i}>
                <dt
                  className="font-medium text-base mb-1.5"
                  style={{ color: "var(--ink)" }}
                >
                  {q.q}
                </dt>
                <dd
                  className="text-[15px] leading-[1.65]"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {q.a}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* CITATIONS */}
      {article.citations.length > 0 && (
        <Section eyebrow="Sources Cited" idx={8}>
          <ul className="space-y-2 text-sm">
            {article.citations.map((c, i) => (
              <li key={i}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 decoration-[var(--gold-soft)] hover:decoration-[var(--gold-deep)]"
                  style={{ color: "var(--ink-soft)" }}
                  data-magnetic
                >
                  {c.source}
                </a>
                {c.tier && (
                  <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "var(--ink-faint)" }}>
                    {c.tier}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* CTA */}
      <div className="mt-16 pt-12 border-t" style={{ borderColor: "var(--gold-soft)" }}>
        <a
          href={article.cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-graphite group inline-flex"
          data-magnetic
        >
          <span>{article.cta.label}</span>
          <span aria-hidden className="transition-transform group-hover:translate-x-1">↗</span>
        </a>
      </div>
    </article>
  );
}

function Section({
  eyebrow,
  idx,
  children,
  accent,
}: {
  eyebrow: string;
  idx: number;
  children: React.ReactNode;
  accent?: "warm" | "trade";
}) {
  const accentBg =
    accent === "warm"
      ? "var(--paper-warm)"
      : accent === "trade"
        ? "rgba(201, 169, 97, 0.06)"
        : "transparent";
  return (
    <section
      className="my-12 md:my-14"
      style={{ background: accentBg, borderRadius: accent ? "16px" : 0, padding: accent ? "1.5rem 1.5rem 0.5rem" : 0 }}
    >
      <header className="mb-5 flex items-baseline gap-3">
        <span
          className="font-mono text-[10px] tabular-nums"
          style={{ color: "var(--gold-deep)" }}
        >
          {String(idx).padStart(2, "0")}
        </span>
        <h2
          className="text-[11px] font-mono uppercase tracking-[0.28em]"
          style={{ color: "var(--ink-soft)" }}
        >
          {eyebrow}
        </h2>
        <div className="flex-1 h-px" style={{ background: "var(--gold-soft)" }} aria-hidden />
      </header>
      <div>{children}</div>
    </section>
  );
}

function Prose({ text }: { text: string }) {
  // Split paragraphs by blank line
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  return (
    <div className="space-y-5">
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className="text-base md:text-[17px] leading-[1.7]"
          style={{ color: "var(--ink-soft)" }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

/** Premium feature-article prose for flat-body articles — drop-cap on the
 *  opening paragraph, generous reading measure. Server-component-safe (inline
 *  styles + a manual drop-cap span; no ::first-letter, no styled-jsx). */
function FeatureProse({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const proseStyle: React.CSSProperties = {
    color: "var(--ink-soft)",
    fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)",
    lineHeight: 1.75,
  };
  return (
    <div className="space-y-6">
      {paragraphs.map((p, i) => {
        if (i === 0 && p.length > 1) {
          return (
            <p key={i} style={proseStyle}>
              <span
                aria-hidden
                style={{
                  float: "left",
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontSize: "3.6rem",
                  lineHeight: 0.8,
                  paddingRight: "0.09em",
                  marginTop: "0.05em",
                  color: "var(--gold-deep)",
                  fontWeight: 500,
                  fontVariationSettings: '"SOFT" 40, "opsz" 144',
                }}
              >
                {p[0]}
              </span>
              {p.slice(1)}
            </p>
          );
        }
        return (
          <p key={i} style={proseStyle}>
            {p}
          </p>
        );
      })}
    </div>
  );
}

function ViewCard({ view }: { view: ViewFrom }) {
  return (
    <figure
      className="border-l-2 pl-5 py-1.5"
      style={{ borderColor: "var(--gold-deep)" }}
    >
      <blockquote
        className="text-base md:text-[17px] leading-[1.65] mb-2"
        style={{ color: "var(--ink-soft)" }}
      >
        “{view.view}”
      </blockquote>
      <figcaption className="text-xs font-mono uppercase tracking-[0.18em]">
        <span style={{ color: "var(--ink)" }}>{view.source}</span>
        {view.role && (
          <>
            {" "}
            <span style={{ color: "var(--ink-faint)" }}>· {view.role}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}

function BrokerCard({ call }: { call: BrokerTake }) {
  const color = ACTION_COLOR[call.action];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className="px-3 py-1 rounded-full text-xs font-mono uppercase tracking-[0.18em] font-medium"
          style={{
            background: `${color}15`,
            color,
            border: `1px solid ${color}33`,
          }}
        >
          {call.action}
        </span>
        {call.horizon && (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "var(--ink-faint)" }}>
            Horizon · {call.horizon}
          </span>
        )}
      </div>
      <p
        className="text-base md:text-[17px] leading-[1.65]"
        style={{ color: "var(--ink-soft)" }}
      >
        {call.reasoning}
      </p>
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em] mt-1"
        style={{ color: "var(--ink-faint)" }}
      >
        — Raj Tomar · real-estate consultant
      </p>
    </div>
  );
}
