// Daily news pipeline orchestrator.
//
// Phase 1 — fetch + dedupe + cluster — runs in pure Node, writes
// clusters.json artifact.
// Phase 2 — drafting + validation + commit — runs inside the schedule-skill
// Claude session, which reads clusters.json + the Voice Profile + the
// validator, drafts each article in Raj's voice, validates, writes to
// content/news/YYYY-MM-DD-slug.ts, commits, pushes.
//
// Invoke manually:    npx tsx scripts/news-pipeline.ts
// Invoke via cron:    via the schedule skill (see RUNBOOK.md)
//
// Output: ./pipeline-runs/YYYY-MM-DD/clusters.json
//         ./pipeline-runs/YYYY-MM-DD/fetch-log.txt

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  fetchAllSources,
  flattenEntries,
  summarizeFetchRun,
} from "../lib/sources/fetchers/index.js";
import { dedupeEntries } from "../lib/pipeline/dedupe.js";
import { clusterAndScore } from "../lib/pipeline/cluster.js";
import type { PipelineRun, DrafterContext } from "../lib/pipeline/types.js";

/** Phase 1 cap — per master plan, 10 articles/day in first 30 days then
 *  raise. Override via PIPELINE_CAP env if needed. */
const ARTICLE_CAP = parseInt(process.env.PIPELINE_CAP ?? "10", 10);

const DRAFTER_CONTEXT: DrafterContext = {
  voiceProfilePath: "lib/voice/raj-profile.md",
  validatorPath: "lib/voice/validator.ts",
  sourceRegistryPath: "lib/sources/registry.ts",
  wordCountTarget: { min: 600, max: 1200 },
  outputPathTemplate: "content/news/YYYY-MM-DD-{slug}.ts",
};

async function run(): Promise<void> {
  const t0 = performance.now();
  const startedAt = new Date().toISOString();
  const today = startedAt.slice(0, 10); // YYYY-MM-DD

  console.log(`\n━━━ news-investwithraj pipeline · ${startedAt} ━━━\n`);
  console.log(`📋 Article cap this run: ${ARTICLE_CAP}\n`);

  // Phase 1.1 — fetch
  console.log("⏬ Fetching all 20 verified sources in parallel…");
  const fetchRun = await fetchAllSources();
  const fetchSummary = summarizeFetchRun(fetchRun);
  console.log(fetchSummary);
  console.log();

  // Phase 1.2 — dedupe
  const allEntries = flattenEntries(fetchRun);
  const deduped = dedupeEntries(allEntries);
  console.log(`🧹 Deduped ${allEntries.length} → ${deduped.length} entries`);

  // Phase 1.3 — cluster + score
  const clusters = clusterAndScore(deduped, ARTICLE_CAP);
  console.log(`🧩 Formed ${clusters.length} top-scored clusters\n`);

  // Surface top-3 clusters in console for the operator
  console.log("🏆 Top 3 by score:");
  for (const c of clusters.slice(0, 3)) {
    console.log(
      `   ${c.score}  ${c.topic.slice(0, 70)}${c.topic.length > 70 ? "…" : ""}`
    );
    console.log(
      `        UHNW=${c.scoreBreakdown.uhnwRelevance} Tier=${c.scoreBreakdown.sourceTier} Fresh=${c.scoreBreakdown.freshness} Angle=${c.scoreBreakdown.rajAngle}`
    );
    console.log(
      `        Sources: ${c.entries.map((e) => e.source.name).join(" · ")}`
    );
  }
  console.log();

  // Write artifacts
  const outDir = resolve(process.cwd(), "pipeline-runs", today);
  await mkdir(outDir, { recursive: true });

  const pipelineRun: PipelineRun = {
    startedAt,
    finishedAt: new Date().toISOString(),
    fetchedCount: allEntries.length,
    dedupedCount: deduped.length,
    clusterCount: clusters.length,
    selectedCount: clusters.length,
    selected: clusters,
    drafterContext: DRAFTER_CONTEXT,
  };

  await writeFile(
    join(outDir, "clusters.json"),
    JSON.stringify(pipelineRun, null, 2),
    "utf-8"
  );
  await writeFile(join(outDir, "fetch-log.txt"), fetchSummary, "utf-8");

  console.log(`📦 Wrote clusters.json + fetch-log.txt to ${outDir}`);
  console.log(`\n━━━ pipeline complete in ${Math.round((performance.now() - t0))}ms ━━━\n`);
  console.log("Next step → schedule-skill Claude session reads clusters.json,");
  console.log("           drafts each cluster per Voice Profile + validator,");
  console.log("           writes article files, commits, pushes.\n");
}

run().catch((err) => {
  console.error("❌ pipeline failed:", err);
  process.exit(1);
});
