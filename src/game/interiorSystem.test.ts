import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_BUILDING_SUBTYPES, createInteriorBlueprintForEntrance } from './interiorData.ts';
import {
  createInteriorDoorStates,
  findNearestExteriorEntrance,
  findNearestInteriorInteractable,
  findSafeOutdoorExitPos,
  getInteriorFloorAndCeilingAt,
  raycastInteriorCamera,
  resolveInteriorCollision,
  stepInteriorDoors,
} from './interiorSystem.ts';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from './playerPhysics.ts';
import type { BuildingCategory } from './types.ts';
import { CITY_LAYOUT } from './worldData.ts';

test('CITY_LAYOUT.entrances covers all 4 categories and all 12 building subtypes without decorative skyline doors', () => {
  const categories = new Set<BuildingCategory>(CITY_LAYOUT.entrances.map((e) => e.category));
  assert.deepEqual(
    [...categories].sort(),
    ['business', 'commercial', 'industrial', 'residential'],
  );

  const subtypes = new Set(CITY_LAYOUT.entrances.map((e) => e.subtype));
  for (const st of ALL_BUILDING_SUBTYPES) {
    assert.ok(subtypes.has(st), `Expected CITY_LAYOUT.entrances to include subtype "${st}"`);
  }

  for (const ent of CITY_LAYOUT.entrances) {
    assert.ok(
      !ent.buildingId.startsWith('dt_fin_'),
      `Decorative skyline building ${ent.buildingId} must not have an entrance`,
    );
  }
});

test('every enterable building creates a valid InteriorBlueprint with furnished rooms, exit door, and safe spawn', () => {
  for (const ent of CITY_LAYOUT.entrances) {
    const bp = createInteriorBlueprintForEntrance(ent);
    const doors = createInteriorDoorStates(bp);

    assert.ok(bp.floorSlabs.length >= 1, `${ent.id} should have at least 1 floor slab`);
    assert.ok(bp.walls.length >= 4, `${ent.id} should have perimeter walls`);
    assert.ok(bp.furniture.length >= 4, `${ent.id} should have interior furniture`);
    assert.ok(bp.lights.length >= 1, `${ent.id} should have interior lighting`);

    const exitDoors = doors.filter((d) => d.isExitDoor);
    assert.equal(exitDoors.length, 1, `${ent.id} should have exactly 1 exit door`);

    // Spawn must sit cleanly inside bounds without immediate collision
    const spawnCol = resolveInteriorCollision(
      bp.spawn.x,
      bp.spawn.z,
      PLAYER_RADIUS,
      bp.spawn.y,
      PLAYER_HEIGHT,
      bp,
      doors,
    );
    assert.equal(
      spawnCol.collided,
      false,
      `${ent.id} spawn (${bp.spawn.x}, ${bp.spawn.z}) must not collide with walls/furniture`,
    );

    const floorInfo = getInteriorFloorAndCeilingAt(bp.spawn.x, bp.spawn.y, bp.spawn.z, bp);
    assert.equal(floorInfo.currentFloor, 1, `${ent.id} spawn should be on Floor 1`);
    assert.ok(floorInfo.ceilingY >= bp.spawn.y + 2.8, `${ent.id} spawn should have sufficient headroom`);
  }
});

test('exterior entrance detection finds Urban Mart across City Avenue and exits safely outdoors', () => {
  const urbanMart = CITY_LAYOUT.entrances.find((e) => e.buildingId === 'urban_mart');
  assert.ok(urbanMart, 'Urban Mart entrance must exist');

  // Stand just outside Urban Mart door (doorX = 9.8, yaw = -PI/2 -> outward -X)
  const found = findNearestExteriorEntrance(8.9, 16.0, CITY_LAYOUT.entrances);
  assert.equal(found?.id, urbanMart.id);

  // Too far away -> null
  const far = findNearestExteriorEntrance(0, 16.0, CITY_LAYOUT.entrances);
  assert.equal(far, null);

  // Safe outdoor exit pos is strictly outside urban_mart collider
  const safeOut = findSafeOutdoorExitPos(urbanMart, CITY_LAYOUT);
  const martCol = CITY_LAYOUT.colliders.find((c) => c.id === 'urban_mart');
  assert.ok(martCol, 'Urban Mart collider must exist');
  const insideCollider =
    safeOut.x > martCol.minX - PLAYER_RADIUS &&
    safeOut.x < martCol.maxX + PLAYER_RADIUS &&
    safeOut.z > martCol.minZ - PLAYER_RADIUS &&
    safeOut.z < martCol.maxZ + PLAYER_RADIUS;
  assert.equal(insideCollider, false, 'Outdoor exit spawn must not intersect Urban Mart collider');
});

