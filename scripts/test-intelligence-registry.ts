import assert from "node:assert/strict";
import {
  CANONICAL_DEVELOPERS,
  INTELLIGENCE_SNAPSHOT,
  REGULATOR_SOURCES,
} from "../content/intelligence/registry";
import { DEVELOPERS } from "../lib/developers";
import { CANONICAL_AREAS, CANONICAL_PROJECTS } from "../content/intelligence/core";

assert.match(INTELLIGENCE_SNAPSHOT, /^\d{4}-\d{2}-\d{2}\./);
assert.ok(CANONICAL_DEVELOPERS.length >= 40, "UAE developer index is unexpectedly narrow");
assert.equal(new Set(CANONICAL_DEVELOPERS.map((item) => item.slug)).size, CANONICAL_DEVELOPERS.length);
assert.equal(new Set(CANONICAL_DEVELOPERS.map((item) => item.officialUrl)).size, CANONICAL_DEVELOPERS.length);
for (const item of CANONICAL_DEVELOPERS) assert.equal(new URL(item.officialUrl).protocol, "https:");
for (const covered of DEVELOPERS) {
  const canonicalSlug = covered.slug === "dubai-holding" ? "dubai-holding-real-estate" : covered.slug;
  assert.ok(CANONICAL_DEVELOPERS.some((entity) => entity.slug === canonicalSlug), `Covered developer ${covered.slug} is missing from the canonical registry`);
}
for (const source of Object.values(REGULATOR_SOURCES)) assert.equal(new URL(source).protocol, "https:");
for (const project of CANONICAL_PROJECTS) {
  assert.ok(CANONICAL_DEVELOPERS.some((developer) => developer.slug === project.developerSlug));
  assert.ok(CANONICAL_AREAS.some((area) => area.slug === project.areaSlug));
  assert.equal(new URL(project.officialSourceUrl).protocol, "https:");
}
console.log(`Intelligence registry ${INTELLIGENCE_SNAPSHOT}: ${CANONICAL_DEVELOPERS.length} developers; ${DEVELOPERS.length} enriched news entities.`);
