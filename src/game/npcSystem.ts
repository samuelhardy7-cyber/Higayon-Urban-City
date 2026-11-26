import { resolveInteriorCollision } from './interiorSystem';
import { dampValue, shortestAngleDelta } from './playerPhysics';
import { OUTDOOR_KIOSK_ANCHORS } from './questionPlacement';
import type { QuizKioskPlacement } from './questionTypes';
import type {
  CityLayout,
  InteriorBlueprint,
  InteriorDoorState,
  NpcActivity,
  NpcState,
} from './types';
import { CITY_LAYOUT, getGroundHeightAt, resolveCircleAABBCollision } from './worldData';

export const NPC_RADIUS = 0.36;

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function isOutdoorSpotClearForNpc(
  x: number,
  z: number,
  y: number,
  layout: CityLayout = CITY_LAYOUT,
): boolean {
  // Keep player initial spawn plaza unobstructed
  if (Math.hypot(x - layout.spawn.x, z - layout.spawn.z) < 3.2) {
    return false;
  }

  // Never spawn or linger blocking exterior building doors
  for (let i = 0; i < layout.entrances.length; i++) {
    const e = layout.entrances[i];
    const outX = Math.sin(e.yaw);
    const outZ = Math.cos(e.yaw);
    const frontX = e.doorX + outX * 1.15;
    const frontZ = e.doorZ + outZ * 1.15;
    if (Math.hypot(x - frontX, z - frontZ) < 2.35 || Math.hypot(x - e.doorX, z - e.doorZ) < 1.95) {
      return false;
    }
  }

  // Keep outdoor educational quiz kiosks clear
  for (let i = 0; i < OUTDOOR_KIOSK_ANCHORS.length; i++) {
    const k = OUTDOOR_KIOSK_ANCHORS[i];
    if (Math.hypot(x - k.x, z - k.z) < 2.1) {
      return false;
    }
  }

  const col = resolveCircleAABBCollision(x, z, NPC_RADIUS + 0.04, y, 1.75, layout);
  return !col.collided;
}

function nudgeOutdoorPointToClear(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  layout: CityLayout,
): { x: number; z: number } {
  const y0 = getGroundHeightAt(x, z, layout);
  if (isOutdoorSpotClearForNpc(x, z, y0, layout)) {
    return { x, z };
  }
  const sideX = -dirZ;
  const sideZ = dirX;
  const offsets: Array<[number, number]> = [
    [dirX * 2.6, dirZ * 2.6],
    [-dirX * 2.6, -dirZ * 2.6],
    [dirX * 4.2, dirZ * 4.2],
    [sideX * 1.4, sideZ * 1.4],
    [-sideX * 1.4, -sideZ * 1.4],
  ];
  for (const [ox, oz] of offsets) {
    const tx = x + ox;
    const tz = z + oz;
    const ty = getGroundHeightAt(tx, tz, layout);
    if (isOutdoorSpotClearForNpc(tx, tz, ty, layout)) {
      return { x: tx, z: tz };
    }
  }
  return { x, z };
}

