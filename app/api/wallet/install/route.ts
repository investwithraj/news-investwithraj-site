// /api/wallet/install — Apple PassKit + Google Wallet pass for the daily digest.
//
// Apple PassKit requires:
//   - APPLE_PASS_TYPE_ID  (eg. pass.com.investwithraj.news.digest)
//   - APPLE_TEAM_ID
//   - APPLE_PASS_CERT_PEM   (private key PEM)
//   - APPLE_PASS_CERT_PASS  (passphrase)
//   - APPLE_WWDR_PEM        (Apple WWDR intermediate certificate)
//
// Google Wallet requires:
//   - GOOGLE_WALLET_ISSUER_ID
//   - GOOGLE_WALLET_SERVICE_ACCOUNT_JSON  (base64 of service account JSON)
//
// Without these, the endpoint returns a structured "preview" — describes the
// pass that would be created — so the UI can render an "Install" CTA that
// gracefully degrades to a coming-soon state.

import { NextRequest, NextResponse } from "next/server";
import { getLatestNews } from "@/content/news";

export const dynamic = "force-dynamic";

const APPLE_CONFIGURED =
  !!process.env.APPLE_PASS_TYPE_ID &&
  !!process.env.APPLE_TEAM_ID &&
  !!process.env.APPLE_PASS_CERT_PEM &&
  !!process.env.APPLE_WWDR_PEM;
const GOOGLE_CONFIGURED =
  !!process.env.GOOGLE_WALLET_ISSUER_ID &&
  !!process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform") || "auto";
  const latest = getLatestNews(1)[0];

  const passPreview = {
    organizationName: "Invest With Raj",
    description: "Beyond the Deal · Daily Digest",
    headline: latest?.title || "Today's UAE real-estate read",
    subtitle: "Curated by Raj · real-estate consultant",
    barcodeMessage: `https://news.investwithraj.com/${latest?.slug ? `news/${latest.slug}` : ""}`,
    foregroundColor: "rgb(249, 246, 240)",
    backgroundColor: "rgb(10, 16, 36)",
    labelColor: "rgb(224, 192, 118)",
  };

  if (platform === "apple") {
    if (!APPLE_CONFIGURED) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Apple PassKit not configured. Set APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_PEM, APPLE_WWDR_PEM on Vercel.",
          preview: passPreview,
        },
        { status: 503 }
      );
    }
    // Real implementation: build .pkpass zip + sign with cert. Requires
    // additional dependencies (passkit-generator or hand-rolled signer).
    // For now return preview + 501.
    return NextResponse.json(
      {
        ok: false,
        message: "Apple pass-signing implementation pending. Certs detected — generator wiring is the next step.",
        preview: passPreview,
      },
      { status: 501 }
    );
  }

  if (platform === "google") {
    if (!GOOGLE_CONFIGURED) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Google Wallet not configured. Set GOOGLE_WALLET_ISSUER_ID + GOOGLE_WALLET_SERVICE_ACCOUNT_JSON.",
          preview: passPreview,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        message: "Google Wallet JWT signer pending. Issuer + service account detected.",
        preview: passPreview,
      },
      { status: 501 }
    );
  }

  // Auto / status query
  return NextResponse.json({
    name: "Beyond the Deal · Daily Digest Wallet Pass",
    apple: { configured: APPLE_CONFIGURED, installUrl: "/api/wallet/install?platform=apple" },
    google: { configured: GOOGLE_CONFIGURED, installUrl: "/api/wallet/install?platform=google" },
    preview: passPreview,
  });
}
