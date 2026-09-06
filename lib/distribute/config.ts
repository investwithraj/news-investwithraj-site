import type { Channel, DistributionVia } from "./types";

type DistributionEnvironment = Readonly<Record<string, string | undefined>>;

export type ChannelConfiguration = Readonly<{
  channel: Channel;
  via: DistributionVia;
  featureEnabled: boolean;
  configured: boolean;
  active: boolean;
  reason: string | null;
}>;

const POSTIZ_CHANNELS = new Set<Channel>([
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
]);

export function socialDistributionEnabled(
  environment: DistributionEnvironment = process.env,
): boolean {
  return environment.ENABLE_SOCIAL_DISTRIBUTION === "1";
}

export function channelConfiguration(
  channel: Channel,
  environment: DistributionEnvironment = process.env,
): ChannelConfiguration {
  const featureEnabled = socialDistributionEnabled(environment);
  let configured = false;
  let via: DistributionVia;

  if (channel === "telegram") {
    via = "telegram-bot";
    configured = Boolean(
      environment.TELEGRAM_BOT_TOKEN?.trim() &&
        environment.TELEGRAM_CHANNEL_ID?.trim(),
    );
  } else if (channel === "discord") {
    via = "discord-webhook";
    configured = Boolean(environment.DISCORD_WEBHOOK_URL?.trim());
  } else {
    via = "postiz";
    const integrationName = `POSTIZ_${channel
      .toUpperCase()
      .replace(/-/g, "_")}_ID`;
    configured = Boolean(
      POSTIZ_CHANNELS.has(channel) &&
        environment.POSTIZ_BASE_URL?.trim() &&
        environment.POSTIZ_API_TOKEN?.trim() &&
        environment[integrationName]?.trim(),
    );
  }

  return {
    channel,
    via,
    featureEnabled,
    configured,
    active: featureEnabled && configured,
    reason: !featureEnabled
      ? "Social distribution feature is disabled."
      : !configured
        ? `${channel} provider configuration is incomplete.`
        : null,
  };
}
