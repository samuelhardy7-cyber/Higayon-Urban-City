import type {
  BodyProportionType,
  CharacterCustomization,
  FaceStyleId,
  GlassesSlotId,
  HairStyleId,
  HatSlotId,
  NeckSlotId,
  OutfitId,
  PantsStyleId,
  ShoeStyleId,
  TopStyleId,
  WatchSlotId,
  BackpackSlotId,
} from './types';
import type {
  KpDifficultyRewards,
  QuestionDifficulty,
  ShopItemOverride,
  TeacherConfig,
} from './questionTypes';

export type RewardShopCategory = 'clothing' | 'accessories' | 'characters';

export type RewardShopSubCategory =
  | 'tshirt'
  | 'hoodie'
  | 'jacket'
  | 'trousers'
  | 'shoes'
  | 'special_outfit'
  | 'hat'
  | 'glasses'
  | 'watch'
  | 'backpack'
  | 'neck'
  | 'character_preset'
  | 'hairstyle'
  | 'face'
  | 'body_proportion';

export interface RewardShopItem {
  id: string;
  name: string;
  description: string;
  category: RewardShopCategory;
  subCategory: RewardShopSubCategory;
  priceKp: number;
  starterOwned?: boolean;
  enabled: boolean;
  rarity: 'starter' | 'common' | 'rare' | 'special';
  accentHex: string;
  patch: Partial<CharacterCustomization>;
}

export interface AchievementBadgeDef {
  id: string;
  name: string;
  description: string;
  accentHex: string;
  bonusKp: number;
}

export const DEFAULT_KP_DIFFICULTY_REWARDS: KpDifficultyRewards = {
  easy: 10,
  medium: 20,
  hard: 30,
  special: 50,
};

export const SKIN_TONE_SWATCHES: Array<{ id: string; label: string; color: number; hex: string }> = [
  { id: 'skin_fair', label: 'Ivory Warm', color: 0xf4cfb4, hex: '#f4cfb4' },
  { id: 'skin_olive', label: 'Warm Olive', color: 0xe2b28b, hex: '#e2b28b' },
  { id: 'skin_tan', label: 'Golden Tan', color: 0xc98f63, hex: '#c98f63' },
  { id: 'skin_chestnut', label: 'Chestnut', color: 0x9c6442, hex: '#9c6442' },
  { id: 'skin_espresso', label: 'Deep Espresso', color: 0x6b422a, hex: '#6b422a' },
];

export const HAIR_COLOR_SWATCHES: Array<{ label: string; color: number; hex: string }> = [
  { label: 'Obsidian', color: 0x1e2028, hex: '#1e2028' },
  { label: 'Chestnut', color: 0x5c3a21, hex: '#5c3a21' },
  { label: 'Auburn', color: 0x8f3f26, hex: '#8f3f26' },
  { label: 'Golden Blonde', color: 0xd9a84e, hex: '#d9a84e' },
  { label: 'Silver Frost', color: 0xcbd5e1, hex: '#cbd5e1' },
  { label: 'Ocean Teal', color: 0x0ea5e9, hex: '#0ea5e9' },
];

export const CLOTHING_COLOR_SWATCHES: Array<{ label: string; color: number; hex: string }> = [
  { label: 'Slate Navy', color: 0x243b55, hex: '#243b55' },
  { label: 'Crimson', color: 0xb93838, hex: '#b93838' },
  { label: 'Emerald', color: 0x15803d, hex: '#15803d' },
  { label: 'Amber Gold', color: 0xd97706, hex: '#d97706' },
  { label: 'Cobalt', color: 0x2563eb, hex: '#2563eb' },
  { label: 'Charcoal', color: 0x334155, hex: '#334155' },
  { label: 'Ivory', color: 0xe2e8f0, hex: '#e2e8f0' },
  { label: 'Plum', color: 0x7e22ce, hex: '#7e22ce' },
];

