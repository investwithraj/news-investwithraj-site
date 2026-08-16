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
  const candidates: Array<{
    value: string;
    kind: "absolute" | "bare-host" | "relative";
  }> = [];
  const absoluteRanges: Array<{ start: number; end: number }> = [];
  const absolutePattern = /(?:https?:[\\/]+|\/\/)[^\s<>"'`)\]}]+/gimu;
  for (const match of value.matchAll(absolutePattern)) {
    if (match.index === undefined) continue;
    candidates.push({ value: match[0], kind: "absolute" });
    absoluteRanges.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const residual = value.split("");
  for (const range of absoluteRanges) {
    residual.fill(" ", range.start, range.end);
  }
  const absoluteUnclaimed = residual.join("");
  const bareHostPattern =
    /(^|[^\p{L}\p{N}_.%-])((?:(?:[a-z0-9-]|%[0-9a-f]{2})+(?:\.|%2e))+(?:(?:[a-z]|%[0-9a-f]{2})){2,63}\.?(?::\d{1,5})?[\\/][^\s<>"'`)\]}]+)/gimu;
  for (const match of absoluteUnclaimed.matchAll(bareHostPattern)) {
    if (!match[2] || match.index === undefined) continue;
    const start = match.index + match[0].length - match[2].length;
    candidates.push({ value: match[2], kind: "bare-host" });
    residual.fill(" ", start, start + match[2].length);
  }

  const unclaimed = residual.join("");
  const relativePattern =
    /(^|[^\p{L}\p{N}_.%/\\-])([\\/][^\s<>"'`)\]}]+)/gimu;
  for (const match of unclaimed.matchAll(relativePattern)) {
    if (match[2]) candidates.push({ value: match[2], kind: "relative" });
  }

  const slugs = new Set<string>();
  let malformed = false;
  for (const candidate of candidates) {
    const result = inspectCandidate(candidate.value, candidate.kind);
    if (result.slug) slugs.add(result.slug);
    malformed ||= result.malformed;
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

function inspectCandidate(
  candidate: string,
  kind: "absolute" | "bare-host" | "relative",
): { slug?: string; malformed: boolean } {
  const trimmed = candidate.replace(/[.,;:!?]+$/g, "");
  const normalizedSlashes = trimmed.replaceAll("\\", "/");
  try {
    const urlInput =
      kind === "relative"
        ? normalizedSlashes
        : normalizedSlashes.startsWith("//")
          ? `https:${normalizedSlashes}`
          : /^https?:\//i.test(normalizedSlashes)
            ? normalizedSlashes
            : `https://${normalizedSlashes}`;
    const absolute =
      kind === "relative"
        ? new URL(urlInput, NEWSROOM_ORIGIN)
        : new URL(urlInput);
    const hostname = absolute.hostname.toLowerCase().replace(/\.$/, "");
    if (!NEWSROOM_HOSTS.has(hostname)) {
      return { malformed: false };
    }

    const pathname = normalizePathname(decodeURIComponent(absolute.pathname));
    const [, collection, slug] = pathname.split("/");
    if (collection?.toLowerCase() !== "news") {
      return { malformed: false };
    }
    if (collection !== "news" || !slug || !ARTICLE_SLUG.test(slug)) {
      return { malformed: true };
    }
    return { slug, malformed: false };
  } catch {
    return {
      malformed:
        kind === "relative"
          ? looksLikeNewsArticlePath(trimmed)
          : looksLikeNewsroomHost(trimmed),
    };
  }
}

function normalizePathname(pathname: string): string {
  const segments: string[] = [];
  for (const segment of pathname.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return `/${segments.join("/")}`;
}

function approximatelyDecode(value: string): string {
  return value.replace(/%([0-9a-f]{2})/gi, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function looksLikeNewsroomHost(value: string): boolean {
  const normalized = approximatelyDecode(value)
    .toLowerCase()
    .replaceAll("\\", "/");
  return [...NEWSROOM_HOSTS].some(
    (hostname) =>
      normalized.includes(`${hostname}/`) ||
      normalized.includes(`${hostname}./`),
  );
}

function looksLikeNewsArticlePath(value: string): boolean {
  const normalized = normalizePathname(
    approximatelyDecode(value).toLowerCase(),
  );
  return normalized === "/news" || normalized.startsWith("/news/");
}
