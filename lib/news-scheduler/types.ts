export const NEWSROOM_ORIGIN = "https://news.investwithraj.com";
export const NEWS_WORKFLOW_OWNER = "investwithraj";
export const NEWS_WORKFLOW_REPOSITORY = "news-investwithraj-site";
export const NEWS_WORKFLOW_FILE = "news-cron.yml";
export const NEWS_WORKFLOW_REF = "main";

export type MorningDispatchResult = Readonly<{
  outcome: "dispatched" | "already-covered";
  morningDate: string;
  workflow: typeof NEWS_WORKFLOW_FILE;
  ref: typeof NEWS_WORKFLOW_REF;
  completedAt: string;
  articleUrl: string | null;
}>;

export type MorningDispatchClaim =
  | Readonly<{ status: "owner"; token: string; payloadDigest: string }>
  | Readonly<{ status: "completed"; result: MorningDispatchResult }>
  | Readonly<{
      status: "busy" | "dispatched" | "conflict" | "unavailable";
    }>;

export interface MorningDispatchLedger {
  claim(morningDate: string): Promise<MorningDispatchClaim>;
  markDispatched(
    morningDate: string,
    payloadDigest: string,
    token: string,
  ): Promise<boolean>;
  complete(
    morningDate: string,
    payloadDigest: string,
    token: string,
    result: MorningDispatchResult,
  ): Promise<boolean>;
  markRetryable(
    morningDate: string,
    payloadDigest: string,
    token: string,
    failureCode: string,
  ): Promise<boolean>;
}

export type GitHubDispatchResult = Readonly<{
  outcome: "accepted" | "rejected" | "ambiguous";
  status: number;
}>;

export type LiveDayCoverage = Readonly<{
  morningDate: string;
  covered: boolean;
  articleUrl: string | null;
  publishedAt: string | null;
}>;

export type NewsWatchdogReceipt = Readonly<{
  ok: boolean;
  pending: boolean;
  httpStatus: 200 | 202 | 409 | 502 | 503;
  outcome:
    | "dispatched"
    | "already-covered"
    | "replay"
    | "disabled"
    | "in-progress"
    | "conflict"
    | "configuration-missing"
    | "coverage-unavailable"
    | "ledger-unavailable"
    | "dispatch-failed"
    | "dispatch-unknown";
  morningDate: string;
  articleUrl: string | null;
  operatorAction: string | null;
}>;
