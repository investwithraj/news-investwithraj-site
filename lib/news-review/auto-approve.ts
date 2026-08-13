// Deterministic evidence assessor and fail-closed publisher. Only drafts that
// satisfy every conservative source and figure gate can enter auto-publish.
//
// A draft is AUTO-APPROVABLE iff ALL of:
//   1. the 8-gate voice validator passes              (draft.validator.ok)
//   2. it carries >= MIN_WHITELIST_CITATIONS citations, ALL from the
//      verified-source whitelist                       (validator.metrics)
//   3. at least two cited URLs have independently fetched source text
//   4. EVERY figure in the body appears in that fetched source text
//   5. SAFETY GUARD: if the body clearly contains statistics the figure parser
//      did NOT capture, the draft is held (a parser blind spot must never become
//      a silent approval).
// Anything that fails any check → "manual". Deliberately conservative: a figure
// we cannot match is a reason to hold the draft.

import type { DraftArticle, NewsDraft } from "./types";
import {
  findSourceByUrl,
  isOfficialDeveloperUrl,
  type SourceTier,
} from "@/lib/sources/registry";

export const DEFAULT_CORROBORATION_SOURCES = 2;

export type EvidenceLane =
  | "official-update"
  | "fast-news"
  | "research-release"
  | "developer-announcement"
  | "corroborated-analysis";

export interface EvidencePolicy {
  lane: EvidenceLane;
  requiredPublisherCount: 1 | 2;
  reason: string;
}

const ANALYTICAL_CLAIM_RE =
  /\b(?:recommend(?:s|ed|ation)?|should\s+(?:buy|sell|avoid)|buy\s+call|sell\s+call|undervalued|overvalued|outperform|underperform|guaranteed|risk[- ]free|forecast(?:s|ed)?|projected\s+return|will\s+(?:rise|fall|increase|decline)\s+by)\b/i;
const ATTRIBUTION_RE =
  /\b(?:according to|said|says|announced|reported|confirmed|stated|published|disclosed)\b/i;

function evidenceTiers(urls: string[]): SourceTier[] {
  return urls
    .map((url) => findSourceByUrl(url)?.tier)
    .filter((tier): tier is SourceTier => Boolean(tier));
}

/** Choose the lightest defensible evidence rule for the article. The policy is
 * deliberately about claim risk, not a blanket source count. */
export function determineEvidencePolicy(
  article: DraftArticle,
  evidenceUrls: string[],
): EvidencePolicy {
  const body = `${article.title}\n${article.subtitle}\n${article.body}`;
  if (ANALYTICAL_CLAIM_RE.test(body) || article.semaform?.howIdTradeIt) {
    return {
      lane: "corroborated-analysis",
      requiredPublisherCount: 2,
      reason: "investment conclusions and forecasts require corroboration",
    };
  }

  const tiers = evidenceTiers(evidenceUrls);
  if (tiers.includes("government")) {
    return {
      lane: "official-update",
      requiredPublisherCount: 1,
      reason: "one fetched government or regulator source is authoritative for its own update",
    };
  }
  if (tiers.includes("national-press")) {
    return {
      lane: "fast-news",
      requiredPublisherCount: 1,
      reason: "one fetched verified national or international newsroom is sufficient for factual news",
    };
  }
  if (
    tiers.includes("institutional-research") &&
    (article.category === "market-pulse" || article.category === "macro") &&
    ATTRIBUTION_RE.test(body)
  ) {
    return {
      lane: "research-release",
      requiredPublisherCount: 1,
      reason: "one attributed institutional report is sufficient for reporting that report's findings",
    };
  }
  if (
    evidenceUrls.some(isOfficialDeveloperUrl) &&
    (article.category === "launch" || article.category === "developer-corporate") &&
    ATTRIBUTION_RE.test(body)
  ) {
    return {
      lane: "developer-announcement",
      requiredPublisherCount: 1,
      reason: "one attributed first-party developer release is sufficient for its own announcement",
    };
  }
  return {
    lane: "corroborated-analysis",
    requiredPublisherCount: DEFAULT_CORROBORATION_SOURCES,
    reason: "portal, regional or unattributed claims require independent corroboration",
  };
}

