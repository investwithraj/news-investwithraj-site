import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest } from "next/server";

import { GET as runWatchdogRoute } from "../app/api/cron/news-watchdog/route.js";
import {
  guardAutomatedMorningPublication,
  observeLiveDubaiDayCoverage,
} from "../lib/news-scheduler/coverage.js";
import { validatedDubaiMorningDate } from "../lib/news-scheduler/day.js";
import {
  KvMorningDispatchLedger,
  morningDispatchPayloadDigest,
} from "../lib/news-scheduler/ledger.js";
import {
  automatedPublicationDayKey,
  automatedPublicationDayPayloadDigest,
  KvAutomatedPublicationDayLedger,
  type AutomatedPublicationDayIdentity,
} from "../lib/news-scheduler/publication-day-ledger.js";
import {
  NEWS_WORKFLOW_FILE,
  NEWS_WORKFLOW_REF,
  type MorningDispatchClaim,
  type MorningDispatchLedger,
  type MorningDispatchResult,
} from "../lib/news-scheduler/types.js";
import {
  dispatchNewsWorkflow,
  runNewsWatchdog,
} from "../lib/news-scheduler/watchdog.js";
import { notifyVerifiedPostPublish } from "../lib/news-review/post-publish.js";

const NOW = new Date("2026-09-08T03:17:00.000Z");
const MORNING_DATE = "2026-09-08";
const DISPATCH_TOKEN = "github-dispatch-token-".padEnd(48, "x");
const ENABLED_ENV = {
  ENABLE_NEWS_WATCHDOG: "1",
  KV_REST_API_URL: "https://kv.example.test",
  KV_REST_API_TOKEN: "kv-token",
  CRON_SECRET: "c".repeat(32),
  POST_PUBLISH_SECRET: "p".repeat(32),
  GITHUB_ACTIONS_DISPATCH_TOKEN: DISPATCH_TOKEN,
} as const;

class MemoryLedger implements MorningDispatchLedger {
  state: "empty" | "claimed" | "dispatched" | "retryable" | "completed" =
    "empty";
  result: MorningDispatchResult | null = null;
  lastFailureCode: string | null = null;
  readonly token = "owner-token";
  readonly payloadDigest = morningDispatchPayloadDigest(MORNING_DATE);

  async claim(morningDate: string): Promise<MorningDispatchClaim> {
    assert.equal(morningDate, MORNING_DATE);
    if (this.state === "empty") {
      this.state = "claimed";
      return {
        status: "owner",
        token: this.token,
        payloadDigest: this.payloadDigest,
      };
    }
    if (this.state === "completed" && this.result) {
      return { status: "completed", result: this.result };
    }
    if (this.state === "retryable") {
      this.state = "claimed";
      return {
        status: "owner",
        token: this.token,
        payloadDigest: this.payloadDigest,
      };
    }
    return { status: this.state === "claimed" ? "busy" : "dispatched" };
  }

  async markDispatched(
    morningDate: string,
    payloadDigest: string,
    token: string,
  ): Promise<boolean> {
    if (
      this.state !== "claimed" ||
      morningDate !== MORNING_DATE ||
      payloadDigest !== this.payloadDigest ||
      token !== this.token
    ) {
      return false;
    }
    this.state = "dispatched";
    return true;
  }

  async complete(
    morningDate: string,
    payloadDigest: string,
    token: string,
    result: MorningDispatchResult,
  ): Promise<boolean> {
    if (
      this.state !== "dispatched" ||
      morningDate !== MORNING_DATE ||
      payloadDigest !== this.payloadDigest ||
      token !== this.token
    ) {
      return false;
    }
    this.state = "completed";
    this.result = result;
    return true;
  }

  async markRetryable(
    morningDate: string,
    payloadDigest: string,
    token: string,
    failureCode: string,
  ): Promise<boolean> {
    if (
      this.state !== "dispatched" ||
      morningDate !== MORNING_DATE ||
      payloadDigest !== this.payloadDigest ||
      token !== this.token
    ) {
      return false;
    }
    this.state = "retryable";
    this.lastFailureCode = failureCode;
    return true;
  }
}

function coverage(covered: boolean) {
  return {
    morningDate: MORNING_DATE,
    covered,
    articleUrl: covered
      ? "https://news.investwithraj.com/news/2026-09-08-fixture"
      : null,
    publishedAt: covered ? "2026-09-08T02:00:00.000Z" : null,
  } as const;
}

async function testDubaiDayBoundaries(): Promise<void> {
  assert.equal(
    validatedDubaiMorningDate(undefined, new Date("2026-09-08T19:59:59.999Z")),
    "2026-09-08",
  );
  assert.equal(
    validatedDubaiMorningDate(undefined, new Date("2026-09-08T20:00:00.000Z")),
    "2026-09-09",
  );
  assert.equal(validatedDubaiMorningDate(MORNING_DATE, NOW), MORNING_DATE);
  assert.throws(
    () => validatedDubaiMorningDate("2026-09-07", NOW),
    /does not match the current Dubai date/u,
  );
  assert.throws(
    () => validatedDubaiMorningDate("2026-02-31", NOW),
    /valid YYYY-MM-DD/u,
  );
}

