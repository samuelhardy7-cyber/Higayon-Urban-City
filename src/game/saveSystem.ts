import {
  createDefaultSettings,
  createInitialCustomization,
  createInitialProgressionState,
} from './progressionSystem';
import type {
  AccessoryId,
  DistrictId,
  GraphicsQuality,
  OutfitId,
  ProgressionState,
  SaveGameData,
  TimeOfDayPhase,
  VehicleKind,
} from './types';

export const SAVE_STORAGE_KEY = 'urban_life_city_freedom_save_v1';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

const VALID_VEHICLES: VehicleKind[] = ['sedan', 'suv', 'sports', 'pickup', 'motor'];
const VALID_OUTFITS: OutfitId[] = ['street_runner', 'urban_hoodie', 'metro_blazer', 'coast_polo'];
const VALID_ACCESSORIES: AccessoryId[] = ['none', 'backpack', 'cap', 'shades', 'cap_backpack'];
const VALID_TIMES: TimeOfDayPhase[] = ['pagi', 'siang', 'sore', 'malam'];
const VALID_QUALITY: GraphicsQuality[] = ['low', 'medium', 'high'];
const VALID_DISTRICTS: DistrictId[] = ['downtown', 'residential', 'industrial', 'coastal', 'avenue'];

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

export function serializeSaveData(data: SaveGameData): string {
  return JSON.stringify(data);
}

