import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { NextRequest } from "next/server";
import { proxy, config } from "../proxy";
import { isRetiredReviewPath, retiredReviewResponse } from "../lib/review-desk-retirement";

const apiModules = [
  "../app/api/news/draft/route",
  "../app/api/news/draft/reservation/route",
  "../app/api/news/draft/[id]/route",
  ...["deployment", "media-approval", "publish", "receipt", "reuse-curated-media", "reuse-daily-media"]
    .map((name) => "../app/api/news/draft/[id]/" + name + "/route"),
  "../app/api/news/correction/route",
  "../app/api/cron/draft/route",
  "../app/api/cron/news-watchdog/route",
];
const paths = [
  "/internal/review", "/internal/review/", "/internal/review/old",
  "/api/news/draft", "/api/news/draft/reservation",
  "/api/news/draft/example/publish", "/api/news/draft/example/media-approval",
  "/api/news/correction", "/api/cron/draft", "/api/cron/news-watchdog",
];
let checks = 0;
async function verify(response: Response, method: string) {
  assert.equal(response.status, 410);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("www-authenticate"), null);
  const text = await response.text();
  if (method === "HEAD") assert.equal(text, "");
  else assert.match(text, /retired/);
  assert.doesNotMatch(text, /secret-value|draft-body|password/i);
  checks++;
}
async function main() {
  // No real credentials or database/provider calls. Auth state is irrelevant to retirement.
  for (const pathname of paths) {
    assert.equal(isRetiredReviewPath(pathname), true);
    for (const method of ["GET", "HEAD", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"]) {
      const request = new NextRequest("https://news.investwithraj.com" + pathname, {
        method, headers: { authorization: "Basic secret-value", cookie: "legacy=secret-value", "x-post-publish-secret": "secret-value" },
      });
      await verify(retiredReviewResponse(request), method);
      await verify(await proxy(request), method);
    }
  }
  for (const pathname of ["/", "/news", "/rss.xml", "/sitemap.xml", "/internal/dashboard", "/api/queue", "/internal/reviewer", "/api/news/drafts"]) {
    assert.equal(isRetiredReviewPath(pathname), false);
  }
  for (const path of apiModules) {
    const module = await import(path);
    for (const method of ["GET", "HEAD", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"]) {
      await verify(await module[method](new Request("https://news.investwithraj.com/api/retired", {method})), method);
    }
    const source = readFileSync(new URL(path + ".ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /process\.env|fetch\(|storage|github|authorize/);
  }
  for (const file of ["page.tsx", "ReviewDesk.tsx", "ReviewDesk.module.css"]) {
    assert.equal(existsSync("app/internal/review/" + file), false);
  }
  assert(config.matcher.includes("/api/news/draft/:path*"));
  assert(config.matcher.includes("/internal/:path*"));
  console.log("PASS: review retirement — " + checks + " response checks; public paths preserved; UI removed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
