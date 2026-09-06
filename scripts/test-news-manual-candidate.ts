import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { selectDraftClusters } from "../lib/news-review/manual-candidate";
import type { Cluster } from "../lib/pipeline/types";

function cluster(
  id: string,
  topic: string,
  summary: string,
  score: number,
): Cluster {
  return {
    id,
    topic,
    score,
    scoreBreakdown: {
      uhnwRelevance: 0,
      sourceTier: 50,
      freshness: 50,
      rajAngle: 24,
    },
    entities: {
      developers: [],
      places: [],
      figures: [],
      hasTier1Source: true,
    },
    suggestedCategory: "regulatory",
    suggestedMarkets: ["Dubai"],
    entries: [
      {
        id: `${id}-entry`,
        title: topic,
        summary,
        url: `https://example.test/${id}`,
        publishedAt: "2026-09-03T12:00:00.000Z",
        source: {
          name: "Test source",
          domain: "example.test",
          tier: "government",
        },
      },
    ],
  };
}

const highScore = cluster(
  "ordinary",
  "Dubai real estate market update",
  "A general market report.",
  50,
);
const reviewedDld = cluster(
  "regulatory",
  "Dubai Land Department launches Initial Registration platform",
  "DLD says the Initial Registration platform connects developer workflows.",
  36,
);
const unrelatedDld = cluster(
  "other-dld",
  "Dubai Land Department updates service centre hours",
  "DLD published new opening times.",
  60,
);

assert.deepEqual(selectDraftClusters([highScore, reviewedDld], 45), [highScore]);
assert.deepEqual(
  selectDraftClusters(
    [highScore, unrelatedDld, reviewedDld],
    45,
    "dld-initial-registration",
  ),
  [reviewedDld],
);
assert.throws(
  () => selectDraftClusters([reviewedDld], 45, "unreviewed-story"),
  /Unknown manual news candidate key/,
);

const workflow = readFileSync(
  new URL("../.github/workflows/news-cron.yml", import.meta.url),
  "utf8",
);
assert.match(workflow, /candidate_key:/u);
assert.match(workflow, /- dld-initial-registration/u);
assert.match(workflow, /PIPELINE_CANDIDATE_KEY:/u);
assert.match(
  workflow,
  /inputs\.candidate_key != 'auto' && '0' \|\| '1'/u,
  "manual candidates must stage without auto-publication",
);

console.log(
  "Manual news candidate regression passed: automatic scoring and exact reviewed-event staging remain separate.",
);
