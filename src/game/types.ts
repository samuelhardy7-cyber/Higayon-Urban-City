export type GamePhase = 'title' | 'playing' | 'paused';

export type TimeOfDayPhase = 'pagi' | 'siang' | 'sore' | 'malam';

export type DistrictId =
  | 'downtown'
  | 'residential'
  | 'industrial'
  | 'coastal'
  | 'avenue';

export type VehicleKind = 'sedan' | 'suv' | 'sports' | 'pickup' | 'motor';

export type PlayerControlMode = 'on_foot' | 'entering' | 'driving' | 'exiting';

export type MissionType = 'delivery' | 'race' | 'escape';

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  kind: 'building' | 'house' | 'vehicle' | 'container' | 'prop' | 'barrier';
  blocksCamera: boolean;
}

export interface BlockZone {
  id: string;
  cx: number;
  cz: number;
  size: number;
  type:
    | 'downtown_tower'
    | 'downtown_mall'
    | 'downtown_parking'
    | 'residential_houses'
    | 'residential_apartments'
    | 'residential_park'
    | 'industrial_factory'
    | 'industrial_port'
    | 'coastal_resort'
    | 'coastal_restaurants';
  district: DistrictId;
  label: string;
}

export type BuildingCategory = 'residential' | 'commercial' | 'business' | 'industrial';

export type BuildingSubtype =
  | 'small_house'
  | 'modern_house'
  | 'apartment'
  | 'convenience_store'
  | 'restaurant'
  | 'cafe'
  | 'mall'
  | 'reward_shop'
  | 'office'
  | 'corporate'
  | 'workshop'
  | 'warehouse'
  | 'factory';

export interface BuildingEntranceSpec {
  id: string;
  buildingId: string;
  name: string;
  category: BuildingCategory;
  subtype: BuildingSubtype;
  doorX: number;
  doorY: number;
  doorZ: number;
  /** Outward-facing Y rotation (local +Z points outward into the street/sidewalk) */
  yaw: number;
  width: number;
  height: number;
  doorStyle: 'wood' | 'glass_double' | 'industrial' | 'storefront';
  accentColor: number;
}

export interface BuildingSpec {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  style:
    | 'skyscraper'
    | 'office'
    | 'mall'
    | 'reward_center'
    | 'apartment'
    | 'factory'
    | 'warehouse'
    | 'workshop'
    | 'store'
    | 'restaurant';
  primaryColor: number;
  accentColor: number;
  hasAwning?: boolean;
  hasSpire?: boolean;
  hasSetback?: boolean;
}

export interface HouseSpec {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  wallHeight: number;
  roofHeight: number;
  facing: number;
  wallColor: number;
  roofColor: number;
  trimColor: number;
}

export interface ParkedVehicleSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  kind: 'sedan' | 'suv' | 'truck';
  color: number;
}

export interface ContainerSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  color: number;
}

export interface TrafficSignSpec {
  x: number;
  y: number;
  z: number;
  rotY: number;
  kind: 'stop' | 'crosswalk' | 'speed';
}

export interface TreeSpec {
  x: number;
  y: number;
  z: number;
  scale: number;
  tint: number;
  kind: 'deciduous' | 'palm';
}

