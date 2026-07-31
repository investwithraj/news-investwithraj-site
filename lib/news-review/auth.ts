// Auth guard for /api/news/draft*.
//
// Browser review actions use a signed HttpOnly session minted by proxy.ts
// after /internal Basic Auth succeeds. CI/pipeline callers use
// POST_PUBLISH_SECRET in x-post-publish-secret. Query-string credentials are
// deliberately rejected so secrets do not enter URLs, logs, or referrers.

import type { NextRequest } from "next/server";
import {
  REVIEW_SESSION_COOKIE,
  verifyReviewSession,
} from "@/lib/news-review/session";

export interface AuthResult {
  ok: boolean;
  status?: number;
  message?: string;
  credential?: "server-secret" | "review-session";
}

const QUERY_CREDENTIAL_KEYS = [
  "secret",
  "token",
  "api_key",
  "key",
  "post_publish_secret",
] as const;

function strongSecret(value: string | undefined): boolean {
  return new TextEncoder().encode(value ?? "").byteLength >= 32;
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function queryCredentialPresent(req: NextRequest): boolean {
  const forbidden = new Set<string>(QUERY_CREDENTIAL_KEYS);
  return [...req.nextUrl.searchParams.keys()].some((key) =>
    forbidden.has(key.toLowerCase()),
  );
}

function serverSecretState(req: NextRequest): "absent" | "valid" | "invalid" {
  const expected = process.env.POST_PUBLISH_SECRET || "";
  const provided = req.headers.get("x-post-publish-secret");
  if (provided === null) return "absent";
  if (!strongSecret(expected)) return "invalid";
  return timingSafeEq(provided, expected) ? "valid" : "invalid";
}

async function sessionOk(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(REVIEW_SESSION_COOKIE)?.value ?? "";
  return verifyReviewSession(token);
}

export async function authorize(req: NextRequest): Promise<AuthResult> {
  if (queryCredentialPresent(req)) {
    return {
      ok: false,
      status: 400,
      message:
        "Credentials in URLs are rejected. Use the signed internal session or x-post-publish-secret header.",
    };
  }

  if (
    !strongSecret(process.env.INTERNAL_SESSION_SECRET) &&
    !strongSecret(process.env.POST_PUBLISH_SECRET)
  ) {
    return {
      ok: false,
      status: 503,
      message:
        "Review API disabled — set INTERNAL_SESSION_SECRET or POST_PUBLISH_SECRET.",
    };
  }

  const serverSecret = serverSecretState(req);
  if (serverSecret === "valid") {
    return { ok: true, credential: "server-secret" };
  }
  if (serverSecret === "invalid") {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  if (await sessionOk(req)) {
    return { ok: true, credential: "review-session" };
  }
  return { ok: false, status: 401, message: "Unauthorized" };
}

function sameOriginMutation(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return false;
  const fetchSite = req.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin";
}

/**
 * Mutation guard with CSRF enforcement for browser sessions.
 *
 * Authenticated CI/pipeline calls are exempt because possession of the
 * server-only header is the request credential and those callers have no
 * browser cookie to protect.
 */
export async function authorizeMutation(req: NextRequest): Promise<AuthResult> {
  if (queryCredentialPresent(req)) {
    return {
      ok: false,
      status: 400,
      message:
        "Credentials in URLs are rejected. Use the signed internal session or x-post-publish-secret header.",
    };
  }

  if (
    !strongSecret(process.env.INTERNAL_SESSION_SECRET) &&
    !strongSecret(process.env.POST_PUBLISH_SECRET)
  ) {
    return {
      ok: false,
      status: 503,
      message:
        "Review API disabled — set INTERNAL_SESSION_SECRET or POST_PUBLISH_SECRET.",
    };
  }
  const serverSecret = serverSecretState(req);
  if (serverSecret === "valid") {
    return { ok: true, credential: "server-secret" };
  }
  if (serverSecret === "invalid") {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  if (!(await sessionOk(req))) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  if (!sameOriginMutation(req)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: true, credential: "review-session" };
}
