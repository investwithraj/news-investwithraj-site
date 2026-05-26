"use client";

// F2 — Procedural Dubai-style 3D skyline.
//
// Hand-built Three.js scene. No external GLB dependencies for Day-1 — pure
// procedural geometry tuned to evoke Dubai (one dominant pinnacle = Burj
// Khalifa proxy; clusters of mid-rises for Marina; offset towers for
// Downtown). Day-night cycle driven by UAE local time. Camera does a slow
// dolly + parallax-tilt on mouse position.
//
// All client-side, lazy-loaded — about 4 KB on top of three.js's bundle.
// Honors prefers-reduced-motion (renders a single still frame).

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  height?: string;
  className?: string;
}

/** Returns sun position parameters based on UAE local time (UTC+4). */
function uaeTimeContext(): {
  /** 0 = midnight, 0.5 = noon, 1 = midnight again — fractional through the day */
  dayFraction: number;
  /** "dawn" | "day" | "dusk" | "night" */
  phase: "dawn" | "day" | "dusk" | "night";
} {
  const now = new Date();
  // UAE = UTC+4
  const uaeHour =
    (now.getUTCHours() + 4 + now.getUTCMinutes() / 60) % 24;
  const fraction = uaeHour / 24;
  let phase: "dawn" | "day" | "dusk" | "night";
  if (uaeHour < 5.5 || uaeHour > 19.5) phase = "night";
  else if (uaeHour < 7) phase = "dawn";
  else if (uaeHour < 17.5) phase = "day";
  else phase = "dusk";
  return { dayFraction: fraction, phase };
}

function paletteForPhase(phase: "dawn" | "day" | "dusk" | "night"): {
  sky: number;
  fog: number;
  ground: number;
  buildingBase: number;
  buildingTop: number;
  windows: number;
  ambient: number;
  sun: number;
} {
  switch (phase) {
    case "dawn":
      return {
        sky: 0xf9d8a0,
        fog: 0xf9d8a0,
        ground: 0x1a1426,
        buildingBase: 0x2d2540,
        buildingTop: 0x9b7a4e,
        windows: 0xffd58a,
        ambient: 0x6b5a78,
        sun: 0xffb86b,
      };
    case "day":
      return {
        sky: 0xf2efe8,
        fog: 0xebe5d6,
        ground: 0x3a3528,
        buildingBase: 0x5b5648,
        buildingTop: 0xc9a961,
        windows: 0xe0c076,
        ambient: 0xe8e2cf,
        sun: 0xfff6dd,
      };
    case "dusk":
      return {
        sky: 0xc9a961,
        fog: 0xa8703a,
        ground: 0x1f1827,
        buildingBase: 0x2a1f3a,
        buildingTop: 0xe0c076,
        windows: 0xffd58a,
        ambient: 0x7a5644,
        sun: 0xff9a4f,
      };
    case "night":
      return {
        sky: 0x0a1024,
        fog: 0x05081a,
        ground: 0x05081a,
        buildingBase: 0x141a2c,
        buildingTop: 0x2a2d44,
        windows: 0xe0c076,
        ambient: 0x1a1f3a,
        sun: 0x5b6378,
      };
  }
}

