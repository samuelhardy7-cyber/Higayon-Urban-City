import type {
  AccessoryId,
  ChallengeDefinition,
  ChallengeStatus,
  CharacterCustomization,
  DistrictId,
  GameSettings,
  OutfitId,
  ProgressionState,
  VehicleKind,
  VehicleSpec,
  VehicleUpgradeLevels,
} from './types';
import { VEHICLE_SPECS } from './vehicleData';
import { normalizeCharacterCustomization } from './rewardShopCatalog';

export const STARTING_CASH = 350;

export const GARAGE_CATALOG = [
  {
    kind: 'sedan' as VehicleKind,
    name: 'Metro Sedan',
    price: 0,
    description: 'Balanced 4-door city cruiser with reliable handling.',
    topSpeedRating: 72,
    accelRating: 68,
    handlingRating: 76,
    defaultColor: 0x2f6a96,
  },
  {
    kind: 'motor' as VehicleKind,
    name: 'Street Moto',
    price: 450,
    description: 'Nimble street bike built for weaving through traffic.',
    topSpeedRating: 86,
    accelRating: 90,
    handlingRating: 94,
    defaultColor: 0x2299b8,
  },
  {
    kind: 'pickup' as VehicleKind,
    name: 'Ranger Pickup',
    price: 750,
    description: 'Heavy utility truck with strong chassis durability.',
    topSpeedRating: 68,
    accelRating: 65,
    handlingRating: 68,
    defaultColor: 0x3b7a52,
  },
  {
    kind: 'suv' as VehicleKind,
    name: 'Urban SUV',
    price: 900,
    description: 'High-clearance city utility vehicle with steady grip.',
    topSpeedRating: 66,
    accelRating: 64,
    handlingRating: 66,
    defaultColor: 0x3a4d5c,
  },
  {
    kind: 'sports' as VehicleKind,
    name: 'Apex GT',
    price: 1500,
    description: 'Twin-turbo street coupe with unmatched top speed.',
    topSpeedRating: 98,
    accelRating: 95,
    handlingRating: 88,
    defaultColor: 0xe04828,
  },
  {
    kind: 'jetski' as VehicleKind,
    name: 'WaveRunner Jet Ski',
    price: 650,
    description: 'Agile personal watercraft built for coastal waves.',
    topSpeedRating: 85,
    accelRating: 89,
    handlingRating: 93,
    defaultColor: 0x06b6d4,
  },
  {
    kind: 'speedboat' as VehicleKind,
    name: 'Emerald Speedboat',
    price: 1350,
    description: 'Twin-outboard ocean cruiser connecting coastal bays.',
    topSpeedRating: 94,
    accelRating: 86,
    handlingRating: 82,
    defaultColor: 0xef4444,
  },
  {
    kind: 'submarine' as VehicleKind,
    name: 'Deep Explorer Sub',
    price: 2200,
    description: 'Dive deep to coral reefs, sunken ships, and ocean trenches.',
    topSpeedRating: 66,
    accelRating: 72,
    handlingRating: 84,
    defaultColor: 0xfacc15,
  },
];

export const VEHICLE_PAINT_SWATCHES: Array<{ label: string; hex: number; css: string }> = [
  { label: 'Flame Red', hex: 0xe04828, css: '#e04828' },
  { label: 'Metro Blue', hex: 0x2f6a96, css: '#2f6a96' },
  { label: 'Cyan Pulse', hex: 0x2299b8, css: '#2299b8' },
  { label: 'Emerald', hex: 0x10b981, css: '#10b981' },
  { label: 'Sunburst', hex: 0xf59e0b, css: '#f59e0b' },
  { label: 'Violet', hex: 0x7c3aed, css: '#7c3aed' },
  { label: 'Pearl White', hex: 0xe2e8f0, css: '#e2e8f0' },
  { label: 'Obsidian', hex: 0x1e293b, css: '#1e293b' },
];

export const UPGRADE_SLOT_INFO: Record<
  keyof VehicleUpgradeLevels,
  { label: string; description: string; costs: [number, number, number] }
> = {
  engine: {
    label: 'Engine Tune',
    description: '+11% top speed & acceleration per level',
    costs: [250, 450, 750],
  },
  handling: {
    label: 'Sport Suspension',
    description: '+10% steering & brake response per level',
    costs: [200, 380, 620],
  },
  chassis: {
    label: 'Reinforced Frame',
    description: '-20% collision damage taken per level',
    costs: [200, 350, 580],
  },
};

