import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFirebaseAuthError } from '../game/authErrors';
import { resolveQuestionKpReward } from '../game/rewardShopCatalog';
import {
  BOOTSTRAPPED_TEACHER_EMAIL,
  GameBackendStore,
  PUBLIC_OPEN_WORLD_CODE,
  PUBLIC_OPEN_WORLD_SESSION_ID,
  PinRateLimiter,
  TeacherTokenManager,
  hashPin,
  resolveCallerAuthorization,
  validatePinFormat,
  verifyPinHash,
} from './securityCore';

test('PIN format requires 6 to 12 numeric digits', () => {
  assert.notEqual(validatePinFormat('12345'), null);
  assert.notEqual(validatePinFormat('12ab56'), null);
  assert.notEqual(validatePinFormat('1234567890123'), null);
  assert.equal(validatePinFormat('123456'), null);
  assert.equal(validatePinFormat('90482175'), null);
});

test('scrypt PIN hashing verifies matching PIN and rejects wrong PIN', () => {
  const digest = hashPin('482910');
  assert.ok(digest.includes(':'));
  assert.equal(digest.includes('482910'), false);
  assert.equal(verifyPinHash('482910', digest), true);
  assert.equal(verifyPinHash('482911', digest), false);
});

test('PinRateLimiter locks after 5 failures and clears after lockout or success', () => {
  const limiter = new PinRateLimiter(5, 60_000);
  const t0 = 1_000_000;

  for (let i = 1; i <= 4; i++) {
    const st = limiter.recordFailure('uid_1', true, t0 + i * 100);
    assert.equal(st.locked, false);
    assert.equal(st.remainingAttempts, 5 - i);
  }

  const locked = limiter.recordFailure('uid_1', true, t0 + 500);
  assert.equal(locked.locked, true);
  assert.equal(locked.remainingAttempts, 0);
  assert.ok(locked.retryAfterSeconds > 0);

  const expired = limiter.getStatus('uid_1', true, t0 + 61_000);
  assert.equal(expired.locked, false);
  assert.equal(expired.remainingAttempts, 5);

  limiter.recordFailure('uid_2', true, t0);
  limiter.recordSuccess('uid_2');
  assert.equal(limiter.getStatus('uid_2', true, t0).remainingAttempts, 5);
});

test('TeacherTokenManager signs, verifies, and rejects tampered/expired/wrong-uid tokens', () => {
  const mgr = new TeacherTokenManager('unit_test_secret_key_0123456789', 5000);
  const t0 = 2_000_000;
  const issued = mgr.issue('teacher_uid', BOOTSTRAPPED_TEACHER_EMAIL, t0);

  const valid = mgr.verify(issued.token, 'teacher_uid', t0 + 1000);
  assert.ok(valid);
  assert.equal(valid.email, BOOTSTRAPPED_TEACHER_EMAIL);

  // Tamper signature
  const tampered = `${issued.token.slice(0, -4)}AAAA`;
  assert.equal(mgr.verify(tampered, 'teacher_uid', t0 + 1000), null);

  // Wrong UID
  assert.equal(mgr.verify(issued.token, 'student_uid', t0 + 1000), null);

  // Expired
  assert.equal(mgr.verify(issued.token, 'teacher_uid', t0 + 6000), null);
});

test('GameBackendStore enforces bootstrapped teacher role, PIN setup/change, and strips answer keys', () => {
  const store = new GameBackendStore({ persistPath: null });

  assert.equal(store.isTeacherEmail(BOOTSTRAPPED_TEACHER_EMAIL), true);
  assert.equal(store.isTeacherEmail('student@school.edu'), false);

  const protect = store.removeTeacherEmail(BOOTSTRAPPED_TEACHER_EMAIL);
  assert.equal(protect.ok, false);

  assert.equal(store.isPinConfigured(), false);
  assert.equal(store.setupInitialPin('739104').ok, true);
  assert.equal(store.isPinConfigured(), true);
  assert.equal(store.setupInitialPin('111111').ok, false);
  assert.equal(store.verifyPin('739104'), true);
  assert.equal(store.changePin('000000', '888888').ok, false);
  assert.equal(store.changePin('739104', '888888').ok, true);
  assert.equal(store.verifyPin('888888'), true);

  const pubDb = store.getPublicDatabase();
  assert.ok(pubDb.questions.length > 0);
  for (const q of pubDb.questions) {
    assert.equal('correctAnswer' in q, false);
    assert.equal('explanation' in q, false);
  }
});

