import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  draftContentHash,
  evidenceApprovalFor,
} from "@/lib/news-review/integrity";
import type {
  ClusterReservation,
  MediaApprovalLedger,
  NewsDraft,
  NewsDraftInput,
  PublicationRecord,
} from "@/lib/news-review/types";
import {
  validateDraft,
  type DraftArticle as ValidatorInput,
} from "@/lib/voice/validator";

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";

export const V2_INDEX_KEY = "iwr:news:draft:index:v2";
export const V2_MIGRATION_KEY = "iwr:news:draft:migration:v2";
const DRAFT_PREFIX = "iwr:news:draft:v2:";
const SLUG_PREFIX = "iwr:news:slug:v2:";
const CLUSTER_PREFIX = "iwr:news:cluster:v2:";

const LOCAL_ROOT = path.join(process.cwd(), "pipeline-runs", "news-drafts-v2");
const LOCAL_INDEX = path.join(LOCAL_ROOT, "index.json");
const LOCAL_MIGRATION = path.join(LOCAL_ROOT, "migration.json");
const LOCAL_RESERVATIONS = path.join(LOCAL_ROOT, "reservations");

const PROCESSING_TTL_MS = 45 * 60 * 1_000;
const FAILED_RETRY_MS = 60 * 60 * 1_000;
const COMPLETED_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

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

export interface MigrationMarker {
  version: 2;
  state: "verified";
  legacyCount: number;
  v2Count: number;
  legacyHash: string;
  v2Hash: string;
  verifiedAt: string;
}

export function v2UsesKv(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

function recordKey(id: string): string {
  return `${DRAFT_PREFIX}${id}`;
}

function slugKey(slug: string): string {
  return `${SLUG_PREFIX}${slug}`;
}

function reservationKey(clusterId: string): string {
  return `${CLUSTER_PREFIX}${crypto
    .createHash("sha256")
    .update(clusterId)
    .digest("hex")}`;
}

function localRecordFile(id: string): string {
  return path.join(LOCAL_ROOT, `${id}.json`);
}

function localReservationFile(clusterId: string): string {
  return path.join(
    LOCAL_RESERVATIONS,
    `${crypto.createHash("sha256").update(clusterId).digest("hex")}.json`,
  );
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

export async function v2RedisCommand(command: unknown[]): Promise<unknown> {
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
    throw new Error(`Draft v2 storage request failed (${response.status}).`);
  }
  const body = (await response.json()) as {
    result?: unknown;
    error?: string;
  };
  if (body.error) throw new Error("Draft v2 storage command failed.");
  return body.result;
}

async function evalScript(
  script: string,
  keys: string[],
  args: Array<string | number>,
): Promise<unknown> {
  return v2RedisCommand(["EVAL", script, keys.length, ...keys, ...args]);
}

function parseDraft(value: unknown): NewsDraft | null {
  if (typeof value !== "string") return null;
  try {
    const draft = JSON.parse(value) as NewsDraft;
    return draft && typeof draft.id === "string" ? draft : null;
  } catch {
    return null;
  }
}

function parseReservation(value: unknown): ClusterReservation | null {
  if (typeof value !== "string") return null;
  try {
    const reservation = JSON.parse(value) as ClusterReservation;
    return reservation && typeof reservation.clusterId === "string"
      ? reservation
      : null;
  } catch {
    return null;
  }
}

async function readLocalJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeLocalJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(temporary, file);
}

async function readLocalIndex(): Promise<string[]> {
  const value = await readLocalJson<unknown>(LOCAL_INDEX);
  if (value === null) return [];
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error("Draft v2 local index is invalid.");
  }
  return value;
}

export async function readMigrationMarker(): Promise<MigrationMarker | null> {
  const raw = v2UsesKv()
    ? await v2RedisCommand(["GET", V2_MIGRATION_KEY])
    : await readLocalJson<unknown>(LOCAL_MIGRATION);
  const parsed =
    typeof raw === "string"
      ? (JSON.parse(raw) as MigrationMarker)
      : (raw as MigrationMarker | null);
  if (
    !parsed ||
    parsed.version !== 2 ||
    parsed.state !== "verified" ||
    parsed.legacyCount !== parsed.v2Count ||
    parsed.legacyHash !== parsed.v2Hash
  ) {
    return null;
  }
  return parsed;
}

