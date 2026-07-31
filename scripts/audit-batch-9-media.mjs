#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const PUBLIC_ROOT = path.join(ROOT, "public");
const CONTRACT_PATH = path.join(ROOT, "config", "media-contract.json");
const SOURCE_ROOTS = ["app", "components", "content", "lib"];
const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const VIDEO_EXTENSIONS = new Set([".m4v", ".mov", ".mp4", ".webm"]);
const AUDIO_EXTENSIONS = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".wav",
]);
const MEDIA_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
]);

function slash(value) {
  return value.split(path.sep).join("/");
}

function publicPath(filePath) {
  return `/${slash(path.relative(PUBLIC_ROOT, filePath))}`;
}

function normalizeMediaPath(value) {
  if (typeof value !== "string") return "";
  const clean = value.split(/[?#]/, 1)[0].replaceAll("\\", "/");
  if (!clean) return "";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function mediaType(extension) {
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  return "other";
}

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...(await walk(absolute)));
    } else if (entry.isFile()) {
      discovered.push(absolute);
    }
  }
  return discovered;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generatedPublicRouteExists(mediaPath) {
  const relative = mediaPath.replace(/^\/+/u, "");
  const candidates = [
    path.join(ROOT, "app", relative),
    path.join(ROOT, "app", relative, "route.js"),
    path.join(ROOT, "app", relative, "route.ts"),
    path.join(ROOT, "app", relative, "route.tsx"),
  ];
  for (const candidate of candidates) {
    if (await exists(candidate)) return true;
  }
  return false;
}

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const digest = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(digest.digest("hex")));
  });
}

function mp4Dimensions(buffer) {
  const candidates = [];
  const addCandidate = (width, height) => {
    const aspect = width / height;
    if (
      width >= 160 &&
      height >= 90 &&
      width <= 16384 &&
      height <= 16384 &&
      aspect >= 0.25 &&
      aspect <= 4
    ) {
      candidates.push({ width, height });
    }
  };

  for (let index = 4; index <= buffer.length - 12; index += 1) {
    const boxType = buffer.toString("ascii", index, index + 4);
    if (boxType === "tkhd") {
      const start = index - 4;
      let size = buffer.readUInt32BE(start);
      let header = 8;
      if (size === 1 && start + 16 <= buffer.length) {
        const extended = Number(buffer.readBigUInt64BE(start + 8));
        if (Number.isSafeInteger(extended)) {
          size = extended;
          header = 16;
        }
      }
      const end = size === 0 ? buffer.length : start + size;
      if (
        size >= header + 8 &&
        end <= buffer.length &&
        end - 8 >= start + header
      ) {
        const width = Math.round(buffer.readUInt32BE(end - 8) / 65536);
        const height = Math.round(buffer.readUInt32BE(end - 4) / 65536);
        addCandidate(width, height);
      }
    }

    if (["avc1", "hev1", "hvc1", "vp09"].includes(boxType)) {
      const widthOffset = index + 28;
      const heightOffset = index + 30;
      if (heightOffset + 2 <= buffer.length) {
        const width = buffer.readUInt16BE(widthOffset);
        const height = buffer.readUInt16BE(heightOffset);
        addCandidate(width, height);
      }
    }
  }

  return (
    candidates.sort(
      (left, right) => right.width * right.height - left.width * left.height,
    )[0] ?? { width: null, height: null }
  );
}

