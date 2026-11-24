import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInitialProgressionState,
  evaluateChallenges,
  getUpgradedVehicleSpec,
  purchaseOrEquipAccessory,
  purchaseOrEquipOutfit,
  purchaseVehicle,
  purchaseVehicleUpgrade,
  recordVisitedDistrict,
  selectGarageVehicle,
} from './progressionSystem';

describe('progressionSystem & economy', () => {
  it('purchases and selects vehicles when player has sufficient funds', () => {
    const prog = createInitialProgressionState();
    let money = 500;

    // Cannot afford Apex GT ($1500)
    const failRes = purchaseVehicle(money, prog, 'sports');
    assert.equal(failRes.success, false);
    assert.equal(failRes.money, 500);
    assert.ok(!prog.ownedVehicles.includes('sports'));

    // Can afford Street Moto ($450)
    const buyMoto = purchaseVehicle(money, prog, 'motor');
    assert.equal(buyMoto.success, true);
    assert.equal(buyMoto.money, 50);
    assert.ok(prog.ownedVehicles.includes('motor'));
    assert.equal(prog.activeGarageVehicle, 'motor');

    // Switch back to starter sedan
    assert.equal(selectGarageVehicle(prog, 'sedan'), true);
    assert.equal(prog.activeGarageVehicle, 'sedan');
  });

  it('upgrades owned vehicle and scales performance specs', () => {
    const prog = createInitialProgressionState();
    const baseSpec = getUpgradedVehicleSpec('sedan', prog.vehicleUpgrades.sedan);

    const upRes = purchaseVehicleUpgrade(1000, prog, 'sedan', 'engine');
    assert.equal(upRes.success, true);
    assert.equal(upRes.money, 750);
    assert.equal(prog.vehicleUpgrades.sedan.engine, 1);

    const upgradedSpec = getUpgradedVehicleSpec('sedan', prog.vehicleUpgrades.sedan);
    assert.ok(upgradedSpec.maxSpeed > baseSpec.maxSpeed);
    assert.ok(upgradedSpec.accel > baseSpec.accel);
  });

  it('unlocks outfits and accessories with cash and applies customization', () => {
    const prog = createInitialProgressionState();
    const outfitRes = purchaseOrEquipOutfit(300, prog, 'urban_hoodie');
    assert.equal(outfitRes.success, true);
    assert.equal(outfitRes.money, 140);
    assert.equal(prog.customization.outfitId, 'urban_hoodie');

    const accRes = purchaseOrEquipAccessory(outfitRes.money, prog, 'cap');
    assert.equal(accRes.success, true);
    assert.equal(accRes.money, 20);
    assert.equal(prog.customization.accessoryId, 'cap');
  });

  it('evaluates challenges once and awards cash rewards cleanly', () => {
    const prog = createInitialProgressionState();
    prog.totalDistance = 320;
    recordVisitedDistrict(prog, 'downtown');
    recordVisitedDistrict(prog, 'residential');
    recordVisitedDistrict(prog, 'industrial');
    recordVisitedDistrict(prog, 'coastal');
    prog.topSpeedKmh = 92;

    const firstEval = evaluateChallenges(prog);
    assert.equal(firstEval.newlyCompleted.length, 3);
    assert.equal(firstEval.rewardEarned, 250 + 450 + 300);

    // Re-evaluating does not double-award
    const secondEval = evaluateChallenges(prog);
    assert.equal(secondEval.newlyCompleted.length, 0);
    assert.equal(secondEval.rewardEarned, 0);
  });
});
