import process from "node:process";

const SITE_URL = process.env.SITE_URL ?? "https://news.investwithraj.com";
const SECRET = process.env.POST_PUBLISH_SECRET ?? "";
const CORRECTION_KEY = process.argv[2] ?? "";
const ATTEMPTS = 20;
const DELAY_MS = 15_000;

function assertConfiguration() {
  const origin = new URL(SITE_URL);
  if (origin.protocol !== "https:" || origin.origin !== SITE_URL) {
    throw new Error("SITE_URL must be one exact HTTPS origin.");
  }
  if (new TextEncoder().encode(SECRET).byteLength < 32) {
    throw new Error("A strong POST_PUBLISH_SECRET is required.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(CORRECTION_KEY)) {
    throw new Error("A valid correction key is required.");
  }
}

async function post<T>(pathname: string, body: unknown): Promise<{
  response: Response;
  value: T & { error?: string };
}> {
  const response = await fetch(`${SITE_URL}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-post-publish-secret": SECRET,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const value = (await response.json()) as T & { error?: string };
  return { response, value };
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  assertConfiguration();
  const staged = await post<{
    ok?: boolean;
    state?: "active" | "completed";
    draftId?: string;
    slug?: string;
    contentHash?: string;
    publication?: { claimId?: string; commitSha?: string; url?: string };
  }>("/api/news/correction", { correctionKey: CORRECTION_KEY });
  if (!staged.response.ok || !staged.value.ok) {
    throw new Error(staged.value.error ?? "Correction staging failed.");
  }
  if (
    !staged.value.draftId ||
    !staged.value.slug ||
    !/^[a-f0-9]{64}$/.test(staged.value.contentHash ?? "")
  ) {
    throw new Error("Correction staging returned an invalid receipt.");
  }

  if (staged.value.state === "completed") {
    console.log(`correction already completed: ${staged.value.slug}`);
    return;
  }

  const published = await post<{
    ok?: boolean;
    claimId?: string;
    commitSha?: string;
    url?: string;
  }>(
    `/api/news/draft/${encodeURIComponent(staged.value.draftId)}/publish`,
    {},
  );
  if (
    !published.response.ok ||
    !published.value.ok ||
    !/^[0-9a-f-]{36}$/i.test(published.value.claimId ?? "") ||
    !/^[a-f0-9]{40}$/i.test(published.value.commitSha ?? "")
  ) {
    throw new Error(published.value.error ?? "Correction publication failed.");
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    await wait(DELAY_MS);
    const deployed = await post<{
      ok?: boolean;
      publicationState?: string;
      error?: string;
    }>(
      `/api/news/draft/${encodeURIComponent(staged.value.draftId)}/deployment`,
      {
        claimId: published.value.claimId,
        deploymentStatus: "READY",
        deployedCommitSha: published.value.commitSha,
      },
    );
    if (deployed.value.publicationState === "completed") {
      console.log(
        `correction live: ${published.value.url ?? `${SITE_URL}/news/${staged.value.slug}`}`,
      );
      if (!deployed.value.ok) {
        console.log(
          "correction is live; downstream search discovery remains pending",
        );
      }
      return;
    }
    if (deployed.response.status !== 409) {
      throw new Error(
        deployed.value.error ?? "Correction deployment verification failed.",
      );
    }
    console.log(`deployment verification pending (${attempt}/${ATTEMPTS})`);
  }
  throw new Error("Correction deployment verification timed out.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Correction failed.");
  process.exitCode = 1;
});
