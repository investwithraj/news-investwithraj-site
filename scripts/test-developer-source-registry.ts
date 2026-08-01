import assert from "node:assert/strict";

import {
  DEVELOPER_DIRECT_FEEDS,
  FETCH_SOURCES,
  findSourceByUrl,
} from "../lib/sources/registry.js";
import {
  classifySender,
  extractTags,
} from "../lib/press-inbox/types.js";

const expectedActive = new Set([
  "Nakheel",
  "Modon Properties",
  "Sobha Realty",
  "Dubai Holding",
  "Marjan",
  "Ellington Properties",
  "Arada",
]);

assert.deepEqual(
  new Set(DEVELOPER_DIRECT_FEEDS.map((source) => source.name)),
  expectedActive,
  "Only live-tested official developer newsrooms may be enabled",
);

for (const source of DEVELOPER_DIRECT_FEEDS) {
  assert.equal(source.directFetchEnabled, true);
  assert.ok(source.fetchUrl?.startsWith("https://"));
  assert.equal(findSourceByUrl(source.url)?.name, source.name);
  assert.ok(FETCH_SOURCES.includes(source));
}

assert.equal(classifySender("newsroom@sobharealty.com"), "developer-tier-1");
assert.equal(classifySender("press@updates.ellingtonproperties.ae"), "developer-tier-1");
assert.equal(classifySender("hello@unknown.example"), "noise");

const tags = extractTags(
  "Arada and Shamal update",
  "Ellington, Meraas, Sobha and Select Group announced project milestones.",
);
for (const expected of ["arada", "shamal", "ellington", "meraas", "sobha", "select group"]) {
  assert.ok(tags.includes(expected), `Missing developer tag: ${expected}`);
}

console.log(
  `Developer source registry passed: ${DEVELOPER_DIRECT_FEEDS.length} live-tested official newsrooms.`,
);
