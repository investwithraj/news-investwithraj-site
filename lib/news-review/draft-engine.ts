// Shared drafting engine — the web-research draft logic, decoupled from where
// it runs. Used by both:
//   • app/api/cron/draft (Vercel) — fast/fallback, but capped at 60s so the
//     web-research path usually times out on Hobby;
//   • scripts/draft-once.ts (GitHub Actions runner) — no time limit, the real
//     daily driver; it POSTs the finished draft to /api/news/draft.
//
// draftFromCluster does research → parse → build article → validate, and
// returns the article + provenance (it does NOT stage — the caller decides
// how: addDraft() server-side, or POST to the endpoint from CI).

import { callClaudeResearch } from "@/lib/ai/claude";
import { validateDraft, type DraftArticle as ValidatorInput } from "@/lib/voice/validator";
import { fetchArticleText } from "@/lib/sources/extract";
import { rootCtaUrl } from "@/lib/constants";
import type { Cluster } from "@/lib/pipeline/types";
import type { DraftArticle, NewsDraftProvenance } from "./types";
import type { NewsCategory } from "@/content/news/types";

const VALID_CATEGORIES: NewsCategory[] = [
  "market-pulse", "launch", "regulatory", "macro",
  "developer-corporate", "infrastructure", "policy",
];

export const DRAFT_SYSTEM_PROMPT = `You are the newsroom drafter for news.investwithraj.com — the editorial voice of Raj Tomar, a DLD-licensed Dubai real-estate broker writing for UHNW investors.

You are given a story lead (a cluster of headlines + snippets). RESEARCH it with web search: find the primary reporting, read the real articles, and gather verifiable facts (figures, names, dates, locations, quotes). Then draft the article.

ABSOLUTE RULES (a draft that breaks these is rejected):
- Every number, name, and claim must come from a real source you found via search. NEVER invent or estimate a figure.
- If, after searching, you cannot verify enough for a defensible 650+ word article, return {"skip": true, "reason": "..."} and nothing else.
- UK English. Em-dashes — like this — are signature; use several.
- The FIRST paragraph must contain a specific, sourced number.
- Banned: synergy, unlock value, platform play, 10x, passive income, amazing, incredible, guaranteed, risk-free, game-changer, "in today's market", "no-brainer", "don't miss out".
- Use the analytical register (≥3): thesis, mandate, structural, absorption, catalyst, compression, precinct, typology, archetype, basis points/bps, sovereign-backed, escrow, payment plan, secondary market.
- Body 650–1100 words. No markdown headings — paragraphs separated by blank lines.

OUTPUT: a single JSON object, no prose, no code fences:
{
  "skip": false,
  "title": "headline ≤ 88 characters",
  "subtitle": "one-line dek",
  "tldr": ["≤140 chars", "≤140 chars", "≤140 chars"],
  "body": "the article, paragraphs separated by \\n\\n",
  "faq": [{"q": "...", "a": "..."}, {"q": "...", "a": "..."}],
  "citations": [{"source": "Publisher name", "url": "https://real-article-url"}]
}
Include 2–5 citations — the actual article URLs you used.`;

interface DraftJson {
  skip?: boolean;
  reason?: string;
  title?: string;
  subtitle?: string;
  tldr?: string[];
  body?: string;
  faq?: { q: string; a: string }[];
  citations?: { source?: string; url?: string }[];
}

export interface DraftAttempt {
  ok: boolean;
  reason?: string;
  article?: DraftArticle;
  provenance?: NewsDraftProvenance;
}

