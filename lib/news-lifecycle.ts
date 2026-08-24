/**
 * Local newsroom lifecycle preview.
 *
 * `docs/migration/news-url-disposition.csv` is the authority. This typed
 * mirror is intentionally explicit so route handling never depends on a
 * production filesystem read and so the focused lifecycle test can detect
 * any drift from the CSV before release.
 */

export type NewsroomDisposition =
  | "KEEP"
  | "IMPROVE"
  | "MERGE"
  | "REDIRECT"
  | "NOINDEX"
  | "REMOVE"
  | "PRIVATE";

export type NewsroomLifecycleEntry = Readonly<{
  disposition: NewsroomDisposition;
  destination: string;
}>;

/**
 * One server-only release switch for the complete URL consolidation.
 *
 * The value is deliberately exact and fail-closed: only `1` activates the
 * approved redirect/removal cutover. Unset, `0`, `true` and every other value
 * preserve the current public routes. This is release configuration, not a
 * secret, and must never be exposed as a NEXT_PUBLIC variable.
 */
export const NEWSROOM_LIFECYCLE_CUTOVER_ENV =
  "NEWSROOM_LIFECYCLE_CUTOVER" as const;

type LifecycleEnvironment = Readonly<Record<string, string | undefined>>;

export function isNewsroomLifecycleCutoverEnabled(
  environment: LifecycleEnvironment = process.env,
): boolean {
  return environment[NEWSROOM_LIFECYCLE_CUTOVER_ENV] === "1";
}

