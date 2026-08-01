import assert from "node:assert/strict";

import { clusterAndScore, topicClusterId } from "../lib/pipeline/cluster.js";
import type { RawEntry } from "../lib/sources/fetchers/types.js";

const entry: RawEntry = {
  id: "https://news.google.com/rss/articles/CBMi?oc=5&x=/unsafe==",
  title: "Dubai real estate market records new off-plan demand",
  url: "https://news.google.com/rss/articles/CBMi?oc=5",
  publishedAt: new Date().toISOString(),
  summary: "Dubai property investors examine off-plan sales and rental yield.",
  source: {
    name: "Test publisher",
    tier: "national-press",
    domain: "example.com",
  },
};

const first = topicClusterId(entry);
const second = topicClusterId({ id: entry.id, title: entry.title });
assert.equal(first, second, "topic cluster IDs must be deterministic");
assert.match(first, /^[A-Za-z0-9:_-]{1,256}$/);

const clusters = clusterAndScore([entry], 1);
assert.equal(clusters.length, 1);
assert.equal(clusters[0].id, first);
assert.match(clusters[0].id, /^[A-Za-z0-9:_-]{1,256}$/);

console.log(
  "Cluster ID regression passed: deterministic, bounded and reservation-safe.",
);
