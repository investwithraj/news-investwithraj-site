"use client";

// Pixel injector — runs after consent is granted, watches for changes,
// and dynamically injects/removes pixel snippets. Tracking IDs are passed
// in via props from a server component that reads the env vars.

import { useEffect } from "react";
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
import { readConsent } from "@/lib/consent/state";

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

function applyConsent(ids: Props["ids"]) {
  const state = readConsent();
  if (!state) return; // No consent yet — nothing fires

  // GA4
  if (state.consents.ga4 && ids.ga4) {
    injectExternal("ga4", ga4ExternalSrc(ids.ga4));
    injectInline("ga4-init", ga4Snippet(ids.ga4));
  } else {
    removePixel("ga4");
    removePixel("ga4-init");
  }

  // Plausible
  if (state.consents.plausible && ids.plausibleDomain) {
    injectExternal("plausible", plausibleSrc(ids.plausibleDomain), {
      ...plausibleAttrs(ids.plausibleDomain),
      defer: "true",
    });
  } else {
    removePixel("plausible");
  }

  // Clarity
  if (state.consents.clarity && ids.clarity) {
    injectInline("clarity", clarityPixelSnippet(ids.clarity));
  } else {
    removePixel("clarity");
  }

  // Meta
  if (state.consents.meta && ids.meta) {
    injectInline("meta", metaPixelSnippet(ids.meta));
  } else {
    removePixel("meta");
  }

  // LinkedIn
  if (state.consents.linkedin && ids.linkedin) {
    injectInline("linkedin", linkedinSnippet(ids.linkedin));
  } else {
    removePixel("linkedin");
  }

  // X
  if (state.consents.x && ids.x) {
    injectInline("x", xPixelSnippet(ids.x));
  } else {
    removePixel("x");
  }

  // TikTok
  if (state.consents.tiktok && ids.tiktok) {
    injectInline("tiktok", tiktokSnippet(ids.tiktok));
  } else {
    removePixel("tiktok");
  }

  // Google Ads
  if (state.consents.googleads && ids.googleAds) {
    injectExternal("googleads", googleAdsExternalSrc(ids.googleAds));
    injectInline("googleads-init", googleAdsSnippet(ids.googleAds));
  } else {
    removePixel("googleads");
    removePixel("googleads-init");
  }
}

export function PixelLoader({ ids }: Props) {
  useEffect(() => {
    // Apply current consent on mount
    applyConsent(ids);

    // React to live changes via custom event
    function onChange() {
      applyConsent(ids);
    }
    window.addEventListener("iwr-consent-changed", onChange);
    return () => window.removeEventListener("iwr-consent-changed", onChange);
  }, [ids]);

  return null;
}
