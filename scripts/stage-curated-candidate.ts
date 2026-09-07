import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import process from "node:process";

import { getNewsBySlug } from "../content/news/index";
import {
  parseBoundedJsonResponse,
  readBoundedResponseText,
} from "../lib/news-review/bounded-response";
import {
  assertCompletedCuratedPublication,
  curatedCandidateMatchesPublishedArticle,
  getCuratedNewsCandidate,
  type CuratedNewsCandidate,
} from "../lib/news-review/curated-candidates";
import {
  committedCuratedDeploymentRequest,
  recoverCommittedCuratedDeployment,
} from "../lib/news-review/curated-recovery";
import {
  approvedEvidencePublisherDomain,
  approvedPublisherIdentity,
  assessDraft,
  MAX_AUTO_NEWS_SOURCE_AGE_HOURS,
} from "../lib/news-review/auto-approve";
import { assessPublicationFreshness } from "../lib/news-review/draft-engine";
import {
  draftContentHash,
  sha256Json,
  validateDraftArticleShape,
  validateProvenanceShape,
} from "../lib/news-review/integrity";
import type {
  NewsDraft,
  NewsDraftProvenance,
  PublicationReceipt,
} from "../lib/news-review/types";
import { fetchArticleText } from "../lib/sources/extract";
import { getWhitelistDomains } from "../lib/sources/registry";
import {
  validateDraft,
  type DraftArticle as VoiceDraftArticle,
} from "../lib/voice/validator";

const PROTECTED_SITE_ORIGIN = "https://news.investwithraj.com";
const SECRET = process.env.POST_PUBLISH_SECRET ?? "";
const REQUESTED_KEY =
  process.env.CURATED_CANDIDATE_KEY ?? process.argv[2] ?? "";
const PREFLIGHT_ONLY = process.env.CURATED_PREFLIGHT_ONLY === "1";

interface ReservationPayload {
  acquired?: boolean;
  reservation?: { token?: string };
}

interface DraftListPayload {
  drafts?: NewsDraft[];
}

interface StagePayload {
  draft?: NewsDraft;
}

interface ReceiptPayload {
  ok?: boolean;
  receipt?: PublicationReceipt;
  draft?: NewsDraft;
}

interface DeploymentPayload {
  publicationState?: string;
}

type BoundEvidence = NonNullable<
  NewsDraftProvenance["fetchedEvidence"]
>[number];

function assertConfiguration(): void {
  if (
    process.env.SITE_URL !== undefined &&
    process.env.SITE_URL !== PROTECTED_SITE_ORIGIN
  ) {
    throw new Error("SITE_URL must match the pinned Production origin.");
  }
  if (
    !PREFLIGHT_ONLY &&
    new TextEncoder().encode(SECRET).byteLength < 32
  ) {
    throw new Error("A strong POST_PUBLISH_SECRET is required.");
  }
}

function exactProtectedUrl(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new Error("Invalid protected API pathname.");
  }
  const url = new URL(pathname, PROTECTED_SITE_ORIGIN);
  if (url.origin !== PROTECTED_SITE_ORIGIN) {
    throw new Error("Protected API origin changed.");
  }
  return url.toString();
}

function assertExactResponseLocation(
  response: Response,
  expectedUrl: string,
): void {
  if (
    response.redirected ||
    (response.url !== "" && response.url !== expectedUrl)
  ) {
    throw new Error("Protected request returned an unexpected location.");
  }
}

