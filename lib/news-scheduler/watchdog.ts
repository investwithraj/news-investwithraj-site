import { validatedDubaiMorningDate } from "./day";
import { observeLiveDubaiDayCoverage } from "./coverage";
import {
  KvMorningDispatchLedger,
  schedulerLedgerConfigured,
} from "./ledger";
import {
  NEWSROOM_ORIGIN,
  NEWS_WORKFLOW_FILE,
  NEWS_WORKFLOW_OWNER,
  NEWS_WORKFLOW_REF,
  NEWS_WORKFLOW_REPOSITORY,
  type LiveDayCoverage,
  type GitHubDispatchResult,
  type MorningDispatchLedger,
  type MorningDispatchResult,
  type NewsWatchdogReceipt,
} from "./types";

type SchedulerEnvironment = Readonly<Record<string, string | undefined>>;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type WatchdogDependencies = Readonly<{
  environment?: SchedulerEnvironment;
  now?: Date;
  ledger?: MorningDispatchLedger;
  observeCoverage?: (morningDate: string) => Promise<LiveDayCoverage>;
  dispatch?: (morningDate: string) => Promise<GitHubDispatchResult>;
}>;

function baseReceipt(
  morningDate: string,
  values: Omit<NewsWatchdogReceipt, "morningDate">,
): NewsWatchdogReceipt {
  return { morningDate, ...values };
}

function configured(environment: SchedulerEnvironment): boolean {
  const dispatchToken = environment.GITHUB_ACTIONS_DISPATCH_TOKEN?.trim() ?? "";
  return (
    environment.ENABLE_NEWS_WATCHDOG === "1" &&
    schedulerLedgerConfigured(environment) &&
    dispatchToken.length >= 20 &&
    dispatchToken !== environment.CRON_SECRET?.trim() &&
    dispatchToken !== environment.POST_PUBLISH_SECRET?.trim()
  );
}

