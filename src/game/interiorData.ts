import type {
  BuildingEntranceSpec,
  BuildingSubtype,
  InteriorBlueprint,
  InteriorDoorSpec,
  InteriorFloorSlab,
  InteriorFurnitureProp,
  InteriorLightSpec,
  InteriorStaircase,
  InteriorWallBox,
} from './types';

const WALL_THICK = 0.28;

/**
 * Helper to build a perimeter wall along X or Z, optionally leaving a doorway gap.
 */
function addWallWithDoorGap(
  walls: InteriorWallBox[],
  idPrefix: string,
  axis: 'x' | 'z',
  fixedCoord: number,
  startCoord: number,
  endCoord: number,
  minY: number,
  maxY: number,
  color: number,
  kind: InteriorWallBox['kind'],
  gapCenter?: number,
  gapWidth = 0,
  gapTopY?: number,
): void {
  const halfT = WALL_THICK * 0.5;
  const blocksCam = kind !== 'glass';

  const pushSeg = (segId: string, a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.08 || y1 - y0 < 0.08) return;
    if (axis === 'z') {
      walls.push({
        id: segId,
        minX: a,
        maxX: b,
        minY: y0,
        maxY: y1,
        minZ: fixedCoord - halfT,
        maxZ: fixedCoord + halfT,
        color,
        kind,
        blocksCamera: blocksCam,
      });
    } else {
      walls.push({
        id: segId,
        minX: fixedCoord - halfT,
        maxX: fixedCoord + halfT,
        minY: y0,
        maxY: y1,
        minZ: a,
        maxZ: b,
        color,
        kind,
        blocksCamera: blocksCam,
      });
    }
  };

  if (gapCenter === undefined || gapWidth <= 0) {
    pushSeg(`${idPrefix}_full`, startCoord, endCoord, minY, maxY);
    return;
  }

  const g0 = gapCenter - gapWidth * 0.5;
  const g1 = gapCenter + gapWidth * 0.5;
  pushSeg(`${idPrefix}_a`, startCoord, g0, minY, maxY);
  pushSeg(`${idPrefix}_b`, g1, endCoord, minY, maxY);
  if (gapTopY !== undefined && gapTopY < maxY) {
    pushSeg(`${idPrefix}_lintel`, g0, g1, gapTopY, maxY);
  }
}

function addPerimeterBox(
  walls: InteriorWallBox[],
  prefix: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  minY: number,
  maxY: number,
  wallColor: number,
  southDoorWidth = 0,
  southDoorHeight = 2.4,
  windowOnNorth = true,
  windowOnSides = true,
): void {
  // South wall (z = maxZ) with optional entrance/exit doorway at x = 0
  addWallWithDoorGap(
    walls,
    `${prefix}_south`,
    'z',
    maxZ,
    minX,
    maxX,
    minY,
    maxY,
    wallColor,
    'wall',
    southDoorWidth > 0 ? 0 : undefined,
    southDoorWidth,
    minY + southDoorHeight,
  );
  // North wall (z = minZ)
  addWallWithDoorGap(
    walls,
    `${prefix}_north`,
    'z',
    minZ,
    minX,
    maxX,
    minY,
    maxY,
    wallColor,
    windowOnNorth ? 'window_wall' : 'wall',
  );
  // West wall (x = minX)
  addWallWithDoorGap(
    walls,
    `${prefix}_west`,
    'x',
    minX,
    minZ,
    maxZ,
    minY,
    maxY,
    wallColor,
    windowOnSides ? 'window_wall' : 'wall',
  );
  // East wall (x = maxX)
  addWallWithDoorGap(
    walls,
    `${prefix}_east`,
    'x',
    maxX,
    minZ,
    maxZ,
    minY,
    maxY,
    wallColor,
    windowOnSides ? 'window_wall' : 'wall',
  );
}

function makeExitDoor(
  id: string,
  width: number,
  height: number,
  maxZ: number,
  style: InteriorDoorSpec['style'],
  color: number,
): InteriorDoorSpec {
  return {
    id,
    label: 'Exit to City',
    hingeX: -width * 0.5,
    y: 0,
    hingeZ: maxZ,
    closedYaw: 0,
    openAngle: Math.PI * 0.48,
    width,
    height,
    thickness: 0.1,
    isExitDoor: true,
    color,
    style,
  };
}

