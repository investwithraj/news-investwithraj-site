import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import dns from "node:dns/promises";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

import { fetchAllSources, summarizeFetchRun } from "../lib/sources/fetchers/index.js";
import { checkOfficialSourceHealth } from "../lib/sources/fetchers/health.js";
import { safeFetchBytes, SourceFetchError } from "../lib/sources/safe-fetch.js";
import type { VerifiedSource } from "../lib/sources/registry.js";

// Offline transport doubles retain the production safe-fetch, RSS parser and
// dispatcher. No real DNS, provider requests, credentials or persisted cache.
interface Reply { status: number; mime: string; retryAfter?: string; body?: string }
const replies = new Map<string, Reply>();
const calls = new Map<string, number>();
const active = new Map<string, number>();
let activeTotal = 0;
let peakTotal = 0;
let peakHost = 0;

function source(host: string, index = 0): VerifiedSource {
  return {
    name: `${host} feed ${index}`, url: `https://${host}`, rssUrl: `https://${host}/rss?q=${index}`,
    tier: "national-press", market: ["UAE"], fetchType: "rss",
  };
}

function reset() {
  assert.equal(activeTotal, 0);
  replies.clear(); calls.clear(); active.clear(); peakTotal = 0; peakHost = 0;
}

mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
mock.method(https, "request", (options: https.RequestOptions, callback: (response: EventEmitter) => void) => {
  const request = new EventEmitter() as EventEmitter & { setTimeout: () => void; end: () => void };
  request.setTimeout = () => {};
  request.end = () => {
    const host = String(options.hostname);
    assert.equal(options.protocol, "https:");
    assert.equal(options.method, "GET");
    assert.ok(options.lookup, "production DNS-pinned lookup stays installed");
    assert.equal((options.headers as Record<string, string>)["Accept-Encoding"], "identity");
    calls.set(host, (calls.get(host) ?? 0) + 1);
    active.set(host, (active.get(host) ?? 0) + 1);
    peakHost = Math.max(peakHost, active.get(host)!);
    peakTotal = Math.max(peakTotal, ++activeTotal);
    setImmediate(() => {
      const reply = replies.get(host) ?? { status: 200, mime: "application/rss+xml" };
      const xml = `<rss><channel><item><title>Dubai property development update</title><link>https://${host}/news/item</link><pubDate>Sun, 13 Sep 2026 06:00:00 GMT</pubDate></item></channel></rss>`;
      const response = new EventEmitter() as EventEmitter & {
        statusCode: number; headers: Record<string, string>; resume: () => void;
      };
      response.statusCode = reply.status;
      response.headers = { "content-type": reply.mime, ...(reply.retryAfter ? { "retry-after": reply.retryAfter } : {}) };
      response.resume = () => {};
      callback(response);
      response.emit("data", Buffer.from(reply.body ?? xml));
      response.emit("end");
      active.set(host, active.get(host)! - 1);
      activeTotal--;
    });
  };
  return request;
});
syncBuiltinESMExports();

