// Draft one article — runs in the GitHub Actions runner (no 60s limit, unlike
// the Vercel function). Does the full pipeline + web-research draft, then POSTs
// the finished draft to /api/news/draft so it lands in The Desk for review.
//
//   npx tsx scripts/draft-once.ts
//
// Env (set as GitHub Actions secrets):
//   POST_PUBLISH_SECRET  — to GET existing drafts + POST the new one
//   ANTHROPIC_API_KEY    — for the web-research draft (read by callClaudeResearch)
//   SITE_URL             — default https://news.investwithraj.com
//   DRAFT_MODEL          — optional model override (default Sonnet, full quality)

import { fetchAllSources, flattenEntries } from "../lib/sources/fetchers/index.js";
import { dedupeEntries, similarity } from "../lib/pipeline/dedupe.js";
import { clusterAndScore } from "../lib/pipeline/cluster.js";
import { getWhitelistDomains } from "../lib/sources/registry.js";
import { draftFromCluster } from "../lib/news-review/draft-engine.js";
import { NEWS_ARTICLES } from "../content/news/index.js";

const SITE = process.env.SITE_URL || "https://news.investwithraj.com";
const SECRET = process.env.POST_PUBLISH_SECRET || "";
const MIN_SCORE = parseInt(process.env.PIPELINE_MIN_SCORE ?? "45", 10);
const MAX_DRAFTS = parseInt(process.env.PIPELINE_CAP ?? "1", 10);
const MAX_ATTEMPTS = parseInt(process.env.PIPELINE_MAX_ATTEMPTS ?? "3", 10);

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  if (!SECRET) throw new Error("POST_PUBLISH_SECRET not set");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  console.log(`\n━━━ draft-once · ${new Date().toISOString()} ━━━\n`);

  // What's already staged / published today (so staggered runs differ).
  const existing = await fetch(`${SITE}/api/news/draft?secret=${SECRET}`)
    .then((r) => r.json())
    .catch(() => ({ drafts: [] as Array<{ provenance: { clusterId: string }; article: { title: string } }> }));
  const draftedIds = new Set((existing.drafts ?? []).map((d: { provenance: { clusterId: string } }) => d.provenance.clusterId));
  const coveredTitles: string[] = [
    ...(existing.drafts ?? []).map((d: { article: { title: string } }) => d.article.title),
    ...NEWS_ARTICLES.filter((a) => a.status !== "research" && isToday(a.publishedAt)).map((a) => a.title),
  ];

  // Pipeline.
  const run = await fetchAllSources();
  const deduped = dedupeEntries(flattenEntries(run));
  const clusters = clusterAndScore(deduped, 12).filter((c) => c.score >= MIN_SCORE);
  const candidates = clusters.filter(
    (c) => !draftedIds.has(c.id) && !coveredTitles.some((t) => similarity(c.topic, t) >= 0.55),
  );
  console.log(`clusters≥${MIN_SCORE}: ${clusters.length} · undrafted candidates: ${candidates.length}\n`);

  const whitelist = getWhitelistDomains();
  let staged = 0;
  let attempts = 0;
  for (const cluster of candidates) {
    if (staged >= MAX_DRAFTS || attempts >= MAX_ATTEMPTS) break;
    attempts++;
    console.log(`▸ researching: ${cluster.topic.slice(0, 72)}  (score ${cluster.score})`);
    const r = await draftFromCluster(cluster, whitelist, {
      model: process.env.DRAFT_MODEL,
      maxSearches: 4,
      maxTokens: 4200,
    });
    if (!r.ok || !r.article) {
      console.log(`  · skip — ${r.reason}`);
      continue;
    }
    const res = await fetch(`${SITE}/api/news/draft?secret=${SECRET}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ article: r.article, provenance: r.provenance }),
    });
    if (res.ok) {
      staged++;
      console.log(`  ✓ staged → ${r.article.slug}`);
    } else {
      const t = await res.text().catch(() => "");
      console.log(`  ✗ POST ${res.status}: ${t.slice(0, 200)}`);
    }
  }

  console.log(`\n━━━ done: ${staged} staged from ${attempts} attempt(s) ━━━\n`);
}

main().catch((e) => {
  console.error("draft-once failed:", e);
  process.exit(1);
});
