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
const BRANCH = process.env.GITHUB_BRANCH || "v16-futurevision";
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

  // 3. Blobs for both files.
  const articleTs = serializeArticle(article);
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
