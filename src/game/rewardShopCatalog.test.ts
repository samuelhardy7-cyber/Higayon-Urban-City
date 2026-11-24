import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChallengeSessionState, DEFAULT_CHALLENGE_SETTINGS } from './challengeSystem';
import type { RemotePlayerState } from './multiplayerTypes';
import { createDefaultTeacherConfig } from './questionBank';
import {
  DEFAULT_KP_DIFFICULTY_REWARDS,
  REWARD_SHOP_CATALOG,
  STARTER_OWNED_ITEM_IDS,
  applyShopItemToCustomization,
  createDefaultCharacterCustomization,
  evaluateEarnedBadges,
  getEffectiveShopCatalog,
  resolveQuestionKpReward,
} from './rewardShopCatalog';
import {
  DEFAULT_SOCIAL_CONFIG,
  MAX_GROUP_MEMBERS,
  createSocialGroup,
  filterVisibleChatMessages,
  joinSocialGroup,
  leaveSocialGroup,
  validateAndFilterChatMessage,
} from './socialSystem';

test('KP reward calculation respects difficulty table and teacher overrides', () => {
  const defaultCfg = createDefaultTeacherConfig();
  assert.equal(DEFAULT_KP_DIFFICULTY_REWARDS.easy, 10);
  assert.equal(DEFAULT_KP_DIFFICULTY_REWARDS.medium, 20);
  assert.equal(DEFAULT_KP_DIFFICULTY_REWARDS.hard, 30);
  assert.equal(DEFAULT_KP_DIFFICULTY_REWARDS.special, 50);

  assert.equal(resolveQuestionKpReward({ difficulty: 'easy', points: 5 }, defaultCfg), 10);
  assert.equal(resolveQuestionKpReward({ difficulty: 'medium', points: 5 }, defaultCfg), 20);
  assert.equal(resolveQuestionKpReward({ difficulty: 'hard', points: 5 }, defaultCfg), 30);
  assert.equal(resolveQuestionKpReward({ difficulty: 'special', points: 5 }, defaultCfg), 50);

  const customCfg = {
    ...defaultCfg,
    kpRewards: { easy: 15, medium: 25, hard: 40, special: 75 },
  };
  assert.equal(resolveQuestionKpReward({ difficulty: 'special', points: 10 }, customCfg), 75);

  const perQuestionCfg = {
    ...defaultCfg,
    useDifficultyKpTable: false,
  };
  assert.equal(resolveQuestionKpReward({ difficulty: 'easy', points: 42 }, perQuestionCfg), 42);
});

test('Reward shop catalog applies teacher overrides and customization updates', () => {
  const effective = getEffectiveShopCatalog({
    char_leo: { priceKp: 95, enabled: false },
  });
  const leo = effective.find((i) => i.id === 'char_leo');
  assert.ok(leo);
  assert.equal(leo.priceKp, 95);
  assert.equal(leo.enabled, false);

  const base = createDefaultCharacterCustomization();
  const hairItem = REWARD_SHOP_CATALOG.find((i) => i.id === 'hair_curly')!;
  const updated = applyShopItemToCustomization(base, hairItem);
  assert.equal(updated.hairStyle, 'curly');
  assert.ok(updated.ownedItemIds?.includes('hair_curly'));
});

test('Achievement badges evaluate deterministically from progression stats', () => {
  assert.deepEqual(
    evaluateEarnedBadges({
      lifetimeKpEarned: 0,
      completedQuestionsCount: 0,
      towerMaxFloor: 1,
      ownedItemIds: STARTER_OWNED_ITEM_IDS,
    }),
    [],
  );

  const allEarned = evaluateEarnedBadges({
    lifetimeKpEarned: 120,
    completedQuestionsCount: 6,
    towerMaxFloor: 14,
    ownedItemIds: [...STARTER_OWNED_ITEM_IDS, 'char_leo', 'hair_curly', 'hair_fade'],
  });
  assert.ok(allEarned.includes('badge_first_kp'));
  assert.ok(allEarned.includes('badge_scholar_5'));
  assert.ok(allEarned.includes('badge_tower_climber'));
  assert.ok(allEarned.includes('badge_collector'));
  assert.ok(allEarned.includes('badge_kp_100'));
});