async function dimensions(filePath, extension) {
  if (IMAGE_EXTENSIONS.has(extension)) {
    try {
      const metadata = await sharp(filePath, { animated: false }).metadata();
      return {
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        format: metadata.format ?? extension.slice(1),
      };
    } catch (error) {
      return {
        width: null,
        height: null,
        format: extension.slice(1),
        metadataError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (extension === ".mp4" || extension === ".mov" || extension === ".m4v") {
    try {
      const buffer = await readFile(filePath);
      return { ...mp4Dimensions(buffer), format: extension.slice(1) };
    } catch (error) {
      return {
        width: null,
        height: null,
        format: extension.slice(1),
        metadataError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    width: null,
    height: null,
    format: extension.slice(1),
  };
}

async function mapLimit(values, limit, worker) {
  const output = new Array(values.length);
  let next = 0;

  async function consume() {
    while (next < values.length) {
      const current = next;
      next += 1;
      output[current] = await worker(values[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => consume()),
  );
  return output;
}

function extractMediaReferences(text) {
  const values = [];
  const quoted =
    /["'`](\/[^"'`\s)<>]+?\.(?:aac|avif|flac|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|png|svg|wav|webm|webp)(?:[?#][^"'`\s)<>]*)?)["'`]/giu;
  const css =
    /url\(\s*(?:["'])?(\/[^"'`\s)<>]+?\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#][^"'`\s)<>]*)?)(?:["'])?\s*\)/giu;

  for (const expression of [quoted, css]) {
    let match;
    while ((match = expression.exec(text))) values.push(match[1]);
  }
  return values;
}

function extractImportSpecifiers(text) {
  const specifiers = [];
  const expression =
    /(?:\bfrom\s+|\bimport\s*)["']([^"']+)["']/gu;
  let match;
  while ((match = expression.exec(text))) specifiers.push(match[1]);
  return specifiers;
}

function resolveSourceImport(fromFile, specifier, sourceText) {
  let unresolved;
  if (specifier.startsWith("@/")) {
    unresolved = specifier.slice(2);
  } else if (specifier.startsWith(".")) {
    unresolved = slash(
      path.normalize(path.join(path.dirname(fromFile), specifier)),
    );
  } else {
    return null;
  }

  const candidates = [
    unresolved,
    `${unresolved}.css`,
    `${unresolved}.js`,
    `${unresolved}.jsx`,
    `${unresolved}.mjs`,
    `${unresolved}.ts`,
    `${unresolved}.tsx`,
    `${unresolved}/index.js`,
    `${unresolved}/index.jsx`,
    `${unresolved}/index.ts`,
    `${unresolved}/index.tsx`,
  ];
  return candidates.find((candidate) => sourceText.has(candidate)) ?? null;
}

function publicRouteFromPage(pageFile) {
  const withoutRoot = pageFile
    .replace(/^app\//u, "")
    .replace(/(?:^|\/)page\.(?:js|jsx|ts|tsx)$/u, "");
  return withoutRoot ? `/${withoutRoot}` : "/";
}

function buildRouteMediaGraphs(sourceText, inventoryByPath) {
  const pageFiles = [...sourceText.keys()]
    .filter((file) => /^app\/(?:.+\/)?page\.(?:js|jsx|ts|tsx)$/u.test(file))
    .filter((file) => !/^app\/(?:api|internal)\//u.test(file))
    .sort();

  return pageFiles.map((pageFile) => {
    const queue = [pageFile];
    const visited = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      const text = sourceText.get(current) ?? "";
      for (const specifier of extractImportSpecifiers(text)) {
        const resolved = resolveSourceImport(current, specifier, sourceText);
        if (
          resolved &&
          (resolved.startsWith("app/") ||
            resolved.startsWith("components/"))
        ) {
          queue.push(resolved);
        }
      }
    }

    const assignments = new Map();
    for (const source of [...visited].sort()) {
      const direct = new Set(
        extractMediaReferences(sourceText.get(source) ?? "")
          .map(normalizeMediaPath)
          .filter((mediaPath) => inventoryByPath.has(mediaPath)),
      );
      for (const mediaPath of direct) {
        if (!assignments.has(mediaPath)) assignments.set(mediaPath, []);
        assignments.get(mediaPath).push(source);
      }
    }

    return {
      route: publicRouteFromPage(pageFile),
      pageFile,
      sourceFiles: [...visited].sort(),
      media: [...assignments.entries()]
        .map(([mediaPath, sources]) => ({
          path: mediaPath,
          sha256: inventoryByPath.get(mediaPath)?.sha256 ?? null,
          sources: sources.sort(),
        }))
        .sort((left, right) => left.path.localeCompare(right.path)),
    };
  });
}

function collectionFor(mediaPath, collections) {
  return [...collections]
    .filter((entry) => mediaPath.startsWith(entry.pathPrefix))
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)[0];
}

function contractStatus(mediaPath, contract) {
  const exact = contract.assets.find(
    (asset) => normalizeMediaPath(asset.path) === mediaPath,
  );
  if (exact) return exact.approval;
  return (
    collectionFor(mediaPath, contract.collections)?.defaultApproval ??
    contract.policy.unknownDefault
  );
}

function addViolation(violations, code, detail, extra = {}) {
  violations.push({ code, detail, ...extra });
}

async function main() {
  const contract = JSON.parse(await readFile(CONTRACT_PATH, "utf8"));
  const publicFiles = (await walk(PUBLIC_ROOT))
    .filter((filePath) =>
      MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
    )
    .sort((left, right) => publicPath(left).localeCompare(publicPath(right)));

  const inventory = await mapLimit(publicFiles, 8, async (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    const fileStat = await stat(filePath);
    const measured = await dimensions(filePath, extension);
    const mediaPath = publicPath(filePath);
    const collection = collectionFor(mediaPath, contract.collections);
    const exactContractAsset = contract.assets.find(
      (asset) => normalizeMediaPath(asset.path) === mediaPath,
    );
    return {
      path: mediaPath,
      type: mediaType(extension),
      extension,
      bytes: fileStat.size,
      sha256: await sha256(filePath),
      width: measured.width,
      height: measured.height,
      format: measured.format,
      metadataError: measured.metadataError,
      classification:
        exactContractAsset?.classification ??
        collection?.classification ??
        "unclassified",
      approval: contractStatus(mediaPath, contract),
      referencedBy: [],
    };
  });

  const inventoryByPath = new Map(inventory.map((asset) => [asset.path, asset]));
  const sourceFiles = [];
  for (const sourceRoot of SOURCE_ROOTS) {
    sourceFiles.push(...(await walk(path.join(ROOT, sourceRoot))));
  }

  const references = new Map();
  const queryReferences = [];
  const templateReferences = [];
  const sourceText = new Map();
  for (const sourceFile of sourceFiles
    .filter((filePath) =>
      SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
    )
    .sort()) {
    const relative = slash(path.relative(ROOT, sourceFile));
    const text = await readFile(sourceFile, "utf8");
    sourceText.set(relative, text);
    for (const raw of extractMediaReferences(text)) {
      if (raw.includes("${")) {
        templateReferences.push({ template: raw, source: relative });
        continue;
      }
      const normalized = normalizeMediaPath(raw);
      if (!references.has(normalized)) references.set(normalized, new Set());
      references.get(normalized).add(relative);
      if (raw !== normalized) {
        queryReferences.push({ raw, normalized, source: relative });
      }
    }
  }

  for (const asset of inventory) {
    asset.referencedBy = [...(references.get(asset.path) ?? [])].sort();
  }

  const referenced = inventory
    .filter((asset) => asset.referencedBy.length > 0)
    .map((asset) => asset.path);
  const unreferenced = inventory
    .filter((asset) => asset.referencedBy.length === 0)
    .map((asset) => asset.path);
  const missingReferences = [];
  for (const [mediaPath, locations] of [...references.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (
      inventoryByPath.has(mediaPath) ||
      (await generatedPublicRouteExists(mediaPath))
    ) {
      continue;
    }
    missingReferences.push({
      path: mediaPath,
      referencedBy: [...locations].sort(),
    });
  }

  const hashes = new Map();
  for (const asset of inventory) {
    if (!hashes.has(asset.sha256)) hashes.set(asset.sha256, []);
    hashes.get(asset.sha256).push(asset.path);
  }
  const duplicateHashes = [...hashes.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([sha256Value, paths]) => ({
      sha256: sha256Value,
      paths: paths.sort(),
    }))
    .sort((left, right) => left.paths[0].localeCompare(right.paths[0]));

  const violations = [];
  const warnings = [];
  const minWidth = contract.policy.fullscreenMinimum.width;
  const minHeight = contract.policy.fullscreenMinimum.height;

  for (const asset of contract.assets) {
    const normalized = normalizeMediaPath(asset.path);
    const actual = inventoryByPath.get(normalized);
    const mustExist = [
      "approved",
      "approved-context",
      "preview-only",
    ].includes(asset.approval);

    if (mustExist && !actual) {
      addViolation(
        violations,
        "CONTRACT_ASSET_MISSING",
        `${normalized} is ${asset.approval} but is absent from public/.`,
        { path: normalized },
      );
      continue;
    }
    if (!actual) continue;

    if (
      asset.derivative?.width &&
      actual.width !== asset.derivative.width
    ) {
      addViolation(
        violations,
        "WIDTH_MISMATCH",
        `${normalized} declares ${asset.derivative.width}px but measures ${actual.width ?? "unknown"}px.`,
        { path: normalized },
      );
    }
    if (
      asset.derivative?.height &&
      actual.height !== asset.derivative.height
    ) {
      addViolation(
        violations,
        "HEIGHT_MISMATCH",
        `${normalized} declares ${asset.derivative.height}px but measures ${actual.height ?? "unknown"}px.`,
        { path: normalized },
      );
    }

    for (const route of asset.routes ?? []) {
      if (
        route.fullscreen &&
        (!(actual.width >= minWidth) || !(actual.height >= minHeight))
      ) {
        addViolation(
          violations,
          "FULLSCREEN_NOT_UHD",
          `${normalized} is assigned fullscreen on ${route.path} but measures ${actual.width ?? "unknown"}x${actual.height ?? "unknown"}.`,
          { path: normalized, route: route.path },
        );
      }
    }

    const provider = asset.source?.provider?.toLowerCase() ?? "";
    if (
      asset.approval === "approved" ||
      asset.approval === "approved-context"
    ) {
      if (
        !asset.rights?.status ||
        asset.rights.status.startsWith("pending")
      ) {
        addViolation(
          violations,
          "APPROVED_RIGHTS_INCOMPLETE",
          `${normalized} is approved without a completed rights status.`,
          { path: normalized },
        );
      }
      if (provider.includes("motion array")) {
        const complete =
          asset.source?.assetId &&
          asset.source?.creator &&
          !asset.source.creator.toLowerCase().includes("pending") &&
          asset.source?.url &&
          asset.rights?.record &&
          asset.rights?.privateReceipt &&
          asset.rights?.status === "verified";
        if (!complete) {
          addViolation(
            violations,
            "MOTION_ARRAY_RECORD_INCOMPLETE",
            `${normalized} lacks the production Motion Array record.`,
            { path: normalized },
          );
        }
      }
      if (provider.includes("adobe")) {
        const complete =
          asset.source?.assetId &&
          asset.source?.creator &&
          asset.source?.url &&
          asset.rights?.record &&
          asset.rights?.status === "verified";
        if (!complete) {
          addViolation(
            violations,
            "ADOBE_RECORD_INCOMPLETE",
            `${normalized} lacks a verified clean-original Adobe record.`,
            { path: normalized },
          );
        }
      }
    }

    if (
      provider.includes("higgsfield") &&
      (asset.aiGenerated !== true ||
        asset.routes?.some((route) =>
          /(hero|listing|project|area|property|portrait)/iu.test(route.role),
        ))
    ) {
      addViolation(
        violations,
        "HIGGSFIELD_EVIDENCE_PROHIBITED",
        `${normalized} would place AI media in an evidence-bearing role.`,
        { path: normalized },
      );
    }
  }

  const routeAssignments = new Map();
  for (const asset of contract.assets) {
    const normalized = normalizeMediaPath(asset.path);
    const actual = inventoryByPath.get(normalized);
    for (const route of asset.routes ?? []) {
      if (!routeAssignments.has(route.path)) routeAssignments.set(route.path, []);
      routeAssignments.get(route.path).push({
        path: normalized,
        hash: actual?.sha256 ?? null,
        role: route.role,
      });
    }
  }
  for (const [route, assignments] of routeAssignments) {
    const seenPaths = new Map();
    const seenHashes = new Map();
    for (const assignment of assignments) {
      if (seenPaths.has(assignment.path)) {
        addViolation(
          violations,
          "ROUTE_SOURCE_REPEATED",
          `${route} assigns ${assignment.path} to both ${seenPaths.get(assignment.path)} and ${assignment.role}.`,
          { route, path: assignment.path },
        );
      } else {
        seenPaths.set(assignment.path, assignment.role);
      }
      if (assignment.hash && seenHashes.has(assignment.hash)) {
        addViolation(
          violations,
          "ROUTE_HASH_REPEATED",
          `${route} assigns byte-identical media to ${seenHashes.get(assignment.hash)} and ${assignment.role}.`,
          { route, path: assignment.path },
        );
      } else if (assignment.hash) {
        seenHashes.set(assignment.hash, assignment.role);
      }
    }
  }

  const routeMediaGraphs = buildRouteMediaGraphs(sourceText, inventoryByPath);
  const routeSourceReuseReview = [];
  for (const graph of routeMediaGraphs) {
    for (const media of graph.media) {
      const independentlyMountedSources = media.sources.filter(
        (source) =>
          !source.endsWith(".css") &&
          !/\/page\.(?:js|jsx|ts|tsx)$/u.test(source),
      );
      if (independentlyMountedSources.length > 1) {
        addViolation(
          violations,
          "ROUTE_GRAPH_SOURCE_REPEATED",
          `${graph.route} reaches ${media.path} from multiple mounted source files.`,
          {
            route: graph.route,
            path: media.path,
            sources: media.sources,
          },
        );
      } else if (media.sources.length > 1) {
        routeSourceReuseReview.push({
          route: graph.route,
          path: media.path,
          sources: media.sources,
          reason:
            "Shared with route metadata or a responsive CSS state; browser visibility review remains required.",
        });
      }
    }

    const routeHashes = new Map();
    for (const media of graph.media) {
      if (!media.sha256) continue;
      if (!routeHashes.has(media.sha256)) routeHashes.set(media.sha256, []);
      routeHashes.get(media.sha256).push(media.path);
    }
    for (const [hash, paths] of routeHashes) {
      const uniquePaths = [...new Set(paths)];
      if (uniquePaths.length > 1) {
        addViolation(
          violations,
          "ROUTE_GRAPH_HASH_REPEATED",
          `${graph.route} reaches byte-identical media through ${uniquePaths.join(", ")}.`,
          { route: graph.route, sha256: hash, paths: uniquePaths.sort() },
        );
      }
    }
  }

  const playbackComponents = new Map();
  for (const entry of contract.playback ?? []) {
    const normalized = normalizeMediaPath(entry.path);
    const asset = contract.assets.find(
      (candidate) => normalizeMediaPath(candidate.path) === normalized,
    );
    if (!asset) {
      addViolation(
        violations,
        "PLAYBACK_ASSET_UNREGISTERED",
        `${normalized} has a playback record but no asset record.`,
        { path: normalized },
      );
    }
    if (
      entry.publicState === "mounted" &&
      !["approved", "approved-context"].includes(asset?.approval)
    ) {
      addViolation(
        violations,
        "MOUNTED_MEDIA_NOT_APPROVED",
        `${normalized} is mounted but has approval ${asset?.approval ?? "missing"}.`,
        { path: normalized },
      );
    }
    if (entry.autoplay !== false) {
      addViolation(
        violations,
        "AUTOPLAY_PROHIBITED",
        `${normalized} is not explicitly autoplay:false.`,
        { path: normalized },
      );
    }
    if (
      entry.audio === true &&
      !["click", "user-gesture", "native-controls-click"].includes(
        entry.trigger,
      )
    ) {
      addViolation(
        violations,
        "AUDIO_NOT_OPT_IN",
        `${normalized} can produce audio without an explicit gesture.`,
        { path: normalized },
      );
    }
    if (!playbackComponents.has(entry.component)) {
      playbackComponents.set(entry.component, []);
    }
    playbackComponents.get(entry.component).push(normalized);
  }

  for (const [component, assets] of playbackComponents) {
    const text = sourceText.get(component);
    if (text === undefined) {
      addViolation(
        violations,
        "PLAYBACK_COMPONENT_MISSING",
        `${component} is registered for ${assets.join(", ")} but was not found.`,
        { component },
      );
      continue;
    }
    if (/<video\b[\s\S]{0,700}\bautoPlay\b/u.test(text)) {
      addViolation(
        violations,
        "AUTOPLAY_ATTRIBUTE_FOUND",
        `${component} contains an autoPlay video attribute.`,
        { component },
      );
    }
  }

  const dormantEntries = contract.dormantMedia ?? [];
  const dormantPaths = dormantEntries.flatMap((entry) =>
    entry.paths ? entry.paths : entry.path ? [entry.path] : [],
  );
  const dormantMissing = dormantPaths
    .map(normalizeMediaPath)
    .filter((mediaPath) => !inventoryByPath.has(mediaPath));
  if (dormantMissing.length > 0) {
    warnings.push({
      code: "DORMANT_REGISTER_STALE",
      detail: `${dormantMissing.length} dormant register paths are absent.`,
      paths: dormantMissing.sort(),
    });
  }

  const motionFiles = contract.motion?.activeSources ?? [];
  const motionText = motionFiles
    .map((file) => sourceText.get(file) ?? "")
    .join("\n");
  const lenisOwners = (
    motionText.match(/\bnew\s+Lenis\s*\(/gu) ?? []
  ).length;
  if (lenisOwners > (contract.motion?.maximumScrollEngines ?? 1)) {
    addViolation(
      violations,
      "MULTIPLE_SCROLL_ENGINES",
      `${lenisOwners} active Lenis instances exceed the contract maximum.`,
    );
  }
  if (
    contract.motion?.scrollEngineOwner &&
    !motionText.includes("prefers-reduced-motion")
  ) {
    addViolation(
      violations,
      "REDUCED_MOTION_GATE_MISSING",
      "The active motion sources do not contain a reduced-motion gate.",
    );
  }
  for (const pattern of contract.motion?.bannedPatterns ?? []) {
    const expression = new RegExp(
      `\\b${pattern.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replaceAll(" ", "\\s+")}\\b`,
      "iu",
    );
    if (expression.test(motionText)) {
      addViolation(
        violations,
        "BANNED_MOTION_PATTERN",
        `Active motion sources contain the banned pattern "${pattern}".`,
      );
    }
  }

  const randomMediaSelection =
    /(?:Math\.random\(\)[\s\S]{0,160}\b(?:asset|fallback|image|media|poster|video)s?\b|\b(?:asset|fallback|image|media|poster|video)s?\b[\s\S]{0,160}Math\.random\(\))/iu;
  const randomFallbackFiles = [...sourceText.entries()]
    .filter(([, text]) => randomMediaSelection.test(text))
    .map(([file]) => file)
    .sort();
  if (randomFallbackFiles.length > 0) {
    warnings.push({
      code: "RANDOM_MEDIA_LOGIC_REVIEW",
      detail:
        "Files combine Math.random with media-related terms; verify that no unrelated fallback is selected.",
      files: randomFallbackFiles,
    });
  }

  const counts = {
    total: inventory.length,
    images: inventory.filter((asset) => asset.type === "image").length,
    videos: inventory.filter((asset) => asset.type === "video").length,
    audio: inventory.filter((asset) => asset.type === "audio").length,
    bytes: inventory.reduce((sum, asset) => sum + asset.bytes, 0),
    referenced: referenced.length,
    unreferenced: unreferenced.length,
    missingReferences: missingReferences.length,
    duplicateHashGroups: duplicateHashes.length,
    contractAssets: contract.assets.length,
    violations: violations.length,
    warnings: warnings.length,
  };

  const report = {
    audit: "Batch 9 Orders 69-77 media/UHD/motion contract",
    auditVersion: 1,
    site: contract.site,
    reviewedAt: contract.reviewedAt,
    status: violations.length === 0 ? "PASS" : "FAIL",
    counts,
    inventory,
    references: {
      referenced,
      unreferenced,
      missing: missingReferences,
      dynamicTemplates: templateReferences.sort((left, right) =>
        `${left.template}:${left.source}`.localeCompare(
          `${right.template}:${right.source}`,
        ),
      ),
      queryOrFragmentReferences: queryReferences.sort((left, right) =>
        `${left.normalized}:${left.source}`.localeCompare(
          `${right.normalized}:${right.source}`,
        ),
      ),
    },
    duplicates: duplicateHashes,
    routeMediaGraphs,
    routeSourceReuseReview,
    contract: {
      path: "config/media-contract.json",
      fullscreenMinimum: contract.policy.fullscreenMinimum,
      assetStatuses: Object.fromEntries(
        inventory.map((asset) => [asset.path, asset.approval]),
      ),
      runtimeBrowserChecksPending: [
        "Rendered fullscreen video videoWidth/videoHeight at desktop viewport",
        "Computed horizontal overflow at desktop, tablet and mobile",
        "Sticky-section release and reduced-motion screenshots",
      ],
    },
    violations,
    warnings,
  };

  const argumentsList = process.argv.slice(2);
  const jsonIndex = argumentsList.findIndex(
    (value) => value === "--json" || value.startsWith("--json="),
  );
  let jsonDestination = null;
  let emitJson = false;
  if (jsonIndex >= 0) {
    emitJson = true;
    const value = argumentsList[jsonIndex];
    if (value.includes("=")) {
      jsonDestination = value.slice(value.indexOf("=") + 1);
    } else {
      const following = argumentsList[jsonIndex + 1];
      if (following && !following.startsWith("--")) {
        jsonDestination = following;
      }
    }
  }

  if (emitJson && jsonDestination) {
    const destination = path.resolve(ROOT, jsonDestination);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Media audit ${report.status}: ${slash(path.relative(ROOT, destination))}`);
  } else if (emitJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`${contract.site} media audit: ${report.status}`);
    console.log(
      `Inventory ${counts.total} (${counts.images} images, ${counts.videos} videos, ${counts.audio} audio)`,
    );
    console.log(
      `References ${counts.referenced} used, ${counts.unreferenced} unused, ${counts.missingReferences} missing`,
    );
    console.log(
      `Hashes ${counts.duplicateHashGroups} duplicate groups · Contract ${counts.violations} violations, ${counts.warnings} warnings`,
    );
    for (const violation of violations.slice(0, 20)) {
      console.log(`FAIL ${violation.code}: ${violation.detail}`);
    }
    if (violations.length > 20) {
      console.log(`… ${violations.length - 20} more violations in JSON output`);
    }
  }

  process.exitCode = violations.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
