import assert from "node:assert/strict";

import {
  assessClaimSupport,
  assessResearchOriginality,
  type ClaimSupportEvidence,
  type ClaimSupportSegment,
} from "../lib/news-review/claim-support.js";

// Synthetic, offline research packet. Source B's wording must remain protected
// even if the final article selects only source A to support the same fact.
const selectedSource: ClaimSupportEvidence = {
  url: "https://www.mediaoffice.abudhabi/en/economy/originality-fixture/",
  publisher: "Abu Dhabi Media Office",
  publisherAliases: ["ADMO"],
  text: "Abu Dhabi Global Market (ADGM) said active licences reached 13,974 at the end of H1 2026.",
};
const copiedClause = "ADGM's active licence total reached 13,974 at the end of H1 2026.";
const unselectedSource: ClaimSupportEvidence = {
  url: "https://gulfnews.com/business/markets/originality-fixture",
  publisher: "Gulf News",
  text: copiedClause,
};
const evidence = [selectedSource, unselectedSource];
const copiedSegments: ClaimSupportSegment[] = [{ field: "body", text: copiedClause }];

const selectedSupport = assessClaimSupport({ segments: copiedSegments, evidence: [selectedSource] });
assert.equal(selectedSupport.ok, true, JSON.stringify(selectedSupport));
assert.deepEqual(assessResearchOriginality({ segments: copiedSegments, evidence: [selectedSource] }), []);
const held = assessResearchOriginality({ segments: copiedSegments, evidence });
assert.equal(held.length, 1, "dropping a citation cannot hide copying from that research source");
assert.equal(held[0].code, "source-copying");
assert.equal(held[0].field, "body");
assert.equal(held[0].clause, copiedClause);
assert.match(held[0].detail, /unselected citations/u);

const originalSegments: ClaimSupportSegment[] = [{
  field: "body", text: "The active licence count for ADGM stood at 13,974 when H1 2026 ended.",
}];
assert.deepEqual(assessResearchOriginality({ segments: originalSegments, evidence }), [],
  "original phrasing is not penalised because another researched source was left uncited");

// This is a copy-only assessment, never an assertion of support, source usage,
// or eligibility for the one-source corporate-intent reporting lane.
assert.deepEqual(assessResearchOriginality({
  segments: [{ field: "body", text: "An unsupported developer plans a wholly different island." }], evidence,
}), []);
assert.deepEqual(assessResearchOriginality({ segments: copiedSegments, evidence: [] }), []);
assert.deepEqual(assessResearchOriginality({ segments: [], evidence }), []);

// The same clause splitter protects reader-visible summaries and clauses
// separated by punctuation or conjunctions; duplicate sources do not duplicate
// the diagnostic for one clause.
for (const field of ["title", "subtitle", "tldr[0]", "body", "faq[0].a"]) {
  const result = assessResearchOriginality({
    segments: [{ field, text: copiedClause }],
    evidence: [...evidence, unselectedSource],
  });
  assert.equal(result.length, 1, field);
  assert.equal(result[0].field, field);
}
for (const separator of ["; ", "\n", " while "]) {
  const result = assessResearchOriginality({
    segments: [{ field: "body", text: `${copiedClause.replace(/\.$/u, "")}${separator}${copiedClause}` }], evidence,
  });
  assert.equal(result.length, 2, `shared atomic splitting: ${JSON.stringify(separator)}`);
}

// Keep the existing short-copy threshold: fewer than eight words is not a
// copying failure; an exact eight-word run is. No new overlap threshold here.
const shortSource = { ...unselectedSource, text: "The district opened a public waterfront exhibition today." };
assert.deepEqual(assessResearchOriginality({
  segments: [{ field: "title", text: "The district opened a public waterfront exhibition" }], evidence: [shortSource],
}), []);
assert.equal(assessResearchOriginality({
  segments: [{ field: "title", text: "The district opened a public waterfront exhibition today" }], evidence: [shortSource],
}).length, 1);

const longSource = { ...unselectedSource, text: Array.from({ length: 40 }, (_, index) => `distinctiveword${index}`).join(" ") };
const bounded = assessResearchOriginality({ segments: [{ field: "body", text: longSource.text }], evidence: [longSource] });
assert.equal(bounded.length, 1);
assert.equal(bounded[0].clause.length, 180);
assert.ok(bounded[0].clause.endsWith("..."));
const snapshot = structuredClone({ segments: copiedSegments, evidence });
assessResearchOriginality({ segments: copiedSegments, evidence });
assert.deepEqual({ segments: copiedSegments, evidence }, snapshot, "original draft and fetched source bytes remain unchanged");

console.log("PASS: research originality retains dropped-source protection, accepts original phrasing, preserves shared copy thresholds and bounded diagnostics, and mutates no evidence. No external operations.");