export interface AutoApproveAssessment {
  id: string;
  slug: string;
  title: string;
  verdict: "auto-approve" | "manual";
  gatesOk: boolean;
  citationCount: number;
  whitelistCount: number;
  allCitationsWhitelisted: boolean;
  fetchedEvidenceCount: number;
  evidenceLane: EvidenceLane;
  requiredPublisherCount: 1 | 2;
  figureCount: number;
  /** Figures present in the body but NOT found in cited-source text. */
  amberFigures: string[];
  /** Human-readable reasons a draft was held for manual review (empty = approve). */
  reasons: string[];
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Preserve the value and unit while normalising publisher typography such as
 * AED3.5 vs AED 3.5, 8,000 vs 8000, and 30 per cent vs 30%. */
export function normNumericEvidence(value: string): string {
  return norm(value)
    .replace(/\b(?:dhs?|aed)\b/g, "aed")
    .replace(/\b(?:per\s*cent|percent)\b/g, "%")
    .replace(/(?<=\d),(?=\d{3}\b)/g, "")
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-");
}

const CUR = String.raw`(?:AED|USD|US\$|\$|€|£|Dhs|Dh)`;
// A comma only counts as a thousands separator (comma + exactly 3 digits), so a
// year followed by a prose comma ("2026,") is NOT read as a comma-number.
const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
// Units incl. spelled-out forms ("per cent", "per annum") and bare m/k.
const UNIT = String.raw`(?:%|per\s?cent|percent|bps|pp|p\.a\.|per\s+annum|bn|billion|million|trillion|tn|sq\.?\s?ft|sqft|psf)`;

// currency? number range? unit?  — capture groups decide "meaningful".
const FIGURE_RE = new RegExp(
  `(${CUR})?\\s?(${NUM})((?:\\s*[-–]\\s*${NUM})?)\\s*(${UNIT}|[mk](?![a-z]))?`,
  "gi",
);

// A cheap independent detector of "this body has statistics" — used as a guard
// against the figure parser silently missing something (see check 5).
const STAT_SIGNAL_RE = new RegExp(
  `${CUR}\\s?\\d|\\d[\\d,]*(?:\\.\\d+)?\\s*${UNIT}|\\d{1,3}(?:,\\d{3})+`,
  "i",
);

/** Distinct meaningful figures (normalised) found in a body of prose. A bare
 *  integer with no currency / unit / range / comma / decimal (a year, a small
 *  count) is NOT a figure-needing-sourcing and is skipped. */
export function extractFigures(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(FIGURE_RE)) {
    const [full, cur, num, range, unit] = m;
    const meaningful =
      Boolean(cur) ||
      Boolean(unit) ||
      Boolean(range && range.trim()) ||
      num.includes(",") ||
      num.includes(".");
    if (!meaningful) continue;
    // A bare range of two 4-digit years ("2023–2024") is a date span, not a
    // statistic needing a source — skip it.
    if (!cur && !unit && /^(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}$/.test(full.trim())) {
      continue;
    }
    const s = norm(full);
    if (s) out.add(s);
  }
  return [...out];
}

export function bodyHasStatSignal(body: string): boolean {
  return STAT_SIGNAL_RE.test(body);
}

export function findUnsupportedFigures(
  body: string,
  evidenceText: string,
): string[] {
  const source = normNumericEvidence(evidenceText);
  return extractFigures(body).filter(
    (figure) => !source.includes(normNumericEvidence(figure)),
  );
}