function buildSmallHouse(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -5.5;
  const maxX = 5.5;
  const minZ = -5.0;
  const maxZ = 5.0;
  const h = 3.4;
  const walls: InteriorWallBox[] = [];
  addPerimeterBox(walls, 'sh', minX, maxX, minZ, maxZ, 0, h, 0xe8e0d5, 1.35, 2.35, true, true);

  // Bedroom partition on East side (x = 1.4, z = -5..0.8) with doorway at z = -1.6
  addWallWithDoorGap(walls, 'sh_bed_part', 'x', 1.4, minZ, 0.8, 0, h, 0xded5c8, 'partition', -1.6, 1.15, 2.3);
  addWallWithDoorGap(walls, 'sh_bed_south', 'z', 0.8, 1.4, maxX, 0, h, 0xded5c8, 'partition');

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 1.35, 2.35, maxZ, 'wood', accentColor),
    {
      id: 'door_bedroom',
      label: 'Bedroom Door',
      hingeX: 1.4,
      y: 0,
      hingeZ: -2.17,
      closedYaw: Math.PI * 0.5,
      openAngle: -Math.PI * 0.48,
      width: 1.14,
      height: 2.25,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x7c5338,
      style: 'wood',
    },
  ];

  const floorSlabs: InteriorFloorSlab[] = [
    { id: 'fl_1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: h, surface: 'wood' },
  ];

  const furniture: InteriorFurnitureProp[] = [
    { id: 'f_sofa', kind: 'sofa', x: -3.4, y: 0, z: 1.6, rotY: Math.PI * 0.5, width: 2.3, height: 0.9, depth: 0.95, primaryColor: 0x3f657d },
    { id: 'f_ctable', kind: 'coffee_table', x: -1.8, y: 0, z: 1.6, rotY: 0, width: 1.1, height: 0.45, depth: 0.7, primaryColor: 0x6e4a32 },
    { id: 'f_tv', kind: 'tv_stand', x: -0.2, y: 0, z: 1.6, rotY: -Math.PI * 0.5, width: 1.6, height: 1.25, depth: 0.45, primaryColor: 0x2c333b, blocksCamera: false },
    { id: 'f_kitchen', kind: 'kitchen_counter', x: -3.4, y: 0, z: -4.2, rotY: 0, width: 3.4, height: 0.95, depth: 0.85, primaryColor: 0xd6cfc4, accentColor: 0x3b444f },
    { id: 'f_dining', kind: 'dining_table', x: -2.6, y: 0, z: -1.8, rotY: 0, width: 1.7, height: 0.82, depth: 1.15, primaryColor: 0x7d5336 },
    { id: 'f_bed', kind: 'bed', x: 3.55, y: 0, z: -2.4, rotY: 0, width: 2.0, height: 0.75, depth: 2.35, primaryColor: 0x355e7a, accentColor: 0xf4f1ea },
    { id: 'f_desk', kind: 'desk', x: 3.8, y: 0, z: 3.2, rotY: -Math.PI * 0.5, width: 1.5, height: 0.8, depth: 0.75, primaryColor: 0x6f4b32 },
    { id: 'f_plant', kind: 'plant', x: 2.1, y: 0, z: 4.1, rotY: 0, width: 0.6, height: 1.35, depth: 0.6, primaryColor: 0x3c7d48, blocksCamera: false },
  ];

  const lights: InteriorLightSpec[] = [
    { x: -2.2, y: 3.05, z: 1.4, color: 0xffe8c2, intensity: 2.2, distance: 11 },
    { x: -2.4, y: 3.05, z: -2.6, color: 0xfff0d4, intensity: 1.9, distance: 10 },
    { x: 3.5, y: 3.05, z: -2.0, color: 0xffe4b8, intensity: 1.8, distance: 9 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'residential',
    subtype: 'small_house',
    floorsCount: 1,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs,
    staircases: [],
    elevators: [],
    walls,
    doors,
    furniture,
    lights,
    ambientColor: 0xfff3e0,
    wallColor: 0xe8e0d5,
    ceilingColor: 0xf6f3ee,
    accentColor,
  };
}

function buildModernHouse(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -6.5;
  const maxX = 6.5;
  const minZ = -5.5;
  const maxZ = 5.5;
  const f2Y = 3.5;
  const roofY = 7.0;
  const walls: InteriorWallBox[] = [];

  // Floor 1 & Floor 2 perimeter
  addPerimeterBox(walls, 'mh_f1', minX, maxX, minZ, maxZ, 0, f2Y, 0xede8df, 1.45, 2.4, true, true);
  addPerimeterBox(walls, 'mh_f2', minX, maxX, minZ, maxZ, f2Y, roofY, 0xeae5dc, 0, 2.4, true, true);

  // Kitchen / Dining divider on Floor 1 (z = -0.8, x = -6.5..-1.0)
  addWallWithDoorGap(walls, 'mh_f1_div', 'z', -0.8, minX, -1.0, 0, f2Y, 0xded8ce, 'partition', -3.6, 1.35, 2.35);

  // Stairwell (x: 3.6..6.1, z: -3.2..2.8) rises from z=2.8 (y=0) to z=-3.2 (y=3.5)
  // Floor 2 slabs leave opening (x: 3.4..6.5, z: -3.4..3.2)
  const floorSlabs: InteriorFloorSlab[] = [
    { id: 'mh_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: f2Y, surface: 'wood' },
    { id: 'mh_fl2_main', floorNumber: 2, minX, maxX: 3.4, minZ, maxZ, y: f2Y, ceilingY: roofY, surface: 'wood' },
    { id: 'mh_fl2_north', floorNumber: 2, minX: 3.4, maxX, minZ, maxZ: -3.2, y: f2Y, ceilingY: roofY, surface: 'wood' },
    { id: 'mh_fl2_south', floorNumber: 2, minX: 3.4, maxX, minZ: 3.0, maxZ, y: f2Y, ceilingY: roofY, surface: 'wood' },
  ];

  // Guardrail along Floor 2 stairwell edge (x = 3.4, z = -3.2..3.0) and south edge (z = 3.0, x = 3.4..6.5)
  walls.push(
    { id: 'mh_rail_w', minX: 3.28, maxX: 3.46, minY: f2Y, maxY: f2Y + 1.05, minZ: -3.2, maxZ: 3.0, color: 0x3b424c, kind: 'railing', blocksCamera: false },
    { id: 'mh_rail_s', minX: 3.4, maxX: maxX, minY: f2Y, maxY: f2Y + 1.05, minZ: 2.9, maxZ: 3.08, color: 0x3b424c, kind: 'railing', blocksCamera: false },
  );

  // Floor 2 Master Bedroom partition (x = -1.2, z = -5.5..1.0) with door at z = -2.0
  addWallWithDoorGap(walls, 'mh_f2_bed', 'x', -1.2, minZ, 1.0, f2Y, roofY, 0xe2dcd2, 'partition', -2.0, 1.2, f2Y + 2.35);
  addWallWithDoorGap(walls, 'mh_f2_beds', 'z', 1.0, minX, -1.2, f2Y, roofY, 0xe2dcd2, 'partition');

  const staircases: InteriorStaircase[] = [
    {
      id: 'mh_stairs',
      fromFloor: 1,
      toFloor: 2,
      minX: 3.6,
      maxX: 6.2,
      minZ: -3.2,
      maxZ: 2.8,
      yStart: 0,
      yEnd: f2Y,
      axis: 'z',
      direction: -1,
    },
  ];

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 1.45, 2.4, maxZ, 'wood', accentColor),
    {
      id: 'mh_door_kitchen',
      label: 'Kitchen Arch Door',
      hingeX: -4.27,
      y: 0,
      hingeZ: -0.8,
      closedYaw: 0,
      openAngle: Math.PI * 0.48,
      width: 1.34,
      height: 2.3,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x6f4c34,
      style: 'wood',
    },
    {
      id: 'mh_door_master',
      label: 'Master Bedroom Door',
      hingeX: -1.2,
      y: f2Y,
      hingeZ: -2.6,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.2,
      height: 2.3,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x6f4c34,
      style: 'wood',
    },
  ];

  const furniture: InteriorFurnitureProp[] = [
    // Floor 1
    { id: 'mh_sofa', kind: 'sofa', x: -4.8, y: 0, z: 2.2, rotY: Math.PI * 0.5, width: 2.5, height: 0.9, depth: 0.95, primaryColor: 0x3b4d5e },
    { id: 'mh_ct', kind: 'coffee_table', x: -3.0, y: 0, z: 2.2, rotY: 0, width: 1.2, height: 0.45, depth: 0.75, primaryColor: 0x5c3e2a },
    { id: 'mh_tv', kind: 'tv_stand', x: -1.3, y: 0, z: 2.2, rotY: -Math.PI * 0.5, width: 1.8, height: 1.35, depth: 0.45, primaryColor: 0x22272e, blocksCamera: false },
    { id: 'mh_kit', kind: 'kitchen_counter', x: -3.5, y: 0, z: -4.7, rotY: 0, width: 4.5, height: 0.95, depth: 0.85, primaryColor: 0xf0ece4, accentColor: 0x323b45 },
    { id: 'mh_din', kind: 'dining_table', x: 0.5, y: 0, z: -3.2, rotY: 0, width: 2.0, height: 0.82, depth: 1.25, primaryColor: 0x734e34 },
    { id: 'mh_pl1', kind: 'plant', x: 2.2, y: 0, z: 4.6, rotY: 0, width: 0.6, height: 1.4, depth: 0.6, primaryColor: 0x3c7d48, blocksCamera: false },
    // Floor 2
    { id: 'mh_bed', kind: 'bed', x: -4.2, y: f2Y, z: -2.4, rotY: 0, width: 2.2, height: 0.8, depth: 2.4, primaryColor: 0x2f5b78, accentColor: 0xf4f1ea },
    { id: 'mh_desk', kind: 'desk', x: 1.2, y: f2Y, z: -4.4, rotY: 0, width: 1.7, height: 0.82, depth: 0.8, primaryColor: 0x6b472f },
    { id: 'mh_sofa2', kind: 'sofa', x: -4.0, y: f2Y, z: 3.4, rotY: Math.PI, width: 2.4, height: 0.88, depth: 0.95, primaryColor: 0x735243 },
  ];

  const lights: InteriorLightSpec[] = [
    { x: -3.0, y: 3.15, z: 2.2, color: 0xffe8c2, intensity: 2.3, distance: 12 },
    { x: -1.5, y: 3.15, z: -3.2, color: 0xfff0d4, intensity: 2.1, distance: 11 },
    { x: -3.8, y: f2Y + 3.1, z: -2.2, color: 0xffe4b8, intensity: 2.1, distance: 11 },
    { x: 0.8, y: f2Y + 3.1, z: 1.6, color: 0xfff2dc, intensity: 2.1, distance: 11 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'residential',
    subtype: 'modern_house',
    floorsCount: 2,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs,
    staircases,
    elevators: [],
    walls,
    doors,
    furniture,
    lights,
    ambientColor: 0xfff4e2,
    wallColor: 0xede8df,
    ceilingColor: 0xf8f6f2,
    accentColor,
  };
}

function buildApartment(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -7.5;
  const maxX = 7.5;
  const minZ = -6.5;
  const maxZ = 6.5;
  const f2Y = 3.6;
  const f3Y = 7.2;
  const roofY = 10.8;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'ap_f1', minX, maxX, minZ, maxZ, 0, f2Y, 0xe3ddd3, 1.85, 2.5, true, true);
  addPerimeterBox(walls, 'ap_f2', minX, maxX, minZ, maxZ, f2Y, f3Y, 0xe5dfd5, 0, 2.5, true, true);
  addPerimeterBox(walls, 'ap_f3', minX, maxX, minZ, maxZ, f3Y, roofY, 0xe8e2d8, 0, 2.5, true, true);

  // Stairwell on East (x: 4.4..7.1, z: -3.2..3.0): Floor 1->2 (south->north), Floor 2->3 (south->north)
  const floorSlabs: InteriorFloorSlab[] = [
    { id: 'ap_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: f2Y, surface: 'tile' },
    // Floor 2
    { id: 'ap_fl2_m', floorNumber: 2, minX, maxX: 4.3, minZ, maxZ, y: f2Y, ceilingY: f3Y, surface: 'wood' },
    { id: 'ap_fl2_n', floorNumber: 2, minX: 4.3, maxX, minZ, maxZ: -3.2, y: f2Y, ceilingY: f3Y, surface: 'wood' },
    { id: 'ap_fl2_s', floorNumber: 2, minX: 4.3, maxX, minZ: 3.0, maxZ, y: f2Y, ceilingY: f3Y, surface: 'wood' },
    // Floor 3
    { id: 'ap_fl3_m', floorNumber: 3, minX, maxX: 4.3, minZ, maxZ, y: f3Y, ceilingY: roofY, surface: 'carpet' },
    { id: 'ap_fl3_n', floorNumber: 3, minX: 4.3, maxX, minZ, maxZ: -3.2, y: f3Y, ceilingY: roofY, surface: 'carpet' },
    { id: 'ap_fl3_s', floorNumber: 3, minX: 4.3, maxX, minZ: 3.0, maxZ, y: f3Y, ceilingY: roofY, surface: 'carpet' },
  ];

  // Stairwell railings on F2 & F3
  for (const [tag, fy] of [
    ['f2', f2Y],
    ['f3', f3Y],
  ] as const) {
    walls.push(
      { id: `ap_rail_${tag}_w`, minX: 4.18, maxX: 4.34, minY: fy, maxY: fy + 1.05, minZ: -3.2, maxZ: 3.0, color: 0x3b4552, kind: 'railing', blocksCamera: false },
      { id: `ap_rail_${tag}_s`, minX: 4.3, maxX, minY: fy, maxY: fy + 1.05, minZ: 2.92, maxZ: 3.08, color: 0x3b4552, kind: 'railing', blocksCamera: false },
    );
  }

  // Floor 2 & Floor 3 Apartment Suite partitions on West half (x = -1.6) with suite entry doors
  addWallWithDoorGap(walls, 'ap_f2_suite', 'x', -1.6, minZ, maxZ, f2Y, f3Y, 0xd8d1c6, 'partition', 1.8, 1.25, f2Y + 2.35);
  addWallWithDoorGap(walls, 'ap_f3_suite', 'x', -1.6, minZ, maxZ, f3Y, roofY, 0xd8d1c6, 'partition', 1.8, 1.25, f3Y + 2.35);

  const staircases: InteriorStaircase[] = [
    { id: 'ap_st_1', fromFloor: 1, toFloor: 2, minX: 4.5, maxX: 7.2, minZ: -3.2, maxZ: 2.9, yStart: 0, yEnd: f2Y, axis: 'z', direction: -1 },
    { id: 'ap_st_2', fromFloor: 2, toFloor: 3, minX: 4.5, maxX: 7.2, minZ: -3.2, maxZ: 2.9, yStart: f2Y, yEnd: f3Y, axis: 'z', direction: -1 },
  ];

  const elevators = [
    {
      id: 'ap_elev',
      x: 1.5,
      z: -5.2,
      width: 2.1,
      depth: 2.0,
      floors: [
        { floorNumber: 1, y: 0, label: 'Floor 1 · Lobby', exitX: 1.5, exitZ: -3.5, exitYaw: Math.PI },
        { floorNumber: 2, y: f2Y, label: 'Floor 2 · Suites', exitX: 1.5, exitZ: -3.5, exitYaw: Math.PI },
        { floorNumber: 3, y: f3Y, label: 'Floor 3 · Penthouse', exitX: 1.5, exitZ: -3.5, exitYaw: Math.PI },
      ],
    },
  ];

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 1.85, 2.5, maxZ, 'glass', accentColor),
    {
      id: 'ap_door_s2',
      label: 'Suite 201 Door',
      hingeX: -1.6,
      y: f2Y,
      hingeZ: 1.18,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.22,
      height: 2.3,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x694932,
      style: 'wood',
    },
    {
      id: 'ap_door_s3',
      label: 'Penthouse 301 Door',
      hingeX: -1.6,
      y: f3Y,
      hingeZ: 1.18,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.22,
      height: 2.3,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x523b2c,
      style: 'wood',
    },
  ];

  const furniture: InteriorFurnitureProp[] = [
    // Floor 1 Lobby
    { id: 'ap_mail', kind: 'mailbox_bank', x: -5.8, y: 0, z: -2.0, rotY: Math.PI * 0.5, width: 2.6, height: 1.9, depth: 0.5, primaryColor: 0x6d7782 },
    { id: 'ap_rec', kind: 'reception_desk', x: -3.6, y: 0, z: -4.2, rotY: 0, width: 2.8, height: 1.05, depth: 0.9, primaryColor: 0x5a4434, accentColor: 0xe6dfd4 },
    { id: 'ap_lounge', kind: 'sofa', x: -4.2, y: 0, z: 2.2, rotY: Math.PI * 0.5, width: 2.4, height: 0.9, depth: 0.95, primaryColor: 0x3b596e },
    { id: 'ap_pl1', kind: 'plant', x: -2.4, y: 0, z: 5.5, rotY: 0, width: 0.65, height: 1.5, depth: 0.65, primaryColor: 0x3d824b, blocksCamera: false },
    // Floor 2 Suite 201
    { id: 'ap_f2_sofa', kind: 'sofa', x: -5.6, y: f2Y, z: 2.6, rotY: Math.PI * 0.5, width: 2.2, height: 0.88, depth: 0.9, primaryColor: 0x586b7a },
    { id: 'ap_f2_bed', kind: 'bed', x: -5.2, y: f2Y, z: -3.6, rotY: 0, width: 2.1, height: 0.78, depth: 2.35, primaryColor: 0x3b6c85, accentColor: 0xf4f1ea },
    { id: 'ap_f2_kit', kind: 'kitchen_counter', x: -3.0, y: f2Y, z: -5.6, rotY: 0, width: 2.8, height: 0.95, depth: 0.8, primaryColor: 0xe5dfd6 },
    // Floor 3 Penthouse 301
    { id: 'ap_f3_sofa', kind: 'sofa', x: -5.6, y: f3Y, z: 2.4, rotY: Math.PI * 0.5, width: 2.4, height: 0.9, depth: 0.95, primaryColor: 0x734b3c },
    { id: 'ap_f3_din', kind: 'dining_table', x: -3.8, y: f3Y, z: -0.6, rotY: 0, width: 1.9, height: 0.82, depth: 1.2, primaryColor: 0x66452e },
    { id: 'ap_f3_bed', kind: 'bed', x: -5.2, y: f3Y, z: -4.0, rotY: 0, width: 2.2, height: 0.8, depth: 2.4, primaryColor: 0x2c4b66, accentColor: 0xfaf7f2 },
  ];

  const lights: InteriorLightSpec[] = [
    { x: -2.0, y: 3.2, z: 1.0, color: 0xffe8c2, intensity: 2.2, distance: 13 },
    { x: 2.0, y: 3.2, z: -2.2, color: 0xfff1d8, intensity: 2.0, distance: 12 },
    { x: -4.2, y: f2Y + 3.2, z: 0, color: 0xffe8c2, intensity: 2.2, distance: 13 },
    { x: 1.5, y: f2Y + 3.2, z: -1.5, color: 0xfff1d8, intensity: 2.0, distance: 12 },
    { x: -4.2, y: f3Y + 3.2, z: 0, color: 0xffe8c2, intensity: 2.2, distance: 13 },
    { x: 1.5, y: f3Y + 3.2, z: -1.5, color: 0xfff1d8, intensity: 2.0, distance: 12 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'residential',
    subtype: 'apartment',
    floorsCount: 3,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs,
    staircases,
    elevators,
    walls,
    doors,
    furniture,
    lights,
    ambientColor: 0xfff3df,
    wallColor: 0xe3ddd3,
    ceilingColor: 0xf4f1eb,
    accentColor,
  };
}

