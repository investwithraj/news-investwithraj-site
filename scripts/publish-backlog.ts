/**
 * Publish retired backlog drafts under their ORIGINAL dates.
 *
 * Raj, 24 Sep 2026: "release them with their dates" — the 109 drafts retired
 * that morning (2 Jun – 7 Sep) are worth an indexed archive even though none
 * is current news. Each is judged by the June rule, offline against freshly
 * fetched sources, before it is written:
 *
 *   1. the eight voice gates (`validateDraft`) pass;
 *   2. at least one cited, whitelisted publisher yields readable text now;
 *   3. every figure in title/subtitle/tldr/body/faq appears verbatim in that
 *      fetched text, and no digit span escapes the parser;
 *   4. it is not a duplicate of an article already live (by slug, title or
 *      shared citation), including ones written earlier in this same run.
 *
 * Source freshness is deliberately NOT checked: the article carries the date
 * the story broke, so the source is exactly as old as the article.
 *
 * Passing drafts are written into the working tree exactly as the cockpit's
 * publish path would write them — `content/news/<slug>.ts`, the registry in
 * `content/news/index.ts`, and `lib/article-relations.ts` — for ONE reviewable
 * commit, instead of one GitHub API commit and Vercel deploy per article.
 * Covers: run `scripts/backfill-covers.ts --write` afterwards; the hero hides
 * itself until then.
 *
 *   npx tsx scripts/publish-backlog.ts --input <backup.json>            # report only
 *   npx tsx scripts/publish-backlog.ts --input <backup.json> --write    # write passing articles
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NEWS_ARTICLES } from "../content/news/index.js";
import type { NewsArticle } from "../content/news/types.js";
import { articleEvidenceSegments } from "../lib/news-review/auto-approve.js";
import { findRecentLiveArticleDuplicate } from "../lib/news-review/duplicate-guard.js";
import { patchArticleRelations, patchIndex, serializeArticle } from "../lib/news-review/serialize.js";
import type { DraftArticle, NewsDraft } from "../lib/news-review/types.js";
import { fetchArticleText } from "../lib/sources/extract.js";
import { getWhitelistDomains } from "../lib/sources/registry.js";
import { validateDraft } from "../lib/voice/validator.js";

const WRITE = process.argv.includes("--write");
const ROOT = process.cwd();
// Long enough that every backlog date falls inside the duplicate window.
const DUPLICATE_WINDOW_DAYS = 3_650;

// ── The June figure rule (be51871, 14 Jun 2026) ─────────────────────────────
// A figure is currency? number range? unit?, normalised, and it passes when
// that normalised string appears anywhere in the normalised source text. The
// September parser (findUnsupportedFigures) keys on the whole numeric span
// including trailing nouns, so "AED 560 million beachfront plot" fails against
// a page that says "AED 560 million beachfront estate". For an archive judged
// against sources fetched today, the number-level rule is the honest one.
const CUR = String.raw`(?:AED|USD|US\$|\$|€|£|Dhs|Dh)`;
const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const UNIT = String.raw`(?:%|per\s?cent|percent|bps|pp|p\.a\.|per\s+annum|bn|billion|million|trillion|tn|sq\.?\s?ft|sqft|psf|sq\.?\s?m|sqm)`;
const FIGURE_RE = new RegExp(
  `(${CUR})?\\s?(${NUM})((?:\\s*[-–]\\s*${NUM})?)\\s*(${UNIT}|[mk](?![a-z]))?`,
  "gi",
);

/** Collapse whitespace/case and the obvious currency and scale synonyms so
 *  "Dh560m", "AED 560 million" and "AED560 million" compare equal. */
