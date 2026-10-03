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
for (const file of ["components/redesign/NewsHome.tsx", "components/redesign/NewsChrome.tsx", "components/redesign/NewsFooter.tsx"]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /utm_(source|medium|campaign|content)/);
}
const runtime = readFileSync("lib/analytics.ts", "utf8");
assert.match(runtime, /if \(isAllowed\("ga4"\)\) window\.gtag/);
assert.match(runtime, /if \(isAllowed\("ga4"\)\) window\.dataLayer/);
console.log("PASS: internal links preserve placement without acquisition UTMs; Google source collision and provider consent guarded.");
