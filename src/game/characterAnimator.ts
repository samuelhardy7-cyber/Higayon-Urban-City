import type { PhotoPoseId } from './types';

export type CharacterAnimState =
  | 'idle'
  | 'idle_shift'
  | 'idle_look'
  | 'walk'
  | 'fast_walk'
  | 'jog'
  | 'sprint'
  | 'walk_backward'
  | 'turn_left'
  | 'turn_right'
  | 'jump'
  | 'fall'
  | 'land'
  | 'climb_stairs'
  | 'descend_stairs'
  | 'climb_ladder'
  | 'parkour_vault'
  | 'enter_elevator'
  | 'exit_elevator'
  | 'open_door'
  | 'close_door'
  | 'pickup'
  | 'examine_book'
  | 'use_tablet'
  | 'press_button'
  | 'sit'
  | 'stand'
  | 'celebrate'
  | 'disappoint'
  | 'wave'
  | 'greet'
  | 'clap'
  | 'dance'
  | 'point'
  | 'victory'
  | 'laugh'
  | 'handshake'
  | 'high_five'
  | 'kp_excited'
  | 'show_accessory'
  | 'rare_outfit_celebrate'
  | 'approach_vehicle'
  | 'enter_vehicle'
  | 'drive'
  | 'exit_vehicle'
  | 'photo_cool'
  | 'photo_hero'
  | 'photo_peace'
  | 'photo_victory'
  | 'photo_scholar'
  | 'photo_parkour';

export type EmoteKind =
  | 'wave'
  | 'greet'
  | 'clap'
  | 'dance'
  | 'point'
  | 'celebrate'
  | 'victory'
  | 'laugh'
  | 'handshake'
  | 'high_five'
  | 'show_accessory'
  | 'sit';

export interface EmoteWheelOption {
  kind: EmoteKind;
  label: string;
  animState: CharacterAnimState;
  durationSec: number;
  looped: boolean;
  socialTargeted?: boolean;
}

export const EMOTE_WHEEL_OPTIONS: EmoteWheelOption[] = [
  { kind: 'wave', label: 'Wave', animState: 'wave', durationSec: 2.2, looped: false },
  { kind: 'dance', label: 'Dance', animState: 'dance', durationSec: 4.5, looped: true },
  { kind: 'celebrate', label: 'Cheer', animState: 'celebrate', durationSec: 2.4, looped: false },
  { kind: 'clap', label: 'Clap', animState: 'clap', durationSec: 2.2, looped: false },
  { kind: 'laugh', label: 'Laugh', animState: 'laugh', durationSec: 2.0, looped: false },
  { kind: 'victory', label: 'Victory', animState: 'victory', durationSec: 2.6, looped: false },
  { kind: 'greet', label: 'Greet', animState: 'greet', durationSec: 2.0, looped: false },
  { kind: 'handshake', label: 'Handshake', animState: 'handshake', durationSec: 1.8, looped: false, socialTargeted: true },
  { kind: 'high_five', label: 'High-Five', animState: 'high_five', durationSec: 1.6, looped: false, socialTargeted: true },
  { kind: 'show_accessory', label: 'Show Gear', animState: 'show_accessory', durationSec: 2.2, looped: false },
];

export type FaceMood = 'neutral' | 'smile' | 'grin' | 'focused' | 'wink';

export interface ArticulatedPose {
  hipsY: number;
  hipsPitch: number;
  hipsRoll: number;
  torsoPitch: number;
  torsoYaw: number;
  torsoRoll: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  lShoulderX: number;
  lShoulderZ: number;
  lElbowX: number;
  rShoulderX: number;
  rShoulderZ: number;
  rElbowX: number;
  lHipX: number;
  lHipZ: number;
  lKneeX: number;
  lAnkleX: number;
  rHipX: number;
  rHipZ: number;
  rKneeX: number;
  rAnkleX: number;
  hairSwingX: number;
  hairSwingZ: number;
  coatSwingX: number;
  scarfSwingZ: number;
  blinkWeight: number;
  faceMood: FaceMood;
}

export interface CharacterAnimRuntime {
  currentState: CharacterAnimState;
  actionState: CharacterAnimState | null;
  actionTimer: number;
  actionDuration: number;
  actionLooped: boolean;
  landTimer: number;
  wasGrounded: boolean;
  idleTimer: number;
  gaitPhase: number;
  ladderPhase: number;
  blinkTimer: number;
  emoteKind: EmoteKind | null;
  emoteSeq: number;
  pose: ArticulatedPose;
}

export interface AnimResolveParams {
  speed: number;
  vy: number;
  grounded: boolean;
  isSprinting: boolean;
  isMoving: boolean;
  isDriving: boolean;
  isMotorcycle?: boolean;
  steerAngle?: number;
  leanAngle?: number;
  onStairs: boolean;
  stairDirection?: 'up' | 'down' | 'none';
  climbingLadder?: boolean;
  climbSpeed?: number;
  parkourActive?: boolean;
  photoPose?: PhotoPoseId | null;
  backward?: boolean;
  turnDeltaYaw?: number;
  inElevator?: boolean;
  sitting?: boolean;
  elapsedTime: number;
}

