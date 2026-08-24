import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import mediaContract from "../config/media-contract.json";

const read = (path: string) => readFileSync(resolve(path));
const text = (path: string) => read(path).toString("utf8");
const sha256 = (path: string) =>
  createHash("sha256").update(read(path)).digest("hex");

const approvedFiles = {
  "app/brand/approved-v1.2-package/Montserrat-ExtraBold.ttf":
    "257af9a05de6371e1f7b345d02a93af5c2e0ab9b9224418a45189b8cc86049cd",
  "app/brand/approved-v1.2-package/Geist-Variable.woff2":
    "affce75284deca6a9b57e425ee2cf3550e512982310473ec7ad6ce5083ea0a47",
  "app/brand/approved-v1.2-package/GeistMono-Variable.woff2":
    "f2da1b1b4ebdc63fdf5ca847e8ed1b7c66eced0142e624d558af86cc26f53d5f",
  "public/brand/v1.2/IWR-B04-CORRECTED-Render-Safe-Color.svg":
    "f1150402f240fb66382152491e6d2e40fa93150632977721ad858eeb151e6d79",
  "public/brand/v1.2/IWR-B04-CORRECTED-Render-Safe-Knockout.svg":
    "eaff363eb64c89b164abb08887555af164339b901314c987925431bd53fb9a58",
} as const;

for (const [path, expected] of Object.entries(approvedFiles)) {
  assert.equal(sha256(path), expected, `${path} drifted from approved v1.2`);
}

const tokens = text("app/brand/brand-tokens.css");
for (const token of [
  "--iwr-ink: #0b0d12",
  "--iwr-paper: #f0f0ec",
  "--iwr-cobalt: #4050c8",
  "--iwr-cobalt-soft: #b8c0ff",
  "--iwr-architectural-slate: #969ab1",
  'font-family: "IWR Montserrat"',
  'font-family: "IWR Geist"',
  'font-family: "IWR Geist Mono"',
]) {
  assert.ok(tokens.includes(token), `Missing governed token: ${token}`);
}

const layout = text("app/layout.tsx");
assert.match(layout, /brand\/brand-tokens\.css/u);
assert.match(layout, /data-iwr-brand-version="v1\.2"/u);
assert.equal(layout.includes("fonts.googleapis.com"), false);

const chrome = text("components/redesign/NewsChrome.tsx");
const footer = text("components/redesign/NewsFooter.tsx");
const consent = text("components/consent/ConsentBanner.tsx");
for (const source of [chrome, footer]) {
  assert.match(source, /IwrMark/u);
  assert.equal(source.includes("TduMark"), false);
}
assert.equal(chrome.includes('className={styles.mark}>IR'), false);
assert.match(consent, /var\(--iwr-ink\)/u);
assert.match(consent, /var\(--iwr-cobalt\)/u);
assert.equal(/#[\da-f]{3,8}|shadow|backdrop|gold|cyan|green|glow|glass/iu.test(consent), false);

const publicCss = [
  "components/redesign/NewsChrome.module.css",
  "components/redesign/NewsFooter.module.css",
  "components/redesign/NewsHome.module.css",
  "components/redesign/NewsArchive.module.css",
  "components/redesign/NewsArticle.module.css",
  "app/about/AboutPages.module.css",
  "app/legal/privacy/Privacy.module.css",
  "app/ask/ask.module.css",
  "components/terminal/TerminalShell.module.css",
  "app/areas/AreaPages.module.css",
  "app/developers/DeveloperPages.module.css",
  "app/NotFound.module.css",
].map(text);

for (const css of publicCss) {
  assert.match(css, /var\(--iwr-/u);
  assert.equal(/#[\da-f]{3,8}/iu.test(css), false);
  assert.equal(/radial-gradient|backdrop-filter|box-shadow/iu.test(css), false);
  assert.equal(/var\(--font-geist|Georgia|Fraunces|Playfair/iu.test(css), false);
}

for (const css of publicCss.slice(2)) {
  assert.match(css, /var\(--iwr-font-display\)/u);
  assert.match(css, /var\(--iwr-font-body\)/u);
}

const approvedBrandPaths = new Set(
  mediaContract.assets
    .filter((asset) => asset.classification === "approved-brand-identity")
    .map((asset) => asset.path),
);
assert.deepEqual(
  [...approvedBrandPaths].sort(),
  [
    "/brand/v1.2/IWR-B04-CORRECTED-Render-Safe-Color.svg",
    "/brand/v1.2/IWR-B04-CORRECTED-Render-Safe-Knockout.svg",
  ],
);

const icon = text("app/icon.svg");
assert.equal(sha256("public/icon.svg"), sha256("app/icon.svg"));
assert.match(icon, /#0B0D12/u);
assert.match(icon, /#4050C8/u);
assert.match(icon, /#F0F0EC/u);
assert.equal(/#D7BC79|#F8F4EA/iu.test(icon), false);

console.log(
  "Newsroom v1.2 brand PASS: 5 canonical binaries, 6 governed colours, 3 type families, exact IWR identity and 12 public surface styles.",
);
