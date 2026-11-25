import type { CharacterAnimState, EmoteKind } from '../game/characterAnimator';
import type {
  AuthUserProfile,
  ChallengeSessionState,
  ChatMessageRecord,
  ClientWsMessage,
  KpTransactionRecord,
  ModerationReportRecord,
  MultiplayerSessionSnapshot,
  PlayerAccountProfile,
  PlayerMovementState,
  ServerWsMessage,
  SessionStatus,
  SocialGroupSnapshot,
  StudentProgressRecord,
  TeacherPinStatus,
} from '../game/multiplayerTypes';
import type {
  AnswerKey,
  PlayerQuizProgress,
  PlayerSubmissionOutcome,
  PublicQuestionDatabase,
  QuestionDatabase,
  TeacherConfig,
} from '../game/questionTypes';
import type { RewardShopItem } from '../game/rewardShopCatalog';
import type { CharacterCustomization, VehicleKind } from '../game/types';

function getGuestId(): string {
  try {
    const key = 'urban_life_guest_player_id';
    let existing = window.localStorage.getItem(key);
    if (!existing) {
      existing = `guest_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(key, existing);
    }
    return existing;
  } catch {
    return 'guest_local';
  }
}

export function getTabMultiplayerGuestId(): string {
  try {
    const key = 'urban_life_tab_guest_id';
    let existing = window.sessionStorage.getItem(key);
    if (!existing) {
      existing = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      window.sessionStorage.setItem(key, existing);
    }
    return existing;
  } catch {
    return getGuestId();
  }
}

export function getSavedGuestDisplayName(): string {
  try {
    return (window.localStorage.getItem('urban_life_guest_name') || '').trim().slice(0, 22);
  } catch {
    return '';
  }
}

export function saveGuestDisplayName(name: string): string {
  const cleaned = name.replace(/[\r\n<>]/g, '').trim().slice(0, 22);
  try {
    if (cleaned) {
      window.localStorage.setItem('urban_life_guest_name', cleaned);
    } else {
      window.localStorage.removeItem('urban_life_guest_name');
    }
  } catch {
    // ignore
  }
  return cleaned;
}

async function apiJson<T>(
  url: string,
  options?: RequestInit & { idToken?: string | null; teacherToken?: string | null },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Guest-Player-Id': getGuestId(),
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (options?.idToken) {
    headers.Authorization = `Bearer ${options.idToken}`;
  }
  if (options?.teacherToken) {
    headers['X-Teacher-Token'] = options.teacherToken;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
    retryAfterSeconds?: number;
    remainingAttempts?: number;
    locked?: boolean;
  };
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      code?: string;
      retryAfterSeconds?: number;
      remainingAttempts?: number;
      locked?: boolean;
    };
    err.status = res.status;
    err.code = data.code;
    err.retryAfterSeconds = data.retryAfterSeconds;
    err.remainingAttempts = data.remainingAttempts;
    err.locked = data.locked;
    throw err;
  }
  return data;
}

export async function fetchAuthProfile(idToken: string): Promise<AuthUserProfile> {
  return apiJson<AuthUserProfile>('/api/auth/me', { idToken });
}

export async function fetchPublicQuizState(
  idToken?: string | null,
): Promise<{ database: PublicQuestionDatabase; progress: PlayerQuizProgress }> {
  return apiJson<{ database: PublicQuestionDatabase; progress: PlayerQuizProgress }>(
    '/api/quiz/public',
    { idToken },
  );
}

export async function submitQuizAnswerToServer(params: {
  idToken?: string | null;
  questionId: string;
  selectedAnswer: AnswerKey;
  sessionId?: string | null;
  txId?: string | null;
}): Promise<{
  outcome: PlayerSubmissionOutcome;
  progress: PlayerQuizProgress;
  profile?: PlayerAccountProfile;
}> {
  return apiJson<{
    outcome: PlayerSubmissionOutcome;
    progress: PlayerQuizProgress;
    profile?: PlayerAccountProfile;
  }>('/api/quiz/submit', {
    method: 'POST',
    idToken: params.idToken,
    body: JSON.stringify({
      questionId: params.questionId,
      selectedAnswer: params.selectedAnswer,
      sessionId: params.sessionId || null,
      txId: params.txId || null,
    }),
  });
}

export async function fetchShopCatalog(): Promise<{
  items: RewardShopItem[];
  teacherConfig: TeacherConfig;
}> {
  return apiJson('/api/shop/catalog');
}

export async function fetchPlayerProfile(
  idToken: string,
): Promise<{ profile: PlayerAccountProfile }> {
  return apiJson('/api/player/profile', { idToken });
}

export async function purchaseShopItemOnServer(
  idToken: string,
  params: { itemId: string; txId: string; equipImmediately?: boolean },
): Promise<{
  profile: PlayerAccountProfile;
  item: RewardShopItem;
  transaction: KpTransactionRecord;
  alreadyProcessed: boolean;
}> {
  return apiJson('/api/shop/purchase', {
    method: 'POST',
    idToken,
    body: JSON.stringify(params),
  });
}

export async function updatePlayerCustomizationOnServer(
  idToken: string,
  params: { itemId?: string; patch?: Partial<CharacterCustomization> },
): Promise<{ profile: PlayerAccountProfile }> {
  return apiJson('/api/player/customization', {
    method: 'PUT',
    idToken,
    body: JSON.stringify(params),
  });
}

export async function syncPlayerProgressOnServer(
  idToken: string,
  params: { visitedBuildingId?: string; towerFloor?: number },
): Promise<{ profile: PlayerAccountProfile }> {
  return apiJson('/api/player/progress-sync', {
    method: 'POST',
    idToken,
    body: JSON.stringify(params),
  });
}

export async function fetchTeacherReports(
  idToken: string,
  teacherToken: string,
): Promise<{ reports: ModerationReportRecord[] }> {
  return apiJson('/api/teacher/reports', { idToken, teacherToken });
}

export async function fetchTeacherPinStatus(idToken: string): Promise<TeacherPinStatus> {
  return apiJson<TeacherPinStatus>('/api/teacher/pin/status', { idToken });
}

export async function setupTeacherPin(
  idToken: string,
  pin: string,
): Promise<{ verified: boolean; teacherToken: string; expiresAt: number }> {
  return apiJson('/api/teacher/pin/setup', {
    method: 'POST',
    idToken,
    body: JSON.stringify({ pin }),
  });
}

export async function verifyTeacherPin(
  idToken: string,
  pin: string,
): Promise<{ verified: boolean; teacherToken: string; expiresAt: number }> {
  return apiJson('/api/teacher/pin/verify', {
    method: 'POST',
    idToken,
    body: JSON.stringify({ pin }),
  });
}

export async function changeTeacherPin(
  idToken: string,
  teacherToken: string,
  currentPin: string,
  newPin: string,
): Promise<{ updated: boolean }> {
  return apiJson('/api/teacher/pin/change', {
    method: 'POST',
    idToken,
    teacherToken,
    body: JSON.stringify({ currentPin, newPin }),
  });
}

export async function fetchTeacherDatabase(
  idToken: string,
  teacherToken: string,
): Promise<{ database: QuestionDatabase; teacherEmails: string[] }> {
  return apiJson('/api/teacher/database', { idToken, teacherToken });
}

export async function saveTeacherDatabase(
  idToken: string,
  teacherToken: string,
  database: QuestionDatabase,
): Promise<{ database: QuestionDatabase }> {
  return apiJson('/api/teacher/database', {
    method: 'PUT',
    idToken,
    teacherToken,
    body: JSON.stringify({ database }),
  });
}

export async function resetTeacherDatabase(
  idToken: string,
  teacherToken: string,
): Promise<{ database: QuestionDatabase }> {
  return apiJson('/api/teacher/database/reset', {
    method: 'POST',
    idToken,
    teacherToken,
  });
}

export async function manageTeacherAccounts(
  idToken: string,
  teacherToken: string,
  action: 'add' | 'remove',
  email: string,
): Promise<{ teacherEmails: string[] }> {
  return apiJson('/api/teacher/accounts', {
    method: 'POST',
    idToken,
    teacherToken,
    body: JSON.stringify({ action, email }),
  });
}

export async function fetchTeacherSessions(
  idToken: string,
  teacherToken: string,
): Promise<{
  sessions: MultiplayerSessionSnapshot[];
  studentProgress: StudentProgressRecord[];
}> {
  return apiJson('/api/teacher/sessions', { idToken, teacherToken });
}

export async function createTeacherSession(
  idToken: string,
  teacherToken: string,
  input: {
    name: string;
    subject: string;
    questionSetId: string;
    maxPlayers: number;
    durationMinutes: number;
    objectives: string;
    joinCode?: string;
  },
): Promise<{ snapshot: MultiplayerSessionSnapshot }> {
  return apiJson('/api/teacher/sessions', {
    method: 'POST',
    idToken,
    teacherToken,
    body: JSON.stringify(input),
  });
}

export async function updateTeacherSessionStatus(
  idToken: string,
  teacherToken: string,
  sessionId: string,
  status: SessionStatus,
): Promise<{ snapshot: MultiplayerSessionSnapshot }> {
  return apiJson(`/api/teacher/sessions/${encodeURIComponent(sessionId)}/status`, {
    method: 'PATCH',
    idToken,
    teacherToken,
    body: JSON.stringify({ status }),
  });
}

export async function deleteTeacherSession(
  idToken: string,
  teacherToken: string,
  sessionId: string,
): Promise<{ deleted: boolean }> {
  return apiJson(`/api/teacher/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    idToken,
    teacherToken,
  });
}

