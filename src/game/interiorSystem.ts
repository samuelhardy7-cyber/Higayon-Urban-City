import { canExitElevatorCabin, isPointInElevatorCabin, type ElevatorRuntimeState } from './elevatorSystem';
import {
  COYOTE_TIME,
  GRAVITY,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  SPRINT_SPEED,
  WALK_SPEED,
  dampValue,
  shortestAngleDelta,
} from './playerPhysics';
import type {
  BuildingEntranceSpec,
  CityLayout,
  ColliderBox,
  InputState,
  InteriorBlueprint,
  InteriorDoorState,
  InteriorElevator,
  PlayerState,
} from './types';
import { getGroundHeightAt, raycastCameraCollision, resolveCircleAABBCollision } from './worldData';

export interface InteriorInteractable {
  kind: 'building_exit' | 'rooftop_exit' | 'interior_door' | 'elevator' | 'elevator_panel' | 'sit_seat' | 'reward_shop' | 'board_flight';
  id: string;
  label: string;
  distance: number;
}

export interface FloorCeilingInfo {
  floorY: number;
  ceilingY: number;
  currentFloor: number;
  onStairs: boolean;
  hasOpenSky: boolean;
}

export interface SittableSpot {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  distance: number;
}

export function createInteriorDoorStates(blueprint: InteriorBlueprint): InteriorDoorState[] {
  return blueprint.doors.map((d) => ({
    ...d,
    isOpen: false,
    openProgress: 0,
  }));
}

export function stepInteriorDoors(doors: InteriorDoorState[], dt: number): void {
  const speed = 3.2;
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    const target = d.isOpen ? 1 : 0;
    if (Math.abs(d.openProgress - target) < 0.005) {
      d.openProgress = target;
    } else if (d.openProgress < target) {
      d.openProgress = Math.min(1, d.openProgress + speed * dt);
    } else {
      d.openProgress = Math.max(0, d.openProgress - speed * dt);
    }
  }
}

export function findNearestExteriorEntrance(
  x: number,
  z: number,
  entrances: BuildingEntranceSpec[],
  maxDistance = 3.1,
): BuildingEntranceSpec | null {
  let best: BuildingEntranceSpec | null = null;
  let bestDistSq = maxDistance * maxDistance;

  for (let i = 0; i < entrances.length; i++) {
    const e = entrances[i];
    const outX = Math.sin(e.yaw);
    const outZ = Math.cos(e.yaw);
    const tx = e.doorX + outX * 0.95;
    const tz = e.doorZ + outZ * 0.95;
    const dSq = (x - tx) * (x - tx) + (z - tz) * (z - tz);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = e;
    }
  }
  return best;
}

export function findSafeOutdoorExitPos(
  entrance: BuildingEntranceSpec,
  layout: CityLayout,
): { x: number; y: number; z: number; yaw: number } {
  const outX = Math.sin(entrance.yaw);
  const outZ = Math.cos(entrance.yaw);
  const rawX = entrance.doorX + outX * 1.9;
  const rawZ = entrance.doorZ + outZ * 1.9;
  const groundY = getGroundHeightAt(rawX, rawZ, layout);
  const resolved = resolveCircleAABBCollision(
    rawX,
    rawZ,
    PLAYER_RADIUS + 0.05,
    groundY,
    PLAYER_HEIGHT,
    layout,
  );
  return {
    x: resolved.x,
    y: getGroundHeightAt(resolved.x, resolved.z, layout),
    z: resolved.z,
    yaw: entrance.yaw + Math.PI,
  };
}

export function findInteriorRooftopEntrySpawn(
  blueprint: InteriorBlueprint,
  targetFloor: number,
): { x: number; y: number; z: number; yaw: number } {
  const roofDoor = blueprint.doors.find((d) => Boolean(d.rooftopTarget));
  if (roofDoor) {
    const midX = roofDoor.hingeX + Math.cos(roofDoor.closedYaw) * roofDoor.width * 0.5;
    const midZ = roofDoor.hingeZ - Math.sin(roofDoor.closedYaw) * roofDoor.width * 0.5;
    return {
      x: midX,
      y: roofDoor.y,
      z: midZ + 1.4,
      yaw: Math.PI,
    };
  }
  const slab =
    blueprint.floorSlabs.find((s) => s.floorNumber === targetFloor) ??
    blueprint.floorSlabs[blueprint.floorSlabs.length - 1];
  return {
    x: slab ? (slab.minX + slab.maxX) * 0.5 : blueprint.spawn.x,
    y: slab ? slab.y : 0,
    z: slab ? (slab.minZ + slab.maxZ) * 0.5 : blueprint.spawn.z,
    yaw: Math.PI,
  };
}