export const PRIMARY_NEWSROOM_LIFECYCLE = {
  "/": { disposition: "IMPROVE", destination: "/" },
  "/news": { disposition: "KEEP", destination: "/news" },
  "/areas": { disposition: "MERGE", destination: "/news" },
  "/map": { disposition: "MERGE", destination: "/news" },
  "/terminal": { disposition: "NOINDEX", destination: "/terminal" },
  "/developers": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/developers",
  },
  "/about": { disposition: "KEEP", destination: "/about" },
  "/about/editorial-standards": {
    disposition: "KEEP",
    destination: "/about/editorial-standards",
  },
  "/legal/privacy": { disposition: "KEEP", destination: "/legal/privacy" },
  "/news/2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-08-13-omniyat-acquires-36-600-sqm-marjan-beach-plot-in-first-rak": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-28-burtville-launches-405-unit-bab-al-qasr-garden-residences-65": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-26-off-plan-sales-capture-71-of-dubai-transactions-as-h1-2026-h": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-25-dubai-logs-aed-419-94bn-in-h1-transactions-as-weekly-volumes": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island": {
    disposition: "KEEP",
    destination: "self",
  },
  "/news/2026-07-22-dubai-office-rents-stabilise-at-aed-238-sqft-as-grade-a-scar": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop": {
    disposition: "REMOVE",
    destination: "410 Gone",
  },
  "/news/2026-07-19-aed-318-billion-q1-transactions-reveal-diverging-investor-ma": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-14-dubai-property-prices-fall-1-24-in-june-as-yields-hold-at-6-": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-": {
    disposition: "REMOVE",
    destination: "410 Gone",
  },
  "/news/2026-07-10-aldar-unveils-dh6bn-yas-point-1-600-residences-anchor-northe": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-10-dubai-retail-sales-surge-171-to-aed-2-1bn-as-off-plan-mandat": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-08-dubai-ultra-prime-sales-hit-5-1bn-as-296-homes-above-10m-tra": {
    disposition: "MERGE",
    destination:
      "/news/2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction",
  },
  "/news/2026-07-06-bugatti-residences-closes-aed-270mn-in-june-penthouse-sales": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-02-dubai-real-estate-sets-historic-high-water-mark-with-aed-252": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-07-01-uk-buyers-lead-dubai-property-demand-but-banks-tighten-the-g": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif": {
    disposition: "REMOVE",
    destination: "410 Gone",
  },
  "/news/2026-06-28-dubai-mandates-monthly-rent-option-across-12-landlords-in-fl": {
    disposition: "REDIRECT",
    destination:
      "/news/2026-06-23-dubai-launches-flexi-rent-12-landlords-offer-monthly-instalm",
  },
  "/news/2026-06-24-oman-tenders-1-035bn-solar-mandate-as-vision-2040-absorbs-1-": {
    disposition: "REMOVE",
    destination: "410 Gone",
  },
  "/news/2026-06-23-dubai-launches-flexi-rent-12-landlords-offer-monthly-instalm": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-22-oman-scraps-sponsor-mandate-for-property-linked-residency-pe": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/news/2026-06-22-from-dhoom-to-dubai-how-rimi-sen-traded-bollywood-for-luxury": {
    disposition: "REMOVE",
    destination: "410 Gone",
  },
  "/news/2026-06-20-ahs-properties-acquires-shangri-la-dubai-for-dh1-1bn-eyes-dh": {
    disposition: "REDIRECT",
    destination:
      "/news/2026-06-10-shangri-la-dubai-sells-for-dh1-1bn-as-sheikh-zayed-road-valu",
  },
  "/news/2026-06-18-dld-expands-barwa-programme-with-workshops-after-serving-18-": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/news/2026-06-18-abu-dhabi-residential-sales-hit-dh38-1bn-in-record-q1-2026": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-gains-i": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-14-branded-residences-command-64-premium-as-dubai-buyers-chase-": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-13-palm-jumeirah-handover-2026-two-sold-out-towers-test-the-cre": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-12-dubai-luxury-off-plan-sales-hit-aed4-96bn-in-may": {
    disposition: "MERGE",
    destination:
      "/news/2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction",
  },
  "/news/2026-06-11-emaar-unveils-dh200bn-masterplan-for-150-000-residents-in-du": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-10-shangri-la-dubai-sells-for-dh1-1bn-as-sheikh-zayed-road-valu": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-10-cbd-and-dubai-holding-real-estate-launch-aed-157-9bn-backed-": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-07-dubai-logs-dhs28-51bn-in-may-property-deals-as-off-plan-abso": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-06-06-dubai-s-off-plan-dominance-66-900-sales-in-five-months-as-ma": {
    disposition: "MERGE",
    destination:
      "/news/2026-07-26-off-plan-sales-capture-71-of-dubai-transactions-as-h1-2026-h",
  },
  "/news/2026-06-05-abu-dhabi-s-rent-freeze-a-structural-intervention-in-the-cap": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-05-31-al-barari-villa-leased-for-aed-14-million-sets-dubai-rental-": {
    disposition: "REDIRECT",
    destination:
      "/news/2026-05-30-al-barari-villa-lease-resets-dubai-ultra-prime-rental-ceilin",
  },
  "/news/2026-05-30-al-barari-villa-lease-resets-dubai-ultra-prime-rental-ceilin": {
    disposition: "IMPROVE",
    destination: "self",
  },
  "/news/2026-05-30-dubai-s-19-6m-visitors-drive-luxury-property-surge-as-touris": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/areas/hudayriyat-island": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/hudayriyat-island",
  },
  "/areas/palm-jebel-ali": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/palm-jebel-ali",
  },
  "/areas/wynn-al-marjan": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/projects/wynn-al-marjan",
  },
  "/areas/downtown-dubai": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/downtown-dubai",
  },
  "/areas/dubai-marina": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/dubai-marina",
  },
  "/areas/palm-jumeirah": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/palm-jumeirah",
  },
  "/areas/business-bay": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/areas/difc": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/areas/dubai-hills-estate": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/dubai-hills-estate",
  },
  "/areas/jvc": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/areas/mbr-city": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/areas/dubai-creek-harbour": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/dubai-creek-harbour",
  },
  "/areas/saadiyat-island": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/saadiyat-island",
  },
  "/areas/yas-island": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/yas-island",
  },
  "/areas/al-reem-island": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/al-reem-island",
  },
  "/areas/al-raha-beach": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/areas/masdar-city": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/areas/al-reef": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/areas/al-marjan-island": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/areas/al-marjan-island",
  },
  "/developer/emaar": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/developers/emaar",
  },
  "/developer/aldar": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/developers/aldar",
  },
  "/developer/nakheel": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/developers/nakheel",
  },
  "/developer/modon": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/developers/modon",
  },
  "/developer/sobha": {
    disposition: "REDIRECT",
    destination: "https://investwithraj.com/developers/sobha",
  },
  "/developer/dubai-holding": {
    disposition: "NOINDEX",
    destination: "self; remove from sitemap",
  },
  "/v/dld-pulse": {
    disposition: "MERGE",
    destination: "/news?desk=dld-pulse",
  },
  "/v/off-plan-watch": {
    disposition: "MERGE",
    destination: "/news?desk=off-plan-watch",
  },
  "/v/uhnw-trades": {
    disposition: "MERGE",
    destination: "/news?desk=uhnw-trades",
  },
  "/v/sovereign-plays": {
    disposition: "MERGE",
    destination: "/news?desk=sovereign-plays",
  },
  "/v/beyond-the-deal": {
    disposition: "MERGE",
    destination: "/news?desk=beyond-the-deal",
  },
} as const satisfies Readonly<Record<string, NewsroomLifecycleEntry>>;