test('GameBackendStore prevents duplicate point farming and enforces session capacity/state', () => {
  const store = new GameBackendStore({ persistPath: null });
  const fullDb = store.getFullDatabase();
  const targetQ = fullDb.questions[0];
  const expectedKp = resolveQuestionKpReward(targetQ, fullDb.teacherConfig);

  const first = store.submitQuizAnswer({
    playerKey: 'student_1',
    displayName: 'Alex',
    questionId: targetQ.id,
    selectedAnswer: targetQ.correctAnswer,
  });
  assert.equal(first.outcome.isCorrect, true);
  assert.equal(first.outcome.pointsAwarded, expectedKp);
  assert.equal(first.progress.earnedPoints, expectedKp);

  // Second submission of same question is practice review with 0 duplicate points
  const second = store.submitQuizAnswer({
    playerKey: 'student_1',
    displayName: 'Alex',
    questionId: targetQ.id,
    selectedAnswer: targetQ.correctAnswer,
  });
  assert.equal(second.outcome.alreadyCompleted, true);
  assert.equal(second.outcome.pointsAwarded, 0);
  assert.equal(second.progress.earnedPoints, expectedKp);

  // Session lifecycle & capacity (min 2)
  const session = store.createSession('teacher_uid', {
    name: 'Algebra Tour',
    subject: 'Mathematics',
    questionSetId: fullDb.questionSets[0].id,
    maxPlayers: 2,
    durationMinutes: 15,
    joinCode: 'ALG101',
  });
  assert.equal(session.joinCode, 'ALG101');
  assert.equal(session.status, 'waiting');

  const join1 = store.joinSession({ joinCode: 'ALG101', playerId: 'p1', displayName: 'One' });
  const join2 = store.joinSession({ joinCode: 'ALG101', playerId: 'p2', displayName: 'Two' });
  const join3 = store.joinSession({ joinCode: 'ALG101', playerId: 'p3', displayName: 'Three' });
  assert.equal(join1.ok, true);
  assert.equal(join2.ok, true);
  assert.equal(join3.ok, false);
  assert.equal(join3.code, 'SESSION_FULL');

  // Rejoining existing playerId succeeds even at capacity
  const rejoin1 = store.joinSession({ joinCode: 'ALG101', playerId: 'p1', displayName: 'One' });
  assert.equal(rejoin1.ok, true);

  // Ending session blocks new joins
  store.setSessionStatus(session.id, 'ended');
  const joinEnded = store.joinSession({ joinCode: 'ALG101', playerId: 'p1', displayName: 'One' });
  assert.equal(joinEnded.ok, false);
  assert.equal(joinEnded.code, 'SESSION_ENDED');
});

test('GameBackendStore validates anti-teleport movement and synchronizes session elevators', () => {
  const store = new GameBackendStore({ persistPath: null });
  const db = store.getFullDatabase();
  const session = store.createSession('teacher_uid', {
    name: 'Skyscraper Hunt',
    subject: 'Science',
    questionSetId: db.questionSets[0].id,
    joinCode: 'SKY022',
  });
  store.joinSession({ joinCode: 'SKY022', playerId: 'p1', displayName: 'Maya' });

  const t0 = Date.now();
  // Normal step
  const okStep = store.updateRemotePlayerState(
    session.id,
    'p1',
    {
      position: { x: 1, y: 0, z: 16 },
      rotation: { yaw: 0 },
      movementState: 'walking',
      animState: 'walk',
      vehicleKind: null,
      currentBuilding: null,
      currentFloor: 1,
      currentActivity: 'Exploring City',
      avatar: store.buildSessionSnapshot(session.id)!.players[0].avatar,
    },
    t0 + 100,
  );
  assert.ok(okStep);
  assert.equal(okStep.position.x, 1);
  assert.equal(okStep.animState, 'walk');

  // Extreme on-foot teleport attempt (100m in 0.1s) is clamped by server
  const clampedStep = store.updateRemotePlayerState(
    session.id,
    'p1',
    {
      position: { x: 101, y: 0, z: 16 },
      rotation: { yaw: 0 },
      movementState: 'running',
      vehicleKind: null,
      currentBuilding: null,
      currentFloor: 1,
      currentActivity: 'Exploring City',
      avatar: okStep.avatar,
    },
    t0 + 200,
  );
  assert.ok(clampedStep);
  assert.ok(clampedStep.position.x < 10, `Expected clamped X < 10, got ${clampedStep.position.x}`);

  // Server elevator call & select moves elevator toward Floor 22 Rooftop
  const callRes = store.triggerSessionElevatorAction(
    session.id,
    'freedom_tower',
    'city_tower_elev',
    'call',
    1,
    t0,
  );
  assert.ok(callRes);
  assert.equal(callRes.doorState, 'opening');

  store.triggerSessionElevatorAction(
    session.id,
    'freedom_tower',
    'city_tower_elev',
    'select',
    22,
    t0 + 100,
  );
  let moved = false;
  for (let i = 0; i < 60; i++) {
    const ups = store.stepSessionElevators(0.05, t0 + 150 + i * 50);
    if (ups.some((u) => u.elevator.moving && u.elevator.currentY > 0.1)) {
      moved = true;
      break;
    }
  }
  assert.equal(moved, true);
});

