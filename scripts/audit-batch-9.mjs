import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const NEWS_BASE =
  process.env.IWR_NEWS_AUDIT_URL ?? "http://localhost:3130";
const ADVISORY_BASE =
  process.env.IWR_ADVISORY_AUDIT_URL ?? "http://localhost:3127";
const NEWS_CANONICAL =
  process.env.IWR_NEWS_CANONICAL_URL ?? "https://news.investwithraj.com";
const OUTPUT = path.resolve(
  process.env.IWR_BATCH_9_OUTPUT ?? "outputs/batch-9-orders-58-77-audit",
);
const STATIC_ONLY = process.env.STATIC_ONLY === "1";
const CHROME =
  process.env.IWR_CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BUNDLED_MODULES =
  process.env.CODEX_BUNDLED_NODE_MODULES ??
  "C:\\Users\\RAJTO\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(BUNDLED_MODULES, "_iwr-batch-9.cjs"));

const ROUTES = [
  {
    order: 58,
    key: "terminal",
    path: "/terminal",
    noindex: false,
    schema: ["WebApplication", "BreadcrumbList"],
    required: [/source/i, /fresh/i, /book.*Raj|working call/i],
    forbidden: [
      /simulated (?:transaction feed|trade tape)/i,
      /Bloomberg/i,
      /live transaction/i,
    ],
  },
  {
    order: 59,
    key: "ask",
    path: "/ask",
    noindex: true,
    schema: ["WebPage", "BreadcrumbList"],
    required: [/AI-generated|AI research/i, /source/i, /Raj/i],
    forbidden: [/I am Raj/i, /signed by Raj/i, /Buy\s*\/\s*Watch\s*\/\s*Avoid/i],
  },
  {
    order: 60,
    key: "spatial",
    path: "/spatial",
    noindex: true,
    schema: ["CollectionPage", "ItemList", "BreadcrumbList"],
    required: [/browser|flat web/i, /desk|directory/i, /area atlas/i],
    forbidden: [/pinch to/i, /gaze to/i, /WebXR required/i, /headset required/i],
  },
  {
    order: 61,
    key: "wallet",
    path: "/wallet",
    noindex: true,
    schema: ["WebPage", "BreadcrumbList"],
    required: [/unsigned|not a signed/i, /coming soon/i, /concept/i],
    forbidden: [/installed successfully/i, /delivered daily/i, /live pass/i],
  },
  {
    order: 62,
    key: "about",
    path: "/about",
    noindex: false,
    schema: ["ProfilePage", "BreadcrumbList", "Person"],
    required: [/Raj Tomar/i, /publisher|publication/i, /advisory/i],
    forbidden: [/Wharton/i, /\bMBA\b/i, /\bB\.?Plan\b/i, /10\+ years/i],
  },
  {
    order: 63,
    key: "editorial-standards",
    path: "/about/editorial-standards",
    noindex: false,
    schema: ["WebPage", "BreadcrumbList"],
    required: [/evidence/i, /correction/i, /artificial intelligence|AI/i],
    forbidden: [],
  },
  {
    order: 64,
    key: "privacy",
    path: "/legal/privacy",
    noindex: false,
    schema: ["WebPage", "BreadcrumbList"],
    required: [
      /analytics/i,
      /AI-generated briefs|artificial intelligence/i,
      /preferences saved in your browser|local storage/i,
    ],
    forbidden: [/rajtomar\.dxb@gmail\.com/i],
  },
];

const VIEWPORTS = [
  { key: "desktop", width: 1440, height: 1000, reducedMotion: "no-preference" },
  { key: "tablet", width: 768, height: 1024, reducedMotion: "no-preference" },
  { key: "mobile", width: 390, height: 844, reducedMotion: "no-preference" },
  { key: "reduced", width: 390, height: 844, reducedMotion: "reduce" },
];

