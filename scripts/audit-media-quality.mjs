import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const contract = JSON.parse(await readFile("config/media-contract.json", "utf8"));
const failures = [];
for (const asset of contract.assets) {
  const fullscreen = asset.routes?.some((route) => route.fullscreen);
  if (!fullscreen || asset.mediaType !== "image") continue;
  const file = path.join("public", asset.path);
  const metadata = await sharp(file).metadata();
  const stats = await sharp(file).stats();
  if ((metadata.width ?? 0) < 3840 || (metadata.height ?? 0) < 2160) {
    failures.push(`${asset.path}: ${metadata.width}x${metadata.height} is not UHD`);
  }
  if (stats.sharpness < 0.7) {
    failures.push(`${asset.path}: sharpness ${stats.sharpness.toFixed(3)} is too soft for fullscreen`);
  }
  if (stats.entropy < 6.5) {
    failures.push(`${asset.path}: entropy ${stats.entropy.toFixed(3)} suggests a weak/upscaled source`);
  }
  if (!asset.subject || !asset.source?.url || !asset.rights?.status) {
    failures.push(`${asset.path}: subject, source or rights record is incomplete`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Fullscreen media quality gate: PASS");
}
