import { dampValue, shortestAngleDelta } from './playerPhysics';
import type { CityLayout, VehicleState } from './types';
import { TRAFFIC_LANE_LOOPS, VEHICLE_SPECS } from './vehicleData';
import { resolveVehicleWorldCollision } from './vehiclePhysics';
import { CITY_LAYOUT, getGroundHeightAt } from './worldData';

const ROAD_CENTERS = [-84, -42, 0, 42, 84];

export interface IntersectionSignalState {
  /** 'ns' = North-South green, 'ew' = East-West green, 'all_red' = brief clearance */
  nsGreen: boolean;
  ewGreen: boolean;
  isAmber: boolean;
}

export function getTrafficSignalState(elapsedTime: number): IntersectionSignalState {
  // 16-second full cycle: 0..6.5 NS Green, 6.5..8.0 NS Amber, 8.0..14.5 EW Green, 14.5..16.0 EW Amber
  const t = ((elapsedTime % 16) + 16) % 16;
  if (t < 6.5) return { nsGreen: true, ewGreen: false, isAmber: false };
  if (t < 8.0) return { nsGreen: false, ewGreen: false, isAmber: true };
  if (t < 14.5) return { nsGreen: false, ewGreen: true, isAmber: false };
  return { nsGreen: false, ewGreen: false, isAmber: true };
}

function isApproachingRedIntersection(
  vx: number,
  vz: number,
  fwdX: number,
  fwdZ: number,
  signal: IntersectionSignalState,
): boolean {
  const movingAlongZ = Math.abs(fwdZ) >= Math.abs(fwdX);
  const canProceed = movingAlongZ ? signal.nsGreen : signal.ewGreen;
  if (canProceed) return false;

  // Check if vehicle nose is 5.5m..10.5m ahead of an intersection center along travel direction
  for (let i = 0; i < ROAD_CENTERS.length; i++) {
    const rc = ROAD_CENTERS[i];
    if (movingAlongZ) {
      const distAhead = (rc - vz) * Math.sign(fwdZ);
      if (distAhead > 5.6 && distAhead < 11.2) {
        // Check if aligned with a cross road X
        for (let j = 0; j < ROAD_CENTERS.length; j++) {
          if (Math.abs(vx - ROAD_CENTERS[j]) < 6.0) return true;
        }
      }
    } else {
      const distAhead = (rc - vx) * Math.sign(fwdX);
      if (distAhead > 5.6 && distAhead < 11.2) {
        for (let j = 0; j < ROAD_CENTERS.length; j++) {
          if (Math.abs(vz - ROAD_CENTERS[j]) < 6.0) return true;
        }
      }
    }
  }
  return false;
}

function computeForwardObstacleFactor(
  v: VehicleState,
  fwdX: number,
  fwdZ: number,
  vehicles: VehicleState[],
  playerX: number,
  playerZ: number,
  playerInVehicle: boolean,
): number {
  let minFactor = 1.0;

  // Check other vehicles within 10.5m forward cone
  for (let i = 0; i < vehicles.length; i++) {
    const other = vehicles[i];
    if (other.id === v.id) continue;
    const dx = other.x - v.x;
    const dz = other.z - v.z;
    const forwardDist = dx * fwdX + dz * fwdZ;
    if (forwardDist <= 0.5 || forwardDist > 11.5) continue;
    const sideDist = Math.abs(dx * -fwdZ + dz * fwdX);
    if (sideDist < 2.35) {
      if (forwardDist < 5.4) return 0;
      const factor = (forwardDist - 5.4) / 6.1;
      if (factor < minFactor) minFactor = factor;
    }
  }

  // Yield to player walking on crosswalk / road
  if (!playerInVehicle) {
    const pdx = playerX - v.x;
    const pdz = playerZ - v.z;
    const pFwd = pdx * fwdX + pdz * fwdZ;
    if (pFwd > 0.5 && pFwd < 9.0) {
      const pSide = Math.abs(pdx * -fwdZ + pdz * fwdX);
      if (pSide < 2.1) {
        if (pFwd < 4.4) return 0;
        const f = (pFwd - 4.4) / 4.6;
        if (f < minFactor) minFactor = f;
      }
    }
  }

  return minFactor;
}