export async function checkJoinSession(
  idToken: string,
  joinCode: string,
): Promise<{ snapshot: MultiplayerSessionSnapshot }> {
  return apiJson('/api/sessions/join-check', {
    method: 'POST',
    idToken,
    body: JSON.stringify({ joinCode }),
  });
}

export interface MultiplayerClientCallbacks {
  onJoined: (selfPlayerId: string, snapshot: MultiplayerSessionSnapshot) => void;
  onSessionState: (snapshot: MultiplayerSessionSnapshot) => void;
  onPlayerDelta: (msg: Extract<ServerWsMessage, { type: 'player:delta' }>) => void;
  onPlayerLeft: (msg: Extract<ServerWsMessage, { type: 'player:left' }>) => void;
  onElevatorState?: (msg: Extract<ServerWsMessage, { type: 'elevator:state' }>) => void;
  onChatMessage?: (message: ChatMessageRecord) => void;
  onEmoteEvent?: (evt: Extract<ServerWsMessage, { type: 'social:emote_event' }>) => void;
  onGroupsState?: (groups: SocialGroupSnapshot[]) => void;
  onChallengeState?: (challengeState: ChallengeSessionState) => void;
  onConnectionChange: (state: 'connected' | 'reconnecting' | 'disconnected') => void;
  onError: (code: string, message: string) => void;
}

