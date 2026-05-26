// Press email → PressDraft converter.
//
// Cleans up subject lines (strips "FW:", "RE:", "PR-", etc.), extracts dek
// from first paragraphs, scores relevance by tier + tag match.

import type { PressEmail, PressDraft } from "./types";

/** Strip PR-noise prefixes from subject. */
function cleanSubject(subject: string): string {
  return subject
    .replace(/^(RE:|FW:|FWD:|PRESS RELEASE:|FOR IMMEDIATE RELEASE:|PR-|MEDIA RELEASE:)+\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract first 1-2 sentences from body for the dek. */
function extractDek(body: string, maxLen = 280): string {
  // Split into sentences; pick first 2 OR until maxLen
  const sentences = body
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/);
  let out = "";
  for (const s of sentences) {
    if ((out + " " + s).length > maxLen) break;
    out = (out + " " + s).trim();
  }
  return out;
}

/** Score relevance 0-1. */
function scoreRelevance(email: PressEmail): { score: number; rationale: string } {
  const reasons: string[] = [];
  let score = 0;

  // Sender tier weight
  const tierWeight: Record<string, number> = {
    "government": 0.35,
    "developer-tier-1": 0.30,
    "advisor-tier-1": 0.25,
    "advisor-tier-2": 0.15,
    "trade-pub": 0.15,
    "industry-event": 0.10,
    "agency": 0.10,
    "noise": 0,
  };
  score += tierWeight[email.tier] || 0;
  reasons.push(`tier=${email.tier} (+${tierWeight[email.tier] || 0})`);

  // Tag count — caps at 6 tags
  const tagBonus = Math.min(email.tags.length, 6) * 0.05;
  score += tagBonus;
  if (email.tags.length > 0) reasons.push(`${email.tags.length} relevant tags (+${tagBonus.toFixed(2)})`);

  // Body length sanity check (very short or very long = lower confidence)
  const bodyLen = email.textBody.length;
  if (bodyLen > 200 && bodyLen < 6000) {
    score += 0.1;
    reasons.push(`body length sensible (+0.1)`);
  } else if (bodyLen < 100) {
    score -= 0.1;
    reasons.push(`body very short (-0.1)`);
  }

  // Link count
  if (email.links.length >= 1 && email.links.length <= 10) {
    score += 0.05;
    reasons.push(`${email.links.length} citation links (+0.05)`);
  }

  // Attachment hint (press packs = serious)
  if (email.attachments.length > 0) {
    score += 0.05;
    reasons.push(`${email.attachments.length} attachment(s) (+0.05)`);
  }

  score = Math.min(Math.max(score, 0), 1);
  return {
    score,
    rationale: reasons.join("; "),
  };
}

/** Generate slug from subject + receivedAt date. */
function buildSlug(email: PressEmail): string {
  const date = (email.receivedAt || new Date().toISOString()).slice(0, 10);
  const slugBody = cleanSubject(email.subject)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 70);
  return `${date}-press-${slugBody}`;
}

/** Convert PressEmail → PressDraft. */
export function buildDraft(email: PressEmail): PressDraft {
  const candidateHeadline = cleanSubject(email.subject);
  const candidateDek = extractDek(email.textBody);
  const candidateCitations = email.links.map((url) => {
    const domain = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url.slice(0, 40);
      }
    })();
    return { url, source: domain };
  });
  const { score, rationale } = scoreRelevance(email);

  return {
    slug: buildSlug(email),
    source: email,
    candidateHeadline,
    candidateDek,
    candidateCitations,
    relevanceScore: score,
    rationale,
    status: "pending",
    draftedAt: new Date().toISOString(),
  };
}