test('closed interior partition door blocks passage and open door permits passage', () => {
  const urbanMart = CITY_LAYOUT.entrances.find((e) => e.buildingId === 'urban_mart');
  assert.ok(urbanMart);
  const bp = createInteriorBlueprintForEntrance(urbanMart);
  const doors = createInteriorDoorStates(bp);
  const partitionDoor = doors.find((d) => !d.isExitDoor);
  assert.ok(partitionDoor, 'Urban Mart should have a stockroom partition door');

  // Compute midpoint of the closed door leaf
  const midX = partitionDoor.hingeX + Math.cos(partitionDoor.closedYaw) * partitionDoor.width * 0.5;
  const midZ = partitionDoor.hingeZ - Math.sin(partitionDoor.closedYaw) * partitionDoor.width * 0.5;

  // When closed, attempting to stand directly in the doorway must collide
  const closedHit = resolveInteriorCollision(
    midX,
    midZ,
    PLAYER_RADIUS,
    partitionDoor.y,
    PLAYER_HEIGHT,
    bp,
    doors,
  );
  assert.equal(closedHit.collided, true, 'Closed partition door must block passage');

  // Open the door fully over simulated frames
  partitionDoor.isOpen = true;
  for (let i = 0; i < 30; i++) {
    stepInteriorDoors(doors, 0.05);
  }
  assert.equal(partitionDoor.openProgress, 1);

  // Now standing in the doorway should pass freely
  const openPass = resolveInteriorCollision(
    midX,
    midZ,
    PLAYER_RADIUS,
    partitionDoor.y,
    PLAYER_HEIGHT,
    bp,
    doors,
  );
  assert.equal(openPass.collided, false, 'Fully open partition door must allow walking through');
});

test('multi-floor staircases smoothly interpolate height and upper floor slabs support standing', () => {
  const multiFloorSubtypes = ['modern_house', 'apartment', 'mall', 'office', 'corporate', 'warehouse', 'factory'];

  for (const subtype of multiFloorSubtypes) {
    const ent = CITY_LAYOUT.entrances.find((e) => e.subtype === subtype);
    assert.ok(ent, `Expected entrance for multi-floor subtype ${subtype}`);
    const bp = createInteriorBlueprintForEntrance(ent);
    assert.ok(bp.floorsCount >= 2, `${subtype} should have >= 2 floors`);
    assert.ok(bp.staircases.length >= 1, `${subtype} should have at least 1 staircase`);

    const st = bp.staircases[0];
    const midX = (st.minX + st.maxX) * 0.5;
    const midZ = (st.minZ + st.maxZ) * 0.5;
    const startInfo = getInteriorFloorAndCeilingAt(
      st.axis === 'x' ? (st.direction === 1 ? st.minX + 0.05 : st.maxX - 0.05) : midX,
      st.yStart,
      st.axis === 'z' ? (st.direction === 1 ? st.minZ + 0.05 : st.maxZ - 0.05) : midZ,
      bp,
    );
    const midInfo = getInteriorFloorAndCeilingAt(midX, (st.yStart + st.yEnd) * 0.5, midZ, bp);
    const endInfo = getInteriorFloorAndCeilingAt(
      st.axis === 'x' ? (st.direction === 1 ? st.maxX - 0.05 : st.minX + 0.05) : midX,
      st.yEnd,
      st.axis === 'z' ? (st.direction === 1 ? st.maxZ - 0.05 : st.minZ + 0.05) : midZ,
      bp,
    );

    assert.equal(startInfo.onStairs, true);
    assert.equal(midInfo.onStairs, true);
    assert.ok(
      midInfo.floorY > startInfo.floorY + 0.8 && midInfo.floorY < endInfo.floorY - 0.8,
      `${subtype} stair ramp should smoothly interpolate height (${startInfo.floorY} < ${midInfo.floorY} < ${endInfo.floorY})`,
    );

    const floor2Slab = bp.floorSlabs.find((s) => s.floorNumber === 2);
    assert.ok(floor2Slab, `${subtype} should have a Floor 2 slab`);
    const f2CenterX = (floor2Slab.minX + floor2Slab.maxX) * 0.5;
    const f2CenterZ = (floor2Slab.minZ + floor2Slab.maxZ) * 0.5;
    const f2Info = getInteriorFloorAndCeilingAt(f2CenterX, floor2Slab.y, f2CenterZ, bp);
    assert.equal(f2Info.currentFloor, 2);
    assert.ok(f2Info.ceilingY >= floor2Slab.y + 2.5);
  }
});

import {
  callElevatorToFloor,
  createElevatorRuntimeState,
  selectElevatorFloor,
  stepElevatorRuntime,
} from './elevatorSystem.ts';

