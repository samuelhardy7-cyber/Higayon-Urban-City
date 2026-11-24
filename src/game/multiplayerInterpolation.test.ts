import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProgressionState } from './progressionSystem';
import {
  createInterpolatedAvatar,
  shouldRenderRemoteAvatar,
  stepInterpolatedAvatar,
} from './multiplayerInterpolation';
import type { RemotePlayerState } from './multiplayerTypes';

function makeRemote(overrides: Partial<RemotePlayerState> = {}): RemotePlayerState {
  return {
    playerId: 'student_1',
    displayName: 'Maya',
    avatar: createInitialProgressionState().customization,
    position: { x: 0, y: 0, z: 0 },
    rotation: { yaw: 0 },
    movementState: 'walking',
    vehicleKind: null,
    currentBuilding: null,
    currentFloor: 1,
    currentActivity: 'Exploring City',
    connectionStatus: 'online',
    questionsCompleted: 0,
    pointsEarned: 0,
    updatedAt: Date.now(),
    ...overrides,
  };
}

test('stepInterpolatedAvatar smoothly damps short movement and snaps on large teleports', () => {
  const remote = makeRemote({ position: { x: 0, y: 0, z: 0 } });
  const avatar = createInterpolatedAvatar(remote);

  avatar.target = makeRemote({ position: { x: 4, y: 0, z: 0 }, rotation: { yaw: 1.0 } });
  stepInterpolatedAvatar(avatar, 0.05);
  assert.ok(avatar.x > 0 && avatar.x < 4);
  assert.ok(avatar.yaw > 0 && avatar.yaw < 1.0);
  assert.ok(avatar.gaitPhase > 0);

  // Teleport (>12m) should snap immediately
  avatar.target = makeRemote({ position: { x: 50, y: 0, z: 50 }, rotation: { yaw: 2.2 } });
  stepInterpolatedAvatar(avatar, 0.05);
  assert.equal(avatar.x, 50);
  assert.equal(avatar.z, 50);
  assert.equal(avatar.yaw, 2.2);
});

test('shouldRenderRemoteAvatar isolates exterior, building interior, floor, and offline status', () => {
  const exterior = makeRemote({ currentBuilding: null, currentFloor: 1 });
  const insideF1 = makeRemote({ currentBuilding: 'tower_1', currentFloor: 1 });
  const insideF2 = makeRemote({ currentBuilding: 'tower_1', currentFloor: 2 });
  const offline = makeRemote({ connectionStatus: 'offline' });

  assert.equal(shouldRenderRemoteAvatar(exterior, null, 1), true);
  assert.equal(shouldRenderRemoteAvatar(insideF1, null, 1), false);
  assert.equal(shouldRenderRemoteAvatar(insideF1, 'tower_1', 1), true);
  assert.equal(shouldRenderRemoteAvatar(insideF2, 'tower_1', 1), false);
  assert.equal(shouldRenderRemoteAvatar(insideF2, 'tower_1', 1, { inSharedElevator: true }), true);
  assert.equal(shouldRenderRemoteAvatar(offline, null, 1), false);
});
