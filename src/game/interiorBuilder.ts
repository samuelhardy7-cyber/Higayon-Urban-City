import * as THREE from 'three';
import type { ElevatorRuntimeState } from './elevatorSystem';
import type { CityTextures } from './textures';
import type {
  BuildingEntranceSpec,
  InteriorBlueprint,
  InteriorDoorState,
  InteriorFloorSlab,
  InteriorFurnitureProp,
  InteriorLightSpec,
} from './types';

export interface ExteriorDoorRig {
  entranceId: string;
  group: THREE.Group;
  hingePivot: THREE.Group;
  openProgress: number;
  targetOpen: boolean;
  setOpenProgress: (progress: number) => void;
  dispose: () => void;
}

interface BuiltElevatorDoors {
  floorNumber: number;
  leftDoor: THREE.Mesh;
  rightDoor: THREE.Mesh;
  doorClosedOffset: number;
  callPadMat: THREE.MeshStandardMaterial;
  ledMat: THREE.MeshStandardMaterial;
}

interface BuiltElevatorVisual {
  elevatorId: string;
  cabinGroup: THREE.Group;
  cabinLeftDoor: THREE.Mesh;
  cabinRightDoor: THREE.Mesh;
  cabinDoorOffset: number;
  hoistwayDoors: BuiltElevatorDoors[];
}

export interface BuiltInterior {
  group: THREE.Group;
  doorPivots: Map<string, THREE.Group>;
  floorGroups: Map<number, THREE.Group>;
  syncVisibleFloorWindow: (currentFloor: number) => void;
  syncDoors: (doors: InteriorDoorState[]) => void;
  syncElevator: (elevState: ElevatorRuntimeState | null) => void;
  dispose: () => void;
}

export function buildExteriorEntranceDoor(
  entrance: BuildingEntranceSpec,
  enableShadows: boolean,
): ExteriorDoorRig {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const tGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const tMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const group = new THREE.Group();
  group.position.set(entrance.doorX, entrance.doorY, entrance.doorZ);
  group.rotation.y = entrance.yaw;

  const w = entrance.width;
  const h = entrance.height;

  const frameMat = tMat(
    new THREE.MeshStandardMaterial({
      color: entrance.doorStyle === 'wood' ? 0xf2ede4 : 0x262e38,
      roughness: 0.45,
      metalness: entrance.doorStyle === 'wood' ? 0.05 : 0.65,
    }),
  );
  const accentMat = tMat(
    new THREE.MeshStandardMaterial({
      color: entrance.accentColor,
      roughness: 0.42,
      metalness: 0.25,
    }),
  );
  const recessMat = tMat(
    new THREE.MeshStandardMaterial({
      color: 0x0b1018,
      emissive: 0xffe4b0,
      emissiveIntensity: 0.14,
      roughness: 0.9,
    }),
  );

  const recess = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w - 0.08, h - 0.06, 0.06)), recessMat);
  recess.position.set(0, h * 0.5, 0.03);
  group.add(recess);

  const matMesh = new THREE.Mesh(
    tGeo(new THREE.BoxGeometry(w + 0.35, 0.04, 0.72)),
    tMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })),
  );
  matMesh.position.set(0, 0.02, 0.42);
  matMesh.receiveShadow = enableShadows;
  group.add(matMesh);

  const jambGeo = tGeo(new THREE.BoxGeometry(0.11, h + 0.06, 0.22));
  const leftJamb = new THREE.Mesh(jambGeo, frameMat);
  leftJamb.position.set(-w * 0.5 - 0.05, (h + 0.06) * 0.5, 0.06);
  const rightJamb = new THREE.Mesh(jambGeo, frameMat);
  rightJamb.position.set(w * 0.5 + 0.05, (h + 0.06) * 0.5, 0.06);
  const header = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w + 0.24, 0.14, 0.24)), frameMat);
  header.position.set(0, h + 0.05, 0.06);
  group.add(leftJamb, rightJamb, header);

  const signBar = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w + 0.45, 0.26, 0.16)), accentMat);
  signBar.position.set(0, h + 0.25, 0.1);
  group.add(signBar);

  const porchLight = new THREE.Mesh(
    tGeo(new THREE.BoxGeometry(0.32, 0.08, 0.14)),
    tMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff3d1,
        emissive: 0xffd27d,
        emissiveIntensity: 0.95,
      }),
    ),
  );
  porchLight.position.set(0, h + 0.12, 0.2);
  group.add(porchLight);

  const hingePivot = new THREE.Group();
  hingePivot.position.set(-w * 0.5, 0, 0.09);

  if (entrance.doorStyle === 'glass_double' || entrance.doorStyle === 'storefront') {
    const leafMat = tMat(
      new THREE.MeshStandardMaterial({
        color: 0x3b6582,
        emissive: 0xffdfa8,
        emissiveIntensity: 0.16,
        roughness: 0.15,
        metalness: 0.55,
      }),
    );
    const leaf = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w - 0.06, h - 0.08, 0.07)), leafMat);
    leaf.position.set(w * 0.5, (h - 0.04) * 0.5, 0);
    leaf.castShadow = enableShadows;
    hingePivot.add(leaf);

    const rail = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w - 0.06, 0.1, 0.1)), frameMat);
    rail.position.set(w * 0.5, 1.05, 0);
    hingePivot.add(rail);

    const handle = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(0.06, 0.42, 0.08)),
      tMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })),
    );
    handle.position.set(w - 0.22, 1.08, 0.06);
    hingePivot.add(handle);
  } else if (entrance.doorStyle === 'industrial') {
    const steelMat = tMat(
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.52, metalness: 0.55 }),
    );
    const leaf = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w - 0.04, h - 0.06, 0.09)), steelMat);
    leaf.position.set(w * 0.5, (h - 0.03) * 0.5, 0);
    leaf.castShadow = enableShadows;
    hingePivot.add(leaf);

    const stripe = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w - 0.16, 0.16, 0.11)), accentMat);
    stripe.position.set(w * 0.5, 1.15, 0);
    hingePivot.add(stripe);

    const handle = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(0.16, 0.08, 0.08)),
      tMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 })),
    );
    handle.position.set(w - 0.22, 1.05, 0.07);
    hingePivot.add(handle);
  } else {
    const woodMat = tMat(
      new THREE.MeshStandardMaterial({ color: entrance.accentColor, roughness: 0.68 }),
    );
    const leaf = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w - 0.04, h - 0.06, 0.08)), woodMat);
    leaf.position.set(w * 0.5, (h - 0.03) * 0.5, 0);
    leaf.castShadow = enableShadows;
    hingePivot.add(leaf);

    const glassInset = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(w * 0.48, 0.55, 0.1)),
      tMat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0xffdfa8, emissiveIntensity: 0.22, roughness: 0.15 })),
    );
    glassInset.position.set(w * 0.5, h * 0.68, 0);
    hingePivot.add(glassInset);

    const knob = new THREE.Mesh(
      tGeo(new THREE.SphereGeometry(0.05, 8, 8)),
      tMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 })),
    );
    knob.position.set(w - 0.16, 1.02, 0.06);
    hingePivot.add(knob);
  }

  group.add(hingePivot);

  const rig: ExteriorDoorRig = {
    entranceId: entrance.id,
    group,
    hingePivot,
    openProgress: 0,
    targetOpen: false,
    setOpenProgress: (progress: number) => {
      rig.openProgress = progress;
      rig.hingePivot.rotation.y = -progress * Math.PI * 0.52;
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };

  return rig;
}

