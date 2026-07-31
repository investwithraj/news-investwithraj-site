// Authenticated queue item reads and mutations.
//
// Browser mutations require the signed HttpOnly internal session plus a
// same-origin request. Pipeline callers can use x-post-publish-secret.

import { NextRequest, NextResponse } from "next/server";

import { authorize, authorizeMutation } from "@/lib/news-review/auth";
import {
  deleteItem,
  getItem,
  QueueMutationConflictError,
  updateItem,
} from "@/lib/queue/storage";
import { readJsonBody } from "@/lib/security/mutation";
import {
  calculateExpiresAt,
  type QueueAction,
  type QueueChannel,
  type QueueItem,
} from "@/lib/queue/types";

export const dynamic = "force-dynamic";

const VALID_ACTIONS: QueueAction[] = [
  "approve",
  "skip",
  "edit",
  "postpone",
  "mark-posted",
  "delete",
];

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function validId(value: string): boolean {
  return value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}

function cleanPostedUrl(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authorizeMutation(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);

  const { id } = await params;
  if (!validId(id)) return privateJson({ error: "Invalid item ID." }, 400);

  const parsed = await readJsonBody<{
    action?: unknown;
    expectedRecordVersion?: unknown;
    draftText?: unknown;
    editNote?: unknown;
    postedUrl?: unknown;
  }>(request, { maxBytes: 24_576 });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return privateJson({ error: "The JSON body must be an object." }, 400);
  }

  const action =
    typeof body.action === "string" &&
    VALID_ACTIONS.includes(body.action as QueueAction)
      ? (body.action as QueueAction)
      : null;
  if (!action) {
    return privateJson(
      { error: `action must be one of: ${VALID_ACTIONS.join(", ")}.` },
      400,
    );
  }
  if (
    !Number.isSafeInteger(body.expectedRecordVersion) ||
    Number(body.expectedRecordVersion) < 1
  ) {
    return privateJson(
      { error: "A positive expectedRecordVersion is required." },
      400,
    );
  }
  const expectedRecordVersion = Number(body.expectedRecordVersion);

  try {
    const item = await getItem(id);
    if (!item) return privateJson({ error: "Queue item not found." }, 404);

    const now = new Date().toISOString();
    const patch: Partial<QueueItem> = { actedAt: now };

    switch (action) {
      case "approve":
        patch.status = "approved";
        break;
      case "skip":
        patch.status = "skipped";
        break;
      case "edit": {
        if (
          typeof body.draftText !== "string" ||
          !body.draftText.trim() ||
          body.draftText.length > 20_000
        ) {
          return privateJson(
            { error: "edit requires draftText between 1 and 20,000 characters." },
            400,
          );
        }
        if (
          body.editNote !== undefined &&
          (typeof body.editNote !== "string" || body.editNote.length > 2_000)
        ) {
          return privateJson(
            { error: "editNote must not exceed 2,000 characters." },
            400,
          );
        }
        patch.status = "edited";
        patch.draftText = body.draftText.trim();
        if (typeof body.editNote === "string") {
          patch.editNote = body.editNote.trim();
        }
        break;
      }
      case "postpone":
        patch.expiresAt = calculateExpiresAt(
          item.channel as QueueChannel,
          new Date(),
        );
        patch.status = "pending";
        break;
      case "mark-posted": {
        const postedUrl = cleanPostedUrl(body.postedUrl);
        if (postedUrl === null) {
          return privateJson(
            { error: "postedUrl must be a valid HTTP(S) URL." },
            400,
          );
        }
        patch.status = "posted";
        patch.postedAt = now;
        if (postedUrl) patch.postedUrl = postedUrl;
        break;
      }
      case "delete": {
        const deleted = await deleteItem(id, expectedRecordVersion);
        if (!deleted) return privateJson({ error: "Delete failed." }, 500);
        return privateJson({ ok: true, action, id, timestamp: now });
      }
    }

    const updated = await updateItem(id, expectedRecordVersion, patch);
    if (!updated) return privateJson({ error: "Update failed." }, 500);
    return privateJson({ ok: true, action, id, item: updated, timestamp: now });
  } catch (error) {
    if (error instanceof QueueMutationConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    return privateJson({ error: "Queue storage is unavailable." }, 503);
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authorize(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);

  const { id } = await params;
  if (!validId(id)) return privateJson({ error: "Invalid item ID." }, 400);

  try {
    const item = await getItem(id);
    if (!item) return privateJson({ error: "Queue item not found." }, 404);
    return privateJson({ ok: true, item });
  } catch {
    return privateJson({ error: "Queue storage is unavailable." }, 503);
  }
}