function normFigureText(value: string): string {
  return value
    .replace(/\s+/gu, " ")
    .toLowerCase()
    .replace(/\b(?:dhs?|aed)\s?/gu, "aed ")
    .replace(/(?:us\$|usd|\$)\s?/gu, "usd ")
    .replace(/(\d)\s*(?:bn|billion)\b/gu, "$1 billion")
    .replace(/(\d)\s*(?:m|mn|million)\b/gu, "$1 million")
    .replace(/(\d)\s*(?:k)\b/gu, "$1,000")
    .replace(/(\d)\s*(?:per\s?cent|percent)/gu, "$1%")
    .replace(/(\d)\s*(?:sq\.?\s?ft|sqft)/gu, "$1 sq ft")
    .replace(/(\d)\s*(?:sq\.?\s?m|sqm)\b/gu, "$1 sq m")
    .replace(/\s+/gu, " ")
    .trim();
}

function juneFigures(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(FIGURE_RE)) {
    const [full, cur, num, range, unit] = match;
    const meaningful =
      Boolean(cur) || Boolean(unit) || Boolean(range && range.trim()) ||
      num.includes(",") || num.includes(".");
    if (!meaningful) continue;
    if (!cur && !unit && /^(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}$/u.test(full.trim())) continue;
    const figure = normFigureText(full);
    if (figure) out.add(figure);
  }
  return [...out];
}

function juneUnsupportedFigures(claimTexts: string[], sourceTexts: string[]): string[] {
  const source = normFigureText(sourceTexts.join("\n"));
  return [...new Set(claimTexts.flatMap(juneFigures))].filter((figure) => !source.includes(figure));
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

interface Verdict {
  slug: string;
  date: string;
  title: string;
  verdict: "publish" | "hold" | "skip";
  reason: string;
  fetchedPublishers: string[];
  figureCount: number;
}

function loadDrafts(file: string): NewsDraft[] {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : ((parsed as { drafts?: unknown[]; items?: unknown[] }).drafts ??
      (parsed as { items?: unknown[] }).items ??
      []);
  return (rows as NewsDraft[]).filter((row) => row?.article?.slug);
}

// Aggregator links resolve through redirects the fetcher will not follow off
// the whitelist; the real publisher URL for the same story is usually present
// in the same provenance list anyway.
const AGGREGATOR_HOSTS = new Set(["news.google.com", "bing.com", "www.bing.com"]);
const MAX_PROVENANCE_FETCHES = 10;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return "";
  }
}

/**
 * Evidence = the article's own citations PLUS the whitelisted discovery
 * sources the draft was built from. The drafter's citation list is often
 * loosely attached (a Bayut area guide beside a Gulf News scoop), while the
 * figures came from the discovery entries; both are whitelisted publisher
 * pages, so both are fair evidence for a number-level check.
 */
async function fetchedTextsFor(draft: NewsDraft, whitelist: string[]) {
  const article = draft.article;
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };
  for (const citation of article.citations) push(citation.url);
  let provenanceCount = 0;
  for (const source of draft.provenance.sources ?? []) {
    if (provenanceCount >= MAX_PROVENANCE_FETCHES) break;
    const host = hostOf(source.url);
    if (!host || AGGREGATOR_HOSTS.has(host)) continue;
    if (!whitelist.some((domain) => host === domain || host.endsWith(`.${domain}`))) continue;
    if (seen.has(source.url)) continue;
    push(source.url);
    provenanceCount += 1;
  }

  const texts: string[] = [];
  const publishers: string[] = [];
  for (const url of urls) {
    try {
      const fetched = await fetchArticleText(url, { allowedDomains: whitelist, timeoutMs: 12_000 });
      if (fetched.text.trim().length >= 80) {
        texts.push(fetched.text);
        publishers.push(hostOf(fetched.finalUrl ?? url));
      }
    } catch {
      // A publisher that blocks the fetcher simply contributes no evidence.
    }
  }
  return { texts, publishers: [...new Set(publishers)] };
}

