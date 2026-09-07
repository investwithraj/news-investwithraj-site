import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  GET as getLlms,
  revalidate as llmsRevalidate,
} from "@/app/llms.txt/route";
import { GET as getRss } from "@/app/rss.xml/route";
import { CONTACT, EDITORIAL, SITE } from "@/lib/constants";
import { getIndexablePublicNewsArticles } from "@/lib/news-discovery";
import { rajPersonSchema } from "@/lib/schema/person";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

async function main() {
  assert.equal(SITE.name, "Invest With Raj Intelligence");
  assert.doesNotMatch(SITE.tagline, /\bproperty\b/i);
  assert.doesNotMatch(SITE.description, /\bproperty\b/i);
  assert.doesNotMatch(EDITORIAL.articleRole, /\bproperty\b/i);

  assert.equal(
    CONTACT.instagram,
    "https://www.instagram.com/thedubaiupgrade/",
  );
  assert.equal(CONTACT.instagramHandle, "@thedubaiupgrade");
  assert.ok(rajPersonSchema.sameAs.includes(CONTACT.instagram));
  assert.doesNotMatch(rajPersonSchema.jobTitle, /\bproperty\b/i);
  assert.doesNotMatch(rajPersonSchema.description, /\bproperty\b/i);

  const layout = read("app/layout.tsx");
  assert.match(layout, /template:\s*`%s · \$\{SITE\.name\}`/);
  assert.match(layout, /publisher:\s*SITE\.name/);
  assert.match(
    layout,
    /publicationIdentityGraph = asGraph\([\s\S]*newsDeskSchema/,
    "The public identity graph must include the collective News Desk author.",
  );
  assert.doesNotMatch(layout, /Daily Market Read/);
  assert.match(
    layout,
    /<link[\s\S]+?rel="alternate"[\s\S]+?type="application\/rss\+xml"[\s\S]+?title=\{`\$\{SITE\.name\} RSS`\}[\s\S]+?href=\{`\$\{SITE\.url\}\/rss\.xml`\}[\s\S]+?\/>/,
    "RSS discovery must be a literal root-head link that survives child metadata replacement.",
  );
  assert.equal(
    layout.match(/application\/rss\+xml/g)?.length,
    1,
    "Root RSS discovery should have one durable source of truth.",
  );
  assert.doesNotMatch(
    layout,
    /site:\s*["']@investwithraj["']/,
    "Do not claim ownership of an unverified X account in metadata.",
  );

  for (const path of [
    "app/page.tsx",
    "app/news/page.tsx",
    "app/about/page.tsx",
    "app/areas/page.tsx",
    "app/areas/[slug]/page.tsx",
    "app/developers/page.tsx",
    "app/developer/[slug]/page.tsx",
    "app/map/page.tsx",
    "app/terminal/page.tsx",
    "app/v/[slug]/page.tsx",
    "app/llms.txt/route.ts",
    "components/EditorialFooter.tsx",
    "components/redesign/NewsArchive.tsx",
    "components/terminal/TerminalShell.tsx",
    "lib/verticals.ts",
    "lib/schema/person.ts",
  ]) {
    const source = read(path);
    assert.doesNotMatch(
      source,
      /Daily Market Read|UAE property|property (?:intelligence|reporting)|real property brief/i,
      `${path} reintroduced a retired publication identity phrase.`,
    );
  }

  const rss = await getRss().text();
  assert.match(rss, /<language>en-AE<\/language>/);
  assert.ok(rss.includes(`<title>${SITE.name}</title>`));
  assert.ok(
    rss.includes(
      `<atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />`,
    ),
  );

  const llmsResponse = getLlms();
  assert.equal(
    llmsResponse.headers.get("Cache-Control"),
    `public, max-age=${llmsRevalidate}, s-maxage=${llmsRevalidate}`,
  );
  const llms = await llmsResponse.text();
  assert.ok(llms.startsWith(`# ${SITE.name}\n`));
  assert.ok(llms.includes(`Area index -> ${SITE.url}/areas`));
  assert.ok(llms.includes(`Developer index -> ${SITE.url}/developers`));
  assert.ok(llms.includes(`Instagram: ${CONTACT.instagram}`));
  assert.ok(llms.includes(`Article byline: ${EDITORIAL.articleByline}`));
  assert.doesNotMatch(llms, /\bproperty\b/i);

  const expectedLatest = getIndexablePublicNewsArticles()
    .filter((article) => Boolean(article.publicationContentHash))
    .slice(0, 5);
  const latestSection = llms
    .split("## Latest verified reporting\n")[1]
    ?.split("\n\n## Authorship and publisher")[0];
  assert.ok(latestSection, "llms.txt omitted its latest verified section.");
  const latestUrls = [
    ...latestSection.matchAll(
      /https:\/\/news\.investwithraj\.com\/news\/([^:\s]+)/g,
    ),
  ].map((match) => match[1]);
  assert.deepEqual(
    latestUrls,
    expectedLatest.map((article) => article.slug),
    "llms.txt must expose exactly the latest five evidence-certified indexable articles.",
  );

  console.log(
    "Publication discovery PASS: consistent real estate identity, verified Instagram entity, durable RSS discovery and en-AE feed metadata.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
