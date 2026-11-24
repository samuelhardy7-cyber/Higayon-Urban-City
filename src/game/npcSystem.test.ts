import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialNpcs, NPC_RADIUS, stepNpcs } from './npcSystem';
import { CITY_LAYOUT, resolveCircleAABBCollision } from './worldData';

test('all NPCs spawn on sidewalks with zero building collision overlap', () => {
  const npcs = createInitialNpcs(CITY_LAYOUT);
  assert.ok(npcs.length >= 12);

  for (const npc of npcs) {
    const check = resolveCircleAABBCollision(npc.x, npc.z, NPC_RADIUS, npc.y, 1.75, CITY_LAYOUT);
    assert.equal(check.collided, false, `NPC ${npc.id} spawned overlapping a collider`);
  }
});

test('NPCs walk along sidewalk loops, pause periodically, and never enter buildings', () => {
  const npcs = createInitialNpcs(CITY_LAYOUT);
  const startPos = npcs.map((n) => ({ x: n.x, z: n.z }));
  let sawPause = false;

  for (let frame = 0; frame < 420; frame++) {
    stepNpcs(npcs, 0.05, 999, 999, CITY_LAYOUT);
    for (const npc of npcs) {
      if (npc.isPaused) sawPause = true;
      const check = resolveCircleAABBCollision(npc.x, npc.z, NPC_RADIUS, npc.y, 1.75, CITY_LAYOUT);
      assert.equal(check.collided, false, `NPC ${npc.id} clipped into collider at (${npc.x}, ${npc.z})`);
    }
  }

  assert.equal(sawPause, true, 'NPCs should pause occasionally while patrolling');
  const movedCount = npcs.filter(
    (n, idx) => Math.hypot(n.x - startPos[idx].x, n.z - startPos[idx].z) > 1.0,
  ).length;
  assert.ok(movedCount >= npcs.length - 2, 'NPCs should travel along their sidewalk routes');
});
