export type MapLightingMode = 'golden' | 'day' | 'night';

export type WorldBiomeArchetype =
  | 'skyblock'
  | 'survival'
  | 'lifesteal'
  | 'crystal_pvp'
  | 'factions'
  | 'prison'
  | 'bedwars'
  | 'economy'
  | 'anarchy'
  | 'creative';

export interface WorldPalette {
  skyTop: string;
  skyBottom: string;
  water: string;
  accent: string;
  glow: string;
}

export interface WorldPreviewSpec {
  serverName: string;
  address: string;
  tags: string[];
  primaryArchetype: WorldBiomeArchetype;
  secondaryArchetypes: WorldBiomeArchetype[];
  title: string;
  subtitle: string;
  landmarks: string[];
  palette: WorldPalette;
}

export interface VoxelBlock {
  x: number;
  y: number;
  z: number;
  top: string;
  left: string;
  right: string;
  emissive?: string;
}

export interface VoxelWorldScene {
  gridSize: number;
  blocks: VoxelBlock[];
  seed: number;
  isVoidWorld: boolean;
}

const ARCHETYPE_PALETTES: Record<WorldBiomeArchetype, WorldPalette> = {
  skyblock: {
    skyTop: '#0b2447',
    skyBottom: '#38bdf8',
    water: '#0284c7',
    accent: '#4ade80',
    glow: '#fde047',
  },
  survival: {
    skyTop: '#164e63',
    skyBottom: '#7dd3fc',
    water: '#0369a1',
    accent: '#22c55e',
    glow: '#fbbf24',
  },
  lifesteal: {
    skyTop: '#1f0814',
    skyBottom: '#7f1d1d',
    water: '#b91c1c',
    accent: '#f43f5e',
    glow: '#fb7185',
  },
  crystal_pvp: {
    skyTop: '#13072e',
    skyBottom: '#4c1d95',
    water: '#6d28d9',
    accent: '#e879f9',
    glow: '#f0abfc',
  },
  factions: {
    skyTop: '#1c1917',
    skyBottom: '#9a3412',
    water: '#0284c7',
    accent: '#f97316',
    glow: '#fb923c',
  },
  prison: {
    skyTop: '#18181b',
    skyBottom: '#3f3f46',
    water: '#0ea5e9',
    accent: '#f59e0b',
    glow: '#38bdf8',
  },
  bedwars: {
    skyTop: '#1e3a8a',
    skyBottom: '#60a5fa',
    water: '#38bdf8',
    accent: '#ef4444',
    glow: '#fde047',
  },
  economy: {
    skyTop: '#064e3b',
    skyBottom: '#34d399',
    water: '#0284c7',
    accent: '#fbbf24',
    glow: '#fde68a',
  },
  anarchy: {
    skyTop: '#180909',
    skyBottom: '#451a03',
    water: '#ea580c',
    accent: '#a8a29e',
    glow: '#fb923c',
  },
  creative: {
    skyTop: '#1e1b4b',
    skyBottom: '#818cf8',
    water: '#06b6d4',
    accent: '#2dd4bf',
    glow: '#f472b6',
  },
};

const ARCHETYPE_TITLES: Record<WorldBiomeArchetype, string> = {
  skyblock: 'Floating Sky Islands & Void Cascade',
  survival: 'Emerald Frontier & Timber Citadel',
  lifesteal: 'Crimson Heart Citadel & Basalt Cliffs',
  crystal_pvp: 'Obsidian Spire & End Crystal Crater',
  factions: 'Fortified Bastion & Siege Outpost',
  prison: 'Tiered Quarry Shaft & Ore Vaults',
  bedwars: 'Cloud Archipelago & Wool Bridges',
  economy: 'Grand Bazaar & Emerald Trade Spire',
  anarchy: 'Obsidian Highway & Scorched Ruins',
  creative: 'Sculpted Terraces & Prism Pavilion',
};

