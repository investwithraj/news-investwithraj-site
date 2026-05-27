"use client";

import { useEffect, useRef, CSSProperties } from "react";

/**
 * v16 HolographicRadial — animated radial network-node data visualization.
 *
 * Pure canvas + RAF (no Three.js). Renders:
 *   • Center hub circle
 *   • N orbiting node circles arranged in concentric rings
 *   • Connecting arcs (curved bezier) from hub → each orbit node
 *   • Pulse cycle (~8s): nodes expand/contract, arcs fade-shift
 *   • Holographic blue color palette with soft glow blur
 *
 * Used on:
 *   • TheNote chapter backdrops (chapter 02 "the numbers")
 *   • news.investwithraj.com hero
 *   • DataPanel cards as a decorative inset
 *
 * Performance budget: <8KB gzip, 60fps on iPhone 13 Safari.
 */
type Density = "low" | "medium" | "high";

interface Props {
  density?: Density;        // node count
  variant?: "light" | "dark";
  /** Outer container styling */
  className?: string;
  style?: CSSProperties;
  /** Honor reduced motion — pauses the pulse */
  respectReducedMotion?: boolean;
}

const NODE_COUNTS: Record<Density, number> = {
  low: 8,
  medium: 14,
  high: 22,
};

const COLOR_PALETTE = {
  light: {
    hub:       "#0A0E14",
    node:      "#5BA5F5",
    nodeGlow:  "rgba(91, 165, 245, 0.45)",
    arc:       "rgba(91, 165, 245, 0.35)",
    arcGlow:   "rgba(77, 208, 225, 0.18)",
    background: "transparent",
  },
  dark: {
    hub:       "#5BA5F5",
    node:      "#80E5F0",
    nodeGlow:  "rgba(128, 229, 240, 0.55)",
    arc:       "rgba(128, 229, 240, 0.45)",
    arcGlow:   "rgba(91, 165, 245, 0.22)",
    background: "transparent",
  },
};

export default function HolographicRadial({
  density = "medium",
  variant = "light",
  className,
  style,
  respectReducedMotion = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = COLOR_PALETTE[variant];
    const nodeCount = NODE_COUNTS[density];

    // Build node ring topology
    type Node = {
      angle: number;
      ring: number;          // 1 or 2 (inner / outer ring)
      baseRadius: number;
      phaseOffset: number;   // randomize pulse phase per node
    };

    const nodes: Node[] = [];
    const innerCount = Math.floor(nodeCount * 0.45);
    const outerCount = nodeCount - innerCount;
    for (let i = 0; i < innerCount; i++) {
      nodes.push({
        angle: (i / innerCount) * Math.PI * 2,
        ring: 1,
        baseRadius: 0.42,
        phaseOffset: Math.random() * Math.PI * 2,
      });
    }
    for (let i = 0; i < outerCount; i++) {
      nodes.push({
        angle: (i / outerCount) * Math.PI * 2 + Math.PI / outerCount,
        ring: 2,
        baseRadius: 0.78,
        phaseOffset: Math.random() * Math.PI * 2,
      });
    }

    // Reduced motion check
    let reducedMotion = false;
    if (respectReducedMotion && typeof window !== "undefined") {
      reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // Resize handler — match canvas to displayed CSS size × DPR
    let dpr = 1;
    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Render loop
    const t0 = performance.now();
    const PULSE_PERIOD = 8000; // ms — full pulse cycle

    function render(now: number) {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const baseSize = Math.min(w, h) * 0.5;
      const dt = reducedMotion ? 0 : (now - t0) / PULSE_PERIOD;
      const pulse = (Math.sin(dt * Math.PI * 2) + 1) * 0.5; // 0..1

      ctx.clearRect(0, 0, w, h);

      // 1. Draw connecting arcs first (behind nodes)
      ctx.lineWidth = 1 * dpr;
      nodes.forEach((node) => {
        const nodePulse = (Math.sin((dt * Math.PI * 2) + node.phaseOffset) + 1) * 0.5;
        const radiusFactor = node.baseRadius * (1 + nodePulse * 0.05);
        const nx = cx + Math.cos(node.angle) * baseSize * radiusFactor;
        const ny = cy + Math.sin(node.angle) * baseSize * radiusFactor;

        // Curved bezier from hub to node
        const ctrlOffset = 0.3 + 0.15 * Math.sin(dt * Math.PI * 2 + node.phaseOffset);
        const midX = (cx + nx) / 2;
        const midY = (cy + ny) / 2;
        const perpX = -(ny - cy);
        const perpY = nx - cx;
        const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
        const ctrlX = midX + (perpX / perpLen) * baseSize * ctrlOffset * 0.3;
        const ctrlY = midY + (perpY / perpLen) * baseSize * ctrlOffset * 0.3;

        // Arc gradient — fade from hub to node
        const grad = ctx.createLinearGradient(cx, cy, nx, ny);
        grad.addColorStop(0, colors.arc);
        grad.addColorStop(1, "rgba(91, 165, 245, 0)");

        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(ctrlX, ctrlY, nx, ny);
        ctx.stroke();
      });

      // 2. Draw outer glow ring (atmosphere)
      const ringRadius = baseSize * 0.92;
      const ringGrad = ctx.createRadialGradient(cx, cy, ringRadius * 0.85, cx, cy, ringRadius * 1.05);
      ringGrad.addColorStop(0, "rgba(91, 165, 245, 0)");
      ringGrad.addColorStop(0.5, colors.arcGlow);
      ringGrad.addColorStop(1, "rgba(91, 165, 245, 0)");
      ctx.fillStyle = ringGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // 3. Draw nodes
      nodes.forEach((node) => {
        const nodePulse = (Math.sin((dt * Math.PI * 2) + node.phaseOffset) + 1) * 0.5;
        const radiusFactor = node.baseRadius * (1 + nodePulse * 0.05);
        const nx = cx + Math.cos(node.angle) * baseSize * radiusFactor;
        const ny = cy + Math.sin(node.angle) * baseSize * radiusFactor;
        const nodeSize = (3 + nodePulse * 2) * dpr;

        // Glow
        const glowGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeSize * 4);
        glowGrad.addColorStop(0, colors.nodeGlow);
        glowGrad.addColorStop(1, "rgba(91, 165, 245, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(nx, ny, nodeSize * 4, 0, Math.PI * 2);
        ctx.fill();

        // Node core
        ctx.fillStyle = colors.node;
        ctx.beginPath();
        ctx.arc(nx, ny, nodeSize, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. Hub — center
      const hubSize = (6 + pulse * 3) * dpr;
      const hubGlowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hubSize * 5);
      hubGlowGrad.addColorStop(0, colors.nodeGlow);
      hubGlowGrad.addColorStop(1, "rgba(91, 165, 245, 0)");
      ctx.fillStyle = hubGlowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, hubSize * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colors.hub;
      ctx.beginPath();
      ctx.arc(cx, cy, hubSize, 0, Math.PI * 2);
      ctx.fill();

      // Hub ring
      ctx.strokeStyle = colors.arc;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, hubSize * 1.8, 0, Math.PI * 2);
      ctx.stroke();

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [density, variant, respectReducedMotion]);

  return (
    <div
      className={`v16-holo-radial ${className ?? ""}`}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        ...style,
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}
