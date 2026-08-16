import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";

import {
  extractQueueNewsroomArticleSlugs,
  validateQueueLifecycleFields,
} from "../lib/queue/lifecycle";
import { NEWSROOM_LIFECYCLE_CUTOVER_ENV } from "../lib/news-lifecycle";

const SECRET = "queue-lifecycle-test-secret-0123456789abcdef";
const APPROVED_SLUG =
  "2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction";
const REMOVED_SLUG =
  "2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop";
const REDIRECT_SOURCE_SLUG =
  "2026-06-28-dubai-mandates-monthly-rent-option-across-12-landlords-in-fl";
const RESEARCH_SLUG = "2026-05-26-dld-21b-week";

type EnvironmentKey =
  | typeof NEWSROOM_LIFECYCLE_CUTOVER_ENV
  | "POST_PUBLISH_SECRET"
  | "KV_REST_API_URL"
  | "KV_REST_API_TOKEN"
  | "NODE_ENV";

const ENVIRONMENT_KEYS: EnvironmentKey[] = [
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
  "POST_PUBLISH_SECRET",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "NODE_ENV",
];

function restoreEnvironment(
  originals: ReadonlyMap<EnvironmentKey, string | undefined>,
): void {
  for (const [key, value] of originals) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      Reflect.set(process.env, key, value);
    }
  }
}

function setCutover(enabled: boolean): void {
  if (enabled) {
    process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
  } else {
    delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  }
}

