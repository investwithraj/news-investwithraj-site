"use client";

import dynamic from "next/dynamic";

const CapitalFlowGlobe = dynamic(
  () => import("./CapitalFlowGlobe").then((m) => m.CapitalFlowGlobe),
  { ssr: false }
);

export function CapitalFlowGlobeLoader({ height = "520px" }: { height?: string }) {
  return <CapitalFlowGlobe height={height} />;
}