function buildConvenienceStore(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -6.0;
  const maxX = 6.0;
  const minZ = -6.5;
  const maxZ = 6.5;
  const h = 3.6;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'cs', minX, maxX, minZ, maxZ, 0, h, 0xf2efe9, 1.85, 2.5, false, true);
  // Back stockroom wall at z = -3.4 with doorway at x = 3.2
  addWallWithDoorGap(walls, 'cs_stock', 'z', -3.4, minX, maxX, 0, h, 0xe2dfd8, 'partition', 3.2, 1.35, 2.4);

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 1.85, 2.5, maxZ, 'glass', accentColor),
    {
      id: 'cs_stock_door',
      label: 'Stockroom Door',
      hingeX: 2.52,
      y: 0,
      hingeZ: -3.4,
      closedYaw: 0,
      openAngle: -Math.PI * 0.48,
      width: 1.34,
      height: 2.35,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x6b7280,
      style: 'metal',
    },
  ];

  const furniture: InteriorFurnitureProp[] = [
    // Checkout counter on front-left
    { id: 'cs_checkout', kind: 'checkout_counter', x: -3.5, y: 0, z: 3.3, rotY: 0, width: 2.8, height: 1.05, depth: 0.9, primaryColor: accentColor, accentColor: 0xf8fafc },
    // Grocery Shelf Aisles (2 rows with generous 1.9m aisles)
    { id: 'cs_shelf_1', kind: 'shelf_rack', x: -2.2, y: 0, z: -0.6, rotY: 0, width: 1.1, height: 1.85, depth: 3.4, primaryColor: 0x3b4450, accentColor: 0xef4444 },
    { id: 'cs_shelf_2', kind: 'shelf_rack', x: 1.4, y: 0, z: -0.6, rotY: 0, width: 1.1, height: 1.85, depth: 3.4, primaryColor: 0x3b4450, accentColor: 0x38bdf8 },
    // Refrigerated drink coolers along East wall
    { id: 'cs_cool_1', kind: 'cooler', x: 5.1, y: 0, z: -0.8, rotY: -Math.PI * 0.5, width: 2.6, height: 2.25, depth: 0.95, primaryColor: 0x1e293b, accentColor: 0xbae6fd },
    { id: 'cs_cool_2', kind: 'cooler', x: 5.1, y: 0, z: 2.2, rotY: -Math.PI * 0.5, width: 2.6, height: 2.25, depth: 0.95, primaryColor: 0x1e293b, accentColor: 0xbae6fd },
    // Stockroom shelving
    { id: 'cs_back_1', kind: 'shelf_rack', x: -3.2, y: 0, z: -5.3, rotY: Math.PI * 0.5, width: 1.0, height: 2.0, depth: 3.6, primaryColor: 0x475569, accentColor: 0xd97706 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'commercial',
    subtype: 'convenience_store',
    floorsCount: 1,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs: [{ id: 'cs_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: h, surface: 'tile' }],
    staircases: [],
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: -2.2, y: 3.25, z: 2.2, color: 0xffffff, intensity: 2.4, distance: 13 },
      { x: 2.2, y: 3.25, z: 0.2, color: 0xf0f9ff, intensity: 2.4, distance: 13 },
      { x: 0, y: 3.25, z: -4.8, color: 0xfff7ed, intensity: 1.9, distance: 10 },
    ],
    ambientColor: 0xfafcff,
    wallColor: 0xf2efe9,
    ceilingColor: 0xf8fafc,
    accentColor,
  };
}

function buildRestaurant(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -7.0;
  const maxX = 7.0;
  const minZ = -6.0;
  const maxZ = 6.0;
  const h = 3.7;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'rs', minX, maxX, minZ, maxZ, 0, h, 0xeadfce, 1.9, 2.5, true, true);
  // Commercial Kitchen wall at z = -2.2 with service swing door at x = 3.0
  addWallWithDoorGap(walls, 'rs_kit_w', 'z', -2.2, minX, maxX, 0, h, 0xdad2c4, 'partition', 3.0, 1.4, 2.4);

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 1.9, 2.5, maxZ, 'glass', accentColor),
    {
      id: 'rs_kit_door',
      label: 'Kitchen Door',
      hingeX: 2.3,
      y: 0,
      hingeZ: -2.2,
      closedYaw: 0,
      openAngle: -Math.PI * 0.48,
      width: 1.38,
      height: 2.35,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x94a3b8,
      style: 'metal',
    },
  ];

  const furniture: InteriorFurnitureProp[] = [
    { id: 'rs_bar', kind: 'espresso_bar', x: -3.2, y: 0, z: -1.1, rotY: 0, width: 4.0, height: 1.15, depth: 0.95, primaryColor: 0x4f3524, accentColor },
    { id: 'rs_t1', kind: 'dining_table', x: -4.5, y: 0, z: 2.8, rotY: 0, width: 1.6, height: 0.82, depth: 1.2, primaryColor: 0x6f4a32 },
    { id: 'rs_t2', kind: 'dining_table', x: 4.2, y: 0, z: 2.8, rotY: 0, width: 1.6, height: 0.82, depth: 1.2, primaryColor: 0x6f4a32 },
    { id: 'rs_t3', kind: 'dining_table', x: 4.2, y: 0, z: -0.2, rotY: 0, width: 1.6, height: 0.82, depth: 1.2, primaryColor: 0x6f4a32 },
    { id: 'rs_pl1', kind: 'plant', x: -5.9, y: 0, z: 5.0, rotY: 0, width: 0.65, height: 1.5, depth: 0.65, primaryColor: 0x3b804a, blocksCamera: false },
    { id: 'rs_pl2', kind: 'plant', x: 5.9, y: 0, z: 5.0, rotY: 0, width: 0.65, height: 1.5, depth: 0.65, primaryColor: 0x3b804a, blocksCamera: false },
    // Back Kitchen
    { id: 'rs_k1', kind: 'kitchen_counter', x: -3.2, y: 0, z: -5.1, rotY: 0, width: 5.4, height: 0.98, depth: 0.9, primaryColor: 0xcbd5e1, accentColor: 0x475569 },
    { id: 'rs_k2', kind: 'cooler', x: 5.7, y: 0, z: -4.8, rotY: -Math.PI * 0.5, width: 1.6, height: 2.2, depth: 0.9, primaryColor: 0x64748b, accentColor: 0x94a3b8 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'commercial',
    subtype: 'restaurant',
    floorsCount: 1,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs: [{ id: 'rs_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: h, surface: 'wood' }],
    staircases: [],
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: -3.2, y: 3.3, z: 2.0, color: 0xffdeb0, intensity: 2.3, distance: 12 },
      { x: 3.2, y: 3.3, z: 1.8, color: 0xffdeb0, intensity: 2.3, distance: 12 },
      { x: -1.0, y: 3.3, z: -4.0, color: 0xf8fafc, intensity: 2.2, distance: 11 },
    ],
    ambientColor: 0xffeeda,
    wallColor: 0xeadfce,
    ceilingColor: 0xf5efe6,
    accentColor,
  };
}

function buildCafe(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -5.5;
  const maxX = 5.5;
  const minZ = -5.0;
  const maxZ = 5.0;
  const h = 3.5;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'cf', minX, maxX, minZ, maxZ, 0, h, 0xefe3d5, 1.7, 2.45, true, true);

  const doors: InteriorDoorSpec[] = [makeExitDoor('exit_door', 1.7, 2.45, maxZ, 'glass', accentColor)];
  const furniture: InteriorFurnitureProp[] = [
    { id: 'cf_bar', kind: 'espresso_bar', x: -1.6, y: 0, z: -3.4, rotY: 0, width: 4.2, height: 1.15, depth: 1.0, primaryColor: 0x5c3c28, accentColor: 0xd97706 },
    { id: 'cf_sofa', kind: 'sofa', x: 3.9, y: 0, z: -1.5, rotY: -Math.PI * 0.5, width: 2.3, height: 0.9, depth: 0.9, primaryColor: 0x9a4d32 },
    { id: 'cf_t1', kind: 'dining_table', x: -3.5, y: 0, z: 1.2, rotY: 0, width: 1.4, height: 0.8, depth: 1.1, primaryColor: 0x7c5338 },
    { id: 'cf_t2', kind: 'dining_table', x: 3.2, y: 0, z: 1.8, rotY: 0, width: 1.4, height: 0.8, depth: 1.1, primaryColor: 0x7c5338 },
    { id: 'cf_pl', kind: 'plant', x: -4.4, y: 0, z: 4.1, rotY: 0, width: 0.6, height: 1.45, depth: 0.6, primaryColor: 0x3b804a, blocksCamera: false },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'commercial',
    subtype: 'cafe',
    floorsCount: 1,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs: [{ id: 'cf_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: h, surface: 'wood' }],
    staircases: [],
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: -1.5, y: 3.15, z: -2.6, color: 0xffdfa8, intensity: 2.3, distance: 11 },
      { x: 1.5, y: 3.15, z: 1.8, color: 0xffe6bd, intensity: 2.2, distance: 11 },
    ],
    ambientColor: 0xfff0dc,
    wallColor: 0xefe3d5,
    ceilingColor: 0xf7efe5,
    accentColor,
  };
}

