// News draft review-staging store.
//
// Mirrors lib/queue/storage.ts exactly: a single KV key holding a JSON array,
// Upstash-compatible REST (GET /get/<key>, POST /set/<key>), with a file-system
// fallback for local dev. In production on Vercel, KV is required (fs writes
// are ephemeral). Drafts never touch git — the publish route generates the
// article .ts and commits once.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateDraft, type DraftArticle as ValidatorInput } from "@/lib/voice/validator";
import {
  draftContentHash,
  evidenceApprovalFor,
  WITHHELD_MEDIA_APPROVAL_HASH,
} from "./integrity";
import type {
  ClusterReservation,
  MediaApprovalLedger,
  NewsDraft,
  NewsDraftInput,
  PublicationReceipt,
  PublicationRecord,
} from "./types";

const DRAFTS_FILE = path.join(process.cwd(), "pipeline-runs", "news-drafts.json");

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
const KV_KEY = "iwr:news:drafts";
const CLUSTER_PREFIX = "iwr:news:cluster:legacy-safe:";
const PUBLICATION_RECEIPT_PREFIX = "iwr:news:publication-receipt:";
const PUBLICATION_ARCHIVE_PREFIX = "iwr:news:publication-archive:";
const PUBLICATION_RECEIPT_TTL_SECONDS = 30 * 24 * 60 * 60;
const PUBLICATION_ARCHIVE_TTL_SECONDS = 365 * 24 * 60 * 60;

let localMutationTail: Promise<void> = Promise.resolve();

export class DraftConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftConflictError";
  }
}

export class DraftCollisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftCollisionError";
  }
}

function kvConfigured(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

function assertDurableStorage(): void {
  if (process.env.NODE_ENV === "production" && !kvConfigured()) {
    throw new Error("Durable draft storage is required in production.");
  }
}

function clusterKey(clusterId: string): string {
  return `${CLUSTER_PREFIX}${crypto
    .createHash("sha256")
    .update(clusterId)
    .digest("hex")}`;
}

async function withLocalMutation<T>(work: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = localMutationTail;
  localMutationTail = previous.then(() => next);
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}

async function kvCommand(command: unknown[]): Promise<unknown> {
  const response = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Draft storage command failed (${response.status}).`);
  }
  const body = (await response.json()) as {
    result?: unknown;
    error?: string;
  };
  if (body.error) throw new Error("Draft storage command failed.");
  return body.result;
}

async function kvEval(
  script: string,
  keys: string[],
  args: Array<string | number>,
): Promise<unknown> {
  return kvCommand(["EVAL", script, keys.length, ...keys, ...args]);
}

function hydrateDraft(draft: NewsDraft): NewsDraft {
  return {
    ...draft,
    recordVersion:
      Number.isSafeInteger(draft.recordVersion) && draft.recordVersion > 0
        ? draft.recordVersion
        : 1,
    revision:
      Number.isSafeInteger(draft.revision) && draft.revision > 0
        ? draft.revision
        : 1,
    contentHash:
      typeof draft.contentHash === "string" &&
      /^[a-f0-9]{64}$/.test(draft.contentHash)
        ? draft.contentHash
        : draftContentHash(draft.article, draft.provenance),
    verifiedSources: draft.verifiedSources ?? [],
  };
}

// ── KV adapter (Upstash REST) ──────────────────────────────────────────

async function kvGet(): Promise<NewsDraft[]> {
  const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Draft storage read failed (${res.status}).`);
  }
  const data = (await res.json()) as { result?: unknown };
  if (data.result == null) return [];
  if (Array.isArray(data.result)) {
    return (data.result as NewsDraft[]).map(hydrateDraft);
  }
  if (typeof data.result === "string") {
    const parsed = JSON.parse(data.result) as unknown;
    if (Array.isArray(parsed)) {
      return (parsed as NewsDraft[]).map(hydrateDraft);
    }
  }
  throw new Error("Draft storage returned an invalid payload.");
}

// ── File-system adapter ────────────────────────────────────────────────