export function getInteriorFloorAndCeilingAt(
  x: number,
  y: number,
  z: number,
  blueprint: InteriorBlueprint,
  elevatorState?: ElevatorRuntimeState | null,
): FloorCeilingInfo {
  // 0. Check if riding inside an active elevator cabin
  if (elevatorState) {
    const el = blueprint.elevators.find((e) => e.id === elevatorState.elevatorId);
    if (el && isPointInElevatorCabin(x, y, z, el, elevatorState.currentY, 0.2)) {
      return {
        floorY: elevatorState.currentY,
        ceilingY: elevatorState.currentY + 3.4,
        currentFloor: elevatorState.currentFloor,
        onStairs: false,
        hasOpenSky: false,
      };
    }
  }

  // 1. Check staircases & switchback mid-landings
  for (let i = 0; i < blueprint.staircases.length; i++) {
    const st = blueprint.staircases[i];
    if (st.midLanding) {
      const ml = st.midLanding;
      if (
        x >= ml.minX - 0.12 &&
        x <= ml.maxX + 0.12 &&
        z >= ml.minZ - 0.12 &&
        z <= ml.maxZ + 0.12 &&
        Math.abs(y - ml.y) <= 1.25
      ) {
        return {
          floorY: ml.y,
          ceilingY: st.yEnd + 3.55,
          currentFloor: st.fromFloor,
          onStairs: true,
          hasOpenSky: false,
        };
      }
    }

    if (
      x >= st.minX - 0.12 &&
      x <= st.maxX + 0.12 &&
      z >= st.minZ - 0.12 &&
      z <= st.maxZ + 0.12 &&
      y >= st.yStart - 0.85 &&
      y <= st.yEnd + 0.85
    ) {
      let t = 0;
      if (st.axis === 'z') {
        const span = Math.max(0.01, st.maxZ - st.minZ);
        t = st.direction === 1 ? (z - st.minZ) / span : (st.maxZ - z) / span;
      } else {
        const span = Math.max(0.01, st.maxX - st.minX);
        t = st.direction === 1 ? (x - st.minX) / span : (st.maxX - x) / span;
      }
      t = Math.max(0, Math.min(1, t));
      const floorY = st.yStart + (st.yEnd - st.yStart) * t;
      return {
        floorY,
        ceilingY: st.yEnd + 3.55,
        currentFloor: t > 0.6 ? st.toFloor : st.fromFloor,
        onStairs: true,
        hasOpenSky: false,
      };
    }
  }

  // 2. Otherwise choose the highest walkable floor slab beneath/near player's feet
  let bestSlab = blueprint.floorSlabs[0];
  let bestY = -Infinity;
  for (let i = 0; i < blueprint.floorSlabs.length; i++) {
    const s = blueprint.floorSlabs[i];
    if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
      if (s.y <= y + 1.25 && s.y > bestY) {
        bestY = s.y;
        bestSlab = s;
      }
    }
  }

  if (bestY === -Infinity && blueprint.floorSlabs.length > 0) {
    bestSlab = blueprint.floorSlabs[0];
  }

  return {
    floorY: bestSlab ? bestSlab.y : 0,
    ceilingY: bestSlab ? bestSlab.ceilingY : 3.5,
    currentFloor: bestSlab ? bestSlab.floorNumber : 1,
    onStairs: false,
    hasOpenSky: Boolean(bestSlab?.hasOpenSky),
  };
}

function pushCircleOutOfSegment(
  cx: number,
  cz: number,
  radius: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  halfThick: number,
): { x: number; z: number; hit: boolean } {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  let t = 0;
  if (lenSq > 1e-6) {
    t = Math.max(0, Math.min(1, ((cx - ax) * abx + (cz - az) * abz) / lenSq));
  }
  const px = ax + abx * t;
  const pz = az + abz * t;
  const dx = cx - px;
  const dz = cz - pz;
  const minD = radius + halfThick;
  const dSq = dx * dx + dz * dz;
  if (dSq < minD * minD) {
    if (dSq > 1e-8) {
      const d = Math.sqrt(dSq);
      const push = minD - d;
      return { x: cx + (dx / d) * push, z: cz + (dz / d) * push, hit: true };
    }
    return { x: cx, z: cz - minD, hit: true };
  }
  return { x: cx, z: cz, hit: false };
}

