import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { getCuratedNewsCandidate } from "../lib/news-review/curated-candidates";
import { expectedDailyMediaFields, selectDailyNewsMedia } from "../lib/news-review/daily-media-catalog";
import { DailyMediaGitError, ensureApprovedDailyMediaCover } from "../lib/news-review/github-daily-media";

function articleFixture() {
  const article = structuredClone(getCuratedNewsCandidate("prestige-one-investment-2026-09-10").article);
  article.slug = "2026-09-11-dubai-daily-git-test";
  const selected = selectDailyNewsMedia(article);
  const expected = expectedDailyMediaFields(article);
  assert.ok(selected && expected);
  article.heroImage = {
    src: `/${expected.repoPath.replace(/^public\//u, "")}`,
    alt: selected.alt, credit: selected.credit, sourceUrl: selected.sourceUrl,
    rightsStatus: selected.rightsStatus, width: selected.width, height: selected.height,
    approval: "approved-editorial",
  };
  return article;
}

async function main() {
  const article = articleFixture();
  const selected = selectDailyNewsMedia(article)!;
  const expected = expectedDailyMediaFields(article)!;
  const bytes = readFileSync(selected.catalogueRepoPath);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), selected.contentSha256);
  const sourceSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  const base = "/repos/investwithraj/news-investwithraj-site";
  function mockGit(options: {
    target?: "missing" | "exact" | "different" | "alternate";
    race?: "unrelated" | "same-image" | "different-image" | "always";
    changedBytes?: boolean;
    articleExists?: boolean;
    missingSource?: boolean;
    upstreamError?: boolean;
  } = {}) {
    let head = "a".repeat(40);
    let target = options.target ?? "missing";
    let refUpdates = 0;
    let commits = 0;
    let trees = 0;
    const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
    const imageBytes = options.changedBytes ? Buffer.from(bytes) : bytes;
    if (options.changedBytes) imageBytes[Math.floor(imageBytes.length / 2)] ^= 1;
    const actualSha = createHash("sha1").update(`blob ${imageBytes.length}\0`).update(imageBytes).digest("hex");
    const file = { type: "file", sha: actualSha, size: imageBytes.length };
    const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
      status, headers: { "content-type": "application/json" },
    });
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://api.github.com");
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      requests.push({ path: url.pathname, method, body });
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-only-token");
      if (options.upstreamError) return response({ message: "PRIVATE UPSTREAM MESSAGE AND TOKEN" }, 403);
      if (method === "GET" && url.pathname === `${base}/git/ref/heads/main`) {
        return response({ object: { sha: head } });
      }
      if (method === "GET" && url.pathname.startsWith(`${base}/git/commits/`)) {
        assert.equal(url.pathname.split("/").at(-1), head);
        return response({ tree: { sha: "b".repeat(40) } });
      }
      if (method === "GET" && url.pathname.startsWith(`${base}/contents/`)) {
        assert.equal(url.searchParams.get("ref"), head, "every file read is pinned to the captured commit");
        const path = decodeURIComponent(url.pathname.slice(`${base}/contents/`.length));
        if (path === selected.catalogueRepoPath) return response(options.missingSource ? {} : file, options.missingSource ? 404 : 200);
        if (path === `content/news/${article.slug}.ts`) return response(options.articleExists ? { type: "file" } : {}, options.articleExists ? 200 : 404);
        if (path === expected.repoPath && target !== "missing" && target !== "alternate") {
          return response(target === "exact" ? file : { ...file, sha: "f".repeat(40) });
        }
        if (path === `public/news/${article.slug}/cover.png` && target === "alternate") {
          return response({ ...file, sha: "f".repeat(40) });
        }
        return response({}, 404);
      }
      if (method === "GET" && url.pathname === `${base}/git/blobs/${actualSha}`) {
        return response({ content: imageBytes.toString("base64"), encoding: "base64", sha: actualSha, size: imageBytes.length });
      }
      if (method === "POST" && url.pathname === `${base}/git/trees`) {
        trees += 1;
        assert.deepEqual(body, {
          base_tree: "b".repeat(40),
          tree: [{ path: expected.repoPath, mode: "100644", type: "blob", sha: sourceSha }],
        });
        return response({ sha: "c".repeat(40) });
      }
      if (method === "POST" && url.pathname === `${base}/git/commits`) {
        commits += 1;
        assert.equal(body?.tree, "c".repeat(40));
        assert.deepEqual(body?.parents, [head]);
        return response({ sha: "d".repeat(39) + commits });
      }
      if (method === "PATCH" && url.pathname === `${base}/git/refs/heads/main`) {
        refUpdates += 1;
        assert.equal(body?.force, false, "branch updates must never force-push");
        if (options.race && (refUpdates === 1 || options.race === "always")) {
          head = "e".repeat(39) + refUpdates;
          if (options.race === "same-image") target = "exact";
          if (options.race === "different-image") target = "different";
          return response({ message: "Reference update failed" }, 422);
        }
        head = String(body?.sha);
        target = "exact";
        return response({ object: { sha: head } });
      }
      throw new Error(`Unexpected mock Git operation: ${method} ${url.pathname}`);
    };
    return {
      options: { fetch: fetcher, token: "test-only-token", owner: "investwithraj", repo: "news-investwithraj-site", branch: "main" },
      requests,
      get refUpdates() { return refUpdates; },
      get commits() { return commits; },
      get trees() { return trees; },
    };
  }

  const created = mockGit();
  const inspected = await ensureApprovedDailyMediaCover(article, created.options);
  assert.deepEqual(inspected, {
    repoPath: expected.repoPath, contentSha256: selected.contentSha256,
    mime: selected.mime, width: selected.width, height: selected.height,
  });
  assert.equal(created.commits, 1);
  assert.equal(created.refUpdates, 1);
  assert.equal(created.requests.some((request) => request.method === "POST" && request.path.endsWith("/git/blobs")), false,
    "reuse links the approved existing Git blob instead of uploading new bytes");
  await ensureApprovedDailyMediaCover(article, created.options);
  assert.equal(created.commits, 1, "idempotent retry has no second commit");

  for (const config of [
    { target: "different" as const }, { target: "alternate" as const },
    { changedBytes: true }, { missingSource: true }, { articleExists: true },
  ]) {
    const rejected = mockGit(config);
    await assert.rejects(ensureApprovedDailyMediaCover(article, rejected.options));
    assert.equal(rejected.commits, 0);
    assert.equal(rejected.refUpdates, 0);
  }
  const wrongContext = articleFixture();
  wrongContext.heroImage.alt = "The actual new developer project";
  const unused = mockGit();
  await assert.rejects(ensureApprovedDailyMediaCover(wrongContext, unused.options), /matching owner-approved/u);
  assert.equal(unused.requests.length, 0);
  const wrongSlug = { ...article, slug: "../../another" };
  await assert.rejects(ensureApprovedDailyMediaCover(wrongSlug, unused.options), /Slug must/u);
  assert.equal(unused.requests.length, 0);
  const noToken = { ...unused.options, token: "" };
  await assert.rejects(ensureApprovedDailyMediaCover(article, noToken), /unavailable/u);
  assert.equal(unused.requests.length, 0);

  const unrelated = mockGit({ race: "unrelated" });
  await ensureApprovedDailyMediaCover(article, unrelated.options);
  assert.equal(unrelated.refUpdates, 2);
  const sameImage = mockGit({ race: "same-image" });
  await ensureApprovedDailyMediaCover(article, sameImage.options);
  assert.equal(sameImage.refUpdates, 1, "a competing exact attachment is reused without another ref update");
  const conflictingRace = mockGit({ race: "different-image" });
  await assert.rejects(ensureApprovedDailyMediaCover(article, conflictingRace.options), /conflicts/u);
  assert.equal(conflictingRace.refUpdates, 1, "a concurrent cover must not be replaced");
  const repeatedRace = mockGit({ race: "always" });
  await assert.rejects(ensureApprovedDailyMediaCover(article, repeatedRace.options), DailyMediaGitError);
  assert.equal(repeatedRace.refUpdates, 3, "branch race retries are bounded");
  const privateError = mockGit({ upstreamError: true });
  await assert.rejects(ensureApprovedDailyMediaCover(article, privateError.options), (error: unknown) =>
    error instanceof DailyMediaGitError && !error.message.includes("PRIVATE"));
  console.log("Daily media Git reuse passed: real Sharp decode and hashes, pinned reads, one image-only blob-link commit, no overwrite, idempotency, bounded non-force races and safe errors.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