const REQUIRED_INTERACTION_EVENTS = [
  "nav_open",
  "nav_close",
  "nav_click",
  "book_call_click",
  "booking_open",
  "booking_complete",
  "booking_close",
  "whatsapp_click",
  "brief_start",
  "brief_step",
  "brief_complete",
  "lead_submit_success",
  "lead_submit_error",
  "area_open",
  "developer_open",
  "project_open",
  "note_open",
  "guide_open",
  "calculator_start",
  "calculator_complete",
  "video_start",
  "video_25",
  "video_50",
  "video_75",
  "video_complete",
  "news_to_advisory",
  "article_source_open",
  "ai_brief_start",
  "ai_brief_complete",
  "ai_brief_error",
  "newsletter_signup",
];

const checks = [];
const failures = [];

function check(scope, name, pass, detail = "") {
  const item = { scope, name, pass: Boolean(pass), detail: String(detail) };
  checks.push(item);
  if (!item.pass) failures.push(item);
}

function flattenSchemas(schemas) {
  return schemas.flatMap((schema) => {
    if (Array.isArray(schema)) return flattenSchemas(schema);
    if (Array.isArray(schema?.["@graph"])) return schema["@graph"];
    return [schema];
  });
}

async function readSources(files) {
  const results = [];
  for (const file of files) {
    try {
      results.push({ file, source: await readFile(file, "utf8") });
    } catch {
      check("static", `${file} exists`, false);
    }
  }
  return results;
}

