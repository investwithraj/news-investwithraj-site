// Smoke-test endpoint for Vertex Veo 3 video generation via WIF.
// Veo is async — kicks off a long-running operation, returns operation name.
// Caller polls via ?op=<operationName> until done=true with videoUri.
//
// GET is read-only status. Authenticated POST may run only in an explicitly
// enabled non-production diagnostic environment.

import { NextRequest } from "next/server";
import {
  isVertexConfigured,
  startVideoGeneration,
  pollVideoGeneration,
} from "@/lib/ai/vertex";
import { diagnosticsAllowed } from "@/lib/operations/features";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return publicStatusJson({
    name: "Vertex Veo diagnostic",
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

  if (!isVertexConfigured()) {
    return privateJson({
      ok: false,
      configured: false,
      message: "Vertex AI WIF env vars not set",
    }, 503);
  }

  const parsed = await readJsonBody<{ operation?: unknown }>(request, {
    maxBytes: 8_192,
    allowEmpty: true,
  });
  if (!parsed.ok) return parsed.response;
  const op =
    typeof parsed.value.operation === "string"
      ? parsed.value.operation.trim()
      : "";

  // Poll existing operation
  if (op) {
    const t0 = performance.now();
    const result = await pollVideoGeneration(op);
    const elapsedMs = Math.round(performance.now() - t0);
    return privateJson({
      mode: "poll",
      operation: op,
      result,
      elapsedMs,
    });
  }

  // Start fresh generation
  const t0 = performance.now();
  const result = await startVideoGeneration({
    prompt:
      "Cinematic aerial flyover of Dubai skyline at golden hour, Burj Khalifa and Palm Jumeirah in frame, moody navy and gold color grade, slight film grain, 35mm anamorphic lens look, ultra-high resolution",
    durationSeconds: 4,
    aspectRatio: "16:9",
  });
  const elapsedMs = Math.round(performance.now() - t0);

  return privateJson({
    mode: "start",
    result,
    elapsedMs,
    operationName: result.operationName ?? null,
  });
}
