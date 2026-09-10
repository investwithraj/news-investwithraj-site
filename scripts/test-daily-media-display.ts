import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { NEWS_ARTICLES } from "../content/news";
import type { NewsArticle } from "../content/news/types";
import * as displayMedia from "../lib/article-display-media";
import * as archive from "../lib/news-archive";
import { NEWS_ARCHIVE_DESKS, projectNewsArchiveItems } from "../lib/news-archive-projection";
import * as editorial from "../lib/news-editorial";
import { withDailyNewsMedia } from "../lib/news-review/daily-media-catalog";

const original = NEWS_ARTICLES.find((article) => article.slug === "2026-09-08-adgm-h1-2026-aum-licences-workforce");
assert.ok(original, "Use a registered article identity for read-only projection fixtures.");
const before = JSON.stringify(original);

function fixture(market: NewsArticle["market"][number], body: string): NewsArticle {
  const article = withDailyNewsMedia({ ...structuredClone(original!), tier: "news", format: "short-update",
    category: "market-pulse", market: [market], body });
  return { ...article, heroImage: { ...article.heroImage, approval: "approved-editorial" } } as NewsArticle;
}

const abuDhabi = fixture("Abu Dhabi", "Abu Dhabi has a city-wide update.");
const rak = fixture("Ras Al Khaimah", "Ras Al Khaimah tourism and hotels on Al Marjan Island.");
const dubai = fixture("Dubai", "Dubai has a city-wide update.");
assert.equal(displayMedia.resolveArticleEditorialMedia(abuDhabi)?.preserveWideFrame, true);
assert.equal(displayMedia.planDistinctArticleMedia([abuDhabi]).get(abuDhabi.slug)?.preserveWideFrame, true);
assert.equal(projectNewsArchiveItems([abuDhabi])[0].media?.preserveWideFrame, true,
  "The archive must retain the catalogue's composition constraint.");
assert.equal(projectNewsArchiveItems([rak])[0].media?.credit, rak.heroImage.credit);
assert.equal(displayMedia.resolveArticleEditorialMedia(rak)?.preserveWideFrame, undefined);
assert.equal(displayMedia.resolveArticleEditorialMedia(dubai)?.preserveWideFrame, undefined);
assert.equal(displayMedia.resolveArticleEditorialMedia({ ...abuDhabi,
  heroImage: { ...abuDhabi.heroImage, approval: "withheld" } }), null);
assert.equal(displayMedia.resolveArticleEditorialMedia({ ...abuDhabi,
  heroImage: { ...abuDhabi.heroImage, sourceUrl: "https://example.com/unregistered-image" } })?.preserveWideFrame, undefined,
  "A similar description must not inherit an exact catalogue constraint.");

// Render the real components while substituting only framework navigation,
// image transport and CSS-module names. No server or content writes are needed.
function component(file: string): React.ComponentType<Record<string, unknown>> {
  const source = readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const dependencies: Record<string, unknown> = {
    "react": React,
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: (props: Record<string, unknown>) => React.createElement("a", props) },
    "next/image": { default: (props: Record<string, unknown>) => {
      const { fill, priority, ...rest } = props;
      void fill; void priority;
      return React.createElement("img", rest);
    } },
    "next/navigation": { useRouter: () => ({ replace: () => { throw new Error("No navigation in rendering test"); } }) },
    "@/lib/article-display-media": displayMedia,
    "@/lib/news-archive": archive,
    "@/lib/news-editorial": editorial,
  };
  const exports: { default?: React.ComponentType<Record<string, unknown>> } = {};
  runInNewContext(compiled, { exports, URLSearchParams, require: (id: string) => {
    if (id.endsWith(".module.css")) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
    assert.ok(id in dependencies, `Unexpected component dependency: ${id}`);
    return dependencies[id];
  } }, { timeout: 2_000 });
  assert.ok(exports.default);
  return exports.default;
}

const home = component("components/redesign/NewsHome.tsx");
const newsArchive = component("components/redesign/NewsArchive.tsx");
for (const article of [abuDhabi, rak]) {
  const renderings = [
    renderToStaticMarkup(React.createElement(home, { articles: [article] })),
    renderToStaticMarkup(React.createElement(newsArchive, {
      items: projectNewsArchiveItems([article]), desks: NEWS_ARCHIVE_DESKS,
      freshness: archive.newsArchiveFreshness(article.publishedAt, Date.parse(article.publishedAt)),
    })),
  ];
  for (const html of renderings) {
    assert.ok(html.includes(article.heroImage.credit), "The complete source credit must remain in the rendered card.");
    assert.match(html, /class="imageViewport"[\s\S]*?<\/span><span class="imageContext">/u,
      "Credits must sit after, not inside, the image viewport.");
    if (article === abuDhabi) {
      assert.match(html, /data-preserve-wide-frame="true"/u);
      assert.match(html, /style="object-fit:contain;transform:none"/u,
        "Inline frame protection must also win over homepage hover zoom.");
    }
    let linkDepth = 0;
    for (const match of html.matchAll(/<a\b|<\/a>/gu)) {
      linkDepth += match[0] === "</a>" ? -1 : 1;
      assert.ok(linkDepth >= 0 && linkDepth <= 1, "Photo attribution must not introduce nested anchors.");
    }
    assert.equal(linkDepth, 0);
  }
}

for (const file of ["components/redesign/NewsHome.module.css", "components/redesign/NewsArchive.module.css"]) {
  const css = readFileSync(file, "utf8");
  const caption = css.match(/\.imageContext\s*\{([^}]+)\}/u)?.[1];
  assert.ok(caption);
  assert.doesNotMatch(caption, /ellipsis|nowrap|position:\s*absolute|overflow:\s*hidden/u);
  assert.match(caption, /overflow-wrap:\s*anywhere/u);
  assert.match(caption, /font-size:\s*0\.75rem/u);
}
assert.equal(JSON.stringify(original), before, "Projection fixtures must not mutate the published corpus.");
console.log("Daily media display passed: exact wide-frame provenance survives archive projection; real component markup preserves full credits, contain/no-zoom and non-nested article links.");
