import { findRooftopAt, findVaultableObstacleAhead } from './rooftopSystem';
import type { CityLayout, InputState, PlayerState } from './types';
import {
  CITY_LAYOUT,
  getGroundHeightAt,
  getWaterInfoAt,
  resolveCircleAABBCollision,
} from './worldData';

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.78;
export const WALK_SPEED = 5.4;
export const SPRINT_SPEED = 9.4;
export const SWIM_SPEED = 4.1;
export const SWIM_FAST_SPEED = 6.6;
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
    inWater: false,
    isUnderwater: false,
    waterDepth: 0,
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
    diveHeld: false,
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

  const waterNow = getWaterInfoAt(state.x, state.z, state.y, layout);
  const shouldSwim =
    waterNow.inWater &&
    waterNow.depth > 1.32 &&
    (state.y <= waterNow.waterSurfaceY - 0.18 || Boolean(state.inWater));

  if (shouldSwim) {
    // 3D Buoyant Ocean Swimming & Underwater Diving
    state.inWater = true;
    state.grounded = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    state.activeRooftopId = null;

    const targetSwimSpeed = hasMoveInput
      ? (state.isSprinting ? SWIM_FAST_SPEED : SWIM_SPEED) * Math.min(1, axisMag)
      : 0;
    const targetVx = normWishX * targetSwimSpeed;
    const targetVz = normWishZ * targetSwimSpeed;
    state.vx = dampValue(state.vx, targetVx, hasMoveInput ? 7.5 : 5.5, dt);
    state.vz = dampValue(state.vz, targetVz, hasMoveInput ? 7.5 : 5.5, dt);

    // Smoothly turn character toward swim velocity
    const prevYaw = state.yaw;
    if (hasMoveInput) {
      const targetYaw = Math.atan2(-normWishX, -normWishZ);
      const angleDiff = shortestAngleDelta(state.yaw, targetYaw);
      state.yaw += angleDiff * (1 - Math.exp(-9 * dt));
    }
    state.turnRate = dt > 1e-5 ? shortestAngleDelta(prevYaw, state.yaw) / dt : 0;

    // Vertical swimming controls (non-inverted: jumpHeld ascends +Y, diveHeld descends -Y)
    const ascendHeld = input.jumpHeld;
    const diveHeld = Boolean(input.diveHeld);
    const surfaceFloatY = waterNow.waterSurfaceY - 1.24;
    const minSwimY = waterNow.seabedY + 0.08;

    if (ascendHeld && !diveHeld) {
      // Allow climbing/hopping onto low piers or sloped beach when near surface
      const targetAscendVy = state.y >= surfaceFloatY - 0.15 ? 4.4 : 4.1;
      state.vy = dampValue(state.vy, targetAscendVy, 8, dt);
    } else if (diveHeld && !ascendHeld) {
      state.vy = dampValue(state.vy, -4.3, 8, dt);
    } else if (state.y > surfaceFloatY - 0.28) {
      // Gentle surface buoyancy tread-water equilibrium
      const bobOffset = Math.sin(state.elapsedTime * 2.4) * 0.04;
      const errY = surfaceFloatY + bobOffset - state.y;
      state.vy = dampValue(state.vy, errY * 3.2, 7, dt);
    } else {
      // Neutral underwater hover so diver stays at chosen coral/reef depth
      state.vy = dampValue(state.vy, 0, 7.5, dt);
    }

    // Horizontal swim integration & collider resolution
    const nextX = state.x + state.vx * dt;
    const nextZ = state.z + state.vz * dt;
    const resolved = resolveCircleAABBCollision(
      nextX,
      nextZ,
      PLAYER_RADIUS,
      state.y,
      PLAYER_HEIGHT,
      layout,
    );
    const actualDx = resolved.x - state.x;
    const actualDz = resolved.z - state.z;
    state.x = resolved.x;
    state.z = resolved.z;
    if (resolved.collided && dt > 1e-5) {
      state.vx = actualDx / dt;
      state.vz = actualDz / dt;
    }

    // Vertical integration & seabed / surface cap
    const nextWater = getWaterInfoAt(state.x, state.z, state.y, layout);
    const nextSeabedY = Math.max(nextWater.seabedY, getGroundHeightAt(state.x, state.z, layout, state.y));
    state.y += state.vy * dt;

    if (state.y < nextSeabedY) {
      state.y = nextSeabedY;
      state.vy = Math.max(0, state.vy);
    }
    const maxWaterHeadY = nextWater.inWater ? nextWater.waterSurfaceY - 0.35 : nextSeabedY + 2.5;
    if (nextWater.inWater && !ascendHeld && state.y > maxWaterHeadY) {
      state.y = maxWaterHeadY;
      state.vy = Math.min(0, state.vy);
    } else if (nextWater.inWater && ascendHeld && state.y > nextWater.waterSurfaceY - 0.85) {
      // Gently cap max hop at surface unless moving onto land/pier
      const aheadWater = getWaterInfoAt(
        state.x + normWishX * 0.75,
        state.z + normWishZ * 0.75,
        state.y,
        layout,
      );
      if (aheadWater.inWater && aheadWater.depth > 1.2) {
        state.y = Math.min(state.y, nextWater.waterSurfaceY - 0.85);
        if (state.vy > 0.6) state.vy = 0.6;
      }
    }

    // Transition smoothly back to dry land if wading onto beach/pier
    if (!nextWater.inWater || nextWater.depth <= 1.05) {
      const dryGroundY = getGroundHeightAt(state.x, state.z, layout, state.y);
      if (state.y <= dryGroundY + 0.35) {
        state.y = dryGroundY;
        state.vy = 0;
        state.grounded = true;
        state.inWater = false;
      }
    }

    state.waterDepth = Math.max(0, nextWater.waterSurfaceY - state.y);
    state.isUnderwater = Boolean(state.inWater) && state.y < nextWater.waterSurfaceY - 1.48;

    const stepDist = Math.hypot(actualDx, actualDz);
    state.speed = dt > 1e-5 ? stepDist / dt : 0;
    state.isMoving = state.speed > 0.25 || Math.abs(state.vy) > 0.4;
    state.distanceWalked += stepDist;
    state.gaitPhase += Math.max(stepDist * 1.9, (state.isMoving ? 2.4 : 0.85) * dt);
    state.squashY = dampValue(state.squashY, 1, 14, dt);

    return { jumped: false, landed: false, vaulted: false };
  }

  state.inWater = false;
  state.isUnderwater = false;
  state.waterDepth = waterNow.inWater ? Math.max(0, waterNow.waterSurfaceY - state.y) : 0;

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

