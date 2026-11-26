import type {
  AirportSpec,
  BenchSpec,
  BlockZone,
  BridgeSpec,
  BuildingEntranceSpec,
  BuildingSpec,
  CityId,
  CityLayout,
  CityZoneSpec,
  ColliderBox,
  ContainerSpec,
  DistrictId,
  ExteriorLadderSpec,
  FountainSpec,
  HouseSpec,
  LandmarkPin,
  NpcWaypointLoop,
  ParkedVehicleSpec,
  RooftopSpec,
  StreetLampSpec,
  TrafficSignSpec,
  TreeSpec,
} from './types';

export const DISTRICT_LABELS: Record<DistrictId, string> = {
  downtown: 'Downtown Core',
  residential: 'Residential Quarter',
  industrial: 'Industrial & Port',
  coastal: 'Coastal Beachfront',
  avenue: 'City Avenue',
  bay_marina: 'Emerald Marina Bay',
  highland_tech: 'Aero Highland Campus',
  suncrest_bay: 'Golden Sunset Coast',
  airport: 'International Airport',
  bridge: 'Grand Skyway Crossing',
};

const ROAD_CENTERS = [-84, -42, 0, 42, 84];
const ROAD_WIDTH = 10; // half-width = 5
const SIDEWALK_WIDTH = 3;
const SIDEWALK_HEIGHT = 0.14;
const BLOCK_CENTERS = [-63, -21, 21, 63];
const BLOCK_OUTER_SIZE = 32;

export const WATER_SURFACE_Y = -0.38;
export const OCEAN_SEABED_Y = -13.5;

function pushCollider(
  colliders: ColliderBox[],
  id: string,
  cx: number,
  cz: number,
  w: number,
  d: number,
  minY: number,
  maxY: number,
  kind: ColliderBox['kind'],
  blocksCamera: boolean,
  vaultable = false,
): void {
  colliders.push({
    id,
    minX: cx - w * 0.5,
    maxX: cx + w * 0.5,
    minY,
    maxY,
    minZ: cz - d * 0.5,
    maxZ: cz + d * 0.5,
    kind,
    blocksCamera,
    vaultable,
  });
}

function addParkedVehicle(
  vehicles: ParkedVehicleSpec[],
  colliders: ColliderBox[],
  id: string,
  x: number,
  y: number,
  z: number,
  rotY: number,
  kind: ParkedVehicleSpec['kind'],
  color: number,
): void {
  vehicles.push({ id, x, y, z, rotY, kind, color });
  // Axis-aligned footprint scaled cleanly to vehicle orientation
  const isRotated90 = Math.abs(Math.sin(rotY)) > 0.7;
  const baseW = kind === 'truck' ? 2.4 : 1.95;
  const baseD = kind === 'truck' ? 6.2 : 4.3;
  const w = isRotated90 ? baseD : baseW;
  const d = isRotated90 ? baseW : baseD;
  const h = kind === 'truck' ? 2.8 : 1.65;
  pushCollider(colliders, `veh_${id}`, x, z, w, d, y, y + h, 'vehicle', false);
}

