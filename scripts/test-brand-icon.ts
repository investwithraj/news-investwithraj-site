import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GET as getFavicon, HEAD as headFavicon } from "@/app/api/favicon/route";
import {
  FAVICON_REDIRECT_CACHE_CONTROL,
  IWR_ICON_SHA256,
  IWR_ICON_URL,
} from "@/lib/brand-icon";
import nextConfig from "../next.config";

type IconLink = {
  href: string;
  rel: string;
};

type ConfiguredRewrite = {
  destination: string;
  source: string;
};

type ConfiguredHeader = {
  headers: Array<{ key: string; value: string }>;
  source: string;
};

const root = process.cwd();

async function main(): Promise<void> {
  const runtimeBase = process.argv[2];
  assert.ok(
    runtimeBase,
    "Usage: tsx scripts/test-brand-icon.ts http://127.0.0.1:<port>",
  );

  const iconBytes = readFileSync(resolve(root, "app/icon.svg"));
  assert.equal(
    createHash("sha256").update(iconBytes).digest("hex"),
    IWR_ICON_SHA256,
    "app/icon.svg changed without updating its content-addressed URL.",
  );

  const layoutSource = readFileSync(resolve(root, "app/layout.tsx"), "utf8");
  const iconsMatch = layoutSource.match(
    /  icons: \{([\s\S]*?)\n  \},\n  (?:manifest|appleWebApp):/,
  );
  assert.ok(iconsMatch, "Root metadata is missing its icons contract.");
  const iconsBlock = iconsMatch[1];
  assert.match(iconsBlock, /icon:\s*\[\{\s*url:\s*IWR_ICON_URL,/);
  assert.match(iconsBlock, /shortcut:\s*\[\{\s*url:\s*IWR_ICON_URL,/);
  assert.doesNotMatch(iconsBlock, /https?:|vercel|arti/i);

  await assertConfiguredContract();
  await assertRuntimeContract(new URL(runtimeBase));

  console.log(
    `Brand icon contract passed at ${runtimeBase}: rendered links, GET/HEAD redirect, one-hop SVG response, and SHA-256 ${IWR_ICON_SHA256}.`,
  );
}

async function assertConfiguredContract(): Promise<void> {
  const configureRewrites = nextConfig.rewrites;
  if (typeof configureRewrites !== "function") {
    assert.fail("next.config.ts must define rewrites().");
  }
  const rewrites = (await configureRewrites()) as ConfiguredRewrite[];
  const faviconRewrites = rewrites.filter(
    ({ source }) => source === "/favicon.ico",
  );
  assert.deepEqual(faviconRewrites, [
    {
      source: "/favicon.ico",
      destination: "/api/favicon",
    },
  ]);

  for (const [method, handler] of [
    ["GET", getFavicon],
    ["HEAD", headFavicon],
  ] as const) {
    const response = handler();
    assert.equal(response.status, 307, `${method} /favicon.ico must redirect.`);
    assert.equal(response.headers.get("Location"), IWR_ICON_URL);
    assert.equal(
      response.headers.get("Cache-Control"),
      FAVICON_REDIRECT_CACHE_CONTROL,
    );
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  }

  const configureHeaders = nextConfig.headers;
  if (typeof configureHeaders !== "function") {
    assert.fail("next.config.ts must define headers().");
  }
  const headers = (await configureHeaders()) as ConfiguredHeader[];
  assert.ok(
    headers.every(({ source }) => !source.includes("ico")),
    "No broader header rule may override the favicon cache policy.",
  );
}

async function assertRuntimeContract(base: URL): Promise<void> {
  const pageResponse = await fetch(new URL("/", base), { redirect: "manual" });
  assert.equal(pageResponse.status, 200, "The rendered root page must return 200.");
  const html = await pageResponse.text();
  const iconLinks = parseIconLinks(html);
  const browserIconLinks = iconLinks.filter(({ rel }) =>
    rel.toLowerCase().split(/\s+/).includes("icon"),
  );

  assert.ok(browserIconLinks.length >= 2, "Rendered HTML is missing icon links.");
  for (const { href, rel } of browserIconLinks) {
    const target = new URL(href, base);
    assert.equal(target.origin, base.origin, `${rel} icon must stay same-origin.`);
    assert.equal(target.pathname, "/icon.svg", `${rel} must use the IWR SVG.`);
    assert.equal(
      `${target.pathname}${target.search}`,
      IWR_ICON_URL,
      `${rel} must use the content-addressed IWR SVG.`,
    );
    assert.doesNotMatch(href, /vercel|arti/i);
  }
  assert.ok(
    browserIconLinks.some(({ rel }) => rel.toLowerCase() === "icon"),
    "Rendered HTML is missing rel=icon.",
  );
  assert.ok(
    browserIconLinks.some(({ rel }) => rel.toLowerCase() === "shortcut icon"),
    "Rendered HTML is missing rel=shortcut icon.",
  );

  const allIconLinks = iconLinks.filter(({ rel }) => /icon/i.test(rel));
  const allowsAppleIcon = existsSync(resolve(root, "app/apple-icon.tsx"));
  for (const { href, rel } of allIconLinks) {
    const target = new URL(href, base);
    assert.equal(target.origin, base.origin, `${rel} must stay same-origin.`);
    assert.ok(
      target.pathname === "/icon.svg" ||
        (allowsAppleIcon && target.pathname === "/apple-icon"),
      `Rendered ${rel} points to an unapproved icon: ${href}`,
    );
    assert.doesNotMatch(href, /vercel|arti/i);
  }

  if (allowsAppleIcon) {
    assert.ok(
      allIconLinks.some(
        ({ rel, href }) =>
          rel.toLowerCase() === "apple-touch-icon" &&
          new URL(href, base).pathname === "/apple-icon",
      ),
      "The advisory Apple icon behavior must be preserved.",
    );
    assert.ok(
      parseLinks(html).some(
        ({ rel, href }) =>
          rel.toLowerCase() === "manifest" &&
          new URL(href, base).pathname === "/manifest.webmanifest",
      ),
      "The advisory PWA manifest link must be preserved.",
    );
  }

  for (const method of ["GET", "HEAD"] as const) {
    const faviconResponse = await fetch(new URL("/favicon.ico", base), {
      method,
      redirect: "manual",
    });
    assert.equal(
      faviconResponse.status,
      307,
      `${method} /favicon.ico must no longer return 404.`,
    );
    assert.equal(
      faviconResponse.headers.get("Cache-Control"),
      FAVICON_REDIRECT_CACHE_CONTROL,
    );
    const location = faviconResponse.headers.get("Location");
    assert.ok(location, `${method} /favicon.ico is missing Location.`);
    const target = new URL(location, base);
    assert.equal(target.origin, base.origin, "The favicon redirect must be same-origin.");
    assert.equal(`${target.pathname}${target.search}`, IWR_ICON_URL);

    const iconResponse = await fetch(target, { method, redirect: "manual" });
    assert.equal(iconResponse.status, 200, `${method} IWR SVG must return 200.`);
    assert.equal(
      iconResponse.headers.get("Location"),
      null,
      "The IWR SVG must terminate the redirect after one hop.",
    );
    assert.match(
      iconResponse.headers.get("Content-Type") ?? "",
      /^image\/svg\+xml\b/i,
    );
    if (method === "GET") {
      const servedBytes = Buffer.from(await iconResponse.arrayBuffer());
      assert.equal(
        createHash("sha256").update(servedBytes).digest("hex"),
        IWR_ICON_SHA256,
        "The runtime icon bytes differ from the pinned IWR SVG.",
      );
    }
  }
}

function parseIconLinks(html: string): IconLink[] {
  return parseLinks(html).filter(({ rel }) => /icon/i.test(rel));
}

function parseLinks(html: string): IconLink[] {
  return [...html.matchAll(/<link\b[^>]*>/gi)].flatMap(([tag]) => {
    const rel = attribute(tag, "rel");
    const href = attribute(tag, "href");
    return rel && href ? [{ rel, href }] : [];
  });
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match?.[1] ?? match?.[2] ?? null;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
