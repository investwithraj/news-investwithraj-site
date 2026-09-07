import assert from "node:assert/strict";

import {
  findNewsDraftQuarantine,
  NEWS_DRAFT_QUARANTINE,
} from "../lib/news-review/draft-quarantine.js";

const rejectedSlug =
  "2026-09-07-dubai-land-department-launches-unified-registration";
const correctedSlug =
  "2026-09-07-dubai-land-department-launches-initial-registration-platform";
const rule = NEWS_DRAFT_QUARANTINE[0];

function draft({
  id = rule.provenance.rejectedDraftId,
  contentHash = rule.provenance.rejectedContentHash,
  slug = rejectedSlug,
}: {
  id?: string;
  contentHash?: string;
  slug?: string;
} = {}) {
  return {
    id,
    contentHash,
    article: { slug },
  };
}

function main(): void {
  const originalHold = findNewsDraftQuarantine(draft());
  assert.equal(originalHold?.ruleId, rule.id);
  assert.equal(originalHold?.scope, "slug");
  assert.equal(
    originalHold?.provenance.rejectedDraftId,
    "f01d5ea6-56b3-45bd-b48c-d67bb567480c",
    "the originally rejected draft ID must remain available as audit provenance",
  );
  assert.equal(
    originalHold?.provenance.rejectedContentHash,
    "118e1030f017d36619d2d95346722f2ba161e2a42a0a526aa6f660e8872e2dd3",
    "the originally rejected content hash must remain available as audit provenance",
  );

  const restagedHold = findNewsDraftQuarantine(
    draft({
      id: "newly-fetched-draft-id",
      contentHash: "f".repeat(64),
    }),
  );
  assert.equal(
    restagedHold?.ruleId,
    rule.id,
    "a changed ID and content hash must not escape the rejected slug hold",
  );
  assert.equal(restagedHold?.matchedDraftId, "newly-fetched-draft-id");
  assert.equal(restagedHold?.matchedContentHash, "f".repeat(64));

  assert.equal(
    findNewsDraftQuarantine(
      draft({
        id: "corrected-candidate-id",
        contentHash: "a".repeat(64),
        slug: correctedSlug,
      }),
    ),
    null,
    "the separately reviewed corrected candidate slug must remain eligible",
  );

  console.log(
    "News draft quarantine regression passed: the rejected DLD slug remains held across mutable staging metadata while the corrected slug remains eligible.",
  );
}

main();
