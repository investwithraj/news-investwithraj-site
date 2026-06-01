"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scrollRig, initScrollRig } from "@/lib/scroll/scrollRig";
import PostFX from "./PostFX";

/**
 * v17 2.0 · ImmersiveWorld (NEWS) — the ONE persistent WebGL world behind the
 * DOM, ported from the MAIN repo's dark-cinematic register.
 *
 * Dark-cinematic register: true-black void (#05070d) + a faint cobalt core-glow
 * + two parallax dust/ember layers that drift and dolly as you scroll
 * (scrollRig.progress). fixed · full-viewport · z-0 · pointer-events:none (the
 * news acts sit above as translucent dark glass and let this bleed through).
 * frameloop="demand" — renders only when scroll moves (RigBridge wires
 * scrollRig.invalidate). The film grade (cobalt bloom + vignette) is composited
 * by <PostFX/> as a DOM overlay sibling (NEWS has no @react-three/postprocessing
 * dependency, so the GPU EffectComposer the MAIN repo uses is reproduced in CSS).
 */

function RigBridge() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    scrollRig.invalidate = invalidate;
    invalidate();
    return () => {
      scrollRig.invalidate = null;
    };
  }, [invalidate]);
  return null;
}

/** Two parallax dust layers + a scroll-driven camera dolly — the cinematic depth. */
function Atmosphere() {
  const near = useRef<THREE.Points>(null);
  const far = useRef<THREE.Points>(null);
  const cam = useThree((s) => s.camera);

  const { nearPos, farPos } = useMemo(() => {
    const mk = (n: number, spread: number) => {
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        a[i * 3] = (Math.random() - 0.5) * spread;
        a[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.66;
        a[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.85;
      }
      return a;
    };
    return { nearPos: mk(900, 16), farPos: mk(1500, 32) };
  }, []);

  useFrame((state) => {
    const p = scrollRig.progress;
    const t = state.clock.elapsedTime;
    if (near.current) {
      near.current.rotation.y = t * 0.012 + p * 0.5;
      near.current.position.z = p * 3.6;
    }
    if (far.current) far.current.rotation.y = -t * 0.006 - p * 0.3;
    cam.position.y = -p * 0.9;
    cam.lookAt(0, 0, 0);
  });

  return (
    <>
      <points ref={far}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[farPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.02}
          color="#2b4a86"
          transparent
          opacity={0.5}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={near}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nearPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.03}
          color="#5BA5F5"
          transparent
          opacity={0.85}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

interface Props {
  children?: React.ReactNode;
}

export default function ImmersiveWorld({ children }: Props) {
  useEffect(() => initScrollRig(), []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(120% 90% at 50% 28%, #0a1024 0%, #05070d 58%, #03040a 100%)",
      }}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#05070d"]} />
        <fog attach="fog" args={["#05070d", 7, 28]} />
        <RigBridge />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 2, 4]} intensity={9} color="#2563EB" distance={22} decay={2} />
        {children ?? <Atmosphere />}
      </Canvas>
      {/* DOM film grade (cobalt bloom + vignette) — sits over the canvas, behind DOM content */}
      <PostFX />
    </div>
  );
}