function buildMall(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -10.5;
  const maxX = 10.5;
  const minZ = -7.5;
  const maxZ = 7.5;
  const f2Y = 3.8;
  const roofY = 7.6;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'ml_f1', minX, maxX, minZ, maxZ, 0, f2Y, 0xe8e2d9, 2.5, 2.6, true, true);
  addPerimeterBox(walls, 'ml_f2', minX, maxX, minZ, maxZ, f2Y, roofY, 0xebe6de, 0, 2.6, true, true);

  // Mezzanine Floor 2 gallery surrounds a wide central atrium opening (x: -4.8..4.8, z: -3.2..3.6)
  // Plus Staircase on East side (x: 5.5..8.5, z: -3.5..3.0) rising from z=3.0 (y=0) to z=-3.5 (y=f2Y)
  const floorSlabs: InteriorFloorSlab[] = [
    { id: 'ml_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: f2Y, surface: 'marble' },
    { id: 'ml_fl2_n', floorNumber: 2, minX, maxX, minZ, maxZ: -3.2, y: f2Y, ceilingY: roofY, surface: 'tile' },
    { id: 'ml_fl2_s', floorNumber: 2, minX, maxX, minZ: 3.4, maxZ, y: f2Y, ceilingY: roofY, surface: 'tile' },
    { id: 'ml_fl2_w', floorNumber: 2, minX, maxX: -4.8, minZ: -3.2, maxZ: 3.4, y: f2Y, ceilingY: roofY, surface: 'tile' },
    { id: 'ml_fl2_e', floorNumber: 2, minX: 8.6, maxX, minZ: -3.2, maxZ: 3.4, y: f2Y, ceilingY: roofY, surface: 'tile' },
    { id: 'ml_fl2_mid_e', floorNumber: 2, minX: 4.8, maxX: 5.4, minZ: -3.2, maxZ: 3.4, y: f2Y, ceilingY: roofY, surface: 'tile' },
  ];

  // Atrium & stairwell glass railings on Floor 2
  walls.push(
    { id: 'ml_rail_n', minX: -4.8, maxX: 5.5, minY: f2Y, maxY: f2Y + 1.05, minZ: -3.3, maxZ: -3.14, color: 0x3b4d63, kind: 'railing', blocksCamera: false },
    { id: 'ml_rail_s', minX: -4.8, maxX: 5.5, minY: f2Y, maxY: f2Y + 1.05, minZ: 3.32, maxZ: 3.48, color: 0x3b4d63, kind: 'railing', blocksCamera: false },
    { id: 'ml_rail_w', minX: -4.88, maxX: -4.72, minY: f2Y, maxY: f2Y + 1.05, minZ: -3.2, maxZ: 3.4, color: 0x3b4d63, kind: 'railing', blocksCamera: false },
    { id: 'ml_rail_e', minX: 5.36, maxX: 5.52, minY: f2Y, maxY: f2Y + 1.05, minZ: -3.2, maxZ: 3.4, color: 0x3b4d63, kind: 'railing', blocksCamera: false },
  );

  // Boutique partitions on West & North with open shop doorways
  addWallWithDoorGap(walls, 'ml_shop_w', 'x', -6.0, minZ, 1.5, 0, f2Y, 0xddd6cc, 'partition', -2.2, 1.8, 2.5);

  const staircases: InteriorStaircase[] = [
    {
      id: 'ml_stairs',
      fromFloor: 1,
      toFloor: 2,
      minX: 5.5,
      maxX: 8.5,
      minZ: -3.2,
      maxZ: 3.4,
      yStart: 0,
      yEnd: f2Y,
      axis: 'z',
      direction: -1,
    },
  ];

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 2.5, 2.6, maxZ, 'glass', accentColor),
    {
      id: 'ml_shop_door',
      label: 'Boutique Door',
      hingeX: -6.0,
      y: 0,
      hingeZ: -3.1,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.78,
      height: 2.45,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x38bdf8,
      style: 'glass',
    },
    ...(buildingId === 'freedom_mall'
      ? [
          {
            id: 'ml_rooftop_door',
            label: 'Rooftop Sky Garden Door',
            hingeX: 6.3,
            y: f2Y,
            hingeZ: minZ + 0.08,
            closedYaw: 0,
            openAngle: Math.PI * 0.48,
            width: 1.4,
            height: 2.38,
            thickness: 0.08,
            isExitDoor: false,
            color: 0x0ea5e9,
            style: 'metal' as const,
            rooftopTarget: {
              rooftopId: 'roof_freedom_mall',
              x: 14.2,
              y: 11.64,
              z: -27.6,
              yaw: 0,
            },
          },
        ]
      : []),
  ];

  const furniture: InteriorFurnitureProp[] = [
    // Floor 1 Concourse
    { id: 'ml_kiosk', kind: 'kiosk', x: 0, y: 0, z: -0.6, rotY: 0, width: 2.8, height: 2.2, depth: 2.2, primaryColor: accentColor, accentColor: 0xfef3c7 },
    { id: 'ml_sh1', kind: 'shelf_rack', x: -8.6, y: 0, z: -3.8, rotY: 0, width: 1.0, height: 1.8, depth: 3.2, primaryColor: 0x475569, accentColor: 0xf43f5e },
    { id: 'ml_sh2', kind: 'shelf_rack', x: -8.6, y: 0, z: 0.2, rotY: 0, width: 1.0, height: 1.8, depth: 2.8, primaryColor: 0x475569, accentColor: 0x38bdf8 },
    { id: 'ml_pl1', kind: 'plant', x: -4.2, y: 0, z: 4.5, rotY: 0, width: 0.75, height: 1.7, depth: 0.75, primaryColor: 0x3d824b, blocksCamera: false },
    { id: 'ml_pl2', kind: 'plant', x: 4.2, y: 0, z: 4.5, rotY: 0, width: 0.75, height: 1.7, depth: 0.75, primaryColor: 0x3d824b, blocksCamera: false },
    // Floor 2 Food Court & Gallery
    { id: 'ml_fc_bar', kind: 'espresso_bar', x: -1.5, y: f2Y, z: -6.3, rotY: 0, width: 4.5, height: 1.15, depth: 0.95, primaryColor: 0x7c2d12, accentColor: 0xf59e0b },
    { id: 'ml_fc_t1', kind: 'dining_table', x: -6.2, y: f2Y, z: -5.2, rotY: 0, width: 1.5, height: 0.82, depth: 1.2, primaryColor: 0x7c5338 },
    { id: 'ml_fc_t2', kind: 'dining_table', x: 3.2, y: f2Y, z: -5.2, rotY: 0, width: 1.5, height: 0.82, depth: 1.2, primaryColor: 0x7c5338 },
    { id: 'ml_f2_sofa', kind: 'sofa', x: -8.4, y: f2Y, z: 0.0, rotY: Math.PI * 0.5, width: 2.6, height: 0.9, depth: 0.95, primaryColor: 0x2f5a78 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'commercial',
    subtype: 'mall',
    floorsCount: 2,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs,
    staircases,
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: 0, y: 3.4, z: 2.0, color: 0xfff8ed, intensity: 2.6, distance: 16 },
      { x: -5.5, y: 3.4, z: -2.0, color: 0xfff8ed, intensity: 2.2, distance: 14 },
      { x: 0, y: f2Y + 3.4, z: -5.0, color: 0xfff5e4, intensity: 2.5, distance: 16 },
      { x: -7.0, y: f2Y + 3.4, z: 0, color: 0xfff5e4, intensity: 2.2, distance: 14 },
    ],
    ambientColor: 0xfef9f0,
    wallColor: 0xe8e2d9,
    ceilingColor: 0xf8fafc,
    accentColor,
  };
}

function buildOffice(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -7.0;
  const maxX = 7.0;
  const minZ = -6.0;
  const maxZ = 6.0;
  const f2Y = 3.6;
  const roofY = 7.2;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'of_f1', minX, maxX, minZ, maxZ, 0, f2Y, 0xdce2e8, 2.0, 2.5, true, true);
  addPerimeterBox(walls, 'of_f2', minX, maxX, minZ, maxZ, f2Y, roofY, 0xdce2e8, 0, 2.5, true, true);

  // Floor 2 Glass Conference Room (minX..-1.0, minZ..-0.5)
  addWallWithDoorGap(walls, 'of_conf_e', 'x', -1.0, minZ, -0.5, f2Y, roofY, 0x94a3b8, 'glass', -3.0, 1.35, f2Y + 2.4);
  addWallWithDoorGap(walls, 'of_conf_s', 'z', -0.5, minX, -1.0, f2Y, roofY, 0x94a3b8, 'glass');

  const floorSlabs: InteriorFloorSlab[] = [
    { id: 'of_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: f2Y, surface: 'tile' },
    { id: 'of_fl2_m', floorNumber: 2, minX, maxX: 4.1, minZ, maxZ, y: f2Y, ceilingY: roofY, surface: 'carpet' },
    { id: 'of_fl2_n', floorNumber: 2, minX: 4.1, maxX, minZ, maxZ: -3.0, y: f2Y, ceilingY: roofY, surface: 'carpet' },
    { id: 'of_fl2_s', floorNumber: 2, minX: 4.1, maxX, minZ: 3.0, maxZ, y: f2Y, ceilingY: roofY, surface: 'carpet' },
  ];

  walls.push(
    { id: 'of_rail_w', minX: 3.98, maxX: 4.14, minY: f2Y, maxY: f2Y + 1.05, minZ: -3.0, maxZ: 3.0, color: 0x334155, kind: 'railing', blocksCamera: false },
    { id: 'of_rail_s', minX: 4.1, maxX, minY: f2Y, maxY: f2Y + 1.05, minZ: 2.92, maxZ: 3.08, color: 0x334155, kind: 'railing', blocksCamera: false },
  );

  const staircases: InteriorStaircase[] = [
    { id: 'of_st', fromFloor: 1, toFloor: 2, minX: 4.2, maxX: 6.7, minZ: -3.0, maxZ: 3.0, yStart: 0, yEnd: f2Y, axis: 'z', direction: -1 },
  ];

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 2.0, 2.5, maxZ, 'glass', accentColor),
    {
      id: 'of_conf_door',
      label: 'Conference Room Door',
      hingeX: -1.0,
      y: f2Y,
      hingeZ: -3.67,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.34,
      height: 2.38,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x38bdf8,
      style: 'glass',
    },
    ...(buildingId === 'civic_office_east'
      ? [
          {
            id: 'of_rooftop_door',
            label: 'Rooftop Garden Terrace Door',
            hingeX: 4.75,
            y: f2Y,
            hingeZ: minZ + 0.08,
            closedYaw: 0,
            openAngle: Math.PI * 0.48,
            width: 1.35,
            height: 2.35,
            thickness: 0.08,
            isExitDoor: false,
            color: 0x0ea5e9,
            style: 'metal' as const,
            rooftopTarget: {
              rooftopId: 'roof_civic_office',
              x: -15.0,
              y: 24.14,
              z: -27.8,
              yaw: 0,
            },
          },
        ]
      : []),
  ];

  const furniture: InteriorFurnitureProp[] = [
    // Floor 1 Reception
    { id: 'of_rec', kind: 'reception_desk', x: 0, y: 0, z: -3.2, rotY: 0, width: 3.6, height: 1.08, depth: 0.95, primaryColor: 0x2c4863, accentColor: 0xf1f5f9 },
    { id: 'of_sofa', kind: 'sofa', x: -5.2, y: 0, z: 1.5, rotY: Math.PI * 0.5, width: 2.5, height: 0.9, depth: 0.95, primaryColor: 0x334155 },
    { id: 'of_desk1', kind: 'desk', x: -4.2, y: 0, z: -4.5, rotY: 0, width: 1.8, height: 0.82, depth: 0.85, primaryColor: 0x7c583c },
    { id: 'of_pl1', kind: 'plant', x: -5.8, y: 0, z: 5.0, rotY: 0, width: 0.65, height: 1.5, depth: 0.65, primaryColor: 0x3d824b, blocksCamera: false },
    // Floor 2 Conference & Open Workstations
    { id: 'of_conf', kind: 'conference_table', x: -4.1, y: f2Y, z: -3.3, rotY: 0, width: 3.4, height: 0.82, depth: 1.55, primaryColor: 0x5c3e2a },
    { id: 'of_ws1', kind: 'desk', x: -4.4, y: f2Y, z: 2.8, rotY: Math.PI, width: 1.8, height: 0.82, depth: 0.85, primaryColor: 0xe2e8f0 },
    { id: 'of_ws2', kind: 'desk', x: 0.6, y: f2Y, z: 2.8, rotY: Math.PI, width: 1.8, height: 0.82, depth: 0.85, primaryColor: 0xe2e8f0 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'business',
    subtype: 'office',
    floorsCount: 2,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs,
    staircases,
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: 0, y: 3.25, z: 0.5, color: 0xf8fafc, intensity: 2.4, distance: 14 },
      { x: -3.5, y: f2Y + 3.25, z: -3.0, color: 0xf8fafc, intensity: 2.3, distance: 13 },
      { x: 1.0, y: f2Y + 3.25, z: 2.0, color: 0xf8fafc, intensity: 2.3, distance: 13 },
    ],
    ambientColor: 0xf4f8fc,
    wallColor: 0xdce2e8,
    ceilingColor: 0xf1f5f9,
    accentColor,
  };
}

