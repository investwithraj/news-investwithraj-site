import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllPowerListYears,
  getPowerListByYear,
  type PowerListEntry,
} from "@/content/power-list";
import { CONTACT, rootCtaUrl, SITE } from "@/lib/constants";
import styles from "./power-list.module.css";

export const dynamic = "force-static";
export const dynamicParams = false;

const currentEdition = new Date().getFullYear().toString();

export function generateStaticParams() {
  return Array.from(
    new Set([...getAllPowerListYears(), currentEdition]),
  ).map((year) => ({ year }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  const edition = getPowerListByYear(year);
  const hasPublishedEntries = Boolean(edition?.entries.length);
  const canonical = `${SITE.url}/power-list/${year}`;

  return {
    title: `Power List research file ${year} — UAE property`,
    description: hasPublishedEntries
      ? edition!.intro
      : `The research method, evidence standard and nomination route for the ${year} UAE property Power List file.`,
    alternates: { canonical },
    robots: { index: hasPublishedEntries, follow: true },
    openGraph: {
      title: `Power List research file ${year} — Invest With Raj`,
      description: hasPublishedEntries
        ? edition!.intro
        : "An evidence-led research file in production. No list or ranking has been published.",
      type: "website",
      url: canonical,
    },
  };
}

export default async function PowerListPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();

  const edition = getPowerListByYear(year);
  const entries = edition?.entries ?? [];
  const canonical = `${SITE.url}/power-list/${year}`;

  return (
    <main className={styles.page}>
      <JsonLd data={buildSchema({ year, edition, entries, canonical })} />

      <section className={styles.hero}>
        <div className={styles.shell}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Power List {year}</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>Annual research file · {year}</p>
              <h1>Power, evidenced.</h1>
            </div>
            <div className={styles.status}>
              <span>Current state</span>
              <strong>
                {entries.length > 0
                  ? "Published research file"
                  : "Research in progress · no list published"}
              </strong>
              <p>
                The edition has no promised size and is not a popularity poll.
              </p>
            </div>
          </div>
        </div>
      </section>

      {entries.length > 0 ? (
        <PublishedEdition year={year} intro={edition!.intro} entries={entries} />
      ) : (
        <ResearchState year={year} />
      )}

      <section className={styles.method} aria-labelledby="power-method">
        <div className={styles.shell}>
          <p className={styles.kicker}>Research method</p>
          <h2 id="power-method">A case for inclusion must survive the evidence.</h2>
          <div className={styles.methodGrid}>
            <article>
              <span>01</span>
              <h3>Define relevance</h3>
              <p>
                The person’s documented work must materially connect to UAE
                property, capital, regulation, delivery or market information
                during the edition period.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Build the record</h3>
              <p>
                Review public disclosures, filings, official project records
                and attributable reporting. Visibility alone is not evidence.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Test the case</h3>
              <p>
                Challenge impact, recency, conflicts and missing context before
                an entry can move from research to publication.
              </p>
            </article>
            <article>
              <span>04</span>
              <h3>Publish sources</h3>
              <p>
                Each published case carries its supporting links and can be
                corrected when better evidence becomes available.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.categories} aria-labelledby="power-categories">
        <div className={`${styles.shell} ${styles.categoryGrid}`}>
          <div>
            <p className={styles.kicker}>Research lenses</p>
            <h2 id="power-categories">Seven categories, one evidence standard.</h2>
          </div>
          <ul>
            {[
              "Developers",
              "Brokers",
              "Investors",
              "Regulators",
              "Sovereign platforms",
              "Advisors",
              "Market media",
            ].map((category) => (
              <li key={category}>{category}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.nominate}>
        <div className={`${styles.shell} ${styles.nominateGrid}`}>
          <div>
            <p className={styles.kicker}>Submit evidence</p>
            <h2>Nominate a person by making the case, not the claim.</h2>
            <p>
              Include the person’s role, the relevant work, the edition year
              and public links that let the editorial team verify it. A
              nomination does not guarantee inclusion.
            </p>
          </div>
          <a
            className={styles.nominationLink}
            href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(`Power List ${year} evidence submission`)}`}
          >
            Send evidence to {CONTACT.email}
          </a>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`${styles.shell} ${styles.ctaGrid}`}>
          <div>
            <p className={styles.kicker}>Your own decision</p>
            <h2>Talk through the market with Raj.</h2>
            <p>
              For a specific UAE property decision, bring Raj the asset, price
              and alternatives you are considering.
            </p>
          </div>
          <a
            className={styles.primary}
            href={rootCtaUrl({
              campaign: `power-list-${year}`,
              content: "book-a-call",
            })}
          >
            Book a call with Raj
          </a>
        </div>
      </section>
    </main>
  );
}

function ResearchState({ year }: { year: string }) {
  return (
    <section className={styles.research} aria-labelledby="research-state">
      <div className={`${styles.shell} ${styles.researchGrid}`}>
        <div>
          <p className={styles.kicker}>No published entries</p>
          <h2 id="research-state">The {year} file is still an open research question.</h2>
        </div>
        <p>
          Names, positions and evidence remain private working material until
          the edition clears review. This page will not display placeholder
          people, synthetic portraits or a pre-declared ranking.
        </p>
      </div>
    </section>
  );
}

function PublishedEdition({
  year,
  intro,
  entries,
}: {
  year: string;
  intro: string;
  entries: PowerListEntry[];
}) {
  return (
    <section className={styles.edition} aria-labelledby="published-edition">
      <div className={styles.shell}>
        <p className={styles.kicker}>Published research · {year}</p>
        <h2 id="published-edition">{intro}</h2>
        <ol className={styles.entryList}>
          {entries.map((entry) => (
            <li key={`${entry.name}-${entry.company}`}>
              <article>
                <div className={styles.entryMeta}>
                  <span>{entry.category}</span>
                  <p>{entry.role} · {entry.company}</p>
                </div>
                <div>
                  <h3>{entry.name}</h3>
                  <p>{entry.caseForInclusion}</p>
                  {entry.evidence.length > 0 && (
                    <ul className={styles.evidence}>
                      {entry.evidence.map((source) => (
                        <li key={source.url}>
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.label} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            </li>
          ))}
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

function buildSchema({
  year,
  edition,
  entries,
  canonical,
}: {
  year: string;
  edition: ReturnType<typeof getPowerListByYear>;
  entries: PowerListEntry[];
  canonical: string;
}): Record<string, unknown> {
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
        name: `Power List ${year}`,
        item: canonical,
      },
    ],
  };

  if (!edition || entries.length === 0) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: `Power List research file ${year}`,
          description:
            "Research method and evidence submission route for an unpublished annual file.",
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
        name: `Power List research file ${year}`,
        description: edition.intro,
        datePublished: edition.publishedAt,
        dateModified: edition.modifiedAt ?? edition.publishedAt,
        mainEntity: { "@id": `${canonical}#entries` },
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
      },
      {
        "@type": "ItemList",
        "@id": `${canonical}#entries`,
        numberOfItems: entries.length,
        itemListElement: entries.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Person",
            name: entry.name,
            jobTitle: entry.role,
            worksFor: {
              "@type": "Organization",
              name: entry.company,
            },
          },
        })),
      },
      breadcrumb,
    ],
  };
}