function createCityLayout(): CityLayout {
  const blocks: BlockZone[] = [];
  const buildings: BuildingSpec[] = [];
  const houses: HouseSpec[] = [];
  const entrances: BuildingEntranceSpec[] = [];
  const parkedVehicles: ParkedVehicleSpec[] = [];
  const containers: ContainerSpec[] = [];
  const trafficSigns: TrafficSignSpec[] = [];
  const trees: TreeSpec[] = [];
  const lamps: StreetLampSpec[] = [];
  const benches: BenchSpec[] = [];
  const fountains: FountainSpec[] = [];
  const colliders: ColliderBox[] = [];

  const getBlockConfig = (
    bx: number,
    bz: number,
  ): { type: BlockZone['type']; district: DistrictId; label: string } => {
    // 1. DOWNTOWN (Center-North Core)
    if (bx === -21 && bz === -21) {
      return { type: 'downtown_tower', district: 'downtown', label: DISTRICT_LABELS.downtown };
    }
    if (bx === 21 && bz === -21) {
      return { type: 'downtown_mall', district: 'downtown', label: DISTRICT_LABELS.downtown };
    }
    if ((bx === -21 || bx === 21) && bz === -63) {
      return { type: 'downtown_parking', district: 'downtown', label: DISTRICT_LABELS.downtown };
    }

    // 3. INDUSTRIAL & HARBOR PORT (North-East Coast)
    if (bx === 63 && bz === -63) {
      return { type: 'industrial_factory', district: 'industrial', label: DISTRICT_LABELS.industrial };
    }
    if (bx === 63 && bz === -21) {
      return { type: 'industrial_port', district: 'industrial', label: DISTRICT_LABELS.industrial };
    }

    // 4. COASTAL (South-East Coast)
    if (bx === 63 && bz === 21) {
      return { type: 'coastal_restaurants', district: 'coastal', label: DISTRICT_LABELS.coastal };
    }
    if ((bx === 63 && bz === 63) || (bx === 21 && bz === 63) || (bx === 21 && bz === 21)) {
      return { type: 'coastal_resort', district: 'coastal', label: DISTRICT_LABELS.coastal };
    }

    // 2. RESIDENTIAL (West & South-West)
    if (bx === -21 && bz === 21) {
      return { type: 'residential_park', district: 'residential', label: DISTRICT_LABELS.residential };
    }
    if ((bx === -21 && bz === 63) || (bx === -63 && bz === -21)) {
      return { type: 'residential_apartments', district: 'residential', label: DISTRICT_LABELS.residential };
    }
    return { type: 'residential_houses', district: 'residential', label: DISTRICT_LABELS.residential };
  };

  for (let ix = 0; ix < BLOCK_CENTERS.length; ix++) {
    for (let iz = 0; iz < BLOCK_CENTERS.length; iz++) {
      const bx = BLOCK_CENTERS[ix];
      const bz = BLOCK_CENTERS[iz];
      const cfg = getBlockConfig(bx, bz);
      blocks.push({
        id: `block_${ix}_${iz}`,
        cx: bx,
        cz: bz,
        size: BLOCK_OUTER_SIZE,
        type: cfg.type,
        district: cfg.district,
        label: cfg.label,
      });

      // Corner streetlamps along sidewalks
      const lampOffset = BLOCK_OUTER_SIZE * 0.5 - 1.1;
      const lampCorners: Array<[number, number, number]> = [
        [bx - lampOffset, bz - lampOffset, Math.PI * 0.25],
        [bx + lampOffset, bz + lampOffset, -Math.PI * 0.75],
      ];
      for (const [lx, lz, rotY] of lampCorners) {
        lamps.push({ x: lx, y: SIDEWALK_HEIGHT, z: lz, rotY });
        pushCollider(colliders, `lamp_${lx}_${lz}`, lx, lz, 0.4, 0.4, 0, 5.0, 'prop', false);
      }

      if (cfg.type === 'downtown_tower') {
        // CITY TOWER (22-story tallest skyscraper) + Office Wing + Civic Fountain Plaza
        buildings.push({
          id: 'freedom_tower',
          x: bx - 4.5,
          z: bz - 4.5,
          width: 14,
          depth: 14,
          height: 76,
          style: 'skyscraper',
          primaryColor: 0xdbe3eb,
          accentColor: 0x315f80,
          hasSetback: false,
          hasSpire: true,
        });
        pushCollider(
          colliders,
          'freedom_tower',
          bx - 4.5,
          bz - 4.5,
          14,
          14,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 76,
          'building',
          true,
        );
        entrances.push({
          id: 'ent_freedom_tower',
          buildingId: 'freedom_tower',
          name: 'CITY TOWER',
          category: 'business',
          subtype: 'corporate',
          doorX: bx - 4.5,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz - 4.5 + 7.0,
          yaw: 0,
          width: 2.2,
          height: 2.8,
          doorStyle: 'glass_double',
          accentColor: 0x315f80,
        });

        buildings.push({
          id: 'civic_office_east',
          x: bx + 8.0,
          z: bz - 6.0,
          width: 8.5,
          depth: 11,
          height: 24,
          style: 'office',
          primaryColor: 0xbcc8d4,
          accentColor: 0x2c4863,
        });
        pushCollider(
          colliders,
          'civic_office_east',
          bx + 8.0,
          bz - 6.0,
          8.5,
          11,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 24,
          'building',
          true,
        );
        entrances.push({
          id: 'ent_civic_office_east',
          buildingId: 'civic_office_east',
          name: 'Civic Center Offices',
          category: 'business',
          subtype: 'office',
          doorX: bx + 8.0,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz - 6.0 + 5.5,
          yaw: 0,
          width: 2.0,
          height: 2.6,
          doorStyle: 'glass_double',
          accentColor: 0x2c4863,
        });

        fountains.push({ x: bx + 6.5, y: SIDEWALK_HEIGHT, z: bz + 6.5, radius: 3.0 });
        pushCollider(
          colliders,
          'downtown_fountain',
          bx + 6.5,
          bz + 6.5,
          6.0,
          6.0,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 1.1,
          'prop',
          false,
        );

        benches.push({ x: bx + 6.5, y: SIDEWALK_HEIGHT, z: bz + 1.4, rotY: 0 });
        pushCollider(colliders, 'dt_bench_1', bx + 6.5, bz + 1.4, 2.1, 0.75, 0, 0.9, 'prop', false, true);
        trees.push({ x: bx - 8.5, y: SIDEWALK_HEIGHT, z: bz + 8.5, scale: 1.0, tint: 0x3e7d48, kind: 'deciduous' });
        pushCollider(colliders, 'dt_tree_1', bx - 8.5, bz + 8.5, 0.85, 0.85, 0, 4.5, 'prop', false);
      } else if (cfg.type === 'downtown_mall') {
        // Freedom Grand Shopping Mall + Mall Parking Bays
        buildings.push({
          id: 'freedom_mall',
          x: bx,
          z: bz - 4.0,
          width: 22,
          depth: 14,
          height: 11.5,
          style: 'mall',
          primaryColor: 0xe6dcd0,
          accentColor: 0x2f5a78,
          hasAwning: true,
        });
        pushCollider(
          colliders,
          'freedom_mall',
          bx,
          bz - 4.0,
          22,
          14,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 11.5,
          'building',
          true,
        );
        entrances.push({
          id: 'ent_freedom_mall',
          buildingId: 'freedom_mall',
          name: 'Freedom Grand Mall',
          category: 'commercial',
          subtype: 'mall',
          doorX: bx,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz - 4.0 + 7.0,
          yaw: 0,
          width: 2.6,
          height: 2.8,
          doorStyle: 'glass_double',
          accentColor: 0x2f5a78,
        });

        // Mall front parking lot (bz + 7.2) with 3 parked cars
        addParkedVehicle(parkedVehicles, colliders, 'mall_car_1', bx - 7.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'sedan', 0xc94238);
        addParkedVehicle(parkedVehicles, colliders, 'mall_car_2', bx - 1.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'suv', 0x2f4d6b);
        addParkedVehicle(parkedVehicles, colliders, 'mall_car_3', bx + 4.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'sedan', 0xd6dce0);
        trees.push({ x: bx + 10.2, y: SIDEWALK_HEIGHT, z: bz + 8.0, scale: 0.95, tint: 0x45864e, kind: 'deciduous' });
        pushCollider(colliders, 'mall_tree', bx + 10.2, bz + 8.0, 0.85, 0.85, 0, 4.5, 'prop', false);
      } else if (cfg.type === 'downtown_parking') {
        // Financial Tower + Open Multi-Bay Parking Lot
        const isLeft = bx < 0;
        const finId = `dt_fin_${ix}_${iz}`;
        const finX = isLeft ? bx - 5.8 : bx + 5.8;
        const finZ = bz - 2.0;
        const finH = isLeft ? 34 : 29;
        buildings.push({
          id: finId,
          x: finX,
          z: finZ,
          width: 11.5,
          depth: 17.0,
          height: finH,
          style: 'skyscraper',
          primaryColor: isLeft ? 0xc2cfd9 : 0xd3cec4,
          accentColor: 0x345570,
          hasSetback: true,
        });
        pushCollider(
          colliders,
          finId,
          finX,
          finZ,
          11.5,
          17.0,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + finH,
          'building',
          true,
        );
        entrances.push({
          id: `ent_${finId}`,
          buildingId: finId,
          name: isLeft ? 'Meridian Finance Tower' : 'Vanguard Capital Plaza',
          category: 'business',
          subtype: isLeft ? 'corporate' : 'office',
          doorX: finX,
          doorY: SIDEWALK_HEIGHT,
          doorZ: finZ + 8.5,
          yaw: 0,
          width: 2.1,
          height: 2.7,
          doorStyle: 'glass_double',
          accentColor: 0x345570,
        });

        // Open parking lot side with parked cars
        const lotX = isLeft ? bx + 6.5 : bx - 6.5;
        addParkedVehicle(parkedVehicles, colliders, `lot_car_a_${ix}`, lotX, SIDEWALK_HEIGHT, bz - 6.5, Math.PI * 0.5, 'sedan', 0x3b6991);
        addParkedVehicle(parkedVehicles, colliders, `lot_car_b_${ix}`, lotX, SIDEWALK_HEIGHT, bz + 0.2, Math.PI * 0.5, 'suv', 0x455249);
        addParkedVehicle(parkedVehicles, colliders, `lot_car_c_${ix}`, lotX, SIDEWALK_HEIGHT, bz + 6.8, Math.PI * 0.5, 'sedan', 0xd6a43e);
      } else if (cfg.type === 'industrial_factory') {
        // Industrial Manufacturing Plant + Logistics Warehouse
        buildings.push({
          id: 'ind_factory_main',
          x: bx - 4.8,
          z: bz - 3.5,
          width: 13.5,
          depth: 15.5,
          height: 9.5,
          style: 'factory',
          primaryColor: 0x8f8a82,
          accentColor: 0xb85b2c,
        });
        pushCollider(
          colliders,
          'ind_factory_main',
          bx - 4.8,
          bz - 3.5,
          13.5,
          15.5,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 13,
          'building',
          true,
        );
        entrances.push({
          id: 'ent_ind_factory_main',
          buildingId: 'ind_factory_main',
          name: 'Apex Urban Factory',
          category: 'industrial',
          subtype: 'factory',
          doorX: bx - 4.8,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz - 3.5 + 7.75,
          yaw: 0,
          width: 2.2,
          height: 2.8,
          doorStyle: 'industrial',
          accentColor: 0xb85b2c,
        });

        buildings.push({
          id: 'ind_warehouse',
          x: bx + 6.8,
          z: bz + 3.5,
          width: 9.5,
          depth: 14.5,
          height: 7.5,
          style: 'warehouse',
          primaryColor: 0x737c85,
          accentColor: 0x45505c,
        });
        pushCollider(
          colliders,
          'ind_warehouse',
          bx + 6.8,
          bz + 3.5,
          9.5,
          14.5,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 7.5,
          'building',
          true,
        );
        entrances.push({
          id: 'ent_ind_warehouse',
          buildingId: 'ind_warehouse',
          name: 'Metro Logistics Warehouse',
          category: 'industrial',
          subtype: 'warehouse',
          doorX: bx + 6.8,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz + 3.5 + 7.25,
          yaw: 0,
          width: 2.2,
          height: 2.8,
          doorStyle: 'industrial',
          accentColor: 0x45505c,
        });

        addParkedVehicle(parkedVehicles, colliders, 'ind_truck_1', bx - 5.2, SIDEWALK_HEIGHT, bz + 8.5, Math.PI * 0.5, 'truck', 0xd98a2b);
      } else if (cfg.type === 'industrial_port') {
        // Harbor Auto Workshop & Shipping Container Terminal
        buildings.push({
          id: 'port_warehouse',
          x: bx - 6.2,
          z: bz - 4.5,
          width: 10.5,
          depth: 13.0,
          height: 8.2,
          style: 'workshop',
          primaryColor: 0x6f7a85,
          accentColor: 0xc25929,
        });
        pushCollider(
          colliders,
          'port_warehouse',
          bx - 6.2,
          bz - 4.5,
          10.5,
          13.0,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 8.2,
          'building',
          true,
        );
        entrances.push({
          id: 'ent_port_workshop',
          buildingId: 'port_warehouse',
          name: 'Harbor Auto Workshop',
          category: 'industrial',
          subtype: 'workshop',
          doorX: bx - 6.2,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz - 4.5 + 6.5,
          yaw: 0,
          width: 2.2,
          height: 2.8,
          doorStyle: 'industrial',
          accentColor: 0xc25929,
        });

        const contSpecs: Array<[number, number, number, number, number]> = [
          [bx + 5.8, SIDEWALK_HEIGHT, bz - 6.5, 0, 0xb83e32],
          [bx + 5.8, SIDEWALK_HEIGHT + 2.6, bz - 6.5, 0, 0x2c668f],
          [bx + 5.8, SIDEWALK_HEIGHT, bz + 0.8, 0, 0x3b7a52],
          [bx + 5.8, SIDEWALK_HEIGHT, bz + 7.5, Math.PI * 0.5, 0xd48b2c],
        ];
        contSpecs.forEach(([cx, cy, cz, rotY, color], cIdx) => {
          containers.push({ id: `cont_${cIdx}`, x: cx, y: cy, z: cz, rotY, color });
          if (cy < SIDEWALK_HEIGHT + 1) {
            const rot90 = Math.abs(Math.sin(rotY)) > 0.7;
            pushCollider(
              colliders,
              `cont_${cIdx}`,
              cx,
              cz,
              rot90 ? 6.0 : 2.5,
              rot90 ? 2.5 : 6.0,
              SIDEWALK_HEIGHT,
              SIDEWALK_HEIGHT + 5.2,
              'container',
              true,
            );
          }
        });

        addParkedVehicle(parkedVehicles, colliders, 'port_truck_1', bx - 5.5, SIDEWALK_HEIGHT, bz + 7.2, 0, 'truck', 0x3b6285);
      } else if (cfg.type === 'coastal_restaurants') {
        // Beachfront Seafood Restaurant & Café Terrace
        buildings.push({
          id: 'coastal_bistro',
          x: bx - 4.2,
          z: bz - 4.0,
          width: 12.5,
          depth: 11.5,
          height: 6.8,
          style: 'restaurant',
          primaryColor: 0xf0e4d1,
          accentColor: 0x267a8a,
          hasAwning: true,
        });
        pushCollider(
          colliders,
          'coastal_bistro',
          bx - 4.2,
          bz - 4.0,
          12.5,
          11.5,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 6.8,
          'building',
          true,
        );
        entrances.push({
          id: 'ent_coastal_bistro',
          buildingId: 'coastal_bistro',
          name: 'Coastal Seafood Bistro',
          category: 'commercial',
          subtype: 'restaurant',
          doorX: bx - 4.2,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz - 4.0 + 5.75,
          yaw: 0,
          width: 1.9,
          height: 2.5,
          doorStyle: 'glass_double',
          accentColor: 0x267a8a,
        });

        buildings.push({
          id: 'coastal_cafe',
          x: bx + 6.8,
          z: bz + 4.8,
          width: 9.2,
          depth: 9.5,
          height: 5.5,
          style: 'restaurant',
          primaryColor: 0xebd6c3,
          accentColor: 0xc95e3a,
          hasAwning: true,
        });
        pushCollider(
          colliders,
          'coastal_cafe',
          bx + 6.8,
          bz + 4.8,
          9.2,
          9.5,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 5.5,
          'building',
          true,
        );
        entrances.push({
          id: 'ent_coastal_cafe',
          buildingId: 'coastal_cafe',
          name: 'Sunburst Artisan Cafe',
          category: 'commercial',
          subtype: 'cafe',
          doorX: bx + 6.8,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz + 4.8 + 4.75,
          yaw: 0,
          width: 1.7,
          height: 2.45,
          doorStyle: 'storefront',
          accentColor: 0xc95e3a,
        });

        benches.push({ x: bx + 6.5, y: SIDEWALK_HEIGHT, z: bz - 6.0, rotY: -Math.PI * 0.5 });
        pushCollider(colliders, 'coast_bench_1', bx + 6.5, bz - 6.0, 0.75, 2.1, 0, 0.9, 'prop', false);
        addParkedVehicle(parkedVehicles, colliders, 'coast_suv_1', bx - 5.8, SIDEWALK_HEIGHT, bz + 7.5, Math.PI * 0.5, 'suv', 0x337b8c);
        trees.push({ x: bx + 9.5, y: SIDEWALK_HEIGHT, z: bz - 9.2, scale: 1.05, tint: 0x4b9452, kind: 'palm' });
        trees.push({ x: bx - 10.0, y: SIDEWALK_HEIGHT, z: bz + 9.5, scale: 1.1, tint: 0x4b9452, kind: 'palm' });
        pushCollider(colliders, 'coast_palm_1', bx + 9.5, bz - 9.2, 0.75, 0.75, 0, 5.0, 'prop', false);
        pushCollider(colliders, 'coast_palm_2', bx - 10.0, bz + 9.5, 0.75, 0.75, 0, 5.0, 'prop', false);
      } else if (cfg.type === 'coastal_resort') {
        const isSpawnBlock = bx === 21 && bz === 21;
        if (isSpawnBlock) {
          // Urban Mart Convenience Store directly facing City Avenue & Player Spawn (0, 16)
          buildings.push({
            id: 'urban_mart',
            x: 13.5,
            z: 16.0,
            width: 7.4,
            depth: 8.4,
            height: 4.8,
            style: 'store',
            primaryColor: 0xf4efe7,
            accentColor: 0x16a34a,
            hasAwning: true,
          });
          pushCollider(
            colliders,
            'urban_mart',
            13.5,
            16.0,
            7.4,
            8.4,
            SIDEWALK_HEIGHT,
            SIDEWALK_HEIGHT + 4.8,
            'building',
            true,
          );
          entrances.push({
            id: 'ent_urban_mart',
            buildingId: 'urban_mart',
            name: 'Urban Mart',
            category: 'commercial',
            subtype: 'convenience_store',
            doorX: 13.5 - 3.7,
            doorY: SIDEWALK_HEIGHT,
            doorZ: 16.0,
            yaw: -Math.PI * 0.5,
            width: 1.85,
            height: 2.45,
            doorStyle: 'storefront',
            accentColor: 0x16a34a,
          });

          // CITY REWARD CENTER: Physical 3D Knowledge Points (KP) Reward & Customization Shop
          buildings.push({
            id: 'city_reward_center',
            x: 13.5,
            z: 28.8,
            width: 8.0,
            depth: 8.2,
            height: 6.8,
            style: 'reward_center',
            primaryColor: 0x1e293b,
            accentColor: 0xf59e0b,
            hasAwning: true,
          });
          pushCollider(
            colliders,
            'city_reward_center',
            13.5,
            28.8,
            8.0,
            8.2,
            SIDEWALK_HEIGHT,
            SIDEWALK_HEIGHT + 6.8,
            'building',
            true,
          );
          entrances.push({
            id: 'ent_city_reward_center',
            buildingId: 'city_reward_center',
            name: 'CITY REWARD CENTER',
            category: 'commercial',
            subtype: 'reward_shop',
            doorX: 13.5 - 4.0,
            doorY: SIDEWALK_HEIGHT,
            doorZ: 28.8,
            yaw: -Math.PI * 0.5,
            width: 2.1,
            height: 2.6,
            doorStyle: 'glass_double',
            accentColor: 0xf59e0b,
          });
        }

        // Coastal Tourist Pavilion / Resort Restaurant
        const rx = isSpawnBlock ? bx + 5.8 : bx - 4.5;
        const rz = isSpawnBlock ? bz - 3.5 : bz - 3.5;
        const rw = isSpawnBlock ? 11.5 : 12.5;
        const rd = isSpawnBlock ? 11.5 : 12.0;
        const rh = bx === 63 ? 9.5 : 13.5;
        const resortId = `resort_${ix}_${iz}`;
        buildings.push({
          id: resortId,
          x: rx,
          z: rz,
          width: rw,
          depth: rd,
          height: rh,
          style: 'restaurant',
          primaryColor: 0xf2e7d8,
          accentColor: 0x2c7f8c,
          hasAwning: true,
        });
        pushCollider(
          colliders,
          resortId,
          rx,
          rz,
          rw,
          rd,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + rh,
          'building',
          true,
        );
        const resortNames: Record<string, string> = {
          resort_2_2: 'Coral Bay Grill',
          resort_2_3: 'Sunset Pier Bistro',
          resort_3_3: 'Horizon Ocean Lounge',
        };
        entrances.push({
          id: `ent_${resortId}`,
          buildingId: resortId,
          name: resortNames[resortId] || 'Coastal Pavilion Restaurant',
          category: 'commercial',
          subtype: 'restaurant',
          doorX: rx,
          doorY: SIDEWALK_HEIGHT,
          doorZ: rz + rd * 0.5,
          yaw: 0,
          width: 1.9,
          height: 2.5,
          doorStyle: 'glass_double',
          accentColor: 0x2c7f8c,
        });

        benches.push({ x: bx + 6.5, y: SIDEWALK_HEIGHT, z: bz + 6.0, rotY: 0 });
        pushCollider(colliders, `res_bench_${ix}_${iz}`, bx + 6.5, bz + 6.0, 2.1, 0.75, 0, 0.9, 'prop', false);

        const palmAx = bx + 7.5;
        const palmAz = isSpawnBlock ? bz - 12.5 : bz - 7.5;
        const palmBx = isSpawnBlock ? 22.0 : bx - 8.5;
        const palmBz = isSpawnBlock ? 32.5 : bz + 7.8;
        trees.push({ x: palmAx, y: SIDEWALK_HEIGHT, z: palmAz, scale: 1.08, tint: 0x4c9652, kind: 'palm' });
        trees.push({ x: palmBx, y: SIDEWALK_HEIGHT, z: palmBz, scale: 0.98, tint: 0x458c4c, kind: 'palm' });
        pushCollider(colliders, `coast_palm_a_${ix}_${iz}`, palmAx, palmAz, 0.75, 0.75, 0, 5.0, 'prop', false);
        pushCollider(colliders, `coast_palm_b_${ix}_${iz}`, palmBx, palmBz, 0.75, 0.75, 0, 5.0, 'prop', false);
      } else if (cfg.type === 'residential_park') {
        // Emerald Neighborhood Park
        fountains.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz, radius: 3.5 });
        pushCollider(
          colliders,
          'emerald_fountain',
          bx,
          bz,
          7.0,
          7.0,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 1.1,
          'prop',
          false,
        );

        const benchOffsets: Array<[number, number, number]> = [
          [0, -6.2, 0],
          [0, 6.2, Math.PI],
          [-6.2, 0, Math.PI * 0.5],
          [6.2, 0, -Math.PI * 0.5],
        ];
        benchOffsets.forEach(([ox, oz, rotY], bIdx) => {
          benches.push({ x: bx + ox, y: SIDEWALK_HEIGHT, z: bz + oz, rotY });
          const rot90 = Math.abs(Math.sin(rotY)) > 0.5;
          pushCollider(colliders, `park_b_${bIdx}`, bx + ox, bz + oz, rot90 ? 0.75 : 2.1, rot90 ? 2.1 : 0.75, 0, 0.9, 'prop', false);
        });

        const treeOffsets: Array<[number, number, number, number]> = [
          [-9.5, -9.5, 1.12, 0x3b7a45],
          [9.5, -9.5, 0.98, 0x498f52],
          [-9.5, 9.5, 1.05, 0x356e3e],
          [9.5, 9.5, 1.14, 0x4b9256],
          [-10.2, 0, 0.94, 0x3f8249],
          [10.2, 0, 1.04, 0x458750],
        ];
        treeOffsets.forEach(([ox, oz, scale, tint], tIdx) => {
          trees.push({ x: bx + ox, y: SIDEWALK_HEIGHT, z: bz + oz, scale, tint, kind: 'deciduous' });
          pushCollider(colliders, `park_t_${tIdx}`, bx + ox, bz + oz, 0.9, 0.9, 0, 4.8, 'prop', false);
        });
      } else if (cfg.type === 'residential_apartments') {
        // Multi-Story Urban Apartments with Balconies & Courtyard
        const aptColor = bx < -40 ? 0xc7896b : 0xd6cbb8;
        buildings.push({
          id: `apt_a_${ix}_${iz}`,
          x: bx - 5.2,
          z: bz - 3.5,
          width: 11.5,
          depth: 13.5,
          height: 15.5,
          style: 'apartment',
          primaryColor: aptColor,
          accentColor: 0x4b5c6b,
          hasAwning: true,
        });
        pushCollider(
          colliders,
          `apt_a_${ix}_${iz}`,
          bx - 5.2,
          bz - 3.5,
          11.5,
          13.5,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 15.5,
          'building',
          true,
        );
        entrances.push({
          id: `ent_apt_a_${ix}_${iz}`,
          buildingId: `apt_a_${ix}_${iz}`,
          name: bx < -40 ? 'Westside Lofts' : 'Parkview Apartments',
          category: 'residential',
          subtype: 'apartment',
          doorX: bx - 5.2,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz - 3.5 + 6.75,
          yaw: 0,
          width: 1.9,
          height: 2.5,
          doorStyle: 'glass_double',
          accentColor: 0x4b5c6b,
        });

        buildings.push({
          id: `apt_b_${ix}_${iz}`,
          x: bx + 6.5,
          z: bz + 4.5,
          width: 10.0,
          depth: 11.5,
          height: 12.5,
          style: 'apartment',
          primaryColor: 0xcfd6db,
          accentColor: 0x5c4a3e,
        });
        pushCollider(
          colliders,
          `apt_b_${ix}_${iz}`,
          bx + 6.5,
          bz + 4.5,
          10.0,
          11.5,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + 12.5,
          'building',
          true,
        );
        entrances.push({
          id: `ent_apt_b_${ix}_${iz}`,
          buildingId: `apt_b_${ix}_${iz}`,
          name: bx < -40 ? 'Metro Residence Suites' : 'Sunrise Terrace Flats',
          category: 'residential',
          subtype: 'apartment',
          doorX: bx + 6.5,
          doorY: SIDEWALK_HEIGHT,
          doorZ: bz + 4.5 + 5.75,
          yaw: 0,
          width: 1.85,
          height: 2.45,
          doorStyle: 'glass_double',
          accentColor: 0x5c4a3e,
        });

        benches.push({ x: bx - 5.2, y: SIDEWALK_HEIGHT, z: bz + 7.5, rotY: 0 });
        pushCollider(colliders, `apt_b_${ix}_${iz}`, bx - 5.2, bz + 7.5, 2.1, 0.75, 0, 0.9, 'prop', false);
        trees.push({ x: bx + 7.8, y: SIDEWALK_HEIGHT, z: bz - 7.5, scale: 1.0, tint: 0x44854d, kind: 'deciduous' });
        pushCollider(colliders, `apt_t_${ix}_${iz}`, bx + 7.8, bz - 7.5, 0.9, 0.9, 0, 4.6, 'prop', false);
      } else {
        // Residential Houses (Small single-floor cottages & 2-floor modern family homes)
        const houseColors = [0xe8dfd1, 0xd8c7b2, 0xcfd9df, 0xe5d3be];
        const roofColors = [0x753c32, 0x44535e, 0x5c4738, 0x3b4d45];
        const subOffsets: Array<[number, number, number]> = [
          [-6.2, -6.2, 0],
          [6.2, -6.2, 0],
          [-6.2, 6.2, Math.PI],
          [6.2, 6.2, Math.PI],
        ];
        subOffsets.forEach(([ox, oz, facing], hIdx) => {
          const cIdx = (ix + iz + hIdx) % houseColors.length;
          const isModern = hIdx % 2 === 1;
          const wh = isModern ? 4.8 : 4.2;
          const houseId = `house_${ix}_${iz}_${hIdx}`;
          const hx = bx + ox;
          const hz = bz + oz;
          houses.push({
            id: houseId,
            x: hx,
            z: hz,
            width: 7.4,
            depth: 6.8,
            wallHeight: wh,
            roofHeight: 2.35,
            facing,
            wallColor: houseColors[cIdx],
            roofColor: roofColors[cIdx],
            trimColor: 0xf4f1ea,
          });
          pushCollider(
            colliders,
            houseId,
            hx,
            hz,
            7.4,
            6.8,
            SIDEWALK_HEIGHT,
            SIDEWALK_HEIGHT + wh + 2.35,
            'house',
            true,
          );
          const outwardYaw = facing === 0 ? Math.PI : 0;
          const doorZOffset = facing === 0 ? -3.4 : 3.4;
          entrances.push({
            id: `ent_${houseId}`,
            buildingId: houseId,
            name: isModern ? 'Modern Family House' : 'Cozy Cottage Home',
            category: 'residential',
            subtype: isModern ? 'modern_house' : 'small_house',
            doorX: hx,
            doorY: SIDEWALK_HEIGHT,
            doorZ: hz + doorZOffset,
            yaw: outwardYaw,
            width: 1.1,
            height: 2.25,
            doorStyle: 'wood',
            accentColor: roofColors[cIdx],
          });
        });
        trees.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz, scale: 1.06, tint: 0x43834c, kind: 'deciduous' });
        pushCollider(colliders, `res_tree_${ix}_${iz}`, bx, bz, 0.9, 0.9, 0, 4.8, 'prop', false);
      }
    }
  }

  // Coastal Boulevard Palms, Streetlamps & Beach Umbrellas / Pier Railings (x = 91..95)
  for (let z = -2; z <= 82; z += 18) {
    lamps.push({ x: 92.2, y: SIDEWALK_HEIGHT, z, rotY: -Math.PI * 0.5 });
    pushCollider(colliders, `coast_lamp_${z}`, 92.2, z, 0.4, 0.4, 0, 5.0, 'prop', false);
    if (Math.abs(z - 42) > 6) {
      trees.push({ x: 91.5, y: SIDEWALK_HEIGHT, z: z + 7, scale: 1.08, tint: 0x4a9452, kind: 'palm' });
      pushCollider(colliders, `prom_palm_${z}`, 91.5, z + 7, 0.75, 0.75, 0, 5.0, 'prop', false);
    }
  }

  // Harbor Industrial Wharf Streetlamps (x = 91.5, z = -78..-16)
  for (let z = -76; z <= -18; z += 26) {
    lamps.push({ x: 91.5, y: SIDEWALK_HEIGHT, z, rotY: -Math.PI * 0.5 });
    pushCollider(colliders, `port_lamp_${z}`, 91.5, z, 0.4, 0.4, 0, 5.0, 'prop', false);
  }

  // Traffic Signs at major intersections
  const signSpots: Array<[number, number, number, TrafficSignSpec['kind']]> = [
    [-6.2, 6.2, Math.PI, 'stop'],
    [6.2, -6.2, 0, 'crosswalk'],
    [-6.2, -35.8, 0, 'speed'],
    [35.8, -6.2, -Math.PI * 0.5, 'crosswalk'],
    [35.8, 48.2, Math.PI * 0.5, 'stop'],
    [77.8, 6.2, -Math.PI * 0.5, 'speed'],
    [77.8, -35.8, -Math.PI * 0.5, 'stop'],
    [-35.8, 35.8, 0, 'crosswalk'],
  ];
  signSpots.forEach(([sx, sz, rotY, kind], i) => {
    trafficSigns.push({ x: sx, y: SIDEWALK_HEIGHT, z: sz, rotY, kind });
    pushCollider(colliders, `tsign_${i}`, sx, sz, 0.3, 0.3, 0, 3.0, 'prop', false);
  });

  // Harbor Wharf Containers on dock (x = 96, z = -68, -50)
  containers.push({ id: 'wharf_cont_1', x: 97.5, y: SIDEWALK_HEIGHT, z: -64, rotY: 0, color: 0xc24938 });
  pushCollider(colliders, 'wharf_cont_1', 97.5, -64, 2.5, 6.0, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT + 2.6, 'container', true);
  containers.push({ id: 'wharf_cont_2', x: 97.5, y: SIDEWALK_HEIGHT, z: -52, rotY: 0, color: 0x2f6c96 });
  pushCollider(colliders, 'wharf_cont_2', 97.5, -52, 2.5, 6.0, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT + 2.6, 'container', true);

  // Minimap Important Location Markers
  const landmarks: LandmarkPin[] = [
    { id: 'lm_tower', label: 'CITY TOWER', shortCode: 'CT', district: 'downtown', x: -25.5, z: -25.5, color: '#f59e0b' },
    { id: 'lm_reward_center', label: 'CITY REWARD CENTER', shortCode: 'RC', district: 'coastal', x: 13.5, z: 28.8, color: '#fbbf24' },
    { id: 'lm_mall', label: 'Grand Mall & Parking', shortCode: 'M', district: 'downtown', x: 21, z: -21, color: '#38bdf8' },
    { id: 'lm_park', label: 'Emerald Park', shortCode: 'P', district: 'residential', x: -21, z: 21, color: '#34d399' },
    { id: 'lm_port', label: 'Harbor Port', shortCode: 'H', district: 'industrial', x: 74, z: -32, color: '#fb923c' },
    { id: 'lm_beach', label: 'Coastal Pier & Beach', shortCode: 'B', district: 'coastal', x: 102, z: 42, color: '#22d3ee' },
    { id: 'lm_airport', label: 'City Airport', shortCode: 'AP', district: 'downtown', x: -92, z: -92, color: '#a78bfa' },
  ];

  // Physical Rooftops (6 climbable & interior-accessible 3D rooftop decks)
  const addPerimeterRailings = (
    idPrefix: string,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    y: number,
    gap?: { side: 'n' | 's' | 'e' | 'w'; center: number; halfWidth: number },
  ) => {
    const h = 1.15;
    const t = 0.24;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const w = maxX - minX;
    const d = maxZ - minZ;

    const addSegmentedH = (side: 'n' | 's', zPos: number) => {
      if (gap && gap.side === side) {
        const leftW = gap.center - gap.halfWidth - minX;
        if (leftW > 0.4) {
          pushCollider(colliders, `${idPrefix}_${side}1`, minX + leftW * 0.5, zPos, leftW, t, y, y + h, 'barrier', false);
        }
        const rightW = maxX - (gap.center + gap.halfWidth);
        if (rightW > 0.4) {
          pushCollider(colliders, `${idPrefix}_${side}2`, maxX - rightW * 0.5, zPos, rightW, t, y, y + h, 'barrier', false);
        }
      } else {
        pushCollider(colliders, `${idPrefix}_${side}`, cx, zPos, w, t, y, y + h, 'barrier', false);
      }
    };
    const addSegmentedV = (side: 'w' | 'e', xPos: number) => {
      if (gap && gap.side === side) {
        const topD = gap.center - gap.halfWidth - minZ;
        if (topD > 0.4) {
          pushCollider(colliders, `${idPrefix}_${side}1`, xPos, minZ + topD * 0.5, t, topD, y, y + h, 'barrier', false);
        }
        const botD = maxZ - (gap.center + gap.halfWidth);
        if (botD > 0.4) {
          pushCollider(colliders, `${idPrefix}_${side}2`, xPos, maxZ - botD * 0.5, t, botD, y, y + h, 'barrier', false);
        }
      } else {
        pushCollider(colliders, `${idPrefix}_${side}`, xPos, cz, t, d, y, y + h, 'barrier', false);
      }
    };

    addSegmentedH('n', minZ + t * 0.5);
    addSegmentedH('s', maxZ - t * 0.5);
    addSegmentedV('w', minX + t * 0.5);
    addSegmentedV('e', maxX - t * 0.5);
  };

  const rooftops: RooftopSpec[] = [
    {
      id: 'roof_freedom_tower',
      buildingId: 'freedom_tower',
      name: 'CITY TOWER Skydeck & Helipad',
      minX: -32.5,
      maxX: -18.5,
      minZ: -32.5,
      maxZ: -18.5,
      y: SIDEWALK_HEIGHT + 76,
      theme: 'helipad_skydeck',
      hasHelipad: true,
      hasGarden: true,
      hasTelescopes: true,
      interiorAccessDoor: { x: -20.8, z: -28.6, yaw: 0, targetFloor: 22 },
      props: [
        { id: 'rt_ft_stair', kind: 'stairhouse', x: -20.8, z: -30.5, width: 3.4, depth: 3.0, height: 3.1, color: 0x334155 },
        { id: 'rt_ft_tele1', kind: 'telescope', x: -25.5, z: -19.5, width: 0.7, depth: 0.7, height: 1.35, rotY: 0 },
        { id: 'rt_ft_tele2', kind: 'telescope', x: -19.5, z: -23.0, width: 0.7, depth: 0.7, height: 1.35, rotY: -Math.PI * 0.5 },
        { id: 'rt_ft_planter1', kind: 'planter', x: -30.5, z: -20.5, width: 2.2, depth: 1.0, height: 0.75, vaultable: true, color: 0x10b981 },
        { id: 'rt_ft_bench1', kind: 'bench', x: -22.2, z: -20.2, width: 2.0, depth: 0.75, height: 0.85, rotY: Math.PI, vaultable: true },
        { id: 'rt_ft_hvac1', kind: 'hvac', x: -30.6, z: -30.6, width: 1.8, depth: 1.5, height: 0.9, vaultable: true },
      ],
    },
    {
      id: 'roof_civic_office',
      buildingId: 'civic_office_east',
      name: 'Civic Center Garden Terrace',
      minX: -17.25,
      maxX: -8.75,
      minZ: -32.5,
      maxZ: -21.5,
      y: SIDEWALK_HEIGHT + 24,
      theme: 'garden_terrace',
      hasGarden: true,
      hasTelescopes: true,
      interiorAccessDoor: { x: -15.0, z: -29.2, yaw: 0, targetFloor: 2 },
      props: [
        { id: 'rt_co_stair', kind: 'stairhouse', x: -15.0, z: -30.8, width: 3.0, depth: 2.6, height: 2.9, color: 0x475569 },
        { id: 'rt_co_pergola', kind: 'pergola', x: -12.2, z: -25.0, width: 4.2, depth: 3.6, height: 2.7, color: 0x92400e },
        { id: 'rt_co_bench', kind: 'bench', x: -12.2, z: -25.0, width: 2.0, depth: 0.75, height: 0.85, rotY: 0, vaultable: true },
        { id: 'rt_co_tree1', kind: 'tree', x: -15.5, z: -23.0, width: 1.0, depth: 1.0, height: 3.4 },
        { id: 'rt_co_planter', kind: 'planter', x: -10.5, z: -22.8, width: 2.0, depth: 0.9, height: 0.75, vaultable: true, color: 0x22c55e },
        { id: 'rt_co_tele', kind: 'telescope', x: -13.0, z: -22.3, width: 0.7, depth: 0.7, height: 1.35, rotY: 0 },
      ],
    },
    {
      id: 'roof_freedom_mall',
      buildingId: 'freedom_mall',
      name: 'Freedom Mall Sky Garden',
      minX: 10.0,
      maxX: 32.0,
      minZ: -32.0,
      maxZ: -18.0,
      y: SIDEWALK_HEIGHT + 11.5,
      theme: 'garden_terrace',
      hasGarden: true,
      hasTelescopes: true,
      interiorAccessDoor: { x: 14.2, z: -29.0, yaw: 0, targetFloor: 2 },
      props: [
        { id: 'rt_fm_stair', kind: 'stairhouse', x: 14.2, z: -30.6, width: 3.2, depth: 2.8, height: 2.9, color: 0x334155 },
        { id: 'rt_fm_pergola', kind: 'pergola', x: 25.5, z: -25.0, width: 5.2, depth: 4.2, height: 2.8, color: 0x78350f },
        { id: 'rt_fm_tree1', kind: 'tree', x: 19.0, z: -21.0, width: 1.0, depth: 1.0, height: 3.6 },
        { id: 'rt_fm_tree2', kind: 'tree', x: 29.8, z: -20.5, width: 1.0, depth: 1.0, height: 3.4 },
        { id: 'rt_fm_planter1', kind: 'planter', x: 21.0, z: -25.0, width: 2.4, depth: 1.0, height: 0.75, vaultable: true, color: 0x16a34a },
        { id: 'rt_fm_hvac', kind: 'hvac', x: 29.5, z: -29.8, width: 2.0, depth: 1.6, height: 0.9, vaultable: true },
        { id: 'rt_fm_bench', kind: 'bench', x: 25.5, z: -25.0, width: 2.2, depth: 0.75, height: 0.85, rotY: 0, vaultable: true },
        { id: 'rt_fm_tele', kind: 'telescope', x: 21.0, z: -18.9, width: 0.7, depth: 0.7, height: 1.35, rotY: 0 },
      ],
    },
    {
      id: 'roof_reward_center',
      buildingId: 'city_reward_center',
      name: 'Reward Center VIP Lookout',
      minX: 9.5,
      maxX: 17.5,
      minZ: 24.7,
      maxZ: 32.9,
      y: SIDEWALK_HEIGHT + 6.8,
      theme: 'lounge_deck',
      hasGarden: true,
      hasTelescopes: true,
      props: [
        { id: 'rt_rc_pergola', kind: 'pergola', x: 13.5, z: 27.2, width: 4.0, depth: 3.4, height: 2.6, color: 0xf59e0b },
        { id: 'rt_rc_bench', kind: 'bench', x: 13.5, z: 27.2, width: 2.0, depth: 0.75, height: 0.85, rotY: 0, vaultable: true },
        { id: 'rt_rc_planter', kind: 'planter', x: 11.2, z: 30.8, width: 1.8, depth: 0.9, height: 0.72, vaultable: true, color: 0x10b981 },
        { id: 'rt_rc_tele', kind: 'telescope', x: 15.8, z: 25.6, width: 0.7, depth: 0.7, height: 1.35, rotY: Math.PI },
      ],
    },
    {
      id: 'roof_ind_warehouse',
      buildingId: 'ind_warehouse',
      name: 'Logistics Warehouse Helipad',
      minX: 65.05,
      maxX: 74.55,
      minZ: -24.75,
      maxZ: -10.25,
      y: SIDEWALK_HEIGHT + 7.5,
      theme: 'industrial_helipad',
      hasHelipad: true,
      hasTelescopes: false,
      interiorAccessDoor: { x: 72.5, z: -21.8, yaw: 0, targetFloor: 2 },
      props: [
        { id: 'rt_iw_stair', kind: 'stairhouse', x: 72.5, z: -23.3, width: 2.8, depth: 2.4, height: 2.7, color: 0x475569 },
        { id: 'rt_iw_hvac1', kind: 'hvac', x: 67.2, z: -22.5, width: 1.9, depth: 1.5, height: 0.88, vaultable: true },
        { id: 'rt_iw_hvac2', kind: 'hvac', x: 67.2, z: -12.4, width: 1.9, depth: 1.5, height: 0.88, vaultable: true },
      ],
    },
    {
      id: 'roof_coral_resort',
      buildingId: 'resort_2_2',
      name: 'Coral Bay Ocean Lounge',
      minX: 21.05,
      maxX: 32.55,
      minZ: 11.75,
      maxZ: 23.25,
      y: SIDEWALK_HEIGHT + 13.5,
      theme: 'coastal_terrace',
      hasGarden: true,
      hasTelescopes: true,
      props: [
        { id: 'rt_cr_pergola', kind: 'pergola', x: 28.5, z: 17.0, width: 4.5, depth: 4.0, height: 2.7, color: 0x92400e },
        { id: 'rt_cr_bench', kind: 'bench', x: 28.5, z: 17.0, width: 2.0, depth: 0.75, height: 0.85, rotY: -Math.PI * 0.5, vaultable: true },
        { id: 'rt_cr_planter', kind: 'planter', x: 23.8, z: 21.2, width: 2.0, depth: 0.9, height: 0.72, vaultable: true, color: 0x10b981 },
        { id: 'rt_cr_tele', kind: 'telescope', x: 31.4, z: 17.5, width: 0.7, depth: 0.7, height: 1.35, rotY: -Math.PI * 0.5 },
      ],
    },
  ];

  const ladders: ExteriorLadderSpec[] = [
    {
      id: 'ladder_civic_office',
      buildingId: 'civic_office_east',
      label: 'Civic Center Roof Ladder',
      x: -8.75,
      z: -27.0,
      normalX: 1,
      normalZ: 0,
      climbYaw: Math.PI * 0.5,
      bottomY: SIDEWALK_HEIGHT,
      topY: SIDEWALK_HEIGHT + 24,
      topStepX: -9.85,
      topStepZ: -27.0,
    },
    {
      id: 'ladder_freedom_mall',
      buildingId: 'freedom_mall',
      label: 'Mall Sky Garden Ladder',
      x: 10.0,
      z: -25.0,
      normalX: -1,
      normalZ: 0,
      climbYaw: -Math.PI * 0.5,
      bottomY: SIDEWALK_HEIGHT,
      topY: SIDEWALK_HEIGHT + 11.5,
      topStepX: 11.1,
      topStepZ: -25.0,
    },
    {
      id: 'ladder_reward_center',
      buildingId: 'city_reward_center',
      label: 'VIP Lookout Ladder',
      x: 13.5,
      z: 32.9,
      normalX: 0,
      normalZ: 1,
      climbYaw: 0,
      bottomY: SIDEWALK_HEIGHT,
      topY: SIDEWALK_HEIGHT + 6.8,
      topStepX: 13.5,
      topStepZ: 31.8,
    },
    {
      id: 'ladder_ind_warehouse',
      buildingId: 'ind_warehouse',
      label: 'Warehouse Helipad Ladder',
      x: 65.05,
      z: -17.5,
      normalX: -1,
      normalZ: 0,
      climbYaw: -Math.PI * 0.5,
      bottomY: SIDEWALK_HEIGHT,
      topY: SIDEWALK_HEIGHT + 7.5,
      topStepX: 66.15,
      topStepZ: -17.5,
    },
    {
      id: 'ladder_coral_resort',
      buildingId: 'resort_2_2',
      label: 'Ocean Lounge Ladder',
      x: 26.8,
      z: 23.25,
      normalX: 0,
      normalZ: 1,
      climbYaw: 0,
      bottomY: SIDEWALK_HEIGHT,
      topY: SIDEWALK_HEIGHT + 13.5,
      topStepX: 26.8,
      topStepZ: 22.15,
    },
  ];

  const ladderGapByBuilding: Record<string, { side: 'n' | 's' | 'e' | 'w'; center: number; halfWidth: number }> = {
    civic_office_east: { side: 'e', center: -27.0, halfWidth: 0.75 },
    freedom_mall: { side: 'w', center: -25.0, halfWidth: 0.75 },
    city_reward_center: { side: 's', center: 13.5, halfWidth: 0.75 },
    ind_warehouse: { side: 'w', center: -17.5, halfWidth: 0.75 },
    resort_2_2: { side: 's', center: 26.8, halfWidth: 0.75 },
  };

  for (const roof of rooftops) {
    addPerimeterRailings(
      roof.id,
      roof.minX,
      roof.maxX,
      roof.minZ,
      roof.maxZ,
      roof.y,
      ladderGapByBuilding[roof.buildingId],
    );
    for (const prop of roof.props) {
      if (prop.kind === 'stairhouse' || prop.kind === 'planter' || prop.kind === 'bench' || prop.kind === 'hvac') {
        pushCollider(
          colliders,
          prop.id,
          prop.x,
          prop.z,
          prop.width,
          prop.depth,
          roof.y,
          roof.y + prop.height,
          prop.kind === 'stairhouse' ? 'building' : 'prop',
          prop.kind === 'stairhouse',
          Boolean(prop.vaultable),
        );
      }
    }
  }

  // Connected sidewalk loops for autonomous NPCs (clear center of 3m sidewalks)
  const npcLoops: NpcWaypointLoop[] = [
    // Downtown Plaza & Mall loop
    {
      id: 'loop_downtown_1',
      points: [
        { x: -7.2, z: -7.2 },
        { x: -7.2, z: -34.8 },
        { x: -34.8, z: -34.8 },
        { x: -34.8, z: -7.2 },
      ],
    },
    {
      id: 'loop_downtown_2',
      points: [
        { x: 7.2, z: -7.2 },
        { x: 34.8, z: -7.2 },
        { x: 34.8, z: -34.8 },
        { x: 7.2, z: -34.8 },
      ],
    },
    // Residential Emerald Park & Homes loop
    {
      id: 'loop_res_park',
      points: [
        { x: -7.2, z: 7.2 },
        { x: -34.8, z: 7.2 },
        { x: -34.8, z: 34.8 },
        { x: -7.2, z: 34.8 },
      ],
    },
    {
      id: 'loop_res_homes',
      points: [
        { x: -49.2, z: 7.2 },
        { x: -76.8, z: 7.2 },
        { x: -76.8, z: 34.8 },
        { x: -49.2, z: 34.8 },
      ],
    },
    {
      id: 'loop_res_apts',
      points: [
        { x: -7.2, z: 49.2 },
        { x: -34.8, z: 49.2 },
        { x: -34.8, z: 76.8 },
        { x: -7.2, z: 76.8 },
      ],
    },
    // Industrial & Harbor loop
    {
      id: 'loop_ind_port',
      points: [
        { x: 49.2, z: -7.2 },
        { x: 76.8, z: -7.2 },
        { x: 76.8, z: -34.8 },
        { x: 49.2, z: -34.8 },
      ],
    },
    // Coastal Restaurants & Beach Promenade loop
    {
      id: 'loop_coastal_prom',
      points: [
        { x: 89.8, z: 8.0 },
        { x: 89.8, z: 78.0 },
        { x: 93.8, z: 78.0 },
        { x: 93.8, z: 8.0 },
      ],
    },
    {
      id: 'loop_coastal_bistro',
      points: [
        { x: 49.2, z: 7.2 },
        { x: 76.8, z: 7.2 },
        { x: 76.8, z: 34.8 },
        { x: 49.2, z: 34.8 },
      ],
    },
  ];

  // =========================================================================
  // MULTI-CITY EXPANSION: BRIDGES, 3 INTERNATIONAL AIRPORTS, CITY 2 & CITY 3
  // =========================================================================

  const cities: CityZoneSpec[] = [
    {
      id: 'liberty_metro',
      name: 'Liberty Metro',
      shortName: 'Liberty',
      tagline: 'Downtown Skyline, Coastal Pier & International Hub',
      centerX: 0,
      centerZ: 0,
      landMinX: -95,
      landMaxX: 95,
      landMinZ: -95,
      landMaxZ: 95,
      roadCentersX: [-84, -42, 0, 42, 84],
      roadCentersZ: [-84, -42, 0, 42, 84],
      accentColor: '#f59e0b',
    },
    {
      id: 'emerald_bay',
      name: 'Emerald Bay',
      shortName: 'Emerald Bay',
      tagline: 'Eastern Harbor Bridge, Nusantara Marina & Coastal Villas',
      centerX: 305,
      centerZ: 0,
      landMinX: 233,
      landMaxX: 382,
      landMinZ: -95,
      landMaxZ: 95,
      roadCentersX: [242, 284, 326, 368],
      roadCentersZ: [-84, -42, 0, 42, 84],
      accentColor: '#10b981',
    },
    {
      id: 'aero_highland',
      name: 'Aero Highland',
      shortName: 'Highland',
      tagline: 'Northern Skyway, Observatory Campus & Eco-Highlands',
      centerX: 0,
      centerZ: -283,
      landMinX: -95,
      landMaxX: 95,
      landMinZ: -358,
      landMaxZ: -210,
      roadCentersX: [-84, -42, 0, 42, 84],
      roadCentersZ: [-346, -304, -262, -220],
      accentColor: '#38bdf8',
    },
    {
      id: 'golden_horizon',
      name: 'Golden Horizon',
      shortName: 'Golden Bay',
      tagline: 'Southern Sunset Bridge, Golden Spire & Coastal Promenade',
      centerX: 0,
      centerZ: 283,
      landMinX: -95,
      landMaxX: 95,
      landMinZ: 210,
      landMaxZ: 358,
      roadCentersX: [-84, -42, 0, 42, 84],
      roadCentersZ: [220, 262, 304, 346],
      accentColor: '#eab308',
    },
  ];

  const bridges: BridgeSpec[] = [
    {
      id: 'bridge_east_harbor',
      name: 'Grand Harbor Suspension Bridge',
      axis: 'x',
      start: 95,
      end: 235,
      crossCenter: 0,
      roadWidth: 10,
      sidewalkWidth: 2,
      rampLength: 28,
      deckHeight: 5.5,
      towerPositions: [128, 202],
      cableColor: 0x38bdf8,
    },
    {
      id: 'bridge_north_skyway',
      name: 'Northern Aero Skyway Bridge',
      axis: 'z',
      start: -215,
      end: -95,
      crossCenter: 0,
      roadWidth: 10,
      sidewalkWidth: 2,
      rampLength: 26,
      deckHeight: 4.5,
      towerPositions: [-180, -130],
      cableColor: 0xf59e0b,
    },
    {
      id: 'bridge_south_sunset',
      name: 'Golden Sunset Cable Bridge',
      axis: 'z',
      start: 95,
      end: 215,
      crossCenter: 0,
      roadWidth: 10,
      sidewalkWidth: 2,
      rampLength: 26,
      deckHeight: 5.0,
      towerPositions: [128, 182],
      cableColor: 0xf97316,
    },
  ];

  // Bridge side guardrails so players & vehicles cross safely above the sea
  pushCollider(colliders, 'bridge_eh_rail_n', 165, -7.25, 140, 0.5, 0, 9.5, 'barrier', false);
  pushCollider(colliders, 'bridge_eh_rail_s', 165, 7.25, 140, 0.5, 0, 9.5, 'barrier', false);
  pushCollider(colliders, 'bridge_ns_rail_w', -7.25, -155, 0.5, 120, 0, 8.5, 'barrier', false);
  pushCollider(colliders, 'bridge_ns_rail_e', 7.25, -155, 0.5, 120, 0, 8.5, 'barrier', false);
  pushCollider(colliders, 'bridge_ls_rail_w', -7.25, 155, 0.5, 120, 0, 9.0, 'barrier', false);
  pushCollider(colliders, 'bridge_ls_rail_e', 7.25, 155, 0.5, 120, 0, 9.0, 'barrier', false);

  // Bridge streetlamps
  for (let bx = 104; bx <= 226; bx += 24) {
    const by = getSingleBridgeHeight(bx, bridges[0]) + SIDEWALK_HEIGHT;
    lamps.push({ x: bx, y: by, z: -6.1, rotY: 0 });
    lamps.push({ x: bx, y: by, z: 6.1, rotY: Math.PI });
  }
  for (let bz = -205; bz <= -105; bz += 24) {
    const by = getSingleBridgeHeight(bz, bridges[1]) + SIDEWALK_HEIGHT;
    lamps.push({ x: -6.1, y: by, z: bz, rotY: Math.PI * 0.5 });
    lamps.push({ x: 6.1, y: by, z: bz, rotY: -Math.PI * 0.5 });
  }
  for (let bz = 105; bz <= 205; bz += 24) {
    const by = getSingleBridgeHeight(bz, bridges[2]) + SIDEWALK_HEIGHT;
    lamps.push({ x: -6.1, y: by, z: bz, rotY: Math.PI * 0.5 });
    lamps.push({ x: 6.1, y: by, z: bz, rotY: -Math.PI * 0.5 });
  }

  // Shared helper to add a 100%-enterable building in any city
  const addCityBuilding = (
    spec: BuildingSpec,
    ent: {
      name: string;
      category: BuildingEntranceSpec['category'];
      subtype: BuildingEntranceSpec['subtype'];
      doorSide?: 'south' | 'north' | 'west' | 'east';
      doorStyle?: BuildingEntranceSpec['doorStyle'];
    },
  ) => {
    buildings.push(spec);
    pushCollider(
      colliders,
      spec.id,
      spec.x,
      spec.z,
      spec.width,
      spec.depth,
      SIDEWALK_HEIGHT,
      SIDEWALK_HEIGHT + spec.height,
      'building',
      true,
    );
    const side = ent.doorSide ?? 'south';
    let doorX = spec.x;
    let doorZ = spec.z + spec.depth * 0.5;
    let yaw = 0;
    if (side === 'north') {
      doorZ = spec.z - spec.depth * 0.5;
      yaw = Math.PI;
    } else if (side === 'west') {
      doorX = spec.x - spec.width * 0.5;
      doorZ = spec.z;
      yaw = -Math.PI * 0.5;
    } else if (side === 'east') {
      doorX = spec.x + spec.width * 0.5;
      doorZ = spec.z;
      yaw = Math.PI * 0.5;
    }
    entrances.push({
      id: `ent_${spec.id}`,
      buildingId: spec.id,
      name: ent.name,
      category: ent.category,
      subtype: ent.subtype,
      doorX,
      doorY: SIDEWALK_HEIGHT,
      doorZ,
      yaw,
      width: 2.0,
      height: 2.6,
      doorStyle:
        ent.doorStyle ??
        (ent.category === 'industrial'
          ? 'industrial'
          : ent.category === 'commercial'
            ? 'storefront'
            : 'glass_double'),
      accentColor: spec.accentColor,
    });
  };

  // Helper to add a 4-house residential block
  const addResidentialHouseQuad = (
    prefix: string,
    bx: number,
    bz: number,
    cityTag: string,
    wallPalette: number[],
    roofPalette: number[],
  ) => {
    const subOffsets: Array<[number, number, number]> = [
      [-6.2, -6.2, 0],
      [6.2, -6.2, 0],
      [-6.2, 6.2, Math.PI],
      [6.2, 6.2, Math.PI],
    ];
    subOffsets.forEach(([ox, oz, facing], hIdx) => {
      const cIdx = (Math.abs(Math.round(bx + bz)) + hIdx) % wallPalette.length;
      const isModern = hIdx % 2 === 1;
      const wh = isModern ? 4.8 : 4.2;
      const houseId = `${prefix}_h_${hIdx}`;
      const hx = bx + ox;
      const hz = bz + oz;
      houses.push({
        id: houseId,
        x: hx,
        z: hz,
        width: 7.4,
        depth: 6.8,
        wallHeight: wh,
        roofHeight: 2.35,
        facing,
        wallColor: wallPalette[cIdx],
        roofColor: roofPalette[cIdx],
        trimColor: 0xf4f1ea,
      });
      pushCollider(
        colliders,
        houseId,
        hx,
        hz,
        7.4,
        6.8,
        SIDEWALK_HEIGHT,
        SIDEWALK_HEIGHT + wh + 2.35,
        'house',
        true,
      );
      const outwardYaw = facing === 0 ? Math.PI : 0;
      const doorZOffset = facing === 0 ? -3.4 : 3.4;
      entrances.push({
        id: `ent_${houseId}`,
        buildingId: houseId,
        name: isModern ? `${cityTag} Modern Villa` : `${cityTag} Cottage Home`,
        category: 'residential',
        subtype: isModern ? 'modern_house' : 'small_house',
        doorX: hx,
        doorY: SIDEWALK_HEIGHT,
        doorZ: hz + doorZOffset,
        yaw: outwardYaw,
        width: 1.1,
        height: 2.25,
        doorStyle: 'wood',
        accentColor: roofPalette[cIdx],
      });
    });
    trees.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz, scale: 1.04, tint: 0x3f844c, kind: 'deciduous' });
    pushCollider(colliders, `${prefix}_tree`, bx, bz, 0.9, 0.9, 0, 4.8, 'prop', false);
  };

  // =========================================================================
  // CITY 2: EMERALD BAY (X: 242..368, Z: -84..84)
  // =========================================================================
  const c2BlockX = [263, 305, 347];
  const c2BlockZ = [-63, -21, 21, 63];
  for (let ix = 0; ix < c2BlockX.length; ix++) {
    for (let iz = 0; iz < c2BlockZ.length; iz++) {
      const bx = c2BlockX[ix];
      const bz = c2BlockZ[iz];
      let bType: BlockZone['type'] = 'residential_houses';
      let dist: DistrictId = 'bay_marina';
      if (bx === 305 && bz === 21) bType = 'residential_park';
      else if (bx === 263 && bz === -21) bType = 'downtown_mall';
      else if (bx === 305 && bz === -21) bType = 'downtown_tower';
      else if (bx === 305 && bz === -63) bType = 'downtown_parking';
      else if (bx === 263 && bz === 21) bType = 'coastal_restaurants';
      else if (bx === 263 && bz === 63) bType = 'residential_apartments';
      else if (bx === 347 && bz === -63) {
        bType = 'industrial_factory';
        dist = 'industrial';
      } else if (bx === 347 && bz === -21) {
        bType = 'industrial_port';
        dist = 'industrial';
      } else if (bx === 347 && bz === 21) {
        bType = 'coastal_resort';
      }

      blocks.push({
        id: `c2_blk_${ix}_${iz}`,
        cx: bx,
        cz: bz,
        size: BLOCK_OUTER_SIZE,
        type: bType,
        district: dist,
        label: DISTRICT_LABELS[dist],
        cityId: 'emerald_bay',
      });

      const lampOff = BLOCK_OUTER_SIZE * 0.5 - 1.1;
      for (const [lx, lz, rY] of [
        [bx - lampOff, bz - lampOff, Math.PI * 0.25],
        [bx + lampOff, bz + lampOff, -Math.PI * 0.75],
      ] as Array<[number, number, number]>) {
        lamps.push({ x: lx, y: SIDEWALK_HEIGHT, z: lz, rotY: rY });
        pushCollider(colliders, `c2_lamp_${lx}_${lz}`, lx, lz, 0.4, 0.4, 0, 5.0, 'prop', false);
      }

      if (bx === 263 && bz === -21) {
        addCityBuilding(
          {
            id: 'c2_marina_mall',
            x: bx,
            z: bz - 3.5,
            width: 21,
            depth: 13.5,
            height: 11.0,
            style: 'mall',
            primaryColor: 0xe6efe9,
            accentColor: 0x0f766e,
            hasAwning: true,
          },
          { name: 'Marina Harbor Mall', category: 'commercial', subtype: 'mall', doorStyle: 'glass_double' },
        );
        addParkedVehicle(parkedVehicles, colliders, 'c2_mall_car1', bx - 5.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'sedan', 0x0ea5e9);
        addParkedVehicle(parkedVehicles, colliders, 'c2_mall_car2', bx + 4.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'suv', 0xf59e0b);
      } else if (bx === 305 && bz === -21) {
        addCityBuilding(
          {
            id: 'c2_emerald_tower',
            x: bx - 4.0,
            z: bz - 4.0,
            width: 13.5,
            depth: 13.5,
            height: 44,
            style: 'skyscraper',
            primaryColor: 0xd5ebe6,
            accentColor: 0x0d9488,
            hasSpire: true,
          },
          { name: 'Emerald Sky Tower', category: 'business', subtype: 'corporate', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c2_marina_offices',
            x: bx + 8.0,
            z: bz - 5.0,
            width: 8.5,
            depth: 11.0,
            height: 20,
            style: 'office',
            primaryColor: 0xcbd5e1,
            accentColor: 0x0f766e,
          },
          { name: 'Marina Innovation Offices', category: 'business', subtype: 'office', doorStyle: 'glass_double' },
        );
        fountains.push({ x: bx + 6.5, y: SIDEWALK_HEIGHT, z: bz + 6.5, radius: 2.8 });
        pushCollider(colliders, 'c2_tower_fount', bx + 6.5, bz + 6.5, 5.6, 5.6, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT + 1.1, 'prop', false);
      } else if (bx === 305 && bz === -63) {
        addCityBuilding(
          {
            id: 'c2_bayview_tech',
            x: bx - 5.2,
            z: bz - 2.5,
            width: 12.5,
            depth: 14.5,
            height: 24,
            style: 'office',
            primaryColor: 0xd0e2ea,
            accentColor: 0x0284c7,
            hasSetback: true,
          },
          { name: 'Bayview Tech Center', category: 'business', subtype: 'office', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c2_coral_espresso',
            x: bx + 7.2,
            z: bz + 4.5,
            width: 8.8,
            depth: 9.2,
            height: 5.5,
            style: 'restaurant',
            primaryColor: 0xf1e4d4,
            accentColor: 0xd97706,
            hasAwning: true,
          },
          { name: 'Coral Espresso Roasters', category: 'commercial', subtype: 'cafe', doorStyle: 'storefront' },
        );
      } else if (bx === 263 && bz === 21) {
        addCityBuilding(
          {
            id: 'c2_bay_mart',
            x: bx - 6.2,
            z: bz - 3.5,
            width: 9.2,
            depth: 10.5,
            height: 5.2,
            style: 'store',
            primaryColor: 0xf4f1ea,
            accentColor: 0x10b981,
            hasAwning: true,
          },
          { name: 'Bay Mart Groceries', category: 'commercial', subtype: 'convenience_store', doorStyle: 'storefront' },
        );
        addCityBuilding(
          {
            id: 'c2_nusantara_bistro',
            x: bx + 5.8,
            z: bz + 3.5,
            width: 11.5,
            depth: 11.0,
            height: 6.5,
            style: 'restaurant',
            primaryColor: 0xf0e1ce,
            accentColor: 0x0d9488,
            hasAwning: true,
          },
          { name: 'Nusantara Seafood Bistro', category: 'commercial', subtype: 'restaurant', doorStyle: 'glass_double' },
        );
      } else if (bx === 305 && bz === 21) {
        // Emerald Lagoon Park
        fountains.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz, radius: 3.4 });
        pushCollider(colliders, 'c2_lagoon_fount', bx, bz, 6.8, 6.8, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT + 1.1, 'prop', false);
        benches.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz + 6.2, rotY: Math.PI });
        benches.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz - 6.2, rotY: 0 });
        pushCollider(colliders, 'c2_park_b1', bx, bz + 6.2, 2.1, 0.75, 0, 0.9, 'prop', false);
        pushCollider(colliders, 'c2_park_b2', bx, bz - 6.2, 2.1, 0.75, 0, 0.9, 'prop', false);
        for (const [tx, tz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
          trees.push({ x: bx + tx, y: SIDEWALK_HEIGHT, z: bz + tz, scale: 1.08, tint: 0x3b8c52, kind: 'palm' });
          pushCollider(colliders, `c2_pt_${tx}_${tz}`, bx + tx, bz + tz, 0.8, 0.8, 0, 5.0, 'prop', false);
        }
      } else if (bx === 263 && bz === 63) {
        addCityBuilding(
          {
            id: 'c2_lagoon_apt_a',
            x: bx - 5.2,
            z: bz - 3.5,
            width: 11.2,
            depth: 13.0,
            height: 15.0,
            style: 'apartment',
            primaryColor: 0xdbe9e6,
            accentColor: 0x0f766e,
            hasAwning: true,
          },
          { name: 'Emerald Lagoon Residence', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c2_lagoon_apt_b',
            x: bx + 6.5,
            z: bz + 4.5,
            width: 9.8,
            depth: 11.2,
            height: 12.2,
            style: 'apartment',
            primaryColor: 0xe2dfd5,
            accentColor: 0x3b6e66,
          },
          { name: 'Coral Bay Suites', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
      } else if (bx === 347 && bz === -63) {
        addCityBuilding(
          {
            id: 'c2_solar_plant',
            x: bx - 4.8,
            z: bz - 3.5,
            width: 13.2,
            depth: 14.5,
            height: 9.2,
            style: 'factory',
            primaryColor: 0x879199,
            accentColor: 0x0d9488,
          },
          { name: 'Solar Marine Plant', category: 'industrial', subtype: 'factory', doorStyle: 'industrial' },
        );
        addCityBuilding(
          {
            id: 'c2_harbor_depot',
            x: bx + 6.8,
            z: bz + 3.5,
            width: 9.4,
            depth: 13.5,
            height: 7.4,
            style: 'warehouse',
            primaryColor: 0x6f7b85,
            accentColor: 0x3b4854,
          },
          { name: 'Bay Freight Depot', category: 'industrial', subtype: 'warehouse', doorStyle: 'industrial' },
        );
      } else if (bx === 347 && bz === -21) {
        addCityBuilding(
          {
            id: 'c2_marine_workshop',
            x: bx - 5.2,
            z: bz - 3.5,
            width: 11.0,
            depth: 13.0,
            height: 8.0,
            style: 'workshop',
            primaryColor: 0x707b84,
            accentColor: 0xd97706,
          },
          { name: 'Bay Marine Auto Workshop', category: 'industrial', subtype: 'workshop', doorStyle: 'industrial' },
        );
        containers.push({ id: 'c2_cont_1', x: bx + 6.2, y: SIDEWALK_HEIGHT, z: bz - 4.5, rotY: 0, color: 0x0d9488 });
        pushCollider(colliders, 'c2_cont_1', bx + 6.2, bz - 4.5, 2.5, 6.0, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT + 2.6, 'container', true);
      } else if (bx === 347 && bz === 21) {
        addCityBuilding(
          {
            id: 'c2_coastline_coffee',
            x: bx - 5.5,
            z: bz - 3.5,
            width: 10.2,
            depth: 10.2,
            height: 5.8,
            style: 'restaurant',
            primaryColor: 0xefe2d0,
            accentColor: 0x059669,
            hasAwning: true,
          },
          { name: 'Coastline Coffee Pavilion', category: 'commercial', subtype: 'cafe', doorStyle: 'storefront' },
        );
        addCityBuilding(
          {
            id: 'c2_marina_suites',
            x: bx + 6.0,
            z: bz + 4.0,
            width: 10.0,
            depth: 11.5,
            height: 12.8,
            style: 'apartment',
            primaryColor: 0xd5e3e0,
            accentColor: 0x1e6b63,
          },
          { name: 'Marina Terrace Flats', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
      } else {
        addResidentialHouseQuad(
          `c2_${ix}_${iz}`,
          bx,
          bz,
          'Emerald',
          [0xeef2ee, 0xdfe9e4, 0xf2e8d8, 0xd8e4ea],
          [0x0f766e, 0x1e5c6b, 0x8a5236, 0x3b6355],
        );
      }
    }
  }

  // =========================================================================
  // CITY 3: AERO HIGHLAND (X: -84..84, Z: -346..-220)
  // =========================================================================
  const c3BlockX = [-63, -21, 21, 63];
  const c3BlockZ = [-325, -283, -241];
  for (let ix = 0; ix < c3BlockX.length; ix++) {
    for (let iz = 0; iz < c3BlockZ.length; iz++) {
      const bx = c3BlockX[ix];
      const bz = c3BlockZ[iz];
      let bType: BlockZone['type'] = 'residential_houses';
      let dist: DistrictId = 'highland_tech';
      if (bx === -21 && bz === -241) bType = 'residential_park';
      else if (bx === 21 && bz === -241) bType = 'residential_apartments';
      else if (bx === -21 && bz === -283) bType = 'downtown_tower';
      else if (bx === 21 && bz === -283) bType = 'downtown_mall';
      else if (bx === -63 && bz === -283) bType = 'coastal_restaurants';
      else if (bx === 63 && bz === -241) {
        bType = 'industrial_port';
        dist = 'industrial';
      } else if (bx === 63 && bz === -283) {
        bType = 'industrial_factory';
        dist = 'industrial';
      } else if (bx === -21 && bz === -325) bType = 'downtown_parking';
      else if (bx === 21 && bz === -325) bType = 'residential_apartments';
      else if (bx === 63 && bz === -325) {
        bType = 'industrial_port';
        dist = 'industrial';
      }

      blocks.push({
        id: `c3_blk_${ix}_${iz}`,
        cx: bx,
        cz: bz,
        size: BLOCK_OUTER_SIZE,
        type: bType,
        district: dist,
        label: DISTRICT_LABELS[dist],
        cityId: 'aero_highland',
      });

      const lampOff = BLOCK_OUTER_SIZE * 0.5 - 1.1;
      for (const [lx, lz, rY] of [
        [bx - lampOff, bz - lampOff, Math.PI * 0.25],
        [bx + lampOff, bz + lampOff, -Math.PI * 0.75],
      ] as Array<[number, number, number]>) {
        lamps.push({ x: lx, y: SIDEWALK_HEIGHT, z: lz, rotY: rY });
        pushCollider(colliders, `c3_lamp_${lx}_${lz}`, lx, lz, 0.4, 0.4, 0, 5.0, 'prop', false);
      }

      if (bx === -21 && bz === -241) {
        // Highland Pine Park
        fountains.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz, radius: 3.3 });
        pushCollider(colliders, 'c3_park_fount', bx, bz, 6.6, 6.6, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT + 1.1, 'prop', false);
        benches.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz + 6.0, rotY: Math.PI });
        benches.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz - 6.0, rotY: 0 });
        pushCollider(colliders, 'c3_park_b1', bx, bz + 6.0, 2.1, 0.75, 0, 0.9, 'prop', false);
        pushCollider(colliders, 'c3_park_b2', bx, bz - 6.0, 2.1, 0.75, 0, 0.9, 'prop', false);
        for (const [tx, tz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
          trees.push({ x: bx + tx, y: SIDEWALK_HEIGHT, z: bz + tz, scale: 1.1, tint: 0x2f6b47, kind: 'deciduous' });
          pushCollider(colliders, `c3_pt_${tx}_${tz}`, bx + tx, bz + tz, 0.9, 0.9, 0, 4.8, 'prop', false);
        }
      } else if (bx === -21 && bz === -283) {
        addCityBuilding(
          {
            id: 'c3_aero_observatory',
            x: bx - 4.2,
            z: bz - 4.0,
            width: 13.5,
            depth: 13.5,
            height: 48,
            style: 'skyscraper',
            primaryColor: 0xe0eaf5,
            accentColor: 0x0284c7,
            hasSpire: true,
          },
          { name: 'Aero Observatory Tower', category: 'business', subtype: 'corporate', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c3_research_labs',
            x: bx + 8.0,
            z: bz - 4.5,
            width: 8.5,
            depth: 11.5,
            height: 21,
            style: 'office',
            primaryColor: 0xcbd8e6,
            accentColor: 0x1d4ed8,
          },
          { name: 'Highland Research Labs', category: 'business', subtype: 'office', doorStyle: 'glass_double' },
        );
      } else if (bx === 21 && bz === -283) {
        addCityBuilding(
          {
            id: 'c3_skyline_mall',
            x: bx,
            z: bz - 3.5,
            width: 21,
            depth: 13.5,
            height: 11.5,
            style: 'mall',
            primaryColor: 0xe6e8f0,
            accentColor: 0x2563eb,
            hasAwning: true,
          },
          { name: 'Skyline Atrium Mall', category: 'commercial', subtype: 'mall', doorStyle: 'glass_double' },
        );
        addParkedVehicle(parkedVehicles, colliders, 'c3_mall_car1', bx - 5.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'sedan', 0x38bdf8);
        addParkedVehicle(parkedVehicles, colliders, 'c3_mall_car2', bx + 4.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'sedan', 0xe2e8f0);
      } else if (bx === -63 && bz === -283) {
        addCityBuilding(
          {
            id: 'c3_highland_mart',
            x: bx - 5.8,
            z: bz - 3.5,
            width: 9.2,
            depth: 10.5,
            height: 5.0,
            style: 'store',
            primaryColor: 0xf4f3ef,
            accentColor: 0x0284c7,
            hasAwning: true,
          },
          { name: 'Highland Mart Express', category: 'commercial', subtype: 'convenience_store', doorStyle: 'storefront' },
        );
        addCityBuilding(
          {
            id: 'c3_summit_espresso',
            x: bx + 5.8,
            z: bz + 4.0,
            width: 9.6,
            depth: 9.8,
            height: 5.6,
            style: 'restaurant',
            primaryColor: 0xede2d4,
            accentColor: 0x7c3aed,
            hasAwning: true,
          },
          { name: 'Summit Espresso House', category: 'commercial', subtype: 'cafe', doorStyle: 'storefront' },
        );
      } else if (bx === 21 && bz === -241) {
        addCityBuilding(
          {
            id: 'c3_alpine_apt_a',
            x: bx - 5.2,
            z: bz - 3.5,
            width: 11.2,
            depth: 13.0,
            height: 15.2,
            style: 'apartment',
            primaryColor: 0xd9e1eb,
            accentColor: 0x3b5978,
            hasAwning: true,
          },
          { name: 'Alpine View Apartments', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c3_alpine_apt_b',
            x: bx + 6.5,
            z: bz + 4.5,
            width: 9.8,
            depth: 11.2,
            height: 12.6,
            style: 'apartment',
            primaryColor: 0xe3dfd6,
            accentColor: 0x475569,
          },
          { name: 'Skyview Terrace Flats', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
      } else if (bx === 63 && bz === -241) {
        addCityBuilding(
          {
            id: 'c3_turbine_garage',
            x: bx - 5.2,
            z: bz - 3.5,
            width: 10.8,
            depth: 12.5,
            height: 8.0,
            style: 'workshop',
            primaryColor: 0x737d87,
            accentColor: 0x0284c7,
          },
          { name: 'Turbine Tuning Garage', category: 'industrial', subtype: 'workshop', doorStyle: 'industrial' },
        );
        addCityBuilding(
          {
            id: 'c3_pilot_diner',
            x: bx + 6.2,
            z: bz + 4.5,
            width: 9.6,
            depth: 10.2,
            height: 6.0,
            style: 'restaurant',
            primaryColor: 0xf1e5d5,
            accentColor: 0xe11d48,
            hasAwning: true,
          },
          { name: 'Pilot Skyway Diner', category: 'commercial', subtype: 'restaurant', doorStyle: 'glass_double' },
        );
      } else if (bx === 63 && bz === -283) {
        addCityBuilding(
          {
            id: 'c3_aero_factory',
            x: bx - 4.8,
            z: bz - 3.5,
            width: 13.0,
            depth: 14.5,
            height: 9.5,
            style: 'factory',
            primaryColor: 0x8b929a,
            accentColor: 0x2563eb,
          },
          { name: 'Aero Propulsion Factory', category: 'industrial', subtype: 'factory', doorStyle: 'industrial' },
        );
        addCityBuilding(
          {
            id: 'c3_hangar_depot',
            x: bx + 6.8,
            z: bz + 3.5,
            width: 9.4,
            depth: 13.5,
            height: 7.5,
            style: 'warehouse',
            primaryColor: 0x6f7984,
            accentColor: 0x334155,
          },
          { name: 'Skyline Hangar Depot', category: 'industrial', subtype: 'warehouse', doorStyle: 'industrial' },
        );
      } else if (bx === -21 && bz === -325) {
        addCityBuilding(
          {
            id: 'c3_northgate_corp',
            x: bx - 5.4,
            z: bz - 2.5,
            width: 12.2,
            depth: 14.5,
            height: 26,
            style: 'office',
            primaryColor: 0xd4dde8,
            accentColor: 0x1e40af,
            hasSetback: true,
          },
          { name: 'Northgate Corporate Plaza', category: 'business', subtype: 'corporate', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c3_summit_bistro',
            x: bx + 7.0,
            z: bz + 4.5,
            width: 9.5,
            depth: 10.5,
            height: 6.4,
            style: 'restaurant',
            primaryColor: 0xefe3d4,
            accentColor: 0x0284c7,
            hasAwning: true,
          },
          { name: 'Summit Horizon Bistro', category: 'commercial', subtype: 'restaurant', doorStyle: 'glass_double' },
        );
      } else if (bx === 21 && bz === -325) {
        addCityBuilding(
          {
            id: 'c3_eco_flats',
            x: bx - 5.2,
            z: bz - 3.0,
            width: 11.0,
            depth: 13.0,
            height: 14.0,
            style: 'apartment',
            primaryColor: 0xdbe7e1,
            accentColor: 0x2563eb,
          },
          { name: 'Eco Terrace Flats', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c3_alpine_cafe',
            x: bx + 6.5,
            z: bz + 4.5,
            width: 9.2,
            depth: 9.6,
            height: 5.4,
            style: 'restaurant',
            primaryColor: 0xf1e6d8,
            accentColor: 0x10b981,
            hasAwning: true,
          },
          { name: 'Alpine Garden Cafe', category: 'commercial', subtype: 'cafe', doorStyle: 'storefront' },
        );
      } else if (bx === 63 && bz === -325) {
        addCityBuilding(
          {
            id: 'c3_highland_logistics',
            x: bx - 5.4,
            z: bz - 3.5,
            width: 11.2,
            depth: 13.0,
            height: 7.8,
            style: 'warehouse',
            primaryColor: 0x727c85,
            accentColor: 0x2563eb,
          },
          { name: 'Highland Logistics Center', category: 'industrial', subtype: 'warehouse', doorStyle: 'industrial' },
        );
        addCityBuilding(
          {
            id: 'c3_north_workshop',
            x: bx + 6.6,
            z: bz + 3.5,
            width: 9.6,
            depth: 12.0,
            height: 7.6,
            style: 'workshop',
            primaryColor: 0x7c848c,
            accentColor: 0xd97706,
          },
          { name: 'North Tech Workshop', category: 'industrial', subtype: 'workshop', doorStyle: 'industrial' },
        );
      } else {
        addResidentialHouseQuad(
          `c3_${ix}_${iz}`,
          bx,
          bz,
          'Highland',
          [0xeaeef2, 0xdce4ec, 0xf0e7dc, 0xdbe3e6],
          [0x2563eb, 0x3b4d5e, 0x6b4738, 0x2f5e53],
        );
      }
    }
  }

  // =========================================================================
  // CITY 4: GOLDEN HORIZON (X: -84..84, Z: 220..346)
  // =========================================================================
  const c4BlockX = [-63, -21, 21, 63];
  const c4BlockZ = [241, 283, 325];
  for (let ix = 0; ix < c4BlockX.length; ix++) {
    for (let iz = 0; iz < c4BlockZ.length; iz++) {
      const bx = c4BlockX[ix];
      const bz = c4BlockZ[iz];
      let bType: BlockZone['type'] = 'residential_houses';
      let dist: DistrictId = 'suncrest_bay';
      if (bx === -21 && bz === 241) bType = 'residential_park';
      else if (bx === 21 && bz === 241) bType = 'residential_apartments';
      else if (bx === -21 && bz === 283) bType = 'downtown_tower';
      else if (bx === 21 && bz === 283) bType = 'downtown_mall';
      else if (bx === -63 && bz === 283) bType = 'golden_promenade';
      else if (bx === 63 && bz === 241) {
        bType = 'coastal_restaurants';
      } else if (bx === 63 && bz === 283) {
        bType = 'industrial_factory';
        dist = 'industrial';
      } else if (bx === -21 && bz === 325) bType = 'downtown_parking';
      else if (bx === 21 && bz === 325) bType = 'golden_promenade';
      else if (bx === 63 && bz === 325) {
        bType = 'industrial_port';
        dist = 'industrial';
      }

      blocks.push({
        id: `c4_blk_${ix}_${iz}`,
        cx: bx,
        cz: bz,
        size: BLOCK_OUTER_SIZE,
        type: bType,
        district: dist,
        label: DISTRICT_LABELS[dist],
        cityId: 'golden_horizon',
      });

      const lampOff = BLOCK_OUTER_SIZE * 0.5 - 1.1;
      for (const [lx, lz, rY] of [
        [bx - lampOff, bz - lampOff, Math.PI * 0.25],
        [bx + lampOff, bz + lampOff, -Math.PI * 0.75],
      ] as Array<[number, number, number]>) {
        lamps.push({ x: lx, y: SIDEWALK_HEIGHT, z: lz, rotY: rY });
        pushCollider(colliders, `c4_lamp_${lx}_${lz}`, lx, lz, 0.4, 0.4, 0, 5.0, 'prop', false);
      }

      if (bx === -21 && bz === 241) {
        // Golden Palm Park
        fountains.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz, radius: 3.4 });
        pushCollider(colliders, 'c4_park_fount', bx, bz, 6.8, 6.8, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT + 1.1, 'prop', false);
        benches.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz + 6.0, rotY: Math.PI });
        benches.push({ x: bx, y: SIDEWALK_HEIGHT, z: bz - 6.0, rotY: 0 });
        pushCollider(colliders, 'c4_park_b1', bx, bz + 6.0, 2.1, 0.75, 0, 0.9, 'prop', false);
        pushCollider(colliders, 'c4_park_b2', bx, bz - 6.0, 2.1, 0.75, 0, 0.9, 'prop', false);
        for (const [tx, tz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
          trees.push({ x: bx + tx, y: SIDEWALK_HEIGHT, z: bz + tz, scale: 1.12, tint: 0x3b8c52, kind: 'palm' });
          pushCollider(colliders, `c4_pt_${tx}_${tz}`, bx + tx, bz + tz, 0.9, 0.9, 0, 5.0, 'prop', false);
        }
      } else if (bx === -21 && bz === 283) {
        addCityBuilding(
          {
            id: 'c4_golden_spire',
            x: bx - 4.2,
            z: bz - 4.0,
            width: 13.5,
            depth: 13.5,
            height: 46,
            style: 'skyscraper',
            primaryColor: 0xf4ead8,
            accentColor: 0xd97706,
            hasSpire: true,
          },
          { name: 'Golden Horizon Spire', category: 'business', subtype: 'corporate', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c4_coastal_offices',
            x: bx + 8.0,
            z: bz - 4.5,
            width: 8.5,
            depth: 11.5,
            height: 22,
            style: 'office',
            primaryColor: 0xe6dfd3,
            accentColor: 0xb45309,
          },
          { name: 'Horizon Trade Offices', category: 'business', subtype: 'office', doorStyle: 'glass_double' },
        );
        fountains.push({ x: bx + 6.5, y: SIDEWALK_HEIGHT, z: bz + 6.5, radius: 2.7 });
        pushCollider(colliders, 'c4_tower_fount', bx + 6.5, bz + 6.5, 5.4, 5.4, SIDEWALK_HEIGHT, SIDEWALK_HEIGHT + 1.1, 'prop', false);
      } else if (bx === 21 && bz === 283) {
        addCityBuilding(
          {
            id: 'c4_suncrest_mall',
            x: bx,
            z: bz - 3.5,
            width: 21,
            depth: 13.5,
            height: 11.5,
            style: 'mall',
            primaryColor: 0xf2ece2,
            accentColor: 0xeab308,
            hasAwning: true,
          },
          { name: 'Suncrest Galleria Mall', category: 'commercial', subtype: 'mall', doorStyle: 'glass_double' },
        );
        addParkedVehicle(parkedVehicles, colliders, 'c4_mall_car1', bx - 5.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'sedan', 0xf59e0b);
        addParkedVehicle(parkedVehicles, colliders, 'c4_mall_car2', bx + 4.5, SIDEWALK_HEIGHT, bz + 7.5, 0, 'suv', 0x0284c7);
      } else if (bx === -63 && bz === 283) {
        addCityBuilding(
          {
            id: 'c4_golden_mart',
            x: bx - 5.8,
            z: bz - 3.5,
            width: 9.2,
            depth: 10.5,
            height: 5.0,
            style: 'store',
            primaryColor: 0xf7f2e7,
            accentColor: 0xd97706,
            hasAwning: true,
          },
          { name: 'Golden Mart Express', category: 'commercial', subtype: 'convenience_store', doorStyle: 'storefront' },
        );
        addCityBuilding(
          {
            id: 'c4_palms_cafe',
            x: bx + 5.8,
            z: bz + 4.0,
            width: 9.6,
            depth: 9.8,
            height: 5.6,
            style: 'restaurant',
            primaryColor: 0xf3e4d2,
            accentColor: 0xf97316,
            hasAwning: true,
          },
          { name: 'Sunset Palms Cafe', category: 'commercial', subtype: 'cafe', doorStyle: 'storefront' },
        );
      } else if (bx === 21 && bz === 241) {
        addCityBuilding(
          {
            id: 'c4_sunset_apt_a',
            x: bx - 5.2,
            z: bz - 3.5,
            width: 11.2,
            depth: 13.0,
            height: 15.2,
            style: 'apartment',
            primaryColor: 0xede5d8,
            accentColor: 0xd97706,
            hasAwning: true,
          },
          { name: 'Suncrest Bay Residences', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c4_sunset_apt_b',
            x: bx + 6.5,
            z: bz + 4.5,
            width: 9.8,
            depth: 11.2,
            height: 12.6,
            style: 'apartment',
            primaryColor: 0xe6ddd0,
            accentColor: 0x9a3412,
          },
          { name: 'Sunset Palms Suites', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
      } else if (bx === 63 && bz === 241) {
        addCityBuilding(
          {
            id: 'c4_harbor_workshop',
            x: bx - 5.2,
            z: bz - 3.5,
            width: 10.8,
            depth: 12.5,
            height: 8.0,
            style: 'workshop',
            primaryColor: 0x7b8087,
            accentColor: 0xf97316,
          },
          { name: 'Sunset Marine Workshop', category: 'industrial', subtype: 'workshop', doorStyle: 'industrial' },
        );
        addCityBuilding(
          {
            id: 'c4_resort_bistro',
            x: bx + 6.2,
            z: bz + 4.5,
            width: 9.6,
            depth: 10.2,
            height: 6.0,
            style: 'restaurant',
            primaryColor: 0xf4e6d2,
            accentColor: 0xeab308,
            hasAwning: true,
          },
          { name: 'Golden Coast Bistro', category: 'commercial', subtype: 'restaurant', doorStyle: 'glass_double' },
        );
      } else if (bx === 63 && bz === 283) {
        addCityBuilding(
          {
            id: 'c4_solar_factory',
            x: bx - 4.8,
            z: bz - 3.5,
            width: 13.0,
            depth: 14.5,
            height: 9.5,
            style: 'factory',
            primaryColor: 0x8f949a,
            accentColor: 0xeab308,
          },
          { name: 'Helios Clean Energy Plant', category: 'industrial', subtype: 'factory', doorStyle: 'industrial' },
        );
        addCityBuilding(
          {
            id: 'c4_cargo_warehouse',
            x: bx + 6.8,
            z: bz + 3.5,
            width: 9.4,
            depth: 13.5,
            height: 7.5,
            style: 'warehouse',
            primaryColor: 0x747b82,
            accentColor: 0xb45309,
          },
          { name: 'South Coast Depot', category: 'industrial', subtype: 'warehouse', doorStyle: 'industrial' },
        );
      } else if (bx === -21 && bz === 325) {
        addCityBuilding(
          {
            id: 'c4_horizon_corp',
            x: bx - 5.4,
            z: bz - 2.5,
            width: 12.2,
            depth: 14.5,
            height: 25,
            style: 'office',
            primaryColor: 0xe8dfd2,
            accentColor: 0xd97706,
            hasSetback: true,
          },
          { name: 'Golden Horizon Corporate', category: 'business', subtype: 'corporate', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c4_bayfront_diner',
            x: bx + 7.0,
            z: bz + 4.5,
            width: 9.5,
            depth: 10.5,
            height: 6.2,
            style: 'restaurant',
            primaryColor: 0xf4e8d8,
            accentColor: 0xf97316,
            hasAwning: true,
          },
          { name: 'Horizon Bay Diner', category: 'commercial', subtype: 'restaurant', doorStyle: 'glass_double' },
        );
      } else if (bx === 21 && bz === 325) {
        addCityBuilding(
          {
            id: 'c4_coral_flats',
            x: bx - 5.2,
            z: bz - 3.0,
            width: 11.0,
            depth: 13.0,
            height: 14.0,
            style: 'apartment',
            primaryColor: 0xebe3d5,
            accentColor: 0xeab308,
          },
          { name: 'Coral Sunset Flats', category: 'residential', subtype: 'apartment', doorStyle: 'glass_double' },
        );
        addCityBuilding(
          {
            id: 'c4_amber_coffee',
            x: bx + 6.5,
            z: bz + 4.5,
            width: 9.2,
            depth: 9.6,
            height: 5.4,
            style: 'restaurant',
            primaryColor: 0xf5e9da,
            accentColor: 0xb45309,
            hasAwning: true,
          },
          { name: 'Amber Wave Roastery', category: 'commercial', subtype: 'cafe', doorStyle: 'storefront' },
        );
      } else if (bx === 63 && bz === 325) {
        addCityBuilding(
          {
            id: 'c4_south_logistics',
            x: bx - 5.4,
            z: bz - 3.5,
            width: 11.2,
            depth: 13.0,
            height: 7.8,
            style: 'warehouse',
            primaryColor: 0x767d85,
            accentColor: 0xd97706,
          },
          { name: 'Southern Port Logistics', category: 'industrial', subtype: 'warehouse', doorStyle: 'industrial' },
        );
        addCityBuilding(
          {
            id: 'c4_solar_workshop',
            x: bx + 6.6,
            z: bz + 3.5,
            width: 9.6,
            depth: 12.0,
            height: 7.6,
            style: 'workshop',
            primaryColor: 0x80858c,
            accentColor: 0xeab308,
          },
          { name: 'Solar EV Garage', category: 'industrial', subtype: 'workshop', doorStyle: 'industrial' },
        );
      } else {
        addResidentialHouseQuad(
          `c4_${ix}_${iz}`,
          bx,
          bz,
          'Suncrest',
          [0xf7f1e5, 0xede4d5, 0xf2e8d8, 0xe8e2d8],
          [0xd97706, 0xb45309, 0x0f766e, 0x9a3412],
        );
      }
    }
  }

  // =========================================================================
  // 4 INTERNATIONAL AIRPORTS (100% ENTERABLE TERMINALS + BOARDABLE JETS)
  // =========================================================================
  const airports: AirportSpec[] = [
    {
      id: 'airport_liberty',
      cityId: 'liberty_metro',
      name: 'Liberty International Airport',
      code: 'LBY',
      terminalBuildingId: 'airport_liberty_terminal',
      centerX: -148,
      centerZ: -142,
      apronMinX: -214,
      apronMaxX: -84,
      apronMinZ: -172,
      apronMaxZ: -112,
      runwayStartX: -206,
      runwayEndX: -92,
      runwayZ: -134,
      gateJetX: -152,
      gateJetZ: -145,
      gateJetYaw: 0.28,
      arrivalSpawnX: -154,
      arrivalSpawnZ: -148,
      arrivalSpawnYaw: Math.PI,
      connectorRects: [
        { minX: -89, maxX: -79, minZ: -130, maxZ: -84 },
        { minX: -170, maxX: -79, minZ: -132, maxZ: -120 },
      ],
    },
    {
      id: 'airport_emerald',
      cityId: 'emerald_bay',
      name: 'Emerald Bay International Airport',
      code: 'EMB',
      terminalBuildingId: 'airport_emerald_terminal',
      centerX: 438,
      centerZ: -20,
      apronMinX: 382,
      apronMaxX: 496,
      apronMinZ: -64,
      apronMaxZ: 14,
      runwayStartX: 392,
      runwayEndX: 488,
      runwayZ: -2,
      gateJetX: 438,
      gateJetZ: -20,
      gateJetYaw: 0.2,
      arrivalSpawnX: 432,
      arrivalSpawnZ: -31,
      arrivalSpawnYaw: Math.PI,
      connectorRects: [{ minX: 368, maxX: 395, minZ: -5, maxZ: 5 }],
    },
    {
      id: 'airport_highland',
      cityId: 'aero_highland',
      name: 'Highland Aero International Airport',
      code: 'HLD',
      terminalBuildingId: 'airport_highland_terminal',
      centerX: -152,
      centerZ: -306,
      apronMinX: -214,
      apronMaxX: -94,
      apronMinZ: -350,
      apronMaxZ: -270,
      runwayStartX: -204,
      runwayEndX: -102,
      runwayZ: -288,
      gateJetX: -150,
      gateJetZ: -307,
      gateJetYaw: 0.22,
      arrivalSpawnX: -152,
      arrivalSpawnZ: -318,
      arrivalSpawnYaw: Math.PI,
      connectorRects: [{ minX: -115, maxX: -84, minZ: -309, maxZ: -299 }],
    },
    {
      id: 'airport_golden',
      cityId: 'golden_horizon',
      name: 'Golden Horizon International Airport',
      code: 'GZH',
      terminalBuildingId: 'airport_golden_terminal',
      centerX: -152,
      centerZ: 274,
      apronMinX: -214,
      apronMaxX: -94,
      apronMinZ: 228,
      apronMaxZ: 312,
      runwayStartX: -204,
      runwayEndX: -102,
      runwayZ: 296,
      gateJetX: -150,
      gateJetZ: 278,
      gateJetYaw: 0.24,
      arrivalSpawnX: -152,
      arrivalSpawnZ: 260,
      arrivalSpawnYaw: Math.PI,
      connectorRects: [{ minX: -115, maxX: -84, minZ: 257, maxZ: 267 }],
    },
  ];

  // Enterable Airport Terminals + ATC & Hangar colliders
  addCityBuilding(
    {
      id: 'airport_liberty_terminal',
      x: -154,
      z: -158,
      width: 36,
      depth: 14,
      height: 9,
      style: 'airport_terminal',
      primaryColor: 0xe2e8f0,
      accentColor: 0x0284c7,
      hasAwning: true,
    },
    {
      name: 'Liberty International Terminal',
      category: 'business',
      subtype: 'airport_terminal',
      doorSide: 'south',
      doorStyle: 'glass_double',
    },
  );
  pushCollider(colliders, 'ap_lby_atc', -182, -158, 6.2, 6.2, 0, 26, 'building', true);
  pushCollider(colliders, 'ap_lby_hangar', -114, -156, 22, 18, 0, 10, 'building', true);

  addCityBuilding(
    {
      id: 'airport_emerald_terminal',
      x: 432,
      z: -48,
      width: 36,
      depth: 14,
      height: 9,
      style: 'airport_terminal',
      primaryColor: 0xe2f0ec,
      accentColor: 0x0d9488,
      hasAwning: true,
    },
    {
      name: 'Emerald Bay Airport Terminal',
      category: 'business',
      subtype: 'airport_terminal',
      doorSide: 'south',
      doorStyle: 'glass_double',
    },
  );
  pushCollider(colliders, 'ap_emb_atc', 404, -48, 6.2, 6.2, 0, 26, 'building', true);
  pushCollider(colliders, 'ap_emb_hangar', 472, -46, 22, 18, 0, 10, 'building', true);

  addCityBuilding(
    {
      id: 'airport_highland_terminal',
      x: -152,
      z: -334,
      width: 36,
      depth: 14,
      height: 9,
      style: 'airport_terminal',
      primaryColor: 0xe5ebf5,
      accentColor: 0x2563eb,
      hasAwning: true,
    },
    {
      name: 'Highland Aero Terminal',
      category: 'business',
      subtype: 'airport_terminal',
      doorSide: 'south',
      doorStyle: 'glass_double',
    },
  );
  pushCollider(colliders, 'ap_hld_atc', -180, -334, 6.2, 6.2, 0, 26, 'building', true);
  pushCollider(colliders, 'ap_hld_hangar', -112, -332, 22, 18, 0, 10, 'building', true);

  addCityBuilding(
    {
      id: 'airport_golden_terminal',
      x: -152,
      z: 242,
      width: 36,
      depth: 14,
      height: 9,
      style: 'airport_terminal',
      primaryColor: 0xf4ede0,
      accentColor: 0xd97706,
      hasAwning: true,
    },
    {
      name: 'Golden Horizon Terminal',
      category: 'business',
      subtype: 'airport_terminal',
      doorSide: 'south',
      doorStyle: 'glass_double',
    },
  );
  pushCollider(colliders, 'ap_gzh_atc', -180, 242, 6.2, 6.2, 0, 26, 'building', true);
  pushCollider(colliders, 'ap_gzh_hangar', -112, 244, 22, 18, 0, 10, 'building', true);

  // Coastline & Outer Water Barriers (bridges, beach, coastal pier & marina boat ramps stay open!)
  // City 1 East coast: wharf (z -85..-14), East bridge opening (z -7..7), open ocean beach & pier (z 7..94)
  pushCollider(colliders, 'sea_c1_e_top', 95.3, -90.5, 0.8, 9.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c1_e_mid', 95.3, -10.5, 0.8, 6.5, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c1_wharf_e', 103.3, -50.0, 0.8, 72.0, 0, 4, 'barrier', false);
  // City 1 North coast (open at x -7..7 for North Bridge and x -89..-79 for Liberty Airport road)
  pushCollider(colliders, 'sea_c1_n_e', 51.0, -95.2, 87.5, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c1_n_w1', -43.0, -95.2, 71.5, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c1_n_w2', -92.0, -95.2, 6.0, 0.8, 0, 4, 'barrier', false);
  // City 1 West & South coast (South coast split cleanly around x -7..7 for Golden Sunset Bridge)
  pushCollider(colliders, 'sea_c1_w', -95.5, 0, 0.8, 191, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c1_s_w', -51.25, 95.2, 88.5, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c1_s_e', 57.5, 95.2, 101.0, 0.8, 0, 4, 'barrier', false);

  // City 2 (Emerald Bay) perimeter seawalls (open at East Bridge z=-7..7, Marina Ramp z=22..44, & East Airport x=382 z=-5..5)
  pushCollider(colliders, 'sea_c2_w_n', 233.0, -51.0, 0.8, 87.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c2_w_s1', 233.0, 14.5, 0.8, 15.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c2_w_s2', 233.0, 69.5, 0.8, 51.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c2_n', 307.5, -95.2, 150.0, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c2_s', 307.5, 95.2, 150.0, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c2_e_n', 382.0, -50.5, 0.8, 89.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c2_e_s', 382.0, 50.5, 0.8, 89.0, 0, 4, 'barrier', false);

  // City 3 (Aero Highland) perimeter seawalls (open at South z=-210 x=-7..7 for North Bridge & West x=-95 z=-309..-299 for Airport)
  pushCollider(colliders, 'sea_c3_s_w', -51.0, -210.0, 87.5, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c3_s_e', 51.0, -210.0, 87.5, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c3_n', 0.0, -358.0, 191.0, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c3_e', 95.5, -284.0, 0.8, 149.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c3_w_s', -95.5, -254.0, 0.8, 89.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c3_w_n', -95.5, -334.0, 0.8, 49.0, 0, 4, 'barrier', false);

  // City 4 (Golden Horizon) perimeter seawalls (open at North z=210 x=-7..7 for South Bridge & West x=-95.5 z=257..267 for Airport)
  pushCollider(colliders, 'sea_c4_n_w', -51.25, 210.0, 88.5, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c4_n_e', 51.25, 210.0, 88.5, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c4_s', 0.0, 358.0, 191.0, 0.8, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c4_e', 95.5, 284.0, 0.8, 149.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c4_w_n', -95.5, 233.5, 0.8, 47.0, 0, 4, 'barrier', false);
  pushCollider(colliders, 'sea_c4_w_s', -95.5, 312.5, 0.8, 91.0, 0, 4, 'barrier', false);

  // Landmarks for City 2, City 3, City 4, Bridges, Airports & Coral Reef Dive Site
  landmarks.push(
    { id: 'lm_underwater_reef', label: 'Coral Reef & Shipwreck', shortCode: 'UW', district: 'coastal', x: 165, z: 58, color: '#06b6d4' },
    { id: 'lm_bridge_eh', label: 'Grand Harbor Bridge', shortCode: 'BR', district: 'bridge', x: 165, z: 0, color: '#38bdf8' },
    { id: 'lm_bridge_ns', label: 'Northern Skyway Bridge', shortCode: 'BR', district: 'bridge', x: 0, z: -155, color: '#f59e0b' },
    { id: 'lm_bridge_ls', label: 'Golden Sunset Bridge', shortCode: 'BR', district: 'bridge', x: 0, z: 155, color: '#f97316' },
    { id: 'lm_c2_tower', label: 'Emerald Sky Tower', shortCode: 'ET', district: 'bay_marina', x: 301, z: -25, color: '#10b981' },
    { id: 'lm_c2_mall', label: 'Marina Harbor Mall', shortCode: 'MM', district: 'bay_marina', x: 263, z: -21, color: '#22d3ee' },
    { id: 'lm_c2_airport', label: 'Emerald Bay Airport', shortCode: 'AP', district: 'airport', x: 432, z: -20, color: '#a78bfa' },
    { id: 'lm_c3_obs', label: 'Aero Observatory', shortCode: 'AO', district: 'highland_tech', x: -25, z: -287, color: '#38bdf8' },
    { id: 'lm_c3_mall', label: 'Skyline Atrium Mall', shortCode: 'SM', district: 'highland_tech', x: 21, z: -283, color: '#60a5fa' },
    { id: 'lm_c3_airport', label: 'Highland Aero Airport', shortCode: 'AP', district: 'airport', x: -152, z: -306, color: '#a78bfa' },
    { id: 'lm_c4_spire', label: 'Golden Horizon Spire', shortCode: 'GS', district: 'suncrest_bay', x: -25, z: 279, color: '#eab308' },
    { id: 'lm_c4_mall', label: 'Suncrest Galleria Mall', shortCode: 'SG', district: 'suncrest_bay', x: 21, z: 280, color: '#f97316' },
    { id: 'lm_c4_airport', label: 'Golden Horizon Airport', shortCode: 'AP', district: 'airport', x: -152, z: 276, color: '#a78bfa' },
  );

  // Additional Rooftops for City 2, City 3 & City 4 iconic towers
  const extraRooftops: RooftopSpec[] = [
    {
      id: 'roof_emerald_tower',
      buildingId: 'c2_emerald_tower',
      name: 'Emerald Skydeck & Helipad',
      minX: 301 - 6.75,
      maxX: 301 + 6.75,
      minZ: -25 - 6.75,
      maxZ: -25 + 6.75,
      y: SIDEWALK_HEIGHT + 44,
      theme: 'helipad_skydeck',
      hasHelipad: true,
      hasGarden: true,
      hasTelescopes: true,
      interiorAccessDoor: { x: 304.8, z: -28.6, yaw: 0, targetFloor: 22 },
      props: [
        { id: 'rt_et_stair', kind: 'stairhouse', x: 304.8, z: -30.3, width: 3.2, depth: 2.8, height: 3.0, color: 0x0f766e },
        { id: 'rt_et_tele', kind: 'telescope', x: 296.0, z: -19.8, width: 0.7, depth: 0.7, height: 1.35, rotY: 0 },
        { id: 'rt_et_bench', kind: 'bench', x: 303.5, z: -20.2, width: 2.0, depth: 0.75, height: 0.85, rotY: Math.PI, vaultable: true },
      ],
    },
    {
      id: 'roof_aero_observatory',
      buildingId: 'c3_aero_observatory',
      name: 'Aero Observatory Skydeck',
      minX: -25.2 - 6.75,
      maxX: -25.2 + 6.75,
      minZ: -287 - 6.75,
      maxZ: -287 + 6.75,
      y: SIDEWALK_HEIGHT + 48,
      theme: 'helipad_skydeck',
      hasHelipad: true,
      hasGarden: true,
      hasTelescopes: true,
      interiorAccessDoor: { x: -21.0, z: -290.6, yaw: 0, targetFloor: 22 },
      props: [
        { id: 'rt_ao_stair', kind: 'stairhouse', x: -21.0, z: -292.3, width: 3.2, depth: 2.8, height: 3.0, color: 0x1e40af },
        { id: 'rt_ao_tele', kind: 'telescope', x: -29.8, z: -281.8, width: 0.7, depth: 0.7, height: 1.35, rotY: 0 },
        { id: 'rt_ao_bench', kind: 'bench', x: -22.2, z: -282.2, width: 2.0, depth: 0.75, height: 0.85, rotY: Math.PI, vaultable: true },
      ],
    },
    {
      id: 'roof_golden_spire',
      buildingId: 'c4_golden_spire',
      name: 'Golden Spire Skydeck',
      minX: -25.2 - 6.75,
      maxX: -25.2 + 6.75,
      minZ: 279.0 - 6.75,
      maxZ: 279.0 + 6.75,
      y: SIDEWALK_HEIGHT + 46,
      theme: 'helipad_skydeck',
      hasHelipad: true,
      hasGarden: true,
      hasTelescopes: true,
      interiorAccessDoor: { x: -21.0, z: 275.4, yaw: 0, targetFloor: 22 },
      props: [
        { id: 'rt_gs_stair', kind: 'stairhouse', x: -21.0, z: 273.7, width: 3.2, depth: 2.8, height: 3.0, color: 0xb45309 },
        { id: 'rt_gs_tele', kind: 'telescope', x: -29.8, z: 284.2, width: 0.7, depth: 0.7, height: 1.35, rotY: 0 },
        { id: 'rt_gs_bench', kind: 'bench', x: -22.2, z: 283.8, width: 2.0, depth: 0.75, height: 0.85, rotY: Math.PI, vaultable: true },
      ],
    },
  ];
  for (const roof of extraRooftops) {
    rooftops.push(roof);
    addPerimeterRailings(roof.id, roof.minX, roof.maxX, roof.minZ, roof.maxZ, roof.y);
    for (const prop of roof.props) {
      if (prop.kind === 'stairhouse' || prop.kind === 'bench') {
        pushCollider(
          colliders,
          prop.id,
          prop.x,
          prop.z,
          prop.width,
          prop.depth,
          roof.y,
          roof.y + prop.height,
          prop.kind === 'stairhouse' ? 'building' : 'prop',
          prop.kind === 'stairhouse',
          Boolean(prop.vaultable),
        );
      }
    }
  }

  // NPC pedestrian loops in City 2, City 3 & City 4
  npcLoops.push(
    {
      id: 'loop_c2_plaza',
      points: [
        { x: 249.2, z: -7.2 },
        { x: 276.8, z: -7.2 },
        { x: 276.8, z: -34.8 },
        { x: 249.2, z: -34.8 },
      ],
    },
    {
      id: 'loop_c2_lagoon',
      points: [
        { x: 291.2, z: 7.2 },
        { x: 318.8, z: 7.2 },
        { x: 318.8, z: 34.8 },
        { x: 291.2, z: 34.8 },
      ],
    },
    {
      id: 'loop_c3_campus',
      points: [
        { x: -34.8, z: -269.2 },
        { x: -7.2, z: -269.2 },
        { x: -7.2, z: -296.8 },
        { x: -34.8, z: -296.8 },
      ],
    },
    {
      id: 'loop_c3_park',
      points: [
        { x: -34.8, z: -227.2 },
        { x: -7.2, z: -227.2 },
        { x: -7.2, z: -254.8 },
        { x: -34.8, z: -254.8 },
      ],
    },
    {
      id: 'loop_c4_park',
      points: [
        { x: -34.8, z: 227.2 },
        { x: -7.2, z: 227.2 },
        { x: -7.2, z: 254.8 },
        { x: -34.8, z: 254.8 },
      ],
    },
    {
      id: 'loop_c4_promenade',
      points: [
        { x: 7.2, z: 269.2 },
        { x: 34.8, z: 269.2 },
        { x: 34.8, z: 296.8 },
        { x: 7.2, z: 296.8 },
      ],
    },
  );

  return {
    bounds: { minX: -240, maxX: 520, minZ: -380, maxZ: 380 },
    spawn: { x: 0, y: 0, z: 16, yaw: 0 },
    roadCenters: ROAD_CENTERS,
    roadWidth: ROAD_WIDTH,
    sidewalkWidth: SIDEWALK_WIDTH,
    sidewalkHeight: SIDEWALK_HEIGHT,
    cities,
    bridges,
    airports,
    blocks,
    buildings,
    houses,
    entrances,
    parkedVehicles,
    containers,
    trafficSigns,
    trees,
    lamps,
    benches,
    fountains,
    landmarks,
    npcLoops,
    ladders,
    rooftops,
    colliders,
  };
}