async function testLiveCoverageAndHeldRetry(): Promise<void> {
  const calls: string[] = [];
  const covered = await observeLiveDubaiDayCoverage({
    morningDate: MORNING_DATE,
    site: "https://news.investwithraj.com",
    fetcher: async (url) => {
      calls.push(url);
      if (url.endsWith("/api/front")) {
        return Response.json({
          schemaVersion: "front-v1",
          items: [
            {
              slug: "2026-09-08-fixture",
              publishedAt: "2026-09-07T20:00:00.000Z",
              url: "https://news.investwithraj.com/news/2026-09-08-fixture",
            },
          ],
        });
      }
      return new Response("article", { status: 200 });
    },
  });
  assert.equal(covered.covered, true);
  assert.equal(calls.length, 2, "A feed match must be proven on its live route");

  let fetchCount = 0;
  const manual = await guardAutomatedMorningPublication({
    environment: {},
    now: NOW,
    fetcher: async () => {
      fetchCount += 1;
      throw new Error("manual lanes must not perform the morning guard fetch");
    },
  });
  assert.equal(manual.automated, false);
  assert.equal(fetchCount, 0, "Manual and curated paths must remain unaffected");

  const heldFeed = async () =>
    Response.json({
      schemaVersion: "front-v1",
      items: [
        {
          slug: "2026-09-07-yesterday",
          publishedAt: "2026-09-07T08:00:00.000Z",
          url: "https://news.investwithraj.com/news/2026-09-07-yesterday",
        },
      ],
    });
  const automatedEnvironment = {
    AUTOMATED_MORNING_LANE: "1",
    MORNING_DATE,
  };
  const firstHeldAttempt = await guardAutomatedMorningPublication({
    environment: automatedEnvironment,
    now: NOW,
    fetcher: heldFeed,
  });
  const recoveryAttempt = await guardAutomatedMorningPublication({
    environment: automatedEnvironment,
    now: NOW,
    fetcher: heldFeed,
  });
  assert.equal(firstHeldAttempt.covered, false);
  assert.equal(
    recoveryAttempt.covered,
    false,
    "A held run with no live publication must leave the recovery lane open",
  );

  let repositoryCoveredFetches = 0;
  const committedBeforeDeployment = await guardAutomatedMorningPublication({
    environment: automatedEnvironment,
    now: NOW,
    repositoryArticles: [
      {
        slug: "2026-09-08-committed-not-yet-live",
        publishedAt: "2026-09-08T03:00:00.000Z",
      },
    ],
    fetcher: async () => {
      repositoryCoveredFetches += 1;
      throw new Error("repository coverage must stop before live observation");
    },
  });
  assert.equal(committedBeforeDeployment.covered, true);
  assert.equal(
    repositoryCoveredFetches,
    0,
    "A same-day article in the fresh main checkout must block a second publish even before deployment",
  );
}

async function testWatchdogConcurrencyReplayAndCoverage(): Promise<void> {
  const ledger = new MemoryLedger();
  let dispatches = 0;
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      runNewsWatchdog({
        environment: ENABLED_ENV,
        now: NOW,
        ledger,
        observeCoverage: async () => coverage(false),
        dispatch: async () => {
          dispatches += 1;
          return { outcome: "accepted", status: 204 };
        },
      }),
    ),
  );
  assert.equal(dispatches, 1, "Concurrent watchdog calls must dispatch once");
  assert.equal(
    results.filter((result) => result.outcome === "dispatched").length,
    1,
  );
  const replay = await runNewsWatchdog({
    environment: ENABLED_ENV,
    now: NOW,
    ledger,
    observeCoverage: async () => coverage(false),
    dispatch: async () => {
      throw new Error("a completed ledger receipt must not replay GitHub");
    },
  });
  assert.equal(replay.outcome, "replay");
  assert.equal(replay.httpStatus, 200);

  const coveredLedger = new MemoryLedger();
  let coveredDispatches = 0;
  const alreadyCovered = await runNewsWatchdog({
    environment: ENABLED_ENV,
    now: NOW,
    ledger: coveredLedger,
    observeCoverage: async () => coverage(true),
    dispatch: async () => {
      coveredDispatches += 1;
      return { outcome: "accepted", status: 204 };
    },
  });
  assert.equal(alreadyCovered.outcome, "already-covered");
  assert.equal(coveredDispatches, 0);
  assert.equal(coveredLedger.state, "completed");
}

