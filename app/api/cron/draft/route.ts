// Daily draft cron — the DURABLE trigger for the news firehose.
//
// Runs server-side on Vercel cron (no machine dependency, no 7-day expiry —
// unlike a Claude Code CronCreate task). Each run:
//   1. fetch all discovery feeds → dedupe → cluster + score   (pure, in-process)
//   2. take the top clusters ≥ PIPELINE_MIN_SCORE
//   3. draft each via the Claude API, grounded ONLY in the fetched snippets
//   4. validate against the 8 voice gates
//   5. stage passing drafts into KV as `review`
// Nothing publishes — drafts land in The Desk (/internal/review) for Raj to
// verify every figure against its source and approve. The review gate + the
// "use only provided facts" instruction + the validator are the three guards
// against fabrication.
//
// Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`. Manual runs
// use ?secret=${POST_PUBLISH_SECRET}.

import { NextRequest, NextResponse } from "next/server";
import { callClaude, isClaudeConfigured } from "@/lib/ai/claude";
import {
  fetchAllSources,
  flattenEntries,
} from "@/lib/sources/fetchers";
import { dedupeEntries } from "@/lib/pipeline/dedupe";
import { clusterAndScore } from "@/lib/pipeline/cluster";
import { getWhitelistDomains } from "@/lib/sources/registry";
import { addDraft } from "@/lib/news-review/storage";
import { rootCtaUrl } from "@/lib/constants";
import type { Cluster } from "@/lib/pipeline/types";
import type { DraftArticle, NewsDraftProvenance } from "@/lib/news-review/types";
import type { NewsCategory } from "@/content/news/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_SCORE = parseInt(process.env.PIPELINE_MIN_SCORE ?? "50", 10);
const MAX_DRAFTS_PER_RUN = parseInt(process.env.PIPELINE_CAP ?? "3", 10);

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

You will be given a cluster of real news snippets about one story. Draft a news article from them.

ABSOLUTE RULES (a draft that breaks these is useless — it will be rejected):
- Use ONLY facts, numbers, names, places, and dates that appear in the provided snippets. NEVER invent or estimate a figure. Every number you write must trace to a snippet.
- If the snippets do not contain enough verifiable detail for a defensible 600+ word article, return {"skip": true, "reason": "..."} and nothing else. Do not pad.
- UK English. Em-dashes — like this — are signature; use several.
- The FIRST paragraph must contain a specific number drawn from the snippets.
- Banned words: synergy, unlock value, platform play, 10x, passive income, amazing, incredible, guaranteed, risk-free, game-changer, "in today's market", "no-brainer", "don't miss out".
- Use the analytical register: thesis, mandate, structural, absorption, catalyst, compression, precinct, typology, archetype, basis points/bps, sovereign-backed, escrow, payment plan, secondary market. Use at least three of these.
- Body 650–1100 words. No markdown headings — paragraphs separated by blank lines.

OUTPUT: a single JSON object, no prose, no code fences:
{
  "skip": false,
  "title": "headline ≤ 88 characters",
  "subtitle": "one-line dek",
  "tldr": ["bullet 1 ≤140 chars", "bullet 2", "bullet 3"],
  "body": "the article body, paragraphs separated by \\n\\n",
  "faq": [{"q": "...", "a": "..."}, {"q": "...", "a": "..."}]
}`;

interface DraftJson {
  skip?: boolean;
  reason?: string;
  title?: string;
  subtitle?: string;
  tldr?: string[];
  body?: string;
  faq?: { q: string; a: string }[];
}

function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || "";
  const postSecret = process.env.POST_PUBLISH_SECRET || "";
  const authHeader = req.headers.get("authorization") || "";
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (postSecret && authHeader === `Bearer ${postSecret}`) return true;
  const provided = req.nextUrl.searchParams.get("secret") || "";
  if (postSecret && provided === postSecret) return true;
  // If neither secret is configured, refuse (don't expose an open drafter).
  return false;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

/** Build the citation list deterministically from the cluster's whitelisted
 *  sources — Claude never invents citations. ≥1 required (validator gate 5). */
function buildCitations(cluster: Cluster, whitelist: string[], now: string) {
  const seen = new Set<string>();
  const cites: { source: string; url: string; accessedAt: string }[] = [];
  for (const e of cluster.entries) {
    const d = e.source.domain.replace(/^www\./, "");
    if (!whitelist.includes(d) || seen.has(d)) continue;
    seen.add(d);
    cites.push({ source: e.source.name, url: `https://${d}/`, accessedAt: now });
    if (cites.length >= 4) break;
  }
  return cites;
}

