// Basic-Auth gate for /internal/* routes.
//
// A successful login also mints a signed HttpOnly session scoped narrowly to
// the API namespace used by the review and queue desks. Client JavaScript
// never receives POST_PUBLISH_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { isReleasedNewsroomRemovalPath } from "@/lib/news-lifecycle";
import { decideNewsroomPublicMedia } from "@/lib/public-media-policy";
import {
  createReviewSession,
  REVIEW_SESSION_COOKIE,
  REVIEW_SESSION_COOKIE_PATH,
  REVIEW_SESSION_MAX_AGE_SECONDS,
} from "@/lib/news-review/session";
import { consumeInternalAuthFailure } from "@/lib/security/internal-auth-limit";

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function authChallenge(
  request: NextRequest,
  message = "Authentication required",
) {
  const decision = await consumeInternalAuthFailure(request);
  if (!decision.available) {
    return new NextResponse("Internal authentication is unavailable.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
        "Retry-After": String(decision.retryAfterSeconds),
      },
    });
  }
  if (!decision.allowed) {
    return new NextResponse("Too many failed authentication attempts.", {
      status: 429,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
        "Retry-After": String(decision.retryAfterSeconds),
        "X-Auth-Lockout-Scope": decision.scope,
      },
    });
  }
  return new NextResponse(message, {
    status: 401,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
      Vary: "Authorization",
      "WWW-Authenticate": 'Basic realm="news.investwithraj.com internal"',
    },
  });
}

function strongCredentials(
  user: string | undefined,
  password: string | undefined,
): user is string {
  const normalizedUser = user?.trim() ?? "";
  const normalizedPassword = password?.trim() ?? "";
  const placeholder =
    /^(?:admin|administrator|changeme|password|investwithraj|raj|test|default)$/iu;
  return (
    normalizedUser.length >= 8 &&
    !placeholder.test(normalizedUser) &&
    new TextEncoder().encode(normalizedPassword).byteLength >= 32 &&
    !placeholder.test(normalizedPassword) &&
    normalizedUser !== normalizedPassword
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mediaDecision = decideNewsroomPublicMedia(pathname);
  if (mediaDecision.state !== "ungoverned") {
    if (mediaDecision.allowed) {
      const response = NextResponse.next();
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      return response;
    }
    return new NextResponse(request.method === "HEAD" ? null : "Not found.\n", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  if (isReleasedNewsroomRemovalPath(pathname)) {
    return new NextResponse(
      request.method === "HEAD"
        ? null
        : "Gone\n",
      {
        status: 410,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store, max-age=0",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }
  if (!pathname.startsWith("/internal")) return NextResponse.next();

  const forbiddenUrlCredentials = new Set([
    "secret",
    "token",
    "post_publish_secret",
    "password",
    "authorization",
    "key",
  ]);
  if (
    [...request.nextUrl.searchParams.keys()].some((name) =>
      forbiddenUrlCredentials.has(name.toLowerCase()),
    )
  ) {
    return new NextResponse(
      "Credentials in URLs are rejected. Remove the query parameter and authenticate again.",
      {
        status: 400,
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }

  const expectedUser = process.env.INTERNAL_DASHBOARD_USER;
  const expectedPassword = process.env.INTERNAL_DASHBOARD_PASSWORD;
  if (!strongCredentials(expectedUser, expectedPassword)) {
    return new NextResponse(
      "Internal dashboard disabled — configure a non-placeholder username and a password of at least 32 bytes.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Basic ")) {
    return authChallenge(request);
  }

  let decoded = "";
  try {
    decoded = atob(authHeader.slice(6).trim());
  } catch {
    return authChallenge(request, "Bad auth header");
  }
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return authChallenge(request, "Bad auth header");
  }
  const suppliedUser = decoded.slice(0, separator);
  const suppliedPassword = decoded.slice(separator + 1);
  if (
    !timingSafeEq(suppliedUser, expectedUser) ||
    !timingSafeEq(suppliedPassword, expectedPassword ?? "")
  ) {
    return authChallenge(request, "Unauthorized");
  }

  const session = await createReviewSession();
  if (!session) {
    return new NextResponse(
      "Internal tools disabled — set INTERNAL_SESSION_SECRET to at least 32 bytes.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Vary", "Authorization");

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure =
    forwardedProto === "https" ||
    (!forwardedProto && request.nextUrl.protocol === "https:");
  response.cookies.set({
    name: REVIEW_SESSION_COOKIE,
    value: session,
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: REVIEW_SESSION_COOKIE_PATH,
    maxAge: REVIEW_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export const config = {
  matcher: [
    "/internal/:path*",
    "/audio/:path*",
    "/brand/:path*",
    "/cinema/:path*",
    "/media/real-uhd/:path*",
    "/media/verified/:path*",
    "/hero.mp4",
    "/pulse",
    "/news/2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop",
    "/news/2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-",
    "/news/2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif",
    "/news/2026-06-24-oman-tenders-1-035bn-solar-mandate-as-vision-2040-absorbs-1-",
    "/news/2026-06-22-from-dhoom-to-dubai-how-rimi-sen-traded-bollywood-for-luxury",
  ],
};
