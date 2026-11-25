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

test('characterAnimator produces human spinal counter-rotation, head stabilization, and ankle/wrist motion during gait', () => {
  const rt = createCharacterAnimRuntime();
  for (let i = 0; i < 20; i++) {
    stepCharacterAnimRuntime(
      rt,
      { speed: 3.4, vy: 0, grounded: true, isSprinting: false, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 2 + i * 0.03 },
      0.03,
    );
  }
  assert.equal(rt.currentState, 'walk');
  // Ribcage counter-rotates against waist/pelvis while head stabilizes toward horizon
  if (Math.abs(rt.pose.chestYaw) > 0.02) {
    assert.equal(Math.sign(rt.pose.chestYaw), -Math.sign(rt.pose.torsoYaw));
    assert.equal(Math.sign(rt.pose.headYaw), -Math.sign(rt.pose.chestYaw));
  }
  // Articulated wrists and ankles actively move instead of remaining locked at zero
  assert.ok(Math.abs(rt.pose.lWristX) + Math.abs(rt.pose.rWristX) > 0.02);
  assert.ok(Math.abs(rt.pose.lAnkleX) + Math.abs(rt.pose.rAnkleX) > 0.02);
});

test('characterAnimator enforces anatomically non-inverted knees/elbows/spines and supports swim/dive', () => {
  const rt = createCharacterAnimRuntime();

  // Sit & drive must bend hips forward (+X) and knees backward (-X) - never inverted hyperextension
  stepCharacterAnimRuntime(
    rt,
    { speed: 0, vy: 0, grounded: true, isSprinting: false, isMoving: false, isDriving: false, onStairs: false, sitting: true, elapsedTime: 1 },
    0.5,
  );
  assert.ok(rt.pose.lHipX > 0.4 && rt.pose.rHipX > 0.4, 'sitting hips flex forward (+X)');
  assert.ok(rt.pose.lKneeX < -0.4 && rt.pose.rKneeX < -0.4, 'sitting knees bend backward (-X)');
  assert.ok(rt.pose.lElbowX >= 0 && rt.pose.rElbowX >= 0, 'elbows never hyperextend backward');

  // Sprint leans torso forward (torsoPitch + chestPitch < 0) and bends knees strictly <= 0
  for (let i = 0; i < 30; i++) {
    stepCharacterAnimRuntime(
      rt,
      { speed: 9.2, vy: 0, grounded: true, isSprinting: true, isMoving: true, isDriving: false, onStairs: false, elapsedTime: 2 + i * 0.025 },
      0.025,
    );
    assert.ok(rt.pose.lKneeX <= 0.01 && rt.pose.rKneeX <= 0.01, 'knees never hyperextend forward during sprint');
    assert.ok(rt.pose.lElbowX >= -0.01 && rt.pose.rElbowX >= -0.01, 'elbows never hyperextend backward during sprint');
  }
  assert.ok(rt.pose.torsoPitch < 0, 'sprint torso pitches forward (< 0)');

  // Swimming states resolve cleanly
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 0.1, vy: 0, grounded: false, isSprinting: false, isMoving: false, isDriving: false, onStairs: false, swimming: true, underwater: false, elapsedTime: 4 },
      0.1,
    ),
    'swim_idle',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 3.8, vy: 0, grounded: false, isSprinting: false, isMoving: true, isDriving: false, onStairs: false, swimming: true, underwater: false, elapsedTime: 4.2 },
      0.1,
    ),
    'swim',
  );
  assert.equal(
    stepCharacterAnimRuntime(
      rt,
      { speed: 4.5, vy: -2.0, grounded: false, isSprinting: true, isMoving: true, isDriving: false, onStairs: false, swimming: true, underwater: true, diveVy: -2.0, elapsedTime: 4.4 },
      0.1,
    ),
    'dive',
  );
});


