// Server component — reads pixel IDs from env vars and passes to client.
// Renders the banner + loader. Drop this once in app/layout.tsx.

import { ConsentBanner } from "./ConsentBanner";
import { PixelLoader } from "./PixelLoader";

export function ConsentRoot() {
  const ids = {
    ga4: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || undefined,
    plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || undefined,
    clarity: process.env.NEXT_PUBLIC_MS_CLARITY_ID || undefined,
    meta: process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
    linkedin: process.env.NEXT_PUBLIC_LINKEDIN_INSIGHT_ID || undefined,
    x: process.env.NEXT_PUBLIC_X_PIXEL_ID || undefined,
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || undefined,
    googleAds: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || undefined,
  };

  return (
    <>
      <ConsentBanner />
      <PixelLoader ids={ids} />
    </>
  );
}
