// Machine-readable Voice Profile — extracted from raj-profile.md + the
// IWR Notes 01-03 voice + the honesty pass rules from the May 2026 review.
// Every auto-drafted article runs through these gates before commit.
//
// Source: lib/voice/raj-profile.md (full editorial guide)
// Block 15 of ~/.claude/plans/tingly-singing-karp.md

export interface VoiceGate {
  id: string;
  label: string;
  /** Returns null if passes, else the failure reason for retry feedback. */
  check: (draft: VoiceDraftInput) => string | null;
}

export interface VoiceDraftInput {
  title: string;
  subtitle: string;
  body: string;
  tldr: string[];
}

/**
 * Words and phrases that get an auto-drafted article rejected. Extracted from
 * the patterns the honesty pass killed across the May 2026 cleanup. Anything
 * that smells like marketing puffery, fabricated scale, or salesy aspiration.
 *
 * Match is case-insensitive; whole-word boundary; punctuation tolerant.
 */
export const BANNED_LEXICON: string[] = [
  // Aspirational / hype
  "world-class",
  "world class",
  "best-in-class",
  "best in class",
  "game-changer",
  "game changer",
  "game-changing",
  "revolutionary",
  "disrupting",
  "disruptor",
  "cutting-edge",
  "cutting edge",
  "next generation",
  "next-gen",
  "industry-leading",
  "premier destination",
  "iconic landmark",
  "unparalleled",
  "unprecedented",
  "transformative",
  "synergy",
  "leverage", // as a verb in marketing sense; we use it precisely on financials only

  // Honesty-pass specifics killed in v16 Block 9
  "151% ROI",
  "5× leverage",
  "5x leverage",
  "33% structural discount",
  "structural discount to Saadiyat",
  "Bashayer one-day sellout",

  // Fake-credibility theatre
  "anonymous insider",
  "Modon analyst",
  "anonymous Modon analyst",
  "Nakheel insider",
  "anonymous source familiar with",
  "sources familiar with the matter",

  // Negativity (no "bet against X" framing per user)
  "betting against",
  "bet against",
  "shorting",
  "doomed",

  // Generic salesy filler
  "deal of the week",
  "limited-time offer",
  "exclusive opportunity",
  "act now",
  "don't miss out",
  "once in a lifetime",
  "guaranteed returns",
  "risk-free",
  "money-back guarantee",
];

/**
 * Vocabulary that signals the voice is right. We require at least N of these
 * to appear in the body (default N=3) before the draft passes the voice gate.
 *
 * Drawn from Raj's actual writing patterns in IWR Notes 01-03.
 */
export const APPROVED_LEXICON: string[] = [
  "the read",
  "cycle position",
  "structural",
  "absorption",
  "trade-killer",
  "the math says",
  "the trade is",
  "mandate-fit",
  "comparable trade",
  "secondary market",
  "primary launch",
  "off-plan",
  "payment plan",
  "DLD",
  "RERA",
  "escrow",
  "frond",
  "masterplan",
  "supply pipeline",
  "median PSF",
  "yield band",
  "exit assumption",
  "compression",
  "repricing",
  "the spread",
  "track record",
  "verified-source",
  "primary source",
];

export const HEADLINE_MAX_CHARS = 90;
export const BODY_MIN_WORDS = 600;
export const BODY_MAX_WORDS = 1200;

/** Word count utility — ignores punctuation, counts sequences of non-whitespace. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Returns first paragraph (text up to first double newline). */
export function firstParagraph(body: string): string {
  return body.split(/\n\n+/)[0] ?? "";
}

/** Number detection — any digit sequence (with optional commas/decimals/%) */
const NUMBER_RE = /\d[\d,]*(\.\d+)?(?:\s*%|\s*[KkMm]?)?/;

/**
 * The 6 voice gates. Run all of them on every auto-drafted article.
 * If any returns a non-null string, the draft is rejected with that
 * feedback string (passed to Claude on retry).
 */
export const VOICE_GATES: VoiceGate[] = [
  {
    id: "headline-length",
    label: "Headline ≤ 90 chars",
    check: (d) =>
      d.title.length > HEADLINE_MAX_CHARS
        ? `Headline is ${d.title.length} chars; trim to ≤${HEADLINE_MAX_CHARS}.`
        : null,
  },
  {
    id: "para-1-number",
    label: "Paragraph 1 contains a number",
    check: (d) => {
      const p1 = firstParagraph(d.body);
      return NUMBER_RE.test(p1)
        ? null
        : "Paragraph 1 must contain a specific number (volume / pct / count / date / price). Lead with a fact.";
    },
  },
  {
    id: "body-length",
    label: `Body ${BODY_MIN_WORDS}–${BODY_MAX_WORDS} words`,
    check: (d) => {
      const n = wordCount(d.body);
      if (n < BODY_MIN_WORDS) return `Body is ${n} words; expand to ≥${BODY_MIN_WORDS}.`;
      if (n > BODY_MAX_WORDS) return `Body is ${n} words; trim to ≤${BODY_MAX_WORDS}.`;
      return null;
    },
  },
  {
    id: "banned-lexicon",
    label: "0 banned-lexicon words",
    check: (d) => {
      const haystack = `${d.title}\n${d.subtitle}\n${d.body}\n${d.tldr.join("\n")}`.toLowerCase();
      const hits = BANNED_LEXICON.filter((w) =>
        new RegExp(`\\b${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack),
      );
      return hits.length === 0 ? null : `Remove banned terms: ${hits.join(", ")}.`;
    },
  },
  {
    id: "approved-lexicon",
    label: "≥3 approved-lexicon hits",
    check: (d) => {
      const haystack = `${d.title}\n${d.subtitle}\n${d.body}\n${d.tldr.join("\n")}`.toLowerCase();
      const hits = APPROVED_LEXICON.filter((w) =>
        haystack.includes(w.toLowerCase()),
      );
      return hits.length >= 3
        ? null
        : `Voice is too generic — found only ${hits.length} approved-lexicon hits (need ≥3). Use phrases like: "the read", "cycle position", "structural", "trade-killer", "mandate-fit", "compression".`;
    },
  },
  {
    id: "tldr-shape",
    label: "TL;DR has 3 entries",
    check: (d) =>
      d.tldr.length === 3
        ? null
        : `TL;DR must have exactly 3 entries (got ${d.tldr.length}).`,
  },
];

export interface VoiceResult {
  pass: boolean;
  failures: Array<{ id: string; label: string; reason: string }>;
}

export function runVoiceGates(draft: VoiceDraftInput): VoiceResult {
  const failures: VoiceResult["failures"] = [];
  for (const gate of VOICE_GATES) {
    const reason = gate.check(draft);
    if (reason) failures.push({ id: gate.id, label: gate.label, reason });
  }
  return { pass: failures.length === 0, failures };
}
