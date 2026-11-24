import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildChallengeSessionState, DEFAULT_CHALLENGE_SETTINGS, type PlayerChallengeMetrics } from '../game/challengeSystem';
import type { CharacterAnimState, EmoteKind } from '../game/characterAnimator';
import {
  callElevatorToFloor,
  createElevatorRuntimeState,
  selectElevatorFloor,
  stepElevatorRuntime,
  type ElevatorRuntimeState,
} from '../game/elevatorSystem';
import type {
  ChallengeSessionState,
  ChatMessageRecord,
  ElevatorSyncPayload,
  KpTransactionRecord,
  ModerationReportRecord,
  MultiplayerSessionRecord,
  MultiplayerSessionSnapshot,
  PlayerAccountProfile,
  PlayerConnectionStatus,
  PlayerMovementState,
  RemotePlayerState,
  SessionStatus,
  SocialGroupSnapshot,
  StudentProgressRecord,
  TeacherPinStatus,
} from '../game/multiplayerTypes';
import { createInitialProgressionState } from '../game/progressionSystem';
import {
  createInitialPlayerQuizProgress,
  createSeedQuestionDatabase,
  evaluatePlayerSubmission,
  toPublicQuestionDatabase,
} from '../game/questionBank';
import type {
  AnswerKey,
  PlayerQuizProgress,
  PlayerSubmissionOutcome,
  PublicQuestionDatabase,
  QuestionDatabase,
} from '../game/questionTypes';
import {
  applyShopItemToCustomization,
  createDefaultCharacterCustomization,
  evaluateEarnedBadges,
  getEffectiveShopCatalog,
  normalizeCharacterCustomization,
  REWARD_SHOP_CATALOG,
  STARTER_OWNED_ITEM_IDS,
  type RewardShopItem,
} from '../game/rewardShopCatalog';
import {
  createSocialGroup,
  DEFAULT_SOCIAL_CONFIG,
  joinSocialGroup,
  leaveSocialGroup,
  validateAndFilterChatMessage,
} from '../game/socialSystem';
import type { CharacterCustomization, InteriorElevatorFloor, VehicleKind } from '../game/types';

export const BOOTSTRAPPED_TEACHER_EMAIL = 'samuelhardy7@gmail.com';

export function validatePinFormat(pin: string): string | null {
  if (typeof pin !== 'string') return 'PIN must be a string.';
  const trimmed = pin.trim();
  if (!/^\d{6,12}$/.test(trimmed)) {
    return 'PIN must be 6 to 12 numeric digits.';
  }
  return null;
}

export function hashPin(pin: string, saltHex?: string): string {
  const err = validatePinFormat(pin);
  if (err) {
    throw new Error(err);
  }
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin.trim(), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(pin.trim(), salt, 64);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

interface RateAttemptEntry {
  failures: number;
  lockedUntil: number;
}

export class PinRateLimiter {
  private attempts = new Map<string, RateAttemptEntry>();
  private readonly maxAttempts: number;
  private readonly lockoutMs: number;

  constructor(maxAttempts = 5, lockoutMs = 60_000) {
    this.maxAttempts = maxAttempts;
    this.lockoutMs = lockoutMs;
  }

  public getStatus(key: string, pinConfigured: boolean, now = Date.now()): TeacherPinStatus {
    const entry = this.attempts.get(key);
    if (!entry) {
      return {
        pinConfigured,
        locked: false,
        retryAfterSeconds: 0,
        remainingAttempts: this.maxAttempts,
      };
    }
    if (entry.lockedUntil > now) {
      return {
        pinConfigured,
        locked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
        remainingAttempts: 0,
      };
    }
    if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
      this.attempts.delete(key);
      return {
        pinConfigured,
        locked: false,
        retryAfterSeconds: 0,
        remainingAttempts: this.maxAttempts,
      };
    }
    return {
      pinConfigured,
      locked: false,
      retryAfterSeconds: 0,
      remainingAttempts: Math.max(0, this.maxAttempts - entry.failures),
    };
  }

  public recordFailure(key: string, pinConfigured: boolean, now = Date.now()): TeacherPinStatus {
    const current = this.attempts.get(key);
    const failures = current && current.lockedUntil <= now ? current.failures + 1 : 1;
    const locked = failures >= this.maxAttempts;
    const lockedUntil = locked ? now + this.lockoutMs : 0;
    this.attempts.set(key, { failures, lockedUntil });
    return this.getStatus(key, pinConfigured, now);
  }

  public recordSuccess(key: string): void {
    this.attempts.delete(key);
  }
}

export interface TeacherTokenPayload {
  uid: string;
  email: string;
  exp: number;
}

export class TeacherTokenManager {
  private readonly secret: Buffer;
  private readonly ttlMs: number;

  constructor(secretHex?: string, ttlMs = 4 * 60 * 60 * 1000) {
    this.secret =
      secretHex && secretHex.length >= 16
        ? Buffer.from(secretHex, 'utf8')
        : crypto.randomBytes(32);
    this.ttlMs = ttlMs;
  }

