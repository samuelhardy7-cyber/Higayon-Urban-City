import { dampValue } from './playerPhysics';
import { getUpgradedVehicleSpec } from './progressionSystem';
import type { CityLayout, DrivingInputState, VehicleState, VehicleUpgradeLevels } from './types';
import { VEHICLE_SPECS } from './vehicleData';
import {
  CITY_LAYOUT,
  getGroundHeightAt,
  getWaterInfoAt,
  isOverDryLand,
  resolveCircleAABBCollision,
  WATER_SURFACE_Y,
} from './worldData';

export const VEHICLE_INTERACT_RANGE = 4.6;

export function createEmptyDrivingInput(): DrivingInputState {
  return {
    accelerate: false,
    brakeReverse: false,
    steerLeft: false,
    steerRight: false,
    handbrake: false,
    ascend: false,
    dive: false,
  };
}

/**
 * Dual-circle collision for vehicles against static world colliders (buildings, houses, props, containers).
 * Motorcycles & jet skis use a single compact circle; 4-wheel vehicles/boats/subs use front + rear axle circles.
 */
export function resolveVehicleWorldCollision(
  vehicle: VehicleState,
  layout: CityLayout = CITY_LAYOUT,
): { collided: boolean; impactSpeed: number } {
  const spec = VEHICLE_SPECS[vehicle.kind];
  const fwdX = -Math.sin(vehicle.yaw);
  const fwdZ = -Math.cos(vehicle.yaw);

  const isCompact = spec.isMotorcycle || vehicle.kind === 'jetski';
  const circleRadius = isCompact ? spec.width * 0.55 : spec.width * 0.48;
  const axleOffset = isCompact ? 0 : Math.max(0.4, spec.length * 0.5 - circleRadius);

  let totalHitNormalX = 0;
  let totalHitNormalZ = 0;
  let collided = false;

  const offsets = isCompact ? [0] : [axleOffset, -axleOffset];

  for (const off of offsets) {
    const cx = vehicle.x + fwdX * off;
    const cz = vehicle.z + fwdZ * off;
    const res = resolveCircleAABBCollision(cx, cz, circleRadius, vehicle.y, 1.85, layout);
    if (res.collided) {
      collided = true;
      const dx = res.x - cx;
      const dz = res.z - cz;
      const pushMag = Math.hypot(dx, dz);
      vehicle.x += dx;
      vehicle.z += dz;
      if (pushMag > 1e-5) {
        totalHitNormalX += dx / pushMag;
        totalHitNormalZ += dz / pushMag;
      }
    }
  }

  let impactSpeed = 0;
  if (collided) {
    const nMag = Math.hypot(totalHitNormalX, totalHitNormalZ);
    if (nMag > 1e-4) {
      const nx = totalHitNormalX / nMag;
      const nz = totalHitNormalZ / nMag;
      const velDotNormal = fwdX * vehicle.speed * nx + fwdZ * vehicle.speed * nz;
      if (velDotNormal < 0) {
        impactSpeed = -velDotNormal;
        // Slide along walls rather than sticking nose-first
        vehicle.speed *= 0.42;
      }
    } else {
      impactSpeed = Math.abs(vehicle.speed);
      vehicle.speed *= 0.35;
    }
  }

  return { collided, impactSpeed };
}

/**
 * Pairwise vehicle-vs-vehicle collision resolution to prevent vehicles passing through one another.
 */
