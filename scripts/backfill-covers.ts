// Backfill hero covers for published articles whose cover 404s — sourcing
// returned null at draft time, so heroImage.src kept the placeholder
// /news/<slug>/cover.jpg with no file behind it. Re-sources a rights-clean
// image (Wikimedia + Openverse + Pexels) and writes it to
// public/news/<slug>/cover.jpg, which the article already points at, then
// patches the article's heroImage.credit (still "To be set at review").
//
//   npx tsx scripts/backfill-covers.ts           # report only
//   npx tsx scripts/backfill-covers.ts --write    # download + write covers + credits
//
// No GITHUB_TOKEN needed — writes into the working tree; commit via git.

import { promises as fs } from "node:fs";
import path from "node:path";
import { NEWS_ARTICLES } from "../content/news/index.js";
import { findBestStockImage } from "../lib/stock/providers.js";
import { buildQueryForArticle } from "../lib/stock/query-builder.js";
import type { NewsArticle } from "../content/news/types.js";

const WRITE = process.argv.includes("--write");
const ROOT = process.cwd();
const EXTS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

// Distinct broader landmark queries — when an article's specific subject query
// returns nothing, we source one of THESE live (with the global `used` set
// excluding anything already taken) so every fallback article still gets a
// DISTINCT, real, licensed photo instead of one identical aerial repeated across
// the whole feed. (This + subject-specific queries is the fix for "same image in
// every news".)
const FALLBACK_QUERIES = [
  "Burj Khalifa Downtown Dubai skyline",
  "Dubai Marina skyline aerial",
  "Palm Jumeirah Dubai aerial",
  "Sheikh Zayed Road Dubai towers",
  "Dubai Creek Harbour waterfront",
  "Business Bay Dubai canal towers",
  "Abu Dhabi Corniche skyline aerial",
  "Al Marjan Island Ras Al Khaimah coastline",
];

// Absolute last resort — only if the specific query AND every distinct broader
// query above also return nothing for this article.
const MARKET_FALLBACK: Record<string, string> = {
  Dubai: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Dubai_aerial.jpg",
  "Abu Dhabi": "https://upload.wikimedia.org/wikipedia/commons/d/d3/Dubai_aerial.jpg",
  "Ras Al Khaimah": "https://upload.wikimedia.org/wikipedia/commons/d/d3/Dubai_aerial.jpg",
};

async function coverExists(slug: string): Promise<boolean> {
  for (const ext of EXTS) {
    try {
      await fs.access(path.join(ROOT, "public", "news", slug, `cover.${ext}`));
      return true;
    } catch {
      /* keep checking */
    }
  }
  return false;
}

function sanitizeCredit(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.\s*To view the terms.*/i, "")
    .replace(/"/g, "'")
    .trim()
    .slice(0, 140);
}

/** Patch heroImage.credit in the article .ts (only the placeholder is replaced). */
async function patchCredit(slug: string, credit: string): Promise<boolean> {
  const file = path.join(ROOT, "content", "news", `${slug}.ts`);
  let src: string;
  try {
    src = await fs.readFile(file, "utf-8");
  } catch {
    return false;
  }
  if (!src.includes('"To be set at review"')) return false;
  const next = src.replace('"To be set at review"', `"${sanitizeCredit(credit)}"`);
  if (next === src) return false;
  await fs.writeFile(file, next, "utf-8");
  return true;
}

/** Repoint a legacy REMOTE heroImage.src (a raw http(s) URL) to the now
 *  self-hosted local cover path. Only the heroImage src is touched. */
async function patchHeroSrc(slug: string, localSrc: string): Promise<void> {
  const file = path.join(ROOT, "content", "news", `${slug}.ts`);
  try {
    const src = await fs.readFile(file, "utf-8");
    const next = src.replace(/("src":\s*")https?:\/\/[^"]+(")/, `$1${localSrc}$2`);
    if (next !== src) await fs.writeFile(file, next, "utf-8");
  } catch {
    /* ignore */
  }
}

async function main() {
  const force = process.argv.includes("--force");
  const live = NEWS_ARTICLES.filter((a) => a.status !== "research");
  const broken: NewsArticle[] = [];
  for (const a of live) if (force || !(await coverExists(a.slug))) broken.push(a);

  console.log(`\n${live.length} live articles · ${broken.length} missing a self-hosted cover · mode: ${WRITE ? "WRITE" : "REPORT"}\n`);

  const used = new Set<string>(); // forces a distinct image per article
  let wrote = 0;
  let failed = 0;

  for (const a of broken) {
    const market = (a.market?.[0] as string) || "Dubai";
    let query = `${market} skyline aerial`;
    try {
      query = buildQueryForArticle(a) || query;
    } catch {
      /* keep default */
    }
    let img = await findBestStockImage({
      query,
      orientation: "landscape",
      minWidth: 1200,
      allowSynthetic: false,
      excludeUrls: [...used],
      emirate: market,
    });
    // Specific subject found nothing → source a DISTINCT broader landmark (the
    // `used` set guarantees no two articles share one) before any static aerial.
    if (!img) {
      for (const fq of FALLBACK_QUERIES) {
        const alt = await findBestStockImage({
          query: fq,
          orientation: "landscape",
          minWidth: 1200,
          allowSynthetic: false,
          excludeUrls: [...used],
          emirate: market,
        });
        if (alt) {
          img = alt;
          break;
        }
      }
    }
    if (img) {
      used.add(img.url);
      if (img.attributionUrl) used.add(img.attributionUrl);
    }
    const url = img?.url || MARKET_FALLBACK[market] || MARKET_FALLBACK.Dubai;
    const credit = sanitizeCredit(img?.credit || "Wikimedia Commons");
    const via = img ? `${img.source} ${img.width}px` : "MARKET FALLBACK";
    console.log(`  ${a.slug}\n     ${via} · ${credit}`);

    if (!WRITE) continue;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "InvestWithRajNewsBot/1.0 (https://news.investwithraj.com)",
          Referer: "https://commons.wikimedia.org/",
        },
      });
      const ct = (res.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (res.ok && ct.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 3000) {
          // Write to the EXACT local path the article references (cover.jpg OR
          // cover.webp) so the file always matches heroImage.src — this fixes the
          // .webp articles' 404. If the article still carries a legacy REMOTE url
          // as its src, self-host at the conventional cover.jpg AND repoint local.
          const isLocal = /^\/news\//.test(a.heroImage.src);
          const dest = isLocal
            ? path.join(ROOT, "public", a.heroImage.src.replace(/^\/+/, ""))
            : path.join(ROOT, "public", "news", a.slug, "cover.jpg");
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.writeFile(dest, buf);
          if (!isLocal) await patchHeroSrc(a.slug, `/news/${a.slug}/cover.jpg`);
          const credited = await patchCredit(a.slug, credit);
          wrote++;
          console.log(`     ✓ ${path.basename(dest)} (${Math.round(buf.length / 1024)} KB)${credited ? " + credit" : ""}`);
        } else {
          failed++;
          console.log(`     ✗ too small (${buf.length} bytes)`);
        }
      } else {
        failed++;
        console.log(`     ✗ download failed (${res.status} ${ct})`);
      }
    } catch (e) {
      failed++;
      console.log(`     ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(WRITE ? `\nwrote ${wrote}, failed ${failed}.` : `\nREPORT only — re-run with --write.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