async function staticChecks() {
  const routeFiles = [
    "app/terminal/page.tsx",
    "components/terminal/TerminalShell.tsx",
    "app/ask/page.tsx",
    "app/ask/AskRajClient.tsx",
    "app/api/brief/route.ts",
    "app/spatial/page.tsx",
    "app/wallet/page.tsx",
    "app/api/wallet/install/route.ts",
    "app/about/page.tsx",
    "app/about/editorial-standards/page.tsx",
    "app/legal/privacy/page.tsx",
    "app/internal/review/page.tsx",
    "app/internal/dashboard/page.tsx",
    "app/internal/dashboard/DashboardClient.tsx",
    "app/api/queue/add/route.ts",
    "app/api/queue/action/[id]/route.ts",
    "lib/news-review/auth.ts",
    "lib/schema/person.ts",
    "lib/schema/organization.ts",
    "lib/schema/area.ts",
    "lib/analytics.ts",
    "components/analytics/InteractionAnalytics.tsx",
    "components/redesign/NewsChrome.tsx",
    "components/redesign/NewsFooter.tsx",
    "../iwr-redesign/lib/analytics.ts",
    "../iwr-redesign/components/analytics/InteractionAnalytics.tsx",
    "../iwr-redesign/components/redesign/BookButton.tsx",
    "../iwr-redesign/components/redesign/RedesignNav.tsx",
    "../iwr-redesign/components/redesign/RedesignFooter.tsx",
    "../iwr-redesign/scripts/audit-cross-site-links.mjs",
    "proxy.ts",
  ];
  const entries = await readSources(routeFiles);
  const source = entries
    .filter(({ file: name }) => !name.includes("/scripts/") && !name.startsWith("scripts/"))
    .map(({ source: value }) => value)
    .join("\n");
  const file = (name) =>
    entries.find((entry) => entry.file === name)?.source ?? "";
  const terminal = `${file("app/terminal/page.tsx")}\n${file(
    "components/terminal/TerminalShell.tsx",
  )}`;
  const ask = `${file("app/ask/AskRajClient.tsx")}\n${file(
    "app/api/brief/route.ts",
  )}`;
  const spatial = file("app/spatial/page.tsx");
  const wallet = `${file("app/wallet/page.tsx")}\n${file(
    "app/api/wallet/install/route.ts",
  )}`;
  const about = `${file("app/about/page.tsx")}\n${file(
    "lib/schema/person.ts",
  )}`;
  const auth = file("lib/news-review/auth.ts");
  const dashboard = file("app/internal/dashboard/DashboardClient.tsx");
  const newsAnalytics = `${file("lib/analytics.ts")}\n${file(
    "components/analytics/InteractionAnalytics.tsx",
  )}`;
  const advisoryAnalytics = `${file(
    "../iwr-redesign/lib/analytics.ts",
  )}\n${file(
    "../iwr-redesign/components/analytics/InteractionAnalytics.tsx",
  )}`;
  const ctaSource = [
    file("components/redesign/NewsChrome.tsx"),
    file("components/redesign/NewsFooter.tsx"),
    file("../iwr-redesign/components/redesign/BookButton.tsx"),
    file("../iwr-redesign/components/redesign/RedesignNav.tsx"),
    file("../iwr-redesign/components/redesign/RedesignFooter.tsx"),
  ].join("\n");
  const linkAudit = file("../iwr-redesign/scripts/audit-cross-site-links.mjs");

  check(
    "static",
    "forbidden brands and stale contact email are absent",
    !/pangea|better[ -]?parker|rajtomar\.dxb@gmail\.com/i.test(source),
  );
  check(
    "order-58:static",
    "Terminal contains no random or simulated market tape",
    !/Math\.random|simulated (?:transaction feed|trade tape)|Bloomberg terminal/i.test(
      terminal,
    ),
  );
  check(
    "order-59:static",
    "Ask cannot sign as Raj or emit Buy/Watch/Avoid advice",
    !/I am Raj|signed by Raj|Buy\s*\/\s*Watch\s*\/\s*Avoid/i.test(ask),
  );
  check(
    "order-59:static",
    "Ask enforces source and hourly request boundaries",
    /source/i.test(ask) && /5|five/.test(ask) && /hour/i.test(ask),
  );
  check(
    "order-60:static",
    "Spatial makes no unsupported gaze, pinch or WebXR claim",
    !/pinch to|gaze to|WebXR required|headset required/i.test(spatial),
  );
  check(
    "order-61:static",
    "Wallet is visibly unsigned and cannot return a live install URL",
    /unsigned/i.test(wallet) &&
      /coming soon/i.test(wallet) &&
      !/installUrl\s*:\s*["'`]https?:|signed pass ready|daily delivery is active/i.test(
        wallet,
      ),
  );
  check(
    "order-62:static",
    "About and Person schema contain no unsupported credentials",
    !/Wharton|\bMBA\b|\bB\.?Plan\b|10\+ years|Licensed Real Estate Broker/i.test(
      about,
    ),
  );
  check(
    "order-65:static",
    "internal pages are explicitly noindex",
    /robots:\s*\{\s*index:\s*false/i.test(
      file("app/internal/review/page.tsx"),
    ) &&
      /robots:\s*\{\s*index:\s*false/i.test(
        file("app/internal/dashboard/page.tsx"),
      ),
  );
  check(
    "order-65:static",
    "dashboard does not prompt for or persist a URL secret",
    !/prompt\([^)]*secret|sessionStorage|[?&]secret=|POST_PUBLISH_SECRET/i.test(
      dashboard,
    ),
  );
  check(
    "order-65:static",
    "query credentials are rejected and browser mutations require same origin",
    /queryCredentialPresent/.test(auth) &&
      /Credentials in URLs are rejected/.test(auth) &&
      /sameOriginMutation/.test(auth),
  );
  check(
    "orders-58-64:static",
    "route pages do not contain autoplay or background video",
    !/<video|autoPlay|autoplay|backgroundVideo/i.test(
      entries
        .filter(({ file: name }) =>
          /^app\/(terminal|ask|spatial|wallet|about|legal\/privacy)/.test(name),
        )
        .map(({ source: value }) => value)
        .join("\n"),
    ),
  );
  check(
    "orders-58-64:static",
    "JSON-LD insertion uses the repository sanitizer",
    !/dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify\([^)]*\)\s*\}\}/.test(
      source,
    ),
  );
  check(
    "order-66:static",
    "both sites implement all three CTA levels",
    ["1", "2", "3"].every((level) =>
      ctaSource.includes(`data-cta-level="${level}"`),
    ),
  );
  check(
    "order-66:static",
    "news global navigation and footer have deterministic audit markers",
    ctaSource.includes('data-site-nav="news"') &&
      ctaSource.includes('data-site-footer="news"'),
  );
  check(
    "order-67:static",
    "both sites expose the complete typed interaction vocabulary",
    [newsAnalytics, advisoryAnalytics].every((analyticsSource) =>
      REQUIRED_INTERACTION_EVENTS.every((eventName) =>
        analyticsSource.includes(`"${eventName}"`),
      ),
    ),
  );
  check(
    "order-67:static",
    "analytics use property allowlists, consent gates and bounded sanitizers",
    [newsAnalytics, advisoryAnalytics].every(
      (analyticsSource) =>
        analyticsSource.includes("PROPERTY_ALLOWLIST") &&
        /hasAnalyticsConsent|hasConsent/.test(analyticsSource) &&
        /safeAnalyticsLocation|sanitize/.test(analyticsSource) &&
        !/new FormData|\.elements\b|\.value\b/.test(analyticsSource),
    ),
  );
  check(
    "order-68:static",
    "cross-site crawler covers fragments, protected routes and out-of-sitemap pages",
    /fragment/i.test(linkAudit) &&
      /protected/i.test(linkAudit) &&
      linkAudit.includes('"/terminal"') &&
      linkAudit.includes('"/legal/privacy"'),
  );
}

