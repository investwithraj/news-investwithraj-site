"use client";

// Voice Mode — "Hey Raj" — persistent hold-to-talk pill, bottom-right.
//
// Flow:
//   1. User holds the gold button (or taps to toggle on touch).
//   2. Web Speech API records + transcribes their question.
//   3. Question fires POST /api/brief with topic.
//   4. Brief comes back as text.
//   5. Brief is POSTed to /api/voice to synthesise with Raj's voice.
//   6. Audio plays back inline.
//
// Visual chrome inspired by Apple Vision Pro's hold-to-record affordance:
//   a gold ring that pulses while listening, then a spectrum bar while
//   transcribing, then a play indicator on the response.

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "listening" | "thinking" | "speaking" | "error";

// Minimal Web Speech API type — TypeScript lib.dom.d.ts doesn't reliably
// include these (still flagged experimental). We define just what we touch.
interface SpeechRecognitionResultAlt {
  transcript: string;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultAlt;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function VoiceMode() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [answerSnippet, setAnswerSnippet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Check support — Web Speech API still vendor-prefixed in many browsers
    const SR =
      typeof window !== "undefined"
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : undefined;
    setSupported(!!SR);
  }, []);

  function startListening() {
    if (!supported) {
      setError("Voice not supported in this browser. Try Chrome or Safari.");
      setPhase("error");
      return;
    }
    setError(null);
    setTranscript("");
    setAnswerSnippet(null);

    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 1;

    let finalText = "";
    r.onresult = (e: SpeechRecognitionEventLike) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else setTranscript(t);
      }
    };
    r.onerror = (e: { error: string }) => {
      setError(e.error || "Speech recognition error");
      setPhase("error");
    };
    r.onend = async () => {
      if (!finalText.trim()) {
        setPhase("idle");
        return;
      }
      setTranscript(finalText);
      await runQuery(finalText);
    };

    recogRef.current = r;
    setPhase("listening");
    r.start();
  }

  function stopListening() {
    recogRef.current?.stop();
  }

  async function runQuery(topic: string) {
    setPhase("thinking");
    try {
      const briefRes = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const briefJson = (await briefRes.json()) as {
        ok?: boolean;
        brief?: string;
        message?: string;
        error?: string;
      };
      if (!briefRes.ok || !briefJson.ok || !briefJson.brief) {
        setError(briefJson.message || briefJson.error || "Brief failed");
        setPhase("error");
        return;
      }

      // Pull the first ~600 chars for voice (full brief is long)
      const voiceText = briefJson.brief.split("\n\n").slice(0, 3).join(" ").slice(0, 600);
      setAnswerSnippet(voiceText);

      setPhase("speaking");
      const voiceRes = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voiceText }),
      });
      if (!voiceRes.ok) {
        const j = await voiceRes.json().catch(() => ({}));
        setError((j as { message?: string }).message || `Voice ${voiceRes.status}`);
        setPhase("error");
        return;
      }
      const blob = await voiceRes.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPhase("idle");
      };
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("error");
    }
  }

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    recogRef.current?.stop();
    setPhase("idle");
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Expanded panel — transcript + answer */}
      {expanded && (transcript || answerSnippet || error) && (
        <div
          className="rounded-2xl border max-w-sm p-4 shadow-xl"
          style={{
            background: "rgba(10, 16, 36, 0.92)",
            color: "var(--paper)",
            borderColor: "rgba(201, 169, 97, 0.35)",
            backdropFilter: "blur(20px)",
          }}
        >
          {transcript && (
            <>
              <div className="text-[9px] font-mono uppercase tracking-[0.22em] mb-1" style={{ color: "rgba(248,250,252,0.45)" }}>
                You asked
              </div>
              <div className="text-sm mb-3" style={{ color: "var(--paper)" }}>
                {transcript}
              </div>
            </>
          )}
          {answerSnippet && (
            <>
              <div className="text-[9px] font-mono uppercase tracking-[0.22em] mb-1" style={{ color: "var(--gold-bright, #E0C076)" }}>
                Raj
              </div>
              <div className="text-sm leading-[1.5]" style={{ color: "rgba(248,250,252,0.85)" }}>
                {answerSnippet}…
              </div>
            </>
          )}
          {error && (
            <div className="text-sm" style={{ color: "#E58E89" }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Button cluster */}
      <div className="flex items-center gap-2">
        {(transcript || answerSnippet || error) && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="px-3 py-2 rounded-full text-[10px] font-mono uppercase tracking-[0.18em]"
            style={{
              background: "rgba(10,16,36,0.9)",
              color: "var(--gold-bright, #E0C076)",
              border: "1px solid rgba(201,169,97,0.3)",
              backdropFilter: "blur(12px)",
            }}
          >
            {expanded ? "Hide" : "Show"}
          </button>
        )}
        <button
          onMouseDown={() => phase === "idle" && startListening()}
          onMouseUp={() => phase === "listening" && stopListening()}
          onMouseLeave={() => phase === "listening" && stopListening()}
          onTouchStart={() => phase === "idle" && startListening()}
          onTouchEnd={() => phase === "listening" && stopListening()}
          onClick={() => phase === "speaking" && stop()}
          disabled={!supported && phase === "idle"}
          data-magnetic
          aria-label="Hold to speak with Raj"
          className="group relative w-14 h-14 rounded-full transition-transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background:
              phase === "listening"
                ? "radial-gradient(circle at 30% 30%, #ff8a4f, #e0442e)"
                : phase === "thinking"
                  ? "radial-gradient(circle at 30% 30%, #4DD0E1, #1E8A93)"
                  : phase === "speaking"
                    ? "radial-gradient(circle at 30% 30%, #7ED99F, #2D8A4F)"
                    : "radial-gradient(circle at 30% 30%, #E0C076, #A88945)",
            boxShadow:
              phase === "idle"
                ? "0 8px 24px rgba(201,169,97,0.45), 0 0 0 1px rgba(201,169,97,0.4) inset"
                : phase === "listening"
                  ? "0 8px 32px rgba(225,68,46,0.6), 0 0 0 4px rgba(225,68,46,0.18)"
                  : phase === "thinking"
                    ? "0 8px 24px rgba(77,208,225,0.6)"
                    : "0 8px 24px rgba(126,217,159,0.6)",
          }}
        >
          {/* Icon — mic or stop */}
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-white"
            style={{ fontSize: "20px" }}
          >
            {phase === "speaking" ? "■" : phase === "thinking" ? "…" : "●"}
          </span>
          {/* Pulse ring when listening */}
          {phase === "listening" && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                animation: "voicemode-pulse 1.4s ease-out infinite",
                border: "2px solid rgba(225,68,46,0.45)",
              }}
            />
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes voicemode-pulse {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