export function resolveVehiclesPairwise(
  vehicles: VehicleState[],
): Array<{ a: VehicleState; b: VehicleState; impactSpeed: number }> {
  const impacts: Array<{ a: VehicleState; b: VehicleState; impactSpeed: number }> = [];

  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i];
    const specA = VEHICLE_SPECS[a.kind];
    const radA = Math.max(specA.width * 0.52, specA.length * 0.34);

    for (let j = i + 1; j < vehicles.length; j++) {
      const b = vehicles[j];
      // Allow vertical clearance between surface boats and deep-diving submarines
      if (Math.abs(a.y - b.y) > 2.2) continue;
      const specB = VEHICLE_SPECS[b.kind];
      const radB = Math.max(specB.width * 0.52, specB.length * 0.34);

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const minDist = radA + radB;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDist * minDist) {
        let nx = 1;
        let nz = 0;
        let dist = 0;
        if (distSq > 1e-6) {
          dist = Math.sqrt(distSq);
          nx = dx / dist;
          nz = dz / dist;
        }
        const overlap = minDist - dist;

        // If one is player-driven and other is stationary parked, push player slightly more; otherwise split 50/50
        const aMovable = a.occupant !== 'none' ? 1 : 0.45;
        const bMovable = b.occupant !== 'none' ? 1 : 0.45;
        const sumW = aMovable + bMovable;
        const shareA = aMovable / sumW;
        const shareB = bMovable / sumW;

        a.x -= nx * overlap * shareA;
        a.z -= nz * overlap * shareA;
        b.x += nx * overlap * shareB;
        b.z += nz * overlap * shareB;

        const vAx = -Math.sin(a.yaw) * a.speed;
        const vAz = -Math.cos(a.yaw) * a.speed;
        const vBx = -Math.sin(b.yaw) * b.speed;
        const vBz = -Math.cos(b.yaw) * b.speed;
        const relAlongNormal = (vAx - vBx) * nx + (vAz - vBz) * nz;

        if (relAlongNormal > 0.5) {
          impacts.push({ a, b, impactSpeed: relAlongNormal });
          a.speed *= 0.62;
          b.speed *= 0.62;
        }
      }
    }
  }

  return impacts;
}

