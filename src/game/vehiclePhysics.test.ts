import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialVehicles, VEHICLE_SPECS } from './vehicleData';
import {
  createEmptyDrivingInput,
  findNearestInteractableVehicle,
  findSafeVehicleExitPos,
  resolveVehicleWorldCollision,
  stepPlayerVehiclePhysics,
} from './vehiclePhysics';
import { CITY_LAYOUT, resolveCircleAABBCollision } from './worldData';

describe('vehiclePhysics & vehicleData', () => {
  it('defines all 5 distinct vehicle types with differentiated speeds and spawns cleanly', () => {
    const kinds = ['sedan', 'suv', 'sports', 'pickup', 'motor'] as const;
    for (const k of kinds) {
      assert.ok(VEHICLE_SPECS[k], `missing spec for ${k}`);
    }
    assert.ok(VEHICLE_SPECS.sports.maxSpeed > VEHICLE_SPECS.sedan.maxSpeed);
    assert.ok(VEHICLE_SPECS.motor.turnRate > VEHICLE_SPECS.suv.turnRate);

    const vehicles = createInitialVehicles(CITY_LAYOUT);
    for (const k of kinds) {
      assert.ok(
        vehicles.some((v) => v.kind === k && v.occupant === 'none'),
        `expected driveable ${k} spawn`,
      );
    }

    // Verify all initial vehicles sit clear of buildings/props
    for (const v of vehicles) {
      const col = resolveVehicleWorldCollision({ ...v }, CITY_LAYOUT);
      assert.equal(col.collided, false, `vehicle ${v.id} overlaps world collider at spawn`);
    }
  });

  it('accelerates, steers with wheel angle & spin, brakes, and reverses', () => {
    const vehicles = createInitialVehicles(CITY_LAYOUT);
    const sports = vehicles.find((v) => v.id === 'veh_spawn_sports')!;
    const input = createEmptyDrivingInput();

    // Accelerate straight along open avenue
    input.accelerate = true;
    for (let i = 0; i < 25; i++) {
      stepPlayerVehiclePhysics(sports, input, 0.04, CITY_LAYOUT);
    }
    assert.ok(sports.speed > 12, `expected acceleration > 12 m/s, got ${sports.speed}`);
    assert.ok(sports.wheelSpin < -1, 'expected wheels spun forward');

    // Apply left steering
    input.steerLeft = true;
    for (let i = 0; i < 12; i++) {
      stepPlayerVehiclePhysics(sports, input, 0.04, CITY_LAYOUT);
    }
    assert.ok(sports.steerAngle > 0.2, 'expected front wheels steered left');
    assert.ok(sports.yaw > 0.1, 'expected vehicle turned left');

    // Brake to stop then reverse
    input.accelerate = false;
    input.steerLeft = false;
    input.brakeReverse = true;
    for (let i = 0; i < 80; i++) {
      stepPlayerVehiclePhysics(sports, input, 0.04, CITY_LAYOUT);
    }
    assert.ok(sports.speed < -2, `expected reverse speed < -2, got ${sports.speed}`);
  });

  it('finds nearby vehicle to enter and computes safe exit position clear of buildings', () => {
    const vehicles = createInitialVehicles(CITY_LAYOUT);
    const near = findNearestInteractableVehicle(3.0, 11.0, vehicles);
    assert.ok(near, 'expected nearby vehicle near spawn');
    assert.equal(near.id, 'veh_spawn_sports');

    const exitPos = findSafeVehicleExitPos(near, CITY_LAYOUT);
    const col = resolveCircleAABBCollision(exitPos.x, exitPos.z, 0.42, exitPos.y, 1.78, CITY_LAYOUT);
    assert.equal(col.collided, false, 'exit position must not collide with buildings');
  });

  it('spawns jetski, speedboat, and submarine in bay and enforces non-inverted sub dive/ascend', () => {
    const vehicles = createInitialVehicles(CITY_LAYOUT);
    const jetski = vehicles.find((v) => v.kind === 'jetski');
    const speedboat = vehicles.find((v) => v.kind === 'speedboat');
    const sub = vehicles.find((v) => v.kind === 'submarine');
    assert.ok(jetski && speedboat && sub, 'expected marine and submarine vehicles spawned in ocean bay');
    assert.equal(VEHICLE_SPECS.jetski.domain, 'water');
    assert.equal(VEHICLE_SPECS.speedboat.domain, 'water');
    assert.equal(VEHICLE_SPECS.submarine.domain, 'submersible');

    // Accelerate jetski forward and steer left (+yaw)
    const jetInput = createEmptyDrivingInput();
    jetInput.accelerate = true;
    jetInput.steerLeft = true;
    const initialYaw = jetski!.yaw;
    for (let i = 0; i < 20; i++) {
      stepPlayerVehiclePhysics(jetski!, jetInput, 0.04, CITY_LAYOUT);
    }
    assert.ok(jetski!.speed > 4, `expected jetski thrust > 4, got ${jetski!.speed}`);
    assert.ok(jetski!.yaw > initialYaw + 0.05, 'expected non-inverted left rudder turn (+yaw)');

    // Submarine dive (-Y, negative pitch) vs ascend (+Y, positive pitch)
    const subStartY = sub!.y;
    const diveInput = createEmptyDrivingInput();
    diveInput.dive = true;
    diveInput.accelerate = true;
    for (let i = 0; i < 45; i++) {
      stepPlayerVehiclePhysics(sub!, diveInput, 0.04, CITY_LAYOUT);
    }
    assert.ok(sub!.y < subStartY - 1.5, `expected submarine to submerge below ${subStartY}, got ${sub!.y}`);
    assert.ok((sub!.pitch ?? 0) < 0, `expected nose-down pitch (< 0) when diving, got ${sub!.pitch}`);

    // Exiting underwater submarine leaves player safely suspended at dive depth in ocean water
    const subExit = findSafeVehicleExitPos(sub!, CITY_LAYOUT);
    assert.ok(subExit.y < -2.0 && subExit.y >= -13.5, `expected underwater exit depth, got ${subExit.y}`);

    const deepY = sub!.y;
    const ascendInput = createEmptyDrivingInput();
    ascendInput.ascend = true;
    ascendInput.accelerate = true;
    for (let i = 0; i < 30; i++) {
      stepPlayerVehiclePhysics(sub!, ascendInput, 0.04, CITY_LAYOUT);
    }
    assert.ok(sub!.y > deepY + 0.5, `expected submarine to surface (+Y), got ${sub!.y} from ${deepY}`);
    assert.ok((sub!.pitch ?? 0) > 0, `expected nose-up pitch (> 0) when ascending, got ${sub!.pitch}`);
  });
});

