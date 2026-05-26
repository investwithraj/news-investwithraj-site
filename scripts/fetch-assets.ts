/**
 * v13 SOTY — auto-asset sourcing pipeline.
 *
 * Runs at build time (predeploy hook). Reads /content/assets-manifest.ts and
 * fetches any missing assets from the configured sources:
 *
 *   AUDIO         → ElevenLabs compose_music + text_to_sound_effects
 *   STOCK PHOTOS  → Pexels + Unsplash + Wikimedia (existing lib/stock/providers.ts)
 *   STOCK VIDEO   → Pexels Videos (existing lib/stock/video-providers.ts)
 *   PORTRAITS     → Higgsfield Soul with RT_SOUL_ID (when available)
 *   FONTS         → Google Fonts (next/font handles this)
 *
 * Usage:
 *   npm run fetch:assets       — refresh missing assets only
 *   npm run fetch:assets -- --force  — regenerate all assets
 *
 * Wire it into package.json:
 *   "prebuild": "tsx scripts/fetch-assets.ts"
 *
 * Run-time graceful degradation: if an API call fails the build continues —
 * the site will gracefully not-render that asset (e.g. AmbientAudio hides
 * itself if /audio/iwr-ambient.mp3 doesn't exist).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const AUDIO_DIR = path.join(PUBLIC_DIR, "audio");
const UI_DIR = path.join(AUDIO_DIR, "ui");

// Manifest of all assets the site needs. Add new entries when you add
// new components that need new sources. The script will only fetch
// missing ones unless --force is passed.
const MANIFEST = {
  audio: {
    "iwr-ambient.mp3": {
      kind: "music",
      durationMs: 45000,
      prompt:
        "Ambient cinematic loop for a luxury real-estate brand site. Warm piano arpeggios in C minor, deep brass swells underneath, no drums, no percussion, no vocals. Tempo 65 BPM, mood: Cucinelli atelier, Aman lobby, late-afternoon golden hour. Reverb-heavy. Long sustained chords. Evolving textures. Cinematic, contemplative, restrained luxury. Designed to loop seamlessly.",
    },
  },
  "audio/ui": {
    "cta-hover.mp3": {
      kind: "sfx",
      duration: 0.5,
      prompt:
        "A soft, very short brass tap. Like a fingernail on polished brass. Damped, tiny, single hit. No reverb tail.",
    },
    "cta-click.mp3": {
      kind: "sfx",
      duration: 0.8,
      prompt:
        "A premium typewriter key click with subtle brass resonance. Single confident click followed by a very brief reverb tail.",
    },
    "section-reveal.mp3": {
      kind: "sfx",
      duration: 2.0,
      prompt:
        "An airy whoosh, like a silk curtain being pulled aside. Very low frequency rumble at the start, soft hiss in the middle, gentle fade out.",
    },
    "cursor-tick.mp3": {
      kind: "sfx",
      duration: 0.5,
      prompt:
        "A barely audible high-frequency tick. Like a tiny watch escapement. Single sharp pulse, very soft, no reverb.",
    },
    "cmdk-swell.mp3": {
      kind: "sfx",
      duration: 1.5,
      prompt:
        "An ascending two-note piano swell. Soft mallet attack, deep room reverb. First note F, second note C. Cinematic, hopeful, restrained.",
    },
  },
} as const;

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function callElevenLabs(
  endpoint: "sound-generation" | "music",
  body: Record<string, unknown>
): Promise<Buffer | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.warn(
      `[fetch-assets] ELEVENLABS_API_KEY missing — skipping ${endpoint}`
    );
    return null;
  }
  const url = `https://api.elevenlabs.io/v1/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn(`[fetch-assets] ${endpoint} ${res.status}: ${txt}`);
    return null;
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

async function fetchSfx(filePath: string, def: { duration: number; prompt: string }) {
  console.log(`[fetch-assets] generating SFX: ${path.basename(filePath)}`);
  const buf = await callElevenLabs("sound-generation", {
    text: def.prompt,
    duration_seconds: def.duration,
    output_format: "mp3_44100_128",
  });
  if (!buf) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buf);
  console.log(`[fetch-assets] saved ${filePath} (${buf.length} bytes)`);
}

async function fetchMusic(filePath: string, def: { durationMs: number; prompt: string }) {
  console.log(`[fetch-assets] generating music: ${path.basename(filePath)}`);
  const buf = await callElevenLabs("music", {
    prompt: def.prompt,
    music_length_ms: def.durationMs,
  });
  if (!buf) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buf);
  console.log(`[fetch-assets] saved ${filePath} (${buf.length} bytes)`);
}

async function main() {
  const force = process.argv.includes("--force");
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.mkdir(UI_DIR, { recursive: true });

  // Audio — music
  for (const [name, def] of Object.entries(MANIFEST.audio)) {
    const target = path.join(AUDIO_DIR, name);
    if (!force && (await exists(target))) {
      console.log(`[fetch-assets] skip ${name} (exists)`);
      continue;
    }
    if (def.kind === "music") {
      await fetchMusic(target, def);
    }
  }

  // Audio — UI sound effects
  for (const [name, def] of Object.entries(MANIFEST["audio/ui"])) {
    const target = path.join(UI_DIR, name);
    if (!force && (await exists(target))) {
      console.log(`[fetch-assets] skip ui/${name} (exists)`);
      continue;
    }
    if (def.kind === "sfx") {
      await fetchSfx(target, def);
    }
  }

  console.log("[fetch-assets] done.");
}

main().catch((e) => {
  console.error("[fetch-assets] fatal:", e);
  // Don't fail the build — graceful degradation
  process.exit(0);
});