export function stepPlayerVehiclePhysics(
  vehicle: VehicleState,
  input: DrivingInputState,
  rawDt: number,
  layout: CityLayout = CITY_LAYOUT,
  upgrades?: VehicleUpgradeLevels,
  elapsedTime = 0,
): { collided: boolean; impactSpeed: number } {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const spec = getUpgradedVehicleSpec(vehicle.kind, upgrades);
  const isWater = spec.domain === 'water';
  const isSub = spec.domain === 'submersible';
  const isMarine = isWater || isSub;

  const prevX = vehicle.x;
  const prevZ = vehicle.z;

  const steerInput = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
  const targetSteerAngle = steerInput * (spec.isMotorcycle || vehicle.kind === 'jetski' ? 0.46 : 0.42);
  vehicle.steerAngle = dampValue(vehicle.steerAngle, targetSteerAngle, 12, dt);

  // Longitudinal acceleration / braking / reverse
  vehicle.isBraking = false;
  if (!isSub && input.handbrake) {
    vehicle.isBraking = true;
    const decel = spec.brakeDecel * 1.25 * dt;
    if (Math.abs(vehicle.speed) <= decel) {
      vehicle.speed = 0;
    } else {
      vehicle.speed -= Math.sign(vehicle.speed) * decel;
    }
  } else if (input.accelerate && !input.brakeReverse) {
    if (vehicle.speed < -0.5) {
      vehicle.isBraking = true;
      vehicle.speed = Math.min(0, vehicle.speed + spec.brakeDecel * dt);
    } else {
      vehicle.speed = Math.min(spec.maxSpeed, vehicle.speed + spec.accel * dt);
    }
  } else if (input.brakeReverse && !input.accelerate) {
    if (vehicle.speed > 0.7) {
      vehicle.isBraking = true;
      vehicle.speed = Math.max(0, vehicle.speed - spec.brakeDecel * dt);
    } else {
      vehicle.isBraking = true;
      vehicle.speed = Math.max(-spec.reverseSpeed, vehicle.speed - spec.accel * 0.72 * dt);
    }
  } else {
    // Coasting rolling / water drag
    vehicle.speed = dampValue(vehicle.speed, 0, isMarine ? 1.8 : 2.2, dt);
    if (Math.abs(vehicle.speed) < 0.06) vehicle.speed = 0;
  }

  // Speed-sensitive steering (watercraft & sub also turn smoothly at low thrust)
  const absSpeed = Math.abs(vehicle.speed);
  const steerThreshold = isMarine ? 0.05 : 0.25;
  if ((absSpeed > steerThreshold || (isSub && Math.abs(steerInput) > 0.01)) && Math.abs(steerInput) > 0.01) {
    const speedFactor = isMarine
      ? Math.max(0.45, Math.min(1, absSpeed / 6.0))
      : Math.min(1, absSpeed / 7.5) * (1 - Math.min(0.32, absSpeed / 65));
    const dirSign = vehicle.speed < -0.25 ? -1 : 1;
    vehicle.yaw += steerInput * dirSign * spec.turnRate * speedFactor * dt;
  }

  // Banking lean angle: motorcycles & jet skis bank INTO the turn (left steer -> positive Z tilt)
  if (spec.isMotorcycle || vehicle.kind === 'jetski') {
    const targetLean = steerInput * Math.min(1, absSpeed / 14) * (vehicle.kind === 'jetski' ? 0.26 : 0.34);
    vehicle.leanAngle = dampValue(vehicle.leanAngle, targetLean, 9, dt);
  } else if (isMarine) {
    const targetBank = steerInput * Math.min(1, absSpeed / 16) * 0.12;
    vehicle.leanAngle = dampValue(vehicle.leanAngle, targetBank, 8, dt);
  } else {
    const targetRoll = -steerInput * Math.min(1, absSpeed / 20) * 0.045;
    vehicle.leanAngle = dampValue(vehicle.leanAngle, targetRoll, 10, dt);
  }

  // Integrate XZ motion along vehicle forward (-sin yaw, -cos yaw)
  const fwdX = -Math.sin(vehicle.yaw);
  const fwdZ = -Math.cos(vehicle.yaw);
  vehicle.x += fwdX * vehicle.speed * dt;
  vehicle.z += fwdZ * vehicle.speed * dt;

  // World collision
  const col = resolveVehicleWorldCollision(vehicle, layout);

  if (isMarine) {
    // Keep marine vessels in navigable water (prevent beaching onto dry land islands or bridge decks)
    const waterCheck = getWaterInfoAt(vehicle.x, vehicle.z, WATER_SURFACE_Y - 1.0, layout);
    if (!waterCheck.inWater || isOverDryLand(vehicle.x, vehicle.z, layout) || waterCheck.depth < 0.85) {
      vehicle.x = prevX;
      vehicle.z = prevZ;
      vehicle.speed *= -0.18;
      col.collided = true;
      col.impactSpeed = Math.max(col.impactSpeed, absSpeed);
    }

    const activeWater = getWaterInfoAt(vehicle.x, vehicle.z, vehicle.y, layout);
    if (isSub) {
      // Submarine vertical control: ascend (+Y) / dive (-Y), non-inverted nose pitch
      const ascendHeld = Boolean(input.ascend);
      const diveHeld = Boolean(input.dive);
      const targetVy = ascendHeld && !diveHeld ? 5.6 : diveHeld && !ascendHeld ? -5.6 : 0;
      const curVy = vehicle.verticalSpeed ?? 0;
      vehicle.verticalSpeed = dampValue(curVy, targetVy, 6.5, dt);
      vehicle.y += vehicle.verticalSpeed * dt;

      const minSubY = activeWater.seabedY + 0.72;
      const maxSubY = activeWater.waterSurfaceY - (spec.draftDepth ?? 0.58);
      if (vehicle.y < minSubY) {
        vehicle.y = minSubY;
        vehicle.verticalSpeed = Math.max(0, vehicle.verticalSpeed);
      } else if (vehicle.y > maxSubY) {
        vehicle.y = maxSubY;
        vehicle.verticalSpeed = Math.min(0, vehicle.verticalSpeed);
      }

      // Rig faces -Z: +rotation.x lifts nose UP (+Y), -rotation.x tilts nose DOWN (-Y)
      const targetPitch = Math.max(-0.42, Math.min(0.42, vehicle.verticalSpeed * 0.068));
      vehicle.pitch = dampValue(vehicle.pitch ?? 0, targetPitch, 7, dt);
    } else {
      // Surface boat / jet ski: buoyant wave bobbing + planing bow-up (+pitch) under throttle
      const waveBob = Math.sin(elapsedTime * 2.6 + vehicle.x * 0.14 + vehicle.z * 0.14) * 0.055;
      const targetY = activeWater.waterSurfaceY - (spec.draftDepth ?? 0.24) + waveBob;
      vehicle.y = dampValue(vehicle.y, targetY, 12, dt);
      vehicle.verticalSpeed = 0;
      const speedRatio = Math.max(-0.2, Math.min(1, vehicle.speed / Math.max(1, spec.maxSpeed)));
      const targetPitch = speedRatio * 0.085 + Math.cos(elapsedTime * 2.9 + vehicle.z * 0.18) * 0.018;
      vehicle.pitch = dampValue(vehicle.pitch ?? 0, targetPitch, 8, dt);
    }

    // Drive impeller / propeller spin
    const spinBase = isSub ? Math.max(2.5, Math.abs(vehicle.speed)) : vehicle.speed;
    vehicle.wheelSpin -= (spinBase * dt) / Math.max(0.18, spec.wheelRadius);
  } else {
    // Land vehicle ground height & water drag if driven into shallow water
    const waterLand = getWaterInfoAt(vehicle.x, vehicle.z, vehicle.y, layout);
    if (waterLand.inWater && waterLand.depth > 0.9) {
      vehicle.speed *= Math.max(0, 1 - 2.6 * dt);
    }
    const targetY = getGroundHeightAt(vehicle.x, vehicle.z, layout);
    vehicle.y = dampValue(vehicle.y, targetY, 20, dt);
    vehicle.pitch = 0;
    vehicle.verticalSpeed = 0;
    vehicle.wheelSpin -= (vehicle.speed * dt) / spec.wheelRadius;
  }

  return col;
}