export const ACHIEVEMENT_BADGES: AchievementBadgeDef[] = [
  {
    id: 'badge_first_kp',
    name: 'First Spark',
    description: 'Earn your first Knowledge Points from any city learning terminal.',
    accentHex: '#38bdf8',
    bonusKp: 0,
  },
  {
    id: 'badge_scholar_5',
    name: 'City Scholar',
    description: 'Answer 5 educational questions accurately across the city.',
    accentHex: '#34d399',
    bonusKp: 0,
  },
  {
    id: 'badge_tower_climber',
    name: 'Skyline Climber',
    description: 'Reach Floor 10 or higher inside CITY TOWER.',
    accentHex: '#f59e0b',
    bonusKp: 0,
  },
  {
    id: 'badge_collector',
    name: 'Wardrobe Collector',
    description: 'Unlock 3 or more Reward Center items with Knowledge Points.',
    accentHex: '#a78bfa',
    bonusKp: 0,
  },
  {
    id: 'badge_kp_100',
    name: 'Knowledge Century',
    description: 'Accumulate 100 lifetime Knowledge Points.',
    accentHex: '#fbbf24',
    bonusKp: 0,
  },
];

export const REWARD_SHOP_CATALOG: RewardShopItem[] = [
  // ================= CHARACTERS (Original Male & Female Personas) =================
  {
    id: 'char_alex',
    name: 'Alex Rivera',
    description: 'Original male urban explorer look with cropped hair and casual runner jacket.',
    category: 'characters',
    subCategory: 'character_preset',
    priceKp: 0,
    starterOwned: true,
    enabled: true,
    rarity: 'starter',
    accentHex: '#38bdf8',
    patch: {
      characterPresetId: 'char_alex',
      bodyType: 'classic',
      skinTone: 0xe2b28b,
      hairStyle: 'short_crop',
      hairColor: 0x1e2028,
      faceStyle: 'friendly',
    },
  },
  {
    id: 'char_maya',
    name: 'Maya Lin',
    description: 'Original female scholar persona with long layered wave hair and cheerful expression.',
    category: 'characters',
    subCategory: 'character_preset',
    priceKp: 0,
    starterOwned: true,
    enabled: true,
    rarity: 'starter',
    accentHex: '#34d399',
    patch: {
      characterPresetId: 'char_maya',
      bodyType: 'slim',
      skinTone: 0xf4cfb4,
      hairStyle: 'long_wave',
      hairColor: 0x1e2028,
      faceStyle: 'cheerful',
    },
  },
  {
    id: 'char_leo',
    name: 'Leo Vance',
    description: 'Original male athlete persona with sharp fade haircut and tall athletic stance.',
    category: 'characters',
    subCategory: 'character_preset',
    priceKp: 30,
    enabled: true,
    rarity: 'common',
    accentHex: '#f59e0b',
    patch: {
      characterPresetId: 'char_leo',
      bodyType: 'athletic',
      skinTone: 0x9c6442,
      hairStyle: 'fade',
      hairColor: 0x1e2028,
      faceStyle: 'determined',
    },
  },
  {
    id: 'char_sara',
    name: 'Sara Okafor',
    description: 'Original female innovator with high ponytail and confident studio flair.',
    category: 'characters',
    subCategory: 'character_preset',
    priceKp: 30,
    enabled: true,
    rarity: 'common',
    accentHex: '#fb7185',
    patch: {
      characterPresetId: 'char_sara',
      bodyType: 'athletic',
      skinTone: 0x6b422a,
      hairStyle: 'ponytail',
      hairColor: 0x1e2028,
      faceStyle: 'cool',
    },
  },
  {
    id: 'char_kai',
    name: 'Kai Tanaka',
    description: 'Original male tech creator with textured curly hair and tall build.',
    category: 'characters',
    subCategory: 'character_preset',
    priceKp: 45,
    enabled: true,
    rarity: 'rare',
    accentHex: '#2dd4bf',
    patch: {
      characterPresetId: 'char_kai',
      bodyType: 'tall',
      skinTone: 0xe2b28b,
      hairStyle: 'curly',
      hairColor: 0x5c3a21,
      faceStyle: 'cool',
    },
  },
  {
    id: 'char_nina',
    name: 'Nina Morales',
    description: 'Original female architect persona with sleek bob cut and crisp aesthetic.',
    category: 'characters',
    subCategory: 'character_preset',
    priceKp: 45,
    enabled: true,
    rarity: 'rare',
    accentHex: '#a78bfa',
    patch: {
      characterPresetId: 'char_nina',
      bodyType: 'classic',
      skinTone: 0xc98f63,
      hairStyle: 'bob',
      hairColor: 0x8f3f26,
      faceStyle: 'determined',
    },
  },

  // Hairstyles
  {
    id: 'hair_curly',
    name: 'Curly Crown',
    description: 'Voluminous sculpted curls compatible with any character.',
    category: 'characters',
    subCategory: 'hairstyle',
    priceKp: 15,
    enabled: true,
    rarity: 'common',
    accentHex: '#f59e0b',
    patch: { hairStyle: 'curly' },
  },
  {
    id: 'hair_ponytail',
    name: 'Active Ponytail',
    description: 'High swept ponytail built for sprinting across downtown.',
    category: 'characters',
    subCategory: 'hairstyle',
    priceKp: 15,
    enabled: true,
    rarity: 'common',
    accentHex: '#fb7185',
    patch: { hairStyle: 'ponytail' },
  },
  {
    id: 'hair_fade',
    name: 'Metro Taper Fade',
    description: 'Clean high-top fade hairstyle.',
    category: 'characters',
    subCategory: 'hairstyle',
    priceKp: 20,
    enabled: true,
    rarity: 'common',
    accentHex: '#38bdf8',
    patch: { hairStyle: 'fade' },
  },
  {
    id: 'hair_bob',
    name: 'Studio Bob',
    description: 'Sleek angled bob framing the jawline.',
    category: 'characters',
    subCategory: 'hairstyle',
    priceKp: 20,
    enabled: true,
    rarity: 'common',
    accentHex: '#a78bfa',
    patch: { hairStyle: 'bob' },
  },

  // Faces & Body Proportions
  {
    id: 'face_cool',
    name: 'Cool Focus Expression',
    description: 'Composed brow and confident half-smile.',
    category: 'characters',
    subCategory: 'face',
    priceKp: 10,
    enabled: true,
    rarity: 'common',
    accentHex: '#38bdf8',
    patch: { faceStyle: 'cool' },
  },
  {
    id: 'face_determined',
    name: 'Challenger Gaze',
    description: 'Sharp determined brows for CITY TOWER races.',
    category: 'characters',
    subCategory: 'face',
    priceKp: 10,
    enabled: true,
    rarity: 'common',
    accentHex: '#f59e0b',
    patch: { faceStyle: 'determined' },
  },
  {
    id: 'body_athletic',
    name: 'Athletic Build',
    description: 'Broader shoulders and sporty posture.',
    category: 'characters',
    subCategory: 'body_proportion',
    priceKp: 25,
    enabled: true,
    rarity: 'common',
    accentHex: '#34d399',
    patch: { bodyType: 'athletic' },
  },
  {
    id: 'body_tall',
    name: 'Tall Skyline Build',
    description: 'Elevated stature with longer stride silhouette.',
    category: 'characters',
    subCategory: 'body_proportion',
    priceKp: 25,
    enabled: true,
    rarity: 'common',
    accentHex: '#a78bfa',
    patch: { bodyType: 'tall' },
  },

  // ================= CLOTHING (T-shirts, Hoodies, Jackets, Trousers, Shoes, Special Outfits) =================
  {
    id: 'cloth_tshirt_classic',
    name: 'Campus Crew T-Shirt',
    description: 'Breathable everyday cotton tee with clean contrast trim.',
    category: 'clothing',
    subCategory: 'tshirt',
    priceKp: 0,
    starterOwned: true,
    enabled: true,
    rarity: 'starter',
    accentHex: '#38bdf8',
    patch: { topStyle: 'tshirt', outfitId: 'coast_polo' },
  },
  {
    id: 'cloth_jacket_runner',
    name: 'Street Runner Jacket',
    description: 'Signature zip jacket built for city exploration.',
    category: 'clothing',
    subCategory: 'jacket',
    priceKp: 0,
    starterOwned: true,
    enabled: true,
    rarity: 'starter',
    accentHex: '#2563eb',
    patch: { topStyle: 'jacket', outfitId: 'street_runner', jacketColor: 0x243b55 },
  },
  {
    id: 'cloth_hoodie_urban',
    name: 'Metro Pullover Hoodie',
    description: 'Cozy layered hoodie with drawstring collar and front pocket.',
    category: 'clothing',
    subCategory: 'hoodie',
    priceKp: 20,
    enabled: true,
    rarity: 'common',
    accentHex: '#f59e0b',
    patch: { topStyle: 'hoodie', outfitId: 'urban_hoodie', jacketColor: 0xb93838 },
  },
  {
    id: 'cloth_blazer_scholar',
    name: 'Academy tailored Blazer',
    description: 'Crisp tailored blazer for CITY TOWER corporate floors.',
    category: 'clothing',
    subCategory: 'jacket',
    priceKp: 35,
    enabled: true,
    rarity: 'rare',
    accentHex: '#60a5fa',
    patch: { topStyle: 'blazer', outfitId: 'metro_blazer', jacketColor: 0x1e293b },
  },
  {
    id: 'cloth_sport_jersey',
    name: 'Harbor Sprint Jersey',
    description: 'Lightweight athletic jersey with racing stripe accents.',
    category: 'clothing',
    subCategory: 'tshirt',
    priceKp: 25,
    enabled: true,
    rarity: 'common',
    accentHex: '#34d399',
    patch: { topStyle: 'sport', outfitId: 'coast_polo', jacketColor: 0x15803d },
  },
  {
    id: 'cloth_special_explorer',
    name: 'Urban Explorer Vest',
    description: 'Multi-pocket utility expedition vest over long-sleeve shirt.',
    category: 'clothing',
    subCategory: 'special_outfit',
    priceKp: 50,
    enabled: true,
    rarity: 'rare',
    accentHex: '#fb923c',
    patch: { topStyle: 'explorer_vest', outfitId: 'street_runner', jacketColor: 0xd97706 },
  },
  {
    id: 'cloth_special_cyber',
    name: 'Neon Horizon Jacket',
    description: 'Luminous cyan-accented futuristic collar jacket.',
    category: 'clothing',
    subCategory: 'special_outfit',
    priceKp: 75,
    enabled: true,
    rarity: 'special',
    accentHex: '#22d3ee',
    patch: { topStyle: 'cyber_jacket', outfitId: 'street_runner', jacketColor: 0x0f172a },
  },
  {
    id: 'cloth_special_champion',
    name: 'Grand Scholar Coat',
    description: 'Gold-trimmed ceremonial overcoat celebrating academic mastery.',
    category: 'clothing',
    subCategory: 'special_outfit',
    priceKp: 100,
    enabled: true,
    rarity: 'special',
    accentHex: '#fbbf24',
    patch: { topStyle: 'champion_coat', outfitId: 'metro_blazer', jacketColor: 0x7e22ce },
  },
  {
    id: 'pants_jeans',
    name: 'Classic Straight Jeans',
    description: 'Durable indigo denim trousers.',
    category: 'clothing',
    subCategory: 'trousers',
    priceKp: 0,
    starterOwned: true,
    enabled: true,
    rarity: 'starter',
    accentHex: '#38bdf8',
    patch: { pantsStyle: 'jeans', pantsColor: 0x1e293b },
  },
  {
    id: 'pants_joggers',
    name: 'Track Taper Joggers',
    description: 'Tapered cuffed joggers with ankle stripes.',
    category: 'clothing',
    subCategory: 'trousers',
    priceKp: 20,
    enabled: true,
    rarity: 'common',
    accentHex: '#34d399',
    patch: { pantsStyle: 'joggers', pantsColor: 0x334155 },
  },
  {
    id: 'pants_cargo',
    name: 'Field Cargo Trousers',
    description: 'Side-pocket utility cargo trousers for city quests.',
    category: 'clothing',
    subCategory: 'trousers',
    priceKp: 30,
    enabled: true,
    rarity: 'common',
    accentHex: '#d97706',
    patch: { pantsStyle: 'cargo', pantsColor: 0x4b5563 },
  },
  {
    id: 'shoes_sneakers',
    name: 'City Low Sneakers',
    description: 'Clean white-soled everyday sneakers.',
    category: 'clothing',
    subCategory: 'shoes',
    priceKp: 0,
    starterOwned: true,
    enabled: true,
    rarity: 'starter',
    accentHex: '#e2e8f0',
    patch: { shoeStyle: 'sneakers', shoeColor: 0xe2e8f0 },
  },
  {
    id: 'shoes_runners',
    name: 'Velocity Aero Runners',
    description: 'Sculpted athletic runners built for speed.',
    category: 'clothing',
    subCategory: 'shoes',
    priceKp: 20,
    enabled: true,
    rarity: 'common',
    accentHex: '#22d3ee',
    patch: { shoeStyle: 'runners', shoeColor: 0x0ea5e9 },
  },
  {
    id: 'shoes_boots',
    name: 'Harbor Work Boots',
    description: 'Reinforced rugged boots with traction soles.',
    category: 'clothing',
    subCategory: 'shoes',
    priceKp: 25,
    enabled: true,
    rarity: 'common',
    accentHex: '#b45309',
    patch: { shoeStyle: 'boots', shoeColor: 0x78350f },
  },

  // ================= ACCESSORIES (Hats, Glasses, Watches, Backpacks, Neck) =================
  {
    id: 'acc_hat_cap',
    name: 'Urban Snapback Cap',
    description: 'Forward-brimmed street cap.',
    category: 'accessories',
    subCategory: 'hat',
    priceKp: 15,
    enabled: true,
    rarity: 'common',
    accentHex: '#ef4444',
    patch: { hatId: 'cap' },
  },
  {
    id: 'acc_hat_beanie',
    name: 'Knit Harbor Beanie',
    description: 'Warm ribbed knit beanie for evening waterfront strolls.',
    category: 'accessories',
    subCategory: 'hat',
    priceKp: 20,
    enabled: true,
    rarity: 'common',
    accentHex: '#f59e0b',
    patch: { hatId: 'beanie' },
  },
  {
    id: 'acc_hat_fedora',
    name: 'Downtown Studio Hat',
    description: 'Structured brimmed hat with contrast band.',
    category: 'accessories',
    subCategory: 'hat',
    priceKp: 30,
    enabled: true,
    rarity: 'rare',
    accentHex: '#a78bfa',
    patch: { hatId: 'fedora' },
  },
  {
    id: 'acc_hat_grad',
    name: 'Honors Mortarboard',
    description: 'Gold-tasseled graduation cap celebrating top scholars.',
    category: 'accessories',
    subCategory: 'hat',
    priceKp: 60,
    enabled: true,
    rarity: 'special',
    accentHex: '#fbbf24',
    patch: { hatId: 'grad_cap' },
  },
  {
    id: 'acc_glasses_shades',
    name: 'Coastal Aviator Shades',
    description: 'Tinted dark sunglasses for sunny avenues.',
    category: 'accessories',
    subCategory: 'glasses',
    priceKp: 15,
    enabled: true,
    rarity: 'common',
    accentHex: '#38bdf8',
    patch: { glassesId: 'shades' },
  },
  {
    id: 'acc_glasses_round',
    name: 'Scholar Gold Frames',
    description: 'Sleek round academic eyewear.',
    category: 'accessories',
    subCategory: 'glasses',
    priceKp: 25,
    enabled: true,
    rarity: 'common',
    accentHex: '#fbbf24',
    patch: { glassesId: 'round_frames' },
  },
  {
    id: 'acc_glasses_visor',
    name: 'Holo AR Visor',
    description: 'Translucent cyan HUD visor.',
    category: 'accessories',
    subCategory: 'glasses',
    priceKp: 55,
    enabled: true,
    rarity: 'special',
    accentHex: '#22d3ee',
    patch: { glassesId: 'visor' },
  },
  {
    id: 'acc_watch_sport',
    name: 'Chrono Sport Watch',
    description: 'Lightweight athletic wristwatch.',
    category: 'accessories',
    subCategory: 'watch',
    priceKp: 15,
    enabled: true,
    rarity: 'common',
    accentHex: '#34d399',
    patch: { watchId: 'sport_watch' },
  },
  {
    id: 'acc_watch_gold',
    name: 'Summit Gold Timepiece',
    description: 'Polished gold-finish wristwatch.',
    category: 'accessories',
    subCategory: 'watch',
    priceKp: 45,
    enabled: true,
    rarity: 'rare',
    accentHex: '#fbbf24',
    patch: { watchId: 'gold_watch' },
  },
  {
    id: 'acc_pack_backpack',
    name: 'Campus Explorer Pack',
    description: 'Two-pocket field backpack for study quests.',
    category: 'accessories',
    subCategory: 'backpack',
    priceKp: 20,
    enabled: true,
    rarity: 'common',
    accentHex: '#3b82f6',
    patch: { backpackId: 'backpack' },
  },
  {
    id: 'acc_pack_tech',
    name: 'Skyline Tech Pack',
    description: 'Hard-shell aerodynamic commuter pack with LED accent bar.',
    category: 'accessories',
    subCategory: 'backpack',
    priceKp: 45,
    enabled: true,
    rarity: 'rare',
    accentHex: '#22d3ee',
    patch: { backpackId: 'tech_pack' },
  },
  {
    id: 'acc_neck_headphones',
    name: 'Studio Neck Headphones',
    description: 'Wireless over-ear headphones resting around the collar.',
    category: 'accessories',
    subCategory: 'neck',
    priceKp: 25,
    enabled: true,
    rarity: 'common',
    accentHex: '#a78bfa',
    patch: { neckId: 'headphones' },
  },
  {
    id: 'acc_neck_scarf',
    name: 'Breeze Knit Scarf',
    description: 'Soft layered collar scarf.',
    category: 'accessories',
    subCategory: 'neck',
    priceKp: 20,
    enabled: true,
    rarity: 'common',
    accentHex: '#fb7185',
    patch: { neckId: 'scarf' },
  },
  {
    id: 'acc_neck_medal',
    name: 'Gold Scholar Medal',
    description: 'Award ribbon & gleaming medallion earned through excellence.',
    category: 'accessories',
    subCategory: 'neck',
    priceKp: 65,
    enabled: true,
    rarity: 'special',
    accentHex: '#fbbf24',
    patch: { neckId: 'medal_lanyard' },
  },
];

