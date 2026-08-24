import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import mediaContract from "../config/media-contract.json";
import {
  APPROVED_NEWSROOM_PUBLIC_MEDIA_PATHS,
  UNKNOWN_NEWSROOM_PUBLIC_MEDIA_PATHS,
  WITHHELD_NEWSROOM_PUBLIC_MEDIA_PATHS,
  decideNewsroomPublicMedia,
} from "../lib/public-media-policy";

const approved = mediaContract.assets.map((asset) => asset.path).sort();
const withheld = mediaContract.dormantMedia
  .flatMap((entry) => [
    ...(Object.hasOwn(entry, "path") ? [entry.path as string] : []),
    ...(Object.hasOwn(entry, "paths") ? (entry.paths as string[]) : []),
  ])
  .sort();

function enumerateFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? enumerateFiles(absolute) : [absolute];
  });
}

const publicRoot = path.join(process.cwd(), "public");
const governedOnDisk = [
  "/hero.mp4",
  ...["audio", "brand", "cinema", "media/real-uhd", "media/verified"].flatMap(
    (prefix) =>
      enumerateFiles(path.join(publicRoot, prefix)).map(
        (absolute) =>
          `/${path.relative(publicRoot, absolute).split(path.sep).join("/")}`,
      ),
  ),
].sort();

assert.equal(approved.length, 18);
assert.equal(new Set(approved).size, 18);
assert.deepEqual(APPROVED_NEWSROOM_PUBLIC_MEDIA_PATHS, approved);
assert.equal(withheld.length, 31);
assert.equal(new Set(withheld).size, 31);
assert.deepEqual(WITHHELD_NEWSROOM_PUBLIC_MEDIA_PATHS, withheld);

for (const mediaPath of approved) {
  assert.deepEqual(decideNewsroomPublicMedia(mediaPath), {
    allowed: true,
    state: "approved",
  });
  assert.equal(
    existsSync(path.join(process.cwd(), "public", mediaPath.slice(1))),
    true,
    `${mediaPath} must exist`,
  );
}
for (const mediaPath of withheld) {
  assert.deepEqual(decideNewsroomPublicMedia(mediaPath), {
    allowed: false,
    state: "withheld",
  });
  assert.equal(
    existsSync(path.join(process.cwd(), "public", mediaPath.slice(1))),
    true,
    `${mediaPath} denial must cover an actual dormant file`,
  );
}

const unknownGovernedPaths = [...mediaContract.unknownGovernedMedia].sort();
assert.equal(unknownGovernedPaths.length, 16);
assert.deepEqual(UNKNOWN_NEWSROOM_PUBLIC_MEDIA_PATHS, unknownGovernedPaths);
const governedAuthority = [...approved, ...withheld, ...unknownGovernedPaths].sort();
assert.equal(governedOnDisk.length, 65);
assert.equal(new Set(governedOnDisk).size, 65);
assert.deepEqual(
  governedOnDisk,
  governedAuthority,
  "Every governed on-disk public file must be classified exactly once",
);
for (const mediaPath of unknownGovernedPaths) {
  assert.equal(existsSync(path.join(process.cwd(), "public", mediaPath.slice(1))), true);
  assert.deepEqual(decideNewsroomPublicMedia(mediaPath), {
    allowed: false,
    state: "unknown",
  });
}
for (const mediaPath of [
  "/media/verified/areas/not-recorded.webp",
  "/media/real-uhd/not-raj.webp",
  "/cinema/not-recorded.mp4",
  "/audio/not-recorded.mp3",
]) {
  assert.deepEqual(decideNewsroomPublicMedia(mediaPath), {
    allowed: false,
    state: "unknown",
  });
}
for (const route of ["/", "/news", "/about", "/icon.svg", "/images/article.jpg"]) {
  assert.deepEqual(decideNewsroomPublicMedia(route), {
    allowed: true,
    state: "ungoverned",
  });
}

const proxySource = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
assert.match(proxySource, /decideNewsroomPublicMedia/u);
for (const matcher of [
  "/audio/:path*",
  "/brand/:path*",
  "/cinema/:path*",
  "/media/real-uhd/:path*",
  "/media/verified/:path*",
  "/hero.mp4",
]) {
  assert.ok(proxySource.includes(`"${matcher}"`), `${matcher} proxy matcher missing`);
}
assert.match(proxySource, /noindex, nofollow, noarchive/u);
assert.match(proxySource, /status:\s*404/u);

console.log(
  "Newsroom public-media policy passed: 18 approved, 31 explicit withheld, 16 on-disk unknown governed assets, unknown fail-closed and app routes unaffected.",
);
