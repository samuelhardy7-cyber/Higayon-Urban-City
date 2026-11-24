import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefaultSettings, createInitialProgressionState } from './progressionSystem';
import {
  clearSavedGame,
  hasSavedGame,
  loadGameFromStorage,
  parseSaveData,
  saveGameToStorage,
  type StorageLike,
} from './saveSystem';
import type { SaveGameData } from './types';

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

describe('saveSystem localStorage persistence', () => {
  it('saves, detects, loads, and clears valid game progression', () => {
    const storage = createMemoryStorage();
    assert.equal(hasSavedGame(storage), false);

    const prog = createInitialProgressionState();
    prog.ownedVehicles.push('sports');
    prog.activeGarageVehicle = 'sports';
    prog.vehicleUpgrades.sports.engine = 2;
    prog.customization.outfitId = 'metro_blazer';
    prog.customization.accessoryId = 'shades';

    const savePayload: SaveGameData = {
      version: 1,
      savedAt: 1700000000000,
      money: 2450,
      health: 86,
      completedMissionIds: ['delivery_port', 'race_coastal'],
      progression: prog,
      settings: { ...createDefaultSettings(), musicEnabled: false, graphicsQuality: 'high' },
      playerPos: { x: 14, y: 0, z: -8, yaw: 1.2 },
    };

    assert.equal(saveGameToStorage(savePayload, storage), true);
    assert.equal(hasSavedGame(storage), true);

    const loaded = loadGameFromStorage(storage);
    assert.ok(loaded);
    assert.equal(loaded.money, 2450);
    assert.equal(loaded.health, 86);
    assert.deepEqual(loaded.completedMissionIds, ['delivery_port', 'race_coastal']);
    assert.equal(loaded.progression.activeGarageVehicle, 'sports');
    assert.equal(loaded.progression.vehicleUpgrades.sports.engine, 2);
    assert.equal(loaded.progression.customization.outfitId, 'metro_blazer');
    assert.equal(loaded.settings.musicEnabled, false);
    assert.equal(loaded.settings.graphicsQuality, 'high');
    assert.equal(loaded.playerPos?.x, 14);

    clearSavedGame(storage);
    assert.equal(hasSavedGame(storage), false);
    assert.equal(loadGameFromStorage(storage), null);
  });

  it('rejects corrupt JSON or incompatible save versions safely', () => {
    assert.equal(parseSaveData('{bad json'), null);
    assert.equal(parseSaveData(JSON.stringify({ version: 99, money: 500 })), null);
  });
});
