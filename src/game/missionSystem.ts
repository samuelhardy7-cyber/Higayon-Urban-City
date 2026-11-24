import type {
  ActiveMissionState,
  MissionBannerState,
  MissionDefinition,
  VehicleState,
} from './types';

export const MISSION_INTERACT_RANGE = 4.2;
export const CHECKPOINT_TRIGGER_RADIUS = 4.6;

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  {
    id: 'delivery_port',
    type: 'delivery',
    title: 'Harbor Express Delivery',
    description: 'Deliver urgent cargo from Downtown Mall to the Industrial Harbor Port.',
    startX: 10.5,
    startZ: -4.2,
    startLabel: 'Grand Mall Curb',
    reward: 500,
    timeLimit: 75,
    wantedOnStart: 0,
    color: 0x10b981,
    badgeColor: '#10b981',
    checkpoints: [
      { x: 80.5, z: -38.5, label: 'Harbor Port Cargo Dock' },
    ],
  },
  {
    id: 'race_coastal',
    type: 'race',
    title: 'Coastal Circuit Sprint',
    description: 'Drive through all 5 coastal and avenue checkpoints before time expires.',
    startX: -4.2,
    startZ: 22.0,
    startLabel: 'Central Avenue',
    reward: 800,
    timeLimit: 90,
    wantedOnStart: 0,
    color: 0xf59e0b,
    badgeColor: '#f59e0b',
    checkpoints: [
      { x: 42.0, z: 0.0, label: 'East Avenue Gate (1/5)' },
      { x: 84.0, z: 0.0, label: 'Coastal Bistro Turn (2/5)' },
      { x: 84.0, z: 42.0, label: 'Pier Promenade Gate (3/5)' },
      { x: 42.0, z: 84.0, label: 'South Resort Turn (4/5)' },
      { x: 0.0, z: 42.0, label: 'Central Plaza Finish (5/5)' },
    ],
  },
  {
    id: 'escape_challenge',
    type: 'escape',
    title: 'Heat Escape Run',
    description: 'Evade police pursuit and reach the Residential Safe House.',
    startX: -12.0,
    startZ: -4.2,
    startLabel: 'CITY TOWER Curb',
    reward: 1000,
    timeLimit: 85,
    wantedOnStart: 2,
    color: 0xef4444,
    badgeColor: '#ef4444',
    checkpoints: [
      { x: -80.0, z: 84.0, label: 'West Bay Safe House' },
    ],
  },
];

export interface MissionRuntimeState {
  money: number;
  wantedLevel: number;
  wantedHeat: number; // 0..3 continuous heat, level = Math.ceil(heat) clamped 0..3
  wantedEscapeTimer: number;
  activeMission: ActiveMissionState | null;
  missionBanner: MissionBannerState | null;
  completedIds: string[];
}

export function createInitialMissionRuntime(): MissionRuntimeState {
  return {
    money: 0,
    wantedLevel: 0,
    wantedHeat: 0,
    wantedEscapeTimer: 0,
    activeMission: null,
    missionBanner: null,
    completedIds: [],
  };
}

export function getMissionDefinition(id: string): MissionDefinition | undefined {
  return MISSION_DEFINITIONS.find((m) => m.id === id);
}

export function findNearestMissionStart(
  px: number,
  pz: number,
  runtime: MissionRuntimeState,
  maxRange = MISSION_INTERACT_RANGE,
): MissionDefinition | null {
  if (runtime.activeMission) return null;
  let best: MissionDefinition | null = null;
  let bestDistSq = maxRange * maxRange;

  for (let i = 0; i < MISSION_DEFINITIONS.length; i++) {
    const m = MISSION_DEFINITIONS[i];
    const dx = m.startX - px;
    const dz = m.startZ - pz;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = m;
    }
  }
  return best;
}

export function startMission(
  runtime: MissionRuntimeState,
  missionId: string,
): ActiveMissionState | null {
  const def = getMissionDefinition(missionId);
  if (!def) return null;

  runtime.activeMission = {
    missionId: def.id,
    type: def.type,
    title: def.title,
    checkpointIndex: 0,
    totalCheckpoints: def.checkpoints.length,
    timeRemaining: def.timeLimit,
    reward: def.reward,
  };
  runtime.missionBanner = null;

  if (def.wantedOnStart > 0) {
    setWantedLevel(runtime, Math.max(runtime.wantedLevel, def.wantedOnStart));
  }

  return runtime.activeMission;
}

