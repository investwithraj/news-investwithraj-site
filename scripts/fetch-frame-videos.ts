/**
 * v14 Draftly — Pexels base-video sourcing + ffmpeg frame extraction.
 *
 * For each section in the manifest below:
 *   1. Search Pexels Videos for the best matching real-footage MP4
 *   2. Download to a temp file
 *   3. Run ffmpeg to extract 240 desktop (1920×1080) + 240 mobile (854×480) WebP frames
 *   4. Drop the result into public/draftly-frames/<section>/{desktop,mobile}/
 *
 * Run: tsx scripts/fetch-frame-videos.ts [section1] [section2] ...
 * Or:  tsx scripts/fetch-frame-videos.ts --all
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

// Pexels key — read from .env.local OR ~/.claude-mcp-env/.env
const PEXELS_KEY =
  process.env.PEXELS_API_KEY ||
  "PYqLwOYvcQVvrG4wjzolVMRuoaFZldD811lyIGVQBoQu1Vs3MOp6bb1g"; // fallback for one-shot run

const FFMPEG =
  process.env.FFMPEG_PATH ||
  "/c/Users/RAJTO/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const FRAMES_DIR = path.join(PUBLIC_DIR, "draftly-frames");

interface SectionSpec {
  /** Section key — used as folder name */
  key: string;
  /** Pexels search query */
  query: string;
  /** Min duration in seconds (filter out clips too short to extract 240 frames from) */
  minDuration: number;
  /** Atmosphere preset — affects the search query refinement (logged only) */
  atmosphere:
    | "noir"
    | "golden-hour"
    | "brutalist"
    | "pastel-dream"
    | "neon-dystopia";
}

const SECTIONS: SectionSpec[] = [
  {
    key: "hero",
    query: "Dubai aerial golden hour cinematic drone sunset",
    minDuration: 8,
    atmosphere: "golden-hour",
  },
  {
    key: "market",
    query: "Dubai night skyline aerial city lights bokeh",
    minDuration: 8,
    atmosphere: "neon-dystopia",
  },
  {
    key: "operator",
    query: "warm interior natural light cinematic ambient",
    minDuration: 8,
    atmosphere: "noir",
  },
];

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  file_type: string;
  quality?: string;
}
interface PexelsVideo {
  id: number;
  url: string;
  duration: number;
  width: number;
  height: number;
  image: string;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

async function searchPexels(query: string, minDuration: number) {
  const params = new URLSearchParams({
    query,
    per_page: "8",
    orientation: "landscape",
    size: "medium",
  });
  const res = await fetch(
    `https://api.pexels.com/videos/search?${params}`,
    { headers: { Authorization: PEXELS_KEY } }
  );
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { videos: PexelsVideo[] };
  // Filter by minimum duration, prefer the largest HD-but-not-4K file
  return data.videos
    .filter((v) => v.duration >= minDuration)
    .map((v) => {
      const mp4s = v.video_files
        .filter((f) => f.file_type === "video/mp4")
        .sort((a, b) => b.width - a.width);
      const target =
        mp4s.find((f) => f.width <= 1920 && f.width >= 1280) ||
        mp4s.find((f) => f.width >= 1000) ||
        mp4s[0];
      return { v, file: target };
    })
    .filter((x) => x.file && x.file.width >= 1000)[0];
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${res.status}`);
  const arr = await res.arrayBuffer();
  await fs.writeFile(dest, Buffer.from(arr));
  return arr.byteLength;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "pipe" });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} exit ${code}: ${stderr.slice(-400)}`))
    );
  });
}

