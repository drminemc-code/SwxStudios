export type SkinMotionMode = 'walk' | 'run' | 'wave' | 'spin' | 'idle';

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PartBoxFaces {
  right: PixelRect; // +X face (viewer left / right arm outer)
  left: PixelRect;  // -X face
  top: PixelRect;   // +Y face
  bottom: PixelRect;// -Y face
  front: PixelRect; // +Z face
  back: PixelRect;  // -Z face
}

export function normalizeMinecraftUsername(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
}

export function isValidMinecraftUsername(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /^[a-zA-Z0-9_]{1,16}$/.test(raw.trim());
}

export function deriveMinecraftIgnSuggestion(input: {
  mcUsername?: string;
  displayName?: string;
  email?: string;
}): string {
  const direct = normalizeMinecraftUsername(input.mcUsername);
  if (direct.length >= 2) return direct;

  const fromName = normalizeMinecraftUsername(input.displayName);
  if (fromName.length >= 2) return fromName;

  if (input.email && input.email.includes('@')) {
    const local = normalizeMinecraftUsername(input.email.split('@')[0]);
    if (local.length >= 2) return local;
  }

  return 'Steve';
}

export function buildMinecraftHeadAvatarUrl(
  username: string,
  options?: { size?: number; style?: '2d' | '3d'; origin?: string }
): string {
  const clean = normalizeMinecraftUsername(username) || 'Steve';
  const size = Math.max(16, Math.min(256, Math.round(options?.size ?? 128)));
  const styleQuery = options?.style === '3d' ? '&style=3d' : '';
  const path = `/api/mc/avatar/${encodeURIComponent(clean)}?s=${size}${styleQuery}`;
  if (options?.origin) {
    return `${options.origin.replace(/\/+$/, '')}${path}`;
  }
  return path;
}

export function buildMinecraftSkinTextureUrl(username: string): string {
  const clean = normalizeMinecraftUsername(username) || 'Steve';
  return `/api/mc/skin/${encodeURIComponent(clean)}`;
}

export function isMinecraftAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('/api/mc/avatar/') ||
    url.includes('mc-heads.net/avatar/') ||
    url.includes('mc-heads.net/head/') ||
    url.includes('minotar.net/')
  );
}

export function extractMinecraftUsernameFromAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const apiMatch = url.match(/\/api\/mc\/avatar\/([a-zA-Z0-9_]{1,16})/i);
  if (apiMatch?.[1]) return apiMatch[1];
  const mcHeadsMatch = url.match(/mc-heads\.net\/(?:avatar|head)\/([a-zA-Z0-9_]{1,16})/i);
  if (mcHeadsMatch?.[1]) return mcHeadsMatch[1];
  return null;
}

/**
 * Generates exact pixel sub-rectangles (in 64x64 UV skin space) for a Minecraft cuboidal limb/body part.
 * Convention matches Mojang's official 64x64 skin texture layout:
 *  - Right (+X): (u, v + d, d, h)
 *  - Left  (-X): (u + d + w, v + d, d, h)
 *  - Top   (+Y): (u + d, v, w, d)
 *  - Bottom(-Y): (u + d + w, v, w, d)
 *  - Front (+Z): (u + d, v + d, w, h)
 *  - Back  (-Z): (u + d + w + d, v + d, w, h)
 */
export function getSkinPartFaces(
  u: number,
  v: number,
  w: number,
  h: number,
  d: number
): PartBoxFaces {
  return {
    right: { x: u, y: v + d, w: d, h },
    left: { x: u + d + w, y: v + d, w: d, h },
    top: { x: u + d, y: v, w, h: d },
    bottom: { x: u + d + w, y: v, w, h: d },
    front: { x: u + d, y: v + d, w, h },
    back: { x: u + d + w + d, y: v + d, w, h },
  };
}

