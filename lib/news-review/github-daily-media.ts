import { createHash } from "node:crypto";

import { expectedDailyMediaFields, hasApprovedDailyMediaContext, selectDailyNewsMedia } from "./daily-media-catalog";
import { assertCanonicalNewsSlug } from "./integrity";
import type { DraftArticle } from "./types";
import type { InspectedEditorialMedia } from "./github";

export class DailyMediaGitError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "DailyMediaGitError";
  }
}

export interface DailyMediaGitOptions {
  fetch?: typeof fetch;
  token?: string;
  owner?: string;
  repo?: string;
  branch?: string;
}

type FileRecord = { type?: string; sha?: string; size?: number };
const MAX_BYTES = 40 * 1024 * 1024;
const SHA = /^[a-f0-9]{40}$/u;

function validSha(value: unknown): value is string {
  return typeof value === "string" && SHA.test(value);
}

function encodedPath(path: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new DailyMediaGitError("Approved media path is invalid.", 422);
  }
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Link one verified existing blob into the article's cover path. The sole
 * mutation is an image-only, non-force Git commit; no draft or article is
 * published here. Refreshing a raced branch never overwrites another cover.
 */
export async function ensureApprovedDailyMediaCover(
  article: DraftArticle,
  options: DailyMediaGitOptions = {},
): Promise<InspectedEditorialMedia> {
  assertCanonicalNewsSlug(article.slug);
  const selected = selectDailyNewsMedia(article);
  const expected = expectedDailyMediaFields(article);
  if (!selected || !expected || !hasApprovedDailyMediaContext(article)) {
    throw new DailyMediaGitError("No matching owner-approved daily image exists.", 422);
  }
  const extension = expected.mime === "image/jpeg" ? "jpg" : expected.mime === "image/png" ? "png" : "webp";
  if (expected.repoPath !== `public/news/${article.slug}/cover.${extension}`) {
    throw new DailyMediaGitError("The daily image must use its exact article-local path.", 422);
  }
  const sourcePath = encodedPath(selected.catalogueRepoPath);
  const targetPath = expected.repoPath;
  const token = options.token ?? process.env.GITHUB_TOKEN ?? "";
  const owner = options.owner ?? process.env.GITHUB_OWNER ?? "investwithraj";
  const repo = options.repo ?? process.env.GITHUB_REPO ?? "news-investwithraj-site";
  const branch = options.branch ?? process.env.GITHUB_BRANCH ?? "main";
  if (!token) throw new DailyMediaGitError("GitHub media reuse is unavailable.", 503);
  if (![owner, repo].every((value) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/u.test(value)) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/u.test(branch) ||
    branch.includes("..") || branch.includes("//")) {
    throw new DailyMediaGitError("GitHub publication configuration is invalid.", 503);
  }
  const base = `/repos/${owner}/${repo}`;
  const transport = options.fetch ?? globalThis.fetch;
  async function gh<T>(path: string, init: RequestInit = {}, optional = false): Promise<T | null> {
    let response: Response;
    try {
      response = await transport(`https://api.github.com${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      throw new DailyMediaGitError("GitHub media transport is unavailable.");
    }
    if (optional && response.status === 404) return null;
    if (!response.ok) {
      // Never relay an upstream body, which may contain private repo details.
      throw new DailyMediaGitError("GitHub media operation did not complete.", response.status);
    }
    try { return await response.json() as T; }
    catch { throw new DailyMediaGitError("GitHub media response is invalid."); }
  }
  function result(): InspectedEditorialMedia {
    return {
      repoPath: targetPath,
      contentSha256: selected!.contentSha256,
      mime: selected!.mime,
      width: selected!.width,
      height: selected!.height,
    };
  }

  // A ref race has no destructive fallback. Retry against a new pinned tree,
  // rechecking every source and target constraint each time.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ref = await gh<{ object?: { sha?: string } }>(`${base}/git/ref/heads/${encodedPath(branch)}`);
    const head = ref?.object?.sha;
    if (!validSha(head)) throw new DailyMediaGitError("Publication branch identity is invalid.");
    const commit = await gh<{ tree?: { sha?: string } }>(`${base}/git/commits/${head}`);
    const baseTree = commit?.tree?.sha;
    if (!validSha(baseTree)) throw new DailyMediaGitError("Publication tree identity is invalid.");
    const fileAtHead = <T>(path: string) => gh<T>(
      `${base}/contents/${path}?ref=${encodeURIComponent(head)}`, {}, true,
    );
    const source = await fileAtHead<FileRecord>(sourcePath);
    if (source?.type !== "file" || !validSha(source.sha) || !Number.isSafeInteger(source.size) ||
      source.size! < 32 * 1024 || source.size! > MAX_BYTES) {
      throw new DailyMediaGitError("The approved catalogue image is unavailable or invalid.", 422);
    }
    const blob = await gh<{ content?: string; encoding?: string; size?: number; sha?: string }>(
      `${base}/git/blobs/${source.sha}`,
    );
    if (blob?.encoding !== "base64" || typeof blob.content !== "string" ||
      blob.content.length > Math.ceil(MAX_BYTES / 3) * 4 + 2_000_000) {
      throw new DailyMediaGitError("The approved catalogue image bytes are unavailable.", 422);
    }
    const encoded = blob.content.replace(/\s+/gu, "");
    // Avoid a repeated-group expression over multi-megabyte originals: V8's
    // regexp backtracking stack can overflow despite otherwise valid base64.
    if (encoded.length % 4 !== 0 || /[^A-Za-z0-9+/=]/u.test(encoded)) {
      throw new DailyMediaGitError("The approved image encoding is invalid.", 422);
    }
    const bytes = Buffer.from(encoded, "base64");
    const gitSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    if (bytes.toString("base64") !== encoded || bytes.length !== source.size || (blob.size !== undefined && blob.size !== bytes.length) ||
      (blob.sha !== undefined && blob.sha !== source.sha) || gitSha !== source.sha ||
      createHash("sha256").update(bytes).digest("hex") !== selected.contentSha256) {
      throw new DailyMediaGitError("The catalogue image bytes changed from the owner-approved original.", 422);
    }
    const { verifyImageBytes } = await import("@/lib/media/image-integrity");
    const decoded = await verifyImageBytes(bytes);
    if (decoded.mime !== selected.mime || decoded.width !== selected.width || decoded.height !== selected.height ||
      decoded.width < 3840 || decoded.height < 2160) {
      throw new DailyMediaGitError("The approved image geometry or format does not match.", 422);
    }

    const articleFile = await fileAtHead<FileRecord>(encodedPath(`content/news/${article.slug}.ts`));
    if (articleFile !== null) {
      throw new DailyMediaGitError("An article already occupies this publication path.", 409);
    }
    let exactTarget = false;
    for (const extension of ["jpg", "jpeg", "png", "webp"]) {
      const path = `public/news/${article.slug}/cover.${extension}`;
      const target = await fileAtHead<FileRecord>(encodedPath(path));
      if (target === null) continue;
      if (path !== targetPath || target.type !== "file" || target.sha !== source.sha || target.size !== source.size) {
        throw new DailyMediaGitError("An existing article cover conflicts with the approved image.", 409);
      }
      exactTarget = true;
    }
    if (exactTarget) return result();

    const tree = await gh<{ sha?: string }>(`${base}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTree,
        tree: [{ path: targetPath, mode: "100644", type: "blob", sha: source.sha }],
      }),
    });
    if (!validSha(tree?.sha)) throw new DailyMediaGitError("The media tree identity is invalid.");
    const imageCommit = await gh<{ sha?: string }>(`${base}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: `news: attach approved city-context image for ${article.slug}`,
        tree: tree.sha,
        parents: [head],
      }),
    });
    if (!validSha(imageCommit?.sha)) throw new DailyMediaGitError("The media commit identity is invalid.");
    try {
      await gh(`${base}/git/refs/heads/${encodedPath(branch)}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: imageCommit.sha, force: false }),
      });
      return result();
    } catch (error) {
      if (!(error instanceof DailyMediaGitError) || ![409, 422].includes(error.status) || attempt === 2) throw error;
    }
  }
  throw new DailyMediaGitError("The publication branch changed during media reuse.", 409);
}
