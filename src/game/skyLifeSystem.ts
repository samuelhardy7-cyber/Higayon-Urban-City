import * as THREE from 'three';

export interface SkyBirdActor {
  id: string;
  centerX: number;
  centerZ: number;
  baseY: number;
  radiusX: number;
  radiusZ: number;
  angularSpeed: number;
  phase: number;
  flapSpeed: number;
  flapPhase: number;
  scale: number;
  color: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  bank: number;
  wingAngle: number;
}

export interface SkyAircraftActor {
  id: string;
  kind: 'jetliner' | 'prop_plane' | 'helicopter';
  centerX: number;
  centerZ: number;
  altitude: number;
  radiusX: number;
  radiusZ: number;
  angularSpeed: number;
  phase: number;
  scale: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  bank: number;
  pitch: number;
  rotorAngle: number;
}

export interface SkyLifeState {
  elapsed: number;
  birds: SkyBirdActor[];
  aircraft: SkyAircraftActor[];
}

export function createSkyLifeState(): SkyLifeState {
  const birdConfigs: Array<Omit<SkyBirdActor, 'x' | 'y' | 'z' | 'yaw' | 'bank' | 'wingAngle'>> = [
    // Coastal & Bay seagulls
    { id: 'bird_bay_1', centerX: 112, centerZ: 34, baseY: 22, radiusX: 28, radiusZ: 38, angularSpeed: 0.24, phase: 0.2, flapSpeed: 8.6, flapPhase: 0.1, scale: 1.05, color: 0xf8fafc },
    { id: 'bird_bay_2', centerX: 118, centerZ: 42, baseY: 25, radiusX: 24, radiusZ: 32, angularSpeed: 0.27, phase: 1.4, flapSpeed: 9.1, flapPhase: 1.2, scale: 0.96, color: 0xf1f5f9 },
    { id: 'bird_bay_3', centerX: 106, centerZ: 18, baseY: 19, radiusX: 20, radiusZ: 28, angularSpeed: -0.22, phase: 2.5, flapSpeed: 8.2, flapPhase: 2.3, scale: 1.0, color: 0xf8fafc },
    { id: 'bird_bay_4', centerX: 124, centerZ: 55, baseY: 29, radiusX: 34, radiusZ: 26, angularSpeed: 0.2, phase: 3.9, flapSpeed: 7.9, flapPhase: 0.8, scale: 1.12, color: 0xe2e8f0 },
    // Emerald Park & Residential songbirds/hawks
    { id: 'bird_park_1', centerX: -21, centerZ: 21, baseY: 16, radiusX: 18, radiusZ: 16, angularSpeed: 0.34, phase: 0.7, flapSpeed: 9.8, flapPhase: 0.4, scale: 0.88, color: 0x334155 },
    { id: 'bird_park_2', centerX: -19, centerZ: 23, baseY: 18.5, radiusX: 15, radiusZ: 20, angularSpeed: 0.32, phase: 2.1, flapSpeed: 9.5, flapPhase: 1.7, scale: 0.85, color: 0x475569 },
    { id: 'bird_park_3', centerX: -25, centerZ: 15, baseY: 21, radiusX: 22, radiusZ: 19, angularSpeed: -0.28, phase: 4.4, flapSpeed: 8.8, flapPhase: 2.9, scale: 0.92, color: 0xf8fafc },
    // Downtown City Tower high soaring hawks & pigeons
    { id: 'bird_dt_1', centerX: -24, centerZ: -25, baseY: 84, radiusX: 26, radiusZ: 24, angularSpeed: 0.23, phase: 0.9, flapSpeed: 6.8, flapPhase: 0.5, scale: 1.18, color: 0x78350f },
    { id: 'bird_dt_2', centerX: -20, centerZ: -22, baseY: 87, radiusX: 30, radiusZ: 28, angularSpeed: 0.21, phase: 3.1, flapSpeed: 7.1, flapPhase: 1.9, scale: 1.15, color: 0x92400e },
    { id: 'bird_dt_3', centerX: 12, centerZ: -18, baseY: 36, radiusX: 32, radiusZ: 26, angularSpeed: -0.24, phase: 1.8, flapSpeed: 8.4, flapPhase: 2.4, scale: 1.0, color: 0xf1f5f9 },
    { id: 'bird_dt_4', centerX: 0, centerZ: 6, baseY: 28, radiusX: 35, radiusZ: 30, angularSpeed: 0.19, phase: 4.8, flapSpeed: 8.0, flapPhase: 0.2, scale: 1.02, color: 0xf8fafc },
    { id: 'bird_harbor_1', centerX: 84, centerZ: -38, baseY: 24, radiusX: 26, radiusZ: 30, angularSpeed: -0.25, phase: 5.2, flapSpeed: 8.5, flapPhase: 1.1, scale: 1.04, color: 0xf8fafc },
    // Emerald Bay & Grand Harbor Bridge seagulls
    { id: 'bird_c2_1', centerX: 298, centerZ: 12, baseY: 23, radiusX: 30, radiusZ: 28, angularSpeed: 0.24, phase: 0.6, flapSpeed: 8.8, flapPhase: 0.4, scale: 1.05, color: 0xf8fafc },
    { id: 'bird_c2_2', centerX: 312, centerZ: -18, baseY: 32, radiusX: 24, radiusZ: 26, angularSpeed: -0.26, phase: 2.2, flapSpeed: 8.4, flapPhase: 1.5, scale: 1.0, color: 0xf1f5f9 },
    // Aero Highland high-altitude hawks
    { id: 'bird_c3_1', centerX: -12, centerZ: -275, baseY: 42, radiusX: 28, radiusZ: 26, angularSpeed: 0.22, phase: 1.5, flapSpeed: 7.4, flapPhase: 0.9, scale: 1.12, color: 0x78350f },
    { id: 'bird_c3_2', centerX: 16, centerZ: -255, baseY: 28, radiusX: 24, radiusZ: 22, angularSpeed: -0.28, phase: 3.7, flapSpeed: 8.2, flapPhase: 2.1, scale: 1.02, color: 0xf8fafc },
    // Golden Horizon sunset gulls
    { id: 'bird_c4_1', centerX: 14, centerZ: 268, baseY: 24, radiusX: 28, radiusZ: 26, angularSpeed: 0.25, phase: 0.9, flapSpeed: 8.6, flapPhase: 0.6, scale: 1.08, color: 0xf8fafc },
    { id: 'bird_c4_2', centerX: -18, centerZ: 294, baseY: 31, radiusX: 26, radiusZ: 24, angularSpeed: -0.23, phase: 2.8, flapSpeed: 8.1, flapPhase: 1.8, scale: 1.02, color: 0xf1f5f9 },
  ];

  const aircraftConfigs: Array<Omit<SkyAircraftActor, 'x' | 'y' | 'z' | 'yaw' | 'bank' | 'pitch' | 'rotorAngle'>> = [
    {
      id: 'sky_jetliner_1',
      kind: 'jetliner',
      centerX: 10,
      centerZ: -10,
      altitude: 108,
      radiusX: 185,
      radiusZ: 155,
      angularSpeed: 0.115,
      phase: 0.4,
      scale: 1.15,
    },
    {
      id: 'sky_jetliner_intercity',
      kind: 'jetliner',
      centerX: 145,
      centerZ: -130,
      altitude: 124,
      radiusX: 255,
      radiusZ: 225,
      angularSpeed: -0.095,
      phase: 2.1,
      scale: 1.25,
    },
    {
      id: 'sky_prop_coastal',
      kind: 'prop_plane',
      centerX: 55,
      centerZ: 10,
      altitude: 68,
      radiusX: 125,
      radiusZ: 115,
      angularSpeed: -0.17,
      phase: 2.7,
      scale: 1.0,
    },
    {
      id: 'sky_prop_emerald',
      kind: 'prop_plane',
      centerX: 305,
      centerZ: -5,
      altitude: 72,
      radiusX: 95,
      radiusZ: 88,
      angularSpeed: 0.16,
      phase: 0.9,
      scale: 1.02,
    },
    {
      id: 'sky_heli_patrol',
      kind: 'helicopter',
      centerX: -12,
      centerZ: -18,
      altitude: 91,
      radiusX: 56,
      radiusZ: 52,
      angularSpeed: 0.22,
      phase: 1.3,
      scale: 1.0,
    },
    {
      id: 'sky_heli_highland',
      kind: 'helicopter',
      centerX: -14,
      centerZ: -280,
      altitude: 66,
      radiusX: 58,
      radiusZ: 54,
      angularSpeed: -0.21,
      phase: 3.4,
      scale: 1.0,
    },
    {
      id: 'sky_prop_golden',
      kind: 'prop_plane',
      centerX: 8,
      centerZ: 278,
      altitude: 70,
      radiusX: 112,
      radiusZ: 96,
      angularSpeed: 0.16,
      phase: 1.2,
      scale: 1.04,
    },
    {
      id: 'sky_jetliner_south',
      kind: 'jetliner',
      centerX: 120,
      centerZ: 145,
      altitude: 118,
      radiusX: 230,
      radiusZ: 210,
      angularSpeed: 0.1,
      phase: 3.8,
      scale: 1.22,
    },
  ];

  const state: SkyLifeState = {
    elapsed: 0,
    birds: birdConfigs.map((b) => ({ ...b, x: b.centerX, y: b.baseY, z: b.centerZ, yaw: 0, bank: 0, wingAngle: 0 })),
    aircraft: aircraftConfigs.map((a) => ({ ...a, x: a.centerX, y: a.altitude, z: a.centerZ, yaw: 0, bank: 0, pitch: 0, rotorAngle: 0 })),
  };
  stepSkyLifeState(state, 0.016);
  return state;
}