export const AUXILIARY_NEWSROOM_LIFECYCLE = {
  "/news/2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-absorbs": {
    disposition: "REDIRECT",
    destination:
      "/news/2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-gains-i",
  },
  "/news/2026-07-24-aldar-unveils-aed-100bn-marsa-al-saadiyat-abu-dhabi-s-final-": {
    disposition: "REDIRECT",
    destination:
      "/news/2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island",
  },
  "/news/2026-05-26-dld-21b-week": {
    disposition: "PRIVATE",
    destination: "no public destination until reviewed publication",
  },
  "/news/2026-05-26-modon-hudayriyat-golf-estate": {
    disposition: "PRIVATE",
    destination: "no public destination until reviewed publication",
  },
  "/news/2026-05-26-golden-visa-mortgage-flex": {
    disposition: "PRIVATE",
    destination: "no public destination until reviewed publication",
  },
  "/ask": { disposition: "NOINDEX", destination: "/ask" },
  "/pulse": {
    disposition: "REMOVE",
    destination: "410 Gone until a real product exists",
  },
  "/spatial": { disposition: "REDIRECT", destination: "/news" },
  "/wallet": {
    disposition: "REMOVE",
    destination: "410 Gone and delete dead public route after log check",
  },
  "/closing-bell": {
    disposition: "PRIVATE",
    destination: "no public destination until reviewed editions exist",
  },
  "/power-list/[year]": {
    disposition: "PRIVATE",
    destination: "no public destination until methodology and reviewed edition exists",
  },
  "/internal/dashboard": {
    disposition: "PRIVATE",
    destination: "self behind authentication",
  },
  "/internal/review": {
    disposition: "PRIVATE",
    destination: "self behind authentication",
  },
} as const satisfies Readonly<Record<string, NewsroomLifecycleEntry>>;

export const NEWSROOM_LIFECYCLE = {
  ...PRIMARY_NEWSROOM_LIFECYCLE,
  ...AUXILIARY_NEWSROOM_LIFECYCLE,
} as const satisfies Readonly<Record<string, NewsroomLifecycleEntry>>;

/**
 * Matrix redirects that are intentionally held in the local preview.
 *
 * A matrix redirect remains held until its destination is both indexable and
 * preserves the source's distinct evidence. This avoids treating a technically
 * valid redirect as a completed editorial consolidation.
 */
export const NEWSROOM_HELD_REDIRECTS = {
  "/news/2026-06-12-dubai-luxury-off-plan-sales-hit-aed4-96bn-in-may": {
    destination:
      "/news/2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction",
    reason:
      "Target does not yet preserve the May AED 4.96bn luxury off-plan series point, 391 transactions, or asset-class split.",
  },
  "/news/2026-06-06-dubai-s-off-plan-dominance-66-900-sales-in-five-months-as-ma": {
    destination:
      "/news/2026-07-26-off-plan-sales-capture-71-of-dubai-transactions-as-h1-2026-h",
    reason:
      "Target does not yet preserve the Jan-May 66,900-sales series point, AED 196.2bn value, or five-month methodology.",
  },
  "/areas/wynn-al-marjan": {
    destination: "https://investwithraj.com/projects/wynn-al-marjan",
    reason: "Advisory destination is public noindex, follow in pinned evidence.",
  },
} as const;

const INDEX_ELIGIBLE_DISPOSITIONS = new Set<NewsroomDisposition>([
  "KEEP",
  "IMPROVE",
]);
const REDIRECT_DISPOSITIONS = new Set<NewsroomDisposition>([
  "MERGE",
  "REDIRECT",
]);

export function getNewsroomLifecycle(
  pathname: string,
): NewsroomLifecycleEntry | null {
  return (
    (NEWSROOM_LIFECYCLE as Readonly<Record<string, NewsroomLifecycleEntry>>)[
      pathname
    ] ?? null
  );
}

export function getNewsArticleLifecycle(
  slug: string,
): NewsroomLifecycleEntry {
  // The matrix is a frozen legacy migration authority. A newly reviewed
  // daily publication is additive, so it receives a conservative, indexable
  // self lifecycle unless an explicit legacy disposition overrides it.
  return (
    getNewsroomLifecycle(`/news/${slug}`) ?? {
      disposition: "IMPROVE",
      destination: "self",
    }
  );
}

export function isIndexEligibleDisposition(
  disposition: NewsroomDisposition,
): boolean {
  return INDEX_ELIGIBLE_DISPOSITIONS.has(disposition);
}

export function isIndexEligiblePath(pathname: string): boolean {
  const lifecycle = pathname.startsWith("/news/")
    ? getNewsArticleLifecycle(pathname.slice("/news/".length))
    : getNewsroomLifecycle(pathname);
  return Boolean(
    lifecycle && isIndexEligibleDisposition(lifecycle.disposition),
  );
}