test('elevators exist on 3-floor apartment and CITY TOWER 22F with call/panel interactables', () => {
  const apartmentEnt = CITY_LAYOUT.entrances.find((e) => e.subtype === 'apartment');
  const towerEnt = CITY_LAYOUT.entrances.find((e) => e.buildingId === 'freedom_tower');
  assert.ok(apartmentEnt && towerEnt);

  for (const [ent, expectedFloors] of [
    [apartmentEnt, 3],
    [towerEnt, 22],
  ] as const) {
    const bp = createInteriorBlueprintForEntrance(ent);
    const doors = createInteriorDoorStates(bp);
    assert.equal(bp.floorsCount, expectedFloors, `${ent.buildingId} floor count`);
    assert.ok(bp.elevators.length >= 1, `${ent.buildingId} must have an elevator`);
    const el = bp.elevators[0];
    assert.equal(el.floors.length, expectedFloors);

    const elevState = createElevatorRuntimeState(el, 1);
    const nearEl = findNearestInteriorInteractable(el.x, el.floors[0].y, el.z + 1.6, bp, doors, 1, elevState);
    assert.equal(nearEl?.kind, 'elevator');

    const inCabin = findNearestInteriorInteractable(el.x, el.floors[0].y, el.z, bp, doors, 1, elevState);
    assert.equal(inCabin?.kind, 'elevator_panel');

    const exitDoor = doors.find((d) => d.isExitDoor)!;
    const exitMidX = exitDoor.hingeX + Math.cos(exitDoor.closedYaw) * exitDoor.width * 0.5;
    const exitMidZ = exitDoor.hingeZ - Math.sin(exitDoor.closedYaw) * exitDoor.width * 0.5;
    const nearExit = findNearestInteriorInteractable(exitMidX, exitDoor.y, exitMidZ - 0.9, bp, doors, 1);
    assert.equal(nearExit?.kind, 'building_exit');
  }
});

test('CITY TOWER 22F switchback stairs reach Floor 22 Open-Air Rooftop and elevator doors lock during motion', () => {
  const towerEnt = CITY_LAYOUT.entrances.find((e) => e.buildingId === 'freedom_tower');
  assert.ok(towerEnt);
  const bp = createInteriorBlueprintForEntrance(towerEnt);
  const doors = createInteriorDoorStates(bp);

  assert.equal(bp.staircases.length, 42); // 21 floor transitions * 2 switchback flights each
  const topSlab = bp.floorSlabs.find((s) => s.floorNumber === 22);
  assert.ok(topSlab);
  assert.equal(topSlab.hasOpenSky, true);

  const rooftopInfo = getInteriorFloorAndCeilingAt(0, topSlab.y, 0, bp);
  assert.equal(rooftopInfo.currentFloor, 22);
  assert.equal(rooftopInfo.hasOpenSky, true);
  assert.ok(rooftopInfo.ceilingY > topSlab.y + 10);

  // Mid-landing check on Floor 1->2 switchback stairs
  const flight1 = bp.staircases[0];
  assert.ok(flight1.midLanding);
  const ml = flight1.midLanding!;
  const mlInfo = getInteriorFloorAndCeilingAt(
    (ml.minX + ml.maxX) * 0.5,
    ml.y,
    (ml.minZ + ml.maxZ) * 0.5,
    bp,
  );
  assert.equal(mlInfo.onStairs, true);
  assert.ok(Math.abs(mlInfo.floorY - ml.y) < 0.05);

  // Elevator door collision: locked while moving, passable when doors open on same floor
  const el = bp.elevators[0];
  const elevState = createElevatorRuntimeState(el, 1);
  callElevatorToFloor(elevState, 1, el.floors);
  for (let i = 0; i < 30; i++) {
    stepElevatorRuntime(elevState, 0.05, el.floors);
  }
  assert.equal(elevState.doorState, 'open');

  // Step through open doorway from outside
  const openRes = resolveInteriorCollision(
    el.x,
    el.z + el.depth * 0.5 - 0.1,
    PLAYER_RADIUS,
    0,
    PLAYER_HEIGHT,
    bp,
    doors,
    elevState,
  );
  assert.equal(openRes.collided, false);

  // Send elevator to Floor 12 -> doors close & block doorway from Floor 1
  selectElevatorFloor(elevState, 12, el.floors);
  for (let i = 0; i < 40; i++) {
    stepElevatorRuntime(elevState, 0.05, el.floors);
  }
  const closedHit = resolveInteriorCollision(
    el.x,
    el.z + el.depth * 0.5,
    PLAYER_RADIUS,
    0,
    PLAYER_HEIGHT,
    bp,
    doors,
    elevState,
  );
  assert.equal(closedHit.collided, true);
});

test('raycastInteriorCamera clamps indoor camera strictly within room bounds and below ceiling', () => {
  const ent = CITY_LAYOUT.entrances.find((e) => e.subtype === 'small_house');
  assert.ok(ent);
  const bp = createInteriorBlueprintForEntrance(ent);
  const floorInfo = getInteriorFloorAndCeilingAt(bp.spawn.x, bp.spawn.y, bp.spawn.z, bp);

  // Attempt to place camera outside perimeter wall & above ceiling
  const cam = raycastInteriorCamera(
    bp.spawn.x,
    bp.spawn.y + 1.38,
    bp.spawn.z,
    bp.bounds.maxX + 6.0,
    floorInfo.ceilingY + 4.0,
    bp.bounds.maxZ + 6.0,
    bp,
    floorInfo,
  );

  assert.equal(cam.clipped, true);
  assert.ok(cam.x <= bp.bounds.maxX - 0.31);
  assert.ok(cam.z <= bp.bounds.maxZ - 0.31);
  assert.ok(cam.y <= floorInfo.ceilingY - 0.29);
});
