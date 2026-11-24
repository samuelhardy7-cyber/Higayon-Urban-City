import { dampValue, shortestAngleDelta } from './playerPhysics';
import type { CityLayout, NpcState } from './types';
import { CITY_LAYOUT, getGroundHeightAt, resolveCircleAABBCollision } from './worldData';

export const NPC_RADIUS = 0.36;

export function createInitialNpcs(layout: CityLayout = CITY_LAYOUT): NpcState[] {
  const npcs: NpcState[] = [];
  const loops = layout.npcLoops;
  if (loops.length === 0) return npcs;

  // Spawn 2 NPCs per sidewalk loop (16 NPCs across all 4 districts)
  for (let li = 0; li < loops.length; li++) {
    const loop = loops[li];
    for (let slot = 0; slot < 2; slot++) {
      const wpIdx = (slot * 2) % loop.points.length;
      const nextIdx = (wpIdx + 1) % loop.points.length;
      const p0 = loop.points[wpIdx];
      const p1 = loop.points[nextIdx];
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const yaw = Math.atan2(-dx, -dz);
      const id = `npc_${li}_${slot}`;
      const speed = 1.25 + ((li * 3 + slot * 5) % 4) * 0.12;
      const nextPause = 8 + ((li * 7 + slot * 3) % 9);

      npcs.push({
        id,
        variant: (li * 2 + slot) % 6,
        x: p0.x,
        y: getGroundHeightAt(p0.x, p0.z, layout),
        z: p0.z,
        yaw,
        speed,
        gaitPhase: slot * 1.7,
        loopIndex: li,
        waypointIndex: nextIdx,
        pauseTimer: slot === 1 ? 1.2 : 0,
        walkDistanceSincePause: 0,
        nextPauseDistance: nextPause,
        isPaused: slot === 1,
      });
    }
  }
  return npcs;
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

    if (npc.pauseTimer > 0) {
      npc.pauseTimer = Math.max(0, npc.pauseTimer - dt);
      npc.isPaused = npc.pauseTimer > 0;
      continue;
    }

    // Brief yield if player is standing right in front of NPC
    const pdx = playerX - npc.x;
    const pdz = playerZ - npc.z;
    const pDistSq = pdx * pdx + pdz * pdz;
    if (pDistSq < 1.15 * 1.15) {
      const fwdX = -Math.sin(npc.yaw);
      const fwdZ = -Math.cos(npc.yaw);
      if (pdx * fwdX + pdz * fwdZ > 0.2) {
        npc.isPaused = true;
        continue;
      }
    }

    npc.isPaused = false;
    const target = loop.points[npc.waypointIndex];
    const dx = target.x - npc.x;
    const dz = target.z - npc.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.45) {
      npc.waypointIndex = (npc.waypointIndex + 1) % loop.points.length;
      // Occasional natural pause at sidewalk corners
      if (npc.walkDistanceSincePause >= npc.nextPauseDistance) {
        npc.pauseTimer = 1.6 + ((i * 5) % 4) * 0.45;
        npc.walkDistanceSincePause = 0;
        npc.isPaused = true;
      }
      continue;
    }

    const dirX = dx / dist;
    const dirZ = dz / dist;
    const targetYaw = Math.atan2(-dirX, -dirZ);
    npc.yaw += shortestAngleDelta(npc.yaw, targetYaw) * (1 - Math.exp(-8 * dt));

    const step = Math.min(dist, npc.speed * dt);
    const nextX = npc.x + dirX * step;
    const nextZ = npc.z + dirZ * step;

    const resolved = resolveCircleAABBCollision(nextX, nextZ, NPC_RADIUS, npc.y, 1.75, layout);
    const moved = Math.hypot(resolved.x - npc.x, resolved.z - npc.z);
    npc.x = resolved.x;
    npc.z = resolved.z;
    npc.y = dampValue(npc.y, getGroundHeightAt(npc.x, npc.z, layout), 18, dt);

    npc.gaitPhase += moved * 2.25;
    npc.walkDistanceSincePause += moved;

    if (npc.walkDistanceSincePause >= npc.nextPauseDistance) {
      npc.pauseTimer = 1.8 + ((i * 3) % 4) * 0.5;
      npc.walkDistanceSincePause = 0;
      npc.isPaused = true;
    }
  }
}
