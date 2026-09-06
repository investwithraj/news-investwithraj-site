import { SITE } from "@/lib/constants";

type AnalyticsEnvironment = Readonly<Record<string, string | undefined>>;

export type AnalyticsProviderIds = Readonly<{
  ga4?: string;
  plausibleDomain?: string;
  clarity?: string;
  meta?: string;
  linkedin?: string;
  x?: string;
  tiktok?: string;
  googleAds?: string;
}>;

export type NewsroomAnalyticsConfig = Readonly<{
  ids: AnalyticsProviderIds;
  posthog?: Readonly<{
    apiKey: string;
    apiHost: string;
  }>;
  crossDomainHosts: readonly string[];
}>;

function firstValid(
  environment: AnalyticsEnvironment,
  names: readonly string[],
  pattern: RegExp,
): string | undefined {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value && pattern.test(value)) return value;
  }
  return undefined;
}

function hostname(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.hostname : undefined;
  } catch {
    return undefined;
  }
}

function httpsOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the newsroom measurement configuration without exposing secrets or
 * baking a provider identifier into the bundle. The main-site names are the
 * canonical contract; the two historical newsroom names remain temporary
 * compatibility aliases during migration.
 */
export function newsroomAnalyticsConfig(
  environment: AnalyticsEnvironment = process.env,
): NewsroomAnalyticsConfig {
  const ids: AnalyticsProviderIds = {
    ga4: firstValid(
      environment,
      ["NEXT_PUBLIC_GA_MEASUREMENT_ID", "NEXT_PUBLIC_GA4_MEASUREMENT_ID"],
      /^G-[A-Z0-9]{6,20}$/,
    ),
    plausibleDomain: firstValid(
      environment,
      ["NEXT_PUBLIC_PLAUSIBLE_DOMAIN"],
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i,
    ),
    clarity: firstValid(
      environment,
      ["NEXT_PUBLIC_MS_CLARITY_ID"],
      /^[a-z0-9]{6,32}$/i,
    ),
    meta: firstValid(
      environment,
      ["NEXT_PUBLIC_META_PIXEL_ID"],
      /^\d{6,24}$/,
    ),
    linkedin: firstValid(
      environment,
      ["NEXT_PUBLIC_LINKEDIN_PARTNER_ID", "NEXT_PUBLIC_LINKEDIN_INSIGHT_ID"],
      /^\d{4,24}$/,
    ),
    x: firstValid(
      environment,
      ["NEXT_PUBLIC_X_PIXEL_ID"],
      /^[a-z0-9]{4,32}$/i,
    ),
    tiktok: firstValid(
      environment,
      ["NEXT_PUBLIC_TIKTOK_PIXEL_ID"],
      /^[A-Z0-9]{8,32}$/i,
    ),
    googleAds: firstValid(
      environment,
      ["NEXT_PUBLIC_GOOGLE_ADS_ID"],
      /^AW-\d{6,20}$/,
    ),
  };

  const configuredHosts = [hostname(SITE.rootUrl), hostname(SITE.url)].filter(
    (value): value is string => Boolean(value),
  );

  const posthogKey = firstValid(
    environment,
    ["NEXT_PUBLIC_POSTHOG_KEY"],
    /^phc_[A-Za-z0-9_-]{8,160}$/,
  );
  const posthogHost = httpsOrigin(environment.NEXT_PUBLIC_POSTHOG_HOST);

  return {
    ids,
    posthog:
      posthogKey && posthogHost
        ? { apiKey: posthogKey, apiHost: posthogHost }
        : undefined,
    crossDomainHosts: [...new Set(configuredHosts)],
  };
}
