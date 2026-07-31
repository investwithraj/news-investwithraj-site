// Smoke-test endpoint for Vertex AI WIF setup.
// Verifies the full chain: Vercel OIDC → STS exchange → impersonation
// → Vertex Imagen 4 → image bytes.
//
// GET is read-only status. Authenticated POST is non-production only.
//
// Returns {ok, configured, generationOk, error, imageSize, model, elapsedMs}
// Remove this route after the WIF flow is validated in production.

import { NextRequest } from "next/server";
import { isVertexConfigured, generateImage } from "@/lib/ai/vertex";
import { diagnosticsAllowed } from "@/lib/operations/features";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return publicStatusJson({
    name: "Vertex image diagnostic",
    mutationMethod: "POST",
    available: diagnosticsAllowed() && isVertexConfigured(),
    productionPolicy: "disabled",
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  if (!diagnosticsAllowed()) {
    return privateJson(
      { error: "Diagnostic media generation is disabled." },
      404,
    );
  }

  const configured = isVertexConfigured();
  if (!configured) {
    return privateJson({
      ok: false,
      configured: false,
      message: "Vertex AI WIF env vars not set",
      env: {
        GCP_PROJECT_ID: Boolean(process.env.GCP_PROJECT_ID),
        GCP_PROJECT_NUMBER: Boolean(process.env.GCP_PROJECT_NUMBER),
        GCP_SERVICE_ACCOUNT_EMAIL: Boolean(process.env.GCP_SERVICE_ACCOUNT_EMAIL),
        GCP_WORKLOAD_IDENTITY_POOL_ID: Boolean(process.env.GCP_WORKLOAD_IDENTITY_POOL_ID),
        GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: Boolean(
          process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID
        ),
      },
    }, 503);
  }

  const t0 = performance.now();
  const result = await generateImage({
    prompt:
      "Aerial photography of Dubai Marina at golden hour, cinematic editorial style, ultra-high resolution",
    aspectRatio: "16:9",
  });
  const elapsedMs = Math.round(performance.now() - t0);

  if (!result.ok) {
    return privateJson({
      ok: false,
      configured: true,
      generationOk: false,
      error: result.error,
      elapsedMs,
    }, 502);
  }

  const img = result.images?.[0];
  return privateJson({
    ok: true,
    configured: true,
    generationOk: true,
    model: process.env.VERTEX_IMAGEN_MODEL || "imagen-4.0-fast-generate-001",
    imageMimeType: img?.mimeType,
    imageBytesBase64Length: img?.dataUrl?.length,
    width: img?.width,
    height: img?.height,
    sampleDataUrlPrefix: img?.dataUrl?.slice(0, 80),
    elapsedMs,
  });
}
