// Next.js proxy (formerly "middleware") — basic-auth gate for /internal/* routes.
//
// Set INTERNAL_BASIC_AUTH on Vercel as "user:pass".
// If not set, /internal/* routes 503 to indicate "intentionally disabled".

import { NextRequest, NextResponse } from "next/server";

const INTERNAL_BASIC_AUTH = process.env.INTERNAL_BASIC_AUTH || "";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/internal")) {
    return NextResponse.next();
  }

  // Not configured = locked out, but with explicit signal
  if (!INTERNAL_BASIC_AUTH) {
    return new NextResponse(
      "Internal dashboard disabled — set INTERNAL_BASIC_AUTH env var.",
      { status: 503, headers: { "Content-Type": "text/plain" } }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="news.investwithraj.com internal"',
      },
    });
  }

  let decoded = "";
  try {
    decoded = atob(authHeader.slice(6));
  } catch {
    return new NextResponse("Bad auth header", { status: 400 });
  }

  if (decoded !== INTERNAL_BASIC_AUTH) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="news.investwithraj.com internal"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/internal/:path*",
};
