// Queue item actions — approve / skip / edit / postpone / mark-posted / delete.
//
// Called by the dashboard buttons + can also be hit directly via curl.
//
// Usage:
//   POST /api/queue/action/<id>?secret=<POST_PUBLISH_SECRET>
//   body: { action: "approve" | "skip" | "edit" | "postpone" | "mark-posted" | "delete",
//           draftText?: string,   // required for "edit"
//           editNote?: string,    // optional for "edit"
//           postedUrl?: string }  // optional for "mark-posted"

import { NextRequest, NextResponse } from "next/server";
import { getItem, updateItem, deleteItem } from "@/lib/queue/storage";
import type { QueueAction, QueueItem, QueueChannel } from "@/lib/queue/types";
import { calculateExpiresAt } from "@/lib/queue/types";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

const VALID_ACTIONS: QueueAction[] = [
  "approve",
  "skip",
  "edit",
  "postpone",
  "mark-posted",
  "delete",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SECRET) {
    return NextResponse.json(
      { error: "POST_PUBLISH_SECRET env var not set — endpoint disabled" },
      { status: 503 }
    );
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing item ID" }, { status: 400 });
  }

  let body: {
    action?: unknown;
    draftText?: unknown;
    editNote?: unknown;
    postedUrl?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as QueueAction;
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const item = await getItem(id);
  if (!item) {
    return NextResponse.json({ error: `Item ${id} not found` }, { status: 404 });
  }

  const now = new Date().toISOString();
  let patch: Partial<QueueItem> = { actedAt: now };

  switch (action) {
    case "approve":
      patch.status = "approved";
      break;

    case "skip":
      patch.status = "skipped";
      break;

    case "edit": {
      if (typeof body.draftText !== "string" || !body.draftText.trim()) {
        return NextResponse.json(
          { error: "edit action requires non-empty draftText" },
          { status: 400 }
        );
      }
      patch.status = "edited";
      patch.draftText = body.draftText;
      if (typeof body.editNote === "string") patch.editNote = body.editNote;
      break;
    }

    case "postpone": {
      // Reset expiry to channel-default-from-now (gives full SLA again)
      patch.expiresAt = calculateExpiresAt(item.channel as QueueChannel, new Date());
      patch.status = "pending"; // stay in queue
      break;
    }

    case "mark-posted":
      patch.status = "posted";
      patch.postedAt = now;
      if (typeof body.postedUrl === "string") patch.postedUrl = body.postedUrl;
      break;

    case "delete": {
      const deleted = await deleteItem(id);
      if (!deleted) {
        return NextResponse.json({ error: "Delete failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, action: "delete", id, timestamp: now });
    }
  }

  const updated = await updateItem(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action,
    id,
    item: updated,
    timestamp: now,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) {
    return NextResponse.json({ error: `Item ${id} not found` }, { status: 404 });
  }
  return NextResponse.json(item);
}
