import type { InteriorElevator, InteriorElevatorFloor } from './types';

export type ElevatorDoorState = 'closed' | 'opening' | 'open' | 'closing';

export interface ElevatorRuntimeState {
  elevatorId: string;
  currentY: number;
  currentFloor: number;
  targetFloor: number | null;
  targetQueue: number[];
  direction: -1 | 0 | 1;
  doorState: ElevatorDoorState;
  doorProgress: number; // 0 = fully closed, 1 = fully open
  holdTimer: number;
  moving: boolean;
  passengerIds: string[];
  lastUpdatedAt: number;
}

export interface ElevatorStepEvents {
  arrivedFloor: number | null;
  doorsOpened: boolean;
  doorsClosed: boolean;
  deltaY: number;
}

const DOOR_SPEED = 1.9; // ~0.53s open/close
const DOOR_HOLD_SECONDS = 3.2;
const ELEVATOR_CRUISE_SPEED = 6.2; // m/s (climbs 75.6m tower in ~12.5s smoothly)

export function createElevatorRuntimeState(
  elevator: InteriorElevator,
  initialFloor = 1,
  now = Date.now(),
): ElevatorRuntimeState {
  const fl =
    elevator.floors.find((f) => f.floorNumber === initialFloor) ||
    elevator.floors[0];
  return {
    elevatorId: elevator.id,
    currentY: fl ? fl.y : 0,
    currentFloor: fl ? fl.floorNumber : initialFloor,
    targetFloor: null,
    targetQueue: [],
    direction: 0,
    doorState: 'closed',
    doorProgress: 0,
    holdTimer: 0,
    moving: false,
    passengerIds: [],
    lastUpdatedAt: now,
  };
}

function getFloorSpec(
  floors: InteriorElevatorFloor[],
  floorNum: number,
): InteriorElevatorFloor | undefined {
  return floors.find((f) => f.floorNumber === floorNum);
}

function resolveNearestFloorNumber(
  y: number,
  floors: InteriorElevatorFloor[],
): number {
  let bestFloor = floors[0]?.floorNumber ?? 1;
  let bestDist = Infinity;
  for (let i = 0; i < floors.length; i++) {
    const d = Math.abs(floors[i].y - y);
    if (d < bestDist) {
      bestDist = d;
      bestFloor = floors[i].floorNumber;
    }
  }
  return bestFloor;
}

export function callElevatorToFloor(
  state: ElevatorRuntimeState,
  requestedFloor: number,
  floors: InteriorElevatorFloor[],
  now = Date.now(),
): ElevatorRuntimeState {
  const spec = getFloorSpec(floors, requestedFloor);
  if (!spec) return state;

  state.lastUpdatedAt = now;

  // Already stopped at requested floor -> open/hold doors
  if (!state.moving && Math.abs(state.currentY - spec.y) < 0.08) {
    state.currentFloor = requestedFloor;
    if (state.doorState === 'closed' || state.doorState === 'closing') {
      state.doorState = 'opening';
    } else if (state.doorState === 'open') {
      state.holdTimer = DOOR_HOLD_SECONDS;
    }
    return state;
  }

  if (
    state.targetFloor !== requestedFloor &&
    !state.targetQueue.includes(requestedFloor)
  ) {
    state.targetQueue.push(requestedFloor);
  }

  if (state.targetFloor === null) {
    state.targetFloor = state.targetQueue.shift() ?? null;
  }

  if (!state.moving && state.doorState === 'open') {
    state.holdTimer = Math.min(state.holdTimer, 0.35);
  }
  return state;
}

export function selectElevatorFloor(
  state: ElevatorRuntimeState,
  destinationFloor: number,
  floors: InteriorElevatorFloor[],
  now = Date.now(),
): ElevatorRuntimeState {
  const spec = getFloorSpec(floors, destinationFloor);
  if (!spec) return state;

  state.lastUpdatedAt = now;

  if (!state.moving && Math.abs(state.currentY - spec.y) < 0.08) {
    if (state.doorState === 'closed' || state.doorState === 'closing') {
      state.doorState = 'opening';
    } else if (state.doorState === 'open') {
      state.holdTimer = DOOR_HOLD_SECONDS;
    }
    return state;
  }

  state.targetFloor = destinationFloor;
  state.targetQueue = state.targetQueue.filter((f) => f !== destinationFloor);
  if (state.doorState === 'open' || state.doorState === 'opening') {
    state.doorState = 'closing';
    state.holdTimer = 0;
  }
  return state;
}

