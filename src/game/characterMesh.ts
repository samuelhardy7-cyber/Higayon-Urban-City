import * as THREE from 'three';
import type { ArticulatedPose, FaceMood } from './characterAnimator';
import { normalizeCharacterCustomization } from './rewardShopCatalog';
import type { CharacterCustomization, FaceStyleId, NpcState, PlayerState } from './types';

export interface CharacterMaterialMaps {
  fabricBumpMap?: THREE.Texture;
  leatherBumpMap?: THREE.Texture;
}

export interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  hipsGroup: THREE.Group;
  torso: THREE.Group;
  chestPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  leftWristPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  rightWristPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  leftAnklePivot: THREE.Group;
  rightLegPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  rightAnklePivot: THREE.Group;
  contactShadow: THREE.Mesh;
  jacketMat: THREE.MeshStandardMaterial;
  shirtMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  shoeMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  backpackGroup: THREE.Group;
  capGroup: THREE.Group;
  shadesMesh: THREE.Mesh;
  tieMesh: THREE.Mesh;
  hoodiePocketMesh: THREE.Mesh;
  innerTeeMesh: THREE.Mesh;
  upperArmMeshes: THREE.Mesh[];
  chestMesh: THREE.Mesh;
  pelvisMesh: THREE.Mesh;
  hairGroups: Record<'short_crop' | 'curly' | 'long_wave' | 'ponytail' | 'fade' | 'bob', THREE.Group>;
  hatGroups: Record<'cap' | 'beanie' | 'fedora' | 'grad_cap', THREE.Group>;
  glassesGroups: Record<'shades' | 'round_frames' | 'visor', THREE.Group>;
  watchGroups: Record<'sport_watch' | 'gold_watch' | 'smart_band', THREE.Group>;
  packGroups: Record<'backpack' | 'tech_pack' | 'mini_satchel', THREE.Group>;
  neckGroups: Record<'scarf' | 'medal_lanyard' | 'headphones', THREE.Group>;
  vestAccentGroup: THREE.Group;
  cyberStripeGroup: THREE.Group;
  coatTailMesh: THREE.Mesh;
  coatTailPivot: THREE.Group;
  scarfTailPivot: THREE.Group;
  ponytailPivot: THREE.Group;
  longWavePivot: THREE.Group;
  bobPivot: THREE.Group;
  eyelidL: THREE.Mesh;
  eyelidR: THREE.Mesh;
  browL: THREE.Mesh;
  browR: THREE.Mesh;
  cargoPocketMeshes: THREE.Mesh[];
  updateFaceStyle: (face: FaceStyleId, skinColor: number, mood?: FaceMood) => void;
  baseScale: { x: number; y: number; z: number };
  dispose: () => void;
}

export interface PlayerNameplateRig {
  sprite: THREE.Sprite;
  update: (displayName: string, isOnline: boolean, activityTag?: string | null) => void;
  dispose: () => void;
}

const NPC_PALETTES = [
  { jacket: 0x355f8c, pants: 0x242c38, skin: 0xdca784, hair: 0x261d18, hat: 'none' as const },
  { jacket: 0x397a5e, pants: 0x3b3530, skin: 0xc88d68, hair: 0x1c1816, hat: 'cap' as const },
  { jacket: 0xd98a24, pants: 0x2a3442, skin: 0xe3b695, hair: 0x3d2a1e, hat: 'hardhat' as const },
  { jacket: 0x7b456e, pants: 0x212936, skin: 0x9c6548, hair: 0x171413, hat: 'none' as const },
  { jacket: 0x4ca3b0, pants: 0xc9bfa8, skin: 0xdeb08c, hair: 0x4f3524, hat: 'cap' as const },
  { jacket: 0x9c3e33, pants: 0x2d323b, skin: 0xb87e5b, hair: 0x211b18, hat: 'none' as const },
];

function createLatheProfile(
  samples: Array<[number, number]>,
  segments = 18,
): THREE.LatheGeometry {
  const pts = samples.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, segments);
}

function createShoeSoleGeometry(): THREE.ExtrudeGeometry {
  // Anatomical sneaker sole silhouette pointing toward -Z in XZ after rotateX
  const shape = new THREE.Shape();
  shape.moveTo(-0.042, 0.068);
  shape.quadraticCurveTo(0, 0.088, 0.042, 0.068);
  shape.quadraticCurveTo(0.052, 0.01, 0.055, -0.072);
  shape.quadraticCurveTo(0.052, -0.148, 0.0, -0.156);
  shape.quadraticCurveTo(-0.052, -0.148, -0.055, -0.072);
  shape.quadraticCurveTo(-0.052, 0.01, -0.042, 0.068);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  geo.rotateX(Math.PI * 0.5);
  return geo;
}

/**
 * Builds an anatomical ~7.7-head real-human 3D character rig pivoted at bottom-center (y = 0)
 * facing local -Z so rotation.y = playerYaw aligns directly with world forward.
 * Hierarchy: root -> bodyGroup -> hipsGroup -> torso -> chestPivot -> headGroup & arms.
 */
