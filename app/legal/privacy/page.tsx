import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT, SITE } from "@/lib/constants";
import { asGraph, breadcrumbSchema, newsOrgRef } from "@/lib/schema";

import PrivacyControls from "./PrivacyControls";
import styles from "./Privacy.module.css";

const PAGE_URL = `${SITE.url}/legal/privacy`;
const DESCRIPTION =
  "How Invest With Raj Intelligence handles reader analytics choices, AI briefs, browser preferences, publication systems and cross-domain attribution.";

export const metadata: Metadata = {
  title: "Privacy and data choices",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: "Privacy | Invest With Raj Intelligence",
    description: DESCRIPTION,
  },
};

const graph = asGraph(
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${PAGE_URL}#page`,
    url: PAGE_URL,
    name: "Privacy and data choices",
    description: DESCRIPTION,
    inLanguage: "en-AE",
    dateModified: "2026-07-31",
    isPartOf: { "@id": `${SITE.url}#website` },
    publisher: newsOrgRef,
  },
  breadcrumbSchema([
    { name: "Privacy", url: PAGE_URL },
  ]),
);

const optionalServices = [
  ["Analytics", "Google Analytics 4, Plausible and Microsoft Clarity"],
  [
    "Advertising",
    "Meta Pixel, LinkedIn Insight, X Pixel and TikTok Pixel",
  ],
  ["Conversion", "Google Ads conversion measurement"],
];

