import type { DraftArticle, NewsDraftProvenance } from "./types";

type FetchedEvidence = NonNullable<NewsDraftProvenance["fetchedEvidence"]>;

export type RepairCitationSelection =
  | { ok: true; citations: DraftArticle["citations"]; evidence: FetchedEvidence }
  | { ok: false; reason: string };

/** Select only an explicit subset of the current draft's already-fetched URLs.
 * This does not approve sources or claims: the caller must rerun every final
 * publication gate against the selected packet. Omission preserves the packet.
 */
export function selectRepairCitations(
  article: DraftArticle,
  evidence: FetchedEvidence,
  raw: unknown,
): RepairCitationSelection {
  if (raw === undefined) {
    return {
      ok: true,
      citations: article.citations.map((citation) => ({ ...citation })),
      evidence: evidence.map((record) => ({ ...record })),
    };
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: "Repair citation selection must be a nonempty array of exact current citation URLs." };
  }

  const selectedUrls = new Set<string>();
  const currentUrls = new Set(article.citations.map((citation) => citation.url));
  const fetchedUrls = new Set(evidence.map((record) => record.url));
  for (const value of raw) {
    if (typeof value !== "string" || value.length === 0) {
      return { ok: false, reason: "Repair citation selection must contain only nonempty exact URL strings." };
    }
    if (selectedUrls.has(value)) {
      return { ok: false, reason: "Repair citation selection must not contain duplicate URLs." };
    }
    if (!currentUrls.has(value)) {
      return { ok: false, reason: "Repair citation selection cannot add or alter a current citation URL." };
    }
    if (!fetchedUrls.has(value)) {
      return { ok: false, reason: "Repair citation selection requires already-fetched evidence for every exact URL." };
    }
    selectedUrls.add(value);
  }

  if (article.reportingBasis !== undefined && !selectedUrls.has(article.reportingBasis.sourceUrl)) {
    return { ok: false, reason: "Repair citation selection must retain the exact reportingBasis sourceUrl." };
  }

  // Model ordering cannot rewrite the server-owned citation/evidence ordering.
  const citations = article.citations
    .filter((citation) => selectedUrls.has(citation.url))
    .map((citation) => ({ ...citation }));
  const citationUrls = [...new Set(citations.map((citation) => citation.url))];
  const selectedEvidence = citationUrls.flatMap((url) => evidence
    .filter((record) => record.url === url)
    .map((record) => ({ ...record })));

  return { ok: true, citations, evidence: selectedEvidence };
}
