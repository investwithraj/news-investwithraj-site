import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const BASE_URL = process.env.IWR_NEWS_AUDIT_URL ?? "http://localhost:3130";
const SITE_URL =
  process.env.IWR_NEWS_CANONICAL_URL ?? "https://news.investwithraj.com";
const OUT_DIR = path.resolve(
  process.env.IWR_NEWS_AUDIT_OUTPUT ?? "outputs/batch-8-orders-46-57-audit",
);
const STATIC_ONLY = process.env.STATIC_ONLY === "1";
const CHROME =
  process.env.IWR_CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const modules =
  process.env.CODEX_BUNDLED_NODE_MODULES ??
  "C:\\Users\\RAJTO\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(modules, "_iwr-news-batch-8.cjs"));

const AREA_SLUGS = [
  "hudayriyat-island",
  "palm-jebel-ali",
  "wynn-al-marjan",
  "downtown-dubai",
  "dubai-marina",
  "palm-jumeirah",
  "jbr",
  "business-bay",
  "jlt",
  "difc",
  "dubai-hills-estate",
  "jvc",
  "damac-lagoons",
  "mbr-city",
  "al-furjan",
  "sobha-hartland",
  "dubai-creek-harbour",
  "mina-rashid",
  "tilal-al-ghaf",
  "saadiyat-island",
  "yas-island",
  "al-reem-island",
  "al-maryah-island",
  "al-raha-beach",
  "masdar-city",
  "al-reef",
  "al-marjan-island",
  "mina-al-arab",
  "al-hamra-village",
];
const DEVELOPER_SLUGS = [
  "emaar",
  "aldar",
  "nakheel",
  "modon",
  "damac",
  "sobha",
  "dubai-holding",
  "ifa-hotels",
  "marjan",
];
const VERTICAL_SLUGS = [
  "dld-pulse",
  "off-plan-watch",
  "uhnw-trades",
  "sovereign-plays",
  "beyond-the-deal",
];

const REPRESENTATIVE_ROUTES = [
  {
    order: 46,
    path: "/",
    key: "home",
    schemaAny: ["WebSite"],
    noindex: false,
  },
  {
    order: 47,
    path: "/news",
    key: "news",
    schemaAll: ["CollectionPage", "ItemList", "BreadcrumbList"],
    noindex: false,
  },
  {
    order: 48,
    path: "/news/2026-07-25-dubai-logs-aed-419-94bn-in-h1-transactions-as-weekly-volumes",
    key: "article",
    schemaAll: ["NewsArticle", "FAQPage", "BreadcrumbList", "Person"],
    noindex: false,
  },
  {
    order: 49,
    path: "/areas",
    key: "areas",
    schemaAll: ["CollectionPage", "ItemList", "BreadcrumbList"],
    noindex: false,
  },
  {
    order: 50,
    path: "/areas/palm-jebel-ali",
    key: "area-detail",
    schemaAll: ["CollectionPage", "ItemList", "BreadcrumbList", "Place"],
    noindex: true,
  },
  {
    order: 51,
    path: "/developers",
    key: "developers",
    schemaAll: ["CollectionPage", "ItemList", "BreadcrumbList"],
    noindex: false,
  },
  {
    order: 52,
    path: "/developer/aldar",
    key: "developer-detail",
    schemaAll: ["Organization", "BreadcrumbList"],
    noindex: false,
  },
  {
    order: 53,
    path: "/v/dld-pulse",
    key: "vertical",
    schemaAll: ["CollectionPage", "ItemList", "BreadcrumbList"],
    noindex: false,
  },
  {
    order: 54,
    path: "/pulse",
    key: "pulse",
    schemaAll: ["WebPage", "BreadcrumbList"],
    noindex: true,
  },
  {
    order: 55,
    path: "/closing-bell",
    key: "closing-bell",
    schemaAny: ["WebPage", "CollectionPage"],
    noindex: true,
  },
  {
    order: 56,
    path: "/power-list/2026",
    key: "power-list",
    schemaAll: ["WebPage", "BreadcrumbList"],
    noindex: true,
  },
  {
    order: 57,
    path: "/map",
    key: "map",
    schemaAll: ["CollectionPage", "ItemList", "BreadcrumbList"],
    noindex: false,
  },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000, reducedMotion: "no-preference" },
  { name: "mobile", width: 390, height: 844, reducedMotion: "no-preference" },
  { name: "reduced-motion", width: 390, height: 844, reducedMotion: "reduce" },
];

