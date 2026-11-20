export const DEFAULT_CHALLENGE_DIFFICULTY = 2;

/**
 * Computes a deterministic 64-bit FNV-1a digest formatted as 16 lowercase hex chars.
 * Uses two independent 32-bit FNV-1a lanes so it runs identically in browsers and Node.
 */
export function fnv1aHex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;

    h2 ^= (c + i) & 0xff;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }

  // Avalanche mix
  h1 ^= h2 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35) >>> 0;
  h2 ^= h1 >>> 15;
  h2 = Math.imul(h2, 0x27d4eb2f) >>> 0;

  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function normalizeChallengeDifficulty(raw: unknown): number {
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) return DEFAULT_CHALLENGE_DIFFICULTY;
  return Math.max(1, Math.min(4, Math.floor(num)));
}

export function verifyChallengeProof(
  nonce: string,
  counter: number,
  difficultyZeroNibbles: number
): boolean {
  if (!nonce || !Number.isInteger(counter) || counter < 0) return false;
  const diff = normalizeChallengeDifficulty(difficultyZeroNibbles);
  const digest = fnv1aHex(`${nonce}:${counter}`);
  return digest.startsWith('0'.repeat(diff));
}

export function solveChallengeProof(
  nonce: string,
  difficultyZeroNibbles: number,
  maxIterations = 250_000
): { counter: number; hashHex: string; iterations: number } | null {
  if (!nonce) return null;
  const diff = normalizeChallengeDifficulty(difficultyZeroNibbles);
  const targetPrefix = '0'.repeat(diff);

  for (let counter = 0; counter < maxIterations; counter++) {
    const hashHex = fnv1aHex(`${nonce}:${counter}`);
    if (hashHex.startsWith(targetPrefix)) {
      return { counter, hashHex, iterations: counter + 1 };
    }
  }
  return null;
}

export function generateRayId(seed?: string): string {
  if (seed) {
    return fnv1aHex(`ray:${seed}`);
  }
  const randomSeed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return fnv1aHex(randomSeed);
}
