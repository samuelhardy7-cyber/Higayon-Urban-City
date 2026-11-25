import type { CharacterAnimState, EmoteKind } from './characterAnimator';
import type { ElevatorDoorState } from './elevatorSystem';
import type { CharacterCustomization, VehicleKind } from './types';

export type UserRole = 'student' | 'teacher';

export interface AuthUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  isBootstrappedTeacher?: boolean;
}

export type SessionStatus = 'waiting' | 'active' | 'paused' | 'ended';

export type PlayerMovementState =
  | 'idle'
  | 'walking'
  | 'running'
  | 'jumping'
  | 'driving'
  | 'flying'
  | 'swimming'
  | 'diving';

export type PlayerConnectionStatus = 'online' | 'reconnecting' | 'offline';

export interface MultiplayerSessionRecord {
  id: string;
  name: string;
  subject: string;
  questionSetId: string;
  joinCode: string;
  maxPlayers: number;
  durationMinutes: number;
  objectives: string;
  status: SessionStatus;
  teacherUid: string;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  pausedAt: number | null;
  accumulatedPauseMs: number;
  remainingSeconds: number;
}

export interface RemotePlayerState {
  playerId: string;
  displayName: string;
  avatar: CharacterCustomization;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number };
  movementState: PlayerMovementState;
  animState?: CharacterAnimState;
  emoteKind?: EmoteKind | null;
  emoteSeq?: number;
  speed?: number;
  grounded?: boolean;
  onStairs?: boolean;
  onSeat?: boolean;
  climbingLadder?: boolean;
  turnDeltaYaw?: number;
  photoPose?: string | null;
  vehicleKind: VehicleKind | null;
  currentBuilding: string | null;
  currentFloor: number;
  currentActivity: string;
  connectionStatus: PlayerConnectionStatus;
  questionsCompleted: number;
  pointsEarned: number;
  groupId?: string | null;
  groupName?: string | null;
  updatedAt: number;
}

export interface ElevatorSyncPayload {
  buildingId: string;
  elevatorId: string;
  currentY: number;
  currentFloor: number;
  targetFloor: number | null;
  direction: -1 | 0 | 1;
  doorState: ElevatorDoorState;
  doorProgress: number;
  moving: boolean;
  updatedAt: number;
}

export interface SocialGroupSnapshot {
  id: string;
  name: string;
  leaderPlayerId: string;
  memberPlayerIds: string[];
  createdAt: number;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  senderPlayerId: string;
  senderName: string;
  text: string;
  createdAt: number;
  redacted?: boolean;
}

export interface ModerationReportRecord {
  id: string;
  sessionId: string;
  reporterUid: string;
  reporterName: string;
  targetPlayerId: string;
  targetName: string;
  reason: string;
  messageExcerpt?: string;
  createdAt: number;
}

export interface ChallengeLeaderboardEntry {
  playerId: string;
  displayName: string;
  groupId: string | null;
  groupName: string | null;
  kpEarned: number;
  questionsCompleted: number;
  buildingsVisited: number;
  towerMaxFloor: number;
  completionStatus: 'in_progress' | 'completed';
  rank: number;
}

export interface TeamScoreEntry {
  groupId: string;
  groupName: string;
  memberCount: number;
  totalKp: number;
  totalQuestions: number;
  rank: number;
}

export interface ChallengeSessionState {
  mode: 'none' | 'knowledge_race' | 'team_exploration' | 'city_tower_challenge' | 'subject_challenge';
  title: string;
  subjectFilter: string;
  targetQuestions: number;
  timeRemainingSeconds: number;
  leaderboard: ChallengeLeaderboardEntry[];
  teamScores: TeamScoreEntry[];
}

export interface KpTransactionRecord {
  txId: string;
  kind: 'earn_question' | 'spend_shop' | 'badge_bonus';
  amount: number;
  balanceAfter: number;
  refId: string;
  description: string;
  createdAt: number;
}

