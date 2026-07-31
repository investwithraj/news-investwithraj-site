// Focused, no-network verification for paid AI and editorial-review controls.
// Run: npx tsx scripts/verify-ai-security.ts

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

async function main() {
const mutableEnv = process.env as Record<string, string | undefined>;
mutableEnv.NODE_ENV = "test";
delete process.env.VERCEL;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
process.env.AI_ACTION_SIGNING_SECRET = "test-ai-action-secret-32-bytes-minimum";
process.env.INTERNAL_SESSION_SECRET = "test-internal-session-secret-32-bytes";
process.env.POST_PUBLISH_SECRET = "test-server-publish-secret-32-bytes";

const {
  checkRateLimit,
  claimOnce,
  getClientIp,
  isFirstPartyMutation,
} = await import("../lib/ai/rate-limit.js");
const {
  issueVoiceGrant,
  verifyVoiceGrant,
  voiceGrantsConfigured,
} = await import("../lib/ai/voice-grant.js");
const {
  createReviewSession,
  verifyReviewSession,
  REVIEW_SESSION_COOKIE,
} = await import("../lib/news-review/session.js");
const {
  authorize,
  authorizeMutation,
} = await import("../lib/news-review/auth.js");
const { NextRequest } = await import("next/server");

let passed = 0;
function pass(name: string) {
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

const sameOrigin = new Request("https://news.investwithraj.com/api/brief", {
  method: "POST",
  headers: {
    Origin: "https://news.investwithraj.com",
    "Sec-Fetch-Site": "same-origin",
    "Content-Type": "application/json",
  },
});
assert.equal(isFirstPartyMutation(sameOrigin), true);
assert.equal(
  isFirstPartyMutation(
    new Request("https://news.investwithraj.com/api/brief", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Sec-Fetch-Site": "cross-site",
        "Content-Type": "application/json",
      },
    }),
  ),
  false,
);
pass("paid browser routes require a same-origin JSON mutation");

const strongAiSecret = process.env.AI_ACTION_SIGNING_SECRET;
const strongSessionSecret = process.env.INTERNAL_SESSION_SECRET;
process.env.AI_ACTION_SIGNING_SECRET = "too-short";
process.env.INTERNAL_SESSION_SECRET = "too-short";
assert.equal(voiceGrantsConfigured(), false);
assert.equal(issueVoiceGrant("Server text.", "203.0.113.7"), null);
assert.equal(await createReviewSession(), null);
process.env.AI_ACTION_SIGNING_SECRET = strongAiSecret;
process.env.INTERNAL_SESSION_SECRET = strongSessionSecret;
pass("weak signing and session secrets fail closed");

process.env.VERCEL = "1";
assert.equal(
  getClientIp(
    new Headers({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.250",
    }),
  ),
  "203.0.113.7",
);
delete process.env.VERCEL;
assert.equal(getClientIp(new Headers()), "local-development");
pass("Vercel-owned client IP wins over spoofable forwarding headers");

const limitNamespace = `verify:${randomUUID()}`;
const first = await checkRateLimit("203.0.113.8", {
  namespace: limitNamespace,
  max: 2,
  windowMs: 60_000,
});
const second = await checkRateLimit("203.0.113.8", {
  namespace: limitNamespace,
  max: 2,
  windowMs: 60_000,
});
const third = await checkRateLimit("203.0.113.8", {
  namespace: limitNamespace,
  max: 2,
  windowMs: 60_000,
});
assert.equal(first.allowed, true);
assert.equal(second.allowed, true);
assert.equal(third.allowed, false);
assert.equal(first.backend, "memory");
pass("safe local fallback enforces endpoint-scoped quotas");

mutableEnv.NODE_ENV = "production";
const failClosed = await checkRateLimit("203.0.113.8", {
  namespace: `verify-production:${randomUUID()}`,
  max: 2,
  windowMs: 60_000,
});
assert.equal(failClosed.allowed, false);
assert.equal(failClosed.reason, "unavailable");
assert.equal(failClosed.backend, "unavailable");
mutableEnv.NODE_ENV = "test";
pass("production quotas fail closed without shared KV");

const claimId = randomUUID();
assert.equal((await claimOnce("verify", claimId, 60_000)).claimed, true);
const replay = await claimOnce("verify", claimId, 60_000);
assert.equal(replay.claimed, false);
assert.equal(replay.reason, "used");
pass("one-time claims reject replay");

