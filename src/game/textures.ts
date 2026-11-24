import * as THREE from 'three';

export interface CityTextures {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  buildingWindowMap: THREE.CanvasTexture;
  commercialFacadeMap: THREE.CanvasTexture;
  grassMap: THREE.CanvasTexture;
  woodFloorMap: THREE.CanvasTexture;
  tileFloorMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCityTextures(maxAnisotropy: number): CityTextures {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Asphalt Road Albedo & Bump (512x512 fine grain)
  const [asphaltCanvas, actx] = makeCanvas(512, 512);
  const [bumpCanvas, bctx] = makeCanvas(512, 512);
  actx.fillStyle = '#33383f';
  actx.fillRect(0, 0, 512, 512);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  // Deterministic pseudo-random aggregate speckle
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 16000; i++) {
    const x = Math.floor(rand() * 512);
    const y = Math.floor(rand() * 512);
    const v = 42 + Math.floor(rand() * 28);
    actx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    actx.fillRect(x, y, 1, 1);

    const bv = 104 + Math.floor(rand() * 56);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(x, y, 1, 1);
  }
  const asphaltMap = finalizeTexture(asphaltCanvas, true, aniso, 48, 48);
  const asphaltBump = finalizeTexture(bumpCanvas, false, aniso, 48, 48);

  // 2. Sidewalk Concrete Paving Slabs
  const [swCanvas, sctx] = makeCanvas(256, 256);
  sctx.fillStyle = '#b9bec2';
  sctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = Math.floor(rand() * 256);
    const y = Math.floor(rand() * 256);
    const v = 168 + Math.floor(rand() * 32);
    sctx.fillStyle = `rgb(${v},${v + 2},${v + 3})`;
    sctx.fillRect(x, y, 2, 2);
  }
  sctx.strokeStyle = 'rgba(72, 79, 88, 0.45)';
  sctx.lineWidth = 3;
  for (let g = 0; g <= 256; g += 64) {
    sctx.beginPath();
    sctx.moveTo(g, 0);
    sctx.lineTo(g, 256);
    sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(0, g);
    sctx.lineTo(256, g);
    sctx.stroke();
  }
  const sidewalkMap = finalizeTexture(swCanvas, true, aniso, 4, 4);

  // 3. Skyscraper / Office Curtain-Wall Window Grid
  const [winCanvas, wctx] = makeCanvas(256, 256);
  wctx.fillStyle = '#dbe1e8';
  wctx.fillRect(0, 0, 256, 256);
  const cols = 4;
  const rows = 4;
  const cw = 256 / cols;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 6;
      const y = r * rh + 8;
      const w = cw - 12;
      const h = rh - 16;
      const tint = rand();
      if (tint > 0.78) {
        wctx.fillStyle = '#6c97b8'; // warm sunlit interior / sky reflection
      } else if (tint > 0.3) {
        wctx.fillStyle = '#3c5d78';
      } else {
        wctx.fillStyle = '#2a4154';
      }
      wctx.fillRect(x, y, w, h);
      // Window reflection highlight
      wctx.fillStyle = 'rgba(220, 240, 255, 0.26)';
      wctx.fillRect(x + 2, y + 2, w * 0.42, h - 4);
      // Mullion divider
      wctx.fillStyle = 'rgba(20, 30, 40, 0.35)';
      wctx.fillRect(x + w * 0.5 - 1, y, 2, h);
    }
    // Horizontal spandrel band
    wctx.fillStyle = 'rgba(90, 102, 115, 0.35)';
    wctx.fillRect(0, r * rh, 256, 4);
  }
  const buildingWindowMap = finalizeTexture(winCanvas, true, aniso, 2, 4);

  // 4. Commercial / Urban Masonry + Window Facade
  const [comCanvas, cctx] = makeCanvas(256, 256);
  cctx.fillStyle = '#dcd4c8';
  cctx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = c * 64 + 10;
      const y = r * 64 + 12;
      cctx.fillStyle = '#5a4e44';
      cctx.fillRect(x - 2, y - 2, 48, 44);
      cctx.fillStyle = rand() > 0.6 ? '#7da0b8' : '#3a4e5e';
      cctx.fillRect(x, y, 44, 40);
      cctx.fillStyle = '#ebe5dc';
      cctx.fillRect(x - 3, y + 40, 50, 4); // sill
    }
  }
  const commercialFacadeMap = finalizeTexture(comCanvas, true, aniso, 2, 2);

  // 5. Park Grass Texture
  const [grassCanvas, gctx] = makeCanvas(256, 256);
  gctx.fillStyle = '#4e7d45';
  gctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(rand() * 256);
    const y = Math.floor(rand() * 256);
    const g = 104 + Math.floor(rand() * 38);
    gctx.fillStyle = `rgb(${Math.floor(g * 0.64)},${g},${Math.floor(g * 0.56)})`;
    gctx.fillRect(x, y, 2, 3);
  }
  const grassMap = finalizeTexture(grassCanvas, true, aniso, 6, 6);

  // 6. Interior Wood Plank Floor
  const [woodCanvas, woctx] = makeCanvas(256, 256);
  woctx.fillStyle = '#8b5e3c';
  woctx.fillRect(0, 0, 256, 256);
  const plankH = 32;
  for (let row = 0; row < 8; row++) {
    const shade = Math.floor((rand() - 0.5) * 20);
    woctx.fillStyle = `rgb(${138 + shade},${94 + Math.floor(shade * 0.7)},${60 + Math.floor(shade * 0.5)})`;
    woctx.fillRect(0, row * plankH, 256, plankH - 1);
    woctx.fillStyle = 'rgba(42, 24, 12, 0.42)';
    woctx.fillRect(0, (row + 1) * plankH - 1, 256, 1.5);
    const seamX = ((row * 96 + 48) % 220) + 18;
    woctx.fillRect(seamX, row * plankH, 1.5, plankH);
  }
  const woodFloorMap = finalizeTexture(woodCanvas, true, aniso, 4, 4);

  // 7. Interior Ceramic / Commercial Floor Tile
  const [tileCanvas, tctx] = makeCanvas(256, 256);
  tctx.fillStyle = '#dde2e7';
  tctx.fillRect(0, 0, 256, 256);
  const tileSize = 64;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const v = 216 + Math.floor(rand() * 18);
      tctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      tctx.fillRect(tx * tileSize + 2, ty * tileSize + 2, tileSize - 4, tileSize - 4);
    }
  }
  const tileFloorMap = finalizeTexture(tileCanvas, true, aniso, 4, 4);

  // 8. Soft Radial Contact Shadow Disc
  const [shadCanvas, shctx] = makeCanvas(128, 128);
  const grad = shctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(10, 14, 22, 0.72)');
  grad.addColorStop(0.55, 'rgba(10, 14, 22, 0.34)');
  grad.addColorStop(1, 'rgba(10, 14, 22, 0)');
  shctx.fillStyle = grad;
  shctx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shadCanvas);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;
  contactShadowMap.needsUpdate = true;

  return {
    asphaltMap,
    asphaltBump,
    sidewalkMap,
    buildingWindowMap,
    commercialFacadeMap,
    grassMap,
    woodFloorMap,
    tileFloorMap,
    contactShadowMap,
    dispose: () => {
      asphaltMap.dispose();
      asphaltBump.dispose();
      sidewalkMap.dispose();
      buildingWindowMap.dispose();
      commercialFacadeMap.dispose();
      grassMap.dispose();
      woodFloorMap.dispose();
      tileFloorMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
