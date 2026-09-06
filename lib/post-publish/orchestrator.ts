import { createHash } from "node:crypto";

import type { NewsArticle } from "@/content/news/types";
import {
  type Channel,
  channelConfiguration,
} from "@/lib/distribute";
import { executeDistributionOperation } from "@/lib/distribute/operation";
import { explicitlyEnabled } from "@/lib/operations/features";
import { executeIndexNowOperation } from "@/lib/search/indexnow-operation";

type StageStatus =
  | "completed"
  | "failed"
  | "pending"
  | "disabled"
  | "not-applicable";

export type PostPublishStageReceipt = Readonly<{
  requested: boolean;
  status: StageStatus;
  attempted: boolean;
  ok: boolean;
  duplicate?: boolean;
  receiptPersisted?: boolean;
  detail?: unknown;
}>;

export type PostPublishReceipt = Readonly<{
  ok: boolean;
  pending: boolean;
  deploymentId: string | null;
  acceptedUrls: string[];
  articleSlugs: string[];
  indexing: PostPublishStageReceipt;
  distribution: PostPublishStageReceipt;
  completedAt: string;
}>;

function childKey(parent: string, stage: string): string {
  return `postpublish-${stage}-${createHash("sha256")
    .update(`${parent}\u0000${stage}`)
    .digest("hex")}`;
}

function operationFailureDetail(status: string): { reason: string } {
  return { reason: status };
}

type PostPublishDependencies = Readonly<{
  executeIndexNowOperation: typeof executeIndexNowOperation;
  executeDistributionOperation: typeof executeDistributionOperation;
  indexNowEnabled: () => boolean;
  channelConfiguration: typeof channelConfiguration;
}>;

const DEFAULT_DEPENDENCIES: PostPublishDependencies = {
  executeIndexNowOperation,
  executeDistributionOperation,
  indexNowEnabled: () => explicitlyEnabled("ENABLE_INDEXNOW_SUBMISSION"),
  channelConfiguration,
};

/**
 * Execute downstream discovery and distribution only after the caller has
 * verified deployment. Each external stage owns a durable derived
 * idempotency key, so a retry returns receipts rather than duplicating work.
 */
export async function orchestratePostPublish(
  input: {
    idempotencyKey: string;
    callerIdentifier: string;
    deploymentId: string | null;
    urls: string[];
    articles: NewsArticle[];
    channels: Channel[];
    requestIndexing: boolean;
    requestDistribution: boolean;
  },
  dependencyOverrides: Partial<PostPublishDependencies> = {},
): Promise<PostPublishReceipt> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  let indexing: PostPublishStageReceipt;
  if (!input.requestIndexing) {
    indexing = {
      requested: false,
      status: "not-applicable",
      attempted: false,
      ok: true,
    };
  } else if (!dependencies.indexNowEnabled()) {
    indexing = {
      requested: true,
      status: "disabled",
      attempted: false,
      ok: false,
      detail: { reason: "ENABLE_INDEXNOW_SUBMISSION is not enabled." },
    };
  } else {
    const operation = await dependencies.executeIndexNowOperation({
      idempotencyKey: childKey(input.idempotencyKey, "indexnow"),
      urls: input.urls,
      callerIdentifier: input.callerIdentifier,
    });
    if (operation.status === "completed") {
      indexing = {
        requested: true,
        status: operation.result.ok ? "completed" : "failed",
        attempted: !operation.duplicate,
        ok: operation.result.ok,
        duplicate: operation.duplicate,
        receiptPersisted: operation.receiptPersisted,
        detail: {
          receiptPersisted: operation.receiptPersisted,
          result: operation.result,
        },
      };
    } else if (operation.status === "pending") {
      indexing = {
        requested: true,
        status: "pending",
        attempted: operation.attempted,
        ok: false,
        duplicate: operation.duplicate,
        receiptPersisted: operation.receiptPersisted,
        detail: {
          reason: operation.reason,
          result: operation.result,
        },
      };
    } else if (operation.status === "busy") {
      indexing = {
        requested: true,
        status: "pending",
        attempted: false,
        ok: false,
        duplicate: true,
        detail: operationFailureDetail(operation.status),
      };
    } else {
      indexing = {
        requested: true,
        status: "failed",
        attempted: false,
        ok: false,
        detail: operationFailureDetail(operation.status),
      };
    }
  }

  let distribution: PostPublishStageReceipt;
  if (!input.requestDistribution || input.articles.length === 0) {
    distribution = {
      requested: input.requestDistribution,
      status: "not-applicable",
      attempted: false,
      ok: true,
      detail:
        input.requestDistribution && input.articles.length === 0
          ? { reason: "No newly published newsroom article was supplied." }
          : undefined,
    };
  } else {
    const channelStatus = input.channels.map((channel) =>
      dependencies.channelConfiguration(channel),
    );
    if (!channelStatus.some((channel) => channel.active)) {
      distribution = {
        requested: true,
        status: "disabled",
        attempted: false,
        ok: false,
        detail: { channels: channelStatus },
      };
    } else {
      const operation = await dependencies.executeDistributionOperation({
        idempotencyKey: childKey(input.idempotencyKey, "distribution"),
        articles: input.articles,
        channels: input.channels,
      });
      if (operation.status === "completed") {
        distribution = {
          requested: true,
          status: operation.result.ok ? "completed" : "failed",
          attempted: !operation.duplicate,
          ok: operation.result.ok,
          duplicate: operation.duplicate,
          receiptPersisted: operation.receiptPersisted,
          detail: {
            receiptPersisted: operation.receiptPersisted,
            result: operation.result,
          },
        };
      } else if (operation.status === "pending") {
        distribution = {
          requested: true,
          status: "pending",
          attempted: operation.attempted,
          ok: false,
          duplicate: operation.duplicate,
          receiptPersisted: operation.receiptPersisted,
          detail: {
            reason: operation.reason,
            result: operation.result,
          },
        };
      } else if (operation.status === "busy") {
        distribution = {
          requested: true,
          status: "pending",
          attempted: false,
          ok: false,
          duplicate: true,
          detail: operationFailureDetail(operation.status),
        };
      } else {
        distribution = {
          requested: true,
          status: "failed",
          attempted: false,
          ok: false,
          detail: operationFailureDetail(operation.status),
        };
      }
    }
  }

  return {
    ok: indexing.ok && distribution.ok,
    pending:
      indexing.status === "pending" || distribution.status === "pending",
    deploymentId: input.deploymentId,
    acceptedUrls: input.urls,
    articleSlugs: input.articles.map((article) => article.slug),
    indexing,
    distribution,
    completedAt: new Date().toISOString(),
  };
}
