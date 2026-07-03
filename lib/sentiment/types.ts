// Sentiment data shapes — drives /pulse heatmap.

export type SentimentChannel = "reddit" | "x" | "telegram" | "news" | "linkedin";

export interface SentimentSignal {
  /** Subject (area or developer slug) */
  subject: string;
  /** Display name */
  name: string;
  /** Kind */
  kind: "area" | "developer";
  /** Where the signal came from */
  channel: SentimentChannel;
  /** Score -1..+1 (bearish → bullish) */
  score: number;
  /** Sample count contributing to this score */
  volume: number;
  /** 1-3 sentence Claude-generated summary of the chatter */
  summary: string;
  /** Top 3 verbatim quotes */
  quotes: string[];
  /** ISO timestamp when this snapshot was taken */
  computedAt: string;
}

export interface SentimentSnapshot {
  /** ISO timestamp */
  generatedAt: string;
  /** "live" when scrapers + Claude classification wired, else "mock" */
  source: "live" | "mock";
  /** Per-subject signals (across all channels merged) */
  signals: SentimentSignal[];
  /** Channel-level aggregates */
  byChannel: Record<SentimentChannel, { score: number; volume: number }>;
}

/** Heat color helper — green=bullish, gold=neutral, red=bearish. */
export function scoreToColor(score: number): string {
  if (score > 0.4) return "#22c55e"; // bullish green
  if (score > 0.1) return "#7ED99F"; // soft green
  if (score > -0.1) return "#E0C076"; // gold neutral
  if (score > -0.4) return "#F4A582"; // soft red
  return "#E58E89"; // bearish red
}

/** AA-on-light variant of scoreToColor — deep tones that clear WCAG AA on the
 *  cream/white cards, for the score TEXT only. Keep scoreToColor for fills,
 *  borders, and text on the dark hero (where the vivid tones read fine).
 *  Ratios on the cream --paper (#FBF8F2): green ~4.7:1, bronze ~4.8:1, red ~6:1. */
export function scoreToInk(score: number): string {
  if (score > 0.1) return "#15803D"; // bullish — deep green
  if (score > -0.1) return "#8A6A1F"; // neutral — deep bronze
  return "#B42318"; // bearish — deep red
}
