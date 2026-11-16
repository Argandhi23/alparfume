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
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
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
  liquidSurfaceDisc: THREE.BufferGeometry;
  dipTube: THREE.BufferGeometry;
  valveHousing: THREE.BufferGeometry;
  valveCollar: THREE.BufferGeometry;
  neckRing: THREE.BufferGeometry;
  capCollar: THREE.BufferGeometry;
  capBody: THREE.BufferGeometry;
  footBlock: THREE.BufferGeometry;
  shadowPlane: THREE.BufferGeometry;
}

let cachedGeometries: SharedBottleGeometries | null = null;

function getSharedBottleGeometries(): SharedBottleGeometries {
  if (cachedGeometries) return cachedGeometries;

  // 1. Rongga dalam berlekuk (16x22x8 segmen untuk lekukan dinding & permukaan cairan halus)
  const innerCavity = new THREE.BoxGeometry(1.62, 2.12, 0.68, 16, 22, 8);
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

  // 2. Kepingan 3D Permukaan Atas Cairan (Meniskus 80%) yang dapat miring & beriak
  const liquidSurfaceDisc = new THREE.BoxGeometry(1.47, 0.032, 0.58, 22, 1, 8);
  const surfPos = liquidSurfaceDisc.attributes.position;
  const sv = new THREE.Vector3();
  for (let i = 0; i < surfPos.count; i++) {
    sv.fromBufferAttribute(surfPos, i);
    const snx = sv.x / 0.735;
    const snz = sv.z / 0.29;
    // Membulatkan sudut horizontal kepingan cairan mengikuti penampang dalam botol pada tinggi 80%
    const cornerRound =
      1.0 - 0.065 * Math.pow(snx * snx, 2) * Math.pow(snz * snz, 2);
    sv.x *= cornerRound;
    sv.z *= cornerRound;
    // Lengkungan meniskus kapiler di pinggir dinding kaca
    const edgeProx = Math.min(
      1.0,
      Math.sqrt(snx * snx * 0.85 + snz * snz * 0.45)
    );
    sv.y += 0.022 * Math.pow(edgeProx, 2.8);
    surfPos.setXYZ(i, sv.x, sv.y, sv.z);
  }
  liquidSurfaceDisc.computeVertexNormals();

  // 3. Selang semprotan melengkung realistis (dip tube) menuju sudut bawah botol
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.32, 0),
    new THREE.Vector3(0.015, 0.76, 0.01),
    new THREE.Vector3(0.065, 0.12, 0.015),
    new THREE.Vector3(0.19, -0.48, 0.01),
    new THREE.Vector3(0.41, -0.94, 0),
  ]);
  const dipTube = new THREE.TubeGeometry(curve, 20, 0.021, 10, false);

  // 4. Geometri botol luar & komponen tutup (shared)
  const outerBottle = new RoundedBoxGeometry(2.04, 2.72, 1.04, 4, 0.072);
  const valveHousing = new THREE.CylinderGeometry(0.145, 0.095, 0.22, 18);
  const valveCollar = new THREE.CylinderGeometry(0.22, 0.21, 0.09, 18);
  const neckRing = new THREE.CylinderGeometry(0.515, 0.515, 0.08, 28);
  const capCollar = new THREE.CylinderGeometry(0.532, 0.528, 0.17, 28);
  const capBody = new THREE.CylinderGeometry(0.542, 0.545, 0.98, 28);
  const footBlock = new RoundedBoxGeometry(0.24, 0.04, 0.76, 2, 0.015);
  const shadowPlane = new THREE.PlaneGeometry(3.2, 1.8);

  cachedGeometries = {
    outerBottle,
    innerCavity,
    liquidSurfaceDisc,
    dipTube,
    valveHousing,
    valveCollar,
    neckRing,
    capCollar,
    capBody,
    footBlock,
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
    grad.addColorStop(0, "rgba(0, 0, 0, 0.30)");
    grad.addColorStop(0.5, "rgba(0, 0, 0, 0.12)");
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
// PROCEDURAL 3D PERFUME BOTTLE (CRYSTAL CLEAR GLASS + 80% SLOSHING LIQUID)
// ============================================================================

interface ProceduralBottleProps {
  item: Perfume3DItemConfig;
  index: number;
  totalItems: number;
  scrollCurrentRef: React.MutableRefObject<number>;
  scrollVelocityRef: React.MutableRefObject<number>;
  maxDragDistRef: React.MutableRefObject<number>;
  globalUseDecal: boolean;
  onSelectBottle: (item: Perfume3DItemConfig, index: number) => void;
}

// Tinggi permukaan cairan 80% dalam ruang normalisasi botol [-0.745 s/d +0.845]
const LIQUID_FILL_NY = 0.5;
// Posisi Y kepingan meniskus dalam koordinat lokal botol
const LIQUID_SURFACE_Y = 0.68;

function ProceduralPerfumeBottle({
  item,
  index,
  totalItems,
  scrollCurrentRef,
  scrollVelocityRef,
  maxDragDistRef,
  globalUseDecal,
  onSelectBottle,
}: ProceduralBottleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const liquidSurfaceRef = useRef<THREE.Mesh>(null);
  const prevOffsetRef = useRef<number | null>(null);
  const prevVelocityRef = useRef<number>(0);

  // State fisika sloshing cairan per botol (pegas teredam)
  const sloshStateRef = useRef({
    angle: 0,
    angularVel: 0,
    waveAmp: 0,
    phase: index * 1.57,
  });

  // Uniforms shader yang di-update setiap frame untuk efek air bergoyang
  const sloshUniforms = useMemo(
    () => ({
      uSloshTilt: { value: 0 },
      uSloshWave: { value: 0 },
      uSloshPhase: { value: index * 1.57 },
    }),
    [index]
  );

  const { viewport } = useThree();
  const geoms = useMemo(() => getSharedBottleGeometries(), []);
  const shadowTex = useMemo(() => getSoftShadowTexture(), []);

  // 1. SHADER RONGGA CAIRAN DALAM (WARNA AWAL JELAS + 80% CAIRAN BERGOYANG)
  const handleInnerCavityBeforeCompile = useCallback(
    (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSloshTilt = sloshUniforms.uSloshTilt;
      shader.uniforms.uSloshWave = sloshUniforms.uSloshWave;
      shader.uniforms.uSloshPhase = sloshUniforms.uSloshPhase;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        varying vec3 vCavityLocalPos;
        varying vec3 vCavityNormal;
        varying vec3 vCavityViewDir;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vCavityLocalPos = position;
        vec4 wsPos = modelMatrix * vec4(position, 1.0);
        vCavityViewDir = normalize(cameraPosition - wsPos.xyz);
        vCavityNormal = normalize(mat3(modelMatrix) * normal);`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        uniform float uSloshTilt;
        uniform float uSloshWave;
        uniform float uSloshPhase;
        varying vec3 vCavityLocalPos;
        varying vec3 vCavityNormal;
        varying vec3 vCavityViewDir;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `
        float nx = vCavityLocalPos.x / 0.81;
        float ny = (vCavityLocalPos.y + 0.05) / 1.36;
        float nz = vCavityLocalPos.z / 0.34;

        // Tinggi permukaan cairan 80% + kemiringan geser + gelombang air + meniskus kapiler
        float wave1 = sin(nx * 3.8 + uSloshPhase) * uSloshWave;
        float wave2 = cos(nx * 6.4 - uSloshPhase * 1.35 + nz * 1.8) * (uSloshWave * 0.4);
        float wallProx = smoothstep(0.35, 0.92, abs(nx));
        float capillary = 0.028 * wallProx * wallProx;
        float surfNy = ${LIQUID_FILL_NY.toFixed(3)} + nx * uSloshTilt + wave1 + wave2 + capillary;

        float isLiquid = 1.0 - smoothstep(-0.015, 0.015, ny - surfNy);
        float meniscusBand = exp(-pow((ny - surfNy) / 0.022, 2.0));

        float ndotv = clamp(abs(dot(normalize(vCavityNormal), normalize(vCavityViewDir))), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, 2.5);

        // Warna cairan sesuai warna asli produk (jelas & hidup)
        float depthGrad = smoothstep(surfNy, -0.74, ny);
        vec3 liquidCol = mix(diffuse, emissive, 0.28 * (1.0 - depthGrad));
        vec3 upperGlassCol = mix(diffuse, emissive, 0.55);
        vec3 meniscusCol = mix(emissive, vec3(1.0), 0.65);

        vec3 combinedColor = mix(upperGlassCol, liquidCol, isLiquid);
        combinedColor = mix(combinedColor, meniscusCol, clamp(meniscusBand * 0.9, 0.0, 0.92));

        float liquidAlpha = (0.30 + 0.10 * depthGrad + 0.12 * fresnel) * isLiquid;
        float upperAlpha = (0.16 + 0.08 * fresnel) * (1.0 - isLiquid);
        float finalAlpha = clamp(liquidAlpha + upperAlpha + meniscusBand * 0.42, 0.16, 0.68);

        gl_FragColor = vec4(combinedColor, finalAlpha);
        #include <dithering_fragment>
        `
      );
    },
    [sloshUniforms]
  );

  // 2. SHADER KACA LUAR (WARNA AWAL JELAS & TAJAM + EFEK BENING KACA + GARIS AIR 80%)
  const handleOuterGlassBeforeCompile = useCallback(
    (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSloshTilt = sloshUniforms.uSloshTilt;
      shader.uniforms.uSloshWave = sloshUniforms.uSloshWave;
      shader.uniforms.uSloshPhase = sloshUniforms.uSloshPhase;

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
        uniform float uSloshTilt;
        uniform float uSloshWave;
        uniform float uSloshPhase;
        varying vec3 vGlassLocalPos;
        varying vec3 vGlassViewDir;
        varying vec3 vGlassWorldNormal;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `
        vec3 uInnerLiquidColor = diffuse;
        vec3 uOuterWallColor = emissive;
        vec3 uInnerGlowColor = mix(diffuse, vec3(1.0), 0.30);
        vec3 uRimColor = mix(diffuse, vec3(1.0), 0.60);

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

        float innerRimBand = exp(-pow((cavitySignedDist + 0.006) / 0.036, 2.0));
        innerRimBand *= (1.0 - 0.6 * smoothstep(0.75, 0.92, ny) * (1.0 - smoothstep(0.0, 0.45, abs(nx))));

        float bottomCushion = exp(-pow((ny + 0.825) / 0.048, 2.0)) * smoothstep(0.92, 0.45, abs(nx));

        // Permukaan cairan 80% yang ikut miring & bergelombang saat digeser
        float cavityNx = clamp(nx / 0.80, -1.0, 1.0);
        float wave1 = sin(cavityNx * 3.8 + uSloshPhase) * uSloshWave;
        float wave2 = cos(cavityNx * 6.4 - uSloshPhase * 1.35) * (uSloshWave * 0.4);
        float wallProx = smoothstep(0.35, 0.92, abs(cavityNx));
        float surfNy = ${LIQUID_FILL_NY.toFixed(3)} + cavityNx * uSloshTilt + wave1 + wave2 + 0.028 * wallProx * wallProx;

        float belowLiquid = (1.0 - smoothstep(-0.02, 0.02, ny - surfNy)) * inCavity;
        float meniscusLine = exp(-pow((ny - surfNy) / 0.016, 2.0)) * inCavity;

        vec3 N = normalize(vGlassWorldNormal);
        vec3 V = normalize(vGlassViewDir);
        float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, 3.4);

        // Kilau kaca vertikal halus di tepi bevel kiri & kanan
        float bevelGlintLeft = exp(-pow((nx + 0.84 + N.x * 0.1) / 0.05, 2.0)) * smoothstep(-0.88, 0.88, ny);
        float bevelGlintRight = exp(-pow((nx - 0.80 + N.x * 0.1) / 0.065, 2.0)) * smoothstep(-0.85, 0.85, ny);
        float studioGlint = bevelGlintLeft * 0.22 + bevelGlintRight * 0.14;

        float centerRadial = length(vec2(nx * 0.85, (ny - 0.05) * 0.72));
        float centerTranslucency = clamp(1.0 - centerRadial * 0.78, 0.0, 1.0) * inCavity;

        // Warna awal kaca celup yang jelas & kaya, namun lebih bening di ruang udara 20% atas
        vec3 centerGlassTint = mix(uInnerLiquidColor, uInnerGlowColor, 0.38);
        centerGlassTint = mix(centerGlassTint, vec3(1.0), 0.14 * centerTranslucency);
        vec3 headspaceGlassTint = mix(centerGlassTint, uInnerGlowColor, 0.26);
        vec3 activeCavityTint = mix(headspaceGlassTint, centerGlassTint, belowLiquid);

        vec3 wallGlassTint = mix(uOuterWallColor, uInnerLiquidColor, 0.30);
        vec3 dippedColor = mix(wallGlassTint, activeCavityTint, inCavity);

        vec3 rimHighlightCol = mix(uRimColor, vec3(1.0), 0.28);
        vec3 finalRgb = mix(dippedColor, rimHighlightCol, clamp(innerRimBand * 0.48, 0.0, 0.58));
        finalRgb = mix(finalRgb, rimHighlightCol, clamp(bottomCushion * 0.36, 0.0, 0.48));
        finalRgb = mix(finalRgb, mix(uRimColor, vec3(1.0), 0.55), clamp(meniscusLine * 0.52, 0.0, 0.55));
        finalRgb += vec3(1.0) * (fresnel * 0.15 + studioGlint);

        // Alpha menjaga warna tetap tegas & jelas seperti semula namun tetap transparan bening
        float cavityBaseAlpha = mix(0.32, 0.44, belowLiquid);
        float baseAlpha = mix(0.68, cavityBaseAlpha, inCavity);
        baseAlpha = mix(baseAlpha, 0.34, centerTranslucency * 0.52 * belowLiquid);
        baseAlpha = clamp(
          baseAlpha + innerRimBand * 0.14 + meniscusLine * 0.16 + fresnel * 0.15 + studioGlint * 0.18,
          0.30,
          0.84
        );

        gl_FragColor = vec4(finalRgb, baseAlpha);
        #include <dithering_fragment>
        `
      );
    },
    [sloshUniforms]
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const dt = Math.min(delta, 0.05);
    const lerpFactor = 1 - Math.exp(-8.5 * dt);

    // ========================================================================
    // 1. INFINITE LOOP WRAPPING (TANPA UJUNG KIRI MAUPUN KANAN)
    // ========================================================================
    const N = Math.max(1, totalItems);
    let offset = (((index - scrollCurrentRef.current) % N) + N) % N;
    if (offset > N * 0.5) {
      offset -= N;
    }

    const prevOffset = prevOffsetRef.current;
    const didWrapJump =
      prevOffset === null || Math.abs(offset - prevOffset) > N * 0.4;
    prevOffsetRef.current = offset;

    const absOffset = Math.abs(offset);
    const velocity = scrollVelocityRef.current;

    // Sembunyikan botol tepat di titik sambungan belakang layar (±2.4) agar transisi mulus
    group.visible = absOffset < 2.38;

    // 2. JARAK ANTAR BOTOL LEGA DI MOBILE MAUPUN DESKTOP
    const isMobileViewport = viewport.width < 4.8;
    const xSpacing = isMobileViewport
      ? Math.max(3.35, viewport.width * 0.82)
      : Math.min(3.9, Math.max(3.0, viewport.width * 0.44));

    const targetX = offset * xSpacing;
    const targetY = -Math.pow(offset, 2) * 0.22 + offset * -0.05;
    const targetZ =
      -Math.pow(absOffset, 1.2) * (isMobileViewport ? 1.65 : 1.42);

    // 3. DYNAMIC ROTATION & TILT
    const targetRotationY = offset * -0.75 + velocity * -0.38;
    const targetRotationZ =
      THREE.MathUtils.clamp(-offset * 0.16, -0.24, 0.24) + velocity * -0.05;
    const targetRotationX =
      Math.min(0.08, absOffset * 0.03) + Math.abs(velocity) * 0.02;

    // 4. DYNAMIC SCALE
    const centerScale = isMobileViewport ? 0.92 : 1.02;
    const sideScale = isMobileViewport ? 0.62 : 0.72;
    const baseScale = THREE.MathUtils.lerp(
      centerScale,
      sideScale,
      Math.min(1, absOffset * 0.85)
    );

    if (didWrapJump) {
      // Langsung snap posisi di luar layar saat botol berpindah dari ujung ke ujung
      group.position.set(targetX, targetY, targetZ);
      group.rotation.set(targetRotationX, targetRotationY, targetRotationZ);
      group.scale.setScalar(baseScale);
    } else {
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

      const nextScale = THREE.MathUtils.lerp(
        group.scale.x,
        baseScale,
        lerpFactor
      );
      group.scale.setScalar(nextScale);
    }

    // ========================================================================
    // 5. FISIKA CAIRAN 80% BERGOYANG (DAMPED SPRING-PENDULUM SLOSHING)
    // ========================================================================
    const slosh = sloshStateRef.current;
    const rawAccel = (velocity - prevVelocityRef.current) / Math.max(dt, 0.008);
    prevVelocityRef.current = velocity;
    const clampedAccel = THREE.MathUtils.clamp(rawAccel, -22, 22);

    // Pegas harmonik teredam: akselerasi & kecepatan geser mendorong cairan miring lalu memantul alami
    const springStiffness = 28.0;
    const springDamping = 3.4;
    const externalForcing = clampedAccel * 0.14 + velocity * 1.35;

    const angularAccel =
      -springStiffness * slosh.angle -
      springDamping * slosh.angularVel +
      externalForcing;

    slosh.angularVel += angularAccel * dt;
    slosh.angle = THREE.MathUtils.clamp(
      slosh.angle + slosh.angularVel * dt,
      -0.26,
      0.26
    );

    // Amplitudo riak gelombang permukaan meningkat saat digeser dan mereda perlahan saat diam
    const targetWaveAmp = Math.min(
      0.042,
      Math.abs(slosh.angularVel) * 0.028 +
        Math.abs(velocity) * 0.016 +
        0.0025
    );
    slosh.waveAmp = THREE.MathUtils.lerp(
      slosh.waveAmp,
      targetWaveAmp,
      1 - Math.exp(-6.5 * dt)
    );
    slosh.phase += dt * (4.2 + Math.min(8.0, Math.abs(velocity) * 3.5));

    sloshUniforms.uSloshTilt.value = slosh.angle;
    sloshUniforms.uSloshWave.value = slosh.waveAmp;
    sloshUniforms.uSloshPhase.value = slosh.phase;

    // Gerakkan kepingan 3D permukaan atas cairan (meniskus) agar miring & beriak selaras
    if (liquidSurfaceRef.current) {
      liquidSurfaceRef.current.rotation.z = slosh.angle * 0.92;
      liquidSurfaceRef.current.rotation.x =
        Math.sin(slosh.phase * 0.8) * slosh.waveAmp * 1.8;
      liquidSurfaceRef.current.position.y =
        LIQUID_SURFACE_Y + Math.cos(slosh.phase) * slosh.waveAmp * 0.35;
    }
  });

  const handleBottleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      // Pastikan hanya klik/tap murni (bukan akhir dari drag/geser) yang membuka detail produk
      if (maxDragDistRef.current < 8) {
        onSelectBottle(item, index);
      }
    },
    [item, index, maxDragDistRef, onSelectBottle]
  );

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (typeof document !== "undefined") {
      document.body.style.cursor = "pointer";
    }
  }, []);

  const handlePointerOut = useCallback(() => {
    if (typeof document !== "undefined") {
      document.body.style.cursor = "";
    }
  }, []);

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
      {/* Bayangan lantai lembut per-botol */}
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
            opacity={0.38}
            depthWrite={false}
          />
        </mesh>
      )}

      <Float
        speed={1.25}
        rotationIntensity={0.025}
        floatIntensity={0.09}
        floatingRange={[-0.02, 0.02]}
      >
        {/* 1. SELANG SEMPROTAN DALAM (DIP TUBE) & VALVE ATOMIZER LOGAM */}
        <mesh geometry={geoms.dipTube} renderOrder={1}>
          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.25}
            metalness={0.05}
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>

        <mesh
          geometry={geoms.valveHousing}
          position={[0, 1.19, 0]}
          renderOrder={1}
        >
          <meshStandardMaterial
            color="#e2e8f0"
            roughness={0.28}
            metalness={0.45}
            transparent
            opacity={0.62}
            depthWrite={false}
          />
        </mesh>

        <mesh
          geometry={geoms.valveCollar}
          position={[0, 1.31, 0]}
          renderOrder={1}
        >
          <meshStandardMaterial
            color="#cbd5e1"
            roughness={0.24}
            metalness={0.55}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>

        {/* 2. RONGGA CAIRAN 80% + RUANG UDARA ATAS 20% */}
        <mesh
          geometry={geoms.innerCavity}
          position={[0, 0.05, 0]}
          renderOrder={2}
        >
          <meshStandardMaterial
            customProgramCacheKey={() => `alparfume-cavity-slosh-v2-${item.id}`}
            onBeforeCompile={handleInnerCavityBeforeCompile}
            color={item.innerCavityColor}
            emissive={item.innerGlowColor}
            emissiveIntensity={1.0}
            roughness={0.22}
            metalness={0.0}
            transparent
            opacity={0.32}
            depthWrite={false}
          />
        </mesh>

        {/* Dinding belakang rongga kaca untuk efek bening kristal berdimensi */}
        <mesh
          geometry={geoms.innerCavity}
          position={[0, 0.05, 0]}
          scale={[1.018, 1.012, 1.02]}
          renderOrder={2}
        >
          <meshStandardMaterial
            color={item.bubbleRimColor}
            roughness={0.28}
            metalness={0.0}
            side={THREE.BackSide}
            transparent
            opacity={0.24}
            depthWrite={false}
          />
        </mesh>

        {/* 2B. KEPINGAN PERMUKAAN ATAS CAIRAN 80% (MENISKUS DINAMIS IKUT BERGOYANG) */}
        <mesh
          ref={liquidSurfaceRef}
          geometry={geoms.liquidSurfaceDisc}
          position={[0, LIQUID_SURFACE_Y, 0]}
          renderOrder={2}
        >
          <meshStandardMaterial
            color={item.bubbleRimColor}
            emissive={item.innerGlowColor}
            emissiveIntensity={0.35}
            roughness={0.18}
            metalness={0.0}
            transparent
            opacity={0.38}
            depthWrite={false}
          />
        </mesh>

        {/* 3. DINDING KACA LUAR 50ML (WARNA AWAL JELAS & BENING + KLIK DETAIL PRODUK) */}
        <mesh
          geometry={geoms.outerBottle}
          renderOrder={3}
          onClick={handleBottleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshStandardMaterial
            customProgramCacheKey={() => `alparfume-crystal-glass-v2-${item.id}`}
            onBeforeCompile={handleOuterGlassBeforeCompile}
            color={item.innerCavityColor}
            emissive={item.outerGlassColor}
            emissiveIntensity={1.0}
            roughness={0.18}
            metalness={0.0}
            transparent
            opacity={0.52}
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
            roughness={0.24}
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
            roughness={0.24}
            metalness={0.0}
            transparent
            opacity={0.62}
            depthWrite={false}
          />
        </mesh>

        {/* 4. LEHER & TUTUP BOTOL HITAM PEKAT (JET BLACK LUXURY CAP) */}
        <mesh
          geometry={geoms.neckRing}
          position={[0, 1.39, 0]}
          onClick={handleBottleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshStandardMaterial
            color="#0a0a0a"
            roughness={0.28}
            metalness={0.18}
          />
        </mesh>

        <mesh
          geometry={geoms.capCollar}
          position={[0, 1.505, 0]}
          onClick={handleBottleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshStandardMaterial
            color="#070707"
            roughness={0.24}
            metalness={0.12}
          />
        </mesh>

        <mesh
          geometry={geoms.capBody}
          position={[0, 2.09, 0]}
          onClick={handleBottleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshStandardMaterial
            color="#050505"
            roughness={0.2}
            metalness={0.08}
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
// SCENE CONTROLLER (INFINITE LOOP SCROLL, SMOOTH INERTIA)
// ============================================================================

interface CarouselSceneProps {
  items: Perfume3DItemConfig[];
  scrollTargetRef: React.MutableRefObject<number>;
  scrollCurrentRef: React.MutableRefObject<number>;
  scrollVelocityRef: React.MutableRefObject<number>;
  inertiaVelocityRef: React.MutableRefObject<number>;
  isDraggingRef: React.MutableRefObject<boolean>;
  maxDragDistRef: React.MutableRefObject<number>;
  globalUseDecal: boolean;
  onSelectBottle: (item: Perfume3DItemConfig, index: number) => void;
}

function PerfumeCarouselScene({
  items,
  scrollTargetRef,
  scrollCurrentRef,
  scrollVelocityRef,
  inertiaVelocityRef,
  isDraggingRef,
  maxDragDistRef,
  globalUseDecal,
  onSelectBottle,
}: CarouselSceneProps) {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const total = Math.max(1, items.length);

    if (
      !isDraggingRef.current &&
      Math.abs(inertiaVelocityRef.current) > 0.0005
    ) {
      // Infinite scroll: tidak ada clamp di ujung kiri/kanan
      scrollTargetRef.current += inertiaVelocityRef.current * dt * 60;
      inertiaVelocityRef.current *= Math.pow(0.92, dt * 60);
    } else if (!isDraggingRef.current) {
      inertiaVelocityRef.current = 0;

      // Jaga angka scroll tetap kecil secara periodik tanpa mengubah posisi relatif
      if (Math.abs(scrollCurrentRef.current) > total * 50) {
        const shift = Math.trunc(scrollCurrentRef.current / total) * total;
        scrollCurrentRef.current -= shift;
        scrollTargetRef.current -= shift;
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
      THREE.MathUtils.clamp(rawVelocity, -4.0, 4.0),
      0.24
    );
  });

  return (
    <>
      <ambientLight intensity={1.08} />
      <directionalLight position={[3.6, 5.2, 5.4]} intensity={1.15} />
      <directionalLight position={[-3.6, 3.0, 4.2]} intensity={0.7} />
      <pointLight position={[0, 0.35, -3.8]} intensity={1.5} color="#ffffff" />

      <group position={[0, -0.34, 0]}>
        {items.map((item, idx) => (
          <ProceduralPerfumeBottle
            key={item.id}
            item={item}
            index={idx}
            totalItems={items.length}
            scrollCurrentRef={scrollCurrentRef}
            scrollVelocityRef={scrollVelocityRef}
            maxDragDistRef={maxDragDistRef}
            globalUseDecal={globalUseDecal}
            onSelectBottle={onSelectBottle}
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
  const router = useRouter();
  const [canRenderWebGL, setCanRenderWebGL] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef(0);
  const scrollCurrentRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const inertiaVelocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const maxDragDistRef = useRef(0);

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

    const findBySlug = (slugs: string[], keywordFallback?: string) => {
      const exact = products.find((p) =>
        slugs.includes(p.slug.toLowerCase())
      );
      if (exact) return exact;
      if (!keywordFallback) return undefined;
      return products.find(
        (p) =>
          p.slug.toLowerCase().includes(keywordFallback) &&
          !p.slug.toLowerCase().includes("toilette")
      );
    };

    const merryProduct =
      merryKiss ??
      findBySlug(
        ["merry-kiss-eau-de-parfum", "merry-kiss-edp"],
        "merry-kiss"
      );
    const guavinProduct =
      guavin ??
      findBySlug(
        [
          "guavin-eau-de-parfume",
          "guavin-eau-de-parfum",
          "guavin-edp",
        ],
        "guavin"
      );
    const elysianProduct =
      elysianVanilla ??
      findBySlug(
        ["elysian-vanilla", "elysian-vanilla-eau-de-parfum"],
        "elysian"
      );
    const pinkProduct =
      pinkRomance ??
      findBySlug(
        ["pink-romance-eau-de-parfum", "pink-romance-edp"],
        "pink-romance"
      );
    const serenityProduct =
      serenity ??
      findBySlug(
        ["serenity-eau-de-parfum", "serenity-edp"],
        "serenity"
      );

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

  const handleSelectBottle = useCallback(
    (item: Perfume3DItemConfig) => {
      if (!item.slug) return;
      router.push(`/products/${item.slug}`);
    },
    [router]
  );

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
        const stepDelta = THREE.MathUtils.clamp(e.deltaX * 0.0022, -0.5, 0.5);
        // Infinite loop: tanpa clamp batas kiri/kanan
        scrollTargetRef.current += stepDelta;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    inertiaVelocityRef.current = 0;
    maxDragDistRef.current = 0;

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
    const dist = Math.hypot(totalDx, totalDy);
    if (dist > maxDragDistRef.current) {
      maxDragDistRef.current = dist;
    }

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

    // Infinite loop: bebas geser melewati produk terakhir maupun pertama tanpa batas ujung
    scrollTargetRef.current = drag.startTarget + dragProgress;

    const instantVel = -(stepDx / sensitivity) / (dtMs / 16.67);
    inertiaVelocityRef.current = THREE.MathUtils.lerp(
      inertiaVelocityRef.current,
      THREE.MathUtils.clamp(instantVel, -0.22, 0.22),
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
        <Link
          key={item.id}
          href={`/products/${item.slug}`}
          className="flex flex-col items-center shrink-0 select-none group"
        >
          <img
            src={item.fallbackImage}
            alt={item.displayName || item.mainTitleTop}
            className="h-64 w-64 rounded-2xl object-cover shadow-sm transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </Link>
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
                maxDragDistRef={maxDragDistRef}
                globalUseDecal={useDecal}
                onSelectBottle={handleSelectBottle}
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
