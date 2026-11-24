import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCharacterAnimRuntime,
  stepCharacterAnimRuntime,
} from './characterAnimator';
import { computeResponsiveJoystickMetrics } from './joystickUtils';
import { createInitialPlayerState, stepPlayerPhysics } from './playerPhysics';
import {
  findNearestExteriorLadder,
  findNearestRooftopInteriorDoor,
  findRooftopAt,
  findVaultableObstacleAhead,
  stepLadderClimb,
} from './rooftopSystem';
import { createSkyLifeState, stepSkyLifeState } from './skyLifeSystem';
import { CITY_LAYOUT, getGroundHeightAt } from './worldData';

test('characterAnimator supports ladder climbing, parkour vault, photo poses, and secondary motion', () => {
  const rt = createCharacterAnimRuntime();

  const climbState = stepCharacterAnimRuntime(
    rt,
    {
      speed: 4.4,
      vy: 4.4,
      grounded: false,
      isSprinting: false,
      isMoving: true,
      isDriving: false,
      onStairs: false,
      climbingLadder: true,
      climbSpeed: 4.4,
      elapsedTime: 1.0,
    },
    0.05,
  );
  assert.equal(climbState, 'climb_ladder');
  assert.ok(rt.ladderPhase > 0);

  const vaultState = stepCharacterAnimRuntime(
    rt,
    {
      speed: 7.2,
      vy: 3.5,
      grounded: false,
      isSprinting: true,
      isMoving: true,
      isDriving: false,
      onStairs: false,
      parkourActive: true,
      elapsedTime: 1.1,
    },
    0.05,
  );
  assert.equal(vaultState, 'parkour_vault');

  const photoState = stepCharacterAnimRuntime(
    rt,
    {
      speed: 0,
      vy: 0,
      grounded: true,
      isSprinting: false,
      isMoving: false,
      isDriving: false,
      onStairs: false,
      photoPose: 'photo_hero',
      elapsedTime: 2.0,
    },
    0.05,
  );
  assert.equal(photoState, 'photo_hero');
  assert.equal(rt.pose.faceMood, 'focused');

  const peaceState = stepCharacterAnimRuntime(
    rt,
    {
      speed: 0,
      vy: 0,
      grounded: true,
      isSprinting: false,
      isMoving: false,
      isDriving: false,
      onStairs: false,
      photoPose: 'photo_peace',
      elapsedTime: 2.1,
    },
    0.05,
  );
  assert.equal(peaceState, 'photo_peace');
  assert.equal(rt.pose.faceMood, 'wink');

  // Sprint generates secondary coat & hair swing
  for (let i = 0; i < 12; i++) {
    stepCharacterAnimRuntime(
      rt,
      {
        speed: 9.2,
        vy: 0,
        grounded: true,
        isSprinting: true,
        isMoving: true,
        isDriving: false,
        onStairs: false,
        turnDeltaYaw: 1.5,
        elapsedTime: 2.5 + i * 0.04,
      },
      0.04,
    );
  }
  assert.ok(rt.pose.coatSwingX > 0.1, 'coat tail should trail back while sprinting');
  assert.ok(rt.pose.hairSwingX > 0.05, 'hair should trail back while sprinting');
});

test('rooftops and exterior ladders support surface-aware ground height and full vertical climb', () => {
  assert.ok(CITY_LAYOUT.rooftops.length >= 6);
  assert.ok(CITY_LAYOUT.ladders.length >= 5);

  const ladder = CITY_LAYOUT.ladders[0];
  const roof = CITY_LAYOUT.rooftops.find((r) => r.buildingId === ladder.buildingId);
  assert.ok(roof);

  // At street level beneath building, getGroundHeightAt without reference Y stays street/sidewalk level
  const streetGround = getGroundHeightAt(roof.minX + 2, roof.minZ + 2, CITY_LAYOUT, 0.2);
  assert.ok(streetGround < 1.0);

  // Near rooftop altitude, getGroundHeightAt resolves onto the rooftop deck
  const rooftopGround = getGroundHeightAt(roof.minX + 2, roof.minZ + 2, CITY_LAYOUT, roof.y);
  assert.equal(rooftopGround, roof.y);
  assert.equal(findRooftopAt(roof.minX + 2, roof.y, roof.minZ + 2, CITY_LAYOUT)?.id, roof.id);

  // Bottom ladder proximity match
  const nearBottom = findNearestExteriorLadder(
    ladder.x + ladder.normalX * 0.6,
    ladder.bottomY,
    ladder.z + ladder.normalZ * 0.6,
    CITY_LAYOUT,
  );
  assert.equal(nearBottom?.ladder.id, ladder.id);
  assert.equal(nearBottom?.entryEnd, 'bottom');

  // Climb to top step
  const p = createInitialPlayerState(CITY_LAYOUT);
  p.x = ladder.x + ladder.normalX * 0.56;
  p.z = ladder.z + ladder.normalZ * 0.56;
  p.y = ladder.bottomY + 0.1;
  let reachedTop = false;
  for (let i = 0; i < 400; i++) {
    const stepRes = stepLadderClimb(p, ladder, 1, 0.04);
    if (stepRes.finished && stepRes.exitReason === 'reached_top') {
      reachedTop = true;
      break;
    }
  }
  assert.equal(reachedTop, true);
  assert.equal(p.y, ladder.topY);
  assert.equal(p.activeRooftopId, ladder.buildingId);

  // Resort 1-story building does not advertise an impossible rooftop-to-interior door
  const resortRoof = CITY_LAYOUT.rooftops.find((r) => r.buildingId === 'resort_2_2');
  assert.ok(resortRoof);
  assert.equal(resortRoof.interiorAccessDoor, undefined);
  assert.equal(
    findNearestRooftopInteriorDoor(
      (resortRoof.minX + resortRoof.maxX) * 0.5,
      resortRoof.y,
      (resortRoof.minZ + resortRoof.maxZ) * 0.5,
      CITY_LAYOUT,
    ),
    null,
  );
});

