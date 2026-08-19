import mediaContract from "@/config/media-contract.json";

export type NewsroomPublicMediaDecision = Readonly<{
  allowed: boolean;
  state: "approved" | "withheld" | "unknown" | "ungoverned";
}>;

const approvedPaths = new Set(mediaContract.assets.map((asset) => asset.path));
const withheldPaths = new Set(
  mediaContract.dormantMedia.flatMap((entry) => [
    ...(Object.hasOwn(entry, "path") ? [entry.path as string] : []),
    ...(Object.hasOwn(entry, "paths") ? (entry.paths as string[]) : []),
  ]),
);
const unknownGovernedPaths = new Set(mediaContract.unknownGovernedMedia);
const governedPrefixes = [
  "/audio/",
  "/brand/",
  "/cinema/",
  "/media/real-uhd/",
  "/media/verified/",
] as const;

export const APPROVED_NEWSROOM_PUBLIC_MEDIA_PATHS = Object.freeze(
  [...approvedPaths].sort(),
);
export const WITHHELD_NEWSROOM_PUBLIC_MEDIA_PATHS = Object.freeze(
  [...withheldPaths].sort(),
);
export const UNKNOWN_NEWSROOM_PUBLIC_MEDIA_PATHS = Object.freeze(
  [...unknownGovernedPaths].sort(),
);

export function decideNewsroomPublicMedia(
  pathname: string,
): NewsroomPublicMediaDecision {
  if (approvedPaths.has(pathname)) return { allowed: true, state: "approved" };
  if (withheldPaths.has(pathname)) return { allowed: false, state: "withheld" };
  if (unknownGovernedPaths.has(pathname)) return { allowed: false, state: "unknown" };
  if (
    pathname === "/hero.mp4" ||
    governedPrefixes.some((prefix) => pathname.startsWith(prefix))
  ) {
    return { allowed: false, state: "unknown" };
  }
  return { allowed: true, state: "ungoverned" };
}
