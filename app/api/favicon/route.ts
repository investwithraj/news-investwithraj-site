import {
  FAVICON_REDIRECT_CACHE_CONTROL,
  IWR_ICON_URL,
} from "@/lib/brand-icon";

function redirectToIwrIcon(): Response {
  return new Response(null, {
    status: 307,
    headers: {
      "Cache-Control": FAVICON_REDIRECT_CACHE_CONTROL,
      Location: IWR_ICON_URL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function GET(): Response {
  return redirectToIwrIcon();
}

export function HEAD(): Response {
  return redirectToIwrIcon();
}
