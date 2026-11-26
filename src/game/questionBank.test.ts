import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveQuestionKpReward } from './rewardShopCatalog';
import { createInteriorBlueprintForEntrance } from './interiorData';
import {
  commitImportedDrafts,
  createInitialPlayerQuizProgress,
  createSeedQuestionDatabase,
  evaluatePlayerSubmission,
  generateCsvTemplate,
  generateJsonTemplate,
  parseBulkImport,
  toPlayerQuestion,
  validateQuestionInput,
} from './questionBank';
import {
  createInteriorKioskPlacements,
  createOutdoorKioskPlacements,
  getActiveQuestions,
  getPlacementTargetLabel,
  getPlacementTargetOptions,
  getQuestionsForPlacement,
} from './questionPlacement';
import { createLocalQuestionRepository } from './questionRepository';
import type { QuestionDraftInput } from './questionTypes';
import { parseSaveData, type StorageLike } from './saveSystem';
import { CITY_LAYOUT } from './worldData';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test('validateQuestionInput catches empty text, incomplete options, invalid answer, and duplicate IDs', () => {
  const db = createSeedQuestionDatabase();
  const baseDraft: QuestionDraftInput = {
    id: '',
    subjectId: 'subj_math',
    topic: '',
    type: 'multiple_choice',
    questionText: '   ',
    optionA: '10',
    optionB: '',
    optionC: '30',
    optionD: '',
    correctAnswer: '',
    explanation: '',
    difficulty: 'easy',
    points: 0,
    buildingCategory: 'commercial',
    floorPlacement: 1,
    questionSetId: 'set_city_core',
  };

  const invalidRes = validateQuestionInput(baseDraft, db.questions);
  assert.equal(invalidRes.valid, false);
  assert.ok(invalidRes.fieldErrors.id);
  assert.ok(invalidRes.fieldErrors.questionText);
  assert.ok(invalidRes.fieldErrors.options);
  assert.ok(invalidRes.fieldErrors.correctAnswer);
  assert.ok(invalidRes.fieldErrors.points);

  // Duplicate ID detection (case-insensitive)
  const dupDraft: QuestionDraftInput = {
    ...baseDraft,
    id: 'math-101',
    topic: 'Multiplication',
    questionText: 'What is 2 × 6?',
    optionA: '10',
    optionB: '12',
    optionC: '14',
    optionD: '16',
    correctAnswer: 'B',
    points: 20,
  };
  const dupRes = validateQuestionInput(dupDraft, db.questions);
  assert.equal(dupRes.valid, false);
  assert.ok(dupRes.fieldErrors.id?.includes('Duplicate'));

  // Allowed when editing the same question ID
  const editRes = validateQuestionInput(dupDraft, db.questions, 'MATH-101');
  assert.equal(editRes.valid, true);
});

test('Bulk CSV & JSON import handles templates, quoted commas, custom subjects, and row validation errors', () => {
  const db = createSeedQuestionDatabase();

  // Valid CSV template import
  const csvTemplate = generateCsvTemplate();
  const csvRes = parseBulkImport(csvTemplate, 'csv', db, 'set_city_core');
  assert.equal(csvRes.errors.length, 0);
  assert.equal(csvRes.validRows.length, 2);

  // Valid JSON template import
  const jsonTemplate = generateJsonTemplate();
  const jsonRes = parseBulkImport(jsonTemplate, 'json', db, 'set_city_core');
  assert.equal(jsonRes.errors.length, 0);
  assert.equal(jsonRes.validRows.length, 2);

  // Custom subject + quoted commas + invalid rows + intra-batch duplicate ID + existing ID collision
  const mixedCsv = [
    'id,subject,topic,type,questionText,optionA,optionB,optionC,optionD,correctAnswer,explanation,difficulty,points,buildingCategory,floorPlacement',
    'PHY-301,Physics,Optics,multiple_choice,"Light bends when entering water, which is called...",Reflection,Refraction,Diffraction,Dispersion,B,"Refraction is wave bending across media.",medium,25,business,2',
    'MATH-101,Mathematics,Addition,multiple_choice,Existing ID collision,1,2,3,4,A,,easy,10,any,',
    'PHY-301,Physics,Motion,true_false,Duplicate inside same CSV,True,False,,,A,,easy,10,any,',
    'BAD-001,Science,Matter,multiple_choice,,A,B,C,,Z,,easy,15,residential,1',
  ].join('\n');

  const mixedRes = parseBulkImport(mixedCsv, 'csv', db, 'set_city_core');
  assert.equal(mixedRes.validRows.length, 1);
  assert.equal(mixedRes.validRows[0].id, 'PHY-301');
  assert.equal(mixedRes.errors.length, 3);
  assert.ok(mixedRes.errors[0].messages.some((m) => m.includes('already exists in the question bank')));
  assert.ok(mixedRes.errors[1].messages.some((m) => m.includes('Duplicate Question ID')));
  assert.ok(mixedRes.errors[2].messages.some((m) => m.includes('Question text cannot be empty')));

  // Committing valid rows auto-creates custom Subject & Topic
  const updatedDb = commitImportedDrafts(db, mixedRes.validRows);
  const physicsSubj = updatedDb.subjects.find((s) => s.name === 'Physics');
  assert.ok(physicsSubj, 'Custom Physics subject should be auto-created');
  assert.ok(physicsSubj.topics.includes('Optics'));
  assert.ok(updatedDb.questions.some((q) => q.id === 'PHY-301'));
});

