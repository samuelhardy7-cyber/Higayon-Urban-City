import { findRooftopAt, findVaultableObstacleAhead } from './rooftopSystem';
import type { CityLayout, InputState, PlayerState } from './types';
import { CITY_LAYOUT, getGroundHeightAt, resolveCircleAABBCollision } from './worldData';

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.78;
export const WALK_SPEED = 5.4;
export const SPRINT_SPEED = 9.4;
export const JUMP_VELOCITY = 8.4;
export const GRAVITY = -22.0;
export const COYOTE_TIME = 0.11;
export const JUMP_BUFFER_TIME = 0.12;

export function createInitialPlayerState(layout: CityLayout = CITY_LAYOUT): PlayerState {
  const groundY = getGroundHeightAt(layout.spawn.x, layout.spawn.z, layout);
  return {
    x: layout.spawn.x,
    y: groundY,
    z: layout.spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: layout.spawn.yaw,
    turnRate: 0,
    cameraYaw: layout.spawn.yaw,
    cameraPitch: 0.28,
    grounded: true,
    coyoteTimer: COYOTE_TIME,
    jumpBufferTimer: 0,
    stamina: 100,
    health: 100,
    maxHealth: 100,
    isSprinting: false,
    isMoving: false,
    speed: 0,
    gaitPhase: 0,
    distanceWalked: 0,
    elapsedTime: 0,
    squashY: 1,
    activeLadderId: null,
    parkourTimer: 0,
    activeRooftopId: null,
  };
}

export function createEmptyInput(): InputState {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jumpHeld: false,
    jumpJustPressed: false,
    moveX: 0,
    moveY: 0,
  };
}

