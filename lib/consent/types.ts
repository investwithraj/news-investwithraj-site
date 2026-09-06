// Consent management — GDPR + UAE PDPL compliant.
//
// 11-provider network: GA4, Plausible, PostHog, Vercel Analytics, Vercel Speed
// Insights, Meta Pixel, LinkedIn Insight, X Pixel, TikTok Pixel, Google Ads
// conversion, Microsoft Clarity.
//
// Each pixel is grouped by purpose so the user can grant per-purpose consent
// rather than per-vendor (GDPR-recommended UX pattern):
//   - analytics: GA4, Plausible, PostHog, Microsoft Clarity (session replay),
//     Vercel Web Analytics and Vercel Speed Insights
//   - advertising: Meta, X, TikTok, LinkedIn (retargeting)
//   - conversion: Google Ads conversion tag (closed-loop attribution)

export type ConsentPurpose = "essential" | "analytics" | "advertising" | "conversion";

export interface PixelDefinition {
  /** Klaro service ID — used in cookie-banner UI */
  name: string;
  /** Friendly label shown to user */
  title: string;
  /** What it does — surfaced in the consent modal */
  description: string;
  /** Privacy policy URL for this vendor */
  privacyUrl: string;
  /** Cookie keys this vendor sets (so the banner can purge them on withdrawal) */
  cookies: Array<string | RegExp>;
  /** Which consent group this belongs to */
  purpose: ConsentPurpose;
  /** Env var that holds the tracking ID — if not set, pixel is dormant */
  envVar: string;
  /** Required: true blocks site usage until consent (we use this only for essential) */
  required: boolean;
  /** Default to opted-in? false = explicit-opt-in (GDPR strict) */
  default: boolean;
  /** Order in the UI — lower numbers shown first */
  order: number;
}

