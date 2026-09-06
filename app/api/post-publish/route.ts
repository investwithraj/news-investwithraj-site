import { NextRequest } from "next/server";

import {
  ALL_CHANNELS,
  type Channel,
  DEFAULT_PHASE_1_CHANNELS,
  getActiveChannels,
} from "@/lib/distribute";
import { getIndexablePublicNewsArticles } from "@/lib/news-discovery";
import { isDistributionLedgerConfigured } from "@/lib/distribute/receipt-ledger";
import { operationKey } from "@/lib/operations/idempotency";
import { orchestratePostPublish } from "@/lib/post-publish/orchestrator";
import {
  INDEXNOW_ALLOWED_HOSTS,
  normalizeIndexNowUrls,
} from "@/lib/search/indexnow";
import { isIndexNowLedgerConfigured } from "@/lib/search/indexnow-ledger";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
  rejectUrlCredentials,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

type PostPublishBody = {
  newUrls?: unknown;
  deploymentId?: unknown;
  channels?: unknown;
  indexNow?: unknown;
  distribute?: unknown;
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

function newsroomArticleSlugs(urls: readonly string[]): string[] {
  const slugs = new Set<string>();
  for (const value of urls) {
    const url = new URL(value);
    if (url.hostname !== "news.investwithraj.com") continue;
    const match = /^\/news\/([a-z0-9-]{1,180})\/?$/.exec(url.pathname);
    if (match?.[1]) slugs.add(match[1]);
  }
  return [...slugs];
}

/** Read-only capability report. GET never invokes a provider. */
export function GET(request: NextRequest) {
  const rejected = rejectUrlCredentials(request);
  if (rejected) return rejected;
  const channels = getActiveChannels();
  return publicStatusJson({
    name: "news.investwithraj.com post-publish orchestrator",
    mutationMethod: "POST",
    sequence:
      "call only after the exact deployment is verified; IndexNow and social distribution keep separate durable receipts",
    allowedIndexNowHosts: INDEXNOW_ALLOWED_HOSTS,
    durableReceipts: {
      indexNow: isIndexNowLedgerConfigured(),
      distribution: isDistributionLedgerConfigured(),
    },
    channelStatus: {
      active: channels.active,
      inactive: channels.inactive,
      providers: channels.status,
    },
    body: {
      newUrls: "string[] — canonical main-site and/or newsroom URLs",
      deploymentId: "string (optional) — verified deployment correlation ID",
      channels: `string[] (optional) — defaults to ${DEFAULT_PHASE_1_CHANNELS.join(", ")}`,
      indexNow: "boolean (optional, defaults true)",
      distribute:
        "boolean (optional, defaults false; social delivery is a separate explicit operation)",
      confirm: "true is required for external mutations",
    },
    requiredHeader: "Idempotency-Key for confirmed execution",
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  const parsed = await readJsonBody<PostPublishBody>(request, {
    maxBytes: 128_000,
  });
  if (!parsed.ok) return parsed.response;

  if (!Array.isArray(parsed.value.newUrls)) {
    return privateJson({ error: "Body must include newUrls: string[]." }, 400);
  }
  const normalized = normalizeIndexNowUrls(parsed.value.newUrls, 1_000);
  if (
    normalized.urls.length === 0 ||
    normalized.rejectedCount > 0 ||
    normalized.urls.length !== parsed.value.newUrls.length
  ) {
    return privateJson(
      {
        error:
          "Every new URL must be a unique canonical HTTPS URL on the approved host allowlist.",
        acceptedCount: normalized.urls.length,
        rejectedCount: normalized.rejectedCount,
      },
      400,
    );
  }

  for (const toggle of [parsed.value.indexNow, parsed.value.distribute]) {
    if (toggle !== undefined && typeof toggle !== "boolean") {
      return privateJson(
        { error: "indexNow and distribute must be booleans when supplied." },
        400,
      );
    }
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

  if (
    parsed.value.deploymentId !== undefined &&
    typeof parsed.value.deploymentId !== "string"
  ) {
    return privateJson(
      { error: "deploymentId must be a string when supplied." },
      400,
    );
  }

  const articleSlugs = newsroomArticleSlugs(normalized.urls);
  const publicArticles = getIndexablePublicNewsArticles();
  const articles = articleSlugs
    .map((slug) => publicArticles.find((article) => article.slug === slug))
    .filter(
      (article): article is (typeof publicArticles)[number] =>
        article !== undefined,
    );
  const unavailableArticleSlugs = articleSlugs.filter(
    (slug) => !articles.some((article) => article.slug === slug),
  );
  if (unavailableArticleSlugs.length > 0) {
    return privateJson(
      {
        error:
          "A newsroom URL does not identify an indexable published article.",
        unavailableArticleSlugs,
      },
      400,
    );
  }

  const requestIndexing = parsed.value.indexNow !== false;
  const requestDistribution = parsed.value.distribute === true;
  const deploymentId =
    typeof parsed.value.deploymentId === "string"
      ? parsed.value.deploymentId.trim().slice(0, 160) || null
      : null;

  if (parsed.value.confirm !== true) {
    const channelStatus = getActiveChannels().status.filter((status) =>
      channels.includes(status.channel),
    );
    return privateJson({
      ok: true,
      dryRun: true,
      externalMutation: false,
      deploymentId,
      acceptedUrls: normalized.urls,
      articleSlugs,
      planned: {
        indexNow: requestIndexing,
        distribution: requestDistribution && articles.length > 0,
        channels: channelStatus,
      },
      timestamp: new Date().toISOString(),
    });
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
    "verified-post-publish-caller";
  const receipt = await orchestratePostPublish({
    idempotencyKey: key,
    callerIdentifier,
    deploymentId,
    urls: normalized.urls,
    articles,
    channels,
    requestIndexing,
    requestDistribution,
  });

  if (receipt.pending) return privateJson(receipt, 202);
  if (receipt.ok) return privateJson(receipt);
  const unavailable = [receipt.indexing, receipt.distribution].some(
    (stage) =>
      stage.status === "disabled" ||
      (stage.status === "failed" &&
        JSON.stringify(stage.detail).includes("unavailable")),
  );
  return privateJson(receipt, unavailable ? 503 : 502);
}