test('GameBackendStore validates KP difficulty rewards, atomic shop purchases, idempotent txIds, and ownership', () => {
  const store = new GameBackendStore({ persistPath: null });
  const db = store.getFullDatabase();

  // Set clear KP difficulty rewards & answer questions to earn KP
  const easyQ = db.questions.find((q) => q.difficulty === 'easy') || db.questions[0];
  const medQ = db.questions.find((q) => q.difficulty === 'medium' && q.id !== easyQ.id) || db.questions[1];

  // Submit answer #1 with txId and verify idempotency
  const sub1 = store.submitQuizAnswer({
    playerKey: 'student_kp',
    displayName: 'Maya',
    questionId: easyQ.id,
    selectedAnswer: easyQ.correctAnswer,
    txId: 'tx_quiz_1',
  });
  assert.equal(sub1.outcome.isCorrect, true);
  assert.ok(sub1.profile.knowledgePoints > 0);
  const kpAfterFirst = sub1.profile.knowledgePoints;

  // Replay exact same txId -> must NOT double-award KP
  const replay1 = store.submitQuizAnswer({
    playerKey: 'student_kp',
    displayName: 'Maya',
    questionId: easyQ.id,
    selectedAnswer: easyQ.correctAnswer,
    txId: 'tx_quiz_1',
  });
  assert.equal(replay1.profile.knowledgePoints, kpAfterFirst);

  // Earn more KP from second question
  const sub2 = store.submitQuizAnswer({
    playerKey: 'student_kp',
    displayName: 'Maya',
    questionId: medQ.id,
    selectedAnswer: medQ.correctAnswer,
    txId: 'tx_quiz_2',
  });
  const totalKpBeforeShop = sub2.profile.knowledgePoints;
  assert.ok(totalKpBeforeShop >= 30);

  // Reject unowned customization equip before purchase
  const unownedEquip = store.equipOwnedCustomization({
    uid: 'student_kp',
    itemId: 'char_leo',
  });
  assert.equal(unownedEquip.ok, false);

  // Reject overly expensive item (negative balance prevention)
  const tooExpensive = store.purchaseShopItem({
    uid: 'student_kp',
    itemId: 'outfit_golden_scholar',
    txId: 'tx_buy_gold',
  });
  assert.equal(tooExpensive.ok, false);
  assert.equal(tooExpensive.profile.knowledgePoints, totalKpBeforeShop);

  // Atomic purchase of 15 KP item ('hair_curly') with txId idempotency
  const buy = store.purchaseShopItem({
    uid: 'student_kp',
    itemId: 'hair_curly',
    txId: 'tx_buy_curly',
    equipImmediately: true,
  });
  assert.equal(buy.ok, true);
  assert.equal(buy.profile.knowledgePoints, totalKpBeforeShop - 15);
  assert.ok(buy.profile.ownedItemIds.includes('hair_curly'));
  assert.equal(buy.profile.customization.hairStyle, 'curly');

  // Replay same purchase txId -> no double charge
  const buyReplay = store.purchaseShopItem({
    uid: 'student_kp',
    itemId: 'hair_curly',
    txId: 'tx_buy_curly',
  });
  assert.equal(buyReplay.ok, true);
  assert.equal(buyReplay.alreadyProcessed, true);
  assert.equal(buyReplay.profile.knowledgePoints, totalKpBeforeShop - 15);

  // Duplicate purchase with a new txId is blocked
  const duplicateBuy = store.purchaseShopItem({
    uid: 'student_kp',
    itemId: 'hair_curly',
    txId: 'tx_buy_curly_2',
  });
  assert.equal(duplicateBuy.ok, false);

  // Disabled item in teacher shop overrides cannot be purchased
  const updatedDb = store.getFullDatabase();
  updatedDb.teacherConfig.shopItemOverrides = { hair_ponytail: { priceKp: 5, enabled: false } };
  store.replaceQuestionDatabase(updatedDb);
  const disabledBuy = store.purchaseShopItem({
    uid: 'student_kp',
    itemId: 'hair_ponytail',
    txId: 'tx_buy_disabled',
  });
  assert.equal(disabledBuy.ok, false);
});