const ARCHETYPE_LANDMARKS: Record<WorldBiomeArchetype, string[]> = {
  skyblock: ['Floating Starter Isle', 'Waterfall Void Drop', 'Cobblestone Generator'],
  survival: ['Oak & Pine Ridge', 'Timber Watchtower', 'River Valley Crossing'],
  lifesteal: ['Heart Beacon Altar', 'Crimson Nether Rift', 'Basalt Duel Terrace'],
  crystal_pvp: ['Obsidian Pillars', 'Floating End Crystals', 'End-Stone Crater'],
  factions: ['Stone Castle Keep', 'Banner Ramparts', 'Moat Drawbridge'],
  prison: ['Deep Ore Quarry', 'Diamond Vein Strata', 'Mine Cart Derrick'],
  bedwars: ['Team Spawn Island', 'Mid Emerald Forge', 'Suspended Wool Bridge'],
  economy: ['Market Stalls', 'Emerald Treasury Spire', 'Town Fountain Plaza'],
  anarchy: ['Ruined Spawn Highway', 'Lava-Lit Crater', 'Obsidian Monolith'],
  creative: ['Quartz Pavilion', 'Terraced Gardens', 'Prism Fountain'],
};

function mapTagToArchetype(tag: string): WorldBiomeArchetype | null {
  const lower = tag.trim().toLowerCase();
  if (!lower) return null;
  if (lower.includes('skyblock') || lower.includes('oneblock')) return 'skyblock';
  if (lower.includes('crystal')) return 'crystal_pvp';
  if (lower.includes('lifesteal') || lower.includes('kitpvp') || lower.includes('pvp')) {
    return lower.includes('crystal') ? 'crystal_pvp' : 'lifesteal';
  }
  if (lower.includes('bedwar') || lower.includes('minigame')) return 'bedwars';
  if (lower.includes('faction')) return 'factions';
  if (lower.includes('prison')) return 'prison';
  if (lower.includes('anarchy')) return 'anarchy';
  if (lower.includes('economy')) return 'economy';
  if (lower.includes('creative') || lower.includes('roleplay')) return 'creative';
  if (lower.includes('survival') || lower.includes('smp') || lower.includes('vanilla')) {
    return 'survival';
  }
  return null;
}

export function resolveWorldPreviewSpec(
  serverName: string,
  address: string,
  tags: string[]
): WorldPreviewSpec {
  const cleanTags = tags.map((t) => t.trim()).filter(Boolean);
  const archetypes: WorldBiomeArchetype[] = [];

  for (const tag of cleanTags) {
    const mapped = mapTagToArchetype(tag);
    if (mapped && !archetypes.includes(mapped)) {
      archetypes.push(mapped);
    }
  }

  const primaryArchetype: WorldBiomeArchetype = archetypes[0] ?? 'survival';
  const secondaryArchetypes = archetypes.slice(1);

  const landmarkSet = new Set<string>(ARCHETYPE_LANDMARKS[primaryArchetype]);
  for (const sec of secondaryArchetypes.slice(0, 2)) {
    const first = ARCHETYPE_LANDMARKS[sec]?.[0];
    if (first) landmarkSet.add(first);
  }

  const tagSummary = cleanTags.length > 0 ? cleanTags.join(' · ') : 'Survival SMP';

  return {
    serverName,
    address,
    tags: cleanTags.length > 0 ? cleanTags : ['Survival SMP'],
    primaryArchetype,
    secondaryArchetypes,
    title: ARCHETYPE_TITLES[primaryArchetype],
    subtitle: `World preview for ${tagSummary}`,
    landmarks: Array.from(landmarkSet).slice(0, 4),
    palette: ARCHETYPE_PALETTES[primaryArchetype],
  };
}

