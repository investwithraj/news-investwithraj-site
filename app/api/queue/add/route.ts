// Enqueue new outreach drafts. Called by the daily news pipeline after
// articles are committed — pipeline picks top-N articles, generates per-
// channel drafts via lib/queue/draft-generators, then POSTs them here.
//
// Usage:
//   POST /api/queue/add?secret=<POST_PUBLISH_SECRET>
//   body: { items: Array<{ channel, target, draftText, rationale, sourceArticleSlug?, responseToUrl? }> }
//
// Or generate from article slugs directly:
//   POST /api/queue/add?secret=...
//   body: { slugs: ["..."], channels: ["reddit", "quora", "haro"] }

import { NextRequest, NextResponse } from "next/server";
import { addItems, getQueueStats, getStorageBackend } from "@/lib/queue/storage";
import {
  generateDraftsForArticle,
  selectTopDrafts,
  toQueuePartials,
} from "@/lib/queue/draft-generators";
import type { QueueChannel } from "@/lib/queue/types";
import { NEWS_ARTICLES } from "@/content/news";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function GET() {
  const stats = await getQueueStats();
  return NextResponse.json({
    name: "news.investwithraj.com outreach queue — add endpoint",
    method: "POST",
    auth: "?secret=<POST_PUBLISH_SECRET>",
    body: {
      mode_a: {
        items: "QueueItem[] — pre-built drafts (channel/target/draftText/rationale/sourceArticleSlug?)",
      },
      mode_b: {
        slugs: "string[] — article slugs from content/news/*.ts",
        channels: "QueueChannel[] (optional) — defaults to [reddit, quora, haro, linkedin-comment]",
      },
    },
    storage: getStorageBackend(),
    currentStats: stats,
  });
}

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json(
      { error: "POST_PUBLISH_SECRET env var not set — endpoint disabled" },
      { status: 503 }
    );
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    items?: unknown;
    slugs?: unknown;
    channels?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Mode A — items provided directly
  if (Array.isArray(body.items)) {
    const partials = (body.items as unknown[])
      .filter(
        (i): i is {
          channel: QueueChannel;
          target: string;
          draftText: string;
          rationale: string;
          sourceArticleSlug?: string;
          responseToUrl?: string;
        } =>
          typeof i === "object" &&
          i !== null &&
          "channel" in i &&
          "target" in i &&
          "draftText" in i &&
          "rationale" in i
      );

    const created = await addItems(partials);
    return NextResponse.json({
      ok: true,
      mode: "items",
      added: created.length,
      ids: created.map((c) => c.id),
      timestamp: new Date().toISOString(),
    });
  }

  // Mode B — generate from slugs
  if (Array.isArray(body.slugs)) {
    const slugs = (body.slugs as unknown[]).filter((s): s is string => typeof s === "string");
    const channels: QueueChannel[] =
      Array.isArray(body.channels) && body.channels.length > 0
        ? (body.channels.filter((c): c is QueueChannel => typeof c === "string") as QueueChannel[])
        : ["reddit", "quora", "haro", "linkedin-comment"];

    const articles = slugs
      .map((slug) => NEWS_ARTICLES.find((a) => a.slug === slug))
      .filter((a): a is (typeof NEWS_ARTICLES)[number] => a !== undefined);

    const allDrafts = articles.flatMap((article) =>
      selectTopDrafts(generateDraftsForArticle(article), channels)
    );
    const partials = toQueuePartials(allDrafts);
    const created = await addItems(partials);

    return NextResponse.json({
      ok: true,
      mode: "slugs",
      articlesProcessed: articles.length,
      missingSlugs: slugs.filter((s) => !articles.find((a) => a.slug === s)),
      channelsRequested: channels,
      drafted: created.length,
      ids: created.map((c) => c.id),
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    { error: "Body must be { items: [...] } or { slugs: [...] }" },
    { status: 400 }
  );
}
