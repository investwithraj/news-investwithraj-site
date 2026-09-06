"use client";

// Pixel injector — runs after consent is granted, watches for changes,
// and dynamically injects/removes pixel snippets. Tracking IDs are passed
// in via props from a server component that reads the env vars.

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ga4Snippet,
  ga4ExternalSrc,
  plausibleAttrs,
  plausibleSrc,
  metaPixelSnippet,
  linkedinSnippet,
  xPixelSnippet,
  tiktokSnippet,
  googleAdsSnippet,
  googleAdsExternalSrc,
  clarityPixelSnippet,
} from "@/lib/pixels/snippets";
import { hasExplicitConsent, readConsent } from "@/lib/consent/state";

interface Props {
  /** Tracking IDs supplied from a server component reading env vars. */
  ids: {
    ga4?: string;
    plausibleDomain?: string;
    clarity?: string;
    meta?: string;
    linkedin?: string;
    x?: string;
    tiktok?: string;
    googleAds?: string;
  };
  /** Public PostHog project configuration; no request is sent before consent. */
  posthog?: {
    apiKey: string;
    apiHost: string;
  };
  /** Canonical hosts that share the same GA property. */
  crossDomainHosts: readonly string[];
  /** Vercel integrations exist only in a Vercel runtime and remain consented. */
  enableVercelObservability: boolean;
}

// Track which pixels we've already loaded so we don't double-inject
const loaded = new Set<string>();

function injectInline(id: string, code: string) {
  if (loaded.has(id)) return;
  const s = document.createElement("script");
  s.id = `pixel-${id}`;
  s.textContent = code;
  document.head.appendChild(s);
  loaded.add(id);
}

function injectExternal(id: string, src: string, attrs: Record<string, string> = {}) {
  if (loaded.has(id)) return;
  const s = document.createElement("script");
  s.id = `pixel-${id}-ext`;
  s.async = true;
  s.src = src;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  loaded.add(id);
}

function removePixel(id: string) {
  document.getElementById(`pixel-${id}`)?.remove();
  document.getElementById(`pixel-${id}-ext`)?.remove();
  loaded.delete(id);
}

const POSTHOG_ANONYMOUS_ID_KEY = "iwr-news-posthog-anonymous-id";