function buildCityTower22F(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -9.5;
  const maxX = 9.5;
  const minZ = -8.0;
  const maxZ = 8.0;
  const FLOOR_H = 3.6;
  const FLOORS = 22;

  const walls: InteriorWallBox[] = [];
  const floorSlabs: InteriorFloorSlab[] = [];
  const staircases: InteriorStaircase[] = [];
  const doors: InteriorDoorSpec[] = [makeExitDoor('exit_door', 2.2, 2.6, maxZ, 'glass', accentColor)];
  const furniture: InteriorFurnitureProp[] = [];
  const lights: InteriorLightSpec[] = [];

  const elevFloors = [];
  const floorSubtitle = (f: number): string => {
    if (f === 1) return 'Floor 1 · Grand Lobby';
    if (f === 2) return 'Floor 2 · Welcome Lounge';
    if (f === 9) return 'Floor 9 · Engineering Bay';
    if (f >= 14 && f <= 16) return `Floor ${f} · Sky Lounge`;
    if (f === 17) return 'Floor 17 · Tech Systems';
    if (f >= 18 && f <= 20) return `Floor ${f} · Observation Deck`;
    if (f === 21) return 'Floor 21 · Executive Penthouse';
    if (f === 22) return 'Floor 22 · Rooftop';
    return `Floor ${f} · Tower Offices`;
  };

  for (let f = 1; f <= FLOORS; f++) {
    const y0 = (f - 1) * FLOOR_H;
    const y1 = y0 + FLOOR_H;
    const isRooftop = f === FLOORS;
    elevFloors.push({
      floorNumber: f,
      y: y0,
      label: floorSubtitle(f),
      exitX: -1.8,
      exitZ: -3.7,
      exitYaw: Math.PI,
    });

    // Floor slabs (Floor 1 solid except outside bounds; Floors 2..22 cut out elevator shaft [-3.25..-0.35 x -8.0..-4.75] & switchback stairwell [4.5..9.5 x -4.2..4.2])
    const surface: InteriorFloorSlab['surface'] =
      f === 1 ? 'marble' : f === 9 || f === 17 || isRooftop ? 'concrete' : f >= 18 ? 'wood' : 'carpet';

    if (f === 1) {
      floorSlabs.push({
        id: `ct_fl_${f}`,
        floorNumber: f,
        minX,
        maxX,
        minZ,
        maxZ,
        y: y0,
        ceilingY: y1,
        surface,
      });
    } else {
      const ceil = isRooftop ? y0 + 10.5 : y1;
      floorSlabs.push(
        { id: `ct_fl_${f}_w`, floorNumber: f, minX, maxX: -3.25, minZ, maxZ, y: y0, ceilingY: ceil, surface, hasOpenSky: isRooftop },
        { id: `ct_fl_${f}_ms`, floorNumber: f, minX: -3.25, maxX: 4.5, minZ: -4.75, maxZ, y: y0, ceilingY: ceil, surface, hasOpenSky: isRooftop },
        { id: `ct_fl_${f}_mne`, floorNumber: f, minX: -0.35, maxX: 4.5, minZ, maxZ: -4.75, y: y0, ceilingY: ceil, surface, hasOpenSky: isRooftop },
        { id: `ct_fl_${f}_sn`, floorNumber: f, minX: 4.5, maxX: maxX, minZ, maxZ: -4.2, y: y0, ceilingY: ceil, surface, hasOpenSky: isRooftop },
        { id: `ct_fl_${f}_ss`, floorNumber: f, minX: 4.5, maxX: maxX, minZ: 4.2, maxZ, y: y0, ceilingY: ceil, surface, hasOpenSky: isRooftop },
      );
    }

    // Perimeter walls or Rooftop observation railings
    if (isRooftop) {
      const railColor = 0x38bdf8;
      walls.push(
        { id: `ct_roof_n`, minX, maxX, minY: y0, maxY: y0 + 1.25, minZ: minZ - 0.12, maxZ: minZ + 0.14, color: railColor, kind: 'railing', blocksCamera: false },
        { id: `ct_roof_s`, minX, maxX, minY: y0, maxY: y0 + 1.25, minZ: maxZ - 0.14, maxZ: maxZ + 0.12, color: railColor, kind: 'railing', blocksCamera: false },
        { id: `ct_roof_w`, minX: minX - 0.12, maxX: minX + 0.14, minY: y0, maxY: y0 + 1.25, minZ, maxZ, color: railColor, kind: 'railing', blocksCamera: false },
        { id: `ct_roof_e`, minX: maxX - 0.14, maxX: maxX + 0.12, minY: y0, maxY: y0 + 1.25, minZ, maxZ, color: railColor, kind: 'railing', blocksCamera: false },
      );
      doors.push({
        id: 'ct_rooftop_door',
        label: 'City Skydeck & Helipad Door',
        hingeX: -7.1,
        y: y0,
        hingeZ: minZ + 0.1,
        closedYaw: 0,
        openAngle: Math.PI * 0.48,
        width: 1.4,
        height: 2.38,
        thickness: 0.08,
        isExitDoor: false,
        color: 0x0ea5e9,
        style: 'metal',
        rooftopTarget: {
          rooftopId: 'roof_freedom_tower',
          x: -20.8,
          y: 76.14,
          z: -27.4,
          yaw: 0,
        },
      });
    } else {
      const wallCol = f % 2 === 0 ? 0xdbe3eb : 0xe2e8f0;
      addPerimeterBox(walls, `ct_f${f}`, minX, maxX, minZ, maxZ, y0, y1, wallCol, f === 1 ? 2.2 : 0, 2.6, true, true);
    }

    // Elevator shaft side/back enclosure on all floors so players cannot clip around shaft
    const shaftWallH = isRooftop ? 2.9 : FLOOR_H;
    walls.push(
      { id: `ct_elev_w_${f}`, minX: -3.28, maxX: -3.1, minY: y0, maxY: y0 + shaftWallH, minZ: -7.5, maxZ: -4.8, color: 0x334155, kind: 'wall', blocksCamera: true },
      { id: `ct_elev_e_${f}`, minX: -0.5, maxX: -0.32, minY: y0, maxY: y0 + shaftWallH, minZ: -7.5, maxZ: -4.8, color: 0x334155, kind: 'wall', blocksCamera: true },
      { id: `ct_elev_b_${f}`, minX: -3.28, maxX: -0.32, minY: y0, maxY: y0 + shaftWallH, minZ: -7.5, maxZ: -7.25, color: 0x1e293b, kind: 'wall', blocksCamera: true },
    );

    // Stairwell safety railings on floors 2..22 (leave South edge z=4.2 open for entering/exiting stairs)
    if (f >= 2) {
      walls.push(
        { id: `ct_st_rail_w_${f}`, minX: 4.42, maxX: 4.58, minY: y0, maxY: y0 + 1.08, minZ: -4.2, maxZ: 4.2, color: 0x334155, kind: 'railing', blocksCamera: false },
        { id: `ct_st_rail_n_${f}`, minX: 4.5, maxX: 9.45, minY: y0, maxY: y0 + 1.08, minZ: -4.28, maxZ: -4.12, color: 0x334155, kind: 'railing', blocksCamera: false },
      );
    }

    // Continuous 2-flight Switchback Staircase connecting Floor f -> f+1
    if (f < FLOORS) {
      const midY = y0 + FLOOR_H * 0.5;
      staircases.push(
        {
          id: `ct_st_${f}_a`,
          fromFloor: f,
          toFloor: f + 1,
          minX: 4.65,
          maxX: 6.75,
          minZ: -1.8,
          maxZ: 4.0,
          yStart: y0,
          yEnd: midY,
          axis: 'z',
          direction: -1,
          isSwitchback: true,
          midLanding: {
            minX: 4.55,
            maxX: 9.35,
            minZ: -4.12,
            maxZ: -1.8,
            y: midY,
          },
        },
        {
          id: `ct_st_${f}_b`,
          fromFloor: f,
          toFloor: f + 1,
          minX: 7.05,
          maxX: 9.25,
          minZ: -1.8,
          maxZ: 4.0,
          yStart: midY,
          yEnd: y1,
          axis: 'z',
          direction: 1,
          isSwitchback: true,
        },
      );
      // Center balustrade between switchback flights
      walls.push({
        id: `ct_st_mid_rail_${f}`,
        minX: 6.84,
        maxX: 6.96,
        minY: y0,
        maxY: y1,
        minZ: -1.8,
        maxZ: 3.9,
        color: 0x475569,
        kind: 'railing',
        blocksCamera: false,
      });
    }

    // Varied themed floor furnishing (keeping central corridor [-3.0..4.3] walkable)
    if (f === 1) {
      furniture.push(
        { id: 'ct_rec_desk', kind: 'reception_desk', x: -6.2, y: y0, z: -2.4, rotY: 0, width: 3.8, height: 1.12, depth: 1.0, primaryColor: 0x1e293b, accentColor: 0xf59e0b },
        { id: 'ct_lobby_sofa', kind: 'sofa', x: -6.8, y: y0, z: 2.6, rotY: Math.PI * 0.5, width: 2.6, height: 0.9, depth: 0.95, primaryColor: 0x315f80 },
        { id: 'ct_lobby_pl1', kind: 'plant', x: -7.6, y: y0, z: 6.2, rotY: 0, width: 0.75, height: 1.75, depth: 0.75, primaryColor: 0x3b804a, blocksCamera: false },
        { id: 'ct_lobby_pl2', kind: 'plant', x: 3.2, y: y0, z: 6.2, rotY: 0, width: 0.75, height: 1.75, depth: 0.75, primaryColor: 0x3b804a, blocksCamera: false },
      );
    } else if (f === 22) {
      furniture.push(
        { id: 'ct_roof_bar', kind: 'espresso_bar', x: -6.4, y: y0, z: -3.2, rotY: Math.PI * 0.5, width: 3.6, height: 1.12, depth: 0.95, primaryColor: 0x1e293b, accentColor: 0x38bdf8 },
        { id: 'ct_roof_sofa1', kind: 'sofa', x: -5.8, y: y0, z: 3.6, rotY: Math.PI * 0.5, width: 2.6, height: 0.9, depth: 0.95, primaryColor: 0x0f766e },
        { id: 'ct_roof_sofa2', kind: 'sofa', x: 1.2, y: y0, z: 4.8, rotY: Math.PI, width: 2.6, height: 0.9, depth: 0.95, primaryColor: 0x315f80 },
        { id: 'ct_roof_table', kind: 'coffee_table', x: 1.2, y: y0, z: 3.1, rotY: 0, width: 1.4, height: 0.45, depth: 0.8, primaryColor: 0x475569 },
        { id: 'ct_roof_pl1', kind: 'plant', x: -8.1, y: y0, z: -6.4, rotY: 0, width: 0.75, height: 1.65, depth: 0.75, primaryColor: 0x3b804a, blocksCamera: false },
        { id: 'ct_roof_pl2', kind: 'plant', x: 8.1, y: y0, z: 6.4, rotY: 0, width: 0.75, height: 1.65, depth: 0.75, primaryColor: 0x3b804a, blocksCamera: false },
      );
    } else if (f === 9 || f === 17) {
      furniture.push(
        { id: `ct_mach_${f}`, kind: 'machinery', x: -6.8, y: y0, z: -2.0, rotY: 0, width: 2.4, height: 2.2, depth: 3.6, primaryColor: 0x334155, accentColor: 0xf59e0b },
        { id: `ct_wb_${f}`, kind: 'workbench', x: -6.4, y: y0, z: 3.8, rotY: 0, width: 2.6, height: 0.95, depth: 0.9, primaryColor: 0x475569 },
        { id: `ct_ed_${f}`, kind: 'desk', x: 1.2, y: y0, z: 4.5, rotY: Math.PI, width: 1.8, height: 0.82, depth: 0.85, primaryColor: 0x64748b },
      );
    } else if (f >= 14 && f <= 16) {
      furniture.push(
        { id: `ct_lounge_s_${f}`, kind: 'sofa', x: -6.8, y: y0, z: 1.8, rotY: Math.PI * 0.5, width: 2.6, height: 0.9, depth: 0.95, primaryColor: 0x7c2d12 },
        { id: `ct_lounge_t_${f}`, kind: 'coffee_table', x: -5.0, y: y0, z: 1.8, rotY: 0, width: 1.2, height: 0.45, depth: 0.75, primaryColor: 0x5c3e2a },
        { id: `ct_lounge_d_${f}`, kind: 'dining_table', x: 1.2, y: y0, z: 4.2, rotY: 0, width: 1.8, height: 0.82, depth: 1.2, primaryColor: 0x6f4a32 },
        { id: `ct_lounge_p_${f}`, kind: 'plant', x: -7.8, y: y0, z: -6.0, rotY: 0, width: 0.7, height: 1.6, depth: 0.7, primaryColor: 0x3b804a, blocksCamera: false },
      );
    } else if (f === 21) {
      furniture.push(
        { id: `ct_ceo_${f}`, kind: 'desk', x: -6.4, y: y0, z: -3.2, rotY: 0, width: 2.4, height: 0.86, depth: 1.0, primaryColor: 0x4f3524 },
        { id: `ct_board_${f}`, kind: 'conference_table', x: 0.6, y: y0, z: 2.2, rotY: 0, width: 3.6, height: 0.84, depth: 1.5, primaryColor: 0x5c3c28 },
        { id: `ct_exec_s_${f}`, kind: 'sofa', x: -6.4, y: y0, z: 3.8, rotY: Math.PI * 0.5, width: 2.5, height: 0.9, depth: 0.95, primaryColor: 0x1e3a5f },
      );
    } else {
      furniture.push(
        { id: `ct_d1_${f}`, kind: 'desk', x: -6.4, y: y0, z: -3.6, rotY: 0, width: 2.0, height: 0.82, depth: 0.9, primaryColor: f % 2 === 0 ? 0x475569 : 0x6f4b32 },
        { id: `ct_d2_${f}`, kind: 'desk', x: -6.4, y: y0, z: 2.4, rotY: Math.PI, width: 2.0, height: 0.82, depth: 0.9, primaryColor: f % 2 === 0 ? 0x475569 : 0x6f4b32 },
        { id: `ct_sf_${f}`, kind: 'sofa', x: 0.6, y: y0, z: 4.8, rotY: Math.PI, width: 2.4, height: 0.88, depth: 0.92, primaryColor: 0x334155 },
      );
    }

    // Two ceiling lights per floor (pooled to 4 active lights in interiorBuilder)
    if (!isRooftop) {
      lights.push(
        { x: -3.8, y: y0 + 3.25, z: -0.5, color: f >= 14 ? 0xffe8c2 : 0xf8fafc, intensity: 2.5, distance: 16 },
        { x: 2.4, y: y0 + 3.25, z: 2.2, color: 0xf8fafc, intensity: 2.3, distance: 15 },
      );
    } else {
      lights.push({ x: -1.8, y: y0 + 2.6, z: -3.5, color: 0x38bdf8, intensity: 2.4, distance: 18 });
    }
  }

  return {
    id: `int_${buildingId}`,
    buildingId,
    name: 'CITY TOWER',
    category: 'business',
    subtype: 'corporate',
    floorsCount: FLOORS,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.2, yaw: 0 },
    floorSlabs,
    staircases,
    elevators: [
      {
        id: 'city_tower_elev',
        x: -1.8,
        z: -6.0,
        width: 2.5,
        depth: 2.2,
        floors: elevFloors,
      },
    ],
    walls,
    doors,
    furniture,
    lights,
    ambientColor: 0xf7f9fc,
    wallColor: 0xd8e0e8,
    ceilingColor: 0xf8fafc,
    accentColor,
  };
}

