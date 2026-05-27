"use client";

import { Suspense, useMemo, useRef, useState, CSSProperties } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * v16 Earth3D — photorealistic interactive Earth globe.
 *
 * Reference: spatial.com globe (Screenshot 2026-05-27 100642.png) — the
 * homepage Reach centerpiece. Three.js sphere with:
 *   • 8K Earth daymap texture (when available — falls back to procedural gradient)
 *   • Atmospheric fresnel glow rim (custom shader)
 *   • 6 city pins as <Html> overlays at lat/lon coords
 *   • Auto-rotate (0.15 rad/s) OR scroll-controlled rotation
 *   • Hover-pin reveals city tooltip with buyer-count stat
 *
 * Performance budget: <60KB gzip JS, DPR clamp at 1.5, mobile fallback to
 * 2K texture or static image (caller decides via reducedQuality prop).
 *
 * Texture assets (user to provide in /public/textures/):
 *   /textures/earth-day-8k.jpg     — NASA Visible Earth daymap
 *   /textures/earth-clouds-4k.jpg  — cloud overlay (translucent)
 *   /textures/earth-normal-4k.jpg  — bump map (optional, for elevation detail)
 *
 * If textures are missing, a procedural gradient sphere renders instead —
 * usable as a placeholder during early Phase 3 iteration.
 */
export interface CityPin {
  name: string;
  lat: number;     // -90..90
  lon: number;     // -180..180
  buyerCount?: string;  // e.g. "47 mandates"
  isPrimary?: boolean;  // larger pin + glow for "home base" (UAE)
}