export interface OutfitCatalogItem {
  id: OutfitId;
  label: string;
  price: number;
  defaultJacket: number;
  defaultPants: number;
  defaultShoe: number;
}

export const OUTFIT_CATALOG: OutfitCatalogItem[] = [
  {
    id: 'street_runner',
    label: 'Street Jacket',
    price: 0,
    defaultJacket: 0xc9542b,
    defaultPants: 0x26384d,
    defaultShoe: 0xf4f5f7,
  },
  {
    id: 'urban_hoodie',
    label: 'Metro Hoodie',
    price: 160,
    defaultJacket: 0x2b6cb0,
    defaultPants: 0x1f2937,
    defaultShoe: 0xf59e0b,
  },
  {
    id: 'coast_polo',
    label: 'Coastal Polo',
    price: 220,
    defaultJacket: 0x10b981,
    defaultPants: 0xd6cbb8,
    defaultShoe: 0x334155,
  },
  {
    id: 'metro_blazer',
    label: 'Downtown Blazer',
    price: 320,
    defaultJacket: 0x312e81,
    defaultPants: 0x111827,
    defaultShoe: 0x1e293b,
  },
];

export interface AccessoryCatalogItem {
  id: AccessoryId;
  label: string;
  price: number;
}

export const ACCESSORY_CATALOG: AccessoryCatalogItem[] = [
  { id: 'none', label: 'Clean Look', price: 0 },
  { id: 'backpack', label: 'Urban Daypack', price: 0 },
  { id: 'cap', label: 'Street Cap', price: 120 },
  { id: 'shades', label: 'Night Shades', price: 150 },
  { id: 'cap_backpack', label: 'Explorer Kit', price: 240 },
];

export const JACKET_COLOR_SWATCHES = [
  0xc9542b, 0x2b6cb0, 0x10b981, 0xd97706, 0x7c3aed, 0xdc2626, 0xe2e8f0, 0x1e293b,
];

export const PANTS_COLOR_SWATCHES = [
  0x26384d, 0x1f2937, 0x3f3a34, 0xd6cbb8, 0x334155, 0x111827,
];

export const SHOE_COLOR_SWATCHES = [
  0xf4f5f7, 0x1e293b, 0xf59e0b, 0xef4444, 0x38bdf8, 0x78350f,
];

export const CHALLENGE_DEFINITIONS: ChallengeDefinition[] = [
  {
    id: 'challenge_explore',
    title: 'City Explorer',
    description: 'Travel 300 m across the streets and avenues.',
    reward: 250,
    target: 300,
    unit: 'm',
  },
  {
    id: 'challenge_districts',
    title: 'District Tour',
    description: 'Explore all 4 city districts (Downtown, Residential, Industrial, Coastal).',
    reward: 450,
    target: 4,
    unit: 'districts',
  },
  {
    id: 'challenge_speed',
    title: 'Speed Runner',
    description: 'Reach 85 km/h behind the wheel.',
    reward: 300,
    target: 85,
    unit: 'km/h',
  },
  {
    id: 'challenge_mission',
    title: 'Freelance Pro',
    description: 'Complete at least 1 city mission.',
    reward: 350,
    target: 1,
    unit: 'mission',
  },
  {
    id: 'challenge_escape',
    title: 'Heat Survivor',
    description: 'Lose a police wanted pursuit safely.',
    reward: 400,
    target: 1,
    unit: 'escape',
  },
];

export function createInitialCustomization(): CharacterCustomization {
  return normalizeCharacterCustomization({
    outfitId: 'street_runner',
    jacketColor: 0xc9542b,
    pantsColor: 0x26384d,
    shoeColor: 0xf4f5f7,
    accessoryId: 'backpack',
    unlockedOutfits: ['street_runner'],
    unlockedAccessories: ['none', 'backpack'],
    backpackId: 'backpack',
    topStyle: 'jacket',
  });
}

export function createDefaultSettings(): GameSettings {
  return {
    muted: false,
    musicEnabled: true,
    timeOfDay: 'siang',
    weather: 'sunny',
    graphicsQuality: 'high',
  };
}

