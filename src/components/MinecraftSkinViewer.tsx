import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Box,
  Download,
  FlipHorizontal2,
  Grid2x2,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Search,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  buildMinecraftSkinTextureUrl,
  buildMirroredSkinPlan,
  computeMotionAngles,
  getCharacterSkinParts,
  normalizeMinecraftUsername,
  PartBoxFaces,
  PixelRect,
  pixelRectToUvBounds,
  SkinMotionMode,
} from '../utils/skinLogic';
import { MinecraftHeadAvatar } from './MinecraftHeadAvatar';

interface MinecraftSkinViewerProps {
  initialUsername?: string;
}

const MOTION_MODES: { id: SkinMotionMode; label: string }[] = [
  { id: 'walk', label: 'Walk' },
  { id: 'run', label: 'Run' },
  { id: 'wave', label: 'Wave' },
  { id: 'spin', label: 'Spin' },
  { id: 'idle', label: 'Idle' },
];

const QUICK_PRESETS = ['Notch', 'Dream', 'Technoblade', 'Dinnerbone', 'MHF_Alex'];

function buildDefaultSteveCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Fill transparent
  ctx.clearRect(0, 0, 64, 64);

  // Head base (skin tone + hair)
  ctx.fillStyle = '#c6967a';
  ctx.fillRect(0, 0, 32, 16);
  ctx.fillStyle = '#3f2718';
  ctx.fillRect(8, 0, 8, 8); // top hair
  ctx.fillRect(0, 8, 8, 3);
  ctx.fillRect(8, 8, 8, 2); // forehead hair
  ctx.fillRect(16, 8, 8, 3);
  ctx.fillRect(24, 8, 8, 8); // back hair
  // Eyes & mouth on front head (8..16, 8..16)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(9, 12, 1, 1);
  ctx.fillRect(14, 12, 1, 1);
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(13, 12, 1, 1);
  ctx.fillStyle = '#9a6449';
  ctx.fillRect(11, 13, 2, 1);
  ctx.fillStyle = '#6b3e28';
  ctx.fillRect(10, 14, 4, 1);

  // Torso (teal shirt)
  ctx.fillStyle = '#0e7490';
  ctx.fillRect(16, 16, 24, 16);

  // Right & Left Arms (skin + teal sleeve)
  ctx.fillStyle = '#c6967a';
  ctx.fillRect(40, 16, 16, 16);
  ctx.fillRect(32, 48, 16, 16);
  ctx.fillStyle = '#0e7490';
  ctx.fillRect(40, 16, 16, 6);
  ctx.fillRect(32, 48, 16, 6);

  // Right & Left Legs (indigo jeans + dark shoes)
  ctx.fillStyle = '#312e81';
  ctx.fillRect(0, 16, 16, 16);
  ctx.fillRect(16, 48, 16, 16);
  ctx.fillStyle = '#52525b';
  ctx.fillRect(0, 30, 16, 2);
  ctx.fillRect(16, 62, 16, 2);

  return canvas;
}

