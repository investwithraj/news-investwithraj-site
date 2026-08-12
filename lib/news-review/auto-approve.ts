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

import type { NewsDraft } from "./types";

/** Single-source stories always remain in human review. */
export const MIN_WHITELIST_CITATIONS = 2;

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
  figureCount: number;
  /** Figures present in the body but NOT found in cited-source text. */
  amberFigures: string[];
  /** Human-readable reasons a draft was held for manual review (empty = approve). */
  reasons: string[];
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

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

  // 2 · citations — all whitelisted, at least MIN_WHITELIST_CITATIONS of them
  const citationCount = validator.metrics.citationCount;
  const whitelistCount = validator.metrics.citationsFromWhitelist;
  const allCitationsWhitelisted =
    citationCount > 0 && whitelistCount === citationCount;
  if (whitelistCount < MIN_WHITELIST_CITATIONS) {
    reasons.push(
      `only ${whitelistCount} whitelisted citation(s) (need >= ${MIN_WHITELIST_CITATIONS})`,
    );
  }
  if (!allCitationsWhitelisted) {
    reasons.push(
      `${citationCount - whitelistCount} citation(s) not on the verified-source whitelist`,
    );
  }

  // 3 + 4 · every figure must trace to text fetched from the cited URL.
  // provenance.citedText is deliberately ignored because it is model output.
  const citationUrls = new Set(article.citations.map((citation) => citation.url));
  const fetchedEvidence = (provenance.fetchedEvidence ?? []).filter(
    (evidence) =>
      citationUrls.has(evidence.url) && norm(evidence.text).length >= 80,
  );
  const distinctEvidenceUrls = new Set(
    fetchedEvidence.map((evidence) => evidence.url),
  );
  const fetchedEvidenceCount = distinctEvidenceUrls.size;
  if (fetchedEvidenceCount < MIN_WHITELIST_CITATIONS) {
    reasons.push(
      `only ${fetchedEvidenceCount} cited source(s) have independently fetched evidence text (need >= ${MIN_WHITELIST_CITATIONS})`,
    );
  }
  const sourceText = norm(
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
    amberFigures = figures.filter((f) => !sourceText.includes(f));
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
    figureCount: figures.length,
    amberFigures,
    reasons,
  };
}

export interface AutoApproveSummary {
  total: number;
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
  const assessments = activeDrafts.map(assessDraft);
  const approve = assessments.filter((a) => a.verdict === "auto-approve");
  const held = assessments.filter((a) => a.verdict === "manual");
  const publishLimit = Math.max(1, Math.min(10, opts.publishLimit ?? 1));
  const selected = opts.publish ? approve.slice(0, publishLimit) : [];
  const deferred = opts.publish ? Math.max(0, approve.length - selected.length) : 0;

  log(
    `auto-approve: ${activeDrafts.length} active draft(s) · ${approve.length} pass · ${held.length} held · ` +
      `mode ${opts.publish ? `PUBLISH (limit ${publishLimit})` : "REVIEW ONLY"} ` +
      `(>= ${MIN_WHITELIST_CITATIONS} whitelisted cites + fetched evidence)`,
  );
  for (const a of approve) {
    log(`  ok  ${a.slug}  (${a.figureCount} figs · ${a.whitelistCount}/${a.citationCount} cites)`);
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
    approved: approve.length,
    published,
    failed,
    held: held.length,
    deferred,
  };
}