function pageState(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const isVisible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        rect.width > 1 &&
        rect.height > 1 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    };
    const visible = [
      ...(main?.querySelectorAll(
        "h1,h2,h3,p,li,a,button,input,select,textarea,article,form,td,th",
      ) ?? []),
    ].filter(isVisible);
    const clipped = visible
      .filter((node) => {
        if (
          node.closest(
            "[aria-hidden='true'],[data-audit-ignore],.sr-only,[class*='visuallyHidden']",
          )
        ) {
          return false;
        }
        const rect = node.getBoundingClientRect();
        let ancestor = node.parentElement;
        while (ancestor && ancestor !== main) {
          const style = getComputedStyle(ancestor);
          if (
            ["auto", "scroll"].includes(style.overflowX) &&
            ancestor.scrollWidth > ancestor.clientWidth + 1
          ) {
            return false;
          }
          ancestor = ancestor.parentElement;
        }
        return rect.left < -1 || rect.right > innerWidth + 1;
      })
      .map((node) => ({
        tag: node.tagName,
        text: (node.textContent ?? "").trim().slice(0, 90),
      }));
    const hidden = visible
      .filter((node) => {
        if (
          node.matches(":disabled") ||
          node.closest(
            "[aria-hidden='true'],[data-audit-ignore],.sr-only,[class*='visuallyHidden']",
          )
        ) {
          return false;
        }
        let opacity = 1;
        let current = node;
        while (current && current !== main?.parentElement) {
          opacity *= Number(getComputedStyle(current).opacity);
          current = current.parentElement;
        }
        return opacity < 0.65;
      })
      .map((node) => ({
        tag: node.tagName,
        text: (node.textContent ?? "").trim().slice(0, 90),
      }));
    const tinyText = visible
      .filter(
        (node) =>
          (node.textContent ?? "").trim().length > 0 &&
          Number.parseFloat(getComputedStyle(node).fontSize) < 10,
      )
      .map((node) => ({
        pixels: getComputedStyle(node).fontSize,
        text: (node.textContent ?? "").trim().slice(0, 90),
      }));
    const normalizeMedia = (raw) => {
      if (!raw) return "";
      const delivered = new URL(raw, location.href);
      if (delivered.pathname === "/_next/image") {
        return decodeURIComponent(delivered.searchParams.get("url") ?? "");
      }
      return `${delivered.origin === location.origin ? "" : delivered.origin}${
        delivered.pathname
      }`;
    };
    const images = [...(main?.querySelectorAll("img") ?? [])].map((image) => {
      const rect = image.getBoundingClientRect();
      return {
        source: normalizeMedia(image.currentSrc || image.src),
        complete: image.complete,
        width: image.naturalWidth,
        height: image.naturalHeight,
        alt: image.alt.trim(),
        fullscreen:
          rect.width >= innerWidth * 0.8 && rect.height >= innerHeight * 0.58,
      };
    });
    const videos = [...(main?.querySelectorAll("video") ?? [])].map((video) => {
      const rect = video.getBoundingClientRect();
      return {
        source: normalizeMedia(
          video.currentSrc ||
            video.querySelector("source")?.getAttribute("src") ||
            "",
        ),
        poster: video.poster ? normalizeMedia(video.poster) : "",
        width: video.videoWidth,
        height: video.videoHeight,
        autoplay: video.autoplay,
        muted: video.muted,
        controls: video.controls,
        fullscreen:
          rect.width >= innerWidth * 0.8 && rect.height >= innerHeight * 0.58,
      };
    });
    const backgrounds = [
      ...(main?.querySelectorAll("*") ?? []),
    ].flatMap((node) => {
      if (!isVisible(node)) return [];
      const value = getComputedStyle(node).backgroundImage;
      const match = value.match(/url\(["']?([^"')]+)["']?\)/);
      return match ? [normalizeMedia(match[1])] : [];
    });
    const schemas = [
      ...document.querySelectorAll('script[type="application/ld+json"]'),
    ].map((script) => {
      try {
        return JSON.parse(script.textContent || "{}");
      } catch {
        return { invalid: true };
      }
    });
    const internalLinks = [
      ...(main?.querySelectorAll("a[href]") ?? []),
    ]
      .map((link) => link.getAttribute("href") ?? "")
      .filter(
        (href) =>
          href.startsWith("/") &&
          !href.startsWith("/api/") &&
          !href.startsWith("/_next/"),
      );
    const badExternalLinks = [
      ...(main?.querySelectorAll("a[href^='http'][target='_blank']") ?? []),
    ]
      .filter((link) => {
        const rel = new Set((link.getAttribute("rel") ?? "").split(/\s+/));
        return !rel.has("noopener") || !rel.has("noreferrer");
      })
      .map((link) => link.getAttribute("href"));
    const badControls = [
      ...(main?.querySelectorAll(
        "a[href='#'],a[href=''],a a,a button,button a",
      ) ?? []),
    ].map((node) => node.outerHTML.slice(0, 180));
    const primaryCtas = [
      ...document.querySelectorAll('[data-cta-level="1"]'),
    ].filter(isVisible);
    const robots =
      document
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content")
        ?.toLowerCase() ?? "";
    const allMediaSources = [
      ...images.map((image) => image.source),
      ...videos.flatMap((video) => [video.source, video.poster]),
      ...backgrounds,
    ].filter(Boolean);
    return {
      bodyText: document.body.textContent ?? "",
      mainText: main?.textContent ?? "",
      h1: main?.querySelector("h1")?.textContent?.trim() ?? "",
      h1Font: main?.querySelector("h1")
        ? getComputedStyle(main.querySelector("h1")).fontFamily
        : "",
      mainCount: document.querySelectorAll("main").length,
      siteNavCount: document.querySelectorAll('[data-site-nav="news"]').length,
      siteFooterCount: document.querySelectorAll(
        '[data-site-footer="news"]',
      ).length,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      clipped,
      hidden,
      tinyText,
      images,
      videos,
      allMediaSources,
      schemas,
      internalLinks: [...new Set(internalLinks)],
      badExternalLinks,
      badControls,
      primaryCtas: primaryCtas.map((node) =>
        (node.textContent ?? "").trim().slice(0, 120),
      ),
      canonical:
        document.querySelector("link[rel='canonical']")?.getAttribute("href") ??
        "",
      noindex: robots.includes("noindex"),
    };
  });
}