function normalizeSkinSourceTo64x64(source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = 64;
  out.height = 64;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);

  const srcW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  if (srcW === 64 && srcH === 32) {
    // Legacy 64x32 format: copy top half & duplicate right leg/arm to left limb UV slots
    ctx.drawImage(source, 0, 0, 64, 32, 0, 0, 64, 32);

    // Strip solid opaque background from legacy hat area (32..64, 0..16) if it has no alpha channel,
    // matching official Minecraft Java's ImageBufferDownload behavior (prevents black box over face).
    const hatData = ctx.getImageData(32, 0, 32, 16);
    let hatHasTransparency = false;
    for (let i = 3; i < hatData.data.length; i += 4) {
      if (hatData.data[i] < 255) {
        hatHasTransparency = true;
        break;
      }
    }
    if (!hatHasTransparency) {
      ctx.clearRect(32, 0, 32, 16);
    }

    // Also strip solid black/opaque unused top background corners so 2D UV sheet looks crisp
    const wholeData = ctx.getImageData(0, 0, 64, 32);
    let anyTransparent = false;
    for (let i = 3; i < wholeData.data.length; i += 4) {
      if (wholeData.data[i] < 255) {
        anyTransparent = true;
        break;
      }
    }
    if (!anyTransparent) {
      ctx.clearRect(0, 0, 8, 8);
      ctx.clearRect(24, 0, 8, 8);
      ctx.clearRect(16, 16, 4, 4);
      ctx.clearRect(36, 16, 8, 4);
      ctx.clearRect(40, 16, 4, 4);
      ctx.clearRect(52, 16, 12, 4);
    }

    // Right leg (0,16,16,16) -> Left leg (16,48,16,16) mirrored
    ctx.save();
    ctx.translate(32, 48);
    ctx.scale(-1, 1);
    ctx.drawImage(out, 0, 16, 16, 16, 0, 0, 16, 16);
    ctx.restore();
    // Right arm (40,16,16,16) -> Left arm (32,48,16,16) mirrored
    ctx.save();
    ctx.translate(48, 48);
    ctx.scale(-1, 1);
    ctx.drawImage(out, 40, 16, 16, 16, 0, 0, 16, 16);
    ctx.restore();
  } else {
    ctx.drawImage(source, 0, 0, 64, 64);
  }
  return out;
}

function createProcessedSkinCanvas(
  baseSkinCanvas: HTMLCanvasElement,
  mirrored: boolean,
  slim: boolean
): HTMLCanvasElement {
  if (!mirrored) return baseSkinCanvas;

  const out = document.createElement('canvas');
  out.width = 64;
  out.height = 64;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);

  const plan = buildMirroredSkinPlan(slim);
  for (const step of plan) {
    if (step.src.w <= 0 || step.src.h <= 0) continue;
    ctx.save();
    if (step.flipX) {
      ctx.translate(step.dst.x + step.dst.w, step.dst.y);
      ctx.scale(-1, 1);
      ctx.drawImage(
        baseSkinCanvas,
        step.src.x,
        step.src.y,
        step.src.w,
        step.src.h,
        0,
        0,
        step.dst.w,
        step.dst.h
      );
    } else {
      ctx.drawImage(
        baseSkinCanvas,
        step.src.x,
        step.src.y,
        step.src.w,
        step.src.h,
        step.dst.x,
        step.dst.y,
        step.dst.w,
        step.dst.h
      );
    }
    ctx.restore();
  }

  return out;
}