export function createInitialNpcs(layout: CityLayout = CITY_LAYOUT): NpcState[] {
  const npcs: NpcState[] = [];
  const loops = layout.npcLoops;
  if (loops.length === 0) return npcs;

  // Spawn 2 NPCs per sidewalk loop across all 4 cities, verified clear of entrances/spawn/kiosks
  for (let li = 0; li < loops.length; li++) {
    const loop = loops[li];
    if (loop.points.length < 2) continue;

    for (let slot = 0; slot < 2; slot++) {
      const wpIdx = (slot * 2) % loop.points.length;
      const nextIdx = (wpIdx + 1) % loop.points.length;
      const p0 = loop.points[wpIdx];
      const p1 = loop.points[nextIdx];
      const segDx = p1.x - p0.x;
      const segDz = p1.z - p0.z;
      const segLen = Math.hypot(segDx, segDz) || 1;
      const dirX = segDx / segLen;
      const dirZ = segDz / segLen;

      // Start slightly along the sidewalk edge rather than directly on a corner
      const baseT = Math.min(0.28, 3.2 / segLen);
      const rawX = p0.x + segDx * baseT;
      const rawZ = p0.z + segDz * baseT;
      const clearPos = nudgeOutdoorPointToClear(rawX, rawZ, dirX, dirZ, layout);

      const yaw = Math.atan2(-dirX, -dirZ);
      const id = `npc_${li}_${slot}`;
      const speed = 1.22 + ((li * 3 + slot * 5) % 4) * 0.13;
      const nextPause = 9 + ((li * 7 + slot * 3) % 8);
      const startsPaused = slot === 1 && isOutdoorSpotClearForNpc(clearPos.x, clearPos.z, getGroundHeightAt(clearPos.x, clearPos.z, layout), layout);

      npcs.push({
        id,
        variant: (li * 2 + slot) % 6,
        x: clearPos.x,
        y: getGroundHeightAt(clearPos.x, clearPos.z, layout),
        z: clearPos.z,
        yaw,
        speed,
        gaitPhase: slot * 1.7 + li * 0.4,
        loopIndex: li,
        waypointIndex: nextIdx,
        pauseTimer: startsPaused ? 1.15 : 0,
        walkDistanceSincePause: 0,
        nextPauseDistance: nextPause,
        isPaused: startsPaused,
        activity: startsPaused ? (li % 2 === 0 ? 'idle_look' : 'chatting') : slot % 2 === 0 ? 'walk' : 'stroll',
        yieldTimer: 0,
      });
    }
  }
  return npcs;
}

function applyNpcSeparation(npcs: NpcState[], floorTolerance: number): void {
  const minSep = NPC_RADIUS * 2.15;
  const minSepSq = minSep * minSep;
  for (let i = 0; i < npcs.length; i++) {
    const a = npcs[i];
    for (let j = i + 1; j < npcs.length; j++) {
      const b = npcs[j];
      if (Math.abs(a.y - b.y) > floorTolerance) continue;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 1e-6 && dSq < minSepSq) {
        const d = Math.sqrt(dSq);
        const push = (minSep - d) * 0.35;
        const nx = dx / d;
        const nz = dz / d;
        if (a.activity !== 'sitting' && a.activity !== 'working') {
          a.x += nx * push;
          a.z += nz * push;
        }
        if (b.activity !== 'sitting' && b.activity !== 'working') {
          b.x -= nx * push;
          b.z -= nz * push;
        }
      }
    }
  }
}

