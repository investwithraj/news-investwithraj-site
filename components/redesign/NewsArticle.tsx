import Image from "next/image";
import Link from "next/link";

import type { AreaPage } from "@/content/areas/types";
import type { NewsArticle as NewsArticleType } from "@/content/news/types";
import { resolveArticleDisplayMedia } from "@/lib/article-display-media";
import type { DeveloperProfile } from "@/lib/developers";
import {
  categoryLabel,
  consequenceExcerpt,
  decisionCta,
  displayMarkets,
  evidenceSummary,
  formatEditorialDate,
  readingMinutes,
  sourceTierForCitation,
} from "@/lib/news-editorial";
import type { Vertical } from "@/lib/verticals";

import styles from "./NewsArticle.module.css";

const TIER_LABELS = {
  government: "Official / government",
  "national-press": "National press",
  "regional-press": "Regional press",
  "institutional-research": "Institutional research",
  "industry-portal": "Industry source",
} as const;

type Props = {
  article: NewsArticleType;
  newer: NewsArticleType | null;
  older: NewsArticleType | null;
  relatedAreas: AreaPage[];
  relatedDevelopers: DeveloperProfile[];
  relatedVerticals: Vertical[];
};

export default function NewsArticle({
  article,
  newer,
  older,
  relatedAreas,
  relatedDevelopers,
  relatedVerticals,
}: Props) {
  const paragraphs = article.body.split(/\n\n+/).filter(Boolean);
  const evidence = evidenceSummary(article);
  const readTime = readingMinutes(article);
  const consequence = consequenceExcerpt(article);
  const cta = decisionCta(article);
  const markets = displayMarkets(article);
  const displayMedia = resolveArticleDisplayMedia(article);
  const pageUrl = `https://news.investwithraj.com/news/${article.slug}`;
  const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    pageUrl,
  )}`;
  const emailShare = `mailto:?subject=${encodeURIComponent(
    article.title,
  )}&body=${encodeURIComponent(pageUrl)}`;

  return (
    <main id="main" className={styles.page}>
      <article>
        <header className={styles.header}>
          <div className={styles.headerGrid} aria-hidden="true" />
          <Link href="/news" className={styles.back}>
            ← Chronological archive
          </Link>
          <div className={styles.meta}>
            <span>{categoryLabel(article.category)}</span>
            <span>{markets.join(" / ")}</span>
            <time dateTime={article.publishedAt}>{article.displayDate}</time>
            <span>{readTime} min read</span>
          </div>
          <h1>{article.title}</h1>
          <p className={styles.subtitle}>{article.subtitle}</p>
          <div className={styles.byline}>
            <Link href="/about" className={styles.author}>
              <b>Raj Tomar</b>
              <span>Dubai-based property advisor and author</span>
            </Link>
            <span className={styles.dates}>
              <span>
                Published{" "}
                <time dateTime={article.publishedAt}>
                  {formatEditorialDate(article.publishedAt)}
                </time>
              </span>
              <span>
                Last modified{" "}
                <time dateTime={article.modifiedAt}>
                  {formatEditorialDate(article.modifiedAt)}
                </time>
              </span>
            </span>
          </div>
        </header>

        {displayMedia ? (
          <figure className={styles.hero}>
            <Image
              src={displayMedia.src}
              alt={displayMedia.alt}
              fill
              priority
              sizes="100vw"
            />
            <span className={styles.heroShade} aria-hidden="true" />
            <figcaption>
              {displayMedia.label} · {displayMedia.credit}. {displayMedia.notice}
            </figcaption>
          </figure>
        ) : (
          <div
            className={styles.heroFallback}
            role="img"
            aria-label="No verified context image is published for this report"
          >
            <span>Source-led report</span>
            <strong>{markets.join(" / ")}</strong>
            <p>
              No unrelated image is used. Visual context appears only when its
              subject, source and rights record match this report.
            </p>
            <small>
              {categoryLabel(article.category)} · {article.displayDate}
            </small>
          </div>
        )}

        <div className={styles.articleGrid}>
          <aside className={styles.tldr} aria-labelledby="signal-title">
            <p id="signal-title">The signal</p>
            <ol>
              {article.tldr.map((item, index) => (
                <li key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </aside>

          <div className={styles.body}>
            <div className={styles.disclosure}>
              <span>AI assistance</span>
              <p>
                AI may assist discovery, research organisation, summarisation,
                structure and drafting. It is never treated as a source. The
                same sourcing and verification rules apply to every draft.{" "}
                <Link href="/about/editorial-standards">
                  Read the editorial standard.
                </Link>
              </p>
            </div>

            {paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
            ))}

            <section className={styles.consequence}>
              <span>Editorial context</span>
              <h2>Why this may matter.</h2>
              <p>{consequence}</p>
              <small>
                This passage is excerpted from the report above. It is
                contextual analysis, not an independent source or a promised
                outcome.
              </small>
            </section>

            {article.semaform?.theTake ? (
              <section className={styles.take}>
                <span>Raj&apos;s read</span>
                <h2>The consequence behind the headline.</h2>
                <p>{article.semaform.theTake}</p>
              </section>
            ) : null}

            {article.semaform?.realityCheck ? (
              <section className={styles.reality}>
                <span>Reality check</span>
                <p>{article.semaform.realityCheck}</p>
              </section>
            ) : null}

            {article.semaform?.whatHappensNext ? (
              <section className={styles.next}>
                <span>What happens next</span>
                <p>{article.semaform.whatHappensNext}</p>
              </section>
            ) : null}
          </div>

          <aside className={styles.sourceRail}>
            <p>Evidence status</p>
            <strong>{evidence.sourceCount}</strong>
            <span>{evidence.label}</span>
            <small>{evidence.detail}</small>
            <nav aria-label="Editorial information">
              <Link href="/about">Author profile ↗</Link>
              <Link href="/about/editorial-standards">
                Editorial standards ↗
              </Link>
            </nav>
          </aside>
        </div>

        <section className={styles.sources} aria-labelledby="sources-title">
          <header>
            <p>Evidence</p>
            <h2 id="sources-title">Sources &amp; provenance.</h2>
            <p>
              Open the original reporting. Access dates and source tiers are
              shown without implying claim-by-claim binding.
            </p>
          </header>
          <ol>
            {article.citations.map((citation, index) => {
              const tier = sourceTierForCitation(citation);
              return (
                <li key={`${citation.url}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{citation.source}</strong>
                    <small>
                      {tier ? TIER_LABELS[tier] : "Tier not classified"} ·
                      Accessed{" "}
                      {formatEditorialDate(citation.accessedAt)}
                    </small>
                  </div>
                  <a href={citation.url} rel="noopener noreferrer" target="_blank">
                    Open source ↗
                  </a>
                </li>
              );
            })}
          </ol>
          {evidence.limited ? (
            <p className={styles.evidenceNotice}>
              Corroboration is limited on this report. The evidence cue is
              visible here and across the archive so readers can judge the
              source base before acting.
            </p>
          ) : null}
        </section>

        {(relatedAreas.length ||
          relatedDevelopers.length ||
          relatedVerticals.length) ? (
          <section
            className={styles.relations}
            aria-labelledby="related-entities-title"
          >
            <header>
              <p>Entity paths</p>
              <h2 id="related-entities-title">Follow the entities.</h2>
              <p>
                Area and developer links require an explicit name or approved
                alias in this report. Desk links follow the publication
                taxonomy.
              </p>
            </header>
            <div className={styles.relationGrid}>
              {relatedAreas.length ? (
                <section>
                  <h3>Areas mentioned</h3>
                  {relatedAreas.map((area) => (
                    <Link href={`/areas/${area.slug}`} key={area.slug}>
                      <span>{area.emirate}</span>
                      <strong>{area.name}</strong>
                      <i aria-hidden="true">↗</i>
                    </Link>
                  ))}
                </section>
              ) : null}
              {relatedDevelopers.length ? (
                <section>
                  <h3>Developers mentioned</h3>
                  {relatedDevelopers.map((developer) => (
                    <Link
                      href={`/developer/${developer.slug}`}
                      key={developer.slug}
                    >
                      <span>Developer record</span>
                      <strong>{developer.name}</strong>
                      <i aria-hidden="true">↗</i>
                    </Link>
                  ))}
                </section>
              ) : null}
              {relatedVerticals.length ? (
                <section>
                  <h3>Related desks</h3>
                  {relatedVerticals.map((vertical) => (
                    <Link href={`/v/${vertical.slug}`} key={vertical.slug}>
                      <span>Taxonomy match</span>
                      <strong>{vertical.name}</strong>
                      <i aria-hidden="true">↗</i>
                    </Link>
                  ))}
                </section>
              ) : null}
            </div>
          </section>
        ) : null}

        <nav className={styles.share} aria-label="Share or follow this reporting">
          <span>Keep the reporting moving</span>
          <a href={linkedInShare} target="_blank" rel="noopener noreferrer">
            Share on LinkedIn ↗
          </a>
          <a href={emailShare}>Share by email ↗</a>
          <a href="/rss.xml">Follow by RSS ↗</a>
        </nav>

        {article.faq.length ? (
          <section className={styles.faq} aria-labelledby="faq-title">
            <header>
              <p>Quick clarity</p>
              <h2 id="faq-title">Questions this report answers.</h2>
            </header>
            <div>
              {article.faq.map((item, index) => (
                <details key={item.q}>
                  <summary>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {item.q}
                    <i aria-hidden="true">+</i>
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.action}>
          <p>Make it specific</p>
          <h2>{cta.heading}</h2>
          <div>
            <p>
              Bring Raj the position, opportunity or concern. The first call
              is a working session, not a substitute for legal, tax or
              financial advice.
            </p>
            <a href={cta.href}>
              {cta.label} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        {older || newer ? (
          <nav className={styles.more} aria-label="More from the desk">
            {older ? (
              <Link href={`/news/${older.slug}`}>
                <span>Previous report</span>
                <strong>{older.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {newer ? (
              <Link href={`/news/${newer.slug}`}>
                <span>Next report</span>
                <strong>{newer.title}</strong>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </article>
    </main>
  );
}
