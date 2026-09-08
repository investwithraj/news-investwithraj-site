import { appendFile } from "node:fs/promises";
import { OFFICIAL_DIRECT_FEEDS } from "../lib/sources/registry";
import { checkOfficialSourceHealth } from "../lib/sources/fetchers/health";

async function main() {
  const results = await checkOfficialSourceHealth(OFFICIAL_DIRECT_FEEDS);

  const summary = [
    "## Official direct source health",
    "",
    "| Source | Transport | Dated entries | Latest publication | Latency | Discovery state |",
    "|---|---|---:|---|---:|---|",
    ...results.map(
      (result) =>
        `| ${result.name} | ${result.transportOk ? "responded" : "failed"} | ${result.entryCount ?? "—"} | ${result.newestPublishedAt ?? "—"} | ${result.latencyMs} ms | ${result.discoveryState} |`,
    ),
    "",
    "`transport-only` means the page responded within the safe-fetch boundary, but no explicitly dated discovery candidate was proven.",
    "",
  ].join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }
  if (results.every((result) => !result.transportOk)) {
    console.error(
      "All official direct source transports failed health checking; stop the newsroom run.",
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
