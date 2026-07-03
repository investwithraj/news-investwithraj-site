// News review drafts — create (POST) + list (GET).
//
// POST is called by the pipeline / cron (?secret=) or the cockpit (Basic-Auth)
// to stage a drafted article into KV for review. It NEVER publishes — the
// article only goes live via the /publish route after Raj approves.

import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/news-review/auth";
import { addDraft, getAllDrafts, getStorageBackend } from "@/lib/news-review/storage";
import type { NewsDraftInput } from "@/lib/news-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const drafts = await getAllDrafts();
  return NextResponse.json({ ok: true, drafts, backend: getStorageBackend() });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: Partial<NewsDraftInput>;
  try {
    body = (await req.json()) as Partial<NewsDraftInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const article = body.article;
  if (
    !article ||
    typeof article.slug !== "string" ||
    typeof article.title !== "string" ||
    typeof article.body !== "string" ||
    !Array.isArray(article.citations)
  ) {
    return NextResponse.json(
      { error: "article must include slug, title, body, citations[]" },
      { status: 400 },
    );
  }

  const provenance = body.provenance ?? {
    clusterId: "manual",
    topic: article.title,
    score: 0,
    scoreBreakdown: { uhnwRelevance: 0, sourceTier: 0, freshness: 0, rajAngle: 0 },
    sources: [],
  };

  const draft = await addDraft({ article, provenance, reviewNote: body.reviewNote });
  return NextResponse.json({ ok: true, draft });
}
