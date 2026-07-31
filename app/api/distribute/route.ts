// Distribution endpoint — schedule-skill calls this after committing
// articles to schedule social posts + fire Telegram/Discord immediately.
//
// Usage:
//   POST /api/distribute with the server credential header
//   body: {
//     "slugs": ["2026-05-26-modon-phase-2", "2026-05-26-rera-q1-bulletin"],
//     "channels": ["linkedin-personal", "x", "telegram", "discord"]  (optional)
//   }
//
// Returns DistributionRun summary per article.

import { NextRequest } from "next/server";
import {
  ALL_CHANNELS,
  type Channel,
  DEFAULT_PHASE_1_CHANNELS,
  getActiveChannels,
} from "@/lib/distribute";
import { buildVariants } from "@/lib/distribute/content-adapter";
import { NEWS_ARTICLES } from "@/content/news";
import { hasVerifiedEditorialImage } from "@/lib/news-editorial";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

export async function GET() {
  const { active, inactive } = getActiveChannels();
  return publicStatusJson({
    name: "news.investwithraj.com distribution endpoint",
    mutationMethod: "POST",
    delivery:
      "disabled; this endpoint produces reviewed channel previews only",
    body: {
      slugs: "string[] — article slugs (from content/news/*.ts) to distribute",
      channels: `string[] (optional) — defaults to ${DEFAULT_PHASE_1_CHANNELS.join(", ")}`,
    },
    channelStatus: {
      active,
      inactive,
      activeCount: active.length,
      inactiveCount: inactive.length,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  const parsed = await readJsonBody<{
    slugs?: unknown;
    channels?: unknown;
  }>(request, { maxBytes: 32_768 });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (!Array.isArray(body.slugs)) {
    return privateJson(
      { error: "Body must be { slugs: string[] }" },
      400,
    );
  }

  const slugs = (body.slugs as unknown[]).filter(
    (s): s is string => typeof s === "string"
  );

  const channels: Channel[] =
    Array.isArray(body.channels) && body.channels.length > 0
      ? body.channels.filter(
          (c): c is Channel =>
            typeof c === "string" && ALL_CHANNELS.includes(c as Channel),
        )
      : DEFAULT_PHASE_1_CHANNELS;

  if (channels.length === 0) {
    return privateJson(
      { error: "No recognised distribution channels were supplied." },
      400,
    );
  }

  // Resolve slugs to articles
  const articles = slugs
    .map((slug) => NEWS_ARTICLES.find((a) => a.slug === slug))
    .filter((a): a is (typeof NEWS_ARTICLES)[number] => a !== undefined);

  const missing = slugs.filter((s) => !articles.find((a) => a.slug === s));

  const previews = articles.map((article) => ({
    articleSlug: article.slug,
    variants: buildVariants(article, channels).map((variant) => ({
      ...variant,
      imageUrl: hasVerifiedEditorialImage(article)
        ? variant.imageUrl
        : undefined,
    })),
  }));

  return privateJson({
    ok: true,
    preview: true,
    delivered: false,
    processedArticles: articles.length,
    missingSlugs: missing,
    channelsRequested: channels,
    previews,
    message:
      "Channel drafts were generated for review. No post, webhook or schedule call was attempted.",
    timestamp: new Date().toISOString(),
  });
}