function buildCorporate(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  if (buildingId === 'freedom_tower') {
    return buildCityTower22F(buildingId, name, accentColor);
  }
  const minX = -8.5;
  const maxX = 8.5;
  const minZ = -7.0;
  const maxZ = 7.0;
  const f2Y = 3.8;
  const f3Y = 7.6;
  const roofY = 11.4;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'cp_f1', minX, maxX, minZ, maxZ, 0, f2Y, 0xd8e0e8, 2.2, 2.6, true, true);
  addPerimeterBox(walls, 'cp_f2', minX, maxX, minZ, maxZ, f2Y, f3Y, 0xdce3eb, 0, 2.6, true, true);
  addPerimeterBox(walls, 'cp_f3', minX, maxX, minZ, maxZ, f3Y, roofY, 0xe3dfd6, 0, 2.6, true, true);

  // Executive glass partition on Floor 3
  addWallWithDoorGap(walls, 'cp_exec_w', 'x', -1.8, minZ, 1.5, f3Y, roofY, 0x94a3b8, 'glass', -1.5, 1.4, f3Y + 2.45);
  addWallWithDoorGap(walls, 'cp_exec_s', 'z', 1.5, minX, -1.8, f3Y, roofY, 0x94a3b8, 'glass');

  const floorSlabs: InteriorFloorSlab[] = [
    { id: 'cp_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: f2Y, surface: 'marble' },
    // F2
    { id: 'cp_fl2_m', floorNumber: 2, minX, maxX: 5.1, minZ, maxZ, y: f2Y, ceilingY: f3Y, surface: 'carpet' },
    { id: 'cp_fl2_n', floorNumber: 2, minX: 5.1, maxX, minZ, maxZ: -3.2, y: f2Y, ceilingY: f3Y, surface: 'carpet' },
    { id: 'cp_fl2_s', floorNumber: 2, minX: 5.1, maxX, minZ: 3.2, maxZ, y: f2Y, ceilingY: f3Y, surface: 'carpet' },
    // F3
    { id: 'cp_fl3_m', floorNumber: 3, minX, maxX: 5.1, minZ, maxZ, y: f3Y, ceilingY: roofY, surface: 'wood' },
    { id: 'cp_fl3_n', floorNumber: 3, minX: 5.1, maxX, minZ, maxZ: -3.2, y: f3Y, ceilingY: roofY, surface: 'wood' },
    { id: 'cp_fl3_s', floorNumber: 3, minX: 5.1, maxX, minZ: 3.2, maxZ, y: f3Y, ceilingY: roofY, surface: 'wood' },
  ];

  for (const [tag, fy] of [
    ['f2', f2Y],
    ['f3', f3Y],
  ] as const) {
    walls.push(
      { id: `cp_rail_${tag}_w`, minX: 4.96, maxX: 5.14, minY: fy, maxY: fy + 1.05, minZ: -3.2, maxZ: 3.2, color: 0x1e293b, kind: 'railing', blocksCamera: false },
      { id: `cp_rail_${tag}_s`, minX: 5.1, maxX, minY: fy, maxY: fy + 1.05, minZ: 3.12, maxZ: 3.28, color: 0x1e293b, kind: 'railing', blocksCamera: false },
    );
  }

  const staircases: InteriorStaircase[] = [
    { id: 'cp_st_1', fromFloor: 1, toFloor: 2, minX: 5.2, maxX: 8.1, minZ: -3.2, maxZ: 3.2, yStart: 0, yEnd: f2Y, axis: 'z', direction: -1 },
    { id: 'cp_st_2', fromFloor: 2, toFloor: 3, minX: 5.2, maxX: 8.1, minZ: -3.2, maxZ: 3.2, yStart: f2Y, yEnd: f3Y, axis: 'z', direction: -1 },
  ];

  const elevators = [
    {
      id: 'cp_elev',
      x: 1.8,
      z: -5.6,
      width: 2.3,
      depth: 2.1,
      floors: [
        { floorNumber: 1, y: 0, label: 'Floor 1 · Grand Lobby', exitX: 1.8, exitZ: -3.8, exitYaw: Math.PI },
        { floorNumber: 2, y: f2Y, label: 'Floor 2 · Operations', exitX: 1.8, exitZ: -3.8, exitYaw: Math.PI },
        { floorNumber: 3, y: f3Y, label: 'Floor 3 · Executive Boardroom', exitX: 1.8, exitZ: -3.8, exitYaw: Math.PI },
      ],
    },
  ];

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 2.2, 2.6, maxZ, 'glass', accentColor),
    {
      id: 'cp_exec_door',
      label: 'CEO Suite Door',
      hingeX: -1.8,
      y: f3Y,
      hingeZ: -2.2,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.4,
      height: 2.4,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x38bdf8,
      style: 'glass',
    },
  ];

  const furniture: InteriorFurnitureProp[] = [
    // Floor 1 Grand Reception
    { id: 'cp_rec', kind: 'reception_desk', x: -3.0, y: 0, z: -2.8, rotY: 0, width: 4.4, height: 1.12, depth: 1.0, primaryColor: 0x1e293b, accentColor: 0xf59e0b },
    { id: 'cp_sofa1', kind: 'sofa', x: -6.4, y: 0, z: 2.5, rotY: Math.PI * 0.5, width: 2.8, height: 0.9, depth: 0.95, primaryColor: 0x315f80 },
    { id: 'cp_pl1', kind: 'plant', x: -6.8, y: 0, z: 5.6, rotY: 0, width: 0.75, height: 1.75, depth: 0.75, primaryColor: 0x3b804a, blocksCamera: false },
    { id: 'cp_pl2', kind: 'plant', x: 3.5, y: 0, z: 5.6, rotY: 0, width: 0.75, height: 1.75, depth: 0.75, primaryColor: 0x3b804a, blocksCamera: false },
    // Floor 2 Operations Workstations
    { id: 'cp_op1', kind: 'desk', x: -5.2, y: f2Y, z: -3.8, rotY: 0, width: 2.0, height: 0.82, depth: 0.9, primaryColor: 0x475569 },
    { id: 'cp_op2', kind: 'desk', x: -1.6, y: f2Y, z: -3.8, rotY: 0, width: 2.0, height: 0.82, depth: 0.9, primaryColor: 0x475569 },
    { id: 'cp_op3', kind: 'desk', x: -5.2, y: f2Y, z: 2.8, rotY: Math.PI, width: 2.0, height: 0.82, depth: 0.9, primaryColor: 0x475569 },
    { id: 'cp_op4', kind: 'desk', x: -1.6, y: f2Y, z: 2.8, rotY: Math.PI, width: 2.0, height: 0.82, depth: 0.9, primaryColor: 0x475569 },
    // Floor 3 Boardroom & CEO Desk
    { id: 'cp_ceo', kind: 'desk', x: -5.2, y: f3Y, z: -3.4, rotY: 0, width: 2.5, height: 0.85, depth: 1.1, primaryColor: 0x4f3524 },
    { id: 'cp_board', kind: 'conference_table', x: 1.2, y: f3Y, z: 1.8, rotY: 0, width: 4.2, height: 0.84, depth: 1.75, primaryColor: 0x5c3c28 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'business',
    subtype: 'corporate',
    floorsCount: 3,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs,
    staircases,
    elevators,
    walls,
    doors,
    furniture,
    lights: [
      { x: -1.5, y: 3.4, z: 1.0, color: 0xfff8eb, intensity: 2.5, distance: 16 },
      { x: -2.0, y: f2Y + 3.4, z: 0, color: 0xf8fafc, intensity: 2.4, distance: 15 },
      { x: -3.8, y: f3Y + 3.4, z: -2.5, color: 0xffe8c4, intensity: 2.4, distance: 15 },
      { x: 1.5, y: f3Y + 3.4, z: 1.5, color: 0xfff6e5, intensity: 2.3, distance: 14 },
    ],
    ambientColor: 0xf7f9fc,
    wallColor: 0xd8e0e8,
    ceilingColor: 0xf8fafc,
    accentColor,
  };
}