export function createCharacterRig(
  contactShadowMap: THREE.Texture,
  castShadows: boolean,
  maps?: CharacterMaterialMaps,
): CharacterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const jacketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc9542b,
      roughness: 0.64,
      metalness: 0.05,
      bumpMap: maps?.fabricBumpMap ?? null,
      bumpScale: maps?.fabricBumpMap ? 0.011 : 0,
    }),
  );
  const shirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0ede6,
      roughness: 0.82,
      metalness: 0.02,
      bumpMap: maps?.fabricBumpMap ?? null,
      bumpScale: maps?.fabricBumpMap ? 0.006 : 0,
    }),
  );
  const jeansMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x26384d,
      roughness: 0.86,
      metalness: 0.04,
      bumpMap: maps?.fabricBumpMap ?? null,
      bumpScale: maps?.fabricBumpMap ? 0.014 : 0,
    }),
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2b28b, roughness: 0.52, metalness: 0.02 }),
  );
  const lipMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xb9685d, roughness: 0.42, metalness: 0.04 }),
  );
  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e2028, roughness: 0.68, metalness: 0.08 }),
  );
  const shoeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f5f7,
      roughness: 0.36,
      metalness: 0.08,
      bumpMap: maps?.leatherBumpMap ?? null,
      bumpScale: maps?.leatherBumpMap ? 0.01 : 0,
    }),
  );
  const soleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72, metalness: 0.02 }),
  );
  const visorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.14, metalness: 0.78 }),
  );
  const packMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2d323b,
      roughness: 0.74,
      metalness: 0.1,
      bumpMap: maps?.fabricBumpMap ?? null,
      bumpScale: maps?.fabricBumpMap ? 0.01 : 0,
    }),
  );
  const buckleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd6b36a, roughness: 0.22, metalness: 0.9 }),
  );
  const cyberCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.35,
    }),
  );
  const goldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.88 }),
  );
  const scleraMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.18, metalness: 0.0 }),
  );
  const irisMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2c4b6e, roughness: 0.24, metalness: 0.08 }),
  );
  const pupilMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.12, metalness: 0.1 }),
  );
  const catchlightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const browMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x221b17, roughness: 0.78 }),
  );
  const beltLeatherMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x28211c, roughness: 0.46, metalness: 0.12 }),
  );

  const setShadow = (m: THREE.Mesh) => {
    m.castShadow = castShadows;
    m.receiveShadow = castShadows;
    return m;
  };

  // 1. Anatomical Pelvis / Hips Assembly (world y = 0.905 -> realistic ~51% leg-to-height ratio)
  const hipsGroup = new THREE.Group();
  hipsGroup.position.set(0, 0.905, 0);
  bodyGroup.add(hipsGroup);

  const pelvisMesh = setShadow(
    new THREE.Mesh(
      trackGeo(
        createLatheProfile([
          [0.055, -0.055],
          [0.132, -0.02],
          [0.145, 0.025],
          [0.138, 0.068],
          [0.126, 0.095],
        ]),
      ),
      jeansMat,
    ),
  );
  pelvisMesh.scale.set(1.08, 1.0, 0.68);
  hipsGroup.add(pelvisMesh);

  const beltBand = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.134, 0.141, 0.042, 20)),
    beltLeatherMat,
  );
  beltBand.scale.set(1.09, 1, 0.7);
  beltBand.position.set(0, 0.072, 0);
  hipsGroup.add(beltBand);

  const beltBuckle = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.056, 0.036, 0.02)),
    buckleMat,
  );
  beltBuckle.position.set(0, 0.072, -0.097);
  hipsGroup.add(beltBuckle);

  // 2. Lumbar Waist (torso, y = +0.06 above hips = 0.965 world) -> Thoracic Chest (chestPivot, y = +0.185 = 1.150 world)
  const torso = new THREE.Group();
  torso.position.set(0, 0.06, 0);
  hipsGroup.add(torso);

  const waistMesh = setShadow(
    new THREE.Mesh(
      trackGeo(
        createLatheProfile([
          [0.132, -0.015],
          [0.126, 0.06],
          [0.125, 0.12],
          [0.138, 0.195],
        ]),
      ),
      jacketMat,
    ),
  );
  waistMesh.scale.set(1.07, 1.0, 0.68);
  torso.add(waistMesh);

  const chestPivot = new THREE.Group();
  chestPivot.position.set(0, 0.185, 0);
  torso.add(chestPivot);

  // Anatomical V-taper ribcage -> pectorals -> trapezius/collarbone slope (zero Lego edges)
  const chestMesh = setShadow(
    new THREE.Mesh(
      trackGeo(
        createLatheProfile([
          [0.136, -0.02],
          [0.152, 0.07],
          [0.172, 0.18],
          [0.176, 0.255],
          [0.152, 0.305],
          [0.088, 0.338],
          [0.054, 0.352],
        ]),
      ),
      jacketMat,
    ),
  );
  chestMesh.scale.set(1.12, 1.0, 0.65);
  chestPivot.add(chestMesh);

  // Natural sloped clavicle / trapezius shoulder bridge
  const shoulderBridge = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.058, 0.27, 8, 14)), jacketMat),
  );
  shoulderBridge.rotation.z = Math.PI * 0.5;
  shoulderBridge.scale.set(0.86, 1.0, 0.94);
  shoulderBridge.position.set(0, 0.272, 0.005);
  chestPivot.add(shoulderBridge);

  const innerTee = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.068, 0.052, 0.34, 12)),
    shirtMat,
  );
  innerTee.scale.set(1.0, 1.0, 0.72);
  innerTee.position.set(0, 0.155, -0.076);
  chestPivot.add(innerTee);

  // Tailored jacket front lapels
  const lapelGeo = trackGeo(new THREE.BoxGeometry(0.036, 0.22, 0.018));
  const lapelL = new THREE.Mesh(lapelGeo, jacketMat);
  lapelL.position.set(-0.056, 0.2, -0.106);
  lapelL.rotation.z = -0.17;
  lapelL.rotation.y = 0.14;
  const lapelR = new THREE.Mesh(lapelGeo, jacketMat);
  lapelR.position.set(0.056, 0.2, -0.106);
  lapelR.rotation.z = 0.17;
  lapelR.rotation.y = -0.14;
  chestPivot.add(lapelL, lapelR);

  const tieMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.42, metalness: 0.18 }),
  );
  const tieMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.038, 0.26, 0.016)), tieMat);
  tieMesh.position.set(0, 0.15, -0.114);
  tieMesh.visible = false;
  chestPivot.add(tieMesh);

  const hoodiePocketMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.05, 0.15, 6, 10)),
    jacketMat,
  );
  hoodiePocketMesh.rotation.z = Math.PI * 0.5;
  hoodiePocketMesh.scale.set(0.8, 1.0, 0.48);
  hoodiePocketMesh.position.set(0, 0.07, -0.095);
  hoodiePocketMesh.visible = false;
  torso.add(hoodiePocketMesh);

  const collar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.078, 0.021, 8, 18)),
    jacketMat,
  );
  collar.rotation.x = Math.PI * 0.5;
  collar.position.set(0, 0.342, 0.002);
  chestPivot.add(collar);

  // Special Outfits extras
  const vestAccentGroup = new THREE.Group();
  const vestPocketL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.072, 0.09, 0.022)), buckleMat);
  vestPocketL.position.set(-0.09, 0.08, -0.105);
  const vestPocketR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.072, 0.09, 0.022)), buckleMat);
  vestPocketR.position.set(0.09, 0.08, -0.105);
  vestAccentGroup.add(vestPocketL, vestPocketR);
  vestAccentGroup.visible = false;
  chestPivot.add(vestAccentGroup);

  const cyberStripeGroup = new THREE.Group();
  const cStripeL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.31, 0.018)), cyberCyanMat);
  cStripeL.position.set(-0.11, 0.145, -0.106);
  const cStripeR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.31, 0.018)), cyberCyanMat);
  cStripeR.position.set(0.11, 0.145, -0.106);
  const cCollar = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.084, 0.018, 8, 18)), cyberCyanMat);
  cCollar.rotation.x = Math.PI * 0.5;
  cCollar.position.set(0, 0.348, 0.002);
  cyberStripeGroup.add(cStripeL, cStripeR, cCollar);
  cyberStripeGroup.visible = false;
  chestPivot.add(cyberStripeGroup);

  // Coat Tail Secondary Motion Pivot
  const coatTailPivot = new THREE.Group();
  coatTailPivot.position.set(0, 0.01, 0.025);
  const coatTailMesh = setShadow(
    new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.145, 0.172, 0.25, 16, 1, false, -0.8, Math.PI * 1.45)),
      jacketMat,
    ),
  );
  coatTailMesh.scale.set(1.08, 1, 0.72);
  coatTailMesh.position.set(0, -0.12, 0.015);
  coatTailMesh.rotation.y = Math.PI * 0.3;
  coatTailPivot.add(coatTailMesh);
  coatTailMesh.visible = false;
  torso.add(coatTailPivot);

  // Backpacks (+Z behind chestPivot)
  const backpackGroup = new THREE.Group();
  const backpack = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.088, 0.17, 8, 12)), packMat),
  );
  backpack.scale.set(0.98, 1.0, 0.5);
  backpack.position.set(0, 0.142, 0.122);
  const packTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.135, 0.024, 0.024)), buckleMat);
  packTrim.position.set(0, 0.195, 0.168);
  const strapL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.27, 0.018)), packMat);
  strapL.position.set(-0.09, 0.165, -0.09);
  const strapR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.27, 0.018)), packMat);
  strapR.position.set(0.09, 0.165, -0.09);
  backpackGroup.add(backpack, packTrim, strapL, strapR);
  chestPivot.add(backpackGroup);

  const techPackGroup = new THREE.Group();
  const techShell = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.092, 0.2, 8, 12)), visorMat),
  );
  techShell.scale.set(1.12, 1.0, 0.52);
  techShell.position.set(0, 0.155, 0.138);
  const techGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.026, 0.21, 0.026)), cyberCyanMat);
  techGlow.position.set(0, 0.155, 0.19);
  techPackGroup.add(techShell, techGlow);
  techPackGroup.visible = false;
  chestPivot.add(techPackGroup);

  const satchelGroup = new THREE.Group();
  const satchelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c4a28, roughness: 0.65 }));
  const satchelBox = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.165, 0.165, 0.07)), satchelMat),
  );
  satchelBox.position.set(0.11, 0.02, 0.125);
  const satchelStrap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.026, 0.38, 0.22)), satchelMat);
  satchelStrap.position.set(0, 0.15, 0);
  satchelStrap.rotation.z = 0.52;
  satchelGroup.add(satchelBox, satchelStrap);
  satchelGroup.visible = false;
  chestPivot.add(satchelGroup);

  // Neck Accessories mounted to chestPivot collar
  const scarfGroup = new THREE.Group();
  const scarfMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.85 }));
  const scarfRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.082, 0.028, 8, 16)), scarfMat);
  scarfRing.rotation.x = Math.PI * 0.5;
  scarfRing.position.set(0, 0.352, 0);
  const scarfTailPivot = new THREE.Group();
  scarfTailPivot.position.set(0.06, 0.335, -0.085);
  const scarfTail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.056, 0.18, 0.024)), scarfMat);
  scarfTail.position.set(0, -0.09, -0.015);
  scarfTailPivot.add(scarfTail);
  scarfGroup.add(scarfRing, scarfTailPivot);
  scarfGroup.visible = false;
  chestPivot.add(scarfGroup);

  const medalGroup = new THREE.Group();
  const ribbonMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 }));
  const ribbonL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.17, 0.018)), ribbonMat);
  ribbonL.position.set(-0.032, 0.245, -0.105);
  ribbonL.rotation.z = -0.19;
  const ribbonR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.17, 0.018)), ribbonMat);
  ribbonR.position.set(0.032, 0.245, -0.105);
  ribbonR.rotation.z = 0.19;
  const medalDisc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.034, 0.034, 0.014, 14)), goldMat);
  medalDisc.rotation.x = Math.PI * 0.5;
  medalDisc.position.set(0, 0.16, -0.114);
  medalGroup.add(ribbonL, ribbonR, medalDisc);
  medalGroup.visible = false;
  chestPivot.add(medalGroup);

  const headphonesGroup = new THREE.Group();
  const hpBand = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.098, 0.015, 8, 16, Math.PI)), visorMat);
  hpBand.rotation.x = Math.PI * 0.55;
  hpBand.position.set(0, 0.352, 0.015);
  const hpCupL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.034, 0.034, 0.028, 12)), cyberCyanMat);
  hpCupL.rotation.z = Math.PI * 0.5;
  hpCupL.position.set(-0.098, 0.345, -0.052);
  const hpCupR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.034, 0.034, 0.028, 12)), cyberCyanMat);
  hpCupR.rotation.z = Math.PI * 0.5;
  hpCupR.position.set(0.098, 0.345, -0.052);
  headphonesGroup.add(hpBand, hpCupL, hpCupR);
  headphonesGroup.visible = false;
  chestPivot.add(headphonesGroup);

  // 3. Anatomical Human Neck & Head Group (world neck base = 1.495, top of head ~ 1.76m -> 7.7:1 ratio)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.345, 0);
  chestPivot.add(headGroup);

  const neck = setShadow(
    new THREE.Mesh(
      trackGeo(
        createLatheProfile([
          [0.056, 0.0],
          [0.047, 0.04],
          [0.046, 0.075],
          [0.052, 0.105],
        ]),
      ),
      skinMat,
    ),
  );
  headGroup.add(neck);

  // Sculpted Anatomical Skull + Zygomatic Cheekbones + Jawline + Chin
  const cranium = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.098, 22, 18)), skinMat),
  );
  cranium.scale.set(0.88, 1.06, 0.99);
  cranium.position.set(0, 0.172, 0.008);
  headGroup.add(cranium);

  const cheekBlushMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd98f7c, roughness: 0.56, metalness: 0.01 }),
  );
  const cheekGeo = trackGeo(new THREE.SphereGeometry(0.032, 12, 10));
  const cheekL = new THREE.Mesh(cheekGeo, cheekBlushMat);
  cheekL.scale.set(0.95, 0.72, 0.78);
  cheekL.position.set(-0.045, 0.142, -0.068);
  const cheekR = new THREE.Mesh(cheekGeo, cheekBlushMat);
  cheekR.scale.set(0.95, 0.72, 0.78);
  cheekR.position.set(0.045, 0.142, -0.068);
  headGroup.add(cheekL, cheekR);

  const jaw = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.076, 16, 14)), skinMat),
  );
  jaw.scale.set(0.86, 0.92, 0.9);
  jaw.position.set(0, 0.122, -0.015);
  headGroup.add(jaw);

  const chin = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 10, 10)), skinMat);
  chin.scale.set(1.05, 0.78, 0.95);
  chin.position.set(0, 0.084, -0.056);
  headGroup.add(chin);

  // Natural Sculpted Ears
  const earGeo = trackGeo(new THREE.SphereGeometry(0.024, 10, 10));
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.scale.set(0.42, 1.08, 0.72);
  earL.position.set(-0.086, 0.156, 0.008);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.scale.set(0.42, 1.08, 0.72);
  earR.position.set(0.086, 0.156, 0.008);
  headGroup.add(earL, earR);

  // Sculpted Nose Bridge, Tip & Alar Nostrils
  const noseBridge = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.009, 0.028, 4, 8)),
    skinMat,
  );
  noseBridge.position.set(0, 0.16, -0.09);
  noseBridge.rotation.x = 0.24;
  const noseTip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0135, 10, 10)), skinMat);
  noseTip.scale.set(0.95, 0.82, 1.15);
  noseTip.position.set(0, 0.144, -0.097);
  const alarGeo = trackGeo(new THREE.SphereGeometry(0.0075, 8, 8));
  const alarL = new THREE.Mesh(alarGeo, skinMat);
  alarL.position.set(-0.009, 0.141, -0.091);
  const alarR = new THREE.Mesh(alarGeo, skinMat);
  alarR.position.set(0.009, 0.141, -0.091);
  headGroup.add(noseBridge, noseTip, alarL, alarR);

  // Sculpted Expressive 3D Mouth Assembly (Cupid's-bow upper lip, full lower lip, dimples, grin teeth)
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, 0.111, -0.084);
  headGroup.add(mouthGroup);

  const upperLipL = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.0052, 0.014, 4, 8)), lipMat);
  upperLipL.rotation.z = Math.PI * 0.5 + 0.12;
  upperLipL.position.set(-0.009, 0.004, -0.002);
  const upperLipR = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.0052, 0.014, 4, 8)), lipMat);
  upperLipR.rotation.z = Math.PI * 0.5 - 0.12;
  upperLipR.position.set(0.009, 0.004, -0.002);
  const lowerLip = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.0062, 0.022, 4, 8)), lipMat);
  lowerLip.rotation.z = Math.PI * 0.5;
  lowerLip.position.set(0, -0.0045, -0.001);

  const teethMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.02 }),
  );
  const teethMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.0045, 0.02, 4, 8)),
    teethMat,
  );
  teethMesh.rotation.z = Math.PI * 0.5;
  teethMesh.position.set(0, 0.0, -0.001);
  teethMesh.visible = false;

  const mouthCornerGeo = trackGeo(new THREE.SphereGeometry(0.0038, 6, 6));
  const cornerL = new THREE.Mesh(mouthCornerGeo, lipMat);
  cornerL.position.set(-0.021, 0.001, 0.002);
  const cornerR = new THREE.Mesh(mouthCornerGeo, lipMat);
  cornerR.position.set(0.021, 0.001, 0.002);

  mouthGroup.add(upperLipL, upperLipR, lowerLip, teethMesh, cornerL, cornerR);

  // Proportional Realistic Almond Eyes (orbital brow ridge + lash rim + sclera + iris + pupil + catchlight + eyelid)
  const buildEye = (side: -1 | 1) => {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(side * 0.032, 0.172, -0.081);
    eyePivot.rotation.y = side * -0.1;

    const sclera = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0155, 12, 10)), scleraMat);
    sclera.scale.set(1.12, 0.86, 0.72);
    eyePivot.add(sclera);

    const iris = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0098, 10, 10)), irisMat);
    iris.scale.set(1.0, 1.0, 0.45);
    iris.position.set(0, 0, -0.0085);
    eyePivot.add(iris);

    const pupil = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0055, 8, 8)), pupilMat);
    pupil.scale.set(1.0, 1.0, 0.45);
    pupil.position.set(0, 0, -0.0112);
    eyePivot.add(pupil);

    const catchlight = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0024, 6, 6)),
      catchlightMat,
    );
    catchlight.position.set(side * 0.003, 0.0035, -0.0128);
    eyePivot.add(catchlight);

    const lashRim = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.0024, 0.022, 4, 6)),
      browMat,
    );
    lashRim.rotation.z = Math.PI * 0.5;
    lashRim.position.set(0, 0.011, -0.0085);
    eyePivot.add(lashRim);

    const eyelid = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0168, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      skinMat,
    );
    eyelid.scale.set(1.14, 0.92, 0.8);
    eyelid.rotation.x = -0.35;
    eyePivot.add(eyelid);

    headGroup.add(eyePivot);
    return eyelid;
  };
  const eyelidL = buildEye(-1);
  const eyelidR = buildEye(1);

  // Proportional Sculpted Eyebrows + Supraorbital Brow Ridge
  const browRidgeGeo = trackGeo(new THREE.CapsuleGeometry(0.0075, 0.024, 4, 8));
  const browRidgeL = new THREE.Mesh(browRidgeGeo, skinMat);
  browRidgeL.rotation.z = Math.PI * 0.5;
  browRidgeL.position.set(-0.032, 0.189, -0.085);
  const browRidgeR = new THREE.Mesh(browRidgeGeo, skinMat);
  browRidgeR.rotation.z = Math.PI * 0.5;
  browRidgeR.position.set(0.032, 0.189, -0.085);
  headGroup.add(browRidgeL, browRidgeR);

  const browGeo = trackGeo(new THREE.CapsuleGeometry(0.0048, 0.026, 4, 8));
  const browL = new THREE.Mesh(browGeo, browMat);
  browL.rotation.z = Math.PI * 0.5;
  browL.position.set(-0.033, 0.195, -0.088);
  const browR = new THREE.Mesh(browGeo, browMat);
  browR.rotation.z = Math.PI * 0.5;
  browR.position.set(0.033, 0.195, -0.088);
  headGroup.add(browL, browR);

  let currentFaceMood: FaceMood = 'neutral';
  const updateFaceStyle = (face: FaceStyleId, skinColor: number, mood?: FaceMood) => {
    const resolvedMood: FaceMood = mood ?? currentFaceMood;
    currentFaceMood = resolvedMood;

    // Tint warm cheek apple & iris hue per character personality
    const sc = new THREE.Color(skinColor);
    cheekBlushMat.color.copy(sc).lerp(new THREE.Color(0xd96b62), 0.24);
    lipMat.color.copy(sc).lerp(new THREE.Color(0x9e4747), 0.45);
    if (face === 'cheerful') {
      irisMat.color.setHex(0x1f6e8c);
    } else if (face === 'cool') {
      irisMat.color.setHex(0x36557a);
    } else if (face === 'determined') {
      irisMat.color.setHex(0x523624);
    } else {
      irisMat.color.setHex(0x2c4b6e);
    }

    if (face === 'determined' || resolvedMood === 'focused') {
      browL.rotation.z = Math.PI * 0.5 - 0.18;
      browR.rotation.z = Math.PI * 0.5 + 0.18;
      browL.position.y = 0.191;
      browR.position.y = 0.191;
      teethMesh.visible = false;
      cornerL.position.y = -0.002;
      cornerR.position.y = -0.002;
      lowerLip.position.y = -0.004;
      mouthGroup.rotation.z = 0;
    } else if (face === 'cool' || resolvedMood === 'wink') {
      browL.rotation.z = Math.PI * 0.5 - 0.04;
      browR.rotation.z = Math.PI * 0.5 - 0.12;
      browL.position.y = 0.195;
      browR.position.y = 0.199;
      teethMesh.visible = false;
      cornerL.position.y = 0.0;
      cornerR.position.y = 0.004;
      lowerLip.position.y = -0.0045;
      mouthGroup.rotation.z = 0.08;
    } else if (resolvedMood === 'grin' || face === 'cheerful') {
      browL.rotation.z = Math.PI * 0.5 + 0.08;
      browR.rotation.z = Math.PI * 0.5 - 0.08;
      browL.position.y = 0.198;
      browR.position.y = 0.198;
      teethMesh.visible = true;
      cornerL.position.y = 0.0045;
      cornerR.position.y = 0.0045;
      lowerLip.position.y = -0.0065;
      mouthGroup.rotation.z = 0;
    } else {
      browL.rotation.z = Math.PI * 0.5 + 0.05;
      browR.rotation.z = Math.PI * 0.5 - 0.05;
      browL.position.y = 0.195;
      browR.position.y = 0.195;
      teethMesh.visible = false;
      cornerL.position.y = 0.0025;
      cornerR.position.y = 0.0025;
      lowerLip.position.y = -0.0045;
      mouthGroup.rotation.z = 0;
    }
  };
  updateFaceStyle('friendly', 0xe2b28b, 'smile');

  // 4. Anatomically Proportioned Layered 3D Hairstyles + Secondary Motion Child Pivots
  const hairShort = new THREE.Group();
  const hsCrown = setShadow(
    new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.103, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)),
      hairMat,
    ),
  );
  hsCrown.scale.set(0.9, 1.02, 1.0);
  hsCrown.position.set(0, 0.178, 0.012);
  hsCrown.rotation.x = 0.2;
  const hsBangs = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.028, 0.095, 6, 10)), hairMat);
  hsBangs.rotation.z = Math.PI * 0.5;
  hsBangs.rotation.x = 0.34;
  hsBangs.position.set(0, 0.236, -0.058);
  const hsBack = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.09, 12, 10)), hairMat);
  hsBack.scale.set(0.88, 0.9, 0.68);
  hsBack.position.set(0, 0.176, 0.048);
  hairShort.add(hsCrown, hsBangs, hsBack);
  headGroup.add(hairShort);

  const hairCurly = new THREE.Group();
  [
    [0, 0.258, 0.01, 0.076],
    [-0.062, 0.238, -0.012, 0.058],
    [0.062, 0.238, -0.012, 0.058],
    [0, 0.238, 0.064, 0.066],
    [-0.066, 0.205, 0.05, 0.056],
    [0.066, 0.205, 0.05, 0.056],
    [0, 0.248, -0.055, 0.052],
    [-0.042, 0.25, -0.048, 0.048],
    [0.042, 0.25, -0.048, 0.048],
  ].forEach(([cx, cy, cz, cr]) => {
    const puff = setShadow(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(cr, 10, 10)), hairMat));
    puff.position.set(cx, cy, cz);
    hairCurly.add(puff);
  });
  hairCurly.visible = false;
  headGroup.add(hairCurly);

  const hairLongWave = new THREE.Group();
  const lwCrown = setShadow(
    new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.105, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65)),
      hairMat,
    ),
  );
  lwCrown.scale.set(0.9, 1.02, 1.0);
  lwCrown.position.set(0, 0.178, 0.012);
  const longWavePivot = new THREE.Group();
  longWavePivot.position.set(0, 0.205, 0.056);
  const lwCurtain = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.082, 0.16, 8, 12)), hairMat),
  );
  lwCurtain.scale.set(1.06, 1.0, 0.54);
  lwCurtain.position.set(0, -0.115, 0.03);
  const lwSideL = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.025, 0.15, 6, 8)), hairMat);
  lwSideL.position.set(-0.086, -0.09, -0.042);
  const lwSideR = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.025, 0.15, 6, 8)), hairMat);
  lwSideR.position.set(0.086, -0.09, -0.042);
  longWavePivot.add(lwCurtain, lwSideL, lwSideR);
  hairLongWave.add(lwCrown, longWavePivot);
  hairLongWave.visible = false;
  headGroup.add(hairLongWave);

  const hairPonytail = new THREE.Group();
  const ptCrown = setShadow(
    new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.103, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)),
      hairMat,
    ),
  );
  ptCrown.scale.set(0.9, 1.02, 1.0);
  ptCrown.position.set(0, 0.178, 0.01);
  ptCrown.rotation.x = 0.2;
  const ptTie = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.024, 0.008, 8, 12)), goldMat);
  ptTie.position.set(0, 0.214, 0.1);
  const ponytailPivot = new THREE.Group();
  ponytailPivot.position.set(0, 0.214, 0.104);
  const ptTail = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.03, 0.15, 8, 10)), hairMat),
  );
  ptTail.position.set(0, -0.088, 0.026);
  ptTail.rotation.x = 0.24;
  ponytailPivot.add(ptTail);
  hairPonytail.add(ptCrown, ptTie, ponytailPivot);
  hairPonytail.visible = false;
  headGroup.add(hairPonytail);

  const hairFade = new THREE.Group();
  const fdCrown = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.062, 0.065, 8, 12)), hairMat),
  );
  fdCrown.rotation.x = Math.PI * 0.5;
  fdCrown.scale.set(1.06, 1.0, 0.72);
  fdCrown.position.set(0, 0.262, -0.006);
  const fdBase = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.098, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45)),
    hairMat,
  );
  fdBase.scale.set(0.9, 1.0, 0.98);
  fdBase.position.set(0, 0.184, 0.01);
  hairFade.add(fdCrown, fdBase);
  hairFade.visible = false;
  headGroup.add(hairFade);

  const hairBob = new THREE.Group();
  const bobCrown = setShadow(
    new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.106, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65)),
      hairMat,
    ),
  );
  bobCrown.scale.set(0.92, 1.02, 1.0);
  bobCrown.position.set(0, 0.178, 0.01);
  const bobPivot = new THREE.Group();
  bobPivot.position.set(0, 0.196, 0.015);
  const bobSides = setShadow(
    new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.1, 0.112, 0.13, 14, 1, false, -Math.PI * 0.15, Math.PI * 1.3)),
      hairMat,
    ),
  );
  bobSides.position.set(0, -0.056, 0.008);
  bobSides.rotation.y = Math.PI * 0.35;
  bobPivot.add(bobSides);
  hairBob.add(bobCrown, bobPivot);
  hairBob.visible = false;
  headGroup.add(hairBob);

  // Hats scaled cleanly to anatomical skull
  const capGroup = new THREE.Group();
  const capMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.62, metalness: 0.08 }),
  );
  const capCrown = setShadow(
    new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.108, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)),
      capMat,
    ),
  );
  capCrown.scale.set(0.92, 1.0, 1.02);
  capCrown.position.set(0, 0.214, 0.01);
  const capBrim = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.102, 0.106, 0.015, 14, 1, false, -0.9, 1.8)),
    capMat,
  );
  capBrim.position.set(0, 0.232, -0.05);
  capBrim.rotation.y = Math.PI;
  capGroup.add(capCrown, capBrim);
  capGroup.visible = false;
  headGroup.add(capGroup);

  const beanieGroup = new THREE.Group();
  const beanieMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.84,
      bumpMap: maps?.fabricBumpMap ?? null,
      bumpScale: maps?.fabricBumpMap ? 0.012 : 0,
    }),
  );
  const beanieDome = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.108, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    beanieMat,
  );
  beanieDome.scale.set(0.92, 1.02, 1.02);
  beanieDome.position.set(0, 0.214, 0.01);
  const beanieCuff = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.096, 0.02, 8, 16)),
    beanieMat,
  );
  beanieCuff.rotation.x = Math.PI * 0.5;
  beanieCuff.position.set(0, 0.228, 0.01);
  beanieGroup.add(beanieDome, beanieCuff);
  beanieGroup.visible = false;
  headGroup.add(beanieGroup);

  const fedoraGroup = new THREE.Group();
  const fedoraMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.68 }));
  const fedBrim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.15, 0.014, 18)), fedoraMat);
  fedBrim.position.set(0, 0.246, 0);
  const fedCrown = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.084, 0.102, 0.08, 14)),
    fedoraMat,
  );
  fedCrown.position.set(0, 0.288, 0);
  const fedBand = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.104, 0.104, 0.018, 14)),
    goldMat,
  );
  fedBand.position.set(0, 0.262, 0);
  fedoraGroup.add(fedBrim, fedCrown, fedBand);
  fedoraGroup.visible = false;
  headGroup.add(fedoraGroup);

  const gradCapGroup = new THREE.Group();
  const gradMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55 }));
  const gradBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.096, 0.104, 0.056, 14)),
    gradMat,
  );
  gradBase.position.set(0, 0.256, 0);
  const gradBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.016, 0.24)), gradMat);
  gradBoard.position.set(0, 0.29, 0);
  const gradTassel = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.009, 0.013, 0.08, 8)),
    goldMat,
  );
  gradTassel.position.set(0.108, 0.25, -0.036);
  gradCapGroup.add(gradBase, gradBoard, gradTassel);
  gradCapGroup.visible = false;
  headGroup.add(gradCapGroup);

  // Glasses scaled to anatomical face
  const shadesGroup = new THREE.Group();
  const sunglasses = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.145, 0.036, 0.022)), visorMat);
  sunglasses.position.set(0, 0.172, -0.092);
  shadesGroup.add(sunglasses);
  shadesGroup.visible = false;
  headGroup.add(shadesGroup);

  const roundGlassesGroup = new THREE.Group();
  const lensL = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.024, 0.005, 8, 16)), goldMat);
  lensL.position.set(-0.033, 0.172, -0.094);
  const lensR = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.024, 0.005, 8, 16)), goldMat);
  lensR.position.set(0.033, 0.172, -0.094);
  const bridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.006, 0.008)), goldMat);
  bridge.position.set(0, 0.172, -0.094);
  roundGlassesGroup.add(lensL, lensR, bridge);
  roundGlassesGroup.visible = false;
  headGroup.add(roundGlassesGroup);

  const visorGroup = new THREE.Group();
  const visorShield = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.102, 0.102, 0.048, 16, 1, true, -0.95, 1.9)),
    cyberCyanMat,
  );
  visorShield.rotation.y = Math.PI;
  visorShield.position.set(0, 0.174, -0.008);
  visorGroup.add(visorShield);
  visorGroup.visible = false;
  headGroup.add(visorGroup);

  // 5. Anatomical Human Arms mounted to chestPivot (Shoulder -> Bicep/Upper Arm -> Elbow -> Tapered Forearm -> Wrist -> Sculpted Multi-Part Hand)
  const upperArmGeo = trackGeo(
    createLatheProfile(
      [
        [0.035, -0.265],
        [0.041, -0.175],
        [0.047, -0.095],
        [0.05, -0.03],
        [0.046, 0.0],
      ],
      14,
    ),
  );
  const forearmGeo = trackGeo(
    createLatheProfile(
      [
        [0.025, -0.245],
        [0.029, -0.17],
        [0.038, -0.075],
        [0.037, -0.018],
        [0.032, 0.0],
      ],
      14,
    ),
  );
  const palmGeo = trackGeo(new THREE.BoxGeometry(0.022, 0.068, 0.054));
  const fingerGeo = trackGeo(new THREE.CapsuleGeometry(0.0068, 0.042, 4, 6));
  const thumbGeo = trackGeo(new THREE.CapsuleGeometry(0.0075, 0.032, 4, 6));

  const upperArmMeshes: THREE.Mesh[] = [];
  const makeArm = (
    side: -1 | 1,
  ): { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.205, 0.272, 0);

    // Sleek deltoid muscle rounding cleanly into chest (no protruding Roblox ball)
    const deltoid = setShadow(
      new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.051, 14, 12)), jacketMat),
    );
    deltoid.scale.set(0.92, 1.12, 0.96);
    shoulder.add(deltoid);

    const upperArm = setShadow(new THREE.Mesh(upperArmGeo, jacketMat));
    shoulder.add(upperArm);
    upperArmMeshes.push(upperArm);

    const elbowCap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.034, 10, 8)), jacketMat);
    elbowCap.position.set(0, -0.265, 0);
    shoulder.add(elbowCap);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.265, 0);
    shoulder.add(elbow);

    const forearm = setShadow(new THREE.Mesh(forearmGeo, skinMat));
    elbow.add(forearm);

    // Sculpted Articulated Wrist & 6-Part Real Human Hand
    const wrist = new THREE.Group();
    wrist.position.set(0, -0.245, 0);
    elbow.add(wrist);

    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0, -0.036, -0.004);
    wrist.add(palm);

    // 4 sculpted fingers gently relaxed toward body/forward
    [-0.018, -0.006, 0.006, 0.018].forEach((fz, idx) => {
      const f = new THREE.Mesh(fingerGeo, skinMat);
      const lenScale = idx === 1 ? 1.06 : idx === 3 ? 0.84 : 0.96;
      f.scale.set(1, lenScale, 1);
      f.position.set(side * -0.004, -0.088, fz - 0.004);
      f.rotation.z = side * -0.16;
      wrist.add(f);
    });

    // Opposable thumb angled forward/inward
    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.position.set(side * -0.011, -0.038, -0.032);
    thumb.rotation.x = 0.45;
    thumb.rotation.z = side * -0.28;
    wrist.add(thumb);

    chestPivot.add(shoulder);
    return { shoulder, elbow, wrist };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Wrist Watches mounted near left wrist
  const sportWatchGroup = new THREE.Group();
  const swBand = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.029, 0.028, 0.024, 12)),
    visorMat,
  );
  swBand.position.set(0, -0.212, 0);
  const swFace = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.028, 0.012)), cyberCyanMat);
  swFace.position.set(0, -0.212, -0.029);
  sportWatchGroup.add(swBand, swFace);
  sportWatchGroup.visible = false;
  leftArm.elbow.add(sportWatchGroup);

  const goldWatchGroup = new THREE.Group();
  const gwBand = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.029, 0.028, 0.026, 12)),
    goldMat,
  );
  gwBand.position.set(0, -0.212, 0);
  goldWatchGroup.add(gwBand);
  goldWatchGroup.visible = false;
  leftArm.elbow.add(goldWatchGroup);

  const smartBandGroup = new THREE.Group();
  const sbBand = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.028, 0.027, 0.018, 12)),
    cyberCyanMat,
  );
  sbBand.position.set(0, -0.212, 0);
  smartBandGroup.add(sbBand);
  smartBandGroup.visible = false;
  leftArm.elbow.add(smartBandGroup);

  // 6. Anatomical Human Legs (Hip -> Thigh -> Knee -> Calf -> Ankle -> Contoured Sneaker)
  const thighGeo = trackGeo(
    createLatheProfile(
      [
        [0.053, -0.405],
        [0.06, -0.32],
        [0.072, -0.18],
        [0.076, -0.07],
        [0.071, 0.0],
      ],
      16,
    ),
  );
  const shinGeo = trackGeo(
    createLatheProfile(
      [
        [0.036, -0.395],
        [0.04, -0.305],
        [0.055, -0.175],
        [0.058, -0.095],
        [0.052, 0.0],
      ],
      16,
    ),
  );
  const soleGeo = trackGeo(createShoeSoleGeometry());

  const cargoPocketMeshes: THREE.Mesh[] = [];
  const makeLeg = (
    side: -1 | 1,
  ): { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.095, -0.025, 0);

    const hipCap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.072, 12, 10)), jeansMat);
    hipCap.scale.set(0.95, 1.0, 1.04);
    hip.add(hipCap);

    const thigh = setShadow(new THREE.Mesh(thighGeo, jeansMat));
    thigh.scale.set(0.96, 1.0, 1.05);
    hip.add(thigh);

    const cargoPocket = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.024, 0.125, 0.095)),
      jeansMat,
    );
    cargoPocket.position.set(side * 0.072, -0.2, 0);
    cargoPocket.visible = false;
    hip.add(cargoPocket);
    cargoPocketMeshes.push(cargoPocket);

    const kneeCap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.052, 12, 10)), jeansMat);
    kneeCap.position.set(0, -0.405, 0);
    hip.add(kneeCap);

    const knee = new THREE.Group();
    knee.position.set(0, -0.405, 0);
    hip.add(knee);

    const shin = setShadow(new THREE.Mesh(shinGeo, jeansMat));
    shin.scale.set(0.95, 1.0, 1.06);
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.395, 0);
    knee.add(ankle);

    // Contoured Multi-Part Sneaker (ankle sits at world y = 0.080; sole bottom hits -0.080 -> world y = 0.0)
    const shoeUpper = setShadow(
      new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.044, 0.125, 6, 12)), shoeMat),
    );
    shoeUpper.rotation.x = Math.PI * 0.5;
    shoeUpper.scale.set(1.06, 1.0, 0.78);
    shoeUpper.position.set(0, -0.028, -0.042);

    const shoeCollar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.042, 0.046, 0.036, 12)),
      shoeMat,
    );
    shoeCollar.position.set(0, -0.008, 0);

    const shoeSole = setShadow(new THREE.Mesh(soleGeo, soleMat));
    shoeSole.position.set(0, -0.051, 0);

    ankle.add(shoeUpper, shoeCollar, shoeSole);
    hipsGroup.add(hip);
    return { hip, knee, ankle };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  const shadowGeo = trackGeo(new THREE.CircleGeometry(0.56, 24));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: contactShadowMap,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  );
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.018, 0);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    hipsGroup,
    torso,
    chestPivot,
    headGroup,
    leftArmPivot: leftArm.shoulder,
    leftElbowPivot: leftArm.elbow,
    leftWristPivot: leftArm.wrist,
    rightArmPivot: rightArm.shoulder,
    rightElbowPivot: rightArm.elbow,
    rightWristPivot: rightArm.wrist,
    leftLegPivot: leftLeg.hip,
    leftKneePivot: leftLeg.knee,
    leftAnklePivot: leftLeg.ankle,
    rightLegPivot: rightLeg.hip,
    rightKneePivot: rightLeg.knee,
    rightAnklePivot: rightLeg.ankle,
    contactShadow,
    jacketMat,
    shirtMat,
    pantsMat: jeansMat,
    shoeMat,
    skinMat,
    hairMat,
    backpackGroup,
    capGroup,
    shadesMesh: sunglasses,
    tieMesh,
    hoodiePocketMesh,
    innerTeeMesh: innerTee,
    upperArmMeshes,
    chestMesh,
    pelvisMesh,
    hairGroups: {
      short_crop: hairShort,
      curly: hairCurly,
      long_wave: hairLongWave,
      ponytail: hairPonytail,
      fade: hairFade,
      bob: hairBob,
    },
    hatGroups: {
      cap: capGroup,
      beanie: beanieGroup,
      fedora: fedoraGroup,
      grad_cap: gradCapGroup,
    },
    glassesGroups: {
      shades: shadesGroup,
      round_frames: roundGlassesGroup,
      visor: visorGroup,
    },
    watchGroups: {
      sport_watch: sportWatchGroup,
      gold_watch: goldWatchGroup,
      smart_band: smartBandGroup,
    },
    packGroups: {
      backpack: backpackGroup,
      tech_pack: techPackGroup,
      mini_satchel: satchelGroup,
    },
    neckGroups: {
      scarf: scarfGroup,
      medal_lanyard: medalGroup,
      headphones: headphonesGroup,
    },
    vestAccentGroup,
    cyberStripeGroup,
    coatTailMesh,
    coatTailPivot,
    scarfTailPivot,
    ponytailPivot,
    longWavePivot,
    bobPivot,
    eyelidL,
    eyelidR,
    browL,
    browR,
    cargoPocketMeshes,
    updateFaceStyle,
    baseScale: { x: 1, y: 1, z: 1 },
    dispose: () => {
      textures.forEach((t) => t.dispose());
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

export function applyCharacterCustomization(
  rig: CharacterRig,
  rawCustomization: CharacterCustomization,
): void {
  const c = normalizeCharacterCustomization(rawCustomization);

  rig.jacketMat.color.setHex(c.jacketColor);
  rig.pantsMat.color.setHex(c.pantsColor);
  rig.shoeMat.color.setHex(c.shoeColor);
  if (typeof c.skinTone === 'number') {
    rig.skinMat.color.setHex(c.skinTone);
  }
  if (typeof c.hairColor === 'number') {
    rig.hairMat.color.setHex(c.hairColor);
  }
  rig.updateFaceStyle(c.faceStyle || 'friendly', c.skinTone || 0xe2b28b);

  const body = c.bodyType || 'classic';
  if (body === 'athletic') {
    rig.baseScale = { x: 1.07, y: 1.02, z: 1.05 };
  } else if (body === 'slim') {
    rig.baseScale = { x: 0.92, y: 1.0, z: 0.93 };
  } else if (body === 'tall') {
    rig.baseScale = { x: 0.96, y: 1.07, z: 0.96 };
  } else {
    rig.baseScale = { x: 1, y: 1, z: 1 };
  }
  rig.bodyGroup.scale.set(rig.baseScale.x, rig.baseScale.y, rig.baseScale.z);

  const top = c.topStyle || 'jacket';
  rig.innerTeeMesh.visible = top === 'jacket' || top === 'blazer' || top === 'explorer_vest';
  rig.tieMesh.visible = top === 'blazer';
  rig.hoodiePocketMesh.visible = top === 'hoodie';
  rig.vestAccentGroup.visible = top === 'explorer_vest';
  rig.cyberStripeGroup.visible = top === 'cyber_jacket';
  rig.coatTailMesh.visible = top === 'champion_coat' || top === 'blazer';

  const showCargo = c.pantsStyle === 'cargo';
  for (const pm of rig.cargoPocketMeshes) {
    pm.visible = showCargo;
  }

  const hair = c.hairStyle || 'short_crop';
  (Object.keys(rig.hairGroups) as Array<keyof typeof rig.hairGroups>).forEach((k) => {
    rig.hairGroups[k].visible = k === hair;
  });

  const hat = c.hatId || 'none';
  (Object.keys(rig.hatGroups) as Array<keyof typeof rig.hatGroups>).forEach((k) => {
    rig.hatGroups[k].visible = k === hat;
  });

  const glasses = c.glassesId || 'none';
  (Object.keys(rig.glassesGroups) as Array<keyof typeof rig.glassesGroups>).forEach((k) => {
    rig.glassesGroups[k].visible = k === glasses;
  });

  const watch = c.watchId || 'none';
  (Object.keys(rig.watchGroups) as Array<keyof typeof rig.watchGroups>).forEach((k) => {
    rig.watchGroups[k].visible = k === watch;
  });

  const pack = c.backpackId || 'none';
  (Object.keys(rig.packGroups) as Array<keyof typeof rig.packGroups>).forEach((k) => {
    rig.packGroups[k].visible = k === pack;
  });

  const neck = c.neckId || 'none';
  (Object.keys(rig.neckGroups) as Array<keyof typeof rig.neckGroups>).forEach((k) => {
    rig.neckGroups[k].visible = k === neck;
  });
}

export function applyArticulatedPoseToRig(
  rig: CharacterRig,
  pose: ArticulatedPose,
  x: number,
  y: number,
  z: number,
  yaw: number,
  groundY: number,
  squashY = 1,
): void {
  rig.root.position.set(x, y, z);
  rig.root.rotation.y = yaw;

  const sy = squashY;
  const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
  rig.bodyGroup.scale.set(
    sxz * rig.baseScale.x,
    sy * rig.baseScale.y,
    sxz * rig.baseScale.z,
  );

  const heightAboveGround = Math.max(0, y - groundY);
  rig.contactShadow.position.y = groundY - y + 0.018;
  const shadowScale = Math.max(0.45, 1 - heightAboveGround * 0.16);
  rig.contactShadow.scale.set(shadowScale, shadowScale, 1);
  (rig.contactShadow.material as THREE.MeshBasicMaterial).opacity =
    Math.max(0.15, 0.55 - heightAboveGround * 0.12);

  rig.hipsGroup.position.set(0, 0.905 + pose.hipsY, 0);
  rig.hipsGroup.rotation.set(pose.hipsPitch, 0, pose.hipsRoll);

  rig.torso.rotation.set(pose.torsoPitch, pose.torsoYaw, pose.torsoRoll);
  rig.chestPivot.rotation.set(pose.chestPitch ?? 0, pose.chestYaw ?? 0, pose.chestRoll ?? 0);
  rig.headGroup.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);

  rig.leftArmPivot.rotation.set(pose.lShoulderX, 0, pose.lShoulderZ);
  rig.leftElbowPivot.rotation.set(pose.lElbowX, 0, 0);
  rig.leftWristPivot.rotation.set(pose.lWristX ?? 0, 0, 0);

  rig.rightArmPivot.rotation.set(pose.rShoulderX, 0, pose.rShoulderZ);
  rig.rightElbowPivot.rotation.set(pose.rElbowX, 0, 0);
  rig.rightWristPivot.rotation.set(pose.rWristX ?? 0, 0, 0);

  rig.leftLegPivot.rotation.set(pose.lHipX, 0, pose.lHipZ);
  rig.leftKneePivot.rotation.set(pose.lKneeX, 0, 0);
  rig.leftAnklePivot.rotation.set(pose.lAnkleX, 0, 0);

  rig.rightLegPivot.rotation.set(pose.rHipX, 0, pose.rHipZ);
  rig.rightKneePivot.rotation.set(pose.rKneeX, 0, 0);
  rig.rightAnklePivot.rotation.set(pose.rAnkleX, 0, 0);

  rig.ponytailPivot.rotation.set(-pose.hairSwingX, 0, pose.hairSwingZ);
  rig.longWavePivot.rotation.set(-pose.hairSwingX * 0.65, 0, pose.hairSwingZ * 0.75);
  rig.bobPivot.rotation.set(-pose.hairSwingX * 0.35, 0, pose.hairSwingZ * 0.45);
  rig.coatTailPivot.rotation.set(-pose.coatSwingX, 0, pose.hairSwingZ * 0.35);
  rig.scarfTailPivot.rotation.set(-pose.hairSwingX * 0.75, 0, pose.scarfSwingZ);

  const blink = Math.max(0, Math.min(1, pose.blinkWeight));
  rig.eyelidL.rotation.x = -0.35 - blink * 1.35;
  rig.eyelidR.rotation.x = -0.35 - (pose.faceMood === 'wink' ? 1.15 : blink * 1.35);
}