export function stepNpcs(
  npcs: NpcState[],
  rawDt: number,
  playerX: number,
  playerZ: number,
  layout: CityLayout = CITY_LAYOUT,
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const loops = layout.npcLoops;

  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    const loop = loops[npc.loopIndex];
    if (!loop || loop.points.length < 2) continue;

    const pdx = playerX - npc.x;
    const pdz = playerZ - npc.z;
    const pDist = Math.hypot(pdx, pdz);

    // If player walks right up to a paused NPC, politely step aside instead of standing like a blocker
    if (npc.pauseTimer > 0) {
      if (pDist < 1.35) {
        npc.pauseTimer = 0;
        npc.isPaused = false;
      } else {
        npc.pauseTimer = Math.max(0, npc.pauseTimer - dt);
        npc.isPaused = npc.pauseTimer > 0;
        if (!npc.isPaused) {
          npc.activity = i % 3 === 0 ? 'stroll' : 'walk';
        }
        continue;
      }
    }

    npc.isPaused = false;
    npc.activity = i % 3 === 0 ? 'stroll' : 'walk';

    const target = loop.points[npc.waypointIndex];
    const dx = target.x - npc.x;
    const dz = target.z - npc.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.5) {
      npc.waypointIndex = (npc.waypointIndex + 1) % loop.points.length;
      if (
        npc.walkDistanceSincePause >= npc.nextPauseDistance &&
        pDist > 2.4 &&
        isOutdoorSpotClearForNpc(npc.x, npc.z, npc.y, layout)
      ) {
        npc.pauseTimer = 1.6 + ((i * 5) % 4) * 0.45;
        npc.walkDistanceSincePause = 0;
        npc.isPaused = true;
        npc.activity = i % 2 === 0 ? 'idle_look' : 'chatting';
      }
      continue;
    }

    let dirX = dx / dist;
    let dirZ = dz / dist;

    // Smooth lateral steering around the player so sidewalks never feel blocked
    if (pDist < 2.25 && pDist > 1e-4) {
      const toPlayerX = pdx / pDist;
      const toPlayerZ = pdz / pDist;
      const aheadDot = dirX * toPlayerX + dirZ * toPlayerZ;
      if (aheadDot > -0.15) {
        const cross = dirX * toPlayerZ - dirZ * toPlayerX;
        const sideSign = cross >= 0 ? -1 : 1;
        const perpX = -dirZ * sideSign;
        const perpZ = dirX * sideSign;
        const avoidStrength = pDist < 1.15 ? 1.35 : (2.25 - pDist) * 0.72;
        dirX = dirX * 0.65 + perpX * avoidStrength;
        dirZ = dirZ * 0.65 + perpZ * avoidStrength;
        const nLen = Math.hypot(dirX, dirZ) || 1;
        dirX /= nLen;
        dirZ /= nLen;
      }
    }

    const targetYaw = Math.atan2(-dirX, -dirZ);
    npc.yaw += shortestAngleDelta(npc.yaw, targetYaw) * (1 - Math.exp(-8 * dt));

    const speedBoost = pDist < 1.1 ? 1.18 : 1.0;
    const step = Math.min(dist + 0.3, npc.speed * speedBoost * dt);
    const nextX = npc.x + dirX * step;
    const nextZ = npc.z + dirZ * step;

    const resolved = resolveCircleAABBCollision(nextX, nextZ, NPC_RADIUS, npc.y, 1.75, layout);
    const moved = Math.hypot(resolved.x - npc.x, resolved.z - npc.z);
    npc.x = resolved.x;
    npc.z = resolved.z;
    npc.y = dampValue(npc.y, getGroundHeightAt(npc.x, npc.z, layout), 18, dt);

    npc.gaitPhase += moved * 2.25;
    npc.walkDistanceSincePause += moved;

    if (
      npc.walkDistanceSincePause >= npc.nextPauseDistance &&
      pDist > 2.4 &&
      isOutdoorSpotClearForNpc(npc.x, npc.z, npc.y, layout)
    ) {
      npc.pauseTimer = 1.8 + ((i * 3) % 4) * 0.5;
      npc.walkDistanceSincePause = 0;
      npc.isPaused = true;
      npc.activity = i % 2 === 0 ? 'idle_look' : 'chatting';
    }
  }

  applyNpcSeparation(npcs, 1.35);
}

// =========================================================================
// INTERIOR NPC SYSTEM (Inhabiting buildings without obstructing players)
// =========================================================================

