import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fnv1aHex,
  generateRayId,
  normalizeChallengeDifficulty,
  solveChallengeProof,
  verifyChallengeProof,
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
