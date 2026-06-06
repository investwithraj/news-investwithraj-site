// Per-channel draft generators.
//
// Given a NewsArticle, produce a draft post tuned to each platform's:
//   - audience (Reddit casuals vs Quora answer-hunters vs HARO journalists)
//   - tone (subreddit slang vs Q&A polish vs press-release formality)
//   - link rules (Reddit 1-in-10, Quora final-paragraph-only, SE bio-only, etc.)
//
// Output is a list of QueueItem candidates ready to be enqueued. The pipeline
// scores articles, picks the top 3-5 per day, then calls this for each.

import type { NewsArticle } from "@/content/news/types";
import type { QueueChannel, QueueItem } from "./types";
import { SITE } from "@/lib/constants";

export interface DraftSeed {
  channel: QueueChannel;
  target: string; // subreddit name, Quora question slug, etc.
  draftText: string;
  rationale: string;
  sourceArticleSlug: string;
  responseToUrl?: string;
}

// ------------------------------------------------------------------
// Reddit
// ------------------------------------------------------------------

const REDDIT_SUBS = [
  { name: "r/dubai", angle: "Dubai-resident reader, casual but informed" },
  { name: "r/dubairealestate", angle: "owner-operator focused, no-hype tolerated" },
  { name: "r/uaeinvesting", angle: "tax + structure curious investors" },
  { name: "r/realestateinvesting", angle: "US/UK-based investors comparing markets" },
  { name: "r/expats", angle: "relocators evaluating UAE residency" },
];

