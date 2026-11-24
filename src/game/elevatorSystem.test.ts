import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callElevatorToFloor,
  canExitElevatorCabin,
  createElevatorRuntimeState,
  isPointInElevatorCabin,
  selectElevatorFloor,
  stepElevatorRuntime,
} from './elevatorSystem';
import type { InteriorElevator } from './types';

function makeTowerElevator(): InteriorElevator {
  const floors = [];
  for (let f = 1; f <= 22; f++) {
    floors.push({
      floorNumber: f,
      y: Number(((f - 1) * 3.6).toFixed(2)),
      label: f === 22 ? 'Floor 22 · Rooftop' : `Floor ${f}`,
      exitX: -1.8,
      exitZ: -3.9,
      exitYaw: Math.PI,
    });
  }
  return {
    id: 'city_tower_elev',
    x: -1.8,
    z: -6.0,
    width: 2.5,
    depth: 2.2,
    floors,
  };
}

test('elevator calls to floor, opens doors, closes doors, travels physically to Floor 22 Rooftop, and unlocks exit', () => {
  const el = makeTowerElevator();
  const state = createElevatorRuntimeState(el, 1);

  assert.equal(state.currentFloor, 1);
  assert.equal(canExitElevatorCabin(state), false);

  // Call at Floor 1 -> opens doors smoothly
  callElevatorToFloor(state, 1, el.floors);
  assert.equal(state.doorState, 'opening');
  for (let i = 0; i < 20; i++) {
    stepElevatorRuntime(state, 0.05, el.floors);
  }
  assert.equal(state.doorState, 'open');
  assert.equal(canExitElevatorCabin(state), true);

  // Select Floor 22 (Rooftop) -> closes doors, starts moving upward continuously
  selectElevatorFloor(state, 22, el.floors);
  assert.equal(state.doorState, 'closing');

  let movedUp = false;
  let closedMidFlight = false;
  let arrived = false;
  for (let i = 0; i < 400; i++) {
    const ev = stepElevatorRuntime(state, 0.05, el.floors);
    if (state.moving) {
      movedUp = true;
      assert.equal(canExitElevatorCabin(state), false, 'Cannot exit cabin while elevator is moving');
      closedMidFlight = state.doorProgress === 0;
    }
    if (ev.arrivedFloor === 22) {
      arrived = true;
    }
    if (arrived && state.doorState === 'open') break;
  }

  assert.equal(movedUp, true);
  assert.equal(closedMidFlight, true);
  assert.equal(arrived, true);
  assert.equal(state.currentFloor, 22);
  assert.ok(Math.abs(state.currentY - 75.6) < 0.01);
  assert.equal(canExitElevatorCabin(state), true);
  assert.equal(isPointInElevatorCabin(-1.8, 75.6, -6.0, el, state.currentY), true);
  assert.equal(isPointInElevatorCabin(-1.8, 75.6, -3.5, el, state.currentY), false);
});
