// Discord webhook — direct POST to a channel webhook URL (no Postiz).
//
// Required env var on Vercel:
//   DISCORD_WEBHOOK_URL — get from Discord channel Settings → Integrations →
//                        Webhooks → Create / Copy URL
//
// Posts as a rich embed with title + description + URL + image.

import type { ContentVariant, ChannelResult } from "./types";
import { channelConfiguration } from "./config";

export function isDiscordConfigured(): boolean {
  return channelConfiguration("discord").configured;
}

/** Post immediately to the configured Discord channel via webhook. */
export async function postToDiscord(
  variant: ContentVariant
): Promise<ChannelResult> {
  const configuration = channelConfiguration("discord");
  if (!configuration.active) {
    return {
      channel: "discord",
      via: "discord-webhook",
      ok: false,
      configured: configuration.configured,
      attempted: false,
      delivered: false,
      status: "skipped",
      error: configuration.reason ?? "Discord is inactive.",
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
    const res = await fetch(process.env.DISCORD_WEBHOOK_URL as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      return {
        channel: "discord",
        via: "discord-webhook",
        ok: false,
        configured: true,
        attempted: true,
        delivered: false,
        status: "failed",
        error: `Discord webhook returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    return {
      channel: "discord",
      via: "discord-webhook",
      ok: true,
      configured: true,
      attempted: true,
      delivered: true,
      status: "delivered",
      scheduledFor: new Date().toISOString(),
    };
  } catch {
    return {
      channel: "discord",
      via: "discord-webhook",
      ok: false,
      configured: true,
      attempted: true,
      delivered: false,
      status: "failed",
      error: "Discord request failed or timed out before acceptance.",
    };
  }
}