export function buildInteriorScene(
  blueprint: InteriorBlueprint,
  textures: CityTextures,
  enableShadows: boolean,
): BuiltInterior {
  const group = new THREE.Group();
  const alwaysVisibleGroup = new THREE.Group();
  group.add(alwaysVisibleGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const doorPivots = new Map<string, THREE.Group>();
  const floorGroups = new Map<number, THREE.Group>();
  const floorBaseY: Array<{ floorNumber: number; y: number }> = [];

  for (let f = 1; f <= blueprint.floorsCount; f++) {
    const fg = new THREE.Group();
    floorGroups.set(f, fg);
    group.add(fg);

    const slab = blueprint.floorSlabs.find((s) => s.floorNumber === f);
    if (slab) {
      floorBaseY.push({ floorNumber: f, y: slab.y });
    }
  }
  floorBaseY.sort((a, b) => a.y - b.y);

  const getFloorGroupForY = (y: number): THREE.Group => {
    let matchedFloor = 1;
    for (let i = 0; i < floorBaseY.length; i++) {
      if (floorBaseY[i].y <= y + 0.55) {
        matchedFloor = floorBaseY[i].floorNumber;
      }
    }
    return floorGroups.get(matchedFloor) ?? alwaysVisibleGroup;
  };

  const tGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const tMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Floor materials cached by surface type so 22-story tower shares materials cleanly
  const floorMatCache = new Map<InteriorFloorSlab['surface'], THREE.MeshStandardMaterial>();
  const makeFloorMat = (surface: InteriorFloorSlab['surface']) => {
    const cached = floorMatCache.get(surface);
    if (cached) return cached;
    let mat: THREE.MeshStandardMaterial;
    switch (surface) {
      case 'wood':
        mat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: textures.woodFloorMap,
          roughness: 0.68,
          metalness: 0.04,
        });
        break;
      case 'tile':
        mat = new THREE.MeshStandardMaterial({
          color: 0xd9e1e8,
          map: textures.tileFloorMap,
          roughness: 0.44,
          metalness: 0.08,
        });
        break;
      case 'marble':
        mat = new THREE.MeshStandardMaterial({
          color: 0xe6dfd4,
          map: textures.tileFloorMap,
          roughness: 0.25,
          metalness: 0.14,
        });
        break;
      case 'carpet':
        mat = new THREE.MeshStandardMaterial({ color: 0x4b5c6b, roughness: 0.94 });
        break;
      case 'concrete':
        mat = new THREE.MeshStandardMaterial({ color: 0x717882, roughness: 0.86, metalness: 0.08 });
        break;
    }
    tMat(mat);
    floorMatCache.set(surface, mat);
    return mat;
  };

  const wallMatCache = new Map<number, THREE.MeshStandardMaterial>();
  const getWallMat = (color: number) => {
    let mat = wallMatCache.get(color);
    if (!mat) {
      mat = tMat(new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
      wallMatCache.set(color, mat);
    }
    return mat;
  };

  const ceilMat = tMat(
    new THREE.MeshStandardMaterial({ color: blueprint.ceilingColor, roughness: 0.88 }),
  );
  const ceilPanelMat = tMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff3db,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    }),
  );

  // 1. Floor slabs + ceilings (skip ceiling when slab.hasOpenSky is true)
  for (const s of blueprint.floorSlabs) {
    const fg = floorGroups.get(s.floorNumber) ?? alwaysVisibleGroup;
    const w = s.maxX - s.minX;
    const d = s.maxZ - s.minZ;
    const cx = (s.minX + s.maxX) * 0.5;
    const cz = (s.minZ + s.maxZ) * 0.5;

    const floorMesh = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(w, 0.18, d)),
      makeFloorMat(s.surface),
    );
    floorMesh.position.set(cx, s.y - 0.09, cz);
    floorMesh.receiveShadow = enableShadows;
    fg.add(floorMesh);

    if (s.floorNumber === blueprint.floorsCount && !s.hasOpenSky) {
      const ceilMesh = new THREE.Mesh(tGeo(new THREE.BoxGeometry(w, 0.18, d)), ceilMat);
      ceilMesh.position.set(cx, s.ceilingY + 0.09, cz);
      fg.add(ceilMesh);
    }
  }

  // Rooftop Helipad circle marking when highest floor hasOpenSky
  const rooftopSlabs = blueprint.floorSlabs.filter((s) => s.hasOpenSky);
  if (rooftopSlabs.length > 0) {
    const roofY = rooftopSlabs[0].y;
    const roofGroup = floorGroups.get(rooftopSlabs[0].floorNumber) ?? alwaysVisibleGroup;
    const padRing = new THREE.Mesh(
      tGeo(new THREE.RingGeometry(2.1, 2.45, 32)),
      tMat(new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })),
    );
    padRing.rotation.x = -Math.PI * 0.5;
    padRing.position.set(-1.5, roofY + 0.02, 0.8);
    const padInner = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(1.4, 0.02, 0.32)),
      tMat(new THREE.MeshBasicMaterial({ color: 0xfacc15 })),
    );
    padInner.position.set(-1.5, roofY + 0.02, 0.8);
    roofGroup.add(padRing, padInner);
  }

  // Ceiling fixture bars per floor + fixed pool of 4 reusable PointLights for performance
  const fixtureGeo = tGeo(new THREE.BoxGeometry(1.4, 0.06, 0.36));
  const lightsByFloor = new Map<number, InteriorLightSpec[]>();
  for (const l of blueprint.lights) {
    let matchedFloor = 1;
    for (let i = 0; i < floorBaseY.length; i++) {
      if (floorBaseY[i].y <= l.y + 0.2) {
        matchedFloor = floorBaseY[i].floorNumber;
      }
    }
    const fg = floorGroups.get(matchedFloor) ?? alwaysVisibleGroup;
    const fix = new THREE.Mesh(fixtureGeo, ceilPanelMat);
    fix.position.set(l.x, l.y + 0.14, l.z);
    fg.add(fix);

    const arr = lightsByFloor.get(matchedFloor) ?? [];
    arr.push(l);
    lightsByFloor.set(matchedFloor, arr);
  }

  const MAX_POOLED_LIGHTS = 4;
  const lightPool: THREE.PointLight[] = [];
  for (let i = 0; i < MAX_POOLED_LIGHTS; i++) {
    const pt = new THREE.PointLight(0xffffff, 0, 14, 1.5);
    alwaysVisibleGroup.add(pt);
    lightPool.push(pt);
  }

  // 2. Walls, Window Walls, Glass Partitions & Railings
  const windowGlassMat = tMat(
    new THREE.MeshStandardMaterial({
      color: 0x8cc7e8,
      emissive: 0x7dd3fc,
      emissiveIntensity: 0.28,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.65,
    }),
  );
  const partGlassMat = tMat(
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.1,
      metalness: 0.25,
      transparent: true,
      opacity: 0.42,
    }),
  );
  const mullionMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.65 }),
  );

  for (const w of blueprint.walls) {
    const fg = getFloorGroupForY(w.minY);
    const sx = w.maxX - w.minX;
    const sy = w.maxY - w.minY;
    const sz = w.maxZ - w.minZ;
    const cx = (w.minX + w.maxX) * 0.5;
    const cy = (w.minY + w.maxY) * 0.5;
    const cz = (w.minZ + w.maxZ) * 0.5;

    if (w.kind === 'window_wall' && sy > 2.2) {
      const wallMat = getWallMat(w.color);
      const wainscotH = 0.95;
      const headerH = 0.65;
      const winH = Math.max(0.4, sy - wainscotH - headerH);

      const lower = new THREE.Mesh(tGeo(new THREE.BoxGeometry(sx, wainscotH, sz)), wallMat);
      lower.position.set(cx, w.minY + wainscotH * 0.5, cz);
      lower.castShadow = enableShadows;
      lower.receiveShadow = enableShadows;

      const upper = new THREE.Mesh(tGeo(new THREE.BoxGeometry(sx, headerH, sz)), wallMat);
      upper.position.set(cx, w.maxY - headerH * 0.5, cz);

      const isAlongX = sx > sz;
      const span = isAlongX ? sx : sz;
      const pillarW = Math.min(1.2, span * 0.14);
      const glassSpan = Math.max(0.5, span - pillarW * 2);

      const p1 = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(isAlongX ? pillarW : sx, winH, isAlongX ? sz : pillarW)),
        wallMat,
      );
      p1.position.set(
        isAlongX ? w.minX + pillarW * 0.5 : cx,
        w.minY + wainscotH + winH * 0.5,
        isAlongX ? cz : w.minZ + pillarW * 0.5,
      );
      const p2 = p1.clone();
      p2.position.set(
        isAlongX ? w.maxX - pillarW * 0.5 : cx,
        w.minY + wainscotH + winH * 0.5,
        isAlongX ? cz : w.maxZ - pillarW * 0.5,
      );

      const glass = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(isAlongX ? glassSpan : 0.08, winH, isAlongX ? 0.08 : glassSpan)),
        windowGlassMat,
      );
      glass.position.set(cx, w.minY + wainscotH + winH * 0.5, cz);

      const centerMullion = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(isAlongX ? 0.1 : sx * 0.7, winH, isAlongX ? sz * 0.7 : 0.1)),
        mullionMat,
      );
      centerMullion.position.set(cx, w.minY + wainscotH + winH * 0.5, cz);

      fg.add(lower, upper, p1, p2, glass, centerMullion);
      const baseboard = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(sx + 0.03, 0.14, sz + 0.03)),
        mullionMat,
      );
      baseboard.position.set(cx, w.minY + 0.07, cz);
      fg.add(baseboard);
    } else if (w.kind === 'glass') {
      const glass = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(Math.max(0.06, sx * 0.5), sy - 0.25, Math.max(0.06, sz * 0.5))),
        partGlassMat,
      );
      glass.position.set(cx, cy, cz);
      const topRail = new THREE.Mesh(tGeo(new THREE.BoxGeometry(sx, 0.12, sz)), mullionMat);
      topRail.position.set(cx, w.maxY - 0.06, cz);
      const botRail = new THREE.Mesh(tGeo(new THREE.BoxGeometry(sx, 0.12, sz)), mullionMat);
      botRail.position.set(cx, w.minY + 0.06, cz);
      fg.add(glass, topRail, botRail);
    } else if (w.kind === 'railing') {
      const railMat = getWallMat(w.color);
      const topBar = new THREE.Mesh(tGeo(new THREE.BoxGeometry(sx, 0.08, sz)), railMat);
      topBar.position.set(cx, w.maxY - 0.04, cz);
      fg.add(topBar);
      const midGlass = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(Math.max(0.04, sx * 0.6), Math.max(0.2, sy - 0.18), Math.max(0.04, sz * 0.6))),
        partGlassMat,
      );
      midGlass.position.set(cx, cy - 0.02, cz);
      fg.add(midGlass);
    } else {
      const wallMat = getWallMat(w.color);
      const mesh = new THREE.Mesh(tGeo(new THREE.BoxGeometry(sx, sy, sz)), wallMat);
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = enableShadows;
      mesh.receiveShadow = enableShadows;
      fg.add(mesh);
      if (sy > 1.8) {
        const baseboard = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(sx + 0.03, 0.14, sz + 0.03)),
          mullionMat,
        );
        baseboard.position.set(cx, w.minY + 0.07, cz);
        fg.add(baseboard);
      }
    }
  }

  // 3. Walkable 3D Staircases + Switchback Mid-Landings
  const stepWoodMat = tMat(new THREE.MeshStandardMaterial({ color: 0x6f4c32, roughness: 0.72 }));
  const stepMetalMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.55 }),
  );
  const stairMat = blueprint.category === 'industrial' ? stepMetalMat : stepWoodMat;
  const landingMat = tMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 }));

  for (const st of blueprint.staircases) {
    const fg = floorGroups.get(st.fromFloor) ?? alwaysVisibleGroup;
    const steps = st.isSwitchback ? 9 : 14;
    const totalRise = st.yEnd - st.yStart;
    const stepH = totalRise / steps;
    const wX = st.maxX - st.minX;
    const wZ = st.maxZ - st.minZ;
    const span = st.axis === 'z' ? wZ : wX;
    const treadRun = span / steps;

    for (let i = 0; i < steps; i++) {
      const frac = (i + 0.5) / steps;
      const treadY = st.yStart + (i + 1) * stepH - stepH * 0.5;
      let tx = (st.minX + st.maxX) * 0.5;
      let tz = (st.minZ + st.maxZ) * 0.5;
      if (st.axis === 'z') {
        tz = st.direction === 1 ? st.minZ + frac * wZ : st.maxZ - frac * wZ;
      } else {
        tx = st.direction === 1 ? st.minX + frac * wX : st.maxX - frac * wX;
      }
      const tread = new THREE.Mesh(
        tGeo(
          new THREE.BoxGeometry(
            st.axis === 'z' ? wX : treadRun + 0.04,
            stepH + 0.04,
            st.axis === 'z' ? treadRun + 0.04 : wZ,
          ),
        ),
        stairMat,
      );
      tread.position.set(tx, treadY, tz);
      tread.castShadow = enableShadows;
      tread.receiveShadow = enableShadows;
      fg.add(tread);
    }

    if (st.midLanding) {
      const ml = st.midLanding;
      const mlMesh = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(ml.maxX - ml.minX, 0.16, ml.maxZ - ml.minZ)),
        landingMat,
      );
      mlMesh.position.set(
        (ml.minX + ml.maxX) * 0.5,
        ml.y - 0.08,
        (ml.minZ + ml.maxZ) * 0.5,
      );
      mlMesh.receiveShadow = enableShadows;
      fg.add(mlMesh);
    }
  }

  // 4. Real Animated 3D Elevator Cabins & Sliding Hoistway Doors
  const elevFrameMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.7 }),
  );
  const elevDoorMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.22, metalness: 0.82 }),
  );
  const cabinWallMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.55 }),
  );
  const cabinFloorMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0x3b596e, roughness: 0.78 }),
  );
  const cabinPanelMat = tMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    }),
  );

  const builtElevators: BuiltElevatorVisual[] = [];

  for (const el of blueprint.elevators) {
    // 4A. Moving 3D Elevator Cabin inside alwaysVisibleGroup
    const cabinGroup = new THREE.Group();
    cabinGroup.position.set(el.x, el.floors[0]?.y ?? 0, el.z);

    const cabW = el.width - 0.24;
    const cabD = el.depth - 0.24;
    const cabH = 2.65;

    const cabFloor = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(cabW, 0.12, cabD)),
      cabinFloorMat,
    );
    cabFloor.position.y = 0.04;
    const cabCeiling = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(cabW, 0.1, cabD)),
      cabinWallMat,
    );
    cabCeiling.position.y = cabH;
    const cabCeilingLight = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(cabW * 0.65, 0.04, cabD * 0.55)),
      ceilPanelMat,
    );
    cabCeilingLight.position.y = cabH - 0.06;

    const backWall = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(cabW, cabH, 0.08)),
      cabinWallMat,
    );
    backWall.position.set(0, cabH * 0.5, -cabD * 0.5 + 0.04);
    const leftWall = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(0.08, cabH, cabD)),
      cabinWallMat,
    );
    leftWall.position.set(-cabW * 0.5 + 0.04, cabH * 0.5, 0);
    const rightWall = leftWall.clone();
    rightWall.position.x = cabW * 0.5 - 0.04;

    // Glowing floor selector console inside cabin
    const insidePanel = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(0.06, 0.55, 0.28)),
      cabinPanelMat,
    );
    insidePanel.position.set(cabW * 0.5 - 0.09, 1.25, cabD * 0.22);

    // Dual sliding cabin doors on South edge
    const leafW = (cabW - 0.16) * 0.5;
    const cabClosedOffset = leafW * 0.5;
    const cabinLeftDoor = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(leafW, 2.32, 0.05)),
      elevDoorMat,
    );
    cabinLeftDoor.position.set(-cabClosedOffset, 1.18, cabD * 0.5 - 0.04);
    const cabinRightDoor = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(leafW, 2.32, 0.05)),
      elevDoorMat,
    );
    cabinRightDoor.position.set(cabClosedOffset, 1.18, cabD * 0.5 - 0.04);

    cabinGroup.add(
      cabFloor,
      cabCeiling,
      cabCeilingLight,
      backWall,
      leftWall,
      rightWall,
      insidePanel,
      cabinLeftDoor,
      cabinRightDoor,
    );
    alwaysVisibleGroup.add(cabinGroup);

    // 4B. Per-floor Hoistway Framing, Sliding Landing Doors, and Call Buttons
    const hoistwayDoors: BuiltElevatorDoors[] = [];
    const landingLeafW = (el.width - 0.28) * 0.5;
    const doorClosedOffset = landingLeafW * 0.5;

    for (const fl of el.floors) {
      const fg = floorGroups.get(fl.floorNumber) ?? alwaysVisibleGroup;
      const eg = new THREE.Group();
      eg.position.set(el.x, fl.y, el.z);

      const postGeo = tGeo(new THREE.BoxGeometry(0.18, 2.65, 0.22));
      const postL = new THREE.Mesh(postGeo, elevFrameMat);
      postL.position.set(-el.width * 0.5 + 0.09, 1.32, el.depth * 0.5);
      const postR = new THREE.Mesh(postGeo, elevFrameMat);
      postR.position.set(el.width * 0.5 - 0.09, 1.32, el.depth * 0.5);
      const lintel = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(el.width + 0.16, 0.34, 0.24)),
        elevFrameMat,
      );
      lintel.position.set(0, 2.52, el.depth * 0.5);

      const leftDoor = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(landingLeafW, 2.35, 0.06)),
        elevDoorMat,
      );
      leftDoor.position.set(-doorClosedOffset, 1.18, el.depth * 0.5);
      const rightDoor = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(landingLeafW, 2.35, 0.06)),
        elevDoorMat,
      );
      rightDoor.position.set(doorClosedOffset, 1.18, el.depth * 0.5);

      const ledMat = tMat(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.9,
        }),
      );
      const indicator = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.55, 0.16, 0.08)), ledMat);
      indicator.position.set(0, 2.54, el.depth * 0.5 + 0.1);

      const callPadMat = tMat(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.85,
        }),
      );
      const callPad = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.14, 0.28, 0.06)), callPadMat);
      callPad.position.set(el.width * 0.5 + 0.08, 1.25, el.depth * 0.5 + 0.08);

      eg.add(postL, postR, lintel, leftDoor, rightDoor, indicator, callPad);
      fg.add(eg);

      hoistwayDoors.push({
        floorNumber: fl.floorNumber,
        leftDoor,
        rightDoor,
        doorClosedOffset,
        callPadMat,
        ledMat,
      });
    }

    builtElevators.push({
      elevatorId: el.id,
      cabinGroup,
      cabinLeftDoor,
      cabinRightDoor,
      cabinDoorOffset: cabClosedOffset,
      hoistwayDoors,
    });
  }

  // 5. Interior & Exit Doors (Hinged rotating leaves)
  const brassMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25 }),
  );
  for (const d of blueprint.doors) {
    const fg = d.isExitDoor ? alwaysVisibleGroup : getFloorGroupForY(d.y);
    const pivot = new THREE.Group();
    pivot.position.set(d.hingeX, d.y, d.hingeZ);
    pivot.rotation.y = d.closedYaw;

    const leafMat =
      d.style === 'glass'
        ? tMat(
            new THREE.MeshStandardMaterial({
              color: d.color,
              roughness: 0.15,
              metalness: 0.35,
              transparent: true,
              opacity: 0.72,
            }),
          )
        : tMat(
            new THREE.MeshStandardMaterial({
              color: d.color,
              roughness: d.style === 'metal' ? 0.45 : 0.65,
              metalness: d.style === 'metal' ? 0.55 : 0.05,
            }),
          );

    const leaf = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(d.width, d.height, d.thickness)),
      leafMat,
    );
    leaf.position.set(d.width * 0.5, d.height * 0.5, 0);
    leaf.castShadow = enableShadows;
    pivot.add(leaf);

    const handle = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(0.14, 0.06, d.thickness + 0.06)),
      brassMat,
    );
    handle.position.set(d.width - 0.18, 1.04, 0);
    pivot.add(handle);

    if (d.isExitDoor) {
      const exitSign = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(0.55, 0.16, 0.08)),
        tMat(
          new THREE.MeshStandardMaterial({
            color: 0x22c55e,
            emissive: 0x22c55e,
            emissiveIntensity: 1.15,
          }),
        ),
      );
      exitSign.position.set(
        d.hingeX + Math.cos(d.closedYaw) * d.width * 0.5,
        d.y + d.height + 0.22,
        d.hingeZ - Math.sin(d.closedYaw) * d.width * 0.5 - 0.08,
      );
      fg.add(exitSign);
    } else if (d.rooftopTarget) {
      const roofSign = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(0.75, 0.18, 0.08)),
        tMat(
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 1.25,
          }),
        ),
      );
      roofSign.position.set(
        d.hingeX + Math.cos(d.closedYaw) * d.width * 0.5,
        d.y + d.height + 0.22,
        d.hingeZ - Math.sin(d.closedYaw) * d.width * 0.5 + 0.08,
      );
      fg.add(roofSign);
    }

    fg.add(pivot);
    doorPivots.set(d.id, pivot);
  }

  // 6. Composite 3D Furniture & Props (grouped per floor)
  const furMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const getFurMat = (color: number, roughness = 0.72, metalness = 0.05) => {
    const key = `${color}_${roughness}_${metalness}`;
    let m = furMatCache.get(key);
    if (!m) {
      m = tMat(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
      furMatCache.set(key, m);
    }
    return m;
  };
  const darkMat = getFurMat(0x1e293b, 0.45, 0.4);
  const screenMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x38bdf8, emissiveIntensity: 0.35 }),
  );

  const buildFurniture = (p: InteriorFurnitureProp) => {
    const fgHost = getFloorGroupForY(p.y);
    const fg = new THREE.Group();
    fg.position.set(p.x, p.y, p.z);
    fg.rotation.y = p.rotY;

    const priMat = getFurMat(p.primaryColor, 0.72, 0.05);
    const accMat = getFurMat(p.accentColor ?? 0xd6d3d1, 0.55, 0.05);

    switch (p.kind) {
      case 'sofa': {
        const base = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.38, p.depth)), priMat);
        base.position.y = 0.22;
        const back = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.52, 0.22)), priMat);
        back.position.set(0, 0.62, -p.depth * 0.38);
        const armL = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.18, 0.48, p.depth)), priMat);
        armL.position.set(-p.width * 0.5 + 0.09, 0.42, 0);
        const armR = armL.clone();
        armR.position.x = p.width * 0.5 - 0.09;
        fg.add(base, back, armL, armR);
        break;
      }
      case 'bed': {
        const frame = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.3, p.depth)), darkMat);
        frame.position.y = 0.2;
        const mattress = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(p.width - 0.14, 0.24, p.depth - 0.14)),
          accMat,
        );
        mattress.position.y = 0.46;
        const blanket = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(p.width - 0.1, 0.26, p.depth * 0.62)),
          priMat,
        );
        blanket.position.set(0, 0.47, p.depth * 0.16);
        const head = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.95, 0.14)), darkMat);
        head.position.set(0, 0.55, -p.depth * 0.46);
        fg.add(frame, mattress, blanket, head);
        break;
      }
      case 'coffee_table':
      case 'dining_table':
      case 'conference_table': {
        const top = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.08, p.depth)), priMat);
        top.position.y = p.height - 0.04;
        top.castShadow = enableShadows;
        fg.add(top);
        const legGeo = tGeo(new THREE.BoxGeometry(0.08, p.height - 0.08, 0.08));
        for (const lx of [-p.width * 0.42, p.width * 0.42]) {
          for (const lz of [-p.depth * 0.4, p.depth * 0.4]) {
            const leg = new THREE.Mesh(legGeo, darkMat);
            leg.position.set(lx, (p.height - 0.08) * 0.5, lz);
            fg.add(leg);
          }
        }
        if (p.kind !== 'coffee_table') {
          const chairGeo = tGeo(new THREE.BoxGeometry(0.42, 0.45, 0.42));
          for (const cz of [-p.depth * 0.55, p.depth * 0.55]) {
            for (const cx of [-p.width * 0.25, p.width * 0.25]) {
              const ch = new THREE.Mesh(chairGeo, accMat);
              ch.position.set(cx, 0.23, cz);
              fg.add(ch);
            }
          }
        }
        break;
      }
      case 'desk':
      case 'reception_desk':
      case 'checkout_counter':
      case 'espresso_bar': {
        const body = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(p.width, p.height - 0.08, p.depth)),
          priMat,
        );
        body.position.y = (p.height - 0.08) * 0.5;
        body.castShadow = enableShadows;
        const top = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(p.width + 0.08, 0.08, p.depth + 0.08)),
          accMat,
        );
        top.position.y = p.height - 0.04;
        fg.add(body, top);
        const mon = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.55, 0.36, 0.06)), screenMat);
        mon.position.set(0, p.height + 0.22, -p.depth * 0.1);
        fg.add(mon);
        break;
      }
      case 'kitchen_counter': {
        const cab = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, p.height - 0.08, p.depth)), priMat);
        cab.position.y = (p.height - 0.08) * 0.5;
        const top = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.08, p.depth + 0.04)), accMat);
        top.position.y = p.height - 0.04;
        const hood = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width * 0.4, 0.45, p.depth * 0.8)), darkMat);
        hood.position.set(-p.width * 0.22, p.height + 1.05, 0);
        fg.add(cab, top, hood);
        break;
      }
      case 'shelf_rack': {
        const uprightGeo = tGeo(new THREE.BoxGeometry(0.08, p.height, 0.08));
        for (const lx of [-p.width * 0.45, p.width * 0.45]) {
          for (const lz of [-p.depth * 0.46, p.depth * 0.46]) {
            const up = new THREE.Mesh(uprightGeo, priMat);
            up.position.set(lx, p.height * 0.5, lz);
            fg.add(up);
          }
        }
        for (let lv = 1; lv <= 3; lv++) {
          const sy = lv * (p.height * 0.28);
          const plank = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.06, p.depth)), priMat);
          plank.position.y = sy;
          const items = new THREE.Mesh(
            tGeo(new THREE.BoxGeometry(p.width * 0.72, 0.22, p.depth * 0.85)),
            lv % 2 === 0 ? accMat : getFurMat(0xf59e0b, 0.6),
          );
          items.position.y = sy + 0.14;
          fg.add(plank, items);
        }
        break;
      }
      case 'cooler': {
        const box = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, p.height, p.depth)), priMat);
        box.position.y = p.height * 0.5;
        const front = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(p.width - 0.22, p.height - 0.35, 0.08)),
          tMat(new THREE.MeshStandardMaterial({ color: p.accentColor ?? 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 0.45, roughness: 0.15 })),
        );
        front.position.set(0, p.height * 0.52, p.depth * 0.5);
        fg.add(box, front);
        break;
      }
      case 'tv_stand': {
        const cab = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.48, p.depth)), priMat);
        cab.position.y = 0.24;
        const tv = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width * 0.85, 0.78, 0.08)), screenMat);
        tv.position.set(0, 0.94, 0);
        fg.add(cab, tv);
        break;
      }
      case 'plant': {
        const pot = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.24, 0.18, 0.42, 10)), accMat);
        pot.position.y = 0.21;
        const foliage = new THREE.Mesh(tGeo(new THREE.DodecahedronGeometry(0.42, 1)), priMat);
        foliage.position.y = 0.85;
        fg.add(pot, foliage);
        break;
      }
      case 'mailbox_bank': {
        const bank = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, p.height, p.depth)), priMat);
        bank.position.y = p.height * 0.5;
        fg.add(bank);
        break;
      }
      case 'kiosk': {
        const counter = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 1.05, p.depth)), priMat);
        counter.position.y = 0.525;
        const canopy = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width + 0.3, 0.18, p.depth + 0.3)), accMat);
        canopy.position.y = p.height;
        const postGeo = tGeo(new THREE.CylinderGeometry(0.06, 0.06, p.height, 8));
        for (const px of [-p.width * 0.44, p.width * 0.44]) {
          for (const pz of [-p.depth * 0.44, p.depth * 0.44]) {
            const post = new THREE.Mesh(postGeo, darkMat);
            post.position.set(px, p.height * 0.5, pz);
            fg.add(post);
          }
        }
        fg.add(counter, canopy);
        break;
      }
      case 'car_lift': {
        const postGeo = tGeo(new THREE.BoxGeometry(0.24, p.height, 0.24));
        for (const px of [-p.width * 0.45, p.width * 0.45]) {
          const post = new THREE.Mesh(postGeo, priMat);
          post.position.set(px, p.height * 0.5, 0);
          fg.add(post);
        }
        const beam = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.2, 0.28)), priMat);
        beam.position.y = p.height;
        const ramp = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width * 0.72, 0.14, p.depth)), accMat);
        ramp.position.y = 0.24;
        fg.add(beam, ramp);
        break;
      }
      case 'machinery':
      case 'workbench': {
        const base = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, p.height * 0.68, p.depth)), priMat);
        base.position.y = p.height * 0.34;
        const top = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width * 0.85, p.height * 0.32, p.depth * 0.85)), accMat);
        top.position.y = p.height * 0.84;
        fg.add(base, top);
        break;
      }
      case 'clothing_rack': {
        const railY = p.height - 0.14;
        const base = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.12, p.depth)), darkMat);
        base.position.y = 0.06;
        const postGeo = tGeo(new THREE.CylinderGeometry(0.035, 0.035, p.height, 8));
        for (const px of [-p.width * 0.44, p.width * 0.44]) {
          const post = new THREE.Mesh(postGeo, accMat);
          post.position.set(px, p.height * 0.5, 0);
          fg.add(post);
        }
        const bar = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.03, 0.03, p.width * 0.92, 8)), accMat);
        bar.rotation.z = Math.PI * 0.5;
        bar.position.y = railY;
        fg.add(base, bar);
        const garmentColors = [p.primaryColor, 0x38bdf8, 0xf59e0b, 0x10b981, 0xf43f5e];
        for (let g = 0; g < 5; g++) {
          const gx = -p.width * 0.32 + g * (p.width * 0.16);
          const gar = new THREE.Mesh(
            tGeo(new THREE.BoxGeometry(0.14, 0.72, 0.42)),
            getFurMat(garmentColors[g % garmentColors.length], 0.68),
          );
          gar.position.set(gx, railY - 0.42, 0);
          fg.add(gar);
        }
        break;
      }
      case 'display_case': {
        const ped = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, p.height * 0.48, p.depth)), priMat);
        ped.position.y = p.height * 0.24;
        const glassVitrine = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(p.width * 0.92, p.height * 0.46, p.depth * 0.86)),
          tMat(new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.25 })),
        );
        glassVitrine.position.y = p.height * 0.71;
        const relic = new THREE.Mesh(
          tGeo(new THREE.OctahedronGeometry(0.24, 0)),
          tMat(new THREE.MeshStandardMaterial({ color: p.accentColor ?? 0xfbbf24, emissive: p.accentColor ?? 0xfbbf24, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.6 })),
        );
        relic.position.set(-p.width * 0.22, p.height * 0.68, 0);
        const relic2 = new THREE.Mesh(
          tGeo(new THREE.TorusGeometry(0.18, 0.055, 8, 16)),
          accMat,
        );
        relic2.position.set(p.width * 0.22, p.height * 0.68, 0);
        fg.add(ped, glassVitrine, relic, relic2);
        break;
      }
      case 'mannequin_stand': {
        const podium = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(p.width * 0.46, p.width * 0.52, 0.34, 16)), darkMat);
        podium.position.y = 0.17;
        const rim = new THREE.Mesh(tGeo(new THREE.TorusGeometry(p.width * 0.46, 0.035, 8, 20)), accMat);
        rim.rotation.x = Math.PI * 0.5;
        rim.position.y = 0.34;
        const torso = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.46, 0.62, 0.24)), priMat);
        torso.position.y = 1.24;
        const legs = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.36, 0.62, 0.2)), darkMat);
        legs.position.y = 0.65;
        const head = new THREE.Mesh(tGeo(new THREE.SphereGeometry(0.18, 10, 8)), accMat);
        head.position.y = 1.72;
        fg.add(podium, rim, torso, legs, head);
        break;
      }
      case 'reward_kiosk':
      case 'boarding_desk': {
        const desk = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width, 0.96, p.depth)), priMat);
        desk.position.y = 0.48;
        const trim = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width + 0.08, 0.1, p.depth + 0.08)), accMat);
        trim.position.y = 0.96;
        const screenColor = p.kind === 'boarding_desk' ? 0x0284c7 : 0x0ea5e9;
        const screenEmissive = p.kind === 'boarding_desk' ? 0x38bdf8 : 0x38bdf8;
        const screen = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(p.width * 0.72, 1.05, 0.14)),
          tMat(new THREE.MeshStandardMaterial({ color: screenColor, emissive: screenEmissive, emissiveIntensity: 0.78, roughness: 0.18 })),
        );
        screen.position.set(0, 1.68, -p.depth * 0.18);
        const halo = new THREE.Mesh(tGeo(new THREE.BoxGeometry(p.width * 0.76, 0.14, 0.24)), accMat);
        halo.position.set(0, 2.26, -p.depth * 0.18);
        fg.add(desk, trim, screen, halo);
        break;
      }
    }

    fgHost.add(fg);
  };

  blueprint.furniture.forEach(buildFurniture);

  const syncVisibleFloorWindow = (currentFloor: number) => {
    const showAll = blueprint.floorsCount <= 3;
    for (const [f, fg] of floorGroups.entries()) {
      fg.visible = showAll || Math.abs(f - currentFloor) <= 1;
    }

    // Reassign pooled PointLights around currentFloor (always <= 4 active shader lights)
    const nearbySpecs: InteriorLightSpec[] = [];
    const candidateFloors = [currentFloor, currentFloor - 1, currentFloor + 1];
    for (const cf of candidateFloors) {
      const list = lightsByFloor.get(cf);
      if (list) {
        for (const spec of list) {
          nearbySpecs.push(spec);
          if (nearbySpecs.length >= MAX_POOLED_LIGHTS) break;
        }
      }
      if (nearbySpecs.length >= MAX_POOLED_LIGHTS) break;
    }

    for (let i = 0; i < MAX_POOLED_LIGHTS; i++) {
      const pt = lightPool[i];
      const spec = nearbySpecs[i];
      if (spec) {
        pt.position.set(spec.x, spec.y, spec.z);
        pt.color.setHex(spec.color);
        pt.intensity = spec.intensity;
        pt.distance = spec.distance;
      } else {
        pt.intensity = 0;
      }
    }
  };

  const syncElevator = (elevState: ElevatorRuntimeState | null) => {
    if (!elevState) return;
    for (const vis of builtElevators) {
      if (vis.elevatorId !== elevState.elevatorId) continue;
      vis.cabinGroup.position.y = elevState.currentY;
      const slide = elevState.doorProgress * (vis.cabinDoorOffset * 1.9);
      vis.cabinLeftDoor.position.x = -vis.cabinDoorOffset - slide;
      vis.cabinRightDoor.position.x = vis.cabinDoorOffset + slide;

      for (const hd of vis.hoistwayDoors) {
        const isAtThisFloor =
          hd.floorNumber === elevState.currentFloor && !elevState.moving;
        const hSlide = isAtThisFloor
          ? elevState.doorProgress * (hd.doorClosedOffset * 1.9)
          : 0;
        hd.leftDoor.position.x = -hd.doorClosedOffset - hSlide;
        hd.rightDoor.position.x = hd.doorClosedOffset + hSlide;

        const isTarget =
          hd.floorNumber === elevState.targetFloor && elevState.moving;
        if (isAtThisFloor && elevState.doorProgress > 0.3) {
          hd.callPadMat.color.setHex(0x10b981);
          hd.callPadMat.emissive.setHex(0x10b981);
          hd.ledMat.emissive.setHex(0x10b981);
        } else if (isTarget) {
          hd.callPadMat.color.setHex(0xf59e0b);
          hd.callPadMat.emissive.setHex(0xf59e0b);
          hd.ledMat.emissive.setHex(0xf59e0b);
        } else {
          hd.callPadMat.color.setHex(0x38bdf8);
          hd.callPadMat.emissive.setHex(0x38bdf8);
          hd.ledMat.emissive.setHex(0x38bdf8);
        }
      }
    }
  };

  syncVisibleFloorWindow(1);

  return {
    group,
    doorPivots,
    floorGroups,
    syncVisibleFloorWindow,
    syncDoors: (doors: InteriorDoorState[]) => {
      for (let i = 0; i < doors.length; i++) {
        const d = doors[i];
        const pivot = doorPivots.get(d.id);
        if (pivot) {
          pivot.rotation.y = d.closedYaw + d.openAngle * d.openProgress;
        }
      }
    },
    syncElevator,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
