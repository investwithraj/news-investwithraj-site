import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rootCtaUrl } from "../lib/constants";
import { advisoryLinkForDeveloper, generalAdvisoryUrl } from "../lib/advisory-relations";
import { decisionCta } from "../lib/news-editorial";
import { NEWS_ARTICLES } from "../content/news";
import { googleEventProperties } from "../lib/google-event-properties";

const input = { source: "news-navigation", route: "/news" };
assert.deepEqual(googleEventProperties(input), { iwr_placement: "news-navigation", route: "/news" });
assert.equal(input.source, "news-navigation");
for (const href of [rootCtaUrl({}), generalAdvisoryUrl("area", "saadiyat-island"), advisoryLinkForDeveloper("aldar", "Aldar")!.href, decisionCta(NEWS_ARTICLES[0]).href]) {
  const url = new URL(href);
  assert.equal(url.origin, "https://www.investwithraj.com");
  assert.equal([...url.searchParams.keys()].some(key => key.startsWith("utm_")), false);
  assert.ok(url.searchParams.get("iwr_placement"));
}
const pageCta = new URL(rootCtaUrl({ placement: "about", campaign: "editorial_to_advisory", content: "about" }));
assert.equal(pageCta.pathname, "/engage");
assert.equal(pageCta.searchParams.get("source"), "news");
assert.equal(pageCta.searchParams.get("iwr_placement"), "about");
assert.equal(pageCta.searchParams.get("iwr_context"), "editorial_to_advisory");
for (const file of ["components/redesign/NewsHome.tsx", "components/redesign/NewsChrome.tsx", "components/redesign/NewsFooter.tsx", "app/about/page.tsx", "app/about/editorial-standards/page.tsx", "components/EditorialFooter.tsx", "components/immersive/acts/CrossLinkAct.tsx", "components/v17/chrome/V17EdgeNav.tsx"]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /utm_(source|medium|campaign|content)/);
}
const policy = readFileSync("app/about/editorial-standards/page.tsx", "utf8");
assert.doesNotMatch(policy, /allowlisted publisher domains|editorial validator|held for review|Automated newsroom publication|AI briefs/);
assert.match(policy, /Publisher/);
assert.match(policy, /Raj Tomar · Invest With Raj/);
assert.match(policy, /Corrections and enquiries/);
assert.match(policy, /REVIEWED_DATE = "2026-10-03"/);
assert.match(policy, /Updated 3 October 2026/);
const runtime = readFileSync("lib/analytics.ts", "utf8");
assert.match(runtime, /if \(isAllowed\("ga4"\)\) window\.gtag/);
assert.match(runtime, /if \(isAllowed\("ga4"\)\) window\.dataLayer/);
console.log("PASS: internal links preserve placement without acquisition UTMs; Google source collision and provider consent guarded.");
