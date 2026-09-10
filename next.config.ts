import type { NextConfig } from "next";
import {
  canonicalNewsroomRedirectDestination,
  getReleasedNewsroomRedirects,
} from "./lib/news-lifecycle";

const nextConfig: NextConfig = {
  // A fresh local build directory leaves active review servers untouched.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // ── Performance ───────────────────────────────────────────────────────
  reactStrictMode: true,
  poweredByHeader: false, // strip X-Powered-By: Next.js (small security/SEO win)
  compress: true,
  productionBrowserSourceMaps: false, // smaller bundle, hide source

  // Next 16 can omit Sharp's runtime-loaded libvips shared object from a
  // traced server function even though the JavaScript package is present.
  // Keep the native files scoped to the newsroom routes that may
  // inspect an approved editorial image.
  outputFileTracingIncludes: {
    "/api/news/draft/*/publish": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/news/draft/*/media-approval": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/news/draft/*/reuse-curated-media": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/news/draft/*/reuse-daily-media": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },

  // ── Image optimization ────────────────────────────────────────────────
  images: {
    // Modern formats. Browsers that support AVIF get it; rest get WebP.
    formats: ["image/avif", "image/webp"],
    // Aggressive sizing for the hero portrait at various viewport widths.
    deviceSizes: [
      375, 640, 750, 828, 1080, 1200, 1440, 1920, 2560, 3840,
    ],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 460, 600],
    // Public filenames remain mutable while verified UHD media is promoted.
    minimumCacheTTL: 60 * 60,
    dangerouslyAllowSVG: false,
    qualities: [50, 70, 75, 80, 88, 95, 100],
  },

  // ── Build-time / runtime headers (security + caching) ─────────────────
  async headers() {
    const enforceCsp =
      process.env.NODE_ENV === "production" &&
      process.env.VERCEL_ENV !== "preview";
    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${enforceCsp ? "" : " 'unsafe-eval'"} va.vercel-scripts.com *.vercel-analytics.com *.vercel-insights.com www.googletagmanager.com www.google-analytics.com plausible.io connect.facebook.net snap.licdn.com static.ads-twitter.com analytics.tiktok.com www.clarity.ms`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: *.vercel-insights.com www.google-analytics.com www.googletagmanager.com plausible.io www.facebook.com *.linkedin.com *.licdn.com analytics.twitter.com t.co analytics.tiktok.com *.clarity.ms",
      "font-src 'self' data: fonts.gstatic.com",
      "connect-src 'self' *.vercel-insights.com *.vercel-analytics.com vitals.vercel-insights.com www.google-analytics.com analytics.google.com plausible.io *.posthog.com www.facebook.com *.linkedin.com analytics.twitter.com analytics.tiktok.com *.clarity.ms",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-src 'self' www.youtube.com www.youtube-nocookie.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ");
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: enforceCsp
          ? "Content-Security-Policy"
          : "Content-Security-Policy-Report-Only",
        value: contentSecurityPolicy,
      },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Static assets — long-cache aggressively
        source: "/(.*)\\.(jpg|jpeg|png|webp|avif|svg|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/rss.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=3600",
          },
        ],
      },
    ];
  },

  // The reserved /favicon.ico file convention cannot host a route handler.
  // Rewrite it internally so the handler can return a cache-controlled 307.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/api/favicon" }];
  },

  // ── v1.1 cutover (June 2026): the immersive Terminal is the news ROOT home
  // (served at "/" directly — no redirect hop). Legacy version URLs 301 to root
  // so any indexed /v17 or /v16 links survive.
  async redirects() {
    const lifecycleRedirects = getReleasedNewsroomRedirects().map(
      ({ destination, ...redirect }) => ({
        ...redirect,
        destination: canonicalNewsroomRedirectDestination(destination),
      }),
    );

    return [
      // Individually verified duplicate redirects are released immediately.
      // The wider legacy lifecycle set remains behind its explicit cutover
      // flag. Absolute destinations keep retired www URLs to one hop if the
      // currently absent DNS is added later.
      ...lifecycleRedirects,
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.news.investwithraj.com" }],
        destination: "https://news.investwithraj.com/:path*",
        permanent: true,
      },
      { source: "/v17", destination: "/", permanent: true },
      { source: "/v16", destination: "/", permanent: true },
    ];
  },

  // ── Experimental performance flags ────────────────────────────────────
  experimental: {
    // Optimize CSS — inline critical, defer the rest
    optimizeCss: false, // currently buggy with Tailwind v4 — keep off
    // Use new scroll restoration (smoother navigations)
    scrollRestoration: true,
    // Inline small static images as base64 (saves requests)
    optimizePackageImports: ["gsap", "three", "lenis"],
  },
};

export default nextConfig;
