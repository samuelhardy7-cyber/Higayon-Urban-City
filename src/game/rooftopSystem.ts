import type {
  CityLayout,
  ColliderBox,
  ExteriorLadderSpec,
  PlayerState,
  RooftopSpec,
} from './types';

export interface NearestLadderMatch {
  ladder: ExteriorLadderSpec;
  entryEnd: 'bottom' | 'top';
  distance: number;
}

export function findRooftopAt(
  x: number,
  y: number,
  z: number,
  layout: CityLayout,
  tolerance = 1.2,
): RooftopSpec | null {
  for (const roof of layout.rooftops) {
    if (
      y >= roof.y - tolerance &&
      y <= roof.y + 4.5 &&
      x >= roof.minX - 0.35 &&
      x <= roof.maxX + 0.35 &&
      z >= roof.minZ - 0.35 &&
      z <= roof.maxZ + 0.35
    ) {
      return roof;
    }
  }
  return null;
}

export function findNearestExteriorLadder(
  x: number,
  y: number,
  z: number,
  layout: CityLayout,
  maxDist = 2.4,
): NearestLadderMatch | null {
  let best: NearestLadderMatch | null = null;
  for (const ladder of layout.ladders) {
    const standX = ladder.x + ladder.normalX * 0.55;
    const standZ = ladder.z + ladder.normalZ * 0.55;

    // Check bottom entry
    const dBottomHoriz = Math.hypot(x - standX, z - standZ);
    const dBottomY = Math.abs(y - ladder.bottomY);
    if (dBottomHoriz <= maxDist && dBottomY <= 1.8) {
      if (!best || dBottomHoriz < best.distance) {
        best = { ladder, entryEnd: 'bottom', distance: dBottomHoriz };
      }
    }

    // Check top entry (on rooftop edge)
    const dTopHoriz = Math.hypot(x - ladder.topStepX, z - ladder.topStepZ);
    const dTopY = Math.abs(y - ladder.topY);
    if (dTopHoriz <= maxDist + 0.3 && dTopY <= 1.8) {
      if (!best || dTopHoriz < best.distance) {
        best = { ladder, entryEnd: 'top', distance: dTopHoriz };
      }
    }
  }
  return best;
}

export function findNearestRooftopInteriorDoor(
  x: number,
  y: number,
  z: number,
  layout: CityLayout,
  maxDist = 2.6,
): { rooftop: RooftopSpec; targetFloor: number; distance: number } | null {
  let best: { rooftop: RooftopSpec; targetFloor: number; distance: number } | null = null;
  for (const roof of layout.rooftops) {
    if (!roof.interiorAccessDoor) continue;
    if (Math.abs(y - roof.y) > 1.8) continue;
    const dist = Math.hypot(
      x - roof.interiorAccessDoor.x,
      z - roof.interiorAccessDoor.z,
    );
    if (dist <= maxDist && (!best || dist < best.distance)) {
      best = {
        rooftop: roof,
        targetFloor: roof.interiorAccessDoor.targetFloor,
        distance: dist,
      };
    }
  }
  return best;
}

export interface LadderStepResult {
  finished: boolean;
  exitReason: 'none' | 'reached_top' | 'reached_bottom';
  climbSpeed: number;
}

export function stepLadderClimb(
  state: PlayerState,
  ladder: ExteriorLadderSpec,
  moveForwardAxis: number, // +1 = W/Up, -1 = S/Down
  dt: number,
): LadderStepResult {
  const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
  const climbVelocity = moveForwardAxis * 4.4;

  state.x = ladder.x + ladder.normalX * 0.56;
  state.z = ladder.z + ladder.normalZ * 0.56;
  state.yaw = ladder.climbYaw;
  state.vx = 0;
  state.vz = 0;
  state.vy = climbVelocity;
  state.grounded = false;
  state.isMoving = Math.abs(climbVelocity) > 0.1;
  state.speed = Math.abs(climbVelocity);
  state.y += climbVelocity * safeDt;
  state.elapsedTime += safeDt;

  if (state.y >= ladder.topY - 0.15 && moveForwardAxis > 0) {
    state.y = ladder.topY;
    state.x = ladder.topStepX;
    state.z = ladder.topStepZ;
    state.vy = 0;
    state.grounded = true;
    state.activeLadderId = null;
    state.activeRooftopId = ladder.buildingId;
    return { finished: true, exitReason: 'reached_top', climbSpeed: 0 };
  }

  if (state.y <= ladder.bottomY + 0.05 && moveForwardAxis < 0) {
    state.y = ladder.bottomY;
    state.x = ladder.x + ladder.normalX * 1.1;
    state.z = ladder.z + ladder.normalZ * 1.1;
    state.vy = 0;
    state.grounded = true;
    state.activeLadderId = null;
    state.activeRooftopId = null;
    return { finished: true, exitReason: 'reached_bottom', climbSpeed: 0 };
  }

  state.y = Math.max(ladder.bottomY, Math.min(ladder.topY, state.y));
  return { finished: false, exitReason: 'none', climbSpeed: climbVelocity };
}

export function findVaultableObstacleAhead(
  x: number,
  y: number,
  z: number,
  dirX: number,
  dirZ: number,
  colliders: ColliderBox[],
): ColliderBox | null {
  const len = Math.hypot(dirX, dirZ);
  if (len < 0.01) return null;
  const nx = dirX / len;
  const nz = dirZ / len;
  const probeX = x + nx * 0.85;
  const probeZ = z + nz * 0.85;

  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    if (!b.vaultable) continue;
    const obsHeight = b.maxY - y;
    if (obsHeight < 0.25 || obsHeight > 1.38) continue;
    if (b.minY > y + 0.4) continue;
    if (
      probeX >= b.minX - 0.45 &&
      probeX <= b.maxX + 0.45 &&
      probeZ >= b.minZ - 0.45 &&
      probeZ <= b.maxZ + 0.45
    ) {
      return b;
    }
  }
  return null;
}
