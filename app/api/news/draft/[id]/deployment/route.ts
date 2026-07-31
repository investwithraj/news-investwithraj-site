// Trusted deployment completion webhook.
//
// A Git commit is not a publication. The draft remains in `committed` until
// the deployment system proves that the exact commit is READY and the
// canonical article responds with the expected article marker.

import { NextRequest } from "next/server";
import {
  completeDraftPublication,
  DraftConflictError,
  getPublicationReceipt,
  getStoredDraft,
} from "@/lib/news-review/storage";
import {
  authorizeServerMutation,
  privateJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESPONSE_BYTES = 1_048_576;
const FETCH_TIMEOUT_MS = 8_000;

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function readBoundedText(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("The canonical response exceeded the verification limit.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("The canonical response exceeded the verification limit.");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = authorizeServerMutation(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return privateJson({ error: "Invalid draft ID." }, 400);
  }
  const parsed = await readJsonBody<{
    claimId?: unknown;
    deploymentStatus?: unknown;
    deployedCommitSha?: unknown;
  }>(req, { maxBytes: 4_096 });
  if (!parsed.ok) return parsed.response;
  const { claimId, deploymentStatus, deployedCommitSha } = parsed.value;
  if (
    typeof claimId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(claimId) ||
    deploymentStatus !== "READY" ||
    typeof deployedCommitSha !== "string" ||
    !/^[a-f0-9]{40}$/i.test(deployedCommitSha)
  ) {
    return privateJson(
      {
        error:
          "claimId, deploymentStatus=READY and a 40-character deployedCommitSha are required.",
      },
      400,
    );
  }

  try {
    const priorReceipt = await getPublicationReceipt(id);
    if (priorReceipt) {
      if (
        priorReceipt.commitSha.toLowerCase() !==
        deployedCommitSha.toLowerCase()
      ) {
        return privateJson(
          { error: "A different deployment already completed this draft." },
          409,
        );
      }
      return privateJson({
        ok: true,
        publicationState: "completed",
        receipt: priorReceipt,
        idempotent: true,
      });
    }
    const draft = await getStoredDraft(id);
    if (!draft) return privateJson({ error: "Draft not found." }, 404);
    const publication = draft.publication;
    if (
      !publication ||
      publication.state !== "committed" ||
      publication.claimId !== claimId ||
      publication.commitSha?.toLowerCase() !== deployedCommitSha.toLowerCase() ||
      !publication.url
    ) {
      return privateJson(
        { error: "Deployment proof does not match the committed publication." },
        409,
      );
    }

    const canonical = new URL(publication.url);
    const expectedOrigin = new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://news.investwithraj.com",
    ).origin;
    if (
      canonical.protocol !== "https:" ||
      canonical.origin !== expectedOrigin ||
      canonical.pathname !== `/news/${draft.article.slug}`
    ) {
      return privateJson({ error: "Stored canonical URL is invalid." }, 409);
    }

    const response = await fetch(canonical, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "text/html" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (
      response.status !== 200 ||
      !contentType.toLowerCase().includes("text/html") ||
      response.url !== canonical.toString()
    ) {
      return privateJson(
        { error: "The canonical article is not live on the verified deployment." },
        409,
      );
    }
    const html = await readBoundedText(response);
    if (
      !html.includes(canonical.toString()) ||
      !html.includes('name="iwr-content-hash"') ||
      !html.includes(draft.contentHash)
    ) {
      return privateJson(
        {
          error:
            "The live page does not contain the exact reviewed content marker.",
        },
        409,
      );
    }

    const completed = await completeDraftPublication(id, claimId);
    return privateJson({
      ok: true,
      publicationState: "completed",
      slug: completed.article.slug,
      url: completed.publication?.url,
      commitSha: completed.publication?.commitSha,
      archived: true,
    });
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    return privateJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Deployment verification failed.",
      },
      502,
    );
  }
}