async function revealAndSettle(page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 620) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 24));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : image.decode().catch(() => undefined),
      ),
    );
  });
}

async function dismissConsent(page) {
  const reject = page.getByRole("button", { name: /Reject all/i }).last();
  if (
    await reject
      .waitFor({ state: "visible", timeout: 1_500 })
      .then(() => true, () => false)
  ) {
    await reject.click().catch(() => undefined);
    await page.waitForTimeout(120);
  }
}

async function checkLinks(context, route, links) {
  for (const href of links) {
    const target = new URL(href, NEWS_BASE);
    target.hash = "";
    const response = await context.request.get(target.href, {
      maxRedirects: 5,
    });
    check(
      `${route.key}:links`,
      `${target.pathname}${target.search} resolves`,
      response.status() >= 200 && response.status() < 400,
      response.status(),
    );
  }
}

async function browserChecks() {
  const { chromium } = require("playwright");
  await mkdir(OUTPUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: viewport.reducedMotion,
      });
      for (const route of ROUTES) {
        const page = await context.newPage();
        const response = await page.goto(`${NEWS_BASE}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        const scope = `${route.key}:${viewport.key}`;
        check(scope, "route returns 200", response?.status() === 200, response?.status());
        await dismissConsent(page);
        await revealAndSettle(page);
        const state = await pageState(page);
        const schemaNodes = flattenSchemas(state.schemas);
        const schemaTypes = schemaNodes.flatMap((node) =>
          Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]],
        );

        check(scope, "one semantic main is rendered", state.mainCount === 1, state.mainCount);
        check(
          scope,
          "global navigation and one footer are present",
          state.siteNavCount === 1 && state.siteFooterCount === 1,
          `${state.siteNavCount}/${state.siteFooterCount}`,
        );
        check(scope, "page has a descriptive H1", state.h1.length >= 5, state.h1);
        check(
          scope,
          "display typography avoids Times and Inter",
          !/Times New Roman|Inter/i.test(state.h1Font),
          state.h1Font,
        );
        check(scope, "no horizontal overflow", state.overflow <= 1, state.overflow);
        check(
          scope,
          "semantic content is not clipped",
          state.clipped.length === 0,
          JSON.stringify(state.clipped),
        );
        check(
          scope,
          "text does not remain hidden by motion",
          state.hidden.length === 0,
          JSON.stringify(state.hidden),
        );
        check(
          scope,
          "visible page text is not microscopically small",
          state.tinyText.length === 0,
          JSON.stringify(state.tinyText),
        );
        check(
          scope,
          "images load and have meaningful alt text",
          state.images.every(
            (image) =>
              image.complete &&
              image.width > 0 &&
              image.height > 0 &&
              image.alt.length >= 8,
          ),
          JSON.stringify(state.images),
        );
        check(
          scope,
          "visible media sources are unique within the page",
          state.allMediaSources.length ===
            new Set(state.allMediaSources).size,
          JSON.stringify(state.allMediaSources),
        );
        check(
          scope,
          "fullscreen images are genuine UHD",
          state.images
            .filter((image) => image.fullscreen)
            .every((image) => image.width >= 3840 && image.height >= 2160),
          JSON.stringify(state.images.filter((image) => image.fullscreen)),
        );
        check(
          scope,
          "fullscreen videos are genuine UHD and never autoplay",
          state.videos
            .filter((video) => video.fullscreen)
            .every(
              (video) =>
                video.width >= 3840 &&
                video.height >= 2160 &&
                !video.autoplay,
            ),
          JSON.stringify(state.videos),
        );
        check(
          scope,
          "required structured-data types are present",
          route.schema.every((type) => schemaTypes.includes(type)),
          schemaTypes.filter(Boolean).join(","),
        );
        check(
          scope,
          "canonical is self-referential",
          Boolean(state.canonical) &&
            new URL(state.canonical).href ===
              new URL(route.path, `${NEWS_CANONICAL}/`).href,
          state.canonical,
        );
        check(
          scope,
          route.noindex ? "pre-release utility is noindex" : "public page is indexable",
          state.noindex === route.noindex,
          String(state.noindex),
        );
        check(
          scope,
          "route-specific truth statements are visible",
          route.required.every((pattern) => pattern.test(state.mainText)),
          route.required
            .filter((pattern) => !pattern.test(state.mainText))
            .map(String)
            .join(","),
        );
        check(
          scope,
          "forbidden capability and credential claims are absent",
          route.forbidden.every((pattern) => !pattern.test(state.bodyText)),
          route.forbidden
            .filter((pattern) => pattern.test(state.bodyText))
            .map(String)
            .join(","),
        );
        check(
          scope,
          "Raj and an advisory conversion route are visible",
          /Raj Tomar|\bRaj\b/i.test(state.bodyText) &&
            /Book.*(?:call|Raj)|working call|office@investwithraj\.com/i.test(
              state.bodyText,
            ),
        );
        check(
          scope,
          "forbidden brands and stale email are absent",
          !/pangea|better[ -]?parker|rajtomar\.dxb@gmail\.com/i.test(
            `${state.bodyText}\n${JSON.stringify(state.schemas)}`,
          ),
        );
        check(
          scope,
          "external new-tab links are isolated",
          state.badExternalLinks.length === 0,
          JSON.stringify(state.badExternalLinks),
        );
        check(
          scope,
          "there are no empty or nested interactive controls",
          state.badControls.length === 0,
          JSON.stringify(state.badControls),
        );
        check(
          scope,
          "primary CTAs are booking actions",
          state.primaryCtas.length >= 1 &&
            state.primaryCtas.every((label) => /book|working call/i.test(label)),
          JSON.stringify(state.primaryCtas),
        );

        if (viewport.key === "desktop") {
          await checkLinks(context, route, state.internalLinks);
          await page.screenshot({
            path: path.join(OUTPUT, `${route.key}-desktop.png`),
            fullPage: true,
          });
        }
        if (viewport.key === "mobile") {
          await page.screenshot({
            path: path.join(OUTPUT, `${route.key}-mobile.png`),
            fullPage: true,
          });
        }
        await page.close();
      }
      await context.close();
    }

    const context = await browser.newContext();
    for (const internalRoute of ["/internal/review", "/internal/dashboard"]) {
      const response = await context.request.get(`${NEWS_BASE}${internalRoute}`, {
        maxRedirects: 0,
      });
      check(
        "order-65:runtime",
        `${internalRoute} fails closed without a valid internal session`,
        [401, 503].includes(response.status()),
        response.status(),
      );
      const robots = response.headers()["x-robots-tag"] ?? "";
      check(
        "order-65:runtime",
        `${internalRoute} response is noindex`,
        /noindex/i.test(robots),
        robots,
      );
    }

    const querySecret = await context.request.get(
      `${NEWS_BASE}/api/queue/add?secret=do-not-log-this`,
    );
    check(
      "order-65:runtime",
      "queue API rejects credentials in the URL",
      querySecret.status() === 400,
      querySecret.status(),
    );
    const queueGet = await context.request.get(`${NEWS_BASE}/api/queue/add`);
    check(
      "order-65:runtime",
      "queue API does not expose public stats",
      [401, 503].includes(queueGet.status()),
      queueGet.status(),
    );
    const walletGet = await context.request.get(
      `${NEWS_BASE}/api/wallet/install?platform=apple`,
    );
    const walletBody = await walletGet.text();
    check(
      "order-61:runtime",
      "wallet API cannot return a live install",
      [501, 503].includes(walletGet.status()) &&
        !/"installUrl"\s*:\s*"https?:/i.test(walletBody),
      `${walletGet.status()} ${walletBody.slice(0, 180)}`,
    );
    const advisory = await context.request.get(`${ADVISORY_BASE}/media`);
    check(
      "orders-66-77:runtime",
      "advisory media route remains reachable",
      advisory.status() === 200,
      advisory.status(),
    );
    await context.close();
  } finally {
    await browser.close();
  }
}

await staticChecks();
if (!STATIC_ONLY) await browserChecks();

const report = {
  batch: 9,
  orders: Array.from({ length: 20 }, (_, index) => index + 58),
  generatedAt: new Date().toISOString(),
  mode: STATIC_ONLY ? "static" : "production-browser",
  newsBase: STATIC_ONLY ? null : NEWS_BASE,
  advisoryBase: STATIC_ONLY ? null : ADVISORY_BASE,
  totals: {
    checks: checks.length,
    passed: checks.length - failures.length,
    failed: failures.length,
  },
  failures,
  checks,
};

if (!STATIC_ONLY) {
  await writeFile(
    path.join(OUTPUT, "report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
}

console.log(
  `Batch 9 Orders 58-77 audit (${report.mode}): ${report.totals.passed}/${report.totals.checks} passed`,
);
if (failures.length) {
  for (const failure of failures) {
    console.error(
      `FAIL [${failure.scope}] ${failure.name}: ${failure.detail}`,
    );
  }
  process.exitCode = 1;
}
