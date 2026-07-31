import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PLATFORMS = new Set(["apple", "google"]);

function statusPayload(platform?: string) {
  return {
    ok: false,
    state: "coming-soon",
    platform: platform ?? "all",
    deliveryLive: false,
    signedPassAvailable: false,
    installationAvailable: false,
    message:
      "Signed wallet-pass delivery is not implemented. No pass has been created and no device has been registered.",
    liveAlternative: {
      label: "Open Daily Market Read",
      href: "/",
    },
  };
}

export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("platform");

  if (requested && !PLATFORMS.has(requested)) {
    return NextResponse.json(
      {
        ...statusPayload(),
        message: "Platform must be apple or google.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (requested) {
    return NextResponse.json(statusPayload(requested), {
      status: 501,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "86400",
      },
    });
  }

  return NextResponse.json(
    {
      ...statusPayload(),
      platforms: {
        apple: { state: "coming-soon", installUrl: null },
        google: { state: "coming-soon", installUrl: null },
      },
      privacy:
        "This status request does not register a device or create a wallet identifier.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
