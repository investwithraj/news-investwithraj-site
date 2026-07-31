// Post-publish review endpoint. It validates owned article URLs and returns a
// dry-run discovery plan. It never sends, publishes, pings or distributes.
//
// Called by:
//   - The daily schedule-skill Claude session AFTER commit + push completes
//   - Optionally: Vercel Deploy Hook (configurable via Vercel project Settings)
//
// Usage (after a commit that adds new articles):
//   POST /api/post-publish
//   x-post-publish-secret: <POST_PUBLISH_SECRET>
//   body: {
//     "newUrls": ["https://news.investwithraj.com/news/2026-05-26-foo"],
//     "deploymentId": "dpl_xyz" (optional, for logging)
//   }
//
// Returns a structured report of every ping attempted + its outcome.

import { NextRequest } from "next/server";
import {
  authorizeServerMutation,
  normalizeOwnedUrls,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  const parsed = await readJsonBody<{
    newUrls?: unknown;
    deploymentId?: unknown;
  }>(request, { maxBytes: 128_000, allowEmpty: true });
  if (!parsed.ok) return parsed.response;

  const newUrls = normalizeOwnedUrls(
    Array.isArray(parsed.value.newUrls) ? parsed.value.newUrls : [],
    { max: 1_000 },
  );

  return privateJson({
    ok: true,
    dryRun: true,
    submitted: false,
    deploymentId:
      typeof parsed.value.deploymentId === "string"
        ? parsed.value.deploymentId.slice(0, 160)
        : null,
    acceptedUrlCount: newUrls.length,
    urls: newUrls,
    discovery: {
      google:
        "sitemap and news-sitemap discovery; no deprecated public ping call",
      indexNow:
        "use the separately authenticated /api/indexnow operation after review",
    },
    timestamp: new Date().toISOString(),
  });
}

/** GET — health check + endpoint documentation */
export async function GET() {
  return publicStatusJson({
    name: "news.investwithraj.com post-publish review",
    mutationMethod: "POST",
    body: {
      newUrls: "string[] — absolute URLs of articles newly published in this deploy",
      deploymentId: "string (optional) — Vercel deployment ID for log correlation",
    },
    externalMutation:
      "none; returns a validated review plan and never pings or distributes",
  });
}
