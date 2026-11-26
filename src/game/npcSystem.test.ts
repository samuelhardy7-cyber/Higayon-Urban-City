import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteriorBlueprintForEntrance } from './interiorData';
import { createInteriorDoorStates, resolveInteriorCollision } from './interiorSystem';
import {
  createInitialNpcs,
  createInteriorNpcs,
  isInteriorSpotClearForNpc,
  isOutdoorSpotClearForNpc,
  NPC_RADIUS,
  stepInteriorNpcs,
  stepNpcs,
} from './npcSystem';
import { createInitialPlayerState, resolvePlayerVsNpcs } from './playerPhysics';
import { createInitialPlayerQuizProgress, createSeedQuestionDatabase } from './questionBank';
import { createInteriorKioskPlacements, OUTDOOR_KIOSK_ANCHORS } from './questionPlacement';
import { CITY_LAYOUT, resolveCircleAABBCollision } from './worldData';

test('all outdoor NPCs spawn clear of buildings, spawn plaza, entrances, and kiosks', () => {
  const npcs = createInitialNpcs(CITY_LAYOUT);
  assert.ok(npcs.length >= 12);

  for (const npc of npcs) {
    const check = resolveCircleAABBCollision(npc.x, npc.z, NPC_RADIUS, npc.y, 1.75, CITY_LAYOUT);
    assert.equal(check.collided, false, `NPC ${npc.id} spawned overlapping a collider`);
    assert.ok(
      Math.hypot(npc.x - CITY_LAYOUT.spawn.x, npc.z - CITY_LAYOUT.spawn.z) >= 3.0,
      `NPC ${npc.id} spawned too close to player spawn`,
    );
    for (const ent of CITY_LAYOUT.entrances) {
      const frontX = ent.doorX + Math.sin(ent.yaw) * 1.15;
      const frontZ = ent.doorZ + Math.cos(ent.yaw) * 1.15;
      assert.ok(
        Math.hypot(npc.x - frontX, npc.z - frontZ) >= 2.1,
        `NPC ${npc.id} spawned blocking entrance ${ent.name}`,
      );
    }
    for (const k of OUTDOOR_KIOSK_ANCHORS) {
      assert.ok(
        Math.hypot(npc.x - k.x, npc.z - k.z) >= 2.0,
        `NPC ${npc.id} spawned too close to kiosk ${k.id}`,
      );
    }
  }
});

test('outdoor NPCs patrol sidewalks, pause clear of doors, and steer smoothly around player', () => {
  const npcs = createInitialNpcs(CITY_LAYOUT);
  const startPos = npcs.map((n) => ({ x: n.x, z: n.z }));
  let sawPause = false;

  for (let frame = 0; frame < 420; frame++) {
    stepNpcs(npcs, 0.05, 999, 999, CITY_LAYOUT);
    for (const npc of npcs) {
      if (npc.isPaused) {
        sawPause = true;
        assert.equal(
          isOutdoorSpotClearForNpc(npc.x, npc.z, npc.y, CITY_LAYOUT),
          true,
          `NPC ${npc.id} paused inside an obstructed/door zone`,
        );
      }
      const check = resolveCircleAABBCollision(npc.x, npc.z, NPC_RADIUS, npc.y, 1.75, CITY_LAYOUT);
      assert.equal(check.collided, false, `NPC ${npc.id} clipped into collider at (${npc.x}, ${npc.z})`);
    }
  }

  assert.equal(sawPause, true, 'NPCs should pause occasionally while patrolling');
  const movedCount = npcs.filter(
    (n, idx) => Math.hypot(n.x - startPos[idx].x, n.z - startPos[idx].z) > 1.0,
  ).length;
  assert.ok(movedCount >= npcs.length - 2, 'NPCs should travel along their sidewalk routes');

  // Verify player-in-front causes lateral dodge rather than hard stalling
  const targetNpc = npcs[0];
  targetNpc.pauseTimer = 0;
  targetNpc.isPaused = false;
  const fwdX = -Math.sin(targetNpc.yaw);
  const fwdZ = -Math.cos(targetNpc.yaw);
  const px = targetNpc.x + fwdX * 1.1;
  const pz = targetNpc.z + fwdZ * 1.1;
  const bx = targetNpc.x;
  const bz = targetNpc.z;
  for (let f = 0; f < 25; f++) {
    stepNpcs(npcs, 0.05, px, pz, CITY_LAYOUT);
  }
  assert.ok(
    Math.hypot(targetNpc.x - bx, targetNpc.z - bz) > 0.35,
    'NPC should steer around player rather than freezing in their path',
  );
});

test('interior NPCs inhabit diverse buildings cleanly without blocking spawn, doors, stairs, elevators, or kiosks', () => {
  const db = createSeedQuestionDatabase();
  const progress = createInitialPlayerQuizProgress();
  const targetSubtypes = ['mall', 'corporate', 'reward_shop', 'airport_terminal', 'restaurant', 'apartment'];

  for (const subtype of targetSubtypes) {
    const entrance = CITY_LAYOUT.entrances.find((e) => e.subtype === subtype) ?? CITY_LAYOUT.entrances[0];
    const blueprint = createInteriorBlueprintForEntrance(entrance);
    const doors = createInteriorDoorStates(blueprint);
    const kiosks = createInteriorKioskPlacements(blueprint, entrance, db, progress);
    const intNpcs = createInteriorNpcs(blueprint, doors, kiosks);

    assert.ok(intNpcs.length >= 2, `Expected interior NPCs inside ${entrance.name} (${subtype})`);

    for (const npc of intNpcs) {
      const clear = isInteriorSpotClearForNpc(npc.x, npc.y, npc.z, blueprint, doors, kiosks, {
        ignoreFurnitureCollision: npc.activity === 'sitting',
      });
      assert.equal(clear, true, `Interior NPC ${npc.id} invalid placement in ${entrance.name}`);

      if (npc.activity !== 'sitting') {
        const col = resolveInteriorCollision(
          npc.x,
          npc.z,
          NPC_RADIUS,
          npc.y,
          1.75,
          blueprint,
          doors,
          null,
        );
        assert.equal(col.collided, false, `Interior NPC ${npc.id} collided with interior geometry`);
      }
    }

    // Step interior NPCs and ensure walking NPCs patrol safely and yield to player
    const walkers = intNpcs.filter((n) => n.patrolPoints && n.patrolPoints.length >= 2);
    const walkStart = walkers.map((n) => ({ x: n.x, z: n.z }));
    const player = createInitialPlayerState();
    player.x = blueprint.spawn.x;
    player.y = blueprint.spawn.y;
    player.z = blueprint.spawn.z;

    for (let f = 0; f < 160; f++) {
      stepInteriorNpcs(intNpcs, 0.05, player.x, player.y, player.z, blueprint, doors, kiosks);
      resolvePlayerVsNpcs(player, intNpcs, NPC_RADIUS, { playerYieldWeight: 0.15 });
    }

    if (walkers.length > 0) {
      const anyMoved = walkers.some(
        (n, idx) => Math.hypot(n.x - walkStart[idx].x, n.z - walkStart[idx].z) > 0.35,
      );
      assert.equal(anyMoved, true, `Expected patrolling interior NPCs to walk in ${entrance.name}`);
    }
  }
});