async function fsGet(): Promise<NewsDraft[]> {
  try {
    const raw = await fs.readFile(DRAFTS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Draft file returned an invalid payload.");
    }
    return (parsed as NewsDraft[]).map(hydrateDraft);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function fsSet(drafts: NewsDraft[]): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(DRAFTS_FILE), { recursive: true });
    await fs.writeFile(DRAFTS_FILE, JSON.stringify(drafts, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export async function getAllDrafts(): Promise<NewsDraft[]> {
  assertDurableStorage();
  const drafts = kvConfigured() ? await kvGet() : await fsGet();
  // Newest first.
  return drafts
    .filter((draft) => draft.publication?.state !== "completed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDraft(id: string): Promise<NewsDraft | null> {
  const all = await getAllDrafts();
  return all.find((d) => d.id === id) ?? null;
}

/** Run the 8-gate validator over a draft's article. */
export function validateArticle(article: NewsDraftInput["article"]) {
  return validateDraft(article as unknown as ValidatorInput);
}

/** Create a new review draft. Validator is computed on write. */
export async function addDraft(input: NewsDraftInput): Promise<NewsDraft> {
  const now = new Date().toISOString();
  const draft: NewsDraft = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "review",
    article: input.article,
    validator: validateArticle(input.article),
    provenance: input.provenance,
    reviewNote: input.reviewNote,
    verifiedSources: [],
    revision: 1,
    recordVersion: 1,
    contentHash: draftContentHash(input.article, input.provenance),
  };
  assertDurableStorage();
  if (kvConfigured()) {
    const script = `
local raw = redis.call("GET", KEYS[1])
local drafts = {}
if raw then drafts = cjson.decode(raw) end
for _, existing in ipairs(drafts) do
  if existing.id == ARGV[2] or existing.article.slug == ARGV[3] then return 0 end
end
table.insert(drafts, cjson.decode(ARGV[1]))
redis.call("SET", KEYS[1], cjson.encode(drafts))
return 1
`;
    const written = Number(
      await kvEval(script, [KV_KEY], [
        JSON.stringify(draft),
        draft.id,
        draft.article.slug,
      ]),
    );
    if (written !== 1) {
      throw new DraftCollisionError("A draft with this slug already exists.");
    }
    return draft;
  }
  return withLocalMutation(async () => {
    const all = await fsGet();
    if (all.some((item) => item.article.slug === draft.article.slug)) {
      throw new DraftCollisionError("A draft with this slug already exists.");
    }
    all.push(draft);
    if (!(await fsSet(all))) throw new Error("Draft storage write failed.");
    return draft;
  });
}

export function getStorageBackend(): "vercel-kv" | "file-system" {
  return kvConfigured() ? "vercel-kv" : "file-system";
}

const RESERVATION_DIR = path.join(
  process.cwd(),
  "pipeline-runs",
  "news-cluster-reservations",
);
const RECEIPT_DIR = path.join(
  process.cwd(),
  "pipeline-runs",
  "news-publication-receipts",
);
const ARCHIVE_DIR = path.join(
  process.cwd(),
  "pipeline-runs",
  "news-publication-archive",
);

function publicationReceiptKey(id: string): string {
  return `${PUBLICATION_RECEIPT_PREFIX}${id}`;
}

function publicationReceiptFile(id: string): string {
  return path.join(RECEIPT_DIR, `${id}.json`);
}

function publicationCommitReceiptKey(commitSha: string): string {
  return `${PUBLICATION_RECEIPT_PREFIX}commit:${commitSha.toLowerCase()}`;
}

function publicationCommitReceiptFile(commitSha: string): string {
  return path.join(RECEIPT_DIR, `commit-${commitSha.toLowerCase()}.json`);
}

function publicationArchiveKey(id: string): string {
  return `${PUBLICATION_ARCHIVE_PREFIX}${id}`;
}

function publicationArchiveFile(id: string): string {
  return path.join(ARCHIVE_DIR, `${id}.json`);
}

export async function getPublicationReceipt(
  id: string,
): Promise<PublicationReceipt | null> {
  assertDurableStorage();
  if (kvConfigured()) {
    const raw = await kvCommand(["GET", publicationReceiptKey(id)]);
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new Error("Publication receipt returned invalid state.");
    }
    return JSON.parse(raw) as PublicationReceipt;
  }
  try {
    return JSON.parse(
      await fs.readFile(publicationReceiptFile(id), "utf8"),
    ) as PublicationReceipt;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function getPublicationReceiptByCommitSha(
  commitSha: string,
): Promise<PublicationReceipt | null> {
  assertDurableStorage();
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) return null;
  if (kvConfigured()) {
    const raw = await kvCommand([
      "GET",
      publicationCommitReceiptKey(commitSha),
    ]);
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new Error("Publication receipt returned invalid state.");
    }
    return JSON.parse(raw) as PublicationReceipt;
  }
  try {
    return JSON.parse(
      await fs.readFile(publicationCommitReceiptFile(commitSha), "utf8"),
    ) as PublicationReceipt;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function getCommittedDraftByCommitSha(
  commitSha: string,
): Promise<NewsDraft | null> {
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) return null;
  const normalized = commitSha.toLowerCase();
  return (
    (await getAllDrafts()).find(
      (draft) =>
        draft.publication?.state === "committed" &&
        draft.publication.commitSha?.toLowerCase() === normalized,
    ) ?? null
  );
}

async function readLocalReservation(
  clusterId: string,
): Promise<ClusterReservation | null> {
  try {
    const name = crypto
      .createHash("sha256")
      .update(clusterId)
      .digest("hex");
    return JSON.parse(
      await fs.readFile(path.join(RESERVATION_DIR, `${name}.json`), "utf8"),
    ) as ClusterReservation;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeLocalReservation(
  reservation: ClusterReservation,
): Promise<void> {
  await fs.mkdir(RESERVATION_DIR, { recursive: true });
  const name = crypto
    .createHash("sha256")
    .update(reservation.clusterId)
    .digest("hex");
  const file = path.join(RESERVATION_DIR, `${name}.json`);
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(
    temporary,
    JSON.stringify(reservation, null, 2),
    "utf8",
  );
  await fs.rename(temporary, file);
}

export async function getStoredDraft(
  id: string,
): Promise<NewsDraft | null> {
  assertDurableStorage();
  const all = kvConfigured() ? await kvGet() : await fsGet();
  return all.find((draft) => draft.id === id) ?? null;
}

async function replaceDraftCas(
  current: NewsDraft,
  next: NewsDraft,
): Promise<void> {
  assertDurableStorage();
  if (kvConfigured()) {
    const script = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local drafts = cjson.decode(raw)
for index, draft in ipairs(drafts) do
  if draft.id == ARGV[1] then
    if tonumber(draft.revision or 1) ~= tonumber(ARGV[2]) or tonumber(draft.recordVersion or 1) ~= tonumber(ARGV[6]) or draft.contentHash ~= ARGV[3] then return -1 end
    local claim = "none"
    if draft.publication and draft.publication.claimId then claim = draft.publication.claimId end
    if claim ~= ARGV[5] then return -1 end
    drafts[index] = cjson.decode(ARGV[4])
    redis.call("SET", KEYS[1], cjson.encode(drafts))
    return 1
  end
end
return 0
`;
    const result = Number(
      await kvEval(script, [KV_KEY], [
        current.id,
        current.revision,
        current.contentHash,
        JSON.stringify(next),
        current.publication?.claimId ?? "none",
        current.recordVersion,
      ]),
    );
    if (result !== 1) {
      throw new DraftConflictError(
        "Draft changed after this review view was loaded.",
      );
    }
    return;
  }
  await withLocalMutation(async () => {
    const all = await fsGet();
    const index = all.findIndex((draft) => draft.id === current.id);
    if (index === -1) throw new DraftConflictError("Draft no longer exists.");
    const latest = all[index];
    if (
      latest.revision !== current.revision ||
      latest.recordVersion !== current.recordVersion ||
      latest.contentHash !== current.contentHash ||
      latest.publication?.claimId !== current.publication?.claimId
    ) {
      throw new DraftConflictError(
        "Draft changed after this review view was loaded.",
      );
    }
    all[index] = next;
    if (!(await fsSet(all))) throw new Error("Draft storage write failed.");
  });
}

export async function reserveDraftCluster(
  clusterId: string,
  topic: string,
  now = Date.now(),
  retryFailed = false,
): Promise<{ acquired: boolean; reservation: ClusterReservation }> {
  const timestamp = new Date(now).toISOString();
  const candidate: ClusterReservation = {
    clusterId,
    token: crypto.randomUUID(),
    state: "processing",
    topic: topic.slice(0, 500),
    startedAt: timestamp,
    updatedAt: timestamp,
    expiresAt: new Date(now + 45 * 60 * 1_000).toISOString(),
  };
  assertDurableStorage();
  if (kvConfigured()) {
    const script = `
local raw = redis.call("GET", KEYS[1])
if raw then
  local current = cjson.decode(raw)
  if current.expiresAt and current.expiresAt > ARGV[1] and not (ARGV[4] == "1" and current.state == "failed") then return raw end
end
redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
return ARGV[2]
`;
    const raw = await kvEval(
      script,
      [clusterKey(clusterId)],
      [timestamp, JSON.stringify(candidate), 45 * 60, retryFailed ? "1" : "0"],
    );
    if (typeof raw !== "string") {
      throw new Error("Cluster reservation returned invalid state.");
    }
    const reservation = JSON.parse(raw) as ClusterReservation;
    return {
      acquired: reservation.token === candidate.token,
      reservation,
    };
  }
  return withLocalMutation(async () => {
    const current = await readLocalReservation(clusterId);
    if (
      current &&
      current.expiresAt > timestamp &&
      !(retryFailed && current.state === "failed")
    ) {
      return { acquired: false, reservation: current };
    }
    await writeLocalReservation(candidate);
    return { acquired: true, reservation: candidate };
  });
}

export async function failDraftCluster(
  clusterId: string,
  token: string,
  result: string,
  now = Date.now(),
): Promise<void> {
  const timestamp = new Date(now).toISOString();
  assertDurableStorage();
  if (kvConfigured()) {
    const script = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.token ~= ARGV[1] or current.state ~= "processing" then return 0 end
current.state = "failed"
current.result = ARGV[2]
current.updatedAt = ARGV[3]
current.expiresAt = ARGV[4]
redis.call("SET", KEYS[1], cjson.encode(current), "EX", tonumber(ARGV[5]))
return 1
`;
    const written = Number(
      await kvEval(script, [clusterKey(clusterId)], [
        token,
        result.slice(0, 500),
        timestamp,
        new Date(now + 60 * 60 * 1_000).toISOString(),
        60 * 60,
      ]),
    );
    if (written !== 1) {
      throw new DraftConflictError("Cluster reservation is no longer current.");
    }
    return;
  }
  await withLocalMutation(async () => {
    const current = await readLocalReservation(clusterId);
    if (!current || current.token !== token || current.state !== "processing") {
      throw new DraftConflictError("Cluster reservation is no longer current.");
    }
    await writeLocalReservation({
      ...current,
      state: "failed",
      result: result.slice(0, 500),
      updatedAt: timestamp,
      expiresAt: new Date(now + 60 * 60 * 1_000).toISOString(),
    });
  });
}

/**
 * Atomically verifies the paid-research reservation, checks slug collisions,
 * stages the draft, and persists the reservation result in one Redis script.
 */
export async function addReservedDraft(
  input: NewsDraftInput & { reservationToken: string },
): Promise<NewsDraft> {
  const now = new Date().toISOString();
  const draft: NewsDraft = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "review",
    article: input.article,
    validator: validateArticle(input.article),
    provenance: input.provenance,
    reviewNote: input.reviewNote,
    verifiedSources: [],
    revision: 1,
    recordVersion: 1,
    contentHash: draftContentHash(input.article, input.provenance),
  };
  assertDurableStorage();
  if (kvConfigured()) {
    const script = `
local reservationRaw = redis.call("GET", KEYS[2])
if not reservationRaw then return "reservation" end
local reservation = cjson.decode(reservationRaw)
if reservation.token ~= ARGV[4] or reservation.state ~= "processing" then return "reservation" end
local raw = redis.call("GET", KEYS[1])
local drafts = {}
if raw then drafts = cjson.decode(raw) end
for _, existing in ipairs(drafts) do
  if existing.id == ARGV[2] or existing.article.slug == ARGV[3] then return "collision" end
end
table.insert(drafts, cjson.decode(ARGV[1]))
reservation.state = "staged"
reservation.draftId = ARGV[2]
reservation.result = "staged for human review"
reservation.updatedAt = ARGV[5]
reservation.expiresAt = ARGV[6]
redis.call("SET", KEYS[1], cjson.encode(drafts))
redis.call("SET", KEYS[2], cjson.encode(reservation), "EX", tonumber(ARGV[7]))
return "ok"
`;
    const state = await kvEval(
      script,
      [KV_KEY, clusterKey(input.provenance.clusterId)],
      [
        JSON.stringify(draft),
        draft.id,
        draft.article.slug,
        input.reservationToken,
        now,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
        30 * 24 * 60 * 60,
      ],
    );
    if (state === "collision") {
      throw new DraftCollisionError("A draft with this slug already exists.");
    }
    if (state === "reservation") {
      throw new DraftConflictError(
        "A current atomic cluster reservation is required.",
      );
    }
    if (state !== "ok") throw new Error("Draft storage write failed.");
    return draft;
  }
  return withLocalMutation(async () => {
    const all = await fsGet();
    const reservation = await readLocalReservation(
      input.provenance.clusterId,
    );
    if (
      !reservation ||
      reservation.token !== input.reservationToken ||
      reservation.state !== "processing"
    ) {
      throw new DraftConflictError(
        "A current atomic cluster reservation is required.",
      );
    }
    if (all.some((item) => item.article.slug === draft.article.slug)) {
      throw new DraftCollisionError("A draft with this slug already exists.");
    }
    all.push(draft);
    if (!(await fsSet(all))) throw new Error("Draft storage write failed.");
    await writeLocalReservation({
      ...reservation,
      state: "staged",
      draftId: draft.id,
      result: "staged for human review",
      updatedAt: now,
      expiresAt: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1_000,
      ).toISOString(),
    });
    return draft;
  });
}

export async function updateReviewedDraft(
  id: string,
  patch: Partial<Pick<NewsDraft, "article" | "reviewNote" | "verifiedSources">>,
  expected: {
    revision: number;
    recordVersion: number;
    contentHash: string;
  },
  options: {
    evidenceReviewer?: "raj-review-session" | "deterministic-auto-publisher";
  } = {},
): Promise<NewsDraft | null> {
  const current = await getStoredDraft(id);
  if (!current) return null;
  if (
    current.revision !== expected.revision ||
    current.recordVersion !== expected.recordVersion ||
    current.contentHash !== expected.contentHash ||
    current.publication
  ) {
    throw new DraftConflictError(
      "Draft changed after this review view was loaded.",
    );
  }
  const next: NewsDraft = {
    ...current,
    ...patch,
    recordVersion: current.recordVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  if (patch.article) {
    next.revision = current.revision + 1;
    next.contentHash = draftContentHash(patch.article, current.provenance);
    next.validator = validateArticle(patch.article);
    next.verifiedSources = [];
    delete next.evidenceApproval;
    delete next.mediaApproval;
  } else if (patch.verifiedSources) {
    next.evidenceApproval =
      evidenceApprovalFor(
        next.revision,
        next.contentHash,
        patch.verifiedSources,
        next.provenance,
        new Date().toISOString(),
        options.evidenceReviewer ?? "raj-review-session",
      ) ?? undefined;
  }
  await replaceDraftCas(current, next);
  return next;
}

export async function deleteReviewedDraft(
  id: string,
  expected: {
    revision: number;
    recordVersion: number;
    contentHash: string;
  },
): Promise<boolean> {
  const current = await getStoredDraft(id);
  if (!current) return false;
  if (
    current.revision !== expected.revision ||
    current.recordVersion !== expected.recordVersion ||
    current.contentHash !== expected.contentHash ||
    current.publication
  ) {
    throw new DraftConflictError("Draft changed.");
  }
  assertDurableStorage();
  if (kvConfigured()) {
    const script = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local drafts = cjson.decode(raw)
for index, draft in ipairs(drafts) do
  if draft.id == ARGV[1] then
    if tonumber(draft.revision or 1) ~= tonumber(ARGV[2]) or tonumber(draft.recordVersion or 1) ~= tonumber(ARGV[4]) or draft.contentHash ~= ARGV[3] or draft.publication then return -1 end
    table.remove(drafts, index)
    redis.call("SET", KEYS[1], cjson.encode(drafts))
    return 1
  end
end
return 0
`;
    const result = Number(
      await kvEval(script, [KV_KEY], [
        id,
        expected.revision,
        expected.contentHash,
        expected.recordVersion,
      ]),
    );
    if (result === 0) return false;
    if (result !== 1) throw new DraftConflictError("Draft changed.");
    return true;
  }
  return withLocalMutation(async () => {
    const all = await fsGet();
    const index = all.findIndex((item) => item.id === id);
    if (index === -1) return false;
    const latest = all[index];
    if (
      latest.revision !== expected.revision ||
      latest.recordVersion !== expected.recordVersion ||
      latest.contentHash !== expected.contentHash ||
      latest.publication
    ) {
      throw new DraftConflictError("Draft changed.");
    }
    all.splice(index, 1);
    if (!(await fsSet(all))) throw new Error("Draft storage write failed.");
    return true;
  });
}

export async function setMediaApproval(
  id: string,
  approval: MediaApprovalLedger,
  expected: {
    revision: number;
    recordVersion: number;
    contentHash: string;
  },
): Promise<NewsDraft | null> {
  const current = await getStoredDraft(id);
  if (!current) return null;
  if (
    current.revision !== expected.revision ||
    current.recordVersion !== expected.recordVersion ||
    current.contentHash !== expected.contentHash ||
    current.publication
  ) {
    throw new DraftConflictError("Draft changed during media review.");
  }
  if (current.mediaApproval) {
    if (current.mediaApproval.hash === approval.hash) return current;
    throw new DraftConflictError("Media approval is immutable.");
  }
  const next = {
    ...current,
    mediaApproval: approval,
    recordVersion: current.recordVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  await replaceDraftCas(current, next);
  return next;
}

export async function claimDraftPublication(
  id: string,
  expected: {
    revision: number;
    recordVersion: number;
    contentHash: string;
    mediaApprovalHash: string;
    evidenceApprovalHash: string;
  },
): Promise<{ draft: NewsDraft; acquired: boolean } | null> {
  const current = await getStoredDraft(id);
  if (!current) return null;
  const mediaApprovalMatches =
    current.mediaApproval?.hash === expected.mediaApprovalHash ||
    (!current.mediaApproval &&
      expected.mediaApprovalHash === WITHHELD_MEDIA_APPROVAL_HASH);
  if (
    current.revision !== expected.revision ||
    current.recordVersion !== expected.recordVersion ||
    current.contentHash !== expected.contentHash ||
    !mediaApprovalMatches ||
    current.evidenceApproval?.hash !== expected.evidenceApprovalHash
  ) {
    throw new DraftConflictError(
      "The reviewed revision or approval ledger changed.",
    );
  }
  if (current.publication) {
    return { draft: current, acquired: false };
  }
  const timestamp = new Date().toISOString();
  const publication: PublicationRecord = {
    state: "publishing",
    claimId: crypto.randomUUID(),
    revision: expected.revision,
    contentHash: expected.contentHash,
    mediaApprovalHash: expected.mediaApprovalHash,
    evidenceApprovalHash: expected.evidenceApprovalHash,
    startedAt: timestamp,
    updatedAt: timestamp,
  };
  const next = {
    ...current,
    publication,
    recordVersion: current.recordVersion + 1,
    updatedAt: timestamp,
  };
  await replaceDraftCas(current, next);
  return { draft: next, acquired: true };
}

export async function recordDraftPublicationCommit(
  id: string,
  claimId: string,
  commitSha: string,
  url: string,
): Promise<NewsDraft> {
  const current = await getStoredDraft(id);
  if (!current || current.publication?.claimId !== claimId) {
    throw new DraftConflictError("Publication claim is no longer current.");
  }
  if (
    current.publication.state === "committed" ||
    current.publication.state === "completed"
  ) {
    if (
      current.publication.commitSha === commitSha &&
      current.publication.url === url
    ) {
      return current;
    }
    throw new DraftConflictError("A different publication result exists.");
  }
  const timestamp = new Date().toISOString();
  const next: NewsDraft = {
    ...current,
    recordVersion: current.recordVersion + 1,
    updatedAt: timestamp,
    publication: {
      ...current.publication,
      state: "committed",
      commitSha,
      url,
      updatedAt: timestamp,
    },
  };
  await replaceDraftCas(current, next);
  return next;
}

export async function completeDraftPublication(
  id: string,
  claimId: string,
): Promise<NewsDraft> {
  const current = await getStoredDraft(id);
  if (!current || current.publication?.claimId !== claimId) {
    throw new DraftConflictError("Publication claim is no longer current.");
  }
  if (
    !["committed", "completed"].includes(current.publication.state) ||
    !current.publication.commitSha ||
    !current.publication.url
  ) {
    throw new DraftConflictError("No durable commit result exists.");
  }
  const timestamp = new Date().toISOString();
  const next: NewsDraft = {
    ...current,
    recordVersion: current.recordVersion + 1,
    updatedAt: timestamp,
    publication: {
      ...current.publication,
      state: "completed",
      updatedAt: timestamp,
    },
  };
  const receipt: PublicationReceipt = {
    draftId: next.id,
    slug: next.article.slug,
    revision: next.revision,
    contentHash: next.contentHash,
    mediaApprovalHash: next.publication!.mediaApprovalHash,
    evidenceApprovalHash: next.publication!.evidenceApprovalHash,
    commitSha: next.publication!.commitSha!,
    url: next.publication!.url!,
    completedAt: timestamp,
    expiresAt: new Date(
      Date.now() + PUBLICATION_RECEIPT_TTL_SECONDS * 1_000,
    ).toISOString(),
  };

  assertDurableStorage();
  if (kvConfigured()) {
    const script = `
local raw = redis.call("GET", KEYS[1])
if not raw then return {-2, ""} end
local drafts = cjson.decode(raw)
for index, draft in ipairs(drafts) do
  if draft.id == ARGV[1] then
    if not draft.publication or draft.publication.claimId ~= ARGV[2]
      or (draft.publication.state ~= "committed" and draft.publication.state ~= "completed")
      or not draft.publication.commitSha
      or not draft.publication.url then
      return {-1, cjson.encode(draft)}
    end
    local completed = cjson.decode(ARGV[3])
    redis.call("SET", KEYS[2], ARGV[4], "EX", tonumber(ARGV[5]))
    redis.call("SET", KEYS[4], ARGV[4], "EX", tonumber(ARGV[5]))
    redis.call("SET", KEYS[3], ARGV[3], "EX", tonumber(ARGV[6]))
    table.remove(drafts, index)
    redis.call("SET", KEYS[1], cjson.encode(drafts))
    return {1, cjson.encode(completed)}
  end
end
return {-2, ""}
`;
    const result = (await kvEval(
      script,
      [
        KV_KEY,
        publicationReceiptKey(id),
        publicationArchiveKey(id),
        publicationCommitReceiptKey(receipt.commitSha),
      ],
      [
        id,
        claimId,
        JSON.stringify(next),
        JSON.stringify(receipt),
        PUBLICATION_RECEIPT_TTL_SECONDS,
        PUBLICATION_ARCHIVE_TTL_SECONDS,
      ],
    )) as [number | string, unknown];
    const code = Number(result?.[0]);
    if (code !== 1) {
      throw new DraftConflictError(
        code === -2
          ? "Publication draft is no longer active."
          : "Publication state changed before deployment verification.",
      );
    }
    return next;
  }

  return withLocalMutation(async () => {
    const all = await fsGet();
    const index = all.findIndex((item) => item.id === id);
    if (index < 0) throw new DraftConflictError("Publication draft is no longer active.");
    const latest = all[index];
    if (
      latest.publication?.claimId !== claimId ||
      !["committed", "completed"].includes(latest.publication.state) ||
      latest.publication.commitSha !== next.publication?.commitSha
    ) {
      throw new DraftConflictError(
        "Publication state changed before deployment verification.",
      );
    }
    await fs.mkdir(RECEIPT_DIR, { recursive: true });
    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    await fs.writeFile(
      publicationReceiptFile(id),
      JSON.stringify(receipt, null, 2),
      "utf8",
    );
    await fs.writeFile(
      publicationCommitReceiptFile(receipt.commitSha),
      JSON.stringify(receipt, null, 2),
      "utf8",
    );
    await fs.writeFile(
      publicationArchiveFile(id),
      JSON.stringify(next, null, 2),
      "utf8",
    );
    all.splice(index, 1);
    if (!(await fsSet(all))) {
      throw new Error("Draft storage write failed.");
    }
    return next;
  });
}
