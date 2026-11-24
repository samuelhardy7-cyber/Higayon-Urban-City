import type { CityLayout, VehicleKind, VehicleSpec, VehicleState } from './types';
import { CITY_LAYOUT, getGroundHeightAt } from './worldData';

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  sedan: {
    kind: 'sedan',
    label: 'Metro Sedan',
    maxSpeed: 23,
    reverseSpeed: 9.5,
    accel: 12.5,
    brakeDecel: 24,
    turnRate: 2.35,
    length: 4.2,
    width: 1.84,
    wheelRadius: 0.34,
    wheelBase: 2.6,
    trackWidth: 1.72,
    seatOffsetX: -0.36,
    seatOffsetY: 0.62,
    seatOffsetZ: 0.1,
    exitOffsetX: -1.45,
    isMotorcycle: false,
  },
  suv: {
    kind: 'suv',
    label: 'Urban SUV',
    maxSpeed: 21,
    reverseSpeed: 9,
    accel: 11,
    brakeDecel: 22,
    turnRate: 2.05,
    length: 4.4,
    width: 1.98,
    wheelRadius: 0.38,
    wheelBase: 2.75,
    trackWidth: 1.84,
    seatOffsetX: -0.4,
    seatOffsetY: 0.82,
    seatOffsetZ: 0.15,
    exitOffsetX: -1.55,
    isMotorcycle: false,
  },
  sports: {
    kind: 'sports',
    label: 'Apex GT',
    maxSpeed: 32,
    reverseSpeed: 12,
    accel: 18.5,
    brakeDecel: 30,
    turnRate: 2.7,
    length: 4.3,
    width: 1.92,
    wheelRadius: 0.33,
    wheelBase: 2.65,
    trackWidth: 1.8,
    seatOffsetX: -0.36,
    seatOffsetY: 0.5,
    seatOffsetZ: 0.2,
    exitOffsetX: -1.48,
    isMotorcycle: false,
  },
  pickup: {
    kind: 'pickup',
    label: 'Ranger Pickup',
    maxSpeed: 22,
    reverseSpeed: 9.5,
    accel: 11.5,
    brakeDecel: 22,
    turnRate: 2.1,
    length: 4.7,
    width: 2.02,
    wheelRadius: 0.39,
    wheelBase: 2.95,
    trackWidth: 1.88,
    seatOffsetX: -0.4,
    seatOffsetY: 0.84,
    seatOffsetZ: -0.45,
    exitOffsetX: -1.58,
    isMotorcycle: false,
  },
  motor: {
    kind: 'motor',
    label: 'Street Moto',
    maxSpeed: 28,
    reverseSpeed: 6,
    accel: 17,
    brakeDecel: 28,
    turnRate: 3.15,
    length: 2.1,
    width: 0.78,
    wheelRadius: 0.31,
    wheelBase: 1.44,
    trackWidth: 0,
    seatOffsetX: 0,
    seatOffsetY: 0.72,
    seatOffsetZ: 0.15,
    exitOffsetX: -1.05,
    isMotorcycle: true,
  },
};

export interface RoadLaneLoop {
  id: string;
  points: Array<{ x: number; z: number }>;
}