function buildWorkshop(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -7.0;
  const maxX = 7.0;
  const minZ = -6.5;
  const maxZ = 6.5;
  const h = 4.2;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'ws', minX, maxX, minZ, maxZ, 0, h, 0x9ca3af, 2.2, 2.8, false, true);
  // Parts office partition on North-East
  addWallWithDoorGap(walls, 'ws_off_w', 'x', 2.0, minZ, -1.5, 0, h, 0x6b7280, 'partition', -3.6, 1.25, 2.4);
  addWallWithDoorGap(walls, 'ws_off_s', 'z', -1.5, 2.0, maxX, 0, h, 0x6b7280, 'partition');

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 2.2, 2.8, maxZ, 'metal', accentColor),
    {
      id: 'ws_off_door',
      label: 'Parts Office Door',
      hingeX: 2.0,
      y: 0,
      hingeZ: -4.22,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.24,
      height: 2.35,
      thickness: 0.08,
      isExitDoor: false,
      color: 0xb45309,
      style: 'metal',
    },
  ];

  const furniture: InteriorFurnitureProp[] = [
    { id: 'ws_lift', kind: 'car_lift', x: -3.4, y: 0, z: -1.6, rotY: 0, width: 3.1, height: 2.8, depth: 4.2, primaryColor: accentColor, accentColor: 0x334155 },
    { id: 'ws_bench1', kind: 'workbench', x: -6.0, y: 0, z: 2.2, rotY: Math.PI * 0.5, width: 3.2, height: 1.05, depth: 0.9, primaryColor: 0xb91c1c, accentColor: 0x64748b },
    { id: 'ws_rack', kind: 'shelf_rack', x: 5.8, y: 0, z: 2.5, rotY: 0, width: 1.1, height: 2.2, depth: 3.4, primaryColor: 0x475569, accentColor: 0xf59e0b },
    { id: 'ws_desk', kind: 'desk', x: 4.5, y: 0, z: -4.5, rotY: 0, width: 1.8, height: 0.85, depth: 0.85, primaryColor: 0x475569 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'industrial',
    subtype: 'workshop',
    floorsCount: 1,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs: [{ id: 'ws_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: h, surface: 'concrete' }],
    staircases: [],
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: -3.2, y: 3.8, z: -1.0, color: 0xf8fafc, intensity: 2.6, distance: 15 },
      { x: 3.5, y: 3.8, z: 2.0, color: 0xfff7ed, intensity: 2.2, distance: 13 },
      { x: 4.4, y: 3.8, z: -4.2, color: 0xfffbeb, intensity: 2.0, distance: 10 },
    ],
    ambientColor: 0xeff3f7,
    wallColor: 0x9ca3af,
    ceilingColor: 0x64748b,
    accentColor,
  };
}

function buildWarehouse(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -8.0;
  const maxX = 8.0;
  const minZ = -7.0;
  const maxZ = 7.0;
  const f2Y = 3.6;
  const roofY = 7.2;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'wh_f1', minX, maxX, minZ, maxZ, 0, f2Y, 0x8a939e, 2.2, 2.8, false, true);
  addPerimeterBox(walls, 'wh_f2', minX, maxX, minZ, maxZ, f2Y, roofY, 0x8a939e, 0, 2.8, true, true);

  // Mezzanine Supervisor Deck along North (z: -7.0..-1.8) + Steel Stairs on East (x: 4.8..7.5, z: -1.8..3.8)
  const floorSlabs: InteriorFloorSlab[] = [
    { id: 'wh_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: f2Y, surface: 'concrete' },
    { id: 'wh_fl2_mez', floorNumber: 2, minX, maxX, minZ, maxZ: -1.8, y: f2Y, ceilingY: roofY, surface: 'concrete' },
  ];

  walls.push(
    { id: 'wh_rail_s', minX, maxX: 4.8, minY: f2Y, maxY: f2Y + 1.05, minZ: -1.9, maxZ: -1.72, color: 0xf59e0b, kind: 'railing', blocksCamera: false },
  );

  // Supervisor Office on mezzanine West
  addWallWithDoorGap(walls, 'wh_sup_e', 'x', -1.8, minZ, -1.8, f2Y, roofY, 0x64748b, 'partition', -4.4, 1.25, f2Y + 2.35);

  const staircases: InteriorStaircase[] = [
    { id: 'wh_st', fromFloor: 1, toFloor: 2, minX: 4.8, maxX: 7.5, minZ: -1.8, maxZ: 3.8, yStart: 0, yEnd: f2Y, axis: 'z', direction: -1 },
  ];

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 2.2, 2.8, maxZ, 'metal', accentColor),
    {
      id: 'wh_sup_door',
      label: 'Supervisor Office Door',
      hingeX: -1.8,
      y: f2Y,
      hingeZ: -5.02,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.24,
      height: 2.32,
      thickness: 0.08,
      isExitDoor: false,
      color: 0xd97706,
      style: 'metal',
    },
    ...(buildingId === 'ind_warehouse'
      ? [
          {
            id: 'wh_rooftop_door',
            label: 'Rooftop Helipad Door',
            hingeX: 5.45,
            y: f2Y,
            hingeZ: minZ + 0.08,
            closedYaw: 0,
            openAngle: Math.PI * 0.48,
            width: 1.35,
            height: 2.35,
            thickness: 0.08,
            isExitDoor: false,
            color: 0x0ea5e9,
            style: 'metal' as const,
            rooftopTarget: {
              rooftopId: 'roof_ind_warehouse',
              x: 72.5,
              y: 7.64,
              z: -20.5,
              yaw: 0,
            },
          },
        ]
      : []),
  ];

  const furniture: InteriorFurnitureProp[] = [
    { id: 'wh_r1', kind: 'shelf_rack', x: -5.6, y: 0, z: -2.0, rotY: 0, width: 1.4, height: 2.6, depth: 5.5, primaryColor: 0xc2410c, accentColor: 0xd97706 },
    { id: 'wh_r2', kind: 'shelf_rack', x: -1.6, y: 0, z: -2.0, rotY: 0, width: 1.4, height: 2.6, depth: 5.5, primaryColor: 0x2563eb, accentColor: 0xd97706 },
    { id: 'wh_wb', kind: 'workbench', x: 2.4, y: 0, z: 2.2, rotY: 0, width: 2.6, height: 1.0, depth: 0.9, primaryColor: 0x475569 },
    // Mezzanine
    { id: 'wh_desk', kind: 'desk', x: -4.8, y: f2Y, z: -4.8, rotY: 0, width: 2.0, height: 0.85, depth: 0.9, primaryColor: 0x334155 },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'industrial',
    subtype: 'warehouse',
    floorsCount: 2,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs,
    staircases,
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: -3.2, y: 3.4, z: 1.5, color: 0xf8fafc, intensity: 2.5, distance: 15 },
      { x: 2.5, y: 3.4, z: -1.5, color: 0xf8fafc, intensity: 2.3, distance: 14 },
      { x: -2.5, y: f2Y + 3.2, z: -4.5, color: 0xfff7ed, intensity: 2.3, distance: 13 },
    ],
    ambientColor: 0xecf1f6,
    wallColor: 0x8a939e,
    ceilingColor: 0x64748b,
    accentColor,
  };
}

