import type { NextRequest } from "next/server";

import { authorize } from "@/lib/news-review/auth";
import {
  getArchivedPublicationDraft,
  getPublicationReceipt,
} from "@/lib/news-review/storage";
import { privateJson } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Read-only durable completion proof for an idempotent automation replay. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authorize(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);
  if (auth.credential !== "server-secret") {
    return privateJson(
      { error: "Publication receipts are available only to server automation." },
      403,
    );
  }

  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    return privateJson({ error: "Invalid draft ID." }, 400);
  }
  try {
    const [receipt, draft] = await Promise.all([
      getPublicationReceipt(id),
      getArchivedPublicationDraft(id),
    ]);
    if (!receipt || !draft) {
      return privateJson({ error: "Completed publication proof not found." }, 404);
    }
    return privateJson({ ok: true, receipt, draft });
  } catch {
    return privateJson({ error: "Publication proof is unavailable." }, 503);
  }
}
