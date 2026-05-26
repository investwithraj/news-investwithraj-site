// Postiz REST API client. Postiz is the open-source social-media
// scheduler we use for 12 of the 14 channels (Telegram + Discord go
// direct). Self-hosted on Hetzner per master plan.
//
// Required env vars on Vercel:
//   POSTIZ_BASE_URL — e.g. https://postiz.investwithraj.com
//   POSTIZ_API_TOKEN — API key generated in Postiz Settings → API
//
// If env vars are not set, the client gracefully no-ops (returns
// "skipped" results) so the rest of the distribution pipeline still
// runs. This way we ship the integration code Day-1 and flip it on
// when Postiz is actually running.

import type { Channel, ContentVariant, ChannelResult } from "./types";

const POSTIZ_BASE_URL = process.env.POSTIZ_BASE_URL || "";
const POSTIZ_API_TOKEN = process.env.POSTIZ_API_TOKEN || "";

/** True when Postiz is configured + can be called. */
export function isPostizConfigured(): boolean {
  return Boolean(POSTIZ_BASE_URL && POSTIZ_API_TOKEN);
}

/** Postiz integration ID per channel — populated after user wires
 *  OAuth per platform in Postiz UI. Override via env if needed. */
const POSTIZ_INTEGRATION_ID: Partial<Record<Channel, string>> = {
  "linkedin-personal": process.env.POSTIZ_LINKEDIN_PERSONAL_ID || "",
  "linkedin-company": process.env.POSTIZ_LINKEDIN_COMPANY_ID || "",
  x: process.env.POSTIZ_X_ID || "",
  facebook: process.env.POSTIZ_FACEBOOK_ID || "",
  "instagram-feed": process.env.POSTIZ_INSTAGRAM_FEED_ID || "",
  "instagram-stories": process.env.POSTIZ_INSTAGRAM_STORIES_ID || "",
  threads: process.env.POSTIZ_THREADS_ID || "",
  tiktok: process.env.POSTIZ_TIKTOK_ID || "",
  pinterest: process.env.POSTIZ_PINTEREST_ID || "",
  bluesky: process.env.POSTIZ_BLUESKY_ID || "",
  mastodon: process.env.POSTIZ_MASTODON_ID || "",
  "youtube-shorts": process.env.POSTIZ_YOUTUBE_SHORTS_ID || "",
};

/** Channels handled by Postiz (not Telegram/Discord which go direct). */
export const POSTIZ_CHANNELS: Channel[] = [
  "linkedin-personal",
  "linkedin-company",
  "x",
  "facebook",
  "instagram-feed",
  "instagram-stories",
  "threads",
  "tiktok",
  "pinterest",
  "bluesky",
  "mastodon",
  "youtube-shorts",
];

/**
 * Schedule a single post on a single channel via Postiz API.
 * No-ops cleanly when not configured.
 */
export async function schedulePostizPost(
  variant: ContentVariant,
  scheduledFor: Date
): Promise<ChannelResult> {
  if (!isPostizConfigured()) {
    return {
      channel: variant.channel,
      via: "postiz",
      ok: false,
      error: "Postiz not configured (POSTIZ_BASE_URL + POSTIZ_API_TOKEN env vars missing). Skipped.",
    };
  }

  const integrationId = POSTIZ_INTEGRATION_ID[variant.channel];
  if (!integrationId) {
    return {
      channel: variant.channel,
      via: "postiz",
      ok: false,
      error: `Postiz integration ID for ${variant.channel} not configured. Set POSTIZ_${variant.channel.toUpperCase().replace(/-/g, "_")}_ID env var.`,
    };
  }

  // Compose final text with hashtags appended
  const fullText = variant.hashtags && variant.hashtags.length > 0
    ? `${variant.text}\n\n${variant.hashtags.map((h) => `#${h}`).join(" ")}`
    : variant.text;

  // Postiz API payload — based on their open-source schema as of 2026.
  // If their API changes, this is the single touch-point to update.
  const payload = {
    type: "schedule",
    date: scheduledFor.toISOString(),
    posts: [
      {
        integration: { id: integrationId },
        value: [
          {
            content: fullText,
            image: variant.imageUrl ? [{ path: variant.imageUrl }] : [],
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(`${POSTIZ_BASE_URL}/api/v1/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTIZ_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        channel: variant.channel,
        via: "postiz",
        ok: false,
        error: `Postiz returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string; postId?: string };
    return {
      channel: variant.channel,
      via: "postiz",
      ok: true,
      scheduledFor: scheduledFor.toISOString(),
      externalId: data.id || data.postId,
    };
  } catch (e) {
    return {
      channel: variant.channel,
      via: "postiz",
      ok: false,
      error: e instanceof Error ? e.message : "Unknown Postiz error",
    };
  }
}
