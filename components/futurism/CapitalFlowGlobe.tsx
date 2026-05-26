"use client";

// F6 — Capital-flow globe.
// Pure Three.js sphere. Country origin points (UK, India, Russia, China,
// France, Saudi, USA, Switzerland) emit animated arcs into Dubai. Real
// DLD nationality data drives arc weight when wired up; mock weights for
// Day-1. ~12 KB on top of the already-loaded three.js bundle.

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface CapitalSource {
  /** Country name */
  name: string;
  /** Latitude in degrees */
  lat: number;
  /** Longitude in degrees */
  lng: number;
  /** Relative volume weight 0..1 (drives arc thickness + pulse rate) */
  weight: number;
}

// Realistic 2026 DLD nationality flow weights (mock baseline; live data
// will replace via /api/dld-pulse extension).
const DEFAULT_SOURCES: CapitalSource[] = [
  { name: "India", lat: 20.5937, lng: 78.9629, weight: 1.0 },
  { name: "United Kingdom", lat: 55.3781, lng: -3.4360, weight: 0.78 },
  { name: "Russia", lat: 61.5240, lng: 105.3188, weight: 0.62 },
  { name: "China", lat: 35.8617, lng: 104.1954, weight: 0.55 },
  { name: "France", lat: 46.2276, lng: 2.2137, weight: 0.42 },
  { name: "Saudi Arabia", lat: 23.8859, lng: 45.0792, weight: 0.50 },
  { name: "United States", lat: 37.0902, lng: -95.7129, weight: 0.38 },
  { name: "Switzerland", lat: 46.8182, lng: 8.2275, weight: 0.32 },
  { name: "Germany", lat: 51.1657, lng: 10.4515, weight: 0.30 },
  { name: "Pakistan", lat: 30.3753, lng: 69.3451, weight: 0.45 },
];

// Dubai destination
const DUBAI = { lat: 25.2048, lng: 55.2708 };

/** Spherical (lat/lng degrees) → 3D unit vector. */
function latLngToVec3(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** Build a great-circle arc between two points as a smooth CatmullRom curve. */
function buildArcCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
  altitude = 0.4
): THREE.CatmullRomCurve3 {
  const mid = from.clone().add(to).normalize().multiplyScalar(1 + altitude);
  // Add a quarter-step point on each side for smoother bow
  const q1 = from.clone().lerp(mid, 0.5).normalize().multiplyScalar(1 + altitude * 0.7);
  const q2 = to.clone().lerp(mid, 0.5).normalize().multiplyScalar(1 + altitude * 0.7);
  return new THREE.CatmullRomCurve3([from, q1, mid, q2, to]);
}

interface Props {
  height?: string;
  className?: string;
  sources?: CapitalSource[];
}