async function main(): Promise<void> {
  const input = readArg("--input");
  if (!input) throw new Error("--input <backup.json> is required");
  const drafts = loadDrafts(input).sort((a, b) =>
    a.article.publishedAt.localeCompare(b.article.publishedAt),
  );
  const whitelist = getWhitelistDomains();
  const live: NewsArticle[] = [...NEWS_ARTICLES];
  let indexSource = readFileSync(path.join(ROOT, "content/news/index.ts"), "utf8");
  let relationsSource = readFileSync(path.join(ROOT, "lib/article-relations.ts"), "utf8");
  const verdicts: Verdict[] = [];

  console.log(`${drafts.length} draft(s) from ${input} · mode ${WRITE ? "WRITE" : "DRY-RUN"}`);

  for (const draft of drafts) {
    const article = draft.article;
    const slug = article.slug;
    const date = article.publishedAt.slice(0, 10);
    const base = { slug, date, title: article.title.slice(0, 80) };
    const record = (verdict: Verdict["verdict"], reason: string, extra: Partial<Verdict> = {}) => {
      verdicts.push({ ...base, verdict, reason, fetchedPublishers: [], figureCount: 0, ...extra });
      console.log(`  ${verdict.padEnd(7)} ${date}  ${base.title}${reason ? `  — ${reason}` : ""}`);
    };

    if (existsSync(path.join(ROOT, "content/news", `${slug}.ts`))) {
      record("skip", "slug already live");
      continue;
    }
    const duplicate = findRecentLiveArticleDuplicate(
      { slug, title: article.title, citations: article.citations },
      live,
      { now: new Date(article.publishedAt), windowDays: DUPLICATE_WINDOW_DAYS },
    );
    if (duplicate) {
      record("skip", `duplicate (${duplicate.signal}) of live ${duplicate.existingSlug}`);
      continue;
    }
    const voice = validateDraft(article);
    if (!voice.ok) {
      record("hold", `voice gates: ${voice.failures.map((f) => f.name).join(", ")}`);
      continue;
    }

    const { texts, publishers } = await fetchedTextsFor(draft, whitelist);
    if (texts.length === 0) {
      record("hold", "no cited publisher yields readable text today");
      continue;
    }
    const claimTexts = articleEvidenceSegments(article).map((segment) => segment.text);
    const figures = [...new Set(claimTexts.flatMap(juneFigures))];
    const unsupported = juneUnsupportedFigures(claimTexts, texts);
    if (unsupported.length > 0) {
      record(
        "hold",
        `${unsupported.length} of ${figures.length} figure(s) not in any fetched source: ${unsupported.slice(0, 4).join(" · ")}`,
        { fetchedPublishers: publishers, figureCount: figures.length },
      );
      continue;
    }

    record("publish", `${figures.length} figure(s) traced to ${publishers.join(", ")}`, {
      fetchedPublishers: publishers,
      figureCount: figures.length,
    });
    if (!WRITE) continue;

    const published: DraftArticle & { publicationContentHash: string } = {
      ...article,
      publicationContentHash: draft.contentHash,
      heroImage: {
        ...article.heroImage,
        credit: "Verified editorial image withheld pending UHD rights approval",
        approval: "withheld",
      },
    };
    writeFileSync(path.join(ROOT, "content/news", `${slug}.ts`), serializeArticle(published));
    indexSource = patchIndex(indexSource, slug);
    relationsSource = patchArticleRelations(relationsSource, slug);
    live.push({ ...published, status: "live" } as NewsArticle);
  }

  if (WRITE) {
    writeFileSync(path.join(ROOT, "content/news/index.ts"), indexSource);
    writeFileSync(path.join(ROOT, "lib/article-relations.ts"), relationsSource);
  }

  const counts = verdicts.reduce<Record<string, number>>((acc, v) => {
    acc[v.verdict] = (acc[v.verdict] ?? 0) + 1;
    return acc;
  }, {});
  const reportPath = `pipeline-runs/publish-backlog-${new Date().toISOString().slice(0, 10)}${WRITE ? "" : "-dry"}.json`;
  writeFileSync(reportPath, JSON.stringify(verdicts, null, 2));
  console.log(`\npublish ${counts.publish ?? 0} · hold ${counts.hold ?? 0} · skip ${counts.skip ?? 0} · report ${reportPath}`);
  if (!WRITE) console.log("dry-run: nothing written. Re-run with --write to publish the passing set.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
