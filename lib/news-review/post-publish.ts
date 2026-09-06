export type VerifiedPostPublishStage = Readonly<{
  requested: boolean;
  status: string;
  attempted: boolean;
  ok: boolean;
  duplicate: boolean;
  receiptPersisted: boolean | null;
}>;

export type VerifiedPostPublishResult = Readonly<{
  ok: boolean;
  pending: boolean;
  httpStatus: number | null;
  code:
    | "completed"
    | "pending"
    | "post-publish-target-invalid"
    | "post-publish-secret-missing"
    | "post-publish-request-failed"
    | "post-publish-operation-failed";
  indexing: VerifiedPostPublishStage | null;
  distribution: VerifiedPostPublishStage | null;
  operatorAction: string | null;
}>;

export function postPublishCompletionStatus(
  result: VerifiedPostPublishResult,
): 200 | 202 | 502 {
  if (result.ok) return 200;
  return result.pending ? 202 : 502;
}

type PostPublishFetcher = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

function stageReceipt(value: unknown): VerifiedPostPublishStage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.requested !== "boolean" ||
    typeof record.status !== "string" ||
    typeof record.attempted !== "boolean" ||
    typeof record.ok !== "boolean"
  ) {
    return null;
  }
  const detail =
    record.detail && typeof record.detail === "object"
      ? (record.detail as Record<string, unknown>)
      : null;
  const persistedValue =
    typeof record.receiptPersisted === "boolean"
      ? record.receiptPersisted
      : typeof detail?.receiptPersisted === "boolean"
        ? detail.receiptPersisted
        : null;
  return {
    requested: record.requested,
    status: record.status.slice(0, 64),
    attempted: record.attempted,
    ok: record.ok,
    duplicate: record.duplicate === true,
    receiptPersisted: persistedValue,
  };
}

function stageDurablyComplete(stage: VerifiedPostPublishStage | null): boolean {
  if (!stage?.ok) return false;
  if (!stage.requested) return stage.status === "not-applicable";
  return stage.status === "completed" && stage.receiptPersisted === true;
}

/**
 * Notify the protected post-publish orchestrator only after the caller has
 * proved the exact commit on the canonical deployment. The stable claim key
 * makes the external operation idempotent. Provider bodies are intentionally
 * reduced to bounded stage receipts before they reach a publication response.
 */
export async function notifyVerifiedPostPublish(input: {
  origin: string;
  secret: string | undefined;
  claimId: string;
  commitSha: string;
  canonicalUrl: string;
  fetcher?: PostPublishFetcher;
}): Promise<VerifiedPostPublishResult> {
  let origin: URL;
  let canonical: URL;
  try {
    origin = new URL(input.origin);
    canonical = new URL(input.canonicalUrl);
  } catch {
    return {
      ok: false,
      pending: false,
      httpStatus: null,
      code: "post-publish-target-invalid",
      indexing: null,
      distribution: null,
      operatorAction: "Verify the canonical newsroom origin and article URL.",
    };
  }
  if (
    origin.protocol !== "https:" ||
    canonical.protocol !== "https:" ||
    origin.origin !== canonical.origin ||
    canonical.hostname !== "news.investwithraj.com" ||
    !/^\/news\/[a-z0-9-]{1,180}\/?$/u.test(canonical.pathname)
  ) {
    return {
      ok: false,
      pending: false,
      httpStatus: null,
      code: "post-publish-target-invalid",
      indexing: null,
      distribution: null,
      operatorAction: "Verify the canonical newsroom origin and article URL.",
    };
  }
  if (new TextEncoder().encode(input.secret ?? "").byteLength < 32) {
    return {
      ok: false,
      pending: false,
      httpStatus: null,
      code: "post-publish-secret-missing",
      indexing: null,
      distribution: null,
      operatorAction:
        "Configure the protected post-publish secret on the newsroom deployment.",
    };
  }

  const fetcher = input.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`${origin.origin}/api/post-publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-post-publish-secret": input.secret!,
        "Idempotency-Key": `news-${input.claimId}`,
      },
      body: JSON.stringify({
        newUrls: [input.canonicalUrl],
        deploymentId: input.commitSha,
        indexNow: true,
        // Social publishing remains a separate, explicitly authorised phase.
        distribute: false,
        confirm: true,
      }),
    });
  } catch {
    return {
      ok: false,
      pending: false,
      httpStatus: null,
      code: "post-publish-request-failed",
      indexing: null,
      distribution: null,
      operatorAction:
        "Inspect the protected newsroom log and safely run a new post-publish operation.",
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: unknown;
    pending?: unknown;
    indexing?: unknown;
    distribution?: unknown;
  } | null;
  const indexing = stageReceipt(payload?.indexing);
  const distribution = stageReceipt(payload?.distribution);
  const stages = [indexing, distribution];
  const completionReceiptMissing = stages.some(
    (stage) =>
      stage?.requested === true &&
      stage.status === "completed" &&
      stage.receiptPersisted !== true,
  );
  const pending =
    response.status === 202 ||
    payload?.pending === true ||
    completionReceiptMissing ||
    stages.some((stage) => stage?.status === "pending");
  const ok =
    response.ok &&
    response.status !== 202 &&
    payload?.ok === true &&
    pending === false &&
    stageDurablyComplete(indexing) &&
    stageDurablyComplete(distribution);

  return {
    ok,
    pending,
    httpStatus: response.status,
    code: ok
      ? "completed"
      : pending
        ? "pending"
        : "post-publish-operation-failed",
    indexing,
    distribution,
    operatorAction: ok
      ? null
      : pending
        ? "The post-publish operation or its durable completion receipt is pending or unknown; do not replay the same operation key."
        : "Inspect the protected post-publish receipts, then run an explicitly authorised recovery operation.",
  };
}
