import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorldVoxels,
  createSeedFromString,
  resolveWorldPreviewSpec,
} from './worldMapGenerator';

test('worldMapGenerator maps Skyblock and Survival tags to matching world archetypes and landmarks', () => {
  const sky = resolveWorldPreviewSpec('SkyRealm', 'play.skyrealm.net', ['Skyblock', 'Economy']);
  assert.equal(sky.primaryArchetype, 'skyblock');
  assert.deepEqual(sky.secondaryArchetypes, ['economy']);
  assert.ok(sky.title.includes('Sky'));
  assert.ok(sky.landmarks.some((l) => l.includes('Floating Starter Isle')));

  const smp = resolveWorldPreviewSpec('DonutSMP', 'donutsmp.net', ['Survival SMP', 'Lifesteal']);
  assert.equal(smp.primaryArchetype, 'survival');
  assert.deepEqual(smp.secondaryArchetypes, ['lifesteal']);

  const pvp = resolveWorldPreviewSpec('McPvP', 'mcpvp.club', ['Crystal PvP', 'KitPvP']);
  assert.equal(pvp.primaryArchetype, 'crystal_pvp');
  assert.ok(pvp.landmarks.some((l) => l.includes('End Crystals')));
});

test('worldMapGenerator builds deterministic back-to-front sorted voxel worlds', () => {
  const spec = resolveWorldPreviewSpec('SkyRealm', 'play.skyrealm.net', ['Skyblock']);
  const seed = createSeedFromString('play.skyrealm.net');

  const sceneA = buildWorldVoxels(spec, seed);
  const sceneB = buildWorldVoxels(spec, seed);
  assert.equal(sceneA.isVoidWorld, true);
  assert.ok(sceneA.blocks.length > 40);
  assert.deepEqual(sceneA.blocks, sceneB.blocks);

  // Verify painter's algorithm depth ordering (x + y non-decreasing, z non-decreasing within same depth)
  for (let i = 1; i < sceneA.blocks.length; i++) {
    const prev = sceneA.blocks[i - 1];
    const curr = sceneA.blocks[i];
    const prevDepth = prev.x + prev.y;
    const currDepth = curr.x + curr.y;
    assert.ok(currDepth >= prevDepth);
    if (currDepth === prevDepth) {
      assert.ok(curr.z >= prev.z);
    }
  }
});

test('worldMapGenerator falls back gracefully when server has no tags', () => {
  const fallback = resolveWorldPreviewSpec('Unnamed', 'example.net', []);
  assert.equal(fallback.primaryArchetype, 'survival');
  assert.deepEqual(fallback.tags, ['Survival SMP']);
  const scene = buildWorldVoxels(fallback, createSeedFromString('example.net'));
  assert.equal(scene.isVoidWorld, false);
  assert.ok(scene.blocks.length > 100);
});
