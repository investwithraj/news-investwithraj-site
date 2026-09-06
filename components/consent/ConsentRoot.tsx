// Server component — reads pixel IDs from env vars and passes to client.
// Renders the banner + loader. Drop this once in app/layout.tsx.

import { Suspense } from "react";

import { ConsentBanner } from "./ConsentBanner";
import { PixelLoader } from "./PixelLoader";
import { newsroomAnalyticsConfig } from "@/lib/analytics-config";

export function ConsentRoot() {
  const { ids, posthog, crossDomainHosts } = newsroomAnalyticsConfig();

  return (
    <>
      <ConsentBanner />
      <Suspense fallback={null}>
        <PixelLoader
          ids={ids}
          posthog={posthog}
          crossDomainHosts={crossDomainHosts}
          enableVercelObservability={process.env.VERCEL === "1"}
        />
      </Suspense>
    </>
  );
}
