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
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
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

/**
 * Builds an articulated multi-joint sculpted 3D character rig pivoted at bottom-center (y = 0)
 * facing local -Z so rotation.y = playerYaw aligns directly with world forward.
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
      roughness: 0.62,
      metalness: 0.06,
      bumpMap: maps?.fabricBumpMap ?? null,
      bumpScale: maps?.fabricBumpMap ? 0.012 : 0,
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
      bumpScale: maps?.fabricBumpMap ? 0.015 : 0,
    }),
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2b28b, roughness: 0.56, metalness: 0.02 }),
  );
  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e2028, roughness: 0.72, metalness: 0.08 }),
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
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2, metalness: 0.0 }),
  );
  const irisMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2b4d6f, roughness: 0.25, metalness: 0.08 }),
  );
  const pupilMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.12, metalness: 0.1 }),
  );
  const catchlightMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  const browMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x221b17, roughness: 0.78 }),
  );
  const beltLeatherMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x28211c, roughness: 0.48, metalness: 0.12 }),
  );

  const setShadow = (m: THREE.Mesh) => {
    m.castShadow = castShadows;
    m.receiveShadow = castShadows;
    return m;
  };

  // 1. Sculpted Hips / Pelvis assembly (base y = 0.84)
  const hipsGroup = new THREE.Group();
  hipsGroup.position.set(0, 0.84, 0);
  bodyGroup.add(hipsGroup);

  const pelvisMesh = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.145, 0.13, 8, 14)), jeansMat),
  );
  pelvisMesh.rotation.z = Math.PI * 0.5;
  pelvisMesh.scale.set(0.85, 1.0, 0.88);
  pelvisMesh.position.set(0, 0.01, 0);
  hipsGroup.add(pelvisMesh);

  const beltBand = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.185, 0.19, 0.055, 16)),
    beltLeatherMat,
  );
  beltBand.scale.set(1.12, 1, 0.72);
  beltBand.position.set(0, 0.055, 0);
  hipsGroup.add(beltBand);

  const beltBuckle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.085, 0.05, 0.03)), buckleMat);
  beltBuckle.position.set(0, 0.055, -0.138);
  hipsGroup.add(beltBuckle);

  // 2. Sculpted Torso group pivoted at waist (y = +0.08 above hips = 0.92 world)
  const torso = new THREE.Group();
  torso.position.set(0, 0.08, 0);
  hipsGroup.add(torso);

  // Sculpted upper torso + tapered waist + rounded chest silhouette
  const chestMesh = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.225, 0.175, 0.49, 16)), jacketMat),
  );
  chestMesh.scale.set(1.06, 1.0, 0.65);
  chestMesh.position.set(0, 0.25, 0);
  torso.add(chestMesh);

  // Shoulder yoke curve
  const shoulderYoke = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.095, 0.34, 8, 12)), jacketMat),
  );
  shoulderYoke.rotation.z = Math.PI * 0.5;
  shoulderYoke.scale.set(0.95, 1.0, 0.82);
  shoulderYoke.position.set(0, 0.45, 0);
  torso.add(shoulderYoke);

  const innerTee = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.09, 0.065, 0.44, 10)),
    shirtMat,
  );
  innerTee.scale.set(1.0, 1.0, 0.78);
  innerTee.position.set(0, 0.25, -0.078);
  torso.add(innerTee);

  // Jacket/blazer subtle front lapels
  const lapelGeo = trackGeo(new THREE.BoxGeometry(0.048, 0.25, 0.025));
  const lapelL = new THREE.Mesh(lapelGeo, jacketMat);
  lapelL.position.set(-0.075, 0.34, -0.135);
  lapelL.rotation.z = -0.18;
  lapelL.rotation.y = 0.14;
  const lapelR = new THREE.Mesh(lapelGeo, jacketMat);
  lapelR.position.set(0.075, 0.34, -0.135);
  lapelR.rotation.z = 0.18;
  lapelR.rotation.y = -0.14;
  torso.add(lapelL, lapelR);

  const tieMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.42, metalness: 0.18 }),
  );
  const tieMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.052, 0.32, 0.022)), tieMat);
  tieMesh.position.set(0, 0.28, -0.146);
  tieMesh.visible = false;
  torso.add(tieMesh);

  const hoodiePocketMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.07, 0.2, 6, 10)),
    jacketMat,
  );
  hoodiePocketMesh.rotation.z = Math.PI * 0.5;
  hoodiePocketMesh.scale.set(0.85, 1.0, 0.52);
  hoodiePocketMesh.position.set(0, 0.11, -0.125);
  hoodiePocketMesh.visible = false;
  torso.add(hoodiePocketMesh);

  const collar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.115, 0.032, 8, 16)),
    jacketMat,
  );
  collar.rotation.x = Math.PI * 0.5;
  collar.position.set(0, 0.505, 0);
  torso.add(collar);

  // Special Outfits extras
  const vestAccentGroup = new THREE.Group();
  const vestPocketL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.12, 0.03)), buckleMat);
  vestPocketL.position.set(-0.12, 0.16, -0.14);
  const vestPocketR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.12, 0.03)), buckleMat);
  vestPocketR.position.set(0.12, 0.16, -0.14);
  vestAccentGroup.add(vestPocketL, vestPocketR);
  vestAccentGroup.visible = false;
  torso.add(vestAccentGroup);

  const cyberStripeGroup = new THREE.Group();
  const cStripeL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.42, 0.025)), cyberCyanMat);
  cStripeL.position.set(-0.15, 0.25, -0.13);
  const cStripeR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.42, 0.025)), cyberCyanMat);
  cStripeR.position.set(0.15, 0.25, -0.13);
  const cCollar = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.125, 0.025, 8, 16)), cyberCyanMat);
  cCollar.rotation.x = Math.PI * 0.5;
  cCollar.position.set(0, 0.515, 0);
  cyberStripeGroup.add(cStripeL, cStripeR, cCollar);
  cyberStripeGroup.visible = false;
  torso.add(cyberStripeGroup);

  // Secondary Motion Pivot for Coat Tail
  const coatTailPivot = new THREE.Group();
  coatTailPivot.position.set(0, 0.02, 0.04);
  const coatTailMesh = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.205, 0.235, 0.28, 14, 1, false, -0.8, Math.PI * 1.45)), jacketMat),
  );
  coatTailMesh.scale.set(1.06, 1, 0.72);
  coatTailMesh.position.set(0, -0.14, 0.02);
  coatTailMesh.rotation.y = Math.PI * 0.3;
  coatTailPivot.add(coatTailMesh);
  coatTailMesh.visible = false;
  torso.add(coatTailPivot);

  // Backpacks (+Z)
  const backpackGroup = new THREE.Group();
  const backpack = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.13, 0.2, 8, 12)), packMat),
  );
  backpack.scale.set(1.18, 1.0, 0.6);
  backpack.position.set(0, 0.28, 0.175);
  const packTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.036, 0.04)), buckleMat);
  packTrim.position.set(0, 0.34, 0.245);
  const strapL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.045, 0.36, 0.03)), packMat);
  strapL.position.set(-0.11, 0.29, -0.12);
  const strapR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.045, 0.36, 0.03)), packMat);
  strapR.position.set(0.11, 0.29, -0.12);
  backpackGroup.add(backpack, packTrim, strapL, strapR);
  torso.add(backpackGroup);

  const techPackGroup = new THREE.Group();
  const techShell = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.12, 0.24, 8, 12)), visorMat),
  );
  techShell.scale.set(1.15, 1.0, 0.55);
  techShell.position.set(0, 0.29, 0.175);
  const techGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.035, 0.26, 0.035)), cyberCyanMat);
  techGlow.position.set(0, 0.29, 0.238);
  techPackGroup.add(techShell, techGlow);
  techPackGroup.visible = false;
  torso.add(techPackGroup);

  const satchelGroup = new THREE.Group();
  const satchelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c4a28, roughness: 0.65 }));
  const satchelBox = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.22, 0.09)), satchelMat),
  );
  satchelBox.position.set(0.12, 0.15, 0.165);
  const satchelStrap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.035, 0.48, 0.29)), satchelMat);
  satchelStrap.position.set(0, 0.29, 0);
  satchelStrap.rotation.z = 0.55;
  satchelGroup.add(satchelBox, satchelStrap);
  satchelGroup.visible = false;
  torso.add(satchelGroup);

  // Neck Accessories (with Scarf secondary motion pivot)
  const scarfGroup = new THREE.Group();
  const scarfMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.85 }));
  const scarfRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.115, 0.038, 8, 16)), scarfMat);
  scarfRing.rotation.x = Math.PI * 0.5;
  scarfRing.position.set(0, 0.525, 0);
  const scarfTailPivot = new THREE.Group();
  scarfTailPivot.position.set(0.08, 0.5, -0.11);
  const scarfTail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.22, 0.032)), scarfMat);
  scarfTail.position.set(0, -0.11, -0.02);
  scarfTailPivot.add(scarfTail);
  scarfGroup.add(scarfRing, scarfTailPivot);
  scarfGroup.visible = false;
  torso.add(scarfGroup);

  const medalGroup = new THREE.Group();
  const ribbonMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 }));
  const ribbonL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.22, 0.025)), ribbonMat);
  ribbonL.position.set(-0.04, 0.4, -0.135);
  ribbonL.rotation.z = -0.2;
  const ribbonR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.22, 0.025)), ribbonMat);
  ribbonR.position.set(0.04, 0.4, -0.135);
  ribbonR.rotation.z = 0.2;
  const medalDisc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 14)), goldMat);
  medalDisc.rotation.x = Math.PI * 0.5;
  medalDisc.position.set(0, 0.29, -0.145);
  medalGroup.add(ribbonL, ribbonR, medalDisc);
  medalGroup.visible = false;
  torso.add(medalGroup);

  const headphonesGroup = new THREE.Group();
  const hpBand = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.14, 0.02, 8, 16, Math.PI)), visorMat);
  hpBand.rotation.x = Math.PI * 0.55;
  hpBand.position.set(0, 0.52, 0.02);
  const hpCupL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.044, 0.044, 0.038, 12)), cyberCyanMat);
  hpCupL.rotation.z = Math.PI * 0.5;
  hpCupL.position.set(-0.14, 0.51, -0.07);
  const hpCupR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.044, 0.044, 0.038, 12)), cyberCyanMat);
  hpCupR.rotation.z = Math.PI * 0.5;
  hpCupR.position.set(0.14, 0.51, -0.07);
  headphonesGroup.add(hpBand, hpCupL, hpCupR);
  headphonesGroup.visible = false;
  torso.add(headphonesGroup);

  // 3. Sculpted Head Group (pivoted at neck y = 0.54 relative to torso)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.54, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.068, 0.08, 0.11, 12)), skinMat);
  neck.position.set(0, 0.035, 0);
  headGroup.add(neck);

  // Sculpted Cranium + Cheek/Jaw silhouette
  const cranium = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.148, 18, 16)), skinMat),
  );
  cranium.scale.set(0.95, 1.04, 0.98);
  cranium.position.set(0, 0.215, 0.005);
  headGroup.add(cranium);

  const jaw = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.118, 14, 12)), skinMat),
  );
  jaw.scale.set(0.9, 0.86, 0.88);
  jaw.position.set(0, 0.155, -0.018);
  headGroup.add(jaw);

  // Sculpted 3D Ears
  const earGeo = trackGeo(new THREE.SphereGeometry(0.036, 10, 10));
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.scale.set(0.45, 1.0, 0.72);
  earL.position.set(-0.142, 0.195, 0.01);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.scale.set(0.45, 1.0, 0.72);
  earR.position.set(0.142, 0.195, 0.01);
  headGroup.add(earL, earR);

  // Sculpted 3D Nose
  const nose = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.024, 10, 10)), skinMat);
  nose.scale.set(0.85, 0.95, 1.2);
  nose.position.set(0, 0.192, -0.142);
  headGroup.add(nose);

  // 3D Sculpted Eyes (sclera + colored iris + pupil + specular catchlight + blinking upper eyelids)
  const buildEye = (side: -1 | 1) => {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(side * 0.052, 0.222, -0.124);

    const sclera = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.025, 12, 10)), scleraMat);
    sclera.scale.set(1.0, 1.05, 0.75);
    eyePivot.add(sclera);

    const iris = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.016, 10, 10)), irisMat);
    iris.scale.set(1.0, 1.0, 0.5);
    iris.position.set(0, 0, -0.013);
    eyePivot.add(iris);

    const pupil = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.009, 8, 8)), pupilMat);
    pupil.scale.set(1.0, 1.0, 0.5);
    pupil.position.set(0, 0, -0.018);
    eyePivot.add(pupil);

    const catchlight = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0042, 6, 6)), catchlightMat);
    catchlight.position.set(side * 0.005, 0.006, -0.021);
    eyePivot.add(catchlight);

    const eyelid = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0275, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
      skinMat,
    );
    eyelid.scale.set(1.04, 1.06, 0.84);
    eyelid.rotation.x = -0.35;
    eyePivot.add(eyelid);

    headGroup.add(eyePivot);
    return eyelid;
  };
  const eyelidL = buildEye(-1);
  const eyelidR = buildEye(1);

  // 3D Sculpted Eyebrows
  const browGeo = trackGeo(new THREE.CapsuleGeometry(0.0085, 0.036, 4, 8));
  const browL = new THREE.Mesh(browGeo, browMat);
  browL.rotation.z = Math.PI * 0.5;
  browL.position.set(-0.054, 0.258, -0.13);
  const browR = new THREE.Mesh(browGeo, browMat);
  browR.rotation.z = Math.PI * 0.5;
  browR.position.set(0.054, 0.258, -0.13);
  headGroup.add(browL, browR);

  // Expressive Mouth & Cheek Tint Decal Plane (layered seamlessly over lower sculpted jaw)
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128;
  faceCanvas.height = 64;
  const faceCtx = faceCanvas.getContext('2d')!;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  textures.push(faceTex);
  const faceMat = trackMat(
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false }),
  );
  const facePlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.145, 0.072)), faceMat);
  facePlane.position.set(0, 0.148, -0.134);
  facePlane.rotation.y = Math.PI;
  headGroup.add(facePlane);

  let currentFaceStyle: FaceStyleId = 'friendly';
  let currentFaceMood: FaceMood = 'neutral';
  let lastFaceKey = '';
  const updateFaceStyle = (face: FaceStyleId, _skinColor: number, mood?: FaceMood) => {
    currentFaceStyle = face;
    const resolvedMood: FaceMood = mood ?? currentFaceMood;
    currentFaceMood = resolvedMood;

    // Update 3D eyebrow expression angles
    if (face === 'determined' || resolvedMood === 'focused') {
      browL.rotation.z = Math.PI * 0.5 - 0.22;
      browR.rotation.z = Math.PI * 0.5 + 0.22;
      browL.position.y = 0.254;
      browR.position.y = 0.254;
    } else if (face === 'cool') {
      browL.rotation.z = Math.PI * 0.5 - 0.04;
      browR.rotation.z = Math.PI * 0.5 - 0.14;
      browL.position.y = 0.258;
      browR.position.y = 0.264;
    } else if (resolvedMood === 'grin') {
      browL.rotation.z = Math.PI * 0.5 + 0.1;
      browR.rotation.z = Math.PI * 0.5 - 0.1;
      browL.position.y = 0.264;
      browR.position.y = 0.264;
    } else {
      browL.rotation.z = Math.PI * 0.5 + 0.06;
      browR.rotation.z = Math.PI * 0.5 - 0.06;
      browL.position.y = 0.259;
      browR.position.y = 0.259;
    }

    const key = `${face}|${resolvedMood}`;
    if (key === lastFaceKey) return;
    lastFaceKey = key;
    faceCtx.clearRect(0, 0, 128, 64);

    // Subtle soft cheek warmth
    faceCtx.fillStyle = 'rgba(225, 110, 100, 0.22)';
    faceCtx.beginPath();
    faceCtx.ellipse(24, 16, 14, 7, 0, 0, Math.PI * 2);
    faceCtx.ellipse(104, 16, 14, 7, 0, 0, Math.PI * 2);
    faceCtx.fill();

    // Mouth stroke
    faceCtx.strokeStyle = '#6d2e24';
    faceCtx.lineWidth = 4.2;
    faceCtx.lineCap = 'round';
    faceCtx.beginPath();
    if (resolvedMood === 'grin' || face === 'cheerful') {
      faceCtx.fillStyle = '#ffffff';
      faceCtx.moveTo(42, 24);
      faceCtx.quadraticCurveTo(64, 48, 86, 24);
      faceCtx.closePath();
      faceCtx.fill();
      faceCtx.stroke();
    } else if (resolvedMood === 'focused' || face === 'determined') {
      faceCtx.moveTo(48, 30);
      faceCtx.quadraticCurveTo(64, 28, 80, 30);
      faceCtx.stroke();
    } else if (face === 'cool' || resolvedMood === 'wink') {
      faceCtx.moveTo(46, 30);
      faceCtx.quadraticCurveTo(68, 38, 84, 24);
      faceCtx.stroke();
    } else {
      faceCtx.arc(64, 22, 16, 0.22 * Math.PI, 0.78 * Math.PI);
      faceCtx.stroke();
    }
    faceTex.needsUpdate = true;
  };
  updateFaceStyle('friendly', 0xe2b28b, 'smile');

  // 4. Sculpted Layered 3D Hairstyles + Secondary Motion Child Pivots
  const hairShort = new THREE.Group();
  const hsCrown = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.156, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)), hairMat),
  );
  hsCrown.position.set(0, 0.225, 0.01);
  hsCrown.rotation.x = 0.22;
  const hsBangs = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.042, 0.14, 6, 10)), hairMat);
  hsBangs.rotation.z = Math.PI * 0.5;
  hsBangs.rotation.x = 0.35;
  hsBangs.position.set(0, 0.305, -0.095);
  const hsBack = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.135, 12, 10)), hairMat);
  hsBack.scale.set(0.95, 0.9, 0.7);
  hsBack.position.set(0, 0.22, 0.068);
  hairShort.add(hsCrown, hsBangs, hsBack);
  headGroup.add(hairShort);

  const hairCurly = new THREE.Group();
  [
    [0, 0.35, 0.01, 0.115],
    [-0.095, 0.32, -0.02, 0.09],
    [0.095, 0.32, -0.02, 0.09],
    [0, 0.32, 0.095, 0.1],
    [-0.1, 0.27, 0.075, 0.085],
    [0.1, 0.27, 0.075, 0.085],
    [0, 0.335, -0.085, 0.08],
    [-0.065, 0.34, -0.075, 0.072],
    [0.065, 0.34, -0.075, 0.072],
  ].forEach(([cx, cy, cz, cr]) => {
    const puff = setShadow(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(cr, 10, 10)), hairMat));
    puff.position.set(cx, cy, cz);
    hairCurly.add(puff);
  });
  hairCurly.visible = false;
  headGroup.add(hairCurly);

  const hairLongWave = new THREE.Group();
  const lwCrown = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.158, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65)), hairMat),
  );
  lwCrown.position.set(0, 0.225, 0.012);
  const longWavePivot = new THREE.Group();
  longWavePivot.position.set(0, 0.26, 0.08);
  const lwCurtain = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.125, 0.2, 8, 12)), hairMat),
  );
  lwCurtain.scale.set(1.12, 1.0, 0.56);
  lwCurtain.position.set(0, -0.15, 0.045);
  const lwSideL = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.036, 0.18, 6, 8)), hairMat);
  lwSideL.position.set(-0.135, -0.12, -0.06);
  const lwSideR = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.036, 0.18, 6, 8)), hairMat);
  lwSideR.position.set(0.135, -0.12, -0.06);
  longWavePivot.add(lwCurtain, lwSideL, lwSideR);
  hairLongWave.add(lwCrown, longWavePivot);
  hairLongWave.visible = false;
  headGroup.add(hairLongWave);

  const hairPonytail = new THREE.Group();
  const ptCrown = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.156, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)), hairMat),
  );
  ptCrown.position.set(0, 0.225, 0.01);
  ptCrown.rotation.x = 0.2;
  const ptTie = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.036, 0.012, 8, 12)), goldMat);
  ptTie.position.set(0, 0.28, 0.145);
  const ponytailPivot = new THREE.Group();
  ponytailPivot.position.set(0, 0.28, 0.15);
  const ptTail = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.044, 0.18, 8, 10)), hairMat),
  );
  ptTail.position.set(0, -0.11, 0.035);
  ptTail.rotation.x = 0.26;
  ponytailPivot.add(ptTail);
  hairPonytail.add(ptCrown, ptTie, ponytailPivot);
  hairPonytail.visible = false;
  headGroup.add(hairPonytail);

  const hairFade = new THREE.Group();
  const fdCrown = setShadow(new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.095, 0.09, 8, 12)), hairMat));
  fdCrown.rotation.x = Math.PI * 0.5;
  fdCrown.scale.set(1.1, 1.0, 0.75);
  fdCrown.position.set(0, 0.345, -0.01);
  const fdBase = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.148, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45)), hairMat);
  fdBase.position.set(0, 0.23, 0.01);
  hairFade.add(fdCrown, fdBase);
  hairFade.visible = false;
  headGroup.add(hairFade);

  const hairBob = new THREE.Group();
  const bobCrown = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65)), hairMat),
  );
  bobCrown.position.set(0, 0.225, 0.01);
  const bobPivot = new THREE.Group();
  bobPivot.position.set(0, 0.25, 0.02);
  const bobSides = setShadow(
    new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.155, 0.17, 0.17, 14, 1, false, -Math.PI * 0.15, Math.PI * 1.3)), hairMat),
  );
  bobSides.position.set(0, -0.075, 0.01);
  bobSides.rotation.y = Math.PI * 0.35;
  bobPivot.add(bobSides);
  hairBob.add(bobCrown, bobPivot);
  hairBob.visible = false;
  headGroup.add(hairBob);

  // Hats (cap, beanie, fedora, grad_cap)
  const capGroup = new THREE.Group();
  const capMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.62, metalness: 0.08 }),
  );
  const capCrown = setShadow(
    new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.162, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), capMat),
  );
  capCrown.position.set(0, 0.275, 0.01);
  const capBrim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.155, 0.02, 14, 1, false, -0.9, 1.8)), capMat);
  capBrim.position.set(0, 0.305, -0.075);
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
    trackGeo(new THREE.SphereGeometry(0.162, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    beanieMat,
  );
  beanieDome.position.set(0, 0.275, 0.01);
  const beanieCuff = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.145, 0.03, 8, 16)), beanieMat);
  beanieCuff.rotation.x = Math.PI * 0.5;
  beanieCuff.position.set(0, 0.295, 0.01);
  beanieGroup.add(beanieDome, beanieCuff);
  beanieGroup.visible = false;
  headGroup.add(beanieGroup);

  const fedoraGroup = new THREE.Group();
  const fedoraMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.68 }));
  const fedBrim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.225, 0.225, 0.018, 18)), fedoraMat);
  fedBrim.position.set(0, 0.33, 0);
  const fedCrown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.125, 0.152, 0.11, 14)), fedoraMat);
  fedCrown.position.set(0, 0.39, 0);
  const fedBand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.154, 0.154, 0.026, 14)), goldMat);
  fedBand.position.set(0, 0.352, 0);
  fedoraGroup.add(fedBrim, fedCrown, fedBand);
  fedoraGroup.visible = false;
  headGroup.add(fedoraGroup);

  const gradCapGroup = new THREE.Group();
  const gradMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55 }));
  const gradBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.142, 0.155, 0.075, 14)), gradMat);
  gradBase.position.set(0, 0.345, 0);
  const gradBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 0.022, 0.35)), gradMat);
  gradBoard.position.set(0, 0.395, 0);
  const gradTassel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.018, 0.11, 8)), goldMat);
  gradTassel.position.set(0.155, 0.335, -0.05);
  gradCapGroup.add(gradBase, gradBoard, gradTassel);
  gradCapGroup.visible = false;
  headGroup.add(gradCapGroup);

  // Glasses (shades, round_frames, visor)
  const shadesGroup = new THREE.Group();
  const sunglasses = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.056, 0.032)), visorMat);
  sunglasses.position.set(0, 0.222, -0.142);
  shadesGroup.add(sunglasses);
  shadesGroup.visible = false;
  headGroup.add(shadesGroup);

  const roundGlassesGroup = new THREE.Group();
  const lensL = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.038, 0.008, 8, 16)), goldMat);
  lensL.position.set(-0.054, 0.222, -0.145);
  const lensR = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.038, 0.008, 8, 16)), goldMat);
  lensR.position.set(0.054, 0.222, -0.145);
  const bridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.032, 0.01, 0.012)), goldMat);
  bridge.position.set(0, 0.222, -0.145);
  roundGlassesGroup.add(lensL, lensR, bridge);
  roundGlassesGroup.visible = false;
  headGroup.add(roundGlassesGroup);

  const visorGroup = new THREE.Group();
  const visorShield = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.155, 0.155, 0.072, 16, 1, true, -0.95, 1.9)), cyberCyanMat);
  visorShield.rotation.y = Math.PI;
  visorShield.position.set(0, 0.225, -0.01);
  visorGroup.add(visorShield);
  visorGroup.visible = false;
  headGroup.add(visorGroup);

  // 5. Sculpted Articulated Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Sculpted Hand)
  const upperArmMeshes: THREE.Mesh[] = [];
  const makeArm = (side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.275, 0.445, 0);

    const shoulderCap = setShadow(
      new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.074, 12, 10)), jacketMat),
    );
    shoulder.add(shoulderCap);

    const upperArm = setShadow(
      new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.064, 0.17, 6, 10)), jacketMat),
    );
    upperArm.position.set(0, -0.13, 0);
    shoulder.add(upperArm);
    upperArmMeshes.push(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.255, 0);
    shoulder.add(elbow);

    const forearm = setShadow(
      new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.05, 0.155, 6, 10)), skinMat),
    );
    forearm.position.set(0, -0.11, 0);
    elbow.add(forearm);

    const hand = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.052, 10, 10)), skinMat);
    hand.scale.set(0.85, 1.12, 0.68);
    hand.position.set(0, -0.245, -0.01);
    elbow.add(hand);

    torso.add(shoulder);
    return { shoulder, elbow };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Wrist Watches mounted to left forearm
  const sportWatchGroup = new THREE.Group();
  const swBand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.056, 0.056, 0.036, 12)), visorMat);
  swBand.position.set(0, -0.185, 0);
  const swFace = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.048, 0.04, 0.022)), cyberCyanMat);
  swFace.position.set(0, -0.185, -0.055);
  sportWatchGroup.add(swBand, swFace);
  sportWatchGroup.visible = false;
  leftArm.elbow.add(sportWatchGroup);

  const goldWatchGroup = new THREE.Group();
  const gwBand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.056, 0.056, 0.038, 12)), goldMat);
  gwBand.position.set(0, -0.185, 0);
  goldWatchGroup.add(gwBand);
  goldWatchGroup.visible = false;
  leftArm.elbow.add(goldWatchGroup);

  const smartBandGroup = new THREE.Group();
  const sbBand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.054, 0.054, 0.028, 12)), cyberCyanMat);
  sbBand.position.set(0, -0.185, 0);
  smartBandGroup.add(sbBand);
  smartBandGroup.visible = false;
  leftArm.elbow.add(smartBandGroup);

  // 6. Sculpted Articulated Legs (Hip -> Thigh -> Knee -> Shin -> Ankle -> Multi-part Shoe)
  const cargoPocketMeshes: THREE.Mesh[] = [];
  const makeLeg = (
    side: -1 | 1,
  ): { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115, -0.05, 0);

    const thigh = setShadow(
      new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.084, 0.22, 6, 12)), jeansMat),
    );
    thigh.position.set(0, -0.17, 0);
    hip.add(thigh);

    const cargoPocket = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.034, 0.13, 0.11)),
      jeansMat,
    );
    cargoPocket.position.set(side * 0.082, -0.19, 0);
    cargoPocket.visible = false;
    hip.add(cargoPocket);
    cargoPocketMeshes.push(cargoPocket);

    const knee = new THREE.Group();
    knee.position.set(0, -0.35, 0);
    hip.add(knee);

    const shin = setShadow(
      new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.072, 0.21, 6, 12)), jeansMat),
    );
    shin.position.set(0, -0.17, 0);
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.34, 0);
    knee.add(ankle);

    // Multi-part sculpted footwear (upper + toe cap + sole)
    const shoeUpper = setShadow(
      new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.068, 0.12, 6, 10)), shoeMat),
    );
    shoeUpper.rotation.x = Math.PI * 0.5;
    shoeUpper.scale.set(1.05, 1.0, 0.82);
    shoeUpper.position.set(0, -0.025, -0.038);

    const shoeSole = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.152, 0.036, 0.25)),
      soleMat,
    );
    shoeSole.position.set(0, -0.072, -0.042);

    ankle.add(shoeUpper, shoeSole);
    hipsGroup.add(hip);
    return { hip, knee, ankle };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  const shadowGeo = trackGeo(new THREE.CircleGeometry(0.62, 24));
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
  contactShadow.position.set(0, 0.02, 0);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    hipsGroup,
    torso,
    headGroup,
    leftArmPivot: leftArm.shoulder,
    leftElbowPivot: leftArm.elbow,
    rightArmPivot: rightArm.shoulder,
    rightElbowPivot: rightArm.elbow,
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
    rig.baseScale = { x: 1.07, y: 1.02, z: 1.06 };
  } else if (body === 'slim') {
    rig.baseScale = { x: 0.91, y: 1.0, z: 0.92 };
  } else if (body === 'tall') {
    rig.baseScale = { x: 0.96, y: 1.09, z: 0.96 };
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
  rig.contactShadow.position.y = groundY - y + 0.02;
  const shadowScale = Math.max(0.45, 1 - heightAboveGround * 0.16);
  rig.contactShadow.scale.set(shadowScale, shadowScale, 1);
  (rig.contactShadow.material as THREE.MeshBasicMaterial).opacity =
    Math.max(0.15, 0.55 - heightAboveGround * 0.12);

  rig.hipsGroup.position.set(0, 0.84 + pose.hipsY, 0);
  rig.hipsGroup.rotation.set(pose.hipsPitch, 0, pose.hipsRoll);

  rig.torso.rotation.set(pose.torsoPitch, pose.torsoYaw, pose.torsoRoll);
  rig.headGroup.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);

  rig.leftArmPivot.rotation.set(pose.lShoulderX, 0, pose.lShoulderZ);
  rig.leftElbowPivot.rotation.set(pose.lElbowX, 0, 0);

  rig.rightArmPivot.rotation.set(pose.rShoulderX, 0, pose.rShoulderZ);
  rig.rightElbowPivot.rotation.set(pose.rElbowX, 0, 0);

  rig.leftLegPivot.rotation.set(pose.lHipX, 0, pose.lHipZ);
  rig.leftKneePivot.rotation.set(pose.lKneeX, 0, 0);
  rig.leftAnklePivot.rotation.set(pose.lAnkleX, 0, 0);

  rig.rightLegPivot.rotation.set(pose.rHipX, 0, pose.rHipZ);
  rig.rightKneePivot.rotation.set(pose.rKneeX, 0, 0);
  rig.rightAnklePivot.rotation.set(pose.rAnkleX, 0, 0);

  // Secondary motion for hair, coat tail, and scarf
  rig.ponytailPivot.rotation.set(pose.hairSwingX, 0, pose.hairSwingZ);
  rig.longWavePivot.rotation.set(pose.hairSwingX * 0.65, 0, pose.hairSwingZ * 0.75);
  rig.bobPivot.rotation.set(pose.hairSwingX * 0.35, 0, pose.hairSwingZ * 0.45);
  rig.coatTailPivot.rotation.set(pose.coatSwingX, 0, pose.hairSwingZ * 0.35);
  rig.scarfTailPivot.rotation.set(pose.hairSwingX * 0.75, 0, pose.scarfSwingZ);

  // Blinking & winking eyelids
  const blink = Math.max(0, Math.min(1, pose.blinkWeight));
  rig.eyelidL.rotation.x = -0.35 + blink * 1.45;
  rig.eyelidR.rotation.x = -0.35 + (pose.faceMood === 'wink' ? 1.15 : blink * 1.45);
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
  rig.contactShadow.position.y = groundY - state.y + 0.02;
  const shadowScale = Math.max(0.45, 1 - heightAboveGround * 0.16);
  rig.contactShadow.scale.set(shadowScale, shadowScale, 1);
  (rig.contactShadow.material as THREE.MeshBasicMaterial).opacity =
    Math.max(0.15, 0.55 - heightAboveGround * 0.12);

  if (!state.grounded) {
    const airFactor = Math.max(-1, Math.min(1, state.vy * 0.12));
    rig.leftLegPivot.rotation.x = 0.35 + airFactor * 0.15;
    rig.rightLegPivot.rotation.x = -0.3 - airFactor * 0.1;
    rig.leftKneePivot.rotation.x = -0.55;
    rig.rightKneePivot.rotation.x = -0.35;
    rig.leftArmPivot.rotation.x = -0.55 - airFactor * 0.25;
    rig.rightArmPivot.rotation.x = 0.45 - airFactor * 0.2;
    rig.leftElbowPivot.rotation.x = 0.45;
    rig.rightElbowPivot.rotation.x = 0.45;
    rig.torso.rotation.x = -0.08;
    rig.hipsGroup.position.y = 0.84;
  } else if (state.isMoving) {
    const amp = state.isSprinting ? 0.85 : 0.56;
    const swing = Math.sin(state.gaitPhase) * amp;
    const bounce = Math.abs(Math.sin(state.gaitPhase)) * (state.isSprinting ? 0.07 : 0.035);

    rig.leftLegPivot.rotation.x = swing;
    rig.rightLegPivot.rotation.x = -swing;
    rig.leftKneePivot.rotation.x = -Math.max(0, -swing) * 0.85;
    rig.rightKneePivot.rotation.x = -Math.max(0, swing) * 0.85;
    rig.leftArmPivot.rotation.x = -swing * 0.88;
    rig.rightArmPivot.rotation.x = swing * 0.88;
    rig.leftElbowPivot.rotation.x = 0.38;
    rig.rightElbowPivot.rotation.x = 0.38;
    rig.torso.rotation.x = state.isSprinting ? -0.16 : -0.06;
    rig.torso.rotation.y = Math.cos(state.gaitPhase) * 0.05;
    rig.hipsGroup.position.y = 0.84 + bounce;
  } else {
    const breath = Math.sin(elapsed * 2.2);
    rig.leftLegPivot.rotation.x *= 0.82;
    rig.rightLegPivot.rotation.x *= 0.82;
    rig.leftKneePivot.rotation.x *= 0.82;
    rig.rightKneePivot.rotation.x *= 0.82;
    rig.leftArmPivot.rotation.x *= 0.82;
    rig.rightArmPivot.rotation.x *= 0.82;
    rig.leftElbowPivot.rotation.x = 0.14;
    rig.rightElbowPivot.rotation.x = 0.14;
    rig.leftArmPivot.rotation.z = 0.06 + breath * 0.015;
    rig.rightArmPivot.rotation.z = -0.06 - breath * 0.015;
    rig.torso.rotation.x = 0;
    rig.torso.rotation.y = 0;
    rig.hipsGroup.position.y = 0.84 + breath * 0.012;
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
  sprite.scale.set(1.85, 0.44, 1);
  sprite.position.set(0, 2.22, 0);

  let lastKey = '';

  const redraw = (displayName: string, isOnline: boolean, activityTag?: string | null) => {
    const safeName = (displayName || 'Student').slice(0, 18);
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
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
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
  const skinMat = tm(new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.6 }));
  const hairMat = tm(new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.8 }));
  const shoeMat = tm(new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.45 }));
  const eyeMat = tm(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2 }));

  const torso = new THREE.Mesh(tg(new THREE.CylinderGeometry(0.2, 0.165, 0.52, 12)), jacketMat);
  torso.scale.set(1.04, 1, 0.64);
  torso.position.set(0, 1.15, 0);
  torso.castShadow = castShadows;
  root.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 1.48, 0);
  const headSphere = new THREE.Mesh(tg(new THREE.SphereGeometry(0.138, 12, 12)), skinMat);
  headSphere.scale.set(0.95, 1.05, 0.96);
  headSphere.position.y = 0.14;
  headSphere.castShadow = castShadows;
  head.add(headSphere);

  const npcEyeGeo = tg(new THREE.SphereGeometry(0.016, 6, 6));
  const npcEyeL = new THREE.Mesh(npcEyeGeo, eyeMat);
  npcEyeL.position.set(-0.045, 0.15, -0.12);
  const npcEyeR = new THREE.Mesh(npcEyeGeo, eyeMat);
  npcEyeR.position.set(0.045, 0.15, -0.12);
  head.add(npcEyeL, npcEyeR);

  const hair = new THREE.Mesh(
    tg(new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    hairMat,
  );
  hair.position.set(0, 0.155, 0.01);
  head.add(hair);

  if (pal.hat === 'cap') {
    const capMat = tm(new THREE.MeshStandardMaterial({ color: 0x22384f, roughness: 0.65 }));
    const capCrown = new THREE.Mesh(
      tg(new THREE.SphereGeometry(0.148, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
      capMat,
    );
    capCrown.position.y = 0.19;
    const capBrim = new THREE.Mesh(tg(new THREE.BoxGeometry(0.22, 0.022, 0.12)), capMat);
    capBrim.position.set(0, 0.21, -0.14);
    head.add(capCrown, capBrim);
  } else if (pal.hat === 'hardhat') {
    const hatMat = tm(new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: 0.35 }));
    const dome = new THREE.Mesh(
      tg(new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
      hatMat,
    );
    dome.position.y = 0.195;
    head.add(dome);
  }
  root.add(head);

  const makeLimb = (r: number, len: number, x: number, y: number, mat: THREE.Material) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(tg(new THREE.CapsuleGeometry(r, len, 4, 8)), mat);
    mesh.position.y = -(len * 0.5 + r);
    mesh.castShadow = castShadows;
    pivot.add(mesh);
    root.add(pivot);
    return pivot;
  };

  const leftArm = makeLimb(0.052, 0.36, -0.255, 1.38, jacketMat);
  const rightArm = makeLimb(0.052, 0.36, 0.255, 1.38, jacketMat);
  const leftLeg = makeLimb(0.072, 0.56, -0.105, 0.86, pantsMat);
  const rightLeg = makeLimb(0.072, 0.56, 0.105, 0.86, pantsMat);

  const shoeGeo = tg(new THREE.CapsuleGeometry(0.06, 0.1, 4, 8));
  const ls = new THREE.Mesh(shoeGeo, shoeMat);
  ls.rotation.x = Math.PI * 0.5;
  ls.position.set(0, -0.79, -0.03);
  leftLeg.add(ls);
  const rs = new THREE.Mesh(shoeGeo, shoeMat);
  rs.rotation.x = Math.PI * 0.5;
  rs.position.set(0, -0.79, -0.03);
  rightLeg.add(rs);

  const shadow = new THREE.Mesh(
    tg(new THREE.CircleGeometry(0.5, 16)),
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
  shadow.position.y = 0.02;
  root.add(shadow);

  return {
    root,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
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
    rig.leftArm.rotation.x *= 0.85;
    rig.rightArm.rotation.x *= 0.85;
    rig.head.rotation.y = Math.sin(elapsed * 1.1 + npc.loopIndex) * 0.22;
  } else {
    const swing = Math.sin(npc.gaitPhase) * 0.48;
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.leftArm.rotation.x = -swing * 0.8;
    rig.rightArm.rotation.x = swing * 0.8;
    rig.head.rotation.y *= 0.9;
  }
}
