// F18 — Multi-language translation endpoint.
// Claude-powered. UHNW buyer-language matrix: AR, HI, ZH, RU, FR.
// POST /api/translate { text, targetLang } → translated text.
// ISR-cached on Vercel when called from server components.

import { NextRequest, NextResponse } from "next/server";
import { callClaude, isClaudeConfigured } from "@/lib/ai/claude";
import { checkRateLimit, getClientIp } from "@/lib/ai/rate-limit";

export const dynamic = "force-dynamic";

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

export async function POST(request: NextRequest) {
  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Translation offline — ANTHROPIC_API_KEY not set." },
      { status: 503 }
    );
  }

  const ip = getClientIp(request.headers);
  const limit = checkRateLimit(ip, { max: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Rate limit hit. Try in 1 hour." },
      { status: 429 }
    );
  }

  let body: { text?: unknown; targetLang?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const targetLang = (typeof body.targetLang === "string" ? body.targetLang : "") as LangCode;
  if (!text || text.length < 1 || text.length > 8000) {
    return NextResponse.json({ error: "text must be 1-8000 chars" }, { status: 400 });
  }
  if (!SUPPORTED_LANGS.includes(targetLang)) {
    return NextResponse.json(
      { error: `targetLang must be one of: ${SUPPORTED_LANGS.join(", ")}` },
      { status: 400 }
    );
  }

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
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    targetLang,
    languageName: LANG_NAME[targetLang],
    translation: result.text,
    remaining: limit.remaining,
    timestamp: new Date().toISOString(),
  });
}

export function GET() {
  return NextResponse.json({
    name: "news.investwithraj.com — translation endpoint",
    method: "POST",
    body: {
      text: "string (1-8000 chars)",
      targetLang: `one of: ${SUPPORTED_LANGS.join(", ")}`,
    },
    rateLimit: "20 / hour / IP",
    configured: isClaudeConfigured(),
  });
}
