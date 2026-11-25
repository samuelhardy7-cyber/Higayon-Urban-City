import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CITY_LAYOUT,
  getCityAt,
  getDistrictAt,
  getGroundHeightAt,
  getSingleBridgeHeight,
  raycastCameraCollision,
  resolveCircleAABBCollision,
} from './worldData';

test('spawn position is on clear ground with zero collider overlap', () => {
  const { spawn } = CITY_LAYOUT;
  const ground = getGroundHeightAt(spawn.x, spawn.z);
  assert.equal(ground, 0);

  const resolved = resolveCircleAABBCollision(spawn.x, spawn.z, 0.45, ground, 1.78);
  assert.equal(resolved.collided, false);
  assert.equal(resolved.x, spawn.x);
  assert.equal(resolved.z, spawn.z);
});

test('all 4 city districts and landmark pins are present and reachable', () => {
  assert.equal(getDistrictAt(-21, -21).id, 'downtown');
  assert.equal(getDistrictAt(-21, 21).id, 'residential');
  assert.equal(getDistrictAt(63, -63).id, 'industrial');
  assert.equal(getDistrictAt(63, 21).id, 'coastal');
  assert.equal(getDistrictAt(0, 0).id, 'avenue');
  assert.ok(CITY_LAYOUT.landmarks.length >= 5);
});

test('sidewalk, sandy beach, and coastal pier ground heights resolve properly', () => {
  assert.equal(getGroundHeightAt(0, 0), 0); // road
  assert.equal(getGroundHeightAt(-21, 21), CITY_LAYOUT.sidewalkHeight); // sidewalk/park
  assert.ok(getGroundHeightAt(100, 42) > 0); // elevated wooden tourist pier
  assert.ok(getGroundHeightAt(103, 20) < 0.06); // sloping sandy beach
});

test('circle-AABB collision pushes player out of buildings and parked vehicles', () => {
  const freedomTower = CITY_LAYOUT.buildings.find((b) => b.id === 'freedom_tower');
  assert.ok(freedomTower);

  const res = resolveCircleAABBCollision(freedomTower.x, freedomTower.z, 0.42, 0.14, 1.78);
  assert.equal(res.collided, true);

  const parkedCar = CITY_LAYOUT.parkedVehicles[0];
  assert.ok(parkedCar);
  const carRes = resolveCircleAABBCollision(parkedCar.x, parkedCar.z, 0.42, 0.14, 1.78);
  assert.equal(carRes.collided, true);
});

test('camera anti-occlusion raycast pulls camera in front of intervening building', () => {
  const freedomTower = CITY_LAYOUT.buildings.find((b) => b.id === 'freedom_tower');
  assert.ok(freedomTower);

  const ox = freedomTower.x + freedomTower.width * 0.5 + 1.5;
  const oy = 1.6;
  const oz = freedomTower.z;
  const tx = freedomTower.x;
  const ty = 2.8;
  const tz = freedomTower.z;

  const hit = raycastCameraCollision(ox, oy, oz, tx, ty, tz, CITY_LAYOUT.colliders);
  assert.equal(hit.clipped, true);
  assert.ok(hit.x >= freedomTower.x + freedomTower.width * 0.5, 'camera must stay outside building');
});

test('connected open-world includes 4 cities, 4 international airports, and drivable suspension bridges', () => {
  assert.deepEqual(
    CITY_LAYOUT.cities.map((c) => c.id),
    ['liberty_metro', 'emerald_bay', 'aero_highland', 'golden_horizon'],
  );
  assert.deepEqual(
    CITY_LAYOUT.airports.map((a) => a.code),
    ['LBY', 'EMB', 'HLD', 'GZH'],
  );
  assert.equal(CITY_LAYOUT.bridges.length, 3);

  assert.equal(getCityAt(0, 0).id, 'liberty_metro');
  assert.equal(getCityAt(300, 0).id, 'emerald_bay');
  assert.equal(getCityAt(0, -280).id, 'aero_highland');
  assert.equal(getCityAt(0, 280).id, 'golden_horizon');
  assert.equal(getDistrictAt(-63, 283).id, 'suncrest_bay');

  const eastBridge = CITY_LAYOUT.bridges.find((b) => b.id === 'bridge_east_harbor');
  const northBridge = CITY_LAYOUT.bridges.find((b) => b.id === 'bridge_north_skyway');
  const southBridge = CITY_LAYOUT.bridges.find((b) => b.id === 'bridge_south_sunset');
  assert.ok(eastBridge && northBridge && southBridge);

  // Bridge deck rises smoothly from y=0 to deckHeight at mid-span and returns cleanly to y=0
  assert.equal(getSingleBridgeHeight(eastBridge.start, eastBridge), 0);
  assert.equal(
    getSingleBridgeHeight((eastBridge.start + eastBridge.end) * 0.5, eastBridge),
    eastBridge.deckHeight,
  );
  assert.ok(Math.abs(getGroundHeightAt(165, 0) - eastBridge.deckHeight) < 1e-6);
  assert.ok(Math.abs(getGroundHeightAt(0, -155) - northBridge.deckHeight) < 1e-6);
  assert.ok(Math.abs(getGroundHeightAt(0, 155) - southBridge.deckHeight) < 1e-6);

  // Verify driving/walking corridor across East Bridge (x=96..234, z=0) is clear of colliders
  for (let x = 96; x <= 234; x += 6) {
    const gy = getGroundHeightAt(x, 0);
    const col = resolveCircleAABBCollision(x, 0, 1.0, gy, 1.78);
    assert.equal(col.collided, false, `East bridge roadway at x=${x}, z=0 must be clear`);
  }

  // Verify driving/walking corridor across North Bridge (z=-214..-96, x=0) is clear of colliders
  for (let z = -214; z <= -96; z += 6) {
    const gy = getGroundHeightAt(0, z);
    const col = resolveCircleAABBCollision(0, z, 1.0, gy, 1.78);
    assert.equal(col.collided, false, `North bridge roadway at x=0, z=${z} must be clear`);
  }

  // Verify driving/walking corridor across South Bridge (z=96..214, x=0) is clear of colliders
  for (let z = 96; z <= 214; z += 6) {
    const gy = getGroundHeightAt(0, z);
    const col = resolveCircleAABBCollision(0, z, 1.0, gy, 1.78);
    assert.equal(col.collided, false, `South bridge roadway at x=0, z=${z} must be clear`);
  }

  // Verify GZH airport west connector roadway (x=-114..-84, z=262) is clear of colliders
  for (let x = -114; x <= -84; x += 6) {
    const gy = getGroundHeightAt(x, 262);
    const col = resolveCircleAABBCollision(x, 262, 1.0, gy, 1.78);
    assert.equal(col.collided, false, `GZH airport roadway at x=${x}, z=262 must be clear`);
  }
});