/** The provider network. Order matters — banner respects this list. */
export const PIXELS: PixelDefinition[] = [
  {
    name: "ga4",
    title: "Google Analytics 4",
    description:
      "Anonymized page-view + conversion analytics. Tracks which articles you read, how long you spend, and which referrer brought you. No PII.",
    privacyUrl: "https://policies.google.com/privacy",
    cookies: [/^_ga/, /^_gid$/],
    purpose: "analytics",
    envVar: "NEXT_PUBLIC_GA_MEASUREMENT_ID",
    required: false,
    default: false,
    order: 1,
  },
  {
    name: "plausible",
    title: "Plausible",
    description:
      "Privacy-friendly analytics. No cookies, no personal data, EU-hosted. Used as a sanity-check against GA4.",
    privacyUrl: "https://plausible.io/privacy",
    cookies: [],
    purpose: "analytics",
    envVar: "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
    required: false,
    default: false,
    order: 2,
  },
  {
    name: "posthog",
    title: "PostHog",
    description:
      "Consent-only, anonymous page-view measurement used to understand newsroom navigation. Query strings and reader-entered text are not sent.",
    privacyUrl: "https://posthog.com/privacy",
    cookies: [/^ph_/],
    purpose: "analytics",
    envVar: "NEXT_PUBLIC_POSTHOG_KEY",
    required: false,
    default: false,
    order: 3,
  },
  {
    name: "clarity",
    title: "Microsoft Clarity",
    description:
      "Anonymized heatmaps + session replay (your face/screen is NOT recorded). Helps me see which sections people skip so I can rewrite them.",
    privacyUrl: "https://privacy.microsoft.com/en-us/privacystatement",
    cookies: [/^_clck$/, /^_clsk$/, /^CLID$/, /^MR$/, /^MUID$/, /^ANONCHK$/, /^SM$/],
    purpose: "analytics",
    envVar: "NEXT_PUBLIC_MS_CLARITY_ID",
    required: false,
    default: false,
    order: 4,
  },
  {
    name: "vercelanalytics",
    title: "Vercel Web Analytics",
    description:
      "Measures aggregate page visits in the Vercel hosting platform. It remains unloaded until you explicitly opt in.",
    privacyUrl: "https://vercel.com/legal/privacy-policy",
    cookies: [],
    purpose: "analytics",
    envVar: "VERCEL",
    required: false,
    default: false,
    order: 5,
  },
  {
    name: "vercelspeedinsights",
    title: "Vercel Speed Insights",
    description:
      "Measures real-user page performance in the Vercel hosting platform. It remains unloaded until you explicitly opt in.",
    privacyUrl: "https://vercel.com/legal/privacy-policy",
    cookies: [],
    purpose: "analytics",
    envVar: "VERCEL",
    required: false,
    default: false,
    order: 6,
  },
  {
    name: "meta",
    title: "Meta Pixel (Facebook + Instagram)",
    description:
      "Lets me show you my Beyond the Deal posts on Facebook/Instagram if you've visited the site. Standard Meta retargeting.",
    privacyUrl: "https://www.facebook.com/policy.php",
    cookies: [/^_fbp$/, /^_fbc$/, /^fr$/],
    purpose: "advertising",
    envVar: "NEXT_PUBLIC_META_PIXEL_ID",
    required: false,
    default: false,
    order: 7,
  },
  {
    name: "linkedin",
    title: "LinkedIn Insight Tag",
    description:
      "Lets me retarget you with my Beyond the Deal newsletter promos on LinkedIn. UHNW-targeted only.",
    privacyUrl: "https://www.linkedin.com/legal/privacy-policy",
    cookies: [/^li_/, /^lidc$/, /^bcookie$/, /^bscookie$/, /^UserMatchHistory$/],
    purpose: "advertising",
    envVar: "NEXT_PUBLIC_LINKEDIN_PARTNER_ID",
    required: false,
    default: false,
    order: 8,
  },
  {
    name: "x",
    title: "X (Twitter) Pixel",
    description: "Retargeting on X. Lets me reach you with relevant posts if you've visited my site.",
    privacyUrl: "https://twitter.com/en/privacy",
    cookies: [/^muc_ads$/, /^personalization_id$/],
    purpose: "advertising",
    envVar: "NEXT_PUBLIC_X_PIXEL_ID",
    required: false,
    default: false,
    order: 9,
  },
  {
    name: "tiktok",
    title: "TikTok Pixel",
    description: "Retargeting on TikTok. For when I run video-led campaigns.",
    privacyUrl: "https://www.tiktok.com/legal/privacy-policy",
    cookies: [/^_ttp$/, /^tt_appInfo$/],
    purpose: "advertising",
    envVar: "NEXT_PUBLIC_TIKTOK_PIXEL_ID",
    required: false,
    default: false,
    order: 10,
  },
  {
    name: "googleads",
    title: "Google Ads Conversion",
    description:
      "Closed-loop attribution for Google Ads campaigns — measures which articles drove newsletter signups vs. consultation requests.",
    privacyUrl: "https://policies.google.com/privacy",
    cookies: [/^_gcl_/, /^_gac_/],
    purpose: "conversion",
    envVar: "NEXT_PUBLIC_GOOGLE_ADS_ID",
    required: false,
    default: false,
    order: 11,
  },
];

/** Initial choices are strict opt-in for every optional provider. */
export function defaultConsentSelection(): Record<string, boolean> {
  return Object.fromEntries(
    PIXELS.map((provider) => [provider.name, provider.default]),
  );
}

/** "Reject all" retains only genuinely required services. */
export function rejectAllConsentSelection(): Record<string, boolean> {
  return Object.fromEntries(
    PIXELS.map((provider) => [provider.name, provider.required]),
  );
}

/** Look up a pixel by name. */
export function getPixel(name: string): PixelDefinition | undefined {
  return PIXELS.find((p) => p.name === name);
}

/** Returns pixels grouped by purpose for the banner UI. */
export function getPixelsByPurpose(): Record<ConsentPurpose, PixelDefinition[]> {
  const out: Record<ConsentPurpose, PixelDefinition[]> = {
    essential: [],
    analytics: [],
    advertising: [],
    conversion: [],
  };
  for (const p of PIXELS) out[p.purpose].push(p);
  return out;
}

/** The current user's consent state — stored in localStorage as JSON. */
export interface ConsentState {
  /** Klaro version of the policy — bump to re-prompt all users */
  version: number;
  /** ISO timestamp of when consent was given */
  timestamp: string;
  /** Per-service grant (true = allowed) */
  consents: Record<string, boolean>;
}

/** Current policy version — bump to force re-consent across all users. */
export const CONSENT_VERSION = 4;
export const CONSENT_STORAGE_KEY = "iwr-news-consent";