export function createSeedFromString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number): () => number {
  let state = (seed || 1) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MATERIALS = {
  grass: { top: '#4ade80', left: '#22c55e', right: '#15803d' },
  darkGrass: { top: '#22c55e', left: '#16a34a', right: '#14532d' },
  dirt: { top: '#a16207', left: '#854d0e', right: '#713f12' },
  stone: { top: '#94a3b8', left: '#64748b', right: '#475569' },
  deepslate: { top: '#475569', left: '#334155', right: '#1e293b' },
  obsidian: { top: '#312e81', left: '#1e1b4b', right: '#0f0d24' },
  netherrack: { top: '#991b1b', left: '#7f1d1d', right: '#450a0a' },
  crimsonGrass: { top: '#e11d48', left: '#be123c', right: '#881337' },
  endStone: { top: '#fef08a', left: '#eab308', right: '#a16207' },
  water: { top: '#38bdf8', left: '#0284c7', right: '#0369a1' },
  lava: { top: '#fb923c', left: '#ea580c', right: '#c2410c', emissive: '#fdba74' },
  wood: { top: '#92400e', left: '#78350f', right: '#451a03' },
  plank: { top: '#d97706', left: '#b45309', right: '#92400e' },
  leaves: { top: '#22c55e', left: '#16a34a', right: '#166534' },
  gold: { top: '#fde047', left: '#eab308', right: '#ca8a04', emissive: '#fef08a' },
  emerald: { top: '#34d399', left: '#10b981', right: '#047857', emissive: '#6ee7b7' },
  diamond: { top: '#67e8f9', left: '#06b6d4', right: '#0e7490', emissive: '#a5f3fc' },
  crystal: { top: '#f0abfc', left: '#d946ef', right: '#a21caf', emissive: '#f5d0fe' },
  quartz: { top: '#f8fafc', left: '#e2e8f0', right: '#cbd5e1' },
  redWool: { top: '#f87171', left: '#ef4444', right: '#b91c1c' },
  blueWool: { top: '#60a5fa', left: '#3b82f6', right: '#1d4ed8' },
  snow: { top: '#ffffff', left: '#e2e8f0', right: '#cbd5e1' },
} as const;

type MaterialKey = keyof typeof MATERIALS;

export function buildWorldVoxels(spec: WorldPreviewSpec, seed: number): VoxelWorldScene {
  const gridSize = 18;
  const rng = createRng(seed);
  const blocks: VoxelBlock[] = [];
  const occupied = new Set<string>();

  const addBlock = (x: number, y: number, z: number, matKey: MaterialKey) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || z < 0 || z > 16) return;
    const key = `${x},${y},${z}`;
    if (occupied.has(key)) return;
    occupied.add(key);
    const mat = MATERIALS[matKey];
    blocks.push({
      x,
      y,
      z,
      top: mat.top,
      left: mat.left,
      right: mat.right,
      emissive: 'emissive' in mat ? mat.emissive : undefined,
    });
  };

  const addTree = (tx: number, ty: number, baseZ: number, crimson = false) => {
    addBlock(tx, ty, baseZ + 1, 'wood');
    addBlock(tx, ty, baseZ + 2, 'wood');
    const leafMat: MaterialKey = crimson ? 'crimsonGrass' : 'leaves';
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        addBlock(tx + dx, ty + dy, baseZ + 3, leafMat);
      }
    }
    addBlock(tx, ty, baseZ + 4, leafMat);
  };

  const arch = spec.primaryArchetype;
  const hasSecondary = (a: WorldBiomeArchetype) => spec.secondaryArchetypes.includes(a);
  const isVoidWorld = arch === 'skyblock' || arch === 'bedwars';

  if (arch === 'skyblock') {
    // Main floating island + side ore island + bridge + waterfall
    for (let x = 3; x <= 10; x++) {
      for (let y = 4; y <= 11; y++) {
        const dist = Math.hypot(x - 6.5, y - 7.5);
        if (dist <= 4.1) {
          addBlock(x, y, 5, 'grass');
          if (dist <= 3.1) addBlock(x, y, 4, 'dirt');
          if (dist <= 2.0) addBlock(x, y, 3, 'stone');
        }
      }
    }
    addTree(5, 6, 5, hasSecondary('lifesteal'));
    // Waterfall spilling off the edge
    for (let z = 1; z <= 5; z++) {
      addBlock(9, 10, z, 'water');
    }
    // Wool/plank bridge to secondary resource island
    for (let x = 10; x <= 13; x++) {
      addBlock(x, 7, 5, 'plank');
    }
    for (let x = 12; x <= 16; x++) {
      for (let y = 5; y <= 9; y++) {
        if (Math.hypot(x - 14, y - 7) <= 2.4) {
          addBlock(x, y, 5, hasSecondary('lifesteal') ? 'crimsonGrass' : 'stone');
          addBlock(x, y, 4, 'deepslate');
        }
      }
    }
    addBlock(14, 7, 6, hasSecondary('economy') ? 'emerald' : 'diamond');
    addBlock(7, 8, 6, 'lava');
  } else if (arch === 'bedwars') {
    // Central mid island + two team islands connected by colored wool bridges
    for (let x = 6; x <= 11; x++) {
      for (let y = 6; y <= 11; y++) {
        addBlock(x, y, 5, 'quartz');
        addBlock(x, y, 4, 'stone');
      }
    }
    addBlock(8, 8, 6, 'emerald');
    addBlock(9, 9, 6, 'emerald');
    // Red & Blue team islands
    for (let x = 1; x <= 4; x++) {
      for (let y = 7; y <= 10; y++) {
        addBlock(x, y, 5, 'redWool');
        addBlock(x, y, 4, 'stone');
      }
    }
    for (let x = 13; x <= 16; x++) {
      for (let y = 7; y <= 10; y++) {
        addBlock(x, y, 5, 'blueWool');
        addBlock(x, y, 4, 'stone');
      }
    }
    for (let x = 5; x <= 6; x++) addBlock(x, 8, 5, 'redWool');
    for (let x = 11; x <= 13; x++) addBlock(x, 9, 5, 'blueWool');
  } else if (arch === 'crystal_pvp') {
    // End-stone crater + towering obsidian pillars crowned with glowing End Crystals
    for (let x = 1; x < gridSize - 1; x++) {
      for (let y = 1; y < gridSize - 1; y++) {
        const d = Math.hypot(x - 8.5, y - 8.5);
        const h = d < 4.5 ? 2 : d < 7 ? 3 : 4;
        for (let z = 0; z <= h; z++) {
          addBlock(x, y, z, z === h ? 'endStone' : 'obsidian');
        }
      }
    }
    const pillars = [
      [4, 4, 8],
      [13, 5, 9],
      [5, 13, 7],
      [12, 12, 8],
    ];
    for (const [px, py, ph] of pillars) {
      for (let z = 3; z <= ph; z++) {
        addBlock(px, py, z, 'obsidian');
      }
      addBlock(px, py, ph + 1, 'crystal');
    }
  } else if (arch === 'lifesteal' || arch === 'anarchy') {
    const isAnarchy = arch === 'anarchy';
    for (let x = 1; x < gridSize - 1; x++) {
      for (let y = 1; y < gridSize - 1; y++) {
        const hill = Math.round(
          2 +
            Math.sin((x + seed % 7) * 0.45) * 1.3 +
            Math.cos((y + seed % 5) * 0.45) * 1.3
        );
        const topMat: MaterialKey = isAnarchy
          ? rng() > 0.55
            ? 'obsidian'
            : 'stone'
          : hill >= 4
          ? 'crimsonGrass'
          : 'deepslate';
        for (let z = 0; z <= hill; z++) {
          addBlock(x, y, z, z === hill ? topMat : 'netherrack');
        }
        if ((x === 8 || x === 9) && y > 3 && y < 14 && !isAnarchy) {
          addBlock(x, y, hill + 1, 'lava');
        }
      }
    }
    // Heart / Crimson Citadel spire
    for (let z = 3; z <= 8; z++) {
      addBlock(8, 8, z, 'obsidian');
      addBlock(9, 8, z, 'obsidian');
    }
    addBlock(8, 8, 9, isAnarchy ? 'lava' : 'crystal');
    addBlock(9, 8, 9, isAnarchy ? 'lava' : 'crystal');
    if (!isAnarchy) addTree(4, 5, 3, true);
  } else if (arch === 'prison') {
    // Tiered deep ore pit + surrounding industrial walls
    for (let x = 1; x < gridSize - 1; x++) {
      for (let y = 1; y < gridSize - 1; y++) {
        const edgeDist = Math.min(x - 1, y - 1, gridSize - 2 - x, gridSize - 2 - y);
        const zTop = edgeDist <= 1 ? 6 : edgeDist <= 3 ? 4 : 2;
        for (let z = 0; z <= zTop; z++) {
          let mat: MaterialKey = 'stone';
          if (zTop <= 2 && rng() > 0.65) mat = rng() > 0.5 ? 'diamond' : 'emerald';
          else if (zTop <= 4 && rng() > 0.72) mat = 'gold';
          else if (z === zTop && edgeDist <= 1) mat = 'deepslate';
          addBlock(x, y, z, mat);
        }
      }
    }
    addBlock(3, 3, 7, 'plank');
    addBlock(3, 3, 8, 'gold');
  } else {
    // Survival SMP, Factions, Economy, Creative
    const offset = seed % 11;
    for (let x = 1; x < gridSize - 1; x++) {
      for (let y = 1; y < gridSize - 1; y++) {
        const wave =
          Math.sin((x + offset) * 0.42) * 1.4 +
          Math.cos((y + offset) * 0.38) * 1.3;
        const h = Math.max(1, Math.min(6, Math.round(2.8 + wave)));
        const isRiver = Math.abs(x - y - 1) <= 1 && h <= 3;

        for (let z = 0; z <= h; z++) {
          let mat: MaterialKey = 'dirt';
          if (isRiver && z === h) mat = 'water';
          else if (z === h) {
            mat = h >= 5 ? 'snow' : arch === 'creative' ? 'quartz' : rng() > 0.5 ? 'grass' : 'darkGrass';
          } else if (z <= 1) mat = 'stone';
          addBlock(x, y, z, mat);
        }
      }
    }

    // Citadel / Keep / Vault Spire for Factions, Economy, or Survival Spawn
    const towerX = 7;
    const towerY = 6;
    const towerBase = 4;
    const towerMat: MaterialKey =
      arch === 'economy' ? 'quartz' : arch === 'factions' ? 'stone' : 'plank';
    for (let dx = 0; dx <= 2; dx++) {
      for (let dy = 0; dy <= 2; dy++) {
        const isCorner = (dx === 0 || dx === 2) && (dy === 0 || dy === 2);
        const topH = isCorner ? towerBase + 4 : towerBase + 3;
        for (let z = towerBase; z <= topH; z++) {
          addBlock(towerX + dx, towerY + dy, z, towerMat);
        }
      }
    }
    addBlock(towerX + 1, towerY + 1, towerBase + 5, arch === 'economy' ? 'emerald' : 'gold');
    if (hasSecondary('lifesteal') || hasSecondary('crystal_pvp')) {
      addBlock(towerX + 1, towerY + 1, towerBase + 6, 'crystal');
    }

    // Lush trees around terrain
    addTree(3, 11, 3, false);
    addTree(13, 4, 4, false);
    addTree(12, 13, 3, hasSecondary('lifesteal'));
  }

  // Sort strictly back-to-front for isometric painter's algorithm
  blocks.sort((a, b) => {
    const depthA = a.x + a.y;
    const depthB = b.x + b.y;
    if (depthA !== depthB) return depthA - depthB;
    return a.z - b.z;
  });

  return {
    gridSize,
    blocks,
    seed,
    isVoidWorld,
  };
}

