import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { MANUAL_NEWS_20260930 } from '@/content/news/2026-09-30-chat-news';
import { NEWS_ARTICLES } from '@/content/news';
import { editorialImageHoldReasons } from '@/lib/news-editorial';
import { getIndexablePublicNewsArticles } from '@/lib/news-discovery';
import { ARTICLE_RELATION_RECORDS } from '@/lib/article-relations';
import { GET } from '@/app/api/front/route';

async function main() {
 assert.equal(MANUAL_NEWS_20260930.length,6);
 const indexed=getIndexablePublicNewsArticles();
 const feed=await (await GET()).json();
 for(const article of MANUAL_NEWS_20260930){
  assert.equal(NEWS_ARTICLES.filter(a=>a.slug===article.slug).length,1);
  assert.equal(ARTICLE_RELATION_RECORDS.filter(a=>a.articleSlug===article.slug).length,1);
  assert(indexed.some(a=>a.slug===article.slug));
  assert(feed.items.some((a:{slug:string;cover:string})=>a.slug===article.slug&&a.cover));
  assert.deepEqual(editorialImageHoldReasons(article),[]);
  const image=await sharp('public'+article.heroImage.src).metadata();
  assert.equal(image.width,1920);
  assert(image.height!>1000);
  assert(fs.statSync('public'+article.heroImage.src).size<1_000_000);
  assert.equal(article.status,'live');
  assert.equal(article.format,'short-update');
  assert.deepEqual(article.distribution,{});
  assert(article.brief);
  assert(article.body.split(/\s+/).length>=80&&article.body.split(/\s+/).length<=400);
  const paragraphs=article.body.split(/\n\n+/);
  for(const heading of article.brief.headings??[])assert(heading.beforeParagraph<paragraphs.length);
  assert.equal(article.citations.length,1);
  assert.equal(article.faq.length,0);
  assert(!/\b(?:TBC|TODO|placeholder|coming soon)\b/i.test(article.body));
  assert(!/Ownerss|Pangea|guaranteed returns/i.test(JSON.stringify(article)));
  if(article.heroImage.rightsStatus?.startsWith('CC '))assert(article.heroImage.licenceUrl);
 }
 assert.equal(feed.media.approvedCoverCount,6);
 console.log('PASS: six unique, indexed manual articles; six UHD-approved covers; feed, relations, prose and licence checks.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
