// Distribution orchestrator — composes content-adapter + schedule +
// per-channel client (Postiz, Telegram, Discord) into a single
// "ship this article everywhere" call.

import type { NewsArticle } from "@/content/news/types";
import type {
  Channel,
  ChannelResult,
  DistributionRun,
} from "./types";
import { buildVariants } from "./content-adapter";
import { scheduleTimeFor, DEFAULT_PHASE_1_CHANNELS, ALL_CHANNELS } from "./schedule";
import { schedulePostizPost, POSTIZ_CHANNELS } from "./postiz";
import { postToTelegram } from "./telegram";
import { postToDiscord } from "./discord";
import { channelConfiguration } from "./config";
import { hasVerifiedEditorialImage } from "@/lib/news-editorial";

export type { Channel, ChannelResult, DistributionRun, ContentVariant } from "./types";
export {
  ALL_CHANNELS,
  DEFAULT_PHASE_1_CHANNELS,
  scheduleTimeFor,
} from "./schedule";
export {
  isPostizConfigured,
  POSTIZ_CHANNELS,
} from "./postiz";
export { isTelegramConfigured } from "./telegram";
export { isDiscordConfigured } from "./discord";
export {
  channelConfiguration,
  socialDistributionEnabled,
  type ChannelConfiguration,
} from "./config";

/**
 * Distribute one article across the specified channels.
 *
 * - Postiz channels are SCHEDULED (future time per master plan cron table)
 * - Telegram + Discord are POSTED IMMEDIATELY (Telegram/Discord have no
 *   scheduling on their direct APIs; for delayed posts they're invoked
 *   via Vercel Cron or the schedule skill)
 *
 * Returns a DistributionRun summary with per-channel results.
 */
export async function distributeArticle(
  article: NewsArticle,
  channels: Channel[] = DEFAULT_PHASE_1_CHANNELS
): Promise<DistributionRun> {
  const startedAt = new Date().toISOString();
  const baseTime = new Date();

  const uniqueChannels = [...new Set(channels)].filter((channel) =>
    ALL_CHANNELS.includes(channel),
  );
  const configuration = uniqueChannels.map((channel) =>
    channelConfiguration(channel),
  );
  const activeChannels = configuration
    .filter((item) => item.active)
    .map((item) => item.channel);
  const variants = buildVariants(article, activeChannels).map((variant) =>
    hasVerifiedEditorialImage(article)
      ? variant
      : { ...variant, imageUrl: undefined },
  );

  const skippedResults: ChannelResult[] = configuration
    .filter((item) => !item.active)
    .map((item) => ({
      channel: item.channel,
      via: item.via,
      ok: false,
      configured: item.configured,
      attempted: false,
      delivered: false,
      status: "skipped",
      error: item.reason ?? "Channel is inactive.",
    }));

  // Postiz channels — scheduled at staggered times
  const postizVariants = variants.filter((v) => POSTIZ_CHANNELS.includes(v.channel));
  const postizPromises = postizVariants.map((v) => {
    const scheduledFor = scheduleTimeFor(v.channel, baseTime);
    return schedulePostizPost(v, scheduledFor);
  });

  // Telegram + Discord — immediate
  const telegramVariant = variants.find((v) => v.channel === "telegram");
  const discordVariant = variants.find((v) => v.channel === "discord");

  const directPromises: Promise<ChannelResult>[] = [];
  if (telegramVariant) directPromises.push(postToTelegram(telegramVariant));
  if (discordVariant) directPromises.push(postToDiscord(discordVariant));

  const attemptedResults = await Promise.all([
    ...postizPromises,
    ...directPromises,
  ]);
  const resultByChannel = new Map(
    [...skippedResults, ...attemptedResults].map((result) => [
      result.channel,
      result,
    ]),
  );
  const results = uniqueChannels
    .map((channel) => resultByChannel.get(channel))
    .filter((result): result is ChannelResult => Boolean(result));

  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.filter((r) => r.status === "failed").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const scheduledCount = results.filter((r) => r.status === "scheduled").length;
  const deliveredCount = results.filter((r) => r.delivered).length;

  return {
    articleSlug: article.slug,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    successCount,
    failureCount,
    skippedCount,
    scheduledCount,
    deliveredCount,
  };
}

/** Distribute multiple articles in sequence (avoids hammering APIs in parallel). */
export async function distributeBatch(
  articles: NewsArticle[],
  channels: Channel[] = DEFAULT_PHASE_1_CHANNELS
): Promise<DistributionRun[]> {
  const runs: DistributionRun[] = [];
  for (const article of articles) {
    runs.push(await distributeArticle(article, channels));
  }
  return runs;
}

/** Helper: which channels are actually configured + ready to fire. */
export function getActiveChannels(): {
  active: Channel[];
  inactive: Channel[];
  status: ReturnType<typeof channelConfiguration>[];
} {
  const status = ALL_CHANNELS.map((channel) => channelConfiguration(channel));
  return {
    active: status.filter((item) => item.active).map((item) => item.channel),
    inactive: status
      .filter((item) => !item.active)
      .map((item) => item.channel),
    status,
  };
}