export interface StreetLampSpec {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface BenchSpec {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface FountainSpec {
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface LandmarkPin {
  id: string;
  label: string;
  shortCode: string;
  district: DistrictId;
  x: number;
  z: number;
  color: string;
}

export interface NpcWaypointLoop {
  id: string;
  points: Array<{ x: number; z: number }>;
}

export interface NpcState {
  id: string;
  variant: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  gaitPhase: number;
  loopIndex: number;
  waypointIndex: number;
  pauseTimer: number;
  walkDistanceSincePause: number;
  nextPauseDistance: number;
  isPaused: boolean;
}

export interface VehicleSpec {
  kind: VehicleKind;
  label: string;
  maxSpeed: number;
  reverseSpeed: number;
  accel: number;
  brakeDecel: number;
  turnRate: number;
  length: number;
  width: number;
  wheelRadius: number;
  wheelBase: number;
  trackWidth: number;
  seatOffsetX: number;
  seatOffsetY: number;
  seatOffsetZ: number;
  exitOffsetX: number;
  isMotorcycle: boolean;
}

export interface VehicleState {
  id: string;
  kind: VehicleKind;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steerAngle: number;
  wheelSpin: number;
  leanAngle: number;
  color: number;
  isPolice: boolean;
  occupant: 'none' | 'player' | 'traffic' | 'police';
  sirenPhase: number;
  isBraking: boolean;
  // AI fields for traffic & police
  aiLoopIndex: number;
  aiWaypointIndex: number;
  aiCruiseSpeed: number;
  aiStopTimer: number;
  aiAvoidSide: number;
  aiAvoidTimer: number;
  aiStuckTimer: number;
}

export interface DrivingInputState {
  accelerate: boolean;
  brakeReverse: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  handbrake: boolean;
}

export interface MissionCheckpoint {
  x: number;
  z: number;
  label: string;
}

export interface MissionDefinition {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  startX: number;
  startZ: number;
  startLabel: string;
  reward: number;
  timeLimit: number;
  checkpoints: MissionCheckpoint[];
  wantedOnStart: number;
  color: number;
  badgeColor: string;
}

export interface ActiveMissionState {
  missionId: string;
  type: MissionType;
  title: string;
  checkpointIndex: number;
  totalCheckpoints: number;
  timeRemaining: number;
  reward: number;
}

export interface MissionBannerState {
  status: 'completed' | 'failed';
  title: string;
  reward: number;
  message: string;
  timer: number;
}

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type OutfitId = 'street_runner' | 'urban_hoodie' | 'metro_blazer' | 'coast_polo';

export type AccessoryId = 'none' | 'backpack' | 'cap' | 'shades' | 'cap_backpack';

export type BodyProportionType = 'classic' | 'athletic' | 'slim' | 'tall';

export type HairStyleId = 'short_crop' | 'curly' | 'long_wave' | 'ponytail' | 'fade' | 'bob';

export type FaceStyleId = 'friendly' | 'determined' | 'cheerful' | 'cool';

export type TopStyleId =
  | 'tshirt'
  | 'hoodie'
  | 'jacket'
  | 'blazer'
  | 'sport'
  | 'explorer_vest'
  | 'cyber_jacket'
  | 'champion_coat';

export type PantsStyleId = 'jeans' | 'chinos' | 'joggers' | 'cargo';

export type ShoeStyleId = 'sneakers' | 'boots' | 'runners' | 'loafers';

export type HatSlotId = 'none' | 'cap' | 'beanie' | 'fedora' | 'grad_cap';

export type GlassesSlotId = 'none' | 'shades' | 'round_frames' | 'visor';

export type WatchSlotId = 'none' | 'sport_watch' | 'gold_watch' | 'smart_band';

export type BackpackSlotId = 'none' | 'backpack' | 'tech_pack' | 'mini_satchel';

export type NeckSlotId = 'none' | 'scarf' | 'medal_lanyard' | 'headphones';

export interface CharacterCustomization {
  outfitId: OutfitId;
  jacketColor: number;
  pantsColor: number;
  shoeColor: number;
  accessoryId: AccessoryId;
  unlockedOutfits: OutfitId[];
  unlockedAccessories: AccessoryId[];
  // Expanded KP Reward Shop & Full Character Customization fields
  characterPresetId?: string;
  bodyType?: BodyProportionType;
  skinTone?: number;
  hairStyle?: HairStyleId;
  hairColor?: number;
  faceStyle?: FaceStyleId;
  topStyle?: TopStyleId;
  pantsStyle?: PantsStyleId;
  shoeStyle?: ShoeStyleId;
  hatId?: HatSlotId;
  glassesId?: GlassesSlotId;
  watchId?: WatchSlotId;
  backpackId?: BackpackSlotId;
  neckId?: NeckSlotId;
  ownedItemIds?: string[];
}

export interface VehicleUpgradeLevels {
  engine: number; // 0..3
  handling: number; // 0..3
  chassis: number; // 0..3
}

export interface GarageCatalogItem {
  kind: VehicleKind;
  name: string;
  price: number;
  description: string;
  topSpeedRating: number;
  accelRating: number;
  handlingRating: number;
  defaultColor: number;
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  reward: number;
  target: number;
  unit: string;
}

export interface ChallengeStatus {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  unit: string;
  completed: boolean;
}

export interface GameSettings {
  muted: boolean;
  musicEnabled: boolean;
  timeOfDay: TimeOfDayPhase;
  graphicsQuality: GraphicsQuality;
}

export interface ProgressionState {
  ownedVehicles: VehicleKind[];
  activeGarageVehicle: VehicleKind;
  vehicleColors: Record<VehicleKind, number>;
  vehicleUpgrades: Record<VehicleKind, VehicleUpgradeLevels>;
  customization: CharacterCustomization;
  completedChallengeIds: string[];
  visitedDistricts: DistrictId[];
  topSpeedKmh: number;
  totalDistance: number;
  missionsCompletedCount: number;
  wantedEscapesCount: number;
}

export interface SaveGameData {
  version: 1;
  savedAt: number;
  money: number;
  health: number;
  completedMissionIds: string[];
  progression: ProgressionState;
  settings: GameSettings;
  playerPos?: { x: number; y: number; z: number; yaw: number };
  quizProgress?: {
    completedQuestionIds: string[];
    lockedQuestionIds: string[];
    earnedPoints: number;
  };
}

export interface InteriorFloorSlab {
  id: string;
  floorNumber: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  ceilingY: number;
  surface: 'wood' | 'tile' | 'carpet' | 'concrete' | 'marble';
  hasOpenSky?: boolean;
}

export interface InteriorStaircase {
  id: string;
  fromFloor: number;
  toFloor: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  yStart: number;
  yEnd: number;
  axis: 'x' | 'z';
  /** 1 means y rises as axis increases; -1 means y rises as axis decreases */
  direction: 1 | -1;
  isSwitchback?: boolean;
  midLanding?: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    y: number;
  };
}

export interface InteriorElevatorFloor {
  floorNumber: number;
  y: number;
  label: string;
  exitX: number;
  exitZ: number;
  exitYaw: number;
}

export interface InteriorElevator {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  floors: InteriorElevatorFloor[];
}

export interface InteriorWallBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  color: number;
  kind: 'wall' | 'partition' | 'pillar' | 'window_wall' | 'glass' | 'railing';
  blocksCamera: boolean;
  windowGlassColor?: number;
}

export interface InteriorDoorSpec {
  id: string;
  label: string;
  hingeX: number;
  y: number;
  hingeZ: number;
  closedYaw: number;
  openAngle: number;
  width: number;
  height: number;
  thickness: number;
  isExitDoor: boolean;
  color: number;
  style: 'wood' | 'glass' | 'metal';
}

export interface InteriorDoorState extends InteriorDoorSpec {
  isOpen: boolean;
  openProgress: number; // 0 (closed) .. 1 (open)
}

export type InteriorFurnitureKind =
  | 'sofa'
  | 'coffee_table'
  | 'dining_table'
  | 'bed'
  | 'desk'
  | 'reception_desk'
  | 'kitchen_counter'
  | 'shelf_rack'
  | 'cooler'
  | 'checkout_counter'
  | 'espresso_bar'
  | 'machinery'
  | 'car_lift'
  | 'workbench'
  | 'plant'
  | 'mailbox_bank'
  | 'tv_stand'
  | 'kiosk'
  | 'conference_table'
  | 'clothing_rack'
  | 'display_case'
  | 'mannequin_stand'
  | 'reward_kiosk';

export interface InteriorFurnitureProp {
  id: string;
  kind: InteriorFurnitureKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  width: number;
  height: number;
  depth: number;
  primaryColor: number;
  accentColor?: number;
  blocksCamera?: boolean;
}

export interface InteriorLightSpec {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  distance: number;
}

export interface InteriorBlueprint {
  id: string;
  buildingId: string;
  name: string;
  category: BuildingCategory;
  subtype: BuildingSubtype;
  floorsCount: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { x: number; y: number; z: number; yaw: number };
  floorSlabs: InteriorFloorSlab[];
  staircases: InteriorStaircase[];
  elevators: InteriorElevator[];
  walls: InteriorWallBox[];
  doors: InteriorDoorSpec[];
  furniture: InteriorFurnitureProp[];
  lights: InteriorLightSpec[];
  ambientColor: number;
  wallColor: number;
  ceilingColor: number;
  accentColor: number;
}

export interface CityLayout {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { x: number; y: number; z: number; yaw: number };
  roadCenters: number[];
  roadWidth: number;
  sidewalkWidth: number;
  sidewalkHeight: number;
  blocks: BlockZone[];
  buildings: BuildingSpec[];
  houses: HouseSpec[];
  entrances: BuildingEntranceSpec[];
  parkedVehicles: ParkedVehicleSpec[];
  containers: ContainerSpec[];
  trafficSigns: TrafficSignSpec[];
  trees: TreeSpec[];
  lamps: StreetLampSpec[];
  benches: BenchSpec[];
  fountains: FountainSpec[];
  landmarks: LandmarkPin[];
  npcLoops: NpcWaypointLoop[];
  colliders: ColliderBox[];
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  cameraYaw: number;
  cameraPitch: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  stamina: number;
  health: number;
  maxHealth: number;
  isSprinting: boolean;
  isMoving: boolean;
  speed: number;
  gaitPhase: number;
  distanceWalked: number;
  elapsedTime: number;
  squashY: number;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  moveX: number;
  moveY: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  timeOfDay: TimeOfDayPhase;
  timeLabel: string;
  district: DistrictId;
  districtName: string;
  speed: number;
  stamina: number;
  health: number;
  maxHealth: number;
  isSprinting: boolean;
  grounded: boolean;
  distanceWalked: number;
  elapsedTime: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  cameraYaw: number;
  pointerLocked: boolean;
  // Stage 3 fields
  money: number;
  wantedLevel: number;
  playerMode: PlayerControlMode;
  currentVehicleKind: VehicleKind | null;
  currentVehicleLabel: string | null;
  interactPrompt: {
    kind:
      | 'vehicle'
      | 'mission'
      | 'garage'
      | 'style'
      | 'building_enter'
      | 'building_exit'
      | 'interior_door'
      | 'elevator'
      | 'elevator_panel'
      | 'sit_seat'
      | 'quiz_kiosk'
      | 'reward_shop'
      | 'player_social';
    label: string;
  } | null;
  activeMission: {
    id: string;
    type: MissionType;
    title: string;
    targetLabel: string;
    targetX: number;
    targetZ: number;
    distanceToTarget: number;
    checkpointIndex: number;
    totalCheckpoints: number;
    timeRemaining: number;
    reward: number;
  } | null;
  missionBanner: {
    status: 'completed' | 'failed';
    title: string;
    reward: number;
    message: string;
  } | null;
  availableMissions: Array<{
    id: string;
    type: MissionType;
    title: string;
    x: number;
    z: number;
    color: string;
  }>;
  trafficMarkers: Array<{
    x: number;
    z: number;
    isPolice: boolean;
  }>;
  // Stage 4 fields
  progression: ProgressionState;
  challenges: ChallengeStatus[];
  completedMissionIds: string[];
  settings: GameSettings;
  activityToast: string | null;
  lastSavedAt: number | null;
  // Stage 5 fields
  interior: {
    active: boolean;
    buildingId: string;
    buildingName: string;
    category: BuildingCategory;
    subtype: BuildingSubtype;
    currentFloor: number;
    totalFloors: number;
    hasElevator: boolean;
    elevatorFloor?: number;
    elevatorMoving?: boolean;
    elevatorDoorState?: 'closed' | 'opening' | 'open' | 'closing';
    inElevatorCabin?: boolean;
  } | null;
  transitionFade: number;
  // Educational Quiz & Knowledge Point Economy fields
  quizPoints: number;
  knowledgePoints?: number;
  completedQuestionsCount: number;
  activeQuestionsCount: number;
  explorationObjectives?: Array<{
    id: string;
    title: string;
    description: string;
    current: number;
    target: number;
    completed: boolean;
    rewardPoints: number;
  }>;
  animState?: string;
  isSitting?: boolean;
  remotePlayerMarkers?: Array<{
    playerId: string;
    displayName: string;
    x: number;
    z: number;
    groupId?: string | null;
  }>;
  nearbyPlayers?: Array<{
    playerId: string;
    displayName: string;
    distance: number;
    animState: string;
    currentActivity: string;
  }>;
}