export default function PrivacyPage() {
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
          <div>
            <Link href="/about">Invest With Raj Intelligence</Link>
            <span>Effective 31 July 2026</span>
          </div>
          <p>Publication privacy</p>
          <h1>
            Read privately.
            <br />
            Choose what travels.
          </h1>
          <p className={styles.dek}>
            This page describes the news publication itself. The separate
            Invest With Raj advisory site has its own privacy notice for
            enquiries, calls and client work.
          </p>
        </header>

        <section className={styles.summary} aria-label="Privacy summary">
          <article>
            <span>Essential operation</span>
            <strong>Works without optional advertising pixels</strong>
          </article>
          <article>
            <span>Your choice</span>
            <strong>Analytics, advertising and conversion services</strong>
          </article>
          <article>
            <span>Human contact</span>
            <strong>{CONTACT.email}</strong>
          </article>
        </section>

        <div className={styles.body}>
          <nav className={styles.index} aria-label="Privacy sections">
            <p>On this page</p>
            <a href="#controller">01 · Who is responsible</a>
            <a href="#reading">02 · When you read</a>
            <a href="#choices">03 · Analytics and retargeting</a>
            <a href="#briefs">04 · AI-generated briefs</a>
            <a href="#preferences">05 · Saved preferences</a>
            <a href="#distribution">06 · Publishing systems</a>
            <a href="#cross-domain">07 · Cross-domain journeys</a>
            <a href="#retention">08 · Retention and rights</a>
          </nav>

          <article className={styles.policy}>
            <section id="controller">
              <span>01</span>
              <h2>Who is responsible</h2>
              <p>
                Invest With Raj Intelligence is the publication responsible
                for the reader journeys described here. Privacy questions,
                access requests and correction or deletion requests can be
                sent to{" "}
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
              </p>
            </section>

            <section id="reading">
              <span>02</span>
              <h2>What happens when you read</h2>
              <p>
                The hosting and security infrastructure receives the normal
                technical information needed to return a page and protect the
                service. This can include the requested URL, time, IP address,
                browser or user-agent information and diagnostic logs.
              </p>
              <p>
                The site layout also mounts Vercel Analytics and Speed
                Insights for deployment analytics and performance diagnosis.
                Their available measurements and retention follow the active
                Vercel project configuration. This notice does not claim a
                configuration that cannot be verified from the public page.
              </p>
            </section>

            <section id="choices">
              <span>03</span>
              <h2>Consented analytics and retargeting</h2>
              <p>
                A consent panel controls the optional measurement and
                advertising integrations in this site&apos;s code. A service
                loads only when its deployment ID is configured and the
                corresponding choice has been recorded. Withdrawing a choice
                stops the site from loading that service again and attempts to
                clear the cookies listed in the consent registry.
              </p>
              <div className={styles.serviceTable}>
                {optionalServices.map(([purpose, services]) => (
                  <div key={purpose}>
                    <strong>{purpose}</strong>
                    <span>{services}</span>
                  </div>
                ))}
              </div>
              <p>
                These providers can receive page, device, referrer and
                campaign information and may set their own identifiers when
                enabled. Their own privacy notices govern processing on their
                systems.
              </p>
              <PrivacyControls />
            </section>

            <section id="briefs">
              <span>04</span>
              <h2>AI-generated briefs</h2>
              <p>
                If you submit a topic to the automated brief tool, the server
                sends that topic and a limited packet of published source
                material to the configured Anthropic Claude service. The
                response is labelled as AI-generated and is not written or
                approved by Raj.
              </p>
              <p>
                The brief route uses the request IP to enforce abuse limits.
                The application code does not intentionally write the topic or
                generated brief into the publication&apos;s article or queue
                storage. Hosting logs and the AI provider may still process
                request data under their configured service terms, so do not
                submit confidential, financial, legal or identifying details.
              </p>
            </section>

            <section id="preferences">
              <span>05</span>
              <h2>Preferences saved in your browser</h2>
              <p>
                The site uses local browser storage for the consent record and,
                where those interfaces are available, preferences such as the
                intelligence-terminal panel order and display currency. These
                values remain on the device and are not a client account. You
                can remove them through browser site-data controls; the
                interfaces fall back to defaults when storage is unavailable.
              </p>
            </section>

            <section id="distribution">
              <span>06</span>
              <h2>Publication and distribution systems</h2>
              <p>
                The newsroom code contains optional server-side connections
                for hosting and publishing through Vercel and GitHub; search
                notification through IndexNow; generation support through
                Anthropic and Google Cloud; and distribution through Postiz,
                Telegram, Discord and Listmonk. Only configured integrations
                run.
              </p>
              <p>
                Those publication routes are designed to send article copy,
                public URLs and operational delivery information—not a
                reader&apos;s private AI topic or terminal preferences. If you
                follow or interact with content on an external platform, that
                platform processes the interaction under its own notice.
              </p>
            </section>

            <section id="cross-domain">
              <span>07</span>
              <h2>Cross-domain measurement</h2>
              <p>
                Links from this publication to investwithraj.com include UTM
                campaign parameters so the advisory site can identify that a
                visit came from the publication and which call-to-action was
                used. The current code does not create a publication account
                or a custom cross-domain user ID.
              </p>
              <p>
                If the same optional analytics or advertising provider is
                separately enabled on both domains, that provider may be able
                to recognise a browser according to your consent and its own
                identifiers. Enquiries, call bookings and advisory records are
                governed by the advisory site&apos;s{" "}
                <a href={`${SITE.rootUrl}/legal/privacy`}>
                  separate privacy notice
                </a>
                .
              </p>
            </section>

            <section id="retention">
              <span>08</span>
              <h2>Retention, transfers and your choices</h2>
              <p>
                Browser preferences remain until you clear them or replace
                them. Infrastructure, analytics and external-platform
                retention follows the configured provider and account
                settings; this page does not invent a fixed period where the
                code does not enforce one. Providers may process data outside
                the UAE subject to their contractual safeguards and privacy
                terms.
              </p>
              <p>
                Depending on the law that applies, you may ask to access,
                correct or delete personal data, object to or restrict certain
                processing, or withdraw consent. Send the request and enough
                context to locate it to{" "}
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
                Withdrawing consent does not affect processing that was lawful
                before withdrawal.
              </p>
            </section>
          </article>
        </div>
      </main>
    </>
  );
}
