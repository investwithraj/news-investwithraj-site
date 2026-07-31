import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Performance ───────────────────────────────────────────────────────
  reactStrictMode: true,
  poweredByHeader: false, // strip X-Powered-By: Next.js (small security/SEO win)
  compress: true,
  productionBrowserSourceMaps: false, // smaller bundle, hide source

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
      "connect-src 'self' *.vercel-insights.com *.vercel-analytics.com vitals.vercel-insights.com www.google-analytics.com analytics.google.com plausible.io www.facebook.com *.linkedin.com analytics.twitter.com analytics.tiktok.com *.clarity.ms",
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
        source: "/(.*)\\.(jpg|jpeg|png|webp|avif|svg|ico|woff2)",
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

  // ── v1.1 cutover (June 2026): the immersive Terminal is the news ROOT home
  // (served at "/" directly — no redirect hop). Legacy version URLs 301 to root
  // so any indexed /v17 or /v16 links survive.
  async redirects() {
    return [
      { source: "/v17", destination: "/", permanent: true },
      { source: "/v16", destination: "/", permanent: true },
      { source: "/v16/:path*", destination: "/", permanent: true },
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
