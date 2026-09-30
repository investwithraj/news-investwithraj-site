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
        <span>Real estate news</span>
        <strong>{displayMarkets(article).join(" / ")}</strong>
        <small>
          {categoryLabel(article.category)} · {article.displayDate}
        </small>
      </span>
    );
  }

  return (
    <>
      <span className={styles.imageViewport}>
        <Image
          src={media.src}
          alt={media.alt}
          fill
          priority={priority}
          data-preserve-wide-frame={media.preserveWideFrame || undefined}
          style={media.preserveWideFrame ? { objectFit: "contain", transform: "none" } : undefined}
          sizes={
            priority
              ? "(max-width: 900px) 100vw, 66vw"
              : "(max-width: 720px) 100vw, 33vw"
          }
        />
        <span className={styles.imageShade} aria-hidden="true" />
      </span>
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
            Latest update:{" "}
            {formatEditorialDate(articles[0].publishedAt)}
          </p>
        </div>

        <div className={styles.masthead}>
          <h1 id="news-home-title">
            The market,
            <br />
            without <br className={styles.mobileBreak} />the noise.
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
              <strong>{lead.title}</strong>
              <span className={styles.subtitle}>{lead.subtitle}</span>
              <span className={styles.signal}>
                <i>Signal</i>
                <span>{lead.tldr[0]}</span>
              </span>
              <span className={styles.open}>Read the full report ↗</span>
            </span>
          </Link>

          <aside className={styles.rail} aria-label="Latest news">
            <div className={styles.railHead}>
              <span>Latest news</span>
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
                </span>
                <i aria-hidden="true">↗</i>
              </Link>
            ))}
          </aside>
        </div>
      </section>

      <section className={styles.ledger} aria-labelledby="ledger-title">
        <header className={styles.sectionHead}>
          <p>More news</p>
          <h2 id="ledger-title">Across the market.</h2>
          <p>
            The latest developments in UAE real estate.
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
                <span>{String(index + 5).padStart(2, "0")} ↗</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.doors} aria-label="Explore the intelligence">
        <Link href="/news">
          <span>01</span>
          <strong>Area filters</strong>
          <p>Find news from the places you follow.</p>
          <i>Open ↗</i>
        </Link>
        <Link href="https://investwithraj.com/developers">
          <span>02</span>
          <strong>Developer dossiers</strong>
          <p>Explore developers and their projects.</p>
          <i>Open ↗</i>
        </Link>
        <Link href="/news">
          <span>03</span>
          <strong>News archive</strong>
          <p>Browse previous stories and market updates.</p>
          <i>Open ↗</i>
        </Link>
        <Link href="/news?desk=dld-pulse">
          <span>04</span>
          <strong>DLD pulse reports</strong>
          <p>Cited Dubai transaction, price and volume reporting.</p>
          <i>Open ↗</i>
        </Link>
      </section>

      <section className={styles.bridge}>
        <p>From information to action</p>
        <h2>Discuss your real estate plans.</h2>
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