// Right-hand driving lane loops along ROAD_CENTERS = [-84, -42, 0, 42, 84] (halfRoad = 5, lane offset = 2.45)
export const TRAFFIC_LANE_LOOPS: RoadLaneLoop[] = [
  // 1. Inner Central Ring (clockwise around central 4 blocks: -42..42)
  {
    id: 'lane_inner_cw',
    points: [
      { x: -39.55, z: 39.55 },
      { x: -39.55, z: -39.55 },
      { x: 39.55, z: -39.55 },
      { x: 39.55, z: 39.55 },
    ],
  },
  // 2. Inner Central Ring (counter-clockwise on outer right-hand lane)
  {
    id: 'lane_inner_ccw',
    points: [
      { x: 44.45, z: 44.45 },
      { x: 44.45, z: -44.45 },
      { x: -44.45, z: -44.45 },
      { x: -44.45, z: 44.45 },
    ],
  },
  // 3. Outer City Boulevard Loop (clockwise around entire city perimeter)
  {
    id: 'lane_outer_cw',
    points: [
      { x: -81.55, z: 81.55 },
      { x: -81.55, z: -81.55 },
      { x: 81.55, z: -81.55 },
      { x: 81.55, z: 81.55 },
    ],
  },
  // 4. East Coastal & Industrial Loop
  {
    id: 'lane_east_ccw',
    points: [
      { x: 86.45, z: 86.45 },
      { x: 86.45, z: -86.45 },
      { x: 44.45, z: -86.45 },
      { x: 44.45, z: 86.45 },
    ],
  },
  // 5. Cross-Town Avenue Loop (North-South x=0 + West Loop)
  {
    id: 'lane_central_west',
    points: [
      { x: 2.45, z: 81.55 },
      { x: 2.45, z: -81.55 },
      { x: -39.55, z: -81.55 },
      { x: -39.55, z: 81.55 },
    ],
  },
  // 6. Mid-Town East-West Loop (z=0 + z=-42)
  {
    id: 'lane_downtown_ew',
    points: [
      { x: -81.55, z: 2.45 },
      { x: 81.55, z: 2.45 },
      { x: 81.55, z: -39.55 },
      { x: -81.55, z: -39.55 },
    ],
  },
];

