import { NextRequest, NextResponse } from "next/server";

const QUERY_CREDENTIAL_KEYS = [
  "secret",
  "token",
  "api_key",
  "key",
  "post_publish_secret",
] as const;

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export type MutationAuthResult =
  | { ok: true; credential: "post-publish" | "cron" }
  | { ok: false; response: NextResponse };

export type JsonBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: NextResponse };

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

export function privateJson(
  payload: unknown,
  status = 200,
  headers: HeadersInit = {},
): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      ...PRIVATE_HEADERS,
      ...Object.fromEntries(new Headers(headers).entries()),
    },
  });
}

export function publicStatusJson(
  payload: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function queryCredentialPresent(request: NextRequest): boolean {
  const forbidden = new Set<string>(QUERY_CREDENTIAL_KEYS);
  return [...request.nextUrl.searchParams.keys()].some((key) =>
    forbidden.has(key.toLowerCase()),
  );
}

/** Reject credentials in a public status URL without authenticating it. */
export function rejectUrlCredentials(
  request: NextRequest,
): NextResponse | null {
  return queryCredentialPresent(request)
    ? privateJson(
        {
          error:
            "Credentials in URLs are rejected. Use the documented server request header for mutations.",
        },
        400,
      )
    : null;
}

function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const allowed = new Set([
    request.nextUrl.origin,
    "https://news.investwithraj.com",
    "https://investwithraj.com",
  ]);
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
    } catch {
      return false;
    }
  }
  return allowed.has(origin);
}

/**
 * Authenticate a server-to-server mutation.
 *
 * Browser URLs never carry credentials. CI uses x-post-publish-secret and
 * Vercel Cron may use Authorization: Bearer <CRON_SECRET>.
 */
export function authorizeServerMutation(
  request: NextRequest,
  options: { allowCronBearer?: boolean } = {},
): MutationAuthResult {
  if (queryCredentialPresent(request)) {
    return {
      ok: false,
      response: privateJson(
        {
          error:
            "Credentials in URLs are rejected. Use the documented server request header.",
        },
        400,
      ),
    };
  }

  if (!originAllowed(request)) {
    return {
      ok: false,
      response: privateJson({ error: "Forbidden origin." }, 403),
    };
  }

  const postSecret = process.env.POST_PUBLISH_SECRET ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  const postConfigured = byteLength(postSecret) >= 32;
  const cronConfigured =
    options.allowCronBearer === true && byteLength(cronSecret) >= 32;

  if (!postConfigured && !cronConfigured) {
    return {
      ok: false,
      response: privateJson(
        {
          error:
            "Server mutation disabled because no valid 32-byte credential is configured.",
        },
        503,
      ),
    };
  }

  const postProvided = request.headers.get("x-post-publish-secret") ?? "";
  if (
    postConfigured &&
    postProvided &&
    timingSafeEqual(postProvided, postSecret)
  ) {
    return { ok: true, credential: "post-publish" };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerPrefix = "Bearer ";
  const bearer = authorization.startsWith(bearerPrefix)
    ? authorization.slice(bearerPrefix.length)
    : "";
  if (cronConfigured && bearer && timingSafeEqual(bearer, cronSecret)) {
    return { ok: true, credential: "cron" };
  }

  return {
    ok: false,
    response: privateJson({ error: "Unauthorized." }, 401),
  };
}

export async function readJsonBody<T>(
  request: NextRequest,
  options: { maxBytes?: number; allowEmpty?: boolean } = {},
): Promise<JsonBodyResult<T>> {
  const maxBytes = options.maxBytes ?? 32_768;
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      ok: false,
      response: privateJson({ error: "Request body is too large." }, 413),
    };
  }

  let raw = "";
  try {
    if (request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return {
            ok: false,
            response: privateJson({ error: "Request body is too large." }, 413),
          };
        }
        chunks.push(value);
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      raw = new TextDecoder().decode(merged);
    }
  } catch {
    return {
      ok: false,
      response: privateJson({ error: "Unable to read request body." }, 400),
    };
  }

  if (byteLength(raw) > maxBytes) {
    return {
      ok: false,
      response: privateJson({ error: "Request body is too large." }, 413),
    };
  }
  if (!raw.trim()) {
    if (options.allowEmpty) return { ok: true, value: {} as T };
    return {
      ok: false,
      response: privateJson({ error: "A JSON request body is required." }, 400),
    };
  }

  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return {
      ok: false,
      response: privateJson({ error: "Invalid JSON request body." }, 400),
    };
  }
}

export function normalizeOwnedUrls(
  values: unknown[],
  options: { max?: number; origin?: string } = {},
): string[] {
  const origin =
    options.origin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://news.investwithraj.com";
  const allowedOrigin = new URL(origin).origin;
  const output = new Set<string>();

  for (const value of values.slice(0, options.max ?? 1_000)) {
    if (typeof value !== "string") continue;
    try {
      const url = new URL(value);
      if (url.origin !== allowedOrigin) continue;
      if (url.username || url.password || url.hash) continue;
      url.search = "";
      output.add(url.toString());
    } catch {
      // Invalid and relative URLs are deliberately ignored.
    }
  }
  return [...output];
}