export function isIndexEligibleArticleSlug(slug: string): boolean {
  return isIndexEligiblePath(`/news/${slug}`);
}

/**
 * The approved public content set, independent of release activation.
 * Used by API/OG/distribution surfaces that must never project REMOVE,
 * PRIVATE, research or redirect-source records.
 */
export function isApprovedPublicLifecyclePath(pathname: string): boolean {
  const lifecycle = pathname.startsWith("/news/")
    ? getNewsArticleLifecycle(pathname.slice("/news/".length))
    : getNewsroomLifecycle(pathname);
  return Boolean(
    lifecycle &&
      (isIndexEligibleDisposition(lifecycle.disposition) ||
        lifecycle.disposition === "NOINDEX" ||
        isHeldRedirectPath(pathname)),
  );
}

export function isApprovedPublicLifecycleArticleSlug(slug: string): boolean {
  return isApprovedPublicLifecyclePath(`/news/${slug}`);
}

export function isPublicNoindexPath(pathname: string): boolean {
  return (
    getNewsroomLifecycle(pathname)?.disposition === "NOINDEX" ||
    isHeldRedirectPath(pathname)
  );
}

export function isHeldRedirectPath(pathname: string): boolean {
  return Object.hasOwn(NEWSROOM_HELD_REDIRECTS, pathname);
}

export function isRenderableArticleSlug(slug: string): boolean {
  const pathname = `/news/${slug}`;
  const disposition = getNewsArticleLifecycle(slug)?.disposition;
  return Boolean(
    disposition &&
      (isNewsroomLifecycleCutoverEnabled()
        ? isApprovedPublicLifecyclePath(pathname)
        : disposition !== "PRIVATE"),
  );
}

/** A route remains at its current URL until the explicit cutover is enabled. */
export function isRenderableLifecyclePath(pathname: string): boolean {
  const lifecycle = getNewsroomLifecycle(pathname);
  if (!lifecycle || lifecycle.disposition === "PRIVATE") return false;
  return isNewsroomLifecycleCutoverEnabled()
    ? isApprovedPublicLifecyclePath(pathname)
    : true;
}

/** Current public pages remain indexable before cutover; the matrix wins after it. */
export function isReleasedIndexEligiblePath(pathname: string): boolean {
  return isNewsroomLifecycleCutoverEnabled()
    ? isIndexEligiblePath(pathname)
    : isRenderableLifecyclePath(pathname);
}

export const NEWSROOM_EXACT_REDIRECTS = Object.entries(NEWSROOM_LIFECYCLE)
  .filter(
    ([source, lifecycle]) =>
      REDIRECT_DISPOSITIONS.has(lifecycle.disposition) &&
      !isHeldRedirectPath(source),
  )
  .map(([source, lifecycle]) => ({
    source,
    destination: lifecycle.destination,
    statusCode: 301 as const,
  }));

export function getReleasedNewsroomRedirects(
  environment: LifecycleEnvironment = process.env,
): typeof NEWSROOM_EXACT_REDIRECTS {
  return isNewsroomLifecycleCutoverEnabled(environment)
    ? NEWSROOM_EXACT_REDIRECTS
    : [];
}

/**
 * Relative lifecycle destinations are made absolute before they enter the
 * framework redirect table. A request on a future www.news host therefore
 * lands on the canonical host and final path in the same hop.
 */
export function canonicalNewsroomRedirectDestination(
  destination: string,
): string {
  return new URL(destination, "https://news.investwithraj.com").toString();
}

export const NEWSROOM_REMOVE_PATHS = Object.entries(NEWSROOM_LIFECYCLE)
  .filter(([, lifecycle]) => lifecycle.disposition === "REMOVE")
  .map(([pathname]) => pathname);

/** The six routes whose public response actually changes at this cutover. */
export const NEWSROOM_RELEASE_REMOVAL_CANDIDATES = NEWSROOM_REMOVE_PATHS.filter(
  (pathname) => pathname === "/pulse" || pathname.startsWith("/news/"),
);

const NEWSROOM_RELEASE_REMOVAL_PATHS = new Set(
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES,
);

/**
 * True only for an exact release-removal URL while the single lifecycle
 * cutover is enabled. Unknown article slugs and nested lookalikes must retain
 * their ordinary route behavior.
 */
export function isReleasedNewsroomRemovalPath(
  pathname: string,
  environment: LifecycleEnvironment = process.env,
): boolean {
  return (
    isNewsroomLifecycleCutoverEnabled(environment) &&
    NEWSROOM_RELEASE_REMOVAL_PATHS.has(pathname)
  );
}
