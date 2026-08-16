export const IWR_ICON_SHA256 =
  "2617a21ba23b753515db82ddd04e0a0e656d2facbcbb87fae7814dc79aef164c";

// Content-address the verified IWR mark so browser and CDN icon caches cannot
// reuse a favicon from an earlier brand deployment.
export const IWR_ICON_URL = `/icon.svg?v=${IWR_ICON_SHA256}`;

// Keep the unversioned compatibility endpoint short-lived. The redirect target
// is content-addressed and can be cached independently for much longer.
export const FAVICON_REDIRECT_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=60";
