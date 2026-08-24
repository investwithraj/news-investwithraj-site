import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  patchArticleRelations,
  patchIndex,
} from "../lib/news-review/serialize";

const slug = "2099-12-31-registry-contract-probe";
const indexSource = readFileSync(resolve("content/news/index.ts"), "utf8");
const relationsSource = readFileSync(
  resolve("lib/article-relations.ts"),
  "utf8",
);

const patchedIndex = patchIndex(indexSource, slug);
assert.match(patchedIndex, new RegExp(`from "\\./${slug}"`, "u"));
assert.equal(patchIndex(patchedIndex, slug), patchedIndex);

const patchedRelations = patchArticleRelations(relationsSource, slug);
assert.match(
  patchedRelations,
  new RegExp(
    `articleSlug:\\s*"${slug}",[\\s\\S]*?areaSlugs:\\s*\\[\\],[\\s\\S]*?developerSlugs:\\s*\\[\\]`,
    "u",
  ),
);
assert.equal(patchArticleRelations(patchedRelations, slug), patchedRelations);

assert.throws(
  () => patchArticleRelations("export const unrelated = [];", slug),
  /registry marker is missing/u,
);

const publisherSource = readFileSync(
  resolve("lib/news-review/github.ts"),
  "utf8",
);
assert.match(publisherSource, /patchArticleRelations\(currentRelations, slug\)/u);
assert.match(publisherSource, /path: "lib\/article-relations\.ts"/u);

console.log(
  "News publication registries PASS: article, index and fail-closed relation records publish atomically.",
);
