import type { CharacterAnimState, EmoteKind } from './characterAnimator';
import type { RemotePlayerState } from './multiplayerTypes';
import { dampValue, shortestAngleDelta } from './playerPhysics';

export interface InterpolatedRemoteAvatar {
  playerId: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  grounded: boolean;
  onStairs: boolean;
  onSeat: boolean;
  climbingLadder: boolean;
  turnDeltaYaw: number;
  photoPose: string | null;
  animState: CharacterAnimState;
  lastEmoteSeq: number;
  activeEmote: EmoteKind | null;
  target: RemotePlayerState;
  gaitPhase: number;
  lastServerAt: number;
}

export function createInterpolatedAvatar(remote: RemotePlayerState): InterpolatedRemoteAvatar {
  return {
    playerId: remote.playerId,
    displayName: remote.displayName,
    x: remote.position.x,
    y: remote.position.y,
    z: remote.position.z,
    yaw: remote.rotation.yaw,
    speed: remote.speed ?? (remote.movementState === 'running' ? 8.5 : remote.movementState === 'walking' ? 4.8 : 0),
    grounded: remote.grounded ?? remote.movementState !== 'jumping',
    onStairs: remote.onStairs ?? false,
    onSeat: remote.onSeat ?? false,
    climbingLadder: remote.climbingLadder ?? false,
    turnDeltaYaw: remote.turnDeltaYaw ?? 0,
    photoPose: remote.photoPose ?? null,
    animState: remote.animState ?? 'idle',
    lastEmoteSeq: remote.emoteSeq ?? 0,
    activeEmote: remote.emoteKind ?? null,
    target: remote,
    gaitPhase: 0,
    lastServerAt: remote.updatedAt,
  };
}

export function stepInterpolatedAvatar(
  avatar: InterpolatedRemoteAvatar,
  dt: number,
): void {
  const safeDt = Math.max(0.001, Math.min(0.1, dt));
  const dx = avatar.target.position.x - avatar.x;
  const dy = avatar.target.position.y - avatar.y;
  const dz = avatar.target.position.z - avatar.z;
  const distSq = dx * dx + dy * dy + dz * dz;

  // Snap cleanly on large teleports (entering/exiting buildings or respawn)
  if (distSq > 144) {
    avatar.x = avatar.target.position.x;
    avatar.y = avatar.target.position.y;
    avatar.z = avatar.target.position.z;
    avatar.yaw = avatar.target.rotation.yaw;
  } else {
    const lambda = 12;
    avatar.x = dampValue(avatar.x, avatar.target.position.x, lambda, safeDt);
    avatar.y = dampValue(avatar.y, avatar.target.position.y, lambda, safeDt);
    avatar.z = dampValue(avatar.z, avatar.target.position.z, lambda, safeDt);

    const yawDelta = shortestAngleDelta(avatar.yaw, avatar.target.rotation.yaw);
    const yawAlpha = 1 - Math.exp(-14 * safeDt);
    avatar.yaw += yawDelta * yawAlpha;
  }

  const targetSpeed =
    typeof avatar.target.speed === 'number'
      ? avatar.target.speed
      : avatar.target.movementState === 'running'
        ? 8.5
        : avatar.target.movementState === 'walking'
          ? 4.8
          : 0;
  avatar.speed = dampValue(avatar.speed, targetSpeed, 14, safeDt);
  avatar.grounded = avatar.target.grounded ?? avatar.target.movementState !== 'jumping';
  avatar.onStairs = avatar.target.onStairs ?? false;
  avatar.onSeat = avatar.target.onSeat ?? false;
  avatar.climbingLadder = avatar.target.climbingLadder ?? false;
  avatar.turnDeltaYaw = avatar.target.turnDeltaYaw ?? 0;
  avatar.photoPose = avatar.target.photoPose ?? null;
  if (avatar.target.animState) {
    avatar.animState = avatar.target.animState;
  }

  const speedMultiplier =
    avatar.target.movementState === 'running'
      ? 12
      : avatar.target.movementState === 'walking'
        ? 7.8
        : avatar.speed > 0.4
          ? avatar.speed * 1.65
          : 0;
  if (speedMultiplier > 0) {
    avatar.gaitPhase += safeDt * speedMultiplier;
  }
}

export function shouldRenderRemoteAvatar(
  remote: RemotePlayerState,
  localBuildingId: string | null,
  localFloor: number,
  options?: { inSharedElevator?: boolean },
): boolean {
  if (remote.connectionStatus === 'offline') return false;
  if (remote.movementState === 'driving' && !remote.vehicleKind) return false;
  if (localBuildingId === null) {
    return remote.currentBuilding === null;
  }
  if (remote.currentBuilding !== localBuildingId) {
    return false;
  }
  if (options?.inSharedElevator) {
    return true;
  }
  return Math.abs(remote.currentFloor - localFloor) <= 0;
}
