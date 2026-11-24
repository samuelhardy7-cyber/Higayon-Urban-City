import * as THREE from 'three';
import type { VehicleState } from './types';
import { VEHICLE_SPECS } from './vehicleData';

export interface VehicleRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  frontSteerPivots: THREE.Group[];
  wheels: THREE.Object3D[];
  paintMat: THREE.MeshStandardMaterial;
  tailLightMat: THREE.MeshStandardMaterial;
  headLightMat: THREE.MeshStandardMaterial;
  policeRedMat?: THREE.MeshStandardMaterial;
  policeBlueMat?: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createVehicleRig(
  vehicle: VehicleState,
  contactShadowMap: THREE.Texture,
  enableShadows: boolean,
): VehicleRig {
  const spec = VEHICLE_SPECS[vehicle.kind];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const frontSteerPivots: THREE.Group[] = [];
  const wheels: THREE.Object3D[] = [];

  const paintMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: vehicle.isPolice ? 0x162238 : vehicle.color,
      roughness: 0.28,
      metalness: 0.45,
    }),
  );
  const policeWhiteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.25 }),
  );
  const trimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.65, metalness: 0.35 }),
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd0d7e0, roughness: 0.22, metalness: 0.85 }),
  );
  const glassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e3242, roughness: 0.12, metalness: 0.68 }),
  );
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.88, metalness: 0.05 }),
  );
  const headLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff6dc,
      emissive: 0xffeab3,
      emissiveIntensity: 0.45,
      roughness: 0.15,
    }),
  );
  const tailLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc42525,
      emissive: 0xff2b2b,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    }),
  );

  // Soft Ground Contact Shadow
  const shadowPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(spec.width * 1.35, spec.length * 1.12)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: contactShadowMap,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
      }),
    ),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  const buildWheelMesh = (radius: number, width: number): THREE.Group => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(radius, radius, width, 14)),
      tireMat,
    );
    tire.rotation.z = Math.PI * 0.5;
    tire.castShadow = enableShadows;
    wg.add(tire);

    const rim = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 10)),
      chromeMat,
    );
    rim.rotation.z = Math.PI * 0.5;
    wg.add(rim);

    // Spoke bar so wheel spin is clearly readable
    const spoke = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width + 0.03, radius * 0.95, 0.06)),
      trimMat,
    );
    wg.add(spoke);
    return wg;
  };

  let policeRedMat: THREE.MeshStandardMaterial | undefined;
  let policeBlueMat: THREE.MeshStandardMaterial | undefined;

  if (spec.isMotorcycle) {
    // 1. Motorcycle Frame & Engine Block
    const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.34, 1.25)), trimMat);
    frame.position.set(0, 0.54, 0.04);
    frame.castShadow = enableShadows;
    chassisGroup.add(frame);

    // 2. Fuel Tank (Sculpted accent color)
    const tank = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.24, 0.58)), paintMat);
    tank.position.set(0, 0.78, -0.22);
    tank.rotation.x = 0.14;
    tank.castShadow = enableShadows;
    chassisGroup.add(tank);

    // 3. Seat & Rear Tail Fairing
    const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.14, 0.62)), trimMat);
    seat.position.set(0, 0.73, 0.32);
    chassisGroup.add(seat);

    const tailFairing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.16, 0.36)), paintMat);
    tailFairing.position.set(0, 0.72, 0.74);
    tailFairing.rotation.x = -0.18;
    chassisGroup.add(tailFairing);

    // 4. Exhaust Pipe
    const exhaust = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 8)),
      chromeMat,
    );
    exhaust.rotation.x = Math.PI * 0.5;
    exhaust.position.set(0.2, 0.36, 0.42);
    chassisGroup.add(exhaust);

    // 5. Rear Wheel
    const rearWheel = buildWheelMesh(spec.wheelRadius, 0.18);
    rearWheel.position.set(0, spec.wheelRadius, 0.72);
    chassisGroup.add(rearWheel);
    wheels.push(rearWheel);

    // 6. Steerable Front Fork + Handlebar + Headlight + Front Wheel
    const forkPivot = new THREE.Group();
    forkPivot.position.set(0, 0.31, -0.72);
    chassisGroup.add(forkPivot);
    frontSteerPivots.push(forkPivot);

    const forkBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.72, 0.1)), chromeMat);
    forkBar.position.set(0, 0.34, 0.08);
    forkBar.rotation.x = 0.24;
    forkPivot.add(forkBar);

    const handlebar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.06, 0.08)), trimMat);
    handlebar.position.set(0, 0.68, 0.16);
    forkPivot.add(handlebar);

    const headlight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.14, 0.1)), headLightMat);
    headlight.position.set(0, 0.54, -0.02);
    forkPivot.add(headlight);

    const frontWheel = buildWheelMesh(spec.wheelRadius, 0.16);
    forkPivot.add(frontWheel);
    wheels.push(frontWheel);

    const taillight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.08, 0.06)), tailLightMat);
    taillight.position.set(0, 0.68, 0.94);
    chassisGroup.add(taillight);
  } else {
    // 4-Wheel Car / SUV / Sports / Pickup
    const isSports = vehicle.kind === 'sports';
    const isSuv = vehicle.kind === 'suv';
    const isPickup = vehicle.kind === 'pickup';

    const bodyH = isSports ? 0.48 : isSuv ? 0.76 : isPickup ? 0.68 : 0.6;
    const cabH = isSports ? 0.44 : isSuv ? 0.62 : isPickup ? 0.6 : 0.52;
    const wheelR = spec.wheelRadius;
    const halfLen = spec.length * 0.5;
    const halfW = spec.width * 0.5;

    // 1. Lower Chassis / Skirts & Bumpers
    const lowerDeck = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(spec.width * 0.96, 0.22, spec.length * 0.98)),
      trimMat,
    );
    lowerDeck.position.set(0, wheelR * 0.78, 0);
    chassisGroup.add(lowerDeck);

    if (isPickup) {
      // Pickup: Separate front hood/cab + open rear cargo bed
      const hood = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.width, bodyH, 2.35)),
        paintMat,
      );
      hood.position.set(0, wheelR * 0.75 + bodyH * 0.5, -1.05);
      hood.castShadow = enableShadows;
      chassisGroup.add(hood);

      const cab = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.width * 0.88, cabH, 1.35)),
        paintMat,
      );
      cab.position.set(0, wheelR * 0.75 + bodyH + cabH * 0.5 - 0.02, -0.58);
      cab.castShadow = enableShadows;
      chassisGroup.add(cab);

      const cabGlass = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.width * 0.89, cabH * 0.76, 1.15)),
        glassMat,
      );
      cabGlass.position.set(0, wheelR * 0.75 + bodyH + cabH * 0.46, -0.58);
      chassisGroup.add(cabGlass);

      // Cargo Bed Sides & Floor
      const bedFloor = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.width * 0.94, 0.2, 2.05)),
        trimMat,
      );
      bedFloor.position.set(0, wheelR * 0.75 + 0.14, 1.18);
      chassisGroup.add(bedFloor);

      for (const sx of [-halfW + 0.12, halfW - 0.12]) {
        const bedWall = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.18, bodyH * 0.92, 2.05)),
          paintMat,
        );
        bedWall.position.set(sx, wheelR * 0.75 + bodyH * 0.46, 1.18);
        bedWall.castShadow = enableShadows;
        chassisGroup.add(bedWall);
      }

      const tailgate = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.width, bodyH * 0.92, 0.18)),
        paintMat,
      );
      tailgate.position.set(0, wheelR * 0.75 + bodyH * 0.46, halfLen - 0.16);
      chassisGroup.add(tailgate);
    } else {
      // Main Hull Body (with Police white doors contrast)
      const hull = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.width, bodyH, spec.length)),
        paintMat,
      );
      hull.position.set(0, wheelR * 0.75 + bodyH * 0.5, 0);
      hull.castShadow = enableShadows;
      hull.receiveShadow = enableShadows;
      chassisGroup.add(hull);

      if (vehicle.isPolice) {
        const whiteDoors = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(spec.width + 0.03, bodyH * 0.86, spec.length * 0.44)),
          policeWhiteMat,
        );
        whiteDoors.position.set(0, wheelR * 0.75 + bodyH * 0.52, 0.05);
        chassisGroup.add(whiteDoors);
      }

      // Cabin Roof + Glazed Greenhouse
      const cabLen = isSuv ? spec.length * 0.58 : isSports ? spec.length * 0.46 : spec.length * 0.48;
      const cabZ = isSuv ? 0.24 : 0.18;

      const glassBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.width * 0.84, cabH * 0.84, cabLen)),
        glassMat,
      );
      glassBand.position.set(0, wheelR * 0.75 + bodyH + cabH * 0.42 - 0.03, cabZ);
      glassBand.castShadow = enableShadows;
      chassisGroup.add(glassBand);

      const roofCap = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.width * 0.8, 0.1, cabLen * 0.82)),
        vehicle.isPolice ? policeWhiteMat : paintMat,
      );
      roofCap.position.set(0, wheelR * 0.75 + bodyH + cabH - 0.06, cabZ);
      chassisGroup.add(roofCap);

      // Sports Car Racing Stripe & Rear Wing Spoiler
      if (isSports) {
        const stripe = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.32, 0.03, spec.length * 0.92)),
          policeWhiteMat,
        );
        stripe.position.set(0, wheelR * 0.75 + bodyH + 0.01, 0);
        chassisGroup.add(stripe);

        const spoilerBlade = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(spec.width * 0.94, 0.08, 0.34)),
          trimMat,
        );
        spoilerBlade.position.set(0, wheelR * 0.75 + bodyH + 0.28, halfLen - 0.28);
        chassisGroup.add(spoilerBlade);

        for (const sx of [-0.55, 0.55]) {
          const strut = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.28, 0.16)), trimMat);
          strut.position.set(sx, wheelR * 0.75 + bodyH + 0.14, halfLen - 0.28);
          chassisGroup.add(strut);
        }
      }

      // SUV Roof Rails
      if (isSuv) {
        for (const rx of [-0.56, 0.56]) {
          const rail = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.07, 0.08, cabLen * 0.78)),
            chromeMat,
          );
          rail.position.set(rx, wheelR * 0.75 + bodyH + cabH + 0.01, cabZ);
          chassisGroup.add(rail);
        }
      }

      // Police Roof Lightbar (Red & Blue strobe pods)
      if (vehicle.isPolice) {
        const barBase = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.12, 0.08, 0.28)),
          trimMat,
        );
        barBase.position.set(0, wheelR * 0.75 + bodyH + cabH + 0.02, cabZ - 0.1);
        chassisGroup.add(barBase);

        policeRedMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: 0xdc2626,
            emissive: 0xff2020,
            emissiveIntensity: 0.4,
            roughness: 0.15,
          }),
        );
        policeBlueMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: 0x2563eb,
            emissive: 0x3b82f6,
            emissiveIntensity: 0.4,
            roughness: 0.15,
          }),
        );

        const redPod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.14, 0.24)), policeRedMat);
        redPod.position.set(-0.32, wheelR * 0.75 + bodyH + cabH + 0.09, cabZ - 0.1);
        const bluePod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.14, 0.24)), policeBlueMat);
        bluePod.position.set(0.32, wheelR * 0.75 + bodyH + cabH + 0.09, cabZ - 0.1);
        chassisGroup.add(redPod, bluePod);
      }
    }

    // Front Grille, Headlights & Taillights
    const grille = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(spec.width * 0.48, bodyH * 0.34, 0.08)),
      chromeMat,
    );
    grille.position.set(0, wheelR * 0.75 + bodyH * 0.36, -halfLen - 0.01);
    chassisGroup.add(grille);

    const hlGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.14, 0.08));
    for (const hx of [-halfW * 0.68, halfW * 0.68]) {
      const hl = new THREE.Mesh(hlGeo, headLightMat);
      hl.position.set(hx, wheelR * 0.75 + bodyH * 0.56, -halfLen - 0.01);
      const tl = new THREE.Mesh(hlGeo, tailLightMat);
      tl.position.set(hx, wheelR * 0.75 + bodyH * 0.58, halfLen + 0.01);
      chassisGroup.add(hl, tl);
    }

    // 4 Articulated Wheels (Front 2 inside steer pivots)
    const frontZ = -spec.wheelBase * 0.5;
    const rearZ = spec.wheelBase * 0.5;
    const trackHalf = spec.trackWidth * 0.5;

    for (const wx of [-trackHalf, trackHalf]) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, wheelR, frontZ);
      root.add(pivot);
      frontSteerPivots.push(pivot);

      const fw = buildWheelMesh(wheelR, 0.24);
      pivot.add(fw);
      wheels.push(fw);

      const rw = buildWheelMesh(wheelR, 0.25);
      rw.position.set(wx, wheelR, rearZ);
      root.add(rw);
      wheels.push(rw);
    }
  }

  return {
    root,
    chassisGroup,
    frontSteerPivots,
    wheels,
    paintMat,
    tailLightMat,
    headLightMat,
    policeRedMat,
    policeBlueMat,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

export function setVehiclePaintColor(rig: VehicleRig, hexColor: number): void {
  rig.paintMat.color.setHex(hexColor);
}

export function animateVehicleRig(
  rig: VehicleRig,
  vehicle: VehicleState,
  wantedLevel: number,
  isNightOrDusk: boolean,
): void {
  rig.root.position.set(vehicle.x, vehicle.y, vehicle.z);
  rig.root.rotation.y = vehicle.yaw;

  // Suspension body roll / motorcycle bank
  rig.chassisGroup.rotation.z = vehicle.leanAngle;

  // Front steering pivots
  for (let i = 0; i < rig.frontSteerPivots.length; i++) {
    rig.frontSteerPivots[i].rotation.y = vehicle.steerAngle;
  }

  // Wheel rolling rotation
  for (let i = 0; i < rig.wheels.length; i++) {
    rig.wheels[i].rotation.x = vehicle.wheelSpin;
  }

  // Headlights & Taillights
  rig.headLightMat.emissiveIntensity = isNightOrDusk ? 1.85 : 0.4;
  rig.tailLightMat.emissiveIntensity = vehicle.isBraking ? 2.1 : isNightOrDusk ? 0.9 : 0.3;

  // Police siren strobe
  if (rig.policeRedMat && rig.policeBlueMat) {
    if (vehicle.isPolice && wantedLevel > 0) {
      const phase = Math.sin(vehicle.sirenPhase);
      rig.policeRedMat.emissiveIntensity = phase > 0 ? 3.2 : 0.25;
      rig.policeBlueMat.emissiveIntensity = phase <= 0 ? 3.2 : 0.25;
    } else {
      rig.policeRedMat.emissiveIntensity = 0.25;
      rig.policeBlueMat.emissiveIntensity = 0.25;
    }
  }
}
