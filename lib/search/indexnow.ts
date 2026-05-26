// IndexNow protocol client.
// IndexNow is a free, open protocol jointly run by Bing + Yandex + Yep
// + Seznam + Naver + IndexNow.org. One POST submits URLs to all
// participating engines simultaneously. No API key required beyond
// the per-site key (verified via a key file at site root).
//
// Spec: https://www.indexnow.org/documentation
//
// Engines fanned out to:
//   - Bing (USA + global)
//   - Yandex (Russia + ex-USSR)
//   - Yep (DuckDuckGo + Brave Search)
//   - Seznam (Czech Republic)
//   - Naver (South Korea)
//   - IndexNow.org central
//
// Why this matters for the news firehose: a freshly committed article
// goes from "pushed to GitHub" → "indexed in Bing + 4 other engines" in
// under 60 seconds. That's the difference between an article showing up
// in SERP today vs in 2-3 days.

import { SITE } from "@/lib/constants";

/** The IndexNow API host — using bing.com is the recommended primary
 *  endpoint (any participating engine forwards to the rest). */
const INDEXNOW_HOST = "https://api.indexnow.org/IndexNow";

/** Per-site key — must match the contents of /<key>.txt at site root */
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "0d6e3835646ccbe5dba5ed6ab2646308";

export interface IndexNowResult {
  ok: boolean;
  statusCode: number;
  message: string;
  submittedUrls: number;
}

/**
 * Submit one or more URLs to IndexNow. All URLs must be on the same host
 * (the host that owns the key file).
 *
 * @param urls   Absolute URLs to submit (https://news.investwithraj.com/news/...)
 *               Max 10,000 per request per spec.
 */
export async function submitToIndexNow(
  urls: string[]
): Promise<IndexNowResult> {
  if (urls.length === 0) {
    return { ok: true, statusCode: 200, message: "No URLs to submit", submittedUrls: 0 };
  }
  if (urls.length > 10_000) {
    return {
      ok: false,
      statusCode: 400,
      message: "IndexNow allows max 10,000 URLs per request",
      submittedUrls: 0,
    };
  }

  // Validate all URLs are on the same host
  const host = new URL(SITE.url).host;
  const offHost = urls.filter((u) => {
    try {
      return new URL(u).host !== host;
    } catch {
      return true;
    }
  });
  if (offHost.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      message: `URLs must be on host ${host}. Off-host: ${offHost.slice(0, 3).join(", ")}`,
      submittedUrls: 0,
    };
  }

  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE.url}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  try {
    const res = await fetch(INDEXNOW_HOST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    // IndexNow returns:
    //   200 OK     — submitted successfully
    //   202 Accepted — submitted, processing
    //   400 Bad Request — malformed body
    //   403 Forbidden  — key not valid (key file missing/wrong)
    //   422 Unprocessable — URLs invalid
    //   429 Too Many Requests — rate limited
    return {
      ok: res.ok || res.status === 202,
      statusCode: res.status,
      message:
        res.status === 200
          ? "Submitted successfully"
          : res.status === 202
            ? "Accepted, processing"
            : `IndexNow returned ${res.status}: ${res.statusText}`,
      submittedUrls: urls.length,
    };
  } catch (e) {
    return {
      ok: false,
      statusCode: 0,
      message: e instanceof Error ? e.message : "Unknown IndexNow error",
      submittedUrls: 0,
    };
  }
}