export function shortestAngleDelta(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function dampValue(current: number, target: number, lambda: number, dt: number): number {
  const t = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * t;
}

export function stepPlayerPhysics(
  state: PlayerState,
  input: InputState,
  rawDt: number,
  layout: CityLayout = CITY_LAYOUT,
): { jumped: boolean; landed: boolean; vaulted: boolean } {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  state.elapsedTime += dt;
  if ((state.parkourTimer ?? 0) > 0) {
    state.parkourTimer = Math.max(0, (state.parkourTimer ?? 0) - dt);
  }

  // Combine digital WASD and analog virtual joystick
  let axisX = input.moveX + (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let axisY = input.moveY + (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const axisMag = Math.hypot(axisX, axisY);
  if (axisMag > 1) {
    axisX /= axisMag;
    axisY /= axisMag;
  }
  const hasMoveInput = axisMag > 0.08;

  // Camera-relative basis on XZ plane (yaw=0 looks along -Z)
  const sinYaw = Math.sin(state.cameraYaw);
  const cosYaw = Math.cos(state.cameraYaw);
  const fwdX = -sinYaw;
  const fwdZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  const wishDirX = fwdX * axisY + rightX * axisX;
  const wishDirZ = fwdZ * axisY + rightZ * axisX;
  const wishMag = Math.hypot(wishDirX, wishDirZ);
  const normWishX = wishMag > 1e-4 ? wishDirX / wishMag : 0;
  const normWishZ = wishMag > 1e-4 ? wishDirZ / wishMag : 0;

  // Stamina & sprint management
  const wantsSprint = input.sprint && hasMoveInput;
  if (wantsSprint && state.stamina > 1.5) {
    state.isSprinting = true;
    state.stamina = Math.max(0, state.stamina - 22 * dt);
  } else {
    state.isSprinting = false;
    const regenRate = hasMoveInput ? 14 : 24;
    state.stamina = Math.min(100, state.stamina + regenRate * dt);
  }

  const targetSpeed = hasMoveInput
    ? (state.isSprinting ? SPRINT_SPEED : WALK_SPEED) * Math.min(1, axisMag)
    : 0;
  const targetVx = normWishX * targetSpeed;
  const targetVz = normWishZ * targetSpeed;

  // Acceleration / deceleration damping (snappier on ground, slightly lighter in air)
  const accelLambda = state.grounded ? (hasMoveInput ? 14 : 16) : 5.5;
  state.vx = dampValue(state.vx, targetVx, accelLambda, dt);
  state.vz = dampValue(state.vz, targetVz, accelLambda, dt);

  // Smoothly turn character toward velocity / input direction & track turnRate
  const prevYaw = state.yaw;
  if (hasMoveInput) {
    const targetYaw = Math.atan2(-normWishX, -normWishZ);
    const angleDiff = shortestAngleDelta(state.yaw, targetYaw);
    state.yaw += angleDiff * (1 - Math.exp(-13 * dt));
  }
  state.turnRate = dt > 1e-5 ? shortestAngleDelta(prevYaw, state.yaw) / dt : 0;

  // Jump buffering & coyote time
  if (input.jumpJustPressed) {
    state.jumpBufferTimer = JUMP_BUFFER_TIME;
  } else {
    state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
  }

  if (state.grounded) {
    state.coyoteTimer = COYOTE_TIME;
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
  }

  let jumped = false;
  let vaulted = false;
  if (state.jumpBufferTimer > 0 && state.coyoteTimer > 0) {
    const vaultBox = hasMoveInput
      ? findVaultableObstacleAhead(state.x, state.y, state.z, normWishX, normWishZ, layout.colliders)
      : null;
    if (vaultBox) {
      state.vy = 6.0;
      state.vx = normWishX * Math.max(6.8, Math.hypot(state.vx, state.vz));
      state.vz = normWishZ * Math.max(6.8, Math.hypot(state.vx, state.vz));
      state.parkourTimer = 0.44;
      vaulted = true;
    } else {
      state.vy = JUMP_VELOCITY;
    }
    state.grounded = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    state.squashY = vaulted ? 1.14 : 1.18;
    jumped = true;
  }

  // Variable jump height cut if jump released while ascending
  if (!input.jumpHeld && !vaulted && (state.parkourTimer ?? 0) <= 0 && state.vy > 3.2) {
    state.vy *= Math.pow(0.45, dt * 15);
  }

  // Gravity
  state.vy += GRAVITY * dt;

  // Horizontal integration + collision push-out (skipping low vaultable prop mid-vault)
  const nextX = state.x + state.vx * dt;
  const nextZ = state.z + state.vz * dt;
  const vaultObs =
    (state.parkourTimer ?? 0) > 0
      ? findVaultableObstacleAhead(state.x, state.y, state.z, state.vx, state.vz, layout.colliders)
      : null;
  const resolved = resolveCircleAABBCollision(
    nextX,
    nextZ,
    PLAYER_RADIUS,
    state.y,
    PLAYER_HEIGHT,
    layout,
    vaultObs?.id ?? null,
  );

  const actualDx = resolved.x - state.x;
  const actualDz = resolved.z - state.z;
  state.x = resolved.x;
  state.z = resolved.z;

  if (resolved.collided && dt > 1e-5) {
    state.vx = actualDx / dt;
    state.vz = actualDz / dt;
  }

  // Vertical integration + surface-aware rooftop/ground clamping
  const prevGrounded = state.grounded;
  const groundY = getGroundHeightAt(state.x, state.z, layout, state.y);
  state.y += state.vy * dt;

  let landed = false;
  if (state.y <= groundY) {
    if (!prevGrounded && state.vy < -2.5) {
      landed = true;
      state.squashY = 0.8;
    }
    state.y = groundY;
    state.vy = 0;
    state.grounded = true;
  } else if (state.y - groundY <= 0.16 && state.vy <= 0 && prevGrounded) {
    state.y = groundY;
    state.vy = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  const roofNow = findRooftopAt(state.x, state.y, state.z, layout);
  state.activeRooftopId = roofNow ? roofNow.id : null;

  // Distance-synced gait & speed metrics
  const stepDist = Math.hypot(actualDx, actualDz);
  state.speed = dt > 1e-5 ? stepDist / dt : 0;
  state.isMoving = state.speed > 0.25;
  state.distanceWalked += stepDist;
  if (state.grounded && state.isMoving) {
    state.gaitPhase += stepDist * 2.1;
  }
  state.squashY = dampValue(state.squashY, 1, 14, dt);

  return { jumped, landed, vaulted };
}

export function resolvePlayerVsNpcs(
  state: PlayerState,
  npcs: Array<{ x: number; y: number; z: number }>,
  npcRadius = 0.36,
): void {
  const minDist = PLAYER_RADIUS + npcRadius;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    if (Math.abs(state.y - npc.y) > 1.4) continue;
    const dx = state.x - npc.x;
    const dz = state.z - npc.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDistSq) {
      if (dSq > 1e-6) {
        const d = Math.sqrt(dSq);
        const push = minDist - d;
        state.x += (dx / d) * push;
        state.z += (dz / d) * push;
      } else {
        state.x += minDist;
      }
    }
  }
}