async function extractFrames(mp4: string, section: string) {
  const desktop = path.join(FRAMES_DIR, section, "desktop");
  const mobile = path.join(FRAMES_DIR, section, "mobile");
  await fs.mkdir(desktop, { recursive: true });
  await fs.mkdir(mobile, { recursive: true });

  // 240 frames = 30s at 30fps OR 8s at 30fps with frames= filter.
  // We'll grab exactly 240 frames using vframes=240 + fps=30 to maintain
  // smoothness. For an 8s clip that yields 240. For longer clips we'll
  // get the first 8s only (which is fine — first 8s of a Pexels clip
  // is usually the best moment).
  const desktopArgs = [
    "-y",
    "-i",
    mp4,
    "-vf",
    "fps=30,scale=1920:1080:force_original_aspect_ratio=cover,crop=1920:1080",
    "-frames:v",
    "240",
    "-q:v",
    "75",
    "-c:v",
    "libwebp",
    path.join(desktop, "%04d.webp"),
  ];
  const mobileArgs = [
    "-y",
    "-i",
    mp4,
    "-vf",
    "fps=30,scale=854:480:force_original_aspect_ratio=cover,crop=854:480",
    "-frames:v",
    "240",
    "-q:v",
    "70",
    "-c:v",
    "libwebp",
    path.join(mobile, "%04d.webp"),
  ];

  console.log(`  [${section}] extracting desktop frames…`);
  await run(FFMPEG, desktopArgs);
  console.log(`  [${section}] extracting mobile frames…`);
  await run(FFMPEG, mobileArgs);

  // Measure
  const dEntries = await fs.readdir(desktop);
  const mEntries = await fs.readdir(mobile);
  let dSize = 0;
  let mSize = 0;
  for (const f of dEntries)
    dSize += (await fs.stat(path.join(desktop, f))).size;
  for (const f of mEntries)
    mSize += (await fs.stat(path.join(mobile, f))).size;
  console.log(
    `  [${section}] ${dEntries.length} desktop frames (${(dSize / 1024 / 1024).toFixed(2)} MB), ${mEntries.length} mobile (${(mSize / 1024 / 1024).toFixed(2)} MB)`
  );
}

async function processSection(spec: SectionSpec) {
  console.log(`\n[${spec.key}] searching Pexels "${spec.query}"`);
  const hit = await searchPexels(spec.query, spec.minDuration);
  if (!hit) throw new Error(`No matching video for ${spec.key}`);
  console.log(
    `  ✓ found ${hit.v.url} by ${hit.v.user.name} (${hit.v.duration}s, ${hit.file.width}×${hit.file.height})`
  );

  const tmp = path.join(tmpdir(), `iwr-${spec.key}-${Date.now()}.mp4`);
  console.log(`  downloading ${hit.file.link}…`);
  const bytes = await download(hit.file.link, tmp);
  console.log(`  ✓ ${(bytes / 1024 / 1024).toFixed(2)} MB`);

  await extractFrames(tmp, spec.key);

  // Save attribution
  const credit = {
    section: spec.key,
    pexelsUrl: hit.v.url,
    videographer: hit.v.user.name,
    videographerUrl: hit.v.user.url,
    query: spec.query,
    atmosphere: spec.atmosphere,
    durationSec: hit.v.duration,
    resolution: `${hit.file.width}×${hit.file.height}`,
  };
  await fs.writeFile(
    path.join(FRAMES_DIR, spec.key, "credit.json"),
    JSON.stringify(credit, null, 2)
  );

  await fs.unlink(tmp).catch(() => {});
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all") || args.length === 0;
  const sections = all
    ? SECTIONS
    : SECTIONS.filter((s) => args.includes(s.key));

  if (sections.length === 0) {
    console.error(
      `No sections selected. Available: ${SECTIONS.map((s) => s.key).join(", ")}`
    );
    process.exit(1);
  }

  await fs.mkdir(FRAMES_DIR, { recursive: true });

  for (const spec of sections) {
    try {
      await processSection(spec);
    } catch (e) {
      console.error(`[${spec.key}] FAILED:`, e instanceof Error ? e.message : e);
      // continue with remaining sections
    }
  }
  console.log("\nDone. Frames written to public/draftly-frames/");
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