export const CITY_LAYOUT: CityLayout = createCityLayout();

export function getSingleBridgeHeight(alongPos: number, b: BridgeSpec): number {
  const dStart = alongPos - b.start;
  const dEnd = b.end - alongPos;
  if (dStart <= 0 || dEnd <= 0) return 0;
  if (dStart < b.rampLength) {
    const t = dStart / b.rampLength;
    return b.deckHeight * (t * t * (3 - 2 * t));
  }
  if (dEnd < b.rampLength) {
    const t = dEnd / b.rampLength;
    return b.deckHeight * (t * t * (3 - 2 * t));
  }
  return b.deckHeight;
}

export function getCityAt(
  x: number,
  z: number,
  layout: CityLayout = CITY_LAYOUT,
): CityZoneSpec {
  if (x >= 185) {
    return layout.cities.find((c) => c.id === 'emerald_bay') || layout.cities[0];
  }
  if (z <= -185) {
    return layout.cities.find((c) => c.id === 'aero_highland') || layout.cities[0];
  }
  if (z >= 185) {
    return layout.cities.find((c) => c.id === 'golden_horizon') || layout.cities[0];
  }
  return layout.cities[0];
}

export function isOnBridgeSurface(
  x: number,
  z: number,
  referenceY = 0,
  layout: CityLayout = CITY_LAYOUT,
): boolean {
  if (referenceY < -0.15) return false;
  for (let i = 0; i < layout.bridges.length; i++) {
    const br = layout.bridges[i];
    const halfSpan = br.roadWidth * 0.5 + br.sidewalkWidth;
    if (br.axis === 'x') {
      if (x >= br.start && x <= br.end && Math.abs(z - br.crossCenter) <= halfSpan) {
        return true;
      }
    } else if (z >= br.start && z <= br.end && Math.abs(x - br.crossCenter) <= halfSpan) {
      return true;
    }
  }
  return false;
}

