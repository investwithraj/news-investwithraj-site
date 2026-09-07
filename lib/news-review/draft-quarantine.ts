/**
 * Version-controlled editorial holds for rejected publication slugs.
 *
 * A rejected slug stays held across re-fetches and re-staging. Mutable draft
 * metadata such as the ID, evidence timestamps, and content hash must never be
 * able to turn the same rejected editorial route back into a publishable draft.
 * A corrected article must use a separately reviewed slug.
 */
export interface NewsDraftQuarantineRule {
  id: string;
  scope: "slug";
  slug: string;
  reason: string;
  provenance: {
    reviewedAt: string;
    rejectedDraftId: string;
    rejectedContentHash: string;
  };
}

export interface NewsDraftQuarantineHold {
  ruleId: string;
  scope: NewsDraftQuarantineRule["scope"];
  matchedDraftId: string;
  matchedContentHash?: string;
  slug: string;
  reason: string;
  provenance: NewsDraftQuarantineRule["provenance"];
}

export const NEWS_DRAFT_QUARANTINE = [
  {
    id: "dld-initial-registration-semantic-overreach-2026-09-07",
    scope: "slug",
    slug:
      "2026-09-07-dubai-land-department-launches-unified-registration",
    reason:
      "Permanent editorial hold for this rejected slug: human review found unsupported interpretation and operational claims beyond the cited evidence. Re-fetching or re-staging it must not bypass review; a corrected article requires its separately reviewed slug.",
    provenance: {
      reviewedAt: "2026-09-07",
      rejectedDraftId: "f01d5ea6-56b3-45bd-b48c-d67bb567480c",
      rejectedContentHash:
        "118e1030f017d36619d2d95346722f2ba161e2a42a0a526aa6f660e8872e2dd3",
    },
  },
] as const satisfies readonly NewsDraftQuarantineRule[];

interface NewsDraftQuarantineCandidate {
  id: string;
  contentHash?: string;
  article: {
    slug: string;
  };
}

/** Return the auditable hold for a permanently rejected publication slug. */
export function findNewsDraftQuarantine(
  draft: NewsDraftQuarantineCandidate,
): NewsDraftQuarantineHold | null {
  for (const rule of NEWS_DRAFT_QUARANTINE) {
    if (draft.article.slug !== rule.slug) {
      continue;
    }
    return {
      ruleId: rule.id,
      scope: rule.scope,
      matchedDraftId: draft.id,
      matchedContentHash: draft.contentHash,
      slug: rule.slug,
      reason: rule.reason,
      provenance: rule.provenance,
    };
  }
  return null;
}