async function testKvLedgerTransportAndTransitions(): Promise<void> {
  const calls: Array<{
    url: string;
    authorization: string;
    parts: unknown[];
  }> = [];
  const queuedResults: unknown[] = [[1, "claimed"], 1, 1];
  const ledger = new KvMorningDispatchLedger(ENABLED_ENV, async (url, init) => {
    const parts = JSON.parse(String(init?.body)) as unknown[];
    calls.push({
      url,
      authorization: String(
        (init?.headers as Record<string, string> | undefined)?.authorization ??
          "",
      ),
      parts,
    });
    return Response.json({ result: queuedResults.shift() });
  });

  const claim = await ledger.claim(MORNING_DATE);
  assert.equal(claim.status, "owner");
  assert.equal(calls.length, 1);
  const claimCommand = calls[0];
  assert.equal(claimCommand.url, ENABLED_ENV.KV_REST_API_URL);
  assert.equal(
    claimCommand.authorization,
    `Bearer ${ENABLED_ENV.KV_REST_API_TOKEN}`,
  );
  assert.equal(claimCommand.parts[0], "EVAL");
  assert.equal(claimCommand.parts[2], 1);
  assert.equal(claimCommand.parts.length, 11);
  assert.equal(
    claimCommand.parts[3],
    `news:scheduler:watchdog:v1:${MORNING_DATE}`,
  );
  assert.equal(
    claimCommand.parts[4],
    morningDispatchPayloadDigest(MORNING_DATE),
  );
  assert.equal(
    Number(claimCommand.parts[7]) - Number(claimCommand.parts[5]),
    120_000,
  );
  assert.equal(Number(claimCommand.parts[9]), 14 * 24 * 60 * 60);
  const claimScript = String(claimCommand.parts[1]);
  assert.match(
    claimScript,
    /current\.status == "retryable"[\s\S]*current\.status = "claimed"/u,
  );
  assert.match(
    claimScript,
    /leaseExpiresAt or 0\) > tonumber\(ARGV\[2\]\)[\s\S]*return \{3, raw\}/u,
  );
  const initialRecord = JSON.parse(String(claimCommand.parts[10])) as {
    status?: string;
    leaseExpiresAt?: number;
    payloadDigest?: string;
  };
  assert.equal(initialRecord.status, "claimed");
  assert.equal(initialRecord.leaseExpiresAt, Number(claimCommand.parts[7]));
  assert.equal(initialRecord.payloadDigest, claimCommand.parts[4]);
  assert.equal(
    JSON.stringify(claimCommand.parts).includes(ENABLED_ENV.KV_REST_API_TOKEN),
    false,
  );

  assert.equal(claim.status, "owner");
  assert.equal(
    await ledger.markDispatched(
      MORNING_DATE,
      claim.payloadDigest,
      claim.token,
    ),
    true,
  );
  const dispatchCommand = calls[1].parts;
  assert.equal(dispatchCommand[0], "EVAL");
  assert.equal(dispatchCommand.length, 8);
  assert.equal(dispatchCommand[2], 1);
  assert.equal(dispatchCommand[3], claimCommand.parts[3]);
  assert.equal(dispatchCommand[4], claim.payloadDigest);
  assert.match(String(dispatchCommand[1]), /current\.status ~= "claimed"/u);
  assert.match(String(dispatchCommand[5]), /^[a-f0-9]{64}$/u);
  assert.equal(Number.isFinite(Date.parse(String(dispatchCommand[6]))), true);
  assert.equal(Number(dispatchCommand[7]), 14 * 24 * 60 * 60);

  assert.equal(
    await ledger.markRetryable(
      MORNING_DATE,
      claim.payloadDigest,
      claim.token,
      "GitHub HTTP 401 / rejected",
    ),
    true,
  );
  const retryCommand = calls[2].parts;
  assert.equal(retryCommand[0], "EVAL");
  assert.equal(retryCommand.length, 9);
  assert.equal(retryCommand[2], 1);
  assert.equal(retryCommand[3], claimCommand.parts[3]);
  assert.equal(retryCommand[4], claim.payloadDigest);
  assert.match(String(retryCommand[1]), /current\.status = "retryable"/u);
  assert.match(String(retryCommand[5]), /^[a-f0-9]{64}$/u);
  assert.equal(retryCommand[6], "GitHub-HTTP-401---rejected");
  assert.equal(Number.isFinite(Date.parse(String(retryCommand[7]))), true);
  assert.equal(Number(retryCommand[8]), 14 * 24 * 60 * 60);
  assert.equal(
    calls.every(
      (call) =>
        call.authorization === `Bearer ${ENABLED_ENV.KV_REST_API_TOKEN}`,
    ),
    true,
  );
  assert.equal(JSON.stringify(calls).includes(claim.token), false);

  const completedResult: MorningDispatchResult = {
    outcome: "already-covered",
    morningDate: MORNING_DATE,
    workflow: NEWS_WORKFLOW_FILE,
    ref: NEWS_WORKFLOW_REF,
    completedAt: NOW.toISOString(),
    articleUrl:
      "https://news.investwithraj.com/news/2026-09-08-ledger-fixture",
  };
  const completionCalls: unknown[][] = [];
  const completionResults: unknown[] = [[1, "claimed"], 1, 1];
  const completionLedger = new KvMorningDispatchLedger(
    ENABLED_ENV,
    async (_url, init) => {
      completionCalls.push(JSON.parse(String(init?.body)) as unknown[]);
      return Response.json({ result: completionResults.shift() });
    },
  );
  const completionClaim = await completionLedger.claim(MORNING_DATE);
  assert.equal(completionClaim.status, "owner");
  if (completionClaim.status === "owner") {
    assert.equal(
      await completionLedger.markDispatched(
        MORNING_DATE,
        completionClaim.payloadDigest,
        completionClaim.token,
      ),
      true,
    );
    assert.equal(
      await completionLedger.complete(
        MORNING_DATE,
        completionClaim.payloadDigest,
        completionClaim.token,
        completedResult,
      ),
      true,
    );
  }
  const completeCommand = completionCalls[2];
  assert.equal(completeCommand[0], "EVAL");
  assert.equal(completeCommand.length, 9);
  assert.equal(completeCommand[2], 1);
  assert.equal(
    completeCommand[3],
    `news:scheduler:watchdog:v1:${MORNING_DATE}`,
  );
  assert.equal(completeCommand[4], completionClaim.status === "owner"
    ? completionClaim.payloadDigest
    : null);
  assert.match(String(completeCommand[1]), /current\.status = "completed"/u);
  assert.match(String(completeCommand[5]), /^[a-f0-9]{64}$/u);
  assert.deepEqual(JSON.parse(String(completeCommand[6])), completedResult);
  assert.equal(Number.isFinite(Date.parse(String(completeCommand[7]))), true);
  assert.equal(Number(completeCommand[8]), 14 * 24 * 60 * 60);

  const claimWithResult = async (result: unknown) =>
    new KvMorningDispatchLedger(ENABLED_ENV, async () =>
      Response.json({ result }),
    ).claim(MORNING_DATE);
  assert.equal(
    (await claimWithResult([-1, JSON.stringify({ status: "claimed" })])).status,
    "conflict",
  );
  assert.equal(
    (await claimWithResult([3, JSON.stringify({ status: "claimed" })])).status,
    "busy",
  );
  assert.equal(
    (await claimWithResult([2, JSON.stringify({ status: "dispatched" })])).status,
    "dispatched",
  );
  assert.equal(
    (await claimWithResult([1, JSON.stringify({ status: "claimed" })])).status,
    "owner",
    "An expired lease or retryable record returned by the Lua claim must transfer ownership",
  );
  const completed = await claimWithResult([
    0,
    JSON.stringify({ status: "completed", result: completedResult }),
  ]);
  assert.equal(completed.status, "completed");
  if (completed.status === "completed") {
    assert.deepEqual(completed.result, completedResult);
  }
  assert.equal(
    (await claimWithResult([0, "{corrupt-json"])).status,
    "unavailable",
    "A corrupt completed receipt must fail closed",
  );
}

