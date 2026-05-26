// Per-platform content transformation. Applies Voice Profile's per-surface
// tone variations from lib/voice/raj-profile.md.
//
// Inputs: NewsArticle + canonical URL
// Outputs: ContentVariant for each requested channel
//
// Voice rules per surface (from raj-profile.md "Per-surface tone" table):
//   LinkedIn post — lead with most counter-intuitive line, 1300c max
//   X — compressed single insight + a number, 280c
//   FB — same as LinkedIn but tighter, photo-led
//   IG feed — caption ≤ 2200c (effective ~200w), photo-led
//   IG Stories — single image + 1-2 line punch
//   Threads — 500c, conversational
//   TikTok — vertical video script (40-60s)
//   Pinterest — title + image + description
//   BlueSky — 300c, similar to X but slightly more relaxed
//   Mastodon — 500c
//   YouTube Shorts — vertical video script

import type { NewsArticle } from "@/content/news/types";
import type { Channel, ContentVariant } from "./types";

/** Canonical UTM-tagged article URL for the lead-back CTA */
export function articleUrl(
  article: NewsArticle,
  channel: Channel
): string {
  // article.cta.href is already UTM-tagged for the lead-back to IWR root
  // but for the article URL itself we want channel-specific UTM tracking
  const base = new URL(
    `${process.env.NEXT_PUBLIC_SITE_URL || "https://news.investwithraj.com"}/news/${article.slug}`
  );
  base.searchParams.set("utm_source", channel);
  base.searchParams.set("utm_medium", "social");
  base.searchParams.set("utm_campaign", article.slug);
  return base.toString();
}

/** Extract the first hard number from article body — for X / Threads hooks. */
function extractLeadNumber(article: NewsArticle): string | null {
  const figureRe = /(AED|aed|USD|usd|\$|€)\s*\d+(?:[.,]\d+)?\s*(?:M|B|K|million|billion|thousand)\b/;
  const m = article.body.match(figureRe);
  return m ? m[0] : null;
}

/** Build canonical hashtag set per article — market + category + brand */
function defaultHashtags(article: NewsArticle): string[] {
  const tags: string[] = [];
  for (const m of article.market) {
    if (m === "UAE") tags.push("UAE");
    if (m === "Dubai") tags.push("DubaiRealEstate");
    if (m === "Abu Dhabi") tags.push("AbuDhabiRealEstate");
    if (m === "Ras Al Khaimah") tags.push("RAK", "WynnAlMarjan");
  }
  if (article.category === "launch") tags.push("OffPlan");
  if (article.category === "regulatory") tags.push("DLD", "RERA");
  if (article.category === "developer-corporate") tags.push("Real Estate");
  tags.push("InvestWithRaj");
  return [...new Set(tags)];
}

