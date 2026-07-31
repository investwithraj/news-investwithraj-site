// F18 — Multi-language translation endpoint.
// Claude-powered. UHNW buyer-language matrix: AR, HI, ZH, RU, FR.
// POST /api/translate { text, targetLang } → translated text.

import { NextRequest, NextResponse } from "next/server";
import { callClaude, isClaudeConfigured } from "@/lib/ai/claude";
import {
  checkRateLimit,
  getClientIp,
  isFirstPartyMutation,
} from "@/lib/ai/rate-limit";
import { readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const SUPPORTED_LANGS = ["ar", "hi", "zh", "ru", "fr", "de", "es", "ja", "ko"] as const;
type LangCode = (typeof SUPPORTED_LANGS)[number];

const LANG_NAME: Record<LangCode, string> = {
  ar: "Arabic (Modern Standard)",
  hi: "Hindi",
  zh: "Simplified Chinese",
  ru: "Russian",
  fr: "French",
  de: "German",
  es: "Spanish (Castilian)",
  ja: "Japanese",
  ko: "Korean",
};

function unavailable() {
  return NextResponse.json(
    { ok: false, message: "Translation is temporarily unavailable." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isFirstPartyMutation(request)) {
    return NextResponse.json(
      { ok: false, message: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ip = getClientIp(request.headers);
  const hourly = await checkRateLimit(ip, {
    namespace: "translate:hour",
    max: 5,
    windowMs: HOUR_MS,
  });
  if (hourly.reason === "unavailable") return unavailable();
  if (!hourly.allowed) {
    return NextResponse.json(
      { ok: false, message: "Translation limit reached. Try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(
            Math.max(1, Math.ceil((hourly.resetAt - Date.now()) / 1_000)),
          ),
        },
      },
    );
  }

  const daily = await checkRateLimit(ip, {
    namespace: "translate:day",
    max: 20,
    windowMs: DAY_MS,
  });
  if (daily.reason === "unavailable") return unavailable();
  if (!daily.allowed) {
    return NextResponse.json(
      { ok: false, message: "Daily translation limit reached." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(
            Math.max(1, Math.ceil((daily.resetAt - Date.now()) / 1_000)),
          ),
        },
      },
    );
  }

  const parsed = await readJsonBody<{
    text?: unknown;
    targetLang?: unknown;
  }>(request, { maxBytes: 12_288 });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const text = typeof body.text === "string" ? body.text : "";
  const targetLang = (typeof body.targetLang === "string" ? body.targetLang : "") as LangCode;
  if (!text || text.length > 8_000) {
    return NextResponse.json({ error: "text must be 1-8000 chars" }, { status: 400 });
  }
  if (!SUPPORTED_LANGS.includes(targetLang)) {
    return NextResponse.json(
      { error: `targetLang must be one of: ${SUPPORTED_LANGS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!isClaudeConfigured()) return unavailable();

  const result = await callClaude({
    system: `You are a professional translator specializing in UAE real-estate copy. Translate the user's text to ${LANG_NAME[targetLang]}. Preserve:
- Proper nouns (Modon, Emaar, DLD, etc.) — leave in English unless there's a widely-used localized form
- Numeric values + units (AED, sqft, %)
- Markdown structure if present (line breaks, lists)
- Brand voice — measured, institutional, never marketing-y

Output ONLY the translation. No commentary, no "here's the translation", just the translated text.`,
    messages: [{ role: "user", content: text }],
    maxTokens: 4000,
    temperature: 0.2,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "Translation failed." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const remaining = Math.min(hourly.remaining, daily.remaining);
  return NextResponse.json(
    {
      ok: true,
      targetLang,
      languageName: LANG_NAME[targetLang],
      translation: result.text,
      remaining,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(hourly.resetAt),
      },
    },
  );
}

export function GET() {
  return NextResponse.json(
    {
      name: "news.investwithraj.com — translation endpoint",
      method: "POST",
      body: {
        text: "string (1-8000 chars)",
        targetLang: `one of: ${SUPPORTED_LANGS.join(", ")}`,
      },
      rateLimit: "5 / hour and 20 / day",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
