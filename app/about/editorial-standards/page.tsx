import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT, SITE, rootCtaUrl } from "@/lib/constants";
import {
  asGraph,
  breadcrumbSchema,
  newsOrgRef,
} from "@/lib/schema";

import styles from "../AboutPages.module.css";

const PAGE_URL = `${SITE.url}/about/editorial-standards`;
const REVIEWED_DATE = "2026-10-03";
const ADVISORY_URL = rootCtaUrl({ placement: "editorial_standards", campaign: "editorial_to_advisory", content: "editorial-standards" });
const DESCRIPTION =
  "The source, verification, interpretation, correction, AI and conflicts standards used by Invest With Raj Intelligence.";

export const metadata: Metadata = {
  title: "Editorial standards, sourcing and corrections",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "article",
    locale: "en_AE",
    siteName: SITE.name,
    url: PAGE_URL,
    title: "Editorial standards | Invest With Raj Intelligence",
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE.url}/api/og`,
        width: 1200,
        height: 630,
        alt: `Editorial standards — ${SITE.name}`,
      },
    ],
  },
};

const graph = asGraph(
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${PAGE_URL}#page`,
    url: PAGE_URL,
    name: "Editorial standards, sourcing and corrections",
    description: DESCRIPTION,
    inLanguage: "en-AE",
    dateModified: REVIEWED_DATE,
    isPartOf: { "@id": `${SITE.url}#website` },
    publisher: newsOrgRef,
  },
  breadcrumbSchema([
    { name: "About", url: `${SITE.url}/about` },
    { name: "Editorial standards", url: PAGE_URL },
  ]),
);

const standards = [
  {
    id: "evidence",
    number: "01",
    title: "Accurate reporting",
    body:
      "We check names, dates and material figures against identifiable sources. Announcements, construction progress and completed delivery are reported distinctly. Publication dates and the periods covered by market data remain clear.",
  },
  {
    id: "sources",
    number: "02",
    title: "Sources you can follow",
    body:
      "Official announcements, public records and named market research form the basis of our coverage, alongside reputable reporting. We link the sources behind material claims. A developer's announcement is attributed to that developer, not presented as an independent endorsement.",
  },
  {
    id: "interpretation",
    number: "03",
    title: "Interpretation is labelled",
    body:
      "News explains what happened. Analysis examines its significance for buyers, owners and investors. Commentary is identified, and financial scenarios are distinguished from reported market results.",
  },
  {
    id: "corrections",
    number: "04",
    title: "Corrections remain visible",
    body:
      "When a material factual error is established, we correct the article and explain the change on the page. A substantive update carries its actual update date; the original publication date is retained.",
  },
  {
    id: "ai",
    number: "05",
    title: "Use of AI",
    body:
      "AI tools can assist research organisation and drafting. They are not factual sources: published claims are checked against identified records, and editorial responsibility remains with Invest With Raj.",
  },
  {
    id: "conflicts",
    number: "06",
    title: "Conflicts and commercial material",
    body:
      "Invest With Raj publishes real estate reporting and provides advisory services. Relevant commercial relationships are disclosed. Paid or sponsored coverage, if introduced, is labelled and kept distinct from editorial reporting.",
  },
];

export default function EditorialStandardsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
        }}
      />

      <main id="main" className={`${styles.page} ${styles.policyPage}`}>
        <header className={styles.policyHero}>
          <div className={styles.heroRegister}>
            <Link href="/about">← About the publication</Link>
            <span>Updated 3 October 2026</span>
          </div>
          <p>Editorial standards</p>
          <h1>
            How we report.
            <br />
            What you can expect.
          </h1>
          <p>
            Clear sources, accurate dates and original reporting, with analysis
            focused on the decisions facing real estate buyers and investors.
          </p>
        </header>

        <div className={styles.policyRegister}>
          <span>Applies to</span>
          <strong>News · analysis · area and developer guides</strong>
          <span>Publication</span>
          <strong>{SITE.name}</strong>
          <span>Publisher</span>
          <strong>Raj Tomar · Invest With Raj</strong>
        </div>

        <div className={styles.policyList}>
          {standards.map((standard) => (
            <section id={standard.id} key={standard.id}>
              <span>{standard.number}</span>
              <h2>{standard.title}</h2>
              <p>{standard.body}</p>
            </section>
          ))}
        </div>

        <section
          id="challenge"
          className={styles.challenge}
          aria-labelledby="challenge-title"
        >
          <p>Corrections and enquiries</p>
          <h2 id="challenge-title">Get in touch.</h2>
          <p>
            For a correction, send the article link, the relevant statement and
            any supporting source to{" "}
            <a href={`mailto:${CONTACT.email}?subject=Correction%20request`}>
              {CONTACT.email}
            </a>
            . We assess corrections against the source record.
          </p>
          <div>
            <Link href="/news">Read the reporting archive →</Link>
            <a href={ADVISORY_URL}>Take a decision to Raj ↗</a>
          </div>
        </section>
      </main>
    </>
  );
}
