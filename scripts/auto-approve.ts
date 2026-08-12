// Assess and publish a bounded batch of queued drafts whose material figures
// trace to independently fetched, allowlisted evidence.
//
//   AUTO_APPROVE=1 npx tsx scripts/auto-approve.ts
//
// Env: SITE_URL (default prod), POST_PUBLISH_SECRET.

import { runAutoApprove } from "../lib/news-review/auto-approve.js";

const SITE = process.env.SITE_URL || "https://news.investwithraj.com";
const SECRET = process.env.POST_PUBLISH_SECRET || "";
const AUTO_APPROVE_ENABLED = process.env.AUTO_APPROVE === "1";

async function main() {
  if (!SECRET) {
    console.error("ERROR: POST_PUBLISH_SECRET not set.");
    process.exit(1);
  }
  if (!AUTO_APPROVE_ENABLED) {
    console.log(
      "AUTO_APPROVE is not exactly 1; every staged draft remains held in The Desk.",
    );
    return;
  }
  const s = await runAutoApprove({
    site: SITE,
    secret: SECRET,
    publish: true,
    publishLimit: Number.parseInt(process.env.AUTO_PUBLISH_LIMIT ?? "1", 10),
  });
  console.log(
    `\nAUTO-PUBLISH — ${s.published} committed, ${s.held} held, ${s.deferred} deferred, ${s.failed} failed.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
