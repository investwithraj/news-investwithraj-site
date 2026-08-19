import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";

import {
  ADVISORY_PROTECTION_BYPASS_ENV,
  NEWSROOM_PROTECTION_BYPASS_ENV,
  PROTECTION_BYPASS_HEADER,
  createProtectedPreviewAuth,
} from "./lib/protected-preview-auth.mjs";

const newsSecret = "newsroom-preview-secret-43bdf1";
const advisorySecret = "advisory-preview-secret-7ca920";
const baseOptions = { viewport: { width: 390, height: 844 } };
const disabled = createProtectedPreviewAuth(NEWSROOM_PROTECTION_BYPASS_ENV, {});

assert.equal(disabled.authConfigured, false);
assert.equal(disabled.browserContextOptions(baseOptions), baseOptions);
assert.equal(disabled.fetchOptions(baseOptions), baseOptions);

const environment = {
  [NEWSROOM_PROTECTION_BYPASS_ENV]: newsSecret,
  [ADVISORY_PROTECTION_BYPASS_ENV]: advisorySecret,
};
const newsroom = createProtectedPreviewAuth(
  NEWSROOM_PROTECTION_BYPASS_ENV,
  environment,
);
const advisory = createProtectedPreviewAuth(
  ADVISORY_PROTECTION_BYPASS_ENV,
  environment,
);
const newsOptions = newsroom.browserContextOptions({
  extraHTTPHeaders: {
    "x-existing-contract": "retained",
    "X-Vercel-Protection-Bypass": "superseded",
  },
});
const advisoryOptions = advisory.browserContextOptions();

assert.equal(newsroom.authConfigured, true);
assert.equal(advisory.authConfigured, true);
assert.deepEqual(newsOptions.extraHTTPHeaders, {
  "x-existing-contract": "retained",
  [PROTECTION_BYPASS_HEADER]: newsSecret,
});
assert.equal(advisoryOptions.extraHTTPHeaders[PROTECTION_BYPASS_HEADER], advisorySecret);
assert.notEqual(
  newsOptions.extraHTTPHeaders[PROTECTION_BYPASS_HEADER],
  advisoryOptions.extraHTTPHeaders[PROTECTION_BYPASS_HEADER],
);

const fetchOptions = newsroom.fetchOptions({
  cache: "no-store",
  headers: { "x-existing-contract": "retained" },
});
assert.equal(fetchOptions.cache, "no-store");
assert.equal(fetchOptions.headers.get("x-existing-contract"), "retained");
assert.equal(fetchOptions.headers.get(PROTECTION_BYPASS_HEADER), newsSecret);

for (const auth of [newsroom, advisory]) {
  assert.equal(JSON.stringify(auth), '{"authConfigured":true}');
  assert.equal(inspect(auth).includes(newsSecret), false);
  assert.equal(inspect(auth).includes(advisorySecret), false);
}

for (const environmentName of [
  NEWSROOM_PROTECTION_BYPASS_ENV,
  ADVISORY_PROTECTION_BYPASS_ENV,
]) {
  for (const invalidValue of [
    "",
    "   ",
    " leading",
    "trailing ",
    "line\nbreak",
    "carriage\rreturn",
    "tab\tcharacter",
    "null\u0000character",
    "delete\u007fcharacter",
  ]) {
    assert.throws(
      () => createProtectedPreviewAuth(environmentName, { [environmentName]: invalidValue }),
      (error) => {
        assert.ok(
          [
            `${environmentName} must be a non-empty string`,
            `${environmentName} must not contain surrounding whitespace or control characters`,
          ].includes(error.message),
        );
        return true;
      },
    );
  }
}

assert.throws(
  () => createProtectedPreviewAuth("UNREVIEWED_SECRET", environment),
  /Unknown protected-Preview credential scope/u,
);
assert.throws(
  () =>
    createProtectedPreviewAuth(NEWSROOM_PROTECTION_BYPASS_ENV, {
      [NEWSROOM_PROTECTION_BYPASS_ENV]: 42,
    }),
  /NEWSROOM_VERCEL_PROTECTION_BYPASS must be a non-empty string/u,
);

const targetScripts = [
  "scripts/audit-batch-8.mjs",
  "scripts/audit-batch-9.mjs",
  "scripts/test-newsroom-removal-runtime.mjs",
];
for (const scriptPath of targetScripts) {
  const source = readFileSync(new URL(`../${scriptPath}`, import.meta.url), "utf8");
  assert.match(source, /createProtectedPreviewAuth/u, `${scriptPath} helper import`);
  assert.doesNotMatch(
    source,
    /NEWSROOM_VERCEL_PROTECTION_BYPASS|IWR_VERCEL_PROTECTION_BYPASS/u,
    `${scriptPath} must not read credential values directly`,
  );
  assert.doesNotMatch(
    source,
    /[?&](?:x-vercel-protection-bypass|set-bypass-cookie)=/iu,
    `${scriptPath} must not put credentials in URLs`,
  );
}

const batch8 = readFileSync(new URL("./audit-batch-8.mjs", import.meta.url), "utf8");
assert.match(batch8, /newsroomAuth\.browserContextOptions/u);
assert.match(batch8, /authConfigured:\s*newsroomAuth\.authConfigured/u);

const batch9 = readFileSync(new URL("./audit-batch-9.mjs", import.meta.url), "utf8");
assert.match(batch9, /newsroomAuth\.browserContextOptions/u);
assert.match(batch9, /advisoryAuth\.browserContextOptions/u);
assert.match(
  batch9,
  /await context\.close\(\);[\s\S]*const advisoryContext = await browser\.newContext\(\s*advisoryAuth\.browserContextOptions\(\),\s*\);[\s\S]*advisoryContext\.request\.get\(`\$\{ADVISORY_BASE\}\/media`\)/u,
  "Batch 9 must close the newsroom context before using a separately scoped advisory context",
);
assert.doesNotMatch(
  batch9,
  /\bcontext\.request\.get\(`\$\{ADVISORY_BASE\}/u,
  "The newsroom-authenticated context must never request the advisory origin",
);
assert.match(
  batch9,
  /authConfigured:\s*\{\s*newsroom:\s*newsroomAuth\.authConfigured,\s*advisory:\s*advisoryAuth\.authConfigured/u,
);

const removal = readFileSync(
  new URL("./test-newsroom-removal-runtime.mjs", import.meta.url),
  "utf8",
);
assert.match(removal, /newsroomAuth\.fetchOptions/u);

console.log(
  "Newsroom protected-Preview auth PASS: origin-scoped headers, fail-closed validation, no-env compatibility and complete redaction.",
);
