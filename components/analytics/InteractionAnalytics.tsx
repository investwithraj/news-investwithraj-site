"use client";

import { useEffect } from "react";

import {
  trackInteractionEvent,
  type InteractionEventName,
  type InteractionProperties,
} from "@/lib/analytics";

const EVENT_NAMES = new Set<InteractionEventName>([
  "nav_open",
  "nav_close",
  "nav_click",
  "book_call_click",
  "booking_open",
  "booking_complete",
  "booking_close",
  "whatsapp_click",
  "brief_start",
  "brief_step",
  "brief_complete",
  "lead_submit_success",
  "lead_submit_error",
  "area_open",
  "developer_open",
  "project_open",
  "note_open",
  "guide_open",
  "calculator_start",
  "calculator_complete",
  "video_start",
  "video_25",
  "video_50",
  "video_75",
  "video_complete",
  "news_to_advisory",
  "article_source_open",
  "ai_brief_start",
  "ai_brief_complete",
  "ai_brief_error",
  "newsletter_signup",
]);

const ENTITY_ROUTES = [
  { prefix: "/areas/", event: "area_open" },
  { prefix: "/developer/", event: "developer_open" },
] as const satisfies ReadonlyArray<{
  prefix: string;
  event: InteractionEventName;
}>;

interface DeclaredInteractionDetail {
  event?: unknown;
  properties?: unknown;
}

/**
 * Delegated, route-aware interaction measurement for the public newsroom.
 * It observes semantic controls and endpoint paths only; it never inspects
 * form bodies, field values, article queries or contact details.
 */