export interface CharacterSkinParts {
  head: PartBoxFaces;
  hat: PartBoxFaces;
  torso: PartBoxFaces;
  jacket: PartBoxFaces;
  rightArm: PartBoxFaces;
  rightSleeve: PartBoxFaces;
  leftArm: PartBoxFaces;
  leftSleeve: PartBoxFaces;
  rightLeg: PartBoxFaces;
  rightPants: PartBoxFaces;
  leftLeg: PartBoxFaces;
  leftPants: PartBoxFaces;
}

export function getCharacterSkinParts(slim: boolean): CharacterSkinParts {
  const armW = slim ? 3 : 4;
  return {
    head: getSkinPartFaces(0, 0, 8, 8, 8),
    hat: getSkinPartFaces(32, 0, 8, 8, 8),
    torso: getSkinPartFaces(16, 16, 8, 12, 4),
    jacket: getSkinPartFaces(16, 32, 8, 12, 4),
    rightArm: getSkinPartFaces(40, 16, armW, 12, 4),
    rightSleeve: getSkinPartFaces(40, 32, armW, 12, 4),
    leftArm: getSkinPartFaces(32, 48, armW, 12, 4),
    leftSleeve: getSkinPartFaces(48, 48, armW, 12, 4),
    rightLeg: getSkinPartFaces(0, 16, 4, 12, 4),
    rightPants: getSkinPartFaces(0, 32, 4, 12, 4),
    leftLeg: getSkinPartFaces(16, 48, 4, 12, 4),
    leftPants: getSkinPartFaces(0, 48, 4, 12, 4),
  };
}

/**
 * Converts a 64x64 pixel rectangle to Three.js normalized UV coordinates (with Y=0 at bottom of canvas).
 */
export function pixelRectToUvBounds(rect: PixelRect, texSize = 64): {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
} {
  return {
    u0: rect.x / texSize,
    u1: (rect.x + rect.w) / texSize,
    v0: 1 - (rect.y + rect.h) / texSize,
    v1: 1 - rect.y / texSize,
  };
}

/**
 * Pure helper computing swapped & horizontally flipped face mapping when mirroring a 64x64 Minecraft skin.
 * Returns pairs of `[targetRect, sourceRect, flipX]` so a 64x64 mirror canvas can mirror BOTH symmetric
 * center parts (Head, Hat, Torso, Jacket) AND swap+flip Right/Left Arms & Legs cleanly!
 */
export interface MirrorCopyInstruction {
  src: PixelRect;
  dst: PixelRect;
  flipX: boolean;
}

export function buildMirroredSkinPlan(slim: boolean): MirrorCopyInstruction[] {
  const srcParts = getCharacterSkinParts(slim);
  const instructions: MirrorCopyInstruction[] = [];

  const pushSymmetric = (faces: PartBoxFaces) => {
    instructions.push(
      { src: faces.front, dst: faces.front, flipX: true },
      { src: faces.back, dst: faces.back, flipX: true },
      { src: faces.top, dst: faces.top, flipX: true },
      { src: faces.bottom, dst: faces.bottom, flipX: true },
      // Swap left (+X / -X) and right sides horizontally
      { src: faces.right, dst: faces.left, flipX: true },
      { src: faces.left, dst: faces.right, flipX: true }
    );
  };

  const pushSwappedPair = (a: PartBoxFaces, b: PartBoxFaces) => {
    const mapAB = (from: PartBoxFaces, to: PartBoxFaces) => {
      instructions.push(
        { src: from.front, dst: to.front, flipX: true },
        { src: from.back, dst: to.back, flipX: true },
        { src: from.top, dst: to.top, flipX: true },
        { src: from.bottom, dst: to.bottom, flipX: true },
        { src: from.right, dst: to.left, flipX: true },
        { src: from.left, dst: to.right, flipX: true }
      );
    };
    mapAB(a, b);
    mapAB(b, a);
  };

  pushSymmetric(srcParts.head);
  pushSymmetric(srcParts.hat);
  pushSymmetric(srcParts.torso);
  pushSymmetric(srcParts.jacket);
  pushSwappedPair(srcParts.rightArm, srcParts.leftArm);
  pushSwappedPair(srcParts.rightSleeve, srcParts.leftSleeve);
  pushSwappedPair(srcParts.rightLeg, srcParts.leftLeg);
  pushSwappedPair(srcParts.rightPants, srcParts.leftPants);

  return instructions;
}