export function isInteriorSpotClearForNpc(
  x: number,
  y: number,
  z: number,
  blueprint: InteriorBlueprint,
  doors: InteriorDoorState[],
  kiosks: QuizKioskPlacement[] = [],
  options?: { radius?: number; ignoreFurnitureCollision?: boolean },
): boolean {
  const radius = options?.radius ?? NPC_RADIUS + 0.14;
  if (
    x < blueprint.bounds.minX + 0.85 ||
    x > blueprint.bounds.maxX - 0.85 ||
    z < blueprint.bounds.minZ + 0.85 ||
    z > blueprint.bounds.maxZ - 0.85
  ) {
    return false;
  }

  // Must rest cleanly on a floor slab at this height
  const onSlab = blueprint.floorSlabs.some(
    (s) =>
      Math.abs(s.y - y) < 0.25 &&
      x >= s.minX + 0.55 &&
      x <= s.maxX - 0.55 &&
      z >= s.minZ + 0.55 &&
      z <= s.maxZ - 0.55,
  );
  if (!onSlab) return false;

  // Keep building entry spawn zone wide open
  if (
    Math.abs(y - blueprint.spawn.y) < 0.45 &&
    Math.hypot(x - blueprint.spawn.x, z - blueprint.spawn.z) < 2.25
  ) {
    return false;
  }

  // Keep every exit door, interior partition door, and rooftop door threshold clear
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (Math.abs(d.y - y) > 0.75) continue;
    const midX = d.hingeX + Math.cos(d.closedYaw) * d.width * 0.5;
    const midZ = d.hingeZ - Math.sin(d.closedYaw) * d.width * 0.5;
    if (Math.hypot(x - midX, z - midZ) < 2.15) {
      return false;
    }
  }

  // Keep elevator shafts & call pads unobstructed
  for (let i = 0; i < blueprint.elevators.length; i++) {
    const el = blueprint.elevators[i];
    if (Math.hypot(x - el.x, z - el.z) < 2.35) {
      return false;
    }
    const callZ = el.z + el.depth * 0.5 + 1.0;
    if (Math.hypot(x - el.x, z - callZ) < 2.05) {
      return false;
    }
  }

  // Keep staircases & mid-landings 100% clear
  for (let i = 0; i < blueprint.staircases.length; i++) {
    const st = blueprint.staircases[i];
    if (y >= st.yStart - 0.65 && y <= st.yEnd + 0.65) {
      const pad = 1.45;
      if (
        x >= st.minX - pad &&
        x <= st.maxX + pad &&
        z >= st.minZ - pad &&
        z <= st.maxZ + pad
      ) {
        return false;
      }
      if (st.midLanding) {
        const ml = st.midLanding;
        if (
          x >= ml.minX - pad &&
          x <= ml.maxX + pad &&
          z >= ml.minZ - pad &&
          z <= ml.maxZ + pad
        ) {
          return false;
        }
      }
    }
  }

  // Keep educational quiz kiosks, collectibles, and reward kiosks unobstructed
  for (let i = 0; i < kiosks.length; i++) {
    const k = kiosks[i];
    if (Math.abs(k.y - y) > 0.75) continue;
    if (Math.hypot(x - k.x, z - k.z) < 1.85) {
      return false;
    }
  }
  for (let i = 0; i < blueprint.furniture.length; i++) {
    const f = blueprint.furniture[i];
    if (f.kind !== 'reward_kiosk') continue;
    if (Math.abs(f.y - y) > 0.75) continue;
    if (Math.hypot(x - f.x, z - f.z) < 1.95) {
      return false;
    }
  }

  // Check walls (always) and furniture (unless anchored onto a seat)
  if (!options?.ignoreFurnitureCollision) {
    const col = resolveInteriorCollision(x, z, radius, y, 1.75, blueprint, doors, null);
    if (col.collided) return false;
  } else {
    for (let i = 0; i < blueprint.walls.length; i++) {
      const w = blueprint.walls[i];
      if (w.maxY <= y + 0.15 || w.minY >= y + 1.85) continue;
      const cx = Math.max(w.minX, Math.min(x, w.maxX));
      const cz = Math.max(w.minZ, Math.min(z, w.maxZ));
      if (Math.hypot(x - cx, z - cz) < 0.32) {
        return false;
      }
    }
  }

  return true;
}