function createSkinnedBoxGeometry(
  w: number,
  h: number,
  d: number,
  faces: PartBoxFaces
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;

  // BoxGeometry face group order: 0=+X(char left), 1=-X(char right), 2=+Y(top), 3=-Y(bottom), 4=+Z(front), 5=-Z(back)
  const faceOrder: { rect: PixelRect; flipY?: boolean }[] = [
    { rect: faces.left },
    { rect: faces.right },
    { rect: faces.top },
    { rect: faces.bottom, flipY: true },
    { rect: faces.front },
    { rect: faces.back },
  ];

  faceOrder.forEach(({ rect, flipY }, faceIdx) => {
    const { u0, v0, u1, v1 } = pixelRectToUvBounds(rect, 64);
    const base = faceIdx * 4;
    if (flipY) {
      uv.setXY(base + 0, u0, v0);
      uv.setXY(base + 1, u1, v0);
      uv.setXY(base + 2, u0, v1);
      uv.setXY(base + 3, u1, v1);
    } else {
      uv.setXY(base + 0, u0, v1);
      uv.setXY(base + 1, u1, v1);
      uv.setXY(base + 2, u0, v0);
      uv.setXY(base + 3, u1, v0);
    }
  });

  uv.needsUpdate = true;
  return geo;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const MinecraftSkinViewer: React.FC<MinecraftSkinViewerProps> = ({
  initialUsername = 'Notch',
}) => {
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [activeUsername, setActiveUsername] = useState(initialUsername);
  const [rawUuid, setRawUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Viewer Mode & Customization Controls
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [mirrored, setMirrored] = useState(false);
  const [slimModel, setSlimModel] = useState(false);
  const [showOuterLayer, setShowOuterLayer] = useState(true);
  const [showGrid2d, setShowGrid2d] = useState(false);

  // Animation Controls
  const [motionMode, setMotionMode] = useState<SkinMotionMode>('walk');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  // Skin texture source state (64x64 base HTMLCanvasElement stored in ref + revision counter)
  const baseSkinCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [skinRevision, setSkinRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 3D WebGL refs
  const threeHostRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const threeStateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    characterGroup: THREE.Group;
    headGroup: THREE.Group;
    rightArmGroup: THREE.Group;
    leftArmGroup: THREE.Group;
    rightLegGroup: THREE.Group;
    leftLegGroup: THREE.Group;
    overlayMeshes: THREE.Mesh[];
    innerMat: THREE.MeshStandardMaterial;
    outerMat: THREE.MeshStandardMaterial;
    skinTexture: THREE.CanvasTexture | null;
    requestRender: () => void;
  } | null>(null);

  // Sync live animation flags cleanly into RAF without tearing down WebGL
  const animStateRef = useRef({
    motionMode,
    isPlaying,
    speedMultiplier,
    showOuterLayer,
  });
  animStateRef.current = {
    motionMode,
    isPlaying,
    speedMultiplier,
    showOuterLayer,
  };

  // 2D Canvas refs
  const front2dCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const back2dCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uvSheet2dCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadSkinImageUrl = useCallback(async (url: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        resolve(normalizeSkinSourceTo64x64(img));
      };
      img.onerror = () => reject(new Error('Could not decode skin PNG image.'));
      img.src = url;
    });
  }, []);

  const loadPlayerSkin = useCallback(
    async (targetName: string) => {
      const clean = normalizeMinecraftUsername(targetName);
      if (!clean) {
        setErrorMsg('Enter a valid Java Edition username (1–16 chars).');
        return;
      }

      setUsernameInput(clean);
      setLoading(true);
      setErrorMsg(null);

      try {
        // Resolve UUID & model type (Classic vs Slim) if available
        const metaRes = await fetch(`/api/mc/uuid/${encodeURIComponent(clean)}`);
        let resolvedName = clean;
        let detectedSlim = false;
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as {
            name?: string;
            rawUuid?: string;
            slim?: boolean;
          };
          resolvedName = meta.name || clean;
          setRawUuid(meta.rawUuid || null);
          detectedSlim = Boolean(meta.slim);
        } else {
          setRawUuid(null);
        }

        const texUrl = `${buildMinecraftSkinTextureUrl(resolvedName)}?t=${Date.now()}`;
        const normalized = await loadSkinImageUrl(texUrl);
        baseSkinCanvasRef.current = normalized;
        setActiveUsername(resolvedName);
        setSlimModel(detectedSlim);
        setSkinRevision((r) => r + 1);
      } catch {
        // Ensure a working Steve skin is loaded if Mojang/network is unreachable
        if (!baseSkinCanvasRef.current) {
          baseSkinCanvasRef.current = buildDefaultSteveCanvas();
          setSkinRevision((r) => r + 1);
        }
        setErrorMsg(`Could not fetch "${clean}" skin texture right now. Showing fallback Steve skin.`);
      } finally {
        setLoading(false);
      }
    },
    [loadSkinImageUrl]
  );

  // Initial skin load
  useEffect(() => {
    baseSkinCanvasRef.current = buildDefaultSteveCanvas();
    setSkinRevision((r) => r + 1);
    void loadPlayerSkin(initialUsername);
  }, [initialUsername, loadPlayerSkin]);

  const handleUploadCustomSkin = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      try {
        const normalized = await loadSkinImageUrl(reader.result);
        baseSkinCanvasRef.current = normalized;
        setActiveUsername(file.name.replace(/\.png$/i, '').slice(0, 20) || 'CustomSkin');
        setRawUuid(null);
        setErrorMsg(null);
        setSkinRevision((r) => r + 1);
      } catch {
        setErrorMsg('Please upload a valid 64×64 or 64×32 Minecraft PNG skin file.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Setup Three.js WebGL Scene when in 3D view mode & slimModel changes
  useEffect(() => {
    if (viewMode !== '3d') return;
    const host = threeHostRef.current;
    if (!host) return;

    const width = Math.max(240, host.clientWidth || 560);
    const height = Math.max(320, host.clientHeight || 420);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // Detect software GL fallback (SwiftShader / llvmpipe) per threejs/SKILL.md
    let isSoftwareGl = false;
    try {
      const gl = renderer.getContext();
      const glRenderer = String(gl.getParameter(gl.RENDERER) || '');
      isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glRenderer);
    } catch {
      isSoftwareGl = false;
    }

    host.innerHTML = '';
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#09090d');

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.42;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(1.15, 1.55, 4.15);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.9;
    controls.maxDistance = 7.5;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.target.set(0, 1.0, 0);
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x18181b, 0.78);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1f2, 1.15);
    keyLight.position.set(2.8, 4.5, 3.6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf43f5e, 0.45);
    rimLight.position.set(-3.0, 2.2, -3.2);
    scene.add(rimLight);

    // Minimalist obsidian stage plinth + contact shadow
    const plinthGeo = new THREE.CylinderGeometry(0.92, 0.98, 0.06, 36);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x13131a,
      roughness: 0.75,
      metalness: 0.18,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.y = -0.035;
    scene.add(plinthMesh);

    const ringGeo = new THREE.RingGeometry(0.91, 0.935, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe11d48,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -0.002;
    scene.add(ringMesh);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1.15, 0.75);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.002;
    scene.add(shadowPlane);

    // Character Skin Texture & Articulated Rig
    const baseCanvas = baseSkinCanvasRef.current || buildDefaultSteveCanvas();
    const processedCanvas = createProcessedSkinCanvas(baseCanvas, mirrored, slimModel);
    const skinTexture = new THREE.CanvasTexture(processedCanvas);
    skinTexture.colorSpace = THREE.SRGBColorSpace;
    skinTexture.magFilter = THREE.NearestFilter;
    skinTexture.minFilter = THREE.NearestFilter;
    skinTexture.generateMipmaps = false;

    const innerMat = new THREE.MeshStandardMaterial({
      map: skinTexture,
      roughness: 0.88,
      metalness: 0.04,
      alphaTest: 0.1,
    });

    const outerMat = new THREE.MeshStandardMaterial({
      map: skinTexture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.04,
    });

    const parts = getCharacterSkinParts(slimModel);
    const px = 1 / 16; // 1 pixel = 0.0625 units
    const overlayExpand = 0.035;

    const disposableGeometries: THREE.BufferGeometry[] = [
      plinthGeo,
      ringGeo,
      shadowGeo,
    ];
    const overlayMeshes: THREE.Mesh[] = [];

    const makeBox = (
      pw: number,
      ph: number,
      pd: number,
      faces: PartBoxFaces,
      overlayFaces: PartBoxFaces
    ) => {
      const group = new THREE.Group();
      const innerGeo = createSkinnedBoxGeometry(pw * px, ph * px, pd * px, faces);
      const outerGeo = createSkinnedBoxGeometry(
        pw * px + overlayExpand,
        ph * px + overlayExpand,
        pd * px + overlayExpand,
        overlayFaces
      );
      disposableGeometries.push(innerGeo, outerGeo);

      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      outerMesh.visible = animStateRef.current.showOuterLayer;
      overlayMeshes.push(outerMesh);

      group.add(innerMesh, outerMesh);
      return group;
    };

    const characterGroup = new THREE.Group();
    scene.add(characterGroup);

    // Head (8x8x8) pivoted at neck y = 1.50
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.5, 0);
    const headBox = makeBox(8, 8, 8, parts.head, parts.hat);
    headBox.position.y = 4 * px;
    headGroup.add(headBox);
    characterGroup.add(headGroup);

    // Torso (8x12x4)
    const torsoBox = makeBox(8, 12, 4, parts.torso, parts.jacket);
    torsoBox.position.set(0, 1.125, 0);
    characterGroup.add(torsoBox);

    // Right & Left Arms
    const armPxW = slimModel ? 3 : 4;
    const armOffsetX = (4 + armPxW / 2) * px;

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(-armOffsetX, 1.5, 0);
    const rightArmBox = makeBox(armPxW, 12, 4, parts.rightArm, parts.rightSleeve);
    rightArmBox.position.y = -6 * px;
    rightArmGroup.add(rightArmBox);
    characterGroup.add(rightArmGroup);

    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(armOffsetX, 1.5, 0);
    const leftArmBox = makeBox(armPxW, 12, 4, parts.leftArm, parts.leftSleeve);
    leftArmBox.position.y = -6 * px;
    leftArmGroup.add(leftArmBox);
    characterGroup.add(leftArmGroup);

    // Right & Left Legs
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(-2 * px, 0.75, 0);
    const rightLegBox = makeBox(4, 12, 4, parts.rightLeg, parts.rightPants);
    rightLegBox.position.y = -6 * px;
    rightLegGroup.add(rightLegBox);
    characterGroup.add(rightLegGroup);

    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(2 * px, 0.75, 0);
    const leftLegBox = makeBox(4, 12, 4, parts.leftLeg, parts.leftPants);
    leftLegBox.position.y = -6 * px;
    leftLegGroup.add(leftLegBox);
    characterGroup.add(leftLegGroup);

    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;
    let renderPending = false;
    let lastTime = performance.now();
    let phase = 0;

    const renderScene = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
    };

    const requestRender = () => {
      if (disposed || renderPending) return;
      renderPending = true;
      rafId = requestAnimationFrame(() => {
        renderPending = false;
        renderScene();
      });
    };

    const onControlChange = () => {
      if (!animStateRef.current.isPlaying) {
        requestRender();
      }
    };
    controls.addEventListener('change', onControlChange);

    threeStateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      characterGroup,
      headGroup,
      rightArmGroup,
      leftArmGroup,
      rightLegGroup,
      leftLegGroup,
      overlayMeshes,
      innerMat,
      outerMat,
      skinTexture,
      requestRender,
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      const { isPlaying: playing, motionMode: mode, speedMultiplier: speed } = animStateRef.current;

      if (playing) {
        phase += dt * 3.4 * speed;
        const angles = computeMotionAngles(mode, phase);

        characterGroup.rotation.y = angles.bodyYaw;
        characterGroup.rotation.x = angles.bodyPitch;
        characterGroup.position.y = angles.bodyBob;

        headGroup.rotation.y = angles.headYaw;
        headGroup.rotation.x = angles.headPitch;

        rightArmGroup.rotation.x = angles.rightArmX;
        rightArmGroup.rotation.z = angles.rightArmZ;
        leftArmGroup.rotation.x = angles.leftArmX;
        leftArmGroup.rotation.z = angles.leftArmZ;

        rightLegGroup.rotation.x = angles.rightLegX;
        leftLegGroup.rotation.x = angles.leftLegX;

        renderScene();
      }

      if (disposed) return;
      if (playing) {
        // Software-GL pacing after draw completes so browser stays responsive
        if (isSoftwareGl) {
          timeoutId = window.setTimeout(() => {
            if (!disposed) rafId = requestAnimationFrame(tick);
          }, 32);
        } else {
          rafId = requestAnimationFrame(tick);
        }
      }
    };

    renderScene();
    rafId = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || disposed) return;
      const nextW = Math.max(240, Math.round(entry.contentRect.width));
      const nextH = Math.max(300, Math.round(entry.contentRect.height));
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
      requestRender();
    });
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      disposableGeometries.forEach((g) => g.dispose());
      plinthMat.dispose();
      ringMat.dispose();
      shadowTex.dispose();
      shadowMat.dispose();
      innerMat.dispose();
      outerMat.dispose();
      skinTexture.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      threeStateRef.current = null;
      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
    };
    // Rebuild 3D rig only when switching into 3D mode or switching Classic vs Slim arm geometry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, slimModel]);

  // Swap 3D skin CanvasTexture live when skinRevision / mirrored changes (no WebGL teardown!)
  useEffect(() => {
    const state = threeStateRef.current;
    if (!state || !baseSkinCanvasRef.current) return;

    const processedCanvas = createProcessedSkinCanvas(
      baseSkinCanvasRef.current,
      mirrored,
      slimModel
    );
    const nextTex = new THREE.CanvasTexture(processedCanvas);
    nextTex.colorSpace = THREE.SRGBColorSpace;
    nextTex.magFilter = THREE.NearestFilter;
    nextTex.minFilter = THREE.NearestFilter;
    nextTex.generateMipmaps = false;

    const oldTex = state.skinTexture;
    state.innerMat.map = nextTex;
    state.innerMat.needsUpdate = true;
    state.outerMat.map = nextTex;
    state.outerMat.needsUpdate = true;
    state.skinTexture = nextTex;
    if (oldTex) oldTex.dispose();
    state.requestRender();
  }, [skinRevision, mirrored, slimModel]);

  // Update outer layer visibility & animation pose wakeups
  useEffect(() => {
    const state = threeStateRef.current;
    if (!state) return;
    state.overlayMeshes.forEach((mesh) => {
      mesh.visible = showOuterLayer;
    });
    state.requestRender();
  }, [showOuterLayer]);

  useEffect(() => {
    const state = threeStateRef.current;
    if (!state) return;
    state.requestRender();
  }, [isPlaying, motionMode, speedMultiplier]);

  // Draw crisp 2D Front, 2D Back, and 64x64 UV Skin Sheet whenever in 2D mode
  useEffect(() => {
    if (viewMode !== '2d' || !baseSkinCanvasRef.current) return;

    const processed = createProcessedSkinCanvas(
      baseSkinCanvasRef.current,
      mirrored,
      slimModel
    );
    const parts = getCharacterSkinParts(slimModel);
    const armW = slimModel ? 3 : 4;

    const drawPart2D = (
      ctx: CanvasRenderingContext2D,
      baseRect: PixelRect,
      overlayRect: PixelRect,
      dx: number,
      dy: number,
      scale: number
    ) => {
      ctx.drawImage(
        processed,
        baseRect.x,
        baseRect.y,
        baseRect.w,
        baseRect.h,
        dx * scale,
        dy * scale,
        baseRect.w * scale,
        baseRect.h * scale
      );
      if (showOuterLayer) {
        ctx.drawImage(
          processed,
          overlayRect.x,
          overlayRect.y,
          overlayRect.w,
          overlayRect.h,
          dx * scale,
          dy * scale,
          overlayRect.w * scale,
          overlayRect.h * scale
        );
      }
    };

    // Front 2D character (20x36 logical grid scaled x7 => 140x252)
    if (front2dCanvasRef.current) {
      const c = front2dCanvasRef.current;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      const s = 7;
      const armOffset = slimModel ? 1 : 0;
      drawPart2D(ctx, parts.head.front, parts.hat.front, 6, 2, s);
      drawPart2D(ctx, parts.torso.front, parts.jacket.front, 6, 10, s);
      drawPart2D(ctx, parts.rightArm.front, parts.rightSleeve.front, 2 + armOffset, 10, s);
      drawPart2D(ctx, parts.leftArm.front, parts.leftSleeve.front, 14, 10, s);
      drawPart2D(ctx, parts.rightLeg.front, parts.rightPants.front, 6, 22, s);
      drawPart2D(ctx, parts.leftLeg.front, parts.leftPants.front, 10, 22, s);
    }

    // Back 2D character
    if (back2dCanvasRef.current) {
      const c = back2dCanvasRef.current;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      const s = 7;
      const armOffset = slimModel ? 1 : 0;
      drawPart2D(ctx, parts.head.back, parts.hat.back, 6, 2, s);
      drawPart2D(ctx, parts.torso.back, parts.jacket.back, 6, 10, s);
      drawPart2D(ctx, parts.leftArm.back, parts.leftSleeve.back, 2 + armOffset, 10, s);
      drawPart2D(ctx, parts.rightArm.back, parts.rightSleeve.back, 14, 10, s);
      drawPart2D(ctx, parts.leftLeg.back, parts.leftPants.back, 6, 22, s);
      drawPart2D(ctx, parts.rightLeg.back, parts.rightPants.back, 10, 22, s);
    }

    // Full 64x64 UV Sheet (256x256 => 4x scale)
    if (uvSheet2dCanvasRef.current) {
      const c = uvSheet2dCanvasRef.current;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(processed, 0, 0, 64, 64, 0, 0, 256, 256);

      if (showGrid2d) {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.25)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 64; i += 4) {
          const p = i * 4;
          ctx.beginPath();
          ctx.moveTo(p, 0);
          ctx.lineTo(p, 256);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, p);
          ctx.lineTo(256, p);
          ctx.stroke();
        }
      }
    }
    void armW;
  }, [viewMode, skinRevision, mirrored, slimModel, showOuterLayer, showGrid2d]);

  const handleResetCamera = () => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    cam.position.set(1.15, 1.55, 4.15);
    ctrl.target.set(0, 1.0, 0);
    ctrl.update();
    threeStateRef.current?.requestRender();
  };

  const handleZoom = (factor: number) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const offset = cam.position.clone().sub(ctrl.target);
    const nextDist = THREE.MathUtils.clamp(offset.length() * factor, 1.9, 7.5);
    offset.setLength(nextDist);
    cam.position.copy(ctrl.target).add(offset);
    ctrl.update();
    threeStateRef.current?.requestRender();
  };

  const handleDownloadSkinPng = () => {
    if (!baseSkinCanvasRef.current) return;
    const exportCanvas = createProcessedSkinCanvas(
      baseSkinCanvasRef.current,
      mirrored,
      slimModel
    );
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeUsername}${mirrored ? '-mirrored' : ''}-skin.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className="mt-5 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadCustomSkin(file);
          e.target.value = '';
        }}
      />

      {/* Top Search & Custom PNG Row */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadPlayerSkin(usernameInput);
          }}
          className="flex flex-1 gap-2"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Enter Java IGN (e.g. Notch, Dream)"
              aria-label="Minecraft Java username for skin viewer"
              className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 font-display-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-10 shrink-0 rounded-md bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Load Skin'}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-200 hover:border-zinc-600 hover:text-white"
          >
            <Upload className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            <span>Upload PNG</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSkinPng}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-200 hover:border-rose-500/60 hover:text-white"
          >
            <Download className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            <span>Download {mirrored ? 'Mirrored ' : ''}PNG</span>
          </button>
        </div>
      </div>

      {/* Presets + Player Header + Model & Mirror Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3.5 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <MinecraftHeadAvatar
            username={activeUsername}
            alt={`${activeUsername} Minecraft head`}
            className="h-9 w-9 shrink-0 rounded border border-zinc-700"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs font-bold text-white">{activeUsername}</p>
              {mirrored && (
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                  Mirrored
                </span>
              )}
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-display-mono text-[10px] text-zinc-300">
                {slimModel ? 'Slim 3px' : 'Classic 4px'}
              </span>
            </div>
            {rawUuid && (
              <p className="truncate font-display-mono text-[10px] text-zinc-500">{rawUuid}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {/* 3D / 2D Mode Toggle */}
          <div className="inline-flex rounded-md border border-zinc-800 bg-[#0b0b0e] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition-colors ${
                viewMode === '3d'
                  ? 'bg-rose-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Box className="h-3 w-3" aria-hidden="true" />
              <span>3D Interactive</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition-colors ${
                viewMode === '2d'
                  ? 'bg-rose-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Grid2x2 className="h-3 w-3" aria-hidden="true" />
              <span>2D &amp; UV Sheet</span>
            </button>
          </div>

          {/* Mirror Skin Button */}
          <button
            type="button"
            aria-pressed={mirrored}
            onClick={() => setMirrored((m) => !m)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-semibold transition-colors ${
              mirrored
                ? 'border-rose-500 bg-rose-600/20 text-rose-200'
                : 'border-zinc-800 bg-[#0b0b0e] text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <FlipHorizontal2 className="h-3 w-3" aria-hidden="true" />
            <span>Mirror Skin</span>
          </button>

          {/* Slim / Classic Arm Width */}
          <button
            type="button"
            aria-pressed={slimModel}
            onClick={() => setSlimModel((s) => !s)}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-[#0b0b0e] px-2.5 py-1.5 font-semibold text-zinc-300 hover:border-zinc-600"
          >
            <span>{slimModel ? 'Slim (Alex)' : 'Classic (Steve)'}</span>
          </button>

          {/* Hat / Outer Layer Toggle */}
          <button
            type="button"
            aria-pressed={showOuterLayer}
            onClick={() => setShowOuterLayer((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-semibold transition-colors ${
              showOuterLayer
                ? 'border-zinc-700 bg-zinc-900 text-white'
                : 'border-zinc-800 bg-[#0b0b0e] text-zinc-500'
            }`}
          >
            <Layers className="h-3 w-3" aria-hidden="true" />
            <span>Outer Layer</span>
          </button>
        </div>
      </div>

      {/* Quick Username Presets */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-zinc-500">Quick presets:</span>
        {QUICK_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => void loadPlayerSkin(preset)}
            className={`rounded border px-2.5 py-1 font-display-mono transition-colors ${
              activeUsername.toLowerCase() === preset.toLowerCase()
                ? 'border-rose-500/60 bg-rose-600/15 text-rose-200'
                : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-rose-500/50 hover:text-white'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          {errorMsg}
        </div>
      )}

      {/* Main Viewport: 3D WebGL or 2D Front/Back + UV Sheet */}
      {viewMode === '3d' ? (
        <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-[#09090d]">
          <div
            ref={threeHostRef}
            className="h-[380px] sm:h-[430px] w-full cursor-grab active:cursor-grabbing"
            aria-label="Interactive 3D Minecraft Skin Canvas"
          />

          {/* Bottom Control Dock (Solid surface, no backdrop-filter over WebGL) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 bg-[#111114] px-3 py-2.5 text-[11px]">
            {/* Animation Motions */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pause movement animation' : 'Play movement animation'}
                className="inline-flex h-7 items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 font-semibold text-white hover:border-rose-500/60"
              >
                {isPlaying ? (
                  <Pause className="h-3 w-3 text-rose-400" aria-hidden="true" />
                ) : (
                  <Play className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                )}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              {MOTION_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMotionMode(m.id);
                    setIsPlaying(true);
                  }}
                  className={`h-7 rounded border px-2.5 font-semibold transition-colors ${
                    motionMode === m.id
                      ? 'border-rose-500 bg-rose-600 text-white'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Speed & Camera Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center rounded border border-zinc-800 bg-zinc-950 p-0.5">
                {[0.5, 1, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSpeedMultiplier(spd)}
                    className={`rounded px-2 py-0.5 font-display-mono text-[10px] font-bold ${
                      speedMultiplier === spd
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleZoom(0.84)}
                aria-label="Zoom in 3D skin"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(1.18)}
                aria-label="Zoom out 3D skin"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white"
              >
                <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleResetCamera}
                aria-label="Reset 3D camera"
                className="inline-flex h-7 items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-2 font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800/80 bg-[#0b0b0e] p-4">
            <span className="mb-2 font-display-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              2D Front View
            </span>
            <canvas
              ref={front2dCanvasRef}
              width={140}
              height={252}
              className="mc-pixelated h-[210px] w-auto"
            />
          </div>

          <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800/80 bg-[#0b0b0e] p-4">
            <span className="mb-2 font-display-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              2D Back View
            </span>
            <canvas
              ref={back2dCanvasRef}
              width={140}
              height={252}
              className="mc-pixelated h-[210px] w-auto"
            />
          </div>

          <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800/80 bg-[#0b0b0e] p-4">
            <div className="mb-2 flex w-full items-center justify-between">
              <span className="font-display-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                64×64 UV Sheet
              </span>
              <button
                type="button"
                onClick={() => setShowGrid2d((g) => !g)}
                className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                  showGrid2d
                    ? 'border-rose-500/60 bg-rose-600/20 text-rose-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                Pixel Grid
              </button>
            </div>
            <canvas
              ref={uvSheet2dCanvasRef}
              width={256}
              height={256}
              className="mc-pixelated h-[210px] w-[210px] rounded border border-zinc-800 bg-[#070709]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
