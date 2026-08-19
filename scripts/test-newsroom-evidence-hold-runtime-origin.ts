import assert from "node:assert/strict";

import {
  canonicalNewsroomUrl,
  createRuntimeAuditTransport,
  normalisedAuditUrl,
} from "./test-newsroom-evidence-hold-runtime";

const immutableOrigin =
  "https://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app";
const bypass = "newsroom-origin-bound-bypass-41c8";

const canonicalUrls = [
  canonicalNewsroomUrl("/"),
  canonicalNewsroomUrl("/news"),
] as const;
assert.deepEqual(canonicalUrls, [
  "https://news.investwithraj.com",
  "https://news.investwithraj.com/news",
]);
assert.equal(
  new Set(canonicalUrls).size,
  canonicalUrls.length,
  "Root and non-root canonical URLs must remain duplicate-free.",
);

async function main(): Promise<void> {
for (const origin of [
  "http://127.0.0.1:3130",
  "http://localhost:3130",
  "http://[::1]:3130",
  immutableOrigin,
]) {
  assert.equal(normalisedAuditUrl(origin).origin, origin);
}

for (const origin of [
  "https://example.com",
  "https://news-preview.vercel.app",
  "https://news-investwithraj-site-short-office-2271s-projects.vercel.app",
  "https://news-investwithraj-site-abc123xyz-other-team.vercel.app",
  "http://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app",
  `${immutableOrigin}/news`,
  `${immutableOrigin}/?preview=1`,
  `https://user:password@${new URL(immutableOrigin).hostname}`,
]) {
  assert.throws(
    () => normalisedAuditUrl(origin),
    /credentials|origin|query|HTTPS|exact immutable newsroom deployment host/u,
    origin,
  );
}

let credentialReads = 0;
const trappedEnvironment: Record<string, string | undefined> = {};
Object.defineProperty(trappedEnvironment, "NEWSROOM_VERCEL_PROTECTION_BYPASS", {
  enumerable: true,
  get() {
    credentialReads += 1;
    return bypass;
  },
});
assert.throws(
  () =>
    createRuntimeAuditTransport(
      "https://attacker.invalid",
      trappedEnvironment,
    ),
  /exact immutable newsroom deployment host/u,
);
assert.equal(
  credentialReads,
  0,
  "The bypass credential was read before origin validation completed.",
);

const encodedAuditPaths = [
  "/%2e%2e",
  "/.%2e",
  "/%2e.",
  "/news%2fescape",
  "/news%2Fescape",
  "/news%5cescape",
  "/news%00escape",
  "/news%0aescape",
] as const;
for (const encodedPath of encodedAuditPaths) {
  let encodedCredentialReads = 0;
  let encodedFetches = 0;
  const encodedEnvironment: Record<string, string | undefined> = {};
  Object.defineProperty(
    encodedEnvironment,
    "NEWSROOM_VERCEL_PROTECTION_BYPASS",
    {
      enumerable: true,
      get() {
        encodedCredentialReads += 1;
        return bypass;
      },
    },
  );
  assert.throws(
    () =>
      createRuntimeAuditTransport(
        `${immutableOrigin}${encodedPath}`,
        encodedEnvironment,
        async () => {
          encodedFetches += 1;
          return new Response(null, { status: 200 });
        },
      ),
    /must not contain percent-encoded input/u,
    encodedPath,
  );
  assert.equal(
    encodedCredentialReads,
    0,
    `${encodedPath} read the bypass credential before rejection.`,
  );
  assert.equal(
    encodedFetches,
    0,
    `${encodedPath} reached the authenticated fetch.`,
  );
}

const localTransport = createRuntimeAuditTransport(
  "http://127.0.0.1:3130",
  {},
  async () => new Response(null, { status: 200 }),
);
assert.equal(localTransport.authConfigured, false);
assert.equal(localTransport.hosted, false);
assert.throws(
  () =>
    createRuntimeAuditTransport("http://127.0.0.1:3130", {
      NEWSROOM_VERCEL_PROTECTION_BYPASS: bypass,
    }),
  /Local newsroom audits must not configure/u,
);
assert.throws(
  () => createRuntimeAuditTransport(immutableOrigin, {}),
  /Hosted newsroom audits require protected-Preview authentication/u,
);

type FetchCall = Readonly<{
  auth: string | null;
  origin: string;
  pathname: string;
  redirect: RequestRedirect | undefined;
}>;
const calls: FetchCall[] = [];
const responseWithUrl = (url: URL, location?: string): Response => {
  const response = new Response(null, {
    headers: location ? { location } : undefined,
    status: location ? 302 : 200,
  });
  Object.defineProperty(response, "url", { value: url.href });
  return response;
};
const hostedTransport = createRuntimeAuditTransport(
  immutableOrigin,
  { NEWSROOM_VERCEL_PROTECTION_BYPASS: bypass },
  async (input, options) => {
    const url =
      input instanceof URL
        ? input
        : new URL(input instanceof Request ? input.url : input);
    const headers = new Headers(options?.headers);
    calls.push({
      auth: headers.get("x-vercel-protection-bypass"),
      origin: url.origin,
      pathname: url.pathname,
      redirect: options?.redirect,
    });
    return responseWithUrl(url);
  },
);
assert.equal(hostedTransport.authConfigured, true);
assert.equal(hostedTransport.hosted, true);
await hostedTransport.fetch("/sitemap.xml", { redirect: "follow" });
assert.deepEqual(calls, [
  {
    auth: bypass,
    origin: immutableOrigin,
    pathname: "/sitemap.xml",
    redirect: "manual",
  },
]);

for (const escaped of [
  "https://attacker.invalid/sitemap.xml",
  "//attacker.invalid/sitemap.xml",
  "/../sitemap.xml",
  "/news\\escape",
  ...encodedAuditPaths,
]) {
  const callCountBefore: number = calls.length;
  await assert.rejects(
    () => hostedTransport.fetch(escaped),
    /single-root relative|dot segments|Audit pathname|percent-encoded input/u,
    escaped,
  );
  assert.equal(
    calls.length,
    callCountBefore,
    `${escaped} reached the authenticated fetch.`,
  );
}

let redirectCalls = 0;
const manualRedirectTransport = createRuntimeAuditTransport(
  immutableOrigin,
  { NEWSROOM_VERCEL_PROTECTION_BYPASS: bypass },
  async (input, options) => {
    const url =
      input instanceof URL
        ? input
        : new URL(input instanceof Request ? input.url : input);
    redirectCalls += 1;
    assert.equal(options?.redirect, "manual");
    assert.equal(
      new Headers(options?.headers).get("x-vercel-protection-bypass"),
      bypass,
    );
    return responseWithUrl(url, "https://news.investwithraj.com/news");
  },
);
const redirectResponse = await manualRedirectTransport.fetch("/legacy-source");
assert.equal(redirectResponse.status, 302);
assert.equal(redirectCalls, 1, "The protected credential followed a redirect.");

let escapeCalls = 0;
const escapedResponseTransport = createRuntimeAuditTransport(
  immutableOrigin,
  { NEWSROOM_VERCEL_PROTECTION_BYPASS: bypass },
  async (input, options) => {
    const requested =
      input instanceof URL
        ? input
        : new URL(input instanceof Request ? input.url : input);
    escapeCalls += 1;
    assert.equal(requested.origin, immutableOrigin);
    assert.equal(
      new Headers(options?.headers).get("x-vercel-protection-bypass"),
      bypass,
    );
    return responseWithUrl(new URL("https://attacker.invalid/stolen"));
  },
);
await assert.rejects(
  () => escapedResponseTransport.fetch("/sitemap.xml"),
  /response escaped the validated newsroom origin/u,
);
assert.equal(escapeCalls, 1);

const serialized = JSON.stringify(hostedTransport);
assert.equal(serialized.includes(bypass), false);
assert.deepEqual(JSON.parse(serialized), {
  auditUrl: immutableOrigin,
  authConfigured: true,
  hosted: true,
});

console.log(
  "Newsroom runtime origin contract PASS: exact immutable host, auth-after-validation, local no-auth, cross-origin preflight rejection, manual redirects and secret-free transport state.",
);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
