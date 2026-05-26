"use client";

// F7 — AR Property Preview using Google's <model-viewer> Web Component.
// Lets UHNW buyers on iPhone tap "View in AR" to overlay a building in their
// physical environment via Quick Look (USDZ) on iOS or Scene Viewer (GLB)
// on Android. Falls back to interactive 3D in-browser on desktop.
//
// Asset sourcing strategy (Day-1 zero-cost):
//   1. Sketchfab MCP (CC-BY models)
//   2. Polycam (developer-supplied scans, when relationships develop)
//   3. Higgsfield image → mesh pipeline (longer term)
// Until each project has its own GLB/USDZ, this component renders a
// placeholder strip with the "available in AR — coming" status.

import { useEffect, useRef, useState } from "react";

interface Props {
  /** GLB URL — for desktop + Android Scene Viewer */
  glbUrl?: string;
  /** USDZ URL — for iOS Quick Look */
  usdzUrl?: string;
  /** Display label (e.g. "Hudayriyat Golf Estates · Tower 1") */
  label: string;
  /** Optional alt text for screen readers */
  alt?: string;
  /** Height of the viewer in px */
  height?: number;
}

// Track whether the model-viewer script has been injected
let modelViewerLoaded = false;
function ensureModelViewerLoaded() {
  if (modelViewerLoaded || typeof document === "undefined") return;
  const existing = document.querySelector(
    'script[src*="model-viewer"]'
  ) as HTMLScriptElement | null;
  if (existing) {
    modelViewerLoaded = true;
    return;
  }
  const s = document.createElement("script");
  s.type = "module";
  s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";
  document.head.appendChild(s);
  modelViewerLoaded = true;
}

export function ARPreview({ glbUrl, usdzUrl, label, alt, height = 360 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [supportsAR, setSupportsAR] = useState(false);

  useEffect(() => {
    ensureModelViewerLoaded();
    // Detect AR support — iOS Quick Look + Android Scene Viewer + WebXR
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    setSupportsAR(isIOS || isAndroid);
  }, []);

  const available = Boolean(glbUrl || usdzUrl);

  if (!available) {
    return (
      <div
        className="rounded-2xl border flex flex-col items-center justify-center text-center px-6 py-10"
        style={{
          background: "var(--paper-warm)",
          borderColor: "var(--gold-soft)",
          minHeight: height,
        }}
      >
        <span
          aria-hidden
          className="leading-none mb-4"
          style={{
            color: "var(--gold-deep)",
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: "3.5rem",
            opacity: 0.55,
          }}
        >
          ◇
        </span>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2" style={{ color: "var(--gold-deep)" }}>
          AR · forthcoming
        </div>
        <div
          className="text-base leading-[1.5] max-w-[40ch]"
          style={{ color: "var(--ink-soft)" }}
        >
          {label} — 3D + AR preview is being prepared. Drop me an email and I'll
          send the GLB or schedule a Polycam walkthrough.
        </div>
      </div>
    );
  }

  // model-viewer attributes set via ref so TypeScript doesn't choke on
  // the custom element. The web component renders only after the module
  // script loads — until then this div is empty.
  useEffect(() => {
    const el = ref.current;
    if (!el || !glbUrl) return;
    el.innerHTML = "";
    const mv = document.createElement("model-viewer") as HTMLElement &
      Record<string, unknown>;
    mv.setAttribute("src", glbUrl);
    if (usdzUrl) mv.setAttribute("ios-src", usdzUrl);
    mv.setAttribute("alt", alt || label);
    mv.setAttribute("ar", "");
    mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
    mv.setAttribute("camera-controls", "");
    mv.setAttribute("auto-rotate", "");
    mv.setAttribute("environment-image", "neutral");
    mv.setAttribute("shadow-intensity", "0.85");
    mv.setAttribute("exposure", "0.95");
    mv.style.width = "100%";
    mv.style.height = `${height}px`;
    mv.style.background = "var(--paper-warm)";
    mv.style.borderRadius = "16px";
    el.appendChild(mv);
  }, [glbUrl, usdzUrl, label, alt, height]);

  return (
    <div className="relative">
      <div ref={ref} className="rounded-2xl overflow-hidden" style={{ minHeight: height }} />
      <div className="mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: "var(--ink-faint)" }}>
        <span>3D · {supportsAR ? "AR-enabled" : "Tap on phone for AR"}</span>
        <span style={{ color: "var(--gold-deep)" }}>{label}</span>
      </div>
    </div>
  );
}