export function isOverDryLand(
  x: number,
  z: number,
  layout: CityLayout = CITY_LAYOUT,
): boolean {
  // Coastal Tourist Pier
  if (x >= 95 && x <= 118.5 && z >= 39 && z <= 45) return true;
  // Harbor Industrial Wharf
  if (x >= 89 && x <= 103.5 && z >= -86 && z <= -14) return true;
  // Upper sandy beach above shoreline
  if (x > 95 && x <= 107.8 && z >= -6 && z <= 94) return true;
  // Airport aprons & connector roads
  for (let i = 0; i < layout.airports.length; i++) {
    const ap = layout.airports[i];
    if (x >= ap.apronMinX - 2 && x <= ap.apronMaxX + 2 && z >= ap.apronMinZ - 2 && z <= ap.apronMaxZ + 2) {
      return true;
    }
    for (let j = 0; j < ap.connectorRects.length; j++) {
      const r = ap.connectorRects[j];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
    }
  }
  // City islands
  for (let i = 0; i < layout.cities.length; i++) {
    const c = layout.cities[i];
    if (x >= c.landMinX - 2 && x <= c.landMaxX + 2 && z >= c.landMinZ - 2 && z <= c.landMaxZ + 2) {
      return true;
    }
  }
  return false;
}

export function getSeabedHeightAt(x: number, z: number): number {
  // Gentle continental shelf off Liberty Metro beach (x = 107..136, z = -8..96)
  if (x >= 107 && x <= 136 && z >= -8 && z <= 96) {
    const t = Math.max(0, Math.min(1, (x - 107) / 29));
    const smoothT = t * t * (3 - 2 * t);
    return -0.35 + smoothT * (OCEAN_SEABED_Y + 0.35);
  }
  // Gentle marina shelf off Emerald Bay west ramp (x = 206..233, z = 18..48)
  if (x >= 206 && x <= 233 && z >= 18 && z <= 48) {
    const t = Math.max(0, Math.min(1, (233 - x) / 27));
    const smoothT = t * t * (3 - 2 * t);
    return -0.35 + smoothT * (OCEAN_SEABED_Y + 0.35);
  }
  // Open ocean seabed with gentle natural sand ripples
  return OCEAN_SEABED_Y + Math.sin(x * 0.045) * Math.cos(z * 0.045) * 0.45;
}

