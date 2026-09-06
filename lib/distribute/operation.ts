import type { NewsArticle } from "@/content/news/types";
import { distributeBatch } from "./index";
import {
  claimDistributionOperation,
  completeDistributionOperation,
  markDistributionDispatched,
  type DistributionOperationResult,
} from "./receipt-ledger";
import type { Channel } from "./types";

export type DistributionOperation =
  | {
      status: "completed";
      duplicate: boolean;
      result: DistributionOperationResult;
      receiptPersisted: true;
    }
  | {
      status: "pending";
      duplicate: boolean;
      attempted: boolean;
      receiptPersisted: false;
      reason: "dispatch-recorded" | "receipt-not-persisted";
      result?: DistributionOperationResult;
    }
  | { status: "conflict" }
  | { status: "unavailable" }
  | { status: "busy" };

type DistributionOperationDependencies = Readonly<{
  claimDistributionOperation: typeof claimDistributionOperation;
  markDistributionDispatched: typeof markDistributionDispatched;
  distributeBatch: typeof distributeBatch;
  completeDistributionOperation: typeof completeDistributionOperation;
}>;

const DEFAULT_DEPENDENCIES: DistributionOperationDependencies = {
  claimDistributionOperation,
  markDistributionDispatched,
  distributeBatch,
  completeDistributionOperation,
};

/** Durable, at-most-once distribution execution shared by protected routes. */
export async function executeDistributionOperation(
  input: {
    idempotencyKey: string;
    articles: NewsArticle[];
    channels: Channel[];
  },
  dependencies: DistributionOperationDependencies = DEFAULT_DEPENDENCIES,
): Promise<DistributionOperation> {
  const slugs = input.articles.map((article) => article.slug);
  const claim = await dependencies.claimDistributionOperation(
    input.idempotencyKey,
    slugs,
    input.channels,
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

  const dispatchReserved = await dependencies.markDistributionDispatched(
    input.idempotencyKey,
    claim.payloadDigest,
    claim.token,
  );
  if (!dispatchReserved) return { status: "unavailable" };

  const runs = await dependencies.distributeBatch(
    input.articles,
    input.channels,
  );
  const result: DistributionOperationResult = {
    ok:
      runs.length === input.articles.length &&
      runs.every(
        (run) => run.failureCount === 0 && run.skippedCount === 0,
      ),
    articleSlugs: slugs,
    channels: input.channels,
    runs,
    completedAt: new Date().toISOString(),
  };
  const receiptPersisted = await dependencies.completeDistributionOperation(
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