function getDoorLeafSegment(d: InteriorDoorState): {
  ax: number;
  az: number;
  bx: number;
  bz: number;
} {
  const theta = d.closedYaw + d.openAngle * d.openProgress;
  const bx = d.hingeX + d.width * Math.cos(theta);
  const bz = d.hingeZ - d.width * Math.sin(theta);
  return { ax: d.hingeX, az: d.hingeZ, bx, bz };
}

export function resolveInteriorCollision(
  x: number,
  z: number,
  radius: number,
  playerY: number,
  playerHeight: number,
  blueprint: InteriorBlueprint,
  doors: InteriorDoorState[],
  elevatorState?: ElevatorRuntimeState | null,
): { x: number; z: number; collided: boolean } {
  const pad = 0.16;
  let nx = Math.max(
    blueprint.bounds.minX + pad + radius,
    Math.min(blueprint.bounds.maxX - pad - radius, x),
  );
  let nz = Math.max(
    blueprint.bounds.minZ + pad + radius,
    Math.min(blueprint.bounds.maxZ - pad - radius, z),
  );
  let collided = nx !== x || nz !== z;

  const pushFromBox = (
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
  ) => {
    if (maxY <= playerY + 0.18 || minY >= playerY + playerHeight) {
      return;
    }
    const closestX = Math.max(minX, Math.min(nx, maxX));
    const closestZ = Math.max(minZ, Math.min(nz, maxZ));
    const dx = nx - closestX;
    const dz = nz - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      collided = true;
      if (distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      } else {
        const penL = Math.abs(nx - minX);
        const penR = Math.abs(maxX - nx);
        const penN = Math.abs(nz - minZ);
        const penS = Math.abs(maxZ - nz);
        const m = Math.min(penL, penR, penN, penS);
        if (m === penL) nx = minX - radius;
        else if (m === penR) nx = maxX + radius;
        else if (m === penN) nz = minZ - radius;
        else nz = maxZ + radius;
      }
    }
  };

  for (let pass = 0; pass < 2; pass++) {
    // 1. Walls, partitions, pillars, railings
    for (let i = 0; i < blueprint.walls.length; i++) {
      const w = blueprint.walls[i];
      pushFromBox(w.minX, w.maxX, w.minY, w.maxY, w.minZ, w.maxZ);
    }

    // 2. Furniture props
    for (let i = 0; i < blueprint.furniture.length; i++) {
      const f = blueprint.furniture[i];
      const rot90 = Math.abs(Math.sin(f.rotY)) > 0.7;
      const hw = (rot90 ? f.depth : f.width) * 0.5;
      const hd = (rot90 ? f.width : f.depth) * 0.5;
      pushFromBox(f.x - hw, f.x + hw, f.y, f.y + f.height, f.z - hd, f.z + hd);
    }

    // 3. Doors (physical rotating door leaf segment)
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.y + d.height <= playerY + 0.15 || d.y >= playerY + playerHeight) {
        continue;
      }
      const seg = getDoorLeafSegment(d);
      const res = pushCircleOutOfSegment(
        nx,
        nz,
        radius,
        seg.ax,
        seg.az,
        seg.bx,
        seg.bz,
        d.thickness * 0.5,
      );
      if (res.hit) {
        nx = res.x;
        nz = res.z;
        collided = true;
      }
    }

    // 4. Physical Elevator Cabin / Hoistway Safety Doors
    if (elevatorState) {
      for (let i = 0; i < blueprint.elevators.length; i++) {
        const el = blueprint.elevators[i];
        if (el.id !== elevatorState.elevatorId) continue;

        const hw = el.width * 0.5;
        const hd = el.depth * 0.5;
        const minX = el.x - hw;
        const maxX = el.x + hw;
        const minZ = el.z - hd;
        const doorZ = el.z + hd;
        const doorsPassable =
          canExitElevatorCabin(elevatorState) &&
          Math.abs(playerY - elevatorState.currentY) <= 0.8;

        if (isPointInElevatorCabin(nx, playerY, nz, el, elevatorState.currentY, 0.15)) {
          // Inside cabin: constrain within cabin inner walls
          const inPad = 0.22 + radius * 0.5;
          if (nx < minX + inPad) {
            nx = minX + inPad;
            collided = true;
          }
          if (nx > maxX - inPad) {
            nx = maxX - inPad;
            collided = true;
          }
          if (nz < minZ + inPad) {
            nz = minZ + inPad;
            collided = true;
          }
          if (!doorsPassable && nz > doorZ - 0.25) {
            nz = doorZ - 0.25;
            collided = true;
          }
        } else {
          // Outside cabin: block empty shaft or closed hoistway doors
          if (!doorsPassable) {
            pushFromBox(minX, maxX, playerY - 0.5, playerY + 3.0, minZ, doorZ + 0.08);
          } else {
            // Even when open, keep shaft side/back enclosures solid
            pushFromBox(minX - 0.15, minX + 0.14, playerY - 0.5, playerY + 3.0, minZ, doorZ);
            pushFromBox(maxX - 0.14, maxX + 0.15, playerY - 0.5, playerY + 3.0, minZ, doorZ);
            pushFromBox(minX, maxX, playerY - 0.5, playerY + 3.0, minZ - 0.15, minZ + 0.15);
          }
        }
      }
    }
  }

  return { x: nx, z: nz, collided };
}