function posthogAnonymousId(): string | undefined {
  try {
    const existing = localStorage.getItem(POSTHOG_ANONYMOUS_ID_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    localStorage.setItem(POSTHOG_ANONYMOUS_ID_KEY, generated);
    return generated;
  } catch {
    return undefined;
  }
}

function forgetPosthogAnonymousId() {
  try {
    localStorage.removeItem(POSTHOG_ANONYMOUS_ID_KEY);
  } catch {
    // Storage may be blocked. There is nothing else to withdraw locally.
  }
}

function applyConsent(ids: Props["ids"], crossDomainHosts: readonly string[]) {
  const state = readConsent();

  if (!hasExplicitConsent(state, "posthog")) forgetPosthogAnonymousId();

  // GA4
  if (hasExplicitConsent(state, "ga4") && ids.ga4) {
    injectExternal("ga4", ga4ExternalSrc(ids.ga4));
    injectInline("ga4-init", ga4Snippet(ids.ga4, crossDomainHosts));
  } else {
    removePixel("ga4");
    removePixel("ga4-init");
  }

  // Plausible
  if (hasExplicitConsent(state, "plausible") && ids.plausibleDomain) {
    injectExternal("plausible", plausibleSrc(), {
      ...plausibleAttrs(ids.plausibleDomain),
      defer: "true",
    });
  } else {
    removePixel("plausible");
  }

  // Clarity
  if (hasExplicitConsent(state, "clarity") && ids.clarity) {
    injectInline("clarity", clarityPixelSnippet(ids.clarity));
  } else {
    removePixel("clarity");
  }

  // Meta
  if (hasExplicitConsent(state, "meta") && ids.meta) {
    injectInline("meta", metaPixelSnippet(ids.meta));
  } else {
    removePixel("meta");
  }

  // LinkedIn
  if (hasExplicitConsent(state, "linkedin") && ids.linkedin) {
    injectInline("linkedin", linkedinSnippet(ids.linkedin));
  } else {
    removePixel("linkedin");
  }

  // X
  if (hasExplicitConsent(state, "x") && ids.x) {
    injectInline("x", xPixelSnippet(ids.x));
  } else {
    removePixel("x");
  }

  // TikTok
  if (hasExplicitConsent(state, "tiktok") && ids.tiktok) {
    injectInline("tiktok", tiktokSnippet(ids.tiktok));
  } else {
    removePixel("tiktok");
  }

  // Google Ads
  if (hasExplicitConsent(state, "googleads") && ids.googleAds) {
    injectExternal("googleads", googleAdsExternalSrc(ids.googleAds));
    injectInline("googleads-init", googleAdsSnippet(ids.googleAds));
  } else {
    removePixel("googleads");
    removePixel("googleads-init");
  }
}

let lastGaPageView = "";
let lastPosthogPageView = "";

function recordGaPageView(ids: Props["ids"]) {
  const state = readConsent();
  if (
    !hasExplicitConsent(state, "ga4") ||
    !ids.ga4 ||
    typeof window === "undefined"
  ) {
    return;
  }
  const location = `${window.location.pathname}${window.location.search}`;
  if (lastGaPageView === location) return;
  lastGaPageView = location;
  window.gtag?.("event", "page_view", {
    page_location: window.location.href,
    page_path: location,
    page_title: document.title,
  });
}

function recordPosthogPageView(posthog: Props["posthog"]) {
  const state = readConsent();
  if (
    !hasExplicitConsent(state, "posthog") ||
    !posthog ||
    typeof window === "undefined"
  ) {
    return;
  }

  // Deliberately omit the query string: searches and campaign parameters can
  // contain reader-entered data. GA handles consented campaign attribution.
  const page = `${window.location.origin}${window.location.pathname}`;
  if (lastPosthogPageView === page) return;
  const distinctId = posthogAnonymousId();
  if (!distinctId) return;
  lastPosthogPageView = page;

  void fetch(`${posthog.apiHost}/capture/`, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: posthog.apiKey,
      event: "$pageview",
      properties: {
        distinct_id: distinctId,
        $current_url: page,
        $host: window.location.hostname,
        $pathname: window.location.pathname,
      },
    }),
  }).catch(() => {
    // Measurement must never interrupt reading or navigation.
  });
}

export function PixelLoader({
  ids,
  posthog,
  crossDomainHosts,
  enableVercelObservability,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [vercelConsent, setVercelConsent] = useState({
    analytics: false,
    speedInsights: false,
  });

  useEffect(() => {
    function applyCurrentConsent() {
      const state = readConsent();
      applyConsent(ids, crossDomainHosts);
      recordGaPageView(ids);
      recordPosthogPageView(posthog);
      setVercelConsent({
        analytics:
          enableVercelObservability &&
          hasExplicitConsent(state, "vercelanalytics"),
        speedInsights:
          enableVercelObservability &&
          hasExplicitConsent(state, "vercelspeedinsights"),
      });
    }

    // Initial render is always off. Only a current, literal stored opt-in may
    // mount either Vercel component after hydration.
    applyCurrentConsent();
    window.addEventListener("iwr-consent-changed", applyCurrentConsent);
    return () =>
      window.removeEventListener("iwr-consent-changed", applyCurrentConsent);
  }, [crossDomainHosts, enableVercelObservability, ids, posthog]);

  useEffect(() => {
    recordGaPageView(ids);
    recordPosthogPageView(posthog);
  }, [ids, pathname, posthog, search]);

  return (
    <>
      {vercelConsent.analytics ? <Analytics /> : null}
      {vercelConsent.speedInsights ? <SpeedInsights /> : null}
    </>
  );
}