export const STARTER_OWNED_ITEM_IDS = REWARD_SHOP_CATALOG.filter((i) => i.starterOwned).map(
  (i) => i.id,
);

export function createDefaultCharacterCustomization(): CharacterCustomization {
  return {
    outfitId: 'street_runner',
    jacketColor: 0x243b55,
    pantsColor: 0x1e293b,
    shoeColor: 0xe2e8f0,
    accessoryId: 'none',
    unlockedOutfits: ['street_runner', 'coast_polo'],
    unlockedAccessories: ['none'],
    characterPresetId: 'char_alex',
    bodyType: 'classic',
    skinTone: 0xe2b28b,
    hairStyle: 'short_crop',
    hairColor: 0x1e2028,
    faceStyle: 'friendly',
    topStyle: 'jacket',
    pantsStyle: 'jeans',
    shoeStyle: 'sneakers',
    hatId: 'none',
    glassesId: 'none',
    watchId: 'none',
    backpackId: 'none',
    neckId: 'none',
    ownedItemIds: [...STARTER_OWNED_ITEM_IDS],
  };
}

export function normalizeCharacterCustomization(
  raw?: Partial<CharacterCustomization> | null,
): CharacterCustomization {
  const base = createDefaultCharacterCustomization();
  if (!raw) return base;

  const hatId: HatSlotId =
    raw.hatId ??
    (raw.accessoryId === 'cap' || raw.accessoryId === 'cap_backpack' ? 'cap' : 'none');
  const backpackId: BackpackSlotId =
    raw.backpackId ??
    (raw.accessoryId === 'backpack' || raw.accessoryId === 'cap_backpack' ? 'backpack' : 'none');
  const glassesId: GlassesSlotId =
    raw.glassesId ?? (raw.accessoryId === 'shades' ? 'shades' : 'none');

  let topStyle: TopStyleId = raw.topStyle ?? 'jacket';
  if (!raw.topStyle && raw.outfitId) {
    if (raw.outfitId === 'urban_hoodie') topStyle = 'hoodie';
    else if (raw.outfitId === 'metro_blazer') topStyle = 'blazer';
    else if (raw.outfitId === 'coast_polo') topStyle = 'tshirt';
    else topStyle = 'jacket';
  }

  const ownedSet = new Set<string>([
    ...STARTER_OWNED_ITEM_IDS,
    ...(Array.isArray(raw.ownedItemIds) ? raw.ownedItemIds : []),
  ]);

  return {
    outfitId: (raw.outfitId as OutfitId) || base.outfitId,
    jacketColor: typeof raw.jacketColor === 'number' ? raw.jacketColor : base.jacketColor,
    pantsColor: typeof raw.pantsColor === 'number' ? raw.pantsColor : base.pantsColor,
    shoeColor: typeof raw.shoeColor === 'number' ? raw.shoeColor : base.shoeColor,
    accessoryId: raw.accessoryId || base.accessoryId,
    unlockedOutfits:
      Array.isArray(raw.unlockedOutfits) && raw.unlockedOutfits.length > 0
        ? [...raw.unlockedOutfits]
        : base.unlockedOutfits,
    unlockedAccessories:
      Array.isArray(raw.unlockedAccessories) && raw.unlockedAccessories.length > 0
        ? [...raw.unlockedAccessories]
        : base.unlockedAccessories,
    characterPresetId: raw.characterPresetId || base.characterPresetId,
    bodyType: (raw.bodyType as BodyProportionType) || base.bodyType,
    skinTone: typeof raw.skinTone === 'number' ? raw.skinTone : base.skinTone,
    hairStyle: (raw.hairStyle as HairStyleId) || base.hairStyle,
    hairColor: typeof raw.hairColor === 'number' ? raw.hairColor : base.hairColor,
    faceStyle: (raw.faceStyle as FaceStyleId) || base.faceStyle,
    topStyle,
    pantsStyle: (raw.pantsStyle as PantsStyleId) || base.pantsStyle,
    shoeStyle: (raw.shoeStyle as ShoeStyleId) || base.shoeStyle,
    hatId,
    glassesId,
    watchId: (raw.watchId as WatchSlotId) || 'none',
    backpackId,
    neckId: (raw.neckId as NeckSlotId) || 'none',
    ownedItemIds: [...ownedSet],
  };
}

