import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE } from "@/lib/constants";
import { ConsentRoot } from "@/components/consent/ConsentRoot";
import NewsChrome from "@/components/redesign/NewsChrome";
import NewsFooter from "@/components/redesign/NewsFooter";
import {
  asGraph,
  newsOrgSchema,
  newsWebsiteSchema,
  rajPersonSchema,
} from "@/lib/schema";
import "./globals.css";

const IS_VERCEL_RUNTIME = process.env.VERCEL === "1";

/* v11 fonts — same stack as IWR root, for visual continuity across the
   brand family. Light-theme only, no dark variant (same lesson learned). */
/* v25 Barnes-register pairing (parity with investwithraj.com): Raleway
   ultra-light tracked display + Playfair Didot-class serif. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#F8FAFC",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name}`,
    template: `%s · Invest With Raj`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  generator: "Next.js",
  keywords: [
    "UAE real estate news",
    "Dubai property news",
    "Abu Dhabi real estate news",
    "DLD transactions",
    "Hudayriyat news",
    "Palm Jebel Ali news",
    "Wynn Al Marjan news",
    "Saadiyat villa news",
    "Dubai market intelligence",
    "Raj Tomar",
    "Beyond the Deal newsletter",
  ],
  authors: [{ name: "Raj Tomar", url: SITE.rootUrl }],
  creator: "Raj Tomar",
  publisher: "Invest With Raj",
  category: "Real Estate News",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    types: {
      "application/rss+xml": `${SITE.url}/rss.xml`,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_AE",
    url: SITE.url,
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    site: "@investwithraj",
    creator: "@rajtomar_dxb",
    title: SITE.name,
    description: SITE.description,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: "default",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? "",
    },
  },
};

const publicationIdentityGraph = asGraph(
  newsWebsiteSchema,
  newsOrgSchema,
  rajPersonSchema,
);

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-AE"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* v11.4 — force light theme. Inline script runs before paint to
            clear any stale data-theme attribute + localStorage. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.removeAttribute('data-theme');localStorage.removeItem('iwr-theme');localStorage.removeItem('nexus-theme');}catch(e){}})();`,
          }}
        />

        {/* Performance: preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://investwithraj.com" />

        {/* One linked identity graph: WebSite + publisher + Raj. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(publicationIdentityGraph).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
      </head>

      <body className="min-h-full flex flex-col">
        {/* v13 SOTY — page-load curtain. RT monogram strokes draw on,
            then curtain wipes up over ~1.9s on first paint. */}
        <NewsChrome />

        {/* V21 brand-motion unification — the main site's NavCurtain
            (B&C route-change wipe: wordmark panel covers down, client
            router.push, reveal up). No double-fire: PageLoadCurtain is
            first-paint only, and app/template.tsx's curtain div never
            paints (its transform is identical in both phases) — only its
            subtle 320ms content fade runs, underneath this cover. */}

        {/* v29 — THE NAV IS GLOBAL. It used to be mounted by three pages
            only (/, /about, /about/editorial-standards), which left every
            article, desk and index page — 80 of 83 — with no navigation at
            all: /closing-bell and /power-list/2026 were pure dead ends whose
            only internal link was the logo. Mounting it here is the fix for
            "lack of connectivity inside the news section". */}

          {/* DLD daily-pulse ticker — Bloomberg-style strip pinned to top */}

        <div id="news-content" tabIndex={-1}>
          {children}
        </div>

        <NewsFooter />

        {/* v13 SOTY — cursor system with [data-cursor-label] + magnetic */}

        {/* v13 SOTY — Web Audio ambient toggle, Cartier W&W pattern */}

        {/* v13 SOTY — UI sound dispatcher, gated by ambient master switch */}

        {/* v13 SOTY easter egg — Konami unlocks Bulgari emerald palette */}

        {/* v12 SOTM — 35mm film-grain overlay, ~4% opacity, multiply blend */}

        {IS_VERCEL_RUNTIME ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}

        {/* GDPR/PDPL consent banner + 8-pixel network loader (gated by consent) */}
        <ConsentRoot />

      </body>
    </html>
  );
}