function isSegmentClearForInteriorNpc(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  y: number,
  blueprint: InteriorBlueprint,
  doors: InteriorDoorState[],
  kiosks: QuizKioskPlacement[],
): boolean {
  const steps = 3;
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const mx = ax + (bx - ax) * t;
    const mz = az + (bz - az) * t;
    if (!isInteriorSpotClearForNpc(mx, y, mz, blueprint, doors, kiosks, { radius: NPC_RADIUS + 0.08 })) {
      return false;
    }
  }
  return true;
}

export function createInteriorNpcs(
  blueprint: InteriorBlueprint,
  doors: InteriorDoorState[],
  kiosks: QuizKioskPlacement[] = [],
): NpcState[] {
  const npcs: NpcState[] = [];
  const seedBase = hashString(blueprint.buildingId);
  const maxTotalNpcs = 14;
  let variantCursor = seedBase % 6;

  const isFarFromExistingOnFloor = (x: number, y: number, z: number, minDist = 1.65): boolean => {
    for (let i = 0; i < npcs.length; i++) {
      const other = npcs[i];
      if (Math.abs(other.y - y) > 0.6) continue;
      if (Math.hypot(other.x - x, other.z - z) < minDist) return false;
    }
    return true;
  };

  const floorNumbers = [...new Set(blueprint.floorSlabs.map((s) => s.floorNumber))].sort((a, b) => a - b);

  for (const floorNum of floorNumbers) {
    if (npcs.length >= maxTotalNpcs) break;
    const slab = blueprint.floorSlabs.find((s) => s.floorNumber === floorNum);
    if (!slab) continue;

    const floorFurniture = blueprint.furniture.filter((f) => Math.abs(f.y - slab.y) < 0.45);
    const isGroundOrRoof = floorNum === 1 || Boolean(slab.hasOpenSky);
    const floorCap = isGroundOrRoof ? 4 : 2;
    let addedOnFloor = 0;

    // 1. Seated NPC on sofa or dining/conference chair (looks natural, completely out of walkways)
    for (const f of floorFurniture) {
      if (addedOnFloor >= floorCap || npcs.length >= maxTotalNpcs) break;
      if (f.kind !== 'sofa' && f.kind !== 'dining_table' && f.kind !== 'conference_table') continue;

      let sx = f.x;
      let sz = f.z;
      let syaw = f.rotY + Math.PI;
      if (f.kind === 'sofa') {
        sx = f.x + Math.sin(f.rotY) * (f.depth * 0.14);
        sz = f.z + Math.cos(f.rotY) * (f.depth * 0.14);
        syaw = f.rotY + Math.PI;
      } else {
        const chairOffset = f.depth * 0.55;
        const sideSign = addedOnFloor % 2 === 0 ? -1 : 1;
        sx = f.x + Math.sin(f.rotY) * (chairOffset * sideSign);
        sz = f.z + Math.cos(f.rotY) * (chairOffset * sideSign);
        syaw = sideSign < 0 ? f.rotY + Math.PI : f.rotY;
      }

      if (
        isInteriorSpotClearForNpc(sx, slab.y, sz, blueprint, doors, kiosks, {
          ignoreFurnitureCollision: true,
        }) &&
        isFarFromExistingOnFloor(sx, slab.y, sz, 1.8)
      ) {
        const idx = npcs.length;
        npcs.push({
          id: `int_npc_${blueprint.buildingId}_f${floorNum}_${idx}`,
          variant: variantCursor++ % 6,
          x: sx,
          y: slab.y,
          z: sz,
          yaw: syaw,
          speed: 0,
          gaitPhase: idx * 0.9,
          loopIndex: idx,
          waypointIndex: 0,
          pauseTimer: 999,
          walkDistanceSincePause: 0,
          nextPauseDistance: 99,
          isPaused: true,
          activity: 'sitting',
          buildingId: blueprint.buildingId,
          floorNumber: floorNum,
          homeX: sx,
          homeZ: sz,
          homeYaw: syaw,
          seatY: 0.50,
        });
        addedOnFloor++;
        break; // max 1 seated per floor pass here so we leave room for staff & walkers
      }
    }

    // 2. Stationed Staff / Worker / Shop Browser near service desks or display racks
    for (const f of floorFurniture) {
      if (addedOnFloor >= floorCap || npcs.length >= maxTotalNpcs) break;
      const isCounter =
        f.kind === 'reception_desk' ||
        f.kind === 'checkout_counter' ||
        f.kind === 'espresso_bar' ||
        f.kind === 'boarding_desk' ||
        f.kind === 'desk' ||
        f.kind === 'workbench' ||
        f.kind === 'kitchen_counter';
      const isBrowse =
        f.kind === 'clothing_rack' ||
        f.kind === 'display_case' ||
        f.kind === 'shelf_rack';
      if (!isCounter && !isBrowse) continue;

      const rot90 = Math.abs(Math.sin(f.rotY)) > 0.7;
      const halfSpan = (rot90 ? f.width : f.depth) * 0.5;
      const standDist = halfSpan + 0.92;
      // Try behind or in front of prop along local Z axis
      const dirSign = isCounter ? -1 : 1;
      const candDirs: Array<[number, number, number]> = [
        [Math.sin(f.rotY) * standDist * dirSign, Math.cos(f.rotY) * standDist * dirSign, isCounter ? f.rotY + Math.PI : f.rotY],
        [-Math.sin(f.rotY) * standDist * dirSign, -Math.cos(f.rotY) * standDist * dirSign, isCounter ? f.rotY : f.rotY + Math.PI],
        [Math.cos(f.rotY) * standDist, -Math.sin(f.rotY) * standDist, f.rotY + Math.PI * 0.5],
      ];

      let placed = false;
      for (const [ox, oz, yaw] of candDirs) {
        const px = f.x + ox;
        const pz = f.z + oz;
        if (
          isInteriorSpotClearForNpc(px, slab.y, pz, blueprint, doors, kiosks) &&
          isFarFromExistingOnFloor(px, slab.y, pz, 1.75)
        ) {
          const idx = npcs.length;
          npcs.push({
            id: `int_npc_${blueprint.buildingId}_f${floorNum}_${idx}`,
            variant: variantCursor++ % 6,
            x: px,
            y: slab.y,
            z: pz,
            yaw,
            speed: 0,
            gaitPhase: idx * 1.1,
            loopIndex: idx,
            waypointIndex: 0,
            pauseTimer: 999,
            walkDistanceSincePause: 0,
            nextPauseDistance: 99,
            isPaused: true,
            activity: isCounter ? 'working' : 'browse',
            buildingId: blueprint.buildingId,
            floorNumber: floorNum,
            homeX: px,
            homeZ: pz,
            homeYaw: yaw,
          });
          addedOnFloor++;
          placed = true;
          break;
        }
      }
      if (placed && addedOnFloor >= 2) break;
    }

    // 3. Walking / Strolling Patrollers along guaranteed obstacle-free floor loop points
    const clearNodes: Array<{ x: number; z: number }> = [];
    const spanX = slab.maxX - slab.minX;
    const spanZ = slab.maxZ - slab.minZ;
    const stepGrid = Math.max(1.85, Math.min(2.8, Math.min(spanX, spanZ) * 0.24));

    for (let gx = slab.minX + 1.4; gx <= slab.maxX - 1.4; gx += stepGrid) {
      for (let gz = slab.minZ + 1.4; gz <= slab.maxZ - 1.4; gz += stepGrid) {
        if (
          isInteriorSpotClearForNpc(gx, slab.y, gz, blueprint, doors, kiosks, {
            radius: NPC_RADIUS + 0.22,
          })
        ) {
          clearNodes.push({ x: gx, z: gz });
        }
      }
    }

    // Pick up to 4 well-spaced patrol waypoints with clear walking segments
    const patrolPoints: Array<{ x: number; z: number }> = [];
    for (const node of clearNodes) {
      if (patrolPoints.length === 0) {
        patrolPoints.push(node);
        continue;
      }
      const prev = patrolPoints[patrolPoints.length - 1];
      const distPrev = Math.hypot(node.x - prev.x, node.z - prev.z);
      const farEnoughFromAll = patrolPoints.every((p) => Math.hypot(node.x - p.x, node.z - p.z) >= 2.2);
      if (
        distPrev >= 2.2 &&
        distPrev <= 10.5 &&
        farEnoughFromAll &&
        isSegmentClearForInteriorNpc(prev.x, prev.z, node.x, node.z, slab.y, blueprint, doors, kiosks)
      ) {
        patrolPoints.push(node);
        if (patrolPoints.length >= 4) break;
      }
    }

    const walkersToAdd = Math.min(
      floorCap - addedOnFloor,
      patrolPoints.length >= 2 ? (isGroundOrRoof ? 2 : 1) : 0,
    );

    for (let w = 0; w < walkersToAdd && npcs.length < maxTotalNpcs; w++) {
      const startWp = (w * 2) % patrolPoints.length;
      const nextWp = (startWp + 1) % patrolPoints.length;
      const p0 = patrolPoints[startWp];
      const p1 = patrolPoints[nextWp];
      if (!isFarFromExistingOnFloor(p0.x, slab.y, p0.z, 1.4)) continue;

      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const idx = npcs.length;

      npcs.push({
        id: `int_npc_${blueprint.buildingId}_f${floorNum}_${idx}`,
        variant: variantCursor++ % 6,
        x: p0.x,
        y: slab.y,
        z: p0.z,
        yaw: Math.atan2(-dx, -dz),
        speed: 0.92 + ((idx + w) % 3) * 0.14,
        gaitPhase: idx * 1.3,
        loopIndex: idx,
        waypointIndex: nextWp,
        pauseTimer: w === 1 ? 1.4 : 0,
        walkDistanceSincePause: 0,
        nextPauseDistance: 5.5 + (idx % 4) * 1.4,
        isPaused: w === 1,
        activity: w === 1 ? 'browse' : 'stroll',
        buildingId: blueprint.buildingId,
        floorNumber: floorNum,
        patrolPoints,
      });
      addedOnFloor++;
    }
  }

  return npcs;
}

