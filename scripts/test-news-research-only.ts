import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Inputs = {
  research_only?: boolean;
  publication_only?: boolean;
  curated_candidate_key?: string;
  candidate_key?: string;
  morning_date?: string;
  retry_failed_research?: boolean;
};

const DEFAULT_INPUTS: Inputs = {
  research_only: false,
  publication_only: false,
  curated_candidate_key: "none",
  candidate_key: "auto",
  morning_date: "",
  retry_failed_research: false,
};

function namedStep(workflow: string, name: string): string {
  const lines = workflow.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `      - name: ${name}`);
  assert.ok(start >= 0, `Missing workflow step: ${name}`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith("      - "));
  return lines.slice(start, next < 0 ? undefined : next).join("\n");
}

// Evaluate the checked-in GitHub expression, not a separately maintained model
// of it. These expressions use the same boolean/string semantics in JavaScript.
function evaluateExpression(value: string, inputs: Inputs, event = "workflow_dispatch"): unknown {
  const expression = value.replace(/^\$\{\{\s*/u, "").replace(/\s*\}\}$/u, "");
  assert.match(expression, /^[\w. '!=&|()\-]+$/u, "Unexpected workflow expression syntax");
  return runInNewContext(expression, {
    github: { event_name: event },
    inputs,
    steps: { curated: { outputs: { already_published: "0" } } },
  }, { timeout: 1_000 });
}

function environmentValue(step: string, key: string, inputs: Inputs, event?: string): string {
  const line = step.split("\n").find((candidate) => candidate.startsWith(`          ${key}: `));
  assert.ok(line, `Missing workflow environment value: ${key}`);
  return String(evaluateExpression(line.slice(`          ${key}: `.length), inputs, event));
}

function runDispatchGuard(step: string, inputs: Inputs): ReturnType<typeof spawnSync> {
  const runStart = step.indexOf("        run: |\n");
  assert.ok(runStart >= 0, "Research-only guard must have an executable shell body");
  const script = step.slice(runStart + "        run: |\n".length)
    .split("\n").map((line) => line.replace(/^          /u, "")).join("\n");
  const env = { ...process.env };
  for (const key of ["PUBLICATION_ONLY", "CURATED_CANDIDATE", "MANUAL_LLM_CANDIDATE", "MORNING_DATE"]) {
    env[key] = environmentValue(step, key, inputs);
  }
  const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
  return spawnSync(bash, ["--noprofile", "--norc", "-c", script], {
    env,
    encoding: "utf8",
    timeout: 5_000,
  });
}

function testWorkflow(workflow: string): void {
  assert.match(workflow, /research_only:\s*\n\s+description:[^\n]+\n\s+required: false\n\s+default: false\n\s+type: boolean/u);
  const guard = namedStep(workflow, "Validate research-only dispatch");
  const pipeline = namedStep(workflow, "Run daily news pipeline");
  assert.ok(workflow.indexOf(guard) < workflow.indexOf("Stage selected curated candidate"));
  assert.ok(workflow.indexOf(guard) < workflow.indexOf(pipeline));
  assert.match(guard, /if: github\.event_name == 'workflow_dispatch' && inputs\.research_only/u);
  assert.match(workflow, /run: npx tsx scripts\/test-news-research-only\.ts/u);

  const research = { ...DEFAULT_INPUTS, research_only: true };
  const accepted = runDispatchGuard(guard, research);
  assert.ifError(accepted.error);
  assert.equal(accepted.status, 0, String(accepted.stderr));
  for (const conflict of [
    { publication_only: true },
    { curated_candidate_key: "prestige-one-investment-2026-09-10" },
    { candidate_key: "dld-initial-registration" },
    { morning_date: "2026-09-10" },
    { morning_date: " " },
    { publication_only: true, candidate_key: "dld-initial-registration" },
  ]) {
    const rejected = runDispatchGuard(guard, { ...research, ...conflict });
    assert.ifError(rejected.error);
    assert.equal(rejected.status, 1, `Conflicting research-only input was accepted: ${JSON.stringify(conflict)}`);
    assert.match(String(rejected.stdout), /::error title=Research-only news test::/u);
  }

  assert.equal(environmentValue(pipeline, "AUTO_APPROVE", research), "0");
  assert.equal(environmentValue(pipeline, "DRAFT_ENABLED", research), "1");
  assert.equal(environmentValue(pipeline, "AUTOMATED_MORNING_LANE", research), "0");
  assert.equal(environmentValue(pipeline, "CURATED_PUBLICATION", research), "0");
  assert.equal(environmentValue(pipeline, "PIPELINE_CANDIDATE_KEY", research), "auto");
  const retry = { ...research, retry_failed_research: true };
  assert.equal(runDispatchGuard(guard, retry).status, 0);
  assert.equal(environmentValue(pipeline, "PIPELINE_RETRY_FAILED", retry), "1");
  assert.equal(environmentValue(pipeline, "AUTO_APPROVE", retry), "0");
  // Defence in depth: even an invalid combination cannot turn publication on.
  assert.equal(environmentValue(pipeline, "AUTO_APPROVE", { ...research, curated_candidate_key: "prestige-one-investment-2026-09-10" }), "0");
  assert.equal(environmentValue(pipeline, "AUTOMATED_MORNING_LANE", { ...research, morning_date: "2026-09-10" }), "0");

  const researchCondition = pipeline.match(/^        if: (.+)$/mu)?.[1];
  assert.ok(researchCondition);
  assert.equal(evaluateExpression(researchCondition, research), true, "Research-only must enter the normal runner, not silently skip");
  for (const [inputs, event, expected] of [
    [{}, "schedule", { approve: "1", draft: "1", morning: "1" }],
    [DEFAULT_INPUTS, "workflow_dispatch", { approve: "1", draft: "1", morning: "0" }],
    [{ ...DEFAULT_INPUTS, morning_date: "2026-09-10" }, "workflow_dispatch", { approve: "1", draft: "1", morning: "1" }],
    [{ ...DEFAULT_INPUTS, publication_only: true }, "workflow_dispatch", { approve: "1", draft: "0", morning: "0" }],
    [{ ...DEFAULT_INPUTS, candidate_key: "dld-initial-registration" }, "workflow_dispatch", { approve: "0", draft: "1", morning: "0" }],
    [{ ...DEFAULT_INPUTS, curated_candidate_key: "prestige-one-investment-2026-09-10" }, "workflow_dispatch", { approve: "1", draft: "0", morning: "0" }],
  ] as const) {
    assert.equal(environmentValue(pipeline, "AUTO_APPROVE", inputs, event), expected.approve);
    assert.equal(environmentValue(pipeline, "DRAFT_ENABLED", inputs, event), expected.draft);
    assert.equal(environmentValue(pipeline, "AUTOMATED_MORNING_LANE", inputs, event), expected.morning);
  }
  assert.deepEqual([...workflow.matchAll(/cron: "([^"]+)"/gu)].map((match) => match[1]), ["37 1 * * *", "17 5 * * *"]);
  assert.match(pipeline, /AUTO_PUBLISH_LIMIT: "1"/u);
}

async function testActualPublicationGate(runner: string): Promise<void> {
  const source = ts.createSourceFile("draft-once.ts", runner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const gate = source.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === "runPublicationPass",
  );
  assert.ok(gate, "The runner's actual publication gate must be present");
  const publisherCalls: ts.CallExpression[] = [];
  const collectCalls = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "runAutoApprove") publisherCalls.push(node);
    ts.forEachChild(node, collectCalls);
  };
  collectCalls(source);
  assert.equal(publisherCalls.length, 1, "All runner auto-publication must remain behind one tested gate");
  assert.ok(publisherCalls[0].pos >= gate.pos && publisherCalls[0].end <= gate.end);
  const code = ts.transpileModule(`${gate.getText(source)}\nrunPublicationPass();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;

  for (const approve of [undefined, "", "false", "0", "1"]) {
    let calls = 0;
    let networkCalls = 0;
    const summary = { published: 1, held: 0, deferred: 0, failed: 0 };
    const result = await runInNewContext(code, {
      process: { env: { AUTO_APPROVE: approve, CURATED_PUBLICATION: "0" } },
      console: { log: () => undefined },
      SITE: "https://news.example.invalid",
      SECRET: "offline-test-only",
      runAutoApprove: async (options: { publish?: boolean; publishLimit?: number }) => {
        calls += 1;
        assert.equal(options.publish, true);
        assert.equal(options.publishLimit, 1);
        return summary;
      },
      fetch: () => { networkCalls += 1; throw new Error("Network is forbidden in this offline regression"); },
      assertCuratedPublicationOutcome: () => { throw new Error("Not a curated run"); },
    }, { timeout: 1_000 });
    assert.equal(calls, approve === "1" ? 1 : 0, `AUTO_APPROVE=${String(approve)} publication gate mismatch`);
    assert.equal(networkCalls, 0);
    assert.equal(result, approve === "1" ? summary : null);
  }
}

async function main(): Promise<void> {
  const workflow = (await readFile(resolve(process.cwd(), ".github/workflows/news-cron.yml"), "utf8")).replace(/\r\n/gu, "\n");
  const runner = await readFile(resolve(process.cwd(), "scripts/draft-once.ts"), "utf8");
  testWorkflow(workflow);
  await testActualPublicationGate(runner);
  console.log("News research-only regression passed: actual dispatch guard rejects conflicting inputs; normal discovery/staging stays enabled; AUTO_APPROVE=0 invokes no publisher; scheduled, watchdog and existing manual modes are unchanged.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
