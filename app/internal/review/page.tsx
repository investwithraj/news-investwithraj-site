// "The Desk" — the editorial review cockpit.
//
// Auth-gated by proxy.ts (strong split dashboard credentials). Server component: reads the
// staged drafts from KV + computes the instrument-row stats, hands them to the
// cinematic client. Composed from the v16 component library so it reads as a
// sibling of the public news site, not an admin panel.

import { getAllDrafts, getStorageBackend } from "@/lib/news-review/storage";
import { NEWS_ARTICLES } from "@/content/news";
import type { NewsDraft } from "@/lib/news-review/types";
import ReviewDesk from "./ReviewDesk";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "The Desk — editorial review",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function ReviewPage() {
  const backend = getStorageBackend();
  // Dynamic internal page: cadence is intentionally calculated at request-time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const live = NEWS_ARTICLES.filter((article) => article.status !== "research");
  const publishedToday = live.filter(
    (article) => now - new Date(article.publishedAt).getTime() < dayMs,
  ).length;
  const publishedThisWeek = live.filter(
    (article) => now - new Date(article.publishedAt).getTime() < 7 * dayMs,
  ).length;

  let drafts: NewsDraft[] = [];
  let avgConfidence = 0;
  let error: string | undefined;

  try {
    drafts = await getAllDrafts();
    avgConfidence =
      drafts.length === 0
        ? 0
        : Math.round(
            (drafts.reduce((sum, draft) => {
              const failedGates = new Set(
                draft.validator.failures
                  .filter((failure) => failure.severity === "block")
                  .map((failure) => failure.gate),
              ).size;
              return sum + (8 - failedGates) / 8;
            }, 0) /
              drafts.length) *
              100,
          );
  } catch {
    drafts = [];
    avgConfidence = 0;
    error =
      "The draft store could not be read. No draft or empty state is being inferred, and publishing actions are disabled.";
  }

  return (
    <ReviewDesk
      drafts={drafts}
      backend={backend}
      stats={{
        awaiting: drafts.length,
        publishedToday,
        publishedThisWeek,
        avgConfidence,
      }}
      error={error}
    />
  );
}
