// Vertex AI client with Workload Identity Federation auth.
//
// Authenticates Vercel functions to Google Cloud via OIDC token exchange —
// no static service-account JSON key. Vercel issues short-lived OIDC tokens,
// GCP trusts them, the WIF pool exchanges them for impersonation credentials
// on the `vercel-news-runtime` service account.
//
// All Imagen 4 + Veo 3 calls go through here so they bill against the $100/mo
// Google AI Ultra Cloud credit on the news-investwithraj project (NOT the
// free-tier Gemini Developer API which paywalls image/video models).
//
// Required env vars (all set by Phase 2 wiring):
//   GCP_PROJECT_ID
//   GCP_PROJECT_NUMBER
//   GCP_SERVICE_ACCOUNT_EMAIL
//   GCP_WORKLOAD_IDENTITY_POOL_ID
//   GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID
//
// Optional overrides:
//   VERTEX_LOCATION   default us-central1
//   VERTEX_IMAGEN_MODEL    default imagen-4.0-fast-generate-001
//   VERTEX_VEO_MODEL  default veo-3.0-generate-001

import { ExternalAccountClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER || "";
const GCP_SERVICE_ACCOUNT_EMAIL = process.env.GCP_SERVICE_ACCOUNT_EMAIL || "";
const GCP_POOL_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID || "";
const GCP_PROVIDER_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID || "";
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const IMAGEN_MODEL =
  process.env.VERTEX_IMAGEN_MODEL || "imagen-4.0-fast-generate-001";
const VEO_MODEL = process.env.VERTEX_VEO_MODEL || "veo-3.0-generate-001";

export function isVertexConfigured(): boolean {
  return Boolean(
    GCP_PROJECT_ID &&
      GCP_PROJECT_NUMBER &&
      GCP_SERVICE_ACCOUNT_EMAIL &&
      GCP_POOL_ID &&
      GCP_PROVIDER_ID
  );
}

let cachedAuthClient: ReturnType<typeof ExternalAccountClient.fromJSON> | null =
  null;

/**
 * Build (and cache) the ExternalAccountClient that authenticates as the
 * vercel-news-runtime service account via Workload Identity Federation.
 */
function getAuthClient(): ReturnType<typeof ExternalAccountClient.fromJSON> {
  if (!isVertexConfigured()) {
    throw new Error(
      "Vertex AI WIF env vars not set (GCP_PROJECT_ID + GCP_PROJECT_NUMBER + GCP_SERVICE_ACCOUNT_EMAIL + GCP_WORKLOAD_IDENTITY_POOL_ID + GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID)"
    );
  }
  if (cachedAuthClient) return cachedAuthClient;

  cachedAuthClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_POOL_ID}/providers/${GCP_PROVIDER_ID}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    subject_token_supplier: {
      // Vercel issues a fresh OIDC token for every function invocation.
      // Wrap to satisfy google-auth-library's ExternalAccountSupplierContext
      // signature — @vercel/oidc's getVercelOidcToken accepts different opts.
      getSubjectToken: async () => getVercelOidcToken(),
    },
  });

  return cachedAuthClient;
}

/** Returns a Bearer access token usable for raw Vertex AI REST calls. */
async function getAccessToken(): Promise<string> {
  const client = getAuthClient();
  if (!client) {
    throw new Error("Failed to initialize ExternalAccountClient");
  }
  const tokenResp = await client.getAccessToken();
  // google-auth-library returns either { token: string } or just string
  // depending on version — accept both.
  if (typeof tokenResp === "string") return tokenResp;
  if (tokenResp && typeof tokenResp === "object" && "token" in tokenResp) {
    const t = (tokenResp as { token: string | null | undefined }).token;
    if (!t) throw new Error("Access token returned null/undefined");
    return t;
  }
  throw new Error("Unexpected access token shape");
}

/* ─── Imagen 4 image generation ─────────────────────────────────────── */

export interface ImagenRequest {
  prompt: string;
  aspectRatio?: "16:9" | "1:1" | "9:16" | "4:3" | "3:4";
  /** 1-4 — number of variations to generate */
  sampleCount?: number;
  /** Negative prompt — what to exclude */
  negativePrompt?: string;
  /** Override the default model (eg "imagen-4.0-ultra-generate-001" for highest quality) */
  model?: string;
}

export interface ImagenResult {
  ok: boolean;
  /** Array of generated images as data URLs */
  images?: Array<{
    dataUrl: string;
    mimeType: string;
    width: number;
    height: number;
  }>;
  error?: string;
}

