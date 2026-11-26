import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientWsMessage, ServerWsMessage, SessionStatus } from './src/game/multiplayerTypes';
import type { AnswerKey, QuestionDatabase } from './src/game/questionTypes';
import type { CharacterCustomization } from './src/game/types';
import {
  BOOTSTRAPPED_TEACHER_EMAIL,
  GameBackendStore,
  PUBLIC_OPEN_WORLD_CODE,
  PUBLIC_OPEN_WORLD_SESSION_ID,
  PinRateLimiter,
  TeacherTokenManager,
  resolveCallerAuthorization,
} from './src/server/securityCore';

interface FirebaseAppletConfig {
  projectId?: string;
}

function loadFirebaseProjectId(): string | null {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as FirebaseAppletConfig;
    if (!raw.projectId || raw.projectId.includes('remixed-')) return null;
    return raw.projectId;
  } catch {
    return null;
  }
}

const firebaseProjectId = loadFirebaseProjectId();
const firebaseAdminApp = firebaseProjectId
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId: firebaseProjectId })
  : null;

interface VerifiedCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL: string;
}

async function verifyFirebaseBearer(authHeader: string | undefined): Promise<VerifiedCaller | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || !firebaseAdminApp) return null;
  try {
    const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    return {
      uid: decoded.uid,
      email,
      emailVerified: Boolean(decoded.email_verified),
      displayName: decoded.name || (email ? email.split('@')[0] : 'Player'),
      photoURL: decoded.picture || '',
    };
  } catch {
    return null;
  }
}

async function verifyFirebaseIdToken(token: string): Promise<VerifiedCaller | null> {
  return verifyFirebaseBearer(`Bearer ${token}`);
}

const store = new GameBackendStore({
  persistPath: path.resolve(process.cwd(), '.data', 'server-store.json'),
  envPinHash: process.env.TEACHER_PIN_HASH,
});
const rateLimiter = new PinRateLimiter(5, 60_000);
const teacherTokens = new TeacherTokenManager(process.env.TEACHER_TOKEN_SECRET);

function extractClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// Active WebSocket tracking by session & UID (prevents duplicate connections per UID)
interface ConnectedWsClient {
  ws: WebSocket;
  uid: string;
  displayName: string;
  sessionId: string;
}

const wsByUid = new Map<string, ConnectedWsClient>();
const wsBySession = new Map<string, Set<ConnectedWsClient>>();

