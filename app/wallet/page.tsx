import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Page not available",
  robots: { index: false, follow: false },
};

/** The Wallet concept is not a public product until a working edition exists. */
export default function WalletPage() {
  notFound();
}
