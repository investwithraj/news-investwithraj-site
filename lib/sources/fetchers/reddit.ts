// Reddit fetcher — free JSON API (no auth). Surfaces emerging stories +
// on-the-ground sentiment from r/dubai, r/dubairealestate, r/UAE. Discovery
// only (citable:false) — the drafter verifies anything it uses via web search.
//
// Reddit rate-limits default user-agents hard, so we send a descriptive one.

import type { RawEntry, FetchResult } from "./types";
import type { VerifiedSource } from "@/lib/sources/registry";

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "web:news.investwithraj.com:v1.0 (by /u/investwithraj news discovery)";

interface RedditChild {
  data?: {
    title?: string;
    selftext?: string;
    permalink?: string;
    url?: string;
    created_utc?: number;
    stickied?: boolean;
    over_18?: boolean;
    subreddit?: string;
  };
}

export async function fetchReddit(
  source: VerifiedSource,
  limit = 15,
): Promise<FetchResult> {
  const t0 = performance.now();
  const jsonUrl = source.rssUrl; // we stash the search/new .json URL here
  if (!jsonUrl) {
    return { source, entries: [], error: "No reddit JSON url configured", durationMs: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(jsonUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        source,
        entries: [],
        error: `HTTP ${res.status} from reddit`,
        durationMs: performance.now() - t0,
      };
    }

    const json = (await res.json()) as { data?: { children?: RedditChild[] } };
    const children = json.data?.children ?? [];
    const entries: RawEntry[] = [];

    for (const c of children.slice(0, limit)) {
      const d = c.data;
      if (!d?.title || d.stickied || d.over_18) continue;
      const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : d.url ?? "";
      if (!permalink) continue;
      const body = (d.selftext ?? "").replace(/\s+/g, " ").trim();
      entries.push({
        id: permalink,
        title: d.title,
        url: permalink,
        publishedAt: d.created_utc
          ? new Date(d.created_utc * 1000).toISOString()
          : new Date().toISOString(),
        summary: (body || `Discussion in r/${d.subreddit ?? "dubai"}`).slice(0, 600),
        source: { name: source.name, tier: source.tier, domain: "reddit.com" },
      });
    }

    return { source, entries, error: null, durationMs: performance.now() - t0 };
  } catch (e) {
    clearTimeout(timeout);
    return {
      source,
      entries: [],
      error: e instanceof Error ? e.message : "Unknown Reddit error",
      durationMs: performance.now() - t0,
    };
  }
}
