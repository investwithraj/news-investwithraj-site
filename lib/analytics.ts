"use client";

import { isAllowed } from "@/lib/consent/state";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (
      command: string,
      eventName: string,
      properties?: Record<string, unknown>,
    ) => void;
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, string | number> },
    ) => void;
  }
}

export type InteractionEventName =
  | "nav_open"
  | "nav_close"
  | "nav_click"
  | "book_call_click"
  | "booking_open"
  | "booking_complete"
  | "booking_close"
  | "whatsapp_click"
  | "brief_start"
  | "brief_step"
  | "brief_complete"
  | "lead_submit_success"
  | "lead_submit_error"
  | "area_open"
  | "developer_open"
  | "project_open"
  | "note_open"
  | "guide_open"
  | "calculator_start"
  | "calculator_complete"
  | "video_start"
  | "video_25"
  | "video_50"
  | "video_75"
  | "video_complete"
  | "news_to_advisory"
  | "article_source_open"
  | "ai_brief_start"
  | "ai_brief_complete"
  | "ai_brief_error"
  | "newsletter_signup";

export interface InteractionProperties {
  source?: string;
  route?: string;
  destination?: string;
  entity?: string;
  step?: string;
  status?: string;
  contentType?: string;
  videoId?: string;
  calculator?: string;
  errorCode?: string;
  ctaLevel?: 1 | 2 | 3;
  progress?: 0 | 25 | 50 | 75 | 100;
}

const PROPERTY_ALLOWLIST: Record<
  InteractionEventName,
  readonly (keyof InteractionProperties)[]
> = {
  nav_open: ["source", "route"],
  nav_close: ["source", "route"],
  nav_click: ["source", "route", "destination", "ctaLevel"],
  book_call_click: ["source", "route", "ctaLevel"],
  booking_open: ["source", "route"],
  booking_complete: ["source", "route", "status"],
  booking_close: ["source", "route"],
  whatsapp_click: ["source", "route", "ctaLevel"],
  brief_start: ["source", "route", "ctaLevel"],
  brief_step: ["source", "route", "step"],
  brief_complete: ["source", "route", "status"],
  lead_submit_success: ["source", "route", "status"],
  lead_submit_error: ["source", "route", "status", "errorCode"],
  area_open: ["source", "route", "destination", "entity"],
  developer_open: ["source", "route", "destination", "entity"],
  project_open: ["source", "route", "destination", "entity"],
  note_open: ["source", "route", "destination", "entity"],
  guide_open: ["source", "route", "destination", "entity"],
  calculator_start: ["source", "route", "calculator"],
  calculator_complete: ["source", "route", "calculator", "status"],
  video_start: ["source", "route", "videoId", "progress"],
  video_25: ["source", "route", "videoId", "progress"],
  video_50: ["source", "route", "videoId", "progress"],
  video_75: ["source", "route", "videoId", "progress"],
  video_complete: ["source", "route", "videoId", "progress"],
  news_to_advisory: ["source", "route", "destination", "ctaLevel"],
  article_source_open: ["source", "route", "destination"],
  ai_brief_start: ["source", "route"],
  ai_brief_complete: ["source", "route", "status"],
  ai_brief_error: ["source", "route", "status", "errorCode"],
  newsletter_signup: ["source", "route", "status"],
};

const LOCATION_KEYS = new Set<keyof InteractionProperties>([
  "route",
  "destination",
]);
const NUMBER_KEYS = new Set<keyof InteractionProperties>([
  "ctaLevel",
  "progress",
]);
const recentEvents = new Map<string, number>();

/**
 * Emits allowlisted interaction metadata only after explicit analytics
 * consent. Form values, contact details, full URLs and arbitrary properties
 * are never read or forwarded.
 */
export function trackInteractionEvent(
  eventName: InteractionEventName,
  properties: InteractionProperties = {},
): void {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;

  const sanitized = sanitizeInteractionProperties(eventName, properties);
  const dedupeKey = `${eventName}:${JSON.stringify(sanitized)}`;
  const now = Date.now();
  const previous = recentEvents.get(dedupeKey) ?? 0;
  if (now - previous < 350) return;
  recentEvents.set(dedupeKey, now);
  if (recentEvents.size > 120) {
    for (const [key, timestamp] of recentEvents) {
      if (now - timestamp > 30_000) recentEvents.delete(key);
    }
  }

  try {
    window.gtag?.("event", eventName, sanitized);
  } catch {
    // Analytics must never interrupt the reader.
  }

  try {
    window.dataLayer?.push({ event: eventName, ...sanitized });
  } catch {
    // Analytics must never interrupt the reader.
  }

  try {
    window.plausible?.(eventName, { props: sanitized });
  } catch {
    // Analytics must never interrupt the reader.
  }

  window.dispatchEvent(
    new CustomEvent("iwr:analytics-event", {
      detail: { event: eventName, properties: sanitized },
    }),
  );
}

function hasAnalyticsConsent(): boolean {
  return (
    isAllowed("ga4") || isAllowed("plausible") || isAllowed("clarity")
  );
}

function sanitizeInteractionProperties(
  eventName: InteractionEventName,
  properties: InteractionProperties,
): Record<string, string | number> {
  const output: Record<string, string | number> = {};
  for (const key of PROPERTY_ALLOWLIST[eventName]) {
    const value = properties[key];
    if (value === undefined) continue;

    if (NUMBER_KEYS.has(key)) {
      if (key === "ctaLevel" && (value === 1 || value === 2 || value === 3)) {
        output.cta_level = value;
      } else if (
        key === "progress" &&
        (value === 0 ||
          value === 25 ||
          value === 50 ||
          value === 75 ||
          value === 100)
      ) {
        output.progress = value;
      }
      continue;
    }

    if (typeof value !== "string") continue;
    const safeValue = LOCATION_KEYS.has(key)
      ? safeAnalyticsLocation(value)
      : safeAnalyticsToken(value);
    if (!safeValue) continue;
    output[toSnakeCase(key)] = safeValue;
  }
  return output;
}

function safeAnalyticsLocation(value: string): string | undefined {
  const input = value.trim();
  if (!input || /^(?:mailto|tel|sms|javascript|data):/i.test(input)) {
    return undefined;
  }
  try {
    const url = new URL(input, "https://news.investwithraj.com");
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const local = url.hostname === "news.investwithraj.com";
    const location = local ? url.pathname : `${url.hostname}${url.pathname}`;
    return location.slice(0, 160);
  } catch {
    return undefined;
  }
}

function safeAnalyticsToken(value: string): string | undefined {
  const normalized = value.trim().toLocaleLowerCase("en").slice(0, 96);
  if (
    !normalized ||
    /@|(?:mailto|tel):|[?&#=]/i.test(normalized) ||
    /\b\d{7,}\b/.test(normalized) ||
    !/^[a-z0-9][a-z0-9:_./ -]*$/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
