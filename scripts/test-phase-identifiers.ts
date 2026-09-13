import assert from "node:assert/strict";

import {
  canonicalizeEvidenceNumericPhrases,
  extractFigures,
  findUnconsumedDigitContexts,
  findUnsupportedFigures,
} from "../lib/news-review/auto-approve.js";

// Synthetic numeric-parser fixtures only; these are not verified project facts.
const source = "The project is located in Dubai Healthcare City Phase 2. The development will include more than 1,000 homes.";
const claim = "The development in Dubai Healthcare City Phase 2 will include more than 1,000 homes.";

assert.deepEqual(
  extractFigures(claim),
  ["phase 2", "1,000 homes"],
  "a phase identifier must end before the following verb/quantifier, leaving the home count independently evidence-bound",
);
assert.deepEqual(findUnsupportedFigures(claim, source), []);
assert.deepEqual(findUnconsumedDigitContexts(claim), []);
assert.equal(canonicalizeEvidenceNumericPhrases(claim, source), claim,
  "phase matching must not rewrite surrounding prose to match the source wording");

for (const continuation of [
  "will include more than 1,000 homes.",
  "includes residential buildings.",
  "offers homes beside the creek.",
  "has residential buildings.",
  "is the location of the development.",
  "of Dubai Healthcare City is the location.",
  ", Dubai Healthcare City, is the location.",
]) {
  const value = `Phase 2 ${continuation}`;
  assert.equal(extractFigures(value)[0], "phase 2");
  assert.deepEqual(findUnsupportedFigures(value, source), [], continuation);
}
assert.deepEqual(findUnsupportedFigures(claim.replace("Phase 2", "Phase 3"), source), ["phase 3"],
  "different phase numbers must remain unsupported, even when all home counts match");
assert.deepEqual(findUnsupportedFigures("The project is in Phase 2.", "The source covers 2 homes."), ["phase 2"],
  "an unrelated number cannot verify a phase identifier");
assert.deepEqual(findUnsupportedFigures("The project is in Phase 2.", "The project location is not identified."), ["phase 2"],
  "phase numbers are claims, not excluded navigation digits");
assert.deepEqual(findUnsupportedFigures("Phase 20 will include homes.", "Phase 2 includes homes."), ["phase 20"]);
assert.deepEqual(findUnsupportedFigures("Phase 2.5 will include homes.", "Phase 2.6 includes homes."), ["phase 2.5"]);
assert.ok(findUnconsumedDigitContexts("Phase 2A will include homes.").length > 0,
  "an unrecognised alphanumeric phase suffix must not be silently reduced to Phase 2");

const phaseOnlyEvidence = "The project is in Phase 2.";
for (const text of [
  "The developer plans to phase 2 million homes into construction.",
  "The developer plans to phase 2 homes into construction.",
  "The developer plans to phase 2 large residential buildings into construction.",
  "Phase 2% of the buildings into construction.",
  "Phase 2 % of the buildings into construction.",
  "Phase 2 per cent of the buildings into construction.",
  "Phase 2 million homes into construction.",
  "Phase 2mn homes into construction.",
  "Phase 2 billion dirhams into construction.",
  "Phase 2 square metres into construction.",
  "Phase 2 hectares into construction.",
  "Phase 2 units into construction.",
  "Phase 2-unit buildings into construction.",
  "Phase 2-million homes into construction.",
  "Phase 2-bedroom homes into construction.",
  "Phase 2 years into the plan.",
]) {
  assert.ok(findUnsupportedFigures(text, phaseOnlyEvidence).length > 0,
    `a phase identifier cannot support a scaled quantity, unit or verbal count: ${text}`);
  assert.ok(!extractFigures(text).includes("phase 2"),
    `quantity continuations must reach the full numeric parser: ${text}`);
  assert.deepEqual(findUnconsumedDigitContexts(text), [], text);
  assert.deepEqual(findUnsupportedFigures(text, text), [], text);
}
assert.deepEqual(
  extractFigures("The developer plans to phase 2 million homes into construction."),
  ["2 million homes"],
);
assert.deepEqual(extractFigures("Phase 2% of the buildings into construction."), ["2%"]);

const materialCases = [
  {
    text: "Phase 2 will include more than 1,001 homes.",
    evidence: "Phase 2 includes more than 1,000 homes.",
    unsupported: ["1,001 homes"],
  },
  {
    text: "Phase 2 has AED 50 million construction costs.",
    evidence: "Phase 2 has AED 40 million construction costs.",
    unsupported: ["aed 50 million construction costs"],
  },
  {
    text: "Phase 2 has a 50 per cent payment threshold.",
    evidence: "Phase 2 has a 40 per cent payment threshold.",
    unsupported: ["50 per cent payment threshold"],
  },
  {
    text: "Phase 2 has a 50 per cent payment threshold.",
    evidence: "Phase 2 has a 50 per cent ownership threshold.",
    unsupported: ["50 per cent payment threshold"],
  },
  {
    text: "Phase 2 has 1,000-1,200 homes.",
    evidence: "Phase 2 has 1,000 homes and 1,200 homes.",
    unsupported: ["1,000-1,200 homes"],
  },
  {
    text: "Phase 2 has AED 40 million-AED 50 million construction costs.",
    evidence: "Phase 2 has AED 40 million construction costs and AED 50 million construction costs.",
    unsupported: ["aed 40 million-aed 50 million construction costs"],
  },
];
for (const fixture of materialCases) {
  assert.deepEqual(findUnsupportedFigures(fixture.text, fixture.evidence), fixture.unsupported, fixture.text);
  assert.deepEqual(findUnconsumedDigitContexts(fixture.text), [], fixture.text);
  assert.deepEqual(findUnsupportedFigures(fixture.text, fixture.text), [], fixture.text);
}

console.log("Phase-identifier regression passed: exact evidence-bound identifiers, no swallowed prose, unchanged home/currency/threshold/range checks.");
