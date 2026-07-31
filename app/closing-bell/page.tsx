import type { Metadata } from "next";
import Link from "next/link";
import { CLOSING_BELLS, sortBells } from "@/content/closing-bell";
import { getNewsBySlug } from "@/content/news";
import { CONTACT, rootCtaUrl, SITE } from "@/lib/constants";
import styles from "./closing-bell.module.css";

export const dynamic = "force-static";

const canonical = `${SITE.url}/closing-bell`;
const hasPublishedEntries = CLOSING_BELLS.length > 0;

export const metadata: Metadata = {
  title: "Closing Bell — a concise UAE property market close",
  description:
    "An evidence-led format for what changed, why it matters and what to watch next in UAE property.",
  alternates: {
    canonical,
    types: { "application/rss+xml": `${SITE.url}/rss.xml` },
  },
  robots: { index: hasPublishedEntries, follow: true },
  openGraph: {
    title: "Closing Bell — Invest With Raj",
    description:
      "An evidence-led format for what changed, why it matters and what to watch next in UAE property.",
    type: "website",
    url: canonical,
  },
};

export default function ClosingBellPage() {
  const entries = sortBells(CLOSING_BELLS);

  return (
    <main className={styles.page}>
      <JsonLd data={buildSchema(entries)} />

      <section className={styles.hero}>
        <div className={styles.shell}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Closing Bell</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>Editorial format · in production</p>
              <h1>Closing Bell.</h1>
            </div>
            <p className={styles.standfirst}>
              A concise, sourced answer to three questions after a consequential
              market day: what changed, why it matters and what deserves
              attention next.
            </p>
          </div>
        </div>
      </section>

      {entries.length === 0 ? (
        <EmptySlate />
      ) : (
        <PublishedEntries entries={entries} />
      )}

      <section className={styles.method} aria-labelledby="bell-method">
        <div className={`${styles.shell} ${styles.methodGrid}`}>
          <div>
            <p className={styles.kicker}>Publication gate</p>
            <h2 id="bell-method">Short does not mean lightly sourced.</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <p>
                Select only changes supported by a primary source or an
                attributable published report.
              </p>
            </li>
            <li>
              <span>02</span>
              <p>
                Separate the observed fact from Raj’s interpretation of its
                consequence.
              </p>
            </li>
            <li>
              <span>03</span>
              <p>
                Withhold the edition if the evidence cannot support all three
                parts of the close.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className={styles.paths} aria-labelledby="bell-paths">
        <div className={styles.shell}>
          <p className={styles.kicker}>Continue reading</p>
          <h2 id="bell-paths">The published record is already open.</h2>
          <div className={styles.pathGrid}>
            <Link href="/news">
              <span>Reporting</span>
              <strong>All verified news</strong>
              <p>Read the complete articles and their visible citations.</p>
            </Link>
            <Link href="/rss.xml">
              <span>Feed</span>
              <strong>RSS</strong>
              <p>Follow new published reports in your preferred reader.</p>
            </Link>
            <Link href="/about/editorial-standards">
              <span>Method</span>
              <strong>Editorial standards</strong>
              <p>See how sourcing, corrections and review are handled.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`${styles.shell} ${styles.ctaGrid}`}>
          <div>
            <p className={styles.kicker}>The next move is yours</p>
            <h2>Pressure-test the decision with Raj.</h2>
            <p>
              Bring a property, a price and the decision you are weighing. The
              call is a working conversation, not a mass-market pitch.
            </p>
          </div>
          <div className={styles.ctaLinks}>
            <a
              className={styles.primary}
              href={rootCtaUrl({
                campaign: "closing-bell",
                content: "book-a-call",
              })}
            >
              Book a call with Raj
            </a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </div>
        </div>
      </section>
    </main>
  );
}

function EmptySlate() {
  const parts = [
    {
      title: "What changed",
      copy: "The observed market event, stated precisely and linked to its supporting evidence.",
    },
    {
      title: "Why it matters",
      copy: "The consequence for buyers, owners or investors, without turning interpretation into fact.",
    },
    {
      title: "What to watch",
      copy: "A clearly labelled forward-looking question, not a guaranteed outcome.",
    },
  ];

  return (
    <section className={styles.slate} aria-labelledby="bell-slate">
      <div className={styles.shell}>
        <p className={styles.kicker}>No editions published yet</p>
        <h2 id="bell-slate">
          The format is ready. The archive remains empty until a close clears
          review.
        </h2>
        <div className={styles.slateGrid}>
          {parts.map((part, index) => (
            <article key={part.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{part.title}</h3>
              <p>{part.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PublishedEntries({
  entries,
}: {
  entries: typeof CLOSING_BELLS;
}) {
  return (
    <section className={styles.archive} aria-labelledby="bell-archive">
      <div className={styles.shell}>
        <p className={styles.kicker}>Published editions</p>
        <h2 id="bell-archive">The Closing Bell archive</h2>
        <ol className={styles.entryList}>
          {entries.map((entry) => {
            const related = entry.relatedNewsSlug
              ? getNewsBySlug(entry.relatedNewsSlug)
              : null;
            const canLinkRelated = related && related.status !== "research";

            return (
              <li key={entry.slug}>
                <article>
                  <div className={styles.entryHead}>
                    <time dateTime={entry.publishedAt}>
                      {entry.displayDate}
                    </time>
                    <h3>{entry.title}</h3>
                  </div>
                  <ol className={styles.highlights}>
                    {entry.highlights.map((highlight, index) => (
                      <li key={`${entry.slug}-${index}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <p>{highlight}</p>
                      </li>
                    ))}
                  </ol>
                  <blockquote>{entry.rajClose}</blockquote>
                  {canLinkRelated && (
                    <Link href={`/news/${related.slug}`}>
                      Read the related report ↗
                    </Link>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

function buildSchema(entries: typeof CLOSING_BELLS): Record<string, unknown> {
  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Daily Market Read",
        item: SITE.url,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Closing Bell",
        item: canonical,
      },
    ],
  };

  if (entries.length === 0) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: "Closing Bell",
          description:
            "The production slate and publication method for a concise UAE property market close.",
          breadcrumb: { "@id": `${canonical}#breadcrumb` },
        },
        breadcrumb,
      ],
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#collection`,
        url: canonical,
        name: "Closing Bell",
        mainEntity: { "@id": `${canonical}#editions` },
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
      },
      {
        "@type": "ItemList",
        "@id": `${canonical}#editions`,
        numberOfItems: entries.length,
        itemListElement: entries.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Article",
            headline: entry.title,
            datePublished: entry.publishedAt,
          },
        })),
      },
      breadcrumb,
    ],
  };
}
