// ElevenLabs TTS client — Raj's locked PVC voice.
// Settings are the canonical Reel-1 Emotional Mode locked May 2026:
//   voice_id    3PmZaGGPRbZDCjAl7KBE  ("rt")
//   model       eleven_multilingual_v2
//   stability   0.40
//   similarity  0.88
//   style       0.20
//   speed       1.0
//   speaker_boost  ON
//   output      mp3_44100_192
//
// Override via env only when explicitly required.

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const RAJ_VOICE_ID = process.env.ELEVENLABS_RAJ_VOICE_ID || "3PmZaGGPRbZDCjAl7KBE";
const RAJ_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

export const RAJ_VOICE_SETTINGS = {
  stability: parseFloat(process.env.ELEVENLABS_STABILITY || "0.40"),
  similarity_boost: parseFloat(process.env.ELEVENLABS_SIMILARITY || "0.88"),
  style: parseFloat(process.env.ELEVENLABS_STYLE || "0.20"),
  use_speaker_boost: true,
  speed: parseFloat(process.env.ELEVENLABS_SPEED || "1.0"),
};

export function isElevenConfigured(): boolean {
  return Boolean(ELEVEN_API_KEY);
}

export interface SynthRequest {
  /** Text to synthesise — max ~5000 chars per call */
  text: string;
  /** Output format. Default mp3_44100_192. */
  outputFormat?:
    | "mp3_44100_192"
    | "mp3_44100_128"
    | "mp3_44100_64"
    | "pcm_24000"
    | "pcm_44100"
    | "ulaw_8000";
  /** Voice ID override (default Raj's locked voice) */
  voiceId?: string;
}

export interface SynthResult {
  ok: boolean;
  /** MP3/PCM bytes when ok=true */
  audio?: ArrayBuffer;
  /** Content-Type to forward back to the caller */
  contentType?: string;
  error?: string;
}

/** Synthesise speech. Returns audio bytes — caller streams to client. */
export async function synthesise(req: SynthRequest): Promise<SynthResult> {
  if (!isElevenConfigured()) {
    return { ok: false, error: "ELEVENLABS_API_KEY not set" };
  }
  if (!req.text || req.text.length < 1 || req.text.length > 5000) {
    return { ok: false, error: "text must be 1-5000 chars" };
  }

  const voiceId = req.voiceId || RAJ_VOICE_ID;
  const fmt = req.outputFormat || "mp3_44100_192";

  try {
    const res = await fetch(
      `${ELEVEN_BASE}/text-to-speech/${voiceId}?output_format=${fmt}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVEN_API_KEY,
          "Content-Type": "application/json",
          Accept: fmt.startsWith("mp3") ? "audio/mpeg" : "audio/wav",
        },
        body: JSON.stringify({
          text: req.text,
          model_id: RAJ_MODEL,
          voice_settings: RAJ_VOICE_SETTINGS,
        }),
      }
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        ok: false,
        error: `ElevenLabs ${res.status}: ${t.slice(0, 200)}`,
      };
    }

    const audio = await res.arrayBuffer();
    return {
      ok: true,
      audio,
      contentType: fmt.startsWith("mp3") ? "audio/mpeg" : "audio/wav",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown ElevenLabs error",
    };
  }
}

/** Convenience — returns base64-encoded audio + data URL for inline use. */
export async function synthesiseToDataUrl(req: SynthRequest): Promise<{
  ok: boolean;
  dataUrl?: string;
  error?: string;
}> {
  const result = await synthesise(req);
  if (!result.ok || !result.audio) {
    return { ok: false, error: result.error };
  }
  const b64 = Buffer.from(result.audio).toString("base64");
  return {
    ok: true,
    dataUrl: `data:${result.contentType};base64,${b64}`,
  };
}
