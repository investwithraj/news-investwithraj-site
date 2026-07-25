import type { Metadata } from "next";
import NewsNav from "@/components/v22/pangea/NewsNav";
import V17BodyFlag from "@/components/v17/chrome/V17BodyFlag";
import { SITE, CONTACT } from "@/lib/constants";

const PAGE_URL = `${SITE.url}/about/editorial-standards`;

export const metadata: Metadata = {
  title: "Editorial standards, sourcing and corrections",
  description:
    "How Invest With Raj sources, verifies, labels and corrects its UAE property reporting, including its policy on AI-assisted editorial work.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "article",
    url: PAGE_URL,
    title: "Editorial standards | Invest With Raj",
    description:
      "Sourcing, verification, AI assistance, corrections and commercial-independence standards.",
  },
};

const standards = [
  {
    id: "sources",
    title: "Source hierarchy",
    body:
      "Official regulators, public records and statutory releases come first. Listed-company filings, investor-relations releases and named research houses come next. Reputable press may provide context or discovery, but material figures should be traced to the strongest available source. Anonymous claims are not presented as established fact.",
  },
  {
    id: "verification",
    title: "Verification",
    body:
      "Names, dates, transaction values, percentages and policy thresholds should be checked against the cited material before publication. A source link must support the claim beside it, not merely discuss the same topic. When reliable sources disagree, the disagreement is stated rather than averaged away.",
  },
  {
    id: "analysis",
    title: "Fact versus analysis",
    body:
      "Reported facts and Raj's interpretation serve different purposes. Facts explain what happened. Analysis explains why it may matter to investors, buyers, developers or landowners. Forward-looking language is framed as a thesis, risk or watchpoint—not as a guaranteed return, price or outcome.",
  },
  {
    id: "ai",
    title: "AI assistance",
    body:
      "AI may assist discovery, research organisation, summarisation, structure and drafting. It is never treated as a source. The same sourcing and verification rules apply regardless of how a draft was produced. Automation does not justify publishing a page that adds no original decision value.",
  },
  {
    id: "commercial",
    title: "Commercial independence",
    body:
      "Coverage is selected for market relevance. A commercial relationship does not change the source standard or remove a material watchpoint. Sponsored or paid material, if introduced, will be labelled clearly and kept distinct from independent reporting.",
  },
];

export default function EditorialStandardsPage() {
  return (
    <>
      <V17BodyFlag />
      <NewsNav />

      <main
        id="main"
        className="v17-dark v17-cobalt"
        style={{ background: "#141414", color: "#F2EEE7", minHeight: "100svh" }}
      >
        <article className="mx-auto w-full max-w-[980px] px-6 pb-24 pt-32 md:px-10 md:pt-40">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C9A961]">
            Publication policy · Last reviewed 25 July 2026
          </p>
          <h1 className="mt-6 max-w-[16ch] font-serif text-[clamp(3rem,7vw,6.5rem)] font-normal leading-[0.96] tracking-[-0.045em]">
            Evidence first. Interpretation labelled.
          </h1>
          <p className="mt-8 max-w-[68ch] text-[clamp(1.05rem,1.8vw,1.3rem)] leading-8 text-[rgba(242,238,231,.72)]">
            These standards govern the market reporting published on
            news.investwithraj.com. They exist to make every page useful as a
            decision record: the reader should be able to identify the source,
            separate fact from analysis and request a correction when the
            public record changes.
          </p>

          <div className="mt-16 divide-y divide-[rgba(242,238,231,.14)] border-y border-[rgba(242,238,231,.14)]">
            {standards.map((standard, index) => (
              <section
                id={standard.id}
                key={standard.id}
                className="grid gap-5 py-10 md:grid-cols-[120px_240px_1fr]"
              >
                <p className="font-mono text-[10px] tracking-[0.2em] text-[#C9A961]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="text-xl leading-7 text-[#F2EEE7]">
                  {standard.title}
                </h2>
                <p className="text-base leading-8 text-[rgba(242,238,231,.7)]">
                  {standard.body}
                </p>
              </section>
            ))}
          </div>

          <section
            id="corrections"
            className="mt-16 border border-[rgba(201,169,97,.4)] p-7 md:p-10"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C9A961]">
              Corrections
            </p>
            <h2 className="mt-4 text-3xl tracking-[-0.025em]">
              Challenge the record.
            </h2>
            <p className="mt-4 max-w-[64ch] text-base leading-8 text-[rgba(242,238,231,.7)]">
              Send the article URL, the specific statement and the strongest
              supporting source to{" "}
              <a className="text-[#D8C089] underline" href={`mailto:${CONTACT.email}?subject=Correction`}>
                {CONTACT.email}
              </a>
              . Material corrections should be made promptly and the
              modification date updated. A change in interpretation is not
              silently presented as a change in fact.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