export interface DraftOpts {
  model?: string;
  maxSearches?: number;
  maxTokens?: number;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function buildProvenance(cluster: Cluster): NewsDraftProvenance {
  return {
    clusterId: cluster.id,
    topic: cluster.topic,
    score: cluster.score,
    scoreBreakdown: cluster.scoreBreakdown,
    sources: cluster.entries.slice(0, 12).map((e) => ({
      name: e.source.name,
      tier: e.source.tier,
      url: e.url,
      summary: e.summary,
      publishedAt: e.publishedAt,
    })),
  };
}

function buildCitations(
  claudeCites: DraftJson["citations"],
  cluster: Cluster,
  whitelist: string[],
  now: string,
): { source: string; url: string; accessedAt: string }[] {
  const out: { source: string; url: string; accessedAt: string }[] = [];
  const seen = new Set<string>();
  const isWhitelisted = (u: string) => {
    try {
      const h = new URL(u).hostname.replace(/^www\./, "");
      return whitelist.some((w) => h === w || h.endsWith(`.${w}`));
    } catch {
      return false;
    }
  };
  for (const c of claudeCites ?? []) {
    if (!c.url || !/^https?:\/\//i.test(c.url) || seen.has(c.url)) continue;
    if (!isWhitelisted(c.url)) continue;
    seen.add(c.url);
    out.push({ source: c.source || new URL(c.url).hostname.replace(/^www\./, ""), url: c.url, accessedAt: now });
  }
  if (out.length === 0) {
    for (const e of cluster.entries) {
      const d = e.source.domain.replace(/^www\./, "");
      if (!whitelist.includes(d) || seen.has(d)) continue;
      seen.add(d);
      out.push({ source: e.source.name, url: `https://${d}/`, accessedAt: now });
      if (out.length >= 3) break;
    }
  }
  return out.slice(0, 5);
}

/** Research a cluster with web search and build a validated article. Returns
 *  the article + provenance (caller stages it); ok=false on skip / fail. */
export async function draftFromCluster(
  cluster: Cluster,
  whitelist: string[],
  opts: DraftOpts = {},
): Promise<DraftAttempt> {
  const now = new Date().toISOString();
  const lead = cluster.entries
    .slice(0, 8)
    .map((e, i) => `[${i + 1}] ${e.source.name} — ${e.title}\n   ${e.summary}`)
    .join("\n\n");

  const res = await callClaudeResearch({
    model: opts.model,
    system: DRAFT_SYSTEM_PROMPT,
    maxSearches: opts.maxSearches ?? 4,
    maxTokens: opts.maxTokens ?? 4200,
    temperature: 0.4,
    messages: [
      {
        role: "user",
        content: `STORY LEAD: ${cluster.topic}\nMarkets: ${cluster.suggestedMarkets.join(", ")}\n\nHEADLINES + SNIPPETS:\n\n${lead}\n\nResearch this story with web search, then output the article JSON.`,
      },
    ],
  });

  if (!res.ok || !res.text) return { ok: false, reason: res.error ?? "no text" };

  let parsed: DraftJson;
  try {
    const m = res.text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : res.text);
  } catch {
    return { ok: false, reason: "unparseable JSON" };
  }
  if (parsed.skip || !parsed.title || !parsed.body || !Array.isArray(parsed.tldr)) {
    return { ok: false, reason: parsed.reason ?? "drafter skipped (unverifiable)" };
  }

  // web_search wraps cited spans in <cite index="…">…</cite>. Capture that text
  // (the figures Claude attributed to a source) for the cockpit's verify gate,
  // then strip the tags so the published body is clean prose.
  const citedText = (parsed.body.match(/<cite[^>]*>[\s\S]*?<\/cite>/gi) ?? [])
    .map((m) => m.replace(/<[^>]+>/g, ""))
    .join("  ");
  const cleanBody = parsed.body
    .replace(/<cite[^>]*>/gi, "")
    .replace(/<\/cite>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  const citations = buildCitations(parsed.citations, cluster, whitelist, now);
  if (citations.length === 0) return { ok: false, reason: "no whitelisted citation" };

  const category: NewsCategory = VALID_CATEGORIES.includes(cluster.suggestedCategory as NewsCategory)
    ? (cluster.suggestedCategory as NewsCategory)
    : "market-pulse";
  const today = now.slice(0, 10);
  const tldr3 = [parsed.tldr[0] ?? "", parsed.tldr[1] ?? "", parsed.tldr[2] ?? ""] as [string, string, string];
  const slug = `${today}-${slugify(parsed.title)}`;

  const article: DraftArticle = {
    slug,
    title: parsed.title.slice(0, 90),
    subtitle: parsed.subtitle ?? "",
    publishedAt: now,
    modifiedAt: now,
    displayDate: new Date(now).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    author: "raj-tomar",
    tier: "news",
    category,
    market: cluster.suggestedMarkets,
    tldr: tldr3,
    body: cleanBody,
    faq: Array.isArray(parsed.faq) ? parsed.faq.slice(0, 5) : [],
    citations,
    heroImage: { src: `/news/${slug}/cover.jpg`, alt: parsed.title, credit: "To be set at review" },
    cta: {
      href: rootCtaUrl({ campaign: "news_auto_draft", content: "newsletter-cta" }),
      label: "Get the institutional read — work with Raj",
    },
    distribution: {},
  };

  const validation = validateDraft(article as unknown as ValidatorInput);
  if (!validation.ok) {
    return {
      ok: false,
      reason: "failed gates: " + validation.failures.filter((f) => f.severity === "block").map((f) => f.name).join(", "),
    };
  }

  // Provenance = the cluster's sources + the sources Claude actually used
  // (its citations + the URLs web_search surfaced), so the cockpit's source
  // rail reflects the real research — not just the one thin cluster entry.
  const provenance = buildProvenance(cluster);
  const seenUrls = new Set(provenance.sources.map((s) => s.url));
  const extra: typeof provenance.sources = [];
  // Fetch the REAL text of each cited article so the cockpit verifies figures
  // against the actual reporting, not a snippet (the autochecker's teeth).
  const citedTexts = await Promise.all(
    citations.map(async (c) => ({ c, text: await fetchArticleText(c.url) })),
  );
  for (const { c, text } of citedTexts) {
    if (seenUrls.has(c.url)) continue;
    seenUrls.add(c.url);
    extra.push({
      name: c.source,
      tier: "national-press",
      url: c.url,
      summary: text || "Cited in the article — figures drawn from this source.",
    });
  }
  for (const u of res.searchedUrls ?? []) {
    if (seenUrls.has(u)) continue;
    seenUrls.add(u);
    let name = u;
    try {
      name = new URL(u).hostname.replace(/^www\./, "");
    } catch {
      /* keep raw */
    }
    extra.push({ name, tier: "national-press", url: u, summary: "Consulted during web research." });
  }
  provenance.sources = [...provenance.sources, ...extra].slice(0, 24);
  provenance.citedText = citedText;

  return { ok: true, article, provenance };
}
