import assert from "node:assert/strict";

import {
  parseDraftJsonResponse,
  slugify,
} from "../lib/news-review/draft-engine.js";

const article = {
  skip: false,
  title: "A sourced property report",
  body: "A sufficiently long body would be supplied by the real drafter.",
  tldr: ["One", "Two", "Three"],
};

assert.deepEqual(
  parseDraftJsonResponse(`Research complete.\n\n\`\`\`json\n${JSON.stringify(article)}\n\`\`\``),
  article,
);
assert.deepEqual(
  parseDraftJsonResponse(`{"tool":"note"}\n${JSON.stringify(article)}`),
  article,
);
assert.equal(parseDraftJsonResponse("not json"), null);
assert.equal(
  slugify("Dubai's property market entered a more selective phase in first half of 2026"),
  "dubai-s-property-market-entered-a-more-selective-phase-in",
);
assert.ok(!slugify(`${"word ".repeat(20)}tail`).endsWith("-"));

console.log("Draft-response parser regression passed.");
