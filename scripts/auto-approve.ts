// Auto-approve queued news drafts whose EVERY figure traces to a verified
// (whitelisted) source — the deterministic version of Raj's manual "figures
// checked" gate. Rule + runner live in lib/news-review/auto-approve.ts.
//
//   npx tsx scripts/auto-approve.ts            # DRY RUN — report only, publishes nothing
//   npx tsx scripts/auto-approve.ts --publish  # publish the auto-approvable drafts
//
// Env: SITE_URL (default prod), POST_PUBLISH_SECRET.

import { runAutoApprove } from "../lib/news-review/auto-approve.js";

const SITE = process.env.SITE_URL || "https://news.investwithraj.com";
const SECRET = process.env.POST_PUBLISH_SECRET || "";
const PUBLISH = process.argv.includes("--publish");

async function main() {
  if (!SECRET) {
    console.error("ERROR: POST_PUBLISH_SECRET not set.");
    process.exit(1);
  }
  const s = await runAutoApprove({ site: SITE, secret: SECRET, publish: PUBLISH });
  console.log(
    "\n" +
      (PUBLISH
        ? `published ${s.published}/${s.approved}, ${s.failed} failed`
        : `DRY RUN — ${s.approved} would publish`) +
      `, ${s.held} held for manual review.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
