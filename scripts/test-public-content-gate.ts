import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AREAS } from "@/content/areas";
import { DEVELOPERS } from "@/lib/developers";
import {
  PUBLIC_AREA_RECORDS,
  PUBLIC_AREAS,
  PUBLIC_DEVELOPER_RECORDS,
  PUBLIC_DEVELOPERS,
} from "@/lib/public-content";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const publicAreaSlugs = new Set(PUBLIC_AREAS.map((area) => area.slug));
const publicDeveloperSlugs = new Set(
  PUBLIC_DEVELOPERS.map((developer) => developer.slug),
);

assert(PUBLIC_AREAS.length > 0, "No public areas passed the publication gate.");
assert(
  PUBLIC_DEVELOPERS.length > 0,
  "No public developers passed the publication gate.",
);

for (const { area, reports } of PUBLIC_AREA_RECORDS) {
  assert(reports.length > 0, `Public area ${area.slug} has no published report.`);
}

for (const { developer, reports } of PUBLIC_DEVELOPER_RECORDS) {
  assert(
    reports.length > 0,
    `Public developer ${developer.slug} has no published report.`,
  );
}

for (const area of AREAS) {
  const hasReports = PUBLIC_AREA_RECORDS.some(
    (record) => record.area.slug === area.slug && record.reports.length > 0,
  );
  assert(
    publicAreaSlugs.has(area.slug) === hasReports,
    `Area gate drift detected for ${area.slug}.`,
  );
}

for (const developer of DEVELOPERS) {
  const hasReports = PUBLIC_DEVELOPER_RECORDS.some(
    (record) =>
      record.developer.slug === developer.slug && record.reports.length > 0,
  );
  assert(
    publicDeveloperSlugs.has(developer.slug) === hasReports,
    `Developer gate drift detected for ${developer.slug}.`,
  );
}

const publicSurfaceFiles = [
  "app/areas/page.tsx",
  "app/areas/[slug]/page.tsx",
  "app/developers/page.tsx",
  "app/developer/[slug]/page.tsx",
  "app/map/page.tsx",
  "app/terminal/page.tsx",
  "app/news/[slug]/page.tsx",
  "app/v/[slug]/page.tsx",
  "app/sitemap.ts",
  "components/redesign/NewsHome.tsx",
  "components/redesign/NewsChrome.tsx",
  "components/redesign/NewsFooter.tsx",
  "components/terminal/TerminalShell.tsx",
];

const forbiddenVisitorLanguage = [
  /research-index/i,
  /source packs? (?:is|are|remain|being|empty|reviewed)/i,
  /profile-source review/i,
  /internal coverage/i,
  /not current inventory/i,
  /market evidence review pending/i,
  /no verified uhd/i,
  /noindex until/i,
  /awaiting first generation/i,
  /coming soon/i,
];

for (const relativePath of publicSurfaceFiles) {
  const source = readFileSync(resolve(relativePath), "utf8");
  for (const pattern of forbiddenVisitorLanguage) {
    assert(
      !pattern.test(source),
      `${relativePath} contains visitor-facing implementation language: ${pattern}`,
    );
  }
}

const registryConsumers = [
  "app/areas/page.tsx",
  "app/areas/[slug]/page.tsx",
  "app/developers/page.tsx",
  "app/developer/[slug]/page.tsx",
  "app/map/page.tsx",
  "app/terminal/page.tsx",
  "app/news/[slug]/page.tsx",
  "app/v/[slug]/page.tsx",
  "app/sitemap.ts",
];

for (const relativePath of registryConsumers) {
  const source = readFileSync(resolve(relativePath), "utf8");
  assert(
    !/import\s*\{[^}]*\bAREAS\b[^}]*\}\s*from\s*["']@\/content\/areas["']/.test(
      source,
    ),
    `${relativePath} bypasses the public area gate.`,
  );
  assert(
    !/import\s*\{[^}]*\bDEVELOPERS\b[^}]*\}\s*from\s*["']@\/lib\/developers["']/.test(
      source,
    ),
    `${relativePath} bypasses the public developer gate.`,
  );
}

const navigationSource = [
  "components/redesign/NewsHome.tsx",
  "components/redesign/NewsChrome.tsx",
  "components/redesign/NewsFooter.tsx",
]
  .map((relativePath) => readFileSync(resolve(relativePath), "utf8"))
  .join("\n");

for (const unfinishedRoute of [
  "/closing-bell",
  "/power-list/2026",
  "/wallet",
]) {
  assert(
    !navigationSource.includes(`href: "${unfinishedRoute}"`) &&
      !navigationSource.includes(`href="${unfinishedRoute}"`),
    `Global navigation exposes unfinished route ${unfinishedRoute}.`,
  );
}

console.log(
  `Public-content gate passed: ${PUBLIC_AREAS.length}/${AREAS.length} areas and ${PUBLIC_DEVELOPERS.length}/${DEVELOPERS.length} developers are publishable.`,
);
