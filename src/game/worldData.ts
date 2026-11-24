import type {
  BenchSpec,
  BlockZone,
  BuildingEntranceSpec,
  BuildingSpec,
  CityLayout,
  ColliderBox,
  ContainerSpec,
  DistrictId,
  FountainSpec,
  HouseSpec,
  LandmarkPin,
  NpcWaypointLoop,
  ParkedVehicleSpec,
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
};

const ROAD_CENTERS = [-84, -42, 0, 42, 84];
const ROAD_WIDTH = 10; // half-width = 5
const SIDEWALK_WIDTH = 3;
const SIDEWALK_HEIGHT = 0.14;
const BLOCK_CENTERS = [-63, -21, 21, 63];
const BLOCK_OUTER_SIZE = 32;

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
          hasSetback: true,
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
        pushCollider(colliders, 'dt_bench_1', bx + 6.5, bz + 1.4, 2.1, 0.75, 0, 0.9, 'prop', false);
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
        buildings.push({
          id: `dt_fin_${ix}_${iz}`,
          x: isLeft ? bx - 5.8 : bx + 5.8,
          z: bz - 2.0,
          width: 11.5,
          depth: 17.0,
          height: isLeft ? 34 : 29,
          style: 'skyscraper',
          primaryColor: isLeft ? 0xc2cfd9 : 0xd3cec4,
          accentColor: 0x345570,
          hasSetback: true,
        });
        pushCollider(
          colliders,
          `dt_fin_${ix}_${iz}`,
          isLeft ? bx - 5.8 : bx + 5.8,
          bz - 2.0,
          11.5,
          17.0,
          SIDEWALK_HEIGHT,
          SIDEWALK_HEIGHT + (isLeft ? 34 : 29),
          'building',
          true,
        );

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
  ];

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
        { x: 89.8, z: 4.0 },
        { x: 89.8, z: 78.0 },
        { x: 93.8, z: 78.0 },
        { x: 93.8, z: 4.0 },
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

  return {
    bounds: { minX: -94, maxX: 118, minZ: -94, maxZ: 94 },
    spawn: { x: 0, y: 0, z: 16, yaw: 0 },
    roadCenters: ROAD_CENTERS,
    roadWidth: ROAD_WIDTH,
    sidewalkWidth: SIDEWALK_WIDTH,
    sidewalkHeight: SIDEWALK_HEIGHT,
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
    colliders,
  };
}

export const CITY_LAYOUT: CityLayout = createCityLayout();

export function getGroundHeightAt(x: number, z: number, layout: CityLayout = CITY_LAYOUT): number {
  // Coastal Tourist Pier (x = 95..118, z in [39..45]) sits above water at sidewalkHeight
  if (x >= 95 && x <= 118.5 && z >= 39 && z <= 45) {
    return layout.sidewalkHeight + 0.04;
  }

  // Harbor Industrial Wharf (x = 89..103, z in [-86..-14])
  if (x >= 89 && x <= 103.5 && z >= -86 && z <= -14) {
    return layout.sidewalkHeight;
  }

  // Coastal Sandy Beach sloping gently from seawall (x=95, y=0.06) down to shoreline (x=108, y=-0.35)
  if (x > 95 && x <= 118 && z >= -6 && z <= 94) {
    const t = Math.max(0, Math.min(1, (x - 95) / 14));
    return 0.06 - t * 0.42;
  }

  const halfRoad = layout.roadWidth * 0.5;
  for (const rc of layout.roadCenters) {
    if (Math.abs(x - rc) < halfRoad || Math.abs(z - rc) < halfRoad) {
      return 0;
    }
  }

  if (x >= layout.bounds.minX - 2 && x <= 95.5 && z >= layout.bounds.minZ - 2 && z <= layout.bounds.maxZ + 2) {
    return layout.sidewalkHeight;
  }

  return 0;
}

export function getDistrictAt(
  x: number,
  z: number,
  layout: CityLayout = CITY_LAYOUT,
): { id: DistrictId; name: string } {
  if (x > 89) {
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
): { x: number; z: number; collided: boolean } {
  // Clamp East coastline: allow walking on Industrial Wharf (x<=102.5, z<-14),
  // Coastal Beach up to shoreline (x<=106.5, z>=-6), or Tourist Pier (x<=117.5, z in [39.5..44.5])
  let eastMax = 94.5;
  if (z >= 39.4 && z <= 44.6) {
    eastMax = 117.2;
  } else if (z >= -5 && z <= 93.5) {
    eastMax = 106.5;
  } else if (z >= -85 && z <= -15) {
    eastMax = 102.5;
  }

  let nx = Math.max(layout.bounds.minX + radius, Math.min(eastMax - radius, x));
  let nz = Math.max(layout.bounds.minZ + radius, Math.min(layout.bounds.maxZ - radius, z));
  let collided = nx !== x || nz !== z;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < layout.colliders.length; i++) {
      const box = layout.colliders[i];
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
    return {
      x: ox + dx * pullT,
      y: Math.max(0.65, oy + dy * pullT),
      z: oz + dz * pullT,
      clipped: true,
    };
  }

  return { x: tx, y: ty, z: tz, clipped: false };
}