export function createInitialProgressionState(): ProgressionState {
  return {
    ownedVehicles: ['sedan'],
    activeGarageVehicle: 'sedan',
    vehicleColors: {
      sedan: 0x2f6a96,
      suv: 0x3a4d5c,
      sports: 0xe04828,
      pickup: 0x3b7a52,
      motor: 0x2299b8,
      jetski: 0x06b6d4,
      speedboat: 0xef4444,
      submarine: 0xfacc15,
    },
    vehicleUpgrades: {
      sedan: { engine: 0, handling: 0, chassis: 0 },
      suv: { engine: 0, handling: 0, chassis: 0 },
      sports: { engine: 0, handling: 0, chassis: 0 },
      pickup: { engine: 0, handling: 0, chassis: 0 },
      motor: { engine: 0, handling: 0, chassis: 0 },
      jetski: { engine: 0, handling: 0, chassis: 0 },
      speedboat: { engine: 0, handling: 0, chassis: 0 },
      submarine: { engine: 0, handling: 0, chassis: 0 },
    },
    customization: createInitialCustomization(),
    completedChallengeIds: [],
    visitedDistricts: [],
    topSpeedKmh: 0,
    totalDistance: 0,
    missionsCompletedCount: 0,
    wantedEscapesCount: 0,
  };
}

export function getUpgradedVehicleSpec(
  kind: VehicleKind,
  upgrades?: VehicleUpgradeLevels,
): VehicleSpec & { damageScale: number } {
  const base = VEHICLE_SPECS[kind];
  const eng = upgrades?.engine ?? 0;
  const hnd = upgrades?.handling ?? 0;
  const chs = upgrades?.chassis ?? 0;

  return {
    ...base,
    maxSpeed: base.maxSpeed * (1 + eng * 0.11),
    accel: base.accel * (1 + eng * 0.12),
    turnRate: base.turnRate * (1 + hnd * 0.1),
    brakeDecel: base.brakeDecel * (1 + hnd * 0.1),
    damageScale: Math.max(0.35, 1 - chs * 0.2),
  };
}

export function purchaseVehicle(
  money: number,
  progression: ProgressionState,
  kind: VehicleKind,
): { success: boolean; money: number; message: string } {
  if (progression.ownedVehicles.includes(kind)) {
    progression.activeGarageVehicle = kind;
    return { success: true, money, message: 'Vehicle selected from garage.' };
  }
  const item = GARAGE_CATALOG.find((g) => g.kind === kind);
  if (!item) return { success: false, money, message: 'Vehicle not found.' };
  if (money < item.price) {
    return { success: false, money, message: `Need $${item.price - money} more to buy ${item.name}.` };
  }
  const nextMoney = money - item.price;
  progression.ownedVehicles.push(kind);
  progression.activeGarageVehicle = kind;
  return { success: true, money: nextMoney, message: `Purchased ${item.name}!` };
}

export function selectGarageVehicle(
  progression: ProgressionState,
  kind: VehicleKind,
): boolean {
  if (!progression.ownedVehicles.includes(kind)) return false;
  progression.activeGarageVehicle = kind;
  return true;
}

export function purchaseVehicleUpgrade(
  money: number,
  progression: ProgressionState,
  kind: VehicleKind,
  slot: keyof VehicleUpgradeLevels,
): { success: boolean; money: number; message: string } {
  if (!progression.ownedVehicles.includes(kind)) {
    return { success: false, money, message: 'Own this vehicle first to upgrade it.' };
  }
  const levels = progression.vehicleUpgrades[kind];
  const currentLvl = levels[slot];
  if (currentLvl >= 3) {
    return { success: false, money, message: `${UPGRADE_SLOT_INFO[slot].label} is already Max Lv 3.` };
  }
  const cost = UPGRADE_SLOT_INFO[slot].costs[currentLvl];
  if (money < cost) {
    return { success: false, money, message: `Need $${cost - money} more for upgrade.` };
  }
  levels[slot] = currentLvl + 1;
  return {
    success: true,
    money: money - cost,
    message: `${UPGRADE_SLOT_INFO[slot].label} upgraded to Lv ${levels[slot]}!`,
  };
}

export function purchaseOrEquipOutfit(
  money: number,
  progression: ProgressionState,
  outfitId: OutfitId,
): { success: boolean; money: number; message: string } {
  const item = OUTFIT_CATALOG.find((o) => o.id === outfitId);
  if (!item) return { success: false, money, message: 'Outfit not found.' };
  const c = progression.customization;

  if (!c.unlockedOutfits.includes(outfitId)) {
    if (money < item.price) {
      return { success: false, money, message: `Need $${item.price - money} more for ${item.label}.` };
    }
    money -= item.price;
    c.unlockedOutfits.push(outfitId);
  }
  c.outfitId = outfitId;
  c.jacketColor = item.defaultJacket;
  c.pantsColor = item.defaultPants;
  c.shoeColor = item.defaultShoe;
  return { success: true, money, message: `Equipped ${item.label}.` };
}

