import type { Metadata } from "next";
import Link from "next/link";
import { NEWS_ARTICLES } from "@/content/news";
import {
  getVerticalArticles,
  VERTICALS,
} from "@/lib/verticals";
import { rootCtaUrl, SITE } from "@/lib/constants";
import styles from "./spatial.module.css";

export const dynamic = "force-static";

const canonical = `${SITE.url}/spatial`;

export const metadata: Metadata = {
  title: "Spatial edition — UAE property intelligence",
  description:
    "A progressive spatial-browser edition of Invest With Raj Intelligence with the complete five-desk directory and flat-web fallback.",
  alternates: { canonical },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Spatial edition — Invest With Raj Intelligence",
    description:
      "A complete, accessible publication directory that does not require 3D or a spatial device.",
    type: "website",
    url: canonical,
  },
  other: {
    "apple-spatial-content": "true",
  },
};

export default function SpatialPage() {
  const desks = VERTICALS.map((vertical) => ({
    ...vertical,
    articleCount: getVerticalArticles(vertical, NEWS_ARTICLES).length,
  }));

  return (
    <main className={styles.page}>
      <JsonLd />

      <section className={styles.hero}>
        <div className={styles.frame}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Spatial edition</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>Progressive spatial edition</p>
              <h1>A roomier way to navigate the intelligence desk.</h1>
            </div>
            <div className={styles.heroCopy}>
              <p>
                Built to sit comfortably in wide or spatial browser windows,
                while remaining complete HTML on every ordinary phone,
                tablet and desktop.
              </p>
              <span>
                No WebXR, 3D scene, headset or gesture support is required.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.desks} aria-labelledby="spatial-desks">
        <div className={styles.frame}>
          <header className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>02 · Five editorial desks</p>
              <h2 id="spatial-desks">Choose the reporting lens.</h2>
            </div>
            <p>
              Each door opens the same published vertical available on the
              standard site.
            </p>
          </header>
          <div className={styles.deskGrid}>
            {desks.map((desk, index) => (
              <Link
                key={desk.slug}
                href={`/v/${desk.slug}`}
                className={styles.deskCard}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>{desk.cadence}</p>
                  <h3>{desk.name}</h3>
                  <strong>{desk.tagline}</strong>
                </div>
                <footer>
                  <small>
                    {desk.articleCount} published{" "}
                    {desk.articleCount === 1 ? "report" : "reports"}
                  </small>
                  <i aria-hidden>↗</i>
                </footer>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.mapEntry} aria-labelledby="spatial-map">
        <div className={`${styles.frame} ${styles.mapGrid}`}>
          <div>
            <p className={styles.kicker}>03 · Area-map entry</p>
            <h2 id="spatial-map">Move from theme to place.</h2>
          </div>
          <div>
            <p>
              The area atlas plots editorial centroids for the published area
              guides. It is a geographic index—not a boundary map, price layer
              or simulated market heatmap.
            </p>
            <Link href="/map">
              Open the area atlas
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.fallback} aria-labelledby="flat-web">
        <div className={`${styles.frame} ${styles.fallbackGrid}`}>
          <div>
            <p className={styles.kicker}>04 · Flat-web fallback</p>
            <h2 id="flat-web">Nothing important lives behind an effect.</h2>
          </div>
          <div className={styles.fallbackList}>
            <article>
              <span>Content</span>
              <p>
                Headlines, descriptions, counts and links remain readable
                without JavaScript animation, depth or device detection.
              </p>
            </article>
            <article>
              <span>Navigation</span>
              <p>
                Every card is an ordinary link with keyboard focus and a
                complete destination on the main publication.
              </p>
            </article>
            <article>
              <span>Motion</span>
              <p>
                No information depends on movement, and the page respects the
                browser’s reduced-motion preference.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.return} aria-labelledby="return-to-desk">
        <div className={`${styles.frame} ${styles.returnGrid}`}>
          <div>
            <p className={styles.kicker}>05 · Continue</p>
            <h2 id="return-to-desk">Return to the main publication.</h2>
            <p>
              Open the latest reporting, or take a property decision to Raj
              for a human working call.
            </p>
          </div>
          <div className={styles.returnLinks}>
            <Link href="/">
              Open Daily Market Read
              <span aria-hidden>→</span>
            </Link>
            <a
              href={rootCtaUrl({
                campaign: "spatial-edition",
                content: "book-raj",
              })}
            >
              Book a call with Raj
              <span aria-hidden>↗</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#collection`,
        url: canonical,
        name: "Invest With Raj Intelligence spatial edition",
        description:
          "A progressive spatial-browser directory for five UAE property reporting verticals.",
        isPartOf: { "@id": `${SITE.url}#website` },
        publisher: { "@id": `${SITE.url}#newsmediaorg` },
      },
      {
        "@type": "ItemList",
        "@id": `${canonical}#desks`,
        numberOfItems: VERTICALS.length,
        itemListElement: VERTICALS.map((vertical, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: vertical.name,
          url: `${SITE.url}/v/${vertical.slug}`,
        })),
      },
      {
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
            name: "Spatial edition",
            item: canonical,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