export function getEffectiveShopCatalog(
  overrides?: Record<string, ShopItemOverride> | null,
): RewardShopItem[] {
  return REWARD_SHOP_CATALOG.map((item) => {
    const ov = overrides?.[item.id];
    if (!ov) return { ...item };
    return {
      ...item,
      priceKp:
        typeof ov.priceKp === 'number' && Number.isFinite(ov.priceKp) && ov.priceKp >= 0
          ? Math.round(ov.priceKp)
          : item.priceKp,
      enabled: typeof ov.enabled === 'boolean' ? ov.enabled : item.enabled,
    };
  });
}

export function applyShopItemToCustomization(
  current: CharacterCustomization,
  item: RewardShopItem,
): CharacterCustomization {
  const normalized = normalizeCharacterCustomization(current);
  const owned = new Set(normalized.ownedItemIds || STARTER_OWNED_ITEM_IDS);
  owned.add(item.id);
  const next: CharacterCustomization = {
    ...normalized,
    ...item.patch,
    ownedItemIds: [...owned],
  };
  // Keep legacy accessoryId synchronized for older HUD/remote views
  if (next.hatId === 'cap' && next.backpackId === 'backpack') {
    next.accessoryId = 'cap_backpack';
  } else if (next.hatId === 'cap') {
    next.accessoryId = 'cap';
  } else if (next.backpackId === 'backpack') {
    next.accessoryId = 'backpack';
  } else if (next.glassesId === 'shades') {
    next.accessoryId = 'shades';
  } else {
    next.accessoryId = 'none';
  }
  return next;
}

