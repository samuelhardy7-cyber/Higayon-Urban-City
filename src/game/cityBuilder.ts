import * as THREE from 'three';
import { buildExteriorEntranceDoor, type ExteriorDoorRig } from './interiorBuilder';
import type { CityTextures } from './textures';
import type { BuildingSpec, CityLayout, HouseSpec, ParkedVehicleSpec } from './types';

export interface BuiltCity {
  group: THREE.Group;
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
  const animatedWaterMeshes: THREE.Mesh[] = [];
  const buildingWindowMats: THREE.MeshStandardMaterial[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Sky Dome (horizon-matched gradient shader updated by TimeOfDay)
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x4c8fd6) },
    horizonColor: { value: new THREE.Color(0xd7e9f6) },
    sunColor: { value: new THREE.Color(0xfff5db) },
    sunDir: { value: new THREE.Vector3(0.52, 0.72, 0.42).normalize() },
  };
  const skyGeo = trackGeo(new THREE.SphereGeometry(470, 24, 16));
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
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.56));
          float sunDot = max(dot(dir, sunDir), 0.0);
          col = mix(col, sunColor, pow(sunDot, 22.0) * 0.72);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  group.add(new THREE.Mesh(skyGeo, skyMat));

  // 2. Outer Rolling Parkland, Distant Hills & Freedom Bay Ocean
  const outerLandMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x5c8252, roughness: 0.94 }),
  );
  const outerLand = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(760, 760)), outerLandMat);
  outerLand.rotation.x = -Math.PI / 2;
  outerLand.position.set(-280, -0.08, 0);
  outerLand.receiveShadow = enableShadows;
  group.add(outerLand);

  const hillMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x42663f, roughness: 0.94 }));
  const hillGeo = trackGeo(
    new THREE.SphereGeometry(48, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  );
  const hillCoords: Array<[number, number, number, number]> = [
    [-195, -160, 1.5, 0.46],
    [-215, -55, 1.8, 0.52],
    [-200, 75, 1.6, 0.48],
    [-165, 190, 1.5, 0.42],
    [-75, -220, 1.7, 0.44],
    [38, -225, 1.5, 0.38],
    [-65, 220, 1.6, 0.42],
    [45, 215, 1.4, 0.36],
  ];
  for (const [hx, hz, sx, sy] of hillCoords) {
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(hx, -0.25, hz);
    hill.scale.set(sx, sy, sx * 1.15);
    group.add(hill);
  }

  // Bay Ocean on East (x > 95)
  const bayMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x22698f, roughness: 0.16, metalness: 0.36 }),
  );
  const bayWater = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(460, 820, 1, 1)), bayMat);
  bayWater.rotation.x = -Math.PI / 2;
  bayWater.position.set(326, -0.38, 0);
  bayWater.receiveShadow = enableShadows;
  group.add(bayWater);

  // Distant Harbor Lighthouse
  const lhGroup = new THREE.Group();
  lhGroup.position.set(170, -0.4, -52);
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
  lhGroup.add(lhRock, lhTower, lhBeacon);
  group.add(lhGroup);

  // 3. Asphalt Road Base (y = 0) + Markings + Crosswalks
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
  const asphaltBase = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(196, 196)), roadMat);
  asphaltBase.rotation.x = -Math.PI / 2;
  asphaltBase.receiveShadow = enableShadows;
  group.add(asphaltBase);

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

  for (const rc of layout.roadCenters) {
    for (let pos = -88; pos <= 88; pos += 6.0) {
      if (layout.roadCenters.some((ic) => Math.abs(pos - ic) < 6.2)) continue;
      dummy.position.set(rc, 0.025, pos);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dashMatrices.push(dummy.matrix.clone());

      dummy.position.set(pos, 0.025, rc);
      dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      dummy.updateMatrix();
      dashMatrices.push(dummy.matrix.clone());
    }
  }
  const dashInst = new THREE.InstancedMesh(dashGeo, yellowLineMat, dashMatrices.length);
  dashMatrices.forEach((m, i) => dashInst.setMatrixAt(i, m));
  dashInst.instanceMatrix.needsUpdate = true;
  dashInst.computeBoundingSphere();
  group.add(dashInst);

  const cwGeo = trackGeo(new THREE.PlaneGeometry(0.65, 2.8));
  const cwMatrices: THREE.Matrix4[] = [];
  for (const rx of layout.roadCenters) {
    for (const rz of layout.roadCenters) {
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

  // Coastal Promenade Deck (x = 89..95.5, z = -8..96)
  const promDeck = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 0.85, 104)),
    sidewalkMat,
  );
  promDeck.position.set(92.2, layout.sidewalkHeight - 0.425, 44);
  promDeck.receiveShadow = enableShadows;
  group.add(promDeck);

  // Golden Sandy Beach sloping into the ocean (x = 95..114, z = -6..94)
  const sandGeo = trackGeo(new THREE.BoxGeometry(20, 0.6, 100));
  const sandMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe8d09e, roughness: 0.94, metalness: 0.0 }),
  );
  const beachMesh = new THREE.Mesh(sandGeo, sandMat);
  beachMesh.position.set(104.5, -0.35, 44);
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

  // Wooden Coastal Tourist Pier (x = 95..118.5, z = 39..45) + Observation Gazebo
  const woodMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x8a6142, roughness: 0.84 }));
  const pierDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 0.28, 6.2)), woodMat);
  pierDeck.position.set(106.8, layout.sidewalkHeight - 0.1, 42);
  pierDeck.receiveShadow = enableShadows;
  pierDeck.castShadow = enableShadows;
  group.add(pierDeck);

  // Pier support pilings
  const pilingGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.25, 2.4, 8));
  for (let px = 97; px <= 117; px += 4.8) {
    for (const pz of [39.3, 44.7]) {
      const pile = new THREE.Mesh(pilingGeo, woodMat);
      pile.position.set(px, -0.7, pz);
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

    if (b.style === 'reward_center') {
      // Modern flagship CITY REWARD CENTER showroom with gold fascia, glowing vitrine windows, rooftop crown & marquee
      const baseMat = trackMat(
        new THREE.MeshStandardMaterial({ color: b.primaryColor, roughness: 0.42, metalness: 0.25 }),
      );
      const goldMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: b.accentColor,
          emissive: 0xd97706,
          emissiveIntensity: 0.25,
          roughness: 0.28,
          metalness: 0.55,
        }),
      );
      const cyanGlowMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.35,
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
        trackGeo(new THREE.BoxGeometry(b.width + 0.38, 0.46, b.depth + 0.38)),
        goldMat,
      );
      goldBelt.position.y = b.height * 0.62;
      bGroup.add(goldBelt);

      const upperShowroom = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.84, b.height * 0.38, b.depth * 0.84)),
        cyanGlowMat,
      );
      upperShowroom.position.y = b.height * 0.81;
      upperShowroom.castShadow = enableShadows;
      bGroup.add(upperShowroom);

      const roofTrim = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.88, 0.36, b.depth * 0.88)),
        goldMat,
      );
      roofTrim.position.y = b.height + 0.18;
      bGroup.add(roofTrim);

      // West-facing showcase windows beside entrance + canopy
      const vitrineW = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.14, 2.25, 2.2)),
        windowGlowMat,
      );
      vitrineW.position.set(-b.width * 0.5 - 0.04, 1.55, -2.55);
      const vitrineW2 = vitrineW.clone();
      vitrineW2.position.z = 2.55;
      bGroup.add(vitrineW, vitrineW2);

      const awning = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.75, 0.24, b.depth * 0.72)),
        goldMat,
      );
      awning.position.set(-b.width * 0.5 - 0.82, 3.15, 0);
      awning.rotation.z = -0.18;
      bGroup.add(awning);

      // Crisp CanvasTexture Shop Marquee facing West entrance street
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
      const rcTex = new THREE.CanvasTexture(rcCanvas);
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
        trackGeo(new THREE.BoxGeometry(b.width + 0.2, 0.5, b.depth + 0.2)),
        trimMat,
      );
      trimBand.position.y = b.height - 0.6;
      bGroup.add(trimBand);

      if (b.style === 'factory') {
        // Sawtooth roof ridges + twin smokestacks
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
      // Shopping Mall: wide lower concourse + glazed skylight atrium + portico + sign fascia
      const wallMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: b.primaryColor,
          map: textures.commercialFacadeMap,
          roughness: 0.55,
          metalness: 0.12,
        }),
      );
      const base = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, b.height * 0.72, b.depth)),
        wallMat,
      );
      base.position.y = b.height * 0.36;
      base.castShadow = enableShadows;
      base.receiveShadow = enableShadows;
      bGroup.add(base);

      const atriumMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xc2dced,
          map: textures.buildingWindowMap,
          emissive: 0xffd791,
          emissiveMap: textures.buildingWindowMap,
          emissiveIntensity: 0.12,
          roughness: 0.18,
          metalness: 0.42,
        }),
      );
      buildingWindowMats.push(atriumMat);

      const glassAtrium = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.58, b.height * 0.38, b.depth * 0.58)),
        atriumMat,
      );
      glassAtrium.position.y = b.height * 0.72 + b.height * 0.19;
      bGroup.add(glassAtrium);

      const canopy = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.55, 0.4, 2.6)),
        trackMat(new THREE.MeshStandardMaterial({ color: b.accentColor, roughness: 0.45, metalness: 0.25 })),
      );
      canopy.position.set(0, 3.6, b.depth * 0.5 + 1.2);
      bGroup.add(canopy);
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

    const mainH = b.hasSetback ? upperH * 0.74 : upperH;
    const shaft = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(b.width - 0.15, mainH, b.depth - 0.15)),
      shaftMat,
    );
    shaft.position.y = lobbyH + 0.4 + mainH * 0.5;
    shaft.castShadow = enableShadows;
    shaft.receiveShadow = enableShadows;
    bGroup.add(shaft);

    const roofY = lobbyH + 0.4 + mainH;
    const parapet = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(b.width + 0.18, 0.5, b.depth + 0.18)),
      darkMetalMat,
    );
    parapet.position.y = roofY + 0.25;
    bGroup.add(parapet);

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
        trackGeo(new THREE.BoxGeometry(b.width * 0.72, 0.45, b.depth * 0.72)),
        darkMetalMat,
      );
      crown.position.y = roofY + 0.5 + setH + 0.22;
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

        if (b.id === 'freedom_tower') {
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
          const signTex = new THREE.CanvasTexture(signCanvas);
          const signMat = trackMat(
            new THREE.MeshStandardMaterial({
              map: signTex,
              emissive: 0xfef3c7,
              emissiveMap: signTex,
              emissiveIntensity: 0.72,
              roughness: 0.35,
            }),
          );
          const crownSign = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(b.width * 0.58, 1.85, 0.28)),
            signMat,
          );
          crownSign.position.set(0, roofY + 0.5 + setH - 1.2, b.depth * 0.34 + 0.16);
          const lobbySign = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(4.4, 0.92, 0.22)),
            signMat,
          );
          lobbySign.position.set(0, 3.65, b.depth * 0.5 + 0.26);
          bGroup.add(crownSign, lobbySign);
        }
      }
    } else {
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

  return {
    group,
    animatedWaterMeshes,
    bayWater,
    skyUniforms,
    lampBulbMat,
    windowGlowMat,
    buildingWindowMats,
    exteriorDoors,
    dispose: () => {
      exteriorDoors.forEach((rig) => rig.dispose());
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
