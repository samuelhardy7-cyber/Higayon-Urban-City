import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCharacterAnimRuntime,
  stepCharacterAnimRuntime,
  triggerCharacterAction,
} from './characterAnimator';

test('characterAnimator resolves full locomotion, stair, jump/fall/land, and drive states smoothly', () => {
  const rt = createCharacterAnimRuntime();

  // Idle -> Idle shift -> Idle look
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 0, vy: 0, grounded: true, isSprinting: false, isMoving: false, isDriving: false, onStairs: false, elapsedTime: 1.0 },
      0.016,
    ),
    'idle',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 0, vy: 0, grounded: true, isSprinting: false, isMoving: false, isDriving: false, onStairs: false, elapsedTime: 4.5 },
      0.016,
    ),
    'idle_shift',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 0, vy: 0, grounded: true, isSprinting: false, isMoving: false, isDriving: false, onStairs: false, elapsedTime: 9.0 },
      0.016,
    ),
    'idle_look',
  );

  // Speed tiers: walk -> fast_walk -> jog -> sprint
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 2.5, vy: 0, grounded: true, isSprinting: false, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 10 },
      0.016,
    ),
    'walk',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 5.0, vy: 0, grounded: true, isSprinting: false, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 10 },
      0.016,
    ),
    'fast_walk',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 6.4, vy: 0, grounded: true, isSprinting: false, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 10 },
      0.016,
    ),
    'jog',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 9.1, vy: 0, grounded: true, isSprinting: true, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 10 },
      0.016,
    ),
    'sprint',
  );

  // Stairs climb / descend
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 3.5, vy: 2.0, grounded: true, isSprinting: false, isMoving: true, isDriving: false, onStairs: true, stairDirection: 'up', elapsedTime: 11 },
      0.016,
    ),
    'climb_stairs',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 3.5, vy: -2.0, grounded: true, isSprinting: false, isMoving: true, isDriving: false, onStairs: true, stairDirection: 'down', elapsedTime: 11 },
      0.016,
    ),
    'descend_stairs',
  );

  // Jump -> Fall -> Land
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 2.0, vy: 5.0, grounded: false, isSprinting: false, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 12 },
      0.016,
    ),
    'jump',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 2.0, vy: -4.0, grounded: false, isSprinting: false, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 12.4 },
      0.016,
    ),
    'fall',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 0, vy: 0, grounded: true, isSprinting: false, isMoving: false, isDriving: false, onStairs: false, elapsedTime: 12.6 },
      0.016,
    ),
    'land',
  );
});

test('characterAnimator blends emotes smoothly and cancels emote immediately on movement', () => {
  const rt = createCharacterAnimRuntime();
  triggerCharacterAction(rt, 'wave', 2.0, false, 'wave');
  const prevShoulder = rt.pose.rShoulderX;

  const st1 = stepCharacterAnimRuntime(
    rt,
    { speed: 0, vy: 0, grounded: true, isSprinting: false, isMoving: false, isDriving: false, onStairs: false, elapsedTime: 1 },
    0.05,
  );
  assert.equal(st1, 'wave');
  // Smooth blending moves shoulder progressively rather than snapping instantly to -2.25
  assert.ok(rt.pose.rShoulderX < prevShoulder && rt.pose.rShoulderX > -2.25);
  assert.equal(rt.emoteSeq, 1);

  // Moving interrupts emote immediately
  const st2 = stepCharacterAnimRuntime(
    rt,
    { speed: 4.0, vy: 0, grounded: true, isSprinting: false, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 1.1 },
    0.05,
  );
  assert.equal(st2, 'walk');
  assert.equal(rt.actionState, null);
});