/** Truncate at word boundary to fit a char limit. Reserves space for ellipsis + link. */
function truncate(text: string, maxChars: number, reservedForLink = 0): string {
  const budget = maxChars - reservedForLink - 4; // 4 for "… "
  if (text.length <= budget) return text;
  const cut = text.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

/* ─── Per-platform builders ─────────────────────────────────────────── */

function buildLinkedIn(article: NewsArticle, link: string): ContentVariant {
  // LinkedIn allows ~3000c but ~1300c is the practical "above the fold" target.
  // Lead with the article's most counter-intuitive line from the body's
  // second paragraph (often where the inversion sits — "The thesis is not X.
  // The thesis is Y."). Fallback to subtitle if body doesn't have a clear hook.
  const paragraphs = article.body.split(/\n\n/);
  const hook = paragraphs[1]?.split(". ").slice(0, 2).join(". ") || article.subtitle;
  const body = `${article.title}\n\n${hook}\n\n${article.tldr.slice(0, 2).join("\n\n")}`;
  const text = truncate(body, 1300, link.length + 4);
  return {
    channel: "linkedin-personal",
    text: `${text}\n\nRead the full read → ${link}`,
    hashtags: defaultHashtags(article).slice(0, 4),
    link,
  };
}

function buildX(article: NewsArticle, link: string): ContentVariant {
  // X cap = 280 chars including link (X auto-shortens to 23 chars)
  // Lead with the lead number if we can find one, else with subtitle.
  const leadNum = extractLeadNumber(article);
  const hook = leadNum
    ? `${leadNum} — ${article.tldr[0]}`
    : article.tldr[0];
  const reserved = 23 + 2; // X shortens links to 23 chars + " " before link
  const text = truncate(hook, 280, reserved);
  return {
    channel: "x",
    text: `${text}\n${link}`,
    link,
  };
}

function buildFacebook(article: NewsArticle, link: string): ContentVariant {
  // FB doesn't penalize length but algorithm favors 80-200 chars + image
  const text = truncate(article.subtitle, 200);
  return {
    channel: "facebook",
    text: `${article.title}\n\n${text}\n\n${link}`,
    hashtags: defaultHashtags(article).slice(0, 3),
    imageUrl: article.heroImage.src,
    link,
  };
}

function buildInstagramFeed(article: NewsArticle, link: string): ContentVariant {
  // IG feed: photo + caption (~200 words ideal, hashtags in first comment)
  const text = `${article.title}\n\n${truncate(article.subtitle, 800)}\n\n${article.tldr[0]}\n\n${article.tldr[1]}\n\nFull read at the link in bio — news.investwithraj.com`;
  return {
    channel: "instagram-feed",
    text,
    hashtags: defaultHashtags(article).slice(0, 10),
    imageUrl: article.heroImage.src,
    // IG strips outbound links from captions, use "link in bio" pattern
  };
}

function buildInstagramStories(article: NewsArticle, link: string): ContentVariant {
  return {
    channel: "instagram-stories",
    text: `${article.title}\n\n${article.tldr[0]}`,
    imageUrl: article.heroImage.src,
    link, // IG Stories support outbound link sticker on Business accounts
  };
}

function buildThreads(article: NewsArticle, link: string): ContentVariant {
  // Threads: 500c, conversational
  const text = truncate(`${article.title}\n\n${article.tldr[0]}`, 500, link.length + 2);
  return {
    channel: "threads",
    text: `${text}\n${link}`,
    link,
  };
}

function buildTikTok(article: NewsArticle, link: string): ContentVariant {
  // TikTok: video caption. The video itself is produced separately
  // (out of scope here — Block 2.5 ships caption only, video pipeline
  // is future-Raj-prep work via the broadcast-reel skill).
  return {
    channel: "tiktok",
    text: `${article.title}\n\n${article.tldr[0]}\n\nFull read → ${link}`,
    hashtags: [...defaultHashtags(article).slice(0, 4), "RealEstateUAE", "PropertyTok"],
  };
}

function buildPinterest(article: NewsArticle, link: string): ContentVariant {
  // Pinterest: title + image + description (the description is the "pin" content)
  return {
    channel: "pinterest",
    text: `${article.subtitle}\n\nRead more at news.investwithraj.com`,
    hashtags: defaultHashtags(article).slice(0, 3),
    imageUrl: article.heroImage.src,
    link,
  };
}

function buildBlueSky(article: NewsArticle, link: string): ContentVariant {
  // BlueSky: 300c
  const text = truncate(`${article.title}\n\n${article.tldr[0]}`, 300, link.length + 2);
  return {
    channel: "bluesky",
    text: `${text}\n${link}`,
    link,
  };
}

function buildMastodon(article: NewsArticle, link: string): ContentVariant {
  // Mastodon: 500c default
  const text = truncate(`${article.title}\n\n${article.tldr[0]}`, 500, link.length + 2);
  return {
    channel: "mastodon",
    text: `${text}\n${link}`,
    hashtags: defaultHashtags(article).slice(0, 3),
    link,
  };
}

function buildYouTubeShorts(article: NewsArticle, link: string): ContentVariant {
  return {
    channel: "youtube-shorts",
    text: `${article.title}\n\n${article.tldr[0]}\n\nFull written read → ${link}`,
    hashtags: [...defaultHashtags(article).slice(0, 4), "Shorts"],
  };
}

function buildTelegram(article: NewsArticle, link: string): ContentVariant {
  // Telegram: HTML-supported, ~4096 char per message. Markdown-style preview
  // looks best. We send the full TLDR + a link card.
  const text = `<b>${escapeHtml(article.title)}</b>\n\n${escapeHtml(article.tldr.join("\n\n"))}\n\n<a href="${link}">Read the full read →</a>`;
  return {
    channel: "telegram",
    text,
    link,
  };
}

function buildDiscord(article: NewsArticle, link: string): ContentVariant {
  // Discord: 2000c per message. Embed gets richer rendering.
  return {
    channel: "discord",
    text: `**${article.title}**\n\n${article.tldr[0]}\n\n${link}`,
    link,
    imageUrl: article.heroImage.src,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ─── Main entrypoint ────────────────────────────────────────────────── */

/**
 * Build per-channel content variants from a news article.
 * Returns one ContentVariant per requested channel.
 */
export function buildVariants(
  article: NewsArticle,
  channels: Channel[]
): ContentVariant[] {
  return channels
    .map((channel) => {
      const link = articleUrl(article, channel);
      switch (channel) {
        case "linkedin-personal":
        case "linkedin-company":
          return { ...buildLinkedIn(article, link), channel };
        case "x":
          return buildX(article, link);
        case "facebook":
          return buildFacebook(article, link);
        case "instagram-feed":
          return buildInstagramFeed(article, link);
        case "instagram-stories":
          return buildInstagramStories(article, link);
        case "threads":
          return buildThreads(article, link);
        case "tiktok":
          return buildTikTok(article, link);
        case "pinterest":
          return buildPinterest(article, link);
        case "bluesky":
          return buildBlueSky(article, link);
        case "mastodon":
          return buildMastodon(article, link);
        case "youtube-shorts":
          return buildYouTubeShorts(article, link);
        case "telegram":
          return buildTelegram(article, link);
        case "discord":
          return buildDiscord(article, link);
      }
    })
    .filter((v): v is ContentVariant => v !== undefined);
}