export function parseSaveData(raw: string): SaveGameData | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SaveGameData> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return null;
    }

    const baseProg = createInitialProgressionState();
    const rawProg = (parsed.progression || {}) as Partial<ProgressionState>;

    const ownedVehicles = Array.isArray(rawProg.ownedVehicles)
      ? rawProg.ownedVehicles.filter((v): v is VehicleKind => VALID_VEHICLES.includes(v))
      : baseProg.ownedVehicles;
    if (!ownedVehicles.includes('sedan')) ownedVehicles.unshift('sedan');

    const activeGarageVehicle =
      rawProg.activeGarageVehicle && ownedVehicles.includes(rawProg.activeGarageVehicle)
        ? rawProg.activeGarageVehicle
        : ownedVehicles[0];

    const vehicleColors = { ...baseProg.vehicleColors };
    if (rawProg.vehicleColors && typeof rawProg.vehicleColors === 'object') {
      for (const k of VALID_VEHICLES) {
        const col = rawProg.vehicleColors[k];
        if (typeof col === 'number' && Number.isFinite(col)) {
          vehicleColors[k] = col & 0xffffff;
        }
      }
    }

    const vehicleUpgrades = { ...baseProg.vehicleUpgrades };
    if (rawProg.vehicleUpgrades && typeof rawProg.vehicleUpgrades === 'object') {
      for (const k of VALID_VEHICLES) {
        const up = rawProg.vehicleUpgrades[k];
        if (up && typeof up === 'object') {
          vehicleUpgrades[k] = {
            engine: clampInt(up.engine, 0, 3, 0),
            handling: clampInt(up.handling, 0, 3, 0),
            chassis: clampInt(up.chassis, 0, 3, 0),
          };
        }
      }
    }

    const baseCust = createInitialCustomization();
    const rawCust = rawProg.customization || baseCust;
    const unlockedOutfits = Array.isArray(rawCust.unlockedOutfits)
      ? rawCust.unlockedOutfits.filter((o): o is OutfitId => VALID_OUTFITS.includes(o))
      : baseCust.unlockedOutfits;
    if (!unlockedOutfits.includes('street_runner')) unlockedOutfits.unshift('street_runner');

    const unlockedAccessories = Array.isArray(rawCust.unlockedAccessories)
      ? rawCust.unlockedAccessories.filter((a): a is AccessoryId => VALID_ACCESSORIES.includes(a))
      : baseCust.unlockedAccessories;
    if (!unlockedAccessories.includes('none')) unlockedAccessories.unshift('none');
    if (!unlockedAccessories.includes('backpack')) unlockedAccessories.push('backpack');

    const customization = {
      outfitId: VALID_OUTFITS.includes(rawCust.outfitId) ? rawCust.outfitId : baseCust.outfitId,
      jacketColor:
        typeof rawCust.jacketColor === 'number' && Number.isFinite(rawCust.jacketColor)
          ? rawCust.jacketColor & 0xffffff
          : baseCust.jacketColor,
      pantsColor:
        typeof rawCust.pantsColor === 'number' && Number.isFinite(rawCust.pantsColor)
          ? rawCust.pantsColor & 0xffffff
          : baseCust.pantsColor,
      shoeColor:
        typeof rawCust.shoeColor === 'number' && Number.isFinite(rawCust.shoeColor)
          ? rawCust.shoeColor & 0xffffff
          : baseCust.shoeColor,
      accessoryId: VALID_ACCESSORIES.includes(rawCust.accessoryId)
        ? rawCust.accessoryId
        : baseCust.accessoryId,
      unlockedOutfits,
      unlockedAccessories,
    };

    const baseSettings = createDefaultSettings();
    const rawSet = parsed.settings || baseSettings;
    const settings = {
      muted: typeof rawSet.muted === 'boolean' ? rawSet.muted : baseSettings.muted,
      musicEnabled:
        typeof rawSet.musicEnabled === 'boolean' ? rawSet.musicEnabled : baseSettings.musicEnabled,
      timeOfDay: VALID_TIMES.includes(rawSet.timeOfDay) ? rawSet.timeOfDay : baseSettings.timeOfDay,
      graphicsQuality: VALID_QUALITY.includes(rawSet.graphicsQuality)
        ? rawSet.graphicsQuality
        : baseSettings.graphicsQuality,
    };

    const playerPos =
      parsed.playerPos &&
      typeof parsed.playerPos.x === 'number' &&
      typeof parsed.playerPos.z === 'number' &&
      Number.isFinite(parsed.playerPos.x) &&
      Number.isFinite(parsed.playerPos.z)
        ? {
            x: clampNum(parsed.playerPos.x, -98, 118, 0),
            y: clampNum(parsed.playerPos.y, -1, 15, 0),
            z: clampNum(parsed.playerPos.z, -98, 98, 16),
            yaw: typeof parsed.playerPos.yaw === 'number' ? parsed.playerPos.yaw : 0,
          }
        : undefined;

    const quizProgress =
      parsed.quizProgress && typeof parsed.quizProgress === 'object'
        ? {
            completedQuestionIds: Array.isArray(parsed.quizProgress.completedQuestionIds)
              ? parsed.quizProgress.completedQuestionIds.filter((id): id is string => typeof id === 'string')
              : [],
            lockedQuestionIds: Array.isArray(parsed.quizProgress.lockedQuestionIds)
              ? parsed.quizProgress.lockedQuestionIds.filter((id): id is string => typeof id === 'string')
              : [],
            earnedPoints: clampInt(parsed.quizProgress.earnedPoints, 0, 9_999_999, 0),
          }
        : undefined;

    return {
      version: 1,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      money: clampInt(parsed.money, 0, 9_999_999, 350),
      health: clampInt(parsed.health, 10, 100, 100),
      completedMissionIds: Array.isArray(parsed.completedMissionIds)
        ? parsed.completedMissionIds.filter((id): id is string => typeof id === 'string')
        : [],
      progression: {
        ownedVehicles,
        activeGarageVehicle,
        vehicleColors,
        vehicleUpgrades,
        customization,
        completedChallengeIds: Array.isArray(rawProg.completedChallengeIds)
          ? rawProg.completedChallengeIds.filter((id): id is string => typeof id === 'string')
          : [],
        visitedDistricts: Array.isArray(rawProg.visitedDistricts)
          ? rawProg.visitedDistricts.filter((d): d is DistrictId => VALID_DISTRICTS.includes(d))
          : [],
        topSpeedKmh: clampNum(rawProg.topSpeedKmh, 0, 400, 0),
        totalDistance: clampNum(rawProg.totalDistance, 0, 1_000_000, 0),
        missionsCompletedCount: clampInt(rawProg.missionsCompletedCount, 0, 10000, 0),
        wantedEscapesCount: clampInt(rawProg.wantedEscapesCount, 0, 10000, 0),
      },
      settings,
      playerPos,
      quizProgress,
    };
  } catch {
    return null;
  }
}

export function saveGameToStorage(
  data: SaveGameData,
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_STORAGE_KEY, serializeSaveData(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGameFromStorage(
  storage: StorageLike | null = getDefaultStorage(),
): SaveGameData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    return parseSaveData(raw);
  } catch {
    return null;
  }
}

export function hasSavedGame(
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  return loadGameFromStorage(storage) !== null;
}

export function clearSavedGame(
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
