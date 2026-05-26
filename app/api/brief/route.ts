// F16 — Personalized AI Brief endpoint.
//
// POST /api/brief { topic: string }
// Returns a 500-word "Beyond the Deal · Generated Insight" branded brief,
// grounded in Raj's published articles via inline context.
//
// Rate limit: 5/hour per IP. Free for guests. Graceful no-op without
// ANTHROPIC_API_KEY.

import { NextRequest, NextResponse } from "next/server";
import { callClaude, isClaudeConfigured } from "@/lib/ai/claude";
import { checkRateLimit, getClientIp } from "@/lib/ai/rate-limit";
import { NEWS_ARTICLES } from "@/content/news";
import { AREAS } from "@/content/areas";
import { DEVELOPERS } from "@/lib/developers";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are "Beyond the Deal" — the editorial voice of Raj Tomar, a DLD-licensed Dubai real-estate broker. You write briefs for UHNW investors. Hard rules:

- 400-600 words.
- Concrete numbers from cited sources only — never invent data.
- Use UK English. Em-dashes — like this — are signature.
- Never use: synergy, unlock value, platform play, 10x, passive income, amazing, guaranteed, "in today's market", "make money", "no-brainer".
- Always use: thesis, mandate, structural, absorption, catalyst, compression, precinct, typology, archetype, trade-killer, IRR, bps, sovereign-backed, escrow.
- Open with a counter-intuitive lead (the read most people get wrong).
- Cite specific developers, areas, and DLD when relevant.
- Close with "How I'd trade it" — explicit action (Buy / Watch / Avoid / Trim / Re-rate).
- Sign-off line: "— Raj Tomar · news.investwithraj.com"

When given a topic, write the brief immediately. No preamble, no "Here's your brief" — just start writing.`;

function buildContextSnapshot(): string {
  // Compact context — 12 most recent news headlines + all areas + all developers.
  const news = NEWS_ARTICLES.slice(0, 12)
    .map((a) => `- ${a.title} (${a.market.join(", ")}, ${a.displayDate}): ${a.tldr.join(" / ")}`)
    .join("\n");
  const areas = AREAS.slice(0, 18)
    .map((a) => `- ${a.name} (${a.emirate}, ${a.kind}): ${a.oneLiner}`)
    .join("\n");
  const devs = DEVELOPERS.map(
    (d) => `- ${d.name} (${d.hq}, ${d.kind}): ${d.tagline}`
  ).join("\n");
  return `## Recent news\n${news || "(none yet — news.investwithraj.com launches today)"}\n\n## Areas Raj covers\n${areas}\n\n## Developers Raj covers\n${devs}`;
}

export async function POST(request: NextRequest) {
  if (!isClaudeConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Personalized briefs are temporarily offline — set ANTHROPIC_API_KEY on Vercel to enable.",
      },
      { status: 503 }
    );
  }

  const ip = getClientIp(request.headers);
  const limit = checkRateLimit(ip, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: `Rate limit hit — try again in ${Math.ceil((limit.resetAt - Date.now()) / 60000)} minutes.`,
        resetAt: limit.resetAt,
      },
      { status: 429 }
    );
  }

  let body: { topic?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length < 4 || topic.length > 500) {
    return NextResponse.json(
      { error: "topic must be 4-500 chars" },
      { status: 400 }
    );
  }

  const context = buildContextSnapshot();

  const result = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Topic: ${topic}\n\n## Available context (grounded in Raj's coverage)\n${context}\n\nWrite the brief now.`,
      },
    ],
    maxTokens: 1800,
    temperature: 0.5,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      topic,
      brief: result.text,
      remaining: limit.remaining,
      resetAt: limit.resetAt,
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "X-RateLimit-Remaining": String(limit.remaining),
        "X-RateLimit-Reset": String(limit.resetAt),
      },
    }
  );
}

export function GET() {
  return NextResponse.json({
    name: "Beyond the Deal · AI Brief generator",
    method: "POST",
    body: { topic: "string (4-500 chars) — what brief should I write?" },
    rateLimit: "5 / hour / IP",
    configured: isClaudeConfigured(),
  });
}
