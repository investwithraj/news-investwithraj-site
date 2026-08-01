import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  advisoryLinkForDeveloper,
  generalAdvisoryUrl,
} from "@/lib/advisory-relations";
import { SITE } from "@/lib/constants";
import {
  categoryLabel,
  displayMarkets,
  formatEditorialDate,
} from "@/lib/news-editorial";
import {
  getAllPublicDeveloperSlugs,
  getPublicDeveloperRecord,
  PUBLIC_AREAS,
} from "@/lib/public-content";
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
  return getAllPublicDeveloperSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const record = getPublicDeveloperRecord(slug);
  if (!record) return { title: "Developer not found" };
  const { developer, reports } = record;
  const media = getVerifiedDeveloperMedia(slug);

  return {
    title: `${developer.name} — developer reporting index`,
    description: `${reports.length} source-linked reports that explicitly mention ${developer.name}, with the latest UAE property developments and direct source access.`,
    alternates: { canonical: `${SITE.url}/developer/${slug}` },
    robots: { index: true, follow: true },
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
  const record = getPublicDeveloperRecord(slug);
  if (!record) notFound();
  const { developer, reports: relatedNews } = record;
  const media = getVerifiedDeveloperMedia(developer.slug);

  const connectedAreas = PUBLIC_AREAS.filter((area) =>
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
                Follow the source-linked reporting that explicitly names {developer.name}.
                Use the collection to track material launches, delivery events,
                corporate moves and the markets they affect.
              </p>
            </div>
            <div className={styles.profileMark}>
              <span>Published coverage</span>
              <strong>{relatedNews.length} explicit reports</strong>
              <small>Latest {relatedNews[0].displayDate}</small>
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
          aria-label="Developer reporting summary"
        >
          <div>
            <span>Published coverage</span>
            <strong>{relatedNews.length} reports</strong>
          </div>
          <div>
            <span>Latest reporting</span>
            <strong>
              {formatEditorialDate(relatedNews[0].publishedAt)}
            </strong>
          </div>
          <div>
            <span>Match method</span>
            <p>Full identity or an approved, unambiguous alias</p>
          </div>
        </section>

        <section className={styles.coverage}>
          <header className={styles.sectionHeader}>
            <h2>Explicit developer mentions.</h2>
            <p>{relatedNews.length} live reports</p>
          </header>
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
        </section>

        {connectedAreas.length ? <section className={styles.connections}>
          <header className={styles.sectionHeader}>
            <h2>Areas connected to this coverage.</h2>
            <p>Continue through the reporting network</p>
          </header>
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
        </section> : null}

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