test('Security DTO strips answer key & explanation; submission handles retries, rewards, and lockouts', () => {
  const db = createSeedQuestionDatabase();
  let progress = createInitialPlayerQuizProgress();
  const target = db.questions.find((q) => q.id === 'MATH-101')!;

  const challenge = toPlayerQuestion(target, db, progress);
  assert.equal('correctAnswer' in challenge, false);
  assert.equal('explanation' in challenge, false);
  assert.equal(challenge.options.length, 4);

  // Wrong answer while retries are allowed: 0 points, no explanation leaked
  const wrong1 = evaluatePlayerSubmission(db, progress, 'MATH-101', 'A');
  assert.equal(wrong1.outcome.isCorrect, false);
  assert.equal(wrong1.outcome.pointsAwarded, 0);
  assert.equal(wrong1.outcome.allowRetry, true);
  assert.equal(wrong1.outcome.explanation, null);
  progress = wrong1.nextProgress;

  // Correct answer awards configured KP difficulty reward & cash bonus and reveals explanation
  const expectedKp = resolveQuestionKpReward(target, db.teacherConfig);
  const right1 = evaluatePlayerSubmission(db, progress, 'MATH-101', 'B');
  assert.equal(right1.outcome.isCorrect, true);
  assert.equal(right1.outcome.pointsAwarded, expectedKp);
  assert.equal(right1.outcome.cashBonusAwarded, expectedKp);
  assert.ok(right1.outcome.explanation?.includes('32'));
  progress = right1.nextProgress;
  assert.equal(progress.earnedPoints, expectedKp);

  // Re-answering same completed question does not double-award points
  const replay = evaluatePlayerSubmission(db, progress, 'MATH-101', 'B');
  assert.equal(replay.outcome.isCorrect, true);
  assert.equal(replay.outcome.alreadyCompleted, true);
  assert.equal(replay.outcome.pointsAwarded, 0);
  assert.equal(replay.nextProgress.earnedPoints, expectedKp);

  // Disallow retry locks question on wrong answer
  const strictDb = {
    ...db,
    teacherConfig: {
      ...db.teacherConfig,
      allowRetryOnWrong: false,
      showExplanationOnWrong: false,
    },
  };
  const strictWrong = evaluatePlayerSubmission(strictDb, progress, 'SCI-101', 'D');
  assert.equal(strictWrong.outcome.isCorrect, false);
  assert.equal(strictWrong.outcome.locked, true);
  assert.equal(strictWrong.outcome.allowRetry, false);
  assert.equal(strictWrong.outcome.explanation, null);
  assert.ok(strictWrong.nextProgress.lockedQuestionIds.includes('SCI-101'));
});

test('Active/inactive Question Sets and building/floor placements filter world & interior kiosks accurately', () => {
  const db = createSeedQuestionDatabase();
  const progress = createInitialPlayerQuizProgress();

  // Deactivate set_values_stem
  const filteredDb = {
    ...db,
    questionSets: db.questionSets.map((s) =>
      s.id === 'set_values_stem' ? { ...s, isActive: false } : s,
    ),
  };
  const active = getActiveQuestions(filteredDb);
  assert.ok(active.every((q) => q.questionSetId !== 'set_values_stem'));

  // Outdoor kiosks reflect active questions and stay clear of building doors
  const outdoorKiosks = createOutdoorKioskPlacements(filteredDb, progress, CITY_LAYOUT);
  assert.ok(outdoorKiosks.length >= 4);
  for (const okiosk of outdoorKiosks) {
    for (const ent of CITY_LAYOUT.entrances) {
      const distToDoor = Math.hypot(okiosk.x - ent.doorX, okiosk.z - ent.doorZ);
      assert.ok(distToDoor >= 2.5, `Kiosk ${okiosk.id} too close to ${ent.id}`);
    }
  }

  // Multi-floor building interior places floor-matched kiosks on valid walkable spots
  const towerEntrance = CITY_LAYOUT.entrances.find((e) => e.category === 'business')!;
  assert.ok(towerEntrance, 'Expected a business entrance in CITY_LAYOUT');
  const towerBlueprint = createInteriorBlueprintForEntrance(towerEntrance);
  const fullFloor2Questions = getQuestionsForPlacement(db, 'business', 2);
  assert.ok(fullFloor2Questions.some((q) => q.id === 'SCI-101'));

  const interiorKiosks = createInteriorKioskPlacements(towerBlueprint, towerEntrance, db, progress);
  assert.ok(interiorKiosks.length >= 2);
  for (const k of interiorKiosks) {
    assert.ok(k.x >= towerBlueprint.bounds.minX && k.x <= towerBlueprint.bounds.maxX);
    assert.ok(k.z >= towerBlueprint.bounds.minZ && k.z <= towerBlueprint.bounds.maxZ);
  }
});