test('parkour vaulting detects low rooftop/city vaultable props and clears them', () => {
  const vaultCollider = CITY_LAYOUT.colliders.find((c) => c.vaultable);
  assert.ok(vaultCollider, 'Expected at least one vaultable obstacle collider');

  const obs = findVaultableObstacleAhead(
    vaultCollider.minX - 0.75,
    vaultCollider.minY,
    (vaultCollider.minZ + vaultCollider.maxZ) * 0.5,
    1,
    0,
    CITY_LAYOUT.colliders,
  );
  assert.equal(obs?.id, vaultCollider.id);

  const p = createInitialPlayerState(CITY_LAYOUT);
  p.x = vaultCollider.minX - 0.75;
  p.y = vaultCollider.minY;
  p.z = (vaultCollider.minZ + vaultCollider.maxZ) * 0.5;
  p.yaw = -Math.PI * 0.5;
  p.cameraYaw = -Math.PI * 0.5;
  p.grounded = true;
  const res = stepPlayerPhysics(
    p,
    {
      forward: true,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jumpHeld: true,
      jumpJustPressed: true,
      moveX: 0,
      moveY: 0,
    },
    0.016,
    CITY_LAYOUT,
  );
  assert.equal(res.vaulted, true);
  assert.ok((p.parkourTimer ?? 0) > 0);
});

test('skyLifeSystem simulates birds and aircraft cleanly with finite coordinates', () => {
  const sky = createSkyLifeState();
  assert.ok(sky.birds.length >= 10);
  assert.ok(sky.aircraft.some((a) => a.kind === 'jetliner'));
  assert.ok(sky.aircraft.some((a) => a.kind === 'prop_plane'));
  assert.ok(sky.aircraft.some((a) => a.kind === 'helicopter'));

  const initialJetX = sky.aircraft[0].x;
  const initialBirdPhase = sky.birds[0].flapPhase;
  for (let i = 0; i < 30; i++) {
    stepSkyLifeState(sky, 0.033);
  }
  assert.notEqual(sky.aircraft[0].x, initialJetX);
  assert.ok(sky.birds[0].flapPhase > initialBirdPhase);
  for (const b of sky.birds) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z));
    assert.ok(Number.isFinite(b.wingAngle));
  }
  for (const a of sky.aircraft) {
    assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z));
    assert.ok(Number.isFinite(a.rotorAngle));
  }
});

test('computeResponsiveJoystickMetrics adapts seamlessly across phone portrait, compact landscape, tablet, and desktop', () => {
  const portrait = computeResponsiveJoystickMetrics(390, 844, true);
  assert.equal(portrait.orientation, 'portrait');
  assert.equal(portrait.compactLandscape, false);
  assert.equal(portrait.showTouchControls, true);
  assert.ok(portrait.padSizePx >= 90 && portrait.padSizePx <= 120);

  const landscape = computeResponsiveJoystickMetrics(844, 390, true);
  assert.equal(landscape.orientation, 'landscape');
  assert.equal(landscape.compactLandscape, true);
  assert.equal(landscape.showTouchControls, true);
  assert.ok(landscape.padSizePx <= portrait.padSizePx);
  assert.ok(landscape.bottomOffsetPx < portrait.bottomOffsetPx || landscape.compactLandscape);

  const tablet = computeResponsiveJoystickMetrics(820, 1180, true);
  assert.equal(tablet.showTouchControls, true);
  assert.ok(tablet.padSizePx >= portrait.padSizePx);

  const desktopMouse = computeResponsiveJoystickMetrics(1440, 900, false);
  assert.equal(desktopMouse.showTouchControls, false);
});