const checks = [];
const failures = [];

function check(scope, name, pass, detail = "") {
  const record = { scope, name, pass: Boolean(pass), detail: String(detail) };
  checks.push(record);
  if (!record.pass) failures.push(record);
}

function schemaNodes(schemas) {
  return schemas.flatMap((schema) => {
    if (Array.isArray(schema)) return schemaNodes(schema);
    return Array.isArray(schema?.["@graph"]) ? schema["@graph"] : [schema];
  });
}

async function staticChecks() {
  const files = [
    "components/redesign/NewsHome.tsx",
    "components/redesign/NewsArticle.tsx",
    "app/news/page.tsx",
    "app/news/[slug]/page.tsx",
    "app/areas/page.tsx",
    "app/areas/[slug]/page.tsx",
    "app/developers/page.tsx",
    "app/developer/[slug]/page.tsx",
    "app/v/[slug]/page.tsx",
    "lib/verticals.ts",
    "app/pulse/page.tsx",
    "app/closing-bell/page.tsx",
    "app/power-list/[year]/page.tsx",
    "app/map/page.tsx",
    "app/sitemap.ts",
  ];
  const contents = [];
  for (const file of files) {
    try {
      contents.push({ file, source: await readFile(file, "utf8") });
    } catch {
      check("static", `${file} exists`, false);
    }
  }
  const source = contents.map((entry) => entry.source).join("\n");
  const pulse = contents.find((entry) => entry.file === "app/pulse/page.tsx")?.source ?? "";
  const map = contents.find((entry) => entry.file === "app/map/page.tsx")?.source ?? "";
  const closing =
    contents.find((entry) => entry.file === "app/closing-bell/page.tsx")?.source ?? "";
  const power =
    contents.find((entry) => entry.file === "app/power-list/[year]/page.tsx")?.source ?? "";
  const verticals =
    contents.find((entry) => entry.file === "lib/verticals.ts")?.source ?? "";

  check(
    "static",
    "forbidden brands and stale email are absent",
    !/pangea|better[ -]?parker|rajtomar\.dxb@gmail\.com/i.test(source),
  );
  check(
    "static",
    "Batch 8 news routes contain no video or autoplay media",
    !/<video|autoPlay|PulseMotionMedia|pulse-loop\.mp4/i.test(source),
  );
  check(
    "order-54:static",
    "Pulse makes no live, real-time, scraping or scored-sentiment claim",
    !/getMockSentiment|PulseMotionMedia|scoreToColor|refreshes every 30m|real-time scrape|scraped, scored|source:\s*["']mock["']/i.test(
      pulse,
    ),
  );
  check(
    "order-57:static",
    "Map makes no DLD, Mapbox, volume, PSF or sentiment claim",
    !/getMockSentiment|scoreToColor|NEXT_PUBLIC_MAPBOX|Mapbox 3D|medianPsf|sentimentByArea|signal\.volume/i.test(
      map,
    ),
  );
  check(
    "order-55:static",
    "Closing Bell makes no unsupported delivery promise",
    !/16:30|weekday|Telegram|Discord|drops? (?:daily|at)|every day/i.test(closing),
  );
  check(
    "order-56:static",
    "Power List makes no unsupported 100-person or ranking promise",
    !/\b100 most\b|popularity contest|first to read|twice weekly/i.test(power),
  );
  check(
    "order-53:static",
    "vertical definitions make no unsupported cadence or exhaustive-coverage promise",
    !/every DLD transaction|twice weekly|daily [·|\\-]|07:00 GST|AED 25M\\+ moves/i.test(
      verticals,
    ),
  );
  check(
    "static",
    "schema injection escapes less-than characters",
    !/dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify\([^)]*\)\s*\}\}/.test(
      source,
    ),
  );
}