export async function writeMigrationMarker(
  marker: MigrationMarker,
): Promise<void> {
  if (
    marker.version !== 2 ||
    marker.state !== "verified" ||
    marker.legacyCount !== marker.v2Count ||
    marker.legacyHash !== marker.v2Hash
  ) {
    throw new Error("Refusing to write an unverified migration marker.");
  }
  if (v2UsesKv()) {
    const result = await v2RedisCommand([
      "SET",
      V2_MIGRATION_KEY,
      JSON.stringify(marker),
    ]);
    if (result !== "OK") throw new Error("Migration marker write failed.");
    return;
  }
  await writeLocalJson(LOCAL_MIGRATION, marker);
}

export async function assertV2MigrationVerified(): Promise<MigrationMarker> {
  const marker = await readMigrationMarker();
  if (!marker) {
    throw new Error(
      "Draft v2 activation is blocked until legacy/v2 count and hash parity are verified.",
    );
  }
  return marker;
}

export function validateV2Article(article: NewsDraftInput["article"]) {
  return validateDraft(article as unknown as ValidatorInput);
}

export async function v2GetAllDrafts(
  includeCompleted = false,
): Promise<NewsDraft[]> {
  let drafts: NewsDraft[];
  if (v2UsesKv()) {
    const ids = await v2RedisCommand(["ZRANGE", V2_INDEX_KEY, 0, -1]);
    if (!Array.isArray(ids)) throw new Error("Draft v2 index is invalid.");
    if (ids.length === 0) return [];
    const values = await v2RedisCommand([
      "MGET",
      ...ids.map((id) => recordKey(String(id))),
    ]);
    if (!Array.isArray(values)) throw new Error("Draft v2 records are invalid.");
    drafts = values
      .map(parseDraft)
      .filter((draft): draft is NewsDraft => draft !== null);
  } else {
    const ids = await readLocalIndex();
    drafts = (
      await Promise.all(
        ids.map((id) => readLocalJson<NewsDraft>(localRecordFile(id))),
      )
    ).filter((draft): draft is NewsDraft => draft !== null);
  }
  return drafts
    .filter(
      (draft) =>
        includeCompleted || draft.publication?.state !== "completed",
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function v2GetDraft(id: string): Promise<NewsDraft | null> {
  return v2UsesKv()
    ? parseDraft(await v2RedisCommand(["GET", recordKey(id)]))
    : readLocalJson<NewsDraft>(localRecordFile(id));
}

export async function v2ImportDraft(draft: NewsDraft): Promise<"added" | "same"> {
  const payload = JSON.stringify(draft);
  if (v2UsesKv()) {
    const script = `
local current = redis.call("GET", KEYS[1])
if current then
  if current == ARGV[1] then return "same" end
  return "collision"
end
local slugOwner = redis.call("GET", KEYS[3])
if slugOwner and slugOwner ~= ARGV[3] then return "collision" end
redis.call("SET", KEYS[1], ARGV[1])
redis.call("ZADD", KEYS[2], ARGV[2], ARGV[3])
redis.call("SET", KEYS[3], ARGV[3])
return "added"
`;
    const result = await evalScript(
      script,
      [recordKey(draft.id), V2_INDEX_KEY, slugKey(draft.article.slug)],
      [payload, new Date(draft.createdAt).getTime(), draft.id],
    );
    if (result === "added" || result === "same") return result;
    throw new DraftCollisionError(
      `Draft v2 import collision for ${draft.id}/${draft.article.slug}.`,
    );
  }
  return withLocalMutation(async () => {
    const current = await readLocalJson<NewsDraft>(localRecordFile(draft.id));
    if (current) {
      if (JSON.stringify(current) === payload) return "same";
      throw new DraftCollisionError(`Draft v2 import collision for ${draft.id}.`);
    }
    const ids = await readLocalIndex();
    const records = (
      await Promise.all(
        ids.map((id) => readLocalJson<NewsDraft>(localRecordFile(id))),
      )
    ).filter((item): item is NewsDraft => item !== null);
    if (records.some((item) => item.article.slug === draft.article.slug)) {
      throw new DraftCollisionError(
        `Draft v2 slug collision for ${draft.article.slug}.`,
      );
    }
    await writeLocalJson(localRecordFile(draft.id), draft);
    await writeLocalJson(LOCAL_INDEX, [...ids, draft.id]);
    return "added";
  });
}

export async function v2ReserveCluster(
  clusterId: string,
  topic: string,
  now = Date.now(),
): Promise<{ acquired: boolean; reservation: ClusterReservation }> {
  const token = crypto.randomUUID();
  const timestamp = new Date(now).toISOString();
  const next: ClusterReservation & { expiresAtMs: number } = {
    clusterId,
    token,
    state: "processing",
    topic: topic.slice(0, 500),
    startedAt: timestamp,
    updatedAt: timestamp,
    expiresAt: new Date(now + PROCESSING_TTL_MS).toISOString(),
    expiresAtMs: now + PROCESSING_TTL_MS,
  };
  if (v2UsesKv()) {
    const script = `
local current = redis.call("GET", KEYS[1])
if current then
  local record = cjson.decode(current)
  if tonumber(record.expiresAtMs or 0) > tonumber(ARGV[1]) then return current end
end
redis.call("SET", KEYS[1], ARGV[2])
return ARGV[2]
`;
    const raw = await evalScript(
      script,
      [reservationKey(clusterId)],
      [now, JSON.stringify(next)],
    );
    const stored = parseReservation(raw);
    if (!stored) throw new Error("Cluster reservation state is invalid.");
    return { acquired: stored.token === token, reservation: stored };
  }
  return withLocalMutation(async () => {
    const file = localReservationFile(clusterId);
    const current = await readLocalJson<ClusterReservation>(file);
    if (current && new Date(current.expiresAt).getTime() > now) {
      return { acquired: false, reservation: current };
    }
    await writeLocalJson(file, next);
    return { acquired: true, reservation: next };
  });
}

export async function v2FailCluster(
  clusterId: string,
  token: string,
  result: string,
  now = Date.now(),
): Promise<void> {
  const current = v2UsesKv()
    ? parseReservation(
        await v2RedisCommand(["GET", reservationKey(clusterId)]),
      )
    : await readLocalJson<ClusterReservation>(
        localReservationFile(clusterId),
      );
  if (!current || current.token !== token || current.state !== "processing") {
    throw new DraftConflictError("Cluster reservation is no longer current.");
  }
  const next = {
    ...current,
    state: "failed" as const,
    result: result.slice(0, 500),
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + FAILED_RETRY_MS).toISOString(),
    expiresAtMs: now + FAILED_RETRY_MS,
  };
  if (v2UsesKv()) {
    const script = `
local current = redis.call("GET", KEYS[1])
if not current then return 0 end
local record = cjson.decode(current)
if record.token ~= ARGV[1] or record.state ~= "processing" then return 0 end
redis.call("SET", KEYS[1], ARGV[2])
return 1
`;
    const written = Number(
      await evalScript(
        script,
        [reservationKey(clusterId)],
        [token, JSON.stringify(next)],
      ),
    );
    if (written !== 1) {
      throw new DraftConflictError("Cluster reservation is no longer current.");
    }
    return;
  }
  await withLocalMutation(async () => {
    const latest = await readLocalJson<ClusterReservation>(
      localReservationFile(clusterId),
    );
    if (!latest || latest.token !== token || latest.state !== "processing") {
      throw new DraftConflictError("Cluster reservation is no longer current.");
    }
    await writeLocalJson(localReservationFile(clusterId), next);
  });
}

export async function v2AddDraft(input: NewsDraftInput): Promise<NewsDraft> {
  const now = new Date();
  const draft: NewsDraft = {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: "review",
    article: input.article,
    validator: validateV2Article(input.article),
    provenance: input.provenance,
    reviewNote: input.reviewNote,
    verifiedSources: [],
    revision: 1,
    recordVersion: 1,
    contentHash: draftContentHash(input.article, input.provenance),
  };
  const token = input.reservationToken ?? "";
  const stagedReservation = {
    clusterId: input.provenance.clusterId,
    token,
    state: "staged",
    topic: input.provenance.topic.slice(0, 500),
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + COMPLETED_TTL_MS).toISOString(),
    expiresAtMs: now.getTime() + COMPLETED_TTL_MS,
    draftId: draft.id,
    result: "staged for human review",
  };

  if (v2UsesKv()) {
    const script = `
if redis.call("EXISTS", KEYS[1]) == 1 or redis.call("EXISTS", KEYS[3]) == 1 then return "collision" end
if ARGV[4] ~= "" then
  local current = redis.call("GET", KEYS[4])
  if not current then return "reservation" end
  local record = cjson.decode(current)
  if record.token ~= ARGV[4] or record.state ~= "processing" then return "reservation" end
end
redis.call("SET", KEYS[1], ARGV[1])
redis.call("ZADD", KEYS[2], ARGV[2], ARGV[3])
redis.call("SET", KEYS[3], ARGV[3])
if ARGV[4] ~= "" then redis.call("SET", KEYS[4], ARGV[5]) end
return "ok"
`;
    const result = await evalScript(
      script,
      [
        recordKey(draft.id),
        V2_INDEX_KEY,
        slugKey(draft.article.slug),
        reservationKey(input.provenance.clusterId),
      ],
      [
        JSON.stringify(draft),
        now.getTime(),
        draft.id,
        token,
        JSON.stringify(stagedReservation),
      ],
    );
    if (result === "collision") {
      throw new DraftCollisionError("Draft slug already exists.");
    }
    if (result === "reservation") {
      throw new DraftConflictError(
        "A current atomic cluster reservation is required.",
      );
    }
    if (result !== "ok") throw new Error("Draft creation failed.");
    return draft;
  }

  return withLocalMutation(async () => {
    const ids = await readLocalIndex();
    const drafts = (
      await Promise.all(
        ids.map((id) => readLocalJson<NewsDraft>(localRecordFile(id))),
      )
    ).filter((item): item is NewsDraft => item !== null);
    if (drafts.some((item) => item.article.slug === draft.article.slug)) {
      throw new DraftCollisionError("Draft slug already exists.");
    }
    if (token) {
      const reservation = await readLocalJson<ClusterReservation>(
        localReservationFile(input.provenance.clusterId),
      );
      if (
        !reservation ||
        reservation.token !== token ||
        reservation.state !== "processing"
      ) {
        throw new DraftConflictError(
          "A current atomic cluster reservation is required.",
        );
      }
    }
    await writeLocalJson(localRecordFile(draft.id), draft);
    await writeLocalJson(LOCAL_INDEX, [...ids, draft.id]);
    if (token) {
      await writeLocalJson(
        localReservationFile(input.provenance.clusterId),
        stagedReservation,
      );
    }
    return draft;
  });
}