export function stepElevatorRuntime(
  state: ElevatorRuntimeState,
  rawDt: number,
  floors: InteriorElevatorFloor[],
  now = Date.now(),
): ElevatorStepEvents {
  const dt = Math.min(Math.max(rawDt, 0.001), 0.1);
  const events: ElevatorStepEvents = {
    arrivedFloor: null,
    doorsOpened: false,
    doorsClosed: false,
    deltaY: 0,
  };

  if (floors.length === 0) return events;

  // Ensure a queued floor becomes active target
  if (state.targetFloor === null && state.targetQueue.length > 0) {
    state.targetFloor = state.targetQueue.shift() ?? null;
  }

  // 1. Door opening / holding / closing state machine
  if (!state.moving) {
    if (state.doorState === 'opening') {
      state.doorProgress = Math.min(1, state.doorProgress + DOOR_SPEED * dt);
      if (state.doorProgress >= 1) {
        state.doorState = 'open';
        state.holdTimer = state.targetFloor !== null ? 0.5 : DOOR_HOLD_SECONDS;
        events.doorsOpened = true;
      }
      state.lastUpdatedAt = now;
      return events;
    }

    if (state.doorState === 'open') {
      state.holdTimer = Math.max(0, state.holdTimer - dt);
      if (state.holdTimer <= 0) {
        state.doorState = 'closing';
      }
      state.lastUpdatedAt = now;
      return events;
    }

    if (state.doorState === 'closing') {
      state.doorProgress = Math.max(0, state.doorProgress - DOOR_SPEED * dt);
      if (state.doorProgress <= 0) {
        state.doorState = 'closed';
        events.doorsClosed = true;
        if (state.targetFloor !== null) {
          const targetSpec = getFloorSpec(floors, state.targetFloor);
          if (targetSpec && Math.abs(targetSpec.y - state.currentY) > 0.05) {
            state.moving = true;
            state.direction = targetSpec.y > state.currentY ? 1 : -1;
          } else {
            state.targetFloor = null;
          }
        }
      }
      state.lastUpdatedAt = now;
      return events;
    }

    // Idle with closed doors and a pending targetFloor -> start moving immediately
    if (state.doorState === 'closed' && state.targetFloor !== null) {
      const targetSpec = getFloorSpec(floors, state.targetFloor);
      if (targetSpec && Math.abs(targetSpec.y - state.currentY) > 0.05) {
        state.moving = true;
        state.direction = targetSpec.y > state.currentY ? 1 : -1;
      } else {
        state.targetFloor = null;
        state.doorState = 'opening';
      }
    }
    return events;
  }

  // 2. Smooth vertical cabin travel toward targetFloor
  const targetSpec =
    state.targetFloor !== null ? getFloorSpec(floors, state.targetFloor) : undefined;
  if (!targetSpec) {
    state.moving = false;
    state.direction = 0;
    return events;
  }

  const diff = targetSpec.y - state.currentY;
  const absDiff = Math.abs(diff);

  if (absDiff <= 0.02) {
    events.deltaY = diff;
    state.currentY = targetSpec.y;
    state.currentFloor = targetSpec.floorNumber;
    state.moving = false;
    state.direction = 0;
    state.targetFloor = null;
    state.doorState = 'opening';
    events.arrivedFloor = targetSpec.floorNumber;
    state.lastUpdatedAt = now;
    return events;
  }

  // Smooth ease near destination (within 2.4m) while keeping brisk cruise speed across 22 floors
  const speedScale = absDiff < 2.4 ? Math.max(0.28, absDiff / 2.4) : 1.0;
  const maxStep = ELEVATOR_CRUISE_SPEED * speedScale * dt;
  const step = Math.sign(diff) * Math.min(absDiff, maxStep);
  state.currentY += step;
  events.deltaY = step;
  state.direction = diff > 0 ? 1 : -1;
  state.currentFloor = resolveNearestFloorNumber(state.currentY, floors);
  state.lastUpdatedAt = now;

  if (Math.abs(targetSpec.y - state.currentY) <= 0.025) {
    events.deltaY += targetSpec.y - state.currentY;
    state.currentY = targetSpec.y;
    state.currentFloor = targetSpec.floorNumber;
    state.moving = false;
    state.direction = 0;
    state.targetFloor = null;
    state.doorState = 'opening';
    events.arrivedFloor = targetSpec.floorNumber;
  }

  return events;
}

export function canExitElevatorCabin(state: ElevatorRuntimeState): boolean {
  return !state.moving && state.doorProgress >= 0.72;
}

export function isPointInElevatorCabin(
  x: number,
  y: number,
  z: number,
  elevator: InteriorElevator,
  cabinY: number,
  margin = 0.05,
): boolean {
  const halfW = elevator.width * 0.5 + margin;
  const halfD = elevator.depth * 0.5 + margin;
  return (
    Math.abs(x - elevator.x) <= halfW &&
    Math.abs(z - elevator.z) <= halfD &&
    Math.abs(y - cabinY) <= 1.6
  );
}