export function findNearestInteractableVehicle(
  px: number,
  pz: number,
  vehicles: VehicleState[],
  maxRange = VEHICLE_INTERACT_RANGE,
  py?: number,
): VehicleState | null {
  let best: VehicleState | null = null;
  let bestDistSq = maxRange * maxRange;

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (v.occupant === 'player') continue;
    // Allow hijacking stopped/slow traffic cars (or parked vehicles)
    if (v.occupant !== 'none' && Math.abs(v.speed) > 13.5) continue;
    if (typeof py === 'number' && Math.abs(v.y - py) > 5.0) continue;
    const dx = v.x - px;
    const dz = v.z - pz;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = v;
    }
  }
  return best;
}

export function computeVehicleSeatWorldPos(vehicle: VehicleState): { x: number; y: number; z: number } {
  const spec = VEHICLE_SPECS[vehicle.kind];
  const sinY = Math.sin(vehicle.yaw);
  const cosY = Math.cos(vehicle.yaw);
  // local right = (cosY, -sinY), local fwd = (-sinY, -cosY)
  const x = vehicle.x + cosY * spec.seatOffsetX - sinY * spec.seatOffsetZ;
  const z = vehicle.z - sinY * spec.seatOffsetX - cosY * spec.seatOffsetZ;
  return {
    x,
    y: vehicle.y + spec.seatOffsetY,
    z,
  };
}

export function findSafeVehicleExitPos(
  vehicle: VehicleState,
  layout: CityLayout = CITY_LAYOUT,
): { x: number; y: number; z: number } {
  const spec = VEHICLE_SPECS[vehicle.kind];
  const isMarine = spec.domain === 'water' || spec.domain === 'submersible';
  const sinY = Math.sin(vehicle.yaw);
  const cosY = Math.cos(vehicle.yaw);

  // Try driver left side, passenger right side, rear, then front
  const candidates: Array<[number, number]> = [
    [spec.exitOffsetX, 0],
    [-spec.exitOffsetX, 0],
    [0, spec.length * 0.65],
    [0, -spec.length * 0.65],
  ];

  const computeExitY = (wx: number, wz: number): number => {
    if (!isMarine) return getGroundHeightAt(wx, wz, layout);
    const wInfo = getWaterInfoAt(wx, wz, vehicle.y, layout);
    if (!wInfo.inWater) return getGroundHeightAt(wx, wz, layout);
    if (spec.domain === 'submersible') {
      // Exit into water at submarine's current dive depth, safely above seabed
      return Math.max(wInfo.seabedY + 0.15, Math.min(wInfo.waterSurfaceY - 1.15, vehicle.y));
    }
    return Math.max(wInfo.seabedY + 0.15, wInfo.waterSurfaceY - 1.15);
  };

  for (const [lx, lz] of candidates) {
    const wx = vehicle.x + cosY * lx - sinY * lz;
    const wz = vehicle.z - sinY * lx - cosY * lz;
    const wy = computeExitY(wx, wz);
    const res = resolveCircleAABBCollision(wx, wz, 0.45, wy, 1.78, layout);
    if (!res.collided) {
      return { x: res.x, y: wy, z: res.z };
    }
  }

  const fallbackX = vehicle.x + cosY * spec.exitOffsetX;
  const fallbackZ = vehicle.z - sinY * spec.exitOffsetX;
  const fallbackY = computeExitY(fallbackX, fallbackZ);
  const res = resolveCircleAABBCollision(fallbackX, fallbackZ, 0.45, fallbackY, 1.78, layout);
  return { x: res.x, y: computeExitY(res.x, res.z), z: res.z };
}

