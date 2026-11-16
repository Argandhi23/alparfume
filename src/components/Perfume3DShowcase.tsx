"use client";

import React, {
  Component,
  ErrorInfo,
  ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Decal, Float, Ring, Text, useTexture } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ProductWithVariants } from "@/lib/supabase";

// ============================================================================
// TYPES & PRODUCT CONFIGURATIONS (EAU DE PARFUM 50ML COLLECTION)
// ============================================================================

export interface BottleLabelLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  letterSpacing?: number;
  font?: string;
}

export interface Perfume3DItemConfig {
  id: string;
  slug: string;
  displayName?: string;
  brandTitle: string;
  mainTitleTop: string;
  subtitleMiddle: string;
  mainTitleBottom?: string;
  titleOffsetX?: number;
  titleOffsetY?: number;
  subtitleOffsetY?: number;
  labelLines?: BottleLabelLine[];
  volumeLabel: string;
  tagline: string;
  scentNotes: string[];
  outerGlassColor: string;
  innerCavityColor: string;
  innerGlowColor: string;
  bubbleRimColor: string;
  uiAccentColor?: string;
  neckColor: string;
  capColor: string;
  labelColor: string;
  shadowColor: string;
  bubblePreset?: "default" | "serenity";
  decalUrl?: string;
  useDecal?: boolean;
  productData?: ProductWithVariants;
  onlySizeMl?: number;
  fallbackPrice: number;
  fallbackImage: string;
}

export interface Perfume3DShowcaseProps {
  products?: ProductWithVariants[];
  merryKiss?: ProductWithVariants;
  guavin?: ProductWithVariants;
  elysianVanilla?: ProductWithVariants;
  pinkRomance?: ProductWithVariants;
  serenity?: ProductWithVariants;
  useDecal?: boolean;
  items?: Perfume3DItemConfig[];
}

function parseProductNotes(
  notesRaw: string | null | undefined,
  fallback: string[]
): string[] {
  if (!notesRaw) return fallback;
  try {
    const parsed = JSON.parse(notesRaw) as {
      top?: string;
      middle?: string;
      bottom?: string;
    };
    const combined = [parsed.top, parsed.middle, parsed.bottom]
      .filter(Boolean)
      .flatMap((part) => (part ? part.split(",") : []))
      .map((s) => s.trim())
      .filter(Boolean);
    return combined.length > 0 ? combined.slice(0, 6) : fallback;
  } catch {
    const split = notesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return split.length > 0 ? split.slice(0, 6) : fallback;
  }
}

// ============================================================================
// WEBGL AVAILABILITY CHECK & ERROR BOUNDARY (ANTI CRASH / CLIENT EXCEPTION)
// ============================================================================

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { powerPreference: "default" }) ||
      canvas.getContext("webgl", { powerPreference: "default" }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    return true;
  } catch {
    return false;
  }
}

interface WebGLErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface WebGLErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  constructor(props: WebGLErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): WebGLErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("3D WebGL Showcase fallback activated:", error.message, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ============================================================================
// SHARED LIGHTWEIGHT GEOMETRIES (DIBUAT 1 KALI UNTUK SEMUA 5 BOTOL — HEMAT GPU)
// ============================================================================

interface SharedBottleGeometries {
  outerBottle: THREE.BufferGeometry;
  innerCavity: THREE.BufferGeometry;
  dipTube: THREE.BufferGeometry;
  valveHousing: THREE.BufferGeometry;
  neckRing: THREE.BufferGeometry;
  capCollar: THREE.BufferGeometry;
  capBody: THREE.BufferGeometry;
  footBlock: THREE.BufferGeometry;
  meniscusDefault: THREE.BufferGeometry;
  bubbleSerenityBig: THREE.BufferGeometry;
  bubbleSerenitySmall: THREE.BufferGeometry;
  shadowPlane: THREE.BufferGeometry;
}

let cachedGeometries: SharedBottleGeometries | null = null;

function getSharedBottleGeometries(): SharedBottleGeometries {
  if (cachedGeometries) return cachedGeometries;

  // 1. Rongga dalam berlekuk (low-poly smooth: 14x18x6 segmen, sangat ringan)
  const innerCavity = new THREE.BoxGeometry(1.62, 2.12, 0.68, 14, 18, 6);
  const pos = innerCavity.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / 0.81;
    const ny = v.y / 1.06;
    const nz = v.z / 0.34;

    const rFactor =
      1.0 -
      0.045 * Math.pow(nx * nx, 2) * Math.pow(ny * ny, 2) -
      0.04 * Math.pow(nx * nx, 2) * Math.pow(nz * nz, 2);
    v.x *= rFactor;
    v.z *= rFactor;

    const clampedY = THREE.MathUtils.clamp(ny + 0.04, -1, 1);
    const waistCurve = Math.pow(Math.cos(clampedY * Math.PI * 0.5), 1.35);
    v.x *= 1.0 - 0.095 * waistCurve;

    if (ny < -0.68) {
      const bottomArch = Math.max(0, 1.0 - nx * nx * 1.15);
      const bottomBlend = THREE.MathUtils.smoothstep(-ny, 0.68, 1.0);
      v.y += 0.055 * bottomArch * bottomBlend;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }
  innerCavity.computeVertexNormals();

  // 2. Selang semprotan melengkung (ringan: 18 segmen)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.32, 0),
    new THREE.Vector3(0.02, 0.72, 0.01),
    new THREE.Vector3(0.08, 0.08, 0.02),
    new THREE.Vector3(0.23, -0.52, 0.01),
    new THREE.Vector3(0.46, -0.96, 0),
  ]);
  const dipTube = new THREE.TubeGeometry(curve, 18, 0.024, 8, false);

  // 3. Geometri botol luar & komponen tutup (shared)
  const outerBottle = new RoundedBoxGeometry(2.04, 2.72, 1.04, 3, 0.065);
  const valveHousing = new THREE.CylinderGeometry(0.16, 0.11, 0.22, 16);
  const neckRing = new THREE.CylinderGeometry(0.515, 0.515, 0.08, 24);
  const capCollar = new THREE.CylinderGeometry(0.532, 0.528, 0.17, 28);
  const capBody = new THREE.CylinderGeometry(0.542, 0.545, 0.98, 28);
  const footBlock = new RoundedBoxGeometry(0.24, 0.04, 0.76, 2, 0.015);
  const meniscusDefault = new RoundedBoxGeometry(0.84, 0.14, 0.52, 2, 0.065);
  const bubbleSerenityBig = new RoundedBoxGeometry(0.56, 0.27, 0.44, 3, 0.13);
  const bubbleSerenitySmall = new RoundedBoxGeometry(0.15, 0.14, 0.2, 2, 0.068);
  const shadowPlane = new THREE.PlaneGeometry(3.2, 1.8);

  cachedGeometries = {
    outerBottle,
    innerCavity,
    dipTube,
    valveHousing,
    neckRing,
    capCollar,
    capBody,
    footBlock,
    meniscusDefault,
    bubbleSerenityBig,
    bubbleSerenitySmall,
    shadowPlane,
  };

  return cachedGeometries;
}

