// Auth guard for the /api/news/draft* routes.
//
// Two accepted credentials — whichever fits the caller:
//   • Basic-Auth header matching INTERNAL_BASIC_AUTH — the review cockpit. The
//     browser already holds these creds (the user authed on /internal via
//     proxy.ts) and sends them automatically on same-origin fetches, so the
//     cockpit needs NO secret prompt.
//   • ?secret=POST_PUBLISH_SECRET — the cron / pipeline (server-to-server),
//     which can't do interactive Basic-Auth.
//
// Returns { ok } or { ok:false, status, message } so the route can early-return.

import type { NextRequest } from "next/server";

const INTERNAL_BASIC_AUTH = process.env.INTERNAL_BASIC_AUTH || "";
const POST_PUBLISH_SECRET = process.env.POST_PUBLISH_SECRET || "";

export interface AuthResult {
  ok: boolean;
  status?: number;
  message?: string;
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function basicAuthOk(req: NextRequest): boolean {
  if (!INTERNAL_BASIC_AUTH) return false;
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  return timingSafeEq(decoded, INTERNAL_BASIC_AUTH);
}

function secretOk(req: NextRequest): boolean {
  if (!POST_PUBLISH_SECRET) return false;
  const provided =
    req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-post-publish-secret") ?? "";
  return timingSafeEq(provided, POST_PUBLISH_SECRET);
}

/** Allow if either credential validates. */
export function authorize(req: NextRequest): AuthResult {
  if (!INTERNAL_BASIC_AUTH && !POST_PUBLISH_SECRET) {
    return {
      ok: false,
      status: 503,
      message: "Review API disabled — set INTERNAL_BASIC_AUTH or POST_PUBLISH_SECRET.",
    };
  }
  if (basicAuthOk(req) || secretOk(req)) return { ok: true };
  return { ok: false, status: 401, message: "Unauthorized" };
}