async function compareAndSet(
  current: NewsDraft,
  next: NewsDraft,
): Promise<void> {
  if (v2UsesKv()) {
    const script = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local record = cjson.decode(raw)
if tonumber(record.revision) ~= tonumber(ARGV[1]) or record.contentHash ~= ARGV[2] then return -1 end
if (record.publication and ARGV[4] == "none") or (not record.publication and ARGV[4] ~= "none") then return -1 end
if record.publication and record.publication.claimId ~= ARGV[4] then return -1 end
redis.call("SET", KEYS[1], ARGV[3])
return 1
`;
    const result = Number(
      await evalScript(script, [recordKey(current.id)], [
        current.revision,
        current.contentHash,
        JSON.stringify(next),
        current.publication?.claimId ?? "none",
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
    const latest = await readLocalJson<NewsDraft>(
      localRecordFile(current.id),
    );
    if (
      !latest ||
      latest.revision !== current.revision ||
      latest.contentHash !== current.contentHash ||
      latest.publication?.claimId !== current.publication?.claimId
    ) {
      throw new DraftConflictError(
        "Draft changed after this review view was loaded.",
      );
    }
    await writeLocalJson(localRecordFile(current.id), next);
  });
}

export async function v2UpdateDraft(
  id: string,
  patch: Partial<Pick<NewsDraft, "article" | "reviewNote" | "verifiedSources">>,
  expected: { revision: number; contentHash: string },
): Promise<NewsDraft | null> {
  const current = await v2GetDraft(id);
  if (!current) return null;
  if (
    current.revision !== expected.revision ||
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
    updatedAt: new Date().toISOString(),
  };
  if (patch.article) {
    next.revision = current.revision + 1;
    next.contentHash = draftContentHash(patch.article, current.provenance);
    next.validator = validateV2Article(patch.article);
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
      ) ?? undefined;
  }
  await compareAndSet(current, next);
  return next;
}

export async function v2SetMediaApproval(
  id: string,
  approval: MediaApprovalLedger,
  expected: { revision: number; contentHash: string },
): Promise<NewsDraft | null> {
  const current = await v2GetDraft(id);
  if (!current) return null;
  if (
    current.revision !== expected.revision ||
    current.contentHash !== expected.contentHash ||
    current.publication
  ) {
    throw new DraftConflictError("Draft changed during media review.");
  }
  if (current.mediaApproval) {
    if (current.mediaApproval.hash === approval.hash) return current;
    throw new DraftConflictError(
      "Media approval is immutable; edit the draft to invalidate it first.",
    );
  }
  const next = {
    ...current,
    mediaApproval: approval,
    updatedAt: new Date().toISOString(),
  };
  await compareAndSet(current, next);
  return next;
}

export async function v2DeleteDraft(
  id: string,
  expected: { revision: number; contentHash: string },
): Promise<boolean> {
  const current = await v2GetDraft(id);
  if (!current) return false;
  if (
    current.revision !== expected.revision ||
    current.contentHash !== expected.contentHash ||
    current.publication
  ) {
    throw new DraftConflictError(
      "Draft changed after this review view was loaded.",
    );
  }
  if (v2UsesKv()) {
    const script = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local record = cjson.decode(raw)
if tonumber(record.revision) ~= tonumber(ARGV[1]) or record.contentHash ~= ARGV[2] or record.publication then return -1 end
redis.call("DEL", KEYS[1])
redis.call("ZREM", KEYS[2], ARGV[3])
redis.call("DEL", KEYS[3])
return 1
`;
    const result = Number(
      await evalScript(
        script,
        [
          recordKey(id),
          V2_INDEX_KEY,
          slugKey(current.article.slug),
        ],
        [expected.revision, expected.contentHash, id],
      ),
    );
    if (result === 0) return false;
    if (result !== 1) throw new DraftConflictError("Draft changed.");
    return true;
  }
  return withLocalMutation(async () => {
    const latest = await readLocalJson<NewsDraft>(localRecordFile(id));
    if (
      !latest ||
      latest.revision !== expected.revision ||
      latest.contentHash !== expected.contentHash ||
      latest.publication
    ) {
      throw new DraftConflictError("Draft changed.");
    }
    await fs.unlink(localRecordFile(id));
    const ids = await readLocalIndex();
    await writeLocalJson(
      LOCAL_INDEX,
      ids.filter((item) => item !== id),
    );
    return true;
  });
}

