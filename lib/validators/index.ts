// Validator orchestrator — Block 15 master gate.
//
// Runs all editorial gates on an auto-drafted (or human-edited) article
// before allowing the commit / publish. Each failure is returned as a
// structured retry-feedback object so the Claude copywriter can re-prompt
// with specific corrections.
//
// Gates (run in order, all must pass):
//   1. Citation gate (≥1 from 20-source whitelist)
//   2. Voice gate (banned/approved lexicon, headline length, body length,
//      paragraph 1 contains number, TL;DR has 3 entries)
//
// Future additions queued in master plan Block 15.2:
//   3. Originality gate (<30% n-gram overlap with cited source body)
//   4. Sentiment gate (no "betting against X" framing)
//   5. Schema gate (NewsArticle JSON-LD valid)
//   6. Hero-image gate (cover image generated successfully)
//   7. SEO meta gate (title/description/OG all set)

import { citationGate, validateCitations, type CitationInput, type CitationResult } from "./citation";
import { runVoiceGates, type VoiceDraftInput, type VoiceResult } from "@/lib/voice/profile";

export interface DraftCheckInput extends VoiceDraftInput {
  citations: CitationInput[];
}

export interface DraftCheckResult {
  /** True only if EVERY gate passes. */
  pass: boolean;
  /** Per-gate result for dashboard surfacing + retry feedback. */
  gates: {
    citation: CitationResult;
    voice: VoiceResult;
  };
  /** Concatenated failure reasons for Claude retry prompt. */
  retryFeedback: string;
}

export function runAllGates(draft: DraftCheckInput): DraftCheckResult {
  const citation = validateCitations(draft.citations);
  const voice = runVoiceGates(draft);

  const pass = citation.pass && voice.pass;

  const feedbackLines: string[] = [];
  if (!citation.pass && citation.reason) {
    feedbackLines.push(`CITATION GATE FAILED: ${citation.reason}`);
  }
  if (!voice.pass) {
    feedbackLines.push("VOICE GATES FAILED:");
    for (const f of voice.failures) {
      feedbackLines.push(`  · [${f.id}] ${f.reason}`);
    }
  }

  return {
    pass,
    gates: { citation, voice },
    retryFeedback: feedbackLines.join("\n"),
  };
}

export { citationGate, validateCitations, runVoiceGates };
export type { CitationInput, CitationResult, VoiceDraftInput, VoiceResult };