export function setWantedLevel(runtime: MissionRuntimeState, level: number): void {
  const clamped = Math.max(0, Math.min(3, Math.round(level)));
  runtime.wantedLevel = clamped;
  runtime.wantedHeat = clamped;
  runtime.wantedEscapeTimer = clamped > 0 ? 16 : 0;
}

export function addWantedHeat(runtime: MissionRuntimeState, delta: number): boolean {
  const prev = runtime.wantedLevel;
  runtime.wantedHeat = Math.max(0, Math.min(3, runtime.wantedHeat + delta));
  runtime.wantedLevel = runtime.wantedHeat > 0.05 ? Math.min(3, Math.ceil(runtime.wantedHeat)) : 0;
  if (runtime.wantedLevel > 0) {
    runtime.wantedEscapeTimer = 16;
  }
  return runtime.wantedLevel > prev;
}

export function stepMissionAndWanted(
  runtime: MissionRuntimeState,
  playerX: number,
  playerZ: number,
  vehicles: VehicleState[],
  rawDt: number,
): {
  checkpointReached: boolean;
  missionCompleted: boolean;
  missionFailed: boolean;
} {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  let checkpointReached = false;
  let missionCompleted = false;
  let missionFailed = false;

  if (runtime.missionBanner) {
    runtime.missionBanner.timer -= dt;
    if (runtime.missionBanner.timer <= 0) {
      runtime.missionBanner = null;
    }
  }

  // Wanted cooldown when player stays > 44m away from all active police cruisers
  if (runtime.wantedLevel > 0) {
    let minPoliceDist = Infinity;
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (!v.isPolice) continue;
      const d = Math.hypot(v.x - playerX, v.z - playerZ);
      if (d < minPoliceDist) minPoliceDist = d;
    }

    const isEscapeMission = runtime.activeMission?.type === 'escape';
    if (!isEscapeMission && minPoliceDist > 44) {
      runtime.wantedEscapeTimer -= dt;
      if (runtime.wantedEscapeTimer <= 0) {
        setWantedLevel(runtime, runtime.wantedLevel - 1);
      }
    } else if (minPoliceDist <= 34) {
      runtime.wantedEscapeTimer = 16;
    }
  }

  // Active mission timer & checkpoint triggers
  const active = runtime.activeMission;
  if (active) {
    const def = getMissionDefinition(active.missionId);
    if (!def) {
      runtime.activeMission = null;
      return { checkpointReached, missionCompleted, missionFailed };
    }

    active.timeRemaining -= dt;
    if (active.timeRemaining <= 0) {
      runtime.activeMission = null;
      runtime.missionBanner = {
        status: 'failed',
        title: def.title,
        reward: 0,
        message: 'Time expired before reaching objective.',
        timer: 4.5,
      };
      if (def.type === 'escape') {
        setWantedLevel(runtime, 0);
      }
      missionFailed = true;
      return { checkpointReached, missionCompleted, missionFailed };
    }

    const target = def.checkpoints[active.checkpointIndex];
    const dist = Math.hypot(target.x - playerX, target.z - playerZ);
    if (dist <= CHECKPOINT_TRIGGER_RADIUS) {
      if (active.checkpointIndex + 1 < def.checkpoints.length) {
        active.checkpointIndex++;
        checkpointReached = true;
      } else {
        // Mission Completed!
        runtime.money += def.reward;
        if (!runtime.completedIds.includes(def.id)) {
          runtime.completedIds.push(def.id);
        }
        runtime.activeMission = null;
        runtime.missionBanner = {
          status: 'completed',
          title: def.title,
          reward: def.reward,
          message: `Reward earned: +$${def.reward}`,
          timer: 4.8,
        };
        if (def.type === 'escape') {
          setWantedLevel(runtime, 0);
        }
        missionCompleted = true;
      }
    }
  }

  return { checkpointReached, missionCompleted, missionFailed };
}