function buildFactory(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -8.5;
  const maxX = 8.5;
  const minZ = -7.5;
  const maxZ = 7.5;
  const f2Y = 3.8;
  const roofY = 7.6;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'fc_f1', minX, maxX, minZ, maxZ, 0, f2Y, 0x8c877f, 2.2, 2.8, false, true);
  addPerimeterBox(walls, 'fc_f2', minX, maxX, minZ, maxZ, f2Y, roofY, 0x8c877f, 0, 2.8, true, true);

  // Control Catwalk Gallery on Floor 2 (North end z: -7.5..-2.0)
  const floorSlabs: InteriorFloorSlab[] = [
    { id: 'fc_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: f2Y, surface: 'concrete' },
    { id: 'fc_fl2', floorNumber: 2, minX, maxX, minZ, maxZ: -2.0, y: f2Y, ceilingY: roofY, surface: 'concrete' },
  ];
  walls.push(
    { id: 'fc_rail_s', minX, maxX: 5.0, minY: f2Y, maxY: f2Y + 1.05, minZ: -2.1, maxZ: -1.92, color: 0xf59e0b, kind: 'railing', blocksCamera: false },
  );

  // Glass Control Room on Floor 2 West
  addWallWithDoorGap(walls, 'fc_ctrl_e', 'x', -1.4, minZ, -2.0, f2Y, roofY, 0x475569, 'glass', -4.6, 1.3, f2Y + 2.4);

  const staircases: InteriorStaircase[] = [
    { id: 'fc_st', fromFloor: 1, toFloor: 2, minX: 5.1, maxX: 7.9, minZ: -2.0, maxZ: 3.8, yStart: 0, yEnd: f2Y, axis: 'z', direction: -1 },
  ];

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 2.2, 2.8, maxZ, 'metal', accentColor),
    {
      id: 'fc_ctrl_door',
      label: 'Control Booth Door',
      hingeX: -1.4,
      y: f2Y,
      hingeZ: -5.25,
      closedYaw: Math.PI * 0.5,
      openAngle: Math.PI * 0.48,
      width: 1.28,
      height: 2.38,
      thickness: 0.08,
      isExitDoor: false,
      color: 0x38bdf8,
      style: 'glass',
    },
  ];

  const furniture: InteriorFurnitureProp[] = [
    { id: 'fc_m1', kind: 'machinery', x: -4.8, y: 0, z: -2.0, rotY: 0, width: 2.6, height: 2.5, depth: 5.0, primaryColor: accentColor, accentColor: 0x334155 },
    { id: 'fc_m2', kind: 'machinery', x: 0.4, y: 0, z: -2.5, rotY: 0, width: 2.4, height: 2.4, depth: 4.2, primaryColor: 0x3b6991, accentColor: 0x334155 },
    { id: 'fc_wb', kind: 'workbench', x: 3.2, y: 0, z: 3.5, rotY: 0, width: 2.8, height: 1.0, depth: 0.9, primaryColor: 0x475569 },
    // Control Booth
    { id: 'fc_ctrl_desk', kind: 'desk', x: -5.0, y: f2Y, z: -5.2, rotY: 0, width: 2.8, height: 0.9, depth: 0.95, primaryColor: 0x1e293b },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'industrial',
    subtype: 'factory',
    floorsCount: 2,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.05, yaw: 0 },
    floorSlabs,
    staircases,
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: -2.5, y: 3.5, z: 1.5, color: 0xfff4de, intensity: 2.5, distance: 16 },
      { x: 2.5, y: 3.5, z: -1.0, color: 0xf8fafc, intensity: 2.3, distance: 14 },
      { x: -3.5, y: f2Y + 3.4, z: -4.8, color: 0xf0f9ff, intensity: 2.4, distance: 14 },
    ],
    ambientColor: 0xf0eee9,
    wallColor: 0x8c877f,
    ceilingColor: 0x57534e,
    accentColor,
  };
}

function buildRewardCenter(
  buildingId: string,
  name: string,
  accentColor: number,
): InteriorBlueprint {
  const minX = -8.5;
  const maxX = 8.5;
  const minZ = -7.5;
  const maxZ = 7.5;
  const h = 4.6;
  const walls: InteriorWallBox[] = [];

  addPerimeterBox(walls, 'rc', minX, maxX, minZ, maxZ, 0, h, 0x1e293b, 2.1, 2.6, true, true);

  const doors: InteriorDoorSpec[] = [
    makeExitDoor('exit_door', 2.1, 2.6, maxZ, 'glass', accentColor),
  ];

  const furniture: InteriorFurnitureProp[] = [
    // Central interactive 3D Reward Studio & KP Redemption Kiosk
    {
      id: 'rc_main_kiosk',
      kind: 'reward_kiosk',
      x: 0,
      y: 0,
      z: -3.2,
      rotY: 0,
      width: 2.6,
      height: 2.35,
      depth: 1.4,
      primaryColor: 0x0f172a,
      accentColor,
      blocksCamera: false,
    },
    // Left Clothing Zone: Wardrobe Racks
    {
      id: 'rc_rack_1',
      kind: 'clothing_rack',
      x: -5.4,
      y: 0,
      z: -2.4,
      rotY: Math.PI * 0.5,
      width: 2.4,
      height: 1.85,
      depth: 0.75,
      primaryColor: 0x38bdf8,
      accentColor: 0xe2e8f0,
    },
    {
      id: 'rc_rack_2',
      kind: 'clothing_rack',
      x: -5.4,
      y: 0,
      z: 1.4,
      rotY: Math.PI * 0.5,
      width: 2.4,
      height: 1.85,
      depth: 0.75,
      primaryColor: 0xa855f7,
      accentColor: 0xe2e8f0,
    },
    // Right Accessory Zone: Illuminated Vitrine Display Cases
    {
      id: 'rc_case_1',
      kind: 'display_case',
      x: 5.4,
      y: 0,
      z: -2.4,
      rotY: -Math.PI * 0.5,
      width: 2.2,
      height: 1.65,
      depth: 0.9,
      primaryColor: 0x0f172a,
      accentColor: 0xfbbf24,
    },
    {
      id: 'rc_case_2',
      kind: 'display_case',
      x: 5.4,
      y: 0,
      z: 1.4,
      rotY: -Math.PI * 0.5,
      width: 2.2,
      height: 1.65,
      depth: 0.9,
      primaryColor: 0x0f172a,
      accentColor: 0x38bdf8,
    },
    // Front Showcase Character Podiums / Mannequin Stands (also trigger 3D Shop)
    {
      id: 'rc_mannequin_w',
      kind: 'mannequin_stand',
      x: -3.2,
      y: 0,
      z: -5.4,
      rotY: 0.32,
      width: 1.2,
      height: 2.05,
      depth: 1.2,
      primaryColor: 0x38bdf8,
      accentColor,
      blocksCamera: false,
    },
    {
      id: 'rc_mannequin_e',
      kind: 'mannequin_stand',
      x: 3.2,
      y: 0,
      z: -5.4,
      rotY: -0.32,
      width: 1.2,
      height: 2.05,
      depth: 1.2,
      primaryColor: 0xec4899,
      accentColor,
      blocksCamera: false,
    },
    // Lounge seating & ornamental greenery
    {
      id: 'rc_sofa',
      kind: 'sofa',
      x: -5.8,
      y: 0,
      z: 5.2,
      rotY: Math.PI * 0.75,
      width: 2.2,
      height: 0.9,
      depth: 0.9,
      primaryColor: 0x334155,
    },
    {
      id: 'rc_plant_1',
      kind: 'plant',
      x: 6.8,
      y: 0,
      z: 5.8,
      rotY: 0,
      width: 0.7,
      height: 1.5,
      depth: 0.7,
      primaryColor: 0x22c55e,
      blocksCamera: false,
    },
  ];

  return {
    id: `int_${buildingId}`,
    buildingId,
    name,
    category: 'commercial',
    subtype: 'reward_shop',
    floorsCount: 1,
    bounds: { minX, maxX, minZ, maxZ },
    spawn: { x: 0, y: 0, z: maxZ - 2.0, yaw: 0 },
    floorSlabs: [
      { id: 'rc_fl1', floorNumber: 1, minX, maxX, minZ, maxZ, y: 0, ceilingY: h, surface: 'marble' },
    ],
    staircases: [],
    elevators: [],
    walls,
    doors,
    furniture,
    lights: [
      { x: 0, y: 4.1, z: -2.8, color: 0xfef3c7, intensity: 2.8, distance: 16 },
      { x: -4.5, y: 4.1, z: 0.4, color: 0xe0f2fe, intensity: 2.3, distance: 13 },
      { x: 4.5, y: 4.1, z: 0.4, color: 0xfef3c7, intensity: 2.3, distance: 13 },
    ],
    ambientColor: 0xf8fafc,
    wallColor: 0x1e293b,
    ceilingColor: 0x0f172a,
    accentColor,
  };
}

export function createInteriorBlueprintForEntrance(
  entrance: BuildingEntranceSpec,
): InteriorBlueprint {
  const { buildingId, subtype, name, accentColor } = entrance;
  switch (subtype) {
    case 'small_house':
      return buildSmallHouse(buildingId, name, accentColor);
    case 'modern_house':
      return buildModernHouse(buildingId, name, accentColor);
    case 'apartment':
      return buildApartment(buildingId, name, accentColor);
    case 'convenience_store':
      return buildConvenienceStore(buildingId, name, accentColor);
    case 'reward_shop':
      return buildRewardCenter(buildingId, name, accentColor);
    case 'restaurant':
      return buildRestaurant(buildingId, name, accentColor);
    case 'cafe':
      return buildCafe(buildingId, name, accentColor);
    case 'mall':
      return buildMall(buildingId, name, accentColor);
    case 'office':
      return buildOffice(buildingId, name, accentColor);
    case 'corporate':
      return buildCorporate(buildingId, name, accentColor);
    case 'workshop':
      return buildWorkshop(buildingId, name, accentColor);
    case 'warehouse':
      return buildWarehouse(buildingId, name, accentColor);
    case 'factory':
      return buildFactory(buildingId, name, accentColor);
  }
}

export const ALL_BUILDING_SUBTYPES: BuildingSubtype[] = [
  'small_house',
  'modern_house',
  'apartment',
  'convenience_store',
  'reward_shop',
  'restaurant',
  'cafe',
  'mall',
  'office',
  'corporate',
  'workshop',
  'warehouse',
  'factory',
];