export async function v2ClaimPublication(
  id: string,
  expected: {
    revision: number;
    contentHash: string;
    mediaApprovalHash: string;
    evidenceApprovalHash: string;
  },
): Promise<NewsDraft | null> {
  const current = await v2GetDraft(id);
  if (!current) return null;
  if (
    current.revision !== expected.revision ||
    current.contentHash !== expected.contentHash ||
    current.mediaApproval?.hash !== expected.mediaApprovalHash ||
    current.evidenceApproval?.hash !== expected.evidenceApprovalHash
  ) {
    throw new DraftConflictError(
      "The reviewed revision or approval ledger changed.",
    );
  }
  if (current.publication) return current;
  const timestamp = new Date().toISOString();
  const publication: PublicationRecord = {
    state: "publishing",
    claimId: crypto.randomUUID(),
    ...expected,
    startedAt: timestamp,
    updatedAt: timestamp,
  };
  const next = { ...current, publication, updatedAt: timestamp };
  await compareAndSet(current, next);
  return next;
}

export async function v2RecordCommit(
  id: string,
  claimId: string,
  commitSha: string,
  url: string,
): Promise<NewsDraft> {
  const current = await v2GetDraft(id);
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
    updatedAt: timestamp,
    publication: {
      ...current.publication,
      state: "committed",
      commitSha,
      url,
      updatedAt: timestamp,
    },
  };
  await compareAndSet(current, next);
  return next;
}

export async function v2CompletePublication(
  id: string,
  claimId: string,
): Promise<NewsDraft> {
  const current = await v2GetDraft(id);
  if (!current || current.publication?.claimId !== claimId) {
    throw new DraftConflictError("Publication claim is no longer current.");
  }
  if (current.publication.state === "completed") return current;
  if (
    current.publication.state !== "committed" ||
    !current.publication.commitSha ||
    !current.publication.url
  ) {
    throw new DraftConflictError("No durable commit result exists.");
  }
  const timestamp = new Date().toISOString();
  const next: NewsDraft = {
    ...current,
    updatedAt: timestamp,
    publication: {
      ...current.publication,
      state: "completed",
      updatedAt: timestamp,
    },
  };
  await compareAndSet(current, next);
  return next;
}
