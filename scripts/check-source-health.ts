import { appendFile } from "node:fs/promises";
import { DEVELOPER_DIRECT_FEEDS } from "../lib/sources/registry";

const timeoutMs = 8_000;
async function main() {
const results = await Promise.all(
  DEVELOPER_DIRECT_FEEDS.map(async (source) => {
    const started = Date.now();
    const target = source.fetchUrl ?? source.url;
    try {
      const response = await fetch(target, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "InvestWithRaj source-health/1.0 (+https://news.investwithraj.com/about/editorial-standards)" },
      });
      return { name: source.name, target, ok: response.ok, status: response.status, latencyMs: Date.now() - started };
    } catch (error) {
      return { name: source.name, target, ok: false, status: 0, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
    }
  }),
);

const summary = [
  "## Official developer source health",
  "",
  "| Source | HTTP | Latency | State |",
  "|---|---:|---:|---|",
  ...results.map((result) => `| ${result.name} | ${result.status || "—"} | ${result.latencyMs} ms | ${result.ok ? "available" : "review"} |`),
  "",
].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
if (results.every((result) => !result.ok)) {
  console.error("All official developer feeds failed health checking; stop the newsroom run.");
  process.exitCode = 1;
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
