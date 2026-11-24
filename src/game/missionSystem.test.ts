import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addWantedHeat,
  createInitialMissionRuntime,
  MISSION_DEFINITIONS,
  startMission,
  stepMissionAndWanted,
} from './missionSystem';
import { CITY_LAYOUT, resolveCircleAABBCollision } from './worldData';

describe('missionSystem & wantedLevel', () => {
  it('places all mission starts and checkpoints clear of buildings', () => {
    assert.equal(MISSION_DEFINITIONS.length, 3);
    const types = new Set(MISSION_DEFINITIONS.map((m) => m.type));
    assert.deepEqual(types, new Set(['delivery', 'race', 'escape']));

    for (const m of MISSION_DEFINITIONS) {
      const startCol = resolveCircleAABBCollision(m.startX, m.startZ, 0.5, 0, 1.8, CITY_LAYOUT);
      assert.equal(startCol.collided, false, `mission ${m.id} start overlaps collider`);
      for (const cp of m.checkpoints) {
        const cpCol = resolveCircleAABBCollision(cp.x, cp.z, 0.5, 0, 1.8, CITY_LAYOUT);
        assert.equal(cpCol.collided, false, `mission ${m.id} checkpoint ${cp.label} overlaps collider`);
      }
    }
  });

  it('completes checkpoint race across all gates and awards cash reward', () => {
    const runtime = createInitialMissionRuntime();
    const race = MISSION_DEFINITIONS.find((m) => m.type === 'race')!;
    const active = startMission(runtime, race.id);
    assert.ok(active);

    for (let i = 0; i < race.checkpoints.length; i++) {
      const cp = race.checkpoints[i];
      const res = stepMissionAndWanted(runtime, cp.x, cp.z, [], 0.04);
      if (i < race.checkpoints.length - 1) {
        assert.equal(res.checkpointReached, true);
        assert.equal(runtime.activeMission?.checkpointIndex, i + 1);
      } else {
        assert.equal(res.missionCompleted, true);
        assert.equal(runtime.activeMission, null);
        assert.equal(runtime.money, race.reward);
        assert.equal(runtime.missionBanner?.status, 'completed');
      }
    }
  });

  it('fails mission when timer reaches zero and clears escape wanted stars on completion', () => {
    const runtime = createInitialMissionRuntime();
    const esc = MISSION_DEFINITIONS.find((m) => m.type === 'escape')!;
    startMission(runtime, esc.id);
    assert.equal(runtime.wantedLevel, 2);

    // Complete escape at Safe House
    const target = esc.checkpoints[0];
    const done = stepMissionAndWanted(runtime, target.x, target.z, [], 0.04);
    assert.equal(done.missionCompleted, true);
    assert.equal(runtime.wantedLevel, 0);
    assert.equal(runtime.money, esc.reward);

    // Verify failure on timeout for delivery
    const del = MISSION_DEFINITIONS.find((m) => m.type === 'delivery')!;
    startMission(runtime, del.id);
    runtime.activeMission!.timeRemaining = 0.02;
    const fail = stepMissionAndWanted(runtime, 0, 0, [], 0.04);
    assert.equal(fail.missionFailed, true);
    assert.equal(runtime.missionBanner?.status, 'failed');
  });

  it('scales wanted level 1..3 and cools down when distant from police', () => {
    const runtime = createInitialMissionRuntime();
    addWantedHeat(runtime, 1.0);
    assert.equal(runtime.wantedLevel, 1);
    addWantedHeat(runtime, 1.5);
    assert.equal(runtime.wantedLevel, 3);

    // Cool down when no police are nearby
    runtime.wantedEscapeTimer = 0.01;
    stepMissionAndWanted(runtime, 0, 0, [], 0.04);
    assert.equal(runtime.wantedLevel, 2);
  });
});
