import { appendFile } from "node:fs/promises";
import { dubaiCalendarDate } from "../../lib/dubai-time";

export const NEWS_FRONT_SCHEMA_VERSION = "front-v1" as const;
export const DEFAULT_MAX_NEWEST_PUBLICATION_AGE_HOURS = 36;

export type NewsCronOutcome =
  | "published"
  | "staged"
  | "held"
  | "deferred"
  | "failed"
  | "no-eligible";

export interface PublicationPassTelemetry {
  total: number;
  eligible: number;
  approved: number;
  published: number;
  failed: number;
  held: number;
  deferred: number;
  publicationShas: string[];
  publishedSlugs: string[];
  deploymentVerified: number;
  pendingVerification: number;
  verificationSkipped: number;
  postPublishCompleted?: number;
  postPublishPending?: number;
  postPublishFailed?: number;
  failureMessages: string[];
  holdReasonCounts?: Record<string, number>;
  heldDetails?: Array<{ slug: string; reasons: string[] }>;
}

export interface NewestPublicationObservation {
  feedState: "fresh" | "stale" | "empty";
  newestPublishedAt: string | null;
  ageHours: number | null;
  observedAt: string;
}

export interface NewsCronRunInput {
  startedAt: string;
  finishedAt: string;
  draftingEnabled: boolean;
  candidates: number;
  attempts: number;
  staged: number;
  draftHeld: number;
  draftHoldReasons?: string[];
  technicalFailures: number;
  failureMessages: string[];
  publication: PublicationPassTelemetry | null;
  observation: NewestPublicationObservation | null;
  /** Automated daily runs must observe an actual publication for this Dubai day. */
  requiredPublishedDubaiDate?: string;
  /** May tighten or relax alert cadence within a safe 12-72 hour range. */
  maxNewestPublicationAgeHours?: number;
}

export interface NewsCronRunReport extends NewsCronRunInput {
  primaryOutcome: NewsCronOutcome;
  outcomes: NewsCronOutcome[];
  publicationShas: string[];
  publishedSlugs: string[];
  failed: number;
  held: number;
  deferred: number;
  shouldFail: boolean;
  operationalFailureReasons: string[];
  actionableReasons: string[];
}

type FrontFeedFetcher = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

function exactIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString() === value ? value : null;
}

export async function observeNewestPublication(options: {
  site: string;
  fetcher?: FrontFeedFetcher;
  now?: Date;
}): Promise<NewestPublicationObservation> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const response = await fetcher(
    `${options.site.replace(/\/$/u, "")}/api/front`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`front feed observation failed (${response.status})`);
  }

  const payload = (await response.json().catch(() => null)) as {
    schemaVersion?: unknown;
    freshness?: {
      state?: unknown;
      newestPublishedAt?: unknown;
    };
  } | null;
  if (payload?.schemaVersion !== NEWS_FRONT_SCHEMA_VERSION) {
    throw new Error(
      `front feed observation did not match ${NEWS_FRONT_SCHEMA_VERSION}`,
    );
  }

  const state = payload.freshness?.state;
  if (state !== "fresh" && state !== "stale" && state !== "empty") {
    throw new Error("front feed observation has an invalid freshness state");
  }

  const newestPublishedAt =
    payload.freshness?.newestPublishedAt === null
      ? null
      : exactIso(payload.freshness?.newestPublishedAt);
  if (state !== "empty" && newestPublishedAt === null) {
    throw new Error("front feed observation is missing a valid publication time");
  }
  if (state === "empty" && payload.freshness?.newestPublishedAt !== null) {
    throw new Error("empty front feed observation must not name a publication");
  }

  const ageHours = newestPublishedAt
    ? Math.round(
        (Math.max(0, now.getTime() - Date.parse(newestPublishedAt)) /
          3_600_000) *
          10,
      ) / 10
    : null;

  return {
    feedState: state,
    newestPublishedAt,
    ageHours,
    observedAt: now.toISOString(),
  };
}

