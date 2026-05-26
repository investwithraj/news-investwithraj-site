"use client";

// Client wrapper around the Three.js scene — keeps the server-rendered
// homepage page.tsx pure while the heavy WebGL bundle stays lazy + client-only.

import dynamic from "next/dynamic";

const DubaiSkyline3D = dynamic(
  () => import("./DubaiSkyline3D").then((m) => m.DubaiSkyline3D),
  { ssr: false }
);

export function DubaiSkyline3DLoader({ height = "100svh" }: { height?: string }) {
  return <DubaiSkyline3D height={height} />;
}