test('GameBackendStore filters session chat, caps exploration groups at 5, and stores teacher reports', () => {
  const store = new GameBackendStore({ persistPath: null });
  const db = store.getFullDatabase();
  const session = store.createSession('teacher_uid', {
    name: 'Social City Lab',
    subject: 'Mathematics',
    questionSetId: db.questionSets[0].id,
    joinCode: 'SOC101',
  });

  const t0 = Date.now();
  // Safe chat passes, profanity filtered, PII rejected
  const goodMsg = store.postSessionChat(session.id, 'p1', 'Alex', 'Check CITY TOWER floor 5!', t0);
  assert.equal(goodMsg.ok, true);

  const badPii = store.postSessionChat(session.id, 'p1', 'Alex', 'email me a@b.com', t0 + 3000);
  assert.equal(badPii.ok, false);

  // Exploration group max 5 cap
  const gCreate = store.handleGroupAction(session.id, 'p1', 'create', undefined, 'Explorers', t0);
  assert.equal(gCreate.ok, true);
  const gid = gCreate.groups[0].id;
  for (const pid of ['p2', 'p3', 'p4', 'p5']) {
    assert.equal(store.handleGroupAction(session.id, pid, 'join', gid).ok, true);
  }
  assert.equal(store.handleGroupAction(session.id, 'p6', 'join', gid).ok, false);

  // Moderation report stored for teacher dashboard
  const rep = store.recordModerationReport({
    sessionId: session.id,
    reporterUid: 'p2',
    reporterName: 'Maya',
    targetPlayerId: 'p1',
    reason: 'Inappropriate chat',
    messageExcerpt: 'test',
  });
  assert.ok(rep.id);
  assert.equal(store.getModerationReports().length, 1);
});