  public issue(uid: string, email: string, now = Date.now()): { token: string; expiresAt: number } {
    const expiresAt = now + this.ttlMs;
    const payload: TeacherTokenPayload = {
      uid,
      email: email.toLowerCase(),
      exp: expiresAt,
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(encoded).digest('base64url');
    return { token: `${encoded}.${sig}`, expiresAt };
  }

  public verify(token: string, expectedUid?: string, now = Date.now()): TeacherTokenPayload | null {
    if (!token || !token.includes('.')) return null;
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    try {
      const expectedSig = crypto
        .createHmac('sha256', this.secret)
        .update(encoded)
        .digest('base64url');
      const sigBuf = Buffer.from(sig, 'utf8');
      const expectedBuf = Buffer.from(expectedSig, 'utf8');
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
      }
      const parsed = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as TeacherTokenPayload;
      if (!parsed.uid || !parsed.email || typeof parsed.exp !== 'number') return null;
      if (parsed.exp <= now) return null;
      if (expectedUid && parsed.uid !== expectedUid) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

export interface CreateSessionInput {
  name: string;
  subject: string;
  questionSetId: string;
  maxPlayers?: number;
  durationMinutes?: number;
  objectives?: string;
  joinCode?: string;
}

export interface SessionJoinOutcome {
  ok: boolean;
  code?: 'SESSION_NOT_FOUND' | 'SESSION_ENDED' | 'SESSION_FULL';
  message?: string;
  snapshot?: MultiplayerSessionSnapshot;
}

interface PersistedServerState {
  pinHash: string | null;
  teacherEmails: string[];
  questionDb: QuestionDatabase;
  progressByPlayer: Record<string, PlayerQuizProgress>;
  displayNamesByPlayer: Record<string, string>;
  sessions: MultiplayerSessionRecord[];
  participantsBySession: Record<string, Record<string, RemotePlayerState>>;
  profilesByPlayer?: Record<string, PlayerAccountProfile>;
  processedQuizTxByPlayer?: Record<
    string,
    Record<string, { outcome: PlayerSubmissionOutcome; progress: PlayerQuizProgress }>
  >;
  processedShopTxByPlayer?: Record<
    string,
    Record<string, { transaction: KpTransactionRecord; itemId: string }>
  >;
  groupsBySession?: Record<string, SocialGroupSnapshot[]>;
  chatBySession?: Record<string, ChatMessageRecord[]>;
  moderationReports?: ModerationReportRecord[];
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

interface SessionElevatorEntry {
  buildingId: string;
  floors: InteriorElevatorFloor[];
  runtime: ElevatorRuntimeState;
}

const CITY_TOWER_FLOOR_COUNT = 22;
const CITY_TOWER_FLOOR_HEIGHT = 3.6;

function buildServerElevatorSpecs(
  buildingId: string,
  elevatorId: string,
): { floors: InteriorElevatorFloor[] } {
  if (buildingId === 'freedom_tower' || elevatorId === 'city_tower_elev') {
    const floors: InteriorElevatorFloor[] = [];
    for (let f = 1; f <= CITY_TOWER_FLOOR_COUNT; f++) {
      floors.push({
        floorNumber: f,
        y: Number(((f - 1) * CITY_TOWER_FLOOR_HEIGHT).toFixed(2)),
        label: f === 22 ? 'Floor 22 · Rooftop' : f === 1 ? 'Floor 1 · Lobby' : `Floor ${f}`,
        exitX: -1.8,
        exitZ: -3.9,
        exitYaw: Math.PI,
      });
    }
    return { floors };
  }
  const floors: InteriorElevatorFloor[] = [
    { floorNumber: 1, y: 0, label: 'Floor 1 · Lobby', exitX: 1.5, exitZ: -3.5, exitYaw: Math.PI },
    { floorNumber: 2, y: 3.6, label: 'Floor 2', exitX: 1.5, exitZ: -3.5, exitYaw: Math.PI },
    { floorNumber: 3, y: 7.2, label: 'Floor 3', exitX: 1.5, exitZ: -3.5, exitYaw: Math.PI },
  ];
  return { floors };
}

export function validatePlayerTransformUpdate(
  prev: RemotePlayerState,
  nextPos: { x: number; y: number; z: number },
  nextBuilding: string | null,
  nextVehicle: VehicleKind | null,
  dtSec: number,
): { x: number; y: number; z: number; clamped: boolean } {
  const safeX = Number.isFinite(nextPos.x) ? Math.max(-140, Math.min(140, nextPos.x)) : prev.position.x;
  const safeY = Number.isFinite(nextPos.y) ? Math.max(-5, Math.min(95, nextPos.y)) : prev.position.y;
  const safeZ = Number.isFinite(nextPos.z) ? Math.max(-140, Math.min(140, nextPos.z)) : prev.position.z;

  // Switching between exterior city and building interior legitimately swaps coordinate space
  if (prev.currentBuilding !== nextBuilding) {
    return { x: safeX, y: safeY, z: safeZ, clamped: false };
  }

  const effectiveDt = Math.max(0.05, Math.min(2.5, dtSec));
  const maxHorizSpeed = nextVehicle ? 46 : 16; // m/s (with generous latency margin)
  const maxHorizDist = maxHorizSpeed * effectiveDt + 3.2;

  const dx = safeX - prev.position.x;
  const dz = safeZ - prev.position.z;
  const horizDist = Math.hypot(dx, dz);

  const dy = safeY - prev.position.y;
  const maxVertDist = 14 * effectiveDt + 2.8;
  const clampedY =
    Math.abs(dy) > maxVertDist
      ? prev.position.y + Math.sign(dy) * maxVertDist
      : safeY;

  if (horizDist > maxHorizDist) {
    const scale = maxHorizDist / horizDist;
    return {
      x: prev.position.x + dx * scale,
      y: clampedY,
      z: prev.position.z + dz * scale,
      clamped: true,
    };
  }

  return {
    x: safeX,
    y: clampedY,
    z: safeZ,
    clamped: Math.abs(dy) > maxVertDist,
  };
}

export class GameBackendStore {
  private readonly persistPath: string | null;
  private pinHash: string | null;
  private teacherEmails: Set<string>;
  private questionDb: QuestionDatabase;
  private progressByPlayer = new Map<string, PlayerQuizProgress>();
  private displayNamesByPlayer = new Map<string, string>();
  private sessions = new Map<string, MultiplayerSessionRecord>();
  private participantsBySession = new Map<string, Map<string, RemotePlayerState>>();
  private elevatorsBySession = new Map<string, Map<string, SessionElevatorEntry>>();
  private profilesByPlayer = new Map<string, PlayerAccountProfile>();
  private processedQuizTxByPlayer = new Map<
    string,
    Map<string, { outcome: PlayerSubmissionOutcome; progress: PlayerQuizProgress }>
  >();
  private processedShopTxByPlayer = new Map<
    string,
    Map<string, { transaction: KpTransactionRecord; itemId: string }>
  >();
  private groupsBySession = new Map<string, SocialGroupSnapshot[]>();
  private chatBySession = new Map<string, ChatMessageRecord[]>();
  private lastChatMsByPlayer = new Map<string, number>();
  private moderationReports: ModerationReportRecord[] = [];

  constructor(options?: { persistPath?: string | null; envPinHash?: string }) {
    this.persistPath = options?.persistPath ?? null;
    this.pinHash = options?.envPinHash?.includes(':') ? options.envPinHash : null;
    this.teacherEmails = new Set([BOOTSTRAPPED_TEACHER_EMAIL]);
    this.questionDb = createSeedQuestionDatabase();
    this.loadFromDisk();
    if (options?.envPinHash?.includes(':') && !this.pinHash) {
      this.pinHash = options.envPinHash;
    }
  }

  private loadFromDisk(): void {
    if (!this.persistPath) return;
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedServerState>;
      if (parsed.pinHash && parsed.pinHash.includes(':')) {
        this.pinHash = parsed.pinHash;
      }
      if (Array.isArray(parsed.teacherEmails)) {
        for (const e of parsed.teacherEmails) {
          if (typeof e === 'string' && e.trim()) {
            this.teacherEmails.add(e.trim().toLowerCase());
          }
        }
      }
      if (parsed.questionDb && Array.isArray(parsed.questionDb.questions)) {
        this.questionDb = parsed.questionDb;
      }
      if (parsed.progressByPlayer) {
        for (const [k, v] of Object.entries(parsed.progressByPlayer)) {
          this.progressByPlayer.set(k, v);
        }
      }
      if (parsed.displayNamesByPlayer) {
        for (const [k, v] of Object.entries(parsed.displayNamesByPlayer)) {
          this.displayNamesByPlayer.set(k, v);
        }
      }
      if (Array.isArray(parsed.sessions)) {
        for (const s of parsed.sessions) {
          this.sessions.set(s.id, s);
          this.participantsBySession.set(s.id, new Map());
        }
      }
      if (parsed.participantsBySession) {
        for (const [sid, roster] of Object.entries(parsed.participantsBySession)) {
          const map = new Map<string, RemotePlayerState>();
          for (const [pid, p] of Object.entries(roster)) {
            map.set(pid, { ...p, connectionStatus: 'offline' });
          }
          this.participantsBySession.set(sid, map);
        }
      }
      if (parsed.profilesByPlayer) {
        for (const [uid, prof] of Object.entries(parsed.profilesByPlayer)) {
          const normCust = normalizeCharacterCustomization(prof.customization);
          const ownedSet = new Set<string>([
            ...STARTER_OWNED_ITEM_IDS,
            ...(Array.isArray(prof.ownedItemIds) ? prof.ownedItemIds : []),
            ...(normCust.ownedItemIds || []),
          ]);
          normCust.ownedItemIds = [...ownedSet];
          this.profilesByPlayer.set(uid, {
            ...prof,
            knowledgePoints: Math.max(0, Math.round(prof.knowledgePoints || 0)),
            lifetimeKpEarned: Math.max(0, Math.round(prof.lifetimeKpEarned || 0)),
            ownedItemIds: [...ownedSet],
            customization: normCust,
            unlockedBadges: Array.isArray(prof.unlockedBadges) ? prof.unlockedBadges : [],
            visitedBuildings: Array.isArray(prof.visitedBuildings) ? prof.visitedBuildings : [],
            towerMaxFloor: Math.max(1, Math.round(prof.towerMaxFloor || 1)),
            recentTransactions: Array.isArray(prof.recentTransactions) ? prof.recentTransactions : [],
          });
        }
      }
      if (parsed.processedQuizTxByPlayer) {
        for (const [uid, txMap] of Object.entries(parsed.processedQuizTxByPlayer)) {
          this.processedQuizTxByPlayer.set(uid, new Map(Object.entries(txMap)));
        }
      }
      if (parsed.processedShopTxByPlayer) {
        for (const [uid, txMap] of Object.entries(parsed.processedShopTxByPlayer)) {
          this.processedShopTxByPlayer.set(uid, new Map(Object.entries(txMap)));
        }
      }
      if (parsed.groupsBySession) {
        for (const [sid, grps] of Object.entries(parsed.groupsBySession)) {
          this.groupsBySession.set(sid, Array.isArray(grps) ? grps : []);
        }
      }
      if (parsed.chatBySession) {
        for (const [sid, msgs] of Object.entries(parsed.chatBySession)) {
          this.chatBySession.set(sid, Array.isArray(msgs) ? msgs : []);
        }
      }
      if (Array.isArray(parsed.moderationReports)) {
        this.moderationReports = parsed.moderationReports;
      }
    } catch {
      // Fallback safely to initialized defaults
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const participantsObj: Record<string, Record<string, RemotePlayerState>> = {};
      for (const [sid, map] of this.participantsBySession.entries()) {
        participantsObj[sid] = Object.fromEntries(map.entries());
      }
      const quizTxObj: Record<
        string,
        Record<string, { outcome: PlayerSubmissionOutcome; progress: PlayerQuizProgress }>
      > = {};
      for (const [uid, map] of this.processedQuizTxByPlayer.entries()) {
        quizTxObj[uid] = Object.fromEntries(map.entries());
      }
      const shopTxObj: Record<
        string,
        Record<string, { transaction: KpTransactionRecord; itemId: string }>
      > = {};
      for (const [uid, map] of this.processedShopTxByPlayer.entries()) {
        shopTxObj[uid] = Object.fromEntries(map.entries());
      }
      const payload: PersistedServerState = {
        pinHash: this.pinHash,
        teacherEmails: [...this.teacherEmails],
        questionDb: this.questionDb,
        progressByPlayer: Object.fromEntries(this.progressByPlayer.entries()),
        displayNamesByPlayer: Object.fromEntries(this.displayNamesByPlayer.entries()),
        sessions: [...this.sessions.values()],
        participantsBySession: participantsObj,
        profilesByPlayer: Object.fromEntries(this.profilesByPlayer.entries()),
        processedQuizTxByPlayer: quizTxObj,
        processedShopTxByPlayer: shopTxObj,
        groupsBySession: Object.fromEntries(this.groupsBySession.entries()),
        chatBySession: Object.fromEntries(this.chatBySession.entries()),
        moderationReports: this.moderationReports.slice(-200),
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(payload), 'utf8');
    } catch {
      // Non-fatal in read-only environments
    }
  }

  // --- Teacher Role & PIN Security ---
  public isTeacherEmail(email: string | undefined | null): boolean {
    if (!email) return false;
    return this.teacherEmails.has(email.trim().toLowerCase());
  }

  public getTeacherEmails(): string[] {
    return [...this.teacherEmails];
  }

  public addTeacherEmail(email: string): string[] {
    const clean = email.trim().toLowerCase();
    if (clean && clean.includes('@')) {
      this.teacherEmails.add(clean);
      this.saveToDisk();
    }
    return this.getTeacherEmails();
  }

  public removeTeacherEmail(email: string): { ok: boolean; emails: string[]; error?: string } {
    const clean = email.trim().toLowerCase();
    if (clean === BOOTSTRAPPED_TEACHER_EMAIL) {
      return {
        ok: false,
        emails: this.getTeacherEmails(),
        error: 'Primary teacher account cannot be removed.',
      };
    }
    this.teacherEmails.delete(clean);
    this.saveToDisk();
    return { ok: true, emails: this.getTeacherEmails() };
  }

  public isPinConfigured(): boolean {
    return Boolean(this.pinHash && this.pinHash.includes(':'));
  }

  public setupInitialPin(newPin: string): { ok: boolean; error?: string } {
    if (this.isPinConfigured()) {
      return { ok: false, error: 'Teacher PIN is already configured.' };
    }
    const fmtErr = validatePinFormat(newPin);
    if (fmtErr) return { ok: false, error: fmtErr };
    this.pinHash = hashPin(newPin);
    this.saveToDisk();
    return { ok: true };
  }

  public verifyPin(pin: string): boolean {
    if (!this.pinHash) return false;
    return verifyPinHash(pin, this.pinHash);
  }

  public changePin(currentPin: string, newPin: string): { ok: boolean; error?: string } {
    if (!this.isPinConfigured()) {
      return { ok: false, error: 'PIN has not been set up yet.' };
    }
    if (!this.verifyPin(currentPin)) {
      return { ok: false, error: 'Current PIN is incorrect.' };
    }
    const fmtErr = validatePinFormat(newPin);
    if (fmtErr) return { ok: false, error: fmtErr };
    if (currentPin.trim() === newPin.trim()) {
      return { ok: false, error: 'New PIN must differ from the current PIN.' };
    }
    this.pinHash = hashPin(newPin);
    this.saveToDisk();
    return { ok: true };
  }

  // --- Authoritative Question Bank ---
  public getFullDatabase(): QuestionDatabase {
    return this.questionDb;
  }

  public getPublicDatabase(): PublicQuestionDatabase {
    return toPublicQuestionDatabase(this.questionDb);
  }

  public replaceQuestionDatabase(nextDb: QuestionDatabase): QuestionDatabase {
    const normalizedQuestions = nextDb.questions.map((q) => ({
      ...q,
      status: q.status || 'active',
    }));
    this.questionDb = {
      ...nextDb,
      questions: normalizedQuestions,
    };
    this.saveToDisk();
    return this.questionDb;
  }

  public resetQuestionDatabase(): QuestionDatabase {
    this.questionDb = createSeedQuestionDatabase();
    this.saveToDisk();
    return this.questionDb;
  }

  public getPlayerProgress(playerKey: string): PlayerQuizProgress {
    return this.progressByPlayer.get(playerKey) || createInitialPlayerQuizProgress();
  }

  public registerDisplayName(playerKey: string, displayName: string): void {
    if (displayName.trim()) {
      this.displayNamesByPlayer.set(playerKey, displayName.trim());
    }
  }

  public getOrCreatePlayerProfile(playerKey: string, displayName?: string): PlayerAccountProfile {
    const cleanName = displayName?.trim();
    if (cleanName) {
      this.displayNamesByPlayer.set(playerKey, cleanName);
    }
    const quizProg = this.getPlayerProgress(playerKey);
    let existing = this.profilesByPlayer.get(playerKey);
    if (!existing) {
      const cust = createDefaultCharacterCustomization();
      existing = {
        uid: playerKey,
        displayName: cleanName || this.displayNamesByPlayer.get(playerKey) || 'Explorer',
        knowledgePoints: Math.max(0, quizProg.earnedPoints),
        lifetimeKpEarned: Math.max(0, quizProg.earnedPoints),
        completedQuestionIds: [...quizProg.completedQuestionIds],
        lockedQuestionIds: [...quizProg.lockedQuestionIds],
        ownedItemIds: [...STARTER_OWNED_ITEM_IDS],
        unlockedBadges: evaluateEarnedBadges({
          lifetimeKpEarned: quizProg.earnedPoints,
          completedQuestionsCount: quizProg.completedQuestionIds.length,
          towerMaxFloor: 1,
          ownedItemIds: STARTER_OWNED_ITEM_IDS,
        }),
        visitedBuildings: [],
        towerMaxFloor: 1,
        customization: cust,
        recentTransactions: [],
        updatedAt: Date.now(),
      };
      this.profilesByPlayer.set(playerKey, existing);
      this.saveToDisk();
      return existing;
    }

    if (cleanName && existing.displayName !== cleanName) {
      existing.displayName = cleanName;
    }
    existing.completedQuestionIds = [...quizProg.completedQuestionIds];
    existing.lockedQuestionIds = [...quizProg.lockedQuestionIds];
    return existing;
  }

  public getEffectiveShopCatalog(): RewardShopItem[] {
    return getEffectiveShopCatalog(this.questionDb.teacherConfig?.shopItemOverrides);
  }

  public submitQuizAnswer(params: {
    playerKey: string;
    displayName?: string;
    questionId: string;
    selectedAnswer: AnswerKey;
    sessionId?: string | null;
    txId?: string | null;
  }): {
    outcome: PlayerSubmissionOutcome;
    progress: PlayerQuizProgress;
    profile: PlayerAccountProfile;
    sessionSnapshot: MultiplayerSessionSnapshot | null;
  } {
    if (params.displayName) {
      this.registerDisplayName(params.playerKey, params.displayName);
    }
    const profile = this.getOrCreatePlayerProfile(params.playerKey, params.displayName);

    const cleanTxId = params.txId?.trim();
    if (cleanTxId) {
      const prevTx = this.processedQuizTxByPlayer.get(params.playerKey)?.get(cleanTxId);
      if (prevTx) {
        return {
          outcome: prevTx.outcome,
          progress: prevTx.progress,
          profile,
          sessionSnapshot: params.sessionId ? this.buildSessionSnapshot(params.sessionId) : null,
        };
      }
    }

    const current = this.getPlayerProgress(params.playerKey);
    const { nextProgress, outcome } = evaluatePlayerSubmission(
      this.questionDb,
      current,
      params.questionId,
      params.selectedAnswer,
    );
    this.progressByPlayer.set(params.playerKey, nextProgress);

    const now = Date.now();
    profile.completedQuestionIds = [...nextProgress.completedQuestionIds];
    profile.lockedQuestionIds = [...nextProgress.lockedQuestionIds];

    if (outcome.pointsAwarded > 0) {
      profile.knowledgePoints = Math.max(0, profile.knowledgePoints + outcome.pointsAwarded);
      profile.lifetimeKpEarned = Math.max(0, profile.lifetimeKpEarned + outcome.pointsAwarded);
      const txRecord: KpTransactionRecord = {
        txId: cleanTxId || `quiz_${params.questionId}_${now}`,
        kind: 'earn_question',
        amount: outcome.pointsAwarded,
        balanceAfter: profile.knowledgePoints,
        refId: params.questionId,
        description: `Answered ${params.questionId} (+${outcome.pointsAwarded} KP)`,
        createdAt: now,
      };
      profile.recentTransactions = [txRecord, ...profile.recentTransactions].slice(0, 40);
      profile.unlockedBadges = evaluateEarnedBadges({
        lifetimeKpEarned: profile.lifetimeKpEarned,
        completedQuestionsCount: profile.completedQuestionIds.length,
        towerMaxFloor: profile.towerMaxFloor,
        ownedItemIds: profile.ownedItemIds,
      });
      profile.updatedAt = now;
    }

    if (cleanTxId) {
      let txMap = this.processedQuizTxByPlayer.get(params.playerKey);
      if (!txMap) {
        txMap = new Map();
        this.processedQuizTxByPlayer.set(params.playerKey, txMap);
      }
      txMap.set(cleanTxId, { outcome, progress: nextProgress });
    }

    let sessionSnapshot: MultiplayerSessionSnapshot | null = null;
    if (params.sessionId) {
      const roster = this.participantsBySession.get(params.sessionId);
      const participant = roster?.get(params.playerKey);
      if (participant && outcome.pointsAwarded > 0) {
        participant.questionsCompleted += 1;
        participant.pointsEarned += outcome.pointsAwarded;
        participant.updatedAt = now;
        sessionSnapshot = this.buildSessionSnapshot(params.sessionId, now);
      }
    }

    this.saveToDisk();
    return {
      outcome,
      progress: nextProgress,
      profile,
      sessionSnapshot,
    };
  }

  public purchaseShopItem(params: {
    uid: string;
    displayName?: string;
    itemId: string;
    txId?: string | null;
    equipImmediately?: boolean;
  }): {
    ok: boolean;
    error?: string;
    profile: PlayerAccountProfile;
    item?: RewardShopItem;
    transaction?: KpTransactionRecord;
    alreadyProcessed?: boolean;
  } {
    const profile = this.getOrCreatePlayerProfile(params.uid, params.displayName);
    const catalog = this.getEffectiveShopCatalog();
    const item = catalog.find((i) => i.id === params.itemId);
    if (!item || !item.enabled) {
      return {
        ok: false,
        error: 'This reward item is currently unavailable in the shop.',
        profile,
      };
    }

    const cleanTxId = params.txId?.trim();
    if (cleanTxId) {
      const existingTx = this.processedShopTxByPlayer.get(params.uid)?.get(cleanTxId);
      if (existingTx) {
        return {
          ok: true,
          profile,
          item,
          transaction: existingTx.transaction,
          alreadyProcessed: true,
        };
      }
    }

    if (profile.ownedItemIds.includes(item.id)) {
      return {
        ok: false,
        error: 'You already own this item. Equip it from your Inventory tab!',
        profile,
        item,
      };
    }

    const priceKp = Math.max(0, Math.round(item.priceKp));
    if (profile.knowledgePoints < priceKp) {
      return {
        ok: false,
        error: `Not enough Knowledge Points (${profile.knowledgePoints}/${priceKp} KP).`,
        profile,
        item,
      };
    }

    const now = Date.now();
    profile.knowledgePoints = Math.max(0, profile.knowledgePoints - priceKp);
    const ownedSet = new Set(profile.ownedItemIds);
    ownedSet.add(item.id);
    profile.ownedItemIds = [...ownedSet];

    if (params.equipImmediately !== false) {
      profile.customization = applyShopItemToCustomization(profile.customization, item);
    } else {
      profile.customization = {
        ...profile.customization,
        ownedItemIds: [...ownedSet],
      };
    }

    profile.unlockedBadges = evaluateEarnedBadges({
      lifetimeKpEarned: profile.lifetimeKpEarned,
      completedQuestionsCount: profile.completedQuestionIds.length,
      towerMaxFloor: profile.towerMaxFloor,
      ownedItemIds: profile.ownedItemIds,
    });

    const transaction: KpTransactionRecord = {
      txId: cleanTxId || `shop_${item.id}_${now}`,
      kind: 'spend_shop',
      amount: -priceKp,
      balanceAfter: profile.knowledgePoints,
      refId: item.id,
      description: `Purchased ${item.name} (-${priceKp} KP)`,
      createdAt: now,
    };
    profile.recentTransactions = [transaction, ...profile.recentTransactions].slice(0, 40);
    profile.updatedAt = now;

    if (cleanTxId) {
      let txMap = this.processedShopTxByPlayer.get(params.uid);
      if (!txMap) {
        txMap = new Map();
        this.processedShopTxByPlayer.set(params.uid, txMap);
      }
      txMap.set(cleanTxId, { transaction, itemId: item.id });
    }

    this.syncCustomizationToActiveSessions(params.uid, profile.customization, now);
    this.saveToDisk();
    return {
      ok: true,
      profile,
      item,
      transaction,
    };
  }

  public equipOwnedCustomization(params: {
    uid: string;
    displayName?: string;
    itemId?: string;
    patch?: Partial<CharacterCustomization>;
  }): { ok: boolean; error?: string; profile: PlayerAccountProfile } {
    const profile = this.getOrCreatePlayerProfile(params.uid, params.displayName);
    const ownedSet = new Set([...STARTER_OWNED_ITEM_IDS, ...profile.ownedItemIds]);

    if (params.itemId) {
      const item = REWARD_SHOP_CATALOG.find((i) => i.id === params.itemId);
      if (!item) {
        return { ok: false, error: 'Unknown reward item.', profile };
      }
      if (!ownedSet.has(item.id)) {
        return { ok: false, error: 'You do not own this item yet.', profile };
      }
      profile.customization = applyShopItemToCustomization(profile.customization, item);
      profile.updatedAt = Date.now();
      this.syncCustomizationToActiveSessions(params.uid, profile.customization, profile.updatedAt);
      this.saveToDisk();
      return { ok: true, profile };
    }

    const patch = params.patch || {};
    const slotFields: Array<keyof CharacterCustomization> = [
      'characterPresetId',
      'bodyType',
      'hairStyle',
      'faceStyle',
      'topStyle',
      'pantsStyle',
      'shoeStyle',
      'hatId',
      'glassesId',
      'watchId',
      'backpackId',
      'neckId',
    ];

    // Enforce server ownership on every non-starter customization slot
    for (const field of slotFields) {
      const requestedVal = patch[field];
      if (requestedVal === undefined) continue;
      if (requestedVal === 'none') continue;
      const defaultCust = createDefaultCharacterCustomization();
      if (requestedVal === defaultCust[field]) continue;
      const unlockedByOwned = REWARD_SHOP_CATALOG.some(
        (item) => ownedSet.has(item.id) && item.patch[field] === requestedVal,
      );
      if (!unlockedByOwned) {
        return {
          ok: false,
          error: `Item for "${String(field)}" must be unlocked in the Reward Shop first.`,
          profile,
        };
      }
    }

    const safeNext = normalizeCharacterCustomization({
      ...profile.customization,
      ...patch,
      ownedItemIds: [...ownedSet],
    });
    profile.customization = safeNext;
    profile.updatedAt = Date.now();
    this.syncCustomizationToActiveSessions(params.uid, profile.customization, profile.updatedAt);
    this.saveToDisk();
    return { ok: true, profile };
  }

  private syncCustomizationToActiveSessions(
    uid: string,
    customization: CharacterCustomization,
    now: number,
  ): void {
    for (const roster of this.participantsBySession.values()) {
      const p = roster.get(uid);
      if (p) {
        p.avatar = customization;
        p.updatedAt = now;
      }
    }
  }

  public recordPlayerExplorationProgress(
    uid: string,
    displayName: string | undefined,
    update: { visitedBuildingId?: string | null; towerFloor?: number | null },
  ): PlayerAccountProfile {
    const profile = this.getOrCreatePlayerProfile(uid, displayName);
    let changed = false;
    if (update.visitedBuildingId && !profile.visitedBuildings.includes(update.visitedBuildingId)) {
      profile.visitedBuildings = [...profile.visitedBuildings, update.visitedBuildingId].slice(-60);
      changed = true;
    }
    if (
      typeof update.towerFloor === 'number' &&
      Number.isFinite(update.towerFloor) &&
      update.towerFloor > profile.towerMaxFloor
    ) {
      profile.towerMaxFloor = Math.min(22, Math.max(1, Math.round(update.towerFloor)));
      changed = true;
    }
    if (changed) {
      profile.unlockedBadges = evaluateEarnedBadges({
        lifetimeKpEarned: profile.lifetimeKpEarned,
        completedQuestionsCount: profile.completedQuestionIds.length,
        towerMaxFloor: profile.towerMaxFloor,
        ownedItemIds: profile.ownedItemIds,
      });
      profile.updatedAt = Date.now();
      this.saveToDisk();
    }
    return profile;
  }

  // --- Multiplayer Sessions ---
  public computeRemainingSeconds(session: MultiplayerSessionRecord, now = Date.now()): number {
    const totalMs = session.durationMinutes * 60 * 1000;
    if (session.status === 'waiting') {
      return Math.round(totalMs / 1000);
    }
    if (session.status === 'ended') {
      return 0;
    }
    if (!session.startedAt) {
      return session.remainingSeconds;
    }
    const effectiveNow =
      session.status === 'paused' && session.pausedAt ? session.pausedAt : now;
    const elapsedMs = Math.max(0, effectiveNow - session.startedAt - session.accumulatedPauseMs);
    const remaining = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
    return remaining;
  }

  public createSession(
    teacherUid: string,
    input: CreateSessionInput,
    now = Date.now(),
  ): MultiplayerSessionRecord {
    const existingCodes = new Set(
      [...this.sessions.values()].map((s) => s.joinCode.toUpperCase()),
    );
    let joinCode = (input.joinCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (joinCode.length < 4 || existingCodes.has(joinCode)) {
      do {
        joinCode = generateJoinCode();
      } while (existingCodes.has(joinCode));
    }

    const durationMinutes = Math.max(1, Math.min(240, Math.round(input.durationMinutes ?? 20)));
    const maxPlayers = Math.max(2, Math.min(50, Math.round(input.maxPlayers ?? 12)));
    const id = `sess_${now.toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    const session: MultiplayerSessionRecord = {
      id,
      name: (input.name || 'Urban Exploration Session').trim().slice(0, 100),
      subject: (input.subject || 'All Subjects').trim().slice(0, 80),
      questionSetId: input.questionSetId || this.questionDb.questionSets[0]?.id || 'set_city_core',
      joinCode,
      maxPlayers,
      durationMinutes,
      objectives:
        (input.objectives || '').trim().slice(0, 360) ||
        'Explore all districts, enter buildings, and solve study terminals!',
      status: 'waiting',
      teacherUid,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      pausedAt: null,
      accumulatedPauseMs: 0,
      remainingSeconds: durationMinutes * 60,
    };

    this.sessions.set(id, session);
    this.participantsBySession.set(id, new Map());
    this.saveToDisk();
    return session;
  }

  public setSessionStatus(
    sessionId: string,
    nextStatus: SessionStatus,
    now = Date.now(),
  ): MultiplayerSessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.status === 'waiting' && nextStatus === 'active') {
      session.startedAt = now;
      session.pausedAt = null;
      session.accumulatedPauseMs = 0;
    } else if (session.status === 'active' && nextStatus === 'paused') {
      session.pausedAt = now;
    } else if (session.status === 'paused' && nextStatus === 'active') {
      if (session.pausedAt) {
        session.accumulatedPauseMs += Math.max(0, now - session.pausedAt);
      }
      session.pausedAt = null;
    }

    session.status = nextStatus;
    session.updatedAt = now;
    session.remainingSeconds = this.computeRemainingSeconds(session, now);
    this.saveToDisk();
    return this.buildSessionSnapshot(sessionId, now);
  }

  public deleteSession(sessionId: string): boolean {
    const existed = this.sessions.delete(sessionId);
    this.participantsBySession.delete(sessionId);
    if (existed) this.saveToDisk();
    return existed;
  }

  public findSessionByJoinCode(joinCode: string): MultiplayerSessionRecord | null {
    const norm = joinCode.trim().toUpperCase();
    for (const s of this.sessions.values()) {
      if (s.joinCode.toUpperCase() === norm) {
        return s;
      }
    }
    return null;
  }

  public getSessionById(sessionId: string): MultiplayerSessionRecord | null {
    return this.sessions.get(sessionId) || null;
  }

  public buildSessionSnapshot(
    sessionId: string,
    now = Date.now(),
  ): MultiplayerSessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const remainingSeconds = this.computeRemainingSeconds(session, now);
    if (remainingSeconds === 0 && session.status === 'active') {
      session.status = 'ended';
      session.remainingSeconds = 0;
      session.updatedAt = now;
    } else {
      session.remainingSeconds = remainingSeconds;
    }

    const roster = this.participantsBySession.get(sessionId) || new Map();
    const players = [...roster.values()];
    const onlineCount = players.filter((p) => p.connectionStatus !== 'offline').length;
    const elevMap = this.elevatorsBySession.get(sessionId);
    const elevators: ElevatorSyncPayload[] = elevMap
      ? [...elevMap.values()].map((e) => ({
          buildingId: e.buildingId,
          elevatorId: e.runtime.elevatorId,
          currentY: Number(e.runtime.currentY.toFixed(3)),
          currentFloor: e.runtime.currentFloor,
          targetFloor: e.runtime.targetFloor,
          direction: e.runtime.direction,
          doorState: e.runtime.doorState,
          doorProgress: Number(e.runtime.doorProgress.toFixed(3)),
          moving: e.runtime.moving,
          updatedAt: e.runtime.lastUpdatedAt,
        }))
      : [];

    const groups = this.groupsBySession.get(sessionId) || [];
    const recentChat = (this.chatBySession.get(sessionId) || []).slice(-30);
    const challengeState = this.buildChallengeStateForSession(sessionId, remainingSeconds);

    return {
      session: { ...session },
      players,
      onlineCount,
      elevators,
      groups,
      recentChat,
      challengeState,
    };
  }

  public buildChallengeStateForSession(
    sessionId: string,
    remainingSecondsOverride?: number,
  ): ChallengeSessionState {
    const session = this.sessions.get(sessionId);
    const roster = this.participantsBySession.get(sessionId) || new Map();
    const players = [...roster.values()];
    const groups = this.groupsBySession.get(sessionId) || [];
    const metricsByUid: Record<string, Partial<PlayerChallengeMetrics>> = {};
    for (const p of players) {
      const prof = this.profilesByPlayer.get(p.playerId);
      metricsByUid[p.playerId] = {
        kpEarned: p.pointsEarned,
        questionsCompleted: p.questionsCompleted,
        buildingsVisited: prof?.visitedBuildings.length ?? 0,
        towerMaxFloor: Math.max(p.currentFloor || 1, prof?.towerMaxFloor ?? 1),
      };
    }
    const remSec =
      typeof remainingSecondsOverride === 'number'
        ? remainingSecondsOverride
        : session
          ? this.computeRemainingSeconds(session)
          : 0;
    return buildChallengeSessionState(
      this.questionDb.teacherConfig?.challengeConfig || DEFAULT_CHALLENGE_SETTINGS,
      players,
      groups,
      metricsByUid,
      remSec,
    );
  }

  public postSessionChat(
    sessionId: string,
    senderUid: string,
    senderName: string,
    rawText: string,
    now = Date.now(),
  ): { ok: boolean; message?: ChatMessageRecord; error?: string } {
    if (!this.sessions.has(sessionId)) {
      return { ok: false, error: 'Session not found.' };
    }
    const socialCfg = this.questionDb.teacherConfig?.socialConfig || DEFAULT_SOCIAL_CONFIG;
    const lastMs = this.lastChatMsByPlayer.get(senderUid);
    const result = validateAndFilterChatMessage(rawText, lastMs, now, socialCfg);
    if (!result.allowed) {
      return { ok: false, error: result.error };
    }
    this.lastChatMsByPlayer.set(senderUid, now);
    const record: ChatMessageRecord = {
      id: `chat_${now.toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
      sessionId,
      senderPlayerId: senderUid,
      senderName: senderName.trim() || 'Explorer',
      text: result.text,
      redacted: result.redacted,
      createdAt: now,
    };
    const existing = this.chatBySession.get(sessionId) || [];
    const next = [...existing, record].slice(-60);
    this.chatBySession.set(sessionId, next);
    this.saveToDisk();
    return { ok: true, message: record };
  }

  public handleGroupAction(
    sessionId: string,
    playerId: string,
    action: 'create' | 'join' | 'leave',
    groupId?: string,
    name?: string,
    now = Date.now(),
  ): { ok: boolean; groups: SocialGroupSnapshot[]; error?: string } {
    const socialCfg = this.questionDb.teacherConfig?.socialConfig || DEFAULT_SOCIAL_CONFIG;
    if (!socialCfg.groupsEnabled && action !== 'leave') {
      return {
        ok: false,
        groups: this.groupsBySession.get(sessionId) || [],
        error: 'Exploration groups are disabled by the teacher.',
      };
    }
    const current = this.groupsBySession.get(sessionId) || [];
    let nextGroups = current;
    if (action === 'create') {
      const res = createSocialGroup(current, playerId, name || 'City Explorers', now);
      nextGroups = res.groups;
    } else if (action === 'join' && groupId) {
      const res = joinSocialGroup(current, playerId, groupId);
      if (!res.joined) {
        return { ok: false, groups: current, error: res.error };
      }
      nextGroups = res.groups;
    } else if (action === 'leave') {
      nextGroups = leaveSocialGroup(current, playerId);
    }

    this.groupsBySession.set(sessionId, nextGroups);

    // Sync group membership metadata onto session participants
    const roster = this.participantsBySession.get(sessionId);
    if (roster) {
      for (const p of roster.values()) {
        const g = nextGroups.find((grp) => grp.memberPlayerIds.includes(p.playerId)) || null;
        p.groupId = g ? g.id : null;
        p.groupName = g ? g.name : null;
      }
    }
    this.saveToDisk();
    return { ok: true, groups: nextGroups };
  }

  public recordModerationReport(params: {
    sessionId: string;
    reporterUid: string;
    reporterName: string;
    targetPlayerId: string;
    reason: string;
    messageExcerpt?: string;
    now?: number;
  }): ModerationReportRecord {
    const now = params.now ?? Date.now();
    const roster = this.participantsBySession.get(params.sessionId);
    const targetName =
      roster?.get(params.targetPlayerId)?.displayName ||
      this.displayNamesByPlayer.get(params.targetPlayerId) ||
      'Student';
    const record: ModerationReportRecord = {
      id: `rep_${now.toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
      sessionId: params.sessionId,
      reporterUid: params.reporterUid,
      reporterName: params.reporterName,
      targetPlayerId: params.targetPlayerId,
      targetName,
      reason: params.reason.trim().slice(0, 200) || 'Inappropriate behavior',
      messageExcerpt: params.messageExcerpt?.trim().slice(0, 180),
      createdAt: now,
    };
    this.moderationReports = [record, ...this.moderationReports].slice(0, 200);
    this.saveToDisk();
    return record;
  }

  public getModerationReports(): ModerationReportRecord[] {
    return [...this.moderationReports];
  }

  public listSessionSnapshots(now = Date.now()): MultiplayerSessionSnapshot[] {
    return [...this.sessions.keys()]
      .map((id) => this.buildSessionSnapshot(id, now))
      .filter((s): s is MultiplayerSessionSnapshot => s !== null)
      .sort((a, b) => b.session.createdAt - a.session.createdAt);
  }

  public joinSession(params: {
    joinCode: string;
    playerId: string;
    displayName: string;
    avatar?: CharacterCustomization;
    now?: number;
  }): SessionJoinOutcome {
    const now = params.now ?? Date.now();
    const session = this.findSessionByJoinCode(params.joinCode);
    if (!session) {
      return {
        ok: false,
        code: 'SESSION_NOT_FOUND',
        message: `No multiplayer session found with join code "${params.joinCode.toUpperCase()}".`,
      };
    }

    if (session.status === 'ended') {
      return {
        ok: false,
        code: 'SESSION_ENDED',
        message: 'This multiplayer session has already ended.',
      };
    }

    let roster = this.participantsBySession.get(session.id);
    if (!roster) {
      roster = new Map();
      this.participantsBySession.set(session.id, roster);
    }

    const existing = roster.get(params.playerId);
    const otherActiveCount = [...roster.values()].filter(
      (p) => p.playerId !== params.playerId && p.connectionStatus !== 'offline',
    ).length;

    if (!existing && otherActiveCount >= session.maxPlayers) {
      return {
        ok: false,
        code: 'SESSION_FULL',
        message: `Session is full (${session.maxPlayers}/${session.maxPlayers} students connected).`,
      };
    }

    this.registerDisplayName(params.playerId, params.displayName);
    const fallbackAvatar = createInitialProgressionState().customization;

    const participant: RemotePlayerState = existing
      ? {
          ...existing,
          displayName: params.displayName.trim() || existing.displayName,
          avatar: params.avatar || existing.avatar,
          connectionStatus: 'online',
          updatedAt: now,
        }
      : {
          playerId: params.playerId,
          displayName: params.displayName.trim() || 'Student',
          avatar: params.avatar || fallbackAvatar,
          position: { x: 0, y: 0, z: 16 },
          rotation: { yaw: 0 },
          movementState: 'idle',
          vehicleKind: null,
          currentBuilding: null,
          currentFloor: 1,
          currentActivity: 'Exploring City',
          connectionStatus: 'online',
          questionsCompleted: 0,
          pointsEarned: 0,
          updatedAt: now,
        };

    roster.set(params.playerId, participant);
    this.saveToDisk();

    return {
      ok: true,
      snapshot: this.buildSessionSnapshot(session.id, now)!,
    };
  }

  public updateRemotePlayerState(
    sessionId: string,
    playerId: string,
    patch: {
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
    },
    now = Date.now(),
  ): RemotePlayerState | null {
    const roster = this.participantsBySession.get(sessionId);
    const player = roster?.get(playerId);
    if (!player) return null;

    const dtSec = Math.max(0.05, (now - player.updatedAt) / 1000);
    const validated = validatePlayerTransformUpdate(
      player,
      patch.position,
      patch.currentBuilding,
      patch.vehicleKind,
      dtSec,
    );

    player.position = {
      x: validated.x,
      y: validated.y,
      z: validated.z,
    };
    player.rotation = {
      yaw: Number.isFinite(patch.rotation.yaw) ? patch.rotation.yaw : player.rotation.yaw,
    };
    player.movementState = patch.movementState;
    if (patch.animState) player.animState = patch.animState;
    if (patch.emoteKind !== undefined) player.emoteKind = patch.emoteKind;
    if (typeof patch.emoteSeq === 'number') player.emoteSeq = patch.emoteSeq;
    if (typeof patch.speed === 'number' && Number.isFinite(patch.speed)) player.speed = patch.speed;
    if (typeof patch.grounded === 'boolean') player.grounded = patch.grounded;
    if (typeof patch.onStairs === 'boolean') player.onStairs = patch.onStairs;
    if (typeof patch.onSeat === 'boolean') player.onSeat = patch.onSeat;
    player.vehicleKind = patch.vehicleKind;
    player.currentBuilding = patch.currentBuilding;
    player.currentFloor = Math.max(1, Math.min(30, Math.round(patch.currentFloor || 1)));
    player.currentActivity = String(patch.currentActivity || 'Exploring').slice(0, 64);
    if (patch.avatar) {
      const prof = this.profilesByPlayer.get(playerId);
      player.avatar = prof ? prof.customization : normalizeCharacterCustomization(patch.avatar);
    }
    player.connectionStatus = 'online';
    player.updatedAt = now;
    return player;
  }

  public triggerSessionElevatorAction(
    sessionId: string,
    buildingId: string,
    elevatorId: string,
    action: 'call' | 'select',
    floor: number,
    now = Date.now(),
  ): ElevatorSyncPayload | null {
    if (!this.sessions.has(sessionId)) return null;
    let map = this.elevatorsBySession.get(sessionId);
    if (!map) {
      map = new Map();
      this.elevatorsBySession.set(sessionId, map);
    }
    const key = `${buildingId}:${elevatorId}`;
    let entry = map.get(key);
    if (!entry) {
      const spec = buildServerElevatorSpecs(buildingId, elevatorId);
      entry = {
        buildingId,
        floors: spec.floors,
        runtime: createElevatorRuntimeState(
          { id: elevatorId, x: 0, z: 0, width: 2, depth: 2, floors: spec.floors },
          1,
          now,
        ),
      };
      map.set(key, entry);
    }

    if (action === 'call') {
      callElevatorToFloor(entry.runtime, floor, entry.floors, now);
    } else {
      selectElevatorFloor(entry.runtime, floor, entry.floors, now);
    }

    return {
      buildingId: entry.buildingId,
      elevatorId: entry.runtime.elevatorId,
      currentY: Number(entry.runtime.currentY.toFixed(3)),
      currentFloor: entry.runtime.currentFloor,
      targetFloor: entry.runtime.targetFloor,
      direction: entry.runtime.direction,
      doorState: entry.runtime.doorState,
      doorProgress: Number(entry.runtime.doorProgress.toFixed(3)),
      moving: entry.runtime.moving,
      updatedAt: entry.runtime.lastUpdatedAt,
    };
  }

  public stepSessionElevators(dt: number, now = Date.now()): Array<{ sessionId: string; elevator: ElevatorSyncPayload }> {
    const updates: Array<{ sessionId: string; elevator: ElevatorSyncPayload }> = [];
    for (const [sessionId, map] of this.elevatorsBySession.entries()) {
      for (const entry of map.values()) {
        const wasActive =
          entry.runtime.moving ||
          entry.runtime.doorState !== 'closed' ||
          entry.runtime.targetFloor !== null ||
          entry.runtime.targetQueue.length > 0;
        if (!wasActive) continue;
        stepElevatorRuntime(entry.runtime, dt, entry.floors, now);
        updates.push({
          sessionId,
          elevator: {
            buildingId: entry.buildingId,
            elevatorId: entry.runtime.elevatorId,
            currentY: Number(entry.runtime.currentY.toFixed(3)),
            currentFloor: entry.runtime.currentFloor,
            targetFloor: entry.runtime.targetFloor,
            direction: entry.runtime.direction,
            doorState: entry.runtime.doorState,
            doorProgress: Number(entry.runtime.doorProgress.toFixed(3)),
            moving: entry.runtime.moving,
            updatedAt: entry.runtime.lastUpdatedAt,
          },
        });
      }
    }
    return updates;
  }

  public setParticipantConnectionStatus(
    sessionId: string,
    playerId: string,
    status: PlayerConnectionStatus,
    now = Date.now(),
  ): RemotePlayerState | null {
    const roster = this.participantsBySession.get(sessionId);
    const player = roster?.get(playerId);
    if (!player) return null;
    player.connectionStatus = status;
    player.updatedAt = now;
    if (status === 'offline') {
      this.saveToDisk();
    }
    return player;
  }

  public getStudentProgressSummary(): StudentProgressRecord[] {
    const out: StudentProgressRecord[] = [];
    const seen = new Set<string>();

    for (const session of this.sessions.values()) {
      const roster = this.participantsBySession.get(session.id);
      if (!roster) continue;
      for (const p of roster.values()) {
        seen.add(p.playerId);
        const prof = this.profilesByPlayer.get(p.playerId);
        out.push({
          uid: p.playerId,
          displayName: p.displayName,
          sessionId: session.id,
          sessionName: session.name,
          questionsCompleted: p.questionsCompleted,
          pointsEarned: p.pointsEarned,
          knowledgePoints: prof?.knowledgePoints ?? p.pointsEarned,
          currentBuilding: p.currentBuilding,
          currentFloor: p.currentFloor,
          currentActivity: p.currentActivity,
          connectionStatus: p.connectionStatus,
          lastActiveAt: p.updatedAt,
        });
      }
    }

    for (const [uid, prog] of this.progressByPlayer.entries()) {
      if (seen.has(uid)) continue;
      const prof = this.profilesByPlayer.get(uid);
      out.push({
        uid,
        displayName: this.displayNamesByPlayer.get(uid) || 'Student Explorer',
        sessionId: null,
        sessionName: null,
        questionsCompleted: prog.completedQuestionIds.length,
        pointsEarned: prog.earnedPoints,
        knowledgePoints: prof?.knowledgePoints ?? prog.earnedPoints,
        currentBuilding: null,
        currentFloor: 1,
        currentActivity: 'Solo Practice',
        connectionStatus: 'offline',
        lastActiveAt:
          prog.history.length > 0 ? prog.history[prog.history.length - 1].attemptedAt : Date.now(),
      });
    }

    return out.sort((a, b) => b.pointsEarned - a.pointsEarned || b.lastActiveAt - a.lastActiveAt);
  }
}