export function DubaiSkyline3D({
  height = "100vh",
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const { phase } = uaeTimeContext();
    const palette = paletteForPhase(phase);

    // ── Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.sky);
    scene.fog = new THREE.Fog(palette.fog, 60, 220);

    // ── Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.5,
      400
    );
    camera.position.set(0, 14, 65);
    camera.lookAt(0, 12, 0);

    // ── Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // ── Lighting
    const ambient = new THREE.AmbientLight(palette.ambient, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(palette.sun, phase === "night" ? 0.18 : 0.85);
    sun.position.set(-30, 50, 20);
    scene.add(sun);

    // ── Ground
    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshLambertMaterial({
      color: palette.ground,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // ── Skyline
    // Procedural building generator. Tuned to evoke a Dubai-style cluster:
    //   - one dominant pinnacle (Burj-proxy) at the center-back
    //   - cluster of 18 mid-rises around it (Downtown)
    //   - thin row of further-back tall slabs (Marina arc)
    const buildings: THREE.Mesh[] = [];

    function building(
      x: number,
      z: number,
      width: number,
      depth: number,
      height: number,
      taper = 0
    ) {
      const geo = taper > 0
        ? new THREE.CylinderGeometry(
            (width / 2) * (1 - taper),
            width / 2,
            height,
            8
          )
        : new THREE.BoxGeometry(width, height, depth);

      // Two-tone gradient via vertex color isn't needed — fake with
      // emissive material so windows glow at night.
      const mat = new THREE.MeshLambertMaterial({
        color: palette.buildingBase,
        emissive: palette.windows,
        emissiveIntensity: phase === "night" ? 0.22 : 0.04,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, height / 2, z);
      scene.add(mesh);
      buildings.push(mesh);

      // Top accent — small gold cap to evoke crown lighting
      if (height > 14) {
        const capGeo = new THREE.BoxGeometry(width * 0.4, 0.6, depth * 0.4);
        const capMat = new THREE.MeshBasicMaterial({
          color: palette.buildingTop,
        });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(x, height + 0.3, z);
        scene.add(cap);
        buildings.push(cap);
      }
    }

    // Burj-proxy — dominant tapered tower
    building(0, -15, 4, 4, 48, 0.6);

    // Downtown cluster
    const downtown = [
      [-6, -8, 3, 3, 18],
      [-10, -12, 2.5, 2.5, 14],
      [6, -10, 3, 3, 16],
      [10, -12, 2.5, 2.5, 13],
      [-4, -22, 2.5, 2.5, 22],
      [4, -22, 2.5, 2.5, 20],
      [-12, -20, 2.4, 2.4, 15],
      [12, -18, 2.4, 2.4, 17],
      [0, -28, 3.6, 3.6, 12],
      [-7, -28, 2.4, 2.4, 11],
      [7, -28, 2.4, 2.4, 10],
    ];
    downtown.forEach((b) => building(b[0], b[1], b[2], b[3], b[4]));

    // Marina arc — wider spread, slab style
    for (let i = -8; i <= 8; i++) {
      if (Math.abs(i) < 3) continue;
      const x = i * 4.5;
      const z = -45 - Math.abs(i) * 1.2 + (i % 2 === 0 ? -1 : 1);
      const h = 8 + Math.abs(Math.sin(i * 1.3)) * 16;
      building(x, z, 2.6, 2.6, h);
    }

    // Foreground softening — a few short blocks closer to camera
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      building(i * 5, -2, 2.2, 2.2, 4 + Math.abs(Math.cos(i)) * 3);
    }

    // ── Particle haze (volumetric atmosphere)
    const hazeCount = phase === "night" ? 350 : 150;
    const hazeGeo = new THREE.BufferGeometry();
    const hazePositions = new Float32Array(hazeCount * 3);
    for (let i = 0; i < hazeCount; i++) {
      hazePositions[i * 3] = (Math.random() - 0.5) * 160;
      hazePositions[i * 3 + 1] = Math.random() * 40 + 4;
      hazePositions[i * 3 + 2] = -Math.random() * 90 - 5;
    }
    hazeGeo.setAttribute("position", new THREE.BufferAttribute(hazePositions, 3));
    const hazeMat = new THREE.PointsMaterial({
      color: palette.windows,
      size: 0.35,
      transparent: true,
      opacity: phase === "night" ? 0.85 : 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const haze = new THREE.Points(hazeGeo, hazeMat);
    scene.add(haze);

    // ── Interaction
    let mouseX = 0;
    let mouseY = 0;
    let cameraOffsetX = 0;
    let cameraOffsetY = 0;
    function onPointerMove(e: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    container.addEventListener("pointermove", onPointerMove);

    // ── Resize
    function onResize() {
      if (!container || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    // ── Loop
    let t = 0;
    let rafId = 0;
    function tick() {
      t += 0.005;

      // Spring camera toward mouse offset
      cameraOffsetX += (mouseX * 4 - cameraOffsetX) * 0.04;
      cameraOffsetY += (-mouseY * 2 - cameraOffsetY) * 0.04;

      // Slow dolly + parallax
      const slow = reducedMotion ? 0 : t;
      camera.position.x = Math.sin(slow * 0.35) * 6 + cameraOffsetX;
      camera.position.y = 13 + Math.sin(slow * 0.6) * 0.6 + cameraOffsetY;
      camera.position.z = 60 + Math.cos(slow * 0.35) * 4;
      camera.lookAt(0, 12, -10);

      // Haze drift
      if (!reducedMotion) {
        haze.rotation.y = slow * 0.05;
      }

      renderer.render(scene, camera);
      if (!reducedMotion) rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeChild(renderer.domElement);
      renderer.dispose();
      // Dispose all geometries/materials
      buildings.forEach((m) => {
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else (m.material as THREE.Material).dispose();
      });
      groundGeo.dispose();
      groundMat.dispose();
      hazeGeo.dispose();
      hazeMat.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`relative overflow-hidden ${className}`}
      style={{ height, width: "100%" }}
    />
  );
}