export function createNeutralPose(): ArticulatedPose {
  return {
    hipsY: 0,
    hipsPitch: 0,
    hipsRoll: 0,
    torsoPitch: 0,
    torsoYaw: 0,
    torsoRoll: 0,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    lShoulderX: 0,
    lShoulderZ: 0.08,
    lElbowX: -0.1,
    rShoulderX: 0,
    rShoulderZ: -0.08,
    rElbowX: -0.1,
    lHipX: 0,
    lHipZ: 0.03,
    lKneeX: 0.04,
    lAnkleX: 0,
    rHipX: 0,
    rHipZ: -0.03,
    rKneeX: 0.04,
    rAnkleX: 0,
    hairSwingX: 0.04,
    hairSwingZ: 0,
    coatSwingX: 0.02,
    scarfSwingZ: 0,
    blinkWeight: 0,
    faceMood: 'neutral',
  };
}

export function createCharacterAnimRuntime(): CharacterAnimRuntime {
  return {
    currentState: 'idle',
    actionState: null,
    actionTimer: 0,
    actionDuration: 0,
    actionLooped: false,
    landTimer: 0,
    wasGrounded: true,
    idleTimer: 0,
    gaitPhase: 0,
    ladderPhase: 0,
    blinkTimer: 0,
    emoteKind: null,
    emoteSeq: 0,
    pose: createNeutralPose(),
  };
}

export function triggerCharacterAction(
  rt: CharacterAnimRuntime,
  state: CharacterAnimState,
  durationSec = 1.4,
  looped = false,
  emoteKind: EmoteKind | null = null,
): void {
  rt.actionState = state;
  rt.actionTimer = 0;
  rt.actionDuration = Math.max(0.25, durationSec);
  rt.actionLooped = looped;
  rt.emoteKind = emoteKind;
  if (emoteKind) {
    rt.emoteSeq += 1;
  }
}

export function clearCharacterAction(rt: CharacterAnimRuntime): void {
  rt.actionState = null;
  rt.actionTimer = 0;
  rt.actionDuration = 0;
  rt.actionLooped = false;
  rt.emoteKind = null;
}

export function resolveCharacterAnimState(
  rt: CharacterAnimRuntime,
  params: AnimResolveParams,
): CharacterAnimState {
  if (params.photoPose) {
    return params.photoPose;
  }
  if (params.isDriving) {
    return 'drive';
  }
  if (params.climbingLadder) {
    return 'climb_ladder';
  }
  if (params.parkourActive) {
    return 'parkour_vault';
  }
  if (!params.grounded) {
    return params.vy > 0.65 ? 'jump' : 'fall';
  }
  if (rt.landTimer > 0) {
    return 'land';
  }
  if (params.sitting) {
    return 'sit';
  }
  if (params.onStairs && params.speed > 0.35) {
    if (params.stairDirection === 'up' || params.vy > 0.25) {
      return 'climb_stairs';
    }
    if (params.stairDirection === 'down' || params.vy < -0.25) {
      return 'descend_stairs';
    }
  }
  if (params.isMoving || params.speed > 0.35) {
    if (params.backward) {
      return 'walk_backward';
    }
    if (params.isSprinting || params.speed >= 7.6) {
      return 'sprint';
    }
    if (params.speed >= 5.9) {
      return 'jog';
    }
    if (params.speed >= 4.4) {
      return 'fast_walk';
    }
    return 'walk';
  }

  if (rt.actionState) {
    return rt.actionState;
  }

  if (Math.abs(params.turnDeltaYaw ?? 0) > 0.75) {
    return (params.turnDeltaYaw ?? 0) > 0 ? 'turn_left' : 'turn_right';
  }

  const cycle = params.elapsedTime % 11.5;
  if (cycle > 7.8) return 'idle_look';
  if (cycle > 3.6 && cycle < 6.4) return 'idle_shift';
  return 'idle';
}