async function protectedGet<T>(pathname: string): Promise<{
  response: Response;
  payload: T;
}> {
  const expectedUrl = exactProtectedUrl(pathname);
  const response = await fetch(expectedUrl, {
    headers: { "x-post-publish-secret": SECRET },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  assertExactResponseLocation(response, expectedUrl);
  return {
    response,
    payload: await parseBoundedJsonResponse<T>(response),
  };
}

function assertCandidateIsReviewOnly(
  candidate: CuratedNewsCandidate,
): void {
  const article = candidate.article as unknown as Record<string, unknown>;
  if (
    Object.hasOwn(article, "status") ||
    Object.hasOwn(article, "publicationContentHash")
  ) {
    throw new Error(
      "Curated candidates cannot contain publication-state fields.",
    );
  }
  if (
    !article.distribution ||
    typeof article.distribution !== "object" ||
    Array.isArray(article.distribution) ||
    Object.keys(article.distribution).length !== 0
  ) {
    throw new Error("Curated candidate distribution must stay empty.");
  }
}

async function readDrafts(): Promise<NewsDraft[]> {
  const { response, payload } = await protectedGet<DraftListPayload>(
    "/api/news/draft",
  );
  if (!response.ok || !Array.isArray(payload.drafts)) {
    throw new Error(`Draft list failed closed (${response.status}).`);
  }
  return payload.drafts;
}

async function post<T>(
  pathname: string,
  body: unknown,
): Promise<{ response: Response; payload: T }> {
  const expectedUrl = exactProtectedUrl(pathname);
  const response = await fetch(expectedUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-post-publish-secret": SECRET,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  assertExactResponseLocation(response, expectedUrl);
  return {
    response,
    payload: await parseBoundedJsonResponse<T>(response),
  };
}

async function verifyCanonicalDeployment(
  slug: string,
  contentHash: string,
): Promise<boolean> {
  const expectedUrl = `${PROTECTED_SITE_ORIGIN}/news/${slug}`;
  const response = await fetch(expectedUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (
    !response.ok ||
    response.redirected ||
    response.url !== expectedUrl ||
    !(response.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("text/html")
  ) {
    return false;
  }
  try {
    const html = await readBoundedResponseText(response, 2_000_000);
    return html.includes(contentHash);
  } catch {
    return false;
  }
}

function evidenceFingerprint(
  candidate: CuratedNewsCandidate,
  evidence: BoundEvidence[],
): string {
  return sha256Json({
    key: candidate.key,
    article: candidate.article,
    evidence: evidence.map((item) => ({
      url: item.url,
      finalPublisher: approvedEvidencePublisherDomain(
        item.url,
        item.finalUrl,
      ),
      contentHash: item.contentHash,
      sourcePublishedAt: item.sourcePublishedAt,
      sourceDateSource: item.sourceDateSource,
    })),
  });
}

function fingerprintStoredDraft(draft: NewsDraft): string | null {
  if (!draft.provenance.fetchedEvidence) return null;
  const candidateKey = draft.provenance.clusterId.replace(/^curated:/u, "");
  try {
    const candidate = getCuratedNewsCandidate(candidateKey);
    if (sha256Json(candidate.article) !== sha256Json(draft.article)) return null;
    return evidenceFingerprint(candidate, draft.provenance.fetchedEvidence);
  } catch {
    return null;
  }
}

function boundedEnvironmentInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(raw)) {
    throw new Error(`${name} must be a bounded integer.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a bounded integer.`);
  }
  return value;
}

function emitActionOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  if (!/^[a-z_]+$/u.test(name) || /[\r\n]/u.test(value)) {
    throw new Error("Invalid workflow output.");
  }
  appendFileSync(outputFile, `${name}=${value}\n`, "utf8");
}

async function fetchAndBindEvidence(
  candidate: CuratedNewsCandidate,
): Promise<NewsDraftProvenance> {
  const allowedDomains = getWhitelistDomains();
  const fetched = [] as Array<{
    citation: CuratedNewsCandidate["article"]["citations"][number];
    identity: NonNullable<ReturnType<typeof approvedPublisherIdentity>>;
    evidence: BoundEvidence;
  }>;

  for (const citation of candidate.article.citations) {
    const identity = approvedPublisherIdentity(citation.url);
    if (
      !identity ||
      citation.source !== identity.name ||
      citation.tier !== identity.tier
    ) {
      throw new Error(
        `Citation does not match its approved canonical publisher: ${citation.url}`,
      );
    }

    const article = await fetchArticleText(citation.url, {
      allowedDomains,
      timeoutMs: 20_000,
    });
    const checkedAt = new Date();
    const freshness = assessPublicationFreshness(
      article.publishedAt,
      checkedAt,
      MAX_AUTO_NEWS_SOURCE_AGE_HOURS,
    );
    const finalPublisher = approvedEvidencePublisherDomain(
      citation.url,
      article.finalUrl,
    );
    if (
      article.diagnostic.code !== "ok" ||
      article.text.trim().length < 80 ||
      !article.publishedAt ||
      !article.publicationDateSource ||
      !freshness.ok ||
      finalPublisher !== identity.domain
    ) {
      throw new Error(
        `Direct evidence failed for ${identity.name}: ${article.diagnostic.code}; ${freshness.detail}; canonical publisher ${finalPublisher ?? "not verified"}.`,
      );
    }

    const text = article.text.slice(0, 9_000);
    const timestamp = checkedAt.toISOString();
    fetched.push({
      citation,
      identity,
      evidence: {
        url: citation.url,
        finalUrl: article.finalUrl ?? undefined,
        text,
        fetchedAt: timestamp,
        contentHash: createHash("sha256").update(text).digest("hex"),
        sourcePublishedAt: article.publishedAt,
        sourceDateSource: article.publicationDateSource,
        freshnessCheckedAt: timestamp,
        freshnessMaxAgeHours: MAX_AUTO_NEWS_SOURCE_AGE_HOURS,
      },
    });
  }

  return {
    clusterId: `curated:${candidate.key}`,
    topic: candidate.topic,
    score: 100,
    scoreBreakdown: {
      uhnwRelevance: 25,
      sourceTier: 25,
      freshness: 25,
      rajAngle: 25,
    },
    sources: fetched.map(({ citation, identity, evidence }) => ({
      name: identity.name,
      tier: identity.tier,
      url: citation.url,
      summary: evidence.text,
      publishedAt: evidence.sourcePublishedAt,
    })),
    fetchedEvidence: fetched.map(({ evidence }) => evidence),
  };
}

async function reserveCluster(
  candidate: CuratedNewsCandidate,
): Promise<string> {
  const { response, payload } = await post<ReservationPayload>(
    "/api/news/draft/reservation",
    {
      action: "reserve",
      clusterId: `curated:${candidate.key}`,
      topic: candidate.topic,
      retryFailed: true,
    },
  );
  const token = payload.reservation?.token;
  if (!response.ok || payload.acquired !== true || !token) {
    throw new Error(
      `Curated candidate reservation was not acquired (${response.status}).`,
    );
  }
  return token;
}

async function failReservation(
  candidate: CuratedNewsCandidate,
  token: string,
  reason: string,
): Promise<void> {
  const { response } = await post<Record<string, unknown>>(
    "/api/news/draft/reservation",
    {
      action: "fail",
      clusterId: `curated:${candidate.key}`,
      token,
      result: reason.slice(0, 500),
    },
  );
  if (!response.ok && response.status !== 409) {
    throw new Error(`Reservation failure record failed (${response.status}).`);
  }
}

async function assertDurablePublishedCandidate(
  candidate: CuratedNewsCandidate,
  fingerprint: string,
  published: NonNullable<ReturnType<typeof getNewsBySlug>>,
): Promise<void> {
  if (!curatedCandidateMatchesPublishedArticle(candidate, published)) {
    throw new Error(
      "A different published article already occupies this curated candidate slug.",
    );
  }
  const proof = await protectedGet<ReceiptPayload>(
    `/api/news/draft/${candidate.draftId}/receipt`,
  );
  if (
    !proof.response.ok ||
    proof.payload.ok !== true ||
    !proof.payload.receipt ||
    !proof.payload.draft
  ) {
    throw new Error(
      `Completed publication proof was unavailable (${proof.response.status}).`,
    );
  }
  const archivedFingerprint = fingerprintStoredDraft(proof.payload.draft);
  if (!archivedFingerprint) {
    throw new Error("Completed publication evidence did not match the candidate.");
  }
  const canonicalDeploymentVerified = await verifyCanonicalDeployment(
    candidate.article.slug,
    published.publicationContentHash ?? "",
  );
  assertCompletedCuratedPublication({
    candidate,
    published,
    archivedDraft: proof.payload.draft,
    receipt: proof.payload.receipt,
    currentEvidenceFingerprint: fingerprint,
    archivedEvidenceFingerprint: archivedFingerprint,
    canonicalDeploymentVerified,
  });
}

function emitAlreadyPublished(candidate: CuratedNewsCandidate): void {
  emitActionOutput("candidate_key", candidate.key);
  emitActionOutput("already_published", "1");
  console.log(`curated candidate already published: ${candidate.article.slug}`);
}

async function recoverCommittedCandidate(
  candidate: CuratedNewsCandidate,
  draft: NewsDraft,
  fingerprint: string,
  published: ReturnType<typeof getNewsBySlug>,
): Promise<void> {
  const storedFingerprint = fingerprintStoredDraft(draft);
  if (!storedFingerprint) {
    throw new Error("Committed publication evidence did not match the candidate.");
  }
  const request = committedCuratedDeploymentRequest({
    candidate,
    draft,
    currentEvidenceFingerprint: fingerprint,
    storedEvidenceFingerprint: storedFingerprint,
  });
  await recoverCommittedCuratedDeployment({
    request,
    attempts: boundedEnvironmentInteger(
      "CURATED_DEPLOYMENT_ATTEMPTS",
      12,
      1,
      20,
    ),
    delayMs: boundedEnvironmentInteger(
      "CURATED_DEPLOYMENT_DELAY_MS",
      15_000,
      0,
      60_000,
    ),
    postDeployment: async (pathname, body) => {
      const result = await post<DeploymentPayload>(pathname, body);
      return {
        status: result.response.status,
        publicationState: result.payload.publicationState,
      };
    },
    verifyDurableProof: async () => {
      if (!published) {
        throw new Error(
          "The committed publication completed, but this checkout does not contain its exact public article yet.",
        );
      }
      await assertDurablePublishedCandidate(candidate, fingerprint, published);
    },
  });
  emitAlreadyPublished(candidate);
}

async function main(): Promise<void> {
  const candidate = getCuratedNewsCandidate(REQUESTED_KEY);
  assertConfiguration();
  assertCandidateIsReviewOnly(candidate);

  const articleResult = validateDraftArticleShape(candidate.article);
  if (!articleResult.ok) {
    throw new Error(`Curated article shape failed: ${articleResult.error}`);
  }
  const article = articleResult.article;
  const provenance = await fetchAndBindEvidence(candidate);
  const provenanceResult = validateProvenanceShape(
    provenance,
    article.citations.map((citation) => citation.url),
  );
  if (!provenanceResult.ok) {
    throw new Error(`Curated provenance shape failed: ${provenanceResult.error}`);
  }

  const validator = validateDraft(
    article as unknown as VoiceDraftArticle,
  );
  if (!validator.ok) {
    const failures = validator.failures
      .filter((failure) => failure.severity === "block")
      .map((failure) => failure.name)
      .join(", ");
    throw new Error(`Curated voice validation held: ${failures || "unknown"}.`);
  }

  const contentHash = draftContentHash(article, provenanceResult.provenance);
  const assessment = assessDraft({
    id: `curated-preflight:${candidate.key}`,
    article,
    validator,
    provenance: provenanceResult.provenance,
    contentHash,
  });
  if (assessment.verdict !== "auto-approve") {
    throw new Error(
      `Curated evidence assessment held: ${assessment.reasons.join("; ")}`,
    );
  }

  if (PREFLIGHT_ONLY) {
    console.log(
      JSON.stringify({
        candidateKey: candidate.key,
        slug: article.slug,
        verdict: assessment.verdict,
      }),
    );
    return;
  }

  // This stable fingerprint deliberately excludes fetch/check timestamps. A
  // rerun still performs a fresh direct fetch, but equivalent publisher bytes
  // can be compared with the durable staged publication archive.
  const fingerprint = evidenceFingerprint(
    candidate,
    provenanceResult.provenance.fetchedEvidence ?? [],
  );
  const published = getNewsBySlug(article.slug);
  const existing = await readDrafts();
  const sameIdentity = existing.find((draft) => draft.id === candidate.draftId);
  if (
    sameIdentity &&
    (sameIdentity.article.slug !== article.slug ||
      fingerprintStoredDraft(sameIdentity) !== fingerprint)
  ) {
    throw new Error(
      "A different review draft already occupies this curated candidate identity.",
    );
  }
  if (sameIdentity?.publication?.state === "committed") {
    await recoverCommittedCandidate(
      candidate,
      sameIdentity,
      fingerprint,
      published,
    );
    return;
  }
  if (published) {
    await assertDurablePublishedCandidate(candidate, fingerprint, published);
    emitAlreadyPublished(candidate);
    return;
  }
  const identical = existing.find(
    (draft) =>
      draft.id === candidate.draftId &&
      draft.article.slug === article.slug &&
      fingerprintStoredDraft(draft) === fingerprint,
  );
  if (identical) {
    if (identical.publication) {
      throw new Error(
        "The exact curated draft has an incomplete publication state that cannot be staged again.",
      );
    }
    emitActionOutput("candidate_key", candidate.key);
    emitActionOutput("already_published", "0");
    emitActionOutput("draft_id", identical.id);
    emitActionOutput("slug", identical.article.slug);
    emitActionOutput("content_hash", identical.contentHash);
    console.log(`curated candidate already staged: ${identical.article.slug}`);
    return;
  }
  if (existing.some((draft) => draft.article.slug === article.slug)) {
    throw new Error(
      "A different review draft already occupies this curated candidate slug.",
    );
  }

  // First mutation: all shape, voice, direct-evidence, freshness, publisher
  // identity and deterministic assessment gates have passed above.
  const reservationToken = await reserveCluster(candidate);
  let staged: NewsDraft | null = null;
  try {
    const result = await post<StagePayload>("/api/news/draft", {
      draftId: candidate.draftId,
      article,
      provenance: provenanceResult.provenance,
      reviewNote: `${candidate.reviewNote} Evidence fingerprint: ${fingerprint}.`,
      reservationToken,
    });
    if (!result.response.ok || !result.payload.draft) {
      throw new Error(
        `Curated candidate staging failed (${result.response.status}).`,
      );
    }
    staged = result.payload.draft;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Curated candidate staging failed.";
    await failReservation(candidate, reservationToken, message);
    throw error;
  }

  if (
    staged.id !== candidate.draftId ||
    staged.article.slug !== article.slug ||
    staged.contentHash !== contentHash ||
    staged.status !== "review" ||
    staged.publication
  ) {
    throw new Error("Curated candidate staging returned an invalid receipt.");
  }

  emitActionOutput("candidate_key", candidate.key);
  emitActionOutput("already_published", "0");
  emitActionOutput("draft_id", staged.id);
  emitActionOutput("slug", staged.article.slug);
  emitActionOutput("content_hash", staged.contentHash);
  console.log(`curated candidate staged for review: ${staged.article.slug}`);
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Curated candidate staging failed.",
  );
  process.exitCode = 1;
});
