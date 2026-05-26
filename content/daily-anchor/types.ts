// Daily Anchor — Raj's voice over real Dubai/Abu Dhabi/RAK B-roll at the
// top of the homepage.
//
// Morning cron picks the day's lead story, drafts a 60-90s script via Claude
// (Voice Profile enforced), synthesises with ElevenLabs Raj voice, and
// selects a REAL stock video clip (Pexels Videos) sourced from professional
// videographers — NOT AI-generated.
//
// The resulting URLs are written to Vercel KV (key: iwr:anchor:current).
// The homepage <DailyAnchorPane/> reads via /api/anchor.

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
  /** B-roll video URL (real stock footage, looped silently under audio) */
  videoUrl?: string;
  /** Videographer credit (for stock-sourced clips) */
  videoCredit?: string;
  /** Provider domain (e.g. "pexels-video", "coverr") */
  videoSource?: string;
  /** License identifier */
  videoLicense?: string;
  /** Direct link back to the original stock-video page (for attribution) */
  videoAttributionUrl?: string;
  /** Provider used (real stock or — legacy — AI-generated) */
  provider?: "pexels-video" | "coverr" | "veo3" | "higgsfield" | "gemini";
  /** Current pipeline state */
  state: AnchorState;
  /** Last update */
  updatedAt: string;
  /** Optional caption transcript for accessibility */
  captionsVtt?: string;
}
