import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const originalDirectory = process.cwd();
  const testDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "iwr-queue-"));

  try {
    process.chdir(testDirectory);
    const queue = await import("../lib/queue/storage");

  const draft = {
    channel: "reddit" as const,
    target: "r/dubai",
    draftText: "Evidence-led test response.",
    rationale: "Concurrency regression fixture.",
  };
  const retryKey = "order98-queue-retry";
  const retries = await Promise.all(
    Array.from({ length: 20 }, () => queue.addItems([draft], retryKey)),
  );
  const ids = new Set(retries.map((result) => result[0].id));
  assert.equal(ids.size, 1, "idempotent retries must return one stable ID");
  assert.equal((await queue.getAllItems()).length, 1);

  await assert.rejects(
    queue.addItems([{ ...draft, target: "r/uae" }], retryKey),
    queue.QueueMutationConflictError,
  );

  const id = retries[0][0].id;
  const competing = await Promise.allSettled([
    queue.updateItem(id, 1, { editNote: "first writer" }),
    queue.updateItem(id, 1, { editNote: "second writer" }),
  ]);
  assert.equal(
    competing.filter((result) => result.status === "fulfilled").length,
    1,
    "exactly one compare-and-swap update must win",
  );
  assert.equal(
    competing.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof queue.QueueMutationConflictError,
    ).length,
    1,
    "the stale writer must receive a conflict",
  );

  const future = new Date(Date.now() + 4 * 24 * 60 * 60 * 1_000);
  assert.equal(await queue.expireStaleItems(future), 1);
  const expired = await queue.getItem(id);
  assert.equal(expired?.status, "expired");
  assert.equal(expired?.recordVersion, 3);

  const queueFile = path.join(testDirectory, "pipeline-runs", "queue.json");
  await fs.writeFile(
    queueFile,
    JSON.stringify([
      {
        ...expired,
        actedAt: "2020-01-01T00:00:00.000Z",
      },
    ]),
    "utf8",
  );
  await queue.addItems([draft], "order98-retention-prune");
  const retained = await queue.getAllItems();
  assert.equal(retained.length, 1, "old terminal records must be pruned on add");
  assert.notEqual(retained[0].id, id);

    console.log(
      "Queue regression passed: 20-way retry dedupe, payload conflict, CAS, expiry and retention pruning.",
    );
  } finally {
    process.chdir(originalDirectory);
    await fs.rm(testDirectory, { recursive: true, force: true });
  }
}

void main();
