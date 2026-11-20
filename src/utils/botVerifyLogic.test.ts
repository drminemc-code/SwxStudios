import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalShieldToken,
  fnv1aHex,
  generateRayId,
  isLocalShieldToken,
  normalizeChallengeDifficulty,
  solveChallengeProof,
  SWX_SHIELD_LOCAL_TTL_MS,
  verifyChallengeProof,
  verifyLocalShieldToken,
} from './botVerifyLogic';

test('fnv1aHex produces deterministic 16-char lowercase hex digests', () => {
  const a = fnv1aHex('swx-nonce-1:42');
  const b = fnv1aHex('swx-nonce-1:42');
  const c = fnv1aHex('swx-nonce-1:43');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{16}$/);
});

test('solveChallengeProof and verifyChallengeProof round-trip cleanly', () => {
  const nonce = 'test-nonce-9f8e7d6c';
  const solved = solveChallengeProof(nonce, 2);
  assert.ok(solved);
  assert.ok(solved.hashHex.startsWith('00'));
  assert.equal(verifyChallengeProof(nonce, solved.counter, 2), true);
  assert.equal(verifyChallengeProof(nonce, solved.counter + 1, 2), false);
  assert.equal(verifyChallengeProof('wrong-nonce', solved.counter, 2), false);
  assert.equal(verifyChallengeProof(nonce, -1, 2), false);
});

test('normalizeChallengeDifficulty clamps within 1..4', () => {
  assert.equal(normalizeChallengeDifficulty(0), 1);
  assert.equal(normalizeChallengeDifficulty(3), 3);
  assert.equal(normalizeChallengeDifficulty(99), 4);
  assert.equal(normalizeChallengeDifficulty('bad'), 2);
});

test('generateRayId formats a valid 16-hex Cloudflare-style Ray ID', () => {
  const ray = generateRayId('session-abc');
  assert.match(ray, /^[0-9a-f]{16}$/);
  assert.equal(ray, generateRayId('session-abc'));
  assert.match(generateRayId(), /^[0-9a-f]{16}$/);
});

test('createLocalShieldToken & verifyLocalShieldToken validate PoW, expiry, and integrity', () => {
  const nonce = 'fallback-nonce-123';
  const solved = solveChallengeProof(nonce, 2);
  assert.ok(solved);

  const now = 1_700_000_000_000;
  const ray = generateRayId(nonce);
  const token = createLocalShieldToken(nonce, solved.counter, ray, now);

  assert.equal(isLocalShieldToken(token), true);
  assert.equal(isLocalShieldToken('not-local-token'), false);

  const ok = verifyLocalShieldToken(token, now + 5_000);
  assert.equal(ok.valid, true);
  assert.equal(ok.rayId, ray);

  // Expired after 24h TTL
  const expired = verifyLocalShieldToken(token, now + SWX_SHIELD_LOCAL_TTL_MS + 1);
  assert.equal(expired.valid, false);

  // Tampered payload rejected
  const tampered = token.replace(ray, 'ffffffffffffffff');
  assert.equal(verifyLocalShieldToken(tampered, now + 5_000).valid, false);
});
