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
  isIndexEligibleArticleSlug,
  isPublicNoindexPath,
} from "@/lib/news-lifecycle";
import { getVerifiedDeveloperMedia } from "@/lib/verified-media";

import styles from "../../developers/DeveloperPages.module.css";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllPublicDeveloperSlugs()
    .filter((slug) => isPublicNoindexPath(`/developer/${slug}`))
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const record = getPublicDeveloperRecord(slug);
  if (!record || !isPublicNoindexPath(`/developer/${slug}`)) {
    return {
      title: "Developer not found",
      robots: { index: false, follow: false },
    };
  }
  const { developer } = record;
  const reports = record.reports.filter((article) =>
    isIndexEligibleArticleSlug(article.slug),
  );
  const media = getVerifiedDeveloperMedia(slug);

  return {
    title: `${developer.name} — developer reporting index`,
    description: `${reports.length} source-linked reports that explicitly mention ${developer.name}, with the latest UAE property developments and direct source access.`,
    alternates: { canonical: `${SITE.url}/developer/${slug}` },
    robots: { index: false, follow: true },
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
  if (!record || !isPublicNoindexPath(`/developer/${slug}`)) notFound();
  const { developer } = record;
  const relatedNews = record.reports.filter((article) =>
    isIndexEligibleArticleSlug(article.slug),
  );
  const media = getVerifiedDeveloperMedia(developer.slug);

  const connectedAreas = PUBLIC_AREAS.filter((area) =>
    developer.activeAreas.includes(area.slug),
  );
  const advisoryLink = advisoryLinkForDeveloper(
    developer.slug,
    developer.name,
  );
  return (
    <>
      <main id="main" className={styles.page}>
        <header className={styles.detailHero}>
          <Link
            href="https://investwithraj.com/developers"
            className={styles.back}
          >
            ← Advisory developer directory
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
              <small>
                {relatedNews[0]
                  ? `Latest ${relatedNews[0].displayDate}`
                  : "No current report"}
              </small>
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
              {relatedNews[0]
                ? formatEditorialDate(relatedNews[0].publishedAt)
                : "No current report"}
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
              <Link href={`/news?area=${area.slug}`} key={area.slug}>
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