async function main() {
  const healthySources = Array.from({ length: 7 }, (_, host) =>
    Array.from({ length: 3 }, (_, index) => source(`healthy-${host}.test`, index))).flat();
  const healthy = await fetchAllSources({ sources: healthySources });
  assert.equal(healthy.okCount, healthySources.length);
  assert.equal(healthy.skippedSourceCount, 0);
  assert.equal(peakHost, 1, "only one in-flight request per actual target host");
  assert.equal(peakTotal, 4, "four independent hosts can progress, never more");
  assert.deepEqual(healthy.results.map((result) => result.source.name), healthySources.map((item) => item.name),
    "concurrency must not change source/entry ordering");

  for (const reply of [
    { status: 503, mime: "application/rss+xml", retryAfter: "600" },
    { status: 429, mime: "text/html" },
    { status: 403, mime: "text/html" },
    { status: 200, mime: "text/html; charset=utf-8", body: "<html>Challenge, not a feed</html>" },
    { status: 200, mime: "application/xhtml+xml", body: "<html>Challenge, not a feed</html>" },
  ]) {
    reset();
    replies.set("blocked.test", reply);
    const sources = [...Array.from({ length: 20 }, (_, index) => source("blocked.test", index)), source("independent.test")];
    const run = await fetchAllSources({ sources });
    assert.equal(calls.get("blocked.test"), 1, `${reply.status}/${reply.mime}: no retries or later queued requests`);
    assert.equal(calls.get("independent.test"), 1, "independent publishers continue");
    assert.equal(run.skippedSourceCount, 19);
    assert.equal(run.errorCount, 20, "compatibility error count includes attempted errors and explicit skips");
    assert.equal(run.transportOkCount, 1);
    assert.equal(run.datedEntrySourceCount, 1);
    assert.equal(run.totalEntries, 1);
    assert.equal(run.results[0].failure?.code, reply.status === 200 ? "content-type" : "http");
    assert.ok(run.results.slice(1, 20).every((result) =>
      result.failure?.code === "provider-backoff" && result.error !== null && result.entries.length === 0 && result.durationMs === 0));
    const summary = summarizeFetchRun(run);
    assert.match(summary, /Transport responses: 1\/21/u);
    assert.match(summary, /1 source transport error/u);
    assert.match(summary, /19 source\(s\) skipped without a request/u);
    assert.ok(peakTotal <= 4 && peakHost === 1);
    if (reply.retryAfter) assert.equal(run.results[0].failure?.retryAfterSeconds, 600);
  }

  // New runs can retry normally; stopping one host is neither permanent nor a
  // process-global ban. Healthy index pages still accept HTML as before.
  reset();
  const restored = await fetchAllSources({ sources: [source("blocked.test"), source("blocked.test", 1)] });
  assert.equal(restored.transportOkCount, 2);
  replies.set("index.test", { status: 200, mime: "text/html", body: "<html>No dated articles here.</html>" });
  const index = { ...source("index.test"), fetchType: "webfetch" as const, rssUrl: undefined };
  const indexRun = await fetchAllSources({ sources: [index] });
  assert.equal(indexRun.transportOkCount, 1, "HTML remains valid for the existing HTML index lane");
  assert.equal(indexRun.datedEntrySourceCount, 0, "an empty index is never dated discovery");

  reset();
  replies.set("health-blocked.test", { status: 503, mime: "text/html", retryAfter: "600" });
  const health = await checkOfficialSourceHealth([
    ...Array.from({ length: 20 }, (_, index) => source("health-blocked.test", index)), source("health-independent.test"),
  ]);
  assert.equal(calls.get("health-blocked.test"), 1);
  assert.equal(health[0].status, 503);
  assert.ok(health.slice(1, 20).every((result) => !result.ok && !result.transportOk && !result.discoveryOk &&
    result.discoveryState === "provider-backoff" && result.status === 0));
  assert.equal(health[20].discoveryOk, true);

  reset();
  replies.set("metadata.test", { status: 503, mime: "text/html; private=do-not-log", retryAfter: "600" });
  await assert.rejects(safeFetchBytes("https://metadata.test/rss?token=do-not-log", {
    allowedDomains: ["metadata.test"], accept: "application/rss+xml", allowedContentTypes: /application\/rss\+xml/u,
    maxBytes: 2_048, timeoutMs: 1_000, maxRedirects: 3, userAgent: "unchanged-test-identity",
  }), (error: unknown) => {
    assert.ok(error instanceof SourceFetchError);
    assert.deepEqual(error.failure, { code: "http", host: "metadata.test", status: 503, contentType: "text/html", retryAfterSeconds: 600 });
    assert.doesNotMatch(`${error.message} ${JSON.stringify(error.failure)}`, /do-not-log|token|private/u,
      "metadata cannot expose response bodies, MIME parameters, query strings or credentials");
    return true;
  });

  console.log("PASS: one request per host, four global workers, one attempted request during a 20-query outage, explicit non-success skips, independent publishers, unchanged RSS XML boundary, bounded metadata and per-run recovery. No external operations.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  mock.restoreAll();
  syncBuiltinESMExports();
});
