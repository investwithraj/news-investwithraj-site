import type { Metadata } from "next";
import Link from "next/link";
import { getLatestNews } from "@/content/news";
import { CONTACT, rootCtaUrl, SITE } from "@/lib/constants";
import styles from "./wallet.module.css";

export const dynamic = "force-static";

const canonical = `${SITE.url}/wallet`;

export const metadata: Metadata = {
  title: "Market Wallet concept — coming soon",
  description:
    "A transparent concept preview for a future signed Apple Wallet and Google Wallet edition of Invest With Raj Intelligence. Delivery is not live.",
  alternates: { canonical },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Market Wallet concept — Invest With Raj",
    description:
      "Unsigned concept preview. Apple Wallet and Google Wallet delivery are not live.",
    type: "website",
    url: canonical,
  },
};

export default function WalletPage() {
  const latest = getLatestNews(1)[0];

  return (
    <main className={styles.page}>
      <JsonLd />

      <section className={styles.hero}>
        <div className={styles.frame}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Market Wallet</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>Concept preview · not live</p>
              <h1>The morning read, designed for a lock screen.</h1>
            </div>
            <div className={styles.heroCopy}>
              <p>
                The product direction is a concise wallet pass linking to the
                latest reviewed report. Signed-pass generation, delivery and
                updates are not implemented.
              </p>
              <strong>
                There is currently nothing to install and this page does not
                enrol you in notifications.
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.previewSection} aria-labelledby="wallet-preview">
        <div className={`${styles.frame} ${styles.previewGrid}`}>
          <div>
            <p className={styles.kicker}>02 · Current preview</p>
            <h2 id="wallet-preview">An illustrative pass—not a signed pass.</h2>
            <p>
              This static composition shows the proposed hierarchy. It does
              not simulate a barcode, installation state, refresh or lock-screen
              notification.
            </p>
          </div>
          <article className={styles.pass} aria-label="Illustrative wallet pass">
            <header>
              <span>Invest With Raj</span>
              <b>Concept</b>
            </header>
            <div className={styles.passBody}>
              <p>Latest reviewed report</p>
              <h3>
                {latest?.title ??
                  "A reviewed UAE property report will appear here."}
              </h3>
              <dl>
                <div>
                  <dt>Edition</dt>
                  <dd>Daily Market Read</dd>
                </div>
                <div>
                  <dt>Byline</dt>
                  <dd>Raj Tomar</dd>
                </div>
              </dl>
            </div>
            <footer>
              <span>Illustration only</span>
              <span>No pass payload</span>
            </footer>
          </article>
        </div>
      </section>

      <section className={styles.doors} aria-labelledby="wallet-doors">
        <div className={styles.frame}>
          <header className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>03–04 · Platform doors</p>
              <h2 id="wallet-doors">Both editions are coming soon.</h2>
            </div>
            <p>
              These controls are intentionally inactive. They will become
              install links only after signed delivery and update handling pass
              production verification.
            </p>
          </header>
          <div className={styles.doorGrid}>
            <article>
              <span>Apple</span>
              <h3>Apple Wallet edition</h3>
              <p>
                Requires a signed PassKit package, update service, device
                registration handling and production privacy review.
              </p>
              <button type="button" disabled aria-disabled="true">
                Coming soon
              </button>
            </article>
            <article>
              <span>Google</span>
              <h3>Google Wallet edition</h3>
              <p>
                Requires an approved Wallet issuer, signed object flow, update
                handling and production privacy review.
              </p>
              <button type="button" disabled aria-disabled="true">
                Coming soon
              </button>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.privacy} aria-labelledby="wallet-privacy">
        <div className={`${styles.frame} ${styles.privacyGrid}`}>
          <div>
            <p className={styles.kicker}>05 · Privacy and frequency</p>
            <h2 id="wallet-privacy">Consent before delivery.</h2>
          </div>
          <div>
            <p>
              This preview collects no wallet identifier, device token or
              notification permission. A live release must disclose the exact
              cadence, data processed, update provider, retention and removal
              path before installation.
            </p>
            <p>
              Planned frequency is a concise morning edition when a reviewed
              report is available—not an unbounded notification stream.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.next} aria-labelledby="wallet-next">
        <div className={`${styles.frame} ${styles.nextGrid}`}>
          <div>
            <p className={styles.kicker}>Use what is live now</p>
            <h2 id="wallet-next">Read the desk, or take a decision to Raj.</h2>
          </div>
          <div className={styles.nextLinks}>
            <Link href="/">
              Open Daily Market Read
              <span aria-hidden>→</span>
            </Link>
            <a
              href={rootCtaUrl({
                campaign: "market-wallet-concept",
                content: "book-raj",
              })}
            >
              Book a call with Raj
              <span aria-hidden>↗</span>
            </a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
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
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: "Market Wallet concept",
        description:
          "A concept preview for a future signed wallet edition. Delivery is not live.",
        isPartOf: { "@id": `${SITE.url}#website` },
        publisher: { "@id": `${SITE.url}#newsmediaorg` },
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
            name: "Market Wallet concept",
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