export interface WaterQueryResult {
  inWater: boolean;
  isSubmerged: boolean;
  waterSurfaceY: number;
  seabedY: number;
  depth: number;
}

export function getWaterInfoAt(
  x: number,
  z: number,
  referenceY = 0,
  layout: CityLayout = CITY_LAYOUT,
): WaterQueryResult {
  if (isOnBridgeSurface(x, z, referenceY, layout)) {
    return { inWater: false, isSubmerged: false, waterSurfaceY: WATER_SURFACE_Y, seabedY: OCEAN_SEABED_Y, depth: 0 };
  }
  // Standing on pier / wharf / dry beach / city islands above water
  if (x >= 95 && x <= 118.5 && z >= 39 && z <= 45 && referenceY >= -0.08) {
    return { inWater: false, isSubmerged: false, waterSurfaceY: WATER_SURFACE_Y, seabedY: OCEAN_SEABED_Y, depth: 0 };
  }
  if (x >= 89 && x <= 103.5 && z >= -86 && z <= -14 && referenceY >= -0.08) {
    return { inWater: false, isSubmerged: false, waterSurfaceY: WATER_SURFACE_Y, seabedY: OCEAN_SEABED_Y, depth: 0 };
  }
  if (x > 95 && x <= 107.8 && z >= -6 && z <= 94) {
    const t = Math.max(0, Math.min(1, (x - 95) / 14));
    const beachY = 0.06 - t * 0.42;
    const depth = Math.max(0, WATER_SURFACE_Y - beachY);
    return {
      inWater: depth > 0.12 && referenceY <= WATER_SURFACE_Y + 0.35,
      isSubmerged: false,
      waterSurfaceY: WATER_SURFACE_Y,
      seabedY: beachY,
      depth,
    };
  }
  if (isOverDryLand(x, z, layout)) {
    return { inWater: false, isSubmerged: false, waterSurfaceY: WATER_SURFACE_Y, seabedY: 0, depth: 0 };
  }
  const seabedY = getSeabedHeightAt(x, z);
  const depth = Math.max(0, WATER_SURFACE_Y - seabedY);
  const inWater = depth > 0.15 && referenceY <= WATER_SURFACE_Y + 0.4;
  const isSubmerged = inWater && referenceY < WATER_SURFACE_Y - 0.85;
  return { inWater, isSubmerged, waterSurfaceY: WATER_SURFACE_Y, seabedY, depth };
}