function computeTargetPose(
  state: CharacterAnimState,
  gait: number,
  ladderPhase: number,
  elapsed: number,
  actionTimer: number,
  params: AnimResolveParams,
): ArticulatedPose {
  const p = createNeutralPose();
  const breath = Math.sin(elapsed * 2.1);

  switch (state) {
    case 'idle': {
      p.hipsY = breath * 0.014;
      p.torsoPitch = 0.015 + breath * 0.01;
      p.lShoulderZ = 0.09 + breath * 0.014;
      p.rShoulderZ = -0.09 - breath * 0.014;
      p.lElbowX = -0.15;
      p.rElbowX = -0.15;
      p.lKneeX = 0.05;
      p.rKneeX = 0.05;
      p.faceMood = 'smile';
      break;
    }
    case 'idle_shift': {
      const sway = Math.sin(elapsed * 1.15);
      p.hipsY = -0.01 + breath * 0.012;
      p.hipsRoll = sway * 0.045;
      p.torsoRoll = -sway * 0.035;
      p.headYaw = -sway * 0.08;
      p.headRoll = sway * 0.04;
      p.lHipX = sway > 0 ? -0.08 : 0.04;
      p.lKneeX = sway > 0 ? 0.16 : 0.03;
      p.rHipX = sway < 0 ? -0.08 : 0.04;
      p.rKneeX = sway < 0 ? 0.16 : 0.03;
      p.lShoulderZ = 0.11;
      p.rShoulderZ = -0.11;
      p.lElbowX = -0.22;
      p.rElbowX = -0.22;
      p.hairSwingZ = -sway * 0.06;
      p.faceMood = 'neutral';
      break;
    }
    case 'idle_look': {
      const look = Math.sin(elapsed * 1.5);
      p.hipsY = breath * 0.012;
      p.torsoYaw = look * 0.14;
      p.headYaw = look * 0.4;
      p.headPitch = Math.sin(elapsed * 0.9) * 0.08;
      p.headRoll = look * 0.05;
      p.lShoulderX = -0.06 * look;
      p.rShoulderX = 0.06 * look;
      p.lElbowX = -0.2;
      p.rElbowX = -0.2;
      p.hairSwingZ = -look * 0.08;
      p.faceMood = 'smile';
      break;
    }
    case 'walk':
    case 'fast_walk':
    case 'walk_backward': {
      const dir = state === 'walk_backward' ? -1 : 1;
      const amp = state === 'fast_walk' ? 0.68 : 0.54;
      const s = Math.sin(gait) * dir;
      const c = Math.cos(gait);
      const liftL = Math.max(0, Math.sin(gait + Math.PI * 0.45));
      const liftR = Math.max(0, Math.sin(gait + Math.PI * 1.45));
      const turnLean = Math.max(-0.18, Math.min(0.18, (params.turnDeltaYaw ?? 0) * 0.06));

      p.hipsY = Math.abs(c) * 0.035 - 0.012;
      p.hipsRoll = s * 0.045;
      p.torsoPitch = state === 'fast_walk' ? 0.09 : state === 'walk_backward' ? -0.04 : 0.05;
      p.torsoYaw = -s * 0.13;
      p.torsoRoll = turnLean;
      p.headYaw = s * 0.05 + turnLean * 1.3;
      p.headRoll = -turnLean * 0.4;

      p.lHipX = s * amp;
      p.rHipX = -s * amp;
      p.lKneeX = 0.08 + liftL * (state === 'fast_walk' ? 0.72 : 0.55);
      p.rKneeX = 0.08 + liftR * (state === 'fast_walk' ? 0.72 : 0.55);
      p.lAnkleX = -s * 0.16 - liftL * 0.12;
      p.rAnkleX = s * 0.16 - liftR * 0.12;

      p.lShoulderX = -s * amp * 0.74;
      p.rShoulderX = s * amp * 0.74;
      p.lElbowX = -0.26 - Math.max(0, -s) * 0.34;
      p.rElbowX = -0.26 - Math.max(0, s) * 0.34;
      p.hairSwingX = 0.14 + Math.abs(c) * 0.09;
      p.hairSwingZ = s * 0.08 - turnLean * 0.8;
      p.coatSwingX = 0.12 + Math.abs(s) * 0.08;
      p.scarfSwingZ = s * 0.11;
      p.faceMood = 'smile';
      break;
    }
    case 'jog':
    case 'sprint': {
      const isSprint = state === 'sprint';
      const amp = isSprint ? 1.0 : 0.8;
      const s = Math.sin(gait);
      const c = Math.cos(gait);
      const liftL = Math.max(0, Math.sin(gait + Math.PI * 0.5));
      const liftR = Math.max(0, Math.sin(gait + Math.PI * 1.5));
      const turnLean = Math.max(-0.24, Math.min(0.24, (params.turnDeltaYaw ?? 0) * 0.08));

      p.hipsY = Math.abs(c) * (isSprint ? 0.08 : 0.055) - 0.025;
      p.hipsPitch = isSprint ? 0.1 : 0.05;
      p.hipsRoll = s * 0.065;
      p.torsoPitch = isSprint ? 0.25 : 0.15;
      p.torsoYaw = -s * (isSprint ? 0.22 : 0.16);
      p.torsoRoll = turnLean;
      p.headYaw = turnLean * 1.2;

      p.lHipX = s * amp;
      p.rHipX = -s * amp;
      p.lKneeX = 0.16 + liftL * (isSprint ? 1.18 : 0.92);
      p.rKneeX = 0.16 + liftR * (isSprint ? 1.18 : 0.92);
      p.lAnkleX = -s * 0.24;
      p.rAnkleX = s * 0.24;

      p.lShoulderX = -s * amp * 0.94;
      p.rShoulderX = s * amp * 0.94;
      p.lShoulderZ = 0.14;
      p.rShoulderZ = -0.14;
      p.lElbowX = isSprint ? -1.2 : -0.85;
      p.rElbowX = isSprint ? -1.2 : -0.85;
      p.hairSwingX = (isSprint ? 0.36 : 0.25) + Math.abs(c) * 0.15;
      p.hairSwingZ = s * 0.14 - turnLean * 1.1;
      p.coatSwingX = (isSprint ? 0.34 : 0.22) + Math.abs(c) * 0.12;
      p.scarfSwingZ = s * 0.22 + (isSprint ? 0.16 : 0.08);
      p.faceMood = isSprint ? 'focused' : 'smile';
      break;
    }
    case 'climb_stairs':
    case 'descend_stairs': {
      const up = state === 'climb_stairs';
      const s = Math.sin(gait);
      const stepL = Math.max(0, Math.sin(gait + 0.6));
      const stepR = Math.max(0, Math.sin(gait + Math.PI + 0.6));
      p.hipsY = Math.abs(Math.cos(gait)) * 0.045 - 0.03;
      p.torsoPitch = up ? 0.18 : -0.06;
      p.torsoYaw = -s * 0.1;

      p.lHipX = (up ? -0.42 : -0.15) + s * 0.56;
      p.rHipX = (up ? -0.42 : -0.15) - s * 0.56;
      p.lKneeX = (up ? 0.55 : 0.38) + stepL * (up ? 0.72 : 0.58);
      p.rKneeX = (up ? 0.55 : 0.38) + stepR * (up ? 0.72 : 0.58);
      p.lAnkleX = up ? -0.22 : 0.12;
      p.rAnkleX = up ? -0.22 : 0.12;

      p.lShoulderX = -s * 0.48;
      p.rShoulderX = s * 0.48;
      p.lElbowX = -0.45;
      p.rElbowX = -0.45;
      p.hairSwingX = 0.14;
      p.faceMood = 'focused';
      break;
    }
    case 'climb_ladder': {
      const s = Math.sin(ladderPhase);
      const reachL = Math.max(0, s);
      const reachR = Math.max(0, -s);
      p.hipsY = Math.abs(Math.cos(ladderPhase)) * 0.04 - 0.03;
      p.torsoPitch = 0.08;
      p.torsoYaw = s * 0.09;
      p.headPitch = -0.26;
      p.lShoulderX = -1.65 - reachL * 0.65;
      p.rShoulderX = -1.65 - reachR * 0.65;
      p.lShoulderZ = 0.14;
      p.rShoulderZ = -0.14;
      p.lElbowX = -0.78 + reachL * 0.35;
      p.rElbowX = -0.78 + reachR * 0.35;
      p.lHipX = -0.62 - reachR * 0.42;
      p.rHipX = -0.62 - reachL * 0.42;
      p.lKneeX = 0.92 + reachR * 0.45;
      p.rKneeX = 0.92 + reachL * 0.45;
      p.lAnkleX = -0.15;
      p.rAnkleX = -0.15;
      p.hairSwingX = 0.16;
      p.faceMood = 'focused';
      break;
    }
    case 'parkour_vault': {
      p.hipsY = 0.12;
      p.hipsPitch = 0.16;
      p.torsoPitch = 0.42;
      p.torsoYaw = 0.22;
      p.headPitch = -0.18;
      p.lShoulderX = -1.25;
      p.lElbowX = -0.35;
      p.rShoulderX = 0.55;
      p.rShoulderZ = -0.32;
      p.rElbowX = -0.45;
      p.lHipX = -1.05;
      p.lKneeX = 1.45;
      p.rHipX = 0.24;
      p.rKneeX = 0.65;
      p.hairSwingX = 0.44;
      p.coatSwingX = 0.48;
      p.scarfSwingZ = 0.28;
      p.faceMood = 'focused';
      break;
    }
    case 'turn_left':
    case 'turn_right': {
      const dir = state === 'turn_left' ? 1 : -1;
      const step = Math.sin(elapsed * 8.5);
      p.torsoYaw = dir * 0.22;
      p.torsoRoll = -dir * 0.08;
      p.headYaw = dir * 0.3;
      p.headRoll = dir * 0.05;
      p.lHipX = step * 0.24;
      p.rHipX = -step * 0.24;
      p.lKneeX = 0.16;
      p.rKneeX = 0.16;
      p.lShoulderX = -step * 0.2;
      p.rShoulderX = step * 0.2;
      p.hairSwingZ = -dir * 0.16;
      p.coatSwingX = 0.08;
      break;
    }
    case 'jump': {
      p.hipsY = 0.06;
      p.torsoPitch = 0.1;
      p.lShoulderX = -0.98;
      p.rShoulderX = -0.98;
      p.lShoulderZ = 0.26;
      p.rShoulderZ = -0.26;
      p.lElbowX = -0.45;
      p.rElbowX = -0.45;
      p.lHipX = -0.48;
      p.rHipX = 0.2;
      p.lKneeX = 0.82;
      p.rKneeX = 0.3;
      p.hairSwingX = 0.32;
      p.coatSwingX = 0.35;
      p.faceMood = 'grin';
      break;
    }
    case 'fall': {
      const flail = Math.sin(elapsed * 9.0) * 0.14;
      p.hipsY = 0.02;
      p.torsoPitch = 0.14;
      p.lShoulderX = -1.28 + flail;
      p.rShoulderX = -1.28 - flail;
      p.lShoulderZ = 0.38;
      p.rShoulderZ = -0.38;
      p.lElbowX = -0.32;
      p.rElbowX = -0.32;
      p.lHipX = -0.25;
      p.rHipX = -0.12;
      p.lKneeX = 0.45;
      p.rKneeX = 0.35;
      p.hairSwingX = 0.45;
      p.coatSwingX = 0.45;
      p.faceMood = 'focused';
      break;
    }
    case 'land': {
      p.hipsY = -0.15;
      p.torsoPitch = 0.24;
      p.lHipX = -0.55;
      p.rHipX = -0.55;
      p.lKneeX = 0.98;
      p.rKneeX = 0.98;
      p.lAnkleX = -0.34;
      p.rAnkleX = -0.34;
      p.lShoulderX = 0.26;
      p.rShoulderX = 0.26;
      p.lShoulderZ = 0.24;
      p.rShoulderZ = -0.24;
      p.lElbowX = -0.5;
      p.rElbowX = -0.5;
      p.hairSwingX = -0.06;
      p.coatSwingX = 0.18;
      break;
    }
    case 'sit': {
      p.hipsY = -0.36;
      p.torsoPitch = -0.06 + breath * 0.015;
      p.lHipX = -1.42;
      p.rHipX = -1.42;
      p.lKneeX = 1.44;
      p.rKneeX = 1.44;
      p.lShoulderX = -0.12;
      p.rShoulderX = -0.12;
      p.lElbowX = -0.58;
      p.rElbowX = -0.58;
      p.headYaw = Math.sin(elapsed * 0.9) * 0.14;
      p.faceMood = 'smile';
      break;
    }
    case 'drive': {
      const steer = params.steerAngle ?? 0;
      p.hipsY = -0.34;
      p.torsoPitch = params.isMotorcycle ? 0.26 : 0.08;
      p.torsoRoll = params.isMotorcycle ? (params.leanAngle ?? 0) * 0.55 : -steer * 0.12;
      p.headYaw = steer * 0.28;
      p.lHipX = -1.32;
      p.rHipX = -1.32;
      p.lKneeX = 1.35;
      p.rKneeX = 1.35;
      p.lShoulderX = -0.78 - steer * 0.2;
      p.rShoulderX = -0.78 + steer * 0.2;
      p.lElbowX = -0.55;
      p.rElbowX = -0.55;
      p.faceMood = 'focused';
      break;
    }
    case 'wave':
    case 'greet': {
      const w = Math.sin(actionTimer * 10.5);
      p.hipsY = breath * 0.015;
      p.torsoRoll = -0.06;
      p.headYaw = state === 'greet' ? 0.1 : -0.08;
      p.headRoll = 0.06;
      p.headPitch = state === 'greet' ? 0.16 * Math.sin(Math.min(1, actionTimer * 2.5) * Math.PI) : -0.04;
      p.rShoulderX = -2.25;
      p.rShoulderZ = -0.35 + w * 0.26;
      p.rElbowX = -0.55 + w * 0.28;
      p.lShoulderZ = 0.1;
      p.lElbowX = -0.18;
      p.faceMood = 'grin';
      break;
    }
    case 'clap': {
      const c = Math.abs(Math.sin(actionTimer * 11.5));
      p.hipsY = -0.02 + c * 0.02;
      p.torsoPitch = 0.05;
      p.lShoulderX = -0.82;
      p.rShoulderX = -0.82;
      p.lShoulderZ = -0.18 + c * 0.28;
      p.rShoulderZ = 0.18 - c * 0.28;
      p.lElbowX = -0.95;
      p.rElbowX = -0.95;
      p.faceMood = 'grin';
      break;
    }
    case 'celebrate':
    case 'victory':
    case 'photo_victory': {
      const t = state === 'photo_victory' ? elapsed * 2.5 : actionTimer;
      const bounce = state === 'photo_victory' ? 0.45 + Math.sin(t) * 0.1 : Math.abs(Math.sin(t * 8.0));
      p.hipsY = bounce * 0.12;
      p.torsoPitch = -0.08;
      p.headPitch = -0.16;
      p.headRoll = 0.08;
      p.lShoulderX = -2.65;
      p.rShoulderX = -2.65;
      p.lShoulderZ = 0.28 + bounce * 0.14;
      p.rShoulderZ = -0.28 - bounce * 0.14;
      p.lElbowX = -0.25;
      p.rElbowX = -0.25;
      p.lKneeX = bounce > 0.5 ? 0.35 : 0.05;
      p.rKneeX = bounce > 0.5 ? 0.1 : 0.25;
      p.hairSwingX = 0.18;
      p.faceMood = 'grin';
      break;
    }
    case 'photo_cool': {
      p.hipsRoll = 0.06;
      p.torsoYaw = -0.24;
      p.torsoRoll = -0.05;
      p.headYaw = 0.22;
      p.headRoll = 0.06;
      p.lShoulderX = -0.35;
      p.lShoulderZ = 0.18;
      p.lElbowX = -1.15;
      p.rShoulderX = 0.14;
      p.rShoulderZ = -0.14;
      p.rElbowX = -0.35;
      p.lHipX = -0.08;
      p.lKneeX = 0.18;
      p.rHipX = 0.06;
      p.faceMood = 'smile';
      break;
    }
    case 'photo_hero': {
      p.hipsY = -0.04;
      p.torsoPitch = -0.08;
      p.torsoYaw = 0.18;
      p.headYaw = -0.16;
      p.headPitch = -0.1;
      p.lShoulderX = -0.22;
      p.lShoulderZ = 0.28;
      p.lElbowX = -0.95;
      p.rShoulderX = -1.65;
      p.rShoulderZ = -0.24;
      p.rElbowX = -0.25;
      p.lHipX = -0.18;
      p.lKneeX = 0.26;
      p.rHipX = 0.16;
      p.coatSwingX = 0.24;
      p.hairSwingX = 0.15;
      p.faceMood = 'focused';
      break;
    }
    case 'photo_peace': {
      p.hipsRoll = -0.06;
      p.torsoYaw = 0.16;
      p.headYaw = -0.12;
      p.headRoll = 0.12;
      p.rShoulderX = -1.85;
      p.rShoulderZ = -0.25;
      p.rElbowX = -0.82;
      p.lShoulderX = -0.25;
      p.lShoulderZ = 0.22;
      p.lElbowX = -0.95;
      p.lKneeX = 0.22;
      p.lHipX = -0.14;
      p.faceMood = 'wink';
      break;
    }
    case 'photo_scholar': {
      p.torsoPitch = 0.04;
      p.torsoYaw = -0.12;
      p.headYaw = 0.1;
      p.headPitch = 0.12;
      p.lShoulderX = -0.88;
      p.lShoulderZ = -0.14;
      p.lElbowX = -1.05;
      p.rShoulderX = -1.15;
      p.rShoulderZ = 0.1;
      p.rElbowX = -1.15;
      p.faceMood = 'smile';
      break;
    }
    case 'photo_parkour': {
      p.hipsY = 0.08;
      p.torsoPitch = 0.34;
      p.torsoYaw = 0.24;
      p.headYaw = -0.22;
      p.headPitch = -0.16;
      p.lShoulderX = -1.35;
      p.lElbowX = -0.4;
      p.rShoulderX = 0.65;
      p.rShoulderZ = -0.3;
      p.rElbowX = -0.35;
      p.lHipX = -1.0;
      p.lKneeX = 1.4;
      p.rHipX = 0.28;
      p.rKneeX = 0.52;
      p.hairSwingX = 0.38;
      p.coatSwingX = 0.42;
      p.faceMood = 'grin';
      break;
    }
    case 'laugh': {
      const chuckle = Math.sin(actionTimer * 14.0);
      p.hipsY = -0.02 + Math.abs(chuckle) * 0.025;
      p.torsoPitch = -0.1 + chuckle * 0.06;
      p.headPitch = -0.2 + chuckle * 0.08;
      p.rShoulderX = -0.95;
      p.rElbowX = -1.35;
      p.rShoulderZ = 0.22;
      p.lShoulderX = -0.25;
      p.lElbowX = -0.4;
      p.faceMood = 'grin';
      break;
    }
    case 'handshake': {
      const pump = Math.sin(actionTimer * 9.5) * 0.12;
      p.torsoPitch = 0.08;
      p.headPitch = 0.06;
      p.rShoulderX = -1.05 + pump;
      p.rShoulderZ = 0.06;
      p.rElbowX = -0.45 + pump;
      p.lShoulderZ = 0.1;
      p.lElbowX = -0.18;
      p.faceMood = 'smile';
      break;
    }
    case 'high_five': {
      const snap = Math.sin(Math.min(1, actionTimer * 1.4) * Math.PI);
      p.hipsY = 0.06 * snap;
      p.torsoPitch = -0.05;
      p.headPitch = -0.14;
      p.rShoulderX = -2.45 * snap - 0.35 * (1 - snap);
      p.rShoulderZ = -0.18;
      p.rElbowX = -0.18;
      p.lShoulderX = 0.25;
      p.faceMood = 'grin';
      break;
    }
    case 'kp_excited': {
      const jumpLoop = Math.abs(Math.sin(actionTimer * 9.0));
      p.hipsY = jumpLoop * 0.2;
      p.torsoYaw = Math.sin(actionTimer * 4.5) * 0.28;
      p.headPitch = -0.22;
      p.lShoulderX = -2.8;
      p.rShoulderX = -2.8;
      p.lShoulderZ = 0.35;
      p.rShoulderZ = -0.35;
      p.lKneeX = jumpLoop * 0.45;
      p.rKneeX = jumpLoop * 0.45;
      p.hairSwingX = 0.28;
      p.faceMood = 'grin';
      break;
    }
    case 'show_accessory': {
      const turn = Math.sin(actionTimer * 3.4);
      p.torsoYaw = turn * 0.45;
      p.headYaw = -turn * 0.22;
      p.lShoulderX = -1.15;
      p.lShoulderZ = -0.18;
      p.lElbowX = -1.2;
      p.rShoulderX = -0.35;
      p.rElbowX = -0.4;
      p.hairSwingZ = -turn * 0.15;
      p.faceMood = 'smile';
      break;
    }
    case 'rare_outfit_celebrate': {
      const spin = Math.min(1, actionTimer / 1.1) * Math.PI * 2;
      const flourish = Math.abs(Math.sin(actionTimer * 7.5));
      p.torsoYaw = Math.sin(spin) * 0.48;
      p.hipsY = flourish * 0.14;
      p.lShoulderX = -1.85;
      p.rShoulderX = -1.85;
      p.lShoulderZ = 0.55 + flourish * 0.25;
      p.rShoulderZ = -0.55 - flourish * 0.25;
      p.lElbowX = -0.3;
      p.rElbowX = -0.3;
      p.coatSwingX = 0.25;
      p.faceMood = 'grin';
      break;
    }
    case 'disappoint': {
      const shake = Math.sin(actionTimer * 9.0);
      p.hipsY = -0.04;
      p.torsoPitch = 0.18;
      p.headPitch = 0.28;
      p.headYaw = shake * 0.25;
      p.lShoulderX = -0.32;
      p.rShoulderX = -0.32;
      p.lElbowX = -1.25;
      p.rElbowX = -1.25;
      p.faceMood = 'focused';
      break;
    }
    case 'dance': {
      const groove = Math.sin(actionTimer * 7.2);
      const step = Math.sin(actionTimer * 3.6);
      p.hipsY = Math.abs(groove) * 0.09 - 0.04;
      p.hipsRoll = step * 0.12;
      p.torsoRoll = -step * 0.1;
      p.torsoYaw = step * 0.24;
      p.headYaw = -step * 0.15;
      p.headRoll = step * 0.08;
      p.lShoulderX = -1.25 + groove * 0.5;
      p.rShoulderX = -1.25 - groove * 0.5;
      p.lShoulderZ = 0.35;
      p.rShoulderZ = -0.35;
      p.lElbowX = -0.85;
      p.rElbowX = -0.85;
      p.lHipX = -Math.max(0, step) * 0.45;
      p.lKneeX = Math.max(0, step) * 0.7;
      p.rHipX = -Math.max(0, -step) * 0.45;
      p.rKneeX = Math.max(0, -step) * 0.7;
      p.hairSwingZ = -step * 0.2;
      p.scarfSwingZ = step * 0.22;
      p.faceMood = 'grin';
      break;
    }
    case 'point': {
      p.torsoYaw = 0.15;
      p.headYaw = 0.08;
      p.rShoulderX = -1.45;
      p.rShoulderZ = -0.05;
      p.rElbowX = -0.06;
      p.lElbowX = -0.2;
      p.faceMood = 'smile';
      break;
    }
    case 'open_door':
    case 'close_door':
    case 'press_button':
    case 'enter_elevator':
    case 'exit_elevator': {
      const reach = Math.sin(Math.min(1, actionTimer * 2.2) * Math.PI);
      p.torsoPitch = 0.08 * reach;
      p.rShoulderX = -1.15 * reach;
      p.rElbowX = -0.35 * reach;
      break;
    }
    case 'pickup': {
      const crouch = Math.sin(Math.min(1, actionTimer * 1.9) * Math.PI);
      p.hipsY = -0.22 * crouch;
      p.torsoPitch = 0.48 * crouch;
      p.lHipX = -0.65 * crouch;
      p.rHipX = -0.65 * crouch;
      p.lKneeX = 0.95 * crouch;
      p.rKneeX = 0.95 * crouch;
      p.rShoulderX = -0.85 * crouch;
      p.rElbowX = -0.25 * crouch;
      break;
    }
    case 'examine_book':
    case 'use_tablet': {
      p.torsoPitch = 0.08;
      p.headPitch = 0.28;
      p.lShoulderX = -0.72;
      p.rShoulderX = -0.72;
      p.lShoulderZ = -0.16;
      p.rShoulderZ = 0.16;
      p.lElbowX = -0.95;
      p.rElbowX = -0.95;
      p.faceMood = 'focused';
      break;
    }
    case 'stand':
    case 'approach_vehicle':
    case 'enter_vehicle':
    case 'exit_vehicle': {
      const t = Math.sin(Math.min(1, actionTimer * 3.0) * Math.PI);
      p.hipsY = state === 'enter_vehicle' ? -0.16 * t : 0.04 * t;
      p.torsoPitch = 0.12 * t;
      p.lHipX = -0.35 * t;
      p.lKneeX = 0.55 * t;
      p.rShoulderX = -0.45 * t;
      break;
    }
  }

  return p;
}

