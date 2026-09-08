import { dubaiCalendarDate } from "@/lib/dubai-time";
import { validatedDubaiMorningDate } from "./day";
import { NEWSROOM_ORIGIN, type LiveDayCoverage } from "./types";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type FrontItem = Readonly<{
  slug?: unknown;
  publishedAt?: unknown;
  url?: unknown;
}>;

type FrontPayload = Readonly<{
  schemaVersion?: unknown;
  items?: unknown;
}>;

type RepositoryArticle = Readonly<{
  slug: string;
  publishedAt: string;
  status?: string;
}>;

function canonicalArticleUrl(value: unknown, slug: unknown, origin: URL): URL | null {
  if (typeof value !== "string" || typeof slug !== "string") return null;
  if (!/^[a-z0-9-]{1,180}$/u.test(slug)) return null;
  try {
    const url = new URL(value);
    if (
      url.origin !== origin.origin ||
      url.pathname !== `/news/${slug}` ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Observe the canonical live feed, then prove the matching article route is
 * serving. A repository timestamp or a Git commit alone is not publication.
 */
export async function observeLiveDubaiDayCoverage(input: {
  morningDate: string;
  site?: string;
  fetcher?: Fetcher;
}): Promise<LiveDayCoverage> {
  const origin = new URL(input.site ?? NEWSROOM_ORIGIN);
  if (origin.protocol !== "https:") {
    throw new Error("The newsroom coverage origin must use HTTPS.");
  }
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(`${origin.origin}/api/front`, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Live newsroom coverage returned ${response.status}.`);
  }
  const payload = (await response.json().catch(() => null)) as FrontPayload | null;
  if (payload?.schemaVersion !== "front-v1" || !Array.isArray(payload.items)) {
    throw new Error("Live newsroom coverage did not match front-v1.");
  }

  const candidates = (payload.items as FrontItem[])
    .slice(0, 20)
    .map((item) => {
      const publishedAt =
        typeof item.publishedAt === "string" ? item.publishedAt : "";
      const timestamp = Date.parse(publishedAt);
      const url = canonicalArticleUrl(item.url, item.slug, origin);
      if (!url || !Number.isFinite(timestamp)) return null;
      return { publishedAt, timestamp, url };
    })
    .filter(
      (
        candidate,
      ): candidate is { publishedAt: string; timestamp: number; url: URL } =>
        candidate !== null &&
        dubaiCalendarDate(candidate.timestamp) === input.morningDate,
    )
    .sort((left, right) => right.timestamp - left.timestamp);

  const probes = await Promise.allSettled(
    candidates.map(async (candidate) => ({
      candidate,
      response: await fetcher(candidate.url.toString(), {
        cache: "no-store",
        headers: { accept: "text/html" },
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      }),
    })),
  );
  const live = probes.find(
    (probe) => probe.status === "fulfilled" && probe.value.response.status === 200,
  );
  if (live?.status === "fulfilled") {
    return {
      morningDate: input.morningDate,
      covered: true,
      articleUrl: live.value.candidate.url.toString(),
      publishedAt: live.value.candidate.publishedAt,
    };
  }
  if (probes.some((probe) => probe.status === "rejected")) {
    throw new Error("A same-day newsroom article route could not be observed.");
  }

  return {
    morningDate: input.morningDate,
    covered: false,
    articleUrl: null,
    publishedAt: null,
  };
}

export function observeRepositoryDubaiDayCoverage(input: {
  morningDate: string;
  articles: readonly RepositoryArticle[];
  site?: string;
}): LiveDayCoverage {
  const origin = new URL(input.site ?? NEWSROOM_ORIGIN);
  const article = input.articles
    .filter(
      (candidate) =>
        candidate.status !== "research" &&
        /^[a-z0-9-]{1,180}$/u.test(candidate.slug) &&
        Number.isFinite(Date.parse(candidate.publishedAt)) &&
        dubaiCalendarDate(candidate.publishedAt) === input.morningDate,
    )
    .sort((left, right) =>
      right.publishedAt.localeCompare(left.publishedAt),
    )[0];
  return article
    ? {
        morningDate: input.morningDate,
        covered: true,
        articleUrl: `${origin.origin}/news/${article.slug}`,
        publishedAt: article.publishedAt,
      }
    : {
        morningDate: input.morningDate,
        covered: false,
        articleUrl: null,
        publishedAt: null,
      };
}

export async function guardAutomatedMorningPublication(input: {
  environment?: Readonly<Record<string, string | undefined>>;
  now?: Date;
  site?: string;
  fetcher?: Fetcher;
  repositoryArticles?: readonly RepositoryArticle[];
}): Promise<
  | Readonly<{ automated: false; covered: false; morningDate: null }>
  | (LiveDayCoverage & Readonly<{ automated: true }>)
> {
  const environment = input.environment ?? process.env;
  if (environment.AUTOMATED_MORNING_LANE !== "1") {
    return { automated: false, covered: false, morningDate: null };
  }
  const morningDate = validatedDubaiMorningDate(
    environment.MORNING_DATE,
    input.now ?? new Date(),
  );
  const repositoryCoverage = observeRepositoryDubaiDayCoverage({
    morningDate,
    articles: input.repositoryArticles ?? [],
    site: input.site,
  });
  if (repositoryCoverage.covered) {
    return { automated: true, ...repositoryCoverage };
  }
  return {
    automated: true,
    ...(await observeLiveDubaiDayCoverage({
      morningDate,
      site: input.site,
      fetcher: input.fetcher,
    })),
  };
}
