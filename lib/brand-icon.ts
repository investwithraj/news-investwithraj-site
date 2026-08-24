export const IWR_ICON_SHA256 =
  "3aea2aa94b915b2c4e439d48f493081f1f1190cccd983b781db43e84f01e13f1";

// Content-address the verified IWR mark so browser and CDN icon caches cannot
// reuse a favicon from an earlier brand deployment.
export const IWR_ICON_URL = `/icon.svg?v=${IWR_ICON_SHA256}`;

// Keep the unversioned compatibility endpoint short-lived. The redirect target
// is content-addressed and can be cached independently for much longer.
export const FAVICON_REDIRECT_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=60";
