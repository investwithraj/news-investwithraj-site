"use client";

import { useEffect, useRef, useState } from "react";

export default function PulseMotionMedia() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const applyMotionPreference = () => {
      if (motionPreference.matches) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // Autoplay can be blocked by the browser; the visible control remains.
      });
    };

    applyMotionPreference();
    motionPreference.addEventListener("change", applyMotionPreference);

    return () => {
      motionPreference.removeEventListener("change", applyMotionPreference);
      video.pause();
    };
  }, []);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().catch(() => {
        // The browser can still block playback after an explicit request.
      });
    } else {
      video.pause();
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, #141414 0%, #202021 55%, #141414 100%)",
          }}
        />
        <video
          ref={videoRef}
          id="pulse-motion-video"
          className="absolute inset-0 h-full w-full object-cover"
          src="/cinema/v21/pulse-loop.mp4"
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(14, 14, 14, 0.66) 0%, rgba(14, 14, 14, 0.74) 60%, rgba(14, 14, 14, 0.9) 100%)",
          }}
        />
      </div>
      <button
        type="button"
        aria-controls="pulse-motion-video"
        onClick={togglePlayback}
        className="absolute top-4 right-6 z-20 min-h-11 rounded-full border px-4 text-[10px] font-mono uppercase tracking-[0.18em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          borderColor: "rgba(242, 238, 231, 0.5)",
          background: "rgba(20, 20, 20, 0.78)",
          color: "#F2EEE7",
        }}
      >
        {playing ? "Pause background motion" : "Play background motion"}
      </button>
    </>
  );
}
