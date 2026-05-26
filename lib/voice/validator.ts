// Voice Profile validator — programmatic checks every drafted article
// must pass before commit. Mirrors lib/voice/raj-profile.md.
//
// Usage:
//   import { validateDraft } from "@/lib/voice/validator";
//   const result = validateDraft(article);
//   if (!result.ok) console.error(result.failures);
//
// Returns structured failures so the daily pipeline can decide:
//   - all-pass → commit
//   - 1-2 failures → redraft (up to 2× retry)
//   - 3+ failures → drop to manual review

import { SOURCE_WHITELIST } from "@/lib/sources/registry";

/* ─── Lexicons ──────────────────────────────────────────────────────── */

/** Words that MUST NOT appear. Any one = automatic fail. */
export const BANNED_LEXICON = [
  // Buzzword filter
  "synergy",
  "synergies",
  "unlock value",
  "unlock potential",
  "unlock the",
  "platform play",
  "ecosystem play",
  "game-changer",
  "game-changing",
  "10x",
  "passive income",
  "wealth hack",
  "financial freedom",
  // Breathless filter
  "amazing",
  "incredible",
  "insane",
  "epic",
  "revolutionary",
  "you won't believe",
  "the secret to",
  "here's why you should",
  // Marketing-broker filter
  "guaranteed return",
  "risk-free",
  "sure thing",
  "limited time",
  "don't miss out",
  "last chance",
  "exclusive offer",
  "investors are flocking",
  // Throat-clearing
  "in today's market",
  "it's no secret that",
  "let me tell you",
  "i want to share",
] as const;

/** Words/phrases that SHOULD appear — editorial DNA. ≥3 per article. */
export const APPROVED_LEXICON = [
  // Analytical frame
  "thesis",
  "mandate",
  "mandate-fit",
  "structural",
  "absorption",
  "catalyst",
  "compression",
  "precinct",
  "typology",
  "typologies",
  "archetype",
  "trade-killer",
  "cycle position",
  // Quantitative frame
  "bps",
  "basis points",
  "IRR",
  "annualised",
  "sensitivity",
  "bear case",
  "bull case",
  "base case",
  "secondary market",
  "resale liquidity",
  "exit liquidity",
  "equity multiplier",
  "leverage mechanic",
  // Premium / institutional frame
  "sovereign-backed",
  "sovereign-developer",
  "escrow",
  "payment plan",
  "payment ladder",
  "handover",
  // Authority signals (developer + research-house names)
  "DLD",
  "RERA",
  "ADGM",
  "DIFC",
  "Modon",
  "Nakheel",
  "Emaar",
  "Aldar",
  "Damac",
  "Sobha",
  "Meraas",
  "Q Properties",
  "Knight Frank",
  "JLL",
  "CBRE",
  "Savills",
  "Asteco",
  "Bayut",
  "Property Finder",
] as const;

/** Patterns that fail the draft. Regex matched case-insensitive. */
export const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /^\s*(have you ever|do you know|did you know|ever wondered)/i,
    reason: "Opening with a question",
  },
  {
    pattern: /\bwhat do you think\?/i,
    reason: 'Closing with "What do you think?"',
  },
  {
    pattern: /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u,
    reason: "Emoji in body content",
  },
];

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface DraftArticle {
  /** Headline */
  title: string;
  /** Sub-head (optional, but counted for total content if present) */
  subtitle?: string;
  /** Long-form body — paragraphs separated by \n\n */
  body: string;
  /** Citations array */
  citations: Array<{ source: string; url: string; accessedAt?: string }>;
  /** "news" | "insight" | "area" */
  tier: "news" | "insight" | "area";
}

export interface ValidationResult {
  ok: boolean;
  failures: ValidationFailure[];
  metrics: {
    bannedLexiconCount: number;
    approvedLexiconCount: number;
    headlineLength: number;
    wordCount: number;
    emDashCount: number;
    p1HasNumber: boolean;
    citationCount: number;
    citationsFromWhitelist: number;
  };
}

export interface ValidationFailure {
  gate: number;
  name: string;
  detail: string;
  severity: "block" | "warn";
}

/* ─── The gates ─────────────────────────────────────────────────────── */

