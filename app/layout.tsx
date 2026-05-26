import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE, CONTACT } from "@/lib/constants";
import { ConsentRoot } from "@/components/consent/ConsentRoot";
import CustomCursor from "@/components/CustomCursor";
import { FxProvider } from "@/components/ticker/FxProvider";
import { DldTicker } from "@/components/ticker/DldTicker";
import PageLoadCurtain from "@/components/PageLoadCurtain";
import AmbientAudio from "@/components/AmbientAudio";
import "./globals.css";

/* v11 fonts — same stack as IWR root, for visual continuity across the
   brand family. Light-theme only, no dark variant (same lesson learned). */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

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
    canonical: SITE.url,
    types: {
      "application/rss+xml": `${SITE.url}/rss.xml`,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
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
  // F17 — Vision Pro / visionOS Safari spatial-web hints. Honored on
  // spatial browsers, silently ignored on flat-web ones. /spatial route
  // is the depth-optimised landing.
  other: {
    "apple-spatial-capable": "yes",
    "apple-spatial-alternate": `${SITE.url}/spatial`,
  },
};

/* JSON-LD — WebSite + NewsMediaOrganization + author Person.
   Cross-references back to IWR root (the canonical brand entity). */
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}#website`,
  url: SITE.url,
  name: SITE.name,
  description: SITE.description,
  inLanguage: "en-US",
  publisher: { "@id": `${SITE.rootUrl}#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

const newsOrgSchema = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  "@id": `${SITE.url}#newsmediaorg`,
  name: SITE.name,
  url: SITE.url,
  parentOrganization: { "@id": `${SITE.rootUrl}#organization` },
  founder: { "@id": `${SITE.rootUrl}#raj` },
  diversityPolicy: `${SITE.url}/about/editorial-standards`,
  ethicsPolicy: `${SITE.url}/about/editorial-standards`,
  masthead: `${SITE.url}/about`,
  missionCoveragePrioritiesPolicy: `${SITE.url}/about/editorial-standards`,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full`}
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

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(newsOrgSchema) }}
        />
      </head>

      <body className="min-h-full flex flex-col">
        {/* v13 SOTY — page-load curtain. RT monogram strokes draw on,
            then curtain wipes up over ~1.9s on first paint. */}
        <PageLoadCurtain />

        <FxProvider>
          {/* DLD daily-pulse ticker — Bloomberg-style strip pinned to top */}
          <DldTicker />

          {children}
        </FxProvider>

        {/* v13 SOTY — cursor system with [data-cursor-label] + magnetic */}
        <CustomCursor />

        {/* v13 SOTY — Web Audio ambient toggle, Cartier W&W pattern */}
        <AmbientAudio />

        {/* v12 SOTM — 35mm film-grain overlay, ~4% opacity, multiply blend */}
        <div className="film-grain" aria-hidden="true" />

        <Analytics />
        <SpeedInsights />

        {/* GDPR/PDPL consent banner + 8-pixel network loader (gated by consent) */}
        <ConsentRoot />

        {/* Hidden footer-of-footer — cross-domain link discoverability */}
        <a
          href={CONTACT.email}
          className="sr-only"
          aria-hidden="true"
        >
          {CONTACT.email}
        </a>
      </body>
    </html>
  );
}