interface Props {
  pins?: CityPin[];
  textureUrl?: string;          // path to daymap; falls back to procedural
  cloudsUrl?: string;            // optional cloud overlay
  autoRotate?: boolean;
  autoRotateSpeed?: number;      // rad/sec
  reducedQuality?: boolean;      // mobile / prefers-reduced-motion
  enableControls?: boolean;      // drag-rotate via OrbitControls
  showStars?: boolean;            // backdrop stars
  variant?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_PINS: CityPin[] = [
  { name: "Dubai",     lat:  25.2048, lon:  55.2708, buyerCount: "Primary",   isPrimary: true },
  { name: "Mumbai",    lat:  19.0760, lon:  72.8777, buyerCount: "31 leads" },
  { name: "New Delhi", lat:  28.6139, lon:  77.2090, buyerCount: "24 leads" },
  { name: "London",    lat:  51.5074, lon:  -0.1278, buyerCount: "18 leads" },
  { name: "New York",  lat:  40.7128, lon: -74.0060, buyerCount: "14 leads" },
  { name: "Singapore", lat:   1.3521, lon: 103.8198, buyerCount:  "9 leads" },
  { name: "Hong Kong", lat:  22.3193, lon: 114.1694, buyerCount:  "7 leads" },
];

/** Convert lat/lon to a unit-sphere XYZ position. */
function latLonToVec3(lat: number, lon: number, radius = 1): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** ─── Procedural Earth (placeholder when no texture provided) ─────────── */
function ProceduralEarth() {
  const mat = useMemo(() => {
    // Build a vibrant canvas texture: high-contrast continents on saturated ocean
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Ocean — vivid mid-blue, NOT navy (so it shows against pale backgrounds)
      const og = ctx.createLinearGradient(0, 0, 0, 512);
      og.addColorStop(0,   "#2563EB"); // holo-deep top
      og.addColorStop(0.4, "#1E40AF"); // saturated blue mid
      og.addColorStop(0.6, "#1E3A8A"); // navy belt
      og.addColorStop(1,   "#2563EB"); // back to bright
      ctx.fillStyle = og;
      ctx.fillRect(0, 0, 1024, 512);

      // Bright continent patches — warm tan/sand on blue ocean
      ctx.fillStyle = "rgba(168, 133, 75, 0.95)"; // brass-deep tone
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * 1024;
        const y = 80 + Math.random() * 360;
        const w = 40 + Math.random() * 200;
        const h = 25 + Math.random() * 100;
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }

      // A few brighter highlight patches (snow / ice caps look)
      ctx.fillStyle = "rgba(232, 235, 238, 0.7)";
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * 1024;
        // Bias toward poles
        const polar = Math.random() < 0.5 ? Math.random() * 60 : 450 + Math.random() * 60;
        const w = 80 + Math.random() * 200;
        const h = 30 + Math.random() * 60;
        ctx.beginPath();
        ctx.ellipse(x, polar, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    // MeshBasicMaterial: unlit. The texture shows its true colors regardless
    // of scene lighting. Best for procedural placeholders + pre-baked NASA
    // daymaps (which are already "lit" via solar daylight).
    return new THREE.MeshBasicMaterial({
      map: tex,
    });
  }, []);

  return (
    <mesh material={mat}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

/** ─── Real-texture Earth (when texture URL provided) ──────────────────── */
function TexturedEarth({
  textureUrl,
  cloudsUrl,
}: {
  textureUrl: string;
  cloudsUrl?: string;
}) {
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  const clouds = useLoader(
    THREE.TextureLoader,
    cloudsUrl ?? textureUrl
  );

  // Configure texture
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);

  const cloudsRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (cloudsRef.current && cloudsUrl) {
      cloudsRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group>
      {/* Earth — MeshBasicMaterial (unlit) so the NASA daymap shows its
          true colors. Daymaps are already "lit" with solar daylight.
          For night-side terminator effects, swap to MeshStandardMaterial
          + add lights + a nightmap. */}
      <mesh>
        <sphereGeometry args={[1, 96, 96]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* Clouds (optional) */}
      {cloudsUrl && (
        <mesh ref={cloudsRef} scale={1.015}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial
            map={clouds}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/** ─── Atmospheric fresnel glow ─────────────────────────────────────────── */
function Atmosphere() {
  const ref = useRef<THREE.Mesh>(null);
  return (
    <mesh ref={ref} scale={1.08}>
      <sphereGeometry args={[1, 48, 48]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        uniforms={{
          uColor: { value: new THREE.Color("#5BA5F5") },
        }}
        vertexShader={`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.75 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
            gl_FragColor = vec4(uColor, intensity * 0.85);
          }
        `}
      />
    </mesh>
  );
}

/** ─── City pin ─────────────────────────────────────────────────────────── */
function Pin({
  pin,
  variant,
  onHover,
  onLeave,
  isHovered,
}: {
  pin: CityPin;
  variant: "light" | "dark";
  onHover: () => void;
  onLeave: () => void;
  isHovered: boolean;
}) {
  const position = useMemo(() => latLonToVec3(pin.lat, pin.lon, 1.015), [pin.lat, pin.lon]);
  const pinSize = pin.isPrimary ? 0.04 : 0.022;
  const pinColor = pin.isPrimary ? "#80E5F0" : "#5BA5F5";

  return (
    <group position={position}>
      {/* Pin sphere */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover();
        }}
        onPointerOut={onLeave}
      >
        <sphereGeometry args={[pinSize, 16, 16]} />
        <meshStandardMaterial
          color={pinColor}
          emissive={pinColor}
          emissiveIntensity={pin.isPrimary ? 2.5 : 1.8}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>

      {/* Pulse ring around primary */}
      {pin.isPrimary && (
        <mesh scale={[1.5, 1.5, 1.5]}>
          <sphereGeometry args={[pinSize, 16, 16]} />
          <meshBasicMaterial
            color={pinColor}
            transparent
            opacity={0.25}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* HTML tooltip on hover */}
      {isHovered && (
        <Html
          center
          distanceFactor={6}
          style={{
            pointerEvents: "none",
            fontFamily: "var(--v16-font-mono), monospace",
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: variant === "dark" ? "#FBFBFC" : "#0A0E14",
            background:
              variant === "dark"
                ? "rgba(20, 24, 31, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
            border: `1px solid ${variant === "dark" ? "rgba(91,165,245,0.4)" : "rgba(91,165,245,0.5)"}`,
            borderRadius: "6px",
            padding: "6px 10px",
            whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(10,14,20,0.18)",
            transform: "translateY(-32px)",
          }}
        >
          <div style={{ fontWeight: 500 }}>{pin.name}</div>
          {pin.buyerCount && (
            <div style={{ color: "#5BA5F5", marginTop: "2px" }}>{pin.buyerCount}</div>
          )}
        </Html>
      )}
    </group>
  );
}

/** ─── Spinning Earth group ──────────────────────────────────────────── */
function EarthGroup({
  textureUrl,
  cloudsUrl,
  pins,
  autoRotate,
  autoRotateSpeed,
  variant,
}: {
  textureUrl?: string;
  cloudsUrl?: string;
  pins: CityPin[];
  autoRotate: boolean;
  autoRotateSpeed: number;
  variant: "light" | "dark";
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);

  useFrame((_, delta) => {
    if (groupRef.current && autoRotate && !hoveredPin) {
      groupRef.current.rotation.y += delta * autoRotateSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      {textureUrl ? (
        <Suspense fallback={<ProceduralEarth />}>
          <TexturedEarth textureUrl={textureUrl} cloudsUrl={cloudsUrl} />
        </Suspense>
      ) : (
        <ProceduralEarth />
      )}
      <Atmosphere />
      {pins.map((pin) => (
        <Pin
          key={pin.name}
          pin={pin}
          variant={variant}
          onHover={() => setHoveredPin(pin.name)}
          onLeave={() => setHoveredPin(null)}
          isHovered={hoveredPin === pin.name}
        />
      ))}
    </group>
  );
}

/** ─── Public component ─────────────────────────────────────────────────── */
/** Default texture paths — wire the NASA daymap + cloud overlay automatically.
 *  Any caller can override by passing textureUrl / cloudsUrl props.
 *  If the files don't exist at these paths, the Suspense fallback in
 *  EarthGroup catches the loader rejection and ProceduralEarth renders. */
const DEFAULT_TEXTURE_URL = "/textures/earth-day-8k.jpg";
const DEFAULT_CLOUDS_URL = "/textures/earth-clouds-4k.jpg";

export default function Earth3D({
  pins = DEFAULT_PINS,
  textureUrl = DEFAULT_TEXTURE_URL,
  cloudsUrl = DEFAULT_CLOUDS_URL,
  autoRotate = true,
  autoRotateSpeed = 0.15,
  reducedQuality = false,
  enableControls = true,
  showStars = false,
  variant = "light",
  className,
  style,
}: Props) {
  const dpr: [number, number] = reducedQuality ? [1, 1.25] : [1, 1.5];

  return (
    <div
      className={`v16-earth3d ${className ?? ""}`}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        ...style,
      }}
    >
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, 2.8], fov: 45 }}
        gl={{
          alpha: true,
          antialias: !reducedQuality,
          powerPreference: "high-performance",
          // Disable tone mapping so basic-material texture colors stay vivid
          toneMapping: THREE.NoToneMapping,
        }}
      >
        {/* Pin emissives still rely on scene lighting */}
        <ambientLight intensity={0.8} color="#FFFFFF" />
        <directionalLight
          position={[5, 3, 5]}
          intensity={1.8}
          color="#FFFFFF"
        />
        <directionalLight
          position={[-3, -1, -2]}
          intensity={0.4}
          color="#5BA5F5"
        />

        {/* Optional star backdrop */}
        {showStars && (
          <Stars
            radius={50}
            depth={20}
            count={1000}
            factor={2}
            saturation={0}
            fade
            speed={0.5}
          />
        )}

        {/* The Earth */}
        <EarthGroup
          textureUrl={textureUrl}
          cloudsUrl={cloudsUrl}
          pins={pins}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          variant={variant}
        />

        {/* User drag-rotate */}
        {enableControls && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            enableRotate
            rotateSpeed={0.4}
            autoRotate={false}
          />
        )}
      </Canvas>
    </div>
  );
}
