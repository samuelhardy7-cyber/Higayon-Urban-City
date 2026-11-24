import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTrafficSignalState, stepTrafficAndPolice } from './trafficSystem';
import { createInitialVehicles } from './vehicleData';
import { resolveVehicleWorldCollision } from './vehiclePhysics';
import { CITY_LAYOUT } from './worldData';

describe('trafficSystem & police chase AI', () => {
  it('alternates intersection traffic signals deterministically between NS and EW green', () => {
    const ns = getTrafficSignalState(2.0);
    assert.equal(ns.nsGreen, true);
    assert.equal(ns.ewGreen, false);

    const ew = getTrafficSignalState(10.0);
    assert.equal(ew.nsGreen, false);
    assert.equal(ew.ewGreen, true);
  });

  it('advances traffic along road lanes without colliding into buildings', () => {
    const vehicles = createInitialVehicles(CITY_LAYOUT);
    const trf1 = vehicles.find((v) => v.id === 'trf_1')!;
    const startX = trf1.x;
    const startZ = trf1.z;

    for (let step = 0; step < 80; step++) {
      stepTrafficAndPolice(vehicles, 0.04, step * 0.04, 0, 0, 16, false, CITY_LAYOUT);
    }

    const movedDist = Math.hypot(trf1.x - startX, trf1.z - startZ);
    assert.ok(movedDist > 5, `expected traffic car to advance > 5m, moved ${movedDist}`);

    for (const v of vehicles) {
      if (v.occupant === 'traffic' || v.occupant === 'police') {
        const col = resolveVehicleWorldCollision({ ...v }, CITY_LAYOUT);
        assert.equal(col.collided, false, `AI vehicle ${v.id} clipped a building`);
      }
    }
  });

  it('activates police pursuit toward player when wantedLevel >= 1 without freezing against walls', () => {
    const vehicles = createInitialVehicles(CITY_LAYOUT);
    const pol1 = vehicles.find((v) => v.id === 'pol_1')!;
    const startDist = Math.hypot(pol1.x - 0, pol1.z - 16);

    for (let step = 0; step < 120; step++) {
      stepTrafficAndPolice(vehicles, 0.04, step * 0.04, 2, 0, 16, true, CITY_LAYOUT);
    }

    const endDist = Math.hypot(pol1.x - 0, pol1.z - 16);
    assert.ok(endDist < startDist, `expected police cruiser to close distance (${startDist} -> ${endDist})`);
    assert.ok(pol1.sirenPhase > 0, 'expected police siren phase advancing during pursuit');
  });
});