export function getGroundHeightAt(
  x: number,
  z: number,
  layout: CityLayout = CITY_LAYOUT,
  currentY?: number,
): number {
  if (typeof currentY === 'number') {
    for (let i = 0; i < layout.rooftops.length; i++) {
      const r = layout.rooftops[i];
      if (
        currentY >= r.y - 1.35 &&
        x >= r.minX - 0.3 &&
        x <= r.maxX + 0.3 &&
        z >= r.minZ - 0.3 &&
        z <= r.maxZ + 0.3
      ) {
        return r.y;
      }
    }
  }

  // Bridges (evaluate before beaches/ocean so ramps & spans sit smoothly above water — unless swimming below!)
  if (currentY === undefined || currentY >= -0.25) {
    for (let i = 0; i < layout.bridges.length; i++) {
      const br = layout.bridges[i];
      const halfSpan = br.roadWidth * 0.5 + br.sidewalkWidth;
      if (br.axis === 'x') {
        if (x >= br.start && x <= br.end && Math.abs(z - br.crossCenter) <= halfSpan) {
          const deckY = getSingleBridgeHeight(x, br);
          const onSidewalk = Math.abs(z - br.crossCenter) > br.roadWidth * 0.5;
          return onSidewalk ? deckY + layout.sidewalkHeight : deckY;
        }
      } else {
        if (z >= br.start && z <= br.end && Math.abs(x - br.crossCenter) <= halfSpan) {
          const deckY = getSingleBridgeHeight(z, br);
          const onSidewalk = Math.abs(x - br.crossCenter) > br.roadWidth * 0.5;
          return onSidewalk ? deckY + layout.sidewalkHeight : deckY;
        }
      }
    }
  }

  // Coastal Tourist Pier (x = 95..118.5, z in [39..45]) sits above water at sidewalkHeight
  if (x >= 95 && x <= 118.5 && z >= 39 && z <= 45 && (currentY === undefined || currentY >= -0.25)) {
    return layout.sidewalkHeight + 0.04;
  }

  // Harbor Industrial Wharf (x = 89..103, z in [-86..-14])
  if (x >= 89 && x <= 103.5 && z >= -86 && z <= -14) {
    return layout.sidewalkHeight;
  }

  // Coastal Sandy Beach sloping gently from seawall (x=95, y=0.06) down to shoreline (x=108, y=-0.35)
  if (x > 95 && x <= 107.8 && z >= -6 && z <= 94) {
    const t = Math.max(0, Math.min(1, (x - 95) / 14));
    return 0.06 - t * 0.42;
  }

  // Airport aprons & connector roads sit cleanly at ground y = 0 (or sidewalkHeight under terminals)
  for (let i = 0; i < layout.airports.length; i++) {
    const ap = layout.airports[i];
    if (x >= ap.apronMinX - 2 && x <= ap.apronMaxX + 2 && z >= ap.apronMinZ - 2 && z <= ap.apronMaxZ + 2) {
      return 0;
    }
    for (let j = 0; j < ap.connectorRects.length; j++) {
      const r = ap.connectorRects[j];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        return 0;
      }
    }
  }

  // City road grids & block sidewalks
  const halfRoad = layout.roadWidth * 0.5;
  for (let i = 0; i < layout.cities.length; i++) {
    const c = layout.cities[i];
    if (x >= c.landMinX - 2 && x <= c.landMaxX + 2 && z >= c.landMinZ - 2 && z <= c.landMaxZ + 2) {
      for (const rx of c.roadCentersX) {
        if (Math.abs(x - rx) < halfRoad) return 0;
      }
      for (const rz of c.roadCentersZ) {
        if (Math.abs(z - rz) < halfRoad) return 0;
      }
      return layout.sidewalkHeight;
    }
  }

  // Open ocean seabed floor
  return getSeabedHeightAt(x, z);
}

