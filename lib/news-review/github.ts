// Minimal GitHub Git Data API client — commits the published article file +
// the patched registry as ONE atomic commit (so a build never sees index.ts
// importing a file that isn't there yet). Vercel auto-deploys on the push.
//
// Needs GITHUB_TOKEN (fine-grained PAT, contents:write on the news repo).
// Owner/repo/branch default to the news repo; override via env if needed.

import { serializeArticle, patchIndex } from "./serialize";
import type { DraftArticle } from "./types";

const TOKEN = process.env.GITHUB_TOKEN || "";
const OWNER = process.env.GITHUB_OWNER || "investwithraj";
const REPO = process.env.GITHUB_REPO || "news-investwithraj-site";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const API = "https://api.github.com";

export function githubConfigured(): boolean {
  return Boolean(TOKEN);
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Commit the article file + the registry update in a single commit.
 *  Returns the new commit SHA. */
export async function publishArticleCommit(
  slug: string,
  article: DraftArticle,
): Promise<string> {
  if (!TOKEN) throw new Error("GITHUB_TOKEN not set");

  const base = `/repos/${OWNER}/${REPO}`;

  // 1. Current branch tip + its tree.
  const ref = await gh<{ object: { sha: string } }>(`${base}/git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  const headCommit = await gh<{ tree: { sha: string } }>(`${base}/git/commits/${headSha}`);
  const baseTree = headCommit.tree.sha;

  // 2. Read + patch the registry.
  const indexFile = await gh<{ content: string; encoding: string }>(
    `${base}/contents/content/news/index.ts?ref=${BRANCH}`,
  );
  const currentIndex = Buffer.from(indexFile.content, "base64").toString("utf-8");
  const nextIndex = patchIndex(currentIndex, slug);

  // 2b. Self-host the hero image. The auto-sourcer stores a remote CDN URL on
  //     the draft (for The Desk preview); at publish we download it and add it
  //     to THIS atomic commit as public/news/<slug>/cover.<ext>, then rewrite
  //     heroImage.src to the local path. Any failure is non-fatal — we keep the
  //     remote URL so the article still renders via the source CDN.
  let finalArticle = article;
  const heroTree: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
  const remoteHero = article.heroImage?.src ?? "";
  if (/^https?:\/\//i.test(remoteHero)) {
    try {
      // For Wikimedia originals, fetch a 1600px thumbnail (caps a 15MB original
      // to a web-sized cover). Non-Wikimedia URLs pass through unchanged.
      const dlUrl = remoteHero.includes("/thumb/")
        ? remoteHero
        : remoteHero.replace(
            /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/(.+\.(?:jpe?g|png|webp))$/i,
            "$1/thumb/$2/$3/$4/1600px-$4",
          );
      // Wikimedia 404s the 1600px thumbnail when the original is narrower than
      // that, so retry the original URL before giving up (the missed-self-host
      // bug that left some articles on a generic remote cover).
      const fetchImage = async (u: string) => {
        const r = await fetch(u, {
          headers: {
            "User-Agent": "InvestWithRajNewsBot/1.0 (https://news.investwithraj.com)",
            Referer: "https://commons.wikimedia.org/",
          },
        });
        const c = (r.headers.get("content-type") || "").split(";")[0].toLowerCase();
        if (r.ok && c.startsWith("image/")) {
          const b = Buffer.from(await r.arrayBuffer());
          if (b.length > 3000) return { buf: b, ct: c };
        }
        return null;
      };
      const got = (await fetchImage(dlUrl)) || (dlUrl !== remoteHero ? await fetchImage(remoteHero) : null);
      if (got) {
        const ext = got.ct.includes("png") ? "png" : got.ct.includes("webp") ? "webp" : "jpg";
        const imgBlob = await gh<{ sha: string }>(`${base}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: got.buf.toString("base64"), encoding: "base64" }),
        });
        heroTree.push({ path: `public/news/${slug}/cover.${ext}`, mode: "100644", type: "blob", sha: imgBlob.sha });
        finalArticle = { ...article, heroImage: { ...article.heroImage, src: `/news/${slug}/cover.${ext}` } };
      }
    } catch {
      // non-fatal — keep the remote heroImage.src; article renders via the CDN.
    }
  }

  // 3. Blobs for both files.
  const articleTs = serializeArticle(finalArticle);
  const [articleBlob, indexBlob] = await Promise.all([
    gh<{ sha: string }>(`${base}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: articleTs, encoding: "utf-8" }),
    }),
    gh<{ sha: string }>(`${base}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: nextIndex, encoding: "utf-8" }),
    }),
  ]);

  // 4. Tree on top of the current tree.
  const tree = await gh<{ sha: string }>(`${base}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTree,
      tree: [
        { path: `content/news/${slug}.ts`, mode: "100644", type: "blob", sha: articleBlob.sha },
        { path: "content/news/index.ts", mode: "100644", type: "blob", sha: indexBlob.sha },
        ...heroTree,
      ],
    }),
  });

  // 5. Commit + move the branch.
  const commit = await gh<{ sha: string }>(`${base}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `news: publish ${slug} (reviewed + approved)`,
      tree: tree.sha,
      parents: [headSha],
    }),
  });
  await gh(`${base}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return commit.sha;
}