async function draftCluster(
  cluster: Cluster,
  whitelist: string[],
): Promise<{ ok: boolean; reason?: string }> {
  const now = new Date().toISOString();

  const citations = buildCitations(cluster, whitelist, now);
  if (citations.length === 0) {
    return { ok: false, reason: "no whitelisted source in cluster" };
  }

  const snippetBlock = cluster.entries
    .slice(0, 10)
    .map(
      (e, i) =>
        `[${i + 1}] ${e.source.name} (${e.publishedAt.slice(0, 10)})\n   ${e.title}\n   ${e.summary}`,
    )
    .join("\n\n");

  const res = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `STORY CLUSTER: ${cluster.topic}\nMarkets: ${cluster.suggestedMarkets.join(", ")}\n\nSNIPPETS (your only source of facts):\n\n${snippetBlock}\n\nDraft the article as JSON now.`,
      },
    ],
    maxTokens: 3200,
    temperature: 0.4,
  });

  if (!res.ok || !res.text) return { ok: false, reason: res.error ?? "no text" };

  let parsed: DraftJson;
  try {
    const json = res.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "unparseable JSON" };
  }

  if (parsed.skip || !parsed.title || !parsed.body || !Array.isArray(parsed.tldr)) {
    return { ok: false, reason: parsed.reason ?? "drafter skipped (insufficient facts)" };
  }

  const category: NewsCategory = VALID_CATEGORIES.includes(
    cluster.suggestedCategory as NewsCategory,
  )
    ? (cluster.suggestedCategory as NewsCategory)
    : "market-pulse";

  const today = now.slice(0, 10);
  const tldr3 = [parsed.tldr[0] ?? "", parsed.tldr[1] ?? "", parsed.tldr[2] ?? ""] as [
    string,
    string,
    string,
  ];

  const article: DraftArticle = {
    slug: `${today}-${slugify(parsed.title)}`,
    title: parsed.title.slice(0, 90),
    subtitle: parsed.subtitle ?? "",
    publishedAt: now,
    modifiedAt: now,
    displayDate: new Date(now).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    author: "raj-tomar",
    tier: "news",
    category,
    market: cluster.suggestedMarkets,
    tldr: tldr3,
    body: parsed.body,
    faq: Array.isArray(parsed.faq) ? parsed.faq.slice(0, 5) : [],
    citations,
    heroImage: {
      src: `/news/${today}-${slugify(parsed.title)}/cover.jpg`,
      alt: parsed.title,
      credit: "To be set at review",
    },
    cta: {
      href: rootCtaUrl({ campaign: "news_auto_draft", content: "newsletter-cta" }),
      label: "Get the institutional read — work with Raj",
    },
    distribution: {},
  };

  const draft = await addDraft({ article, provenance: buildProvenance(cluster) });

  // Only keep drafts that pass the 8 gates; otherwise drop (keeps the desk clean).
  if (!draft.validator.ok) {
    const { deleteDraft } = await import("@/lib/news-review/storage");
    await deleteDraft(draft.id);
    return {
      ok: false,
      reason:
        "failed gates: " +
        draft.validator.failures.filter((f) => f.severity === "block").map((f) => f.name).join(", "),
    };
  }

  return { ok: true };
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isClaudeConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });
  }

  const fetchRun = await fetchAllSources();
  const entries = flattenEntries(fetchRun);
  const deduped = dedupeEntries(entries);
  const clusters = clusterAndScore(deduped, 10).filter((c) => c.score >= MIN_SCORE);
  const top = clusters.slice(0, MAX_DRAFTS_PER_RUN);

  const whitelist = getWhitelistDomains();
  const results: { topic: string; ok: boolean; reason?: string }[] = [];
  for (const cluster of top) {
    const r = await draftCluster(cluster, whitelist);
    results.push({ topic: cluster.topic.slice(0, 80), ok: r.ok, reason: r.reason });
  }

  return NextResponse.json({
    ok: true,
    fetched: entries.length,
    deduped: deduped.length,
    clustersOverThreshold: clusters.length,
    attempted: top.length,
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