function queueRequest(
  pathname: string,
  body: unknown,
  idempotencyKey?: string,
): NextRequest {
  return new NextRequest(`https://news.investwithraj.com${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-post-publish-secret": SECRET,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  const originalDirectory = process.cwd();
  const originals = new Map<EnvironmentKey, string | undefined>(
    ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  );
  const testDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "iwr-queue-lifecycle-"),
  );

  try {
    process.env.POST_PUBLISH_SECRET = SECRET;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    Reflect.set(process.env, "NODE_ENV", "development");
    process.chdir(testDirectory);

    const [{ POST: addToQueue }, { POST: actOnQueueItem }, queue] =
      await Promise.all([
        import("../app/api/queue/add/route"),
        import("../app/api/queue/action/[id]/route"),
        import("../lib/queue/storage"),
      ]);

    assert.deepEqual(
      new Set(
        extractQueueNewsroomArticleSlugs(
          `See /news/${APPROVED_SLUG} and https://www.news.investwithraj.com/news/${REMOVED_SLUG}?source=queue.`,
        ),
      ),
      new Set([APPROVED_SLUG, REMOVED_SLUG]),
    );
    const malformed = validateQueueLifecycleFields({
      draftText:
        "Malformed internal link: https://news.investwithraj.com/news/NOT-CANONICAL.",
    });
    assert.equal(malformed.ok, false);
    assert.equal(malformed.malformedNewsroomReference, true);

    for (const cutoverEnabled of [false, true]) {
      setCutover(cutoverEnabled);
      const mode = cutoverEnabled ? "on" : "off";

      const rejectedFields = [
        { target: `/news/${REMOVED_SLUG}` },
        {
          draftText: `Read https://news.investwithraj.com/news/${REMOVED_SLUG}`,
        },
        {
          rationale: `Context: https://www.news.investwithraj.com/news/${REDIRECT_SOURCE_SLUG}`,
        },
        {
          responseToUrl: `https://news.investwithraj.com/news/${RESEARCH_SLUG}`,
        },
        { sourceArticleSlug: REMOVED_SLUG },
        { editNote: `Do not use /news/${REDIRECT_SOURCE_SLUG}` },
        {
          postedUrl: `https://www.news.investwithraj.com/news/${RESEARCH_SLUG}`,
        },
        {
          draftText: `Normalized path: https://news.investwithraj.com/x/../news/${REMOVED_SLUG}`,
        },
        {
          draftText: `Encoded host: https://news%2Einvestwithraj.com/news/${REMOVED_SLUG}`,
        },
        {
          draftText: String.raw`Backslash path: https://news.investwithraj.com\news\${REMOVED_SLUG}`,
        },
        {
          responseToUrl: `https://news.investwithraj.com./news/${REMOVED_SLUG}`,
        },
        {
          draftText: `Encoded path: https://news.investwithraj.com/%6eews/${REMOVED_SLUG}`,
        },
        {
          draftText: `Single slash: https:/%6eews.investwithraj.com/news/${REMOVED_SLUG}`,
        },
        {
          draftText: String.raw`Single backslash: https:\%6eews.investwithraj.com/news/${REMOVED_SLUG}`,
        },
        { draftText: `Punctuation—/news/${REMOVED_SLUG}` },
        { rationale: `Punctuation;/news/${REMOVED_SLUG}` },
        { editNote: `Punctuation!/news/${REMOVED_SLUG}` },
      ];
      for (const fields of rejectedFields) {
        assert.equal(
          validateQueueLifecycleFields(fields).ok,
          false,
          `${mode}: a non-public newsroom reference escaped ${JSON.stringify(fields)}.`,
        );
      }

      const allowed = validateQueueLifecycleFields({
        target: `https://example.com/?next=/news/${REMOVED_SLUG}`,
        draftText: `Approved: /news/${APPROVED_SLUG}. External bare URL: example.com/?next=/news/${REMOVED_SLUG}`,
        rationale: `Canonical: https://news.investwithraj.com/news/${APPROVED_SLUG}`,
        responseToUrl: `https://example.org/news.investwithraj.com/news/${RESEARCH_SLUG}`,
        editNote: `WWW: https://www.news.investwithraj.com:443/news/${APPROVED_SLUG}`,
      });
      assert.equal(allowed.ok, true, `${mode}: approved/external URLs were blocked.`);
      assert.deepEqual(allowed.referencedArticleSlugs, [APPROVED_SLUG]);

      const baseItem = {
        channel: "linkedin-comment",
        target: "https://www.linkedin.com/feed/update/test",
        draftText: `Evidence: /news/${APPROVED_SLUG}`,
        rationale: "Relevant to the current market discussion.",
        responseToUrl: `https://example.com/news/${REMOVED_SLUG}`,
      } as const;
      const intakeBypassCases = [
        {
          ...baseItem,
          target: `/news/${REMOVED_SLUG}`,
        },
        {
          ...baseItem,
          draftText: `Copy https://news.investwithraj.com/news/${REMOVED_SLUG}`,
        },
        {
          ...baseItem,
          rationale: `Copy https://www.news.investwithraj.com/news/${REDIRECT_SOURCE_SLUG}`,
        },
        {
          ...baseItem,
          responseToUrl: `https://news.investwithraj.com/news/${RESEARCH_SLUG}`,
        },
        {
          ...baseItem,
          draftText: `Copy https://news.investwithraj.com/x/../news/${REMOVED_SLUG}`,
        },
        {
          ...baseItem,
          draftText: `Copy https://news%2Einvestwithraj.com/news/${REMOVED_SLUG}`,
        },
        {
          ...baseItem,
          draftText: String.raw`Copy https://news.investwithraj.com\news\${REMOVED_SLUG}`,
        },
        {
          ...baseItem,
          responseToUrl: `https://news.investwithraj.com./news/${REMOVED_SLUG}`,
        },
        {
          ...baseItem,
          draftText: `Copy https:/%6eews.investwithraj.com/news/${REMOVED_SLUG}`,
        },
        {
          ...baseItem,
          rationale: `Copy—/news/${REMOVED_SLUG}`,
        },
      ];

      for (const [index, item] of intakeBypassCases.entries()) {
        const before = (await queue.getAllItems()).length;
        const response = await addToQueue(
          queueRequest(
            "/api/queue/add",
            { items: [item] },
            `lifecycle-${mode}-reject-${index}`,
          ),
        );
        assert.equal(
          response.status,
          400,
          `${mode}: source-less embedded newsroom URL was accepted at intake.`,
        );
        assert.equal((await queue.getAllItems()).length, before);
      }

      const accepted = await addToQueue(
        queueRequest(
          "/api/queue/add",
          { items: [baseItem] },
          `lifecycle-${mode}-accept`,
        ),
      );
      assert.equal(accepted.status, 200, `${mode}: valid intake was rejected.`);
      const acceptedBody = (await accepted.json()) as { ids?: string[] };
      const id = acceptedBody.ids?.[0];
      assert.ok(id, `${mode}: valid intake did not return an item ID.`);

      for (const [index, edit] of [
        {
          draftText: `Bad edit: /news/${REMOVED_SLUG}`,
          editNote: "Draft field bypass test.",
        },
        {
          draftText: `Still approved: /news/${APPROVED_SLUG}`,
          editNote: `Bad note: https://www.news.investwithraj.com/news/${REDIRECT_SOURCE_SLUG}`,
        },
      ].entries()) {
        const response = await actOnQueueItem(
          queueRequest(`/api/queue/action/${id}`, {
            action: "edit",
            expectedRecordVersion: 1,
            ...edit,
          }),
          { params: Promise.resolve({ id }) },
        );
        assert.equal(
          response.status,
          400,
          `${mode}: post-intake lifecycle bypass ${index} was accepted.`,
        );
        assert.equal((await queue.getItem(id))?.recordVersion, 1);
      }

      const validEdit = await actOnQueueItem(
        queueRequest(`/api/queue/action/${id}`, {
          action: "edit",
          expectedRecordVersion: 1,
          draftText: `Approved: https://news.investwithraj.com/news/${APPROVED_SLUG}. External context: https://example.com/news/${REMOVED_SLUG}.`,
          editNote: "Lifecycle-safe edit.",
        }),
        { params: Promise.resolve({ id }) },
      );
      assert.equal(validEdit.status, 200, `${mode}: valid edit was rejected.`);
      assert.equal((await queue.getItem(id))?.recordVersion, 2);

      const badPostedUrl = await actOnQueueItem(
        queueRequest(`/api/queue/action/${id}`, {
          action: "mark-posted",
          expectedRecordVersion: 2,
          postedUrl: `https://news.investwithraj.com/news/${REMOVED_SLUG}`,
        }),
        { params: Promise.resolve({ id }) },
      );
      assert.equal(
        badPostedUrl.status,
        400,
        `${mode}: a non-public newsroom postedUrl was accepted.`,
      );
      assert.equal((await queue.getItem(id))?.recordVersion, 2);

      const validPostedUrl = await actOnQueueItem(
        queueRequest(`/api/queue/action/${id}`, {
          action: "mark-posted",
          expectedRecordVersion: 2,
          postedUrl: `https://example.com/news/${REMOVED_SLUG}`,
        }),
        { params: Promise.resolve({ id }) },
      );
      assert.equal(
        validPostedUrl.status,
        200,
        `${mode}: a valid external postedUrl was rejected.`,
      );
      assert.equal((await queue.getItem(id))?.recordVersion, 3);

      const legacyBad = await queue.addItems(
        [
          {
            ...baseItem,
            draftText: `Legacy copy: /news/${REMOVED_SLUG}`,
          },
        ],
        `lifecycle-${mode}-legacy`,
      );
      const approveLegacy = await actOnQueueItem(
        queueRequest(`/api/queue/action/${legacyBad[0].id}`, {
          action: "approve",
          expectedRecordVersion: 1,
        }),
        { params: Promise.resolve({ id: legacyBad[0].id }) },
      );
      assert.equal(
        approveLegacy.status,
        400,
        `${mode}: a legacy non-public URL advanced to approved.`,
      );

      const skipLegacy = await actOnQueueItem(
        queueRequest(`/api/queue/action/${legacyBad[0].id}`, {
          action: "skip",
          expectedRecordVersion: 1,
        }),
        { params: Promise.resolve({ id: legacyBad[0].id }) },
      );
      assert.equal(skipLegacy.status, 200);
      const postponeLegacy = await actOnQueueItem(
        queueRequest(`/api/queue/action/${legacyBad[0].id}`, {
          action: "postpone",
          expectedRecordVersion: 2,
        }),
        { params: Promise.resolve({ id: legacyBad[0].id }) },
      );
      assert.equal(
        postponeLegacy.status,
        400,
        `${mode}: postpone reactivated a legacy non-public queue item.`,
      );
      assert.equal((await queue.getItem(legacyBad[0].id))?.status, "skipped");
    }

    console.log(
      "Queue lifecycle PASS: every queue field, source-less intake and post-intake edits fail closed with cutover OFF and ON.",
    );
  } finally {
    process.chdir(originalDirectory);
    restoreEnvironment(originals);
    await fs.rm(testDirectory, { recursive: true, force: true });
  }
}

void main();
