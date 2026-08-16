import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/** Pulse has no released product or evidence set in the migration register. */
export default function PulsePage() {
  notFound();
}