export function animateCharacterRig(
  rig: CharacterRig,
  state: PlayerState,
  groundY: number,
  elapsed: number,
): void {
  rig.root.position.set(state.x, state.y, state.z);
  rig.root.rotation.y = state.yaw;

  const sy = state.squashY;
  const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
  rig.bodyGroup.scale.set(
    sxz * rig.baseScale.x,
    sy * rig.baseScale.y,
    sxz * rig.baseScale.z,
  );

  const heightAboveGround = Math.max(0, state.y - groundY);
  rig.contactShadow.position.y = groundY - state.y + 0.018;
  const shadowScale = Math.max(0.45, 1 - heightAboveGround * 0.16);
  rig.contactShadow.scale.set(shadowScale, shadowScale, 1);
  (rig.contactShadow.material as THREE.MeshBasicMaterial).opacity =
    Math.max(0.15, 0.55 - heightAboveGround * 0.12);

  if (state.inWater) {
    rig.contactShadow.visible = false;
    const stroke = elapsed * (state.isSprinting ? 6.5 : 4.5);
    const s = Math.sin(stroke);
    rig.hipsGroup.position.y = 1.05;
    rig.hipsGroup.rotation.set(state.isMoving || state.isUnderwater ? -1.18 : -0.14, 0, 0);
    rig.torso.rotation.set(-0.05, s * 0.16, 0);
    rig.chestPivot.rotation.set(-0.04, s * 0.2, 0);
    rig.headGroup.rotation.set(state.isMoving || state.isUnderwater ? 0.98 : 0.15, 0, 0);
    rig.leftLegPivot.rotation.x = s * 0.3;
    rig.rightLegPivot.rotation.x = -s * 0.3;
    rig.leftKneePivot.rotation.x = -0.22 - Math.max(0, s) * 0.28;
    rig.rightKneePivot.rotation.x = -0.22 - Math.max(0, -s) * 0.28;
    rig.leftArmPivot.rotation.set(1.9 + s * 1.1, 0, -0.25);
    rig.rightArmPivot.rotation.set(1.9 - s * 1.1, 0, 0.25);
    rig.leftElbowPivot.rotation.x = 0.45;
    rig.rightElbowPivot.rotation.x = 0.45;
  } else if (!state.grounded) {
    rig.contactShadow.visible = true;
    const airFactor = Math.max(-1, Math.min(1, state.vy * 0.12));
    rig.leftLegPivot.rotation.x = 0.45 + airFactor * 0.15;
    rig.rightLegPivot.rotation.x = -0.25 - airFactor * 0.1;
    rig.leftKneePivot.rotation.x = -0.72;
    rig.rightKneePivot.rotation.x = -0.35;
    rig.leftArmPivot.rotation.x = 0.95 + airFactor * 0.25;
    rig.rightArmPivot.rotation.x = 0.95 - airFactor * 0.2;
    rig.leftElbowPivot.rotation.x = 0.42;
    rig.rightElbowPivot.rotation.x = 0.42;
    rig.torso.rotation.x = -0.06;
    rig.chestPivot.rotation.set(-0.06, 0, 0);
    rig.hipsGroup.position.y = 0.905;
    rig.hipsGroup.rotation.set(0, 0, 0);
    rig.headGroup.rotation.set(0, 0, 0);
  } else if (state.isMoving) {
    rig.contactShadow.visible = true;
    const amp = state.isSprinting ? 0.85 : 0.52;
    const s = Math.sin(state.gaitPhase);
    const swing = s * amp;
    const bounce = Math.abs(Math.cos(state.gaitPhase)) * (state.isSprinting ? 0.065 : 0.032) - 0.015;

    rig.leftLegPivot.rotation.x = swing;
    rig.rightLegPivot.rotation.x = -swing;
    rig.leftKneePivot.rotation.x = -(0.06 + Math.max(0, Math.sin(state.gaitPhase + 1.5)) * 0.65);
    rig.rightKneePivot.rotation.x = -(0.06 + Math.max(0, Math.sin(state.gaitPhase + Math.PI + 1.5)) * 0.65);
    rig.leftArmPivot.rotation.x = -swing * 0.78;
    rig.rightArmPivot.rotation.x = swing * 0.78;
    rig.leftElbowPivot.rotation.x = 0.36;
    rig.rightElbowPivot.rotation.x = 0.36;
    rig.torso.rotation.set(state.isSprinting ? -0.12 : -0.04, s * 0.06, -s * 0.025);
    rig.chestPivot.rotation.set(state.isSprinting ? -0.1 : -0.03, -s * 0.16, -s * 0.035);
    rig.hipsGroup.position.y = 0.905 + bounce;
    rig.hipsGroup.rotation.set(0, 0, s * 0.05);
    rig.headGroup.rotation.set(state.isSprinting ? 0.16 : 0.03, 0, 0);
  } else {
    rig.contactShadow.visible = true;
    const breath = Math.sin(elapsed * 2.1);
    rig.leftLegPivot.rotation.x = 0.02;
    rig.rightLegPivot.rotation.x = -0.02;
    rig.leftKneePivot.rotation.x = -0.07;
    rig.rightKneePivot.rotation.x = -0.03;
    rig.leftArmPivot.rotation.set(-0.02, 0, -0.06 - breath * 0.012);
    rig.rightArmPivot.rotation.set(0.02, 0, 0.06 + breath * 0.012);
    rig.leftElbowPivot.rotation.x = 0.22;
    rig.rightElbowPivot.rotation.x = 0.17;
    rig.leftWristPivot.rotation.x = 0.06;
    rig.rightWristPivot.rotation.x = 0.04;
    rig.torso.rotation.set(-0.012, 0, -0.016);
    rig.chestPivot.rotation.set(-0.01 - breath * 0.015, -0.035, -0.014);
    rig.hipsGroup.position.y = 0.905 + breath * 0.009;
    rig.hipsGroup.rotation.set(0, 0, 0.026);
    rig.headGroup.rotation.set(0, 0, 0);
  }
}

