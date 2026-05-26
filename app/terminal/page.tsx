// /terminal — F3 Beyond the Deal Terminal entry point.
// Server component: pre-loads headlines + areas + bells from registries,
// hands off to client TerminalShell for the interactive workspace.

import type { Metadata } from "next";
import { NEWS_ARTICLES } from "@/content/news";
import { AREAS } from "@/content/areas";
import { CLOSING_BELLS } from "@/content/closing-bell";
import { SITE } from "@/lib/constants";
import { TerminalShell } from "@/components/terminal/TerminalShell";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Beyond the Deal · Terminal",
  description:
    "Bloomberg-Terminal-for-Dubai-real-estate. Live DLD pulse + FX matrix + market tape + headlines + closing bell + the desk — all in one workspace. Layout saves to your browser.",
  alternates: { canonical: `${SITE.url}/terminal` },
};

export default function TerminalPage() {
  const headlines = NEWS_ARTICLES.slice(0, 12).map((a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    displayDate: a.displayDate,
  }));
  const areas = AREAS.slice(0, 20).map((a) => ({
    slug: a.slug,
    name: a.name,
    emirate: a.emirate,
    medianPsf: a.medianAedPerSqft,
  }));
  const bells = CLOSING_BELLS.slice(0, 4).map((b) => ({
    slug: b.slug,
    title: b.title,
    displayDate: b.displayDate,
    highlights: b.highlights as unknown as string[],
  }));

  return <TerminalShell headlines={headlines} areas={areas} bells={bells} />;
}
