import * as THREE from 'three';
import { buildExteriorEntranceDoor, type ExteriorDoorRig } from './interiorBuilder';
import type { CityTextures } from './textures';
import type { BuildingSpec, CityLayout, HouseSpec, ParkedVehicleSpec } from './types';
import { getSingleBridgeHeight, OCEAN_SEABED_Y, WATER_SURFACE_Y } from './worldData';

export interface BuiltCity {
  group: THREE.Group;
  skyDome: THREE.Mesh;
  animatedWaterMeshes: THREE.Mesh[];
  bayWater: THREE.Mesh;
  skyUniforms: {
    topColor: { value: THREE.Color };
    horizonColor: { value: THREE.Color };
    sunColor: { value: THREE.Color };
    sunDir: { value: THREE.Vector3 };
  };
  lampBulbMat: THREE.MeshStandardMaterial;
  windowGlowMat: THREE.MeshStandardMaterial;
  buildingWindowMats: THREE.MeshStandardMaterial[];
  exteriorDoors: Map<string, ExteriorDoorRig>;
  updateEnvironment: (elapsedTime: number) => void;
  dispose: () => void;
}

export function buildCityScene(
  layout: CityLayout,
  textures: CityTextures,
  enableShadows: boolean,
): BuiltCity {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const texturesToDispose: THREE.Texture[] = [];
  const animatedWaterMeshes: THREE.Mesh[] = [];
  const buildingWindowMats: THREE.MeshStandardMaterial[] = [];
  const landmarkSpinners: Array<{
    obj: THREE.Object3D;
    speed: number;
    bobBaseY?: number;
    bobAmp?: number;
  }> = [];
  const underwaterFishSchools: Array<{
    pivot: THREE.Group;
    speed: number;
    phase: number;
    fishFins: THREE.Mesh[];
  }> = [];
  const underwaterMantas: Array<{
    group: THREE.Group;
    centerX: number;
    centerZ: number;
    radiusX: number;
    radiusZ: number;
    baseY: number;
    speed: number;
    phase: number;
    wingL: THREE.Mesh;
    wingR: THREE.Mesh;
  }> = [];
  const underwaterKelp: Array<{ mesh: THREE.Mesh; phase: number; speed: number }> = [];
  const underwaterBubbles: Array<{ mesh: THREE.Mesh; baseY: number; phase: number; speed: number }> = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    texturesToDispose.push(t);
    return t;
  };

  // 1. Sky Dome (horizon-matched gradient shader updated by TimeOfDay, follows player)
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x4c8fd6) },
    horizonColor: { value: new THREE.Color(0xd7e9f6) },
    sunColor: { value: new THREE.Color(0xfff5db) },
    sunDir: { value: new THREE.Vector3(0.52, 0.72, 0.42).normalize() },
  };
  const skyGeo = trackGeo(new THREE.SphereGeometry(1650, 28, 18));
  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        void main() {
          vec3 dir = normalize(vWorldPos - cameraPosition);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.56));
          float sunDot = max(dot(dir, sunDir), 0.0);
          col = mix(col, sunColor, pow(sunDot, 22.0) * 0.72);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  // 2. Global Ocean Surface, Deep Seabed, Island Land Bases, Distant Mainland & Hills
  const bayMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x16749a,
      roughness: 0.14,
      metalness: 0.28,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const bayWater = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(2200, 2200, 1, 1)), bayMat);
  bayWater.rotation.x = -Math.PI / 2;
  bayWater.position.set(140, WATER_SURFACE_Y, 0);
  bayWater.receiveShadow = enableShadows;
  group.add(bayWater);

  // Sandy Deep Ocean Floor (y = OCEAN_SEABED_Y = -13.5)
  const seabedSandMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xb9a882, roughness: 0.96, metalness: 0.0 }),
  );
  const seabedFloor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1400, 1400, 1, 1)),
    seabedSandMat,
  );
  seabedFloor.rotation.x = -Math.PI / 2;
  seabedFloor.position.set(140, OCEAN_SEABED_Y - 0.18, 0);
  seabedFloor.receiveShadow = enableShadows;
  group.add(seabedFloor);

  const outerLandMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x5c8252, roughness: 0.94 }),
  );
  const seawallEdgeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x808790, roughness: 0.86 }),
  );
  const underwaterRockWallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.92 }),
  );

  // Island embankments under each city (extending down to seabed so underwater views look solid)
  for (const city of layout.cities) {
    const cw = city.landMaxX - city.landMinX + 4;
    const cd = city.landMaxZ - city.landMaxZ === 0 ? city.landMaxZ - city.landMinZ + 4 : city.landMaxZ - city.landMinZ + 4;
    const cx = (city.landMinX + city.landMaxX) * 0.5;
    const cz = (city.landMinZ + city.landMaxZ) * 0.5;
    const islandSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(cw, 0.9, cd)), seawallEdgeMat);
    islandSlab.position.set(cx, -0.49, cz);
    islandSlab.receiveShadow = enableShadows;
    group.add(islandSlab);

    const islandDeepBase = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(cw - 1.5, 13.6, cd - 1.5)),
      underwaterRockWallMat,
    );
    islandDeepBase.position.set(cx, -7.5, cz);
    group.add(islandDeepBase);

    const grassCap = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(cw - 1.2, cd - 1.2)), outerLandMat);
    grassCap.rotation.x = -Math.PI / 2;
    grassCap.position.set(cx, -0.025, cz);
    grassCap.receiveShadow = enableShadows;
    group.add(grassCap);
  }

  // Far-West, Far-North & Far-South Horizon Parkland + Rolling Hills (clear of channels, bridges & airports)
  const westParkland = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(260, 1300)), outerLandMat);
  westParkland.rotation.x = -Math.PI / 2;
  westParkland.position.set(-360, -0.1, 0);
  group.add(westParkland);

  const hillMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x42663f, roughness: 0.94 }));
  const hillGeo = trackGeo(
    new THREE.SphereGeometry(48, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  );
  const hillCoords: Array<[number, number, number, number]> = [
    [-295, -240, 1.5, 0.46],
    [-310, -80, 1.8, 0.52],
    [-285, 65, 1.6, 0.48],
    [-295, 290, 1.6, 0.44],
    [-95, -455, 1.7, 0.44],
    [45, -460, 1.5, 0.38],
    [-65, 455, 1.6, 0.42],
    [55, 460, 1.5, 0.38],
    [310, -210, 1.4, 0.36],
  ];
  for (const [hx, hz, sx, sy] of hillCoords) {
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(hx, -0.35, hz);
    hill.scale.set(sx, sy, sx * 1.15);
    group.add(hill);
  }

  // Distant Harbor Lighthouse (with submerged reef rock foundation down to seabed)
  const lhGroup = new THREE.Group();
  lhGroup.position.set(170, -0.4, -56);
  const lhSubBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(8.5, 13.5, 14.0, 10)),
    underwaterRockWallMat,
  );
  lhSubBase.position.y = -6.5;
  const lhRock = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(7, 10, 3.2, 8)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x6c7278, roughness: 0.92 })),
  );
  lhRock.position.y = 1.4;
  const lhTower = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.4, 2.2, 16, 12)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.65 })),
  );
  lhTower.position.y = 10.5;
  const lhBeacon = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.6, 1.6, 2.2, 12)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xb83a2d,
        emissive: 0xffd27d,
        emissiveIntensity: 0.8,
      }),
    ),
  );
  lhBeacon.position.y = 19.2;
  lhGroup.add(lhSubBase, lhRock, lhTower, lhBeacon);
  group.add(lhGroup);

  // 2B. Outer Decorative Skyline Silhouette (far west, north & south outer horizons)
  const distBuildingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      map: textures.buildingWindowMap,
      emissive: 0xffd796,
      emissiveMap: textures.buildingWindowMap,
      emissiveIntensity: 0.12,
      roughness: 0.55,
      metalness: 0.22,
    }),
  );
  buildingWindowMats.push(distBuildingMat);

  const outerTowers: Array<[number, number, number, number, number]> = [
    [-250, -52, 14, 14, 42],
    [-260, -10, 16, 16, 56],
    [-248, 36, 14, 14, 34],
    [-262, 76, 15, 15, 28],
    [-42, -412, 16, 16, 48],
    [12, -418, 18, 16, 62],
    [66, -412, 14, 14, 36],
    [-40, 412, 16, 15, 44],
    [14, 418, 18, 16, 54],
    [64, 410, 14, 14, 38],
  ];
  for (const [ox, oz, ow, od, oh] of outerTowers) {
    const tMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ow, oh, od)), distBuildingMat);
    tMesh.position.set(ox, oh * 0.5 - 0.1, oz);
    group.add(tMesh);
  }

  // 2C. International Airports (Tarmac Aprons, Runways, Connectors, Ribbed Hangars, Lathe ATC Towers, Swept-Wing Gate Jets)
  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.asphaltMap,
      bumpMap: textures.asphaltBump,
      bumpScale: 0.035,
      roughness: 0.88,
      metalness: 0.04,
    }),
  );
  const apronMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.88 }));
  const runwayStripeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }));
  const hangarMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.55, metalness: 0.42 }));
  const atcShaftMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xdbe2e8, roughness: 0.48, metalness: 0.15 }));
  const atcCabMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.35,
      roughness: 0.14,
      metalness: 0.62,
    }),
  );
  const atcRadarMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xfef08a, emissiveIntensity: 0.55 }),
  );
  const jetWhiteMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.24, metalness: 0.32 }));
  const jetTailMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.34 }));
  const jetDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.68 }));
  const boardingBeaconMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    }),
  );
  const atcRadars: THREE.Mesh[] = [];
  const atcShaftProfile = [
    new THREE.Vector2(3.1, 0),
    new THREE.Vector2(2.7, 2.2),
    new THREE.Vector2(1.9, 5.5),
    new THREE.Vector2(1.55, 14.5),
    new THREE.Vector2(2.05, 19.8),
    new THREE.Vector2(2.85, 22.0),
  ];
  const sharedAtcShaftGeo = trackGeo(new THREE.LatheGeometry(atcShaftProfile, 12));

  for (const ap of layout.airports) {
    const apW = ap.apronMaxX - ap.apronMinX;
    const apD = ap.apronMaxZ - ap.apronMinZ;
    const apCx = (ap.apronMinX + ap.apronMaxX) * 0.5;
    const apCz = (ap.apronMinZ + ap.apronMaxZ) * 0.5;

    // Concrete reclamation slab beneath airport apron so it sits cleanly above ocean
    const apFoundation = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(apW + 6, 0.9, apD + 6)),
      seawallEdgeMat,
    );
    apFoundation.position.set(apCx, -0.47, apCz);
    apFoundation.receiveShadow = enableShadows;
    group.add(apFoundation);

    const apron = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(apW, apD)), apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(apCx, 0.02, apCz);
    apron.receiveShadow = enableShadows;
    group.add(apron);

    // Connector roads linking airport apron cleanly to host city grid
    for (const cr of ap.connectorRects) {
      const cw = cr.maxX - cr.minX;
      const cd = cr.maxZ - cr.minZ;
      const ccx = (cr.minX + cr.maxX) * 0.5;
      const ccz = (cr.minZ + cr.maxZ) * 0.5;
      const roadSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(cw + 1.5, 0.85, cd + 1.5)), seawallEdgeMat);
      roadSlab.position.set(ccx, -0.44, ccz);
      const roadTop = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(cw, cd)), roadMat);
      roadTop.rotation.x = -Math.PI / 2;
      roadTop.position.set(ccx, 0.015, ccz);
      roadTop.receiveShadow = enableShadows;
      group.add(roadSlab, roadTop);
    }

    // Runway centerline dashes & threshold stripes
    const rLen = ap.runwayEndX - ap.runwayStartX;
    const rMidX = (ap.runwayStartX + ap.runwayEndX) * 0.5;
    for (let rx = -rLen * 0.44; rx <= rLen * 0.44; rx += 9) {
      const dash = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(4.6, 0.48)), runwayStripeMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(rMidX + rx, 0.05, ap.runwayZ);
      group.add(dash);
    }
    for (let tz = -4; tz <= 4; tz += 2) {
      const th1 = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.2, 0.65)), runwayStripeMat);
      th1.rotation.x = -Math.PI / 2;
      th1.position.set(ap.runwayStartX + 4, 0.05, ap.runwayZ + tz);
      const th2 = th1.clone();
      th2.position.x = ap.runwayEndX - 4;
      group.add(th1, th2);
    }

    // Align ATC & Hangar to the enterable terminal BuildingSpec (terminal itself is rendered by buildUrbanBuilding)
    const term = layout.buildings.find((b) => b.id === ap.terminalBuildingId);
    const atcX = term ? term.x - 28 : ap.centerX - 34;
    const atcZ = term ? term.z : ap.centerZ - 16;
    const hangarX = term ? term.x + 40 : ap.centerX + 34;
    const hangarZ = term ? term.z + 2 : ap.centerZ - 14;

    const hangarGroup = new THREE.Group();
    hangarGroup.position.set(hangarX, 0, hangarZ);
    const hangar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(9, 9, 22, 16, 1, false, 0, Math.PI)),
      hangarMat,
    );
    hangar.rotation.z = Math.PI * 0.5;
    hangar.castShadow = enableShadows;
    hangarGroup.add(hangar);
    const ribGeo = trackGeo(new THREE.TorusGeometry(9.12, 0.22, 6, 18, Math.PI));
    for (const rx of [-8.5, 0, 8.5]) {
      const rib = new THREE.Mesh(ribGeo, atcCabMat);
      rib.rotation.y = Math.PI * 0.5;
      rib.position.x = rx;
      hangarGroup.add(rib);
    }
    group.add(hangarGroup);

    const atcShaft = new THREE.Mesh(sharedAtcShaftGeo, atcShaftMat);
    atcShaft.position.set(atcX, 0, atcZ);
    atcShaft.castShadow = enableShadows;
    const atcCab = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(4.2, 2.85, 4.0, 12)), atcCabMat);
    atcCab.position.set(atcX, 24.0, atcZ);
    const atcCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.8, 4.4, 1.4, 12)), atcShaftMat);
    atcCap.position.set(atcX, 26.6, atcZ);
    const atcRadar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 0.72, 0.48)), atcRadarMat);
    atcRadar.position.set(atcX, 27.9, atcZ);
    atcRadars.push(atcRadar);
    group.add(atcShaft, atcCab, atcCap, atcRadar);

    // Swept-Wing Passenger Jetliner at Gate + Boarding Zone Beacon Ring
    const parkedJet = new THREE.Group();
    parkedJet.position.set(ap.gateJetX, 1.85, ap.gateJetZ);
    parkedJet.rotation.y = ap.gateJetYaw;
    const jetFuse = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(1.18, 13.8, 6, 12)), jetWhiteMat);
    jetFuse.rotation.z = Math.PI * 0.5;
    jetFuse.castShadow = enableShadows;
    const jetNose = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.12, 2.6, 12)), jetWhiteMat);
    jetNose.rotation.z = -Math.PI * 0.5;
    jetNose.position.set(8.0, -0.05, 0);
    const wingL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.2, 7.6)), jetWhiteMat);
    wingL.position.set(-0.6, -0.25, -4.1);
    wingL.rotation.y = 0.26;
    wingL.castShadow = enableShadows;
    const wingR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.2, 7.6)), jetWhiteMat);
    wingR.position.set(-0.6, -0.25, 4.1);
    wingR.rotation.y = -0.26;
    wingR.castShadow = enableShadows;
    const jetTail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.5, 3.6, 0.25)), jetTailMat);
    jetTail.position.set(-6.5, 1.95, 0);
    jetTail.rotation.z = 0.28;
    const jetHTail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 0.16, 4.8)), jetWhiteMat);
    jetHTail.position.set(-6.7, 0.45, 0);
    const jetEngGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.4, 1.75, 10));
    for (const ez of [-3.6, 3.6]) {
      const eng = new THREE.Mesh(jetEngGeo, jetDarkMat);
      eng.rotation.z = Math.PI * 0.5;
      eng.position.set(0.0, -0.65, ez);
      parkedJet.add(eng);
    }
    parkedJet.add(jetFuse, jetNose, wingL, wingR, jetTail, jetHTail);
    group.add(parkedJet);

    const boardingRing = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(4.8, 5.4, 24)),
      boardingBeaconMat,
    );
    boardingRing.rotation.x = -Math.PI / 2;
    boardingRing.position.set(ap.gateJetX, 0.05, ap.gateJetZ);
    group.add(boardingRing);
  }

  // 2D. Intercity Suspension Bridges (Grand Harbor East Bridge + Northern Aero Skyway Bridge)
  const bridgeAsphaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2f353d,
      map: textures.asphaltMap,
      roughness: 0.86,
    }),
  );
  const bridgeConcreteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.72, metalness: 0.1 }),
  );
  const bridgeSteelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.34, metalness: 0.74 }),
  );

  for (const br of layout.bridges) {
    const segCount = 16;
    const spanLen = br.end - br.start;
    const segStep = spanLen / segCount;
    const isX = br.axis === 'x';
    const cableMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: br.cableColor,
        emissive: br.cableColor,
        emissiveIntensity: 0.25,
        roughness: 0.3,
        metalness: 0.65,
      }),
    );

    for (let s = 0; s < segCount; s++) {
      const a0 = br.start + s * segStep;
      const a1 = br.start + (s + 1) * segStep;
      const aMid = (a0 + a1) * 0.5;
      const y0 = getSingleBridgeHeight(a0, br);
      const y1 = getSingleBridgeHeight(a1, br);
      const yMid = (y0 + y1) * 0.5;
      const segLength = Math.hypot(segStep, y1 - y0) + 0.12;
      const slope = Math.atan2(y1 - y0, segStep);

      const segGroup = new THREE.Group();
      if (isX) {
        segGroup.position.set(aMid, yMid, br.crossCenter);
        segGroup.rotation.z = slope;
      } else {
        segGroup.position.set(br.crossCenter, yMid, aMid);
        segGroup.rotation.x = -slope;
      }

      const roadDeck = new THREE.Mesh(
        trackGeo(
          new THREE.BoxGeometry(
            isX ? segLength : br.roadWidth,
            0.35,
            isX ? br.roadWidth : segLength,
          ),
        ),
        bridgeAsphaltMat,
      );
      roadDeck.position.y = -0.175;
      roadDeck.receiveShadow = enableShadows;
      segGroup.add(roadDeck);

      // Center yellow dashed strip
      const dash = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(isX ? segLength * 0.55 : 0.22, 0.03, isX ? 0.22 : segLength * 0.55)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xe6b23a, roughness: 0.7 })),
      );
      dash.position.y = 0.02;
      segGroup.add(dash);

      // Raised twin pedestrian walkways + outer steel guardrails
      for (const side of [-1, 1]) {
        const swOffset = side * (br.roadWidth * 0.5 + br.sidewalkWidth * 0.5);
        const swMesh = new THREE.Mesh(
          trackGeo(
            new THREE.BoxGeometry(
              isX ? segLength : br.sidewalkWidth,
              0.38,
              isX ? br.sidewalkWidth : segLength,
            ),
          ),
          bridgeConcreteMat,
        );
        swMesh.position.set(isX ? 0 : swOffset, 0.02, isX ? swOffset : 0);
        swMesh.receiveShadow = enableShadows;
        segGroup.add(swMesh);

        const railOffset = side * (br.roadWidth * 0.5 + br.sidewalkWidth - 0.14);
        const railBar = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(isX ? segLength : 0.16, 1.05, isX ? 0.16 : segLength)),
          bridgeSteelMat,
        );
        railBar.position.set(isX ? 0 : railOffset, 0.65, isX ? railOffset : 0);
        segGroup.add(railBar);
      }

      group.add(segGroup);
    }

    // Twin suspension pylons + pier foundations + main cables
    const towerHalfSpan = br.roadWidth * 0.5 + br.sidewalkWidth + 0.5;
    const towerHeight = br.deckHeight + 21;
    const pylonGeo = trackGeo(new THREE.BoxGeometry(1.6, towerHeight + 15.5, 1.6));
    const crossBeamGeo = trackGeo(
      new THREE.BoxGeometry(
        isX ? 1.4 : towerHalfSpan * 2 + 1.4,
        1.4,
        isX ? towerHalfSpan * 2 + 1.4 : 1.4,
      ),
    );
    const beaconGeo = trackGeo(new THREE.SphereGeometry(0.42, 8, 8));

    for (const tp of br.towerPositions) {
      const tg = new THREE.Group();
      tg.position.set(isX ? tp : br.crossCenter, 0, isX ? br.crossCenter : tp);

      for (const side of [-1, 1]) {
        const pylon = new THREE.Mesh(pylonGeo, bridgeConcreteMat);
        pylon.position.set(
          isX ? 0 : side * towerHalfSpan,
          (towerHeight - 14.5) * 0.5,
          isX ? side * towerHalfSpan : 0,
        );
        pylon.castShadow = enableShadows;
        tg.add(pylon);

        const beacon = new THREE.Mesh(beaconGeo, cableMat);
        beacon.position.set(
          isX ? 0 : side * towerHalfSpan,
          towerHeight + 0.35,
          isX ? side * towerHalfSpan : 0,
        );
        tg.add(beacon);
      }

      for (const by of [towerHeight * 0.58, towerHeight - 1.6]) {
        const crossBeam = new THREE.Mesh(crossBeamGeo, bridgeConcreteMat);
        crossBeam.position.y = by;
        tg.add(crossBeam);
      }

      group.add(tg);
    }

    // Parabolic main suspension cables & vertical hanger rods
    const cablePts = 14;
    const t0 = br.towerPositions[0];
    const t1 = br.towerPositions[1];
    const getCableY = (pos: number): number => {
      if (pos <= t0) {
        const u = (pos - br.start) / Math.max(1, t0 - br.start);
        return br.deckHeight + 1.2 + Math.pow(u, 1.45) * (towerHeight - br.deckHeight - 1.5);
      }
      if (pos >= t1) {
        const u = (br.end - pos) / Math.max(1, br.end - t1);
        return br.deckHeight + 1.2 + Math.pow(u, 1.45) * (towerHeight - br.deckHeight - 1.5);
      }
      const midT = (pos - t0) / Math.max(1, t1 - t0);
      const sag = Math.sin(midT * Math.PI) * 11.5;
      return towerHeight - 0.3 - sag;
    };

    for (const side of [-1, 1]) {
      const lateral = side * towerHalfSpan;
      for (let c = 0; c < cablePts; c++) {
        const p0 = br.start + (c / cablePts) * spanLen;
        const p1 = br.start + ((c + 1) / cablePts) * spanLen;
        const cy0 = getCableY(p0);
        const cy1 = getCableY(p1);
        const pMid = (p0 + p1) * 0.5;
        const cyMid = (cy0 + cy1) * 0.5;
        const cLen = Math.hypot(p1 - p0, cy1 - cy0) + 0.08;
        const cSlope = Math.atan2(cy1 - cy0, p1 - p0);

        const seg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, cLen, 6)), cableMat);
        if (isX) {
          seg.position.set(pMid, cyMid, br.crossCenter + lateral);
          seg.rotation.z = Math.PI * 0.5 + cSlope;
        } else {
          seg.position.set(br.crossCenter + lateral, cyMid, pMid);
          seg.rotation.x = Math.PI * 0.5 - cSlope;
        }
        group.add(seg);

        if (c > 0 && c < cablePts) {
          const deckY = getSingleBridgeHeight(p0, br);
          const rodH = Math.max(0.5, cy0 - deckY);
          const rod = new THREE.Mesh(
            trackGeo(new THREE.CylinderGeometry(0.05, 0.05, rodH, 5)),
            bridgeSteelMat,
          );
          rod.position.set(
            isX ? p0 : br.crossCenter + lateral,
            deckY + rodH * 0.5,
            isX ? br.crossCenter + lateral : p0,
          );
          group.add(rod);
        }
      }
    }
  }

  // Bay Ocean Ships (Cargo Freighter near Harbor + 3 Animated Coastal Sailboats, positioned clear of bridges)
  const cargoShip = new THREE.Group();
  cargoShip.position.set(148, -0.1, -60);
  const hullMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10.5, 4.0, 36)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.7 })),
  );
  hullMesh.position.y = 1.4;
  const deckBridge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(8.5, 6.2, 6.5)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 })),
  );
  deckBridge.position.set(0, 6.2, -12);
  cargoShip.add(hullMesh, deckBridge);
  const cargoColors = [0xd97706, 0x0284c7, 0x16a34a, 0xdc2626];
  for (let row = 0; row < 3; row++) {
    const cBox = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(6.4, 2.4, 6.2)),
      trackMat(new THREE.MeshStandardMaterial({ color: cargoColors[row % cargoColors.length], roughness: 0.65 })),
    );
    cBox.position.set(0, 4.6, -2 + row * 7.2);
    cargoShip.add(cBox);
  }
  group.add(cargoShip);

  const sailboats: Array<{ group: THREE.Group; baseY: number; phase: number }> = [];
  const boatCoords: Array<[number, number, number, number]> = [
    [146, 26, 0.4, 0xef4444],
    [182, 58, -0.6, 0x0ea5e9],
    [194, -54, 0.9, 0xf59e0b],
    [142, 224, -0.4, 0xf97316],
    [-148, 168, 0.7, 0xeab308],
  ];
  for (let i = 0; i < boatCoords.length; i++) {
    const [bx, bz, yaw, accentCol] = boatCoords[i];
    const sb = new THREE.Group();
    sb.position.set(bx, -0.22, bz);
    sb.rotation.y = yaw;
    const sHull = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.1, 0.9, 6.4)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })),
    );
    const sStripe = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.18, 0.25, 6.2)),
      trackMat(new THREE.MeshStandardMaterial({ color: accentCol, roughness: 0.45 })),
    );
    sStripe.position.y = 0.25;
    const sMast = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 6.8, 6)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.6, roughness: 0.3 })),
    );
    sMast.position.y = 3.5;
    const sSail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.08, 5.2, 3.2)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.7 })),
    );
    sSail.position.set(0, 3.6, 1.3);
    sb.add(sHull, sStripe, sMast, sSail);
    group.add(sb);
    sailboats.push({ group: sb, baseY: -0.22, phase: i * 1.9 });
  }

  // 3. Multi-City Asphalt Road Bases (y = 0) + Markings + Crosswalks
  for (const city of layout.cities) {
    const w = city.landMaxX - city.landMinX;
    const d = city.landMaxZ - city.landMinZ;
    const cx = (city.landMinX + city.landMaxX) * 0.5;
    const cz = (city.landMinZ + city.landMaxZ) * 0.5;
    const cityAsphalt = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(w, d)), roadMat);
    cityAsphalt.rotation.x = -Math.PI / 2;
    cityAsphalt.position.set(cx, 0.005, cz);
    cityAsphalt.receiveShadow = enableShadows;
    group.add(cityAsphalt);
  }

  const stripeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0ece1,
      roughness: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const yellowLineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6b23a,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const dashGeo = trackGeo(new THREE.PlaneGeometry(0.24, 2.8));
  const dashMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  const cwGeo = trackGeo(new THREE.PlaneGeometry(0.65, 2.8));
  const cwMatrices: THREE.Matrix4[] = [];

  for (const city of layout.cities) {
    const minX = city.roadCentersX[0] - 4;
    const maxX = city.roadCentersX[city.roadCentersX.length - 1] + 4;
    const minZ = city.roadCentersZ[0] - 4;
    const maxZ = city.roadCentersZ[city.roadCentersZ.length - 1] + 4;

    for (const rcx of city.roadCentersX) {
      for (let pos = minZ; pos <= maxZ; pos += 6.0) {
        if (city.roadCentersZ.some((ic) => Math.abs(pos - ic) < 6.2)) continue;
        dummy.position.set(rcx, 0.025, pos);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        dashMatrices.push(dummy.matrix.clone());
      }
    }
    for (const rcz of city.roadCentersZ) {
      for (let pos = minX; pos <= maxX; pos += 6.0) {
        if (city.roadCentersX.some((ic) => Math.abs(pos - ic) < 6.2)) continue;
        dummy.position.set(pos, 0.025, rcz);
        dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        dashMatrices.push(dummy.matrix.clone());
      }
    }
    for (const rx of city.roadCentersX) {
      for (const rz of city.roadCentersZ) {
        for (let s = -3.4; s <= 3.4; s += 1.36) {
          for (const side of [-1, 1]) {
            dummy.position.set(rx + s, 0.028, rz + side * 6.5);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            dummy.updateMatrix();
            cwMatrices.push(dummy.matrix.clone());

            dummy.position.set(rx + side * 6.5, 0.028, rz + s);
            dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
            dummy.updateMatrix();
            cwMatrices.push(dummy.matrix.clone());
          }
        }
      }
    }
  }

  const dashInst = new THREE.InstancedMesh(dashGeo, yellowLineMat, dashMatrices.length);
  dashMatrices.forEach((m, i) => dashInst.setMatrixAt(i, m));
  dashInst.instanceMatrix.needsUpdate = true;
  dashInst.computeBoundingSphere();
  group.add(dashInst);

  const cwInst = new THREE.InstancedMesh(cwGeo, stripeMat, cwMatrices.length);
  cwMatrices.forEach((m, i) => cwInst.setMatrixAt(i, m));
  cwInst.instanceMatrix.needsUpdate = true;
  cwInst.computeBoundingSphere();
  group.add(cwInst);

  // 4. Sidewalks, District Ground Pads, Parking Lots, Industrial Wharf & Coastal Sandy Beach + Pier
  const sidewalkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.sidewalkMap,
      roughness: 0.86,
      metalness: 0.02,
    }),
  );
  const curbMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.88 }));
  const blockGeo = trackGeo(new THREE.BoxGeometry(32, layout.sidewalkHeight, 32));
  const parkGrassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.grassMap, roughness: 0.92 }),
  );
  const parkLawnGeo = trackGeo(new THREE.BoxGeometry(25.4, 0.03, 25.4));
  const parkPathGeoX = trackGeo(new THREE.BoxGeometry(26, 0.04, 3.2));
  const parkPathGeoZ = trackGeo(new THREE.BoxGeometry(3.2, 0.04, 26));
  const parkingAsphaltMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b4047, roughness: 0.9 }),
  );

  for (const b of layout.blocks) {
    const swMesh = new THREE.Mesh(blockGeo, [curbMat, curbMat, sidewalkMat, curbMat, curbMat, curbMat]);
    swMesh.position.set(b.cx, layout.sidewalkHeight * 0.5, b.cz);
    swMesh.receiveShadow = enableShadows;
    group.add(swMesh);

    if (b.type === 'residential_park') {
      const lawn = new THREE.Mesh(parkLawnGeo, parkGrassMat);
      lawn.position.set(b.cx, layout.sidewalkHeight + 0.015, b.cz);
      lawn.receiveShadow = enableShadows;
      group.add(lawn);

      const pathX = new THREE.Mesh(parkPathGeoX, sidewalkMat);
      pathX.position.set(b.cx, layout.sidewalkHeight + 0.025, b.cz);
      group.add(pathX);

      const pathZ = new THREE.Mesh(parkPathGeoZ, sidewalkMat);
      pathZ.position.set(b.cx, layout.sidewalkHeight + 0.025, b.cz);
      group.add(pathZ);
    } else if (b.type === 'downtown_parking' || b.type === 'downtown_mall') {
      // Paved asphalt parking bay pad + painted white stall lines
      const isLeft = b.cx < 0;
      const lotW = b.type === 'downtown_mall' ? 24 : 11.5;
      const lotD = b.type === 'downtown_mall' ? 8.5 : 24;
      const lotX = b.type === 'downtown_mall' ? b.cx : isLeft ? b.cx + 6.5 : b.cx - 6.5;
      const lotZ = b.type === 'downtown_mall' ? b.cz + 7.5 : b.cz;
      const lotPad = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(lotW, 0.025, lotD)),
        parkingAsphaltMat,
      );
      lotPad.position.set(lotX, layout.sidewalkHeight + 0.012, lotZ);
      lotPad.receiveShadow = enableShadows;
      group.add(lotPad);

      // White stall stripes
      const stallCount = 4;
      for (let s = 0; s < stallCount; s++) {
        const line = new THREE.Mesh(
          trackGeo(
            new THREE.PlaneGeometry(
              b.type === 'downtown_mall' ? 0.14 : 4.6,
              b.type === 'downtown_mall' ? 4.4 : 0.14,
            ),
          ),
          stripeMat,
        );
        line.rotation.x = -Math.PI / 2;
        if (b.type === 'downtown_mall') {
          line.position.set(lotX - 10 + s * 6, layout.sidewalkHeight + 0.032, lotZ);
        } else {
          line.position.set(lotX, layout.sidewalkHeight + 0.032, lotZ - 9 + s * 6.5);
        }
        group.add(line);
      }
    } else if (b.type === 'industrial_factory' || b.type === 'industrial_port') {
      const yardPad = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(25.5, 0.025, 25.5)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x6c7178, roughness: 0.9 })),
      );
      yardPad.position.set(b.cx, layout.sidewalkHeight + 0.012, b.cz);
      yardPad.receiveShadow = enableShadows;
      group.add(yardPad);
    } else if (b.type === 'golden_promenade') {
      const promPad = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(27.0, 0.03, 27.0)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xd9c7a6, roughness: 0.82 })),
      );
      promPad.position.set(b.cx, layout.sidewalkHeight + 0.015, b.cz);
      promPad.receiveShadow = enableShadows;
      group.add(promPad);
    }
  }

  // Harbor Industrial Wharf (x = 89..103.5, z = -86..-14) + 2 Tall Gantry Cranes
  const wharfDeck = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(15.2, 1.2, 74)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x7d838a, roughness: 0.88 })),
  );
  wharfDeck.position.set(96.1, layout.sidewalkHeight - 0.6, -50);
  wharfDeck.receiveShadow = enableShadows;
  group.add(wharfDeck);

  const craneSteelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd16128, roughness: 0.45, metalness: 0.45 }),
  );
  for (const cz of [-68, -34]) {
    const crane = new THREE.Group();
    crane.position.set(101.2, layout.sidewalkHeight, cz);
    const legGeo = trackGeo(new THREE.BoxGeometry(0.65, 13.5, 0.65));
    for (const lx of [-2.2, 2.2]) {
      for (const lz of [-2.8, 2.8]) {
        const leg = new THREE.Mesh(legGeo, craneSteelMat);
        leg.position.set(lx, 6.75, lz);
        leg.castShadow = enableShadows;
        crane.add(leg);
      }
    }
    const boom = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18, 1.1, 1.4)), craneSteelMat);
    boom.position.set(3.2, 13.8, 0);
    boom.castShadow = enableShadows;
    crane.add(boom);
    const cab = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.2, 1.8, 2.2)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xe6edf5, roughness: 0.35 })),
    );
    cab.position.set(1.5, 12.6, 0);
    crane.add(cab);
    group.add(crane);
  }

  // Coastal Promenade Deck (split around East Grand Bridge z = -7..7)
  const promDeckSouth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 0.85, 88.5)),
    sidewalkMat,
  );
  promDeckSouth.position.set(92.2, layout.sidewalkHeight - 0.425, 51.75);
  promDeckSouth.receiveShadow = enableShadows;
  const promDeckNorth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 0.85, 6.5)),
    sidewalkMat,
  );
  promDeckNorth.position.set(92.2, layout.sidewalkHeight - 0.425, -10.75);
  promDeckNorth.receiveShadow = enableShadows;
  group.add(promDeckSouth, promDeckNorth);

  // Golden Sandy Beach sloping into the ocean (x = 95..114, z = 7.5..94)
  const sandGeo = trackGeo(new THREE.BoxGeometry(20, 0.6, 86.5));
  const sandMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe8d09e, roughness: 0.94, metalness: 0.0 }),
  );
  const beachMesh = new THREE.Mesh(sandGeo, sandMat);
  beachMesh.position.set(104.5, -0.35, 50.75);
  beachMesh.rotation.z = -0.032; // slopes gently from 0.06 at x=95 down into bay water
  beachMesh.receiveShadow = enableShadows;
  group.add(beachMesh);

  // Beach Umbrellas & Loungers along the Coastal Beach
  const umbrellaColors = [0xd94b3d, 0x2687a3, 0xe8a832, 0x3b8f64];
  for (let i = 0; i < 5; i++) {
    const uz = 8 + i * 18;
    if (Math.abs(uz - 42) < 6) continue;
    const ux = 100.5;
    const uy = -0.05;
    const pole = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xeae5dc, roughness: 0.5 })),
    );
    pole.position.set(ux, uy + 1.1, uz);
    const canopy = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(1.45, 0.55, 8)),
      trackMat(new THREE.MeshStandardMaterial({ color: umbrellaColors[i % umbrellaColors.length], roughness: 0.72 })),
    );
    canopy.position.set(ux, uy + 2.15, uz);
    canopy.castShadow = enableShadows;
    group.add(pole, canopy);
  }

  // Wooden Coastal Tourist Pier (x = 95..118.5, z = 39..45) + Water Ramp + Emerald Marina Dock + Coral Reef World
  const woodMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x8a6142, roughness: 0.84 }));
  const pierDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 0.28, 6.2)), woodMat);
  pierDeck.position.set(106.8, layout.sidewalkHeight - 0.1, 42);
  pierDeck.receiveShadow = enableShadows;
  pierDeck.castShadow = enableShadows;
  group.add(pierDeck);

  // Sloped underwater continental sand shelves off Liberty Beach & Emerald Bay Marina
  const shelfGeo1 = trackGeo(new THREE.BoxGeometry(31, 0.8, 102));
  const shelf1 = new THREE.Mesh(shelfGeo1, seabedSandMat);
  shelf1.position.set(121.5, -7.2, 44);
  shelf1.rotation.z = -0.43;
  shelf1.receiveShadow = enableShadows;
  const shelfGeo2 = trackGeo(new THREE.BoxGeometry(29, 0.8, 30));
  const shelf2 = new THREE.Mesh(shelfGeo2, seabedSandMat);
  shelf2.position.set(219.5, -7.2, 33);
  shelf2.rotation.z = 0.44;
  shelf2.receiveShadow = enableShadows;
  group.add(shelf1, shelf2);

  // Boat launch ramp off end of Liberty Pier & Emerald Bay Marina floating dock
  const pierRamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 0.18, 4.0)), woodMat);
  pierRamp.position.set(119.8, -0.22, 42);
  pierRamp.rotation.z = -0.18;
  const emeraldDock = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 0.24, 5.2)), woodMat);
  emeraldDock.position.set(229.8, -0.05, 32);
  emeraldDock.receiveShadow = enableShadows;
  group.add(pierRamp, emeraldDock);

  // Pier support pilings (extending down to seabed)
  const pilingGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 14.2, 8));
  for (let px = 97; px <= 117; px += 4.8) {
    for (const pz of [39.3, 44.7]) {
      const pile = new THREE.Mesh(pilingGeo, woodMat);
      pile.position.set(px, -7.0, pz);
      group.add(pile);
    }
  }

  // Gazebo at end of Tourist Pier (x = 115.5, z = 42)
  const gazPostGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8));
  for (const gx of [113.8, 117.2]) {
    for (const gz of [40.2, 43.8]) {
      const post = new THREE.Mesh(gazPostGeo, woodMat);
      post.position.set(gx, layout.sidewalkHeight + 1.3, gz);
      group.add(post);
    }
  }
  const gazRoof = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(3.2, 1.35, 6)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x2c7885, roughness: 0.68 })),
  );
  gazRoof.position.set(115.5, layout.sidewalkHeight + 3.25, 42);
  gazRoof.castShadow = enableShadows;
  group.add(gazRoof);

  // 4B. 3D Underwater Coral Reefs, Kelp Forest, Rock Arches, Sunken Shipwreck & Marine Wildlife
  const coralMats = [
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.72, emissive: 0x4c0519, emissiveIntensity: 0.16 })),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.74, emissive: 0x431407, emissiveIntensity: 0.14 })),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.7, emissive: 0x3b0764, emissiveIntensity: 0.18 })),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.68, emissive: 0x042f2e, emissiveIntensity: 0.16 })),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7, emissive: 0x422006, emissiveIntensity: 0.14 })),
  ];
  const reefRockMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.94 }));
  const kelpMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78, side: THREE.DoubleSide }));
  const bubbleMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.65 }),
  );

  const reefRockGeo = trackGeo(new THREE.DodecahedronGeometry(1.8, 0));
  const brainCoralGeo = trackGeo(new THREE.SphereGeometry(0.95, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6));
  const stagBranchGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.24, 1.9, 6));
  const kelpGeo = trackGeo(new THREE.BoxGeometry(0.32, 4.8, 0.08));
  kelpGeo.translate(0, 2.4, 0);
  const bubbleGeo = trackGeo(new THREE.SphereGeometry(0.14, 6, 6));

  const reefSpots: Array<[number, number, number]> = [
    [138, 22, 1.2], [146, 36, 1.5], [142, 54, 1.1], [154, 68, 1.4],
    [160, 32, 1.6], [172, 44, 1.3], [178, 66, 1.5], [186, 38, 1.4],
    [194, 52, 1.2], [202, 26, 1.5], [152, -24, 1.3], [176, -34, 1.4],
    [195, -48, 1.6], [144, -68, 1.2], [190, 74, 1.3], [134, 78, 1.1],
    [-35, -155, 1.4], [38, -148, 1.5], [-42, 145, 1.4], [46, 162, 1.5],
  ];
  reefSpots.forEach(([rx, rz, sc], idx) => {
    const cg = new THREE.Group();
    cg.position.set(rx, OCEAN_SEABED_Y - 0.15, rz);

    const boulder = new THREE.Mesh(reefRockGeo, reefRockMat);
    boulder.scale.set(sc * 1.3, sc * 0.7, sc * 1.1);
    boulder.rotation.y = idx * 0.85;
    cg.add(boulder);

    const cMat = coralMats[idx % coralMats.length];
    const brain = new THREE.Mesh(brainCoralGeo, cMat);
    brain.position.set(sc * 0.75, 0.2, sc * 0.4);
    brain.scale.setScalar(sc * 0.75);
    cg.add(brain);

    for (let b = 0; b < 3; b++) {
      const stag = new THREE.Mesh(stagBranchGeo, coralMats[(idx + b + 1) % coralMats.length]);
      stag.position.set((b - 1) * 0.55 * sc, 0.9, -0.45 * sc);
      stag.rotation.z = (b - 1) * 0.34;
      stag.rotation.x = (b % 2 === 0 ? 1 : -1) * 0.22;
      cg.add(stag);
    }

    // Swaying Kelp stalks around reef
    for (let k = 0; k < 2; k++) {
      const kelp = new THREE.Mesh(kelpGeo, kelpMat);
      kelp.position.set((k === 0 ? -1.4 : 1.5) * sc, 0, (k === 0 ? 0.9 : -1.1) * sc);
      kelp.scale.y = 0.8 + (idx % 3) * 0.38;
      cg.add(kelp);
      underwaterKelp.push({ mesh: kelp, phase: idx * 0.7 + k * 1.9, speed: 1.4 + (k % 2) * 0.35 });
    }

    // Rising Bubble plume on every 2nd coral vent
    if (idx % 2 === 0) {
      for (let b = 0; b < 3; b++) {
        const bub = new THREE.Mesh(bubbleGeo, bubbleMat);
        bub.position.set(rx + (b - 1) * 0.45, OCEAN_SEABED_Y + 1 + b * 3.2, rz + 0.3);
        group.add(bub);
        underwaterBubbles.push({
          mesh: bub,
          baseY: OCEAN_SEABED_Y + 0.5,
          phase: idx * 0.9 + b * 2.1,
          speed: 1.4 + (b % 2) * 0.4,
        });
      }
    }

    group.add(cg);
  });

  // Underwater Reef Stone Arches (swim-through / sub-through landmarks)
  for (const [ax, az, rot] of [[158, 42, 0.35], [182, 22, -0.45]] as const) {
    const arch = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(4.8, 1.15, 8, 16, Math.PI)),
      reefRockMat,
    );
    arch.position.set(ax, OCEAN_SEABED_Y - 0.3, az);
    arch.rotation.y = rot;
    group.add(arch);
  }

  // Sunken Wooden Galleon Shipwreck & Glowing Treasure Chest at (165, -13.5, 58)
  const wreckGroup = new THREE.Group();
  wreckGroup.position.set(165, OCEAN_SEABED_Y + 0.3, 58);
  wreckGroup.rotation.set(0.08, -0.52, -0.18);
  const wreckWoodMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.92 }));
  const wreckHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.6, 2.8, 14.5)), wreckWoodMat);
  wreckHull.position.y = 1.2;
  const wreckBow = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.4, 4.2, 6)), wreckWoodMat);
  wreckBow.rotation.x = -Math.PI * 0.5;
  wreckBow.position.set(0, 1.4, -9.2);
  const wreckMast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 8.8, 8)), wreckWoodMat);
  wreckMast.position.set(0, 5.2, -1.2);
  wreckMast.rotation.z = 0.28;
  const wreckYard = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.1, 5.2, 6)), wreckWoodMat);
  wreckYard.rotation.z = Math.PI * 0.5;
  wreckYard.position.set(0.6, 6.8, -1.2);
  const chestBox = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.4, 0.95, 0.95)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.45, metalness: 0.35 })),
  );
  chestBox.position.set(1.6, 2.75, 2.5);
  const chestGold = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.15, 0.25, 0.72)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 1.4, roughness: 0.22, metalness: 0.85 })),
  );
  chestGold.position.set(1.6, 3.26, 2.5);
  wreckGroup.add(wreckHull, wreckBow, wreckMast, wreckYard, chestBox, chestGold);
  group.add(wreckGroup);

  // Animated Underwater Tropical Fish Schools & Graceful Manta Rays
  const fishBodyGeo = trackGeo(new THREE.SphereGeometry(0.24, 8, 6));
  fishBodyGeo.scale(0.65, 0.85, 1.6);
  const fishTailGeo = trackGeo(new THREE.ConeGeometry(0.18, 0.32, 4));
  fishTailGeo.rotateX(Math.PI * 0.5);
  const fishColors = [0xf59e0b, 0x38bdf8, 0xf43f5e, 0xfacc15, 0x2dd4bf];
  const fishMats = fishColors.map((c) =>
    trackMat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.15 })),
  );

  for (const [sx, sy, sz, rad, speed, count] of [
    [146, -5.2, 36, 9.5, 0.42, 8],
    [166, -7.8, 56, 11.5, -0.34, 10],
    [192, -6.0, 32, 10.0, 0.38, 8],
    [168, -5.6, -34, 12.0, 0.32, 7],
  ] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, sy, sz);
    const fins: THREE.Mesh[] = [];
    for (let f = 0; f < count; f++) {
      const ang = (f / count) * Math.PI * 2;
      const fg = new THREE.Group();
      const rOff = rad + ((f % 3) - 1) * 1.4;
      fg.position.set(Math.cos(ang) * rOff, ((f % 3) - 1) * 0.85, Math.sin(ang) * rOff);
      fg.rotation.y = speed > 0 ? -ang : -ang + Math.PI;
      const fm = fishMats[f % fishMats.length];
      const fBody = new THREE.Mesh(fishBodyGeo, fm);
      const fTail = new THREE.Mesh(fishTailGeo, fm);
      fTail.position.set(0, 0, 0.36);
      fg.add(fBody, fTail);
      pivot.add(fg);
      fins.push(fTail);
    }
    group.add(pivot);
    underwaterFishSchools.push({ pivot, speed, phase: sx * 0.1, fishFins: fins });
  }

  const mantaMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.42, metalness: 0.18 }));
  const mantaBodyGeo = trackGeo(new THREE.SphereGeometry(0.75, 10, 8));
  mantaBodyGeo.scale(1.1, 0.24, 1.6);
  const mantaWingGeo = trackGeo(new THREE.ConeGeometry(1.45, 2.2, 3));
  mantaWingGeo.rotateZ(Math.PI * 0.5);
  mantaWingGeo.scale(1.0, 0.12, 0.85);
  for (const [mx, mz, rx, rz, my, sp] of [
    [164, 40, 22, 18, -4.6, 0.22],
    [186, -24, 24, 18, -6.4, -0.19],
  ] as const) {
    const mg = new THREE.Group();
    const mBody = new THREE.Mesh(mantaBodyGeo, mantaMat);
    const wingL = new THREE.Mesh(mantaWingGeo, mantaMat);
    wingL.position.set(-1.1, 0, 0.1);
    const wingR = new THREE.Mesh(mantaWingGeo, mantaMat);
    wingR.rotation.y = Math.PI;
    wingR.position.set(1.1, 0, 0.1);
    const mTail = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.08, 2.1, 6)), mantaMat);
    mTail.rotation.x = Math.PI * 0.5;
    mTail.position.set(0, 0, 1.8);
    mg.add(mBody, wingL, wingR, mTail);
    group.add(mg);
    underwaterMantas.push({
      group: mg,
      centerX: mx,
      centerZ: mz,
      radiusX: rx,
      radiusZ: rz,
      baseY: my,
      speed: sp,
      phase: mx * 0.05,
      wingL,
      wingR,
    });
  }

  // 5. Shared Emissive Window & Lamp Materials (updated dynamically by TimeOfDay)
  const windowGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbeafa,
      map: textures.commercialFacadeMap,
      emissive: 0xffd791,
      emissiveMap: textures.commercialFacadeMap,
      emissiveIntensity: 0.15,
      roughness: 0.18,
      metalness: 0.38,
    }),
  );

  const glassLobbyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2a4559, roughness: 0.16, metalness: 0.65 }),
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x373e47, roughness: 0.36, metalness: 0.72 }),
  );
  const roofHvacMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x8d959e, roughness: 0.78, metalness: 0.2 }),
  );

  const enterableBuildingIds = new Set(layout.entrances.map((e) => e.buildingId));

  // 6. Composite 3D Buildings (Skyscrapers, Offices, Mall, Store, Apartments, Factories, Warehouses, Workshops, Restaurants)
  const buildUrbanBuilding = (b: BuildingSpec) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, layout.sidewalkHeight, b.z);

    if (b.style === 'store') {
      const wallMat = trackMat(
        new THREE.MeshStandardMaterial({ color: b.primaryColor, roughness: 0.72 }),
      );
      const body = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, b.height, b.depth)),
        wallMat,
      );
      body.position.y = b.height * 0.5;
      body.castShadow = enableShadows;
      body.receiveShadow = enableShadows;
      bGroup.add(body);

      const signBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width + 0.25, 0.75, b.depth + 0.25)),
        trackMat(new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.42 })),
      );
      signBand.position.y = b.height - 0.55;
      bGroup.add(signBand);

      // West-facing storefront window flanking the entrance + canopy
      const storeWin = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.1, 1.8, 2.2)),
        windowGlowMat,
      );
      storeWin.position.set(-b.width * 0.5 - 0.04, 1.35, -2.25);
      const storeWin2 = storeWin.clone();
      storeWin2.position.z = 2.25;
      bGroup.add(storeWin, storeWin2);

      const awning = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.5, 0.22, b.depth * 0.78)),
        trackMat(new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.6 })),
      );
      awning.position.set(-b.width * 0.5 - 0.7, 3.05, 0);
      awning.rotation.z = -0.22;
      bGroup.add(awning);

      group.add(bGroup);
      return;
    }

    if (b.style === 'airport_terminal') {
      // Sculpted Gull-Wing Curved Airport Terminal + Slanted Glass Concourse + V-Columns + Passenger Jetway + Airport Code Gantry
      const wallMat = trackMat(
        new THREE.MeshStandardMaterial({ color: b.primaryColor, roughness: 0.42, metalness: 0.2 }),
      );
      const wingMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34, metalness: 0.48 }),
      );
      const accentMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: b.accentColor,
          emissive: b.accentColor,
          emissiveIntensity: 0.18,
          roughness: 0.32,
          metalness: 0.55,
        }),
      );
      const concourseGlassMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xbae6fd,
          map: textures.buildingWindowMap,
          emissive: 0x38bdf8,
          emissiveMap: textures.buildingWindowMap,
          emissiveIntensity: 0.18,
          roughness: 0.12,
          metalness: 0.62,
        }),
      );
      buildingWindowMats.push(concourseGlassMat);

      const core = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.88, b.height * 0.72, b.depth * 0.82)),
        wallMat,
      );
      core.position.y = b.height * 0.36;
      core.castShadow = enableShadows;
      core.receiveShadow = enableShadows;
      bGroup.add(core);

      const glassConcourse = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.96, b.height * 0.58, b.depth * 0.96)),
        concourseGlassMat,
      );
      glassConcourse.position.y = b.height * 0.34;
      bGroup.add(glassConcourse);

      // Sweeping Gull-Wing Airfoil Canopy Roof extruded along Z
      const hw = b.width * 0.5 + 2.4;
      const roofShape = new THREE.Shape();
      roofShape.moveTo(-hw, 1.35);
      roofShape.quadraticCurveTo(-hw * 0.45, -0.35, 0, 0.85);
      roofShape.quadraticCurveTo(hw * 0.45, -0.35, hw, 1.35);
      roofShape.lineTo(hw, 1.95);
      roofShape.quadraticCurveTo(hw * 0.45, 0.25, 0, 1.55);
      roofShape.quadraticCurveTo(-hw * 0.45, 0.25, -hw, 1.95);
      roofShape.closePath();

      const gullGeo = trackGeo(
        new THREE.ExtrudeGeometry(roofShape, {
          depth: b.depth + 3.8,
          bevelEnabled: true,
          bevelThickness: 0.14,
          bevelSize: 0.14,
          bevelSegments: 2,
          curveSegments: 16,
        }),
      );
      gullGeo.translate(0, 0, -(b.depth + 3.8) * 0.5);
      const gullRoof = new THREE.Mesh(gullGeo, wingMat);
      gullRoof.position.y = b.height * 0.68;
      gullRoof.castShadow = enableShadows;
      bGroup.add(gullRoof);

      // Sculpted V-Columns along South Entrance Concourse
      const vColGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.18, b.height * 0.78, 8));
      for (const vx of [-b.width * 0.36, -b.width * 0.14, b.width * 0.14, b.width * 0.36]) {
        const colL = new THREE.Mesh(vColGeo, accentMat);
        colL.position.set(vx - 0.5, b.height * 0.38, b.depth * 0.5 + 1.2);
        colL.rotation.z = -0.18;
        const colR = new THREE.Mesh(vColGeo, accentMat);
        colR.position.set(vx + 0.5, b.height * 0.38, b.depth * 0.5 + 1.2);
        colR.rotation.z = 0.18;
        bGroup.add(colL, colR);
      }

      // Telescopic Glass Passenger Jetway Bridge extending toward apron gate
      const jetwayTube = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(2.2, 2.1, 8.2)),
        wingMat,
      );
      jetwayTube.position.set(b.width * 0.26, 3.35, b.depth * 0.5 + 4.0);
      jetwayTube.castShadow = enableShadows;
      const jetwayCol = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.24, 0.3, 3.2, 8)),
        darkMetalMat,
      );
      jetwayCol.position.set(b.width * 0.26, 1.6, b.depth * 0.5 + 7.2);
      bGroup.add(jetwayTube, jetwayCol);

      // Airport Terminal Code Gantry Sign
      const apCode =
        b.id.includes('emerald')
          ? 'EMB · EMERALD BAY'
          : b.id.includes('highland')
            ? 'HLD · HIGHLAND AERO'
            : b.id.includes('golden')
              ? 'GZH · GOLDEN HORIZON'
              : 'LBY · LIBERTY INTL';
      const apCanvas = document.createElement('canvas');
      apCanvas.width = 512;
      apCanvas.height = 128;
      const aCtx = apCanvas.getContext('2d');
      if (aCtx) {
        aCtx.fillStyle = '#0f172a';
        aCtx.fillRect(0, 0, 512, 128);
        aCtx.strokeStyle = '#38bdf8';
        aCtx.lineWidth = 6;
        aCtx.strokeRect(6, 6, 500, 116);
        aCtx.fillStyle = '#f8fafc';
        aCtx.font = 'bold 38px Inter, system-ui, sans-serif';
        aCtx.textAlign = 'center';
        aCtx.textBaseline = 'middle';
        aCtx.fillText(apCode, 256, 48);
        aCtx.fillStyle = '#38bdf8';
        aCtx.font = 'bold 20px Inter, system-ui, sans-serif';
        aCtx.fillText('SKYLINE AIR DEPARTURES', 256, 92);
      }
      const apTex = trackTex(new THREE.CanvasTexture(apCanvas));
      const apSignMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: apTex,
          emissive: 0xe0f2fe,
          emissiveMap: apTex,
          emissiveIntensity: 0.72,
          roughness: 0.3,
        }),
      );
      const apSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.5, 1.55, 0.28)), apSignMat);
      apSign.position.set(0, 4.1, b.depth * 0.5 + 1.55);
      bGroup.add(apSign);

      group.add(bGroup);
      return;
    }

    if (b.style === 'reward_center') {
      // Sculpted Flagship CITY REWARD CENTER showroom: V-pillars, angled gold halo, glowing vitrine & rotating diamond emblem
      const baseMat = trackMat(
        new THREE.MeshStandardMaterial({ color: b.primaryColor, roughness: 0.42, metalness: 0.25 }),
      );
      const goldMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: b.accentColor,
          emissive: 0xd97706,
          emissiveIntensity: 0.28,
          roughness: 0.24,
          metalness: 0.62,
        }),
      );
      const cyanGlowMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.38,
          roughness: 0.14,
          metalness: 0.45,
        }),
      );
      buildingWindowMats.push(cyanGlowMat);

      const lowerBody = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, b.height * 0.62, b.depth)),
        baseMat,
      );
      lowerBody.position.y = b.height * 0.31;
      lowerBody.castShadow = enableShadows;
      lowerBody.receiveShadow = enableShadows;
      bGroup.add(lowerBody);

      const goldBelt = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width + 0.55, 0.52, b.depth + 0.55)),
        goldMat,
      );
      goldBelt.position.y = b.height * 0.62;
      bGroup.add(goldBelt);

      const upperShowroom = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(b.width * 0.44, b.width * 0.48, b.height * 0.38, 12)),
        cyanGlowMat,
      );
      upperShowroom.position.y = b.height * 0.81;
      upperShowroom.castShadow = enableShadows;
      bGroup.add(upperShowroom);

      const haloCrown = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(b.width * 0.48, 0.24, 10, 28)),
        goldMat,
      );
      haloCrown.rotation.x = Math.PI * 0.5;
      haloCrown.rotation.y = 0.12;
      haloCrown.position.y = b.height + 0.35;
      bGroup.add(haloCrown);

      // Rotating Floating Golden Diamond Emblem above Reward Center
      const crystal = new THREE.Mesh(
        trackGeo(new THREE.OctahedronGeometry(1.15, 0)),
        goldMat,
      );
      crystal.position.set(0, b.height + 2.15, 0);
      crystal.scale.set(1, 1.35, 1);
      bGroup.add(crystal);
      landmarkSpinners.push({ obj: crystal, speed: 1.35, bobBaseY: b.height + 2.15, bobAmp: 0.24 });

      // West-facing showcase windows + V-columns + canopy
      const vitrineW = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.14, 2.25, 2.2)),
        windowGlowMat,
      );
      vitrineW.position.set(-b.width * 0.5 - 0.04, 1.55, -2.55);
      const vitrineW2 = vitrineW.clone();
      vitrineW2.position.z = 2.55;
      bGroup.add(vitrineW, vitrineW2);

      const vColGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.11, 3.1, 8));
      for (const vz of [-3.4, 3.4]) {
        const p1 = new THREE.Mesh(vColGeo, goldMat);
        p1.position.set(-b.width * 0.5 - 1.35, 1.55, vz);
        p1.rotation.x = vz < 0 ? 0.18 : -0.18;
        bGroup.add(p1);
      }

      const awning = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.9, 0.24, b.depth * 0.76)),
        goldMat,
      );
      awning.position.set(-b.width * 0.5 - 0.9, 3.18, 0);
      awning.rotation.z = -0.18;
      bGroup.add(awning);

      const rcCanvas = document.createElement('canvas');
      rcCanvas.width = 512;
      rcCanvas.height = 128;
      const rCtx = rcCanvas.getContext('2d');
      if (rCtx) {
        rCtx.fillStyle = '#0f172a';
        rCtx.fillRect(0, 0, 512, 128);
        rCtx.strokeStyle = '#fbbf24';
        rCtx.lineWidth = 8;
        rCtx.strokeRect(6, 6, 500, 116);
        rCtx.fillStyle = '#fbbf24';
        rCtx.font = 'bold 34px Inter, system-ui, sans-serif';
        rCtx.textAlign = 'center';
        rCtx.textBaseline = 'middle';
        rCtx.fillText('CITY REWARD CENTER', 256, 48);
        rCtx.fillStyle = '#38bdf8';
        rCtx.font = 'bold 22px Inter, system-ui, sans-serif';
        rCtx.fillText('KP SHOP & CHARACTER STUDIO', 256, 90);
      }
      const rcTex = trackTex(new THREE.CanvasTexture(rcCanvas));
      const rcSignMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: rcTex,
          emissive: 0xfef3c7,
          emissiveMap: rcTex,
          emissiveIntensity: 0.78,
          roughness: 0.3,
        }),
      );
      const westSign = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.24, 1.35, 5.4)),
        rcSignMat,
      );
      westSign.position.set(-b.width * 0.5 - 0.22, 4.35, 0);
      bGroup.add(westSign);

      group.add(bGroup);
      return;
    }

    if (b.style === 'factory' || b.style === 'warehouse' || b.style === 'workshop') {
      // Industrial Factory / Warehouse / Workshop with corrugated siding & roof details
      const wallMat = trackMat(
        new THREE.MeshStandardMaterial({ color: b.primaryColor, roughness: 0.76, metalness: 0.22 }),
      );
      const trimMat = trackMat(
        new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.55, metalness: 0.35 }),
      );
      const body = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, b.height, b.depth)),
        wallMat,
      );
      body.position.y = b.height * 0.5;
      body.castShadow = enableShadows;
      body.receiveShadow = enableShadows;
      bGroup.add(body);

      const trimBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width + 0.25, 0.5, b.depth + 0.25)),
        trimMat,
      );
      trimBand.position.y = b.height - 0.6;
      bGroup.add(trimBand);

      if (b.style === 'factory') {
        for (let r = -1; r <= 1; r++) {
          const ridge = new THREE.Mesh(
            trackGeo(new THREE.CylinderGeometry(1.4, 1.4, b.depth * 0.9, 3)),
            trimMat,
          );
          ridge.rotation.x = Math.PI * 0.5;
          ridge.position.set(r * (b.width * 0.28), b.height + 0.7, 0);
          bGroup.add(ridge);
        }
        const stackGeo = trackGeo(new THREE.CylinderGeometry(0.6, 0.85, 7.5, 12));
        for (const sx of [-b.width * 0.28, b.width * 0.28]) {
          const stack = new THREE.Mesh(stackGeo, darkMetalMat);
          stack.position.set(sx, b.height + 3.5, -b.depth * 0.24);
          stack.castShadow = enableShadows;
          bGroup.add(stack);
        }
      }
      group.add(bGroup);
      return;
    }

    if (b.style === 'mall') {
      // Sculpted Shopping Mall: fluted corner pilasters, curved barrel-vault skylight atrium, arched entrance portico & roof sign
      const wallMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: b.primaryColor,
          map: textures.commercialFacadeMap,
          roughness: 0.5,
          metalness: 0.14,
        }),
      );
      const accentMat = trackMat(
        new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.4, metalness: 0.35 }),
      );
      const base = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, b.height * 0.66, b.depth)),
        wallMat,
      );
      base.position.y = b.height * 0.33;
      base.castShadow = enableShadows;
      base.receiveShadow = enableShadows;
      bGroup.add(base);

      // Vertical architectural pilasters on corners & bays
      const pilGeo = trackGeo(new THREE.BoxGeometry(0.55, b.height * 0.72, 0.55));
      for (const px of [-b.width * 0.48, -b.width * 0.22, b.width * 0.22, b.width * 0.48]) {
        for (const pz of [-b.depth * 0.49, b.depth * 0.49]) {
          const pil = new THREE.Mesh(pilGeo, accentMat);
          pil.position.set(px, b.height * 0.36, pz);
          bGroup.add(pil);
        }
      }

      const atriumMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xc2dced,
          map: textures.buildingWindowMap,
          emissive: 0xffd791,
          emissiveMap: textures.buildingWindowMap,
          emissiveIntensity: 0.14,
          roughness: 0.16,
          metalness: 0.48,
        }),
      );
      buildingWindowMats.push(atriumMat);

      // Curved Barrel-Vaulted Glass Skylight Roof
      const vaultRadius = b.depth * 0.44;
      const barrelVault = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(vaultRadius, vaultRadius, b.width * 0.9, 16, 1, false, 0, Math.PI)),
        atriumMat,
      );
      barrelVault.rotation.z = Math.PI * 0.5;
      barrelVault.scale.set(0.68, 1, 1);
      barrelVault.position.y = b.height * 0.66;
      barrelVault.castShadow = enableShadows;
      bGroup.add(barrelVault);

      const archRibGeo = trackGeo(new THREE.TorusGeometry(vaultRadius + 0.14, 0.16, 6, 18, Math.PI));
      for (const rx of [-b.width * 0.38, 0, b.width * 0.38]) {
        const rib = new THREE.Mesh(archRibGeo, accentMat);
        rib.rotation.y = Math.PI * 0.5;
        rib.scale.set(1, 0.68, 1);
        rib.position.set(rx, b.height * 0.66, 0);
        bGroup.add(rib);
      }

      // Curved entrance portico canopy + twin pillars
      const porticoArch = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(2.6, 2.6, 3.0, 12, 1, false, 0, Math.PI)),
        accentMat,
      );
      porticoArch.rotation.x = Math.PI * 0.5;
      porticoArch.scale.set(1.35, 1, 0.45);
      porticoArch.position.set(0, 3.3, b.depth * 0.5 + 1.3);
      bGroup.add(porticoArch);

      const portColGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.2, 3.3, 8));
      for (const cx of [-3.0, 3.0]) {
        const pCol = new THREE.Mesh(portColGeo, accentMat);
        pCol.position.set(cx, 1.65, b.depth * 0.5 + 2.45);
        bGroup.add(pCol);
      }

      group.add(bGroup);
      return;
    }

    if (b.style === 'apartment') {
      // Multi-story Urban Apartment with protruding 3D balconies
      const wallMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: b.primaryColor,
          map: textures.commercialFacadeMap,
          emissive: 0xffd599,
          emissiveMap: textures.commercialFacadeMap,
          emissiveIntensity: 0.08,
          roughness: 0.65,
        }),
      );
      buildingWindowMats.push(wallMat);

      const body = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, b.height, b.depth)),
        wallMat,
      );
      body.position.y = b.height * 0.5;
      body.castShadow = enableShadows;
      body.receiveShadow = enableShadows;
      bGroup.add(body);

      const balcMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 0.75 }));
      const railMat = trackMat(new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.4, metalness: 0.5 }));
      for (let fy = 3.8; fy < b.height - 1.5; fy += 3.2) {
        const balc = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(b.width * 0.42, 0.22, 1.1)), balcMat);
        balc.position.set(0, fy, b.depth * 0.5 + 0.5);
        bGroup.add(balc);
        const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(b.width * 0.42, 0.72, 0.08)), railMat);
        rail.position.set(0, fy + 0.45, b.depth * 0.5 + 1.0);
        bGroup.add(rail);
      }

      const parapet = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width + 0.3, 0.45, b.depth + 0.3)),
        darkMetalMat,
      );
      parapet.position.y = b.height + 0.22;
      bGroup.add(parapet);
      group.add(bGroup);
      return;
    }

    // Skyscrapers, Offices, and Coastal Restaurants
    const lobbyH = Math.min(3.8, b.height * 0.24);
    const upperH = b.height - lobbyH;
    const isEnterable = enterableBuildingIds.has(b.id);
    const decorativeBaseMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x7e8791, roughness: 0.85, metalness: 0.08 }),
    );

    const lobby = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(b.width, lobbyH, b.depth)),
      b.style === 'restaurant' ? windowGlowMat : isEnterable ? glassLobbyMat : decorativeBaseMat,
    );
    lobby.position.y = lobbyH * 0.5;
    lobby.castShadow = enableShadows;
    lobby.receiveShadow = enableShadows;
    bGroup.add(lobby);

    const cornice = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(b.width + 0.45, 0.42, b.depth + 0.45)),
      trackMat(new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.55, metalness: 0.25 })),
    );
    cornice.position.y = lobbyH + 0.21;
    bGroup.add(cornice);

    const tex = b.style === 'restaurant' ? textures.commercialFacadeMap : textures.buildingWindowMap;
    const shaftMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: b.primaryColor,
        map: tex,
        emissive: 0xffd796,
        emissiveMap: tex,
        emissiveIntensity: 0.08,
        roughness: 0.5,
        metalness: 0.18,
      }),
    );
    buildingWindowMats.push(shaftMat);

    const mainH = b.hasSetback ? upperH * 0.74 : Math.max(1.2, upperH - 0.4);
    const shaft = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(b.width - 0.15, mainH, b.depth - 0.15)),
      shaftMat,
    );
    shaft.position.y = lobbyH + 0.4 + mainH * 0.5;
    shaft.castShadow = enableShadows;
    shaft.receiveShadow = enableShadows;
    bGroup.add(shaft);

    const roofY = lobbyH + 0.4 + mainH;
    const isRooftopBuilding = layout.rooftops.some((r) => r.buildingId === b.id);
    const accentTrimMat = trackMat(
      new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.36, metalness: 0.55 }),
    );
    const glowFinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: b.accentColor,
        emissive: b.accentColor,
        emissiveIntensity: 0.48,
        roughness: 0.25,
        metalness: 0.45,
      }),
    );

    // Non-flat architectural corner pilasters & sun-louver belt courses on offices, restaurants & skyscrapers
    if (b.style === 'skyscraper' || b.style === 'office') {
      const pilGeo = trackGeo(
        new THREE.CylinderGeometry(
          b.style === 'skyscraper' ? 0.42 : 0.32,
          b.style === 'skyscraper' ? 0.72 : 0.42,
          mainH + 0.6,
          8,
        ),
      );
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const pil = new THREE.Mesh(pilGeo, accentTrimMat);
          pil.position.set(sx * (b.width * 0.49), lobbyH + 0.4 + mainH * 0.5, sz * (b.depth * 0.49));
          bGroup.add(pil);
        }
      }
      if (mainH > 12) {
        for (let by = lobbyH + 10; by < roofY - 3; by += 11) {
          const belt = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(b.width + 0.55, 0.35, b.depth + 0.55)),
            accentTrimMat,
          );
          belt.position.y = by;
          bGroup.add(belt);
        }
      }
    } else if (b.style === 'restaurant') {
      // Sculpted patio pergola frame + side planters on restaurants/cafes
      const roofTrim = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width + 0.65, 0.36, b.depth + 0.65)),
        accentTrimMat,
      );
      roofTrim.position.y = roofY + 0.18;
      bGroup.add(roofTrim);
    }

    if (!isRooftopBuilding) {
      const parapet = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width + 0.18, 0.5, b.depth + 0.18)),
        darkMetalMat,
      );
      parapet.position.y = roofY + 0.25;
      bGroup.add(parapet);
    }

    if (b.hasSetback) {
      const setH = upperH * 0.26;
      const setback = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.68, setH, b.depth * 0.68)),
        shaftMat,
      );
      setback.position.y = roofY + 0.5 + setH * 0.5;
      setback.castShadow = enableShadows;
      bGroup.add(setback);

      const crown = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.74, 0.52, b.depth * 0.74)),
        accentTrimMat,
      );
      crown.position.y = roofY + 0.5 + setH + 0.26;
      bGroup.add(crown);

      if (b.hasSpire) {
        const spireBase = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(1.1, 1.8, 3.2, 8)),
          darkMetalMat,
        );
        spireBase.position.y = roofY + 0.5 + setH + 2.0;
        bGroup.add(spireBase);

        const mast = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.12, 0.38, 10.5, 8)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0xe6edf5, roughness: 0.25, metalness: 0.85 })),
        );
        mast.position.y = roofY + 0.5 + setH + 8.5;
        bGroup.add(mast);

        const beacon = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.34, 10, 8)),
          trackMat(
            new THREE.MeshStandardMaterial({
              color: 0xffa73b,
              emissive: 0xff8c24,
              emissiveIntensity: 1.5,
            }),
          ),
        );
        beacon.position.y = roofY + 0.5 + setH + 13.8;
        bGroup.add(beacon);
      }
    } else if (b.id === 'freedom_tower') {
      // Iconic CITY TOWER: Art-Deco vertical glowing ribs, octagonal crown gallery collar, colonnade portico, corner spire & CITY TOWER signs
      const finGeo = trackGeo(new THREE.BoxGeometry(0.42, mainH * 0.88, 0.55));
      for (const fx of [-b.width * 0.24, b.width * 0.24]) {
        const finS = new THREE.Mesh(finGeo, glowFinMat);
        finS.position.set(fx, lobbyH + 0.4 + mainH * 0.5, b.depth * 0.5 + 0.16);
        const finN = new THREE.Mesh(finGeo, glowFinMat);
        finN.position.set(fx, lobbyH + 0.4 + mainH * 0.5, -b.depth * 0.5 - 0.16);
        bGroup.add(finS, finN);
      }
      const crownRing = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(b.width * 0.54, 0.32, 8, 8)),
        glowFinMat,
      );
      crownRing.rotation.x = Math.PI * 0.5;
      crownRing.rotation.z = Math.PI / 8;
      crownRing.position.y = roofY - 2.6;
      bGroup.add(crownRing);

      // Colonnade entrance portico pillars flanking South doorway
      const portColGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.24, lobbyH + 0.4, 10));
      for (const cx of [-2.8, 2.8]) {
        const col = new THREE.Mesh(portColGeo, accentTrimMat);
        col.position.set(cx, (lobbyH + 0.4) * 0.5, b.depth * 0.5 + 1.05);
        bGroup.add(col);
      }

      const spireX = 4.7;
      const spireZ = -5.0;
      const spireBase = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.55, 0.9, 1.8, 8)),
        darkMetalMat,
      );
      spireBase.position.set(spireX, roofY + 3.8, spireZ);
      const mast = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.08, 0.24, 9.2, 8)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xe6edf5, roughness: 0.25, metalness: 0.85 })),
      );
      mast.position.set(spireX, roofY + 8.8, spireZ);
      const beacon = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.32, 10, 8)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: 0xffa73b,
            emissive: 0xff8c24,
            emissiveIntensity: 1.6,
          }),
        ),
      );
      beacon.position.set(spireX, roofY + 13.6, spireZ);
      bGroup.add(spireBase, mast, beacon);

      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512;
      signCanvas.height = 128;
      const sCtx = signCanvas.getContext('2d');
      if (sCtx) {
        sCtx.fillStyle = '#0f172a';
        sCtx.fillRect(0, 0, 512, 128);
        sCtx.strokeStyle = '#f59e0b';
        sCtx.lineWidth = 6;
        sCtx.strokeRect(6, 6, 500, 116);
        sCtx.fillStyle = '#f8fafc';
        sCtx.font = 'bold 62px Inter, system-ui, sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText('CITY TOWER', 256, 66);
      }
      const signTex = trackTex(new THREE.CanvasTexture(signCanvas));
      const signMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: signTex,
          emissive: 0xfef3c7,
          emissiveMap: signTex,
          emissiveIntensity: 0.78,
          roughness: 0.35,
        }),
      );
      const crownSignS = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.68, 1.85, 0.24)),
        signMat,
      );
      crownSignS.position.set(0, roofY - 1.35, b.depth * 0.5 + 0.06);
      const crownSignE = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.24, 1.85, b.depth * 0.68)),
        signMat,
      );
      crownSignE.position.set(b.width * 0.5 + 0.06, roofY - 1.35, 0);
      const lobbySign = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(4.4, 0.92, 0.22)),
        signMat,
      );
      lobbySign.position.set(0, 3.65, b.depth * 0.5 + 0.26);
      bGroup.add(crownSignS, crownSignE, lobbySign);
    } else if (b.id === 'c2_emerald_tower') {
      // Sculpted Emerald Sky Tower: Curved Sail Wing Fins + Halo Ring + Corner Beacon Spire
      const sailShape = new THREE.Shape();
      sailShape.moveTo(0, 0);
      sailShape.lineTo(2.4, 0);
      sailShape.quadraticCurveTo(2.8, mainH * 0.55, 0.2, mainH + 1.5);
      sailShape.lineTo(0, mainH + 1.5);
      sailShape.closePath();
      const sailGeo = trackGeo(
        new THREE.ExtrudeGeometry(sailShape, { depth: 0.45, bevelEnabled: false, curveSegments: 12 }),
      );
      sailGeo.translate(0, 0, -0.225);
      const angles = [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75, -Math.PI * 0.25];
      for (const ang of angles) {
        const sail = new THREE.Mesh(sailGeo, glowFinMat);
        sail.position.set(Math.cos(ang) * (b.width * 0.46), lobbyH + 0.4, Math.sin(ang) * (b.depth * 0.46));
        sail.rotation.y = -ang;
        bGroup.add(sail);
      }
      const ecoHalo = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(b.width * 0.56, 0.28, 8, 24)),
        glowFinMat,
      );
      ecoHalo.rotation.x = Math.PI * 0.5;
      ecoHalo.position.y = roofY - 2.2;
      bGroup.add(ecoHalo);

      const spireX = 4.2;
      const spireZ = -4.8;
      const spireMast = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.1, 0.28, 9.0, 8)),
        accentTrimMat,
      );
      spireMast.position.set(spireX, roofY + 7.2, spireZ);
      const beacon = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.32, 10, 8)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 1.5 })),
      );
      beacon.position.set(spireX, roofY + 11.9, spireZ);
      bGroup.add(spireMast, beacon);
    } else if (b.id === 'c3_aero_observatory') {
      // Sculpted Aero Observatory Tower: Cantilevered Saucer Observation Pod + Glowing Orbital Ring + Rotating Astronomical Dome
      const saucerPts = [
        new THREE.Vector2(4.2, 0),
        new THREE.Vector2(8.8, 1.4),
        new THREE.Vector2(9.2, 2.3),
        new THREE.Vector2(6.8, 3.2),
      ];
      const saucerPod = new THREE.Mesh(
        trackGeo(new THREE.LatheGeometry(saucerPts, 20)),
        accentTrimMat,
      );
      saucerPod.position.y = roofY - 5.2;
      bGroup.add(saucerPod);

      const orbitalRing = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(9.45, 0.25, 8, 28)),
        glowFinMat,
      );
      orbitalRing.rotation.x = Math.PI * 0.5;
      orbitalRing.position.y = roofY - 3.0;
      bGroup.add(orbitalRing);

      // Rotating Astronomical Observatory Dome on corner stairhouse
      const domeGroup = new THREE.Group();
      domeGroup.position.set(4.2, roofY + 3.0, -5.0);
      const domeMesh = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(1.45, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.5 })),
      );
      const scopeBarrel = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.24, 0.3, 1.85, 10)),
        darkMetalMat,
      );
      scopeBarrel.rotation.x = Math.PI * 0.28;
      scopeBarrel.position.set(0, 0.95, 0.9);
      domeGroup.add(domeMesh, scopeBarrel);
      bGroup.add(domeGroup);
      landmarkSpinners.push({ obj: domeGroup, speed: 0.45 });
    } else if (b.id === 'c4_golden_spire') {
      // Iconic Golden Horizon Spire: Twin Curved Golden Arches + Solar Halo Crown + Corner Spire + GOLDEN SPIRE Sign
      const archCurveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-b.width * 0.58, 0, 0),
        new THREE.Vector3(-b.width * 0.68, mainH * 0.55, 0),
        new THREE.Vector3(-b.width * 0.36, roofY - 2.0, 0),
      ]);
      const archCurveR = new THREE.CatmullRomCurve3([
        new THREE.Vector3(b.width * 0.58, 0, 0),
        new THREE.Vector3(b.width * 0.68, mainH * 0.55, 0),
        new THREE.Vector3(b.width * 0.36, roofY - 2.0, 0),
      ]);
      const archL = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(archCurveL, 18, 0.42, 8, false)), glowFinMat);
      const archR = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(archCurveR, 18, 0.42, 8, false)), glowFinMat);
      bGroup.add(archL, archR);

      const solarRing = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(b.width * 0.56, 0.3, 8, 24)),
        glowFinMat,
      );
      solarRing.rotation.x = Math.PI * 0.5;
      solarRing.position.y = roofY - 2.4;
      bGroup.add(solarRing);

      const spireMast = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.1, 0.28, 9.5, 8)),
        accentTrimMat,
      );
      spireMast.position.set(4.2, roofY + 7.4, -5.0);
      const beacon = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.34, 10, 8)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 1.55 })),
      );
      beacon.position.set(4.2, roofY + 12.2, -5.0);
      bGroup.add(spireMast, beacon);

      const gsCanvas = document.createElement('canvas');
      gsCanvas.width = 512;
      gsCanvas.height = 128;
      const gCtx = gsCanvas.getContext('2d');
      if (gCtx) {
        gCtx.fillStyle = '#0f172a';
        gCtx.fillRect(0, 0, 512, 128);
        gCtx.strokeStyle = '#eab308';
        gCtx.lineWidth = 6;
        gCtx.strokeRect(6, 6, 500, 116);
        gCtx.fillStyle = '#fef08a';
        gCtx.font = 'bold 54px Inter, system-ui, sans-serif';
        gCtx.textAlign = 'center';
        gCtx.textBaseline = 'middle';
        gCtx.fillText('GOLDEN SPIRE', 256, 66);
      }
      const gsTex = trackTex(new THREE.CanvasTexture(gsCanvas));
      const gsSignMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: gsTex,
          emissive: 0xfef08a,
          emissiveMap: gsTex,
          emissiveIntensity: 0.72,
          roughness: 0.35,
        }),
      );
      const crownSignS = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(b.width * 0.68, 1.75, 0.24)), gsSignMat);
      crownSignS.position.set(0, roofY - 1.35, b.depth * 0.5 + 0.06);
      bGroup.add(crownSignS);
    } else if (!isRooftopBuilding) {
      const hvac = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.34, 1.0, b.depth * 0.28)),
        roofHvacMat,
      );
      hvac.position.set(b.width * 0.14, roofY + 0.8, -b.depth * 0.12);
      bGroup.add(hvac);
    }

    if (b.hasAwning) {
      const awning = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.76, 0.24, 1.6)),
        trackMat(new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.72 })),
      );
      awning.position.set(0, 3.0, b.depth * 0.5 + 0.75);
      awning.rotation.x = 0.24;
      bGroup.add(awning);
    }

    group.add(bGroup);
  };

  layout.buildings.forEach(buildUrbanBuilding);

  // 7. Composite 3D Residential Houses
  const chimneyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x824438, roughness: 0.9 }));

  const buildHouse = (h: HouseSpec) => {
    const hGroup = new THREE.Group();
    hGroup.position.set(h.x, layout.sidewalkHeight, h.z);
    hGroup.rotation.y = h.facing;

    const wallMat = trackMat(new THREE.MeshStandardMaterial({ color: h.wallColor, roughness: 0.86 }));
    const roofMat = trackMat(new THREE.MeshStandardMaterial({ color: h.roofColor, roughness: 0.78 }));
    const trimMat = trackMat(new THREE.MeshStandardMaterial({ color: h.trimColor, roughness: 0.6 }));

    const plinth = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(h.width + 0.2, 0.36, h.depth + 0.2)),
      curbMat,
    );
    plinth.position.y = 0.18;
    hGroup.add(plinth);

    const body = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(h.width, h.wallHeight, h.depth)),
      wallMat,
    );
    body.position.y = 0.36 + h.wallHeight * 0.5;
    body.castShadow = enableShadows;
    body.receiveShadow = enableShadows;
    hGroup.add(body);

    const overhang = 0.42;
    const halfW = h.width * 0.5 + overhang;
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-halfW, 0);
    roofShape.lineTo(0, h.roofHeight);
    roofShape.lineTo(halfW, 0);
    roofShape.closePath();

    const roofGeo = trackGeo(
      new THREE.ExtrudeGeometry(roofShape, { depth: h.depth + overhang * 2, bevelEnabled: false }),
    );
    roofGeo.translate(0, 0, -(h.depth * 0.5 + overhang));
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.36 + h.wallHeight;
    roof.castShadow = enableShadows;
    hGroup.add(roof);

    const chimney = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.75, h.roofHeight + 1.1, 0.75)),
      chimneyMat,
    );
    chimney.position.set(h.width * 0.26, 0.36 + h.wallHeight + h.roofHeight * 0.65, -h.depth * 0.18);
    hGroup.add(chimney);

    const porchRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.18, 1.2)), trimMat);
    porchRoof.position.set(0, 2.75, -h.depth * 0.5 - 0.55);
    hGroup.add(porchRoof);

    const colGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.09, 2.4, 8));
    for (const sx of [-1.05, 1.05]) {
      const col = new THREE.Mesh(colGeo, trimMat);
      col.position.set(sx, 1.56, -h.depth * 0.5 - 0.95);
      hGroup.add(col);
    }

    const winGeo = trackGeo(new THREE.BoxGeometry(1.1, 1.1, 0.12));
    for (const wx of [-h.width * 0.28, h.width * 0.28]) {
      const wf = new THREE.Mesh(winGeo, windowGlowMat);
      wf.position.set(wx, 2.2, -h.depth * 0.5 - 0.02);
      const wb = new THREE.Mesh(winGeo, windowGlowMat);
      wb.position.set(wx, 2.2, h.depth * 0.5 + 0.02);
      hGroup.add(wf, wb);
    }

    group.add(hGroup);
  };

  layout.houses.forEach(buildHouse);

  // 8. 3D Parked Vehicles (Sedans, SUVs, Trucks)
  const tireMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.85 }));
  const cabGlassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x263847, roughness: 0.12, metalness: 0.65 }),
  );
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12));

  const buildParkedVehicle = (v: ParkedVehicleSpec) => {
    const vg = new THREE.Group();
    vg.position.set(v.x, v.y, v.z);
    vg.rotation.y = v.rotY;

    const paintMat = trackMat(
      new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.3, metalness: 0.45 }),
    );

    if (v.kind === 'truck') {
      const cab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 1.75, 2.0)), paintMat);
      cab.position.set(0, 1.25, -1.85);
      cab.castShadow = enableShadows;
      vg.add(cab);

      const windshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 0.72, 0.1)), cabGlassMat);
      windshield.position.set(0, 1.55, -2.86);
      vg.add(windshield);

      const cargo = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(2.2, 2.2, 3.8)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xe3e6ea, roughness: 0.62 })),
      );
      cargo.position.set(0, 1.55, 1.15);
      cargo.castShadow = enableShadows;
      vg.add(cargo);
    } else {
      const bodyH = v.kind === 'suv' ? 0.8 : 0.62;
      const cabH = v.kind === 'suv' ? 0.66 : 0.52;
      const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.82, bodyH, 4.1)), paintMat);
      body.position.set(0, 0.34 + bodyH * 0.5, 0);
      body.castShadow = enableShadows;
      vg.add(body);

      const cabin = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.56, cabH, v.kind === 'suv' ? 2.45 : 2.05)),
        cabGlassMat,
      );
      cabin.position.set(0, 0.34 + bodyH + cabH * 0.5 - 0.04, 0.15);
      cabin.castShadow = enableShadows;
      vg.add(cabin);
    }

    const wheelCoords: Array<[number, number]> =
      v.kind === 'truck'
        ? [
            [-1.02, -2.0],
            [1.02, -2.0],
            [-1.02, 1.6],
            [1.02, 1.6],
          ]
        : [
            [-0.88, -1.3],
            [0.88, -1.3],
            [-0.88, 1.3],
            [0.88, 1.3],
          ];
    for (const [wx, wz] of wheelCoords) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.rotation.z = Math.PI * 0.5;
      w.position.set(wx, 0.34, wz);
      vg.add(w);
    }

    group.add(vg);
  };

  layout.parkedVehicles.forEach(buildParkedVehicle);

  // 9. Industrial Shipping Containers
  const contGeo = trackGeo(new THREE.BoxGeometry(2.45, 2.55, 5.95));
  for (const c of layout.containers) {
    const cMat = trackMat(
      new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.68, metalness: 0.32 }),
    );
    const mesh = new THREE.Mesh(contGeo, cMat);
    mesh.position.set(c.x, c.y + 1.28, c.z);
    mesh.rotation.y = c.rotY;
    mesh.castShadow = enableShadows;
    mesh.receiveShadow = enableShadows;
    group.add(mesh);
  }

  // 10. Fountains
  const stoneMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xc9c4b9, roughness: 0.78 }));
  const fountainWaterMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3f98bf, roughness: 0.12, metalness: 0.25 }),
  );
  for (const f of layout.fountains) {
    const fg = new THREE.Group();
    fg.position.set(f.x, f.y, f.z);
    const rim = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(f.radius, f.radius + 0.25, 0.72, 24)),
      stoneMat,
    );
    rim.position.y = 0.36;
    rim.castShadow = enableShadows;
    const water = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(f.radius - 0.32, 24)), fountainWaterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.75;
    animatedWaterMeshes.push(water);
    const ped = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.55, 0.8, 1.6, 16)), stoneMat);
    ped.position.y = 0.9;
    const bowl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.35, 0.55, 0.45, 16)), stoneMat);
    bowl.position.y = 1.8;
    fg.add(rim, water, ped, bowl);
    group.add(fg);
  }

  // 11. Instanced Deciduous & Palm Trees
  const decTrees = layout.trees.filter((t) => t.kind === 'deciduous');
  const palmTrees = layout.trees.filter((t) => t.kind === 'palm');

  if (decTrees.length > 0) {
    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 1.9, 8));
    const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c4230, roughness: 0.92 }));
    const crownLowGeo = trackGeo(new THREE.DodecahedronGeometry(1.45, 1));
    const crownTopGeo = trackGeo(new THREE.DodecahedronGeometry(1.05, 1));
    const foliageMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84 }));

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, decTrees.length);
    const crownLowInst = new THREE.InstancedMesh(crownLowGeo, foliageMat, decTrees.length);
    const crownTopInst = new THREE.InstancedMesh(crownTopGeo, foliageMat, decTrees.length);
    trunkInst.castShadow = enableShadows;
    crownLowInst.castShadow = enableShadows;
    crownTopInst.castShadow = enableShadows;

    const tc = new THREE.Color();
    decTrees.forEach((t, i) => {
      dummy.position.set(t.x, t.y + 0.95 * t.scale, t.z);
      dummy.rotation.set(0, i * 1.1, 0);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, t.y + 2.55 * t.scale, t.z);
      dummy.scale.set(t.scale, t.scale * 0.95, t.scale);
      dummy.updateMatrix();
      crownLowInst.setMatrixAt(i, dummy.matrix);
      tc.setHex(t.tint);
      crownLowInst.setColorAt(i, tc);

      dummy.position.set(t.x + 0.12, t.y + 3.65 * t.scale, t.z - 0.08);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.updateMatrix();
      crownTopInst.setMatrixAt(i, dummy.matrix);
      tc.setHex(t.tint).offsetHSL(0.01, 0.04, 0.05);
      crownTopInst.setColorAt(i, tc);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    crownLowInst.instanceMatrix.needsUpdate = true;
    crownTopInst.instanceMatrix.needsUpdate = true;
    if (crownLowInst.instanceColor) crownLowInst.instanceColor.needsUpdate = true;
    if (crownTopInst.instanceColor) crownTopInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownLowInst.computeBoundingSphere();
    crownTopInst.computeBoundingSphere();
    group.add(trunkInst, crownLowInst, crownTopInst);
  }

  if (palmTrees.length > 0) {
    const pTrunkGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.24, 4.4, 7));
    const pTrunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x735940, roughness: 0.9 }));
    const pFrondGeo = trackGeo(new THREE.ConeGeometry(1.5, 0.7, 6));
    const pFrondMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x458e4c, roughness: 0.8 }));

    const pTrunkInst = new THREE.InstancedMesh(pTrunkGeo, pTrunkMat, palmTrees.length);
    const pFrondInst = new THREE.InstancedMesh(pFrondGeo, pFrondMat, palmTrees.length);
    pTrunkInst.castShadow = enableShadows;
    pFrondInst.castShadow = enableShadows;

    palmTrees.forEach((t, i) => {
      dummy.position.set(t.x, t.y + 2.2 * t.scale, t.z);
      dummy.rotation.set(0.05, i * 0.9, 0.04);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.updateMatrix();
      pTrunkInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x + 0.14, t.y + 4.4 * t.scale, t.z + 0.12);
      dummy.rotation.set(0, i * 0.9, 0);
      dummy.scale.set(t.scale * 1.15, t.scale, t.scale * 1.15);
      dummy.updateMatrix();
      pFrondInst.setMatrixAt(i, dummy.matrix);
    });
    pTrunkInst.instanceMatrix.needsUpdate = true;
    pFrondInst.instanceMatrix.needsUpdate = true;
    pTrunkInst.computeBoundingSphere();
    pFrondInst.computeBoundingSphere();
    group.add(pTrunkInst, pFrondInst);
  }

  // 12. Instanced Streetlamps (with Time-of-Day reactive bulb material)
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.13, 4.6, 8));
  const armGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.1, 1.1));
  const bulbGeo = trackGeo(new THREE.SphereGeometry(0.2, 8, 8));
  const lampPoleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2a313a, roughness: 0.34, metalness: 0.78 }),
  );
  const lampBulbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff3d1,
      emissive: 0xffce73,
      emissiveIntensity: 0.15,
      roughness: 0.2,
    }),
  );

  const poleInst = new THREE.InstancedMesh(poleGeo, lampPoleMat, layout.lamps.length);
  const armInst = new THREE.InstancedMesh(armGeo, lampPoleMat, layout.lamps.length);
  const bulbInst = new THREE.InstancedMesh(bulbGeo, lampBulbMat, layout.lamps.length);
  poleInst.castShadow = enableShadows;

  layout.lamps.forEach((l, i) => {
    dummy.position.set(l.x, l.y + 2.3, l.z);
    dummy.rotation.set(0, l.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);

    const fwdX = Math.sin(l.rotY) * 0.48;
    const fwdZ = Math.cos(l.rotY) * 0.48;
    dummy.position.set(l.x + fwdX, l.y + 4.55, l.z + fwdZ);
    dummy.updateMatrix();
    armInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(l.x + fwdX * 1.85, l.y + 4.42, l.z + fwdZ * 1.85);
    dummy.updateMatrix();
    bulbInst.setMatrixAt(i, dummy.matrix);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  armInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  armInst.computeBoundingSphere();
  bulbInst.computeBoundingSphere();
  group.add(poleInst, armInst, bulbInst);

  // 13. Instanced Benches
  const seatGeo = trackGeo(new THREE.BoxGeometry(2.0, 0.1, 0.56));
  const backGeo = trackGeo(new THREE.BoxGeometry(2.0, 0.42, 0.08));
  const benchWoodMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7d5336, roughness: 0.8 }));
  const seatInst = new THREE.InstancedMesh(seatGeo, benchWoodMat, layout.benches.length);
  const backInst = new THREE.InstancedMesh(backGeo, benchWoodMat, layout.benches.length);

  layout.benches.forEach((b, i) => {
    dummy.position.set(b.x, b.y + 0.44, b.z);
    dummy.rotation.set(0, b.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    seatInst.setMatrixAt(i, dummy.matrix);

    const bxOff = -Math.sin(b.rotY) * 0.24;
    const bzOff = -Math.cos(b.rotY) * 0.24;
    dummy.position.set(b.x + bxOff, b.y + 0.7, b.z + bzOff);
    dummy.updateMatrix();
    backInst.setMatrixAt(i, dummy.matrix);
  });
  seatInst.instanceMatrix.needsUpdate = true;
  backInst.instanceMatrix.needsUpdate = true;
  seatInst.computeBoundingSphere();
  backInst.computeBoundingSphere();
  group.add(seatInst, backInst);

  // 14. 3D Traffic Signs (Stop, Crosswalk, Speed Limit) & Traffic Signal Gantries
  const signPostGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6));
  const signPostMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c858e, roughness: 0.4, metalness: 0.7 }));
  const stopPlateGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 8));
  const stopMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xc92c24, roughness: 0.45 }));
  const warnPlateGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.65, 0.06));
  const warnMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45 }));
  const speedMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 }));

  for (const s of layout.trafficSigns) {
    const sg = new THREE.Group();
    sg.position.set(s.x, s.y, s.z);
    sg.rotation.y = s.rotY;
    const post = new THREE.Mesh(signPostGeo, signPostMat);
    post.position.y = 1.3;
    sg.add(post);

    if (s.kind === 'stop') {
      const plate = new THREE.Mesh(stopPlateGeo, stopMat);
      plate.rotation.x = Math.PI * 0.5;
      plate.position.set(0, 2.35, 0.06);
      sg.add(plate);
    } else if (s.kind === 'crosswalk') {
      const plate = new THREE.Mesh(warnPlateGeo, warnMat);
      plate.rotation.z = Math.PI * 0.25;
      plate.position.set(0, 2.35, 0.06);
      sg.add(plate);
    } else {
      const plate = new THREE.Mesh(warnPlateGeo, speedMat);
      plate.position.set(0, 2.35, 0.06);
      sg.add(plate);
    }
    group.add(sg);
  }

  const signalOffsets: Array<[number, number, number]> = [
    [-6.2, -6.2, 0],
    [6.2, 6.2, Math.PI],
    [-6.2, -48.2, 0],
    [48.2, 6.2, Math.PI],
    [77.8, -6.2, -Math.PI * 0.5],
    // City 2 (Emerald Bay) traffic lights
    [277.8, -6.2, 0],
    [290.2, 6.2, Math.PI],
    [319.8, -6.2, 0],
    // City 3 (Aero Highland) traffic lights
    [-6.2, -268.2, 0],
    [6.2, -255.8, Math.PI],
    [-6.2, -310.2, 0],
    // City 4 (Golden Horizon) traffic lights
    [-6.2, 255.8, 0],
    [6.2, 268.2, Math.PI],
    [-6.2, 297.8, 0],
    [48.2, 268.2, Math.PI],
  ];
  const sigMastGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.11, 5.2, 8));
  const sigArmGeo = trackGeo(new THREE.BoxGeometry(3.6, 0.12, 0.12));
  const sigHeadGeo = trackGeo(new THREE.BoxGeometry(0.45, 1.05, 0.38));
  const sigLightGreen = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2ec46a, emissive: 0x22a858, emissiveIntensity: 1.2 }),
  );
  const sigLightGeo = trackGeo(new THREE.SphereGeometry(0.11, 8, 8));

  for (const [sx, sz, rotY] of signalOffsets) {
    const sg = new THREE.Group();
    sg.position.set(sx, layout.sidewalkHeight, sz);
    sg.rotation.y = rotY;
    const mast = new THREE.Mesh(sigMastGeo, lampPoleMat);
    mast.position.y = 2.6;
    const arm = new THREE.Mesh(sigArmGeo, lampPoleMat);
    arm.position.set(1.75, 5.05, 0);
    const head = new THREE.Mesh(sigHeadGeo, lampPoleMat);
    head.position.set(2.9, 4.75, 0);
    const greenLens = new THREE.Mesh(sigLightGeo, sigLightGreen);
    greenLens.position.set(2.9, 4.42, 0.18);
    sg.add(mast, arm, head, greenLens);
    group.add(sg);
  }

  // 15. Functional Hinged Exterior Entrance Doors (1:1 with real enterable interiors)
  const exteriorDoors = new Map<string, ExteriorDoorRig>();
  for (const ent of layout.entrances) {
    const doorRig = buildExteriorEntranceDoor(ent, enableShadows);
    exteriorDoors.set(ent.id, doorRig);
    group.add(doorRig.group);
  }

  // 16. Accessible 3D Rooftop Decks, Glass Safety Railings, Helipads & Rooftop Props
  const roofPaverMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.rooftopTileMap,
      roughness: 0.76,
      metalness: 0.06,
    }),
  );
  const railGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.36,
    }),
  );
  const railSteelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.32, metalness: 0.75 }),
  );
  const helipadMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.helipadMap,
      roughness: 0.55,
      metalness: 0.12,
    }),
  );
  const beaconMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.15,
    }),
  );
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.82 }),
  );
  const roofShrubMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2f855a, roughness: 0.84 }),
  );
  const roofAccessDoorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.38,
      roughness: 0.32,
      metalness: 0.45,
    }),
  );

  const ladderGapByBuilding: Record<string, { side: 'n' | 's' | 'e' | 'w'; center: number; halfWidth: number }> = {
    civic_office_east: { side: 'e', center: -27.0, halfWidth: 0.75 },
    freedom_mall: { side: 'w', center: -25.0, halfWidth: 0.75 },
    city_reward_center: { side: 's', center: 13.5, halfWidth: 0.75 },
    ind_warehouse: { side: 'w', center: -17.5, halfWidth: 0.75 },
    resort_2_2: { side: 's', center: 26.8, halfWidth: 0.75 },
  };

  for (const roof of layout.rooftops) {
    const rw = roof.maxX - roof.minX;
    const rd = roof.maxZ - roof.minZ;
    const rcx = (roof.minX + roof.maxX) * 0.5;
    const rcz = (roof.minZ + roof.maxZ) * 0.5;

    const slab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(rw, 0.16, rd)), roofPaverMat);
    slab.position.set(rcx, roof.y - 0.08, rcz);
    slab.receiveShadow = enableShadows;
    group.add(slab);

    // Perimeter glass + steel safety railings (leaving gap where exterior ladder enters)
    const gap = ladderGapByBuilding[roof.buildingId];
    const addRailSegment = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.35) return;
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      const yaw = Math.atan2(x2 - x1, z2 - z1);
      const rg = new THREE.Group();
      rg.position.set(mx, roof.y, mz);
      rg.rotation.y = yaw;

      const topBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.07, len)), railSteelMat);
      topBar.position.y = 1.12;
      const midGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.92, len - 0.08)), railGlassMat);
      midGlass.position.y = 0.58;
      rg.add(topBar, midGlass);

      const postCount = Math.max(2, Math.round(len / 2.2) + 1);
      const postGeo = trackGeo(new THREE.BoxGeometry(0.07, 1.12, 0.07));
      for (let p = 0; p < postCount; p++) {
        const t = postCount === 1 ? 0.5 : p / (postCount - 1);
        const post = new THREE.Mesh(postGeo, railSteelMat);
        post.position.set(0, 0.56, -len * 0.5 + t * len);
        rg.add(post);
      }
      group.add(rg);
    };

    const drawSideRail = (side: 'n' | 's' | 'e' | 'w') => {
      const isNS = side === 'n' || side === 's';
      const fixedCoord =
        side === 'n'
          ? roof.minZ + 0.12
          : side === 's'
            ? roof.maxZ - 0.12
            : side === 'w'
              ? roof.minX + 0.12
              : roof.maxX - 0.12;
      const start = isNS ? roof.minX + 0.12 : roof.minZ + 0.12;
      const end = isNS ? roof.maxX - 0.12 : roof.maxZ - 0.12;

      if (gap && gap.side === side) {
        const gStart = gap.center - gap.halfWidth;
        const gEnd = gap.center + gap.halfWidth;
        if (isNS) {
          addRailSegment(start, fixedCoord, gStart, fixedCoord);
          addRailSegment(gEnd, fixedCoord, end, fixedCoord);
        } else {
          addRailSegment(fixedCoord, start, fixedCoord, gStart);
          addRailSegment(fixedCoord, gEnd, fixedCoord, end);
        }
      } else {
        if (isNS) addRailSegment(start, fixedCoord, end, fixedCoord);
        else addRailSegment(fixedCoord, start, fixedCoord, end);
      }
    };
    drawSideRail('n');
    drawSideRail('s');
    drawSideRail('w');
    drawSideRail('e');

    if (roof.hasHelipad) {
      const helipadCoords: Record<string, [number, number, number]> = {
        freedom_tower: [-26.2, -25.4, 3.5],
        ind_warehouse: [69.8, -17.5, 3.0],
        c2_emerald_tower: [299.2, -24.5, 3.2],
        c3_aero_observatory: [-26.5, -286.5, 3.2],
        c4_golden_spire: [-26.5, 279.5, 3.2],
      };
      const [hx, hz, padRadius] = helipadCoords[roof.buildingId] ?? [rcx, rcz, 3.0];
      const helipad = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(padRadius, padRadius + 0.15, 0.08, 28)),
        helipadMat,
      );
      helipad.position.set(hx, roof.y + 0.04, hz);
      helipad.receiveShadow = enableShadows;
      group.add(helipad);

      const beaconGeo = trackGeo(new THREE.SphereGeometry(0.11, 8, 6));
      for (let bIdx = 0; bIdx < 8; bIdx++) {
        const ang = (bIdx / 8) * Math.PI * 2;
        const bMesh = new THREE.Mesh(beaconGeo, beaconMat);
        bMesh.position.set(hx + Math.cos(ang) * (padRadius + 0.18), roof.y + 0.12, hz + Math.sin(ang) * (padRadius + 0.18));
        group.add(bMesh);
      }
    }

    // Rooftop Props (stairhouses, pergolas, planters, trees, benches, telescopes, HVAC)
    for (const p of roof.props) {
      const pg = new THREE.Group();
      pg.position.set(p.x, roof.y, p.z);
      pg.rotation.y = p.rotY ?? 0;

      if (p.kind === 'stairhouse') {
        const box = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(p.width, p.height, p.depth)),
          trackMat(new THREE.MeshStandardMaterial({ color: p.color ?? 0x334155, roughness: 0.7 })),
        );
        box.position.y = p.height * 0.5;
        box.castShadow = enableShadows;
        box.receiveShadow = enableShadows;
        const roofCap = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(p.width + 0.25, 0.22, p.depth + 0.25)),
          railSteelMat,
        );
        roofCap.position.y = p.height + 0.11;
        const doorLeaf = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.15, 2.15, 0.12)),
          roofAccessDoorMat,
        );
        doorLeaf.position.set(0, 1.08, p.depth * 0.5 + 0.04);
        const signBar = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.45, 0.22, 0.14)),
          beaconMat,
        );
        signBar.position.set(0, 2.38, p.depth * 0.5 + 0.08);
        pg.add(box, roofCap, doorLeaf, signBar);
      } else if (p.kind === 'pergola') {
        const pergolaWoodMat = trackMat(new THREE.MeshStandardMaterial({ color: p.color ?? 0x78350f, roughness: 0.78 }));
        const colGeo = trackGeo(new THREE.BoxGeometry(0.16, p.height, 0.16));
        for (const cx of [-p.width * 0.45, p.width * 0.45]) {
          for (const cz of [-p.depth * 0.45, p.depth * 0.45]) {
            const col = new THREE.Mesh(colGeo, pergolaWoodMat);
            col.position.set(cx, p.height * 0.5, cz);
            col.castShadow = enableShadows;
            pg.add(col);
          }
        }
        for (let b = -3; b <= 3; b++) {
          const beam = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(p.width + 0.2, 0.12, 0.14)),
            pergolaWoodMat,
          );
          beam.position.set(0, p.height, (b / 3) * (p.depth * 0.44));
          pg.add(beam);
        }
      } else if (p.kind === 'planter') {
        const box = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(p.width, p.height, p.depth)),
          stoneMat,
        );
        box.position.y = p.height * 0.5;
        box.castShadow = enableShadows;
        const shrub = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(p.width - 0.22, 0.36, p.depth - 0.22)),
          roofShrubMat,
        );
        shrub.position.y = p.height + 0.15;
        pg.add(box, shrub);
      } else if (p.kind === 'bench') {
        const seat = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(p.width, 0.1, p.depth * 0.78)),
          benchWoodMat,
        );
        seat.position.y = 0.46;
        const back = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(p.width, 0.42, 0.08)),
          benchWoodMat,
        );
        back.position.set(0, 0.72, -p.depth * 0.32);
        const legs = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(p.width * 0.85, 0.42, p.depth * 0.65)),
          railSteelMat,
        );
        legs.position.y = 0.21;
        pg.add(seat, back, legs);
      } else if (p.kind === 'hvac') {
        const unit = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(p.width, p.height, p.depth)),
          roofHvacMat,
        );
        unit.position.y = p.height * 0.5;
        unit.castShadow = enableShadows;
        const fanRing = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(Math.min(p.width, p.depth) * 0.34, Math.min(p.width, p.depth) * 0.34, 0.08, 12)),
          railSteelMat,
        );
        fanRing.position.y = p.height + 0.04;
        pg.add(unit, fanRing);
      } else if (p.kind === 'telescope') {
        const post = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.06, 0.12, 1.15, 8)),
          railSteelMat,
        );
        post.position.y = 0.58;
        const barrel = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 0.62, 10)),
          brassMat,
        );
        barrel.rotation.x = Math.PI * 0.42;
        barrel.position.set(0, 1.24, 0.08);
        pg.add(post, barrel);
      } else if (p.kind === 'tree') {
        const pot = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.58, 0.46, 0.68, 10)),
          stoneMat,
        );
        pot.position.y = 0.34;
        const trunk = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 8)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0x5c4230, roughness: 0.9 })),
        );
        trunk.position.y = 1.25;
        const crown = new THREE.Mesh(
          trackGeo(new THREE.DodecahedronGeometry(0.95, 1)),
          roofShrubMat,
        );
        crown.position.y = 2.45;
        crown.castShadow = enableShadows;
        pg.add(pot, trunk, crown);
      }
      group.add(pg);
    }
  }

  // 17. Exterior Climbable 3D Steel Ladders (flush against building walls with rungs & safety hoops)
  const ladderSteelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.38, metalness: 0.55 }),
  );
  const ladderPadMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
      roughness: 0.4,
    }),
  );

  for (const l of layout.ladders) {
    const lg = new THREE.Group();
    const height = l.topY - l.bottomY;
    lg.position.set(l.x + l.normalX * 0.28, l.bottomY, l.z + l.normalZ * 0.28);
    lg.rotation.y = l.climbYaw + Math.PI;

    const railH = height + 1.05;
    const railGeo = trackGeo(new THREE.CylinderGeometry(0.038, 0.038, railH, 8));
    for (const rx of [-0.26, 0.26]) {
      const rail = new THREE.Mesh(railGeo, ladderSteelMat);
      rail.position.set(rx, railH * 0.5, 0);
      rail.castShadow = enableShadows;
      lg.add(rail);
    }

    const rungGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.52, 6));
    const rungCount = Math.floor(height / 0.36);
    for (let r = 1; r <= rungCount; r++) {
      const ry = r * 0.36;
      const rung = new THREE.Mesh(rungGeo, ladderSteelMat);
      rung.rotation.z = Math.PI * 0.5;
      rung.position.set(0, ry, 0);
      lg.add(rung);
    }

    // Wall mounting brackets & safety cage rings on taller ladders
    const bracketGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.06, 0.3));
    for (let by = 1.6; by <= height; by += 2.4) {
      for (const bx of [-0.26, 0.26]) {
        const br = new THREE.Mesh(bracketGeo, railSteelMat);
        br.position.set(bx, by, 0.14);
        lg.add(br);
      }
      if (by > 4.0) {
        const hoop = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(0.42, 0.024, 6, 12, Math.PI * 1.25)),
          railSteelMat,
        );
        hoop.rotation.x = Math.PI * 0.5;
        hoop.rotation.z = -Math.PI * 0.125;
        hoop.position.set(0, by, -0.18);
        lg.add(hoop);
      }
    }

    // Ground boarding marker pad so climbable ladders stand out visually
    const marker = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.04, 0.85)), ladderPadMat);
    marker.position.set(0, 0.02, -0.45);
    lg.add(marker);

    group.add(lg);
  }

  return {
    group,
    skyDome,
    animatedWaterMeshes,
    bayWater,
    skyUniforms,
    lampBulbMat,
    windowGlowMat,
    buildingWindowMats,
    exteriorDoors,
    updateEnvironment: (elapsedTime: number) => {
      for (let r = 0; r < atcRadars.length; r++) {
        atcRadars[r].rotation.y = elapsedTime * 1.4 + r * 0.8;
      }
      for (let i = 0; i < sailboats.length; i++) {
        const s = sailboats[i];
        s.group.position.y = s.baseY + Math.sin(elapsedTime * 1.35 + s.phase) * 0.14;
        s.group.rotation.z = Math.sin(elapsedTime * 1.1 + s.phase) * 0.045;
      }
      for (let i = 0; i < landmarkSpinners.length; i++) {
        const sp = landmarkSpinners[i];
        sp.obj.rotation.y = elapsedTime * sp.speed + i * 0.9;
        if (sp.bobBaseY !== undefined && sp.bobAmp !== undefined) {
          sp.obj.position.y = sp.bobBaseY + Math.sin(elapsedTime * 2.1 + i) * sp.bobAmp;
        }
      }
      for (let i = 0; i < underwaterFishSchools.length; i++) {
        const school = underwaterFishSchools[i];
        school.pivot.rotation.y = elapsedTime * school.speed + school.phase;
        school.pivot.position.y += Math.sin(elapsedTime * 1.2 + i) * 0.002;
        for (let f = 0; f < school.fishFins.length; f++) {
          school.fishFins[f].rotation.y = Math.sin(elapsedTime * 9.5 + f * 1.1) * 0.36;
        }
      }
      for (let i = 0; i < underwaterMantas.length; i++) {
        const m = underwaterMantas[i];
        const a = elapsedTime * m.speed + m.phase;
        const nx = m.centerX + Math.cos(a) * m.radiusX;
        const nz = m.centerZ + Math.sin(a) * m.radiusZ;
        const vx = -Math.sin(a) * m.radiusX * m.speed;
        const vz = Math.cos(a) * m.radiusZ * m.speed;
        m.group.position.set(nx, m.baseY + Math.sin(elapsedTime * 0.9 + i) * 0.9, nz);
        m.group.rotation.y = Math.atan2(-vx, -vz);
        const flap = Math.sin(elapsedTime * 2.6 + i * 1.4) * 0.28;
        m.wingL.rotation.z = flap;
        m.wingR.rotation.z = -flap;
      }
      for (let i = 0; i < underwaterKelp.length; i++) {
        const k = underwaterKelp[i];
        k.mesh.rotation.z = Math.sin(elapsedTime * k.speed + k.phase) * 0.16;
        k.mesh.rotation.x = Math.cos(elapsedTime * k.speed * 0.8 + k.phase) * 0.1;
      }
      for (let i = 0; i < underwaterBubbles.length; i++) {
        const b = underwaterBubbles[i];
        const cycle = (elapsedTime * b.speed + b.phase) % 12.2;
        b.mesh.position.y = b.baseY + cycle;
        b.mesh.position.x += Math.sin(elapsedTime * 3.0 + b.phase) * 0.004;
      }
    },
    dispose: () => {
      exteriorDoors.forEach((rig) => rig.dispose());
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      texturesToDispose.forEach((t) => t.dispose());
    },
  };
}