export function createInitialVehicles(layout: CityLayout = CITY_LAYOUT): VehicleState[] {
  const vehicles: VehicleState[] = [];

  const addPlayerVehicle = (
    id: string,
    kind: VehicleKind,
    x: number,
    z: number,
    yaw: number,
    color: number,
  ) => {
    const spec = VEHICLE_SPECS[kind];
    vehicles.push({
      id,
      kind,
      label: spec.label,
      x,
      y: getGroundHeightAt(x, z, layout),
      z,
      yaw,
      speed: 0,
      steerAngle: 0,
      wheelSpin: 0,
      leanAngle: 0,
      color,
      isPolice: false,
      occupant: 'none',
      sirenPhase: 0,
      isBraking: false,
      aiLoopIndex: 0,
      aiWaypointIndex: 0,
      aiCruiseSpeed: 0,
      aiStopTimer: 0,
      aiAvoidSide: 1,
      aiAvoidTimer: 0,
      aiStuckTimer: 0,
    });
  };

  // Driveable Player-Ready Vehicles across all 4 districts + central spawn plaza
  addPlayerVehicle('veh_spawn_sports', 'sports', 3.1, 10.5, 0, 0xe04828); // Sports car right ahead of spawn
  addPlayerVehicle('veh_spawn_motor', 'motor', -3.1, 13.5, 0, 0x2299b8); // Motorcycle across curb at spawn
  addPlayerVehicle('veh_dt_sedan', 'sedan', -14.0, -3.3, Math.PI * 0.5, 0x2f6a96); // Downtown Plaza road curb
  addPlayerVehicle('veh_dt_suv', 'suv', 24.0, -3.3, -Math.PI * 0.5, 0x3a4d5c); // Mall front avenue
  addPlayerVehicle('veh_res_pickup', 'pickup', -42.0, 22.0, 0, 0x3b7a52); // Residential Emerald Park West
  addPlayerVehicle('veh_res_sedan', 'sedan', -20.0, 45.2, Math.PI * 0.5, 0xd49b35); // Residential Apartments
  addPlayerVehicle('veh_ind_pickup', 'pickup', 45.2, -55.0, 0, 0xc76628); // Industrial Factory road
  addPlayerVehicle('veh_coast_sports', 'sports', 81.2, 22.0, Math.PI, 0xf0b429); // Coastal Boulevard
  addPlayerVehicle('veh_coast_motor', 'motor', 86.8, 42.0, Math.PI * 0.5, 0xd93838); // Coastal Pier entrance
  addPlayerVehicle('veh_coast_suv', 'suv', 45.2, 60.0, Math.PI, 0x2b7e8c); // South Resort avenue

  // Autonomous NPC Traffic Vehicles (6 civilian cruisers across lane loops)
  const trafficSpawns: Array<{
    id: string;
    kind: VehicleKind;
    loopIndex: number;
    wpIndex: number;
    progress: number;
    color: number;
    speed: number;
  }> = [
    { id: 'trf_1', kind: 'sedan', loopIndex: 0, wpIndex: 0, progress: 0.35, color: 0x4c789c, speed: 10.5 },
    { id: 'trf_2', kind: 'suv', loopIndex: 1, wpIndex: 1, progress: 0.4, color: 0x5c6670, speed: 10.0 },
    { id: 'trf_3', kind: 'pickup', loopIndex: 2, wpIndex: 2, progress: 0.3, color: 0x8f5638, speed: 9.8 },
    { id: 'trf_4', kind: 'sports', loopIndex: 3, wpIndex: 0, progress: 0.45, color: 0xc94238, speed: 12.0 },
    { id: 'trf_5', kind: 'sedan', loopIndex: 4, wpIndex: 1, progress: 0.55, color: 0xd6dce0, speed: 10.2 },
    { id: 'trf_6', kind: 'motor', loopIndex: 5, wpIndex: 0, progress: 0.5, color: 0x2b7556, speed: 11.5 },
  ];

  for (const ts of trafficSpawns) {
    const loop = TRAFFIC_LANE_LOOPS[ts.loopIndex];
    const p0 = loop.points[ts.wpIndex];
    const nextIdx = (ts.wpIndex + 1) % loop.points.length;
    const p1 = loop.points[nextIdx];
    const x = p0.x + (p1.x - p0.x) * ts.progress;
    const z = p0.z + (p1.z - p0.z) * ts.progress;
    const yaw = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
    const spec = VEHICLE_SPECS[ts.kind];

    vehicles.push({
      id: ts.id,
      kind: ts.kind,
      label: spec.label,
      x,
      y: getGroundHeightAt(x, z, layout),
      z,
      yaw,
      speed: ts.speed * 0.7,
      steerAngle: 0,
      wheelSpin: 0,
      leanAngle: 0,
      color: ts.color,
      isPolice: false,
      occupant: 'traffic',
      sirenPhase: 0,
      isBraking: false,
      aiLoopIndex: ts.loopIndex,
      aiWaypointIndex: nextIdx,
      aiCruiseSpeed: ts.speed,
      aiStopTimer: 0,
      aiAvoidSide: 1,
      aiAvoidTimer: 0,
      aiStuckTimer: 0,
    });
  }

  // Police Patrol / Chaser Units (patrol when wanted=0, pursue when wanted>=1)
  const policeSpawns: Array<{ id: string; loopIndex: number; wpIndex: number; progress: number }> = [
    { id: 'pol_1', loopIndex: 0, wpIndex: 2, progress: 0.5 },
    { id: 'pol_2', loopIndex: 2, wpIndex: 1, progress: 0.45 },
    { id: 'pol_3', loopIndex: 5, wpIndex: 2, progress: 0.35 },
  ];

  for (const ps of policeSpawns) {
    const loop = TRAFFIC_LANE_LOOPS[ps.loopIndex];
    const p0 = loop.points[ps.wpIndex];
    const nextIdx = (ps.wpIndex + 1) % loop.points.length;
    const p1 = loop.points[nextIdx];
    const x = p0.x + (p1.x - p0.x) * ps.progress;
    const z = p0.z + (p1.z - p0.z) * ps.progress;
    const yaw = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));

    vehicles.push({
      id: ps.id,
      kind: 'sedan',
      label: 'Police Cruiser',
      x,
      y: getGroundHeightAt(x, z, layout),
      z,
      yaw,
      speed: 9.5,
      steerAngle: 0,
      wheelSpin: 0,
      leanAngle: 0,
      color: 0x162238,
      isPolice: true,
      occupant: 'police',
      sirenPhase: 0,
      isBraking: false,
      aiLoopIndex: ps.loopIndex,
      aiWaypointIndex: nextIdx,
      aiCruiseSpeed: 10.5,
      aiStopTimer: 0,
      aiAvoidSide: 1,
      aiAvoidTimer: 0,
      aiStuckTimer: 0,
    });
  }

  return vehicles;
}
