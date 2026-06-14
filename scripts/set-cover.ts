// Set ONE article's hero cover deliberately — for editor-picked, relevant
// images (the manual lever on top of the auto-sourcer). Either search a
// targeted query for a rights-clean photo, or pass a direct image URL you've
// already cleared (e.g. a developer press render).
//
//   npx tsx scripts/set-cover.ts <slug> "Burj Khalifa Downtown Dubai skyline"
//   npx tsx scripts/set-cover.ts <slug> --url "https://.../render.jpg" --credit "Emaar"
//
// Downloads to public/news/<slug>/cover.jpg and rewrites heroImage.src/credit in
// content/news/<slug>.ts. Commit via git. No GITHUB_TOKEN needed.

import { promises as fs } from "node:fs";
import path from "node:path";
import { findBestStockImage } from "../lib/stock/providers.js";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const slug = args[0];
const urlFlag = args.indexOf("--url");
const creditFlag = args.indexOf("--credit");
const directUrl = urlFlag !== -1 ? args[urlFlag + 1] : null;
const directCredit = creditFlag !== -1 ? args[creditFlag + 1] : null;
const query = !directUrl ? args.slice(1).join(" ") : "";

function clean(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/"/g, "'").trim().slice(0, 140);
}

async function main() {
  if (!slug || (!directUrl && !query)) {
    console.error('usage: set-cover.ts <slug> "<query>"  |  <slug> --url <url> [--credit "..."]');
    process.exit(1);
  }

  // Never let the editor-pick tool return the generic auto-sourcer fallbacks.
  const GENERIC_EXCLUDE = [
    "https://upload.wikimedia.org/wikipedia/commons/d/d3/Dubai_aerial.jpg",
  ];
  const excludeIdx = args.indexOf("--exclude");
  const extraExclude = excludeIdx !== -1 ? (args[excludeIdx + 1] || "").split(",").filter(Boolean) : [];

  let url = directUrl;
  let credit = directCredit || "";
  if (!url) {
    const img = await findBestStockImage({
      query,
      orientation: "landscape",
      minWidth: 1600,
      allowSynthetic: false,
      excludeUrls: [...GENERIC_EXCLUDE, ...extraExclude],
    });
    if (!img) {
      console.error(`No rights-clean image found for "${query}".`);
      process.exit(1);
    }
    url = img.url;
    credit = credit || clean(img.credit);
    console.log(`sourced: ${img.source} ${img.width}px · ${credit}\n${url}`);
  } else {
    console.log(`direct url · credit "${credit || "(none)"}"\n${url}`);
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "InvestWithRajNewsBot/1.0 (https://news.investwithraj.com)",
      Referer: "https://commons.wikimedia.org/",
    },
  });
  const ct = (res.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!res.ok || !ct.startsWith("image/")) {
    console.error(`download failed: ${res.status} ${ct}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const dir = path.join(ROOT, "public", "news", slug);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `cover.${ext}`);
  await fs.writeFile(file, buf);
  console.log(`wrote ${file} (${Math.round(buf.length / 1024)} KB)`);

  // rewrite heroImage.src + credit in the article (keep alt)
  const ts = path.join(ROOT, "content", "news", `${slug}.ts`);
  let src = await fs.readFile(ts, "utf-8");
  const heroRe = /("heroImage":\s*\{\s*"src":\s*")[^"]*("\s*,\s*"alt":\s*"[^"]*"\s*,\s*"credit":\s*")[^"]*("\s*\})/;
  if (!heroRe.test(src)) {
    console.error("could not locate heroImage block in the article — left .ts unchanged.");
    process.exit(1);
  }
  src = src.replace(heroRe, `$1/news/${slug}/cover.${ext}$2${credit || "Wikimedia Commons"}$3`);
  await fs.writeFile(ts, src, "utf-8");
  console.log(`patched heroImage → /news/${slug}/cover.${ext} (credit: ${credit || "Wikimedia Commons"})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