function sendWs(ws: WebSocket, msg: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastToSession(sessionId: string, msg: ServerWsMessage, excludeUid?: string): void {
  const clients = wsBySession.get(sessionId);
  if (!clients) return;
  const encoded = JSON.stringify(msg);
  for (const c of clients) {
    if (excludeUid && c.uid === excludeUid) continue;
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(encoded);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // --- Auth Role Inspection ---
  app.get('/api/auth/me', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    const authz = resolveCallerAuthorization(caller, store);
    res.json({
      uid: caller.uid,
      email: caller.email,
      emailVerified: caller.emailVerified,
      displayName: caller.displayName,
      photoURL: caller.photoURL,
      role: authz.role,
      isBootstrappedTeacher: authz.isBootstrappedTeacher,
    });
  });

  // --- Student-Safe Sanitized Public Question Bank (NEVER leaks correctAnswer or explanation) ---
  app.get('/api/quiz/public', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    const playerKey = caller?.uid || String(req.headers['x-guest-player-id'] || 'guest_local');
    res.json({
      database: store.getPublicDatabase(),
      progress: store.getPlayerProgress(playerKey),
    });
  });

  // --- Server-Authoritative Quiz Answer Evaluation & Atomic KP Claim ---
  app.post('/api/quiz/submit', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    const playerKey = caller?.uid || String(req.headers['x-guest-player-id'] || 'guest_local');
    const { questionId, selectedAnswer, sessionId, txId } = req.body as {
      questionId?: string;
      selectedAnswer?: AnswerKey;
      sessionId?: string | null;
      txId?: string | null;
    };

    if (
      !questionId ||
      (selectedAnswer !== 'A' &&
        selectedAnswer !== 'B' &&
        selectedAnswer !== 'C' &&
        selectedAnswer !== 'D')
    ) {
      res.status(400).json({ error: 'Invalid quiz submission payload.' });
      return;
    }

    const result = store.submitQuizAnswer({
      playerKey,
      displayName: caller?.displayName,
      questionId,
      selectedAnswer,
      sessionId: sessionId || null,
      txId: txId || null,
    });

    if (result.sessionSnapshot && sessionId) {
      broadcastToSession(sessionId, {
        type: 'session:state',
        snapshot: result.sessionSnapshot,
      });
      if (result.sessionSnapshot.challengeState) {
        broadcastToSession(sessionId, {
          type: 'challenge:state',
          challengeState: result.sessionSnapshot.challengeState,
        });
      }
    }

    res.json({
      outcome: result.outcome,
      progress: result.progress,
      profile: result.profile,
    });
  });

  // --- Authoritative Account-Bound KP Economy, Inventory, Badges & 3D Reward Shop ---
  app.get('/api/shop/catalog', (_req, res) => {
    const pub = store.getPublicDatabase();
    res.json({
      items: store.getEffectiveShopCatalog(),
      teacherConfig: pub.teacherConfig,
    });
  });

  app.get('/api/player/profile', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Sign in with your account to synchronize Knowledge Points & Reward Inventory.' });
      return;
    }
    const profile = store.getOrCreatePlayerProfile(caller.uid, caller.displayName);
    res.json({ profile });
  });

  app.post('/api/shop/purchase', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Please sign in to purchase and save items to your account.' });
      return;
    }
    const { itemId, txId, equipImmediately } = req.body as {
      itemId?: string;
      txId?: string;
      equipImmediately?: boolean;
    };
    if (!itemId || typeof itemId !== 'string') {
      res.status(400).json({ error: 'Valid itemId is required.' });
      return;
    }
    const result = store.purchaseShopItem({
      uid: caller.uid,
      displayName: caller.displayName,
      itemId: itemId.trim(),
      txId: txId || null,
      equipImmediately: equipImmediately !== false,
    });
    if (!result.ok) {
      res.status(409).json({
        error: result.error || 'Purchase could not be completed.',
        profile: result.profile,
      });
      return;
    }

    // Push live outfit/character update to connected multiplayer classmates
    const wsClient = wsByUid.get(caller.uid);
    if (wsClient) {
      const snap = store.buildSessionSnapshot(wsClient.sessionId);
      const playerRecord = snap?.players.find((p) => p.playerId === caller.uid);
      if (playerRecord) {
        broadcastToSession(wsClient.sessionId, {
          type: 'player:delta',
          player: playerRecord,
        });
      }
    }

    res.json({
      profile: result.profile,
      item: result.item,
      transaction: result.transaction,
      alreadyProcessed: Boolean(result.alreadyProcessed),
    });
  });

  app.put('/api/player/customization', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Account sign-in required to save character customization.' });
      return;
    }
    const { itemId, patch } = req.body as {
      itemId?: string;
      patch?: Partial<CharacterCustomization>;
    };
    const result = store.equipOwnedCustomization({
      uid: caller.uid,
      displayName: caller.displayName,
      itemId,
      patch,
    });
    if (!result.ok) {
      res.status(403).json({ error: result.error, profile: result.profile });
      return;
    }

    const wsClient = wsByUid.get(caller.uid);
    if (wsClient) {
      const snap = store.buildSessionSnapshot(wsClient.sessionId);
      const playerRecord = snap?.players.find((p) => p.playerId === caller.uid);
      if (playerRecord) {
        broadcastToSession(wsClient.sessionId, {
          type: 'player:delta',
          player: playerRecord,
        });
      }
    }

    res.json({ profile: result.profile });
  });

  app.post('/api/player/progress-sync', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    const { visitedBuildingId, towerFloor } = req.body as {
      visitedBuildingId?: string;
      towerFloor?: number;
    };
    const profile = store.recordPlayerExplorationProgress(caller.uid, caller.displayName, {
      visitedBuildingId,
      towerFloor,
    });
    res.json({ profile });
  });

  // --- Protected Teacher PIN Gate (Requires verified Teacher Google Login) ---
  app.get('/api/teacher/pin/status', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller || !caller.emailVerified) {
      res.status(401).json({ error: 'Sign in with a verified Teacher Google account first.' });
      return;
    }
    if (!store.isTeacherEmail(caller.email)) {
      res.status(403).json({ error: 'Access denied. Teacher authorization required.' });
      return;
    }
    const rateKey = `${extractClientIp(req)}:${caller.uid}`;
    res.json(rateLimiter.getStatus(rateKey, store.isPinConfigured()));
  });

  app.post('/api/teacher/pin/setup', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller || !caller.emailVerified || !store.isTeacherEmail(caller.email)) {
      res.status(403).json({ error: 'Authorized teacher account required.' });
      return;
    }
    const { pin } = req.body as { pin?: string };
    const setup = store.setupInitialPin(String(pin || ''));
    if (!setup.ok) {
      res.status(400).json({ error: setup.error || 'Could not set up PIN.' });
      return;
    }
    const issued = teacherTokens.issue(caller.uid, caller.email);
    res.json({
      verified: true,
      teacherToken: issued.token,
      expiresAt: issued.expiresAt,
    });
  });

  app.post('/api/teacher/pin/verify', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller || !caller.emailVerified) {
      res.status(401).json({ error: 'Verified teacher sign-in required.' });
      return;
    }
    if (!store.isTeacherEmail(caller.email)) {
      res.status(403).json({ error: 'Access denied. Student accounts cannot enter Teacher Mode.' });
      return;
    }

    if (!store.isPinConfigured()) {
      res.status(409).json({
        error: 'Teacher PIN has not been created yet.',
        pinConfigured: false,
      });
      return;
    }

    const rateKey = `${extractClientIp(req)}:${caller.uid}`;
    const status = rateLimiter.getStatus(rateKey, true);
    if (status.locked) {
      res.status(429).json({
        error: `Too many failed PIN attempts. Try again in ${status.retryAfterSeconds}s.`,
        ...status,
      });
      return;
    }

    const { pin } = req.body as { pin?: string };
    const ok = store.verifyPin(String(pin || ''));
    if (!ok) {
      const nextStatus = rateLimiter.recordFailure(rateKey, true);
      res.status(nextStatus.locked ? 429 : 401).json({
        error: nextStatus.locked
          ? `Too many failed attempts. Locked for ${nextStatus.retryAfterSeconds}s.`
          : `Incorrect Teacher PIN. ${nextStatus.remainingAttempts} attempt(s) remaining.`,
        ...nextStatus,
      });
      return;
    }

    rateLimiter.recordSuccess(rateKey);
    const issued = teacherTokens.issue(caller.uid, caller.email);
    res.json({
      verified: true,
      teacherToken: issued.token,
      expiresAt: issued.expiresAt,
    });
  });

  // Helper middleware verifying BOTH Teacher Google Auth AND Teacher PIN Elevation Token
  async function requireVerifiedTeacher(
    req: express.Request,
    res: express.Response,
  ): Promise<VerifiedCaller | null> {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller || !caller.emailVerified) {
      res.status(401).json({ error: 'Unauthenticated' });
      return null;
    }
    if (!store.isTeacherEmail(caller.email)) {
      res.status(403).json({ error: 'Forbidden: Teacher role required.' });
      return null;
    }
    const pinToken = String(req.headers['x-teacher-token'] || '');
    const verifiedToken = teacherTokens.verify(pinToken, caller.uid);
    if (!verifiedToken) {
      res.status(403).json({ error: 'Teacher PIN verification expired or missing.' });
      return null;
    }
    return caller;
  }

  app.post('/api/teacher/pin/change', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    const { currentPin, newPin } = req.body as { currentPin?: string; newPin?: string };
    const changed = store.changePin(String(currentPin || ''), String(newPin || ''));
    if (!changed.ok) {
      res.status(400).json({ error: changed.error });
      return;
    }
    res.json({ updated: true });
  });

  app.get('/api/teacher/database', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    res.json({
      database: store.getFullDatabase(),
      teacherEmails: store.getTeacherEmails(),
    });
  });

  app.put('/api/teacher/database', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    const { database } = req.body as { database?: QuestionDatabase };
    if (!database || !Array.isArray(database.questions)) {
      res.status(400).json({ error: 'Invalid question database payload.' });
      return;
    }
    const updated = store.replaceQuestionDatabase(database);
    for (const snap of store.listSessionSnapshots()) {
      if (wsBySession.get(snap.session.id)?.size) {
        broadcastToSession(snap.session.id, {
          type: 'session:state',
          snapshot: snap,
        });
      }
    }
    res.json({ database: updated });
  });

  app.get('/api/teacher/reports', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    res.json({ reports: store.getModerationReports() });
  });

  app.post('/api/teacher/database/reset', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    const reset = store.resetQuestionDatabase();
    res.json({ database: reset });
  });

  app.post('/api/teacher/accounts', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    const { action, email } = req.body as { action?: 'add' | 'remove'; email?: string };
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    if (action === 'remove') {
      const result = store.removeTeacherEmail(email);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ teacherEmails: result.emails });
      return;
    }
    const emails = store.addTeacherEmail(email);
    res.json({ teacherEmails: emails });
  });

  // --- Teacher Multiplayer Session Management & Student Progress Monitor ---
  app.get('/api/teacher/sessions', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    res.json({
      sessions: store
        .listSessionSnapshots()
        .filter((s) => s.session.id !== PUBLIC_OPEN_WORLD_SESSION_ID),
      studentProgress: store.getStudentProgressSummary(),
    });
  });

  app.post('/api/teacher/sessions', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    const body = req.body as {
      name?: string;
      subject?: string;
      questionSetId?: string;
      maxPlayers?: number;
      durationMinutes?: number;
      objectives?: string;
      joinCode?: string;
    };
    if (!body.name?.trim()) {
      res.status(400).json({ error: 'Session name is required.' });
      return;
    }
    const session = store.createSession(teacher.uid, {
      name: body.name,
      subject: body.subject || 'All Subjects',
      questionSetId: body.questionSetId || 'set_city_core',
      maxPlayers: body.maxPlayers,
      durationMinutes: body.durationMinutes,
      objectives: body.objectives,
      joinCode: body.joinCode,
    });
    res.status(201).json({ snapshot: store.buildSessionSnapshot(session.id) });
  });

  app.patch('/api/teacher/sessions/:sessionId/status', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    const { status } = req.body as { status?: SessionStatus };
    if (status !== 'waiting' && status !== 'active' && status !== 'paused' && status !== 'ended') {
      res.status(400).json({ error: 'Invalid session status.' });
      return;
    }
    const snapshot = store.setSessionStatus(req.params.sessionId, status);
    if (!snapshot) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }
    broadcastToSession(req.params.sessionId, {
      type: 'session:state',
      snapshot,
    });
    res.json({ snapshot });
  });

  app.delete('/api/teacher/sessions/:sessionId', async (req, res) => {
    const teacher = await requireVerifiedTeacher(req, res);
    if (!teacher) return;
    broadcastToSession(req.params.sessionId, {
      type: 'session:error',
      code: 'SESSION_ENDED',
      message: 'Session was closed by the teacher.',
    });
    const ok = store.deleteSession(req.params.sessionId);
    res.json({ deleted: ok });
  });

  // --- Student Session Lookup & Join Check (Authenticated Firebase account required) ---
  app.post('/api/sessions/join-check', async (req, res) => {
    const caller = await verifyFirebaseBearer(req.headers.authorization);
    if (!caller) {
      res.status(401).json({ error: 'Please sign in before joining a classroom session.' });
      return;
    }
    const { joinCode } = req.body as { joinCode?: string };
    if (!joinCode?.trim()) {
      res.status(400).json({ error: 'Session join code is required.' });
      return;
    }
    const outcome = store.joinSession({
      joinCode,
      playerId: caller.uid,
      displayName: caller.displayName,
    });
    if (!outcome.ok || !outcome.snapshot) {
      const codeNum = outcome.code === 'SESSION_NOT_FOUND' ? 404 : 409;
      res.status(codeNum).json({ error: outcome.message, code: outcome.code });
      return;
    }
    res.json({ snapshot: outcome.snapshot });
  });

  // --- HTTP + WebSocket Server ---
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/multiplayer' });

  wss.on('connection', (ws) => {
    let clientCtx: ConnectedWsClient | null = null;

    ws.on('message', async (raw) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientWsMessage;
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        sendWs(ws, { type: 'pong', ts: msg.ts });
        return;
      }

      if (msg.type === 'auth:join') {
        const requestedCode = String(msg.joinCode || PUBLIC_OPEN_WORLD_CODE).trim().toUpperCase();
        const isPublicOpenWorld = requestedCode === PUBLIC_OPEN_WORLD_CODE;

        const caller = msg.token ? await verifyFirebaseIdToken(msg.token) : null;
        const verifiedCaller = caller;

        if (!verifiedCaller && !isPublicOpenWorld) {
          sendWs(ws, {
            type: 'session:error',
            code: 'UNAUTHORIZED',
            message: 'Account sign-in is required to join classroom sessions.',
          });
          ws.close(4001, 'Unauthorized');
          return;
        }

        let playerId: string;
        let displayName: string;
        let avatarToUse = msg.avatar;

        if (verifiedCaller) {
          playerId = verifiedCaller.uid;
          displayName = verifiedCaller.displayName;
          const serverProf = store.getOrCreatePlayerProfile(verifiedCaller.uid, verifiedCaller.displayName);
          avatarToUse = serverProf.customization || msg.avatar;
        } else {
          // Guest Open-World real-time identity (sandboxed to guest: prefix, never collides with verified UIDs)
          const rawGuest = String(msg.guestId || '')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 32);
          const suffix =
            rawGuest.length >= 6
              ? rawGuest
              : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
          playerId = suffix.startsWith('guest_') ? `guest:${suffix}` : `guest:${suffix}`;
          const cleanName = String(msg.displayName || '')
            .replace(/[\r\n<>]/g, '')
            .trim()
            .slice(0, 22);
          displayName = cleanName || `Citizen-${suffix.slice(-4).toUpperCase()}`;
        }

        // Prevent duplicate simultaneous WebSocket session per playerId
        const previousClient = wsByUid.get(playerId);
        if (previousClient && previousClient.ws !== ws) {
          sendWs(previousClient.ws, {
            type: 'session:error',
            code: 'DUPLICATE_LOGIN',
            message: 'Your account joined from another tab or device.',
          });
          previousClient.ws.close(4009, 'Superseded by newer connection');
        }

        const outcome = store.joinSession({
          joinCode: requestedCode,
          playerId,
          displayName,
          avatar: avatarToUse,
        });

        if (!outcome.ok || !outcome.snapshot) {
          sendWs(ws, {
            type: 'session:error',
            code: outcome.code || 'JOIN_FAILED',
            message: outcome.message || 'Unable to join session.',
          });
          ws.close(4003, outcome.code || 'Join rejected');
          return;
        }

        const sessionId = outcome.snapshot.session.id;
        clientCtx = {
          ws,
          uid: playerId,
          displayName,
          sessionId,
        };
        wsByUid.set(playerId, clientCtx);
        let group = wsBySession.get(sessionId);
        if (!group) {
          group = new Set();
          wsBySession.set(sessionId, group);
        }
        group.add(clientCtx);

        sendWs(ws, {
          type: 'session:joined',
          selfPlayerId: playerId,
          snapshot: outcome.snapshot,
        });

        broadcastToSession(
          sessionId,
          {
            type: 'session:state',
            snapshot: outcome.snapshot,
          },
          playerId,
        );
        return;
      }

      if (!clientCtx) {
        sendWs(ws, {
          type: 'session:error',
          code: 'NOT_JOINED',
          message: 'Authenticate and join a session first.',
        });
        return;
      }

      if (msg.type === 'player:update') {
        const updated = store.updateRemotePlayerState(clientCtx.sessionId, clientCtx.uid, {
          position: msg.position,
          rotation: msg.rotation,
          movementState: msg.movementState,
          animState: msg.animState,
          emoteKind: msg.emoteKind,
          emoteSeq: msg.emoteSeq,
          speed: msg.speed,
          grounded: msg.grounded,
          onStairs: msg.onStairs,
          onSeat: msg.onSeat,
          vehicleKind: msg.vehicleKind,
          currentBuilding: msg.currentBuilding,
          currentFloor: msg.currentFloor,
          currentActivity: msg.currentActivity,
          avatar: msg.avatar,
        });
        if (updated) {
          broadcastToSession(
            clientCtx.sessionId,
            {
              type: 'player:delta',
              player: updated,
            },
            clientCtx.uid,
          );
        }
        return;
      }

      if (msg.type === 'elevator:action') {
        const elevator = store.triggerSessionElevatorAction(
          clientCtx.sessionId,
          msg.buildingId,
          msg.elevatorId,
          msg.action,
          msg.floor,
        );
        if (elevator) {
          broadcastToSession(clientCtx.sessionId, {
            type: 'elevator:state',
            elevator,
          });
        }
        return;
      }

      if (msg.type === 'social:chat') {
        const chatRes = store.postSessionChat(
          clientCtx.sessionId,
          clientCtx.uid,
          clientCtx.displayName,
          msg.text,
        );
        if (!chatRes.ok || !chatRes.message) {
          sendWs(ws, {
            type: 'session:error',
            code: 'CHAT_BLOCKED',
            message: chatRes.error || 'Message could not be sent.',
          });
          return;
        }
        broadcastToSession(clientCtx.sessionId, {
          type: 'social:chat_msg',
          message: chatRes.message,
        });
        return;
      }

      if (msg.type === 'group:action') {
        const grpRes = store.handleGroupAction(
          clientCtx.sessionId,
          clientCtx.uid,
          msg.action,
          msg.groupId,
          msg.name,
        );
        if (!grpRes.ok) {
          sendWs(ws, {
            type: 'session:error',
            code: 'GROUP_ERROR',
            message: grpRes.error || 'Group update failed.',
          });
          return;
        }
        broadcastToSession(clientCtx.sessionId, {
          type: 'social:groups_state',
          groups: grpRes.groups,
        });
        const snap = store.buildSessionSnapshot(clientCtx.sessionId);
        if (snap) {
          broadcastToSession(clientCtx.sessionId, {
            type: 'session:state',
            snapshot: snap,
          });
        }
        return;
      }

      if (msg.type === 'social:emote_greet') {
        broadcastToSession(
          clientCtx.sessionId,
          {
            type: 'social:emote_event',
            fromPlayerId: clientCtx.uid,
            fromName: clientCtx.displayName,
            targetPlayerId: msg.targetPlayerId,
            emote: msg.emote,
          },
          clientCtx.uid,
        );
        return;
      }

      if (msg.type === 'social:report') {
        store.recordModerationReport({
          sessionId: clientCtx.sessionId,
          reporterUid: clientCtx.uid,
          reporterName: clientCtx.displayName,
          targetPlayerId: msg.targetPlayerId,
          reason: msg.reason,
          messageExcerpt: msg.messageExcerpt,
        });
        return;
      }

      if (msg.type === 'session:leave') {
        const ctx = clientCtx;
        clientCtx = null;
        if (wsByUid.get(ctx.uid)?.ws === ws) {
          wsByUid.delete(ctx.uid);
        }
        wsBySession.get(ctx.sessionId)?.delete(ctx);
        store.setParticipantConnectionStatus(ctx.sessionId, ctx.uid, 'offline');
        broadcastToSession(ctx.sessionId, {
          type: 'player:left',
          playerId: ctx.uid,
          connectionStatus: 'offline',
        });
        ws.close(1000, 'Left session');
      }
    });

    ws.on('close', () => {
      if (!clientCtx) return;
      const ctx = clientCtx;
      clientCtx = null;
      if (wsByUid.get(ctx.uid)?.ws === ws) {
        wsByUid.delete(ctx.uid);
      }
      wsBySession.get(ctx.sessionId)?.delete(ctx);
      store.setParticipantConnectionStatus(ctx.sessionId, ctx.uid, 'offline');
      broadcastToSession(ctx.sessionId, {
        type: 'player:left',
        playerId: ctx.uid,
        connectionStatus: 'offline',
      });
    });
  });

  // Periodic authoritative session timer sync every 1s for active sessions
  setInterval(() => {
    const snapshots = store.listSessionSnapshots();
    for (const snap of snapshots) {
      if (snap.session.status === 'active' && wsBySession.get(snap.session.id)?.size) {
        broadcastToSession(snap.session.id, {
          type: 'session:state',
          snapshot: snap,
        });
      }
    }
  }, 1000);

  // Authoritative elevator physics step (~15 Hz when any session elevator is active)
  let lastElevTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.1, Math.max(0.01, (now - lastElevTick) / 1000));
    lastElevTick = now;
    const elevatorUpdates = store.stepSessionElevators(dt, now);
    for (const { sessionId, elevator } of elevatorUpdates) {
      if (wsBySession.get(sessionId)?.size) {
        broadcastToSession(sessionId, {
          type: 'elevator:state',
          elevator,
        });
      }
    }
  }, 66);

  // Vite middleware in development; static dist serving in production
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));
  if (isProd) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Urban Life server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