export function CapitalFlowGlobe({
  height = "520px",
  className = "",
  sources = DEFAULT_SOURCES,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.4, 3.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // ── Globe — wireframe sphere with dotted overlay for texture
    const globeGeo = new THREE.IcosahedronGeometry(1, 4);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x0a1024,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // Solid interior sphere so the wireframe reads
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x141a2c,
      transparent: true,
      opacity: 0.65,
    });
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.99, 64, 64), innerMat);
    scene.add(inner);

    // ── Source dots
    const sourceVecs = sources.map((s) => ({
      ...s,
      vec: latLngToVec3(s.lat, s.lng, 1.005),
    }));

    sourceVecs.forEach((s) => {
      const dotGeo = new THREE.SphereGeometry(0.015 + s.weight * 0.02, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0xc9a961,
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(s.vec);
      scene.add(dot);

      // Pulse ring
      const ringGeo = new THREE.RingGeometry(0.04, 0.045, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xe0c076,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(s.vec);
      ring.lookAt(0, 0, 0);
      ring.userData = { phase: Math.random() * Math.PI * 2, weight: s.weight };
      scene.add(ring);
    });

    // ── Dubai destination — bright pulse
    const dubaiVec = latLngToVec3(DUBAI.lat, DUBAI.lng, 1.005);
    const dubaiGeo = new THREE.SphereGeometry(0.035, 16, 16);
    const dubaiMat = new THREE.MeshBasicMaterial({ color: 0xffd58a });
    const dubaiDot = new THREE.Mesh(dubaiGeo, dubaiMat);
    dubaiDot.position.copy(dubaiVec);
    scene.add(dubaiDot);

    // ── Arcs source → Dubai
    type ArcData = {
      curve: THREE.CatmullRomCurve3;
      mesh: THREE.Line;
      progressLine: THREE.Mesh;
      points: THREE.Vector3[];
      progress: number;
      speed: number;
      weight: number;
    };
    const arcs: ArcData[] = [];

    sourceVecs.forEach((s) => {
      const curve = buildArcCurve(s.vec, dubaiVec, 0.35 + s.weight * 0.25);
      const points = curve.getPoints(64);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0xc9a961,
        transparent: true,
        opacity: 0.18,
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      scene.add(arcLine);

      // Bright "comet" segment that travels along the arc
      const cometGeo = new THREE.SphereGeometry(0.018 + s.weight * 0.012, 10, 10);
      const cometMat = new THREE.MeshBasicMaterial({
        color: 0xffd58a,
      });
      const comet = new THREE.Mesh(cometGeo, cometMat);
      scene.add(comet);

      arcs.push({
        curve,
        mesh: arcLine,
        progressLine: comet,
        points,
        progress: Math.random(),
        speed: 0.002 + s.weight * 0.005,
        weight: s.weight,
      });
    });

    // ── Interaction
    let mouseX = 0;
    let mouseY = 0;
    let autoRot = 0;
    function onPointerMove(e: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    container.addEventListener("pointermove", onPointerMove);

    function onResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    let rafId = 0;
    function tick() {
      if (!reducedMotion) autoRot += 0.0018;

      // Slow auto-spin + mouse parallax
      globe.rotation.y = autoRot + mouseX * 0.4;
      globe.rotation.x = mouseY * 0.25;
      inner.rotation.copy(globe.rotation);

      // Animate dots — copy parent rotation
      scene.children.forEach((c) => {
        if (c === globe || c === inner) return;
        if (c.userData?.phase !== undefined) {
          // Pulse ring
          c.userData.phase += 0.04 * c.userData.weight + 0.01;
          const s = 1 + Math.sin(c.userData.phase) * 0.3;
          c.scale.set(s, s, s);
          (c as THREE.Mesh).material instanceof THREE.MeshBasicMaterial &&
            (((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
              0.7 - (s - 1) * 1.2);
        }
      });

      // Apply spin to dot/arc/Dubai/comet positions through a parent rotation matrix
      const rotMat = new THREE.Matrix4().makeRotationY(globe.rotation.y);
      rotMat.multiply(new THREE.Matrix4().makeRotationX(globe.rotation.x));

      // Comets traveling along arcs
      arcs.forEach((arc) => {
        if (!reducedMotion) arc.progress += arc.speed;
        if (arc.progress > 1) arc.progress = 0;
        const pos = arc.curve.getPoint(arc.progress).clone().applyMatrix4(rotMat);
        arc.progressLine.position.copy(pos);
        arc.mesh.rotation.y = globe.rotation.y;
        arc.mesh.rotation.x = globe.rotation.x;
      });

      // Rotate all dots + Dubai + rings with globe
      sourceVecs.forEach((_s, idx) => {
        const ringIdx = idx * 2 + 1;
        const dotIdx = idx * 2;
        // Their positions are already on sphere — we apply globe rotation
        // via the same rotation matrix.
      });

      // Easier — just rotate the whole group? We add a group below in a refactor pass.
      dubaiDot.position.copy(dubaiVec).applyMatrix4(rotMat);

      // Apply rot to source dots + rings — easier: store originals & rotate
      let sIdx = 0;
      scene.children.forEach((c) => {
        if (c === globe || c === inner) return;
        // Skip lines (arcs) — they rotate via mesh.rotation above
        if ((c as THREE.Line).isLine) return;
        // Skip Dubai (handled above)
        if (c === dubaiDot) return;
        // Skip comets (handled in arcs loop)
        if (arcs.some((a) => a.progressLine === c)) return;
        // It's a source dot or pulse ring
        if (sIdx < sourceVecs.length * 2) {
          const sourceIdx = Math.floor(sIdx / 2);
          const v = sourceVecs[sourceIdx].vec.clone().applyMatrix4(rotMat);
          c.position.copy(v);
          if (sIdx % 2 === 1) c.lookAt(0, 0, 0);
          sIdx++;
        }
      });

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeChild(renderer.domElement);
      renderer.dispose();
      globeGeo.dispose();
      globeMat.dispose();
      innerMat.dispose();
      arcs.forEach((a) => {
        (a.mesh.geometry as THREE.BufferGeometry).dispose();
        (a.mesh.material as THREE.Material).dispose();
      });
    };
  }, [sources]);

  return (
    <div
      ref={containerRef}
      aria-label="Live capital flow into Dubai"
      className={`relative ${className}`}
      style={{ width: "100%", height }}
    />
  );
}