export function stepSkyLifeState(state: SkyLifeState, rawDt: number): void {
  const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
  state.elapsed += dt;

  for (let i = 0; i < state.birds.length; i++) {
    const b = state.birds[i];
    b.phase += b.angularSpeed * dt;
    b.flapPhase += b.flapSpeed * dt;

    const prevX = b.x;
    const prevZ = b.z;
    b.x = b.centerX + Math.cos(b.phase) * b.radiusX;
    b.z = b.centerZ + Math.sin(b.phase) * b.radiusZ;
    b.y = b.baseY + Math.sin(b.phase * 2.0 + i) * 1.8;

    const dx = b.x - prevX;
    const dz = b.z - prevZ;
    if (dx * dx + dz * dz > 1e-6) {
      b.yaw = Math.atan2(-dx, -dz);
    } else {
      const tx = -Math.sin(b.phase) * b.radiusX * b.angularSpeed;
      const tz = Math.cos(b.phase) * b.radiusZ * b.angularSpeed;
      b.yaw = Math.atan2(-tx, -tz);
    }
    b.bank = b.angularSpeed > 0 ? -0.24 : 0.24;
    // Intermittent glide + active wingbeat pattern
    const glideGate = Math.sin(b.phase * 3.0 + i * 0.9);
    const flapAmp = glideGate > 0.55 ? 0.14 : 0.68;
    b.wingAngle = Math.sin(b.flapPhase) * flapAmp;
  }

  for (let i = 0; i < state.aircraft.length; i++) {
    const a = state.aircraft[i];
    a.phase += a.angularSpeed * dt;
    a.rotorAngle = (a.rotorAngle + dt * (a.kind === 'helicopter' ? 22 : 28)) % (Math.PI * 2);

    const tx = -Math.sin(a.phase) * a.radiusX * a.angularSpeed;
    const tz = Math.cos(a.phase) * a.radiusZ * a.angularSpeed;

    a.x = a.centerX + Math.cos(a.phase) * a.radiusX;
    a.z = a.centerZ + Math.sin(a.phase) * a.radiusZ;
    a.y = a.altitude + Math.sin(a.phase * 2.0) * (a.kind === 'jetliner' ? 2.8 : 1.9);
    a.yaw = Math.atan2(-tx, -tz);
    a.bank = (a.angularSpeed > 0 ? -1 : 1) * (a.kind === 'helicopter' ? 0.14 : 0.24);
    a.pitch = a.kind === 'helicopter' ? 0.08 : Math.cos(a.phase * 2.0) * 0.04;
  }
}

