// Discord webhook — direct POST to a channel webhook URL (no Postiz).
//
// Required env var on Vercel:
//   DISCORD_WEBHOOK_URL — get from Discord channel Settings → Integrations →
//                        Webhooks → Create / Copy URL
//
// Posts as a rich embed with title + description + URL + image.

import type { ContentVariant, ChannelResult } from "./types";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

export function isDiscordConfigured(): boolean {
  return Boolean(DISCORD_WEBHOOK_URL);
}

/** Post immediately to the configured Discord channel via webhook. */
export async function postToDiscord(
  variant: ContentVariant
): Promise<ChannelResult> {
  if (!isDiscordConfigured()) {
    return {
      channel: "discord",
      via: "discord-webhook",
      ok: false,
      error: "Discord not configured (DISCORD_WEBHOOK_URL env var missing). Skipped.",
    };
  }

  // Extract title from variant.text (Markdown bold-wrapped first line)
  const lines = variant.text.split("\n");
  const titleLine = lines[0]?.replace(/^\*\*|\*\*$/g, "") || "";
  const restBody = lines.slice(1).join("\n").trim();

  const payload = {
    username: "Invest With Raj",
    avatar_url:
      process.env.NEXT_PUBLIC_DISCORD_AVATAR_URL ||
      "https://news.investwithraj.com/icon.svg",
    embeds: [
      {
        title: titleLine || variant.text.slice(0, 256),
        description: restBody || variant.text,
        url: variant.link,
        color: 0xc9a961, // brand gold
        image: variant.imageUrl ? { url: variant.imageUrl } : undefined,
        footer: {
          text: "news.investwithraj.com",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      return {
        channel: "discord",
        via: "discord-webhook",
        ok: false,
        error: `Discord webhook returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    return {
      channel: "discord",
      via: "discord-webhook",
      ok: true,
      scheduledFor: new Date().toISOString(),
    };
  } catch (e) {
    return {
      channel: "discord",
      via: "discord-webhook",
      ok: false,
      error: e instanceof Error ? e.message : "Unknown Discord error",
    };
  }
}
