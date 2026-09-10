import Image from "next/image";
import Link from "next/link";

import type { NewsArticle as NewsArticleType } from "@/content/news/types";
import type {
  ResolvedArticleArea,
  ResolvedArticleDeveloper,
} from "@/lib/article-relations";
import { resolveArticleEditorialMedia } from "@/lib/article-display-media";
import { EDITORIAL } from "@/lib/constants";
import {
  categoryLabel,
  consequenceExcerpt,
  decisionCta,
  displayMarkets,
  evidenceSummary,
  formatEditorialDate,
  readingMinutes,
  sourceNameForCitation,
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
  relatedAreas: readonly ResolvedArticleArea[];
  relatedDevelopers: readonly ResolvedArticleDeveloper[];
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
  const shortUpdate = article.format === "short-update";
  const evidence = evidenceSummary(article);
  const readTime = readingMinutes(article);
  const consequence = consequenceExcerpt(article);
  const cta = decisionCta(article);
  const markets = displayMarkets(article);
  const displayMedia = resolveArticleEditorialMedia(article);
  const pageUrl = `https://news.investwithraj.com/news/${article.slug}`;
  const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    pageUrl,
  )}`;
  const emailShare = `mailto:?subject=${encodeURIComponent(
    article.title,
  )}&body=${encodeURIComponent(pageUrl)}`;

  return (
    <main id="main" className={`${styles.page}${shortUpdate ? ` ${styles.shortUpdate}` : ""}`}>
      <article>
        <div className={styles.identity} data-news-layer="identity">
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
            <Link href={EDITORIAL.bylineUrl} className={styles.author}>
              <b>{EDITORIAL.articleByline}</b>
              <span>{EDITORIAL.articleRole}</span>
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
          {article.correction ? (
            <aside className={styles.correction} aria-label="Correction note">
              <strong>Correction</strong>
              <p>{article.correction.summary}</p>
              <time dateTime={article.correction.correctedAt}>
                {formatEditorialDate(article.correction.correctedAt)}
              </time>
            </aside>
          ) : null}
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
                {displayMedia.label} · {displayMedia.credit}
              </figcaption>
            </figure>
          ) : (
            <div
              className={styles.heroFallback}
              role="img"
              aria-label={`${categoryLabel(article.category)} report for ${markets.join(", ")}`}
            >
              <span>IWR market intelligence</span>
              <strong>The brief.</strong>
              <p>{article.subtitle}</p>
              <small>
                {categoryLabel(article.category)} · {article.displayDate}
              </small>
            </div>
          )}
        </div>

        {!shortUpdate ? <section
          className={`${styles.tldr} article-tldr`}
          aria-labelledby="signal-title"
          data-news-layer="signal"
        >
          <p id="signal-title">The signal</p>
          <ol>
            {article.tldr.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </section> : null}

        <div className={styles.articleGrid} data-news-layer="analysis">

          <div className={`${styles.body} article-body`}>
            {paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
            ))}

            {!shortUpdate ? <section className={styles.consequence}>
              <span>Editorial context</span>
              <h2>Why this may matter.</h2>
              <p>{consequence}</p>
              <small>
                This passage is excerpted from the report above. It is
                contextual analysis, not an independent source or a promised
                outcome.
              </small>
            </section> : null}

            {article.semaform?.theTake ? (
              <section className={styles.take}>
                <span>News Desk analysis</span>
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

          {!shortUpdate ? <aside className={styles.sourceRail}>
            <p>Evidence status</p>
            <strong>{evidence.sourceCount}</strong>
            <span>{evidence.label}</span>
            <small>{evidence.detail}</small>
            <nav aria-label="Editorial information">
              <Link href="/about">About the publication ↗</Link>
              <Link href="/about/editorial-standards">
                Editorial standards ↗
              </Link>
            </nav>
          </aside> : null}
        </div>

        <section
          className={styles.sources}
          aria-labelledby="sources-title"
          data-news-layer="evidence"
        >
          <header>
            <p>{shortUpdate ? "Original reporting" : "Evidence"}</p>
            <h2 id="sources-title">{shortUpdate ? "Read the source." : "Sources & provenance."}</h2>
            <p>
              {shortUpdate ? "The original report behind this update." : "Open the primary reporting behind this analysis."}
            </p>
          </header>
          <ol>
            {article.citations.map((citation, index) => {
              const tier = sourceTierForCitation(citation);
              return (
                <li key={`${citation.url}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{sourceNameForCitation(citation)}</strong>
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

        <section className={styles.context} data-news-layer="context">
          {(relatedAreas.length ||
            relatedDevelopers.length ||
            relatedVerticals.length) ? (
            <div
              className={styles.relations}
              aria-labelledby="related-entities-title"
            >
              <header>
                <p>Entity paths</p>
                <h2 id="related-entities-title">Follow the subject.</h2>
                <p>
                  Continue into the relevant place, developer and market desk
                  behind this report.
                </p>
              </header>
              <div className={styles.relationGrid}>
                {relatedAreas.length ? (
                  <section>
                    <h3>Area dossiers</h3>
                    {relatedAreas.flatMap((area) =>
                      area.advisoryLinks.map((link) => (
                        <a
                          href={link.href}
                          key={`${area.slug}-${link.href}`}
                        >
                          <span>{link.eyebrow}</span>
                          <strong>{link.label}</strong>
                          <i aria-hidden="true">↗</i>
                        </a>
                      )),
                    )}
                  </section>
                ) : null}
                {relatedDevelopers.length ? (
                  <section>
                    <h3>Developer dossiers</h3>
                    {relatedDevelopers.map((developer) => (
                      <a
                        href={developer.advisoryLink.href}
                        key={developer.slug}
                      >
                        <span>{developer.advisoryLink.eyebrow}</span>
                        <strong>{developer.advisoryLink.label}</strong>
                        <i aria-hidden="true">↗</i>
                      </a>
                    ))}
                  </section>
                ) : null}
                {relatedVerticals.length ? (
                  <section>
                    <h3>Related desks</h3>
                    {relatedVerticals.map((vertical) => (
                      <Link
                        href={`/news?desk=${vertical.slug}`}
                        key={vertical.slug}
                      >
                        <span>Editorial desk</span>
                        <strong>{vertical.name}</strong>
                        <i aria-hidden="true">↗</i>
                      </Link>
                    ))}
                  </section>
                ) : null}
              </div>
            </div>
          ) : null}

          {article.faq.length ? (
            <div className={styles.faq} aria-labelledby="faq-title">
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
            </div>
          ) : null}
        </section>

        <footer className={styles.finalLayer} data-news-layer="next-action">
          <nav
            className={styles.share}
            aria-label="Share or follow this reporting"
          >
            <span>Keep the reporting moving</span>
            <a href={linkedInShare} target="_blank" rel="noopener noreferrer">
              Share on LinkedIn ↗
            </a>
            <a href={emailShare}>Share by email ↗</a>
            <a href="/rss.xml">Follow by RSS ↗</a>
          </nav>

          <section className={styles.action}>
          <p>Make it specific</p>
          <h2>{shortUpdate ? "Talk through your next move." : cta.heading}</h2>
          <div>
            <p>
              {shortUpdate
                ? "Bring the project, area or question you are considering. We will work through the details together."
                : "Bring Raj the position, opportunity or concern. The first call is a working session, not a substitute for legal, tax or financial advice."}
            </p>
            <a href={shortUpdate ? article.cta.href : cta.href}>
              {shortUpdate ? article.cta.label : cta.label} <span aria-hidden="true">↗</span>
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
        </footer>
      </article>
    </main>
  );
}
