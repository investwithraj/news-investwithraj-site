// Deterministic mock sentiment data — used until live Reddit/X/Telegram
// scrapers are provisioned. Date-seeded so the heatmap is stable per day.

import type { SentimentSignal, SentimentSnapshot, SentimentChannel } from "./types";
import { AREAS } from "@/content/areas";
import { DEVELOPERS } from "@/lib/developers";

function seed(date: string, salt: string): number {
  let h = 0;
  const s = date + ":" + salt;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function rand(date: string, salt: string, min = 0, max = 1): number {
  const v = seed(date, salt) / 2147483647;
  return min + (v % 1) * (max - min);
}

const CHANNEL_BLURBS: Record<SentimentChannel, string[]> = {
  reddit: [
    "Off-plan launch timing draws comparison to last cycle's late-Q2 cool-down",
    "Most-upvoted comment threads center on payment-plan flexibility",
    "Heated subthread on Modon vs Aldar build quality drove 80+ replies",
  ],
  x: [
    "Broker community quote-tweeting the price-per-sqft chart",
    "Sentiment thread dominated by Russia + India HNW demand commentary",
    "Sceptics flagged escrow-cycle exposure on early-stage launches",
  ],
  telegram: [
    "Investor groups citing the comparable Q1 print as upside catalyst",
    "Cross-posted from Dubai brokerages — buy-side enthusiasm tepid",
    "Group admins resharing the IRR math from this week's note",
  ],
  news: [
    "Khaleej Times + Arabian Business converging on the same lead angle",
    "Knight Frank's Q1 wealth report cited as primary upside catalyst",
    "Trade-press tone modest — facts-first, no hype",
  ],
  linkedin: [
    "C-suite repost activity heavy on the regulatory-update item",
    "DLD officials commenting + reinforcing the headline metric",
    "Broker thought-leaders pushing a counter-thesis on yields",
  ],
};

const CHANNELS: SentimentChannel[] = ["reddit", "x", "telegram", "news", "linkedin"];

export function getMockSentimentSnapshot(date?: string): SentimentSnapshot {
  const d = date || new Date().toISOString().slice(0, 10);

  const signals: SentimentSignal[] = [];

  // Areas — pick top 15 by name length to keep mock varied
  for (const area of AREAS.slice(0, 18)) {
    const score = rand(d, "area:" + area.slug, -0.7, 0.85);
    const channel = CHANNELS[seed(d, "ch:" + area.slug) % CHANNELS.length];
    const blurbs = CHANNEL_BLURBS[channel];
    signals.push({
      subject: area.slug,
      name: area.name,
      kind: "area",
      channel,
      score,
      volume: Math.round(rand(d, "vol:" + area.slug, 12, 480)),
      summary: `${area.name} chatter on ${channel} — ${
        score > 0.2 ? "leaning bullish" : score < -0.2 ? "skewing bearish" : "broadly neutral"
      }. ${blurbs[seed(d, "b:" + area.slug) % blurbs.length]}.`,
      quotes: [
        blurbs[0],
        blurbs[1],
        blurbs[2],
      ],
      computedAt: new Date().toISOString(),
    });
  }

  // Developers
  for (const dev of DEVELOPERS) {
    const score = rand(d, "dev:" + dev.slug, -0.6, 0.85);
    const channel = CHANNELS[seed(d, "dch:" + dev.slug) % CHANNELS.length];
    const blurbs = CHANNEL_BLURBS[channel];
    signals.push({
      subject: dev.slug,
      name: dev.name,
      kind: "developer",
      channel,
      score,
      volume: Math.round(rand(d, "dvol:" + dev.slug, 25, 680)),
      summary: `${dev.name} chatter on ${channel} — ${
        score > 0.2 ? "buy-side optimism" : score < -0.2 ? "scepticism on delivery" : "neutral discussion"
      }. ${blurbs[seed(d, "db:" + dev.slug) % blurbs.length]}.`,
      quotes: blurbs,
      computedAt: new Date().toISOString(),
    });
  }

  // Channel-level aggregates
  const byChannel: SentimentSnapshot["byChannel"] = {
    reddit: { score: 0, volume: 0 },
    x: { score: 0, volume: 0 },
    telegram: { score: 0, volume: 0 },
    news: { score: 0, volume: 0 },
    linkedin: { score: 0, volume: 0 },
  };
  for (const sig of signals) {
    byChannel[sig.channel].score += sig.score * sig.volume;
    byChannel[sig.channel].volume += sig.volume;
  }
  for (const ch of CHANNELS) {
    if (byChannel[ch].volume > 0) {
      byChannel[ch].score = byChannel[ch].score / byChannel[ch].volume;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "mock",
    signals,
    byChannel,
  };
}
