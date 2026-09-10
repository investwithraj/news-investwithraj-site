import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";

import { NEWS_ARTICLES } from "../content/news";
import type { NewsArticle } from "../content/news/types";
import { decisionCta, relatedVerticalsForArticle } from "../lib/news-editorial";
import { resolveArticleRelations, type ResolvedArticleArea, type ResolvedArticleDeveloper } from "../lib/article-relations";
import { VERTICALS, type Vertical } from "../lib/verticals";
import { getCuratedNewsCandidate } from "../lib/news-review/curated-candidates";
import { PRESTIGE_ONE_CONTEXT_MEDIA as media } from "../lib/news-review/curated-media-context";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentPath = path.join(root, "components/redesign/NewsArticle.tsx");
const cssPath = path.join(root, "components/redesign/NewsArticle.module.css");
const css = readFileSync(cssPath, "utf8");
const classNames = [...new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/gu)].map((match) => match[1]))];
const classes = Object.fromEntries(classNames.map((name) => [name, `qaNewsArticle__${name}`]));
const className = (name: string) => classes[name];

type ArticleProps = {
  article: NewsArticle;
  newer: NewsArticle | null;
  older: NewsArticle | null;
  relatedAreas: readonly ResolvedArticleArea[];
  relatedDevelopers: readonly ResolvedArticleDeveloper[];
  relatedVerticals: Vertical[];
};

function escaped(text: string): string {
  return renderToStaticMarkup(createElement("span", null, text)).replace(/^<span>|<\/span>$/gu, "");
}

function occurrences(html: string, text: string): number {
  return html.split(text).length - 1;
}

