import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CITY_LAYOUT,
  getDistrictAt,
  getGroundHeightAt,
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
