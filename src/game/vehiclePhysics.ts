import { dampValue } from './playerPhysics';
import { getUpgradedVehicleSpec } from './progressionSystem';
import type { CityLayout, DrivingInputState, VehicleState, VehicleUpgradeLevels } from './types';
import { VEHICLE_SPECS } from './vehicleData';
import { CITY_LAYOUT, getGroundHeightAt, resolveCircleAABBCollision } from './worldData';

export const VEHICLE_INTERACT_RANGE = 3.9;

export function createEmptyDrivingInput(): DrivingInputState {
  return {
    accelerate: false,
    brakeReverse: false,
    steerLeft: false,
    steerRight: false,
    handbrake: false,
  };
}

/**
 * Dual-circle collision for vehicles against static world colliders (buildings, houses, props, containers).
 * Motorcycles use a single compact circle; 4-wheel vehicles use front + rear axle circles.
 */
export function resolveVehicleWorldCollision(
  vehicle: VehicleState,
  layout: CityLayout = CITY_LAYOUT,
): { collided: boolean; impactSpeed: number } {
  const spec = VEHICLE_SPECS[vehicle.kind];
  const fwdX = -Math.sin(vehicle.yaw);
  const fwdZ = -Math.cos(vehicle.yaw);

  const circleRadius = spec.isMotorcycle ? spec.width * 0.55 : spec.width * 0.48;
  const axleOffset = spec.isMotorcycle ? 0 : Math.max(0.4, spec.length * 0.5 - circleRadius);

  let maxPush = 0;
  let totalHitNormalX = 0;
  let totalHitNormalZ = 0;
  let collided = false;

  const offsets = spec.isMotorcycle ? [0] : [axleOffset, -axleOffset];

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
      if (pushMag > maxPush) maxPush = pushMag;
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
): { collided: boolean; impactSpeed: number } {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const spec = getUpgradedVehicleSpec(vehicle.kind, upgrades);

  const steerInput = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
  const targetSteerAngle = steerInput * (spec.isMotorcycle ? 0.46 : 0.42);
  vehicle.steerAngle = dampValue(vehicle.steerAngle, targetSteerAngle, 12, dt);

  // Longitudinal acceleration / braking / reverse
  vehicle.isBraking = false;
  if (input.handbrake) {
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
    // Coasting rolling drag
    vehicle.speed = dampValue(vehicle.speed, 0, 2.2, dt);
    if (Math.abs(vehicle.speed) < 0.06) vehicle.speed = 0;
  }

  // Speed-sensitive steering
  const absSpeed = Math.abs(vehicle.speed);
  if (absSpeed > 0.25 && Math.abs(steerInput) > 0.01) {
    const speedFactor = Math.min(1, absSpeed / 7.5) * (1 - Math.min(0.32, absSpeed / 65));
    const dirSign = vehicle.speed >= 0 ? 1 : -1;
    vehicle.yaw += steerInput * dirSign * spec.turnRate * speedFactor * dt;
  }

  // Motorcycle banking lean angle
  if (spec.isMotorcycle) {
    const targetLean = steerInput * Math.min(1, absSpeed / 14) * 0.34;
    vehicle.leanAngle = dampValue(vehicle.leanAngle, targetLean, 9, dt);
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

  // Ground height & wheel spin
  const targetY = getGroundHeightAt(vehicle.x, vehicle.z, layout);
  vehicle.y = dampValue(vehicle.y, targetY, 20, dt);
  vehicle.wheelSpin -= (vehicle.speed * dt) / spec.wheelRadius;

  return col;
}

export function findNearestInteractableVehicle(
  px: number,
  pz: number,
  vehicles: VehicleState[],
  maxRange = VEHICLE_INTERACT_RANGE,
): VehicleState | null {
  let best: VehicleState | null = null;
  let bestDistSq = maxRange * maxRange;

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (v.occupant === 'player') continue;
    // Allow hijacking stopped/slow traffic cars (or parked vehicles)
    if (v.occupant !== 'none' && Math.abs(v.speed) > 13.5) continue;
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
  const sinY = Math.sin(vehicle.yaw);
  const cosY = Math.cos(vehicle.yaw);

  // Try driver left side, passenger right side, rear, then front
  const candidates: Array<[number, number]> = [
    [spec.exitOffsetX, 0],
    [-spec.exitOffsetX, 0],
    [0, spec.length * 0.65],
    [0, -spec.length * 0.65],
  ];

  for (const [lx, lz] of candidates) {
    const wx = vehicle.x + cosY * lx - sinY * lz;
    const wz = vehicle.z - sinY * lx - cosY * lz;
    const wy = getGroundHeightAt(wx, wz, layout);
    const res = resolveCircleAABBCollision(wx, wz, 0.45, wy, 1.78, layout);
    if (!res.collided) {
      return { x: res.x, y: wy, z: res.z };
    }
  }

  const fallbackX = vehicle.x + cosY * spec.exitOffsetX;
  const fallbackZ = vehicle.z - sinY * spec.exitOffsetX;
  const fallbackY = getGroundHeightAt(fallbackX, fallbackZ, layout);
  const res = resolveCircleAABBCollision(fallbackX, fallbackZ, 0.45, fallbackY, 1.78, layout);
  return { x: res.x, y: getGroundHeightAt(res.x, res.z, layout), z: res.z };
}
