/** Owner-requested retirement: no authentication, provider calls or data writes. */
export const RETIRED_REVIEW_ROOTS = [
  "/internal/review",
  "/api/news/draft",
  "/api/news/correction",
  "/api/cron/draft",
  "/api/cron/news-watchdog",
] as const;

export function isRetiredReviewPath(pathname: string): boolean {
  return RETIRED_REVIEW_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(root + "/"),
  );
}

/** Tombstone all methods, including requests with legacy valid credentials. */
export function retiredReviewResponse(request: Request, _context?: unknown): Response {
  const api = new URL(request.url).pathname.startsWith("/api/");
  const body = api
    ? JSON.stringify({ error: "This newsroom review workflow has been retired.", code: "REVIEW_DESK_RETIRED" })
    : "The newsroom review desk has been retired. News is prepared through the IWR chat workflow.\n";
  return new Response(request.method === "HEAD" ? null : body, {
    status: 410,
    headers: {
      "Content-Type": api ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