async function testAutomatedPublicationDayRace(): Promise<void> {
  const first: AutomatedPublicationDayIdentity = {
    morningDate: MORNING_DATE,
    draftId: "first-draft",
    revision: 3,
    contentHash: "a".repeat(64),
  };
  const second: AutomatedPublicationDayIdentity = {
    morningDate: MORNING_DATE,
    draftId: "second-draft",
    revision: 7,
    contentHash: "b".repeat(64),
  };
  type DayRecord = {
    payloadDigest: string;
    status: string;
    ownerTokenHash?: string;
    leaseExpiresAt?: number;
    failureCode?: string;
    result?: unknown;
  };
  let stored: DayRecord | null = null;
  const calls: Array<{ parts: unknown[]; authorization: string }> = [];
  const fakeUpstash = async (_url: string, init?: RequestInit) => {
    const parts = JSON.parse(String(init?.body)) as unknown[];
    calls.push({
      parts,
      authorization: String(
        (init?.headers as Record<string, string> | undefined)?.authorization ??
          "",
      ),
    });
    const script = String(parts[1]);
    const payloadDigest = String(parts[4]);
    const current = stored as DayRecord | null;
    if (script.includes('current.status = "committing"')) {
      if (
        !current ||
        current.payloadDigest !== payloadDigest ||
        current.ownerTokenHash !== String(parts[5])
      ) {
        return Response.json({ result: 0 });
      }
      if (current.status === "committing") {
        return Response.json({ result: 2 });
      }
      if (
        current.status !== "claimed" ||
        Number(current.leaseExpiresAt ?? 0) <= Number(parts[6])
      ) {
        return Response.json({ result: 0 });
      }
      stored = {
        ...current,
        status: "committing",
        leaseExpiresAt: undefined,
      };
      return Response.json({ result: 1 });
    }
    if (script.includes('current.status = "completed"')) {
      if (!current || current.payloadDigest !== payloadDigest) {
        return Response.json({ result: 0 });
      }
      if (current.status === "completed") {
        return Response.json({ result: 2 });
      }
      if (
        current.status !== "committing" ||
        current.ownerTokenHash !== String(parts[5])
      ) {
        return Response.json({ result: 0 });
      }
      stored = {
        ...current,
        status: "completed",
        ownerTokenHash: undefined,
        result: JSON.parse(String(parts[6])),
      };
      return Response.json({ result: 1 });
    }
    if (script.includes('current.status = "retryable"')) {
      if (
        !current ||
        current.payloadDigest !== payloadDigest ||
        current.ownerTokenHash !== String(parts[5]) ||
        (current.status !== "claimed" && current.status !== "committing")
      ) {
        return Response.json({ result: 0 });
      }
      stored = {
        ...current,
        status: "retryable",
        ownerTokenHash: undefined,
        leaseExpiresAt: undefined,
        failureCode: String(parts[6]),
      };
      return Response.json({ result: 1 });
    }
    if (script.includes('current.status = "claimed"')) {
      if (!stored) {
        stored = JSON.parse(String(parts[10])) as DayRecord;
        return Response.json({ result: 1 });
      }
      if (stored.payloadDigest !== payloadDigest) {
        return Response.json({ result: -1 });
      }
      if (stored.status === "completed") {
        return Response.json({ result: 3 });
      }
      if (
        stored.status === "committing" ||
        (stored.status === "claimed" &&
          Number(stored.leaseExpiresAt ?? 0) > Number(parts[5]))
      ) {
        return Response.json({ result: 2 });
      }
      if (stored.status !== "claimed" && stored.status !== "retryable") {
        return Response.json({ result: -1 });
      }
      stored = {
        ...stored,
        status: "claimed",
        ownerTokenHash: String(parts[6]),
        leaseExpiresAt: Number(parts[7]),
      };
      return Response.json({ result: 1 });
    }
    throw new Error("Unexpected publication-day ledger script.");
  };
  const firstLedger = new KvAutomatedPublicationDayLedger(
    ENABLED_ENV,
    fakeUpstash,
  );
  const secondLedger = new KvAutomatedPublicationDayLedger(
    ENABLED_ENV,
    fakeUpstash,
  );
  const samePayloadRace = await Promise.all([
    firstLedger.claim(first),
    secondLedger.claim(first),
  ]);
  assert.deepEqual(
    samePayloadRace.map((claim) => claim.status).sort(),
    ["busy", "owner"],
    "Concurrent requests for one immutable draft must produce one owner and one busy receipt",
  );
  const firstOwner = samePayloadRace.find((claim) => claim.status === "owner");
  assert.ok(firstOwner?.status === "owner");
  assert.equal((await secondLedger.claim(second)).status, "conflict");

  const firstCommand = calls[0].parts;
  assert.equal(firstCommand[0], "EVAL");
  assert.equal(firstCommand.length, 11);
  assert.equal(firstCommand[2], 1);
  assert.equal(firstCommand[3], automatedPublicationDayKey(MORNING_DATE));
  assert.equal(firstCommand[4], automatedPublicationDayPayloadDigest(first));
  assert.equal(Number(firstCommand[9]), 14 * 24 * 60 * 60);
  assert.match(String(firstCommand[1]), /redis\.call\("GET", KEYS\[1\]\)/u);
  assert.match(String(firstCommand[1]), /redis\.call\("SET", KEYS\[1\]/u);
  assert.equal(
    calls.every(
      (call) =>
        call.authorization === `Bearer ${ENABLED_ENV.KV_REST_API_TOKEN}`,
    ),
    true,
  );
  assert.equal(
    JSON.stringify(calls.map((call) => call.parts)).includes(
      ENABLED_ENV.KV_REST_API_TOKEN,
    ),
    false,
  );

  const result = {
    draftId: first.draftId,
    slug: "2026-09-08-first-draft",
    claimId: "00000000-0000-4000-8000-000000000000",
    commitSha: "c".repeat(40),
    url: "https://news.investwithraj.com/news/2026-09-08-first-draft",
    completedAt: NOW.toISOString(),
  };
  assert.equal(
    await firstLedger.complete(first, firstOwner.token, result),
    false,
    "Completion is impossible before the owner crosses the commit barrier",
  );
  assert.equal(
    await firstLedger.markCommitStarted(first, firstOwner.token),
    "started",
  );
  assert.equal(
    (await secondLedger.claim(first)).status,
    "busy",
    "A commit-started receipt must never reopen automatically",
  );
  assert.equal(
    await firstLedger.complete(first, firstOwner.token, result),
    true,
  );
  const completedStored = stored as unknown as {
    status: string;
    result?: unknown;
  };
  assert.equal(completedStored.status, "completed");
  assert.deepEqual(completedStored.result, result);
  assert.equal((await secondLedger.claim(first)).status, "completed");
  const completeCommand = calls.at(-2)!.parts;
  assert.equal(completeCommand[0], "EVAL");
  assert.equal(completeCommand.length, 9);
  assert.equal(completeCommand[3], automatedPublicationDayKey(MORNING_DATE));
  assert.equal(completeCommand[4], automatedPublicationDayPayloadDigest(first));
  assert.equal(Number(completeCommand[8]), 14 * 24 * 60 * 60);
  const replacementResult = { ...result, commitSha: "d".repeat(40) };
  assert.equal(
    await firstLedger.complete(first, firstOwner.token, replacementResult),
    true,
  );
  assert.deepEqual(
    (stored as unknown as DayRecord).result,
    result,
    "A completed day receipt must be immutable",
  );

  stored = null;
  const retryOwner = await firstLedger.claim(first);
  assert.ok(retryOwner.status === "owner");
  assert.equal(
    await firstLedger.releaseBeforeCommit(
      first,
      "not-the-owner",
      "definite-pre-commit-failure",
    ),
    "not-owner",
  );
  assert.equal(
    await firstLedger.releaseBeforeCommit(
      first,
      retryOwner.token,
      "definite-pre-commit-failure",
    ),
    "released",
  );
  assert.equal((stored as unknown as DayRecord).status, "retryable");
  assert.equal(
    (await secondLedger.claim(second)).status,
    "conflict",
    "A retryable reservation remains bound to the original immutable draft",
  );
  const retried = await secondLedger.claim(first);
  assert.ok(retried.status === "owner");
  assert.notEqual(retried.token, retryOwner.token);

  const staleOwnerToken = retried.token;
  (stored as unknown as DayRecord).leaseExpiresAt = Date.now() - 1;
  const staleRecovery = await firstLedger.claim(first);
  assert.ok(staleRecovery.status === "owner");
  assert.equal(
    await secondLedger.markCommitStarted(first, staleOwnerToken),
    "lost",
    "A stale owner must not cross the GitHub commit boundary after recovery",
  );
  assert.equal(
    await firstLedger.markCommitStarted(first, staleRecovery.token),
    "started",
  );
  assert.equal(
    (await secondLedger.claim(first)).status,
    "busy",
    "A commit-started attempt remains pending after an ambiguous GitHub outcome",
  );
  assert.equal(
    await firstLedger.complete(first, staleRecovery.token, result),
    true,
    "An exact committed idempotent receipt must close the owned Dubai day",
  );
  assert.equal(
    (await secondLedger.claim(second)).status,
    "conflict",
    "Closing an idempotent commit must still block a different automated story",
  );

  let unavailableFetches = 0;
  const missing = await new KvAutomatedPublicationDayLedger(
    {},
    async () => {
      unavailableFetches += 1;
      return Response.json({ result: 1 });
    },
  ).claim(first);
  assert.equal(missing.status, "unavailable");
  assert.equal(unavailableFetches, 0);
  const failedTransport = await new KvAutomatedPublicationDayLedger(
    ENABLED_ENV,
    async () => new Response(null, { status: 503 }),
  ).claim(first);
  assert.equal(failedTransport.status, "unavailable");
}

async function testDispatchFailureAndMissingConfig(): Promise<void> {
  const ledger = new MemoryLedger();
  let dispatches = 0;
  const failed = await runNewsWatchdog({
    environment: ENABLED_ENV,
    now: NOW,
    ledger,
    observeCoverage: async () => coverage(false),
    dispatch: async () => {
      dispatches += 1;
      return { outcome: "rejected", status: 401 };
    },
  });
  assert.equal(failed.outcome, "dispatch-failed");
  assert.equal(failed.httpStatus, 502);
  assert.equal(failed.pending, false);
  assert.equal(ledger.state, "retryable");
  assert.equal(ledger.lastFailureCode, "github-http-401");
  const retry = await runNewsWatchdog({
    environment: ENABLED_ENV,
    now: NOW,
    ledger,
    observeCoverage: async () => coverage(false),
    dispatch: async () => {
      dispatches += 1;
      return { outcome: "accepted", status: 204 };
    },
  });
  assert.equal(retry.outcome, "dispatched");
  assert.equal(dispatches, 2, "A confirmed no-dispatch response must be retryable");
  assert.equal(ledger.state, "completed");

  const ambiguousLedger = new MemoryLedger();
  let ambiguousDispatches = 0;
  const ambiguous = await runNewsWatchdog({
    environment: ENABLED_ENV,
    now: NOW,
    ledger: ambiguousLedger,
    observeCoverage: async () => coverage(false),
    dispatch: async () => {
      ambiguousDispatches += 1;
      return { outcome: "ambiguous", status: 500 };
    },
  });
  assert.equal(ambiguous.outcome, "dispatch-unknown");
  assert.equal(ambiguous.httpStatus, 202);
  assert.equal(ambiguous.pending, true);
  assert.equal(ambiguousLedger.state, "dispatched");
  const ambiguousReplay = await runNewsWatchdog({
    environment: ENABLED_ENV,
    now: NOW,
    ledger: ambiguousLedger,
    observeCoverage: async () => coverage(false),
    dispatch: async () => {
      ambiguousDispatches += 1;
      return { outcome: "accepted", status: 204 };
    },
  });
  assert.equal(ambiguousReplay.outcome, "in-progress");
  assert.equal(
    ambiguousDispatches,
    1,
    "Timeouts, rate limits and server errors must remain pending rather than risk duplicate dispatch",
  );

  const missing = await runNewsWatchdog({
    environment: { ENABLE_NEWS_WATCHDOG: "1" },
    now: NOW,
    ledger: new MemoryLedger(),
  });
  assert.equal(missing.outcome, "configuration-missing");
  assert.equal(missing.httpStatus, 503);

  const disabled = await runNewsWatchdog({ environment: {}, now: NOW });
  assert.equal(disabled.outcome, "disabled");
  assert.equal(disabled.httpStatus, 200);
  assert.equal(disabled.ok, true);

  const reusedCredential = await runNewsWatchdog({
    environment: {
      ...ENABLED_ENV,
      GITHUB_ACTIONS_DISPATCH_TOKEN: ENABLED_ENV.CRON_SECRET,
    },
    now: NOW,
    ledger: new MemoryLedger(),
  });
  assert.equal(reusedCredential.outcome, "configuration-missing");
}

async function testDispatchContractAndCronAuthentication(): Promise<void> {
  const dispatchRequests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await dispatchNewsWorkflow({
    morningDate: MORNING_DATE,
    token: DISPATCH_TOKEN,
    fetcher: async (url, init) => {
      dispatchRequests.push({ url, init });
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(result.outcome, "accepted");
  assert.equal(dispatchRequests.length, 1);
  const dispatchRequest = dispatchRequests[0];
  assert.equal(
    dispatchRequest.url,
    `https://api.github.com/repos/investwithraj/news-investwithraj-site/actions/workflows/${NEWS_WORKFLOW_FILE}/dispatches`,
  );
  const requestBody = JSON.parse(String(dispatchRequest.init?.body));
  assert.deepEqual(requestBody, {
    ref: NEWS_WORKFLOW_REF,
    inputs: { morning_date: MORNING_DATE },
  });
  assert.equal(String(dispatchRequest.init?.body).includes(DISPATCH_TOKEN), false);
  assert.equal(dispatchRequest.url.includes(DISPATCH_TOKEN), false);

  const definite = await dispatchNewsWorkflow({
    morningDate: MORNING_DATE,
    token: DISPATCH_TOKEN,
    fetcher: async () => new Response(null, { status: 422 }),
  });
  assert.equal(definite.outcome, "rejected");
  const rateLimited = await dispatchNewsWorkflow({
    morningDate: MORNING_DATE,
    token: DISPATCH_TOKEN,
    fetcher: async () => new Response(null, { status: 429 }),
  });
  assert.equal(rateLimited.outcome, "ambiguous");
  const timedOut = await dispatchNewsWorkflow({
    morningDate: MORNING_DATE,
    token: DISPATCH_TOKEN,
    fetcher: async () => {
      throw new Error("timeout");
    },
  });
  assert.equal(timedOut.outcome, "ambiguous");

  const original = {
    cron: process.env.CRON_SECRET,
    post: process.env.POST_PUBLISH_SECRET,
    enabled: process.env.ENABLE_NEWS_WATCHDOG,
    dispatch: process.env.GITHUB_ACTIONS_DISPATCH_TOKEN,
    kvUrl: process.env.KV_REST_API_URL,
    kvToken: process.env.KV_REST_API_TOKEN,
  };
  process.env.CRON_SECRET = ENABLED_ENV.CRON_SECRET;
  process.env.POST_PUBLISH_SECRET = ENABLED_ENV.POST_PUBLISH_SECRET;
  delete process.env.ENABLE_NEWS_WATCHDOG;
  try {
    const inert = await runWatchdogRoute(
      new NextRequest("https://news.investwithraj.com/api/cron/news-watchdog"),
    );
    assert.equal(inert.status, 200);
    assert.equal((await inert.json()).outcome, "disabled");
    process.env.ENABLE_NEWS_WATCHDOG = "1";
    const unauthenticated = await runWatchdogRoute(
      new NextRequest("https://news.investwithraj.com/api/cron/news-watchdog"),
    );
    assert.equal(unauthenticated.status, 401);
    const wrongCredential = await runWatchdogRoute(
      new NextRequest("https://news.investwithraj.com/api/cron/news-watchdog", {
        headers: { "x-post-publish-secret": ENABLED_ENV.POST_PUBLISH_SECRET },
      }),
    );
    assert.equal(wrongCredential.status, 403);
    delete process.env.GITHUB_ACTIONS_DISPATCH_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const misconfigured = await runWatchdogRoute(
      new NextRequest("https://news.investwithraj.com/api/cron/news-watchdog", {
        headers: { authorization: `Bearer ${ENABLED_ENV.CRON_SECRET}` },
      }),
    );
    assert.equal(misconfigured.status, 503);
  } finally {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("CRON_SECRET", original.cron);
    restore("POST_PUBLISH_SECRET", original.post);
    restore("ENABLE_NEWS_WATCHDOG", original.enabled);
    restore("GITHUB_ACTIONS_DISPATCH_TOKEN", original.dispatch);
    restore("KV_REST_API_URL", original.kvUrl);
    restore("KV_REST_API_TOKEN", original.kvToken);
  }
}

async function testSchedulesAndSocialIsolation(): Promise<void> {
  const workflow = await readFile(
    resolve(process.cwd(), ".github/workflows/news-cron.yml"),
    "utf8",
  );
  const draftOnce = await readFile(
    resolve(process.cwd(), "scripts/draft-once.ts"),
    "utf8",
  );
  const autoApprove = await readFile(
    resolve(process.cwd(), "lib/news-review/auto-approve.ts"),
    "utf8",
  );
  const publishRoute = await readFile(
    resolve(process.cwd(), "app/api/news/draft/[id]/publish/route.ts"),
    "utf8",
  );
  const vercel = JSON.parse(
    await readFile(resolve(process.cwd(), "vercel.json"), "utf8"),
  ) as { crons?: Array<{ path?: string; schedule?: string }> };
  assert.match(workflow, /cron: "37 1 \* \* \*"/u);
  assert.match(workflow, /cron: "17 5 \* \* \*"/u);
  assert.match(workflow, /group: news-cron-production/u);
  assert.match(workflow, /AUTO_PUBLISH_LIMIT: "1"/u);
  assert.match(workflow, /AUTOMATED_MORNING_LANE:/u);
  assert.match(workflow, /MORNING_DATE:/u);
  assert.deepEqual(vercel.crons, [
    { path: "/api/cron/news-watchdog", schedule: "17 3 * * *" },
  ]);
  assert.doesNotMatch(JSON.stringify(vercel), /\/api\/cron\/draft/u);
  const repositoryGuardIndex = draftOnce.indexOf(
    "repositoryArticles: NEWS_ARTICLES",
  );
  const coveredReturnIndex = draftOnce.indexOf(
    "if (morningGuard.automated && morningGuard.covered)",
  );
  const secretGateIndex = draftOnce.indexOf(
    "new TextEncoder().encode(SECRET).byteLength",
  );
  const sourceIngestionIndex = draftOnce.indexOf("fetchAllSources()");
  assert.ok(repositoryGuardIndex >= 0);
  assert.ok(coveredReturnIndex > repositoryGuardIndex);
  assert.match(
    draftOnce.slice(coveredReturnIndex, secretGateIndex),
    /return;/u,
    "Repository coverage must exit before credentials, research or publication",
  );
  assert.ok(secretGateIndex > coveredReturnIndex);
  assert.ok(sourceIngestionIndex > secretGateIndex);
  assert.equal(
    (draftOnce.match(/guardAutomatedMorningPublication\(/gu) ?? []).length,
    2,
    "The automated lane must check coverage before research and again before publication",
  );
  assert.match(
    draftOnce,
    /const finalMorningGuard = await guardAutomatedMorningPublication\([\s\S]{0,300}?repositoryArticles: NEWS_ARTICLES[\s\S]{0,300}?finalMorningGuard\.automated && finalMorningGuard\.covered[\s\S]{0,220}?return;/u,
  );
  assert.match(
    draftOnce,
    /runAutoApprove\(\{[\s\S]{0,900}?requiredPublishedDubaiDate,/u,
    "The automated publication pass must restrict selection to the current Dubai day",
  );
  assert.match(
    draftOnce,
    /state\.publication = await runPublicationPass\([\s\S]{0,120}?morningGuard\.automated \? morningGuard\.morningDate : undefined/u,
  );
  assert.match(
    draftOnce,
    /automatedMorningLane: requiredPublishedDubaiDate !== undefined/u,
  );
  assert.match(
    autoApprove,
    /automatedMorningLane: true,[\s\S]{0,100}?requiredPublishedDubaiDate:/u,
  );
  const dayClaimIndex = publishRoute.indexOf("await ledger.claim(identity)");
  const draftClaimIndex = publishRoute.indexOf("await claimDraftPublication(id");
  const idempotentBranchIndex = publishRoute.indexOf(
    "claimedEvidence &&",
    draftClaimIndex,
  );
  const idempotentCommitBarrierIndex = publishRoute.indexOf(
    "idempotentCommitStart",
    idempotentBranchIndex,
  );
  const idempotentCompletionIndex = publishRoute.indexOf(
    "automatedDayCompleted = await automatedDay.ledger.complete",
    idempotentCommitBarrierIndex,
  );
  const idempotentReturnIndex = publishRoute.indexOf(
    "return privateJson({",
    idempotentCompletionIndex,
  );
  const commitBarrierIndex = publishRoute.indexOf(
    "await automatedDay.ledger.markCommitStarted",
    idempotentReturnIndex,
  );
  const rejectedCommitBarrierIndex = publishRoute.indexOf(
    'if (commitStart !== "started")',
  );
  const crossedCommitBoundaryIndex = publishRoute.indexOf(
    "automatedCommitBoundaryCrossed = true",
    rejectedCommitBarrierIndex,
  );
  const githubCommitIndex = publishRoute.indexOf("await publishArticleCommit(");
  assert.ok(dayClaimIndex >= 0);
  assert.ok(draftClaimIndex > dayClaimIndex);
  assert.ok(idempotentBranchIndex > draftClaimIndex);
  assert.ok(idempotentCommitBarrierIndex > idempotentBranchIndex);
  assert.ok(idempotentCompletionIndex > idempotentCommitBarrierIndex);
  assert.ok(idempotentReturnIndex > idempotentCompletionIndex);
  assert.ok(commitBarrierIndex > draftClaimIndex);
  assert.ok(rejectedCommitBarrierIndex > commitBarrierIndex);
  assert.ok(crossedCommitBoundaryIndex > rejectedCommitBarrierIndex);
  assert.ok(githubCommitIndex > crossedCommitBoundaryIndex);
  assert.match(
    publishRoute,
    /automated && body\.automatedMorningLane === true/u,
  );
  assert.match(
    publishRoute,
    /dayClaim\.status === "unavailable"[\s\S]{0,220}?503/u,
  );
  assert.match(
    publishRoute,
    /dayClaim\.status === "conflict"[\s\S]{0,220}?409/u,
  );
  assert.match(
    publishRoute,
    /dayClaim\.status === "busy"[\s\S]{0,260}?409/u,
  );
  assert.match(
    publishRoute,
    /dayClaim\.status === "completed"[\s\S]{0,260}?409/u,
  );
  assert.match(
    publishRoute,
    /finally \{[\s\S]{0,180}?automatedDay && !automatedCommitBoundaryCrossed[\s\S]{0,220}?releaseBeforeCommit/u,
    "A definite pre-commit failure must release only its own Dubai-day reservation",
  );

  const postPublishBodies: Array<Record<string, unknown>> = [];
  const postPublish = await notifyVerifiedPostPublish({
    origin: "https://news.investwithraj.com",
    secret: "s".repeat(32),
    claimId: "scheduler-social-regression",
    commitSha: "a".repeat(40),
    canonicalUrl:
      "https://news.investwithraj.com/news/2026-09-08-scheduler-social-regression",
    fetcher: async (_url, init) => {
      postPublishBodies.push(JSON.parse(String(init.body)));
      return Response.json({
        ok: true,
        pending: false,
        indexing: {
          requested: true,
          status: "completed",
          attempted: true,
          ok: true,
          duplicate: false,
          receiptPersisted: true,
        },
        distribution: {
          requested: false,
          status: "not-applicable",
          attempted: false,
          ok: true,
          duplicate: false,
          receiptPersisted: null,
        },
      });
    },
  });
  assert.equal(postPublish.ok, true);
  assert.equal(postPublishBodies.length, 1);
  assert.equal(postPublishBodies[0]?.distribute, false);
}

async function main(): Promise<void> {
  await testDubaiDayBoundaries();
  await testLiveCoverageAndHeldRetry();
  await testWatchdogConcurrencyReplayAndCoverage();
  await testKvLedgerTransportAndTransitions();
  await testAutomatedPublicationDayRace();
  await testDispatchFailureAndMissingConfig();
  await testDispatchContractAndCronAuthentication();
  await testSchedulesAndSocialIsolation();
  console.log(
    "News scheduler regression passed: Dubai boundaries, repository/live and final coverage guards, same-day publication selection and atomic publish-boundary race control, manual isolation, held recovery, real KV command transitions, one-shot dispatch, retryable versus ambiguous failures, cron auth and social-off policy are intact.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
