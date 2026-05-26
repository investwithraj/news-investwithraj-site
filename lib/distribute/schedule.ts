// Per-channel scheduling — when to publish each variant.
// Per master plan Part 5 (Daily distribution cron schedule).
//
// All times in GST (UTC+4). Articles drop at 06:30 GST after the daily
// cron commits, then distribution staggers throughout the day to
// maximize per-platform attention.

import type { Channel } from "./types";

/** Schedule offset from "now" in minutes per channel — per master plan timing.
 *  Lower = sooner. */
const CHANNEL_OFFSET_MINUTES: Record<Channel, number> = {
  // 07:00 GST — first wave (LinkedIn + X, peak professional read)
  "linkedin-personal": 30,
  "linkedin-company": 30,
  x: 30,

  // 07:30 — Threads
  threads: 60,

  // 09:00 — FB + IG feed (morning scroll)
  facebook: 150,
  "instagram-feed": 150,

  // 10:00 — IG Stories (mid-morning quick check)
  "instagram-stories": 210,

  // 12:00 — TikTok + Reels + Shorts (lunch break attention)
  tiktok: 330,
  "youtube-shorts": 330,

  // 14:00 — Pinterest (afternoon planning slot)
  pinterest: 450,

  // 15:00 — BlueSky + Mastodon (tech audience, afternoon)
  bluesky: 510,
  mastodon: 510,

  // 16:00 — Telegram + Discord (audience-rich evening)
  telegram: 570,
  discord: 570,
};

/** Compute the scheduled-for ISO timestamp for a given channel.
 *  baseTime defaults to "now" (the moment after commit+deploy). */
export function scheduleTimeFor(channel: Channel, baseTime: Date = new Date()): Date {
  const offset = CHANNEL_OFFSET_MINUTES[channel];
  return new Date(baseTime.getTime() + offset * 60 * 1000);
}

/** The full default channel list for a "ship everywhere" distribution. */
export const ALL_CHANNELS: Channel[] = [
  "linkedin-personal",
  "linkedin-company",
  "x",
  "threads",
  "facebook",
  "instagram-feed",
  "instagram-stories",
  "tiktok",
  "pinterest",
  "bluesky",
  "mastodon",
  "youtube-shorts",
  "telegram",
  "discord",
];

/** Conservative default — only channels where we have direct webhook
 *  access (Telegram + Discord), plus LinkedIn + X if Postiz is configured. */
export const DEFAULT_PHASE_1_CHANNELS: Channel[] = [
  "linkedin-personal",
  "x",
  "telegram",
  "discord",
];
