// Authenticated outreach-queue intake.
//
// Browser operators authenticate with the signed HttpOnly session minted
// after /internal Basic Auth. Pipeline callers use x-post-publish-secret.
// URL/query credentials are rejected by the shared authorization guard.

import { NextRequest, NextResponse } from "next/server";

import { NEWS_ARTICLES } from "@/content/news";
import { authorize, authorizeMutation } from "@/lib/news-review/auth";
import {
  generateDraftsForArticle,
  selectTopDrafts,
  toQueuePartials,
} from "@/lib/queue/draft-generators";
import {
  addItems,
  getQueueStats,
  getStorageBackend,
  QueueMutationConflictError,
} from "@/lib/queue/storage";
import { CHANNEL_POLICIES, type QueueChannel } from "@/lib/queue/types";
import { readJsonBody } from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

const CHANNELS = Object.keys(CHANNEL_POLICIES) as QueueChannel[];
const CHANNEL_SET = new Set<string>(CHANNELS);
const MAX_BATCH = 100;
const MAX_DRAFT_LENGTH = 20_000;

type QueuePartial = {
  channel: QueueChannel;
  target: string;
  draftText: string;
  rationale: string;
  sourceArticleSlug?: string;
  responseToUrl?: string;
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean && clean.length <= max ? clean : null;
}

function cleanOptionalUrl(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function parseQueuePartial(value: unknown): QueuePartial | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const channel =
    typeof item.channel === "string" && CHANNEL_SET.has(item.channel)
      ? (item.channel as QueueChannel)
      : null;
  const target = cleanText(item.target, 1_000);
  const draftText = cleanText(item.draftText, MAX_DRAFT_LENGTH);
  const rationale = cleanText(item.rationale, 2_000);
  const sourceArticleSlug =
    item.sourceArticleSlug === undefined
      ? undefined
      : cleanText(item.sourceArticleSlug, 180);
  const responseToUrl = cleanOptionalUrl(item.responseToUrl);

  if (
    !channel ||
    !target ||
    !draftText ||
    !rationale ||
    sourceArticleSlug === null ||
    responseToUrl === null
  ) {
    return null;
  }

  return {
    channel,
    target,
    draftText,
    rationale,
    ...(sourceArticleSlug ? { sourceArticleSlug } : {}),
    ...(responseToUrl ? { responseToUrl } : {}),
  };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);

  try {
    const stats = await getQueueStats();
    return privateJson({
      name: "Invest With Raj outreach queue intake",
      method: "POST",
      authentication:
        "signed internal session or x-post-publish-secret request header",
      body: {
        items:
          "validated queue drafts, or slugs[] with optional supported channels[]",
      },
      storage: getStorageBackend(),
      currentStats: stats,
    });
  } catch {
    return privateJson({ error: "Queue storage is unavailable." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeMutation(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return privateJson(
      { error: "A valid Idempotency-Key header is required." },
      428,
    );
  }

  const parsed = await readJsonBody<{
    items?: unknown;
    slugs?: unknown;
    channels?: unknown;
  }>(request, { maxBytes: 512_000 });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return privateJson({ error: "The JSON body must be an object." }, 400);
  }

  try {
    if (Array.isArray(body.items)) {
      if (body.items.length === 0 || body.items.length > MAX_BATCH) {
        return privateJson(
          { error: `items must contain between 1 and ${MAX_BATCH} entries.` },
          400,
        );
      }
      const partials = body.items.map(parseQueuePartial);
      if (partials.some((item) => item === null)) {
        return privateJson(
          {
            error:
              "Every item requires a supported channel and bounded target, draftText and rationale. Optional URLs must be HTTP(S).",
          },
          400,
        );
      }

      const created = await addItems(
        partials as QueuePartial[],
        idempotencyKey,
      );
      return privateJson({
        ok: true,
        mode: "items",
        added: created.length,
        ids: created.map((item) => item.id),
        timestamp: new Date().toISOString(),
      });
    }

    if (Array.isArray(body.slugs)) {
      if (body.slugs.length === 0 || body.slugs.length > MAX_BATCH) {
        return privateJson(
          { error: `slugs must contain between 1 and ${MAX_BATCH} entries.` },
          400,
        );
      }
      const slugs = [
        ...new Set(
          body.slugs
            .map((slug) => cleanText(slug, 180))
            .filter((slug): slug is string => Boolean(slug)),
        ),
      ];
      if (slugs.length !== body.slugs.length) {
        return privateJson(
          { error: "Every slug must be a non-empty bounded string." },
          400,
        );
      }

      const requestedChannels =
        Array.isArray(body.channels) && body.channels.length > 0
          ? body.channels
          : ["reddit", "quora", "haro", "linkedin-comment"];
      const channels = requestedChannels.filter(
        (channel): channel is QueueChannel =>
          typeof channel === "string" && CHANNEL_SET.has(channel),
      );
      if (channels.length !== requestedChannels.length) {
        return privateJson({ error: "Unsupported queue channel." }, 400);
      }

      const articles = slugs
        .map((slug) => NEWS_ARTICLES.find((article) => article.slug === slug))
        .filter(
          (article): article is (typeof NEWS_ARTICLES)[number] =>
            article !== undefined,
        );
      const drafts = articles.flatMap((article) =>
        selectTopDrafts(generateDraftsForArticle(article), channels),
      );
      const created = await addItems(toQueuePartials(drafts), idempotencyKey);

      return privateJson({
        ok: true,
        mode: "slugs",
        articlesProcessed: articles.length,
        missingSlugs: slugs.filter(
          (slug) => !articles.some((article) => article.slug === slug),
        ),
        channelsRequested: channels,
        drafted: created.length,
        ids: created.map((item) => item.id),
        timestamp: new Date().toISOString(),
      });
    }

    return privateJson(
      { error: "Body must contain items[] or slugs[]." },
      400,
    );
  } catch (error) {
    if (error instanceof QueueMutationConflictError) {
      return privateJson(
        { error: "This Idempotency-Key was used for a different queue payload." },
        409,
      );
    }
    return privateJson({ error: "Queue storage is unavailable." }, 503);
  }
}