function hasForwardBuildingCollider(
  x: number,
  z: number,
  fwdX: number,
  fwdZ: number,
  probeDist: number,
  layout: CityLayout,
): boolean {
  const px = x + fwdX * probeDist;
  const pz = z + fwdZ * probeDist;
  for (let i = 0; i < layout.colliders.length; i++) {
    const b = layout.colliders[i];
    if (b.kind !== 'building' && b.kind !== 'house' && b.kind !== 'container') continue;
    if (px >= b.minX - 1.1 && px <= b.maxX + 1.1 && pz >= b.minZ - 1.1 && pz <= b.maxZ + 1.1) {
      return true;
    }
  }
  return false;
}

export function stepTrafficAndPolice(
  vehicles: VehicleState[],
  rawDt: number,
  elapsedTime: number,
  wantedLevel: number,
  playerX: number,
  playerZ: number,
  playerInVehicle: boolean,
  layout: CityLayout = CITY_LAYOUT,
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const signal = getTrafficSignalState(elapsedTime);
  let activeChasersAssigned = 0;

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];

    // Decay unoccupied vehicles smoothly to rest
    if (v.occupant === 'none') {
      if (Math.abs(v.speed) > 0.05) {
        v.speed = dampValue(v.speed, 0, 3.5, dt);
        const fwdX = -Math.sin(v.yaw);
        const fwdZ = -Math.cos(v.yaw);
        v.x += fwdX * v.speed * dt;
        v.z += fwdZ * v.speed * dt;
        resolveVehicleWorldCollision(v, layout);
        v.y = dampValue(v.y, getGroundHeightAt(v.x, v.z, layout), 20, dt);
        v.wheelSpin -= (v.speed * dt) / VEHICLE_SPECS[v.kind].wheelRadius;
      } else {
        v.speed = 0;
        v.isBraking = false;
      }
      continue;
    }

    if (v.occupant === 'player') continue;

    const spec = VEHICLE_SPECS[v.kind];
    const isChasingPolice =
      v.occupant === 'police' && wantedLevel > 0 && activeChasersAssigned < wantedLevel;

    if (isChasingPolice) {
      activeChasersAssigned++;
      v.sirenPhase += dt * 11;

      const dx = playerX - v.x;
      const dz = playerZ - v.z;
      const distToPlayer = Math.hypot(dx, dz);

      const dirToPlayerX = distToPlayer > 0.1 ? dx / distToPlayer : 0;
      const dirToPlayerZ = distToPlayer > 0.1 ? dz / distToPlayer : -1;
      let desiredYaw = Math.atan2(-dirToPlayerX, -dirToPlayerZ);

      const curFwdX = -Math.sin(v.yaw);
      const curFwdZ = -Math.cos(v.yaw);

      // Obstacle avoidance so police cars never get stuck nose-first against buildings
      if (v.aiAvoidTimer > 0) {
        v.aiAvoidTimer = Math.max(0, v.aiAvoidTimer - dt);
        desiredYaw = v.yaw + v.aiAvoidSide * 1.15;
      } else if (hasForwardBuildingCollider(v.x, v.z, curFwdX, curFwdZ, 5.2, layout)) {
        // Probe left vs right clearance
        const leftX = -curFwdZ;
        const leftZ = curFwdX;
        const leftBlocked = hasForwardBuildingCollider(v.x, v.z, leftX, leftZ, 5.0, layout);
        v.aiAvoidSide = leftBlocked ? -1 : 1;
        v.aiAvoidTimer = 0.75;
        desiredYaw = v.yaw + v.aiAvoidSide * 1.15;
      }

      const yawDelta = shortestAngleDelta(v.yaw, desiredYaw);
      v.steerAngle = dampValue(v.steerAngle, Math.max(-0.42, Math.min(0.42, yawDelta)), 10, dt);

      // Keep fair intercept distance (stop ~4.8m from player when on foot so player isn't trapped endlessly)
      const minStandOff = playerInVehicle ? 3.8 : 5.2;
      let targetSpeed = 14.5 + wantedLevel * 2.2;
      if (distToPlayer < minStandOff) {
        targetSpeed = 0;
        v.isBraking = true;
      } else {
        v.isBraking = false;
      }

      // Brief reverse maneuver if stuck against a wall
      if (v.aiStuckTimer > 0.65) {
        targetSpeed = -7.0;
        if (v.aiStuckTimer > 1.35) {
          v.aiStuckTimer = 0;
        }
      }

      v.speed = dampValue(v.speed, targetSpeed, targetSpeed === 0 ? 7.5 : 3.2, dt);
      if (Math.abs(v.speed) > 0.25) {
        const turnDir = v.speed >= 0 ? 1 : -1;
        v.yaw += Math.max(-1, Math.min(1, yawDelta * 1.8)) * turnDir * spec.turnRate * dt;
      }

      const fwdX = -Math.sin(v.yaw);
      const fwdZ = -Math.cos(v.yaw);
      const prevX = v.x;
      const prevZ = v.z;
      v.x += fwdX * v.speed * dt;
      v.z += fwdZ * v.speed * dt;
      const col = resolveVehicleWorldCollision(v, layout);
      const moved = Math.hypot(v.x - prevX, v.z - prevZ);

      if (targetSpeed > 4 && (col.collided || moved < 0.08 * dt * 20)) {
        v.aiStuckTimer += dt;
      } else if (moved > 0.25 * dt * 20) {
        v.aiStuckTimer = Math.max(0, v.aiStuckTimer - dt * 2);
      }

      v.y = dampValue(v.y, getGroundHeightAt(v.x, v.z, layout), 20, dt);
      v.wheelSpin -= (v.speed * dt) / spec.wheelRadius;
      continue;
    }

    // Civilian Traffic & Idle Police Patrol along Road Lane Loops
    v.sirenPhase = 0;
    const loop = TRAFFIC_LANE_LOOPS[v.aiLoopIndex % TRAFFIC_LANE_LOOPS.length];
    const target = loop.points[v.aiWaypointIndex % loop.points.length];
    const dx = target.x - v.x;
    const dz = target.z - v.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 2.2) {
      v.aiWaypointIndex = (v.aiWaypointIndex + 1) % loop.points.length;
    }

    const dirX = dist > 0.01 ? dx / dist : -Math.sin(v.yaw);
    const dirZ = dist > 0.01 ? dz / dist : -Math.cos(v.yaw);
    const targetYaw = Math.atan2(-dirX, -dirZ);
    const yawDiff = shortestAngleDelta(v.yaw, targetYaw);

    v.steerAngle = dampValue(v.steerAngle, Math.max(-0.4, Math.min(0.4, yawDiff)), 10, dt);
    v.yaw += yawDiff * (1 - Math.exp(-5.5 * dt));

    const fwdX = -Math.sin(v.yaw);
    const fwdZ = -Math.cos(v.yaw);

    // Intersection stop & forward obstacle avoidance
    const redLight = isApproachingRedIntersection(v.x, v.z, fwdX, fwdZ, signal);
    const obstacleFactor = computeForwardObstacleFactor(
      v,
      fwdX,
      fwdZ,
      vehicles,
      playerX,
      playerZ,
      playerInVehicle,
    );

    const cornerFactor = Math.abs(yawDiff) > 0.45 ? 0.65 : 1.0;
    const desiredSpeed = redLight ? 0 : v.aiCruiseSpeed * obstacleFactor * cornerFactor;

    v.isBraking = desiredSpeed < v.speed - 0.8 || desiredSpeed < 0.2;
    const accelLambda = desiredSpeed < v.speed ? 6.5 : 2.8;
    v.speed = dampValue(v.speed, desiredSpeed, accelLambda, dt);
    if (desiredSpeed === 0 && Math.abs(v.speed) < 0.15) {
      v.speed = 0;
    }

    v.x += fwdX * v.speed * dt;
    v.z += fwdZ * v.speed * dt;
    resolveVehicleWorldCollision(v, layout);
    v.y = dampValue(v.y, getGroundHeightAt(v.x, v.z, layout), 20, dt);
    v.wheelSpin -= (v.speed * dt) / spec.wheelRadius;
  }
}