test('GameBackendStore supports Emerald Bay, Aero Highland, intercity flight speed, and City 2/3 22F elevators', () => {
  const store = new GameBackendStore({ persistPath: null });
  const db = store.getFullDatabase();
  const session = store.createSession('teacher_uid', {
    name: 'Global Flight Tour',
    subject: 'Geography',
    questionSetId: db.questionSets[0].id,
    joinCode: 'FLY333',
  });
  store.joinSession({ joinCode: 'FLY333', playerId: 'pilot_1', displayName: 'Sky' });
  const avatar = store.buildSessionSnapshot(session.id)!.players[0].avatar;
  const t0 = Date.now();

  // Intercity flight movement at high altitude & speed should not clamp into Liberty Metro
  const airborne = store.updateRemotePlayerState(
    session.id,
    'pilot_1',
    {
      position: { x: 180, y: 74, z: 0 },
      rotation: { yaw: -Math.PI * 0.5 },
      movementState: 'flying',
      vehicleKind: null,
      currentBuilding: null,
      currentFloor: 1,
      currentActivity: 'Flying to Emerald Bay',
      avatar,
    },
    t0 + 1000,
  );
  assert.ok(airborne);
  assert.equal(airborne.position.x, 180);
  assert.equal(airborne.position.y, 74);

  // Landing inside Emerald Bay & moving into Aero Highland retains extended coordinates
  const landedEmerald = store.updateRemotePlayerState(
    session.id,
    'pilot_1',
    {
      position: { x: 356, y: 0, z: 0 },
      rotation: { yaw: 0 },
      movementState: 'flying',
      vehicleKind: null,
      currentBuilding: null,
      currentFloor: 1,
      currentActivity: 'Exploring Emerald Bay',
      avatar,
    },
    t0 + 2000,
  );
  assert.ok(landedEmerald);
  assert.equal(landedEmerald.position.x, 356);

  // Landing inside Golden Horizon retains southern extended coordinates (dt=2.5s across bay)
  const landedGolden = store.updateRemotePlayerState(
    session.id,
    'pilot_1',
    {
      position: { x: 0, y: 0, z: 280 },
      rotation: { yaw: 0 },
      movementState: 'flying',
      vehicleKind: null,
      currentBuilding: null,
      currentFloor: 1,
      currentActivity: 'Exploring Golden Horizon',
      avatar,
    },
    t0 + 4500,
  );
  assert.ok(landedGolden);
  assert.equal(landedGolden.position.z, 280);

  // City 2, City 3, and City 4 skyscraper elevators work up to Floor 22
  const elevC2 = store.triggerSessionElevatorAction(
    session.id,
    'c2_emerald_tower',
    'city_tower_elev',
    'select',
    22,
    t0,
  );
  assert.ok(elevC2);
  assert.equal(elevC2.targetFloor, 22);

  const elevC4 = store.triggerSessionElevatorAction(
    session.id,
    'c4_golden_spire',
    'city_tower_elev',
    'select',
    22,
    t0 + 100,
  );
  assert.ok(elevC4);
  assert.equal(elevC4.targetFloor, 22);
});

test('GameBackendStore maintains a standing active PUBLIC_OPEN_WORLD room for instant real-time multiplayer', () => {
  const store = new GameBackendStore({ persistPath: null });
  const snap = store.buildSessionSnapshot(PUBLIC_OPEN_WORLD_SESSION_ID);
  assert.ok(snap);
  assert.equal(snap.session.joinCode, PUBLIC_OPEN_WORLD_CODE);
  assert.equal(snap.session.status, 'active');
  assert.equal(snap.session.remainingSeconds, 86400);

  // Standing Open-World room cannot be deleted or terminated
  assert.equal(store.deleteSession(PUBLIC_OPEN_WORLD_SESSION_ID), false);
  const stillHere = store.buildSessionSnapshot(PUBLIC_OPEN_WORLD_SESSION_ID);
  assert.ok(stillHere);
  assert.equal(stillHere.session.status, 'active');

  // Guest and verified players join the same shared Open-World city
  const p1 = store.joinSession({
    joinCode: PUBLIC_OPEN_WORLD_CODE,
    playerId: 'guest:tab_1',
    displayName: 'Budi',
  });
  const p2 = store.joinSession({
    joinCode: PUBLIC_OPEN_WORLD_CODE,
    playerId: 'google_uid_siti',
    displayName: 'Siti',
  });
  assert.equal(p1.ok, true);
  assert.equal(p2.ok, true);

  const afterSnap = store.buildSessionSnapshot(PUBLIC_OPEN_WORLD_SESSION_ID);
  assert.ok(afterSnap);
  assert.equal(afterSnap.players.length, 2);
  assert.ok(afterSnap.players.some((p) => p.playerId === 'guest:tab_1'));
  assert.ok(afterSnap.players.some((p) => p.playerId === 'google_uid_siti'));
});