export function validateDraft(article: DraftArticle): ValidationResult {
  const failures: ValidationFailure[] = [];
  const allText = [article.title, article.subtitle ?? "", article.body]
    .join("\n\n")
    .toLowerCase();
  const bodyLower = article.body.toLowerCase();
  const wordCount = countWords(article.body);

  // Gate 1 — Banned lexicon
  const bannedHits = BANNED_LEXICON.filter((w) => allText.includes(w.toLowerCase()));
  if (bannedHits.length > 0) {
    failures.push({
      gate: 1,
      name: "Banned lexicon",
      detail: `Found banned term(s): ${bannedHits.join(", ")}`,
      severity: "block",
    });
  }

  // Gate 2 — Approved lexicon (≥3)
  const approvedHits = APPROVED_LEXICON.filter((w) =>
    allText.includes(w.toLowerCase())
  );
  if (approvedHits.length < 3) {
    failures.push({
      gate: 2,
      name: "Approved lexicon",
      detail: `Only ${approvedHits.length} approved terms (need ≥3). Hits: ${approvedHits.join(", ") || "none"}`,
      severity: "block",
    });
  }

  // Gate 3 — Headline length (≤90 chars)
  const headlineLength = article.title.length;
  if (headlineLength > 90) {
    failures.push({
      gate: 3,
      name: "Headline length",
      detail: `Headline ${headlineLength} chars (max 90)`,
      severity: "block",
    });
  }

  // Gate 4 — P1 has a number
  const p1 = (article.body.split(/\n\n/)[0] ?? "").trim();
  const p1HasNumber = /\d/.test(p1);
  if (!p1HasNumber) {
    failures.push({
      gate: 4,
      name: "P1 has a number",
      detail: "First paragraph contains no digit. Per voice profile, P1 must lead with a fact + number.",
      severity: "block",
    });
  }

  // Gate 5 — Citations (≥1 from whitelist)
  const whitelistDomains = SOURCE_WHITELIST.map((s) => new URL(s.url).hostname.replace("www.", ""));
  const citationsFromWhitelist = article.citations.filter((c) => {
    try {
      const host = new URL(c.url).hostname.replace("www.", "");
      return whitelistDomains.some(
        (wd) => host === wd || host.endsWith(`.${wd}`)
      );
    } catch {
      return false;
    }
  }).length;
  if (citationsFromWhitelist < 1) {
    failures.push({
      gate: 5,
      name: "Citation whitelist",
      detail: `${citationsFromWhitelist} of ${article.citations.length} citations are from the verified-source whitelist (need ≥1)`,
      severity: "block",
    });
  }

  // Gate 6 — Forbidden patterns
  for (const fp of FORBIDDEN_PATTERNS) {
    if (fp.pattern.test(article.body)) {
      failures.push({
        gate: 6,
        name: "Forbidden pattern",
        detail: fp.reason,
        severity: "block",
      });
    }
  }

  // Gate 7 — Word count
  const wordCountTarget = {
    news: { min: 600, max: 1200 },
    insight: { min: 2500, max: 3500 },
    area: { min: 800, max: 2500 },
  }[article.tier];
  if (wordCount < wordCountTarget.min || wordCount > wordCountTarget.max) {
    failures.push({
      gate: 7,
      name: "Word count",
      detail: `${wordCount} words (target ${wordCountTarget.min}-${wordCountTarget.max} for ${article.tier})`,
      severity: "block",
    });
  }

  // Gate 8 — Em-dash present (signature punctuation)
  const emDashCount = (article.body.match(/—/g) || []).length;
  if (emDashCount < 1) {
    failures.push({
      gate: 8,
      name: "Em-dash signature",
      detail: "No em-dashes in body. Raj's published voice uses them liberally; absence reads off-voice.",
      severity: "warn",
    });
  }

  // Bonus warning — excessive bolding (not in main gates but flag for review)
  const boldCount = (bodyLower.match(/\*\*/g) || []).length / 2;
  if (boldCount > Math.ceil(wordCount / 500)) {
    failures.push({
      gate: 0,
      name: "Bold density",
      detail: `${boldCount} bolded phrases in ${wordCount}-word body (max ~${Math.ceil(wordCount / 500)})`,
      severity: "warn",
    });
  }

  const blockingFailures = failures.filter((f) => f.severity === "block");

  return {
    ok: blockingFailures.length === 0,
    failures,
    metrics: {
      bannedLexiconCount: bannedHits.length,
      approvedLexiconCount: approvedHits.length,
      headlineLength,
      wordCount,
      emDashCount,
      p1HasNumber,
      citationCount: article.citations.length,
      citationsFromWhitelist,
    },
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** Convenience: returns a one-line summary suitable for pipeline logs. */
export function summarizeResult(result: ValidationResult): string {
  const m = result.metrics;
  return [
    result.ok ? "✅ PASS" : "❌ FAIL",
    `words=${m.wordCount}`,
    `headline=${m.headlineLength}c`,
    `approved=${m.approvedLexiconCount}`,
    `banned=${m.bannedLexiconCount}`,
    `cites=${m.citationsFromWhitelist}/${m.citationCount}`,
    `p1#=${m.p1HasNumber}`,
    `em-${m.emDashCount}`,
    result.failures.length > 0 &&
      `[${result.failures.map((f) => f.name).join("·")}]`,
  ]
    .filter(Boolean)
    .join(" ");
}
