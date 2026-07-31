import sharp from "sharp";

export type DecodedImageMetadata = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
};

const MIN_BYTES = 32 * 1024;
const MAX_BYTES = 40 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;
const MAX_DECODED_BYTES = 200 * 1024 * 1024;

function hasExactContainerEnd(
  bytes: Buffer,
  format: "jpeg" | "png" | "webp",
): boolean {
  if (format === "jpeg") {
    return (
      bytes.length >= 2 &&
      bytes[bytes.length - 2] === 0xff &&
      bytes[bytes.length - 1] === 0xd9
    );
  }
  if (format === "png") {
    const iend = Buffer.from("0000000049454e44ae426082", "hex");
    return (
      bytes.length >= iend.length &&
      bytes.subarray(bytes.length - iend.length).equals(iend)
    );
  }
  if (
    bytes.length < 12 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return false;
  }
  return bytes.readUInt32LE(4) + 8 === bytes.length;
}

/**
 * Fully decode and validate an editorial image. Header-only dimensions are
 * insufficient: malformed/truncated/polyglot files must never enter a human
 * approval ledger.
 */
export async function verifyImageBytes(
  bytes: Buffer,
): Promise<DecodedImageMetadata> {
  if (bytes.length < MIN_BYTES || bytes.length > MAX_BYTES) {
    throw new Error("Editorial image byte length is outside the safe range.");
  }
  const decoder = sharp(bytes, {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
    sequentialRead: true,
  });
  const metadata = await decoder.metadata();
  if (
    (metadata.format !== "jpeg" &&
      metadata.format !== "png" &&
      metadata.format !== "webp") ||
    !metadata.width ||
    !metadata.height ||
    metadata.width < 1 ||
    metadata.height < 1 ||
    metadata.width * metadata.height > MAX_PIXELS ||
    (metadata.pages ?? 1) !== 1
  ) {
    throw new Error("Editorial image format or decoded geometry is invalid.");
  }
  if (!hasExactContainerEnd(bytes, metadata.format)) {
    throw new Error(
      "Editorial image container is truncated or contains trailing payload bytes.",
    );
  }
  const channels = metadata.channels ?? 4;
  if (metadata.width * metadata.height * channels > MAX_DECODED_BYTES) {
    throw new Error("Editorial image decoded size exceeds the safe limit.");
  }

  // Force a complete pixel decode; metadata parsing alone is not proof that
  // the source is renderable.
  const decoded = await sharp(bytes, {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
    sequentialRead: true,
  })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    decoded.info.width !== metadata.width ||
    decoded.info.height !== metadata.height ||
    decoded.data.length === 0
  ) {
    throw new Error("Editorial image failed full pixel verification.");
  }

  return {
    mime:
      metadata.format === "jpeg"
        ? "image/jpeg"
        : metadata.format === "png"
          ? "image/png"
          : "image/webp",
    width: metadata.width,
    height: metadata.height,
  };
}