export function assessDraft(draft: NewsDraft): AutoApproveAssessment {
  const reasons: string[] = [];
  const { article, validator, provenance } = draft;

  // 1 · the 8 gates
  const gatesOk = validator.ok;
  if (!gatesOk) {
    const blocked = validator.failures
      .filter((f) => f.severity === "block")
      .map((f) => f.name)
      .join(", ");
    reasons.push(`fails gates: ${blocked || "unknown"}`);
  }

  const citationUrls = new Set(article.citations.map((citation) => citation.url));
  const fetchedEvidence = (provenance.fetchedEvidence ?? []).filter(
    (evidence) =>
      citationUrls.has(evidence.url) && norm(evidence.text).length >= 80,
  );
  const policy = determineEvidencePolicy(
    article,
    fetchedEvidence.map((evidence) => evidence.finalUrl ?? evidence.url),
  );

  // 2 · citations — all whitelisted, with the count selected by claim risk
  const citationCount = validator.metrics.citationCount;
  const whitelistCount = validator.metrics.citationsFromWhitelist;
  const allCitationsWhitelisted =
    citationCount > 0 && whitelistCount === citationCount;
  if (whitelistCount < policy.requiredPublisherCount) {
    reasons.push(
      `only ${whitelistCount} whitelisted citation(s) (need >= ${policy.requiredPublisherCount} for ${policy.lane})`,
    );
  }
  if (!allCitationsWhitelisted) {
    reasons.push(
      `${citationCount - whitelistCount} citation(s) not on the verified-source whitelist`,
    );
  }

  // 3 + 4 · every figure must trace to text fetched from the cited URL.
  // provenance.citedText is deliberately ignored because it is model output.
  const distinctEvidenceDomains = new Set(
    fetchedEvidence.map((evidence) => {
      try {
        return new URL(evidence.finalUrl ?? evidence.url).hostname.replace(
          /^www\./,
          "",
        );
      } catch {
        return "";
      }
    }).filter(Boolean),
  );
  const fetchedEvidenceCount = distinctEvidenceDomains.size;
  if (fetchedEvidenceCount < policy.requiredPublisherCount) {
    reasons.push(
      `only ${fetchedEvidenceCount} cited publisher domain(s) have fetched evidence text (need >= ${policy.requiredPublisherCount} for ${policy.lane})`,
    );
  }
  const sourceText = normNumericEvidence(
    fetchedEvidence.map((evidence) => evidence.text).join(" "),
  );
  const figures = extractFigures(article.body);
  let amberFigures: string[];
  if (!sourceText) {
    amberFigures = figures;
    reasons.push(
      "no independently fetched source text on the draft — model citation markup cannot verify figures",
    );
  } else {
    amberFigures = findUnsupportedFigures(article.body, sourceText);
    if (amberFigures.length > 0) {
      reasons.push(
        `${amberFigures.length} unsourced figure(s): ${amberFigures
          .slice(0, 8)
          .join(" · ")}`,
      );
    }
  }

  // 5 · safety guard against a parser blind spot — if the body clearly has
  // statistics but the parser found none, never approve on a vacuous pass.
  if (figures.length === 0 && bodyHasStatSignal(article.body)) {
    reasons.push(
      "body contains statistics the figure parser did not capture — holding for manual safety",
    );
  }

  return {
    id: draft.id,
    slug: article.slug,
    title: article.title,
    verdict: reasons.length === 0 ? "auto-approve" : "manual",
    gatesOk,
    citationCount,
    whitelistCount,
    allCitationsWhitelisted,
    fetchedEvidenceCount,
    evidenceLane: policy.lane,
    requiredPublisherCount: policy.requiredPublisherCount,
    figureCount: figures.length,
    amberFigures,
    reasons,
  };
}

export interface AutoApproveSummary {
  total: number;
  eligible: number;
  approved: number;
  published: number;
  failed: number;
  held: number;
  deferred: number;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Assess The Desk and, when explicitly enabled, publish a bounded batch. */
export async function runAutoApprove(opts: {
  site: string;
  secret: string;
  publish: boolean;
  publishLimit?: number;
  publishOrder?: "newest" | "backlog";
  backlogMinAgeHours?: number;
  backlogMaxAgeDays?: number;
  now?: Date;
  deploymentAttempts?: number;
  log?: (msg: string) => void;
}): Promise<AutoApproveSummary> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const base = opts.site.replace(/\/$/, "");
  const authHeaders = { "x-post-publish-secret": opts.secret };

