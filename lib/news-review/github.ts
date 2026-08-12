// Minimal GitHub Git Data API client — commits the published article file +
// the patched registry as ONE atomic commit (so a build never sees index.ts
// importing a file that isn't there yet). Vercel auto-deploys on the push.
//
// Needs GITHUB_TOKEN (fine-grained PAT, contents:write on the news repo).
// Owner/repo/branch default to the news repo; override via env if needed.

import { createHash } from "node:crypto";

import { verifyImageBytes } from "@/lib/media/image-integrity";
import { assertCanonicalNewsSlug } from "@/lib/news-review/integrity";
import { serializeArticle, patchIndex } from "./serialize";
import type {
  DraftArticle,
  MediaApprovalLedger,
} from "./types";

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

async function ghOptional<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub GET ${path} failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

export interface InspectedEditorialMedia {
  repoPath: string;
  contentSha256: string;
  mime: MediaApprovalLedger["mime"];
  width: number;
  height: number;
}

/**
 * Inspect the one real article cover already present on the publication
 * branch. Metadata is decoded from bytes, not trusted from a filename or form.
 */
export async function inspectEditorialMedia(
  slug: string,
): Promise<InspectedEditorialMedia> {
  assertCanonicalNewsSlug(slug);
  if (!TOKEN) throw new Error("GITHUB_TOKEN not set");
  const base = `/repos/${OWNER}/${REPO}`;
  const candidates = ["jpg", "jpeg", "png", "webp"];
  const matches: Array<{
    repoPath: string;
    sha: string;
    size: number;
  }> = [];
  for (const extension of candidates) {
    const repoPath = `public/news/${slug}/cover.${extension}`;
    const encoded = repoPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const file = await ghOptional<{
      type?: string;
      size?: number;
      sha?: string;
    }>(`${base}/contents/${encoded}?ref=${encodeURIComponent(BRANCH)}`);
    if (file?.type === "file" && file.sha && file.size) {
      matches.push({ repoPath, sha: file.sha, size: file.size });
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? "No article-local cover exists on the publication branch."
        : "Multiple cover files exist; retain exactly one reviewed source.",
    );
  }
  if (matches[0].size > 40 * 1024 * 1024) {
    throw new Error("Editorial cover exceeds the 40 MB review limit.");
  }
  const blob = await gh<{ content: string; encoding: string; size?: number }>(
    `${base}/git/blobs/${encodeURIComponent(matches[0].sha)}`,
  );
  if (blob.encoding !== "base64" || !blob.content) {
    throw new Error("Editorial cover bytes are unavailable for verification.");
  }
  const bytes = Buffer.from(blob.content.replace(/\s+/g, ""), "base64");
  if (bytes.length !== matches[0].size) {
    throw new Error("Editorial cover byte length does not match GitHub.");
  }
  const decoded = await verifyImageBytes(bytes);
  if (decoded.width < 3840 || decoded.height < 2160) {
    throw new Error("Editorial cover source is not genuine UHD.");
  }
  return {
    repoPath: matches[0].repoPath,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
    ...decoded,
  };
}

/** Commit the article file + the registry update in a single commit.
 *  Returns the new commit SHA. */
export async function publishArticleCommit(
  slug: string,
  article: DraftArticle,
  mediaApproval: MediaApprovalLedger | null,
  publicationContentHash: string,
): Promise<string> {
  if (!TOKEN) throw new Error("GITHUB_TOKEN not set");
  assertCanonicalNewsSlug(slug);
  if (article.slug !== slug || (mediaApproval && mediaApproval.slug !== slug)) {
    throw new Error("Publication slug does not match the reviewed records.");
  }

  const base = `/repos/${OWNER}/${REPO}`;

  // 1. Current branch tip + its tree.
  const ref = await gh<{ object: { sha: string } }>(`${base}/git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  const headCommit = await gh<{ tree: { sha: string } }>(`${base}/git/commits/${headSha}`);
  const baseTree = headCommit.tree.sha;

  let approvedArticle: DraftArticle;
  if (mediaApproval) {
    const inspected = await inspectEditorialMedia(slug);
    if (
      inspected.repoPath !== mediaApproval.repoPath ||
      inspected.contentSha256 !== mediaApproval.contentSha256 ||
      inspected.mime !== mediaApproval.mime ||
      inspected.width !== mediaApproval.width ||
      inspected.height !== mediaApproval.height
    ) {
      throw new Error(
        "Publication cover bytes do not match the immutable media approval ledger.",
      );
    }
    approvedArticle = {
      ...article,
      publicationContentHash,
      heroImage: {
        ...article.heroImage,
        src: `/${mediaApproval.repoPath.replace(/^public\//, "")}`,
        credit: mediaApproval.credit,
        sourceUrl: mediaApproval.sourceUrl,
        rightsStatus: mediaApproval.rightsStatus,
        width: mediaApproval.width,
        height: mediaApproval.height,
        approval: "approved-editorial",
      },
    };
  } else {
    approvedArticle = {
      ...article,
      publicationContentHash,
      heroImage: {
        ...article.heroImage,
        credit: "Verified editorial image withheld pending UHD rights approval",
        approval: "withheld",
      },
    };
  }

  // 2. Read + patch the registry.
  const indexFile = await gh<{ content: string; encoding: string }>(
    `${base}/contents/content/news/index.ts?ref=${BRANCH}`,
  );
  const currentIndex = Buffer.from(indexFile.content, "base64").toString("utf-8");
  const nextIndex = patchIndex(currentIndex, slug);

  const articlePath = `content/news/${slug}.ts`;
  const encodedArticlePath = articlePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const expectedArticleTs = serializeArticle(approvedArticle);
  const existingArticle = await ghOptional<{
    content?: string;
    encoding?: string;
    sha?: string;
  }>(`${base}/contents/${encodedArticlePath}?ref=${encodeURIComponent(BRANCH)}`);
  if (existingArticle) {
    const existingText =
      existingArticle.encoding === "base64" && existingArticle.content
        ? Buffer.from(existingArticle.content, "base64").toString("utf8")
        : "";
    if (existingText !== expectedArticleTs) {
      throw new Error(
        "A different article already occupies the reviewed publication slug.",
      );
    }
    if (!currentIndex.includes(`from "./${slug}"`)) {
      throw new Error(
        "Article exists but the registry is inconsistent; reconcile it before retrying.",
      );
    }
    const commits = await gh<Array<{ sha?: string }>>(
      `${base}/commits?sha=${encodeURIComponent(BRANCH)}&path=${encodeURIComponent(articlePath)}&per_page=1`,
    );
    const publicationCommitSha = commits[0]?.sha;
    if (!publicationCommitSha || !existingArticle.sha) {
      throw new Error(
        "The existing article's exact publication commit could not be proven.",
      );
    }
    const committedArticle = await ghOptional<{
      content?: string;
      encoding?: string;
      sha?: string;
    }>(
      `${base}/contents/${encodedArticlePath}?ref=${encodeURIComponent(publicationCommitSha)}`,
    );
    const committedText =
      committedArticle?.encoding === "base64" && committedArticle.content
        ? Buffer.from(committedArticle.content, "base64").toString("utf8")
        : "";
    if (
      committedArticle?.sha !== existingArticle.sha ||
      committedText !== expectedArticleTs
    ) {
      throw new Error(
        "The existing article is not bound to the recovered publication commit.",
      );
    }
    return publicationCommitSha;
  }

  // 3. Blobs for both files.
  const [articleBlob, indexBlob] = await Promise.all([
    gh<{ sha: string }>(`${base}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: expectedArticleTs, encoding: "utf-8" }),
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
