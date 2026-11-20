import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMinecraftHeadAvatarUrl,
  buildMinecraftSkinTextureUrl,
  buildMirroredSkinPlan,
  computeMotionAngles,
  deriveMinecraftIgnSuggestion,
  extractMinecraftUsernameFromAvatarUrl,
  getCharacterSkinParts,
  isMinecraftAvatarUrl,
  isValidMinecraftUsername,
  normalizeMinecraftUsername,
  pixelRectToUvBounds,
  POPULAR_MINECRAFT_HEADS,
  resolveAuthMinecraftAvatarChoice,
} from './skinLogic';

test('normalizeMinecraftUsername and isValidMinecraftUsername handle valid & invalid IGNs', () => {
  assert.equal(normalizeMinecraftUsername(' @Notch '), 'Notch');
  assert.equal(normalizeMinecraftUsername('Dream_123!@#'), 'Dream_123');
  assert.equal(isValidMinecraftUsername('Technoblade'), true);
  assert.equal(isValidMinecraftUsername('TooLongMinecraftName17'), false);
  assert.equal(isValidMinecraftUsername('bad name'), false);
});

test('deriveMinecraftIgnSuggestion picks mcUsername, then displayName, then email local-part', () => {
  assert.equal(deriveMinecraftIgnSuggestion({ mcUsername: 'Dream', displayName: 'Notch' }), 'Dream');
  assert.equal(deriveMinecraftIgnSuggestion({ displayName: 'SwxBuilder', email: 'test@swx.io' }), 'SwxBuilder');
  assert.equal(deriveMinecraftIgnSuggestion({ displayName: '', email: 'herobrine@craft.net' }), 'herobrine');
  assert.equal(deriveMinecraftIgnSuggestion({}), 'Steve');
});

test('buildMinecraftHeadAvatarUrl and extraction round-trip cleanly', () => {
  const url = buildMinecraftHeadAvatarUrl('Notch', { size: 128, style: '2d', origin: 'https://swx.test' });
  assert.equal(url, 'https://swx.test/api/mc/avatar/Notch?s=128');
  assert.equal(isMinecraftAvatarUrl(url), true);
  assert.equal(extractMinecraftUsernameFromAvatarUrl(url), 'Notch');
  assert.equal(buildMinecraftSkinTextureUrl('Dinnerbone'), '/api/mc/skin/Dinnerbone');
});

test('resolveAuthMinecraftAvatarChoice handles signup, signin, 3d head style, and opt-out', () => {
  assert.equal(POPULAR_MINECRAFT_HEADS.length >= 5, true);
  assert.equal(
    resolveAuthMinecraftAvatarChoice({
      mode: 'signup',
      useMcHeadAvatar: false,
      mcUsername: 'Notch',
    }),
    null
  );
  assert.equal(
    resolveAuthMinecraftAvatarChoice({
      mode: 'signup',
      useMcHeadAvatar: true,
      displayName: 'SwxBuilder',
      style: '3d',
      origin: 'https://swx.test',
    }),
    'https://swx.test/api/mc/avatar/SwxBuilder?s=128&style=3d'
  );
  assert.equal(
    resolveAuthMinecraftAvatarChoice({
      mode: 'signin',
      useMcHeadAvatar: true,
      mcUsername: '',
      email: 'dream@smp.net',
      style: '2d',
      origin: 'https://swx.test',
    }),
    'https://swx.test/api/mc/avatar/dream?s=128'
  );
});

test('getCharacterSkinParts returns exact Mojang 64x64 UV rectangles for classic and slim models', () => {
  const classic = getCharacterSkinParts(false);
  assert.deepEqual(classic.head.front, { x: 8, y: 8, w: 8, h: 8 });
  assert.deepEqual(classic.rightArm.front, { x: 44, y: 20, w: 4, h: 12 });
  assert.deepEqual(classic.leftArm.front, { x: 36, y: 52, w: 4, h: 12 });

  const slim = getCharacterSkinParts(true);
  assert.equal(slim.rightArm.front.w, 3);
  assert.equal(slim.leftArm.front.w, 3);
});

test('pixelRectToUvBounds maps top-down PNG pixels to normalized WebGL V coordinates', () => {
  const uv = pixelRectToUvBounds({ x: 8, y: 8, w: 8, h: 8 }, 64);
  assert.equal(uv.u0, 8 / 64);
  assert.equal(uv.u1, 16 / 64);
  assert.equal(uv.v0, 1 - 16 / 64);
  assert.equal(uv.v1, 1 - 8 / 64);
});

test('buildMirroredSkinPlan swaps right/left limbs and stays within 64x64 texture bounds', () => {
  const plan = buildMirroredSkinPlan(false);
  // 12 parts * 6 faces = 72 instructions
  assert.equal(plan.length, 72);
  for (const step of plan) {
    assert.ok(step.src.x >= 0 && step.src.x + step.src.w <= 64);
    assert.ok(step.src.y >= 0 && step.src.y + step.src.h <= 64);
    assert.ok(step.dst.x >= 0 && step.dst.x + step.dst.w <= 64);
    assert.ok(step.dst.y >= 0 && step.dst.y + step.dst.h <= 64);
  }
  const hasRightArmToLeft = plan.some(
    (s) => s.src.x === 44 && s.src.y === 20 && s.dst.x === 36 && s.dst.y === 52
  );
  assert.equal(hasRightArmToLeft, true);
});

test('computeMotionAngles produces distinct kinematic poses across walk, run, wave, spin, idle', () => {
  const walk = computeMotionAngles('walk', Math.PI / 2);
  const run = computeMotionAngles('run', Math.PI / 4);
  const wave = computeMotionAngles('wave', 1.0);
  const spin = computeMotionAngles('spin', 2.0);
  assert.ok(Math.abs(walk.rightLegX) > 0.4);
  assert.ok(run.bodyPitch > 0.05);
  assert.ok(wave.rightArmX < -2.0);
  assert.ok(Math.abs(spin.bodyYaw) > 1.0);
});
