import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextRequest } from "next/server";

import {
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES,
  isReleasedNewsroomRemovalPath,
} from "../lib/news-lifecycle";
import { config, proxy } from "../proxy";

const originalCutover = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];

function request(pathname: string, method = "GET") {
  return new NextRequest(`https://news.investwithraj.com${pathname}`, {
    method,
  });
}

async function main() {
  assert.equal(NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length, 6);
  assert.equal(
    new Set(NEWSROOM_RELEASE_REMOVAL_CANDIDATES).size,
    NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length,
  );

  for (const disabledValue of [undefined, "", "0", "true", " 1 "]) {
    const environment = {
      [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: disabledValue,
    };
    for (const pathname of NEWSROOM_RELEASE_REMOVAL_CANDIDATES) {
      assert.equal(isReleasedNewsroomRemovalPath(pathname, environment), false);
    }
  }

  const enabledEnvironment = {
    [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: "1",
  };
  for (const pathname of NEWSROOM_RELEASE_REMOVAL_CANDIDATES) {
    assert.equal(isReleasedNewsroomRemovalPath(pathname, enabledEnvironment), true);
  }
  for (const pathname of [
    "/pulse/extra",
    "/news/not-a-removal-candidate",
    "/news/2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-/extra",
    "/internal/dashboard",
  ]) {
    assert.equal(isReleasedNewsroomRemovalPath(pathname, enabledEnvironment), false);
  }

  delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  for (const pathname of NEWSROOM_RELEASE_REMOVAL_CANDIDATES) {
    const response = await proxy(request(pathname));
    assert.notEqual(response.status, 410, `${pathname} changed while cutover was off.`);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }

  process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
  for (const pathname of NEWSROOM_RELEASE_REMOVAL_CANDIDATES) {
    for (const method of ["GET", "HEAD", "POST"]) {
      const response = await proxy(request(pathname, method));
      assert.equal(response.status, 410, `${method} ${pathname} must be gone.`);
      assert.equal(
        response.headers.get("cache-control"),
        "private, no-store, max-age=0",
      );
      assert.equal(
        response.headers.get("x-robots-tag"),
        "noindex, nofollow, noarchive",
      );
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("location"), null);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.match(response.headers.get("content-type") ?? "", /^text\/plain/iu);
      const body = await response.text();
      if (method === "HEAD") {
        assert.equal(body, "");
      } else {
        assert.equal(body, "Gone\n");
      }
    }
  }

  for (const pathname of NEWSROOM_RELEASE_REMOVAL_CANDIDATES) {
    const response = await proxy(
      request(`${pathname}?utm_source=archive&x=1&x=2`),
    );
    assert.equal(response.status, 410, `${pathname} query variant must be gone.`);
  }

  for (const pathname of [
    "/pulse/extra",
    "/news/not-a-removal-candidate",
    "/news/2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-/extra",
  ]) {
    const response = await proxy(request(pathname));
    assert.notEqual(response.status, 410, `${pathname} must not match by prefix.`);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }

  const internalResponse = await proxy(request("/internal/dashboard"));
  assert.equal(internalResponse.status, 503);
  assert.notEqual(internalResponse.status, 410);

  const proxySource = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
  assert.ok(Array.isArray(config.matcher));
  const publicMatchers = config.matcher
    .filter((matcher) => matcher !== "/internal/:path*")
    .sort();
  assert.deepEqual(
    publicMatchers,
    [...NEWSROOM_RELEASE_REMOVAL_CANDIDATES].sort(),
    "The static Next proxy matcher must equal the six typed removal candidates.",
  );
  assert.ok(!publicMatchers.includes("/wallet"));
  assert.ok(publicMatchers.every((matcher) => !matcher.includes(":")));
  assert.match(proxySource, /isReleasedNewsroomRemovalPath\(pathname\)/u);

  console.log(
    "Newsroom gone responses PASS: six exact cutover-only 410 routes; flag-off, prefix safety, headers, methods and proxy matcher preserved.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (originalCutover === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = originalCutover;
    }
  });