export function getDistrictAt(
  x: number,
  z: number,
  layout: CityLayout = CITY_LAYOUT,
): { id: DistrictId; name: string } {
  for (const br of layout.bridges) {
    const halfSpan = br.roadWidth * 0.5 + br.sidewalkWidth + 0.5;
    if (br.axis === 'x') {
      if (x >= br.start && x <= br.end && Math.abs(z - br.crossCenter) <= halfSpan) {
        return { id: 'bridge', name: br.name };
      }
    } else if (z >= br.start && z <= br.end && Math.abs(x - br.crossCenter) <= halfSpan) {
      return { id: 'bridge', name: br.name };
    }
  }

  for (const ap of layout.airports) {
    if (x >= ap.apronMinX && x <= ap.apronMaxX && z >= ap.apronMinZ && z <= ap.apronMaxZ) {
      return { id: 'airport', name: ap.name };
    }
  }

  // City 1 east waterfront (wharf & beach)
  if (x > 89 && x < 130 && z >= -95 && z <= 95) {
    if (z < -8) {
      return { id: 'industrial', name: DISTRICT_LABELS.industrial };
    }
    return { id: 'coastal', name: DISTRICT_LABELS.coastal };
  }

  let closestBlock: BlockZone | null = null;
  let minDist = Infinity;
  for (const b of layout.blocks) {
    const dx = Math.abs(x - b.cx);
    const dz = Math.abs(z - b.cz);
    if (Math.max(dx, dz) <= b.size * 0.5 + 3) {
      const d = dx * dx + dz * dz;
      if (d < minDist) {
        minDist = d;
        closestBlock = b;
      }
    }
  }
  if (closestBlock) {
    return { id: closestBlock.district, name: closestBlock.label };
  }
  return { id: 'avenue', name: DISTRICT_LABELS.avenue };
}

