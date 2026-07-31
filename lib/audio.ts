/**
 * Dormant news-site audio registry.
 *
 * The current public layout mounts no audio system. These local files remain
 * withheld until their provenance is complete and Raj deliberately restores
 * an accessible audio control. File presence is never treated as approval.
 */
export const NEWS_AUDIO_REGISTER = [
  "/audio/iwr-ambient.mp3",
  "/audio/iwr-ambient-classic.mp3",
  "/audio/raj-intro.mp3",
  "/audio/ui/audio-on.mp3",
  "/audio/ui/cmdk-swell.mp3",
  "/audio/ui/cta-click.mp3",
  "/audio/ui/cta-hover.mp3",
  "/audio/ui/cursor-tick.mp3",
  "/audio/ui/form-submit.mp3",
  "/audio/ui/page-turn.mp3",
  "/audio/ui/section-reveal.mp3",
] as const;

const SOUND_MAP = {
  "cta-hover": "/audio/ui/cta-hover.mp3",
  "cta-click": "/audio/ui/cta-click.mp3",
  "section-reveal": "/audio/ui/section-reveal.mp3",
  "cursor-tick": "/audio/ui/cursor-tick.mp3",
  "cmdk-swell": "/audio/ui/cmdk-swell.mp3",
  "page-turn": "/audio/ui/page-turn.mp3",
  "form-submit": "/audio/ui/form-submit.mp3",
  "audio-on": "/audio/ui/audio-on.mp3",
} as const satisfies Readonly<
  Record<string, (typeof NEWS_AUDIO_REGISTER)[number]>
>;

export type UISound = keyof typeof SOUND_MAP;

const VOLUME: Record<UISound, number> = {
  "cta-hover": 0.18,
  "cta-click": 0.28,
  "section-reveal": 0.14,
  "cursor-tick": 0.1,
  "cmdk-swell": 0.32,
  "page-turn": 0.22,
  "form-submit": 0.3,
  "audio-on": 0.35,
};

const buffers = new Map<UISound, AudioBuffer>();
let audioCtx: AudioContext | null = null;
let preloaded = false;
let gestureUnlocked = false;

function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("iwr-ambient-pref") !== "on";
}

function hasUserActivation(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userActivation?.hasBeenActive === true;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined" || !gestureUnlocked) return null;
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
  if (preloaded || !gestureUnlocked || isMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  preloaded = true;

  await Promise.all(
    (Object.keys(SOUND_MAP) as UISound[]).map(async (key) => {
      try {
        const response = await fetch(SOUND_MAP[key]);
        if (!response.ok) return;
        const encoded = await response.arrayBuffer();
        const decoded = await ctx.decodeAudioData(encoded);
        buffers.set(key, decoded);
      } catch {
        // Audio is optional. The visible interface remains fully functional.
      }
    }),
  );
}

/**
 * Initializes the dormant audio runtime only after a real browser gesture and
 * an explicit saved "on" preference. Calling this during mount or page load is
 * intentionally a no-op.
 */
export function initAudio() {
  if (!hasUserActivation() || isMuted()) return;
  gestureUnlocked = true;
  void preloadAll();
}

/**
 * Plays an optional UI sound only after explicit opt-in and a user gesture.
 * It never unlocks audio by itself and never runs on touch-only interfaces.
 */
export function playSound(key: UISound) {
  if (
    typeof window === "undefined" ||
    !gestureUnlocked ||
    isMuted() ||
    window.matchMedia("(hover: none)").matches
  ) {
    return;
  }

  const ctx = getCtx();
  const buffer = buffers.get(key);
  if (!ctx || !buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = VOLUME[key];
  source.connect(gain).connect(ctx.destination);
  source.start(0);
}