export function createPlayerNameplateRig(
  initialName: string,
  initialOnline = true,
  initialTag: string | null = null,
): PlayerNameplateRig {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 76;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.8, 0.42, 1);
  sprite.position.set(0, 2.08, 0);

  let lastKey = '';

  const redraw = (displayName: string, isOnline: boolean, activityTag?: string | null) => {
    const safeName = (displayName || 'Player').slice(0, 18);
    const safeTag = activityTag ? activityTag.slice(0, 14) : '';
    const key = `${safeName}|${isOnline ? 1 : 0}|${safeTag}`;
    if (key === lastKey) return;
    lastKey = key;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = 304;
    const h = 58;
    const x = 8;
    const y = 9;
    const r = 14;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isOnline ? 'rgba(52, 211, 153, 0.72)' : 'rgba(148, 163, 184, 0.5)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(32, y + h * 0.5, 7, 0, Math.PI * 2);
    ctx.fillStyle = isOnline ? '#10b981' : '#94a3b8';
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (safeTag) {
      ctx.fillText(safeName, 50, y + 21);
      ctx.fillStyle = '#fde68a';
      ctx.font = '600 17px Inter, system-ui, sans-serif';
      ctx.fillText(safeTag, 50, y + 43);
    } else {
      ctx.fillText(safeName, 50, y + h * 0.5);
    }

    texture.needsUpdate = true;
  };

  redraw(initialName, initialOnline, initialTag);

  return {
    sprite,
    update: redraw,
    dispose: () => {
      texture.dispose();
      mat.dispose();
    },
  };
}