export interface SkyLifeSystemRig {
  group: THREE.Group;
  update: (state: SkyLifeState) => void;
  dispose: () => void;
}

export function buildSkyLifeVisuals(state: SkyLifeState): SkyLifeSystemRig {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const tg = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g);
    return g;
  };
  const tm = <T extends THREE.Material>(m: T): T => {
    mats.push(m);
    return m;
  };

  // Shared bird geometries
  const birdBodyGeo = tg(new THREE.CapsuleGeometry(0.11, 0.34, 4, 8));
  const birdHeadGeo = tg(new THREE.SphereGeometry(0.085, 8, 8));
  const birdBeakGeo = tg(new THREE.ConeGeometry(0.032, 0.12, 6));
  const birdWingGeo = tg(new THREE.BoxGeometry(0.58, 0.025, 0.22));
  const birdTailGeo = tg(new THREE.BoxGeometry(0.22, 0.02, 0.18));
  const beakMat = tm(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45 }));

  const birdRigs: Array<{
    root: THREE.Group;
    leftWing: THREE.Group;
    rightWing: THREE.Group;
  }> = [];

  for (const b of state.birds) {
    const bGroup = new THREE.Group();
    bGroup.scale.setScalar(b.scale);
    const bodyMat = tm(new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.72 }));
    const tipMat = tm(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 }));

    const torso = new THREE.Mesh(birdBodyGeo, bodyMat);
    torso.rotation.x = Math.PI * 0.5;
    bGroup.add(torso);

    const head = new THREE.Mesh(birdHeadGeo, bodyMat);
    head.position.set(0, 0.05, -0.24);
    bGroup.add(head);

    const beak = new THREE.Mesh(birdBeakGeo, beakMat);
    beak.rotation.x = -Math.PI * 0.5;
    beak.position.set(0, 0.04, -0.34);
    bGroup.add(beak);

    const tail = new THREE.Mesh(birdTailGeo, tipMat);
    tail.position.set(0, 0.02, 0.28);
    tail.rotation.x = -0.15;
    bGroup.add(tail);

    const leftWing = new THREE.Group();
    leftWing.position.set(-0.08, 0.04, -0.02);
    const lwMesh = new THREE.Mesh(birdWingGeo, bodyMat);
    lwMesh.position.set(-0.29, 0, 0.02);
    lwMesh.rotation.y = 0.18;
    leftWing.add(lwMesh);

    const rightWing = new THREE.Group();
    rightWing.position.set(0.08, 0.04, -0.02);
    const rwMesh = new THREE.Mesh(birdWingGeo, bodyMat);
    rwMesh.position.set(0.29, 0, 0.02);
    rwMesh.rotation.y = -0.18;
    rightWing.add(rwMesh);

    bGroup.add(leftWing, rightWing);
    group.add(bGroup);
    birdRigs.push({ root: bGroup, leftWing, rightWing });
  }

  // Aircraft rigs
  const whiteAirMat = tm(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.28 }));
  const stripeAirMat = tm(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.25 }));
  const propYellowMat = tm(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.38, metalness: 0.2 }));
  const darkRotorMat = tm(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 }));
  const canopyGlassMat = tm(new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.14, metalness: 0.65 }));
  const navRedMat = tm(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const navGreenMat = tm(new THREE.MeshBasicMaterial({ color: 0x10b981 }));

  const aircraftRigs: Array<{
    root: THREE.Group;
    rotors: THREE.Object3D[];
  }> = [];

  for (const a of state.aircraft) {
    const aGroup = new THREE.Group();
    aGroup.scale.setScalar(a.scale);
    const rotors: THREE.Object3D[] = [];

    if (a.kind === 'jetliner') {
      const fuse = new THREE.Mesh(tg(new THREE.CapsuleGeometry(0.92, 9.2, 8, 16)), whiteAirMat);
      fuse.rotation.x = Math.PI * 0.5;
      aGroup.add(fuse);

      const stripe = new THREE.Mesh(tg(new THREE.CylinderGeometry(0.94, 0.94, 7.2, 14)), stripeAirMat);
      stripe.rotation.x = Math.PI * 0.5;
      stripe.scale.set(1, 1, 0.35);
      aGroup.add(stripe);

      const cockpit = new THREE.Mesh(tg(new THREE.SphereGeometry(0.75, 10, 8)), canopyGlassMat);
      cockpit.scale.set(0.95, 0.62, 1.4);
      cockpit.position.set(0, 0.36, -4.25);
      aGroup.add(cockpit);

      // Swept Main Wings
      const wingL = new THREE.Mesh(tg(new THREE.BoxGeometry(6.8, 0.16, 1.9)), whiteAirMat);
      wingL.position.set(-3.4, -0.1, 0.2);
      wingL.rotation.y = 0.28;
      const wingR = new THREE.Mesh(tg(new THREE.BoxGeometry(6.8, 0.16, 1.9)), whiteAirMat);
      wingR.position.set(3.4, -0.1, 0.2);
      wingR.rotation.y = -0.28;
      aGroup.add(wingL, wingR);

      // Twin Underwing Jet Engines
      const engGeo = tg(new THREE.CylinderGeometry(0.36, 0.32, 1.5, 12));
      for (const sx of [-2.4, 2.4]) {
        const eng = new THREE.Mesh(engGeo, darkRotorMat);
        eng.rotation.x = Math.PI * 0.5;
        eng.position.set(sx, -0.45, -0.1);
        aGroup.add(eng);
      }

      // Tail Fin + Horizontal Stabilizer
      const vTail = new THREE.Mesh(tg(new THREE.BoxGeometry(0.18, 2.1, 1.6)), stripeAirMat);
      vTail.position.set(0, 1.25, 4.4);
      vTail.rotation.x = -0.3;
      const hTail = new THREE.Mesh(tg(new THREE.BoxGeometry(4.2, 0.14, 1.0)), whiteAirMat);
      hTail.position.set(0, 0.28, 4.5);
      aGroup.add(vTail, hTail);

      // Navigation lights
      const lLight = new THREE.Mesh(tg(new THREE.SphereGeometry(0.16, 6, 6)), navRedMat);
      lLight.position.set(-6.6, -0.05, 1.15);
      const rLight = new THREE.Mesh(tg(new THREE.SphereGeometry(0.16, 6, 6)), navGreenMat);
      rLight.position.set(6.6, -0.05, 1.15);
      aGroup.add(lLight, rLight);
    } else if (a.kind === 'prop_plane') {
      const fuse = new THREE.Mesh(tg(new THREE.CapsuleGeometry(0.55, 4.8, 6, 12)), propYellowMat);
      fuse.rotation.x = Math.PI * 0.5;
      aGroup.add(fuse);

      const cabin = new THREE.Mesh(tg(new THREE.BoxGeometry(0.95, 0.58, 1.6)), canopyGlassMat);
      cabin.position.set(0, 0.45, -0.5);
      aGroup.add(cabin);

      const mainWing = new THREE.Mesh(tg(new THREE.BoxGeometry(8.6, 0.14, 1.35)), whiteAirMat);
      mainWing.position.set(0, 0.72, -0.2);
      aGroup.add(mainWing);

      const vTail = new THREE.Mesh(tg(new THREE.BoxGeometry(0.14, 1.25, 0.95)), stripeAirMat);
      vTail.position.set(0, 0.72, 2.45);
      const hTail = new THREE.Mesh(tg(new THREE.BoxGeometry(2.8, 0.12, 0.72)), whiteAirMat);
      hTail.position.set(0, 0.25, 2.55);
      aGroup.add(vTail, hTail);

      const propHub = new THREE.Group();
      propHub.position.set(0, 0, -3.0);
      const blade = new THREE.Mesh(tg(new THREE.BoxGeometry(2.1, 0.16, 0.06)), darkRotorMat);
      propHub.add(blade);
      aGroup.add(propHub);
      rotors.push(propHub);
    } else {
      // Helicopter
      const hull = new THREE.Mesh(tg(new THREE.CapsuleGeometry(0.76, 2.2, 8, 12)), stripeAirMat);
      hull.rotation.x = Math.PI * 0.5;
      aGroup.add(hull);

      const cockpit = new THREE.Mesh(tg(new THREE.SphereGeometry(0.72, 10, 8)), canopyGlassMat);
      cockpit.position.set(0, 0.08, -1.05);
      aGroup.add(cockpit);

      const tailBoom = new THREE.Mesh(tg(new THREE.CylinderGeometry(0.14, 0.22, 3.2, 8)), whiteAirMat);
      tailBoom.rotation.x = Math.PI * 0.5;
      tailBoom.position.set(0, 0.18, 2.4);
      aGroup.add(tailBoom);

      const skidGeo = tg(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6));
      for (const sx of [-0.65, 0.65]) {
        const skid = new THREE.Mesh(skidGeo, darkRotorMat);
        skid.rotation.x = Math.PI * 0.5;
        skid.position.set(sx, -0.95, -0.1);
        aGroup.add(skid);
      }

      const mainRotor = new THREE.Group();
      mainRotor.position.set(0, 0.95, 0);
      const b1 = new THREE.Mesh(tg(new THREE.BoxGeometry(5.8, 0.05, 0.22)), darkRotorMat);
      const b2 = new THREE.Mesh(tg(new THREE.BoxGeometry(0.22, 0.05, 5.8)), darkRotorMat);
      mainRotor.add(b1, b2);
      aGroup.add(mainRotor);
      rotors.push(mainRotor);
    }

    group.add(aGroup);
    aircraftRigs.push({ root: aGroup, rotors });
  }

  const update = (next: SkyLifeState) => {
    for (let i = 0; i < next.birds.length; i++) {
      const b = next.birds[i];
      const rig = birdRigs[i];
      if (!rig) continue;
      rig.root.position.set(b.x, b.y, b.z);
      rig.root.rotation.set(0, b.yaw, b.bank, 'YXZ');
      rig.leftWing.rotation.z = -b.wingAngle;
      rig.rightWing.rotation.z = b.wingAngle;
    }

    for (let i = 0; i < next.aircraft.length; i++) {
      const a = next.aircraft[i];
      const rig = aircraftRigs[i];
      if (!rig) continue;
      rig.root.position.set(a.x, a.y, a.z);
      rig.root.rotation.set(a.pitch, a.yaw, a.bank, 'YXZ');
      for (const r of rig.rotors) {
        if (a.kind === 'prop_plane') {
          r.rotation.z = a.rotorAngle;
        } else {
          r.rotation.y = a.rotorAngle;
        }
      }
    }
  };

  update(state);

  return {
    group,
    update,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
