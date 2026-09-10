import assert from "node:assert/strict";
import { fetchProviderWithRetry } from "../lib/ai/provider-retry";

async function simulate(statuses: number[], retryAfter?: string) {
  let calls = 0;
  const waits: number[] = [];
  const result = await fetchProviderWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST", body: JSON.stringify({ messages: [] }),
  }, {
    fetcher: async (_url, init) => {
      assert.equal(init?.method, "POST");
      const status = statuses[Math.min(calls++, statuses.length - 1)];
      return new Response("provider response", { status, headers: retryAfter ? { "retry-after": retryAfter } : {} });
    },
    sleep: async (ms) => { waits.push(ms); },
    now: () => Date.parse("2026-09-10T12:00:00Z"),
  });
  return { calls, waits, status: result.status };
}

async function main() {
  assert.deepEqual(await simulate([500, 200]), { calls: 2, waits: [1000], status: 200 });
  assert.deepEqual(await simulate([529, 503, 200]), { calls: 3, waits: [1000, 2000], status: 200 });
  assert.deepEqual(await simulate([500]), { calls: 3, waits: [1000, 2000], status: 500 });
  assert.deepEqual(await simulate([429, 200], "3"), { calls: 2, waits: [3000], status: 200 });
  assert.deepEqual(await simulate([429], "120"), { calls: 1, waits: [], status: 429 });
  assert.deepEqual(await simulate([503, 200], "Thu, 10 Sep 2026 12:00:04 GMT"), { calls: 2, waits: [4000], status: 200 });
  for (const status of [200, 400, 401, 403, 404, 422]) {
    assert.deepEqual(await simulate([status]), { calls: 1, waits: [], status });
  }
  let networkCalls = 0;
  await assert.rejects(fetchProviderWithRetry("https://api.anthropic.com/v1/messages", {}, {
    fetcher: async () => { networkCalls++; throw new TypeError("fetch failed"); },
  }), /fetch failed/u);
  assert.equal(networkCalls, 1, "Do not retry an ambiguously accepted request");
  console.log("Provider retry tests passed: bounded transient responses, Retry-After, no auth/client/network retries.");
}
void main();