function readPageState(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const schemas = [
      ...document.querySelectorAll('script[type="application/ld+json"]'),
    ].map((script) => {
      try {
        return JSON.parse(script.textContent || "{}");
      } catch {
        return { invalid: true };
      }
    });
    const visibleElements = [
      ...(main?.querySelectorAll(
        "h1,h2,h3,p,li,a,button,input,select,textarea,article,form,td,th",
      ) ?? []),
    ].filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        rect.width > 1 &&
        rect.height > 1 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });
    const clipped = visibleElements
      .filter((node) => {
        if (
          node.closest(
            "[aria-hidden='true'],[data-audit-ignore],.hiddenField,.sr-only",
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
        text: (node.textContent ?? "").trim().slice(0, 80),
      }));
    const hiddenText = visibleElements
      .filter((node) => {
        if (
          node.matches(":disabled") ||
          node.closest(
            "[aria-hidden='true'],[data-audit-ignore],.hiddenField,.sr-only",
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
        className: String(node.className),
        text: (node.textContent ?? "").trim().slice(0, 120),
      }));
    const images = [...(main?.querySelectorAll("img") ?? [])].map((image) => {
      const delivered = new URL(image.currentSrc || image.src, location.href);
      const source =
        delivered.pathname === "/_next/image"
          ? decodeURIComponent(delivered.searchParams.get("url") ?? "")
          : delivered.pathname;
      return {
        source,
        complete: image.complete,
        width: image.naturalWidth,
        height: image.naturalHeight,
        alt: image.alt,
      };
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
    const robots =
      document
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content")
        ?.toLowerCase() ?? "";
    return {
      h1: main?.querySelector("h1")?.textContent?.trim() ?? "",
      text: main?.textContent ?? "",
      documentText: document.body.textContent ?? "",
      mainCount: document.querySelectorAll("main").length,
      footerCount: document.querySelectorAll("footer").length,
      navCount: document.querySelectorAll("nav").length,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      clipped,
      hiddenText,
      images,
      videos: main?.querySelectorAll("video").length ?? 0,
      schemas,
      internalLinks: [...new Set(internalLinks)],
      canonical:
        document.querySelector("link[rel='canonical']")?.getAttribute("href") ??
        "",
      noindex: robots.includes("noindex"),
    };
  });
}

async function revealAndSettle(page) {
  await page.evaluate(async () => {
    for (let top = 0; top <= document.documentElement.scrollHeight; top += 650) {
      window.scrollTo({ top, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    await Promise.all(
      [...document.images].map((image) =>
        image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
      ),
    );
  });
}

async function dismissConsent(page) {
  const banner = page.locator("[data-consent-layer]");
  if (await banner.waitFor({ state: "visible", timeout: 1_200 }).then(
    () => true,
    () => false,
  )) {
    await banner
      .getByRole("button", { name: "Reject all" })
      .click()
      .catch(() => undefined);
  }
}

async function checkInternalLinks(context, route, links) {
  for (const href of links) {
    const target = new URL(href, BASE_URL);
    target.hash = "";
    const response = await context.request.get(target.href, { maxRedirects: 5 });
    check(
      `${route.key}:links`,
      `${target.pathname}${target.search} resolves`,
      response.status() >= 200 && response.status() < 400,
      response.status(),
    );
  }
}

await staticChecks();

if (!STATIC_ONLY) {
  const { chromium } = require("playwright");
  await mkdir(OUT_DIR, { recursive: true });
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
      for (const route of REPRESENTATIVE_ROUTES) {
        const page = await context.newPage();
        const response = await page.goto(`${BASE_URL}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        const scope = `${route.key}:${viewport.name}`;
        check(scope, "route returns 200", response?.status() === 200, response?.status());
        await dismissConsent(page);
        await revealAndSettle(page);
        const state = await readPageState(page);
        const nodes = schemaNodes(state.schemas);
        const types = nodes.flatMap((node) =>
          Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]],
        );
        check(scope, "one page main is rendered", state.mainCount === 1, state.mainCount);
        check(
          scope,
          "global navigation and one footer are present",
          state.navCount >= 1 && state.footerCount === 1,
          `${state.navCount}/${state.footerCount}`,
        );
        check(scope, "page has a descriptive H1", state.h1.length >= 5, state.h1);
        check(scope, "no horizontal overflow", state.overflow <= 1, state.overflow);
        check(scope, "semantic content is not clipped", state.clipped.length === 0, JSON.stringify(state.clipped));
        check(
          scope,
          "text never remains hidden by motion",
          state.hiddenText.length === 0,
          JSON.stringify(state.hiddenText),
        );
        check(scope, "no page video is present", state.videos === 0, state.videos);
        check(
          scope,
          "all images load with meaningful alt text",
          state.images.every(
            (image) =>
              image.complete && image.width > 0 && image.alt.trim().length >= 10,
          ),
          JSON.stringify(state.images),
        );
        check(
          scope,
          "visible images are unique within the page",
          new Set(state.images.map((image) => image.source)).size === state.images.length,
          JSON.stringify(state.images),
        );
        if (route.schemaAll) {
          check(
            scope,
            "all required structured-data types are present",
            route.schemaAll.every((type) => types.includes(type)),
            types.filter(Boolean).join(","),
          );
        }
        if (route.schemaAny) {
          check(
            scope,
            "an appropriate structured-data type is present",
            route.schemaAny.some((type) => types.includes(type)),
            types.filter(Boolean).join(","),
          );
        }
        check(
          scope,
          "canonical is self-referential",
          new URL(state.canonical).href ===
            new URL(route.path, `${SITE_URL}/`).href,
          state.canonical,
        );
        check(
          scope,
          route.noindex ? "pre-publication route is noindex" : "release route is indexable",
          state.noindex === route.noindex,
          String(state.noindex),
        );
        check(
          scope,
          "Raj and the advisory conversion path are visible",
          /Raj Tomar/i.test(state.documentText) &&
            /Book Raj|Take .* to Raj|Speak to Raj|office@investwithraj\.com/i.test(
              state.documentText,
            ),
        );
        check(
          scope,
          "forbidden brands and stale email are absent",
          !/pangea|better[ -]?parker|rajtomar\.dxb@gmail\.com/i.test(
            `${state.documentText}\n${JSON.stringify(state.schemas)}`,
          ),
        );
        if (viewport.name === "desktop") {
          await checkInternalLinks(context, route, state.internalLinks);
          await page.screenshot({
            path: path.join(OUT_DIR, `${route.key}-desktop.png`),
            fullPage: true,
          });
        }
        await page.close();
      }
      await context.close();
    }

    const requestContext = await browser.newContext();
    const sitemapResponse = await requestContext.request.get(`${BASE_URL}/sitemap.xml`);
    const sitemapText = await sitemapResponse.text();
    const newsUrls = [
      ...sitemapText.matchAll(/<loc>([^<]+\/news\/[^<]+)<\/loc>/g),
    ].map((match) => match[1]);
    check(
      "order-48:inventory",
      "sitemap contains 38 live report routes",
      newsUrls.length === 38,
      newsUrls.length,
    );
    for (const url of newsUrls) {
      const response = await requestContext.request.get(url);
      check(
        "order-48:inventory",
        `${new URL(url).pathname} returns 200`,
        response.status() === 200,
        response.status(),
      );
    }
    for (const slug of AREA_SLUGS) {
      const route = `/areas/${slug}`;
      const response = await requestContext.request.get(`${BASE_URL}${route}`);
      check(
        "order-50:inventory",
        `${route} remains accessible`,
        response.status() === 200,
        response.status(),
      );
      check(
        "order-50:sitemap",
        `${route} is withheld from sitemap while evidence is incomplete`,
        !sitemapText.includes(`${SITE_URL}${route}`),
      );
    }
    for (const slug of DEVELOPER_SLUGS) {
      const route = `/developer/${slug}`;
      const response = await requestContext.request.get(`${BASE_URL}${route}`);
      check(
        "order-52:inventory",
        `${route} returns 200`,
        response.status() === 200,
        response.status(),
      );
    }
    for (const slug of VERTICAL_SLUGS) {
      const route = `/v/${slug}`;
      const response = await requestContext.request.get(`${BASE_URL}${route}`);
      check(
        "order-53:inventory",
        `${route} returns 200`,
        response.status() === 200,
        response.status(),
      );
    }
    for (const route of ["/pulse", "/closing-bell", "/power-list/2026"]) {
      check(
        "orders-54-56:sitemap",
        `${route} is withheld from sitemap before publication`,
        !sitemapText.includes(`${SITE_URL}${route}`),
      );
    }
    check(
      "order-57:sitemap",
      "/map is included in sitemap",
      sitemapText.includes(`${SITE_URL}/map`),
    );
    await requestContext.close();
  } finally {
    await browser.close();
  }
}

const report = {
  batch: 8,
  orders: [46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57],
  generatedAt: new Date().toISOString(),
  baseUrl: STATIC_ONLY ? null : BASE_URL,
  mode: STATIC_ONLY ? "static" : "production-browser",
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
    path.join(OUT_DIR, "report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
}

console.log(
  `Batch 8 Orders 46-57 audit (${report.mode}): ${report.totals.passed}/${report.totals.checks} passed`,
);
if (failures.length) {
  for (const failure of failures) {
    console.error(
      `FAIL [${failure.scope}] ${failure.name}: ${failure.detail}`,
    );
  }
  process.exitCode = 1;
}
