import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { IWR_ICON_URL } from "@/lib/brand-icon";
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
import "./brand/brand-tokens.css";
import "./globals.css";

const IS_VERCEL_RUNTIME = process.env.VERCEL === "1";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B0D12",
  colorScheme: "dark light",
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
  authors: [
    {
      name: "Invest With Raj News Desk",
      url: `${SITE.url}/about/editorial-standards`,
    },
  ],
  creator: "Invest With Raj News Desk",
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
    title: SITE.name,
    description: SITE.description,
  },
  icons: {
    icon: [{ url: IWR_ICON_URL, type: "image/svg+xml", sizes: "any" }],
    shortcut: [{ url: IWR_ICON_URL, type: "image/svg+xml", sizes: "any" }],
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
      className="h-full"
      data-iwr-brand-version="v1.2"
      suppressHydrationWarning
    >
      <head>
        {/* Keep legacy theme state from overriding the governed v1.2 system. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.removeAttribute('data-theme');localStorage.removeItem('iwr-theme');localStorage.removeItem('nexus-theme');}catch(e){}})();`,
          }}
        />

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
        <NewsChrome />

        <div id="news-content" tabIndex={-1}>
          {children}
        </div>

        <NewsFooter />

        {IS_VERCEL_RUNTIME ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}

        <ConsentRoot />
      </body>
    </html>
  );
}