const IMAGEN_DIMENSIONS: Record<NonNullable<ImagenRequest["aspectRatio"]>, [number, number]> = {
  "16:9": [1408, 768],
  "1:1": [1024, 1024],
  "9:16": [768, 1408],
  "4:3": [1280, 896],
  "3:4": [896, 1280],
};

/** Generate one or more images via Vertex Imagen 4. */
export async function generateImage(req: ImagenRequest): Promise<ImagenResult> {
  if (!isVertexConfigured()) {
    return { ok: false, error: "Vertex AI not configured" };
  }
  try {
    const token = await getAccessToken();
    const model = req.model || IMAGEN_MODEL;
    const aspectRatio = req.aspectRatio || "16:9";
    const [w, h] = IMAGEN_DIMENSIONS[aspectRatio];

    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:predict`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: req.prompt,
            ...(req.negativePrompt && { negativePrompt: req.negativePrompt }),
          },
        ],
        parameters: {
          sampleCount: req.sampleCount || 1,
          aspectRatio,
          // Recommended Vertex Imagen 4 defaults
          personGeneration: "dont_allow",
          safetySetting: "block_only_high",
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Vertex Imagen ${res.status}: ${errText.slice(0, 400)}`,
      };
    }

    const data = (await res.json()) as {
      predictions?: Array<{
        bytesBase64Encoded?: string;
        mimeType?: string;
      }>;
    };

    const preds = data.predictions || [];
    if (preds.length === 0) {
      return { ok: false, error: "No predictions returned" };
    }

    const images = preds
      .filter((p) => p.bytesBase64Encoded)
      .map((p) => ({
        dataUrl: `data:${p.mimeType || "image/png"};base64,${p.bytesBase64Encoded}`,
        mimeType: p.mimeType || "image/png",
        width: w,
        height: h,
      }));

    return { ok: true, images };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown Vertex Imagen error",
    };
  }
}

/* ─── Veo 3 video generation ─────────────────────────────────────────── */

export interface VeoRequest {
  prompt: string;
  durationSeconds?: number; // 4-8
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /** Optional negative prompt */
  negativePrompt?: string;
}

export interface VeoStartResult {
  ok: boolean;
  /** Long-running operation name to poll */
  operationName?: string;
  error?: string;
}

export interface VeoPollResult {
  ok: boolean;
  done?: boolean;
  /** GCS URI when complete */
  videoUri?: string;
  error?: string;
}

/** Kick off a Veo 3 generation. Returns the operation name to poll. */
export async function startVideoGeneration(req: VeoRequest): Promise<VeoStartResult> {
  if (!isVertexConfigured()) {
    return { ok: false, error: "Vertex AI not configured" };
  }
  try {
    const token = await getAccessToken();
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${VERTEX_LOCATION}/publishers/google/models/${VEO_MODEL}:predictLongRunning`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: req.prompt,
            ...(req.negativePrompt && { negativePrompt: req.negativePrompt }),
          },
        ],
        parameters: {
          aspectRatio: req.aspectRatio || "16:9",
          durationSeconds: req.durationSeconds || 4,
          personGeneration: "allow_adult",
          sampleCount: 1,
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Vertex Veo ${res.status}: ${errText.slice(0, 400)}`,
      };
    }

    const data = (await res.json()) as { name?: string };
    if (!data.name) {
      return { ok: false, error: "Operation name missing from Veo response" };
    }
    return { ok: true, operationName: data.name };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown Vertex Veo error",
    };
  }
}

/** Poll a Veo operation. Returns done=true with videoUri once complete. */
export async function pollVideoGeneration(
  operationName: string
): Promise<VeoPollResult> {
  if (!isVertexConfigured()) {
    return { ok: false, error: "Vertex AI not configured" };
  }
  try {
    const token = await getAccessToken();
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/${operationName}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `Veo poll ${res.status}` };
    }
    const data = (await res.json()) as {
      done?: boolean;
      response?: {
        videos?: Array<{ gcsUri?: string; mimeType?: string }>;
      };
      error?: { message?: string };
    };

    if (data.error?.message) {
      return { ok: false, error: data.error.message };
    }
    if (!data.done) {
      return { ok: true, done: false };
    }
    const uri = data.response?.videos?.[0]?.gcsUri;
    if (!uri) {
      return { ok: false, error: "Operation done but no video URI" };
    }
    return { ok: true, done: true, videoUri: uri };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown Veo poll error",
    };
  }
}