export function stepInteriorNpcs(
  npcs: NpcState[],
  rawDt: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  blueprint: InteriorBlueprint,
  doors: InteriorDoorState[],
  kiosks: QuizKioskPlacement[] = [],
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);

  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    const pdx = playerX - npc.x;
    const pdz = playerZ - npc.z;
    const sameFloor = Math.abs(playerY - npc.y) <= 1.5;
    const pDist = sameFloor ? Math.hypot(pdx, pdz) : 99;

    // Stationary seated / working / stationed browsing NPCs
    if (!npc.patrolPoints || npc.patrolPoints.length < 2) {
      npc.isPaused = true;
      if (npc.activity === 'sitting') {
        continue;
      }
      // Stationed working/browsing NPCs politely turn slightly toward passing player without leaving post
      if (pDist < 2.2 && npc.homeYaw !== undefined) {
        const lookYaw = Math.atan2(-pdx, -pdz);
        npc.yaw += shortestAngleDelta(npc.yaw, lookYaw) * (1 - Math.exp(-3.5 * dt));
      } else if (npc.homeYaw !== undefined) {
        npc.yaw += shortestAngleDelta(npc.yaw, npc.homeYaw) * (1 - Math.exp(-3.0 * dt));
      }
      if (npc.homeX !== undefined && npc.homeZ !== undefined) {
        npc.x = dampValue(npc.x, npc.homeX, 4, dt);
        npc.z = dampValue(npc.z, npc.homeZ, 4, dt);
      }
      continue;
    }

    if (npc.pauseTimer > 0) {
      if (pDist < 1.35) {
        npc.pauseTimer = 0;
        npc.isPaused = false;
      } else {
        npc.pauseTimer = Math.max(0, npc.pauseTimer - dt);
        npc.isPaused = npc.pauseTimer > 0;
        if (!npc.isPaused) {
          npc.activity = i % 2 === 0 ? 'stroll' : 'walk';
        }
        continue;
      }
    }

    npc.isPaused = false;
    npc.activity = i % 2 === 0 ? 'stroll' : 'walk';

    const target = npc.patrolPoints[npc.waypointIndex];
    const dx = target.x - npc.x;
    const dz = target.z - npc.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.42) {
      npc.waypointIndex = (npc.waypointIndex + 1) % npc.patrolPoints.length;
      if (
        pDist > 2.2 &&
        isInteriorSpotClearForNpc(npc.x, npc.y, npc.z, blueprint, doors, kiosks)
      ) {
        npc.pauseTimer = 1.6 + (i % 3) * 0.65;
        npc.walkDistanceSincePause = 0;
        npc.isPaused = true;
        npc.activity = i % 3 === 0 ? 'browse' : i % 3 === 1 ? 'chatting' : 'idle_look';
      }
      continue;
    }

    let dirX = dx / dist;
    let dirZ = dz / dist;

    // Steer politely out of the player's corridor path indoors
    if (pDist < 2.15 && pDist > 1e-4) {
      const toPlayerX = pdx / pDist;
      const toPlayerZ = pdz / pDist;
      const aheadDot = dirX * toPlayerX + dirZ * toPlayerZ;
      if (aheadDot > -0.2) {
        const cross = dirX * toPlayerZ - dirZ * toPlayerX;
        const sideSign = cross >= 0 ? -1 : 1;
        const perpX = -dirZ * sideSign;
        const perpZ = dirX * sideSign;
        const avoidWeight = pDist < 1.05 ? 1.4 : (2.15 - pDist) * 0.78;
        dirX = dirX * 0.6 + perpX * avoidWeight;
        dirZ = dirZ * 0.6 + perpZ * avoidWeight;
        const nLen = Math.hypot(dirX, dirZ) || 1;
        dirX /= nLen;
        dirZ /= nLen;
      }
    }

    const targetYaw = Math.atan2(-dirX, -dirZ);
    npc.yaw += shortestAngleDelta(npc.yaw, targetYaw) * (1 - Math.exp(-8 * dt));

    const speed = pDist < 1.1 ? npc.speed * 1.15 : npc.speed;
    const step = Math.min(dist + 0.25, speed * dt);
    const nextX = npc.x + dirX * step;
    const nextZ = npc.z + dirZ * step;

    const resolved = resolveInteriorCollision(nextX, nextZ, NPC_RADIUS, npc.y, 1.75, blueprint, doors, null);
    const moved = Math.hypot(resolved.x - npc.x, resolved.z - npc.z);

    // If blocked on a leg, advance to next patrol point cleanly instead of walking in place
    if (resolved.collided && moved < 0.004) {
      npc.waypointIndex = (npc.waypointIndex + 1) % npc.patrolPoints.length;
    }

    npc.x = resolved.x;
    npc.z = resolved.z;
    npc.gaitPhase += moved * 2.3;
    npc.walkDistanceSincePause += moved;

    if (
      npc.walkDistanceSincePause >= npc.nextPauseDistance &&
      pDist > 2.2 &&
      isInteriorSpotClearForNpc(npc.x, npc.y, npc.z, blueprint, doors, kiosks)
    ) {
      npc.pauseTimer = 1.6 + (i % 3) * 0.55;
      npc.walkDistanceSincePause = 0;
      npc.isPaused = true;
      npc.activity = i % 2 === 0 ? 'browse' : 'idle_look';
    }
  }

  applyNpcSeparation(npcs, 0.8);
}