const grantNow = Date.now();
const grant = issueVoiceGrant("Server generated brief excerpt.", "203.0.113.9", grantNow);
assert.ok(grant);
const verifiedGrant = verifyVoiceGrant(grant, "203.0.113.9", grantNow + 1_000);
assert.equal(verifiedGrant.ok, true);
assert.equal(verifyVoiceGrant(grant, "203.0.113.10", grantNow + 1_000).ok, false);
const [grantPayload, grantSignature] = grant.split(".");
const tamperedGrant = `${grantPayload.slice(0, -1)}${grantPayload.endsWith("A") ? "B" : "A"}.${grantSignature}`;
assert.equal(
  verifyVoiceGrant(tamperedGrant, "203.0.113.9", grantNow + 1_000).ok,
  false,
);
const expiredGrant = verifyVoiceGrant(grant, "203.0.113.9", grantNow + 6 * 60_000);
assert.deepEqual(expiredGrant, { ok: false, reason: "expired" });
pass("voice grants are signed, client-bound, tamper-proof, and short-lived");

const sessionNow = Date.now();
const session = await createReviewSession(sessionNow);
assert.ok(session);
assert.equal(await verifyReviewSession(session, sessionNow + 1_000), true);
const [sessionPayload, sessionSignature] = session.split(".");
const tamperedSession = `${sessionPayload.slice(0, -1)}${sessionPayload.endsWith("A") ? "B" : "A"}.${sessionSignature}`;
assert.equal(await verifyReviewSession(tamperedSession, sessionNow + 1_000), false);
assert.equal(await verifyReviewSession(session, sessionNow + 9 * 60 * 60 * 1_000), false);
pass("review sessions are signed and expire");

const queryOnly = new NextRequest(
  `https://news.investwithraj.com/api/news/draft?secret=${process.env.POST_PUBLISH_SECRET}`,
);
assert.equal((await authorize(queryOnly)).ok, false);

const serverHeader = new NextRequest("https://news.investwithraj.com/api/news/draft", {
  method: "POST",
  headers: { "x-post-publish-secret": process.env.POST_PUBLISH_SECRET },
});
assert.equal((await authorizeMutation(serverHeader)).ok, true);

const cookie = `${REVIEW_SESSION_COOKIE}=${session}`;
const sessionMutation = new NextRequest(
  "https://news.investwithraj.com/api/news/draft/abc",
  {
    method: "PATCH",
    headers: {
      Cookie: cookie,
      Origin: "https://news.investwithraj.com",
      "Sec-Fetch-Site": "same-origin",
      "Content-Type": "application/json",
    },
  },
);
assert.equal((await authorizeMutation(sessionMutation)).ok, true);
const crossSiteSessionMutation = new NextRequest(
  "https://news.investwithraj.com/api/news/draft/abc",
  {
    method: "DELETE",
    headers: {
      Cookie: cookie,
      Origin: "https://attacker.example",
      "Sec-Fetch-Site": "cross-site",
    },
  },
);
const crossSiteAuth = await authorizeMutation(crossSiteSessionMutation);
assert.equal(crossSiteAuth.ok, false);
assert.equal(crossSiteAuth.status, 403);
pass("review auth rejects query secrets and CSRF while exempting server headers");

const [voiceRoute, reviewClient, reviewPage, authSource] = await Promise.all([
  readFile(path.join(process.cwd(), "app/api/voice/route.ts"), "utf8"),
  readFile(path.join(process.cwd(), "app/internal/review/ReviewDesk.tsx"), "utf8"),
  readFile(path.join(process.cwd(), "app/internal/review/page.tsx"), "utf8"),
  readFile(path.join(process.cwd(), "lib/news-review/auth.ts"), "utf8"),
]);
assert.equal(voiceRoute.includes("3PmZaGGPRbZDCjAl7KBE"), false);
assert.equal(voiceRoute.includes("body.text"), false);
assert.equal(reviewClient.includes("actionSecret"), false);
assert.equal(reviewClient.includes("?secret="), false);
assert.equal(reviewPage.includes("POST_PUBLISH_SECRET"), false);
assert.equal(authSource.includes("queryCredentialPresent"), true);
assert.equal(authSource.includes("req.nextUrl.searchParams.keys()"), true);
assert.equal(authSource.includes("Credentials in URLs are rejected"), true);
pass("source scan finds no voice ID, arbitrary TTS body, or accepted browser/query secret");

console.log(`\n${passed} focused security checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