export function resolveCircleAABBCollision(
  x: number,
  z: number,
  radius: number,
  playerY: number,
  playerHeight: number,
  layout: CityLayout = CITY_LAYOUT,
  skipColliderId?: string | null,
): { x: number; z: number; collided: boolean } {
  let nx = Math.max(layout.bounds.minX + radius, Math.min(layout.bounds.maxX - radius, x));
  let nz = Math.max(layout.bounds.minZ + radius, Math.min(layout.bounds.maxZ - radius, z));
  let collided = nx !== x || nz !== z;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < layout.colliders.length; i++) {
      const box = layout.colliders[i];
      if (skipColliderId && box.id === skipColliderId) {
        continue;
      }
      if (box.maxY <= playerY + 0.12 || box.minY >= playerY + playerHeight) {
        continue;
      }
      const closestX = Math.max(box.minX, Math.min(nx, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(nz, box.maxZ));
      const dx = nx - closestX;
      const dz = nz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        collided = true;
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          nx += (dx / dist) * push;
          nz += (dz / dist) * push;
        } else {
          const penLeft = Math.abs(nx - box.minX);
          const penRight = Math.abs(box.maxX - nx);
          const penTop = Math.abs(nz - box.minZ);
          const penBottom = Math.abs(box.maxZ - nz);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) nx = box.minX - radius;
          else if (minPen === penRight) nx = box.maxX + radius;
          else if (minPen === penTop) nz = box.minZ - radius;
          else nz = box.maxZ + radius;
        }
      }
    }
  }

  return { x: nx, z: nz, collided };
}

export function raycastCameraCollision(
  ox: number,
  oy: number,
  oz: number,
  tx: number,
  ty: number,
  tz: number,
  colliders: ColliderBox[],
  margin = 0.4,
): { x: number; y: number; z: number; clipped: boolean } {
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;
  const segLen = Math.hypot(dx, dy, dz);
  if (segLen < 1e-5) {
    return { x: tx, y: ty, z: tz, clipped: false };
  }

  let bestT = 1.0;

  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    if (!b.blocksCamera) continue;

    const minX = b.minX - 0.25;
    const maxX = b.maxX + 0.25;
    const minY = b.minY - 0.2;
    const maxY = b.maxY + 0.2;
    const minZ = b.minZ - 0.25;
    const maxZ = b.maxZ + 0.25;

    let tmin = 0;
    let tmax = 1;

    if (Math.abs(dx) < 1e-8) {
      if (ox < minX || ox > maxX) continue;
    } else {
      const inv = 1 / dx;
      let t1 = (minX - ox) * inv;
      let t2 = (maxX - ox) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (Math.abs(dy) < 1e-8) {
      if (oy < minY || oy > maxY) continue;
    } else {
      const inv = 1 / dy;
      let t1 = (minY - oy) * inv;
      let t2 = (maxY - oy) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (Math.abs(dz) < 1e-8) {
      if (oz < minZ || oz > maxZ) continue;
    } else {
      const inv = 1 / dz;
      let t1 = (minZ - oz) * inv;
      let t2 = (maxZ - oz) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (tmin > 0 && tmin < bestT) {
      bestT = tmin;
    }
  }

  if (bestT < 1.0) {
    const pullT = Math.max(0.05, bestT - margin / segLen);
    const minCamY = oy < WATER_SURFACE_Y ? OCEAN_SEABED_Y + 0.45 : 0.65;
    return {
      x: ox + dx * pullT,
      y: Math.max(minCamY, oy + dy * pullT),
      z: oz + dz * pullT,
      clipped: true,
    };
  }

  return { x: tx, y: ty, z: tz, clipped: false };
}
