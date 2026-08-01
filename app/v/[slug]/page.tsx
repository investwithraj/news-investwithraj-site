import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NEWS_ARTICLES } from "@/content/news";
import { CONTACT, rootCtaUrl, SITE } from "@/lib/constants";
import { PUBLIC_AREAS, PUBLIC_DEVELOPERS } from "@/lib/public-content";
import {
  getVerticalArticles,
  getVerticalBySlug,
  VERTICALS,
} from "@/lib/verticals";
import styles from "./vertical.module.css";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return VERTICALS.map((vertical) => ({ slug: vertical.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vertical = getVerticalBySlug(slug);
  if (!vertical) return { title: "Desk not found" };

  const articles = getVerticalArticles(vertical, NEWS_ARTICLES);
  const hasPublishedReports = articles.length > 0;
  const title = `${vertical.name} — UAE property intelligence`;

  return {
    title,
    description: vertical.description,
    alternates: {
      canonical: `${SITE.url}/v/${vertical.slug}`,
      types: { "application/rss+xml": `${SITE.url}/rss.xml` },
    },
    robots: {
      index: hasPublishedReports,
      follow: true,
    },
    openGraph: {
      title,
      description: vertical.description,
      type: "website",
      url: `${SITE.url}/v/${vertical.slug}`,
    },
  };
}

export default async function VerticalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vertical = getVerticalBySlug(slug);
  if (!vertical) notFound();

  const articles = getVerticalArticles(vertical, NEWS_ARTICLES);
  const areas = vertical.relatedAreaSlugs
    .map((areaSlug) => PUBLIC_AREAS.find((area) => area.slug === areaSlug))
    .filter((area): area is (typeof PUBLIC_AREAS)[number] => Boolean(area));
  const developers = vertical.relatedDeveloperSlugs
    .map((developerSlug) =>
      PUBLIC_DEVELOPERS.find((developer) => developer.slug === developerSlug),
    )
    .filter(
      (developer): developer is (typeof PUBLIC_DEVELOPERS)[number] =>
        Boolean(developer),
    );
  const canonical = `${SITE.url}/v/${vertical.slug}`;
  const schema = buildSchema({
    name: vertical.name,
    description: vertical.description,
    canonical,
    articles,
  });

  return (
    <main className={styles.page}>
      <JsonLd data={schema} />

      <section className={styles.hero}>
        <div className={styles.shell}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{vertical.name}</span>
          </nav>

          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>Editorial desk {vertical.glyph}</p>
              <h1>{vertical.name}</h1>
              <p className={styles.standfirst}>{vertical.tagline}</p>
            </div>
            <div className={styles.deskNote}>
              <span>Publication basis</span>
              <p>{vertical.cadence}</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.intro}>
        <div className={`${styles.shell} ${styles.introGrid}`}>
          <div>
            <p className={styles.sectionLabel}>The remit</p>
            <p className={styles.description}>{vertical.description}</p>
          </div>
          <aside className={styles.method}>
            <p className={styles.sectionLabel}>How stories enter this desk</p>
            <p>{vertical.method}</p>
            <Link href="/about/editorial-standards">Read our standards</Link>
          </aside>
        </div>
      </section>

      <section className={styles.archive} aria-labelledby="archive-heading">
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.sectionLabel}>Published reports</p>
              <h2 id="archive-heading">The desk archive</h2>
            </div>
            <p>
              {articles.length} {articles.length === 1 ? "report" : "reports"}{" "}
              currently meet the published scope.
            </p>
          </div>

          {articles.length > 0 ? (
            <ol className={styles.storyList}>
              {articles.map((article, index) => (
                <li key={article.slug}>
                  <Link
                    href={`/news/${article.slug}`}
                    className={styles.story}
                  >
                    <span className={styles.storyNumber}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.storyCopy}>
                      <span className={styles.storyMeta}>
                        {article.category.replaceAll("-", " ")}
                        <span aria-hidden> · </span>
                        <time dateTime={article.publishedAt}>
                          {article.displayDate}
                        </time>
                      </span>
                      <strong>{article.title}</strong>
                      <span className={styles.storyDek}>
                        {article.subtitle}
                      </span>
                    </span>
                    <span className={styles.storyArrow} aria-hidden>
                      ↗
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.sectionLabel}>No published reports yet</p>
              <h3>This desk stays empty until the evidence clears review.</h3>
              <p>
                We do not fill an archive with placeholders, recycled listings
                or unpublished research. Use the full news feed while this desk
                is being assembled.
              </p>
              <Link href="/news">Open all verified news</Link>
            </div>
          )}
        </div>
      </section>

      {(areas.length > 0 || developers.length > 0) && (
        <section className={styles.context} aria-labelledby="context-heading">
          <div className={styles.shell}>
            <p className={styles.sectionLabel}>Continue the research</p>
            <h2 id="context-heading">Related market context</h2>
            <div className={styles.contextGrid}>
              {areas.map((area) => (
                <Link key={area.slug} href={`/areas/${area.slug}`}>
                  <span>{area.emirate} · {area.kind.replaceAll("-", " ")}</span>
                  <strong>{area.name}</strong>
                  <span>Open area guide ↗</span>
                </Link>
              ))}
              {developers.map((developer) => (
                <Link
                  key={developer.slug}
                  href={`/developer/${developer.slug}`}
                >
                  <span>{developer.hq} · developer profile</span>
                  <strong>{developer.name}</strong>
                  <span>Open company guide ↗</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={styles.actions}>
        <div className={`${styles.shell} ${styles.actionsGrid}`}>
          <div>
            <p className={styles.sectionLabel}>Keep this desk close</p>
            <h2>Read, share or take the decision to Raj.</h2>
          </div>
          <div className={styles.actionLinks}>
            <Link href="/rss.xml">RSS feed</Link>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical)}`}
              target="_blank"
              rel="noreferrer"
            >
              Share on LinkedIn
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(vertical.name)}&body=${encodeURIComponent(canonical)}`}
            >
              Share by email
            </a>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`${styles.shell} ${styles.ctaGrid}`}>
          <div>
            <p className={styles.sectionLabel}>A property decision in view?</p>
            <h2>Bring Raj the facts, the alternatives and the downside.</h2>
            <p>
              The call is for buyers and investors who want to pressure-test a
              UAE property decision with a human advisor.
            </p>
          </div>
          <div className={styles.ctaLinks}>
            <a
              className={styles.primaryCta}
              href={rootCtaUrl({
                campaign: `vertical-${vertical.slug}`,
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
  name,
  description,
  canonical,
  articles,
}: {
  name: string;
  description: string;
  canonical: string;
  articles: ReturnType<typeof getVerticalArticles>;
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
        name,
        item: canonical,
      },
    ],
  };

  if (articles.length === 0) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name,
          description,
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
        name,
        description,
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
        mainEntity: { "@id": `${canonical}#reports` },
      },
      {
        "@type": "ItemList",
        "@id": `${canonical}#reports`,
        numberOfItems: articles.length,
        itemListElement: articles.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: article.title,
          url: `${SITE.url}/news/${article.slug}`,
        })),
      },
      breadcrumb,
    ],
  };
}
