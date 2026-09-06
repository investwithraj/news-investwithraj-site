// Telegram Bot API — direct webhook (no Postiz).
//
// Required env vars on Vercel:
//   TELEGRAM_BOT_TOKEN — from @BotFather after creating the bot
//   TELEGRAM_CHANNEL_ID — channel username (with @) OR numeric chat_id
//
// Bot must be an admin of the channel for posting privileges.

import type { ContentVariant, ChannelResult } from "./types";
import { channelConfiguration } from "./config";

export function isTelegramConfigured(): boolean {
  return channelConfiguration("telegram").configured;
}

/**
 * Post immediately to the configured Telegram channel.
 * Telegram has no native scheduling on Bot API — for delayed posts,
 * we schedule the API call itself via Vercel Cron or the schedule skill.
 */
export async function postToTelegram(
  variant: ContentVariant
): Promise<ChannelResult> {
  const configuration = channelConfiguration("telegram");
  if (!configuration.active) {
    return {
      channel: "telegram",
      via: "telegram-bot",
      ok: false,
      configured: configuration.configured,
      attempted: false,
      delivered: false,
      status: "skipped",
      error: configuration.reason ?? "Telegram is inactive.",
    };
  }

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: process.env.TELEGRAM_CHANNEL_ID,
    text: variant.text,
    parse_mode: "HTML" as const,
    disable_web_page_preview: false,
    link_preview_options: {
      prefer_large_media: true,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        channel: "telegram",
        via: "telegram-bot",
        ok: false,
        configured: true,
        attempted: true,
        delivered: false,
        status: "failed",
        error: `Telegram API returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };
    if (!data.ok) {
      return {
        channel: "telegram",
        via: "telegram-bot",
        ok: false,
        configured: true,
        attempted: true,
        delivered: false,
        status: "failed",
        error: `Telegram API: ${data.description ?? "unknown"}`,
      };
    }

    return {
      channel: "telegram",
      via: "telegram-bot",
      ok: true,
      configured: true,
      attempted: true,
      delivered: true,
      status: "delivered",
      scheduledFor: new Date().toISOString(),
      externalId: String(data.result?.message_id ?? ""),
    };
  } catch {
    return {
      channel: "telegram",
      via: "telegram-bot",
      ok: false,
      configured: true,
      attempted: true,
      delivered: false,
      status: "failed",
      error: "Telegram request failed or timed out before acceptance.",
    };
  }
}
