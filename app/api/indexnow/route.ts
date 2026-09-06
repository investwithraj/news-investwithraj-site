import { NextRequest } from "next/server";
import { explicitlyEnabled } from "@/lib/operations/features";
import { operationKey } from "@/lib/operations/idempotency";
import {
  INDEXNOW_ALLOWED_HOSTS,
  normalizeIndexNowUrls,
} from "@/lib/search/indexnow";
import { executeIndexNowOperation } from "@/lib/search/indexnow-operation";
import { isIndexNowLedgerConfigured } from "@/lib/search/indexnow-ledger";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
  rejectUrlCredentials,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

type SubmissionBody = {
  urls?: unknown;
  confirm?: unknown;
};

/** Read-only capability status. GET never submits a URL. */
export function GET(request: NextRequest) {
  const rejected = rejectUrlCredentials(request);
  if (rejected) return rejected;
  const featureEnabled = explicitlyEnabled("ENABLE_INDEXNOW_SUBMISSION");
  const durableReceiptStoreConfigured = isIndexNowLedgerConfigured();
  return publicStatusJson({
    name: "IndexNow submission",
    mutationMethod: "POST",
    featureEnabled,
    durableReceiptStoreConfigured,
    configured: featureEnabled && durableReceiptStoreConfigured,
    allowedHosts: INDEXNOW_ALLOWED_HOSTS,
    status:
      "disabled by default; authenticated confirmation is required for a submission",
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody<SubmissionBody>(request, {
    maxBytes: 128_000,
  });
  if (!parsed.ok) return parsed.response;

  const rawUrls = Array.isArray(parsed.value.urls) ? parsed.value.urls : [];
  const normalized = normalizeIndexNowUrls(rawUrls, 1_000);
  const urls = normalized.urls;
  if (urls.length === 0) {
    return privateJson(
      { error: "No valid canonical Invest With Raj URLs were supplied." },
      400,
    );
  }
  if (normalized.rejectedCount > 0) {
    return privateJson(
      {
        error:
          "Every URL must be an absolute HTTPS URL on the canonical host allowlist.",
        rejectedCount: normalized.rejectedCount,
      },
      400,
    );
  }

  if (parsed.value.confirm !== true) {
    return privateJson({
      ok: true,
      dryRun: true,
      submitted: false,
      acceptedUrlCount: urls.length,
      urls,
    });
  }
  if (!explicitlyEnabled("ENABLE_INDEXNOW_SUBMISSION")) {
    return privateJson(
      {
        error:
          "IndexNow submission is disabled. Set ENABLE_INDEXNOW_SUBMISSION=1 only after production review.",
      },
      503,
    );
  }

  const key = operationKey(request);
  if (!key) {
    return privateJson(
      { error: "A valid Idempotency-Key header is required." },
      428,
    );
  }
  const callerIdentifier =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-production-caller";
  const operation = await executeIndexNowOperation({
    idempotencyKey: key,
    urls,
    callerIdentifier,
  });
  if (operation.status === "conflict") {
    return privateJson(
      { error: "This Idempotency-Key was used for a different URL set." },
      409,
    );
  }
  if (operation.status === "rate-limited") {
    return privateJson(
      { error: "IndexNow submission quota reached. Retry in the next hour." },
      429,
    );
  }
  if (operation.status === "unavailable") {
    return privateJson(
      { error: "The durable IndexNow submission ledger is unavailable." },
      503,
    );
  }
  if (operation.status === "completed") {
    return privateJson(
      {
        ...operation.result,
        duplicate: operation.duplicate,
        cached: operation.duplicate,
        receiptPersisted: operation.receiptPersisted,
      },
      operation.result.ok ? 200 : 502,
    );
  }
  if (operation.status === "pending") {
    return privateJson(
      {
        ok: false,
        pending: true,
        duplicate: operation.duplicate,
        submitted: operation.attempted,
        status: operation.reason,
        receiptPersisted: operation.receiptPersisted,
        result: operation.result,
      },
      202,
    );
  }
  if (operation.status === "busy") {
    return privateJson(
      { error: "This exact submission is already being processed." },
      409,
    );
  }
  return privateJson({ error: "IndexNow operation failed safely." }, 503);
}
