// News review draft — approve + publish (POST).
//
// The one git write in the whole pipeline. Generates content/news/<slug>.ts
// from the reviewed draft + registers it in index.ts, in ONE GitHub commit
// (Vercel auto-deploys). Then fires the existing /api/post-publish fan-out
// (IndexNow + sitemap pings) and clears the draft from KV.
//
// Server-side guard: the 8-gate validator must pass (block-severity gates)
// before anything is committed — the cockpit additionally soft-locks Approve
// until every number is verified, but the server enforces the gates too.

import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/news-review/auth";
import { getDraft, deleteDraft } from "@/lib/news-review/storage";
import { publishArticleCommit, githubConfigured } from "@/lib/news-review/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEWS_SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://news.investwithraj.com";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  if (!githubConfigured()) {
    return NextResponse.json(
      { error: "Publishing disabled — set GITHUB_TOKEN env var." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const draft = await getDraft(id);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  // Hard gate — block-severity validator failures cannot publish.
  if (!draft.validator.ok) {
    return NextResponse.json(
      {
        error: "Draft fails the voice/validator gates — fix before publishing.",
        failures: draft.validator.failures.filter((f) => f.severity === "block"),
      },
      { status: 422 },
    );
  }

  const { slug } = draft.article;

  let commitSha: string;
  try {
    commitSha = await publishArticleCommit(slug, draft.article);
  } catch (err) {
    return NextResponse.json(
      { error: `GitHub commit failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const url = `${NEWS_SITE}/news/${slug}`;

  // Best-effort search-engine fan-out — never blocks the publish result.
  fireAndForget(req, url);

  // Clear the draft from KV now that it lives in git.
  await deleteDraft(id);

  return NextResponse.json({ ok: true, slug, url, commitSha });
}

function fireAndForget(req: NextRequest, url: string) {
  const secret = process.env.POST_PUBLISH_SECRET;
  if (!secret) return;
  const origin = req.nextUrl.origin;
  void fetch(`${origin}/api/post-publish?secret=${encodeURIComponent(secret)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newUrls: [url] }),
  }).catch(() => {
    /* non-fatal — the article is already live; pings retry next run */
  });
}
