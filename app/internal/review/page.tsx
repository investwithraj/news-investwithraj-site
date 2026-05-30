// "The Desk" — the editorial review cockpit.
//
// Auth-gated by proxy.ts (INTERNAL_BASIC_AUTH). Server component: reads the
// staged drafts from KV + computes the instrument-row stats, hands them to the
// cinematic client. Composed from the v16 component library so it reads as a
// sibling of the public news site, not an admin panel.

import { getAllDrafts, getStorageBackend } from "@/lib/news-review/storage";
import { NEWS_ARTICLES } from "@/content/news";
import ReviewDesk from "./ReviewDesk";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "The Desk — editorial review",
  robots: { index: false, follow: false },
};

export default async function ReviewPage() {
  const drafts = await getAllDrafts();
  const backend = getStorageBackend();

  // Real published-cadence stats from the live registry.
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const live = NEWS_ARTICLES.filter((a) => a.status !== "research");
  const publishedToday = live.filter(
    (a) => now - new Date(a.publishedAt).getTime() < dayMs,
  ).length;
  const publishedThisWeek = live.filter(
    (a) => now - new Date(a.publishedAt).getTime() < 7 * dayMs,
  ).length;

  // Avg validator confidence across drafts (share of the 8 gates passing).
  const avgConfidence =
    drafts.length === 0
      ? 0
      : Math.round(
          (drafts.reduce((sum, d) => {
            const failedGates = new Set(
              d.validator.failures
                .filter((f) => f.severity === "block")
                .map((f) => f.gate),
            ).size;
            return sum + (8 - failedGates) / 8;
          }, 0) /
            drafts.length) *
            100,
        );

  // The browser scopes its Basic-Auth creds to /internal/* (where proxy.ts
  // challenged it), so the cockpit's fetches to /api/news/draft/* arrive
  // unauthenticated → 401. Pass the action secret down so the client appends
  // ?secret=; only authenticated operators ever render this page.
  return (
    <ReviewDesk
      drafts={drafts}
      backend={backend}
      stats={{ awaiting: drafts.length, publishedToday, publishedThisWeek, avgConfidence }}
      actionSecret={process.env.POST_PUBLISH_SECRET ?? ""}
    />
  );
}
