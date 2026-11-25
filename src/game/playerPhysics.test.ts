import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyInput,
  createInitialPlayerState,
  SPRINT_SPEED,
  stepPlayerPhysics,
  WALK_SPEED,
} from './playerPhysics';

test('player survives idle seconds at spawn without falling or drifting', () => {
  const state = createInitialPlayerState();
  const input = createEmptyInput();

  for (let i = 0; i < 60; i++) {
    stepPlayerPhysics(state, input, 1 / 60);
  }

  assert.equal(state.grounded, true);
  assert.equal(state.y, 0);
  assert.ok(Math.abs(state.x) < 1e-4);
  assert.ok(Math.abs(state.z - 16) < 1e-4);
});

test('camera-relative W/D movement moves player forward (-Z) and right (+X) at cameraYaw=0', () => {
  const state = createInitialPlayerState();
  const input = createEmptyInput();
  input.forward = true;

  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(state, input, 0.025);
  }

  assert.ok(state.z < 12, 'holding W at yaw=0 moves toward -Z');
  assert.ok(Math.abs(state.x) < 0.05);
  assert.ok(state.speed <= WALK_SPEED + 0.1);

  // Rotate camera 90 degrees left (+PI/2 -> looking -X) and hold W
  state.cameraYaw = Math.PI / 2;
  const startX = state.x;
  for (let i = 0; i < 30; i++) {
    stepPlayerPhysics(state, input, 0.025);
  }
  assert.ok(state.x < startX - 1.5, 'holding W at yaw=+PI/2 moves along -X');
});

test('sprint increases speed above walk speed and consumes stamina', () => {
  const state = createInitialPlayerState();
  const input = createEmptyInput();
  input.forward = true;
  input.sprint = true;

  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(state, input, 0.025);
  }

  assert.equal(state.isSprinting, true);
  assert.ok(state.speed > WALK_SPEED + 1.0);
  assert.ok(state.speed <= SPRINT_SPEED + 0.1);
  assert.ok(state.stamina < 100);
});

test('jump launches player upward and lands cleanly back on ground', () => {
  const state = createInitialPlayerState();
  const input = createEmptyInput();
  input.jumpJustPressed = true;
  input.jumpHeld = true;

  const first = stepPlayerPhysics(state, input, 0.016);
  assert.equal(first.jumped, true);
  assert.equal(state.grounded, false);
  assert.ok(state.y > 0);

  input.jumpJustPressed = false;
  let landed = false;
  for (let i = 0; i < 120; i++) {
    const res = stepPlayerPhysics(state, input, 0.016);
    if (res.landed) {
      landed = true;
      break;
    }
  }

  assert.equal(landed, true);
  assert.equal(state.grounded, true);
  assert.equal(state.y, 0);
});

test('ocean swimming floats near surface, diveHeld submerges (-Y) above seabed, and jumpHeld ascends (+Y)', () => {
  const state = createInitialPlayerState();
  // Deep Liberty Bay water at x=132, z=56
  state.x = 132;
  state.z = 56;
  state.y = -1.6;
  state.grounded = false;

  const idleInput = createEmptyInput();
  for (let i = 0; i < 45; i++) {
    stepPlayerPhysics(state, idleInput, 0.03);
  }
  assert.equal(state.inWater, true);
  assert.ok(state.y > -2.0 && state.y < -0.5, `expected surface float, got y=${state.y}`);

  // Holding dive submerges downward (-Y) without ever breaking seabed
  const diveInput = createEmptyInput();
  diveInput.diveHeld = true;
  diveInput.forward = true;
  const beforeDiveY = state.y;
  for (let i = 0; i < 100; i++) {
    stepPlayerPhysics(state, diveInput, 0.03);
  }
  assert.ok(state.y < beforeDiveY - 2.0, `expected deep dive below ${beforeDiveY}, got ${state.y}`);
  assert.equal(state.isUnderwater, true);
  assert.ok(state.y >= -13.5, `must never sink below seabed, got ${state.y}`);
  assert.ok((state.waterDepth ?? 0) > 2.5);

  // Holding jump ascends upward (+Y) toward surface (non-inverted!)
  const ascendInput = createEmptyInput();
  ascendInput.jumpHeld = true;
  const deepY = state.y;
  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(state, ascendInput, 0.03);
  }
  assert.ok(state.y > deepY + 1.0, `expected non-inverted ascend above ${deepY}, got ${state.y}`);
});