test('Safe filtered chat redacts profanity, blocks PII/links, allows KP numbers, and respects mute', () => {
  const t0 = 1_000_000;

  // Normal educational message with short numbers allowed
  const ok = validateAndFilterChatMessage('Meet on Floor 22 for +10 KP!', undefined, t0, DEFAULT_SOCIAL_CONFIG);
  assert.equal(ok.allowed, true);
  assert.equal(ok.redacted, false);

  // Profanity redacted cleanly
  const prof = validateAndFilterChatMessage('This is shit right now', undefined, t0, DEFAULT_SOCIAL_CONFIG);
  assert.equal(prof.allowed, true);
  assert.equal(prof.redacted, true);
  assert.ok(prof.text.includes('*'));

  // Email / phone / external links / external apps blocked
  assert.equal(validateAndFilterChatMessage('Email me at kid@example.com', undefined, t0).allowed, false);
  assert.equal(validateAndFilterChatMessage('Call 08123456789', undefined, t0).allowed, false);
  assert.equal(validateAndFilterChatMessage('Check https://evil.test/free', undefined, t0).allowed, false);
  assert.equal(validateAndFilterChatMessage('Add my whatsapp please', undefined, t0).allowed, false);

  // Rate-limiting
  assert.equal(validateAndFilterChatMessage('Second message too fast', t0, t0 + 400).allowed, false);

  // Mute filtering
  const visible = filterVisibleChatMessages(
    [
      { id: '1', sessionId: 's1', senderPlayerId: 'p1', senderName: 'A', text: 'Hi', createdAt: 1 },
      { id: '2', sessionId: 's1', senderPlayerId: 'p2', senderName: 'B', text: 'Spam', createdAt: 2 },
    ],
    new Set(['p2']),
  );
  assert.equal(visible.length, 1);
  assert.equal(visible[0].senderPlayerId, 'p1');
});

test('Exploration groups enforce max 5 members and reassign leader on leave', () => {
  const created = createSocialGroup([], 'p1', 'Skyline Squad', 1000);
  let groups = created.groups;
  const gid = created.group.id;

  for (const pid of ['p2', 'p3', 'p4', 'p5']) {
    const res = joinSocialGroup(groups, pid, gid);
    assert.equal(res.joined, true);
    groups = res.groups;
  }
  assert.equal(groups[0].memberPlayerIds.length, MAX_GROUP_MEMBERS);

  // 6th member is rejected
  const full = joinSocialGroup(groups, 'p6', gid);
  assert.equal(full.joined, false);

  // Leader p1 leaves -> p2 becomes leader
  groups = leaveSocialGroup(groups, 'p1');
  assert.equal(groups[0].leaderPlayerId, 'p2');
  assert.equal(groups[0].memberPlayerIds.length, 4);
});

test('Challenge session state ranks players and teams accurately', () => {
  const avatar = createDefaultCharacterCustomization();
  const players: RemotePlayerState[] = [
    {
      playerId: 'p1',
      displayName: 'Alex',
      avatar,
      position: { x: 0, y: 0, z: 0 },
      rotation: { yaw: 0 },
      movementState: 'idle',
      vehicleKind: null,
      currentBuilding: 'freedom_tower',
      currentFloor: 22,
      currentActivity: 'Rooftop',
      connectionStatus: 'online',
      questionsCompleted: 4,
      pointsEarned: 80,
      updatedAt: 1000,
    },
    {
      playerId: 'p2',
      displayName: 'Maya',
      avatar,
      position: { x: 2, y: 0, z: 0 },
      rotation: { yaw: 0 },
      movementState: 'idle',
      vehicleKind: null,
      currentBuilding: 'freedom_tower',
      currentFloor: 10,
      currentActivity: 'Lobby',
      connectionStatus: 'online',
      questionsCompleted: 5,
      pointsEarned: 110,
      updatedAt: 1000,
    },
  ];
  const groups = [
    {
      id: 'g1',
      name: 'Alpha',
      leaderPlayerId: 'p1',
      memberPlayerIds: ['p1', 'p2'],
      createdAt: 500,
    },
  ];

  const race = buildChallengeSessionState(
    DEFAULT_CHALLENGE_SETTINGS,
    players,
    groups,
    {
      p1: { kpEarned: 80, questionsCompleted: 4, towerMaxFloor: 22 },
      p2: { kpEarned: 110, questionsCompleted: 5, towerMaxFloor: 10 },
    },
    600,
  );
  assert.equal(race.leaderboard[0].playerId, 'p2');
  assert.equal(race.leaderboard[0].completionStatus, 'completed');
  assert.equal(race.teamScores[0].totalKp, 190);

  const towerChallenge = buildChallengeSessionState(
    {
      ...DEFAULT_CHALLENGE_SETTINGS,
      mode: 'city_tower_challenge',
      targetQuestions: 3,
    },
    players,
    groups,
    {
      p1: { kpEarned: 80, questionsCompleted: 4, towerMaxFloor: 22 },
      p2: { kpEarned: 110, questionsCompleted: 5, towerMaxFloor: 10 },
    },
    600,
  );
  assert.equal(towerChallenge.leaderboard[0].playerId, 'p1');
  assert.equal(towerChallenge.leaderboard[0].completionStatus, 'completed');
});
