// Verticals — Raj's editorial taxonomy. Drives the homepage bento + each
// vertical landing page (/v/dld-pulse, /v/off-plan-watch, etc.).
//
// Each vertical maps to one or more NewsCategory values + has its own
// brand identity (gradient, icon glyph, eyebrow color).

import type { NewsCategory } from "@/content/news/types";

export type VerticalSlug =
  | "dld-pulse"
  | "off-plan-watch"
  | "uhnw-trades"
  | "sovereign-plays"
  | "beyond-the-deal";

export interface Vertical {
  slug: VerticalSlug;
  /** Display name */
  name: string;
  /** 1-line tagline shown under name on homepage card */
  tagline: string;
  /** Longer description for /v/[slug] header */
  description: string;
  /** Which NewsCategory values feed this vertical */
  categories: NewsCategory[];
  /** Background CSS gradient — used on the bento card */
  gradient: string;
  /** Accent color for eyebrow + chip */
  accent: string;
  /** Single-glyph "icon" — keeps bundle tiny vs an icon library */
  glyph: string;
  /** Editorial cadence promise */
  cadence: string;
}

export const VERTICALS: Vertical[] = [
  {
    slug: "dld-pulse",
    name: "DLD Pulse",
    tagline: "Daily prints. Volume, velocity, who moved.",
    description:
      "Every Dubai Land Department transaction print, parsed and contextualized. Daily volume, sale velocity by area, the unusual trades. Bloomberg-tier data, desk-tier commentary.",
    categories: ["market-pulse"],
    gradient:
      "linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(29, 78, 216, 0.06))",
    accent: "var(--gold-deep)",
    glyph: "◐",
    cadence: "Daily · 07:00 GST",
  },
  {
    slug: "off-plan-watch",
    name: "Off-Plan Watch",
    tagline: "New launches. Real numbers. Honest read.",
    description:
      "Every meaningful new launch in Dubai, Abu Dhabi, and Ras Al Khaimah — payment plan, escrow status, hand-over timeline, developer credit standing. The Notes you wish your broker emailed you.",
    categories: ["launch"],
    gradient:
      "linear-gradient(135deg, rgba(10, 16, 36, 0.08), rgba(10, 16, 36, 0.02))",
    accent: "var(--ink)",
    glyph: "▲",
    cadence: "As launches drop",
  },
  {
    slug: "uhnw-trades",
    name: "UHNW Trades",
    tagline: "AED 25M+ moves. Who. Why. What it means.",
    description:
      "The trophy trades — penthouses on the Palm, mansions on Saadiyat, branded residences in Downtown. Every transaction above AED 25M, who bought, who sold, and what the comp tells you about the next print.",
    categories: ["market-pulse", "developer-corporate"],
    gradient:
      "linear-gradient(135deg, rgba(30, 58, 138, 0.22), rgba(91, 165, 245, 0.06))",
    accent: "var(--gold-rich)",
    glyph: "✦",
    cadence: "Weekly + ad-hoc",
  },
  {
    slug: "sovereign-plays",
    name: "Sovereign Plays",
    tagline: "PIF · Mubadala · ADIA · DH · IFA. What they buy next.",
    description:
      "Tracking sovereign wealth + UAE-holding moves in real estate — Mubadala's Aldar plays, ADQ's Modon, PIF crossings into the UAE, IHC's land bank. The map of what the smart money is doing before the announcement.",
    categories: ["developer-corporate", "infrastructure", "macro"],
    gradient:
      "linear-gradient(135deg, rgba(10, 16, 36, 0.15), rgba(37, 99, 235, 0.05))",
    accent: "var(--navy)",
    glyph: "◈",
    cadence: "Weekly",
  },
  {
    slug: "beyond-the-deal",
    name: "Beyond the Deal",
    tagline: "The newsletter. UHNW intelligence, twice weekly.",
    description:
      "The signature Beyond the Deal newsletter — 1500-word essays on what's actually moving the UAE market. Goes out on LinkedIn first, archived here. The slow-read pair to the daily firehose.",
    categories: ["macro", "policy", "regulatory"],
    gradient:
      "linear-gradient(135deg, rgba(249, 246, 240, 1), rgba(37, 99, 235, 0.15))",
    accent: "var(--gold-deep)",
    glyph: "❖",
    cadence: "Twice weekly · Wed + Sat",
  },
];

export function getVerticalBySlug(slug: string): Vertical | null {
  return VERTICALS.find((v) => v.slug === slug) ?? null;
}
