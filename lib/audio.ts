// v13 SOTY — Web Audio UI sound system.
//
// Pattern: Cartier W&W ambient + Lusion-grade interaction feedback.
// All sounds are auto-sourced from ElevenLabs (compose_music + text_to_sound_effects)
// via the scripts/fetch-assets.ts pipeline. See lib/audio/providers.ts for
// the regeneration mechanism.
//
// Sounds are gated by the AmbientAudio toggle state (localStorage iwr-ambient-pref).
// When ambient is OFF, all UI sounds are also muted. This is the user's master
// audio switch — no separate UI-sounds toggle (would be too noisy).
//
// All sounds preload on first audio context init (lazy — only after user
// gesture, to bypass browser autoplay policy).

const SOUND_MAP = {
  "cta-hover":      "/audio/ui/cta-hover.mp3",      // 0.5s soft brass tap
  "cta-click":      "/audio/ui/cta-click.mp3",      // 0.8s typewriter + reverb
  "section-reveal": "/audio/ui/section-reveal.mp3", // 2s airy whoosh
  "cursor-tick":    "/audio/ui/cursor-tick.mp3",    // 0.5s hairline tick
  "cmdk-swell":     "/audio/ui/cmdk-swell.mp3",     // 1.5s ascending piano swell
  // v14.3 — three new cinematic UI sounds
  "page-turn":      "/audio/ui/page-turn.mp3",      // 2.5s paper rustle (chapter pin)
  "form-submit":    "/audio/ui/form-submit.mp3",    // 2s brass bell strike (form success)
  "audio-on":       "/audio/ui/audio-on.mp3",       // 2s ascending swell (toggle on)
} as const;

export type UISound = keyof typeof SOUND_MAP;

const VOLUME: Record<UISound, number> = {
  "cta-hover":      0.18,
  "cta-click":      0.28,
  "section-reveal": 0.14,
  "cursor-tick":    0.10,
  "cmdk-swell":     0.32,
  "page-turn":      0.22,
  "form-submit":    0.30,
  "audio-on":       0.35,
};

// Buffer cache — we preload + reuse, since each sound plays many times
const buffers = new Map<UISound, AudioBuffer>();
let audioCtx: AudioContext | null = null;
let preloaded = false;

function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("iwr-ambient-pref") !== "on";
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    type WindowWithWebkit = Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctx =
      window.AudioContext ||
      (window as WindowWithWebkit).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

async function preloadAll() {
  if (preloaded) return;
  const ctx = getCtx();
  if (!ctx) return;
  preloaded = true;
  await Promise.all(
    (Object.keys(SOUND_MAP) as UISound[]).map(async (k) => {
      try {
        const r = await fetch(SOUND_MAP[k]);
        if (!r.ok) return;
        const arr = await r.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        buffers.set(k, buf);
      } catch {
        // silent — UI sounds are non-critical
      }
    })
  );
}

/**
 * Play a UI sound. Silent if the user has ambient muted (the master
 * audio switch). Silent if Web Audio is unavailable. Silent on touch.
 */
export function playSound(key: UISound) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(hover: none)").matches) return;
  if (isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (!preloaded) {
    void preloadAll();
    return; // skip first call — buffers not ready
  }
  const buf = buffers.get(key);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = VOLUME[key];
  src.connect(gain).connect(ctx.destination);
  src.start(0);
}

/**
 * Initialize the audio context + preload all sounds. Must be called from
 * a user-gesture event handler (click, keydown) per browser autoplay policy.
 */
export function initAudio() {
  void preloadAll();
}
