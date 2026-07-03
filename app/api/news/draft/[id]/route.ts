// News review draft — edit (PATCH) + reject (DELETE).
//
// Both called from the cockpit, authed by the browser's Basic-Auth header
// (no secret prompt). PATCH re-runs the 8-gate validator when the article
// changes. DELETE drops the draft from KV — the repo is never touched.

import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/news-review/auth";
import { updateDraft, deleteDraft } from "@/lib/news-review/storage";
import type { DraftArticle, NewsDraft } from "@/lib/news-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id } = await params;
  let body: {
    article?: DraftArticle;
    reviewNote?: string;
    verifiedSources?: string[];
    provenance?: NewsDraft["provenance"];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateDraft>[1] = {};
  if (body.article) patch.article = body.article;
  if (typeof body.reviewNote === "string") patch.reviewNote = body.reviewNote;
  if (Array.isArray(body.verifiedSources)) patch.verifiedSources = body.verifiedSources;
  if (body.provenance) patch.provenance = body.provenance;

  const draft = await updateDraft(id, patch);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ ok: true, draft });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id } = await params;
  const ok = await deleteDraft(id);
  if (!ok) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
