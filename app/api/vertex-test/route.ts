// Smoke-test endpoint for Vertex AI WIF setup.
// Verifies the full chain: Vercel OIDC → STS exchange → impersonation
// → Vertex Imagen 4 → image bytes.
//
// GET /api/vertex-test?secret=<POST_PUBLISH_SECRET>
//
// Returns {ok, configured, generationOk, error, imageSize, model, elapsedMs}
// Remove this route after the WIF flow is validated in production.

import { NextRequest, NextResponse } from "next/server";
import { isVertexConfigured, generateImage } from "@/lib/ai/vertex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function GET(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "POST_PUBLISH_SECRET not set" }, { status: 503 });
  }
  if (request.nextUrl.searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = isVertexConfigured();
  if (!configured) {
    return NextResponse.json({
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
    });
  }

  const t0 = performance.now();
  const result = await generateImage({
    prompt:
      "Aerial photography of Dubai Marina at golden hour, cinematic editorial style, ultra-high resolution",
    aspectRatio: "16:9",
  });
  const elapsedMs = Math.round(performance.now() - t0);

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      configured: true,
      generationOk: false,
      error: result.error,
      elapsedMs,
    });
  }

  const img = result.images?.[0];
  return NextResponse.json({
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