export function buildNewsCronRunReport(
  input: NewsCronRunInput,
): NewsCronRunReport {
  const publication = input.publication;
  const held = input.draftHeld + (publication?.held ?? 0);
  const deferred = publication?.deferred ?? 0;
  const maxAgeHours = Number.isFinite(input.maxNewestPublicationAgeHours)
    ? Math.max(
        12,
        Math.min(72, input.maxNewestPublicationAgeHours as number),
      )
    : DEFAULT_MAX_NEWEST_PUBLICATION_AGE_HOURS;
  const operationalFailureReasons: string[] = [];
  const published = publication?.published ?? 0;
  const ageHours = input.observation?.ageHours;
  const feedPastCadence =
    input.observation?.feedState === "empty" ||
    input.observation?.feedState === "stale" ||
    (typeof ageHours === "number" && ageHours > maxAgeHours);
  if (!input.observation) {
    operationalFailureReasons.push(
      "front-feed freshness could not be observed",
    );
  } else if (feedPastCadence) {
    const age = ageHours === null ? "empty" : `${ageHours}h old`;
    operationalFailureReasons.push(
      published === 0 && input.staged === 0 && held > 0
        ? `held-only run left the public feed ${age}; maximum cadence is ${maxAgeHours}h`
        : `public feed is ${age}; maximum cadence is ${maxAgeHours}h`,
    );
  }
  if (input.requiredPublishedDubaiDate) {
    const observedDay = input.observation?.newestPublishedAt
      ? dubaiCalendarDate(input.observation.newestPublishedAt)
      : null;
    if (observedDay !== input.requiredPublishedDubaiDate) {
      operationalFailureReasons.push(
        `no live publication observed for Dubai day ${input.requiredPublishedDubaiDate}; latest publication day is ${observedDay ?? "none"}`,
      );
    }
  }
  if (published > 0 && (
    publication?.deploymentVerified !== published ||
    (publication?.pendingVerification ?? 0) > 0 ||
    (publication?.verificationSkipped ?? 0) > 0
  )) {
    operationalFailureReasons.push("publication was committed but its exact canonical deployment is not verified");
  }
  const failed =
    input.technicalFailures +
    (publication?.failed ?? 0) +
    operationalFailureReasons.length;
  const outcomes: NewsCronOutcome[] = [];

  if (published > 0) outcomes.push("published");
  if (input.staged > 0) outcomes.push("staged");
  if (held > 0) outcomes.push("held");
  if (deferred > 0) outcomes.push("deferred");
  if (failed > 0) outcomes.push("failed");
  if (outcomes.length === 0) outcomes.push("no-eligible");

  const primaryOutcome =
    outcomes.includes("failed")
      ? "failed"
      : outcomes.includes("published")
        ? "published"
        : outcomes.includes("staged")
          ? "staged"
          : outcomes.includes("held")
            ? "held"
            : outcomes.includes("deferred")
              ? "deferred"
              : "no-eligible";

  const holdCategories = Object.entries(publication?.holdReasonCounts ?? {})
    .slice(0, 10)
    .map(([reason, count]) => `${reason}: ${count}`);
  const heldDetails = (publication?.heldDetails ?? [])
    .slice(0, 5)
    .map(({ slug, reasons }) => `${slug}: ${reasons.slice(0, 3).join("; ")}`);
  const actionableReasons = [
    ...operationalFailureReasons,
    ...input.failureMessages,
    ...(publication?.failureMessages ?? []),
    ...(input.draftHoldReasons ?? []).slice(0, 5),
    ...holdCategories,
    ...heldDetails,
  ].filter((reason, index, all) => reason && all.indexOf(reason) === index);

  return {
    ...input,
    primaryOutcome,
    outcomes,
    publicationShas: publication?.publicationShas ?? [],
    publishedSlugs: publication?.publishedSlugs ?? [],
    failed,
    held,
    deferred,
    shouldFail: failed > 0,
    operationalFailureReasons,
    actionableReasons,
  };
}

