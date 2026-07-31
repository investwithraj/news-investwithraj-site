import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT, rootCtaUrl, SITE } from "@/lib/constants";
import styles from "./pulse.module.css";

export const dynamic = "force-static";

const canonical = `${SITE.url}/pulse`;

export const metadata: Metadata = {
  title: "Pulse methodology — evidence before signal",
  description:
    "The production method and publication safeguards for a future UAE property evidence register. No public sentiment scores are currently published.",
  alternates: { canonical },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Pulse methodology — Invest With Raj",
    description:
      "How a future UAE property evidence register will be sourced, reviewed and corrected.",
    type: "website",
    url: canonical,
  },
};

const pipeline = [
  {
    number: "01",
    title: "Register the source",
    body: "Every eligible input needs a named publisher or accountable primary source, a durable URL and a capture time. Anonymous chatter is not a publishable fact.",
  },
  {
    number: "02",
    title: "Preserve the evidence",
    body: "The underlying statement, date and geographic subject must remain traceable. A score without the supporting evidence does not leave production.",
  },
  {
    number: "03",
    title: "Classify with review",
    body: "Machine-assisted classification may support triage, but a human editor must review ambiguous claims, sarcasm, duplicates and entity matches.",
  },
  {
    number: "04",
    title: "Show the method",
    body: "Any future public signal must state its source coverage, observation window, sample size, known blind spots and the time it was last reviewed.",
  },
  {
    number: "05",
    title: "Correct in public",
    body: "Material corrections need a visible change note. Historical outputs should not silently shift after a method or source set changes.",
  },
] as const;

export default function PulsePage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: "Pulse methodology",
        description:
          "Production methodology and publication safeguards for a future UAE property evidence register.",
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
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
            name: "Pulse methodology",
            item: canonical,
          },
        ],
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />

      <section className={styles.hero}>
        <div className={styles.shell}>
          <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Pulse</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>Pulse · production note</p>
              <h1>Evidence before signal.</h1>
            </div>
            <div className={styles.status}>
              <span>Current public state</span>
              <strong>No signal scores published</strong>
              <p>
                This page documents the intended safeguards while the method is
                being tested.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.position}>
        <div className={`${styles.shell} ${styles.positionGrid}`}>
          <p className={styles.lead}>
            Pulse is being built as an evidence register, not a mood gauge.
          </p>
          <div>
            <p>
              The previous concept implied live social scraping and precise
              sentiment scores without a publishable evidence trail. Those
              claims have been removed.
            </p>
            <p>
              A public release should happen only when readers can understand
              where a signal came from, what it covers and where it can fail.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.pipeline} aria-labelledby="pipeline-heading">
        <div className={styles.shell}>
          <p className={styles.kicker}>Publication pipeline</p>
          <h2 id="pipeline-heading">Five gates before a public output.</h2>
          <ol>
            {pipeline.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.guardrails}>
        <div className={`${styles.shell} ${styles.guardrailGrid}`}>
          <div>
            <p className={styles.kicker}>Non-negotiable safeguards</p>
            <h2>What Pulse must not become.</h2>
          </div>
          <ul>
            <li>No invented volumes, confidence scores or source counts.</li>
            <li>No anonymous post presented as a market fact.</li>
            <li>No “live” label without a real freshness contract.</li>
            <li>No automated investment recommendation.</li>
            <li>No silent replacement of a published method.</li>
          </ul>
        </div>
      </section>

      <section className={styles.available} aria-labelledby="available-heading">
        <div className={styles.shell}>
          <p className={styles.kicker}>Available now</p>
          <h2 id="available-heading">Use the published evidence while Pulse is tested.</h2>
          <div className={styles.linkGrid}>
            <Link href="/news">
              <span>01</span>
              <strong>Verified news</strong>
              <p>Cited reporting and visible sources.</p>
            </Link>
            <Link href="/areas">
              <span>02</span>
              <strong>Area guides</strong>
              <p>Geographic context from the published registry.</p>
            </Link>
            <Link href="/developers">
              <span>03</span>
              <strong>Developer index</strong>
              <p>Company profiles connected to covered markets.</p>
            </Link>
            <Link href="/rss.xml">
              <span>04</span>
              <strong>RSS feed</strong>
              <p>Follow new published reports without an algorithmic score.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`${styles.shell} ${styles.ctaGrid}`}>
          <div>
            <p className={styles.kicker}>A decision cannot wait?</p>
            <h2>Take the evidence to Raj.</h2>
            <p>
              Raj can help buyers and investors pressure-test a specific UAE
              property decision while the public signal product remains in
              production.
            </p>
          </div>
          <div className={styles.ctaLinks}>
            <a
              className={styles.primary}
              href={rootCtaUrl({
                campaign: "pulse-methodology",
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
