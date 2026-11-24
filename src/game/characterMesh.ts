import * as THREE from 'three';
import type { ArticulatedPose } from './characterAnimator';
import { normalizeCharacterCustomization } from './rewardShopCatalog';
import type { CharacterCustomization, FaceStyleId, NpcState, PlayerState } from './types';

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
  // Expanded modular visual slots
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
  cargoPocketMeshes: THREE.Mesh[];
  updateFaceStyle: (face: FaceStyleId, skinColor: number) => void;
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
 * Builds an articulated multi-joint 3D character rig pivoted at bottom-center (y = 0)
 * facing local -Z so rotation.y = playerYaw aligns directly with world forward.
 */
export function createCharacterRig(
  contactShadowMap: THREE.Texture,
  castShadows: boolean,
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
    new THREE.MeshStandardMaterial({ color: 0xc9542b, roughness: 0.55, metalness: 0.05 }),
  );
  const shirtMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.85, metalness: 0.0 }),
  );
  const jeansMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x26384d, roughness: 0.88, metalness: 0.04 }),
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2b28b, roughness: 0.65, metalness: 0.02 }),
  );
  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e2028, roughness: 0.88, metalness: 0.05 }),
  );
  const shoeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.34, metalness: 0.05 }),
  );
  const visorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.14, metalness: 0.72 }),
  );
  const packMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2d323b, roughness: 0.78, metalness: 0.08 }),
  );
  const buckleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd6b36a, roughness: 0.24, metalness: 0.88 }),
  );
  const cyberCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    }),
  );
  const goldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.85 }),
  );

  const setShadow = (m: THREE.Mesh) => {
    m.castShadow = castShadows;
    m.receiveShadow = castShadows;
    return m;
  };

  // Hips / Pelvis assembly (base y = 0.84)
  const hipsGroup = new THREE.Group();
  hipsGroup.position.set(0, 0.84, 0);
  bodyGroup.add(hipsGroup);

  const pelvisMesh = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.16, 0.25)), jeansMat),
  );
  pelvisMesh.position.set(0, 0, 0);
  hipsGroup.add(pelvisMesh);

  const beltBuckle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.06, 0.27)), buckleMat);
  beltBuckle.position.set(0, 0.04, -0.01);
  hipsGroup.add(beltBuckle);

  // Torso group pivoted at waist (y = +0.08 above hips = 0.92 world)
  const torso = new THREE.Group();
  torso.position.set(0, 0.08, 0);
  hipsGroup.add(torso);

  const chestMesh = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.5, 0.27)), jacketMat),
  );
  chestMesh.position.set(0, 0.25, 0);
  torso.add(chestMesh);

  const innerTee = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.46, 0.285)), shirtMat);
  innerTee.position.set(0, 0.25, -0.005);
  torso.add(innerTee);

  const tieMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45, metalness: 0.15 }),
  );
  const tieMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.34, 0.295)), tieMat);
  tieMesh.position.set(0, 0.28, -0.008);
  tieMesh.visible = false;
  torso.add(tieMesh);

  const hoodiePocketMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.32, 0.16, 0.295)),
    jacketMat,
  );
  hoodiePocketMesh.position.set(0, 0.12, -0.01);
  hoodiePocketMesh.visible = false;
  torso.add(hoodiePocketMesh);

  const collar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.08, 12)), jacketMat);
  collar.position.set(0, 0.51, 0);
  torso.add(collar);

  // Special Outfits extras: Explorer Vest pockets, Cyber neon stripes, Champion coat tail
  const vestAccentGroup = new THREE.Group();
  const vestPocketL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.13, 0.3)), buckleMat);
  vestPocketL.position.set(-0.13, 0.16, -0.01);
  const vestPocketR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.13, 0.3)), buckleMat);
  vestPocketR.position.set(0.13, 0.16, -0.01);
  vestAccentGroup.add(vestPocketL, vestPocketR);
  vestAccentGroup.visible = false;
  torso.add(vestAccentGroup);

  const cyberStripeGroup = new THREE.Group();
  const cStripeL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.035, 0.44, 0.29)), cyberCyanMat);
  cStripeL.position.set(-0.17, 0.25, 0);
  const cStripeR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.035, 0.44, 0.29)), cyberCyanMat);
  cStripeR.position.set(0.17, 0.25, 0);
  const cCollar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.17, 0.07, 12)), cyberCyanMat);
  cCollar.position.set(0, 0.52, 0);
  cyberStripeGroup.add(cStripeL, cStripeR, cCollar);
  cyberStripeGroup.visible = false;
  torso.add(cyberStripeGroup);

  const coatTailMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.49, 0.28, 0.26)), jacketMat);
  coatTailMesh.position.set(0, -0.08, 0.01);
  coatTailMesh.visible = false;
  torso.add(coatTailMesh);

  // Backpacks (+Z)
  const backpackGroup = new THREE.Group();
  const backpack = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.38, 0.14)), packMat),
  );
  backpack.position.set(0, 0.27, 0.18);
  const packTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.04, 0.15)), buckleMat);
  packTrim.position.set(0, 0.36, 0.185);
  backpackGroup.add(backpack, packTrim);
  torso.add(backpackGroup);

  const techPackGroup = new THREE.Group();
  const techShell = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.42, 0.12)), visorMat),
  );
  techShell.position.set(0, 0.28, 0.18);
  const techGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.3, 0.135)), cyberCyanMat);
  techGlow.position.set(0, 0.28, 0.185);
  techPackGroup.add(techShell, techGlow);
  techPackGroup.visible = false;
  torso.add(techPackGroup);

  const satchelGroup = new THREE.Group();
  const satchelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c4a28, roughness: 0.72 }));
  const satchelBox = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.24, 0.1)), satchelMat),
  );
  satchelBox.position.set(0.11, 0.16, 0.17);
  satchelGroup.add(satchelBox);
  satchelGroup.visible = false;
  torso.add(satchelGroup);

  // Neck Accessories
  const scarfGroup = new THREE.Group();
  const scarfMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.85 }));
  const scarfRing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.17, 0.09, 12)), scarfMat);
  scarfRing.position.set(0, 0.52, 0);
  const scarfTail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.22, 0.04)), scarfMat);
  scarfTail.position.set(0.08, 0.39, -0.14);
  scarfGroup.add(scarfRing, scarfTail);
  scarfGroup.visible = false;
  torso.add(scarfGroup);

  const medalGroup = new THREE.Group();
  const ribbonMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 }));
  const ribbonL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.22, 0.295)), ribbonMat);
  ribbonL.position.set(-0.04, 0.4, -0.01);
  ribbonL.rotation.z = -0.2;
  const ribbonR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.22, 0.295)), ribbonMat);
  ribbonR.position.set(0.04, 0.4, -0.01);
  ribbonR.rotation.z = 0.2;
  const medalDisc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12)), goldMat);
  medalDisc.rotation.x = Math.PI * 0.5;
  medalDisc.position.set(0, 0.29, -0.152);
  medalGroup.add(ribbonL, ribbonR, medalDisc);
  medalGroup.visible = false;
  torso.add(medalGroup);

  const headphonesGroup = new THREE.Group();
  const hpBand = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.145, 0.022, 8, 16, Math.PI)), visorMat);
  hpBand.rotation.x = Math.PI * 0.55;
  hpBand.position.set(0, 0.51, 0.02);
  const hpCupL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10)), cyberCyanMat);
  hpCupL.rotation.z = Math.PI * 0.5;
  hpCupL.position.set(-0.15, 0.51, -0.08);
  const hpCupR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10)), cyberCyanMat);
  hpCupR.rotation.z = Math.PI * 0.5;
  hpCupR.position.set(0.15, 0.51, -0.08);
  headphonesGroup.add(hpBand, hpCupL, hpCupR);
  headphonesGroup.visible = false;
  torso.add(headphonesGroup);

  // Head group (pivoted at neck y = 0.55 relative to torso)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.55, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 10)), skinMat);
  neck.position.set(0, 0.03, 0);
  headGroup.add(neck);

  const head = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.27, 0.28, 0.27)), skinMat),
  );
  head.position.set(0, 0.2, 0);
  headGroup.add(head);

  // Expressive Canvas Face on front of head (-Z)
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128;
  faceCanvas.height = 128;
  const faceCtx = faceCanvas.getContext('2d')!;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  textures.push(faceTex);
  const faceMat = trackMat(
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }),
  );
  const facePlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.24, 0.24)), faceMat);
  facePlane.position.set(0, 0.195, -0.137);
  facePlane.rotation.y = Math.PI;
  headGroup.add(facePlane);

  let lastFaceKey = '';
  const updateFaceStyle = (face: FaceStyleId, _skinColor: number) => {
    const key = face;
    if (key === lastFaceKey) return;
    lastFaceKey = key;
    faceCtx.clearRect(0, 0, 128, 128);
    // Eyes
    faceCtx.fillStyle = '#18181b';
    faceCtx.beginPath();
    faceCtx.arc(44, 58, 7, 0, Math.PI * 2);
    faceCtx.arc(84, 58, 7, 0, Math.PI * 2);
    faceCtx.fill();
    // Eye highlights
    faceCtx.fillStyle = '#ffffff';
    faceCtx.beginPath();
    faceCtx.arc(46, 55, 2.3, 0, Math.PI * 2);
    faceCtx.arc(86, 55, 2.3, 0, Math.PI * 2);
    faceCtx.fill();
    // Eyebrows
    faceCtx.strokeStyle = '#27272a';
    faceCtx.lineWidth = 4.5;
    faceCtx.lineCap = 'round';
    faceCtx.beginPath();
    if (face === 'determined') {
      faceCtx.moveTo(34, 42);
      faceCtx.lineTo(54, 47);
      faceCtx.moveTo(94, 42);
      faceCtx.lineTo(74, 47);
    } else if (face === 'cool') {
      faceCtx.moveTo(34, 45);
      faceCtx.lineTo(54, 44);
      faceCtx.moveTo(74, 44);
      faceCtx.lineTo(94, 41);
    } else {
      faceCtx.moveTo(35, 44);
      faceCtx.quadraticCurveTo(44, 40, 53, 44);
      faceCtx.moveTo(75, 44);
      faceCtx.quadraticCurveTo(84, 40, 93, 44);
    }
    faceCtx.stroke();
    // Mouth
    faceCtx.strokeStyle = '#7c2d12';
    faceCtx.lineWidth = 4.5;
    faceCtx.beginPath();
    if (face === 'cheerful') {
      faceCtx.arc(64, 78, 15, 0.15 * Math.PI, 0.85 * Math.PI);
    } else if (face === 'determined') {
      faceCtx.moveTo(52, 86);
      faceCtx.lineTo(76, 84);
    } else if (face === 'cool') {
      faceCtx.moveTo(52, 85);
      faceCtx.quadraticCurveTo(68, 89, 78, 81);
    } else {
      faceCtx.arc(64, 76, 12, 0.2 * Math.PI, 0.8 * Math.PI);
    }
    faceCtx.stroke();
    faceTex.needsUpdate = true;
  };
  updateFaceStyle('friendly', 0xe2b28b);

  // 6 Procedural 3D Hairstyles
  const hairShort = new THREE.Group();
  const hsTop = setShadow(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.295, 0.11, 0.295)), hairMat));
  hsTop.position.set(0, 0.32, 0.01);
  const hsBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.285, 0.16, 0.1)), hairMat);
  hsBack.position.set(0, 0.24, 0.11);
  hairShort.add(hsTop, hsBack);
  headGroup.add(hairShort);

  const hairCurly = new THREE.Group();
  [
    [0, 0.35, 0, 0.14],
    [-0.1, 0.33, -0.02, 0.1],
    [0.1, 0.33, -0.02, 0.1],
    [0, 0.32, 0.1, 0.11],
    [-0.1, 0.29, 0.08, 0.095],
    [0.1, 0.29, 0.08, 0.095],
  ].forEach(([cx, cy, cz, cr]) => {
    const puff = setShadow(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(cr, 8, 8)), hairMat));
    puff.position.set(cx, cy, cz);
    hairCurly.add(puff);
  });
  hairCurly.visible = false;
  headGroup.add(hairCurly);

  const hairLongWave = new THREE.Group();
  const lwTop = setShadow(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.11, 0.3)), hairMat));
  lwTop.position.set(0, 0.32, 0.01);
  const lwBack = setShadow(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.29, 0.36, 0.12)), hairMat));
  lwBack.position.set(0, 0.14, 0.11);
  const lwSideL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.28, 0.14)), hairMat);
  lwSideL.position.set(-0.14, 0.17, 0.02);
  const lwSideR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.28, 0.14)), hairMat);
  lwSideR.position.set(0.14, 0.17, 0.02);
  hairLongWave.add(lwTop, lwBack, lwSideL, lwSideR);
  hairLongWave.visible = false;
  headGroup.add(hairLongWave);

  const hairPonytail = new THREE.Group();
  const ptBase = setShadow(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.295, 0.11, 0.295)), hairMat));
  ptBase.position.set(0, 0.32, 0.01);
  const ptTie = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8)), goldMat);
  ptTie.rotation.x = Math.PI * 0.5;
  ptTie.position.set(0, 0.28, 0.16);
  const ptTail = setShadow(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.26, 0.09)), hairMat));
  ptTail.position.set(0, 0.16, 0.19);
  ptTail.rotation.x = 0.22;
  hairPonytail.add(ptBase, ptTie, ptTail);
  hairPonytail.visible = false;
  headGroup.add(hairPonytail);

  const hairFade = new THREE.Group();
  const fdCrown = setShadow(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.12, 0.25)), hairMat));
  fdCrown.position.set(0, 0.35, 0);
  const fdSides = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.285, 0.06, 0.27)), hairMat);
  fdSides.position.set(0, 0.29, 0.01);
  hairFade.add(fdCrown, fdSides);
  hairFade.visible = false;
  headGroup.add(hairFade);

  const hairBob = new THREE.Group();
  const bobTop = setShadow(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.11, 0.3)), hairMat));
  bobTop.position.set(0, 0.32, 0.01);
  const bobSides = setShadow(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.22)), hairMat));
  bobSides.position.set(0, 0.21, 0.05);
  hairBob.add(bobTop, bobSides);
  hairBob.visible = false;
  headGroup.add(hairBob);

  // Hats (cap, beanie, fedora, grad_cap)
  const capGroup = new THREE.Group();
  const capMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.65, metalness: 0.06 }),
  );
  const capCrown = setShadow(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.305, 0.1, 0.305)), capMat),
  );
  capCrown.position.set(0, 0.36, 0.005);
  const capBrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.27, 0.032, 0.16)), capMat);
  capBrim.position.set(0, 0.325, -0.18);
  capGroup.add(capCrown, capBrim);
  capGroup.visible = false;
  headGroup.add(capGroup);

  const beanieGroup = new THREE.Group();
  const beanieMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 }));
  const beanieDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), beanieMat);
  beanieDome.position.set(0, 0.31, 0);
  const beanieCuff = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.305, 0.07, 0.305)), beanieMat);
  beanieCuff.position.set(0, 0.32, 0);
  beanieGroup.add(beanieDome, beanieCuff);
  beanieGroup.visible = false;
  headGroup.add(beanieGroup);

  const fedoraGroup = new THREE.Group();
  const fedoraMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }));
  const fedBrim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.23, 0.23, 0.022, 16)), fedoraMat);
  fedBrim.position.set(0, 0.34, 0);
  const fedCrown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.135, 0.155, 0.12, 12)), fedoraMat);
  fedCrown.position.set(0, 0.4, 0);
  const fedBand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.157, 0.157, 0.03, 12)), goldMat);
  fedBand.position.set(0, 0.36, 0);
  fedoraGroup.add(fedBrim, fedCrown, fedBand);
  fedoraGroup.visible = false;
  headGroup.add(fedoraGroup);

  const gradCapGroup = new THREE.Group();
  const gradMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55 }));
  const gradBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.16, 0.08, 12)), gradMat);
  gradBase.position.set(0, 0.36, 0);
  const gradBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.025, 0.36)), gradMat);
  gradBoard.position.set(0, 0.41, 0);
  const gradTassel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.025, 0.12, 0.025)), goldMat);
  gradTassel.position.set(0.16, 0.35, -0.05);
  gradCapGroup.add(gradBase, gradBoard, gradTassel);
  gradCapGroup.visible = false;
  headGroup.add(gradCapGroup);

  // Glasses (shades, round_frames, visor)
  const shadesGroup = new THREE.Group();
  const sunglasses = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.065, 0.04)), visorMat);
  sunglasses.position.set(0, 0.215, -0.14);
  shadesGroup.add(sunglasses);
  shadesGroup.visible = false;
  headGroup.add(shadesGroup);

  const roundGlassesGroup = new THREE.Group();
  const lensL = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.045, 0.009, 6, 14)), goldMat);
  lensL.position.set(-0.06, 0.215, -0.142);
  const lensR = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.045, 0.009, 6, 14)), goldMat);
  lensR.position.set(0.06, 0.215, -0.142);
  const bridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.012, 0.015)), goldMat);
  bridge.position.set(0, 0.215, -0.142);
  roundGlassesGroup.add(lensL, lensR, bridge);
  roundGlassesGroup.visible = false;
  headGroup.add(roundGlassesGroup);

  const visorGroup = new THREE.Group();
  const visorShield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.08, 0.06)), cyberCyanMat);
  visorShield.position.set(0, 0.22, -0.145);
  visorGroup.add(visorShield);
  visorGroup.visible = false;
  headGroup.add(visorGroup);

  // Articulated Arms (Shoulder -> Upper Arm -> Elbow Pivot -> Forearm & Hand)
  const upperArmMeshes: THREE.Mesh[] = [];
  const makeArm = (side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.32, 0.45, 0);

    const upperArm = setShadow(
      new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.28, 0.15)), jacketMat),
    );
    upperArm.position.set(0, -0.13, 0);
    shoulder.add(upperArm);
    upperArmMeshes.push(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.26, 0);
    shoulder.add(elbow);

    const forearm = setShadow(
      new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.115, 0.23, 0.12)), skinMat),
    );
    forearm.position.set(0, -0.11, 0);
    elbow.add(forearm);

    const hand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.1, 0.11)), skinMat);
    hand.position.set(0, -0.25, -0.01);
    elbow.add(hand);

    torso.add(shoulder);
    return { shoulder, elbow };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Wrist Watches mounted to left forearm (leftArm.elbow)
  const sportWatchGroup = new THREE.Group();
  const swBand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.132, 0.04, 0.138)), visorMat);
  swBand.position.set(0, -0.19, 0);
  const swFace = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.045, 0.025)), cyberCyanMat);
  swFace.position.set(0, -0.19, -0.072);
  sportWatchGroup.add(swBand, swFace);
  sportWatchGroup.visible = false;
  leftArm.elbow.add(sportWatchGroup);

  const goldWatchGroup = new THREE.Group();
  const gwBand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.132, 0.042, 0.138)), goldMat);
  gwBand.position.set(0, -0.19, 0);
  goldWatchGroup.add(gwBand);
  goldWatchGroup.visible = false;
  leftArm.elbow.add(goldWatchGroup);

  const smartBandGroup = new THREE.Group();
  const sbBand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.128, 0.032, 0.132)), cyberCyanMat);
  sbBand.position.set(0, -0.19, 0);
  smartBandGroup.add(sbBand);
  smartBandGroup.visible = false;
  leftArm.elbow.add(smartBandGroup);

  // Articulated Legs (Hip Pivot -> Thigh -> Knee Pivot -> Shin -> Ankle Pivot -> Shoe)
  const cargoPocketMeshes: THREE.Mesh[] = [];
  const makeLeg = (
    side: -1 | 1,
  ): { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.125, -0.06, 0);

    const thigh = setShadow(
      new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.175, 0.36, 0.185)), jeansMat),
    );
    thigh.position.set(0, -0.17, 0);
    hip.add(thigh);

    const cargoPocket = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.035, 0.14, 0.13)),
      jeansMat,
    );
    cargoPocket.position.set(side * 0.095, -0.2, 0);
    cargoPocket.visible = false;
    hip.add(cargoPocket);
    cargoPocketMeshes.push(cargoPocket);

    const knee = new THREE.Group();
    knee.position.set(0, -0.35, 0);
    hip.add(knee);

    const shin = setShadow(
      new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.34, 0.17)), jeansMat),
    );
    shin.position.set(0, -0.17, 0);
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.34, 0);
    knee.add(ankle);

    const shoe = setShadow(
      new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.12, 0.27)), shoeMat),
    );
    shoe.position.set(0, -0.03, -0.04);
    ankle.add(shoe);

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
      opacity: 0.55,
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

  // Body proportions
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

  // Clothing top style
  const top = c.topStyle || 'jacket';
  rig.innerTeeMesh.visible = top === 'jacket' || top === 'blazer' || top === 'explorer_vest';
  rig.tieMesh.visible = top === 'blazer';
  rig.hoodiePocketMesh.visible = top === 'hoodie';
  rig.vestAccentGroup.visible = top === 'explorer_vest';
  rig.cyberStripeGroup.visible = top === 'cyber_jacket';
  rig.coatTailMesh.visible = top === 'champion_coat' || top === 'blazer';

  // Pants cargo pockets
  const showCargo = c.pantsStyle === 'cargo';
  for (const pm of rig.cargoPocketMeshes) {
    pm.visible = showCargo;
  }

  // Hairstyles
  const hair = c.hairStyle || 'short_crop';
  (Object.keys(rig.hairGroups) as Array<keyof typeof rig.hairGroups>).forEach((k) => {
    rig.hairGroups[k].visible = k === hair;
  });

  // Hats
  const hat = c.hatId || 'none';
  (Object.keys(rig.hatGroups) as Array<keyof typeof rig.hatGroups>).forEach((k) => {
    rig.hatGroups[k].visible = k === hat;
  });

  // Glasses
  const glasses = c.glassesId || 'none';
  (Object.keys(rig.glassesGroups) as Array<keyof typeof rig.glassesGroups>).forEach((k) => {
    rig.glassesGroups[k].visible = k === glasses;
  });

  // Watches
  const watch = c.watchId || 'none';
  (Object.keys(rig.watchGroups) as Array<keyof typeof rig.watchGroups>).forEach((k) => {
    rig.watchGroups[k].visible = k === watch;
  });

  // Backpacks
  const pack = c.backpackId || 'none';
  (Object.keys(rig.packGroups) as Array<keyof typeof rig.packGroups>).forEach((k) => {
    rig.packGroups[k].visible = k === pack;
  });

  // Neck accessories
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
  rig.headGroup.rotation.set(pose.headPitch, pose.headYaw, 0);

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
  sprite.position.set(0, 2.18, 0);

  let lastKey = '';

  const redraw = (displayName: string, isOnline: boolean, activityTag?: string | null) => {
    const safeName = (displayName || 'Student').slice(0, 18);
    const safeTag = activityTag ? activityTag.slice(0, 14) : '';
    const key = `${safeName}|${isOnline ? 1 : 0}|${safeTag}`;
    if (key === lastKey) return;
    lastKey = key;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Rounded dark pill badge with crisp border
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

    // Online indicator dot
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

  const jacketMat = tm(new THREE.MeshStandardMaterial({ color: pal.jacket, roughness: 0.68 }));
  const pantsMat = tm(new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.88 }));
  const skinMat = tm(new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.66 }));
  const hairMat = tm(new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.9 }));
  const shoeMat = tm(new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.5 }));

  const torso = new THREE.Mesh(tg(new THREE.BoxGeometry(0.44, 0.56, 0.24)), jacketMat);
  torso.position.set(0, 1.16, 0);
  torso.castShadow = castShadows;
  root.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 1.56, 0);
  const headBox = new THREE.Mesh(tg(new THREE.BoxGeometry(0.25, 0.26, 0.25)), skinMat);
  headBox.castShadow = castShadows;
  head.add(headBox);

  const hair = new THREE.Mesh(tg(new THREE.BoxGeometry(0.27, 0.09, 0.27)), hairMat);
  hair.position.y = 0.12;
  head.add(hair);

  if (pal.hat === 'cap') {
    const capMat = tm(new THREE.MeshStandardMaterial({ color: 0x22384f, roughness: 0.7 }));
    const capCrown = new THREE.Mesh(tg(new THREE.BoxGeometry(0.28, 0.08, 0.28)), capMat);
    capCrown.position.y = 0.14;
    const capBrim = new THREE.Mesh(tg(new THREE.BoxGeometry(0.26, 0.03, 0.14)), capMat);
    capBrim.position.set(0, 0.11, -0.18);
    head.add(capCrown, capBrim);
  } else if (pal.hat === 'hardhat') {
    const hatMat = tm(new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: 0.35 }));
    const dome = new THREE.Mesh(tg(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 10)), hatMat);
    dome.position.y = 0.15;
    head.add(dome);
  }
  root.add(head);

  const makeLimb = (w: number, h: number, d: number, x: number, y: number, mat: THREE.Material) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(tg(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.y = -h * 0.5;
    mesh.castShadow = castShadows;
    pivot.add(mesh);
    root.add(pivot);
    return pivot;
  };

  const leftArm = makeLimb(0.12, 0.5, 0.13, -0.29, 1.4, jacketMat);
  const rightArm = makeLimb(0.12, 0.5, 0.13, 0.29, 1.4, jacketMat);
  const leftLeg = makeLimb(0.16, 0.78, 0.17, -0.11, 0.86, pantsMat);
  const rightLeg = makeLimb(0.16, 0.78, 0.17, 0.11, 0.86, pantsMat);

  const shoeGeo = tg(new THREE.BoxGeometry(0.17, 0.1, 0.24));
  const ls = new THREE.Mesh(shoeGeo, shoeMat);
  ls.position.set(0, -0.8, -0.03);
  leftLeg.add(ls);
  const rs = new THREE.Mesh(shoeGeo, shoeMat);
  rs.position.set(0, -0.8, -0.03);
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
