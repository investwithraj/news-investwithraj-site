// Shared types for the social distribution layer.

export type Channel =
  // Postiz-managed (require Postiz self-hosted + OAuth per channel)
  | "linkedin-personal"
  | "linkedin-company"
  | "x"
  | "facebook"
  | "instagram-feed"
  | "instagram-stories"
  | "threads"
  | "tiktok"
  | "pinterest"
  | "bluesky"
  | "mastodon"
  | "youtube-shorts"
  // Direct webhook (no Postiz needed)
  | "telegram"
  | "discord";

export type DistributionVia = "postiz" | "telegram-bot" | "discord-webhook";

/** Result of a single channel distribution attempt */
export interface ChannelResult {
  channel: Channel;
  via: DistributionVia;
  ok: boolean;
  /** Scheduled-for timestamp (ISO) — may be in the future */
  scheduledFor?: string;
  /** Postiz post ID or platform post ID when available */
  externalId?: string;
  /** Error message on failure */
  error?: string;
}

/** Per-platform content variant — produced by lib/distribute/content-adapter */
export interface ContentVariant {
  channel: Channel;
  /** The actual text content to publish */
  text: string;
  /** Optional hashtags appended at the end (separate so platforms can strip if needed) */
  hashtags?: string[];
  /** Image URL (absolute) — when the channel supports media */
  imageUrl?: string;
  /** Outbound link — usually the article's canonical URL with UTM tags */
  link?: string;
}

/** Aggregated multi-channel distribution run summary */
export interface DistributionRun {
  articleSlug: string;
  startedAt: string;
  finishedAt: string;
  results: ChannelResult[];
  successCount: number;
  failureCount: number;
  skippedCount: number;
}
