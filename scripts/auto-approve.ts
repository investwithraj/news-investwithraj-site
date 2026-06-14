// Auto-approve queued news drafts whose EVERY figure traces to a verified
// (whitelisted) source — the deterministic version of Raj's manual "figures
// checked" gate. See lib/news-review/auto-approve.ts for the rule.
//
//   npx tsx scripts/auto-approve.ts            # DRY RUN — report only, publishes nothing
//   npx tsx scripts/auto-approve.ts --publish  # publish the auto-approvable drafts
//
// Env: SITE_URL (default prod), POST_PUBLISH_SECRET.
// Reuses the live API: GET /api/news/draft (list) + POST /api/news/draft/[id]/publish
// (the same route the cockpit's Approve button calls — it re-checks the gates
// server-side before committing, so this can never bypass them).

import { assessDraft, MIN_WHITELIST_CITATIONS } from "@/lib/news-review/auto-approve";
import type { NewsDraft } from "@/lib/news-review/types";

const SITE = (process.env.SITE_URL || "https://news.investwithraj.com").replace(/\/$/, "");
const SECRET = process.env.POST_PUBLISH_SECRET || "";
const PUBLISH = process.argv.includes("--publish");

async function main() {
  if (!SECRET) {
    console.error("ERROR: POST_PUBLISH_SECRET not set.");
    process.exit(1);
  }

  const listRes = await fetch(
    `${SITE}/api/news/draft?secret=${encodeURIComponent(SECRET)}`,
    { cache: "no-store" },
  );
  if (!listRes.ok) {
    console.error(`ERROR: draft list failed (${listRes.status}).`);
    process.exit(1);
  }
  const { drafts } = (await listRes.json()) as { drafts: NewsDraft[] };

  console.log(
    `\n${drafts.length} draft(s) in The Desk  ·  mode: ${PUBLISH ? "PUBLISH" : "DRY RUN"}` +
      `\nrule: 8 gates pass + ALL citations whitelisted (>= ${MIN_WHITELIST_CITATIONS}) + EVERY body figure found in cited-source text\n`,
  );

  const assessments = drafts.map(assessDraft);
  const approve = assessments.filter((a) => a.verdict === "auto-approve");
  const manual = assessments.filter((a) => a.verdict === "manual");

  console.log(`✅ AUTO-APPROVE (${approve.length}/${drafts.length}):`);
  for (const a of approve) {
    console.log(
      `   ${a.slug}\n      ${a.figureCount} figures all sourced · ${a.whitelistCount}/${a.citationCount} whitelisted cites`,
    );
  }
  console.log(`\n⏸  HELD FOR MANUAL REVIEW (${manual.length}/${drafts.length}):`);
  for (const a of manual) {
    console.log(`   ${a.slug}\n      → ${a.reasons.join("; ")}`);
  }

  if (!PUBLISH) {
    console.log(
      `\nDRY RUN — nothing published. Re-run with --publish to publish the ${approve.length} auto-approvable draft(s).`,
    );
    return;
  }

  if (approve.length === 0) {
    console.log("\nNothing to publish.");
    return;
  }

  console.log(`\nPublishing ${approve.length} draft(s)…`);
  let ok = 0;
  let fail = 0;
  for (const a of approve) {
    const r = await fetch(
      `${SITE}/api/news/draft/${a.id}/publish?secret=${encodeURIComponent(SECRET)}`,
      { method: "POST" },
    );
    if (r.ok) {
      ok++;
      const body = (await r.json().catch(() => ({}))) as { url?: string };
      console.log(`   ✅ ${a.slug}${body.url ? `  → ${body.url}` : ""}`);
    } else {
      fail++;
      const t = await r.text().catch(() => "");
      console.log(`   ❌ ${a.slug}  → ${r.status} ${t.slice(0, 140)}`);
    }
  }
  console.log(`\nDone: ${ok} published, ${fail} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
