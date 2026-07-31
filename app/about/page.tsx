import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SITE } from "@/lib/constants";
import {
  asGraph,
  breadcrumbSchema,
  newsOrgSchema,
  rajPersonSchema,
  RAJ_PERSON_ID,
} from "@/lib/schema";

import styles from "./AboutPages.module.css";

const PAGE_URL = `${SITE.url}/about`;
const ADVISORY_URL =
  `${SITE.rootUrl}/engage?utm_source=news.investwithraj.com` +
  "&utm_medium=about&utm_campaign=editorial_to_advisory";
const DESCRIPTION =
  "Why Invest With Raj Intelligence exists, who Raj is, and where source-led UAE property reporting ends and personal advisory begins.";

export const metadata: Metadata = {
  title: "About the publication and Raj Tomar",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "profile",
    url: PAGE_URL,
    title: "About | Invest With Raj Intelligence",
    description: DESCRIPTION,
  },
};

const graph = asGraph(
  {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${PAGE_URL}#profile`,
    url: PAGE_URL,
    name: "About Invest With Raj Intelligence and Raj Tomar",
    description: DESCRIPTION,
    inLanguage: "en-AE",
    dateModified: "2026-07-31",
    isPartOf: { "@id": `${SITE.url}#website` },
    mainEntity: { "@id": RAJ_PERSON_ID },
    about: { "@id": `${SITE.url}#newsmediaorg` },
  },
  rajPersonSchema,
  newsOrgSchema,
  breadcrumbSchema([{ name: "About", url: PAGE_URL }]),
);

const publicationWork = [
  {
    number: "01",
    title: "Report what changed",
    copy:
      "Launches, transactions, regulation, corporate moves and place-level developments are recorded against identifiable sources.",
  },
  {
    number: "02",
    title: "Explain the consequence",
    copy:
      "Interpretation is separated from the reported fact so buyers and investors can see where evidence ends and judgement begins.",
  },
  {
    number: "03",
    title: "Open the next question",
    copy:
      "Each useful report should leave the reader with a clearer verification list—not a manufactured promise or a forced sales conclusion.",
  },
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
        }}
      />

      <main id="main" className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroRegister}>
            <span>About the publication</span>
            <span>Dubai · UAE property intelligence</span>
          </div>
          <h1>
            Make the property
            <br />
            decision more legible.
          </h1>
          <p className={styles.heroCopy}>
            Invest With Raj Intelligence exists to help buyers and investors
            understand the evidence around a UAE property decision before they
            enter a sales conversation.
          </p>
        </header>

        <section className={styles.mission} aria-labelledby="mission-title">
          <div className={styles.sectionLabel}>
            <span>01</span>
            <p>Mission</p>
          </div>
          <div className={styles.statement}>
            <h2 id="mission-title">
              A public record for the decision before the deal.
            </h2>
            <p>
              The publication follows market movements that can change how a
              home or investment should be assessed: source documents,
              launches, regulation, developer activity and the development of
              places. It does not replace legal, financial, tax or technical
              due diligence.
            </p>
          </div>
        </section>

        <section className={styles.raj} aria-labelledby="raj-title">
          <figure className={styles.rajPortrait}>
            <Image
              src="/media/real-uhd/raj-tomar-portrait.webp"
              alt="Raj Tomar, UAE property advisor and named publisher"
              fill
              quality={92}
              sizes="(max-width: 820px) 100vw, 42vw"
            />
            <figcaption>
              <span>Raj Tomar</span>
              <small>Named publisher · human advisor</small>
            </figcaption>
          </figure>
          <div className={styles.rajCopy}>
            <div className={styles.sectionLabel}>
              <span>02</span>
              <p>Raj Tomar</p>
            </div>
            <h2 id="raj-title">The human name remains visible.</h2>
            <p>
              Raj Tomar is the Dubai-based property advisor and named
              publisher behind Invest With Raj Intelligence. He is the human
              contact for readers who want to move from a public market report
              to a private property conversation.
            </p>
            <p>
              Raj remains visible because editorial accountability should
              have a name. His role here is to set the judgement, keep the
              advisory boundary clear and answer readers who want a human
              review of a property decision.
            </p>
            <a href={ADVISORY_URL}>Book a working call with Raj ↗</a>
          </div>
        </section>

        <section className={styles.work} aria-labelledby="work-title">
          <div className={styles.sectionHeading}>
            <div className={styles.sectionLabel}>
              <span>03</span>
              <p>The publication</p>
            </div>
            <h2 id="work-title">What the newsroom is here to do.</h2>
          </div>
          <div className={styles.workGrid}>
            {publicationWork.map((item) => (
              <article key={item.number}>
                <span>{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className={styles.boundary}
          aria-labelledby="publication-boundary-title"
        >
          <div className={styles.sectionLabel}>
            <span>04</span>
            <p>One name · two jobs</p>
          </div>
          <h2 id="publication-boundary-title">
            Reporting and advisory are connected. They are not the same thing.
          </h2>
          <div className={styles.boundaryGrid}>
            <article>
              <span>Here · Intelligence</span>
              <h3>Read the public evidence.</h3>
              <ul>
                <li>Source-linked reporting and analysis</li>
                <li>Published methods and correction route</li>
                <li>No personalised recommendation</li>
                <li>No guarantee of price, yield or outcome</li>
              </ul>
              <Link href="/news">Open the reporting archive →</Link>
            </article>
            <article>
              <span>There · Advisory</span>
              <h3>Apply it to your decision.</h3>
              <ul>
                <li>Your budget, timing and intended use</li>
                <li>Questions for verification and due diligence</li>
                <li>A direct conversation with Raj</li>
                <li>A decision route, not a public article</li>
              </ul>
              <a href={ADVISORY_URL}>Go to the advisory site ↗</a>
            </article>
          </div>
        </section>

        <section className={styles.standards} aria-labelledby="standards-title">
          <div>
            <div className={styles.sectionLabel}>
              <span>05</span>
              <p>Standards</p>
            </div>
            <h2 id="standards-title">Trust should be inspectable.</h2>
          </div>
          <div>
            <p>
              Readers should be able to identify the source, distinguish fact
              from interpretation, understand where AI assisted the workflow
              and challenge the record when stronger evidence exists.
            </p>
            <Link href="/about/editorial-standards">
              Read the complete editorial standards →
            </Link>
          </div>
        </section>

        <section className={styles.call} aria-labelledby="call-title">
          <p>From public reading to a private decision</p>
          <h2 id="call-title">Bring the property. Bring the doubt.</h2>
          <p>
            The call is a working conversation about what you are trying to
            decide, what the current evidence establishes and what still needs
            to be verified.
          </p>
          <a href={ADVISORY_URL}>Book the 15-minute call with Raj ↗</a>
        </section>
      </main>
    </>
  );
}