function adjustHexColor(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * factor)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

export function renderWorldPreviewCanvas(
  canvas: HTMLCanvasElement,
  spec: WorldPreviewSpec,
  seed: number,
  lighting: MapLightingMode = 'golden'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const scene = buildWorldVoxels(spec, seed);

  // 1. Atmospheric Sky Gradient based on lighting + server biome palette
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  if (lighting === 'night') {
    skyGrad.addColorStop(0, '#05050a');
    skyGrad.addColorStop(0.65, '#111827');
    skyGrad.addColorStop(1, spec.palette.skyTop);
  } else if (lighting === 'day') {
    skyGrad.addColorStop(0, '#0c4a6e');
    skyGrad.addColorStop(0.55, spec.palette.skyBottom);
    skyGrad.addColorStop(1, '#bae6fd');
  } else {
    skyGrad.addColorStop(0, spec.palette.skyTop);
    skyGrad.addColorStop(0.6, spec.palette.skyBottom);
    skyGrad.addColorStop(1, '#fb923c');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Stars (night/golden) & Celestial Glow
  const rng = createRng(seed + 99);
  if (lighting !== 'day') {
    for (let i = 0; i < 64; i++) {
      const sx = rng() * w;
      const sy = rng() * (h * 0.55);
      const size = rng() > 0.8 ? 2 : 1.2;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + rng() * 0.6})`;
      ctx.fillRect(sx, sy, size, size);
    }
  }

  const sunX = w * 0.8;
  const sunY = h * 0.22;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 170);
  sunGrad.addColorStop(0, lighting === 'night' ? 'rgba(226,232,240,0.85)' : 'rgba(254,240,138,0.95)');
  sunGrad.addColorStop(0.35, lighting === 'night' ? 'rgba(148,163,184,0.22)' : 'rgba(251,146,60,0.3)');
  sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, w, h);

  // Volumetric Stylized Cloud Layers
  ctx.fillStyle =
    lighting === 'night' ? 'rgba(148,163,184,0.09)' : 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 190 + (seed % 120)) % (w + 120)) - 60;
    const cy = 54 + (i % 3) * 44;
    ctx.fillRect(cx, cy, 110 + (i % 2) * 40, 14);
    ctx.fillRect(cx + 22, cy - 8, 66, 8);
  }

  // 3. Isometric Voxel Diorama Projection
  const halfW = Math.round(w / 46);
  const halfH = Math.round(halfW * 0.52);
  const blockH = Math.round(halfW * 0.92);
  const originX = w * 0.5;
  const originY = h * 0.34;
  const shadeFactor = lighting === 'night' ? 0.68 : lighting === 'golden' ? 0.96 : 1.04;

  for (const b of scene.blocks) {
    const px = originX + (b.x - b.y) * halfW;
    const py = originY + (b.x + b.y) * halfH - b.z * blockH;

    const topCol = adjustHexColor(b.top, shadeFactor);
    const leftCol = adjustHexColor(b.left, shadeFactor * 0.92);
    const rightCol = adjustHexColor(b.right, shadeFactor * 0.82);

    // Top face
    ctx.beginPath();
    ctx.moveTo(px, py - halfH);
    ctx.lineTo(px + halfW, py);
    ctx.lineTo(px, py + halfH);
    ctx.lineTo(px - halfW, py);
    ctx.closePath();
    ctx.fillStyle = topCol;
    ctx.fill();

    // Left face
    ctx.beginPath();
    ctx.moveTo(px - halfW, py);
    ctx.lineTo(px, py + halfH);
    ctx.lineTo(px, py + halfH + blockH);
    ctx.lineTo(px - halfW, py + blockH);
    ctx.closePath();
    ctx.fillStyle = leftCol;
    ctx.fill();

    // Right face
    ctx.beginPath();
    ctx.moveTo(px + halfW, py);
    ctx.lineTo(px, py + halfH);
    ctx.lineTo(px, py + halfH + blockH);
    ctx.lineTo(px + halfW, py + blockH);
    ctx.closePath();
    ctx.fillStyle = rightCol;
    ctx.fill();

    // Subtle voxel edge highlights
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(px - halfW, py);
    ctx.lineTo(px, py - halfH);
    ctx.lineTo(px + halfW, py);
    ctx.stroke();

    // Emissive beacon / crystal halo
    if (b.emissive) {
      const halo = ctx.createRadialGradient(px, py, 2, px, py, halfW * 2.4);
      halo.addColorStop(0, `${b.emissive}88`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(px - halfW * 2.4, py - halfW * 2.4, halfW * 4.8, halfW * 4.8);
    }
  }

  // 4. Bottom Atmospheric Mist & Cinematic Framing Vignette
  const mist = ctx.createLinearGradient(0, h * 0.72, 0, h);
  mist.addColorStop(0, 'rgba(9,9,11,0)');
  mist.addColorStop(1, 'rgba(9,9,11,0.72)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
}