export function computeMotionAngles(
  mode: SkinMotionMode,
  phase: number
): {
  bodyYaw: number;
  bodyBob: number;
  bodyPitch: number;
  headYaw: number;
  headPitch: number;
  rightArmX: number;
  rightArmZ: number;
  leftArmX: number;
  leftArmZ: number;
  rightLegX: number;
  leftLegX: number;
} {
  switch (mode) {
    case 'walk': {
      const swing = Math.sin(phase) * 0.65;
      return {
        bodyYaw: Math.sin(phase * 0.35) * 0.14,
        bodyBob: Math.abs(Math.cos(phase)) * 0.035,
        bodyPitch: 0,
        headYaw: Math.sin(phase * 0.5) * 0.16,
        headPitch: Math.cos(phase * 0.5) * 0.04,
        rightArmX: -swing,
        rightArmZ: -0.05,
        leftArmX: swing,
        leftArmZ: 0.05,
        rightLegX: swing * 0.9,
        leftLegX: -swing * 0.9,
      };
    }
    case 'run': {
      const fastSwing = Math.sin(phase * 1.8) * 1.05;
      return {
        bodyYaw: Math.sin(phase * 0.4) * 0.12,
        bodyBob: Math.abs(Math.sin(phase * 1.8)) * 0.085,
        bodyPitch: 0.12,
        headYaw: Math.sin(phase * 0.5) * 0.1,
        headPitch: -0.08,
        rightArmX: -fastSwing,
        rightArmZ: -0.08,
        leftArmX: fastSwing,
        leftArmZ: 0.08,
        rightLegX: fastSwing * 1.05,
        leftLegX: -fastSwing * 1.05,
      };
    }
    case 'wave': {
      return {
        bodyYaw: Math.sin(phase * 0.4) * 0.12,
        bodyBob: Math.sin(phase * 1.2) * 0.015,
        bodyPitch: 0,
        headYaw: -0.14 + Math.sin(phase * 0.8) * 0.08,
        headPitch: -0.05,
        rightArmX: -2.55,
        rightArmZ: -0.35 + Math.sin(phase * 3.4) * 0.32,
        leftArmX: Math.sin(phase * 0.9) * 0.08,
        leftArmZ: 0.07,
        rightLegX: Math.sin(phase * 0.6) * 0.04,
        leftLegX: -Math.sin(phase * 0.6) * 0.04,
      };
    }
    case 'spin': {
      return {
        bodyYaw: phase * 0.85,
        bodyBob: Math.sin(phase * 1.5) * 0.02,
        bodyPitch: 0,
        headYaw: Math.sin(phase * 0.6) * 0.12,
        headPitch: 0,
        rightArmX: Math.sin(phase * 1.2) * 0.12,
        rightArmZ: -0.06,
        leftArmX: -Math.sin(phase * 1.2) * 0.12,
        leftArmZ: 0.06,
        rightLegX: 0,
        leftLegX: 0,
      };
    }
    case 'idle':
    default: {
      return {
        bodyYaw: Math.sin(phase * 0.3) * 0.08,
        bodyBob: Math.sin(phase * 1.2) * 0.012,
        bodyPitch: 0,
        headYaw: Math.sin(phase * 0.55) * 0.18,
        headPitch: Math.sin(phase * 0.4) * 0.05,
        rightArmX: Math.sin(phase * 1.2) * 0.05,
        rightArmZ: -0.04 - Math.abs(Math.sin(phase * 1.2)) * 0.02,
        leftArmX: -Math.sin(phase * 1.2) * 0.05,
        leftArmZ: 0.04 + Math.abs(Math.sin(phase * 1.2)) * 0.02,
        rightLegX: 0,
        leftLegX: 0,
      };
    }
  }
}