export function purchaseOrEquipAccessory(
  money: number,
  progression: ProgressionState,
  accessoryId: AccessoryId,
): { success: boolean; money: number; message: string } {
  const item = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);
  if (!item) return { success: false, money, message: 'Accessory not found.' };
  const c = progression.customization;

  if (!c.unlockedAccessories.includes(accessoryId)) {
    if (money < item.price) {
      return { success: false, money, message: `Need $${item.price - money} more for ${item.label}.` };
    }
    money -= item.price;
    c.unlockedAccessories.push(accessoryId);
  }
  c.accessoryId = accessoryId;
  return { success: true, money, message: `Equipped ${item.label}.` };
}

const CORE_DISTRICTS: DistrictId[] = ['downtown', 'residential', 'industrial', 'coastal'];

export function recordVisitedDistrict(progression: ProgressionState, district: DistrictId): boolean {
  if (!CORE_DISTRICTS.includes(district)) return false;
  if (progression.visitedDistricts.includes(district)) return false;
  progression.visitedDistricts.push(district);
  return true;
}

export function getChallengeStatuses(progression: ProgressionState): ChallengeStatus[] {
  return CHALLENGE_DEFINITIONS.map((def) => {
    let rawProgress = 0;
    switch (def.id) {
      case 'challenge_explore':
        rawProgress = Math.floor(progression.totalDistance);
        break;
      case 'challenge_districts':
        rawProgress = progression.visitedDistricts.length;
        break;
      case 'challenge_speed':
        rawProgress = Math.floor(progression.topSpeedKmh);
        break;
      case 'challenge_mission':
        rawProgress = progression.missionsCompletedCount;
        break;
      case 'challenge_escape':
        rawProgress = progression.wantedEscapesCount;
        break;
    }
    const completed = progression.completedChallengeIds.includes(def.id) || rawProgress >= def.target;
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      reward: def.reward,
      progress: Math.min(def.target, rawProgress),
      target: def.target,
      unit: def.unit,
      completed,
    };
  });
}

export function evaluateChallenges(progression: ProgressionState): {
  newlyCompleted: ChallengeDefinition[];
  rewardEarned: number;
} {
  const statuses = getChallengeStatuses(progression);
  const newlyCompleted: ChallengeDefinition[] = [];
  let rewardEarned = 0;

  for (const st of statuses) {
    if (st.completed && !progression.completedChallengeIds.includes(st.id)) {
      progression.completedChallengeIds.push(st.id);
      const def = CHALLENGE_DEFINITIONS.find((d) => d.id === st.id);
      if (def) {
        newlyCompleted.push(def);
        rewardEarned += def.reward;
      }
    }
  }
  return { newlyCompleted, rewardEarned };
}

export function cloneProgression(p: ProgressionState): ProgressionState {
  return {
    ownedVehicles: [...p.ownedVehicles],
    activeGarageVehicle: p.activeGarageVehicle,
    vehicleColors: { ...p.vehicleColors },
    vehicleUpgrades: {
      sedan: { ...p.vehicleUpgrades.sedan },
      suv: { ...p.vehicleUpgrades.suv },
      sports: { ...p.vehicleUpgrades.sports },
      pickup: { ...p.vehicleUpgrades.pickup },
      motor: { ...p.vehicleUpgrades.motor },
      jetski: { ...(p.vehicleUpgrades.jetski || { engine: 0, handling: 0, chassis: 0 }) },
      speedboat: { ...(p.vehicleUpgrades.speedboat || { engine: 0, handling: 0, chassis: 0 }) },
      submarine: { ...(p.vehicleUpgrades.submarine || { engine: 0, handling: 0, chassis: 0 }) },
    },
    customization: {
      ...p.customization,
      unlockedOutfits: [...p.customization.unlockedOutfits],
      unlockedAccessories: [...p.customization.unlockedAccessories],
    },
    completedChallengeIds: [...p.completedChallengeIds],
    visitedDistricts: [...p.visitedDistricts],
    topSpeedKmh: p.topSpeedKmh,
    totalDistance: p.totalDistance,
    missionsCompletedCount: p.missionsCompletedCount,
    wantedEscapesCount: p.wantedEscapesCount,
  };
}
