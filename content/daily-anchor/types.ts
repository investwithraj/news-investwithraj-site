// Daily Anchor — AI-generated Raj video shown at the top of the homepage.
//
// Morning cron picks the day's lead story, drafts a 60-90s script via Claude
// (Voice Profile enforced), synthesises with ElevenLabs Raj voice, and
// generates a lip-synced video via Higgsfield Soul (or Gemini Omni / Veo 3).
//
// The resulting URLs are written to pipeline-runs/daily-anchor.json. The
// homepage <DailyAnchorPane/> reads this file via /api/anchor.

export type AnchorState =
  | "pending-script"
  | "pending-voice"
  | "pending-video"
  | "ready"
  | "failed";

export interface DailyAnchor {
  /** YYYY-MM-DD */
  date: string;
  /** Headline that the anchor riffs on */
  headline: string;
  /** Slug of the underlying news article (if any) */
  sourceSlug?: string;
  /** Generated VO script */
  script: string;
  /** ISO timestamp when the script was finalised */
  scriptedAt?: string;
  /** ElevenLabs MP3 URL or data URI */
  audioUrl?: string;
  /** Lip-synced video URL */
  videoUrl?: string;
  /** Provider used (higgsfield or gemini) */
  provider?: "higgsfield" | "gemini" | "veo3";
  /** Current pipeline state */
  state: AnchorState;
  /** Last update */
  updatedAt: string;
  /** Optional caption transcript for accessibility */
  captionsVtt?: string;
}