function buildRedditDraft(article: NewsArticle, sub: { name: string; angle: string }): DraftSeed {
  const headline = article.title;
  const tldr = article.tldr.join(" ");
  const link = `${SITE.url}/news/${article.slug}`;
  const body = [
    `Came across this earlier — sharing because I cover this market full-time and the math here is unusual.`,
    ``,
    `**${headline}**`,
    ``,
    `Quick read of what's in it:`,
    ...article.tldr.map((t) => `- ${t}`),
    ``,
    `What I think actually matters: ${article.body.split("\n\n")[0]?.slice(0, 280) || tldr}`,
    ``,
    `Full breakdown with the source links: ${link}`,
    ``,
    `Happy to answer market questions in comments — I'm DLD-licensed in Dubai.`,
  ].join("\n");

  return {
    channel: "reddit",
    target: sub.name,
    draftText: body,
    rationale: `${sub.angle}. Counter-intuitive lead, value-first body, link buried near the end — passes the 1-in-10 self-promo rule.`,
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// Quora
// ------------------------------------------------------------------

function buildQuoraDraft(article: NewsArticle): DraftSeed {
  const link = `${SITE.url}/news/${article.slug}`;
  const body = [
    `**TL;DR:** ${article.tldr[0] || article.subtitle || ""}`,
    ``,
    `Here's the longer answer.`,
    ``,
    article.body.split("\n\n").slice(0, 3).join("\n\n"),
    ``,
    `A few specifics worth noting:`,
    ...article.tldr.slice(1, 3).map((t) => `- ${t}`),
    ``,
    `I cover Dubai + UAE real estate full-time (real-estate consultant). If you want my full breakdown with the underlying source documents, I keep it up to date here: ${link}`,
  ].join("\n");

  return {
    channel: "quora",
    target: "Dubai real estate / UAE investing topic",
    draftText: body,
    rationale: "TL;DR-first format, link in final paragraph only (Quora policy compliant), 400-600 word answer length proven to rank.",
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// HARO / Qwoted / Featured
// ------------------------------------------------------------------

function buildHaroDraft(article: NewsArticle): DraftSeed {
  const quote = [
    `"${article.tldr[0] || article.subtitle || ""}`,
    ``,
    `${article.body.split("\n\n")[0]?.slice(0, 280) || ""}`,
    ``,
    `The key number is in the data: ${article.tldr.find((t) => /\d/.test(t)) || article.tldr[0] || ""}."`,
    ``,
    `— Raj Tomar, real-estate consultant, Dubai. Cover ${article.market.slice(0, 2).join(" + ")} as a full-time mandate.`,
    ``,
    `Bio: Founder, news.investwithraj.com. Daily UAE real-estate intelligence for UHNW investors. Linked sources: ${SITE.url}/news/${article.slug}`,
  ].join("\n");

  return {
    channel: "haro",
    target: "HARO journalist query (manually matched)",
    draftText: quote,
    rationale: "Quote-first format, ≤200 words, includes credentials + bio. Journalist can paste directly into a story.",
    sourceArticleSlug: article.slug,
  };
}

function buildQwotedDraft(article: NewsArticle): DraftSeed {
  return { ...buildHaroDraft(article), channel: "qwoted", target: "Qwoted source pitch" };
}

function buildFeaturedDraft(article: NewsArticle): DraftSeed {
  const link = `${SITE.url}/news/${article.slug}`;
  const body = [
    `Question prompt: [insert prompt from Featured.com]`,
    ``,
    `My take:`,
    ``,
    article.body.split("\n\n").slice(0, 2).join("\n\n"),
    ``,
    `Source: ${link}`,
    `— Raj Tomar, real-estate consultant, Dubai`,
  ].join("\n");

  return {
    channel: "featured",
    target: "Featured.com expert prompt",
    draftText: body,
    rationale: "Expert quote-DB format. 200-300 words, attributed quote-style, source line for verification.",
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// Stack Exchange (Money.SE, Personal Finance.SE)
// ------------------------------------------------------------------

function buildStackExchangeDraft(article: NewsArticle): DraftSeed {
  const body = [
    `The relevant data here is: ${article.tldr.find((t) => /\d/.test(t)) || article.tldr[0] || ""}`,
    ``,
    article.body.split("\n\n").slice(0, 3).join("\n\n"),
    ``,
    `Sources used in this answer:`,
    ...article.citations.slice(0, 3).map((c) => `- [${c.source}](${c.url})`),
    ``,
    `(No promo link in the answer body — SE policy. My profile bio links to my newsroom.)`,
  ].join("\n");

  return {
    channel: "stackexchange",
    target: "money.stackexchange.com / personal-finance",
    draftText: body,
    rationale: "Cited answer with source links inline. No promo URL in body (SE rule). Profile bio carries the brand link.",
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// BiggerPockets / PropertyHub
// ------------------------------------------------------------------

function buildBiggerPocketsDraft(article: NewsArticle): DraftSeed {
  const link = `${SITE.url}/news/${article.slug}`;
  const body = [
    `Posting this for the international-curious folks on BP — Dubai dropped some moves this week worth knowing if you've ever wondered about adding UAE exposure to a portfolio.`,
    ``,
    `**${article.title}**`,
    ``,
    ...article.tldr.map((t) => `- ${t}`),
    ``,
    `Key differences vs US market:`,
    `- 0% income tax on rent for individuals`,
    `- Escrowed off-plan structure (developer can't touch funds until milestones)`,
    `- Foreign freehold legal since 2002`,
    ``,
    `Full data + citations: ${link}`,
    ``,
    `Not soliciting — just sharing the data. Happy to answer market questions.`,
  ].join("\n");

  return {
    channel: "biggerpockets",
    target: "BiggerPockets International Investing forum",
    draftText: body,
    rationale: "US-investor framing. Educational, not transactional. Comparison angle (Dubai vs US) primes engagement.",
    sourceArticleSlug: article.slug,
  };
}

function buildPropertyHubDraft(article: NewsArticle): DraftSeed {
  const link = `${SITE.url}/news/${article.slug}`;
  const body = [
    `For the UK members watching UAE as a non-dom or expat play — this week's data point worth flagging:`,
    ``,
    `**${article.title}**`,
    ``,
    article.tldr.join("\n"),
    ``,
    `UK-investor specific notes:`,
    `- UK CGT still applies if you're UK-resident, but UAE-resident expats clear of it`,
    `- DTAA between UK ↔ UAE prevents double tax on rental income`,
    ``,
    `Full breakdown: ${link}`,
  ].join("\n");

  return {
    channel: "propertyhub",
    target: "PropertyHub UK — International forum",
    draftText: body,
    rationale: "UK-expat tax angle. Direct relevance to forum's resident-non-dom debate.",
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// Discord investor servers
// ------------------------------------------------------------------

function buildDiscordInvestorDraft(article: NewsArticle): DraftSeed {
  const link = `${SITE.url}/news/${article.slug}`;
  const body = [
    `Dubai market update worth flagging:`,
    ``,
    `**${article.title}**`,
    article.tldr.slice(0, 2).join(" — "),
    ``,
    `Full data: ${link}`,
  ].join("\n");

  return {
    channel: "discord-investor",
    target: "[insert Discord server name]",
    draftText: body,
    rationale: "Short, server-friendly. Lead with data. Check #rules-channel before posting.",
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// LinkedIn comment
// ------------------------------------------------------------------

function buildLinkedinCommentDraft(article: NewsArticle): DraftSeed {
  const body = [
    `Adding a data point that backs this up — ${article.tldr.find((t) => /\d/.test(t)) || article.tldr[0] || ""}.`,
    ``,
    `Worth noting because [reason specific to the original post — fill in].`,
  ].join("\n");

  return {
    channel: "linkedin-comment",
    target: "[paste URL of UHNW thought-leader's post to comment on]",
    draftText: body,
    rationale: "Adds value, no plug. Strategic comments on UHNW posts compound discovery faster than own-feed posting.",
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// Twitter reply
// ------------------------------------------------------------------

function buildTwitterReplyDraft(article: NewsArticle): DraftSeed {
  const link = `${SITE.url}/news/${article.slug}`;
  // First TLDR, link, fit in 280
  const t = article.tldr[0] || article.subtitle || article.title;
  const truncated = t.length > 200 ? t.slice(0, 197) + "…" : t;
  const body = `${truncated}\n\nFull data: ${link}`;

  return {
    channel: "twitter-reply",
    target: "[paste X/Twitter thread URL to reply to]",
    draftText: body,
    rationale: "Short, data-led. 280-char fit. Reply within 1hr of original for max algo lift.",
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// Telegram group
// ------------------------------------------------------------------

function buildTelegramGroupDraft(article: NewsArticle): DraftSeed {
  const link = `${SITE.url}/news/${article.slug}`;
  const body = [
    `📊 ${article.title}`,
    ``,
    article.tldr.map((t) => `• ${t}`).join("\n"),
    ``,
    `Full breakdown: ${link}`,
  ].join("\n");

  return {
    channel: "telegram-group",
    target: "[insert Telegram group name + admin check]",
    draftText: body,
    rationale: "Data-led, no soft sell. Check group admin rules before posting.",
    sourceArticleSlug: article.slug,
  };
}

// ------------------------------------------------------------------
// Public — generate all drafts for one article
// ------------------------------------------------------------------

/**
 * Generate per-channel drafts for one article. The caller decides which
 * subset to actually enqueue (e.g. only the top 2-3 channels per article
 * to avoid drowning the queue).
 */
export function generateDraftsForArticle(article: NewsArticle): DraftSeed[] {
  const drafts: DraftSeed[] = [];

  // Reddit — generate one per relevant sub
  for (const sub of REDDIT_SUBS) {
    drafts.push(buildRedditDraft(article, sub));
  }

  // One-each for the rest
  drafts.push(buildQuoraDraft(article));
  drafts.push(buildHaroDraft(article));
  drafts.push(buildQwotedDraft(article));
  drafts.push(buildFeaturedDraft(article));
  drafts.push(buildStackExchangeDraft(article));
  drafts.push(buildBiggerPocketsDraft(article));
  drafts.push(buildPropertyHubDraft(article));
  drafts.push(buildDiscordInvestorDraft(article));
  drafts.push(buildLinkedinCommentDraft(article));
  drafts.push(buildTwitterReplyDraft(article));
  drafts.push(buildTelegramGroupDraft(article));

  return drafts;
}

/**
 * Top-N selector — for each article, pick the highest-leverage channels.
 * Currently: Reddit r/dubairealestate + Quora + HARO + LinkedIn comment.
 * Caller passes the list of channels they want.
 */
export function selectTopDrafts(
  drafts: DraftSeed[],
  channels: QueueChannel[] = ["reddit", "quora", "haro", "linkedin-comment"]
): DraftSeed[] {
  return drafts.filter((d) => channels.includes(d.channel));
}

/**
 * Convenience — convert DraftSeeds to QueueItem partials (ready for storage.addItems).
 * Status / createdAt / expiresAt / id assigned by storage layer.
 */
export function toQueuePartials(
  drafts: DraftSeed[]
): Array<Omit<QueueItem, "id" | "createdAt" | "expiresAt" | "status">> {
  return drafts.map((d) => ({
    channel: d.channel,
    target: d.target,
    draftText: d.draftText,
    rationale: d.rationale,
    sourceArticleSlug: d.sourceArticleSlug,
    responseToUrl: d.responseToUrl,
  }));
}
