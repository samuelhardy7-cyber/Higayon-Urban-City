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
});
