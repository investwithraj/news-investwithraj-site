import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NEWS_ARTICLES } from "../content/news";
import {
  ARTICLE_RELATION_RECORDS,
  resolveArticleRelations,
  validateArticleRelationRecords,
} from "../lib/article-relations";
import { resolveArticleEditorialMedia } from "../lib/article-display-media";
import { decisionCta, hasVerifiedEditorialImage } from "../lib/news-editorial";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const component = read("components/redesign/NewsArticle.tsx");
const route = read("app/news/[slug]/page.tsx");
const css = read("components/redesign/NewsArticle.module.css");

const layers = [...component.matchAll(/data-news-layer="([^"]+)"/g)].map(
  (match) => match[1],
);
assert.deepEqual(layers, [
  "identity",
  "signal",
  "analysis",
  "evidence",
  "context",
  "next-action",
]);
assert.equal(component.includes('"use client"'), false);
assert.equal((component.match(/<h1/g) ?? []).length, 1);
assert.equal(component.includes("unoptimized"), false);
assert.match(component, /resolveArticleEditorialMedia/);

assert.match(route, /resolveArticleRelations\(article\.slug\)/);
assert.equal(route.includes("relatedAreasForArticle"), false);
assert.equal(route.includes("relatedDevelopersForArticle"), false);
assert.equal(component.includes("href={`/areas/${area.slug}`"), false);
assert.equal(component.includes("href={`/developer/${developer.slug}`"), false);

const published = NEWS_ARTICLES.filter((article) => article.status !== "research");
const research = NEWS_ARTICLES.filter((article) => article.status === "research");
assert.ok(published.length >= 41, "The certified published baseline regressed.");
assert.ok(research.length >= 4, "The held research baseline regressed.");
assert.equal(ARTICLE_RELATION_RECORDS.length, published.length);
validateArticleRelationRecords(ARTICLE_RELATION_RECORDS, NEWS_ARTICLES);

for (const article of published) {
  const relations = resolveArticleRelations(article.slug);
  for (const area of relations.areas) {
    assert.ok(area.advisoryLinks.length > 0);
    assert.ok(
      area.advisoryLinks.every((link) =>
        link.href.startsWith("https://investwithraj.com/"),
      ),
    );
  }
  for (const developer of relations.developers) {
    assert.ok(
      developer.advisoryLink.href.startsWith("https://investwithraj.com/"),
    );
  }

  const media = resolveArticleEditorialMedia(article);
  assert.equal(Boolean(media), hasVerifiedEditorialImage(article));

  const cta = decisionCta(article);
  const ctaUrl = new URL(cta.href);
  assert.equal(ctaUrl.origin, "https://investwithraj.com");
  assert.equal(ctaUrl.pathname, "/engage");
  assert.equal(ctaUrl.searchParams.get("utm_source"), "news");
  assert.equal(ctaUrl.searchParams.get("utm_content"), article.slug);
}

assert.match(css, /\.context/);
assert.match(css, /\.finalLayer/);
assert.match(css, /@media \(max-width: 720px\)/);

console.log(
  `News article template PASS: ${published.length} published routes, ${research.length} held records, 6 layers, explicit relations and media fail-closed.`,
);