export default function InteractionAnalytics() {
  useEffect(() => {
    const videoMilestones = new WeakMap<HTMLMediaElement, Set<number>>();
    const route = () => window.location.pathname;

    const onClick = (event: MouseEvent) => {
      const origin =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("a[href], button")
          : null;
      if (!origin) return;

      const source = interactionSource(origin);
      const currentRoute = route();
      const level = ctaLevel(origin);
      const destination = anchorDestination(origin);
      const action =
        origin.dataset.ctaAction ??
        origin.closest<HTMLElement>("[data-cta-action]")?.dataset.ctaAction;

      if (origin.matches("[data-analytics-nav-toggle]")) {
        trackInteractionEvent(
          origin.getAttribute("aria-expanded") === "true"
            ? "nav_close"
            : "nav_open",
          { source, route: currentRoute },
        );
      }

      if (
        destination &&
        origin.closest("header, nav, [data-site-directory]")
      ) {
        trackInteractionEvent("nav_click", {
          source,
          route: currentRoute,
          destination,
          ctaLevel: level,
        });
      }

      if (action === "book-call") {
        trackInteractionEvent("book_call_click", {
          source,
          route: currentRoute,
          ctaLevel: level,
        });
      }

      if (
        action === "whatsapp" ||
        destination?.startsWith("wa.me/") ||
        destination?.includes("whatsapp.com/")
      ) {
        trackInteractionEvent("whatsapp_click", {
          source,
          route: currentRoute,
          ctaLevel: level,
        });
      }

      if (
        action === "start-brief" ||
        destination === "investwithraj.com/brief" ||
        destination?.startsWith("investwithraj.com/brief/")
      ) {
        trackInteractionEvent("brief_start", {
          source,
          route: currentRoute,
          ctaLevel: level,
        });
      }

      if (destination?.startsWith("investwithraj.com/")) {
        trackInteractionEvent("news_to_advisory", {
          source,
          route: currentRoute,
          destination,
          ctaLevel: level,
        });
      }

      if (
        destination &&
        origin.closest(
          '[aria-labelledby="sources-title"], [data-article-sources]',
        )
      ) {
        trackInteractionEvent("article_source_open", {
          source: "article-sources",
          route: currentRoute,
          destination,
        });
      }

      if (destination) {
        const path = destinationPath(destination);
        const routeMatch = ENTITY_ROUTES.find(
          ({ prefix }) =>
            path.startsWith(prefix) && path.slice(prefix.length).length > 0,
        );
        if (routeMatch) {
          trackInteractionEvent(routeMatch.event, {
            source,
            route: currentRoute,
            destination,
            entity: path.slice(routeMatch.prefix.length).split("/")[0],
          });
        }
      }
    };

    const onDeclaredInteraction = (event: Event) => {
      const detail = (event as CustomEvent<DeclaredInteractionDetail>).detail;
      if (
        !detail ||
        typeof detail.event !== "string" ||
        !EVENT_NAMES.has(detail.event as InteractionEventName)
      ) {
        return;
      }
      const properties =
        detail.properties && typeof detail.properties === "object"
          ? (detail.properties as InteractionProperties)
          : {};
      trackInteractionEvent(
        detail.event as InteractionEventName,
        properties,
      );
    };

    const onMedia = (event: Event) => {
      const media =
        event.target instanceof HTMLMediaElement ? event.target : null;
      if (!media) return;
      const currentRoute = route();
      const source = interactionSource(media);
      const videoId = safeVideoId(media);
      const milestones =
        videoMilestones.get(media) ??
        (() => {
          const created = new Set<number>();
          videoMilestones.set(media, created);
          return created;
        })();

      if (event.type === "play" && !milestones.has(0)) {
        milestones.add(0);
        trackInteractionEvent("video_start", {
          source,
          route: currentRoute,
          videoId,
          progress: 0,
        });
        return;
      }

      if (event.type === "ended") {
        if (!milestones.has(100)) {
          milestones.add(100);
          trackInteractionEvent("video_complete", {
            source,
            route: currentRoute,
            videoId,
            progress: 100,
          });
        }
        return;
      }

      if (
        event.type !== "timeupdate" ||
        !Number.isFinite(media.duration) ||
        media.duration <= 0
      ) {
        return;
      }
      const ratio = media.currentTime / media.duration;
      for (const threshold of [25, 50, 75] as const) {
        if (ratio >= threshold / 100 && !milestones.has(threshold)) {
          milestones.add(threshold);
          trackInteractionEvent(`video_${threshold}` as InteractionEventName, {
            source,
            route: currentRoute,
            videoId,
            progress: threshold,
          });
        }
      }
    };

    const originalFetch = window.fetch.bind(window);
    const observedFetch: typeof window.fetch = async (...args) => {
      const path = requestPath(args[0]);
      const currentRoute = route();
      const source = pageSource(currentRoute);

      if (path === "/api/brief") {
        trackInteractionEvent("ai_brief_start", {
          source,
          route: currentRoute,
        });
      }

      try {
        const response = await originalFetch(...args);
        if (path === "/api/brief") {
          trackInteractionEvent(
            response.ok ? "ai_brief_complete" : "ai_brief_error",
            {
              source,
              route: currentRoute,
              status: response.ok ? "complete" : `http-${response.status}`,
              errorCode: response.ok ? undefined : `http-${response.status}`,
            },
          );
        } else if (path === "/api/lead") {
          trackInteractionEvent(
            response.ok ? "lead_submit_success" : "lead_submit_error",
            {
              source,
              route: currentRoute,
              status: response.ok ? "accepted" : `http-${response.status}`,
              errorCode: response.ok ? undefined : `http-${response.status}`,
            },
          );
        } else if (path === "/api/newsletter" && response.ok) {
          trackInteractionEvent("newsletter_signup", {
            source,
            route: currentRoute,
            status: "accepted",
          });
        }
        return response;
      } catch (error) {
        if (path === "/api/brief") {
          trackInteractionEvent("ai_brief_error", {
            source,
            route: currentRoute,
            status: "network-error",
            errorCode: "network-error",
          });
        } else if (path === "/api/lead") {
          trackInteractionEvent("lead_submit_error", {
            source,
            route: currentRoute,
            status: "network-error",
            errorCode: "network-error",
          });
        }
        throw error;
      }
    };
    window.fetch = observedFetch;

    document.addEventListener("click", onClick, true);
    document.addEventListener("play", onMedia, true);
    document.addEventListener("timeupdate", onMedia, true);
    document.addEventListener("ended", onMedia, true);
    window.addEventListener("iwr:interaction", onDeclaredInteraction);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("play", onMedia, true);
      document.removeEventListener("timeupdate", onMedia, true);
      document.removeEventListener("ended", onMedia, true);
      window.removeEventListener("iwr:interaction", onDeclaredInteraction);
      if (window.fetch === observedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}

function interactionSource(element: Element): string {
  return (
    element.closest<HTMLElement>("[data-cta-source]")?.dataset.ctaSource ??
    element.closest<HTMLElement>("[data-analytics-source]")?.dataset
      .analyticsSource ??
    (element.closest("header")
      ? "news-navigation"
      : element.closest("footer")
        ? "news-footer"
        : element.closest("nav")
          ? "page-navigation"
          : "news-page")
  );
}

function ctaLevel(element: Element): 1 | 2 | 3 | undefined {
  const raw = element.closest<HTMLElement>("[data-cta-level]")?.dataset.ctaLevel;
  return raw === "1" ? 1 : raw === "2" ? 2 : raw === "3" ? 3 : undefined;
}

function anchorDestination(element: HTMLElement): string | undefined {
  if (!(element instanceof HTMLAnchorElement)) return undefined;
  try {
    const url = new URL(element.href, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.hostname === window.location.hostname
      ? url.pathname
      : `${url.hostname}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function destinationPath(destination: string): string {
  return destination.startsWith("/")
    ? destination
    : `/${destination.split("/").slice(1).join("/")}`;
}

function safeVideoId(media: HTMLMediaElement): string {
  const declared = media.dataset.analyticsVideoId;
  if (declared) return declared;
  try {
    const url = new URL(media.currentSrc || media.src, window.location.href);
    return (
      url.pathname.split("/").filter(Boolean).at(-1)?.replace(/\.[^.]+$/, "") ??
      "page-video"
    );
  } catch {
    return "page-video";
  }
}

function requestPath(input: RequestInfo | URL): string | null {
  try {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    return new URL(raw, window.location.href).pathname;
  } catch {
    return null;
  }
}

function pageSource(route: string): string {
  const segment = route.split("/").filter(Boolean)[0];
  return segment ? `news:${segment}` : "news:home";
}
