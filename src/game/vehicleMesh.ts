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
    new THREE.MeshPhysicalMaterial({
      color: vehicle.isPolice ? 0x162238 : vehicle.color,
      roughness: 0.22,
      metalness: 0.52,
      clearcoat: 0.92,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.25,
    }),
  );
  const policeWhiteMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf1f5f9,
      roughness: 0.26,
      metalness: 0.28,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16,
    }),
  );
  const trimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.65, metalness: 0.35 }),
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd0d7e0, roughness: 0.18, metalness: 0.9 }),
  );
  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e3242,
      roughness: 0.08,
      metalness: 0.72,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    }),
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
  } else if (vehicle.kind === 'jetski') {
    // Sleek Jet Ski / WaveRunner facing -Z
    shadowPlane.visible = false;
    const hull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.96, 0.34, 2.35)), paintMat);
    hull.position.set(0, 0.24, 0);
    hull.castShadow = enableShadows;
    chassisGroup.add(hull);

    const bowTip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.48, 0.72, 6)), paintMat);
    bowTip.rotation.x = -Math.PI * 0.5;
    bowTip.scale.set(1.0, 1.0, 0.55);
    bowTip.position.set(0, 0.27, -1.48);
    chassisGroup.add(bowTip);

    const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.04, 0.14, 1.95)), policeWhiteMat);
    deck.position.set(0, 0.44, 0.08);
    chassisGroup.add(deck);

    const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.2, 0.92)), trimMat);
    seat.position.set(0, 0.6, 0.28);
    chassisGroup.add(seat);

    const cowl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.28, 0.72)), paintMat);
    cowl.position.set(0, 0.56, -0.58);
    cowl.rotation.x = 0.22;
    chassisGroup.add(cowl);

    const shield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.16, 0.22)), glassMat);
    shield.position.set(0, 0.72, -0.56);
    shield.rotation.x = -0.55;
    chassisGroup.add(shield);

    const barPivot = new THREE.Group();
    barPivot.position.set(0, 0.68, -0.4);
    chassisGroup.add(barPivot);
    frontSteerPivots.push(barPivot);

    const stem = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.22, 0.1)), chromeMat);
    stem.position.set(0, 0.1, 0);
    const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 0.06, 0.08)), trimMat);
    bar.position.set(0, 0.2, 0.02);
    barPivot.add(stem, bar);

    const nozzle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 10)), trimMat);
    nozzle.rotation.x = Math.PI * 0.5;
    nozzle.position.set(0, 0.22, 1.24);
    chassisGroup.add(nozzle);

    const impeller = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.04, 0.04)), chromeMat);
    impeller.position.set(0, 0.22, 1.36);
    chassisGroup.add(impeller);
    wheels.push(impeller);
  } else if (vehicle.kind === 'speedboat') {
    // Luxury Coastal Speedboat facing -Z
    shadowPlane.visible = false;
    const keel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.72, 0.52, 4.1)), policeWhiteMat);
    keel.position.set(0, 0.28, 0.25);
    keel.castShadow = enableShadows;
    chassisGroup.add(keel);

    const sideHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.04, 0.48, 3.85)), paintMat);
    sideHull.position.set(0, 0.42, 0.3);
    sideHull.castShadow = enableShadows;
    chassisGroup.add(sideHull);

    const bow = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.06, 1.65, 4)), paintMat);
    bow.rotation.y = Math.PI * 0.25;
    bow.rotation.x = -Math.PI * 0.5;
    bow.scale.set(1.0, 1.0, 0.42);
    bow.position.set(0, 0.42, -2.35);
    chassisGroup.add(bow);

    const bowDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.78, 0.12, 1.85)), policeWhiteMat);
    bowDeck.position.set(0, 0.68, -1.0);
    chassisGroup.add(bowDeck);

    const cockpitFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.7, 0.1, 2.35)), trimMat);
    cockpitFloor.position.set(0, 0.5, 0.72);
    chassisGroup.add(cockpitFloor);

    const windshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.76, 0.36, 0.58)), glassMat);
    windshield.position.set(0, 0.84, -0.32);
    windshield.rotation.x = -0.45;
    chassisGroup.add(windshield);

    const helm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.38, 0.42)), trimMat);
    helm.position.set(0.32, 0.68, -0.15);
    chassisGroup.add(helm);

    const helmWheel = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.14, 0.025, 8, 16)), chromeMat);
    helmWheel.position.set(0.32, 0.84, 0.06);
    helmWheel.rotation.x = -0.35;
    chassisGroup.add(helmWheel);

    for (const sx of [-0.42, 0.42]) {
      const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.56, 0.36, 0.54)), policeWhiteMat);
      seat.position.set(sx, 0.68, 0.35);
      chassisGroup.add(seat);
    }
    const bench = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.64, 0.38, 0.58)), policeWhiteMat);
    bench.position.set(0, 0.7, 1.45);
    chassisGroup.add(bench);

    // Twin Outboard Motors + Spinning Propellers
    for (const mx of [-0.46, 0.46]) {
      const outboardPivot = new THREE.Group();
      outboardPivot.position.set(mx, 0.42, 2.42);
      chassisGroup.add(outboardPivot);
      frontSteerPivots.push(outboardPivot);

      const cowling = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.44, 0.42)), trimMat);
      cowling.position.set(0, 0.24, 0.06);
      const lowerLeg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.52, 0.2)), trimMat);
      lowerLeg.position.set(0, -0.16, 0.06);
      outboardPivot.add(cowling, lowerLeg);

      const prop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.07, 0.05)), chromeMat);
      prop.position.set(0, -0.34, 0.22);
      outboardPivot.add(prop);
      wheels.push(prop);
    }

    const navLight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.1, 0.1)), headLightMat);
    navLight.position.set(0, 0.78, -2.0);
    chassisGroup.add(navLight);
  } else if (vehicle.kind === 'submarine') {
    // Deep-Sea Explorer Submarine facing -Z
    shadowPlane.visible = false;
    const subGlassMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.42,
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1.0,
      }),
    );
    const floodMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x7dd3fc,
        emissiveIntensity: 1.9,
        roughness: 0.1,
      }),
    );

    const pressureHull = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.84, 0.8, 3.3, 18)),
      paintMat,
    );
    pressureHull.rotation.x = Math.PI * 0.5;
    pressureHull.position.set(0, 0.56, 0.18);
    pressureHull.castShadow = enableShadows;
    chassisGroup.add(pressureHull);

    // Clear Acrylic Bow Observatory Dome
    const bowDome = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.84, 20, 16)),
      subGlassMat,
    );
    bowDome.position.set(0, 0.56, -1.48);
    chassisGroup.add(bowDome);

    const noseRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.84, 0.08, 10, 22)),
      trimMat,
    );
    noseRing.position.set(0, 0.56, -1.46);
    chassisGroup.add(noseRing);

    // Side Ballast Pods & Floodlights
    for (const bx of [-0.94, 0.94]) {
      const pod = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 2.65, 12)),
        trimMat,
      );
      pod.rotation.x = Math.PI * 0.5;
      pod.position.set(bx, 0.34, 0.1);
      chassisGroup.add(pod);

      const lamp = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 12)), floodMat);
      lamp.rotation.x = Math.PI * 0.5;
      lamp.position.set(bx, 0.38, -1.25);
      chassisGroup.add(lamp);

      const fin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.08, 0.42)), paintMat);
      fin.position.set(bx * 1.15, 0.56, -0.55);
      chassisGroup.add(fin);
    }

    // Conning Tower & Periscope
    const tower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.68, 1.18)), paintMat);
    tower.position.set(0, 1.56, -0.15);
    chassisGroup.add(tower);

    const periscope = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.52, 8)), chromeMat);
    periscope.position.set(0, 2.08, -0.25);
    chassisGroup.add(periscope);

    // Tapered Stern + Shroud + Brass Propeller
    const stern = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.8, 1.25, 16)),
      paintMat,
    );
    stern.rotation.x = Math.PI * 0.5;
    stern.position.set(0, 0.56, 2.42);
    chassisGroup.add(stern);

    const rudderPivot = new THREE.Group();
    rudderPivot.position.set(0, 0.56, 2.86);
    chassisGroup.add(rudderPivot);
    frontSteerPivots.push(rudderPivot);

    const rudder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.92, 0.46)), trimMat);
    rudderPivot.add(rudder);

    const shroud = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.38, 0.06, 10, 18)), trimMat);
    shroud.position.set(0, 0.56, 3.04);
    chassisGroup.add(shroud);

    const propGroup = new THREE.Group();
    propGroup.position.set(0, 0.56, 3.05);
    chassisGroup.add(propGroup);
    const blade1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.64, 0.1, 0.06)), chromeMat);
    const blade2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.64, 0.06)), chromeMat);
    propGroup.add(blade1, blade2);
    wheels.push(propGroup);
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

  // Pitch (submarine climb/dive & boat planing) + Suspension body roll / motorcycle bank
  rig.chassisGroup.rotation.order = 'YXZ';
  rig.chassisGroup.rotation.x = vehicle.pitch ?? 0;
  rig.chassisGroup.rotation.z = vehicle.leanAngle;

  // Front steering pivots (or rudder / outboard steering)
  for (let i = 0; i < rig.frontSteerPivots.length; i++) {
    rig.frontSteerPivots[i].rotation.y = vehicle.steerAngle;
  }

  // Wheel / propeller rolling rotation
  const isProp =
    vehicle.kind === 'jetski' || vehicle.kind === 'speedboat' || vehicle.kind === 'submarine';
  for (let i = 0; i < rig.wheels.length; i++) {
    if (isProp) {
      rig.wheels[i].rotation.z = vehicle.wheelSpin;
    } else {
      rig.wheels[i].rotation.x = vehicle.wheelSpin;
    }
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
