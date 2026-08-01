import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT, rootCtaUrl, SITE } from "@/lib/constants";
import { PUBLIC_AREAS, PUBLIC_AREA_RECORDS } from "@/lib/public-content";
import OrientationAtlas, { type AtlasArea } from "./OrientationAtlas";
import styles from "./map.module.css";

export const dynamic = "force-static";

const canonical = `${SITE.url}/map`;

export const metadata: Metadata = {
  title: "UAE property area atlas — Dubai, Abu Dhabi and Ras Al Khaimah",
  description:
    "An accessible geographic index of published Invest With Raj area guides, using the names, emirates, area types and coordinates in the editorial registry.",
  alternates: { canonical },
  robots: { index: true, follow: true },
  openGraph: {
    title: "UAE property area atlas — Invest With Raj",
    description:
      "Explore published area guides by emirate, area type and geographic position.",
    type: "website",
    url: canonical,
  },
};

export default function MapPage() {
  const areas: AtlasArea[] = PUBLIC_AREAS.map((area) => ({
    slug: area.slug,
    name: area.name,
    emirate: area.emirate,
    kind: area.kind,
    lat: area.coords.lat,
    lng: area.coords.lng,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const newestReview = PUBLIC_AREA_RECORDS.flatMap(({ reports }) =>
    reports.map((article) => article.modifiedAt),
  )
    .sort((a, b) => b.localeCompare(a))[0];
  const reviewLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(newestReview));

  return (
    <main className={styles.page}>
      <JsonLd data={buildSchema(areas)} />

      <section className={styles.hero}>
        <div className={styles.shell}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Area atlas</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>UAE area index</p>
              <h1>A geographic index, not a heatmap.</h1>
            </div>
            <p className={styles.standfirst}>
              Explore the places covered by Invest With Raj using only the
              area name, emirate, type and coordinates connected to published
              reporting.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.atlasSection} aria-labelledby="atlas-heading">
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Orientation atlas</p>
              <h2 id="atlas-heading">Choose a place. Open its area guide.</h2>
            </div>
          <p>{areas.length} covered areas across three emirates.</p>
          </div>
          <OrientationAtlas areas={areas} />
          <p className={styles.disclaimer}>
            Orientation only. This graphic is not a cadastral map, boundary
            survey, navigation tool or statement of distance. Points are
            editorial centroids and the projection is not to scale.
          </p>
        </div>
      </section>

      <section className={styles.method} aria-labelledby="map-method">
        <div className={`${styles.shell} ${styles.methodGrid}`}>
          <div>
            <p className={styles.kicker}>What the atlas contains</p>
            <h2 id="map-method">No mood score. No invented market layer.</h2>
          </div>
          <div>
            <p>
              The public atlas includes only places with published reporting.
              It does not display transaction volume, price, sentiment,
              “chatter” or real-time status.
            </p>
            <dl>
              <div>
                <dt>Fields shown</dt>
                <dd>Name, emirate, area type and coordinates</dd>
              </div>
              <div>
                <dt>Newest reporting update</dt>
                <dd>{reviewLabel}</dd>
              </div>
              <div>
                <dt>Full context</dt>
                <dd>Available on each linked area guide</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`${styles.shell} ${styles.ctaGrid}`}>
          <div>
            <p className={styles.kicker}>Comparing areas?</p>
            <h2>Ask Raj to pressure-test the shortlist.</h2>
            <p>
              Bring the areas, property type, budget and intended outcome. Raj
              will help you compare the decision with its trade-offs visible.
            </p>
          </div>
          <div className={styles.ctaLinks}>
            <a
              className={styles.primary}
              href={rootCtaUrl({
                campaign: "area-atlas",
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

function buildSchema(areas: AtlasArea[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#collection`,
        url: canonical,
        name: "UAE property area atlas",
        description:
          "A geographic index of published Invest With Raj area guides.",
        mainEntity: { "@id": `${canonical}#areas` },
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
      },
      {
        "@type": "ItemList",
        "@id": `${canonical}#areas`,
        numberOfItems: areas.length,
        itemListElement: areas.map((area, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: area.name,
          url: `${SITE.url}/areas/${area.slug}`,
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
            name: "Area atlas",
            item: canonical,
          },
        ],
      },
    ],
  };
}
