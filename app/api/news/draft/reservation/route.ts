import { NextRequest } from "next/server";

import { authorizeMutation } from "@/lib/news-review/auth";
import {
  DraftConflictError,
  failDraftCluster,
  reserveDraftCluster,
} from "@/lib/news-review/storage";
import { privateJson, readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authorizeMutation(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);
  if (auth.credential !== "server-secret") {
    return privateJson(
      { error: "Cluster reservations are available only to server automation." },
      403,
    );
  }
  const parsed = await readJsonBody<{
    action?: unknown;
    clusterId?: unknown;
    topic?: unknown;
    token?: unknown;
    result?: unknown;
  }>(request, { maxBytes: 8_192 });
  if (!parsed.ok) return parsed.response;
  const { action, clusterId, topic, token, result } = parsed.value;
  if (
    typeof clusterId !== "string" ||
    !/^[A-Za-z0-9:_-]{1,256}$/.test(clusterId)
  ) {
    return privateJson({ error: "clusterId is invalid." }, 400);
  }

  try {
    if (action === "reserve") {
      if (
        typeof topic !== "string" ||
        !topic.trim() ||
        topic.length > 500
      ) {
        return privateJson({ error: "topic is invalid." }, 400);
      }
      const reservation = await reserveDraftCluster(clusterId, topic);
      return privateJson(
        {
          ok: reservation.acquired,
          acquired: reservation.acquired,
          reservation: reservation.reservation,
        },
        reservation.acquired ? 201 : 409,
      );
    }
    if (action === "fail") {
      if (
        typeof token !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(token) ||
        typeof result !== "string" ||
        !result.trim() ||
        result.length > 500
      ) {
        return privateJson(
          { error: "A valid token and bounded failure result are required." },
          400,
        );
      }
      await failDraftCluster(clusterId, token, result);
      return privateJson({ ok: true, state: "failed" });
    }
    return privateJson({ error: "action must be reserve or fail." }, 400);
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    return privateJson({ error: "Reservation storage is unavailable." }, 503);
  }
}