export function resolveDifficultyKp(
  difficulty: QuestionDifficulty,
  teacherConfig?: TeacherConfig | null,
): number {
  const table = {
    ...DEFAULT_KP_DIFFICULTY_REWARDS,
    ...(teacherConfig?.kpRewards || {}),
  };
  switch (difficulty) {
    case 'easy':
      return Math.max(1, Math.round(table.easy));
    case 'medium':
      return Math.max(1, Math.round(table.medium));
    case 'hard':
      return Math.max(1, Math.round(table.hard));
    case 'special':
      return Math.max(1, Math.round(table.special));
    default:
      return 10;
  }
}

export function resolveQuestionKpReward(
  question: { difficulty: QuestionDifficulty; points: number },
  teacherConfig?: TeacherConfig | null,
): number {
  const useTable = teacherConfig?.useDifficultyKpTable !== false;
  if (useTable) {
    return resolveDifficultyKp(question.difficulty, teacherConfig);
  }
  const pts = Number(question.points);
  if (Number.isFinite(pts) && pts > 0) {
    return Math.round(pts);
  }
  return resolveDifficultyKp(question.difficulty, teacherConfig);
}

export function evaluateEarnedBadges(stats: {
  lifetimeKpEarned: number;
  completedQuestionsCount: number;
  towerMaxFloor: number;
  ownedItemIds: string[];
}): string[] {
  const earned = new Set<string>();
  if (stats.lifetimeKpEarned > 0) earned.add('badge_first_kp');
  if (stats.completedQuestionsCount >= 5) earned.add('badge_scholar_5');
  if (stats.towerMaxFloor >= 10) earned.add('badge_tower_climber');
  const nonStarterOwned = stats.ownedItemIds.filter(
    (id) => !STARTER_OWNED_ITEM_IDS.includes(id),
  ).length;
  if (nonStarterOwned >= 3) earned.add('badge_collector');
  if (stats.lifetimeKpEarned >= 100) earned.add('badge_kp_100');
  return [...earned];
}