let cachedShadowTexture: THREE.CanvasTexture | null = null;

function getSoftShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedShadowTexture) return cachedShadowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, "rgba(0, 0, 0, 0.34)");
    grad.addColorStop(0.5, "rgba(0, 0, 0, 0.14)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  cachedShadowTexture = new THREE.CanvasTexture(canvas);
  return cachedShadowTexture;
}

// ============================================================================
// OPTIONAL DECAL SUB-COMPONENT
// ============================================================================

function BottleDecalOverlay({ decalUrl }: { decalUrl: string }) {
  const texture = useTexture(decalUrl);
  useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    }
  }, [texture]);

  return (
    <Decal
      position={[0, -0.02, 0.53]}
      rotation={[0, 0, 0]}
      scale={[1.8, 2.45, 0.35]}
      map={texture}
    />
  );
}

// ============================================================================
// PROCEDURAL 3D PERFUME BOTTLE (LIGHTWEIGHT, NON-METALLIC, PITCH BLACK CAP)
// ============================================================================

interface ProceduralBottleProps {
  item: Perfume3DItemConfig;
  index: number;
  scrollCurrentRef: React.MutableRefObject<number>;
  scrollVelocityRef: React.MutableRefObject<number>;
  globalUseDecal: boolean;
}

function ProceduralPerfumeBottle({
  item,
  index,
  scrollCurrentRef,
  scrollVelocityRef,
  globalUseDecal,
}: ProceduralBottleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  const geoms = useMemo(() => getSharedBottleGeometries(), []);
  const shadowTex = useMemo(() => getSoftShadowTexture(), []);

  // Shader kaca bening celup (1 program shader ringan yang di-share oleh semua 5 botol!)
  const handleOuterGlassBeforeCompile = useCallback(
    (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        varying vec3 vGlassLocalPos;
        varying vec3 vGlassViewDir;
        varying vec3 vGlassWorldNormal;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vGlassLocalPos = position;
        vec4 wsPos = modelMatrix * vec4(position, 1.0);
        vGlassViewDir = normalize(cameraPosition - wsPos.xyz);
        vGlassWorldNormal = normalize(mat3(modelMatrix) * normal);`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        varying vec3 vGlassLocalPos;
        varying vec3 vGlassViewDir;
        varying vec3 vGlassWorldNormal;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `
        vec3 uInnerLiquidColor = diffuse;
        vec3 uOuterWallColor = emissive;
        vec3 uInnerGlowColor = mix(diffuse, vec3(1.0), 0.32);
        vec3 uRimColor = mix(diffuse, vec3(1.0), 0.62);

        float nx = vGlassLocalPos.x / 1.02;
        float ny = vGlassLocalPos.y / 1.36;

        float clampedNy = clamp((ny + 0.04) * 1.12, -1.57079, 1.57079);
        float waistBoundaryX = 0.805 - 0.078 * pow(cos(clampedNy), 1.35);

        float bottomFloorY = -0.745 + 0.038 * max(0.0, 1.0 - nx * nx * 1.3);
        float topShoulderY = 0.845 - 0.025 * nx * nx;

        float dxWall = abs(nx) - waistBoundaryX;
        float dyBottom = bottomFloorY - ny;
        float dyTop = ny - topShoulderY;
        float cavitySignedDist = max(dxWall, max(dyBottom, dyTop));

        float inCavity = 1.0 - smoothstep(-0.04, 0.05, cavitySignedDist);

        float innerRimBand = exp(-pow((cavitySignedDist + 0.006) / 0.038, 2.0));
        innerRimBand *= (1.0 - 0.6 * smoothstep(0.75, 0.92, ny) * (1.0 - smoothstep(0.0, 0.45, abs(nx))));

        float bottomCushion = exp(-pow((ny + 0.825) / 0.048, 2.0)) * smoothstep(0.92, 0.45, abs(nx));

        float ndotv = clamp(abs(dot(normalize(vGlassWorldNormal), normalize(vGlassViewDir))), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, 3.6);

        float centerRadial = length(vec2(nx * 0.85, (ny - 0.05) * 0.72));
        float centerTranslucency = clamp(1.0 - centerRadial * 0.78, 0.0, 1.0) * inCavity;

        vec3 centerGlassTint = mix(uInnerLiquidColor, uInnerGlowColor, 0.42);
        centerGlassTint = mix(centerGlassTint, vec3(1.0), 0.16 * centerTranslucency);
        vec3 wallGlassTint = mix(uOuterWallColor, uInnerLiquidColor, 0.32);
        vec3 dippedColor = mix(wallGlassTint, centerGlassTint, inCavity);

        vec3 rimHighlightCol = mix(uRimColor, vec3(1.0), 0.25);
        vec3 finalRgb = mix(dippedColor, rimHighlightCol, clamp(innerRimBand * 0.46, 0.0, 0.55));
        finalRgb = mix(finalRgb, rimHighlightCol, clamp(bottomCushion * 0.34, 0.0, 0.45));
        finalRgb += vec3(1.0) * (fresnel * 0.12);

        float baseAlpha = mix(0.66, 0.40, inCavity);
        baseAlpha = mix(baseAlpha, 0.34, centerTranslucency * 0.62);
        baseAlpha = clamp(
          baseAlpha + innerRimBand * 0.12 + fresnel * 0.14,
          0.32,
          0.82
        );

        gl_FragColor = vec4(finalRgb, baseAlpha);
        #include <dithering_fragment>
        `
      );
    },
    []
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const dt = Math.min(delta, 0.05);
    const lerpFactor = 1 - Math.exp(-8.0 * dt);

    const offset = index - scrollCurrentRef.current;
    const absOffset = Math.abs(offset);
    const velocity = scrollVelocityRef.current;

    // 1. JARAK ANTAR BOTOL LEBIH LEGA DI HP (MOBILE) MAUPUN DESKTOP
    const isMobileViewport = viewport.width < 4.8;
    const xSpacing = isMobileViewport
      ? Math.max(3.35, viewport.width * 0.82)
      : Math.min(3.9, Math.max(3.0, viewport.width * 0.44));

    const targetX = offset * xSpacing;
    const targetY = -Math.pow(offset, 2) * 0.22 + offset * -0.05;
    const targetZ =
      -Math.pow(absOffset, 1.2) * (isMobileViewport ? 1.65 : 1.42);

    group.position.x = THREE.MathUtils.lerp(
      group.position.x,
      targetX,
      lerpFactor
    );
    group.position.y = THREE.MathUtils.lerp(
      group.position.y,
      targetY,
      lerpFactor
    );
    group.position.z = THREE.MathUtils.lerp(
      group.position.z,
      targetZ,
      lerpFactor
    );

    // 2. DYNAMIC ROTATION & TILT
    const targetRotationY = offset * -0.75 + velocity * -0.38;
    const targetRotationZ =
      THREE.MathUtils.clamp(-offset * 0.16, -0.24, 0.24) + velocity * -0.05;
    const targetRotationX =
      Math.min(0.08, absOffset * 0.03) + Math.abs(velocity) * 0.02;

    group.rotation.y = THREE.MathUtils.lerp(
      group.rotation.y,
      targetRotationY,
      lerpFactor
    );
    group.rotation.z = THREE.MathUtils.lerp(
      group.rotation.z,
      targetRotationZ,
      lerpFactor
    );
    group.rotation.x = THREE.MathUtils.lerp(
      group.rotation.x,
      targetRotationX,
      lerpFactor
    );

    // 3. DYNAMIC SCALE
    const centerScale = isMobileViewport ? 0.92 : 1.02;
    const sideScale = isMobileViewport ? 0.62 : 0.72;
    const baseScale = THREE.MathUtils.lerp(
      centerScale,
      sideScale,
      Math.min(1, absOffset * 0.85)
    );
    const nextScale = THREE.MathUtils.lerp(
      group.scale.x,
      baseScale,
      lerpFactor
    );
    group.scale.setScalar(nextScale);
  });

  const showDecal = Boolean((globalUseDecal || item.useDecal) && item.decalUrl);
  const titleX = item.titleOffsetX ?? 0;
  const titleY = item.titleOffsetY ?? -0.08;
  const subY = item.subtitleOffsetY ?? -0.34;

  const resolvedLabelLines: BottleLabelLine[] = useMemo(() => {
    if (item.labelLines && item.labelLines.length > 0) {
      return item.labelLines;
    }
    const lines: BottleLabelLine[] = [
      {
        text: item.mainTitleTop,
        x: titleX,
        y: titleY,
        fontSize: 0.4,
        letterSpacing: 0.02,
        font: "/fonts/CormorantGaramond-Bold.ttf",
      },
      {
        text: item.subtitleMiddle,
        x: titleX,
        y: subY,
        fontSize: 0.118,
        letterSpacing: 0.03,
        font: "/fonts/CormorantGaramond-Bold.ttf",
      },
    ];
    if (item.mainTitleBottom) {
      lines.push({
        text: item.mainTitleBottom,
        x: titleX,
        y: -0.6,
        fontSize: 0.4,
        letterSpacing: 0.03,
        font: "/fonts/CormorantGaramond-Bold.ttf",
      });
    }
    return lines;
  }, [
    item.labelLines,
    item.mainTitleTop,
    item.subtitleMiddle,
    item.mainTitleBottom,
    titleX,
    titleY,
    subY,
  ]);

  return (
    <group ref={groupRef}>
      {/* Bayangan lantai ringan per-botol (menggantikan ContactShadows FBO yang berat) */}
      {shadowTex && (
        <mesh
          geometry={geoms.shadowPlane}
          position={[0, -1.52, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial
            map={shadowTex}
            color={item.shadowColor}
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
      )}

      <Float
        speed={1.3}
        rotationIntensity={0.03}
        floatIntensity={0.11}
        floatingRange={[-0.022, 0.022]}
      >
        {/* 1. SELANG SEMPROTAN DALAM & HOUSING VALVE */}
        <mesh geometry={geoms.dipTube} renderOrder={1}>
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.35}
            metalness={0.0}
            transparent
            opacity={0.34}
            depthWrite={false}
          />
        </mesh>

        <mesh
          geometry={geoms.valveHousing}
          position={[0, 1.21, 0]}
          renderOrder={1}
        >
          <meshStandardMaterial
            color="#e5e7eb"
            roughness={0.45}
            metalness={0.0}
            transparent
            opacity={0.36}
            depthWrite={false}
          />
        </mesh>

        {/* 2. RONGGA CAIRAN DALAM BERLEKUK */}
        <mesh
          geometry={geoms.innerCavity}
          position={[0, 0.05, 0]}
          renderOrder={2}
        >
          <meshStandardMaterial
            color={item.innerCavityColor}
            emissive={item.innerGlowColor}
            emissiveIntensity={0.18}
            roughness={0.28}
            metalness={0.0}
            transparent
            opacity={0.26}
            depthWrite={false}
          />
        </mesh>

        <mesh
          geometry={geoms.innerCavity}
          position={[0, 0.05, 0]}
          scale={[1.018, 1.012, 1.02]}
          renderOrder={2}
        >
          <meshStandardMaterial
            color={item.bubbleRimColor}
            roughness={0.35}
            metalness={0.0}
            side={THREE.BackSide}
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </mesh>

        {/* 2B. GELEMBUNG UDARA / MENISKUS */}
        {item.bubblePreset === "serenity" ? (
          <>
            <mesh
              geometry={geoms.bubbleSerenityBig}
              position={[0.43, 1.03, 0.06]}
              rotation={[0, 0, -0.08]}
              renderOrder={2}
            >
              <meshStandardMaterial
                color={item.bubbleRimColor}
                roughness={0.25}
                metalness={0.0}
                transparent
                opacity={0.38}
                depthWrite={false}
              />
            </mesh>
            <mesh
              geometry={geoms.bubbleSerenitySmall}
              position={[-0.58, 1.09, 0.08]}
              renderOrder={2}
            >
              <meshStandardMaterial
                color={item.bubbleRimColor}
                roughness={0.25}
                metalness={0.0}
                transparent
                opacity={0.4}
                depthWrite={false}
              />
            </mesh>
          </>
        ) : (
          <mesh
            geometry={geoms.meniscusDefault}
            position={[0.0, 1.09, 0.02]}
            renderOrder={2}
          >
            <meshStandardMaterial
              color={item.bubbleRimColor}
              roughness={0.3}
              metalness={0.0}
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* 3. DINDING KACA LUAR 50ML (KACA BENING DICELUP WARNA — RINGAN & TIDAK METALIK) */}
        <mesh geometry={geoms.outerBottle} renderOrder={3}>
          <meshStandardMaterial
            customProgramCacheKey={() => "alparfume-dipped-glass-shared-v1"}
            onBeforeCompile={handleOuterGlassBeforeCompile}
            color={item.innerCavityColor}
            emissive={item.outerGlassColor}
            emissiveIntensity={1.0}
            roughness={0.22}
            metalness={0.0}
            transparent
            opacity={0.5}
            depthWrite={false}
          />

          {showDecal && item.decalUrl && (
            <Suspense fallback={null}>
              <BottleDecalOverlay decalUrl={item.decalUrl} />
            </Suspense>
          )}
        </mesh>

        {/* Kaki sudut botol kaca di kiri bawah & kanan bawah */}
        <mesh
          geometry={geoms.footBlock}
          position={[-0.84, -1.365, 0]}
          renderOrder={3}
        >
          <meshStandardMaterial
            color={item.outerGlassColor}
            roughness={0.28}
            metalness={0.0}
            transparent
            opacity={0.62}
            depthWrite={false}
          />
        </mesh>
        <mesh
          geometry={geoms.footBlock}
          position={[0.84, -1.365, 0]}
          renderOrder={3}
        >
          <meshStandardMaterial
            color={item.outerGlassColor}
            roughness={0.28}
            metalness={0.0}
            transparent
            opacity={0.62}
            depthWrite={false}
          />
        </mesh>

        {/* 4. LEHER & TUTUP BOTOL HITAM PEKAT (JET BLACK) */}
        <mesh geometry={geoms.neckRing} position={[0, 1.39, 0]}>
          <meshStandardMaterial
            color="#040404"
            roughness={0.38}
            metalness={0.0}
          />
        </mesh>

        <mesh geometry={geoms.capCollar} position={[0, 1.505, 0]}>
          <meshStandardMaterial
            color="#050505"
            roughness={0.32}
            metalness={0.0}
          />
        </mesh>

        <mesh geometry={geoms.capBody} position={[0, 2.09, 0]}>
          <meshStandardMaterial
            color="#050505"
            roughness={0.28}
            metalness={0.0}
          />
        </mesh>

        {/* 5. SABLON TIPOGRAFI PUTIH DI PERMUKAAN DEPAN KACA */}
        {!showDecal && (
          <group position={[0, 0, 0.532]} renderOrder={4}>
            <Ring
              args={[0.225, 0.262, 32, 1, Math.PI * 0.2, Math.PI * 0.6]}
              position={[0, 0.73, 0]}
              scale={[1.2, 0.72, 1]}
              renderOrder={4}
            >
              <meshBasicMaterial
                color={item.labelColor}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </Ring>

            <Suspense fallback={null}>
              <Text
                position={[0, 0.75, 0]}
                fontSize={0.126}
                color={item.labelColor}
                font="/fonts/Montserrat-ExtraBoldItalic.ttf"
                letterSpacing={0.06}
                anchorX="center"
                anchorY="middle"
                renderOrder={4}
              >
                {item.brandTitle}
              </Text>

              {resolvedLabelLines.map((line, lineIdx) => (
                <Text
                  key={`${item.id}-line-${lineIdx}`}
                  position={[line.x, line.y, 0]}
                  fontSize={line.fontSize}
                  color={item.labelColor}
                  font={line.font || "/fonts/CormorantGaramond-Bold.ttf"}
                  letterSpacing={line.letterSpacing ?? 0.02}
                  anchorX="center"
                  anchorY="middle"
                  renderOrder={4}
                >
                  {line.text}
                </Text>
              ))}
            </Suspense>
          </group>
        )}
      </Float>
    </group>
  );
}

// ============================================================================
// SCENE CONTROLLER (FREE-FLOWING FLEXIBLE SCROLL, NO SNAPPING)
// ============================================================================

interface CarouselSceneProps {
  items: Perfume3DItemConfig[];
  scrollTargetRef: React.MutableRefObject<number>;
  scrollCurrentRef: React.MutableRefObject<number>;
  scrollVelocityRef: React.MutableRefObject<number>;
  inertiaVelocityRef: React.MutableRefObject<number>;
  isDraggingRef: React.MutableRefObject<boolean>;
  globalUseDecal: boolean;
}

function PerfumeCarouselScene({
  items,
  scrollTargetRef,
  scrollCurrentRef,
  scrollVelocityRef,
  inertiaVelocityRef,
  isDraggingRef,
  globalUseDecal,
}: CarouselSceneProps) {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const maxIndex = Math.max(0, items.length - 1);

    if (
      !isDraggingRef.current &&
      Math.abs(inertiaVelocityRef.current) > 0.0005
    ) {
      scrollTargetRef.current = THREE.MathUtils.clamp(
        scrollTargetRef.current + inertiaVelocityRef.current * dt * 60,
        -0.15,
        maxIndex + 0.15
      );
      inertiaVelocityRef.current *= Math.pow(0.92, dt * 60);

      if (scrollTargetRef.current < 0) {
        scrollTargetRef.current = THREE.MathUtils.lerp(
          scrollTargetRef.current,
          0,
          1 - Math.exp(-10 * dt)
        );
        inertiaVelocityRef.current *= 0.5;
      } else if (scrollTargetRef.current > maxIndex) {
        scrollTargetRef.current = THREE.MathUtils.lerp(
          scrollTargetRef.current,
          maxIndex,
          1 - Math.exp(-10 * dt)
        );
        inertiaVelocityRef.current *= 0.5;
      }
    } else if (!isDraggingRef.current) {
      inertiaVelocityRef.current = 0;
      if (scrollTargetRef.current < 0) {
        scrollTargetRef.current = THREE.MathUtils.lerp(
          scrollTargetRef.current,
          0,
          1 - Math.exp(-8 * dt)
        );
      } else if (scrollTargetRef.current > maxIndex) {
        scrollTargetRef.current = THREE.MathUtils.lerp(
          scrollTargetRef.current,
          maxIndex,
          1 - Math.exp(-8 * dt)
        );
      }
    }

    const lerpSpeed = 1 - Math.exp(-9.0 * dt);
    const prev = scrollCurrentRef.current;
    const next = THREE.MathUtils.lerp(
      prev,
      scrollTargetRef.current,
      lerpSpeed
    );
    scrollCurrentRef.current = next;

    const rawVelocity = (next - prev) / Math.max(dt, 0.008);
    scrollVelocityRef.current = THREE.MathUtils.lerp(
      scrollVelocityRef.current,
      THREE.MathUtils.clamp(rawVelocity, -3.5, 3.5),
      0.22
    );
  });

  return (
    <>
      <ambientLight intensity={1.0} />
      <directionalLight position={[3.2, 4.8, 5.2]} intensity={0.85} />
      <directionalLight position={[-3.2, 2.8, 4.0]} intensity={0.55} />
      <pointLight position={[0, 0.25, -3.6]} intensity={1.35} color="#ffffff" />

      <group position={[0, -0.34, 0]}>
        {items.map((item, idx) => (
          <ProceduralPerfumeBottle
            key={item.id}
            item={item}
            index={idx}
            scrollCurrentRef={scrollCurrentRef}
            scrollVelocityRef={scrollVelocityRef}
            globalUseDecal={globalUseDecal}
          />
        ))}
      </group>
    </>
  );
}

// ============================================================================
// MAIN SHOWCASE COMPONENT (ALL 5 EAU DE PARFUM PRODUCTS, ULTRA LIGHTWEIGHT)
// ============================================================================

export default function Perfume3DShowcase({
  products = [],
  merryKiss,
  guavin,
  elysianVanilla,
  pinkRomance,
  serenity,
  useDecal = false,
  items: customItems,
}: Perfume3DShowcaseProps) {
  const [canRenderWebGL, setCanRenderWebGL] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef(0);
  const scrollCurrentRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const inertiaVelocityRef = useRef(0);
  const isDraggingRef = useRef(false);

  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    startTarget: number;
    axisLocked: "horizontal" | "vertical" | null;
  } | null>(null);

  const showcaseItems: Perfume3DItemConfig[] = useMemo(() => {
    if (customItems && customItems.length > 0) return customItems;

    const findBySlug = (slugs: string[]) =>
      products.find((p) => slugs.includes(p.slug.toLowerCase()));

    const merryProduct =
      merryKiss ??
      findBySlug(["merry-kiss-eau-de-parfum", "merry-kiss-edp"]);
    const guavinProduct =
      guavin ??
      findBySlug([
        "guavin-eau-de-parfume",
        "guavin-eau-de-parfum",
        "guavin-edp",
      ]);
    const elysianProduct =
      elysianVanilla ??
      findBySlug(["elysian-vanilla", "elysian-vanilla-eau-de-parfum"]);
    const pinkProduct =
      pinkRomance ??
      findBySlug(["pink-romance-eau-de-parfum", "pink-romance-edp"]);
    const serenityProduct =
      serenity ??
      findBySlug(["serenity-eau-de-parfum", "serenity-edp"]);

    return [
      // 1. MERRY KISS
      {
        id: "merry-kiss-edp-3d",
        slug: merryProduct?.slug || "merry-kiss-eau-de-parfum",
        displayName: "Merry Kiss",
        brandTitle: "ALPARFUME",
        mainTitleTop: "Merry",
        subtitleMiddle: "Eau de Parfum",
        mainTitleBottom: "Kiss",
        labelLines: [
          {
            text: "Merry",
            x: 0,
            y: -0.08,
            fontSize: 0.4,
            letterSpacing: 0.02,
          },
          {
            text: "Eau de Parfum",
            x: 0,
            y: -0.34,
            fontSize: 0.118,
            letterSpacing: 0.03,
          },
          {
            text: "Kiss",
            x: 0,
            y: -0.59,
            fontSize: 0.4,
            letterSpacing: 0.04,
          },
        ],
        volumeLabel: "50 ml",
        tagline:
          "Perpaduan manis elegan plum, peony, red lily, dan warm amber musk dalam botol kaca bening celup berry magenta.",
        scentNotes: parseProductNotes(merryProduct?.notes, [
          "Plum",
          "Peach",
          "Peony",
          "Jasmine",
          "Red Lily",
          "White Musk",
        ]),
        outerGlassColor: "#981f6e",
        innerCavityColor: "#d12d9c",
        innerGlowColor: "#f268c4",
        bubbleRimColor: "#ffb5e6",
        uiAccentColor: "#b82587",
        neckColor: "#050505",
        capColor: "#050505",
        labelColor: "#ffffff",
        shadowColor: "#4a0f35",
        decalUrl: "/models/merry-kiss-edp-front.webp",
        useDecal: false,
        productData: merryProduct,
        fallbackPrice: 89000,
        fallbackImage:
          "https://pcpokqyahsheljmeaibh.supabase.co/storage/v1/object/public/product-images/products/merry-kiss-eau-de-parfum-1789298852594-0.jpg",
      },

      // 2. GUAVIN
      {
        id: "guavin-edp-3d",
        slug: guavinProduct?.slug || "guavin-eau-de-parfume",
        displayName: "Guavin",
        brandTitle: "ALPARFUME",
        mainTitleTop: "Guavin",
        subtitleMiddle: "Eau de Parfum",
        labelLines: [
          {
            text: "Guavin",
            x: 0.2,
            y: -0.22,
            fontSize: 0.39,
            letterSpacing: 0.02,
          },
          {
            text: "Eau de Parfum",
            x: 0.2,
            y: -0.45,
            fontSize: 0.118,
            letterSpacing: 0.03,
          },
        ],
        volumeLabel: "50 ml",
        tagline:
          "Kesegaran mint, lemon Italia, dan apel hijau berpadu dengan tonka bean serta vanilla Madagaskar dalam botol kaca bening celup biru turquoise.",
        scentNotes: parseProductNotes(guavinProduct?.notes, [
          "Mint",
          "Lemon Italia",
          "Apel Hijau",
          "Tonka Bean",
          "Ambroxan",
          "Vanilla Madagaskar",
        ]),
        outerGlassColor: "#008da0",
        innerCavityColor: "#04bfd1",
        innerGlowColor: "#4ce6f5",
        bubbleRimColor: "#b8f9ff",
        uiAccentColor: "#0099ad",
        neckColor: "#050505",
        capColor: "#050505",
        labelColor: "#ffffff",
        shadowColor: "#00444f",
        useDecal: false,
        productData: guavinProduct,
        fallbackPrice: 89000,
        fallbackImage:
          "https://pcpokqyahsheljmeaibh.supabase.co/storage/v1/object/public/product-images/products/guavin-eau-de-parfume-1789304594304-0.jpg",
      },

      // 3. ELYSIAN VANILLA
      {
        id: "elysian-vanilla-edp-3d",
        slug: elysianProduct?.slug || "elysian-vanilla",
        displayName: "Elysian Vanilla",
        brandTitle: "ALPARFUME",
        mainTitleTop: "Elysian",
        subtitleMiddle: "Eau de Parfum",
        mainTitleBottom: "Vanilla",
        labelLines: [
          {
            text: "Elysian",
            x: -0.25,
            y: -0.11,
            fontSize: 0.37,
            letterSpacing: 0.015,
          },
          {
            text: "Eau de Parfum",
            x: 0.03,
            y: -0.32,
            fontSize: 0.114,
            letterSpacing: 0.025,
          },
          {
            text: "Vanilla",
            x: 0.26,
            y: -0.51,
            fontSize: 0.37,
            letterSpacing: 0.015,
          },
        ],
        volumeLabel: "50 ml",
        tagline:
          "Kehangatan vanilla bean premium, vanilla orchid, jasmine, dan sentuhan bergamot segar dalam botol kaca bening celup warna amber keemasan.",
        scentNotes: parseProductNotes(elysianProduct?.notes, [
          "Bergamot",
          "Lemon",
          "Vanilla Orchid",
          "Jasmine",
          "Vanilla Bean",
          "Warm Musk",
        ]),
        outerGlassColor: "#874012",
        innerCavityColor: "#c46016",
        innerGlowColor: "#eb8834",
        bubbleRimColor: "#ffd29e",
        uiAccentColor: "#a85015",
        neckColor: "#050505",
        capColor: "#050505",
        labelColor: "#ffffff",
        shadowColor: "#472007",
        useDecal: false,
        productData: elysianProduct,
        fallbackPrice: 89000,
        fallbackImage:
          "https://pcpokqyahsheljmeaibh.supabase.co/storage/v1/object/public/product-images/products/elysian-vanilla-1789298657570-0.jpg",
      },

      // 4. PINK ROMANCE
      {
        id: "pink-romance-edp-3d",
        slug: pinkProduct?.slug || "pink-romance-eau-de-parfum",
        displayName: "Pink Romance",
        brandTitle: "ALPARFUME",
        mainTitleTop: "Pink",
        subtitleMiddle: "Eau de Parfum",
        mainTitleBottom: "Romance",
        labelLines: [
          {
            text: "Pink",
            x: -0.34,
            y: -0.12,
            fontSize: 0.39,
            letterSpacing: 0.02,
          },
          {
            text: "Romance",
            x: -0.07,
            y: -0.38,
            fontSize: 0.33,
            letterSpacing: 0.015,
            font: "/fonts/CormorantGaramond-SemiBold.ttf",
          },
          {
            text: "Eau de Parfum",
            x: 0.32,
            y: -0.57,
            fontSize: 0.114,
            letterSpacing: 0.025,
          },
        ],
        volumeLabel: "50 ml",
        tagline:
          "Kelembutan pear, peach, apple blossom, dan tiare flower yang romantis berpadu dengan vanilla sandalwood dalam botol kaca bening celup blush pink.",
        scentNotes: parseProductNotes(pinkProduct?.notes, [
          "Pear",
          "Peach",
          "Apple Blossom",
          "Jasmine",
          "Vanilla",
          "Sandalwood",
        ]),
        outerGlassColor: "#cc7877",
        innerCavityColor: "#efa3a1",
        innerGlowColor: "#ffc4c2",
        bubbleRimColor: "#fff0ef",
        uiAccentColor: "#d17574",
        neckColor: "#050505",
        capColor: "#050505",
        labelColor: "#ffffff",
        shadowColor: "#6e3d3c",
        useDecal: false,
        productData: pinkProduct,
        fallbackPrice: 89000,
        fallbackImage:
          "https://pcpokqyahsheljmeaibh.supabase.co/storage/v1/object/public/product-images/products/pink-romance-eau-de-parfum-1789298776712-0.jpg",
      },

      // 5. SERENITY
      {
        id: "serenity-edp-3d",
        slug: serenityProduct?.slug || "serenity-eau-de-parfum",
        displayName: "Serenity",
        brandTitle: "ALPARFUME",
        mainTitleTop: "Serenity",
        subtitleMiddle: "Eau de Parfum",
        labelLines: [
          {
            text: "SERE",
            x: -0.29,
            y: -0.17,
            fontSize: 0.34,
            letterSpacing: 0.045,
            font: "/fonts/CormorantGaramond-SemiBold.ttf",
          },
          {
            text: "NITY",
            x: -0.29,
            y: -0.51,
            fontSize: 0.34,
            letterSpacing: 0.045,
            font: "/fonts/CormorantGaramond-SemiBold.ttf",
          },
          {
            text: "Eau de Parfum",
            x: 0.41,
            y: -0.34,
            fontSize: 0.11,
            letterSpacing: 0.025,
          },
        ],
        volumeLabel: "50 ml",
        tagline:
          "Karakter maskulin & menenangkan dari bergamot, mandarin, rempah hangat, vetiver, dan kayu cedar dalam botol kaca bening celup smoky grey.",
        scentNotes: parseProductNotes(serenityProduct?.notes, [
          "Lemon",
          "Mandarin",
          "Bergamot",
          "Spices",
          "Vetiver",
          "Kayu Cedar",
        ]),
        outerGlassColor: "#5e5d59",
        innerCavityColor: "#94938e",
        innerGlowColor: "#b8b7b2",
        bubbleRimColor: "#ecebe6",
        uiAccentColor: "#575652",
        bubblePreset: "serenity",
        neckColor: "#050505",
        capColor: "#050505",
        labelColor: "#ffffff",
        shadowColor: "#333330",
        useDecal: false,
        productData: serenityProduct,
        fallbackPrice: 89000,
        fallbackImage:
          "https://pcpokqyahsheljmeaibh.supabase.co/storage/v1/object/public/product-images/products/serenity-eau-de-parfum-1789458014323-0.jpg",
      },
    ];
  }, [
    customItems,
    products,
    merryKiss,
    guavin,
    elysianVanilla,
    pinkRomance,
    serenity,
  ]);

  useEffect(() => {
    setCanRenderWebGL(checkWebGLSupport());
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const isHorizontalSwipe = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.1;

      if (isHorizontalSwipe) {
        e.preventDefault();
        const maxIndex = Math.max(0, showcaseItems.length - 1);
        const stepDelta = THREE.MathUtils.clamp(e.deltaX * 0.0022, -0.5, 0.5);
        scrollTargetRef.current = THREE.MathUtils.clamp(
          scrollTargetRef.current + stepDelta,
          -0.2,
          maxIndex + 0.2
        );
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [showcaseItems.length]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    inertiaVelocityRef.current = 0;

    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastTime: performance.now(),
      startTarget: scrollTargetRef.current,
      axisLocked: null,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const totalDx = e.clientX - drag.startX;
    const totalDy = e.clientY - drag.startY;

    if (!drag.axisLocked) {
      if (Math.abs(totalDx) < 6 && Math.abs(totalDy) < 6) return;
      if (Math.abs(totalDx) > Math.abs(totalDy) * 1.05) {
        drag.axisLocked = "horizontal";
        isDraggingRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      } else {
        drag.axisLocked = "vertical";
        dragStateRef.current = null;
        isDraggingRef.current = false;
        return;
      }
    }

    if (drag.axisLocked !== "horizontal") return;

    const now = performance.now();
    const dtMs = Math.max(1, now - drag.lastTime);
    const stepDx = e.clientX - drag.lastX;

    const stageWidth = stageRef.current?.clientWidth || 380;
    const sensitivity = Math.max(220, stageWidth * 0.45);
    const dragProgress = -(totalDx / sensitivity);
    const maxIndex = Math.max(0, showcaseItems.length - 1);

    scrollTargetRef.current = THREE.MathUtils.clamp(
      drag.startTarget + dragProgress,
      -0.25,
      maxIndex + 0.25
    );

    const instantVel = -(stepDx / sensitivity) / (dtMs / 16.67);
    inertiaVelocityRef.current = THREE.MathUtils.lerp(
      inertiaVelocityRef.current,
      THREE.MathUtils.clamp(instantVel, -0.18, 0.18),
      0.45
    );

    drag.lastX = e.clientX;
    drag.lastTime = now;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.axisLocked === "horizontal") {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    }

    dragStateRef.current = null;
    isDraggingRef.current = false;
  };

  const fallbackView = (
    <div className="flex h-full w-full items-center justify-center overflow-x-auto gap-6 px-6">
      {showcaseItems.map((item) => (
        <div
          key={item.id}
          className="flex flex-col items-center shrink-0 select-none"
        >
          <img
            src={item.fallbackImage}
            alt={item.displayName || item.mainTitleTop}
            className="h-64 w-64 rounded-2xl object-cover shadow-sm"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );

  return (
    <section
      id="parfum-3d-showcase"
      aria-label="Galeri Botol 3D Eau de Parfum"
      className="relative w-full overflow-hidden bg-brandWhite pt-6 pb-10 sm:pt-10 sm:pb-16 md:pt-12 md:pb-20 select-none"
    >
      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative z-10 h-[480px] sm:h-[560px] md:h-[620px] w-full cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {canRenderWebGL ? (
          <WebGLErrorBoundary fallback={fallbackView}>
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [0, 0.08, 7.4], fov: 35 }}
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: "default",
                stencil: false,
                depth: true,
              }}
              onCreated={({ gl }) => {
                // Cegah Chrome memblokir domain jika terjadi context loss sementara
                const canvasEl = gl.domElement;
                const handleContextLost = (event: Event) => {
                  event.preventDefault();
                };
                canvasEl.addEventListener(
                  "webglcontextlost",
                  handleContextLost,
                  false
                );
              }}
            >
              <PerfumeCarouselScene
                items={showcaseItems}
                scrollTargetRef={scrollTargetRef}
                scrollCurrentRef={scrollCurrentRef}
                scrollVelocityRef={scrollVelocityRef}
                inertiaVelocityRef={inertiaVelocityRef}
                isDraggingRef={isDraggingRef}
                globalUseDecal={useDecal}
              />
            </Canvas>
          </WebGLErrorBoundary>
        ) : (
          fallbackView
        )}
      </div>
    </section>
  );
}
