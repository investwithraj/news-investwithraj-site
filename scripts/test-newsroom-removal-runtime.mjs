import assert from "node:assert/strict";

const baseUrl = (process.env.NEWSROOM_REMOVAL_BASE_URL ?? "").replace(/\/$/u, "");
const mode = process.env.NEWSROOM_REMOVAL_MODE;

assert.ok(baseUrl, "Set NEWSROOM_REMOVAL_BASE_URL to the exact candidate server.");
assert.ok(mode === "off" || mode === "on", "Set NEWSROOM_REMOVAL_MODE to off or on.");

const removalPaths = [
  "/news/2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop",
  "/news/2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-",
  "/news/2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif",
  "/news/2026-06-24-oman-tenders-1-035bn-solar-mandate-as-vision-2040-absorbs-1-",
  "/news/2026-06-22-from-dhoom-to-dubai-how-rimi-sen-traded-bollywood-for-luxury",
  "/pulse",
];

for (const pathname of removalPaths) {
  for (const method of ["GET", "HEAD"]) {
    const response = await fetch(`${baseUrl}${pathname}?audit=gone`, {
      method,
      redirect: "manual",
      cache: "no-store",
    });
    const expectedStatus = mode === "on" ? 410 : 200;
    assert.equal(response.status, expectedStatus, `${method} ${pathname}`);
    assert.equal(response.headers.get("location"), null);
    if (mode === "on") {
      assert.equal(
        response.headers.get("cache-control"),
        "private, no-store, max-age=0",
      );
      assert.equal(
        response.headers.get("x-robots-tag"),
        "noindex, nofollow, noarchive",
      );
      const body = await response.text();
      assert.equal(body, method === "HEAD" ? "" : "Gone\n");
    }
  }
}

for (const [pathname, expectedStatus] of [
  ["/wallet", 404],
  ["/news/not-a-removal-candidate", 404],
  [
    "/news/2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island",
    200,
  ],
]) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: "manual",
    cache: "no-store",
  });
  assert.equal(response.status, expectedStatus, pathname);
}

const nested = await fetch(`${baseUrl}${removalPaths[0]}/extra`, {
  redirect: "manual",
  cache: "no-store",
});
assert.equal(nested.status, 404);

const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`, { cache: "no-store" });
assert.equal(sitemapResponse.status, 200);
const sitemapXml = await sitemapResponse.text();
const sitemapPaths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
  (match) => new URL(match[1]).pathname,
);
assert.equal(sitemapPaths.length, mode === "on" ? 31 : 79);
for (const pathname of removalPaths.filter((candidate) => candidate.startsWith("/news/"))) {
  assert.equal(sitemapPaths.includes(pathname), mode === "off", pathname);
}
assert.equal(sitemapPaths.includes("/pulse"), false);

console.log(
  `Newsroom removal runtime PASS (${mode}): six routes, headers, methods, controls and ${sitemapPaths.length}-URL sitemap.`,
);
