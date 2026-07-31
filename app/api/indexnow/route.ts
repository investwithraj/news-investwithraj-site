import { NextRequest } from "next/server";
import { explicitlyEnabled } from "@/lib/operations/features";
import { operationKey } from "@/lib/operations/idempotency";
import {
  canonicalUrls,
  claimIndexNow,
  completeIndexNow,
  markIndexNowDispatched,
} from "@/lib/search/indexnow-ledger";
import { submitToIndexNow } from "@/lib/search/indexnow";
import {
  authorizeServerMutation,
  normalizeOwnedUrls,
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
  return publicStatusJson({
    name: "IndexNow submission",
    mutationMethod: "POST",
    configured: explicitlyEnabled("ENABLE_INDEXNOW_SUBMISSION"),
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
  const urls = canonicalUrls(normalizeOwnedUrls(rawUrls, { max: 1_000 }));
  if (urls.length === 0) {
    return privateJson(
      { error: "No valid news.investwithraj.com URLs were supplied." },
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
  const claim = await claimIndexNow(key, urls, callerIdentifier);
  if (claim.status === "conflict") {
    return privateJson(
      { error: "This Idempotency-Key was used for a different URL set." },
      409,
    );
  }
  if (claim.status === "rate-limited") {
    return privateJson(
      { error: "IndexNow submission quota reached. Retry in the next hour." },
      429,
    );
  }
  if (claim.status === "unavailable") {
    return privateJson(
      { error: "The durable IndexNow submission ledger is unavailable." },
      503,
    );
  }
  if (claim.status === "completed") {
    return privateJson({ ...claim.result, duplicate: true, cached: true });
  }
  if (claim.status === "dispatched") {
    return privateJson(
      {
        ok: true,
        duplicate: true,
        submitted: false,
        status: "dispatch-recorded",
      },
      202,
    );
  }
  if (claim.status === "busy") {
    return privateJson(
      { error: "This exact submission is already being processed." },
      409,
    );
  }
  if (claim.status !== "owner") {
    return privateJson(
      { error: "The IndexNow submission could not be claimed." },
      503,
    );
  }

  const dispatchReserved = await markIndexNowDispatched(
    key,
    claim.payloadDigest,
    claim.token,
  );
  if (!dispatchReserved) {
    return privateJson(
      { error: "The IndexNow dispatch receipt could not be reserved." },
      503,
    );
  }
  const result = await submitToIndexNow(urls);
  await completeIndexNow(key, claim.payloadDigest, claim.token, result);
  return privateJson(result, result.ok ? 200 : 502);
}