export async function dispatchNewsWorkflow(input: {
  morningDate: string;
  token: string;
  fetcher?: Fetcher;
}): Promise<GitHubDispatchResult> {
  const fetcher = input.fetcher ?? fetch;
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${NEWS_WORKFLOW_OWNER}/${NEWS_WORKFLOW_REPOSITORY}/actions/workflows/${NEWS_WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${input.token}`,
          "content-type": "application/json",
          "user-agent": "investwithraj-news-watchdog",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: NEWS_WORKFLOW_REF,
          inputs: { morning_date: input.morningDate },
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.status === 204) {
      return { outcome: "accepted", status: response.status };
    }
    if ([400, 401, 403, 404, 422].includes(response.status)) {
      return { outcome: "rejected", status: response.status };
    }
    return { outcome: "ambiguous", status: response.status };
  } catch {
    return { outcome: "ambiguous", status: 0 };
  }
}

/**
 * Lightweight Vercel watchdog. It never researches, drafts or publishes. It
 * only observes the live Dubai-day state and, when still uncovered, requests
 * one bounded run of the GitHub workflow.
 */
export async function runNewsWatchdog(
  dependencies: WatchdogDependencies = {},
): Promise<NewsWatchdogReceipt> {
  const environment = dependencies.environment ?? process.env;
  const now = dependencies.now ?? new Date();
  let morningDate: string;
  try {
    morningDate = validatedDubaiMorningDate(undefined, now);
  } catch {
    return baseReceipt("unknown", {
      ok: false,
      pending: false,
      httpStatus: 503,
      outcome: "configuration-missing",
      articleUrl: null,
      operatorAction: "Verify the runtime clock and Dubai calendar support.",
    });
  }

  if (environment.ENABLE_NEWS_WATCHDOG !== "1") {
    return baseReceipt(morningDate, {
      ok: true,
      pending: false,
      httpStatus: 200,
      outcome: "disabled",
      articleUrl: null,
      operatorAction: null,
    });
  }

  if (!configured(environment)) {
    return baseReceipt(morningDate, {
      ok: false,
      pending: false,
      httpStatus: 503,
      outcome: "configuration-missing",
      articleUrl: null,
      operatorAction:
        "Enable the watchdog and configure its distinct GitHub dispatch credential plus durable KV.",
    });
  }

  const ledger = dependencies.ledger ?? new KvMorningDispatchLedger(environment);
  const claim = await ledger.claim(morningDate);
  if (claim.status === "completed") {
    return baseReceipt(morningDate, {
      ok: true,
      pending: false,
      httpStatus: 200,
      outcome: "replay",
      articleUrl: claim.result.articleUrl,
      operatorAction: null,
    });
  }
  if (claim.status === "busy" || claim.status === "dispatched") {
    return baseReceipt(morningDate, {
      ok: false,
      pending: true,
      httpStatus: 202,
      outcome: "in-progress",
      articleUrl: null,
      operatorAction: null,
    });
  }
  if (claim.status === "conflict") {
    return baseReceipt(morningDate, {
      ok: false,
      pending: false,
      httpStatus: 409,
      outcome: "conflict",
      articleUrl: null,
      operatorAction: "Inspect the durable watchdog receipt for this Dubai date.",
    });
  }
  if (claim.status === "unavailable") {
    return baseReceipt(morningDate, {
      ok: false,
      pending: false,
      httpStatus: 503,
      outcome: "ledger-unavailable",
      articleUrl: null,
      operatorAction: "Restore the durable watchdog ledger before retrying.",
    });
  }
  if (claim.status !== "owner") {
    return baseReceipt(morningDate, {
      ok: false,
      pending: false,
      httpStatus: 503,
      outcome: "ledger-unavailable",
      articleUrl: null,
      operatorAction: "The durable watchdog ledger returned an invalid claim.",
    });
  }

  let coverage: LiveDayCoverage;
  try {
    coverage = dependencies.observeCoverage
      ? await dependencies.observeCoverage(morningDate)
      : await observeLiveDubaiDayCoverage({
          morningDate,
          site: NEWSROOM_ORIGIN,
        });
  } catch {
    return baseReceipt(morningDate, {
      ok: false,
      pending: false,
      httpStatus: 502,
      outcome: "coverage-unavailable",
      articleUrl: null,
      operatorAction:
        "Restore canonical newsroom observation; the watchdog failed closed without dispatching.",
    });
  }

  if (
    !(await ledger.markDispatched(
      morningDate,
      claim.payloadDigest,
      claim.token,
    ))
  ) {
    return baseReceipt(morningDate, {
      ok: false,
      pending: false,
      httpStatus: 503,
      outcome: "ledger-unavailable",
      articleUrl: coverage.articleUrl,
      operatorAction:
        "Restore the durable watchdog ledger; no GitHub dispatch was attempted.",
    });
  }

  let outcome: MorningDispatchResult["outcome"] = "already-covered";
  if (!coverage.covered) {
    const dispatch = dependencies.dispatch
      ? await dependencies.dispatch(morningDate)
      : await dispatchNewsWorkflow({
          morningDate,
          token: environment.GITHUB_ACTIONS_DISPATCH_TOKEN!.trim(),
        });
    if (dispatch.outcome === "rejected") {
      const retryable = await ledger.markRetryable(
        morningDate,
        claim.payloadDigest,
        claim.token,
        `github-http-${dispatch.status}`,
      );
      if (!retryable) {
        return baseReceipt(morningDate, {
          ok: false,
          pending: true,
          httpStatus: 202,
          outcome: "dispatch-unknown",
          articleUrl: null,
          operatorAction:
            "GitHub rejected the dispatch, but the retryable receipt could not be persisted; inspect the ledger before replaying.",
        });
      }
      return baseReceipt(morningDate, {
        ok: false,
        pending: false,
        httpStatus: 502,
        outcome: "dispatch-failed",
        articleUrl: null,
        operatorAction:
          "Correct the GitHub workflow dispatch request or credential, then retry; the scheduled recovery remains independent.",
      });
    }
    if (dispatch.outcome === "ambiguous") {
      return baseReceipt(morningDate, {
        ok: false,
        pending: true,
        httpStatus: 202,
        outcome: "dispatch-unknown",
        articleUrl: null,
        operatorAction:
          "The GitHub dispatch outcome is unknown; do not replay it. The scheduled recovery remains independent.",
      });
    }
    outcome = "dispatched";
  }

  const result: MorningDispatchResult = {
    outcome,
    morningDate,
    workflow: NEWS_WORKFLOW_FILE,
    ref: NEWS_WORKFLOW_REF,
    completedAt: now.toISOString(),
    articleUrl: coverage.articleUrl,
  };
  if (
    !(await ledger.complete(
      morningDate,
      claim.payloadDigest,
      claim.token,
      result,
    ))
  ) {
    return baseReceipt(morningDate, {
      ok: false,
      pending: true,
      httpStatus: 202,
      outcome: "in-progress",
      articleUrl: coverage.articleUrl,
      operatorAction:
        "The dispatch outcome is known but its durable completion receipt is pending; do not replay it.",
    });
  }

  return baseReceipt(morningDate, {
    ok: true,
    pending: false,
    httpStatus: 200,
    outcome,
    articleUrl: coverage.articleUrl,
    operatorAction: null,
  });
}
