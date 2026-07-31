import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AREAS } from "@/content/areas";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";
import {
  advisoryLinkForDeveloper,
  generalAdvisoryUrl,
} from "@/lib/advisory-relations";
import { SITE } from "@/lib/constants";
import {
  getAllDeveloperSlugs,
  getDeveloperBySlug,
} from "@/lib/developers";
import {
  articleMentionsDeveloper,
  categoryLabel,
  displayMarkets,
  formatEditorialDate,
} from "@/lib/news-editorial";
import {
  asGraph,
  breadcrumbSchema,
  collectionPageSchemas,
} from "@/lib/schema";
import { getVerifiedDeveloperMedia } from "@/lib/verified-media";

import styles from "../../developers/DeveloperPages.module.css";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllDeveloperSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const developer = getDeveloperBySlug(slug);
  if (!developer) return { title: "Developer not found" };
  const media = getVerifiedDeveloperMedia(slug);

  const relatedNews = NEWS_ARTICLES.filter(
    (article) =>
      article.status !== "research" &&
      articleMentionsDeveloper(article, developer),
  );
  const hasReporting = relatedNews.length > 0;
  return {
    title: `${developer.name} — developer reporting index`,
    description: `Source-linked reports that explicitly mention ${developer.name}. Profile facts remain under source review.`,
    alternates: { canonical: `${SITE.url}/developer/${slug}` },
    robots: { index: hasReporting, follow: true },
    openGraph: {
      type: "website",
      title: `${developer.name} reporting index`,
      description: `Explicit source-linked reporting for ${developer.name}.`,
      url: `${SITE.url}/developer/${slug}`,
      ...(media
        ? {
            images: [
              {
                url: `${SITE.url}${media.src}`,
                width: media.width,
                height: media.height,
                alt: media.alt,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function DeveloperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const developer = getDeveloperBySlug(slug);
  if (!developer) notFound();
  const media = getVerifiedDeveloperMedia(developer.slug);

  const relatedNews = sortNewsArticles(NEWS_ARTICLES)
    .filter((article) => article.status !== "research")
    .filter((article) => articleMentionsDeveloper(article, developer))
    .slice(0, 10);
  const connectedAreas = AREAS.filter((area) =>
    developer.activeAreas.includes(area.slug),
  );
  const advisoryLink = advisoryLinkForDeveloper(
    developer.slug,
    developer.name,
  );
  const pageUrl = `${SITE.url}/developer/${developer.slug}`;
  const [collection, itemList] = collectionPageSchemas({
    url: pageUrl,
    name: `${developer.name} reporting index`,
    description: `Source-linked reports that explicitly mention ${developer.name}.`,
    dateModified: relatedNews[0]?.modifiedAt,
    itemListOrder: "descending",
    items: relatedNews.map((article) => ({
      name: article.title,
      url: `${SITE.url}/news/${article.slug}`,
      description: article.subtitle,
    })),
  });
  const graph = asGraph(
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${pageUrl}#entity`,
      name: developer.name,
      url: pageUrl,
    },
    collection,
    itemList,
    breadcrumbSchema([
      { name: "Developers", url: `${SITE.url}/developers` },
      { name: developer.name, url: pageUrl },
    ]),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
        }}
      />
      <main id="main" className={styles.page}>
        <header className={styles.detailHero}>
          <Link href="/developers" className={styles.back}>
            ← Developer reporting index
          </Link>
          <div className={styles.detailHead}>
            <div>
              <p className={styles.eyebrow}>
                {developer.hq} · entity-led reporting
              </p>
              <h1>{developer.name}</h1>
              <p className={styles.dek}>
                This page is a reporting index, not a corporate profile or
                inventory sheet. Ownership, listing, delivery and current
                release claims remain unpublished until a dedicated source
                pack exists.
              </p>
            </div>
            <div className={styles.profileMark}>
              <span>Evidence state</span>
              <strong>
                {relatedNews.length
                  ? `${relatedNews.length} explicit reports`
                  : "No matched reports"}
              </strong>
              <small>Profile-source review pending</small>
            </div>
          </div>
        </header>

        {media ? (
          <figure className={styles.detailFigure}>
            <Image
              src={media.src}
              width={media.width}
              height={media.height}
              alt={media.alt}
              sizes="100vw"
              quality={95}
              priority
            />
            <figcaption className={styles.detailCredit}>
              <span>{media.notice}</span>
              <span>
                <a
                  href={media.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {media.sourceLabel}
                </a>
                {" · "}
                {media.licenseLabel}
              </span>
            </figcaption>
          </figure>
        ) : null}

        <section
          className={styles.reviewStrip}
          aria-label="Developer evidence status"
        >
          <div>
            <span>Entity match</span>
            <strong>Full identity or approved alias</strong>
          </div>
          <div>
            <span>Latest reporting</span>
            <strong>
              {relatedNews[0]
                ? formatEditorialDate(relatedNews[0].publishedAt)
                : "No explicit mention"}
            </strong>
          </div>
          <div>
            <span>Search status</span>
            <p>
              {relatedNews.length
                ? "Indexable source-linked collection"
                : "Noindex until explicit reporting exists"}
            </p>
          </div>
        </section>

        <section className={styles.coverage}>
          <header className={styles.sectionHeader}>
            <h2>Explicit developer mentions.</h2>
            <p>{relatedNews.length} live reports</p>
          </header>
          {relatedNews.length ? (
            <div className={styles.reportList}>
              {relatedNews.map((article) => (
                <Link href={`/news/${article.slug}`} key={article.slug}>
                  <span>
                    {displayMarkets(article).join(" / ")} ·{" "}
                    {categoryLabel(article.category)} · {article.displayDate}
                  </span>
                  <strong>{article.title}</strong>
                  <i aria-hidden="true">↗</i>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              No live report explicitly names this developer. Generic mentions
              of {developer.hq} are not counted.
            </p>
          )}
        </section>

        <section className={styles.connections}>
          <header className={styles.sectionHeader}>
            <h2>Connected area records.</h2>
            <p>Internal coverage map · not current inventory</p>
          </header>
          {connectedAreas.length ? (
            <div className={styles.connectionList}>
              {connectedAreas.map((area) => (
                <Link href={`/areas/${area.slug}`} key={area.slug}>
                  <span>
                    {area.emirate} · {area.kind.replaceAll("-", " ")}
                  </span>
                  <strong>{area.name}</strong>
                  <i aria-hidden="true">↗</i>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              No area record is connected to this entity in the publication
              registry.
            </p>
          )}
        </section>

        <section className={styles.independence}>
          <span>Commercial independence</span>
          <h2>Coverage is not endorsement.</h2>
          <p>
            Coverage is selected for market relevance. A commercial
            relationship does not change the source standard or remove a
            material watchpoint. Sponsored material, if introduced, is
            labelled and kept distinct.{" "}
            <Link href="/about/editorial-standards">
              Read the full editorial standard.
            </Link>
          </p>
        </section>

        <section className={styles.advisory}>
          <header className={styles.sectionHeader}>
            <h2>Put the entity against the decision.</h2>
            <p>Invest With Raj · advisory site</p>
          </header>
          {advisoryLink ? (
            <div className={styles.advisoryLinks}>
              <a href={advisoryLink.href}>
                <span>{advisoryLink.eyebrow}</span>
                <strong>{advisoryLink.label}</strong>
                <i aria-hidden="true">↗</i>
              </a>
            </div>
          ) : null}
          <div className={styles.cta}>
            <p>
              If {developer.name} is part of a live shortlist, bring the
              project, payment schedule, holding period and exit constraint.
              Raj can test the exposure without turning this reporting index
              into an endorsement.
            </p>
            <a href={generalAdvisoryUrl("developer", developer.slug)}>
              Discuss this developer ↗
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