export interface PlayerAccountProfile {
  uid: string;
  displayName: string;
  knowledgePoints: number;
  lifetimeKpEarned: number;
  completedQuestionIds: string[];
  lockedQuestionIds: string[];
  ownedItemIds: string[];
  unlockedBadges: string[];
  visitedBuildings: string[];
  towerMaxFloor: number;
  customization: CharacterCustomization;
  recentTransactions: KpTransactionRecord[];
  updatedAt: number;
}

export interface MultiplayerSessionSnapshot {
  session: MultiplayerSessionRecord;
  players: RemotePlayerState[];
  onlineCount: number;
  elevators?: ElevatorSyncPayload[];
  groups?: SocialGroupSnapshot[];
  recentChat?: ChatMessageRecord[];
  challengeState?: ChallengeSessionState;
}

export interface StudentProgressRecord {
  uid: string;
  displayName: string;
  sessionId: string | null;
  sessionName: string | null;
  questionsCompleted: number;
  pointsEarned: number;
  knowledgePoints?: number;
  currentBuilding: string | null;
  currentFloor: number;
  currentActivity: string;
  connectionStatus: PlayerConnectionStatus;
  lastActiveAt: number;
}

export interface TeacherPinStatus {
  pinConfigured: boolean;
  locked: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
}

export type ClientWsMessage =
  | {
      type: 'auth:join';
      token?: string;
      guestId?: string;
      displayName?: string;
      joinCode: string;
      avatar: CharacterCustomization;
    }
  | {
      type: 'player:update';
      position: { x: number; y: number; z: number };
      rotation: { yaw: number };
      movementState: PlayerMovementState;
      animState?: CharacterAnimState;
      emoteKind?: EmoteKind | null;
      emoteSeq?: number;
      speed?: number;
      grounded?: boolean;
      onStairs?: boolean;
      onSeat?: boolean;
      climbingLadder?: boolean;
      turnDeltaYaw?: number;
      photoPose?: string | null;
      vehicleKind: VehicleKind | null;
      currentBuilding: string | null;
      currentFloor: number;
      currentActivity: string;
      avatar: CharacterCustomization;
    }
  | {
      type: 'elevator:action';
      buildingId: string;
      elevatorId: string;
      action: 'call' | 'select';
      floor: number;
    }
  | {
      type: 'social:chat';
      text: string;
    }
  | {
      type: 'social:emote_greet';
      targetPlayerId: string;
      emote: EmoteKind;
    }
  | {
      type: 'group:action';
      action: 'create' | 'join' | 'leave';
      groupId?: string;
      name?: string;
    }
  | {
      type: 'social:report';
      targetPlayerId: string;
      reason: string;
      messageExcerpt?: string;
    }
  | {
      type: 'session:leave';
    }
  | {
      type: 'ping';
      ts: number;
    };

export type ServerWsMessage =
  | {
      type: 'session:joined';
      selfPlayerId: string;
      snapshot: MultiplayerSessionSnapshot;
    }
  | {
      type: 'session:state';
      snapshot: MultiplayerSessionSnapshot;
    }
  | {
      type: 'player:delta';
      player: RemotePlayerState;
    }
  | {
      type: 'elevator:state';
      elevator: ElevatorSyncPayload;
    }
  | {
      type: 'social:chat_msg';
      message: ChatMessageRecord;
    }
  | {
      type: 'social:emote_event';
      fromPlayerId: string;
      fromName: string;
      targetPlayerId: string;
      emote: EmoteKind;
    }
  | {
      type: 'social:groups_state';
      groups: SocialGroupSnapshot[];
    }
  | {
      type: 'challenge:state';
      challengeState: ChallengeSessionState;
    }
  | {
      type: 'player:left';
      playerId: string;
      connectionStatus: PlayerConnectionStatus;
    }
  | {
      type: 'session:error';
      code: string;
      message: string;
    }
  | {
      type: 'pong';
      ts: number;
    };