export interface NpcRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  head: THREE.Group;
  dispose: () => void;
}

export function createNpcRig(
  variant: number,
  contactShadowMap: THREE.Texture,
  castShadows: boolean,
): NpcRig {
  const pal = NPC_PALETTES[Math.abs(variant) % NPC_PALETTES.length];
  const root = new THREE.Group();
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

  const jacketMat = tm(new THREE.MeshStandardMaterial({ color: pal.jacket, roughness: 0.65 }));
  const pantsMat = tm(new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.86 }));
  const skinMat = tm(new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.56 }));
  const hairMat = tm(new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.78 }));
  const shoeMat = tm(new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.42 }));
  const eyeMat = tm(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2 }));

  const hips = new THREE.Group();
  hips.position.set(0, 0.89, 0);
  root.add(hips);

  const pelvis = new THREE.Mesh(
    tg(
      createLatheProfile(
        [
          [0.055, -0.05],
          [0.13, -0.015],
          [0.135, 0.05],
          [0.122, 0.08],
        ],
        12,
      ),
    ),
    pantsMat,
  );
  pelvis.scale.set(1.06, 1, 0.68);
  hips.add(pelvis);

  const torso = new THREE.Group();
  torso.position.set(0, 0.06, 0);
  hips.add(torso);

  const bodyMesh = new THREE.Mesh(
    tg(
      createLatheProfile(
        [
          [0.125, 0.0],
          [0.122, 0.14],
          [0.165, 0.34],
          [0.162, 0.44],
          [0.078, 0.51],
          [0.05, 0.525],
        ],
        14,
      ),
    ),
    jacketMat,
  );
  bodyMesh.scale.set(1.1, 1, 0.65);
  bodyMesh.castShadow = castShadows;
  torso.add(bodyMesh);

  // Proportional anatomical sculpted NPC Head with expressive 3D features
  const head = new THREE.Group();
  head.position.set(0, 0.535, 0);
  const neckMesh = new THREE.Mesh(tg(new THREE.CylinderGeometry(0.044, 0.052, 0.095, 10)), skinMat);
  neckMesh.position.y = 0.045;
  const headSphere = new THREE.Mesh(tg(new THREE.SphereGeometry(0.094, 14, 12)), skinMat);
  headSphere.scale.set(0.88, 1.06, 0.98);
  headSphere.position.set(0, 0.168, 0.006);
  headSphere.castShadow = castShadows;
  const jawMesh = new THREE.Mesh(tg(new THREE.SphereGeometry(0.072, 12, 10)), skinMat);
  jawMesh.scale.set(0.86, 0.9, 0.88);
  jawMesh.position.set(0, 0.12, -0.014);
  const noseBridgeNpc = new THREE.Mesh(tg(new THREE.CapsuleGeometry(0.0075, 0.022, 4, 6)), skinMat);
  noseBridgeNpc.position.set(0, 0.158, -0.088);
  noseBridgeNpc.rotation.x = 0.24;
  const noseMesh = new THREE.Mesh(tg(new THREE.SphereGeometry(0.012, 8, 8)), skinMat);
  noseMesh.position.set(0, 0.145, -0.093);
  const npcLipMat = tm(new THREE.MeshStandardMaterial({ color: 0xb66258, roughness: 0.45 }));
  const npcLip = new THREE.Mesh(tg(new THREE.CapsuleGeometry(0.0055, 0.022, 4, 6)), npcLipMat);
  npcLip.rotation.z = Math.PI * 0.5;
  npcLip.position.set(0, 0.112, -0.081);
  head.add(neckMesh, headSphere, jawMesh, noseBridgeNpc, noseMesh, npcLip);

  const npcScleraMat = tm(new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2 }));
  const npcIrisMat = tm(new THREE.MeshStandardMaterial({ color: 0x2a4564, roughness: 0.25 }));
  const npcBrowMat = tm(new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.8 }));
  for (const side of [-1, 1] as const) {
    const sc = new THREE.Mesh(tg(new THREE.SphereGeometry(0.013, 8, 8)), npcScleraMat);
    sc.scale.set(1.1, 0.85, 0.72);
    sc.position.set(side * 0.031, 0.17, -0.079);
    const ir = new THREE.Mesh(tg(new THREE.SphereGeometry(0.0085, 8, 8)), npcIrisMat);
    ir.scale.set(1, 1, 0.5);
    ir.position.set(side * 0.031, 0.17, -0.085);
    const pu = new THREE.Mesh(tg(new THREE.SphereGeometry(0.0048, 6, 6)), eyeMat);
    pu.position.set(side * 0.031, 0.17, -0.088);
    const br = new THREE.Mesh(tg(new THREE.CapsuleGeometry(0.0042, 0.022, 4, 6)), npcBrowMat);
    br.rotation.z = Math.PI * 0.5 + side * -0.06;
    br.position.set(side * 0.031, 0.191, -0.084);
    head.add(sc, ir, pu, br);
  }

  const hair = new THREE.Mesh(
    tg(new THREE.SphereGeometry(0.099, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    hairMat,
  );
  hair.scale.set(0.9, 1.02, 0.98);
  hair.position.set(0, 0.176, 0.01);
  head.add(hair);

  if (pal.hat === 'cap') {
    const capMat = tm(new THREE.MeshStandardMaterial({ color: 0x22384f, roughness: 0.65 }));
    const capCrown = new THREE.Mesh(
      tg(new THREE.SphereGeometry(0.104, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
      capMat,
    );
    capCrown.scale.set(0.92, 1, 1);
    capCrown.position.y = 0.205;
    const capBrim = new THREE.Mesh(tg(new THREE.BoxGeometry(0.15, 0.016, 0.085)), capMat);
    capBrim.position.set(0, 0.218, -0.095);
    head.add(capCrown, capBrim);
  } else if (pal.hat === 'hardhat') {
    const hatMat = tm(new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: 0.35 }));
    const dome = new THREE.Mesh(
      tg(new THREE.SphereGeometry(0.108, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
      hatMat,
    );
    dome.position.y = 0.21;
    head.add(dome);
  }
  torso.add(head);

  const upperArmGeo = tg(
    createLatheProfile(
      [
        [0.033, -0.255],
        [0.044, -0.09],
        [0.043, 0.0],
      ],
      10,
    ),
  );
  const forearmGeo = tg(
    createLatheProfile(
      [
        [0.024, -0.24],
        [0.035, -0.08],
        [0.031, 0.0],
      ],
      10,
    ),
  );
  const handGeo = tg(new THREE.BoxGeometry(0.024, 0.075, 0.046));
  const makeNpcArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.195, 0.455, 0);
    const deltoid = new THREE.Mesh(tg(new THREE.SphereGeometry(0.046, 10, 8)), jacketMat);
    const ua = new THREE.Mesh(upperArmGeo, jacketMat);
    ua.castShadow = castShadows;
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.255, 0);
    const fa = new THREE.Mesh(forearmGeo, skinMat);
    fa.castShadow = castShadows;
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(0, -0.275, -0.005);
    elbow.add(fa, hand);
    pivot.add(deltoid, ua, elbow);
    torso.add(pivot);
    return { pivot, elbow };
  };
  const lArm = makeNpcArm(-1);
  const rArm = makeNpcArm(1);

  const thighGeo = tg(
    createLatheProfile(
      [
        [0.05, -0.395],
        [0.07, -0.15],
        [0.068, 0.0],
      ],
      10,
    ),
  );
  const shinGeo = tg(
    createLatheProfile(
      [
        [0.034, -0.395],
        [0.054, -0.14],
        [0.049, 0.0],
      ],
      10,
    ),
  );
  const shoeGeo = tg(new THREE.CapsuleGeometry(0.042, 0.115, 4, 8));
  const makeNpcLeg = (side: -1 | 1) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.092, -0.02, 0);
    const th = new THREE.Mesh(thighGeo, pantsMat);
    th.castShadow = castShadows;
    const knee = new THREE.Group();
    knee.position.set(0, -0.395, 0);
    const sh = new THREE.Mesh(shinGeo, pantsMat);
    sh.castShadow = castShadows;
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.rotation.x = Math.PI * 0.5;
    shoe.scale.set(1.04, 1, 0.78);
    shoe.position.set(0, -0.43, -0.036);
    knee.add(sh, shoe);
    legPivot.add(th, knee);
    hips.add(legPivot);
    return { legPivot, knee };
  };
  const lLeg = makeNpcLeg(-1);
  const rLeg = makeNpcLeg(1);

  const shadow = new THREE.Mesh(
    tg(new THREE.CircleGeometry(0.46, 16)),
    tm(
      new THREE.MeshBasicMaterial({
        map: contactShadowMap,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
      }),
    ),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  root.add(shadow);

  return {
    root,
    hips,
    torso,
    leftArm: lArm.pivot,
    leftElbow: lArm.elbow,
    rightArm: rArm.pivot,
    rightElbow: rArm.elbow,
    leftLeg: lLeg.legPivot,
    leftKnee: lLeg.knee,
    rightLeg: rLeg.legPivot,
    rightKnee: rLeg.knee,
    head,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export function animateNpcRig(rig: NpcRig, npc: NpcState, elapsed: number): void {
  rig.root.position.set(npc.x, npc.y, npc.z);
  rig.root.rotation.y = npc.yaw;

  if (npc.isPaused) {
    rig.leftLeg.rotation.x *= 0.85;
    rig.rightLeg.rotation.x *= 0.85;
    rig.leftKnee.rotation.x = -0.05;
    rig.rightKnee.rotation.x = -0.05;
    rig.leftArm.rotation.x *= 0.85;
    rig.rightArm.rotation.x *= 0.85;
    rig.leftElbow.rotation.x = 0.2;
    rig.rightElbow.rotation.x = 0.2;
    rig.torso.rotation.y *= 0.85;
    rig.hips.rotation.z *= 0.85;
    rig.hips.position.y = 0.89 + Math.sin(elapsed * 2.0 + npc.loopIndex) * 0.008;
    rig.head.rotation.y = Math.sin(elapsed * 1.1 + npc.loopIndex) * 0.22;
  } else {
    const s = Math.sin(npc.gaitPhase);
    const c = Math.cos(npc.gaitPhase);
    const swing = s * 0.48;
    rig.hips.position.y = 0.89 + Math.abs(c) * 0.025 - 0.01;
    rig.hips.rotation.z = s * 0.042;
    rig.torso.rotation.set(-0.03, -s * 0.14, -s * 0.035);
    rig.head.rotation.y = s * 0.1;
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.leftKnee.rotation.x = -(0.05 + Math.max(0, Math.sin(npc.gaitPhase + 1.5)) * 0.56);
    rig.rightKnee.rotation.x = -(0.05 + Math.max(0, Math.sin(npc.gaitPhase + Math.PI + 1.5)) * 0.56);
    rig.leftArm.rotation.x = -swing * 0.78;
    rig.rightArm.rotation.x = swing * 0.78;
    rig.leftElbow.rotation.x = 0.24 + Math.max(0, -s) * 0.34;
    rig.rightElbow.rotation.x = 0.24 + Math.max(0, s) * 0.34;
  }
}
