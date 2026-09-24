/**
 * Retire stale review-queue drafts.
 *
 * News that has waited longer than the source-freshness window can never pass
 * the automated gate (every source is by then older than the 7-day limit), and
 * publishing it by hand would date-stamp weeks-old stories as today's. On
 * 24 Sep 2026 the queue held 109 such drafts from 2 Jun – 7 Sep; all 109 were
 * held for "source too old". This script removes them.
 *
 * Dry-run by default: prints what it would delete and changes nothing.
 * Pass --delete to act. Requires the KV environment (KV_REST_API_*).
 *
 *   npx tsx scripts/retire-backlog.ts                # report only
 *   npx tsx scripts/retire-backlog.ts --delete       # delete drafts older than 7 days
 *   npx tsx scripts/retire-backlog.ts --max-age-days 14 --delete
 */
import { writeFileSync } from "node:fs";
import { getAllDrafts, retireStaleDraft } from "@/lib/news-review/storage";
import { MAX_AUTO_NEWS_SOURCE_AGE_HOURS } from "@/lib/news-review/auto-approve";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const act = process.argv.includes("--delete");
  const maxAgeDays = Number.parseFloat(
    readArg("--max-age-days") ?? String(MAX_AUTO_NEWS_SOURCE_AGE_HOURS / 24),
  );
  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    throw new Error("--max-age-days must be a positive number");
  }
  const cutoff = Date.now() - maxAgeDays * 24 * 3_600_000;

  const drafts = await getAllDrafts();
  const stale = drafts
    .filter((draft) => draft.status === "review" && !draft.publication)
    .filter((draft) => Date.parse(draft.createdAt) < cutoff)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  console.log(
    `${drafts.length} draft(s) in the queue · ${stale.length} older than ${maxAgeDays} day(s) · mode ${act ? "DELETE" : "DRY-RUN"}`,
  );
  for (const draft of stale) {
    console.log(`  ${draft.createdAt.slice(0, 10)}  ${draft.id}  ${draft.article.title.slice(0, 80)}`);
  }
  if (stale.length === 0) return;

  // Keep a full copy beside the script before anything is removed.
  const backupPath = `pipeline-runs/retired-backlog-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(backupPath, JSON.stringify(stale, null, 2));
  console.log(`backup written: ${backupPath}`);

  if (!act) {
    console.log("dry-run: nothing deleted. Re-run with --delete to act.");
    return;
  }

  // Drafts staged before the integrity fields existed cannot pass the
  // cockpit's compare-and-swap; retireStaleDraft checks id + age + no
  // publication record atomically instead, which is all a sweep needs.
  const cutoffIso = new Date(cutoff).toISOString();
  let deleted = 0;
  let skipped = 0;
  for (const draft of stale) {
    try {
      const ok = await retireStaleDraft(draft.id, cutoffIso);
      if (ok) deleted += 1;
      else skipped += 1;
    } catch (error) {
      skipped += 1;
      console.warn(`  skipped ${draft.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`deleted ${deleted} · skipped ${skipped} · remaining ${drafts.length - deleted}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
