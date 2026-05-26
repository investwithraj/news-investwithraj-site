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

  const variants = buildVariants(article, channels);

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

  const results = await Promise.all([...postizPromises, ...directPromises]);

  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.filter((r) => !r.ok && !r.error?.includes("Skipped")).length;
  const skippedCount = results.filter((r) => r.error?.includes("Skipped")).length;

  return {
    articleSlug: article.slug,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    successCount,
    failureCount,
    skippedCount,
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
} {
  const active: Channel[] = [];
  const inactive: Channel[] = [];

  // Lazy require to avoid circular imports
  const postizReady = process.env.POSTIZ_BASE_URL && process.env.POSTIZ_API_TOKEN;
  const tgReady = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID;
  const dcReady = process.env.DISCORD_WEBHOOK_URL;

  for (const c of ALL_CHANNELS) {
    if (c === "telegram") {
      (tgReady ? active : inactive).push(c);
    } else if (c === "discord") {
      (dcReady ? active : inactive).push(c);
    } else {
      // Postiz channel — needs Postiz base + per-channel integration ID
      const idEnv = `POSTIZ_${c.toUpperCase().replace(/-/g, "_")}_ID`;
      const hasId = Boolean(process.env[idEnv]);
      (postizReady && hasId ? active : inactive).push(c);
    }
  }

  return { active, inactive };
}
