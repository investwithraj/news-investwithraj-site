import Image from "next/image";
import Link from "next/link";

import type { NewsArticle } from "@/content/news/types";
import {
  planDistinctArticleMedia,
  type ArticleDisplayMedia,
} from "@/lib/article-display-media";
import {
  categoryLabel,
  displayMarkets,
  evidenceSummary,
  formatEditorialDate,
  selectDistinctArticles,
} from "@/lib/news-editorial";

import styles from "./NewsHome.module.css";

function ArticleImage({
  article,
  media,
  priority = false,
}: {
  article: NewsArticle;
  media?: ArticleDisplayMedia;
  priority?: boolean;
}) {
  if (!media) {
    return (
      <span className={styles.mediaFallback}>
        <span>Source-led report</span>
        <strong>{displayMarkets(article).join(" / ")}</strong>
        <small>
          {categoryLabel(article.category)} · {article.displayDate}
        </small>
      </span>
    );
  }

  return (
    <>
      <Image
        src={media.src}
        alt={media.alt}
        fill
        priority={priority}
        sizes={
          priority
            ? "(max-width: 900px) 100vw, 66vw"
            : "(max-width: 720px) 100vw, 33vw"
        }
      />
      <span className={styles.imageContext}>
        {media.label} · {media.credit}
      </span>
    </>
  );
}

export default function NewsHome({ articles }: { articles: NewsArticle[] }) {
  const featured = selectDistinctArticles(articles, 10);
  const [lead, ...rest] = featured;
  if (!lead) return null;

  const rail = rest.slice(0, 3);
  const ledger = rest.slice(3, 9);
  const mediaPlan = planDistinctArticleMedia(featured);
  const leadEvidence = evidenceSummary(lead);

  return (
    <main id="main" className={styles.page}>
      <section className={styles.hero} aria-labelledby="news-home-title">
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.heroHead}>
          <p>
            UAE real-estate intelligence
            <span aria-hidden="true" />
          </p>
          <p>
            Latest source-linked publication:{" "}
            {formatEditorialDate(articles[0].publishedAt)}
          </p>
        </div>

        <div className={styles.masthead}>
          <h1 id="news-home-title">
            The market,
            <br />
            without the noise.
          </h1>
          <p>
            What moved. What it changes. What a serious buyer, seller or
            developer should do next.
          </p>
        </div>

        <div className={styles.leadGrid}>
          <Link className={styles.lead} href={`/news/${lead.slug}`}>
            <span className={styles.leadMedia}>
              <ArticleImage
                article={lead}
                media={mediaPlan.get(lead.slug)}
                priority
              />
              <span className={styles.imageShade} />
              <span className={styles.imageIndex}>01</span>
            </span>
            <span className={styles.leadCopy}>
              <span className={styles.meta}>
                <span>
                  {categoryLabel(lead.category)} ·{" "}
                  {displayMarkets(lead).join(" / ")}
                </span>
                <time dateTime={lead.publishedAt}>{lead.displayDate}</time>
              </span>
              <span
                className={`${styles.evidence} ${
                  leadEvidence.limited ? styles.evidenceLimited : ""
                }`}
              >
                Evidence · {leadEvidence.label}
              </span>
              <strong>{lead.title}</strong>
              <span className={styles.subtitle}>{lead.subtitle}</span>
              <span className={styles.signal}>
                <i>Signal</i>
                <span>{lead.tldr[0]}</span>
              </span>
              <span className={styles.open}>Read the full report ↗</span>
            </span>
          </Link>

          <aside className={styles.rail} aria-label="Latest distinct reports">
            <div className={styles.railHead}>
              <span>Latest distinct reports</span>
              <span>{String(articles.length).padStart(2, "0")} live</span>
            </div>
            {rail.map((article, index) => (
              <Link
                href={`/news/${article.slug}`}
                className={styles.railItem}
                key={article.slug}
              >
                <span className={styles.railIndex}>
                  {String(index + 2).padStart(2, "0")}
                </span>
                <span>
                  <span className={styles.meta}>
                    <span>{categoryLabel(article.category)}</span>
                    <time dateTime={article.publishedAt}>
                      {article.displayDate}
                    </time>
                  </span>
                  <strong>{article.title}</strong>
                  <small>{displayMarkets(article).join(" / ")}</small>
                  <small className={styles.railEvidence}>
                    Evidence · {evidenceSummary(article).label}
                  </small>
                </span>
                <i aria-hidden="true">↗</i>
              </Link>
            ))}
          </aside>
        </div>
      </section>

      <section className={styles.ledger} aria-labelledby="ledger-title">
        <header className={styles.sectionHead}>
          <p>Current intelligence</p>
          <h2 id="ledger-title">The consequential read.</h2>
          <p>
            Reporting selected for the decision it affects—not the volume it
            generates. Near-identical event reports are shown once here.
          </p>
        </header>

        <div className={styles.cardGrid}>
          {ledger.map((article, index) => (
            <Link
              href={`/news/${article.slug}`}
              className={styles.card}
              key={article.slug}
            >
              <span className={styles.cardMedia}>
                <ArticleImage
                  article={article}
                  media={mediaPlan.get(article.slug)}
                />
                <span className={styles.imageShade} />
              </span>
              <span className={styles.cardBody}>
                <span className={styles.meta}>
                  <span>
                    {categoryLabel(article.category)} ·{" "}
                    {displayMarkets(article).join(" / ")}
                  </span>
                  <time dateTime={article.publishedAt}>
                    {article.displayDate}
                  </time>
                </span>
                <strong>{article.title}</strong>
                <small>{article.subtitle}</small>
                <small className={styles.cardEvidence}>
                  Evidence · {evidenceSummary(article).label}
                </small>
                <span>{String(index + 5).padStart(2, "0")} ↗</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.doors} aria-label="Explore the intelligence">
        <Link href="/areas">
          <span>01</span>
          <strong>Areas</strong>
          <p>Research-index entries and source-cited reporting by place.</p>
          <i>Open ↗</i>
        </Link>
        <Link href="/developers">
          <span>02</span>
          <strong>Developers</strong>
          <p>Entity-led reporting without unverified profile claims.</p>
          <i>Open ↗</i>
        </Link>
        <Link href="/map">
          <span>03</span>
          <strong>Live map</strong>
          <p>Move from the headline to the geography behind it.</p>
          <i>Open ↗</i>
        </Link>
        <Link href="/pulse">
          <span>04</span>
          <strong>Market pulse</strong>
          <p>The live numbers and the direction underneath them.</p>
          <i>Open ↗</i>
        </Link>
        <Link href="/closing-bell">
          <span>05</span>
          <strong>Closing bell</strong>
          <p>The end-of-day move, compressed into the signal that matters.</p>
          <i>Open ↗</i>
        </Link>
        <Link href="/power-list/2026">
          <span>06</span>
          <strong>Power list</strong>
          <p>The institutions, principals and operators shaping the market.</p>
          <i>Open ↗</i>
        </Link>
      </section>

      <section className={styles.bridge}>
        <p>From information to action</p>
        <h2>A headline is not a strategy.</h2>
        <div>
          <p>
            If a market move changes your position, book a short working call
            with Raj. Bring the decision; leave with the next move.
          </p>
          <a href="https://investwithraj.com/engage?utm_source=news.investwithraj.com&utm_medium=homepage_cta&utm_campaign=editorial_to_advisory">
            Book 15 minutes <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </main>
  );
}