test('GameBackendStore preserves underwater ocean and submarine diving Y coordinates down to seabed', () => {
  const store = new GameBackendStore({ persistPath: null });
  store.joinSession({
    joinCode: PUBLIC_OPEN_WORLD_CODE,
    playerId: 'diver_1',
    displayName: 'Nadia',
  });
  const avatar = store.buildSessionSnapshot(PUBLIC_OPEN_WORLD_SESSION_ID)!.players[0].avatar;
  const t0 = Date.now();

  const surfaceSub = store.updateRemotePlayerState(
    PUBLIC_OPEN_WORLD_SESSION_ID,
    'diver_1',
    {
      position: { x: 145, y: -1.2, z: 56 },
      rotation: { yaw: 0 },
      movementState: 'driving',
      vehicleKind: 'submarine',
      currentBuilding: null,
      currentFloor: 1,
      currentActivity: 'Diving Submarine',
      avatar,
    },
    t0,
  );
  assert.ok(surfaceSub);
  assert.equal(surfaceSub.position.y, -1.2);

  const deepDive = store.updateRemotePlayerState(
    PUBLIC_OPEN_WORLD_SESSION_ID,
    'diver_1',
    {
      position: { x: 162, y: -12.8, z: 58 },
      rotation: { yaw: -1.4 },
      movementState: 'diving',
      vehicleKind: null,
      currentBuilding: null,
      currentFloor: 1,
      currentActivity: 'Diving Ocean Reef',
      avatar,
    },
    t0 + 2500,
  );
  assert.ok(deepDive);
  assert.equal(deepDive.position.y, -12.8);
  assert.equal(deepDive.movementState, 'diving');
});

test('resolveCallerAuthorization keeps unverified emails strictly as students while allowing verified teachers', () => {
  const store = new GameBackendStore({ persistPath: null });

  const unverifiedStudent = resolveCallerAuthorization(
    { email: 'student@school.edu', emailVerified: false },
    store,
  );
  assert.equal(unverifiedStudent.role, 'student');
  assert.equal(unverifiedStudent.canAccessTeacherTools, false);

  const unverifiedSpoof = resolveCallerAuthorization(
    { email: BOOTSTRAPPED_TEACHER_EMAIL, emailVerified: false },
    store,
  );
  assert.equal(unverifiedSpoof.role, 'student');
  assert.equal(unverifiedSpoof.isBootstrappedTeacher, false);
  assert.equal(unverifiedSpoof.canAccessTeacherTools, false);

  const verifiedTeacher = resolveCallerAuthorization(
    { email: BOOTSTRAPPED_TEACHER_EMAIL, emailVerified: true },
    store,
  );
  assert.equal(verifiedTeacher.role, 'teacher');
  assert.equal(verifiedTeacher.isBootstrappedTeacher, true);
  assert.equal(verifiedTeacher.canAccessTeacherTools, true);
});

test('formatFirebaseAuthError maps unauthorized-domain cleanly without raw Firebase prefix', () => {
  const fromCode = formatFirebaseAuthError({ code: 'auth/unauthorized-domain' });
  assert.equal(fromCode.includes('Firebase:'), false);
  assert.ok(fromCode.includes('Email & Kata Sandi'));
  assert.ok(fromCode.includes('Authorized domains'));

  const fromWrappedMessage = formatFirebaseAuthError(
    new Error('Firebase: Error (auth/unauthorized-domain).'),
  );
  assert.equal(fromWrappedMessage.includes('Firebase:'), false);
  assert.ok(fromWrappedMessage.includes('Email & Kata Sandi'));

  const fromUnknownFirebase = formatFirebaseAuthError(
    new Error('Firebase: Error (auth/something-new-unexpected).'),
  );
  assert.equal(fromUnknownFirebase.includes('Firebase:'), false);
});

test('GameBackendStore replaceQuestionDatabase sanitizes placementScope, targetBuildingId, and floorPlacement', () => {
  const store = new GameBackendStore({ persistPath: null });
  const db = store.getFullDatabase();
  const mutated = {
    ...db,
    questions: [
      {
        ...db.questions[0],
        placementScope: 'indoor' as const,
        targetBuildingId: 'freedom_tower',
        floorPlacement: 22,
      },
      {
        ...db.questions[1],
        placementScope: 'invalid_scope' as unknown as 'both',
        targetBuildingId: 'bad target with spaces!',
        floorPlacement: 99,
      },
    ],
  };

  const saved = store.replaceQuestionDatabase(mutated);
  assert.equal(saved.questions[0].placementScope, 'indoor');
  assert.equal(saved.questions[0].targetBuildingId, 'freedom_tower');
  assert.equal(saved.questions[0].floorPlacement, 22);

  assert.equal(saved.questions[1].placementScope, 'both');
  assert.equal(saved.questions[1].targetBuildingId, null);
  assert.equal(saved.questions[1].floorPlacement, null);
});