function damp(curr: number, target: number, lambda: number, dt: number): number {
  return curr + (target - curr) * (1 - Math.exp(-lambda * dt));
}

export function stepCharacterAnimRuntime(
  rt: CharacterAnimRuntime,
  params: AnimResolveParams,
  rawDt: number,
): CharacterAnimState {
  const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

  if (!rt.wasGrounded && params.grounded) {
    rt.landTimer = 0.18;
  }
  rt.wasGrounded = params.grounded;
  if (rt.landTimer > 0) {
    rt.landTimer = Math.max(0, rt.landTimer - dt);
  }

  if (rt.actionState) {
    rt.actionTimer += dt;
    if (params.isMoving || params.speed > 0.45 || !params.grounded || params.isDriving || params.climbingLadder) {
      clearCharacterAction(rt);
    } else if (!rt.actionLooped && rt.actionTimer >= rt.actionDuration) {
      clearCharacterAction(rt);
    }
  }

  const nextState = resolveCharacterAnimState(rt, params);
  rt.currentState = nextState;

  if (nextState === 'climb_ladder') {
    const climbMag = Math.abs(params.climbSpeed ?? 0);
    if (climbMag > 0.1) {
      rt.ladderPhase += (params.climbSpeed ?? 0) * 2.4 * dt;
    }
  } else if (params.grounded && (params.isMoving || params.speed > 0.25)) {
    const strideScale =
      nextState === 'climb_stairs' || nextState === 'descend_stairs'
        ? 2.45
        : nextState === 'sprint'
          ? 1.55
          : nextState === 'jog'
            ? 1.75
            : 2.05;
    rt.gaitPhase += params.speed * strideScale * dt;
  }

  // Natural eye blink cycle (every ~3.8s blink for ~0.15s)
  rt.blinkTimer = (rt.blinkTimer + dt) % 3.8;
  const naturalBlink = rt.blinkTimer < 0.15 ? Math.sin((rt.blinkTimer / 0.15) * Math.PI) : 0;

  const target = computeTargetPose(
    nextState,
    rt.gaitPhase,
    rt.ladderPhase,
    params.elapsedTime,
    rt.actionTimer,
    params,
  );
  const blendSpeed =
    nextState === 'land' || nextState === 'jump' || nextState === 'parkour_vault'
      ? 20
      : nextState === 'sprint' || nextState === 'climb_stairs' || nextState === 'descend_stairs' || nextState === 'climb_ladder'
        ? 16
        : 12.5;

  const p = rt.pose;
  p.hipsY = damp(p.hipsY, target.hipsY, blendSpeed, dt);
  p.hipsPitch = damp(p.hipsPitch, target.hipsPitch, blendSpeed, dt);
  p.hipsRoll = damp(p.hipsRoll, target.hipsRoll, blendSpeed, dt);
  p.torsoPitch = damp(p.torsoPitch, target.torsoPitch, blendSpeed, dt);
  p.torsoYaw = damp(p.torsoYaw, target.torsoYaw, blendSpeed, dt);
  p.torsoRoll = damp(p.torsoRoll, target.torsoRoll, blendSpeed, dt);
  p.headYaw = damp(p.headYaw, target.headYaw, blendSpeed, dt);
  p.headPitch = damp(p.headPitch, target.headPitch, blendSpeed, dt);
  p.headRoll = damp(p.headRoll, target.headRoll, blendSpeed, dt);
  p.lShoulderX = damp(p.lShoulderX, target.lShoulderX, blendSpeed, dt);
  p.lShoulderZ = damp(p.lShoulderZ, target.lShoulderZ, blendSpeed, dt);
  p.lElbowX = damp(p.lElbowX, target.lElbowX, blendSpeed, dt);
  p.rShoulderX = damp(p.rShoulderX, target.rShoulderX, blendSpeed, dt);
  p.rShoulderZ = damp(p.rShoulderZ, target.rShoulderZ, blendSpeed, dt);
  p.rElbowX = damp(p.rElbowX, target.rElbowX, blendSpeed, dt);
  p.lHipX = damp(p.lHipX, target.lHipX, blendSpeed, dt);
  p.lHipZ = damp(p.lHipZ, target.lHipZ, blendSpeed, dt);
  p.lKneeX = damp(p.lKneeX, target.lKneeX, blendSpeed, dt);
  p.lAnkleX = damp(p.lAnkleX, target.lAnkleX, blendSpeed, dt);
  p.rHipX = damp(p.rHipX, target.rHipX, blendSpeed, dt);
  p.rHipZ = damp(p.rHipZ, target.rHipZ, blendSpeed, dt);
  p.rKneeX = damp(p.rKneeX, target.rKneeX, blendSpeed, dt);
  p.rAnkleX = damp(p.rAnkleX, target.rAnkleX, blendSpeed, dt);
  p.hairSwingX = damp(p.hairSwingX, target.hairSwingX, 10, dt);
  p.hairSwingZ = damp(p.hairSwingZ, target.hairSwingZ, 10, dt);
  p.coatSwingX = damp(p.coatSwingX, target.coatSwingX, 10, dt);
  p.scarfSwingZ = damp(p.scarfSwingZ, target.scarfSwingZ, 10, dt);
  p.blinkWeight = naturalBlink;
  p.faceMood = target.faceMood;

  return nextState;
}
