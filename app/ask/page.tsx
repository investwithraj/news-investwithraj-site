import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT, rootCtaUrl, SITE } from "@/lib/constants";
import { AskRajClient } from "./AskRajClient";
import styles from "./ask.module.css";

export const dynamic = "force-static";

const canonical = `${SITE.url}/ask`;

export const metadata: Metadata = {
  title: "Ask the automated UAE property desk",
  description:
    "Generate a source-bounded UAE property brief from published Invest With Raj reporting, then take the decision to Raj for human review.",
  alternates: { canonical },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Ask the automated desk — Invest With Raj",
    description:
      "Generated analysis with the source boundary, AI disclosure and human advisory route visible.",
    type: "website",
    url: canonical,
  },
};

export default function AskPage() {
  return (
    <main className={styles.page}>
      <JsonLd />

      <section className={styles.hero}>
        <div className={styles.frame}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Ask the desk</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>Automated first desk</p>
              <h1>Ask a property question. See the evidence boundary.</h1>
            </div>
            <div className={styles.heroCopy}>
              <p>
                This tool uses AI to draft a 400–600 word analysis from a
                limited packet of published Invest With Raj reporting. It is
                not Raj, and it does not replace a current human review.
              </p>
              <dl>
                <div>
                  <dt>Public limit</dt>
                  <dd>Five requests per hour, per IP</dd>
                </div>
                <div>
                  <dt>Evidence rule</dt>
                  <dd>Only the sources returned beside the brief</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.tool} aria-labelledby="ask-tool-heading">
        <div className={styles.frame}>
          <div className={styles.toolIntro}>
            <p className={styles.kicker}>01 · Ask</p>
            <h2 id="ask-tool-heading">Give the desk a precise topic.</h2>
            <p>
              Include the place, property type, timing and decision you are
              weighing. Do not submit private, financial or identity documents.
            </p>
          </div>
          <AskRajClient />
        </div>
      </section>

      <section className={styles.boundary} aria-labelledby="source-boundary">
        <div className={`${styles.frame} ${styles.boundaryGrid}`}>
          <div>
            <p className={styles.kicker}>04 · Context boundary</p>
            <h2 id="source-boundary">What the automated desk can—and cannot—do.</h2>
          </div>
          <div className={styles.boundaryList}>
            <article>
              <span>01</span>
              <div>
                <h3>Ground a first read</h3>
                <p>
                  It receives selected article summaries and their recorded
                  citations. The returned source list is assembled by the
                  server, not invented by the model.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Show when evidence is insufficient</h3>
                <p>
                  If the source packet cannot support a brief, the tool should
                  stop instead of filling the gap with an uncited claim.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Not perform due diligence</h3>
                <p>
                  Availability, price, title, contract, finance, tax and legal
                  position still require current primary documents and
                  qualified advisers.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.human} aria-labelledby="human-review">
        <div className={`${styles.frame} ${styles.humanGrid}`}>
          <div>
            <p className={styles.kicker}>06 · Human advisory</p>
            <h2 id="human-review">Take the brief to Raj.</h2>
            <p>
              Bring the generated read, the actual property and the decision
              you need to make. Raj can challenge the assumptions against
              current documents and your mandate.
            </p>
          </div>
          <div className={styles.humanLinks}>
            <a
              className={styles.primary}
              href={rootCtaUrl({
                campaign: "ask-automated-desk",
                content: "human-advisory",
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
        name: "Ask the automated UAE property desk",
        description:
          "A source-bounded AI writing tool for first-pass UAE property analysis.",
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
            name: "Ask the automated desk",
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