export class MultiplayerWsClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerClientCallbacks;
  private getToken: () => Promise<string | null>;
  private getDisplayName: () => string;
  private joinCode = '';
  private avatar: CharacterCustomization;
  private closedManually = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;

  constructor(
    getToken: () => Promise<string | null>,
    initialAvatar: CharacterCustomization,
    callbacks: MultiplayerClientCallbacks,
    getDisplayName?: () => string,
  ) {
    this.getToken = getToken;
    this.avatar = initialAvatar;
    this.callbacks = callbacks;
    this.getDisplayName = getDisplayName || (() => getSavedGuestDisplayName());
  }

  public async connect(joinCode: string, avatar: CharacterCustomization): Promise<void> {
    this.closedManually = false;
    this.joinCode = joinCode.trim().toUpperCase();
    this.avatar = avatar;
    this.reconnectAttempts = 0;
    await this.openSocket();
  }

  private async openSocket(): Promise<void> {
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    const token = await this.getToken();
    const isPublicOpenWorld = this.joinCode === 'OPEN_WORLD';
    if (!token && !isPublicOpenWorld) {
      this.callbacks.onError('UNAUTHORIZED', 'Google sign-in is required for classroom sessions.');
      this.callbacks.onConnectionChange('disconnected');
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/multiplayer`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      const msg: ClientWsMessage = {
        type: 'auth:join',
        token: token || undefined,
        guestId: token ? undefined : getTabMultiplayerGuestId(),
        displayName: token ? undefined : this.getDisplayName(),
        joinCode: this.joinCode,
        avatar: this.avatar,
      };
      ws.send(JSON.stringify(msg));
      this.pingTimer = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', ts: Date.now() } satisfies ClientWsMessage));
        }
      }, 8000);
    };

    ws.onmessage = (evt) => {
      let data: ServerWsMessage;
      try {
        data = JSON.parse(String(evt.data)) as ServerWsMessage;
      } catch {
        return;
      }
      if (data.type === 'session:joined') {
        this.callbacks.onConnectionChange('connected');
        this.callbacks.onJoined(data.selfPlayerId, data.snapshot);
      } else if (data.type === 'session:state') {
        this.callbacks.onSessionState(data.snapshot);
      } else if (data.type === 'player:delta') {
        this.callbacks.onPlayerDelta(data);
      } else if (data.type === 'player:left') {
        this.callbacks.onPlayerLeft(data);
      } else if (data.type === 'elevator:state') {
        this.callbacks.onElevatorState?.(data);
      } else if (data.type === 'social:chat_msg') {
        this.callbacks.onChatMessage?.(data.message);
      } else if (data.type === 'social:emote_event') {
        this.callbacks.onEmoteEvent?.(data);
      } else if (data.type === 'social:groups_state') {
        this.callbacks.onGroupsState?.(data.groups);
      } else if (data.type === 'challenge:state') {
        this.callbacks.onChallengeState?.(data.challengeState);
      } else if (data.type === 'session:error') {
        this.callbacks.onError(data.code, data.message);
        if (data.code === 'DUPLICATE_LOGIN' || data.code === 'SESSION_ENDED' || data.code === 'SESSION_FULL') {
          this.closedManually = true;
        }
      }
    };

    ws.onclose = () => {
      this.clearTimers();
      if (this.closedManually) {
        this.callbacks.onConnectionChange('disconnected');
        return;
      }
      if (this.reconnectAttempts < 6) {
        this.reconnectAttempts++;
        this.callbacks.onConnectionChange('reconnecting');
        const delay = Math.min(8000, 900 * Math.pow(1.6, this.reconnectAttempts - 1));
        this.reconnectTimer = window.setTimeout(() => {
          void this.openSocket();
        }, delay);
      } else {
        this.callbacks.onConnectionChange('disconnected');
      }
    };

    ws.onerror = () => {
      // handled cleanly in onclose
    };
  }

  public sendPlayerUpdate(payload: {
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
    vehicleKind: VehicleKind | null;
    currentBuilding: string | null;
    currentFloor: number;
    currentActivity: string;
    avatar: CharacterCustomization;
  }): void {
    this.avatar = payload.avatar;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientWsMessage = {
      type: 'player:update',
      ...payload,
    };
    this.ws.send(JSON.stringify(msg));
  }

  public sendElevatorAction(payload: {
    buildingId: string;
    elevatorId: string;
    action: 'call' | 'select';
    floor: number;
  }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientWsMessage = {
      type: 'elevator:action',
      ...payload,
    };
    this.ws.send(JSON.stringify(msg));
  }

  public sendChatMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'social:chat', text } satisfies ClientWsMessage));
  }

  public sendGroupAction(
    action: 'create' | 'join' | 'leave',
    groupId?: string,
    name?: string,
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({ type: 'group:action', action, groupId, name } satisfies ClientWsMessage),
    );
  }

  public sendSocialEmote(targetPlayerId: string, emote: EmoteKind): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'social:emote_greet',
        targetPlayerId,
        emote,
      } satisfies ClientWsMessage),
    );
  }

  public sendSocialReport(targetPlayerId: string, reason: string, messageExcerpt?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'social:report',
        targetPlayerId,
        reason,
        messageExcerpt,
      } satisfies ClientWsMessage),
    );
  }

  public disconnect(): void {
    this.closedManually = true;
    this.clearTimers();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'session:leave' } satisfies ClientWsMessage));
      } catch {
        // ignore
      }
    }
    this.ws?.close();
    this.ws = null;
    this.callbacks.onConnectionChange('disconnected');
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
