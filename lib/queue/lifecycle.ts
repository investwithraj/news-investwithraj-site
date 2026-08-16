import { isApprovedPublicLifecycleArticleSlug } from "@/lib/news-lifecycle";
import type { QueueItem } from "@/lib/queue/types";

type QueueLifecycleFields = Partial<
  Pick<
    QueueItem,
    | "target"
    | "draftText"
    | "rationale"
    | "responseToUrl"
    | "sourceArticleSlug"
    | "editNote"
    | "postedUrl"
  >
>;

export type QueueLifecycleValidation = Readonly<{
  ok: boolean;
  referencedArticleSlugs: readonly string[];
  rejectedArticleSlugs: readonly string[];
  malformedNewsroomReference: boolean;
}>;

const NEWSROOM_ORIGIN = "https://news.investwithraj.com";
const NEWSROOM_HOSTS = new Set([
  "news.investwithraj.com",
  "www.news.investwithraj.com",
]);
const ARTICLE_SLUG = /^[a-z0-9-]{1,180}$/;

/**
 * Finds canonical, www, scheme-relative, bare-host and relative newsroom
 * article references embedded in queue copy. External hosts are deliberately
 * ignored, even when their path happens to begin with /news/.
 */
export function extractQueueNewsroomArticleSlugs(
  value: string,
): string[] {
  return inspectQueueNewsroomArticleReferences(value).slugs;
}

function inspectQueueNewsroomArticleReferences(value: string): {
  slugs: string[];
  malformed: boolean;
} {
  const candidates: string[] = [];
  const hostedPattern =
    /(^|[^\p{L}\p{N}_.-])((?:(?:https?:)?\/\/)?(?:www\.)?news\.investwithraj\.com(?::\d{1,5})?\/news\/[^\s<>"'`)\]}]+)/gimu;
  const relativePattern =
    /(^|[\s("'`=\[{},>:])(\/news\/[^\s<>"'`)\]}]+)/gimu;

  for (const match of value.matchAll(hostedPattern)) {
    if (match[2]) candidates.push(match[2]);
  }
  for (const match of value.matchAll(relativePattern)) {
    if (match[2]) candidates.push(match[2]);
  }

  const slugs = new Set<string>();
  let malformed = false;
  for (const candidate of candidates) {
    const slug = articleSlugFromCandidate(candidate);
    if (slug) {
      slugs.add(slug);
    } else {
      malformed = true;
    }
  }
  return { slugs: [...slugs], malformed };
}

/**
 * Queue content may mention only lifecycle-approved public newsroom articles.
 * This invariant is intentionally independent of the cutover flag: turning
 * redirects/removals off must never re-enable retired content for outreach.
 */
export function validateQueueLifecycleFields(
  fields: QueueLifecycleFields,
): QueueLifecycleValidation {
  const referenced = new Set<string>();
  let malformedNewsroomReference = false;
  for (const value of [
    fields.target,
    fields.draftText,
    fields.rationale,
    fields.responseToUrl,
    fields.editNote,
    fields.postedUrl,
  ]) {
    if (typeof value !== "string") continue;
    const inspection = inspectQueueNewsroomArticleReferences(value);
    malformedNewsroomReference ||= inspection.malformed;
    for (const slug of inspection.slugs) {
      referenced.add(slug);
    }
  }

  const sourceArticleSlug = fields.sourceArticleSlug?.trim();
  if (sourceArticleSlug) referenced.add(sourceArticleSlug);

  const referencedArticleSlugs = [...referenced].sort();
  const rejectedArticleSlugs = referencedArticleSlugs.filter(
    (slug) => !isApprovedPublicLifecycleArticleSlug(slug),
  );
  return {
    ok:
      !malformedNewsroomReference && rejectedArticleSlugs.length === 0,
    referencedArticleSlugs,
    rejectedArticleSlugs,
    malformedNewsroomReference,
  };
}

function articleSlugFromCandidate(candidate: string): string | null {
  try {
    const trimmed = candidate.replace(/[.,;:!?]+$/g, "");
    const absolute = trimmed.startsWith("/news/")
      ? new URL(trimmed, NEWSROOM_ORIGIN)
      : new URL(
          trimmed.startsWith("//")
            ? `https:${trimmed}`
            : /^https?:\/\//i.test(trimmed)
              ? trimmed
              : `https://${trimmed}`,
        );
    if (!NEWSROOM_HOSTS.has(absolute.hostname.toLowerCase())) {
      return null;
    }
    const [root, collection, slug] = absolute.pathname.split("/");
    if (
      root !== "" ||
      collection !== "news" ||
      !slug ||
      !ARTICLE_SLUG.test(slug)
    ) {
      return null;
    }
    return slug;
  } catch {
    return null;
  }
}