  const res = await fetch(`${base}/api/news/draft`, {
    headers: authHeaders,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`draft list failed (${res.status})`);
  const { drafts } = (await res.json()) as { drafts: NewsDraft[] };

  const activeDrafts = drafts.filter((draft) => !draft.publication);
  const publishOrder = opts.publishOrder ?? "newest";
  const now = (opts.now ?? new Date()).getTime();
  const backlogMinAgeMs =
    Math.max(0, opts.backlogMinAgeHours ?? 12) * 60 * 60 * 1_000;
  const backlogMaxAgeMs =
    Math.max(1, opts.backlogMaxAgeDays ?? 21) * 24 * 60 * 60 * 1_000;
  const eligibleDrafts = activeDrafts
    .filter((draft) => {
      if (publishOrder !== "backlog") return true;
      const publishedAt = Date.parse(draft.article.publishedAt);
      if (!Number.isFinite(publishedAt)) return false;
      const age = now - publishedAt;
      return age >= backlogMinAgeMs && age <= backlogMaxAgeMs;
    })
    .sort((left, right) => {
      if (publishOrder === "backlog") {
        const scoreDifference = right.provenance.score - left.provenance.score;
        if (scoreDifference !== 0) return scoreDifference;
      }
      return right.article.publishedAt.localeCompare(left.article.publishedAt);
    });
  const assessments = eligibleDrafts.map(assessDraft);
  const approve = assessments.filter((a) => a.verdict === "auto-approve");
  const held = assessments.filter((a) => a.verdict === "manual");
  const publishLimit = Math.max(1, Math.min(10, opts.publishLimit ?? 1));
  const selected = opts.publish ? approve.slice(0, publishLimit) : [];
  const deferred = opts.publish ? Math.max(0, approve.length - selected.length) : 0;

  if (publishOrder === "backlog") {
    log(
      `backlog window: ${eligibleDrafts.length}/${activeDrafts.length} active draft(s) are ${opts.backlogMinAgeHours ?? 12}h-${opts.backlogMaxAgeDays ?? 21}d old`,
    );
  }

  log(
    `auto-approve: ${activeDrafts.length} active draft(s) · ${approve.length} pass · ${held.length} held · ` +
      `mode ${opts.publish ? `PUBLISH (${publishOrder}, limit ${publishLimit})` : "REVIEW ONLY"} ` +
      `(risk-based evidence policy)`,
  );
  for (const a of approve) {
    log(`  ok  ${a.slug}  (${a.evidenceLane} · ${a.figureCount} figs · ${a.whitelistCount}/${a.citationCount} cites)`);
  }
  for (const a of held) log(`  hold ${a.slug} -> ${a.reasons.join("; ")}`);

  let published = 0;
  let failed = 0;
  for (const assessment of selected) {
    const response = await fetch(
      `${base}/api/news/draft/${encodeURIComponent(assessment.id)}/publish`,
      {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: "{}",
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      claimId?: string;
      commitSha?: string;
      idempotent?: boolean;
    };
    if (!response.ok || !payload.commitSha || !payload.claimId) {
      failed += 1;
      log(
        `  fail ${assessment.slug} -> ${payload.error ?? `publish returned ${response.status}`}`,
      );
      continue;
    }
    published += 1;
    log(
      `  live ${assessment.slug} -> commit ${payload.commitSha.slice(0, 8)}${payload.idempotent ? " (idempotent)" : ""}`,
    );

    // Finalise the durable queue receipt only after the canonical page proves
    // that the exact reviewed content is serving. A timeout leaves the commit
    // safely pending for a later verifier; it does not create a second commit.
    const attempts = Math.max(0, Math.min(20, opts.deploymentAttempts ?? 12));
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await wait(15_000);
      const deployed = await fetch(
        `${base}/api/news/draft/${encodeURIComponent(assessment.id)}/deployment`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            claimId: payload.claimId,
            deploymentStatus: "READY",
            deployedCommitSha: payload.commitSha,
          }),
        },
      );
      if (deployed.ok) {
        log(`  verified ${assessment.slug} on the canonical newsroom`);
        break;
      }
      if (attempt === attempts) {
        const detail = (await deployed.json().catch(() => ({}))) as {
          error?: string;
        };
        log(
          `  pending ${assessment.slug} -> ${detail.error ?? "deployment verification timed out"}`,
        );
      }
    }
  }
  return {
    total: activeDrafts.length,
    eligible: eligibleDrafts.length,
    approved: approve.length,
    published,
    failed,
    held: held.length,
    deferred,
  };
}
