import mediaContract from "@/config/media-contract.json";

export type VerifiedMedia = Readonly<{
  src: `/media/verified/${"areas" | "developers"}/${string}.webp`;
  width: 3840;
  height: 2160;
  alt: string;
  notice: string;
  subject: string;
  mediaKind: "photograph" | "official-render" | "satellite-image";
  evidenceUse: "context-only";
  approval: "approved-context";
  rightsStatus: string;
  renderNotice: string;
  sourceLabel: string;
  sourceUrl: string;
  licenseLabel: string;
  licenseUrl?: string;
  credit?: string;
}>;

type ContractVerifiedAsset = {
  key: `area:${string}` | `developer:${string}`;
  path: VerifiedMedia["src"];
  subject: string;
  approval: "approved-context";
  alt: string;
  source: {
    provider: string;
    creator: string;
    sourceId: string;
    url: string;
  };
  rights: {
    status: string;
    record: string;
    license?: string;
  };
  derivative: {
    width: 3840;
    height: 2160;
    from: string;
  };
  renderNotice: string;
};

function mediaKind(
  asset: ContractVerifiedAsset,
): VerifiedMedia["mediaKind"] {
  const source = asset.derivative.from.toLowerCase();
  if (source.includes("render")) return "official-render";
  if (source.includes("satellite")) return "satellite-image";
  return "photograph";
}

function toVerifiedMedia(asset: ContractVerifiedAsset): VerifiedMedia {
  return {
    src: asset.path,
    width: asset.derivative.width,
    height: asset.derivative.height,
    alt: asset.alt,
    notice: asset.renderNotice,
    subject: asset.subject,
    mediaKind: mediaKind(asset),
    evidenceUse: "context-only",
    approval: asset.approval,
    rightsStatus: asset.rights.status,
    renderNotice: asset.renderNotice,
    sourceLabel: asset.source.provider,
    sourceUrl: asset.source.url,
    licenseLabel: asset.rights.record,
    licenseUrl: asset.rights.license,
    credit: asset.source.creator,
  };
}

const contractAssets =
  mediaContract.assets as unknown as readonly ContractVerifiedAsset[];

function buildRegistry(prefix: "area:" | "developer:") {
  return Object.fromEntries(
    contractAssets
      .filter((asset) => asset.key.startsWith(prefix))
      .map((asset) => [asset.key.slice(prefix.length), toVerifiedMedia(asset)]),
  ) as Readonly<Record<string, VerifiedMedia>>;
}

/**
 * This registry is intentionally derived from the machine-readable media
 * contract. A file existing under /public does not make it verified: it must
 * have a named subject, source URL, rights status and truthful render notice.
 */
export const VERIFIED_AREA_MEDIA = buildRegistry("area:");
export const VERIFIED_DEVELOPER_MEDIA = buildRegistry("developer:");

export function getVerifiedAreaMedia(slug: string): VerifiedMedia | undefined {
  return VERIFIED_AREA_MEDIA[slug];
}

export function getVerifiedDeveloperMedia(
  slug: string,
): VerifiedMedia | undefined {
  return VERIFIED_DEVELOPER_MEDIA[slug];
}
