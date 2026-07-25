import type { Metadata } from "next";
import Link from "next/link";
import NewsNav from "@/components/v22/pangea/NewsNav";
import V17BodyFlag from "@/components/v17/chrome/V17BodyFlag";
import { asGraph, rajPersonSchema } from "@/lib/schema";
import { SITE } from "@/lib/constants";

const PAGE_URL = `${SITE.url}/about`;

export const metadata: Metadata = {
  title: "About Raj Tomar and the publication",
  description:
    "Meet Raj Tomar and learn how Invest With Raj publishes source-cited UAE property intelligence for investors, private buyers, developers and landowners.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "profile",
    url: PAGE_URL,
    title: "About Raj Tomar | Invest With Raj",
    description:
      "The author, purpose and standards behind Invest With Raj's UAE property reporting.",
  },
};

const profileGraph = asGraph(
  {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${PAGE_URL}#profile`,
    url: PAGE_URL,
    name: "About Raj Tomar",
    description:
      "Raj Tomar is a Dubai-based trusted property advisor and the author of Invest With Raj's UAE property intelligence.",
    dateModified: "2026-07-25",
    mainEntity: { "@id": `${SITE.rootUrl}#raj` },
  },
  rajPersonSchema,
);

export default function AboutPage() {
  return (
    <>
      <V17BodyFlag />
      <NewsNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(profileGraph).replace(/</g, "\\u003c"),
        }}
      />

      <main
        id="main"
        className="v17-dark v17-cobalt"
        style={{ background: "#141414", color: "#F2EEE7", minHeight: "100svh" }}
      >
        <article className="mx-auto w-full max-w-[980px] px-6 pb-24 pt-32 md:px-10 md:pt-40">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C9A961]">
            The publisher · Dubai
          </p>
          <h1 className="mt-6 max-w-[16ch] font-serif text-[clamp(3rem,8vw,7.5rem)] font-normal leading-[0.94] tracking-[-0.045em]">
            Intelligence for the decision before the deal.
          </h1>
          <p className="mt-8 max-w-[66ch] text-[clamp(1.05rem,1.8vw,1.35rem)] leading-8 text-[rgba(242,238,231,.72)]">
            Invest With Raj is the market-intelligence publication of Raj
            Tomar, a Dubai-based trusted property advisor. It reports the
            market movements, launches, policy changes, developer decisions
            and community-level signals that can materially affect a UAE
            property decision.
          </p>

          <div className="mt-16 grid gap-12 border-t border-[rgba(242,238,231,.14)] pt-12 md:grid-cols-[.72fr_1.28fr]">
            <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-[#C9A961]">
              Who is Raj Tomar?
            </h2>
            <div className="space-y-6 text-base leading-8 text-[rgba(242,238,231,.78)]">
              <p>
                Raj Tomar is a Dubai-based property advisor whose approach is
                shaped by urban and regional planning, construction
                management and cross-border commercial experience. He holds a
                B.Plan in Urban &amp; Regional Planning, an MBA in Construction
                Management and a Wharton AI Applications Certificate completed
                as executive education. His work focuses on reading the
                masterplan, supply, developer execution and exit conditions
                before recommending an address.
              </p>
              <p>
                The publication gives that process a public record. Reporting
                is separated from advisory: this site explains what changed
                and why it matters; the main Invest With Raj site handles
                private briefs and the 15-minute call.
              </p>
            </div>
          </div>

          <div className="mt-16 grid gap-12 border-t border-[rgba(242,238,231,.14)] pt-12 md:grid-cols-[.72fr_1.28fr]">
            <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-[#C9A961]">
              What we publish
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                ["Market reporting", "Transactions, capital flows, rents, supply and regulation."],
                ["Launch analysis", "What changed, the source, the investment relevance and the watchpoint."],
                ["Area coverage", "Community-level reporting across Dubai, Abu Dhabi and Ras Al Khaimah."],
                ["Developer coverage", "Corporate, delivery and project signals organised by developer."],
              ].map(([title, copy]) => (
                <section
                  key={title}
                  className="border-l border-[rgba(201,169,97,.45)] pl-5"
                >
                  <h3 className="text-lg text-[#F2EEE7]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[rgba(242,238,231,.62)]">
                    {copy}
                  </p>
                </section>
              ))}
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-5 border-t border-[rgba(242,238,231,.14)] pt-10 sm:flex-row">
            <Link
              href="/about/editorial-standards"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(242,238,231,.28)] px-6 font-mono text-[10px] uppercase tracking-[0.18em]"
            >
              Read the editorial standards
            </Link>
            <a
              href="https://investwithraj.com/start?utm_source=news.investwithraj.com&utm_medium=about&utm_campaign=organic-authority"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#C9A961] px-6 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#141414]"
            >
              Book the 15-minute call ↗
            </a>
          </div>
        </article>
      </main>
    </>
  );
}
