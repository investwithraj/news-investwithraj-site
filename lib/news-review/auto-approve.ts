// Deterministic auto-approver — encodes the manual "figures checked" gate so a
// draft whose EVERY figure traces to a cited, whitelisted source can publish
// without a human, while anything with an unsourced number stays in The Desk.
//
// A draft is AUTO-APPROVABLE iff ALL of:
//   1. the 8-gate voice validator passes              (draft.validator.ok)
//   2. it carries >= MIN_WHITELIST_CITATIONS citations, ALL from the
//      verified-source whitelist                       (validator.metrics)
//   3. provenance.citedText is non-empty (there IS cited-source text)
//   4. EVERY figure in the body appears verbatim in citedText — zero "amber" /
//      unsourced numbers (the gold/amber split the cockpit shows; citedText is
//      the verbatim text of the <cite> spans the drafter attributed to a source,
//      and the published body is that same prose with the tags stripped, so an
//      exact substring match is sound).
//   5. SAFETY GUARD: if the body clearly contains statistics the figure parser
//      did NOT capture, the draft is held (a parser blind spot must never become
//      a silent approval).
// Anything that fails any check → "manual". Deliberately conservative: a figure
// we cannot match is a reason to NOT auto-publish, never a reason to publish.

import type { NewsDraft } from "./types";

/** Need at least this many whitelisted citations to auto-publish. Raj's call
 *  (Jun 14): 1 verified source qualifies — single-source drafts can auto-publish
 *  as long as that source is whitelisted AND every figure traces to it. */
export const MIN_WHITELIST_CITATIONS = 1;

export interface AutoApproveAssessment {
  id: string;
  slug: string;
  title: string;
  verdict: "auto-approve" | "manual";
  gatesOk: boolean;
  citationCount: number;
  whitelistCount: number;
  allCitationsWhitelisted: boolean;
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

  // 3 + 4 · every figure must trace to cited-source text
  const citedText = norm(provenance.citedText ?? "");
  const figures = extractFigures(article.body);
  let amberFigures: string[];
  if (!citedText) {
    amberFigures = figures;
    reasons.push("no cited-source text on the draft — cannot verify figures");
  } else {
    amberFigures = figures.filter((f) => !citedText.includes(f));
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
}

/** Orchestrator: list The Desk's drafts, assess each, and (when publish=true)
 *  publish the auto-approvable ones via the live /publish route — which itself
 *  re-checks the gates server-side. Used by both the CLI and the cron. */
export async function runAutoApprove(opts: {
  site: string;
  secret: string;
  publish: boolean;
  log?: (msg: string) => void;
}): Promise<AutoApproveSummary> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const base = opts.site.replace(/\/$/, "");
  const q = `secret=${encodeURIComponent(opts.secret)}`;

  const res = await fetch(`${base}/api/news/draft?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`draft list failed (${res.status})`);
  const { drafts } = (await res.json()) as { drafts: NewsDraft[] };

  const assessments = drafts.map(assessDraft);
  const approve = assessments.filter((a) => a.verdict === "auto-approve");
  const held = assessments.filter((a) => a.verdict === "manual");

  log(
    `auto-approve: ${drafts.length} draft(s) · ${approve.length} pass · ${held.length} held · ` +
      `mode ${opts.publish ? "PUBLISH" : "DRY RUN"} (>= ${MIN_WHITELIST_CITATIONS} whitelisted cites)`,
  );
  for (const a of approve) {
    log(`  ok  ${a.slug}  (${a.figureCount} figs · ${a.whitelistCount}/${a.citationCount} cites)`);
  }
  for (const a of held) log(`  hold ${a.slug} -> ${a.reasons.join("; ")}`);

  if (!opts.publish) {
    return { total: drafts.length, approved: approve.length, published: 0, failed: 0, held: held.length };
  }

  let published = 0;
  let failed = 0;
  for (const a of approve) {
    const r = await fetch(`${base}/api/news/draft/${a.id}/publish?${q}`, { method: "POST" });
    if (r.ok) {
      published++;
      const b = (await r.json().catch(() => ({}))) as { url?: string };
      log(`  published ${a.slug}${b.url ? `  -> ${b.url}` : ""}`);
    } else {
      failed++;
      const t = await r.text().catch(() => "");
      log(`  FAILED ${a.slug}: ${r.status} ${t.slice(0, 120)}`);
    }
  }
  return { total: drafts.length, approved: approve.length, published, failed, held: held.length };
}
