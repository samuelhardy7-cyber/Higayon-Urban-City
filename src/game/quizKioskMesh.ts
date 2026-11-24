import * as THREE from 'three';
import type { QuizKioskPlacement } from './questionTypes';

export interface QuizKioskRig {
  placement: QuizKioskPlacement;
  group: THREE.Group;
  crystal: THREE.Object3D;
  ring: THREE.Mesh;
  dispose: () => void;
}

export function createQuizKioskRig(
  placement: QuizKioskPlacement,
  contactShadowTex: THREE.Texture,
  enableShadows: boolean,
): QuizKioskRig {
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
  group.position.set(placement.x, placement.y, placement.z);
  group.rotation.y = placement.rotY;

  const visualStyle = placement.visualStyle ?? 'terminal';
  const isCompleted = placement.allCompleted;
  const accentHex = isCompleted ? 0x10b981 : new THREE.Color(placement.nextSubjectColor).getHex();

  // 1. Contact shadow disc
  const shadow = new THREE.Mesh(
    tGeo(new THREE.CircleGeometry(visualStyle === 'terminal' ? 0.68 : 0.48, 18)),
    tMat(
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    ),
  );
  shadow.rotation.x = -Math.PI * 0.5;
  shadow.position.y = 0.015;
  group.add(shadow);

  const baseMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.52, metalness: 0.38 }),
  );
  const goldMat = tMat(
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.72 }),
  );
  const paperMat = tMat(
    new THREE.MeshStandardMaterial({
      color: 0xfefce8,
      emissive: accentHex,
      emissiveIntensity: isCompleted ? 0.12 : 0.25,
      roughness: 0.7,
    }),
  );
  const trimMat = tMat(
    new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: isCompleted ? 0.28 : 0.68,
      roughness: 0.25,
      metalness: 0.28,
    }),
  );

  // Glowing ground halo ring
  const ring = new THREE.Mesh(
    tGeo(
      visualStyle === 'terminal'
        ? new THREE.RingGeometry(0.58, 0.72, 24)
        : new THREE.RingGeometry(0.36, 0.48, 22),
    ),
    tMat(
      new THREE.MeshBasicMaterial({
        color: accentHex,
        transparent: true,
        opacity: isCompleted ? 0.32 : 0.78,
        side: THREE.DoubleSide,
      }),
    ),
  );
  ring.rotation.x = -Math.PI * 0.5;
  ring.position.y = 0.025;
  group.add(ring);

  let crystal: THREE.Object3D;

  if (visualStyle === 'book') {
    // Illuminated open educational book floating gently above a sleek study plinth
    const plinth = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 10)), baseMat);
    plinth.position.y = 0.36;
    plinth.castShadow = enableShadows;
    group.add(plinth);

    const bookGroup = new THREE.Group();
    bookGroup.position.y = 1.08;
    const coverLeft = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.26, 0.04, 0.36)), trimMat);
    coverLeft.position.set(-0.13, 0, 0);
    coverLeft.rotation.z = 0.22;
    const coverRight = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.26, 0.04, 0.36)), trimMat);
    coverRight.position.set(0.13, 0, 0);
    coverRight.rotation.z = -0.22;
    const pagesLeft = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.23, 0.05, 0.33)), paperMat);
    pagesLeft.position.set(-0.12, 0.028, 0);
    pagesLeft.rotation.z = 0.22;
    const pagesRight = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.23, 0.05, 0.33)), paperMat);
    pagesRight.position.set(0.12, 0.028, 0);
    pagesRight.rotation.z = -0.22;
    const spine = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.37, 8)), goldMat);
    spine.rotation.x = Math.PI * 0.5;
    bookGroup.add(coverLeft, coverRight, pagesLeft, pagesRight, spine);
    group.add(bookGroup);
    crystal = bookGroup;
  } else if (visualStyle === 'tablet') {
    // Sleek holographic digital learning tablet above compact stand
    const stand = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.16, 0.24, 0.78, 12)), baseMat);
    stand.position.y = 0.39;
    group.add(stand);

    const tabletGroup = new THREE.Group();
    tabletGroup.position.y = 1.15;
    const bezel = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.46, 0.32, 0.045)), baseMat);
    bezel.rotation.x = -0.28;
    const display = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.4, 0.26, 0.02)), trimMat);
    display.position.z = 0.022;
    display.rotation.x = -0.28;
    const holoDot = new THREE.Mesh(tGeo(new THREE.OctahedronGeometry(0.08, 0)), goldMat);
    holoDot.position.set(0, 0.26, 0);
    tabletGroup.add(bezel, display, holoDot);
    group.add(tabletGroup);
    crystal = tabletGroup;
  } else if (visualStyle === 'card') {
    // Floating glowing knowledge card plaque
    const pod = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.32, 0.62, 0.32)), baseMat);
    pod.position.y = 0.31;
    group.add(pod);

    const cardGroup = new THREE.Group();
    cardGroup.position.y = 1.05;
    const cardBody = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.42, 0.28, 0.04)), paperMat);
    const band = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.43, 0.08, 0.048)), trimMat);
    band.position.y = 0.08;
    const badge = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.055, 12)), goldMat);
    badge.rotation.x = Math.PI * 0.5;
    badge.position.set(0.12, -0.05, 0);
    cardGroup.add(cardBody, band, badge);
    group.add(cardGroup);
    crystal = cardGroup;
  } else if (visualStyle === 'crystal') {
    // Radiant crystal knowledge prism hovering over minimalist pedestal
    const pedestal = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.22, 0.28, 0.72, 12)), baseMat);
    pedestal.position.y = 0.36;
    group.add(pedestal);

    const crystalMesh = new THREE.Mesh(tGeo(new THREE.OctahedronGeometry(0.24, 0)), trimMat);
    crystalMesh.position.y = 1.15;
    group.add(crystalMesh);
    crystal = crystalMesh;
  } else if (visualStyle === 'artifact') {
    // Scholarly spinning astrolabe / knowledge globe
    const plinth = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.26, 0.34, 0.76, 12)), baseMat);
    plinth.position.y = 0.38;
    group.add(plinth);

    const artGroup = new THREE.Group();
    artGroup.position.y = 1.22;
    const core = new THREE.Mesh(tGeo(new THREE.DodecahedronGeometry(0.18, 0)), trimMat);
    const orbitA = new THREE.Mesh(tGeo(new THREE.TorusGeometry(0.28, 0.022, 8, 24)), goldMat);
    orbitA.rotation.x = 0.65;
    const orbitB = new THREE.Mesh(tGeo(new THREE.TorusGeometry(0.24, 0.02, 8, 24)), goldMat);
    orbitB.rotation.y = 0.85;
    artGroup.add(core, orbitA, orbitB);
    group.add(artGroup);
    crystal = artGroup;
  } else {
    // Classic full Study Terminal pedestal
    const plinth = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.46, 0.54, 0.16, 12)), baseMat);
    plinth.position.y = 0.08;
    plinth.castShadow = enableShadows;
    plinth.receiveShadow = enableShadows;

    const column = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.44, 0.92, 0.34)), baseMat);
    column.position.y = 0.62;
    column.castShadow = enableShadows;

    const consoleHead = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.64, 0.42, 0.12)), baseMat);
    consoleHead.position.set(0, 1.15, 0.04);
    consoleHead.rotation.x = -0.45;
    consoleHead.castShadow = enableShadows;

    const screenFace = new THREE.Mesh(
      tGeo(new THREE.BoxGeometry(0.54, 0.32, 0.03)),
      tMat(
        new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          emissive: accentHex,
          emissiveIntensity: 0.65,
          roughness: 0.2,
        }),
      ),
    );
    screenFace.position.set(0, 1.17, 0.1);
    screenFace.rotation.x = -0.45;

    const oct = new THREE.Mesh(tGeo(new THREE.OctahedronGeometry(0.24, 0)), trimMat);
    oct.position.y = 1.85;

    group.add(plinth, column, consoleHead, screenFace, oct);
    crystal = oct;
  }

  return {
    placement,
    group,
    crystal,
    ring,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