function workflowCommandValue(value: string): string {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function markdownValue(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ");
}

export async function emitNewsCronRunReport(
  report: NewsCronRunReport,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const newestPublishedAt = report.observation?.newestPublishedAt ?? "none";
  const ageHours = report.observation?.ageHours;
  const output = {
    outcome: report.primaryOutcome,
    outcomes: report.outcomes.join(","),
    published_count: String(report.publication?.published ?? 0),
    verified_publication_count: String(report.publication?.deploymentVerified ?? 0),
    required_publication_day: report.requiredPublishedDubaiDate ?? "not-required",
    staged_count: String(report.staged),
    held_count: String(report.held),
    deferred_count: String(report.deferred),
    failed_count: String(report.failed),
    publication_sha: report.publicationShas[0] ?? "none",
    publication_shas: report.publicationShas.join(",") || "none",
    newest_published_at: newestPublishedAt,
    newest_publication_age_hours:
      ageHours === null || ageHours === undefined ? "unknown" : String(ageHours),
    front_feed_state: report.observation?.feedState ?? "unavailable",
    post_publish_completed: String(report.publication?.postPublishCompleted ?? 0),
    post_publish_pending: String(report.publication?.postPublishPending ?? 0),
    post_publish_failed: String(report.publication?.postPublishFailed ?? 0),
    should_fail: report.shouldFail ? "1" : "0",
    actionable_reasons:
      report.actionableReasons
        .slice(0, 12)
        .join("; ")
        .replaceAll("\r", " ")
        .replaceAll("\n", " ")
        .slice(0, 4_000) || "none",
  } as const;

  if (environment.GITHUB_OUTPUT) {
    await appendFile(
      environment.GITHUB_OUTPUT,
      `${Object.entries(output)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}\n`,
      "utf8",
    );
  }

  if (environment.GITHUB_STEP_SUMMARY) {
    const failures = report.actionableReasons;
    const summary = [
      "### Daily news pipeline receipt",
      "",
      "| Signal | Result |",
      "| --- | --- |",
      `| Outcome | ${markdownValue(report.primaryOutcome)} |`,
      `| All outcomes | ${markdownValue(report.outcomes.join(", "))} |`,
      `| Published / staged | ${report.publication?.published ?? 0} / ${report.staged} |`,
      `| Canonical deployment verified | ${report.publication?.deploymentVerified ?? 0} |`,
      `| Required Dubai publication day | ${report.requiredPublishedDubaiDate ?? "not required for this run"} |`,
      `| Held / deferred / failed | ${report.held} / ${report.deferred} / ${report.failed} |`,
      `| Publication SHA | ${markdownValue(report.publicationShas.join(", ") || "none")} |`,
      `| Newest publication | ${markdownValue(newestPublishedAt)} |`,
      `| Newest-publication age | ${ageHours === null || ageHours === undefined ? "unknown" : `${ageHours} hours`} |`,
      `| Front-feed state | ${report.observation?.feedState ?? "unavailable"} |`,
      `| Post-publish completed / pending / failed | ${report.publication?.postPublishCompleted ?? 0} / ${report.publication?.postPublishPending ?? 0} / ${report.publication?.postPublishFailed ?? 0} |`,
      `| Workflow must fail | ${report.shouldFail ? "yes" : "no"} |`,
      `| Started / finished | ${markdownValue(report.startedAt)} / ${markdownValue(report.finishedAt)} |`,
      ...(failures.length > 0
        ? [
            "",
            "#### Action required",
            ...failures.map((failure) => `- ${markdownValue(failure)}`),
          ]
        : []),
      "",
    ].join("\n");
    await appendFile(environment.GITHUB_STEP_SUMMARY, summary, "utf8");
  }

  const notice = `outcome=${report.primaryOutcome}; outcomes=${report.outcomes.join(",")}; published=${report.publication?.published ?? 0}; staged=${report.staged}; held=${report.held}; deferred=${report.deferred}; failed=${report.failed}; publication_sha=${report.publicationShas[0] ?? "none"}; newest_age_hours=${ageHours ?? "unknown"}`;
  if (environment.GITHUB_ACTIONS === "true") {
    const command = report.shouldFail ? "error" : "notice";
    console.log(
      `::${command} title=Daily news pipeline::${workflowCommandValue(notice)}`,
    );
  } else {
    console.log(`news-cron receipt: ${notice}`);
  }
}
