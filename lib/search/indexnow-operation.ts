import {
  claimIndexNow,
  completeIndexNow,
  markIndexNowDispatched,
} from "./indexnow-ledger";
import { submitToIndexNow, type IndexNowResult } from "./indexnow";

export type IndexNowOperation =
  | {
      status: "completed";
      duplicate: boolean;
      result: IndexNowResult;
      receiptPersisted: true;
    }
  | {
      status: "pending";
      duplicate: boolean;
      attempted: boolean;
      receiptPersisted: false;
      reason: "dispatch-recorded" | "receipt-not-persisted";
      result?: IndexNowResult;
    }
  | {
      status: "conflict" | "rate-limited" | "unavailable" | "busy";
    };

type IndexNowOperationDependencies = Readonly<{
  claimIndexNow: typeof claimIndexNow;
  markIndexNowDispatched: typeof markIndexNowDispatched;
  submitToIndexNow: typeof submitToIndexNow;
  completeIndexNow: typeof completeIndexNow;
}>;

const DEFAULT_DEPENDENCIES: IndexNowOperationDependencies = {
  claimIndexNow,
  markIndexNowDispatched,
  submitToIndexNow,
  completeIndexNow,
};

/** Durable, at-most-once IndexNow execution shared by both protected routes. */
export async function executeIndexNowOperation(
  input: {
    idempotencyKey: string;
    urls: string[];
    callerIdentifier: string;
  },
  dependencies: IndexNowOperationDependencies = DEFAULT_DEPENDENCIES,
): Promise<IndexNowOperation> {
  const claim = await dependencies.claimIndexNow(
    input.idempotencyKey,
    input.urls,
    input.callerIdentifier,
  );
  if (claim.status === "completed") {
    return {
      status: "completed",
      duplicate: true,
      result: claim.result,
      receiptPersisted: true,
    };
  }
  if (claim.status === "dispatched") {
    return {
      status: "pending",
      duplicate: true,
      attempted: false,
      receiptPersisted: false,
      reason: "dispatch-recorded",
    };
  }
  if (claim.status !== "owner") return { status: claim.status };

  const dispatchReserved = await dependencies.markIndexNowDispatched(
    input.idempotencyKey,
    claim.payloadDigest,
    claim.token,
  );
  if (!dispatchReserved) return { status: "unavailable" };

  const result = await dependencies.submitToIndexNow(input.urls);
  const receiptPersisted = await dependencies.completeIndexNow(
    input.idempotencyKey,
    claim.payloadDigest,
    claim.token,
    result,
  );
  if (!receiptPersisted) {
    return {
      status: "pending",
      duplicate: false,
      attempted: true,
      receiptPersisted: false,
      reason: "receipt-not-persisted",
      result,
    };
  }
  return {
    status: "completed",
    duplicate: false,
    result,
    receiptPersisted: true,
  };
}