test('Question repository and SaveGameData persist custom bank & quiz progress independently', () => {
  const storage = createMemoryStorage();
  const repo = createLocalQuestionRepository(storage);

  const db = repo.loadDatabase();
  const customDb = {
    ...db,
    subjects: [
      ...db.subjects,
      { id: 'subj_art', name: 'Art & Design', color: '#f472b6', topics: ['Color Theory'] },
    ],
  };
  assert.equal(repo.saveDatabase(customDb), true);

  // Reloading from repository restores custom subject
  const reloaded = repo.loadDatabase();
  assert.ok(reloaded.subjects.some((s) => s.name === 'Art & Design'));

  // Save & parse player quiz progress via SaveGameData
  const rawSave = JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    money: 500,
    health: 100,
    completedMissionIds: [],
    progression: {},
    settings: {},
    quizProgress: {
      completedQuestionIds: ['MATH-101'],
      lockedQuestionIds: [],
      earnedPoints: 20,
      history: [
        {
          questionId: 'MATH-101',
          selectedAnswer: 'B',
          isCorrect: true,
          pointsAwarded: 20,
          attemptedAt: Date.now(),
        },
      ],
    },
  });
  const parsedSave = parseSaveData(rawSave);
  assert.ok(parsedSave?.quizProgress);
  assert.equal(parsedSave?.quizProgress?.earnedPoints, 20);
  assert.deepEqual(parsedSave?.quizProgress?.completedQuestionIds, ['MATH-101']);

  // Resetting student progress preserves Teacher's custom subjects/questions
  const resetProgress = repo.resetPlayerProgress();
  assert.equal(resetProgress.earnedPoints, 0);
  assert.ok(repo.loadDatabase().subjects.some((s) => s.name === 'Art & Design'));
});

test('Teacher placementScope and targetBuildingId restrict outdoor and indoor kiosks accurately', () => {
  const db = createSeedQuestionDatabase();
  const progress = createInitialPlayerQuizProgress();
  const targetOpts = getPlacementTargetOptions(CITY_LAYOUT);
  assert.ok(targetOpts.outdoorKiosks.length >= 5);
  assert.ok(targetOpts.buildings.some((b) => b.id === 'freedom_tower'));
  assert.equal(getPlacementTargetLabel('kiosk_avenue_hub', CITY_LAYOUT), 'City Avenue Knowledge Hub');
  assert.ok(getPlacementTargetLabel('freedom_tower', CITY_LAYOUT));

  const towerEntrance = CITY_LAYOUT.entrances.find((e) => e.buildingId === 'freedom_tower')!;
  const otherBusinessEntrance = CITY_LAYOUT.entrances.find(
    (e) => e.category === 'business' && e.buildingId !== 'freedom_tower',
  );
  const towerBlueprint = createInteriorBlueprintForEntrance(towerEntrance);

  const customDb = {
    ...db,
    questions: [
      {
        ...db.questions[0],
        id: 'INDOOR-ONLY-TOWER',
        placementScope: 'indoor' as const,
        targetBuildingId: 'freedom_tower',
        buildingCategory: 'business' as const,
        floorPlacement: 3,
      },
      {
        ...db.questions[1],
        id: 'OUTDOOR-ONLY-HUB',
        placementScope: 'outdoor' as const,
        targetBuildingId: 'kiosk_avenue_hub',
        buildingCategory: 'any' as const,
        floorPlacement: null,
      },
    ],
  };

  // Outdoor kiosks must include OUTDOOR-ONLY-HUB on kiosk_avenue_hub and exclude indoor-only questions
  const outdoor = createOutdoorKioskPlacements(customDb, progress, CITY_LAYOUT);
  const avenueKiosk = outdoor.find((k) => k.id === 'kiosk_avenue_hub');
  assert.ok(avenueKiosk);
  assert.ok(avenueKiosk.questionIds.includes('OUTDOOR-ONLY-HUB'));
  assert.ok(outdoor.every((k) => !k.questionIds.includes('INDOOR-ONLY-TOWER')));

  // Floor 3 inside freedom_tower receives INDOOR-ONLY-TOWER, excluding outdoor-only questions
  const towerKiosks = createInteriorKioskPlacements(towerBlueprint, towerEntrance, customDb, progress);
  const floor3Kiosks = towerKiosks.filter((k) => k.floorNumber === 3);
  assert.ok(floor3Kiosks.some((k) => k.questionIds.includes('INDOOR-ONLY-TOWER')));
  assert.ok(towerKiosks.every((k) => !k.questionIds.includes('OUTDOOR-ONLY-HUB')));

  // Other business building must NOT receive question pinned specifically to freedom_tower
  if (otherBusinessEntrance) {
    const otherBlueprint = createInteriorBlueprintForEntrance(otherBusinessEntrance);
    const otherKiosks = createInteriorKioskPlacements(
      otherBlueprint,
      otherBusinessEntrance,
      customDb,
      progress,
    );
    assert.ok(otherKiosks.every((k) => !k.questionIds.includes('INDOOR-ONLY-TOWER')));
  }
});
