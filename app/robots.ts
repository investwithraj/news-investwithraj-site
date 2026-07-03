import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/internal/", "/api/"],
      },
      // AI-crawler explicit allowlist — the news subdomain is meant to be
      // surfaced in AI search / Q&A flows.
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "OAI-SearchBot",
          "PerplexityBot",
          "Perplexity-User",
          "ClaudeBot",
          "Claude-Web",
          "anthropic-ai",
          "Google-Extended",
          "Googlebot",
          "Bingbot",
          "DuckDuckBot",
          "Applebot",
          "Applebot-Extended",
          "Bytespider",
          "cohere-ai",
          "CCBot",
          "Diffbot",
          "FacebookBot",
          "facebookexternalhit",
          "Twitterbot",
          "LinkedInBot",
          "Mojeek",
          "YandexBot",
          "Amazonbot",
          "Meta-ExternalAgent",
        ],
        allow: "/",
      },
      // Block low-quality scrapers.
      {
        userAgent: ["AhrefsBot", "MJ12bot", "SemrushBot"],
        disallow: "/",
      },
    ],
    sitemap: [`${SITE.url}/sitemap.xml`, `${SITE.url}/news-sitemap.xml`],
    host: SITE.url,
  };
}
