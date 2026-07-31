// HttpOnly review-session capability shared by proxy.ts and review APIs.
//
// After Basic Auth succeeds on /internal/*, proxy.ts mints this signed cookie
// for the review and queue API namespace. POST_PUBLISH_SECRET never enters
// browser-rendered props, JavaScript, cookies, or URLs.

export const REVIEW_SESSION_COOKIE = "iwr_review_session";
export const REVIEW_SESSION_COOKIE_PATH = "/api";
export const REVIEW_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

interface ReviewSessionPayload {
  v: 1;
  aud: "news-review";
  iat: number;
  exp: number;
  nonce: string;
}

function sessionSecret(): string {
  const value = process.env.INTERNAL_SESSION_SECRET || "";
  return new TextEncoder().encode(value).byteLength >= 32 ? value : "";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function reviewSessionsConfigured(): boolean {
  return Boolean(sessionSecret());
}

export async function createReviewSession(now = Date.now()): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;

  const payload: ReviewSessionPayload = {
    v: 1,
    aud: "news-review",
    iat: now,
    exp: now + REVIEW_SESSION_MAX_AGE_SECONDS * 1_000,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await hmacKey(secret),
      new TextEncoder().encode(encodedPayload),
    ),
  );
  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export async function verifyReviewSession(
  token: string,
  now = Date.now(),
): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret || !token || token.length > 2_048) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encodedPayload, encodedSignature] = parts;
  const payloadBytes = base64UrlToBytes(encodedPayload);
  const signatureBytes = base64UrlToBytes(encodedSignature);
  if (!payloadBytes || !signatureBytes) return false;

  const authentic = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    new Uint8Array(signatureBytes).buffer,
    new TextEncoder().encode(encodedPayload),
  );
  if (!authentic) return false;

  let payload: ReviewSessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as ReviewSessionPayload;
  } catch {
    return false;
  }

  return (
    payload.v === 1 &&
    payload.aud === "news-review" &&
    Number.isSafeInteger(payload.iat) &&
    Number.isSafeInteger(payload.exp) &&
    typeof payload.nonce === "string" &&
    payload.nonce.length >= 16 &&
    payload.iat <= now + 60_000 &&
    payload.exp > now &&
    payload.exp - payload.iat === REVIEW_SESSION_MAX_AGE_SECONDS * 1_000
  );
}
