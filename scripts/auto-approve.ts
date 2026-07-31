// Assess queued drafts whose material figures trace to independently fetched,
// allowlisted evidence. This command never publishes.
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
  const s = await runAutoApprove({ site: SITE, secret: SECRET, publish: false });
  console.log(
    `\nASSESSMENT ONLY — ${s.approved} evidence-ready, ${s.held} held; 0 published.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
