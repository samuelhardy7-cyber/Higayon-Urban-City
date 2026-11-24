import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialExplorationTracker,
  evaluateExplorationObjectives,
  recordVisitedBuilding,
} from './explorationObjectives';
import { createInitialPlayerQuizProgress, createSeedQuestionDatabase } from './questionBank';

test('explorationObjectives tracks math/science solves, buildings discovered, CITY TOWER, and Rooftop Floor 22', () => {
  const db = createSeedQuestionDatabase();
  const progress = createInitialPlayerQuizProgress();
  const tracker = createInitialExplorationTracker();

  const initial = evaluateExplorationObjectives(db, progress, tracker);
  assert.equal(initial.length, 6);
  assert.ok(initial.every((o) => !o.completed));

  // Visit Urban Mart & CITY TOWER up to Floor 22
  recordVisitedBuilding(tracker, 'urban_mart', 1);
  recordVisitedBuilding(tracker, 'freedom_tower', 22);

  // Complete 5 Math & 3 Science questions including upper floor & Floor 22 Rooftop
  const mathIds = db.questions.filter((q) => q.subjectName === 'Mathematics').map((q) => q.id);
  const sciIds = db.questions.filter((q) => q.subjectName === 'Science').map((q) => q.id);
  assert.ok(mathIds.length >= 5, 'Seed DB should contain >= 5 Mathematics questions');
  assert.ok(sciIds.length >= 3, 'Seed DB should contain >= 3 Science questions');
  assert.ok(
    db.questions.some((q) => q.floorPlacement === 22),
    'Seed DB should include a Floor 22 Rooftop question',
  );

  progress.completedQuestionIds = [...mathIds.slice(0, 5), ...sciIds.slice(0, 3)];
  const done = evaluateExplorationObjectives(db, progress, tracker);
  for (const obj of done) {
    assert.equal(obj.completed, true, `Expected objective ${obj.id} to be completed`);
  }
});
