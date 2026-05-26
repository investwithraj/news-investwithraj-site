// IndexNow key file — required at site root by the IndexNow spec for
// ownership verification. Filename MUST equal the key value (32 hex chars).
//
// IndexNow servers fetch this file when we submit URLs to verify we
// actually own the host claiming the key.
//
// If we ever rotate the key, this file's path AND the constant in
// lib/search/indexnow.ts both have to change. Vercel deploys atomic, so
// rotation should be safe.

import { INDEXNOW_KEY } from "@/lib/search/indexnow";

export const dynamic = "force-static";
export const revalidate = false; // never re-validate — this is a constant

export function GET(): Response {
  return new Response(INDEXNOW_KEY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
