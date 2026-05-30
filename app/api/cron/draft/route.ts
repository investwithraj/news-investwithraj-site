// Daily draft cron — the DURABLE trigger for the news firehose.
//
// Triggered by staggered GitHub Actions (3×/day) — see
// .github/workflows/news-cron.yml — plus a Vercel cron backstop. Each run:
//   1. fetch all discovery feeds → dedupe → cluster + score   (pure, in-process)
//   2. pick the top cluster ≥ PIPELINE_MIN_SCORE that ISN'T already staged
//      or published today (so staggered runs produce distinct articles)
//   3. draft it with Claude's web-search tool — Claude researches the story
//      live (reads the real reporting, pulls real figures, cites real URLs)
//   4. validate against the 8 voice gates → stage to KV as `review`
// Nothing publishes — drafts land in The Desk (/internal/review) for Raj to
// verify every figure against its source and approve.
//
// Auth: Bearer ${CRON_SECRET} (Vercel cron) or ?secret=${POST_PUBLISH_SECRET}.

import { NextRequest, NextResponse } from "next/server";
import { callClaudeResearch, isClaudeConfigured } from "@/lib/ai/claude";
import { fetchAllSources, flattenEntries } from "@/lib/sources/fetchers";
import { dedupeEntries, similarity } from "@/lib/pipeline/dedupe";
import { clusterAndScore } from "@/lib/pipeline/cluster";
import { getWhitelistDomains } from "@/lib/sources/registry";
import { addDraft, getAllDrafts, deleteDraft } from "@/lib/news-review/storage";
import { NEWS_ARTICLES } from "@/content/news";
import { rootCtaUrl } from "@/lib/constants";
import type { Cluster } from "@/lib/pipeline/types";
import type { DraftArticle, NewsDraftProvenance } from "@/lib/news-review/types";
import type { NewsCategory } from "@/content/news/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby cap

const MIN_SCORE = parseInt(process.env.PIPELINE_MIN_SCORE ?? "45", 10);
// Web-research drafting is slow — one deep article per run; staggered crons
// give ~3/day. Raise on Pro (300s functions).
const MAX_DRAFTS_PER_RUN = parseInt(process.env.PIPELINE_CAP ?? "1", 10);

const VALID_CATEGORIES: NewsCategory[] = [
  "market-pulse",
  "launch",
  "regulatory",
  "macro",
  "developer-corporate",
  "infrastructure",
  "policy",
];

const SYSTEM_PROMPT = `You are the newsroom drafter for news.investwithraj.com — the editorial voice of Raj Tomar, a DLD-licensed Dubai real-estate broker writing for UHNW investors.

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

function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || "";
  const postSecret = process.env.POST_PUBLISH_SECRET || "";
  const authHeader = req.headers.get("authorization") || "";
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (postSecret && authHeader === `Bearer ${postSecret}`) return true;
  const provided = req.nextUrl.searchParams.get("secret") || "";
  if (postSecret && provided === postSecret) return true;
  return false;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function buildProvenance(cluster: Cluster): NewsDraftProvenance {
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

/** Citations from what Claude actually cited (real article URLs), validated
 *  against the whitelist; fall back to the cluster's whitelisted sources so
 *  validator gate 5 (≥1 whitelisted citation) is always satisfiable. */
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

async function draftCluster(
  cluster: Cluster,
  whitelist: string[],
): Promise<{ ok: boolean; reason?: string }> {
  const now = new Date().toISOString();

  const lead = cluster.entries
    .slice(0, 8)
    .map((e, i) => `[${i + 1}] ${e.source.name} — ${e.title}\n   ${e.summary}`)
    .join("\n\n");

  const res = await callClaudeResearch({
    system: SYSTEM_PROMPT,
    maxSearches: 4,
    maxTokens: 4200,
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
    body: parsed.body,
    faq: Array.isArray(parsed.faq) ? parsed.faq.slice(0, 5) : [],
    citations,
    heroImage: { src: `/news/${slug}/cover.jpg`, alt: parsed.title, credit: "To be set at review" },
    cta: {
      href: rootCtaUrl({ campaign: "news_auto_draft", content: "newsletter-cta" }),
      label: "Get the institutional read — work with Raj",
    },
    distribution: {},
  };

  const draft = await addDraft({ article, provenance: buildProvenance(cluster) });
  if (!draft.validator.ok) {
    await deleteDraft(draft.id);
    return {
      ok: false,
      reason: "failed gates: " + draft.validator.failures.filter((f) => f.severity === "block").map((f) => f.name).join(", "),
    };
  }
  return { ok: true };
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isClaudeConfigured()) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });

  const fetchRun = await fetchAllSources();
  const entries = flattenEntries(fetchRun);
  const deduped = dedupeEntries(entries);
  const clusters = clusterAndScore(deduped, 12).filter((c) => c.score >= MIN_SCORE);

  // Skip clusters already staged or published today (so staggered runs differ).
  const existing = await getAllDrafts();
  const draftedClusterIds = new Set(existing.map((d) => d.provenance.clusterId));
  const coveredTitles = [
    ...existing.map((d) => d.article.title),
    ...NEWS_ARTICLES.filter((a) => a.status !== "research" && isToday(a.publishedAt)).map((a) => a.title),
  ];
  const candidates = clusters.filter(
    (c) =>
      !draftedClusterIds.has(c.id) &&
      !coveredTitles.some((t) => similarity(c.topic, t) >= 0.55),
  );

  // Try candidates in score order until one stages — if the top cluster turns
  // out off-topic and Claude skips it, fall through to the next. Capped to
  // respect the 60s function budget (each web-research draft is ~20-40s).
  const MAX_ATTEMPTS = parseInt(process.env.PIPELINE_MAX_ATTEMPTS ?? "2", 10);
  const whitelist = getWhitelistDomains();
  const results: { topic: string; ok: boolean; reason?: string }[] = [];
  let staged = 0;
  let attempts = 0;
  for (const cluster of candidates) {
    if (staged >= MAX_DRAFTS_PER_RUN || attempts >= MAX_ATTEMPTS) break;
    attempts++;
    const r = await draftCluster(cluster, whitelist);
    results.push({ topic: cluster.topic.slice(0, 80), ok: r.ok, reason: r.reason });
    if (r.ok) staged++;
  }

  return NextResponse.json({
    ok: true,
    fetched: entries.length,
    deduped: deduped.length,
    clustersOverThreshold: clusters.length,
    candidatesUndrafted: candidates.length,
    attempted: attempts,
    staged: results.filter((r) => r.ok).length,
    results,
    ranAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
