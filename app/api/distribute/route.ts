import { NextRequest } from "next/server";

import {
  ALL_CHANNELS,
  type Channel,
  DEFAULT_PHASE_1_CHANNELS,
  getActiveChannels,
} from "@/lib/distribute";
import { buildVariants } from "@/lib/distribute/content-adapter";
import { executeDistributionOperation } from "@/lib/distribute/operation";
import { isDistributionLedgerConfigured } from "@/lib/distribute/receipt-ledger";
import { hasVerifiedEditorialImage } from "@/lib/news-editorial";
import { getIndexablePublicNewsArticles } from "@/lib/news-discovery";
import { operationKey } from "@/lib/operations/idempotency";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

type DistributionBody = {
  slugs?: unknown;
  channels?: unknown;
  confirm?: unknown;
};

function requestedChannels(value: unknown): Channel[] | null {
  if (value === undefined) return DEFAULT_PHASE_1_CHANNELS;
  if (!Array.isArray(value) || value.length === 0) return null;
  const channels = [
    ...new Set(
      value.filter(
        (channel): channel is Channel =>
          typeof channel === "string" &&
          ALL_CHANNELS.includes(channel as Channel),
      ),
    ),
  ];
  return channels.length === value.length ? channels : null;
}

export async function GET() {
  const { active, inactive, status } = getActiveChannels();
  const durableReceiptStoreConfigured = isDistributionLedgerConfigured();
  return publicStatusJson({
    name: "news.investwithraj.com distribution endpoint",
    mutationMethod: "POST",
    mode:
      active.length && durableReceiptStoreConfigured
        ? "configured"
        : "disabled",
    durableReceiptStoreConfigured,
    deliverySemantics: {
      postiz: "scheduled is reported separately from delivered",
      directWebhooks: "delivered only after the provider accepts the request",
      inactive: "never attempted and always reported as skipped",
    },
    body: {
      slugs: "string[] — indexable article slugs",
      channels: `string[] (optional) — defaults to ${DEFAULT_PHASE_1_CHANNELS.join(", ")}`,
      confirm: "true is required for external delivery",
    },
    channelStatus: {
      active,
      inactive,
      activeCount: active.length,
      inactiveCount: inactive.length,
      providers: status,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  const parsed = await readJsonBody<DistributionBody>(request, {
    maxBytes: 32_768,
  });
  if (!parsed.ok) return parsed.response;

  if (!Array.isArray(parsed.value.slugs)) {
    return privateJson({ error: "Body must include slugs: string[]." }, 400);
  }
  const suppliedSlugs = parsed.value.slugs;
  const slugs = [
    ...new Set(
      suppliedSlugs.filter(
        (slug): slug is string =>
          typeof slug === "string" && /^[a-z0-9-]{1,180}$/.test(slug),
      ),
    ),
  ].slice(0, 20);
  if (slugs.length === 0 || slugs.length !== suppliedSlugs.length) {
    return privateJson(
      { error: "Supply between 1 and 20 valid canonical article slugs." },
      400,
    );
  }

  const channels = requestedChannels(parsed.value.channels);
  if (!channels) {
    return privateJson(
      {
        error:
          "channels must contain one or more unique, recognised distribution channels.",
      },
      400,
    );
  }

  const publicArticles = getIndexablePublicNewsArticles();
  const articles = slugs
    .map((slug) => publicArticles.find((article) => article.slug === slug))
    .filter(
      (article): article is (typeof publicArticles)[number] =>
        article !== undefined,
    );
  const missingSlugs = slugs.filter(
    (slug) => !articles.some((article) => article.slug === slug),
  );
  if (missingSlugs.length > 0) {
    return privateJson(
      {
        error: "One or more slugs are not indexable public articles.",
        missingSlugs,
      },
      400,
    );
  }

  const { active, status } = getActiveChannels();
  const requestedStatus = status.filter((item) =>
    channels.includes(item.channel),
  );
  const activeRequested = channels.filter((channel) => active.includes(channel));
  const previews = articles.map((article) => ({
    articleSlug: article.slug,
    variants: buildVariants(article, channels).map((variant) => ({
      ...variant,
      imageUrl: hasVerifiedEditorialImage(article)
        ? variant.imageUrl
        : undefined,
    })),
  }));

  if (parsed.value.confirm !== true) {
    return privateJson({
      ok: true,
      dryRun: true,
      attempted: false,
      deliveredCount: 0,
      scheduledCount: 0,
      channelsRequested: channels,
      channelStatus: requestedStatus,
      previews,
      timestamp: new Date().toISOString(),
    });
  }

  if (activeRequested.length === 0) {
    return privateJson(
      {
        ok: false,
        error:
          "No requested channel is both explicitly enabled and fully configured.",
        channelStatus: requestedStatus,
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
  const operation = await executeDistributionOperation({
    idempotencyKey: key,
    articles,
    channels,
  });

  if (operation.status === "conflict") {
    return privateJson(
      { error: "This Idempotency-Key was used for different content." },
      409,
    );
  }
  if (operation.status === "unavailable") {
    return privateJson(
      { error: "The durable distribution receipt ledger is unavailable." },
      503,
    );
  }
  if (operation.status === "busy") {
    return privateJson(
      { error: "This distribution operation is already being claimed." },
      409,
    );
  }
  if (operation.status === "pending") {
    return privateJson(
      {
        ok: false,
        duplicate: operation.duplicate,
        pending: true,
        attempted: operation.attempted,
        receiptPersisted: operation.receiptPersisted,
        result: operation.result,
        message:
          operation.reason === "receipt-not-persisted"
            ? "Delivery finished, but its durable completion receipt was not persisted."
            : "Dispatch was already reserved; delivery is not being attempted again.",
      },
      202,
    );
  }

  const deliveredCount = operation.result.runs.reduce(
    (total, run) => total + run.deliveredCount,
    0,
  );
  const scheduledCount = operation.result.runs.reduce(
    (total, run) => total + run.scheduledCount,
    0,
  );
  return privateJson(
    {
      ...operation.result,
      duplicate: operation.duplicate,
      receiptPersisted: operation.receiptPersisted,
      deliveredCount,
      scheduledCount,
    },
    operation.result.ok ? 200 : 502,
  );
}