export function stepInteriorPlayerPhysics(
  state: PlayerState,
  input: InputState,
  rawDt: number,
  blueprint: InteriorBlueprint,
  doors: InteriorDoorState[],
  elevatorState?: ElevatorRuntimeState | null,
): { jumped: boolean; landed: boolean; floorInfo: FloorCeilingInfo } {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  state.elapsedTime += dt;

  let axisX = input.moveX + (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let axisY = input.moveY + (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const axisMag = Math.hypot(axisX, axisY);
  if (axisMag > 1) {
    axisX /= axisMag;
    axisY /= axisMag;
  }
  const hasMoveInput = axisMag > 0.08;

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

  const indoorWalk = WALK_SPEED * 0.88;
  const indoorSprint = SPRINT_SPEED * 0.78;
  const wantsSprint = input.sprint && hasMoveInput;
  if (wantsSprint && state.stamina > 1.5) {
    state.isSprinting = true;
    state.stamina = Math.max(0, state.stamina - 18 * dt);
  } else {
    state.isSprinting = false;
    state.stamina = Math.min(100, state.stamina + (hasMoveInput ? 16 : 26) * dt);
  }

  const targetSpeed = hasMoveInput
    ? (state.isSprinting ? indoorSprint : indoorWalk) * Math.min(1, axisMag)
    : 0;
  const targetVx = normWishX * targetSpeed;
  const targetVz = normWishZ * targetSpeed;

  const accelLambda = state.grounded ? (hasMoveInput ? 15 : 18) : 6.0;
  state.vx = dampValue(state.vx, targetVx, accelLambda, dt);
  state.vz = dampValue(state.vz, targetVz, accelLambda, dt);

  if (hasMoveInput) {
    const targetYaw = Math.atan2(-normWishX, -normWishZ);
    const angleDiff = shortestAngleDelta(state.yaw, targetYaw);
    state.yaw += angleDiff * (1 - Math.exp(-14 * dt));
  }

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
  if (state.jumpBufferTimer > 0 && state.coyoteTimer > 0) {
    state.vy = JUMP_VELOCITY * 0.78;
    state.grounded = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    state.squashY = 1.14;
    jumped = true;
  }

  if (!input.jumpHeld && state.vy > 2.8) {
    state.vy *= Math.pow(0.45, dt * 15);
  }

  state.vy += GRAVITY * dt;

  const nextX = state.x + state.vx * dt;
  const nextZ = state.z + state.vz * dt;
  const resolved = resolveInteriorCollision(
    nextX,
    nextZ,
    PLAYER_RADIUS,
    state.y,
    PLAYER_HEIGHT,
    blueprint,
    doors,
    elevatorState,
  );

  const actualDx = resolved.x - state.x;
  const actualDz = resolved.z - state.z;
  state.x = resolved.x;
  state.z = resolved.z;

  if (resolved.collided && dt > 1e-5) {
    state.vx = actualDx / dt;
    state.vz = actualDz / dt;
  }

  const prevGrounded = state.grounded;
  const floorInfo = getInteriorFloorAndCeilingAt(
    state.x,
    state.y,
    state.z,
    blueprint,
    elevatorState,
  );
  state.y += state.vy * dt;

  const maxHeadY = floorInfo.ceilingY - PLAYER_HEIGHT - 0.08;
  if (state.y > maxHeadY) {
    state.y = maxHeadY;
    if (state.vy > 0) state.vy = 0;
  }

  let landed = false;
  if (state.y <= floorInfo.floorY) {
    if (!prevGrounded && state.vy < -2.2) {
      landed = true;
      state.squashY = 0.84;
    }
    state.y = floorInfo.floorY;
    state.vy = 0;
    state.grounded = true;
  } else if (state.y - floorInfo.floorY <= 0.34 && state.vy <= 0 && prevGrounded) {
    state.y = floorInfo.floorY;
    state.vy = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  const stepDist = Math.hypot(actualDx, actualDz);
  state.speed = dt > 1e-5 ? stepDist / dt : 0;
  state.isMoving = state.speed > 0.22;
  state.distanceWalked += stepDist;
  if (state.grounded && state.isMoving) {
    state.gaitPhase += stepDist * 2.15;
  }
  state.squashY = dampValue(state.squashY, 1, 14, dt);

  return { jumped, landed, floorInfo };
}

export function findNearestSittableProp(
  x: number,
  y: number,
  z: number,
  blueprint: InteriorBlueprint,
  maxDistance = 2.0,
): SittableSpot | null {
  let best: SittableSpot | null = null;
  let bestDist = maxDistance;

  for (let i = 0; i < blueprint.furniture.length; i++) {
    const f = blueprint.furniture[i];
    if (f.kind !== 'sofa') continue;
    if (Math.abs(y - f.y) > 1.3) continue;
    const dist = Math.hypot(x - f.x, z - f.z);
    if (dist <= bestDist) {
      bestDist = dist;
      // Sit slightly forward of sofa backrest
      const seatOffset = 0.14;
      best = {
        id: f.id,
        label: 'Sit on Sofa',
        x: f.x + Math.sin(f.rotY) * seatOffset,
        y: f.y + 0.1,
        z: f.z + Math.cos(f.rotY) * seatOffset,
        yaw: f.rotY + Math.PI,
        distance: dist,
      };
    }
  }
  return best;
}

export function findNearestInteriorInteractable(
  x: number,
  y: number,
  z: number,
  blueprint: InteriorBlueprint,
  doors: InteriorDoorState[],
  currentFloor: number,
  elevatorState?: ElevatorRuntimeState | null,
): InteriorInteractable | null {
  let best: InteriorInteractable | null = null;
  let bestDist = Infinity;

  // Check doors (exit door + partition doors)
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (Math.abs(y - d.y) > 1.75) continue;
    const midX = d.hingeX + Math.cos(d.closedYaw) * d.width * 0.5;
    const midZ = d.hingeZ - Math.sin(d.closedYaw) * d.width * 0.5;
    const dist = Math.hypot(x - midX, z - midZ);
    const maxRange = d.isExitDoor || d.rooftopTarget ? 2.45 : 2.3;
    if (dist <= maxRange && dist < bestDist) {
      bestDist = dist;
      const kind: InteriorInteractable['kind'] = d.isExitDoor
        ? 'building_exit'
        : d.rooftopTarget
          ? 'rooftop_exit'
          : 'interior_door';
      const label = d.isExitDoor
        ? d.label
        : d.rooftopTarget
          ? `Step Out: ${d.label}`
          : `${d.isOpen ? 'Close' : 'Open'} ${d.label}`;
      best = {
        kind,
        id: d.id,
        label,
        distance: dist,
      };
    }
  }

  // Check elevators (inside cabin -> floor panel; outside doorway -> call button)
  for (let i = 0; i < blueprint.elevators.length; i++) {
    const el: InteriorElevator = blueprint.elevators[i];
    const cabinY = elevatorState ? elevatorState.currentY : y;
    const inCabin = isPointInElevatorCabin(x, y, z, el, cabinY, 0.15);
    const distToCenter = Math.hypot(x - el.x, z - el.z);
    const callSpotZ = el.z + el.depth * 0.5 + 0.55;
    const distToCall = Math.hypot(x - el.x, z - callSpotZ);

    if (inCabin && distToCenter < bestDist) {
      bestDist = distToCenter;
      best = {
        kind: 'elevator_panel',
        id: el.id,
        label: `Select Floor (1–${el.floors.length})`,
        distance: distToCenter,
      };
    } else if (!inCabin && distToCall <= 2.35 && distToCall < bestDist) {
      bestDist = distToCall;
      const curElevFloor = elevatorState?.currentFloor ?? currentFloor;
      const statusText =
        elevatorState && elevatorState.moving
          ? `Elevator (Floor ${curElevFloor} → ${elevatorState.targetFloor ?? curElevFloor})`
          : curElevFloor === currentFloor && elevatorState && canExitElevatorCabin(elevatorState)
            ? 'Enter Elevator Cabin'
            : `Call Elevator (Now F${curElevFloor})`;
      best = {
        kind: 'elevator',
        id: el.id,
        label: statusText,
        distance: distToCall,
      };
    }
  }

  // Interactive 3D Reward Shop Kiosk & Character Showcase Stands inside CITY REWARD CENTER
  if (blueprint.subtype === 'reward_shop') {
    for (let i = 0; i < blueprint.furniture.length; i++) {
      const f = blueprint.furniture[i];
      if (f.kind !== 'reward_kiosk' && f.kind !== 'mannequin_stand') continue;
      if (Math.abs(y - f.y) > 1.5) continue;
      const dist = Math.hypot(x - f.x, z - f.z);
      if (dist <= 2.65 && dist < bestDist) {
        bestDist = dist;
        best = {
          kind: 'reward_shop',
          id: f.id,
          label: 'Open 3D Reward Shop & Studio',
          distance: dist,
        };
      }
    }
  }

  // Interactive Flight Boarding Desk inside Airport Terminals
  if (blueprint.subtype === 'airport_terminal') {
    for (let i = 0; i < blueprint.furniture.length; i++) {
      const f = blueprint.furniture[i];
      if (f.kind !== 'boarding_desk') continue;
      if (Math.abs(y - f.y) > 1.5) continue;
      const dist = Math.hypot(x - f.x, z - f.z);
      if (dist <= 3.1 && dist < bestDist) {
        bestDist = dist;
        best = {
          kind: 'board_flight',
          id: f.id,
          label: 'Flight Boarding Desk — Fly to Another City',
          distance: dist,
        };
      }
    }
  }

  // Fallback lower-priority sittable sofa interaction
  if (!best) {
    const seat = findNearestSittableProp(x, y, z, blueprint, 1.9);
    if (seat) {
      best = {
        kind: 'sit_seat',
        id: seat.id,
        label: seat.label,
        distance: seat.distance,
      };
    }
  }

  return best;
}

export function raycastInteriorCamera(
  ox: number,
  oy: number,
  oz: number,
  tx: number,
  ty: number,
  tz: number,
  blueprint: InteriorBlueprint,
  floorInfo: FloorCeilingInfo,
): { x: number; y: number; z: number; clipped: boolean } {
  const colliders: ColliderBox[] = [];

  for (let i = 0; i < blueprint.walls.length; i++) {
    const w = blueprint.walls[i];
    if (!w.blocksCamera) continue;
    colliders.push({
      id: w.id,
      minX: w.minX,
      maxX: w.maxX,
      minY: w.minY,
      maxY: w.maxY,
      minZ: w.minZ,
      maxZ: w.maxZ,
      kind: 'building',
      blocksCamera: true,
    });
  }

  for (let i = 0; i < blueprint.furniture.length; i++) {
    const f = blueprint.furniture[i];
    if (f.blocksCamera === false || f.height < 1.35) continue;
    const rot90 = Math.abs(Math.sin(f.rotY)) > 0.7;
    const hw = (rot90 ? f.depth : f.width) * 0.5;
    const hd = (rot90 ? f.width : f.depth) * 0.5;
    colliders.push({
      id: f.id,
      minX: f.x - hw,
      maxX: f.x + hw,
      minY: f.y,
      maxY: f.y + f.height,
      minZ: f.z - hd,
      maxZ: f.z + hd,
      kind: 'prop',
      blocksCamera: true,
    });
  }

  const clampedTy = Math.max(
    floorInfo.floorY + 0.55,
    Math.min(floorInfo.ceilingY - 0.32, ty),
  );

  const hit = raycastCameraCollision(
    ox,
    oy,
    oz,
    tx,
    clampedTy,
    tz,
    colliders,
    0.34,
  );

  const margin = 0.32;
  const safeX = Math.max(
    blueprint.bounds.minX + margin,
    Math.min(blueprint.bounds.maxX - margin, hit.x),
  );
  const safeZ = Math.max(
    blueprint.bounds.minZ + margin,
    Math.min(blueprint.bounds.maxZ - margin, hit.z),
  );
  const safeY = Math.max(
    floorInfo.floorY + 0.5,
    Math.min(floorInfo.ceilingY - 0.3, hit.y),
  );

  return {
    x: safeX,
    y: safeY,
    z: safeZ,
    clipped: hit.clipped || safeX !== hit.x || safeZ !== hit.z || safeY !== hit.y,
  };
}