async function main() {
  // Compile the real component in memory; tsx loads its actual dependencies.
  // Only the CSS-module import needs a deterministic map outside a Next build.
  const compiled = await transform(readFileSync(componentPath, "utf8"), {
    loader: "tsx",
    sourcefile: componentPath,
    format: "cjs",
    jsx: "automatic",
  });
  const moduleRecord: { exports: { default?: ComponentType<ArticleProps> } } = { exports: {} };
  const localRequire = createRequire(import.meta.url);
  const componentRequire = (specifier: string) => {
    if (specifier === "./NewsArticle.module.css") return classes;
    return localRequire(specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : specifier);
  };
  const execute = new Function("require", "module", "exports", compiled.code);
  execute(componentRequire, moduleRecord, moduleRecord.exports);
  const Article = moduleRecord.exports.default;
  assert.ok(Article, "actual NewsArticle component was not loaded");

  const candidate = getCuratedNewsCandidate(media.candidateKey);
  const shortArticle: NewsArticle = {
    ...candidate.article,
    heroImage: {
      ...candidate.article.heroImage,
      sourceUrl: media.sourceUrl,
      rightsStatus: media.rightsStatus,
      credit: media.credit,
      width: media.width,
      height: media.height,
      approval: "approved-editorial",
    },
  };
  assert.equal(shortArticle.format, "short-update");
  const longArticle = NEWS_ARTICLES.find((article) =>
    article.format !== "short-update" && article.status !== "research" && article.body.length > 2_000);
  assert.ok(longArticle, "an actual long-form article is required for the comparison");

  function render(article: NewsArticle, overrides: Partial<Omit<ArticleProps, "article">> = {}) {
    return renderToStaticMarkup(createElement(Article!, {
      article, newer: null, older: null, relatedAreas: [], relatedDevelopers: [],
      relatedVerticals: relatedVerticalsForArticle(article, VERTICALS).slice(0, 3),
      ...overrides,
    }));
  }
  const broadVerticals = relatedVerticalsForArticle(shortArticle, VERTICALS).slice(0, 3);
  assert.deepEqual(broadVerticals.map((vertical) => vertical.slug),
    ["off-plan-watch", "uhnw-trades", "sovereign-plays"],
    "short fixture must cover the three broad links supplied by the actual route");
  const shortHtml = render(shortArticle);
  const longHtml = render(longArticle);
  assert.equal(shortHtml.includes('data-news-layer="context"'), false,
    "a short update with only broad desks must not render an empty context section");
  assert.equal(shortHtml.includes("Follow the subject."), false);
  const longWithBroadDesks = render(longArticle, { relatedVerticals: broadVerticals });
  assert.ok(longWithBroadDesks.includes("Follow the subject."));
  for (const vertical of broadVerticals) {
    assert.equal(shortHtml.includes(`href="/news?desk=${vertical.slug}"`), false);
    assert.ok(longWithBroadDesks.includes(`href="/news?desk=${vertical.slug}"`));
  }
  // Actual existing relations are a component fixture only, not a new claim
  // that these entities belong to the Prestige One publication.
  const explicit = resolveArticleRelations("2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island");
  assert.ok(explicit.areas.length && explicit.developers.length);
  for (const overrides of [
    { relatedAreas: explicit.areas }, { relatedDevelopers: explicit.developers },
  ]) {
    const explicitHtml = render(shortArticle, overrides);
    assert.ok(explicitHtml.includes('data-news-layer="context"'));
    assert.ok(explicitHtml.includes("Follow the subject."));
    assert.equal(explicitHtml.includes("Related desks"), false);
    const link = "relatedAreas" in overrides
      ? explicit.areas[0].advisoryLinks[0]
      : explicit.developers[0].advisoryLink;
    assert.ok(explicitHtml.includes(`href="${escaped(link.href)}"`));
  }
  const withMore = render(shortArticle, { older: longArticle });
  assert.ok(withMore.includes(`href="/news/${longArticle.slug}"`));
  assert.equal(occurrences(shortHtml, "<h1>"), 1);
  assert.equal(occurrences(longHtml, "<h1>"), 1);
  assert.ok(shortHtml.includes(className("shortUpdate")));
  assert.equal(longHtml.includes(className("shortUpdate")), false);
  for (const marker of ["article-tldr", 'data-news-layer="signal"', className("consequence"), className("sourceRail")]) {
    assert.equal(shortHtml.includes(marker), false, `short update retained repeated section ${marker}`);
    assert.ok(longHtml.includes(marker), `long report lost section ${marker}`);
  }
  for (const paragraph of shortArticle.body.split(/\n\n+/u).filter(Boolean)) {
    assert.equal(occurrences(shortHtml, `<p>${escaped(paragraph)}</p>`), 1,
      "each actual story paragraph must be rendered exactly once");
  }
  assert.equal(occurrences(shortHtml, 'data-news-layer="evidence"'), 1);
  assert.ok(shortHtml.includes("Read the source."));
  assert.ok(longHtml.includes("Sources &amp; provenance."));
  for (const citation of shortArticle.citations) {
    assert.equal(occurrences(shortHtml, `href="${escaped(citation.url)}"`), 1);
  }
  assert.ok(shortHtml.includes(`alt="${escaped(media.alt)}"`));
  assert.ok(shortHtml.includes(escaped(media.credit)));
  assert.equal(shortHtml.includes(className("heroFallback")), false);
  assert.ok(shortHtml.includes(encodeURIComponent(shortArticle.heroImage.src)) ||
    shortHtml.includes(`src="${shortArticle.heroImage.src}"`));
  assert.ok(shortHtml.includes('aria-label="Share or follow this reporting"'));
  assert.equal(shortHtml.includes("undefined"), false, "CSS module names must resolve");
  const shortAction = shortHtml.match(new RegExp(`<section class="${className("action")}">([\\s\\S]*?)</section>`, "u"))?.[1];
  assert.ok(shortAction, "short update must retain its article-specific CTA");
  assert.ok(shortAction.includes(`href="${escaped(shortArticle.cta.href)}"`));
  assert.ok(shortAction.includes(escaped(shortArticle.cta.label)));
  assert.ok(shortAction.includes("<h2>Talk through your next move.</h2>"));
  assert.equal(shortAction.includes(`<h2>${escaped(decisionCta(shortArticle).heading)}</h2>`), false,
    "short update must not inherit the old category-derived jargon heading");

  const withheldHtml = render({ ...shortArticle, heroImage: { ...shortArticle.heroImage, approval: "withheld" } });
  assert.ok(withheldHtml.includes(className("heroFallback")), "rendering must retain the media approval gate");
  assert.equal(withheldHtml.includes(`alt="${escaped(media.alt)}"`), false);

  assert.match(css, /\.shortUpdate\s+\.identity\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.15fr\)\s+minmax\(0,\s*1fr\)/u);
  assert.match(css, /@media\s*\(max-width:\s*760px\)\s*\{\s*\.shortUpdate\s+\.identity\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(css, /\.shortUpdate\s+\.articleGrid\s*\{[^}]*display:\s*block/u);
  assert.match(css, /\.shortUpdate\s+\.relations\s*\{[^}]*padding:\s*2rem\s+1\.25rem/u);
  assert.match(css, /\.shortUpdate\s+\.relations\s*>\s*header\s*\{[^}]*display:\s*block/u);
  assert.match(css, /\.shortUpdate\s+\.more\s+a\s*\{[^}]*min-height:\s*7rem/u);
  assert.match(css, /\.shortUpdate\s+\.more\s+a\s+strong\s*\{[^}]*margin-top:\s*1rem/u);

  const imagePath = path.join(root, media.repoPath);
  assert.ok(existsSync(imagePath), "root must copy the approved image before this rendered-image check");
  const image = readFileSync(imagePath);
  assert.equal(createHash("sha256").update(image).digest("hex"), media.contentSha256);
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, media.width);
  assert.equal(metadata.height, media.height);
  assert.equal(metadata.format, "jpeg");

  if (process.argv.includes("--html")) {
    // A local-only, self-contained component preview. No alternate article
    // markup or CSS is implemented; asset URLs alone become embedded bytes.
    let tokens = readFileSync(path.join(root, "app/brand/brand-tokens.css"), "utf8");
    tokens = tokens.replace(/url\("(\.\/approved-v1\.2-package\/[^\"]+)"\)/g, (_all, relative: string) => {
      const bytes = readFileSync(path.resolve(root, "app/brand", relative));
      const mime = relative.endsWith(".woff2") ? "font/woff2" : "font/ttf";
      return `url("data:${mime};base64,${bytes.toString("base64")}")`;
    });
    const globals = readFileSync(path.join(root, "app/globals.css"), "utf8")
      .replace(/^@import[^;]+;/gmu, "");
    // The production Tailwind import provides this reset. Include its actual
    // bytes when inlining globals instead of silently dropping border-box.
    const preflight = readFileSync(path.join(root, "node_modules/tailwindcss/preflight.css"), "utf8");
    assert.match(preflight, /box-sizing:\s*border-box/u);
    const scopedCss = css.replace(/\.([A-Za-z_][\w-]*)/gu, (_all, name: string) => `.${classes[name]}`);
    const previewMarkup = shortHtml
      .replace(/<link\b[^>]*rel="preload"[^>]*>/gu, "")
      .replace(/<img\b[^>]*>/gu, (tag) => tag
        .replace(/\s+srcSet="[^"]*"/gu, "")
        .replace(/\s+src="[^"]*"/gu, ` src="data:image/jpeg;base64,${image.toString("base64")}"`));
    const outputDirectory = path.join(root, "outputs/news-short-layout");
    mkdirSync(outputDirectory, { recursive: true });
    const output = path.join(outputDirectory, "index.html");
    const mobile = process.argv.includes("--mobile");
    const geometryScript = mobile ? `<script>
      (async function () {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, function (image) {
          return image.decode ? image.decode().catch(function () {}) : Promise.resolve();
        }));
        var output = document.createElement('output');
        output.id = 'mobile-geometry';
        output.setAttribute('aria-live', 'polite');
        output.style.cssText = 'display:block;box-sizing:border-box;width:100%;padding:12px;background:#e8edf5;color:#111827;font:12px/1.5 monospace;white-space:pre-wrap;overflow-wrap:anywhere';
        document.body.appendChild(output);
        function report() {
          var width = window.innerWidth;
          var main = document.querySelector('main');
          var bounds = main.getBoundingClientRect();
          var offenders = Array.from(document.querySelectorAll('main, main *')).map(function (element) {
            var rect = element.getBoundingClientRect();
            return {tag:element.tagName, className:element.className, left:Math.round(rect.left*10)/10,
              right:Math.round(rect.right*10)/10, width:Math.round(rect.width*10)/10,
              scrollWidth:element.scrollWidth, clientWidth:element.clientWidth,
              boxSizing:getComputedStyle(element).boxSizing};
          }).filter(function (item) {
            return item.left < -1 || item.right > width + 1 || item.width > width + 1 ||
              (item.clientWidth > 0 && item.scrollWidth > item.clientWidth + 1);
          });
          var summary = {viewport:width, documentClientWidth:document.documentElement.clientWidth,
            documentScrollWidth:document.documentElement.scrollWidth, bodyScrollWidth:document.body.scrollWidth,
            mainWidth:Math.round(bounds.width*10)/10, mainRight:Math.round(bounds.right*10)/10,
            boxSizing:getComputedStyle(main).boxSizing, fonts:document.fonts.status,
            imageLoaded:Array.from(document.images).every(function(image){return image.complete && image.naturalWidth > 0;}),
            offenderCount:offenders.length, offenders:offenders.slice(0,12)};
          output.textContent = 'MOBILE GEOMETRY (actual component, after assets settle)\\n' + JSON.stringify(summary,null,2);
        }
        await new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});});
        report();
        setTimeout(report, 150);
      })();
    </script>` : '';
    const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Local QA — ${escaped(shortArticle.title)}</title><style>${preflight}\n${tokens}\n${globals}\n${scopedCss}</style></head><body>${previewMarkup}${geometryScript}</body></html>`;
    const outputHtml = mobile
      ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Local QA — 390px mobile article</title><style>html,body{margin:0;background:#171b25}body{display:flex;justify-content:center}iframe{display:block;flex:none;width:390px;height:2400px;border:0}</style></head><body><iframe id="mobile-preview" title="Actual article at a 390 pixel mobile viewport" width="390" height="2400" srcdoc="${escaped(page)}"></iframe></body></html>`
      : page;
    writeFileSync(output, outputHtml);
    console.log(`Local component preview${mobile ? " (390px srcdoc iframe)" : ""}: ${output}`);
  }
  console.log(`Short news layout PASS: actual component, ${shortArticle.body.split(/\n\n+/u).length} paragraphs once, approved ${media.width}x${media.height} original, one source section; three real broad desk links omitted for short updates, explicit area/developer links retained, long report retains signal/consequence/source rail/desks. Browser geometry is not asserted.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
