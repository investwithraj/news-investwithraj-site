import type { Metadata } from "next";
import NavPill from "@/components/v16/NavPill";

/**
 * /v16 layout for news subdomain.
 * Suppresses v15 chrome (DldTicker mounts elsewhere, CustomCursor, etc.)
 * via CSS. Mounts a v16 NavPill with news-specific links.
 */
export const metadata: Metadata = {
  title: "Invest With Raj — Daily Market Read · v16",
  robots: { index: false, follow: false },
};

const NEWS_NAV = [
  { label: "Pulse", href: "/v16/pulse" },
  { label: "Articles", href: "/v16/articles" },
  { label: "Power List", href: "/v16/power-list" },
  { label: "Terminal", href: "/v16/terminal" },
  { label: "Map", href: "/v16/map" },
];

export default function NewsV16Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* Suppress v15 chrome on /v16 routes */
        body > .cursor-dot,
        body > .cursor-ring,
        body > [class*="dld-ticker"],
        body > .glass-nav {
          display: none !important;
        }
        html, body {
          background: var(--v16-paper) !important;
          color: var(--v16-ink) !important;
          font-family: var(--v16-font-body), system-ui, sans-serif !important;
        }
        body, body * { cursor: auto !important; }
        body a, body button, body [role="button"] { cursor: pointer !important; }
      `}</style>

      <NavPill
        items={NEWS_NAV}
        ctaLabel="Subscribe"
        ctaHref="/v16/articles"
      />

      <main style={{ background: "var(--v16-paper)" }}>{children}</main>
    </>
  );
}
