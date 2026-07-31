import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT, SITE } from "@/lib/constants";
import {
  asGraph,
  breadcrumbSchema,
  newsOrgRef,
} from "@/lib/schema";

import styles from "../AboutPages.module.css";

const PAGE_URL = `${SITE.url}/about/editorial-standards`;
const REVIEWED_DATE = "2026-07-31";
const ADVISORY_URL =
  `${SITE.rootUrl}/engage?utm_source=news.investwithraj.com` +
  "&utm_medium=editorial_standards&utm_campaign=editorial_to_advisory";
const DESCRIPTION =
  "The source, verification, interpretation, correction, AI and conflicts standards used by Invest With Raj Intelligence.";

export const metadata: Metadata = {
  title: "Editorial standards, sourcing and corrections",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "article",
    url: PAGE_URL,
    title: "Editorial standards | Invest With Raj Intelligence",
    description: DESCRIPTION,
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
    title: "Evidence first",
    body:
      "A report begins with an identifiable record. Material names, dates, prices, percentages, policy thresholds and attributed statements must be supportable from the sources linked to the page. If the record is too weak, the claim is withheld or described as unverified.",
  },
  {
    id: "sources",
    number: "02",
    title: "Source hierarchy",
    body:
      "Regulators, public records, statutory notices and first-party corporate filings are preferred. Named research and reputable reporting can add context. Discovery feeds and social posts are leads, not proof. A link must support the specific nearby claim, not merely discuss the same subject.",
  },
  {
    id: "interpretation",
    number: "03",
    title: "Interpretation is labelled",
    body:
      "Reported fact and Raj's interpretation do different jobs. Fact describes what the available record establishes. Interpretation explains a possible consequence for a buyer or investor. Forecasts are framed as scenarios, risks or watchpoints—never as guaranteed returns, prices or outcomes.",
  },
  {
    id: "corrections",
    number: "04",
    title: "Corrections remain visible",
    body:
      "A material factual error should be corrected promptly once stronger evidence is verified. The page's modification date is updated and a material correction should be disclosed on the page. Changes in interpretation are not silently presented as changes in fact.",
  },
  {
    id: "ai",
    number: "05",
    title: "AI can assist, never source",
    body:
      "AI may help organise research, search a bounded editorial packet, summarise, translate, structure or draft. It is not evidence and it cannot approve publication in Raj's name. Generated public briefs are labelled, source-bounded and withheld when their citations fail validation.",
  },
  {
    id: "conflicts",
    number: "06",
    title: "Conflicts and commercial material",
    body:
      "Editorial coverage and Raj's advisory work sit under the same name, so the boundary must be explicit. A commercial relationship must not lower the evidence standard or remove a material watchpoint. Paid or sponsored material, if introduced, must be labelled and separated from independent reporting.",
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
            <span>Reviewed 31 July 2026</span>
          </div>
          <p>Editorial standards</p>
          <h1>
            Evidence first.
            <br />
            Interpretation labelled.
          </h1>
          <p>
            These are the working rules for reporting published on
            news.investwithraj.com. They describe what readers can expect and
            how to challenge the record.
          </p>
        </header>

        <div className={styles.policyRegister}>
          <span>Applies to</span>
          <strong>News · analysis · area and developer records · AI briefs</strong>
          <span>Accountable editor</span>
          <strong>Raj Tomar</strong>
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
          <p>07 · Challenge the record</p>
          <h2 id="challenge-title">Bring the stronger source.</h2>
          <p>
            Send the article URL, the exact statement being challenged and the
            strongest supporting source to{" "}
            <a href={`mailto:${CONTACT.email}?subject=Correction%20request`}>
              {CONTACT.email}
            </a>
            . A challenge is reviewed against the source record; it is not
            accepted or rejected on the basis of commercial preference.
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
