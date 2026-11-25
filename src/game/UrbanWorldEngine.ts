import * as THREE from 'three';
import { ProceduralAudio } from './audio';
import {
  createCharacterAnimRuntime,
  stepCharacterAnimRuntime,
  triggerCharacterAction,
  type CharacterAnimRuntime,
  type CharacterAnimState,
  type EmoteKind,
} from './characterAnimator';
import {
  applyArticulatedPoseToRig,
  applyCharacterCustomization,
  createCharacterRig,
  createNpcRig,
  createPlayerNameplateRig,
  animateCharacterRig,
  animateNpcRig,
  type CharacterRig,
  type NpcRig,
  type PlayerNameplateRig,
} from './characterMesh';
import { buildCityScene, type BuiltCity } from './cityBuilder';
import {
  addWantedHeat,
  createInitialMissionRuntime,
  findNearestMissionStart,
  getMissionDefinition,
  MISSION_DEFINITIONS,
  setWantedLevel,
  startMission,
  stepMissionAndWanted,
  type MissionRuntimeState,
} from './missionSystem';
import {
  callElevatorToFloor,
  canExitElevatorCabin,
  createElevatorRuntimeState,
  isPointInElevatorCabin,
  selectElevatorFloor,
  stepElevatorRuntime,
  type ElevatorRuntimeState,
} from './elevatorSystem';
import {
  createInitialExplorationTracker,
  evaluateExplorationObjectives,
  recordVisitedBuilding,
  type ExplorationTrackerState,
} from './explorationObjectives';
import {
  createInterpolatedAvatar,
  shouldRenderRemoteAvatar,
  stepInterpolatedAvatar,
  type InterpolatedRemoteAvatar,
} from './multiplayerInterpolation';
import type {
  ElevatorSyncPayload,
  PlayerMovementState,
  RemotePlayerState,
} from './multiplayerTypes';
import { createInitialNpcs, stepNpcs } from './npcSystem';
import {
  createEmptyInput,
  createInitialPlayerState,
  dampValue,
  PLAYER_RADIUS,
  resolvePlayerVsNpcs,
  shortestAngleDelta,
  stepPlayerPhysics,
} from './playerPhysics';
import {
  cloneProgression,
  createDefaultSettings,
  createInitialProgressionState,
  evaluateChallenges,
  getChallengeStatuses,
  getUpgradedVehicleSpec,
  purchaseOrEquipAccessory,
  purchaseOrEquipOutfit,
  purchaseVehicle,
  purchaseVehicleUpgrade,
  recordVisitedDistrict,
  selectGarageVehicle,
  STARTING_CASH,
} from './progressionSystem';
import {
  clearSavedGame,
  loadGameFromStorage,
  saveGameToStorage,
} from './saveSystem';
import {
  buildInteriorScene,
  type BuiltInterior,
} from './interiorBuilder';
import { createInteriorBlueprintForEntrance } from './interiorData';
import {
  createInteriorDoorStates,
  findInteriorRooftopEntrySpawn,
  findNearestExteriorEntrance,
  findNearestInteriorInteractable,
  findNearestSittableProp,
  findSafeOutdoorExitPos,
  getInteriorFloorAndCeilingAt,
  raycastInteriorCamera,
  stepInteriorDoors,
  stepInteriorPlayerPhysics,
  type FloorCeilingInfo,
  type SittableSpot,
} from './interiorSystem';
import {
  findNearestExteriorLadder,
  findNearestRooftopInteriorDoor,
  findRooftopAt,
  stepLadderClimb,
} from './rooftopSystem';
import {
  buildSkyLifeVisuals,
  createSkyLifeState,
  stepSkyLifeState,
  type SkyLifeState,
  type SkyLifeSystemRig,
} from './skyLifeSystem';
import {
  toPlayerQuestion,
  toPublicQuestionDatabase,
} from './questionBank';
import {
  createInteriorKioskPlacements,
  createOutdoorKioskPlacements,
  findNearestQuizKiosk,
  getActiveQuestions,
} from './questionPlacement';
import { createLocalQuestionRepository } from './questionRepository';
import type {
  PlayerQuestionChallenge,
  PlayerQuizProgress,
  PlayerSubmissionOutcome,
  PublicQuestionDatabase,
  QuestionDatabase,
  QuizKioskPlacement,
} from './questionTypes';
import { createQuizKioskRig, type QuizKioskRig } from './quizKioskMesh';
import { createCityTextures, type CityTextures } from './textures';
import { nextTimeOfDay, TIME_PRESETS } from './timeOfDay';
import { stepTrafficAndPolice } from './trafficSystem';
import type {
  AccessoryId,
  AirportSpec,
  BuildingEntranceSpec,
  CharacterCustomization,
  CityId,
  DrivingInputState,
  ExteriorLadderSpec,
  GamePhase,
  GameSettings,
  GraphicsQuality,
  HudSnapshot,
  InputState,
  InteriorBlueprint,
  InteriorDoorState,
  InteriorElevatorFloor,
  NpcState,
  OutfitId,
  PhotoModeState,
  PlayerControlMode,
  PlayerState,
  ProgressionState,
  RooftopSpec,
  SaveGameData,
  TimeOfDayPhase,
  VehicleKind,
  VehicleState,
  VehicleUpgradeLevels,
} from './types';
import { createInitialVehicles, VEHICLE_SPECS } from './vehicleData';
import {
  animateVehicleRig,
  createVehicleRig,
  setVehiclePaintColor,
  type VehicleRig,
} from './vehicleMesh';
import {
  computeVehicleSeatWorldPos,
  createEmptyDrivingInput,
  findNearestInteractableVehicle,
  findSafeVehicleExitPos,
  resolveVehiclesPairwise,
  stepPlayerVehiclePhysics,
  VEHICLE_INTERACT_RANGE,
} from './vehiclePhysics';
import {
  CITY_LAYOUT,
  getCityAt,
  getDistrictAt,
  getGroundHeightAt,
  getWaterInfoAt,
  raycastCameraCollision,
  resolveCircleAABBCollision,
  WATER_SURFACE_Y,
} from './worldData';

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface EngineCallbacks {
  onSnapshot: (snap: HudSnapshot) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onMuteChange: (muted: boolean) => void;
  onContextError?: (message: string) => void;
  onOpenQuiz?: (challenge: PlayerQuestionChallenge) => void;
  onOpenElevator?: (params: {
    buildingName: string;
    elevatorId: string;
    currentFloor: number;
    targetFloor: number | null;
    moving: boolean;
    floors: InteriorElevatorFloor[];
  }) => void;
  onElevatorAction?: (action: {
    buildingId: string;
    elevatorId: string;
    action: 'call' | 'select';
    floor: number;
  }) => void;
  onOpenRewardShop?: () => void;
  onOpenFlightModal?: (params: {
    originAirportId: string;
    originAirportName: string;
    originAirportCode: string;
    originCityId: CityId;
    originCityName: string;
  }) => void;
  onTriggerSocialEmote?: (targetPlayerId: string, emote: EmoteKind) => void;
  onPhotoModeChange?: (state: PhotoModeState) => void;
}

const _tmpColor = new THREE.Color();

function createOutdoorEnvScene(): { scene: THREE.Scene; dispose: () => void } {
  const envScene = new THREE.Scene();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const skyGeo = new THREE.SphereGeometry(20, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x9cd3ff, side: THREE.BackSide });
  geos.push(skyGeo);
  mats.push(skyMat);
  envScene.add(new THREE.Mesh(skyGeo, skyMat));

  const horizonGeo = new THREE.CylinderGeometry(18, 18, 6, 24, 1, true);
  const horizonMat = new THREE.MeshBasicMaterial({ color: 0xe6f2ff, side: THREE.BackSide });
  geos.push(horizonGeo);
  mats.push(horizonMat);
  const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
  horizonMesh.position.y = 0.5;
  envScene.add(horizonMesh);

  const groundGeo = new THREE.CircleGeometry(18, 24);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x5c5b57 });
  geos.push(groundGeo);
  mats.push(groundMat);
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -3.0;
  envScene.add(groundMesh);

  const sunDiscGeo = new THREE.SphereGeometry(3.4, 16, 12);
  const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xfff3d4 });
  geos.push(sunDiscGeo);
  mats.push(sunDiscMat);
  const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
  sunDisc.position.set(8, 13, 6);
  envScene.add(sunDisc);

  const bounceGeo = new THREE.SphereGeometry(4.5, 12, 10);
  const bounceMat = new THREE.MeshBasicMaterial({ color: 0x7cb8eb });
  geos.push(bounceGeo);
  mats.push(bounceMat);
  const bounce = new THREE.Mesh(bounceGeo, bounceMat);
  bounce.position.set(-10, 8, -8);
  envScene.add(bounce);

  return {
    scene: envScene,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

interface MissionBeaconMesh {
  missionId: string;
  group: THREE.Group;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export class UrbanWorldEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private builtCity: BuiltCity;
  private isSoftwareGl: boolean;
  private audio = new ProceduralAudio();
  private textures!: CityTextures;
  private contactShadowTex!: THREE.Texture;

  // Stage 5: Building Interiors & Door Transitions
  private activeEntrance: BuildingEntranceSpec | null = null;
  private activeBlueprint: InteriorBlueprint | null = null;
  private activeBuiltInterior: BuiltInterior | null = null;
  private activeInteriorDoors: InteriorDoorState[] = [];
  private activeElevatorState: ElevatorRuntimeState | null = null;
  private currentInteriorFloor = 1;
  private prevInteriorFloor = 1;
  private outdoorReturnState: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    cameraYaw: number;
    cameraPitch: number;
  } | null = null;
  private buildingTransition: {
    kind: 'enter' | 'exit';
    timer: number;
    swapped: boolean;
    entrance?: BuildingEntranceSpec;
    targetFloor?: number;
    rooftopTarget?: { x: number; y: number; z: number; yaw: number };
  } | null = null;
  private transitionFade = 0;

  private activeLadder: ExteriorLadderSpec | null = null;
  private lastLadderClimbSpeed = 0;
  private activeRooftop: RooftopSpec | null = null;
  private skyLifeState!: SkyLifeState;
  private skyLifeRig!: SkyLifeSystemRig;

  private playerState: PlayerState;
  private playerRig: ReturnType<typeof createCharacterRig>;
  private playerAnimRuntime: CharacterAnimRuntime = createCharacterAnimRuntime();
  private activeSitSpot: SittableSpot | null = null;
  private prevPlayerYaw = 0;
  private prevPlayerY = 0;
  private prevTurnDeltaYaw = 0;
  private prevOnStairs = false;
  private explorationTracker: ExplorationTrackerState = createInitialExplorationTracker();
  private npcs: NpcState[];
  private npcRigs: NpcRig[] = [];

  private vehicles: VehicleState[] = [];
  private vehicleRigs: VehicleRig[] = [];
  private activeVehicleId: string | null = null;
  private playerMode: PlayerControlMode = 'on_foot';
  private transitionTimer = 0;
  private transitionDuration = 0.24;
  private transitionStartPos = { x: 0, y: 0, z: 0, yaw: 0 };
  private transitionEndPos = { x: 0, y: 0, z: 0, yaw: 0 };

  // Intercity Airplane Travel Sequence
  private flightJetGroup!: THREE.Group;
  private flightSequence: {
    originCityName: string;
    destCityId: CityId;
    destCityName: string;
    destAirportName: string;
    destAirportCode: string;
    startX: number;
    startZ: number;
    endX: number;
    endZ: number;
    arrivalSpawnX: number;
    arrivalSpawnZ: number;
    arrivalSpawnYaw: number;
    timer: number;
    duration: number;
  } | null = null;

  private missionRuntime: MissionRuntimeState = createInitialMissionRuntime();
  private missionBeacons: MissionBeaconMesh[] = [];
  private activeObjectiveBeacon: { group: THREE.Group; ring: THREE.Mesh; beam: THREE.Mesh };

  // Stage 4: Progression, Economy, Settings, Pooled Particles & Preview Camera
  private progression: ProgressionState = createInitialProgressionState();
  private knowledgePoints = 0;
  private settings: GameSettings = createDefaultSettings();
  private previewMode:
    | 'none'
    | 'customize'
    | 'garage'
    | 'teacher'
    | 'quiz'
    | 'session'
    | 'pin'
    | 'elevator'
    | 'shop'
    | 'flight'
    | 'emotes'
    | 'social'
    | 'photo' = 'none';
  private photoState: PhotoModeState = {
    active: false,
    pose: 'photo_cool',
    orbitYaw: 2.72,
    orbitPitch: 0.14,
    distance: 3.6,
    fov: 54,
    filter: 'natural',
    hideUi: false,
    panY: 0.12,
  };
  private activityToast: string | null = null;
  private activityToastTimer = 0;
  private lastSavedAt: number | null = null;
  private lastMilestoneDistance = 0;
  private prevWantedLevel = 0;
  private timeSinceDamage = 10;
  private particlePool: PooledParticle[] = [];

  // Educational Question Bank & 3D Quiz Kiosks (sanitized, never holds answer keys)
  private questionRepo = createLocalQuestionRepository();
  private questionDb: PublicQuestionDatabase;
  private quizProgress: PlayerQuizProgress;
  private outdoorKiosks: QuizKioskPlacement[] = [];
  private outdoorKioskRigs: QuizKioskRig[] = [];
  private interiorKiosks: QuizKioskPlacement[] = [];
  private interiorKioskRigs: QuizKioskRig[] = [];

  // Real-Time Multiplayer 3D Remote Avatars
  private selfMultiplayerId: string | null = null;
  private remoteAvatars = new Map<
    string,
    {
      state: InterpolatedRemoteAvatar;
      rig: CharacterRig;
      animRuntime: CharacterAnimRuntime;
      nameplate: PlayerNameplateRig;
      lastAvatarSig: string;
    }
  >();

  private input: InputState = createEmptyInput();
  private drivingInput: DrivingInputState = createEmptyDrivingInput();
  private phase: GamePhase = 'title';
  private timeOfDay: TimeOfDayPhase = 'siang';
  private sunOffset = new THREE.Vector3(52, 86, 42);

  // Camera follow smoothing vectors (zero-GC pre-allocated)
  private camPos = new THREE.Vector3(0, 4, 22);
  private camTarget = new THREE.Vector3(0, 1.5, 16);
  private camInitialized = false;
  private drivingCamOrbitYaw = 0;
  private manualOrbitCooldown = 0;
  private cameraTrauma = 0;

  private titleElapsed = 0;
  private worldElapsed = 0;
  private lastTickTime = 0;
  private lastHudPushTime = 0;
  private lastDistrictId = '';
  private frameId = 0;
  private isDisposed = false;

  // Pointer & touch camera state
  private isMouseDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private pointerLocked = false;
  private skipNextLockedMove = false;
  private cameraTouchId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;

  private disposeCallbacks: Array<() => void> = [];
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks, autostart: boolean) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(container.clientWidth, window.innerWidth, 320);
    const height = Math.max(container.clientHeight, window.innerHeight, 240);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Urban Life 3D City Viewport');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd7e9f6);
    this.scene.fog = new THREE.FogExp2(0xd7e9f6, 0.0021);

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.15, 1650);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const outdoorEnv = createOutdoorEnvScene();
    const envTex = pmremGenerator.fromScene(outdoorEnv.scene, 0.04).texture;
    this.scene.environment = envTex;
    outdoorEnv.dispose();
    pmremGenerator.dispose();
    this.disposeCallbacks.push(() => envTex.dispose());

    this.hemiLight = new THREE.HemisphereLight(0x9bc8eb, 0x5e564a, 0.8);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3dc, 2.05);
    this.sunLight.position.set(52, 86, 42);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 210;
    const shadowBound = 46;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.015;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Cool sky opposite fill / rim light for sculpted depth on faces, clothes, and facades
    this.fillLight = new THREE.DirectionalLight(0x9ecbff, 0.36);
    this.fillLight.position.set(-48, 38, -42);
    this.fillLight.castShadow = false;
    this.scene.add(this.fillLight);
    this.scene.add(this.fillLight.target);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const textures = createCityTextures(maxAniso);
    this.textures = textures;
    this.contactShadowTex = textures.contactShadowMap;
    this.builtCity = buildCityScene(CITY_LAYOUT, textures, !this.isSoftwareGl);
    this.scene.add(this.builtCity.group);

    this.skyLifeState = createSkyLifeState();
    this.skyLifeRig = buildSkyLifeVisuals(this.skyLifeState);
    this.scene.add(this.skyLifeRig.group);

    // Intercity Player Flight Jetliner (visible during active city-to-city flight)
    const fjGroup = new THREE.Group();
    const fjWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.24, metalness: 0.32 });
    const fjBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.32, metalness: 0.25 });
    const fjDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 });
    const fjGlass = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.14, metalness: 0.68 });
    const fjRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const fjGreen = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    const fjGeos: THREE.BufferGeometry[] = [];
    const tfg = <T extends THREE.BufferGeometry>(g: T): T => {
      fjGeos.push(g);
      return g;
    };
    const fjFuse = new THREE.Mesh(tfg(new THREE.CapsuleGeometry(1.15, 13.5, 8, 16)), fjWhite);
    fjFuse.rotation.x = Math.PI * 0.5;
    fjFuse.castShadow = !this.isSoftwareGl;
    const fjStripe = new THREE.Mesh(tfg(new THREE.CylinderGeometry(1.18, 1.18, 10.5, 14)), fjBlue);
    fjStripe.rotation.x = Math.PI * 0.5;
    fjStripe.scale.set(1, 1, 0.34);
    const fjCockpit = new THREE.Mesh(tfg(new THREE.SphereGeometry(0.95, 10, 8)), fjGlass);
    fjCockpit.scale.set(0.95, 0.6, 1.4);
    fjCockpit.position.set(0, 0.48, -6.2);
    const fjWingL = new THREE.Mesh(tfg(new THREE.BoxGeometry(8.2, 0.2, 2.3)), fjWhite);
    fjWingL.position.set(-4.1, -0.15, 0.4);
    fjWingL.rotation.y = 0.25;
    const fjWingR = new THREE.Mesh(tfg(new THREE.BoxGeometry(8.2, 0.2, 2.3)), fjWhite);
    fjWingR.position.set(4.1, -0.15, 0.4);
    fjWingR.rotation.y = -0.25;
    const fjEngGeo = tfg(new THREE.CylinderGeometry(0.45, 0.4, 1.8, 12));
    for (const ex of [-3.0, 3.0]) {
      const eng = new THREE.Mesh(fjEngGeo, fjDark);
      eng.rotation.x = Math.PI * 0.5;
      eng.position.set(ex, -0.58, 0);
      fjGroup.add(eng);
    }
    const fjTail = new THREE.Mesh(tfg(new THREE.BoxGeometry(0.22, 2.8, 2.1)), fjBlue);
    fjTail.position.set(0, 1.75, 6.2);
    fjTail.rotation.x = -0.28;
    const fjHTail = new THREE.Mesh(tfg(new THREE.BoxGeometry(5.2, 0.16, 1.3)), fjWhite);
    fjHTail.position.set(0, 0.35, 6.4);
    const fjNavL = new THREE.Mesh(tfg(new THREE.SphereGeometry(0.2, 6, 6)), fjRed);
    fjNavL.position.set(-7.9, -0.1, 1.45);
    const fjNavR = new THREE.Mesh(tfg(new THREE.SphereGeometry(0.2, 6, 6)), fjGreen);
    fjNavR.position.set(7.9, -0.1, 1.45);
    fjGroup.add(fjFuse, fjStripe, fjCockpit, fjWingL, fjWingR, fjTail, fjHTail, fjNavL, fjNavR);
    fjGroup.visible = false;
    this.flightJetGroup = fjGroup;
    this.scene.add(this.flightJetGroup);
    this.disposeCallbacks.push(() => {
      fjGeos.forEach((g) => g.dispose());
      [fjWhite, fjBlue, fjDark, fjGlass, fjRed, fjGreen].forEach((m) => m.dispose());
    });

    this.playerRig = createCharacterRig(textures.contactShadowMap, !this.isSoftwareGl, {
      fabricBumpMap: textures.fabricBumpMap,
      leatherBumpMap: textures.leatherBumpMap,
    });
    applyCharacterCustomization(this.playerRig, this.progression.customization);
    this.scene.add(this.playerRig.root);

    // Spawn autonomous sidewalk NPCs across all 4 districts
    this.npcs = createInitialNpcs(CITY_LAYOUT);
    for (const npc of this.npcs) {
      const npcRig = createNpcRig(npc.variant, textures.contactShadowMap, !this.isSoftwareGl);
      animateNpcRig(npcRig, npc, 0);
      this.scene.add(npcRig.root);
      this.npcRigs.push(npcRig);
    }

    // Spawn driveable vehicles, civilian traffic & police cruisers
    this.vehicles = createInitialVehicles(CITY_LAYOUT);
    for (const v of this.vehicles) {
      const vRig = createVehicleRig(v, textures.contactShadowMap, !this.isSoftwareGl);
      animateVehicleRig(vRig, v, 0, false);
      this.scene.add(vRig.root);
      this.vehicleRigs.push(vRig);
    }

    // Pre-allocate pooled impact/dust particles (zero runtime allocation)
    const particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (let i = 0; i < 24; i++) {
      const pm = new THREE.Mesh(particleGeo, particleMat);
      pm.visible = false;
      this.scene.add(pm);
      this.particlePool.push({
        mesh: pm,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
      });
    }
    this.disposeCallbacks.push(() => {
      particleGeo.dispose();
      particleMat.dispose();
    });

    // Create 3D Mission Start Beacons + Active Objective Beacon
    const beaconMats: THREE.Material[] = [];
    const beaconGeos: THREE.BufferGeometry[] = [];
    const ringGeo = new THREE.RingGeometry(1.4, 2.05, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const beamGeo = new THREE.CylinderGeometry(0.55, 0.9, 14, 16, 1, true);
    beaconGeos.push(ringGeo, beamGeo);

    for (const def of MISSION_DEFINITIONS) {
      const g = new THREE.Group();
      const gy = getGroundHeightAt(def.startX, def.startZ, CITY_LAYOUT);
      g.position.set(def.startX, gy + 0.04, def.startZ);

      const ringMat = new THREE.MeshBasicMaterial({
        color: def.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const beamMat = new THREE.MeshBasicMaterial({
        color: def.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      });
      beaconMats.push(ringMat, beamMat);

      const ring = new THREE.Mesh(ringGeo, ringMat);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 7.0;
      g.add(ring, beam);
      this.scene.add(g);
      this.missionBeacons.push({ missionId: def.id, group: g, ring, beam });
    }

    const activeGroup = new THREE.Group();
    const activeRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const activeBeamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    beaconMats.push(activeRingMat, activeBeamMat);

    const activeRingGeo = new THREE.RingGeometry(2.3, 3.2, 32);
    activeRingGeo.rotateX(-Math.PI / 2);
    const activeBeamGeo = new THREE.CylinderGeometry(0.95, 1.4, 26, 18, 1, true);
    beaconGeos.push(activeRingGeo, activeBeamGeo);

    const activeRing = new THREE.Mesh(activeRingGeo, activeRingMat);
    const activeBeam = new THREE.Mesh(activeBeamGeo, activeBeamMat);
    activeBeam.position.y = 13.0;
    activeGroup.add(activeRing, activeBeam);
    activeGroup.visible = false;
    this.scene.add(activeGroup);
    this.activeObjectiveBeacon = { group: activeGroup, ring: activeRing, beam: activeBeam };

    this.questionDb = toPublicQuestionDatabase(this.questionRepo.loadDatabase());
    this.quizProgress = this.questionRepo.loadPlayerProgress();
    this.rebuildOutdoorQuizKiosks();

    this.disposeCallbacks.push(() => {
      this.cleanupInterior();
      this.clearRemotePlayers();
      this.disposeKioskRigs(this.outdoorKioskRigs);
      textures.dispose();
      this.builtCity.dispose();
      this.skyLifeRig.dispose();
      this.playerRig.dispose();
      this.npcRigs.forEach((nr) => nr.dispose());
      this.vehicleRigs.forEach((vr) => vr.dispose());
      beaconGeos.forEach((g) => g.dispose());
      beaconMats.forEach((m) => m.dispose());
    });

    this.playerState = createInitialPlayerState(CITY_LAYOUT);
    this.missionRuntime.money = STARTING_CASH;
    animateCharacterRig(this.playerRig, this.playerState, 0, 0);
    this.applyTimeOfDayImmediate(this.timeOfDay);
    this.applyGraphicsQualitySettings(this.settings.graphicsQuality);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.setupListeners();
    this.setPhase(autostart ? 'playing' : 'title', true);
    if (autostart) {
      this.snapCameraBehindPlayer();
    } else {
      this.updateTitleCamera(0);
    }

    this.renderer.render(this.scene, this.camera);
    this.lastTickTime = performance.now();
    this.startLoop();
  }

  private applyTimeOfDayImmediate(phase: TimeOfDayPhase): void {
    const p = TIME_PRESETS[phase];
    this.builtCity.skyUniforms.topColor.value.setHex(p.skyTop);
    this.builtCity.skyUniforms.horizonColor.value.setHex(p.skyHorizon);
    this.builtCity.skyUniforms.sunColor.value.setHex(p.sunGlow);
    this.builtCity.skyUniforms.sunDir.value.set(...p.sunPosition).normalize();

    (this.scene.background as THREE.Color).setHex(p.fogColor);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.setHex(p.fogColor);
    fog.density = p.fogDensity;

    this.sunLight.color.setHex(p.sunColor);
    this.sunLight.intensity = p.sunIntensity;
    this.sunOffset.set(...p.sunPosition);

    this.hemiLight.color.setHex(p.hemiSky);
    this.hemiLight.groundColor.setHex(p.hemiGround);
    this.hemiLight.intensity = p.hemiIntensity;
    this.fillLight.color.setHex(p.hemiSky);
    this.fillLight.intensity = Math.max(0.18, p.hemiIntensity * 0.44);
    this.scene.environmentIntensity = p.envIntensity;

    this.builtCity.lampBulbMat.emissiveIntensity = p.lampEmissiveIntensity;
    this.builtCity.windowGlowMat.emissiveIntensity = p.windowEmissiveIntensity;
    for (const m of this.builtCity.buildingWindowMats) {
      m.emissiveIntensity = p.windowEmissiveIntensity * 0.72;
    }
    this.renderer.toneMappingExposure = p.exposure;
  }

  private updateTimeOfDayLighting(dt: number): void {
    const p = TIME_PRESETS[this.timeOfDay];
    const lambda = 5.5;
    const alpha = 1 - Math.exp(-lambda * dt);

    const camWater = getWaterInfoAt(
      this.camera.position.x,
      this.camera.position.z,
      this.camera.position.y,
      CITY_LAYOUT,
    );
    const cameraSubmerged =
      !this.activeBlueprint &&
      this.phase === 'playing' &&
      camWater.inWater &&
      this.camera.position.y < WATER_SURFACE_Y - 0.08;

    _tmpColor.setHex(p.skyTop);
    this.builtCity.skyUniforms.topColor.value.lerp(_tmpColor, alpha);
    _tmpColor.setHex(p.skyHorizon);
    this.builtCity.skyUniforms.horizonColor.value.lerp(_tmpColor, alpha);
    _tmpColor.setHex(p.sunGlow);
    this.builtCity.skyUniforms.sunColor.value.lerp(_tmpColor, alpha);

    this.builtCity.skyUniforms.sunDir.value.x = dampValue(
      this.builtCity.skyUniforms.sunDir.value.x,
      p.sunPosition[0],
      lambda,
      dt,
    );
    this.builtCity.skyUniforms.sunDir.value.y = dampValue(
      this.builtCity.skyUniforms.sunDir.value.y,
      p.sunPosition[1],
      lambda,
      dt,
    );
    this.builtCity.skyUniforms.sunDir.value.z = dampValue(
      this.builtCity.skyUniforms.sunDir.value.z,
      p.sunPosition[2],
      lambda,
      dt,
    );
    this.builtCity.skyUniforms.sunDir.value.normalize();

    const fog = this.scene.fog as THREE.FogExp2;
    if (cameraSubmerged) {
      const subAlpha = 1 - Math.exp(-9.5 * dt);
      _tmpColor.setHex(0x0b4f6c);
      (this.scene.background as THREE.Color).lerp(_tmpColor, subAlpha);
      fog.color.lerp(_tmpColor, subAlpha);
      fog.density = dampValue(fog.density, 0.025, 9.5, dt);

      _tmpColor.setHex(p.sunColor);
      this.sunLight.color.lerp(_tmpColor, alpha);
      this.sunLight.intensity = dampValue(this.sunLight.intensity, Math.max(0.55, p.sunIntensity * 0.58), 8, dt);

      _tmpColor.setHex(0x38bdf8);
      this.hemiLight.color.lerp(_tmpColor, subAlpha);
      this.fillLight.color.lerp(_tmpColor, subAlpha);
      _tmpColor.setHex(0x083344);
      this.hemiLight.groundColor.lerp(_tmpColor, subAlpha);
      this.hemiLight.intensity = dampValue(this.hemiLight.intensity, Math.max(0.75, p.hemiIntensity * 1.1), 8, dt);
      this.fillLight.intensity = Math.max(0.24, this.hemiLight.intensity * 0.5);
      this.scene.environmentIntensity = dampValue(this.scene.environmentIntensity, p.envIntensity * 0.65, 8, dt);
    } else {
      _tmpColor.setHex(p.fogColor);
      (this.scene.background as THREE.Color).lerp(_tmpColor, alpha);
      fog.color.lerp(_tmpColor, alpha);
      fog.density = dampValue(fog.density, p.fogDensity, lambda, dt);

      _tmpColor.setHex(p.sunColor);
      this.sunLight.color.lerp(_tmpColor, alpha);
      this.sunLight.intensity = dampValue(this.sunLight.intensity, p.sunIntensity, lambda, dt);

      _tmpColor.setHex(p.hemiSky);
      this.hemiLight.color.lerp(_tmpColor, alpha);
      this.fillLight.color.lerp(_tmpColor, alpha);
      _tmpColor.setHex(p.hemiGround);
      this.hemiLight.groundColor.lerp(_tmpColor, alpha);
      this.hemiLight.intensity = dampValue(this.hemiLight.intensity, p.hemiIntensity, lambda, dt);
      this.fillLight.intensity = Math.max(0.18, this.hemiLight.intensity * 0.44);
      this.scene.environmentIntensity = dampValue(
        this.scene.environmentIntensity,
        p.envIntensity,
        lambda,
        dt,
      );
    }

    this.sunOffset.x = dampValue(this.sunOffset.x, p.sunPosition[0], lambda, dt);
    this.sunOffset.y = dampValue(this.sunOffset.y, p.sunPosition[1], lambda, dt);
    this.sunOffset.z = dampValue(this.sunOffset.z, p.sunPosition[2], lambda, dt);

    this.builtCity.lampBulbMat.emissiveIntensity = dampValue(
      this.builtCity.lampBulbMat.emissiveIntensity,
      p.lampEmissiveIntensity,
      lambda,
      dt,
    );
    this.builtCity.windowGlowMat.emissiveIntensity = dampValue(
      this.builtCity.windowGlowMat.emissiveIntensity,
      p.windowEmissiveIntensity,
      lambda,
      dt,
    );
    const winTarget = p.windowEmissiveIntensity * 0.72;
    for (let i = 0; i < this.builtCity.buildingWindowMats.length; i++) {
      this.builtCity.buildingWindowMats[i].emissiveIntensity = dampValue(
        this.builtCity.buildingWindowMats[i].emissiveIntensity,
        winTarget,
        lambda,
        dt,
      );
    }
    this.renderer.toneMappingExposure = dampValue(
      this.renderer.toneMappingExposure,
      p.exposure,
      lambda,
      dt,
    );
  }

  public setTimeOfDay(next: TimeOfDayPhase): void {
    this.timeOfDay = next;
    this.settings.timeOfDay = next;
    this.audio.playUiClick();
    this.pushHudSnapshot(true);
  }

  public cycleTimeOfDay(): TimeOfDayPhase {
    this.timeOfDay = nextTimeOfDay(this.timeOfDay);
    this.settings.timeOfDay = this.timeOfDay;
    this.audio.playUiClick();
    this.pushHudSnapshot(true);
    return this.timeOfDay;
  }

  private setPhase(nextPhase: GamePhase, immediate = false): void {
    this.phase = nextPhase;
    document.body.dataset.state = nextPhase;
    document.body.dataset.mode = this.playerMode;
    this.audio.setPlayingState(nextPhase === 'playing');
    this.callbacks.onPhaseChange(nextPhase);
    if (nextPhase !== 'playing') {
      this.clearHeldInputs();
      this.audio.updateEngineSound(false, 0, 1);
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    }
    if (immediate) {
      this.pushHudSnapshot(true);
    }
  }

  private showActivityToast(msg: string, duration = 3.6): void {
    this.activityToast = msg;
    this.activityToastTimer = duration;
    this.pushHudSnapshot(true);
  }

  private applyGraphicsQualitySettings(quality: GraphicsQuality): void {
    this.settings.graphicsQuality = quality;
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const prevShadowSize = this.sunLight.shadow.mapSize.width;
    if (quality === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2.5));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
    }
    if (this.sunLight.shadow.map && prevShadowSize !== this.sunLight.shadow.mapSize.width) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.audio.playUiClick();
    this.applyGraphicsQualitySettings(quality);
    this.pushHudSnapshot(true);
  }

  public setMusicEnabled(enabled: boolean): void {
    this.settings.musicEnabled = enabled;
    this.audio.setMusicEnabled(enabled);
    this.audio.playUiClick();
    this.pushHudSnapshot(true);
  }

  private disposeKioskRigs(rigs: QuizKioskRig[]): void {
    for (let i = 0; i < rigs.length; i++) {
      this.scene.remove(rigs[i].group);
      rigs[i].dispose();
    }
    rigs.length = 0;
  }

  private rebuildOutdoorQuizKiosks(): void {
    this.disposeKioskRigs(this.outdoorKioskRigs);
    this.outdoorKiosks = createOutdoorKioskPlacements(
      this.questionDb,
      this.quizProgress,
      CITY_LAYOUT,
    );
    for (let i = 0; i < this.outdoorKiosks.length; i++) {
      const rig = createQuizKioskRig(
        this.outdoorKiosks[i],
        this.contactShadowTex,
        !this.isSoftwareGl,
      );
      rig.group.visible = !this.activeBlueprint;
      this.scene.add(rig.group);
      this.outdoorKioskRigs.push(rig);
    }
  }

  private rebuildInteriorQuizKiosks(): void {
    this.disposeKioskRigs(this.interiorKioskRigs);
    if (!this.activeBlueprint || !this.activeEntrance) {
      this.interiorKiosks = [];
      return;
    }
    this.interiorKiosks = createInteriorKioskPlacements(
      this.activeBlueprint,
      this.activeEntrance,
      this.questionDb,
      this.quizProgress,
    );
    for (let i = 0; i < this.interiorKiosks.length; i++) {
      const rig = createQuizKioskRig(
        this.interiorKiosks[i],
        this.contactShadowTex,
        !this.isSoftwareGl,
      );
      this.scene.add(rig.group);
      this.interiorKioskRigs.push(rig);
    }
  }

  public getPublicQuestionDatabase(): PublicQuestionDatabase {
    return this.questionDb;
  }

  public getPlayerQuizProgress(): PlayerQuizProgress {
    return this.quizProgress;
  }

  public applyPublicQuestionDatabase(
    nextDb: PublicQuestionDatabase,
    progress?: PlayerQuizProgress,
  ): void {
    this.questionDb = nextDb;
    if (progress) {
      this.quizProgress = progress;
    }
    this.rebuildOutdoorQuizKiosks();
    if (this.activeBlueprint) {
      this.rebuildInteriorQuizKiosks();
    }
    this.pushHudSnapshot(true);
  }

  public updateQuestionDatabase(nextDb: QuestionDatabase): void {
    this.questionDb = toPublicQuestionDatabase(nextDb);
    this.rebuildOutdoorQuizKiosks();
    if (this.activeBlueprint) {
      this.rebuildInteriorQuizKiosks();
    }
    this.pushHudSnapshot(true);
  }

  public setKnowledgePoints(kp: number): void {
    const safeKp = Math.max(0, Math.round(kp));
    if (safeKp !== this.knowledgePoints) {
      this.knowledgePoints = safeKp;
      this.pushHudSnapshot(true);
    }
  }

  public applySyncedCustomization(next: CharacterCustomization): void {
    this.progression.customization = {
      ...this.progression.customization,
      ...next,
    };
    applyCharacterCustomization(this.playerRig, this.progression.customization);
    this.saveGame(true);
    this.renderer.render(this.scene, this.camera);
    this.pushHudSnapshot(true);
  }

  public playRewardAnimation(kind: 'kp' | 'accessory' | 'rare_outfit'): void {
    if (this.playerMode !== 'on_foot') return;
    if (this.activeSitSpot) this.activeSitSpot = null;
    if (kind === 'kp') {
      triggerCharacterAction(this.playerAnimRuntime, 'kp_excited', 2.2, false, 'celebrate');
    } else if (kind === 'accessory') {
      triggerCharacterAction(this.playerAnimRuntime, 'show_accessory', 2.4, false, 'show_accessory');
    } else {
      triggerCharacterAction(this.playerAnimRuntime, 'rare_outfit_celebrate', 2.6, false, 'celebrate');
    }
    this.pushHudSnapshot(true);
  }

  public applyServerQuizOutcome(
    nextProgress: PlayerQuizProgress,
    outcome: PlayerSubmissionOutcome,
  ): void {
    this.quizProgress = nextProgress;

    if (outcome.isCorrect) {
      this.audio.playCheckpoint();
      triggerCharacterAction(
        this.playerAnimRuntime,
        outcome.pointsAwarded >= 30 ? 'kp_excited' : 'celebrate',
        2.1,
        false,
        'celebrate',
      );
      if (outcome.cashBonusAwarded > 0) {
        this.missionRuntime.money += outcome.cashBonusAwarded;
        this.audio.playCash();
      }
      if (outcome.pointsAwarded > 0) {
        this.showActivityToast(
          outcome.cashBonusAwarded > 0
            ? `Correct! +${outcome.pointsAwarded} KP & +$${outcome.cashBonusAwarded}`
            : `Correct! +${outcome.pointsAwarded} KP`,
        );
      }
      this.saveGame(true);
    } else {
      this.audio.playError();
      triggerCharacterAction(this.playerAnimRuntime, 'disappoint', 1.4, false);
    }

    this.rebuildOutdoorQuizKiosks();
    if (this.activeBlueprint) {
      this.rebuildInteriorQuizKiosks();
    }
    this.pushHudSnapshot(true);
  }

  public triggerEmote(emote: EmoteKind): void {
    if (this.phase !== 'playing' || this.playerMode !== 'on_foot') return;
    this.audio.unlock();
    if (emote === 'sit') {
      this.toggleSit();
      return;
    }
    if (this.activeSitSpot) {
      this.activeSitSpot = null;
    }
    const stateMap: Record<Exclude<EmoteKind, 'sit'>, CharacterAnimState> = {
      wave: 'wave',
      greet: 'greet',
      clap: 'clap',
      dance: 'dance',
      point: 'point',
      celebrate: 'celebrate',
      victory: 'victory',
      laugh: 'laugh',
      handshake: 'handshake',
      high_five: 'high_five',
      show_accessory: 'show_accessory',
    };
    const duration = emote === 'dance' ? 4.2 : 2.4;
    triggerCharacterAction(this.playerAnimRuntime, stateMap[emote], duration, false, emote);
    if (emote === 'handshake' || emote === 'high_five' || emote === 'greet' || emote === 'wave') {
      const localBuilding = this.activeBlueprint ? this.activeBlueprint.buildingId : null;
      let nearestId: string | null = null;
      let nearestDist = 4.8;
      for (const entry of this.remoteAvatars.values()) {
        if ((entry.state.target.currentBuilding || null) !== localBuilding) continue;
        const d = Math.hypot(entry.state.x - this.playerState.x, entry.state.z - this.playerState.z);
        if (d < nearestDist) {
          nearestDist = d;
          nearestId = entry.state.playerId;
        }
      }
      if (nearestId) {
        this.callbacks.onTriggerSocialEmote?.(nearestId, emote);
      }
    }
    this.audio.playUiClick();
    this.pushHudSnapshot(true);
  }

  public toggleSit(): void {
    if (this.phase !== 'playing' || this.playerMode !== 'on_foot') return;
    this.audio.unlock();
    if (this.activeSitSpot) {
      this.activeSitSpot = null;
      triggerCharacterAction(this.playerAnimRuntime, 'stand', 0.65, false);
      this.audio.playUiClick();
      this.pushHudSnapshot(true);
      return;
    }

    if (this.activeBlueprint) {
      const seat = findNearestSittableProp(
        this.playerState.x,
        this.playerState.y,
        this.playerState.z,
        this.activeBlueprint,
        2.5,
      );
      if (seat) {
        this.activeSitSpot = seat;
        this.playerState.x = seat.x;
        this.playerState.y = seat.y;
        this.playerState.z = seat.z;
        this.playerState.yaw = seat.yaw;
        this.playerState.vx = 0;
        this.playerState.vz = 0;
        this.audio.playUiClick();
        this.pushHudSnapshot(true);
        return;
      }
    } else {
      let bestBench: { x: number; y: number; z: number; rotY: number; dist: number } | null = null;
      for (const b of CITY_LAYOUT.benches) {
        const d = Math.hypot(this.playerState.x - b.x, this.playerState.z - b.z);
        if (d <= 2.5 && (!bestBench || d < bestBench.dist)) {
          bestBench = { ...b, dist: d };
        }
      }
      if (bestBench) {
        this.activeSitSpot = {
          id: 'city_bench',
          label: 'City Bench',
          x: bestBench.x,
          y: bestBench.y + 0.08,
          z: bestBench.z,
          yaw: bestBench.rotY,
          distance: bestBench.dist,
        };
        this.playerState.x = this.activeSitSpot.x;
        this.playerState.y = this.activeSitSpot.y;
        this.playerState.z = this.activeSitSpot.z;
        this.playerState.yaw = this.activeSitSpot.yaw;
        this.playerState.vx = 0;
        this.playerState.vz = 0;
        this.audio.playUiClick();
        this.pushHudSnapshot(true);
        return;
      }
    }

    // Fallback ground sit / relax pose anywhere
    this.activeSitSpot = {
      id: 'ground_sit',
      label: 'Relax',
      x: this.playerState.x,
      y: this.playerState.y,
      z: this.playerState.z,
      yaw: this.playerState.yaw,
      distance: 0,
    };
    this.playerState.vx = 0;
    this.playerState.vz = 0;
    this.audio.playUiClick();
    this.pushHudSnapshot(true);
  }

  public selectElevatorFloorFromUi(floorNumber: number): void {
    if (!this.activeBlueprint || !this.activeElevatorState) return;
    const el = this.activeBlueprint.elevators.find(
      (e) => e.id === this.activeElevatorState?.elevatorId,
    );
    if (!el) return;
    this.audio.unlock();
    selectElevatorFloor(this.activeElevatorState, floorNumber, el.floors);
    triggerCharacterAction(this.playerAnimRuntime, 'press_button', 0.8, false);
    this.audio.playUiClick();
    this.activeBuiltInterior?.syncElevator(this.activeElevatorState);
    this.callbacks.onElevatorAction?.({
      buildingId: this.activeBlueprint.buildingId,
      elevatorId: el.id,
      action: 'select',
      floor: floorNumber,
    });
    if (this.previewMode === 'elevator') {
      this.setPreviewMode('none');
    }
    this.pushHudSnapshot(true);
  }

  public openElevatorPanel(): void {
    if (this.phase !== 'playing' || !this.activeBlueprint || !this.activeElevatorState) return;
    const el = this.activeBlueprint.elevators.find(
      (e) => e.id === this.activeElevatorState?.elevatorId,
    );
    if (!el || !this.callbacks.onOpenElevator) return;
    triggerCharacterAction(this.playerAnimRuntime, 'press_button', 0.8, false);
    this.audio.playUiClick();
    this.setPreviewMode('elevator');
    this.callbacks.onOpenElevator({
      buildingName: this.activeBlueprint.name,
      elevatorId: el.id,
      currentFloor: this.activeElevatorState.currentFloor,
      targetFloor: this.activeElevatorState.targetFloor,
      moving: this.activeElevatorState.moving,
      floors: el.floors,
    });
  }

  public applyRemoteElevatorState(payload: ElevatorSyncPayload): void {
    if (
      !this.activeBlueprint ||
      this.activeBlueprint.buildingId !== payload.buildingId ||
      !this.activeElevatorState ||
      this.activeElevatorState.elevatorId !== payload.elevatorId
    ) {
      return;
    }
    const el = this.activeBlueprint.elevators.find((e) => e.id === payload.elevatorId);
    if (!el) return;
    const wasInCabin = isPointInElevatorCabin(
      this.playerState.x,
      this.playerState.y,
      this.playerState.z,
      el,
      this.activeElevatorState.currentY,
      0.22,
    );
    if (Math.abs(this.activeElevatorState.currentY - payload.currentY) > 0.45) {
      this.activeElevatorState.currentY = payload.currentY;
    }
    this.activeElevatorState.currentFloor = payload.currentFloor;
    this.activeElevatorState.targetFloor = payload.targetFloor;
    this.activeElevatorState.direction = payload.direction;
    this.activeElevatorState.doorState = payload.doorState;
    if (Math.abs(this.activeElevatorState.doorProgress - payload.doorProgress) > 0.25) {
      this.activeElevatorState.doorProgress = payload.doorProgress;
    }
    this.activeElevatorState.moving = payload.moving;
    if (wasInCabin) {
      this.playerState.y = this.activeElevatorState.currentY;
      this.currentInteriorFloor = this.activeElevatorState.currentFloor;
    }
    this.activeBuiltInterior?.syncElevator(this.activeElevatorState);
  }

  private formatActivityTag(remote: RemotePlayerState): string | null {
    if (remote.emoteKind) {
      return remote.emoteKind.toUpperCase();
    }
    if (remote.animState === 'climb_stairs' || remote.animState === 'descend_stairs') {
      return 'Stairs';
    }
    if (remote.currentActivity === 'Answering Quiz') {
      return 'Quiz';
    }
    if (remote.currentBuilding) {
      return `F${remote.currentFloor}`;
    }
    return null;
  }

  public setMultiplayerPlayers(selfPlayerId: string | null, players: RemotePlayerState[]): void {
    this.selfMultiplayerId = selfPlayerId;
    const activeIds = new Set<string>();
    let overlapAtDefaultSpawn = false;
    const nearDefaultSpawn =
      !this.activeBlueprint &&
      this.playerMode === 'on_foot' &&
      Math.hypot(this.playerState.x, this.playerState.z - 16) < 0.75;

    for (const p of players) {
      if (selfPlayerId && p.playerId === selfPlayerId) continue;
      if (p.connectionStatus === 'offline') continue;
      if (
        nearDefaultSpawn &&
        !p.currentBuilding &&
        Math.hypot(p.position.x - this.playerState.x, p.position.z - this.playerState.z) < 1.25
      ) {
        overlapAtDefaultSpawn = true;
      }
      activeIds.add(p.playerId);
      this.upsertRemotePlayer(p);
    }

    if (overlapAtDefaultSpawn && selfPlayerId) {
      let hash = 0;
      for (let i = 0; i < selfPlayerId.length; i++) {
        hash = (hash * 31 + selfPlayerId.charCodeAt(i)) | 0;
      }
      const laneOffsets = [-2.4, -1.45, 1.45, 2.4, -3.2, 3.2];
      const slotX = laneOffsets[Math.abs(hash) % laneOffsets.length];
      const slotZ = 16 + (((Math.abs(hash) >> 3) % 3) - 1) * 0.9;
      this.playerState.x = slotX;
      this.playerState.z = slotZ;
    }

    for (const existingId of [...this.remoteAvatars.keys()]) {
      if (!activeIds.has(existingId)) {
        this.removeRemotePlayer(existingId);
      }
    }
    this.pushHudSnapshot(true);
  }

  private getAvatarSignature(a: CharacterCustomization): string {
    return [
      a.outfitId,
      a.jacketColor,
      a.pantsColor,
      a.shoeColor,
      a.accessoryId,
      a.characterPresetId || '',
      a.bodyType || '',
      a.skinTone ?? '',
      a.hairStyle || '',
      a.hairColor ?? '',
      a.faceStyle || '',
      a.topStyle || '',
      a.pantsStyle || '',
      a.shoeStyle || '',
      a.hatId || '',
      a.glassesId || '',
      a.watchId || '',
      a.backpackId || '',
      a.neckId || '',
    ].join('_');
  }

  public upsertRemotePlayer(remote: RemotePlayerState): void {
    if (this.selfMultiplayerId && remote.playerId === this.selfMultiplayerId) return;
    if (remote.connectionStatus === 'offline') {
      this.removeRemotePlayer(remote.playerId);
      return;
    }

    const avatarSig = this.getAvatarSignature(remote.avatar);
    const existing = this.remoteAvatars.get(remote.playerId);
    if (existing) {
      existing.state.target = remote;
      existing.state.lastServerAt = remote.updatedAt;
      if (remote.emoteSeq && remote.emoteSeq !== existing.state.lastEmoteSeq && remote.emoteKind) {
        existing.state.lastEmoteSeq = remote.emoteSeq;
        existing.state.activeEmote = remote.emoteKind;
        if (remote.emoteKind !== 'sit') {
          triggerCharacterAction(
            existing.animRuntime,
            remote.emoteKind,
            remote.emoteKind === 'dance' ? 4.0 : 2.3,
            false,
            remote.emoteKind,
          );
        }
      }
      if (existing.lastAvatarSig !== avatarSig) {
        applyCharacterCustomization(existing.rig, remote.avatar);
        existing.lastAvatarSig = avatarSig;
      }
      existing.nameplate.update(
        remote.displayName,
        remote.connectionStatus === 'online',
        this.formatActivityTag(remote),
      );
      return;
    }

    const rig = createCharacterRig(this.contactShadowTex, false, {
      fabricBumpMap: this.textures.fabricBumpMap,
      leatherBumpMap: this.textures.leatherBumpMap,
    });
    applyCharacterCustomization(rig, remote.avatar);
    const nameplate = createPlayerNameplateRig(
      remote.displayName,
      remote.connectionStatus === 'online',
      this.formatActivityTag(remote),
    );
    rig.root.add(nameplate.sprite);
    rig.root.position.set(remote.position.x, remote.position.y, remote.position.z);
    rig.root.rotation.y = remote.rotation.yaw;
    this.scene.add(rig.root);

    this.remoteAvatars.set(remote.playerId, {
      state: createInterpolatedAvatar(remote),
      rig,
      animRuntime: createCharacterAnimRuntime(),
      nameplate,
      lastAvatarSig: avatarSig,
    });
  }

  public removeRemotePlayer(playerId: string): void {
    const entry = this.remoteAvatars.get(playerId);
    if (!entry) return;
    this.scene.remove(entry.rig.root);
    entry.nameplate.dispose();
    entry.rig.dispose();
    this.remoteAvatars.delete(playerId);
  }

  public clearRemotePlayers(): void {
    for (const id of [...this.remoteAvatars.keys()]) {
      this.removeRemotePlayer(id);
    }
    this.selfMultiplayerId = null;
  }

  public getLocalMultiplayerState() {
    const activeVehicle = this.getActiveVehicle();
    let movementState: PlayerMovementState = 'idle';
    if (this.playerMode === 'flying') {
      movementState = 'flying';
    } else if (this.playerMode === 'driving') {
      movementState = 'driving';
    } else if (this.playerState.inWater) {
      movementState = this.playerState.isUnderwater ? 'diving' : 'swimming';
    } else if (!this.playerState.grounded) {
      movementState = 'jumping';
    } else if (this.playerState.isMoving) {
      movementState = this.playerState.isSprinting ? 'running' : 'walking';
    }

    const currentActivity = this.playerMode === 'flying'
      ? `Flying to ${this.flightSequence?.destCityName ?? 'City'}`
      : this.previewMode === 'quiz'
        ? 'Answering Quiz'
        : this.activeSitSpot
          ? 'Seated'
          : this.activeBlueprint
            ? `Inside ${this.activeBlueprint.name}`
            : this.playerMode === 'driving' && activeVehicle
              ? activeVehicle.kind === 'submarine'
                ? 'Diving Submarine'
                : `Driving ${activeVehicle.label}`
              : this.playerState.isUnderwater
                ? 'Diving Ocean Reef'
                : this.playerState.inWater
                  ? 'Swimming in Bay'
                  : this.missionRuntime.activeMission
                    ? `Mission: ${this.missionRuntime.activeMission.title}`
                    : 'Exploring City';

    return {
      position: {
        x: Math.round(this.playerState.x * 100) / 100,
        y: Math.round(this.playerState.y * 100) / 100,
        z: Math.round(this.playerState.z * 100) / 100,
      },
      rotation: { yaw: Math.round(this.playerState.yaw * 1000) / 1000 },
      movementState,
      animState: this.playerAnimRuntime.currentState,
      emoteKind: this.playerAnimRuntime.emoteKind,
      emoteSeq: this.playerAnimRuntime.emoteSeq,
      speed: Math.round(this.playerState.speed * 100) / 100,
      grounded: this.playerState.grounded,
      onStairs: this.prevOnStairs,
      onSeat: Boolean(this.activeSitSpot),
      climbingLadder: Boolean(this.activeLadder),
      turnDeltaYaw: Math.round(this.prevTurnDeltaYaw * 100) / 100,
      photoPose: this.previewMode === 'photo' ? this.photoState.pose : null,
      vehicleKind: activeVehicle ? activeVehicle.kind : null,
      currentBuilding: this.activeBlueprint ? this.activeBlueprint.buildingId : null,
      currentFloor: this.activeBlueprint ? this.currentInteriorFloor : 1,
      currentActivity,
      avatar: this.progression.customization,
    };
  }

  private stepRemoteAvatars(dt: number, elapsed: number): void {
    const localBuilding = this.activeBlueprint ? this.activeBlueprint.buildingId : null;
    const localFloor = this.activeBlueprint ? this.currentInteriorFloor : 1;
    const localElevator = this.activeBlueprint?.elevators[0];
    const localInElevator =
      localElevator && this.activeElevatorState
        ? isPointInElevatorCabin(
            this.playerState.x,
            this.playerState.y,
            this.playerState.z,
            localElevator,
            this.activeElevatorState.currentY,
            0.22,
          )
        : false;

    for (const entry of this.remoteAvatars.values()) {
      stepInterpolatedAvatar(entry.state, dt);
      const t = entry.state.target;
      const remoteInSharedElev =
        localInElevator &&
        Boolean(localElevator && this.activeElevatorState) &&
        isPointInElevatorCabin(
          t.position.x,
          t.position.y,
          t.position.z,
          localElevator!,
          this.activeElevatorState!.currentY,
          0.35,
        );
      const visible = shouldRenderRemoteAvatar(t, localBuilding, localFloor, {
        inSharedElevator: remoteInSharedElev,
      });
      entry.rig.root.visible = visible;
      if (!visible) continue;

      stepCharacterAnimRuntime(
        entry.animRuntime,
        {
          speed: entry.state.speed,
          vy: 0,
          grounded: entry.state.grounded,
          isSprinting: t.movementState === 'running',
          isMoving:
            entry.state.speed > 0.28 ||
            t.movementState === 'walking' ||
            t.movementState === 'running' ||
            t.movementState === 'swimming' ||
            t.movementState === 'diving',
          isDriving: t.movementState === 'driving',
          isMotorcycle: t.vehicleKind === 'motor' || t.vehicleKind === 'jetski' || t.vehicleKind === 'speedboat',
          onStairs: entry.state.onStairs,
          stairDirection: t.animState === 'descend_stairs' ? 'down' : t.animState === 'climb_stairs' ? 'up' : 'none',
          climbingLadder: entry.state.climbingLadder || t.animState === 'climb_ladder',
          climbSpeed: entry.state.speed,
          turnDeltaYaw: entry.state.turnDeltaYaw,
          photoPose: (entry.state.photoPose as PhotoModeState['pose'] | null) ?? null,
          backward: t.animState === 'walk_backward',
          sitting: entry.state.onSeat || t.animState === 'sit' || entry.state.photoPose === 'sit',
          swimming: t.movementState === 'swimming' || t.movementState === 'diving',
          underwater: t.movementState === 'diving',
          elapsedTime: elapsed,
        },
        dt,
      );
      applyArticulatedPoseToRig(
        entry.rig,
        entry.animRuntime.pose,
        entry.state.x,
        entry.state.y,
        entry.state.z,
        entry.state.yaw,
        entry.state.y,
        1,
      );
    }
  }

  private openQuizForKiosk(kiosk: QuizKioskPlacement): void {
    const activeQs = getActiveQuestions(this.questionDb);
    const targetQ =
      activeQs.find((q) => q.id === kiosk.nextQuestionId) ||
      activeQs.find((q) => kiosk.questionIds.includes(q.id));
    if (!targetQ) {
      this.showActivityToast('No active questions at this terminal yet.');
      return;
    }
    const style = kiosk.visualStyle ?? 'terminal';
    if (style === 'book' || style === 'card') {
      triggerCharacterAction(this.playerAnimRuntime, 'examine_book', 1.5, false);
    } else if (style === 'tablet') {
      triggerCharacterAction(this.playerAnimRuntime, 'use_tablet', 1.5, false);
    } else if (style === 'crystal' || style === 'artifact') {
      triggerCharacterAction(this.playerAnimRuntime, 'pickup', 1.2, false);
    } else {
      triggerCharacterAction(this.playerAnimRuntime, 'press_button', 1.0, false);
    }
    const challenge = toPlayerQuestion(targetQ, this.questionDb, this.quizProgress);
    this.audio.playUiClick();
    this.setPreviewMode('quiz');
    this.callbacks.onOpenQuiz?.(challenge);
  }

  public getPhotoModeState(): PhotoModeState {
    return { ...this.photoState };
  }

  public enterPhotoMode(): boolean {
    if (this.phase !== 'playing' || this.playerMode !== 'on_foot' || this.activeLadder || this.buildingTransition) {
      return false;
    }
    this.photoState = {
      ...this.photoState,
      active: true,
      orbitYaw: this.playerState.yaw + Math.PI - 0.42,
      orbitPitch: 0.14,
    };
    this.callbacks.onPhotoModeChange?.({ ...this.photoState });
    this.setPreviewMode('photo');
    this.audio.playUiClick();
    return true;
  }

  public exitPhotoMode(): void {
    if (!this.photoState.active && this.previewMode !== 'photo') return;
    this.photoState = { ...this.photoState, active: false };
    this.camera.fov = this.activeBlueprint ? 72 : 62;
    this.camera.updateProjectionMatrix();
    this.callbacks.onPhotoModeChange?.({ ...this.photoState });
    this.setPreviewMode('none');
    this.audio.playUiClick();
  }

  public updatePhotoModeState(patch: Partial<PhotoModeState>): void {
    this.photoState = { ...this.photoState, ...patch };
    if (patch.fov !== undefined && this.previewMode === 'photo') {
      this.camera.fov = this.photoState.fov;
      this.camera.updateProjectionMatrix();
    }
    this.callbacks.onPhotoModeChange?.({ ...this.photoState });
  }

  public capturePhotoSnapshot(): string | null {
    this.audio.playCheckpoint();
    this.updatePhotoModeCamera(0.05);
    this.renderer.render(this.scene, this.camera);
    const glCanvas = this.renderer.domElement;
    if (this.photoState.filter === 'natural') {
      return glCanvas.toDataURL('image/png');
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = glCanvas.width;
    offscreen.height = glCanvas.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return glCanvas.toDataURL('image/png');
    const filterCss =
      this.photoState.filter === 'golden'
        ? 'sepia(0.28) saturate(1.24) contrast(1.06) brightness(1.04)'
        : this.photoState.filter === 'cinema'
          ? 'contrast(1.18) saturate(0.84) brightness(0.95)'
          : 'saturate(1.38) contrast(1.08) brightness(1.03)';
    ctx.filter = filterCss;
    ctx.drawImage(glCanvas, 0, 0);
    return offscreen.toDataURL('image/png');
  }

  public setPreviewMode(
    mode:
      | 'none'
      | 'customize'
      | 'garage'
      | 'teacher'
      | 'quiz'
      | 'session'
      | 'pin'
      | 'elevator'
      | 'shop'
      | 'flight'
      | 'emotes'
      | 'social'
      | 'photo',
  ): void {
    this.previewMode = mode;
    if (mode !== 'photo' && this.photoState.active) {
      this.photoState = { ...this.photoState, active: false };
      this.callbacks.onPhotoModeChange?.({ ...this.photoState });
    }
    if (mode !== 'none') {
      this.clearHeldInputs();
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
      if (mode === 'customize') {
        this.playerRig.root.visible = true;
        this.snapCustomizePreviewCamera();
        this.renderer.render(this.scene, this.camera);
      } else if (mode === 'photo') {
        this.playerRig.root.visible = true;
        this.camera.fov = this.photoState.fov;
        this.camera.updateProjectionMatrix();
        this.updatePhotoModeCamera(0.2);
        this.renderer.render(this.scene, this.camera);
      }
    } else if (this.playerMode === 'driving') {
      const activeV = this.getActiveVehicle();
      if (
        activeV &&
        !VEHICLE_SPECS[activeV.kind].isMotorcycle &&
        activeV.kind !== 'jetski' &&
        activeV.kind !== 'speedboat'
      ) {
        this.playerRig.root.visible = false;
      }
    } else {
      this.camera.fov = this.activeBlueprint ? 72 : 62;
      this.camera.updateProjectionMatrix();
      this.camInitialized = false;
      if (this.activeBlueprint) {
        this.snapInteriorCamera();
      } else {
        this.snapCameraBehindPlayer();
      }
      this.renderer.render(this.scene, this.camera);
    }
    this.pushHudSnapshot(true);
  }

  private cleanupInterior(): void {
    this.disposeKioskRigs(this.interiorKioskRigs);
    this.interiorKiosks = [];
    if (this.activeBuiltInterior) {
      this.scene.remove(this.activeBuiltInterior.group);
      this.activeBuiltInterior.dispose();
      this.activeBuiltInterior = null;
    }
    this.activeBlueprint = null;
    this.activeEntrance = null;
    this.activeInteriorDoors = [];
    this.activeElevatorState = null;
    this.activeSitSpot = null;
    this.activeLadder = null;
    this.activeRooftop = null;
    this.currentInteriorFloor = 1;
    this.prevInteriorFloor = 1;
    this.outdoorReturnState = null;
    this.buildingTransition = null;
    this.transitionFade = 0;
    this.builtCity.group.visible = true;
    this.skyLifeRig.group.visible = true;
    this.outdoorKioskRigs.forEach((kr) => {
      kr.group.visible = true;
    });
    this.builtCity.exteriorDoors.forEach((rig) => {
      rig.targetOpen = false;
      rig.setOpenProgress(0);
    });
    delete document.body.dataset.interior;
  }

  private resetWorldState(resetProgression = true): void {
    this.cleanupInterior();
    this.applyTimeOfDayImmediate(this.timeOfDay);
    this.playerState = createInitialPlayerState(CITY_LAYOUT);
    this.playerAnimRuntime = createCharacterAnimRuntime();
    this.activeSitSpot = null;
    this.prevOnStairs = false;
    this.npcs = createInitialNpcs(CITY_LAYOUT);
    this.vehicles = createInitialVehicles(CITY_LAYOUT);
    this.missionRuntime = createInitialMissionRuntime();
    this.missionRuntime.money = STARTING_CASH;
    if (resetProgression) {
      this.progression = createInitialProgressionState();
      this.explorationTracker = createInitialExplorationTracker();
      this.quizProgress = this.questionRepo.resetPlayerProgress();
      this.rebuildOutdoorQuizKiosks();
      this.lastMilestoneDistance = 0;
      this.prevWantedLevel = 0;
      this.lastSavedAt = null;
    }
    applyCharacterCustomization(this.playerRig, this.progression.customization);
    this.syncGarageVehicleInWorld(false);
    this.activeVehicleId = null;
    this.flightSequence = null;
    this.flightJetGroup.visible = false;
    this.playerMode = 'on_foot';
    this.playerRig.root.visible = true;
    this.drivingCamOrbitYaw = 0;
    this.cameraTrauma = 0;
    this.activityToast = null;
    this.activityToastTimer = 0;
    document.body.dataset.mode = this.playerMode;
  }

  private syncGarageVehicleInWorld(repositionNearPlayer: boolean): void {
    const kind = this.progression.activeGarageVehicle;
    const paint = this.progression.vehicleColors[kind];
    let idx = this.vehicles.findIndex((v) => v.id === 'veh_player_garage');
    const spec = VEHICLE_SPECS[kind];

    const isMarine = spec.domain === 'water' || spec.domain === 'submersible';
    const spawnDraft = spec.draftDepth ?? 0.35;

    if (idx === -1) {
      const sx = isMarine ? 120 : 3.1;
      const sz = isMarine ? 48 : 21.5;
      const personal: VehicleState = {
        id: 'veh_player_garage',
        kind,
        label: `My ${spec.label}`,
        x: sx,
        y: isMarine ? WATER_SURFACE_Y - spawnDraft : getGroundHeightAt(sx, sz, CITY_LAYOUT),
        z: sz,
        yaw: 0,
        speed: 0,
        pitch: 0,
        verticalSpeed: 0,
        steerAngle: 0,
        wheelSpin: 0,
        leanAngle: 0,
        color: paint,
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
      };
      this.vehicles.push(personal);
      const rig = createVehicleRig(personal, this.contactShadowTex, !this.isSoftwareGl);
      animateVehicleRig(rig, personal, 0, false);
      this.scene.add(rig.root);
      this.vehicleRigs.push(rig);
      idx = this.vehicles.length - 1;
    }

    const veh = this.vehicles[idx];
    const kindChanged = veh.kind !== kind;
    veh.kind = kind;
    veh.label = `My ${spec.label}`;
    veh.color = paint;

    if (kindChanged) {
      const oldRig = this.vehicleRigs[idx];
      this.scene.remove(oldRig.root);
      oldRig.dispose();
      const newRig = createVehicleRig(veh, this.contactShadowTex, !this.isSoftwareGl);
      this.scene.add(newRig.root);
      this.vehicleRigs[idx] = newRig;
    } else {
      setVehiclePaintColor(this.vehicleRigs[idx], paint);
    }

    if (repositionNearPlayer) {
      const fwdX = -Math.sin(this.playerState.yaw);
      const fwdZ = -Math.cos(this.playerState.yaw);
      const rightX = Math.cos(this.playerState.yaw);
      const rightZ = -Math.sin(this.playerState.yaw);
      if (isMarine) {
        const tx = this.playerState.x + fwdX * 5.2 + rightX * 1.5;
        const tz = this.playerState.z + fwdZ * 5.2 + rightZ * 1.5;
        const nearWater = getWaterInfoAt(tx, tz, this.playerState.y, CITY_LAYOUT);
        if (nearWater.inWater && nearWater.depth >= spawnDraft + 0.5) {
          veh.x = tx;
          veh.z = tz;
          veh.y = nearWater.waterSurfaceY - spawnDraft;
          veh.yaw = this.playerState.yaw;
        } else {
          // Deliver to nearest harbor dock when player calls from inland
          const libertyPier = { x: 124, z: 48, yaw: -Math.PI * 0.5 };
          const emeraldMarina = { x: 214, z: 22, yaw: Math.PI * 0.5 };
          const distLib = Math.hypot(this.playerState.x - libertyPier.x, this.playerState.z - libertyPier.z);
          const distEm = Math.hypot(this.playerState.x - emeraldMarina.x, this.playerState.z - emeraldMarina.z);
          const dock = distEm < distLib ? emeraldMarina : libertyPier;
          veh.x = dock.x;
          veh.z = dock.z;
          veh.y = WATER_SURFACE_Y - spawnDraft;
          veh.yaw = dock.yaw;
        }
        veh.pitch = 0;
        veh.verticalSpeed = 0;
      } else {
        const tx = this.playerState.x + rightX * 3.4 + fwdX * 1.5;
        const tz = this.playerState.z + rightZ * 3.4 + fwdZ * 1.5;
        const resolved = resolveCircleAABBCollision(tx, tz, 2.2, 0, 1.8, CITY_LAYOUT);
        veh.x = resolved.x;
        veh.z = resolved.z;
        veh.y = getGroundHeightAt(veh.x, veh.z, CITY_LAYOUT);
        veh.yaw = this.playerState.yaw;
        veh.pitch = 0;
        veh.verticalSpeed = 0;
      }
      veh.speed = 0;
      veh.occupant = 'none';
    }
    animateVehicleRig(this.vehicleRigs[idx], veh, 0, false);
  }

  public buyOrSelectVehicle(kind: VehicleKind): { success: boolean; message: string } {
    const res = purchaseVehicle(this.missionRuntime.money, this.progression, kind);
    this.missionRuntime.money = res.money;
    if (res.success) {
      this.audio.playCash();
      this.syncGarageVehicleInWorld(false);
      this.saveGame(true);
      this.showActivityToast(res.message);
    } else {
      this.audio.playError();
    }
    this.pushHudSnapshot(true);
    return { success: res.success, message: res.message };
  }

  public selectOwnedVehicle(kind: VehicleKind): boolean {
    const ok = selectGarageVehicle(this.progression, kind);
    if (ok) {
      this.audio.playUiClick();
      this.syncGarageVehicleInWorld(false);
      this.saveGame(true);
      this.pushHudSnapshot(true);
    }
    return ok;
  }

  public deliverGarageVehicle(): void {
    if (this.activeBlueprint) {
      this.audio.playError();
      this.showActivityToast('Exit the building to summon your Garage vehicle.');
      return;
    }
    if (this.playerMode === 'driving') {
      this.audio.playError();
      this.showActivityToast('Exit your current vehicle to call Garage delivery.');
      return;
    }
    this.audio.playCash();
    this.syncGarageVehicleInWorld(true);
    const kind = this.progression.activeGarageVehicle;
    const spec = VEHICLE_SPECS[kind];
    const veh = this.vehicles.find((v) => v.id === 'veh_player_garage');
    const dist = veh ? Math.hypot(veh.x - this.playerState.x, veh.z - this.playerState.z) : 0;
    if ((spec.domain === 'water' || spec.domain === 'submersible') && dist > 18) {
      this.showActivityToast(`Delivered ${spec.label} to Harbor Marina!`);
    } else {
      this.showActivityToast(`Delivered ${spec.label} nearby!`);
    }
    this.pushHudSnapshot(true);
  }

  public setVehiclePaint(kind: VehicleKind, color: number): void {
    this.progression.vehicleColors[kind] = color;
    this.audio.playUiClick();
    if (this.progression.activeGarageVehicle === kind) {
      this.syncGarageVehicleInWorld(false);
    }
    this.saveGame(true);
    this.renderer.render(this.scene, this.camera);
    this.pushHudSnapshot(true);
  }

  public buyVehicleUpgrade(
    kind: VehicleKind,
    slot: keyof VehicleUpgradeLevels,
  ): { success: boolean; message: string } {
    const res = purchaseVehicleUpgrade(this.missionRuntime.money, this.progression, kind, slot);
    this.missionRuntime.money = res.money;
    if (res.success) {
      this.audio.playCash();
      this.saveGame(true);
      this.showActivityToast(res.message);
    } else {
      this.audio.playError();
    }
    this.pushHudSnapshot(true);
    return { success: res.success, message: res.message };
  }

  public buyOrEquipOutfit(outfitId: OutfitId): { success: boolean; message: string } {
    const res = purchaseOrEquipOutfit(this.missionRuntime.money, this.progression, outfitId);
    this.missionRuntime.money = res.money;
    if (res.success) {
      this.audio.playCash();
      applyCharacterCustomization(this.playerRig, this.progression.customization);
      this.saveGame(true);
      this.showActivityToast(res.message);
      this.renderer.render(this.scene, this.camera);
    } else {
      this.audio.playError();
    }
    this.pushHudSnapshot(true);
    return { success: res.success, message: res.message };
  }

  public buyOrEquipAccessory(accessoryId: AccessoryId): { success: boolean; message: string } {
    const res = purchaseOrEquipAccessory(this.missionRuntime.money, this.progression, accessoryId);
    this.missionRuntime.money = res.money;
    if (res.success) {
      this.audio.playCash();
      applyCharacterCustomization(this.playerRig, this.progression.customization);
      this.saveGame(true);
      this.showActivityToast(res.message);
      this.renderer.render(this.scene, this.camera);
    } else {
      this.audio.playError();
    }
    this.pushHudSnapshot(true);
    return { success: res.success, message: res.message };
  }

  public setCustomizationColors(
    colors: Partial<
      Pick<
        CharacterCustomization,
        'skinTone' | 'hairColor' | 'jacketColor' | 'pantsColor' | 'shoeColor'
      >
    >,
  ): void {
    Object.assign(this.progression.customization, colors);
    this.audio.playUiClick();
    applyCharacterCustomization(this.playerRig, this.progression.customization);
    this.saveGame(true);
    this.renderer.render(this.scene, this.camera);
    this.pushHudSnapshot(true);
  }

  public saveGame(silent = false): boolean {
    const payload: SaveGameData = {
      version: 1,
      savedAt: Date.now(),
      money: this.missionRuntime.money,
      health: Math.round(this.playerState.health),
      completedMissionIds: [...this.missionRuntime.completedIds],
      progression: cloneProgression(this.progression),
      settings: {
        ...this.settings,
        muted: this.audio.isMuted(),
        musicEnabled: this.audio.isMusicEnabled(),
        timeOfDay: this.timeOfDay,
      },
      playerPos: this.outdoorReturnState
        ? {
            x: this.outdoorReturnState.x,
            y: this.outdoorReturnState.y,
            z: this.outdoorReturnState.z,
            yaw: this.outdoorReturnState.yaw,
          }
        : {
            x: this.playerState.x,
            y: this.playerState.y,
            z: this.playerState.z,
            yaw: this.playerState.yaw,
          },
      quizProgress: this.quizProgress,
    };
    const ok = saveGameToStorage(payload);
    if (ok) {
      this.lastSavedAt = payload.savedAt;
      if (!silent) {
        this.audio.playCheckpoint();
        this.showActivityToast('Progress saved to local storage!');
      }
      this.pushHudSnapshot(true);
    }
    return ok;
  }

  public loadGame(): boolean {
    const saved = loadGameFromStorage();
    if (!saved) {
      this.audio.playError();
      return false;
    }

    this.audio.unlock();
    this.audio.playCheckpoint();
    this.resetWorldState(false);

    this.missionRuntime.money = saved.money;
    this.missionRuntime.completedIds = [...saved.completedMissionIds];
    this.progression = cloneProgression(saved.progression);
    if (saved.quizProgress) {
      this.quizProgress = {
        completedQuestionIds: [...saved.quizProgress.completedQuestionIds],
        lockedQuestionIds: [...saved.quizProgress.lockedQuestionIds],
        earnedPoints: saved.quizProgress.earnedPoints,
        history: [],
      };
      this.questionRepo.savePlayerProgress(this.quizProgress);
    }
    this.settings = { ...saved.settings };
    this.lastSavedAt = saved.savedAt;

    this.timeOfDay = this.settings.timeOfDay;
    this.applyTimeOfDayImmediate(this.timeOfDay);
    this.applyGraphicsQualitySettings(this.settings.graphicsQuality);
    this.audio.setMuted(this.settings.muted);
    this.audio.setMusicEnabled(this.settings.musicEnabled);
    this.callbacks.onMuteChange(this.settings.muted);

    if (saved.playerPos) {
      this.playerState.x = saved.playerPos.x;
      const savedWater = getWaterInfoAt(saved.playerPos.x, saved.playerPos.z, saved.playerPos.y, CITY_LAYOUT);
      if (savedWater.inWater && savedWater.depth > 1.2 && saved.playerPos.y < savedWater.waterSurfaceY - 0.15) {
        this.playerState.y = Math.max(savedWater.seabedY + 0.1, Math.min(savedWater.waterSurfaceY - 0.85, saved.playerPos.y));
        this.playerState.inWater = true;
        this.playerState.grounded = false;
        this.playerState.isUnderwater = this.playerState.y < savedWater.waterSurfaceY - 1.48;
      } else {
        this.playerState.y = getGroundHeightAt(saved.playerPos.x, saved.playerPos.z, CITY_LAYOUT);
        this.playerState.inWater = false;
        this.playerState.isUnderwater = false;
      }
      this.playerState.z = saved.playerPos.z;
      this.playerState.yaw = saved.playerPos.yaw;
      this.playerState.cameraYaw = saved.playerPos.yaw;
    }
    this.playerState.health = saved.health;
    this.lastMilestoneDistance = Math.floor(this.progression.totalDistance / 250) * 250;

    applyCharacterCustomization(this.playerRig, this.progression.customization);
    this.syncGarageVehicleInWorld(false);
    this.rebuildOutdoorQuizKiosks();
    this.camInitialized = false;
    this.snapCameraBehindPlayer();
    this.lastTickTime = performance.now();
    this.setPhase('playing', true);
    this.showActivityToast('Saved game loaded!');
    this.renderer.domElement.focus();
    return true;
  }

  public newGame(): void {
    clearSavedGame();
    this.startGame();
  }

  public startGame(): void {
    this.audio.unlock();
    this.audio.playUiClick();
    this.resetWorldState(true);
    this.camInitialized = false;
    this.snapCameraBehindPlayer();
    this.setPhase('playing', true);
    this.renderer.domElement.focus();
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.audio.playUiClick();
    this.setPhase('paused', true);
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.audio.unlock();
    this.audio.playUiClick();
    this.lastTickTime = performance.now();
    this.setPhase('playing', true);
    this.renderer.domElement.focus();
  }

  public restartGame(): void {
    this.audio.unlock();
    this.audio.playUiClick();
    this.resetWorldState(true);
    this.camInitialized = false;
    this.snapCameraBehindPlayer();
    this.lastTickTime = performance.now();
    this.setPhase('playing', true);
    this.renderer.domElement.focus();
  }

  public returnToMenu(): void {
    this.audio.playUiClick();
    this.previewMode = 'none';
    this.resetWorldState(true);
    this.camInitialized = false;
    this.setPhase('title', true);
  }

  public toggleMute(): boolean {
    const next = !this.audio.isMuted();
    this.audio.setMuted(next);
    this.settings.muted = next;
    if (!next) {
      this.audio.unlock();
      this.audio.playUiClick();
    }
    this.callbacks.onMuteChange(next);
    this.pushHudSnapshot(true);
    return next;
  }

  public setMobileMove(x: number, y: number): void {
    this.input.moveX = Math.max(-1, Math.min(1, x));
    this.input.moveY = Math.max(-1, Math.min(1, y));
  }

  public setMobileSprint(active: boolean): void {
    this.input.sprint = active;
  }

  public triggerMobileJump(held: boolean): void {
    if (held && !this.input.jumpHeld) {
      this.input.jumpJustPressed = true;
    }
    this.input.jumpHeld = held;
    this.drivingInput.ascend = held;
  }

  public triggerMobileDive(held: boolean): void {
    this.input.diveHeld = held;
    this.drivingInput.dive = held;
  }

  public setMobileDrivingInput(field: keyof DrivingInputState, held: boolean): void {
    this.audio.unlock();
    this.drivingInput[field] = held;
  }

  private getActiveVehicle(): VehicleState | null {
    if (!this.activeVehicleId) return null;
    return this.vehicles.find((v) => v.id === this.activeVehicleId) || null;
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing' || this.buildingTransition || this.previewMode !== 'none') return;
    this.audio.unlock();

    // Indoor interactions: exit door, interior partition doors, elevator call/panel, seats, or collectibles
    if (this.activeBlueprint) {
      const nearInt = findNearestInteriorInteractable(
        this.playerState.x,
        this.playerState.y,
        this.playerState.z,
        this.activeBlueprint,
        this.activeInteriorDoors,
        this.currentInteriorFloor,
        this.activeElevatorState,
      );
      const nearQuiz = findNearestQuizKiosk(
        this.playerState.x,
        this.playerState.y,
        this.playerState.z,
        this.interiorKiosks,
      );

      if (nearQuiz && (!nearInt || Math.hypot(nearQuiz.x - this.playerState.x, nearQuiz.z - this.playerState.z) < 2.2)) {
        this.openQuizForKiosk(nearQuiz);
        return;
      }

      if (!nearInt) {
        if (nearQuiz) this.openQuizForKiosk(nearQuiz);
        return;
      }

      if (nearInt.kind === 'building_exit') {
        this.activeSitSpot = null;
        const door = this.activeInteriorDoors.find((d) => d.id === nearInt.id);
        if (door) door.isOpen = true;
        triggerCharacterAction(this.playerAnimRuntime, 'open_door', 0.85, false);
        this.clearHeldInputs();
        this.audio.playDoorLatch(false);
        this.buildingTransition = { kind: 'exit', timer: 0, swapped: false };
        this.pushHudSnapshot(true);
        return;
      }

      if (nearInt.kind === 'rooftop_exit') {
        this.activeSitSpot = null;
        const door = this.activeInteriorDoors.find((d) => d.id === nearInt.id);
        if (door) door.isOpen = true;
        triggerCharacterAction(this.playerAnimRuntime, 'open_door', 0.85, false);
        this.clearHeldInputs();
        this.audio.playDoorLatch(true);
        this.buildingTransition = {
          kind: 'exit',
          timer: 0,
          swapped: false,
          rooftopTarget: door?.rooftopTarget,
        };
        this.pushHudSnapshot(true);
        return;
      }

      if (nearInt.kind === 'interior_door') {
        const door = this.activeInteriorDoors.find((d) => d.id === nearInt.id);
        if (door) {
          door.isOpen = !door.isOpen;
          triggerCharacterAction(
            this.playerAnimRuntime,
            door.isOpen ? 'open_door' : 'close_door',
            0.75,
            false,
          );
          this.audio.playDoorLatch(door.isOpen);
          this.pushHudSnapshot(true);
        }
        return;
      }

      if (nearInt.kind === 'elevator') {
        const el = this.activeBlueprint.elevators.find((e) => e.id === nearInt.id);
        if (el && this.activeElevatorState) {
          callElevatorToFloor(this.activeElevatorState, this.currentInteriorFloor, el.floors);
          triggerCharacterAction(this.playerAnimRuntime, 'press_button', 0.8, false);
          this.audio.playUiClick();
          this.activeBuiltInterior?.syncElevator(this.activeElevatorState);
          this.callbacks.onElevatorAction?.({
            buildingId: this.activeBlueprint.buildingId,
            elevatorId: el.id,
            action: 'call',
            floor: this.currentInteriorFloor,
          });
          if (
            this.activeElevatorState.currentFloor === this.currentInteriorFloor &&
            canExitElevatorCabin(this.activeElevatorState)
          ) {
            this.showActivityToast('Elevator doors open — walk into cabin to pick a floor!');
          } else {
            this.showActivityToast(`Elevator called to Floor ${this.currentInteriorFloor}...`);
          }
          this.pushHudSnapshot(true);
        }
        return;
      }

      if (nearInt.kind === 'elevator_panel') {
        const el = this.activeBlueprint.elevators.find((e) => e.id === nearInt.id);
        if (el && this.activeElevatorState) {
          triggerCharacterAction(this.playerAnimRuntime, 'press_button', 0.8, false);
          this.audio.playUiClick();
          if (this.callbacks.onOpenElevator) {
            this.setPreviewMode('elevator');
            this.callbacks.onOpenElevator({
              buildingName: this.activeBlueprint.name,
              elevatorId: el.id,
              currentFloor: this.activeElevatorState.currentFloor,
              targetFloor: this.activeElevatorState.targetFloor,
              moving: this.activeElevatorState.moving,
              floors: el.floors,
            });
          } else {
            const nextFloor =
              this.currentInteriorFloor < el.floors.length ? this.currentInteriorFloor + 1 : 1;
            this.selectElevatorFloorFromUi(nextFloor);
          }
        }
        return;
      }

      if (nearInt.kind === 'reward_shop') {
        triggerCharacterAction(this.playerAnimRuntime, 'use_tablet', 1.2, false);
        this.audio.playUiClick();
        this.setPreviewMode('shop');
        this.callbacks.onOpenRewardShop?.();
        return;
      }

      if (nearInt.kind === 'board_flight') {
        this.openFlightModalForCurrentAirport();
        return;
      }

      if (nearInt.kind === 'sit_seat') {
        this.toggleSit();
        return;
      }
      return;
    }

    // Exit active vehicle
    if (this.playerMode === 'driving') {
      const vehicle = this.getActiveVehicle();
      if (!vehicle) return;
      vehicle.occupant = 'none';
      vehicle.isBraking = true;
      const spec = VEHICLE_SPECS[vehicle.kind];
      const openRider = spec.isMotorcycle || vehicle.kind === 'jetski' || vehicle.kind === 'speedboat';
      const seat = computeVehicleSeatWorldPos(vehicle);
      const exit = findSafeVehicleExitPos(vehicle, CITY_LAYOUT);

      this.transitionStartPos = {
        x: seat.x,
        y: vehicle.y + (openRider ? 0.14 : 0.04),
        z: seat.z,
        yaw: vehicle.yaw,
      };
      this.transitionEndPos = { x: exit.x, y: exit.y, z: exit.z, yaw: vehicle.yaw };
      this.transitionTimer = 0;
      this.transitionDuration = 0.22;
      this.playerMode = 'exiting';
      this.playerRig.root.visible = true;
      this.playerState.cameraYaw = vehicle.yaw + this.drivingCamOrbitYaw;
      this.drivingCamOrbitYaw = 0;
      document.body.dataset.mode = this.playerMode;

      this.audio.playDoorClunk(false);
      this.audio.updateEngineSound(false, 0, 1);
      this.pushHudSnapshot(true);
      return;
    }

    if (this.playerMode !== 'on_foot') return;

    // Dismount exterior ladder if currently climbing
    if (this.activeLadder) {
      const l = this.activeLadder;
      this.activeLadder = null;
      this.playerState.activeLadderId = null;
      this.playerState.vx = 0;
      this.playerState.vz = 0;
      if (this.playerState.y >= l.topY - 1.4) {
        this.playerState.x = l.topStepX;
        this.playerState.y = l.topY;
        this.playerState.z = l.topStepZ;
        this.playerState.vy = 0;
        this.playerState.grounded = true;
      } else {
        this.playerState.x = l.x + l.normalX * 1.1;
        this.playerState.z = l.z + l.normalZ * 1.1;
        this.playerState.grounded = false;
      }
      this.audio.playDoorLatch(false);
      this.pushHudSnapshot(true);
      return;
    }

    const nearRooftopDoor = findNearestRooftopInteriorDoor(
      this.playerState.x,
      this.playerState.y,
      this.playerState.z,
      CITY_LAYOUT,
    );
    const nearLadder = findNearestExteriorLadder(
      this.playerState.x,
      this.playerState.y,
      this.playerState.z,
      CITY_LAYOUT,
    );
    const nearEntrance = findNearestExteriorEntrance(
      this.playerState.x,
      this.playerState.z,
      CITY_LAYOUT.entrances,
    );
    const nearVehicle = findNearestInteractableVehicle(
      this.playerState.x,
      this.playerState.z,
      this.vehicles,
      VEHICLE_INTERACT_RANGE,
      this.playerState.y,
    );
    const nearMission = findNearestMissionStart(
      this.playerState.x,
      this.playerState.z,
      this.missionRuntime,
    );
    const nearKiosk = findNearestQuizKiosk(
      this.playerState.x,
      this.playerState.y,
      this.playerState.z,
      this.outdoorKiosks,
    );
    const nearGateJet = this.findNearestOutdoorGateJet();

    const candidates: Array<{
      kind: 'rooftop_enter' | 'climb_ladder' | 'entrance' | 'vehicle' | 'mission' | 'quiz' | 'board_flight';
      dist: number;
    }> = [];
    if (nearGateJet) {
      candidates.push({
        kind: 'board_flight',
        dist: Math.hypot(nearGateJet.gateJetX - this.playerState.x, nearGateJet.gateJetZ - this.playerState.z) * 0.4,
      });
    }
    if (nearRooftopDoor) {
      candidates.push({ kind: 'rooftop_enter', dist: nearRooftopDoor.distance });
    }
    if (nearLadder) {
      candidates.push({ kind: 'climb_ladder', dist: nearLadder.distance });
    }
    if (nearEntrance && Math.abs(this.playerState.y - CITY_LAYOUT.sidewalkHeight) < 2.2) {
      candidates.push({
        kind: 'entrance',
        dist: Math.hypot(nearEntrance.doorX - this.playerState.x, nearEntrance.doorZ - this.playerState.z),
      });
    }
    if (nearVehicle && Math.abs(this.playerState.y - nearVehicle.y) < 3.6) {
      candidates.push({
        kind: 'vehicle',
        dist: Math.hypot(nearVehicle.x - this.playerState.x, nearVehicle.z - this.playerState.z),
      });
    }
    if (nearMission && Math.abs(this.playerState.y - CITY_LAYOUT.sidewalkHeight) < 2.2) {
      candidates.push({
        kind: 'mission',
        dist: Math.hypot(nearMission.startX - this.playerState.x, nearMission.startZ - this.playerState.z),
      });
    }
    if (nearKiosk) {
      candidates.push({
        kind: 'quiz',
        dist: Math.hypot(nearKiosk.x - this.playerState.x, nearKiosk.z - this.playerState.z),
      });
    }
    candidates.sort((a, b) => a.dist - b.dist);

    const chosen = candidates[0]?.kind;
    if (chosen === 'board_flight') {
      this.openFlightModalForCurrentAirport();
    } else if (chosen === 'rooftop_enter' && nearRooftopDoor) {
      const targetEntrance = CITY_LAYOUT.entrances.find(
        (e) => e.buildingId === nearRooftopDoor.rooftop.buildingId,
      );
      if (targetEntrance) {
        this.beginEnterBuilding(targetEntrance, nearRooftopDoor.targetFloor);
      }
    } else if (chosen === 'climb_ladder' && nearLadder) {
      this.activeSitSpot = null;
      this.activeLadder = nearLadder.ladder;
      this.playerState.activeLadderId = nearLadder.ladder.id;
      this.playerState.x = nearLadder.ladder.x + nearLadder.ladder.normalX * 0.56;
      this.playerState.z = nearLadder.ladder.z + nearLadder.ladder.normalZ * 0.56;
      this.playerState.y =
        nearLadder.entryEnd === 'top'
          ? nearLadder.ladder.topY - 0.35
          : nearLadder.ladder.bottomY + 0.15;
      this.playerState.yaw = nearLadder.ladder.climbYaw;
      this.playerState.vx = 0;
      this.playerState.vy = 0;
      this.playerState.vz = 0;
      this.playerState.grounded = false;
      this.audio.playUiClick();
      this.showActivityToast('Climbing ladder (W/S to climb · Space/E to let go)');
      this.pushHudSnapshot(true);
    } else if (chosen === 'entrance' && nearEntrance) {
      this.beginEnterBuilding(nearEntrance);
    } else if (chosen === 'vehicle' && nearVehicle) {
      this.enterVehicle(nearVehicle);
    } else if (chosen === 'mission' && nearMission) {
      this.activateMission(nearMission.id);
    } else if (chosen === 'quiz' && nearKiosk) {
      this.openQuizForKiosk(nearKiosk);
    }
  }

  private findNearestOutdoorGateJet(): AirportSpec | null {
    if (this.activeBlueprint || this.playerState.y > 3.5) return null;
    let best: AirportSpec | null = null;
    let bestDist = 11.2;
    for (const ap of CITY_LAYOUT.airports) {
      const d = Math.hypot(ap.gateJetX - this.playerState.x, ap.gateJetZ - this.playerState.z);
      if (d <= bestDist) {
        bestDist = d;
        best = ap;
      }
    }
    return best;
  }

  private resolveCurrentAirport(): AirportSpec {
    if (this.activeEntrance) {
      const byTerm = CITY_LAYOUT.airports.find(
        (ap) => ap.terminalBuildingId === this.activeEntrance!.buildingId,
      );
      if (byTerm) return byTerm;
    }
    const px = this.activeEntrance ? this.activeEntrance.doorX : this.playerState.x;
    const pz = this.activeEntrance ? this.activeEntrance.doorZ : this.playerState.z;
    let best = CITY_LAYOUT.airports[0];
    let bestD = Number.POSITIVE_INFINITY;
    for (const ap of CITY_LAYOUT.airports) {
      const d = Math.hypot(ap.centerX - px, ap.centerZ - pz);
      if (d < bestD) {
        bestD = d;
        best = ap;
      }
    }
    return best;
  }

  private openFlightModalForCurrentAirport(): void {
    const originAp = this.resolveCurrentAirport();
    const originCity = CITY_LAYOUT.cities.find((c) => c.id === originAp.cityId) ?? CITY_LAYOUT.cities[0];
    triggerCharacterAction(this.playerAnimRuntime, 'press_button', 0.9, false);
    this.audio.playUiClick();
    this.setPreviewMode('flight');
    this.callbacks.onOpenFlightModal?.({
      originAirportId: originAp.id,
      originAirportName: originAp.name,
      originAirportCode: originAp.code,
      originCityId: originCity.id,
      originCityName: originCity.name,
    });
  }

  public flyToCity(destCityId: CityId): void {
    if (this.phase !== 'playing') return;
    const originAp = this.resolveCurrentAirport();
    const originCity = CITY_LAYOUT.cities.find((c) => c.id === originAp.cityId) ?? CITY_LAYOUT.cities[0];
    const destAp = CITY_LAYOUT.airports.find((ap) => ap.cityId === destCityId);
    const destCity = CITY_LAYOUT.cities.find((c) => c.id === destCityId);
    if (!destAp || !destCity) return;

    this.setPreviewMode('none');
    if (this.activeBlueprint) {
      this.exitInteriorToCity();
    }
    this.clearHeldInputs();
    this.activeLadder = null;
    this.activeSitSpot = null;
    this.buildingTransition = null;
    this.transitionFade = 0;

    this.playerMode = 'flying';
    document.body.dataset.mode = this.playerMode;
    this.playerRig.root.visible = false;

    const startX = originAp.gateJetX;
    const startZ = originAp.runwayZ;
    const endX = destAp.gateJetX;
    const endZ = destAp.runwayZ;
    const yaw = Math.atan2(-(endX - startX), -(endZ - startZ));

    this.flightSequence = {
      originCityName: originCity.name,
      destCityId: destCity.id,
      destCityName: destCity.name,
      destAirportName: destAp.name,
      destAirportCode: destAp.code,
      startX,
      startZ,
      endX,
      endZ,
      arrivalSpawnX: destAp.arrivalSpawnX,
      arrivalSpawnZ: destAp.arrivalSpawnZ,
      arrivalSpawnYaw: destAp.arrivalSpawnYaw,
      timer: 0,
      duration: 4.8,
    };

    this.flightJetGroup.visible = true;
    this.flightJetGroup.position.set(startX, 1.9, startZ);
    this.flightJetGroup.rotation.set(0, yaw, 0, 'YXZ');
    this.playerState.x = startX;
    this.playerState.y = 1.9;
    this.playerState.z = startZ;
    this.playerState.yaw = yaw;
    this.camPos.set(startX + Math.sin(yaw) * 24, 10, startZ + Math.cos(yaw) * 24);
    this.camTarget.set(startX, 2.5, startZ);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.camInitialized = true;

    this.audio.playCheckpoint();
    this.showActivityToast(`Flight departing ${originAp.code} -> ${destAp.code} (${destCity.name})`);
    this.pushHudSnapshot(true);
  }

  private beginEnterBuilding(entrance: BuildingEntranceSpec, targetFloor?: number): void {
    this.clearHeldInputs();
    this.activeLadder = null;
    this.playerState.activeLadderId = null;
    this.outdoorReturnState = {
      x: this.playerState.x,
      y: this.playerState.y,
      z: this.playerState.z,
      yaw: this.playerState.yaw,
      cameraYaw: this.playerState.cameraYaw,
      cameraPitch: this.playerState.cameraPitch,
    };
    const doorRig = this.builtCity.exteriorDoors.get(entrance.id);
    if (doorRig) {
      doorRig.targetOpen = true;
    }
    this.audio.playDoorLatch(true);
    this.buildingTransition = {
      kind: 'enter',
      timer: 0,
      swapped: false,
      entrance,
      targetFloor,
    };
    this.pushHudSnapshot(true);
  }

  private swapToInterior(entrance: BuildingEntranceSpec, targetFloor?: number): void {
    if (this.activeBuiltInterior) {
      this.scene.remove(this.activeBuiltInterior.group);
      this.activeBuiltInterior.dispose();
    }
    const blueprint = createInteriorBlueprintForEntrance(entrance);
    const doors = createInteriorDoorStates(blueprint);
    const built = buildInteriorScene(blueprint, this.textures, !this.isSoftwareGl);
    const startFloor = targetFloor ?? 1;
    const elevState =
      blueprint.elevators.length > 0 ? createElevatorRuntimeState(blueprint.elevators[0], startFloor) : null;

    this.activeEntrance = entrance;
    this.activeBlueprint = blueprint;
    this.activeInteriorDoors = doors;
    this.activeElevatorState = elevState;
    this.activeBuiltInterior = built;
    this.activeSitSpot = null;
    this.activeRooftop = null;
    this.currentInteriorFloor = startFloor;
    this.prevInteriorFloor = startFloor;
    built.syncVisibleFloorWindow(startFloor);
    built.syncElevator(elevState);
    if (recordVisitedBuilding(this.explorationTracker, entrance.buildingId, startFloor)) {
      this.showActivityToast(`Discovered ${entrance.name}!`);
    }

    // Hide exterior city & world entities
    this.builtCity.group.visible = false;
    this.skyLifeRig.group.visible = false;
    this.outdoorKioskRigs.forEach((kr) => {
      kr.group.visible = false;
    });
    this.npcRigs.forEach((nr) => {
      nr.root.visible = false;
    });
    this.vehicleRigs.forEach((vr) => {
      vr.root.visible = false;
    });
    this.missionBeacons.forEach((mb) => {
      mb.group.visible = false;
    });
    this.activeObjectiveBeacon.group.visible = false;

    this.scene.add(built.group);
    this.rebuildInteriorQuizKiosks();

    // Interior atmosphere & lighting
    (this.scene.background as THREE.Color).setHex(0x131822);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.setHex(0x131822);
    fog.density = 0;
    this.sunLight.intensity = 0.22;
    this.hemiLight.color.setHex(blueprint.ambientColor);
    this.hemiLight.groundColor.setHex(0x475569);
    this.hemiLight.intensity = 0.92;
    this.scene.environmentIntensity = 0.55;
    this.renderer.toneMappingExposure = 1.12;

    const spawnPos =
      targetFloor && targetFloor > 1
        ? findInteriorRooftopEntrySpawn(blueprint, targetFloor)
        : blueprint.spawn;

    this.playerState.x = spawnPos.x;
    this.playerState.y = spawnPos.y;
    this.playerState.z = spawnPos.z;
    this.playerState.vx = 0;
    this.playerState.vy = 0;
    this.playerState.vz = 0;
    this.playerState.yaw = spawnPos.yaw;
    this.playerState.cameraYaw = spawnPos.yaw;
    this.playerState.cameraPitch = 0.22;
    this.playerState.grounded = true;
    this.playerState.speed = 0;
    this.playerState.isMoving = false;
    this.playerRig.root.visible = true;

    applyArticulatedPoseToRig(
      this.playerRig,
      this.playerAnimRuntime.pose,
      this.playerState.x,
      this.playerState.y,
      this.playerState.z,
      this.playerState.yaw,
      spawnPos.y,
      this.playerState.squashY,
    );
    this.camInitialized = false;
    this.snapInteriorCamera();
    document.body.dataset.interior = entrance.buildingId;
    this.renderer.render(this.scene, this.camera);
  }

  private exitInteriorToCity(rooftopTarget?: { x: number; y: number; z: number; yaw: number }): void {
    const entrance = this.activeEntrance;
    const savedReturn = this.outdoorReturnState;

    this.disposeKioskRigs(this.interiorKioskRigs);
    this.interiorKiosks = [];
    if (this.activeBuiltInterior) {
      this.scene.remove(this.activeBuiltInterior.group);
      this.activeBuiltInterior.dispose();
      this.activeBuiltInterior = null;
    }
    this.activeBlueprint = null;
    this.activeEntrance = null;
    this.activeInteriorDoors = [];
    this.activeElevatorState = null;
    this.activeSitSpot = null;
    this.prevOnStairs = false;
    this.currentInteriorFloor = 1;
    this.prevInteriorFloor = 1;
    this.outdoorReturnState = null;

    this.builtCity.group.visible = true;
    this.skyLifeRig.group.visible = true;
    this.outdoorKioskRigs.forEach((kr) => {
      kr.group.visible = true;
    });
    this.builtCity.exteriorDoors.forEach((rig) => {
      rig.targetOpen = false;
      rig.setOpenProgress(0);
    });
    this.applyTimeOfDayImmediate(this.timeOfDay);

    if (rooftopTarget) {
      this.playerState.x = rooftopTarget.x;
      this.playerState.y = rooftopTarget.y;
      this.playerState.z = rooftopTarget.z;
      this.playerState.yaw = rooftopTarget.yaw;
      this.playerState.cameraYaw = rooftopTarget.yaw;
      this.playerState.cameraPitch = 0.24;
      this.activeRooftop = findRooftopAt(
        rooftopTarget.x,
        rooftopTarget.y,
        rooftopTarget.z,
        CITY_LAYOUT,
      );
      if (this.activeRooftop) {
        this.showActivityToast(`Stepped out onto ${this.activeRooftop.name}!`);
      }
    } else if (entrance) {
      const safeOut = findSafeOutdoorExitPos(entrance, CITY_LAYOUT);
      this.playerState.x = safeOut.x;
      this.playerState.y = safeOut.y;
      this.playerState.z = safeOut.z;
      this.playerState.yaw = safeOut.yaw;
      this.playerState.cameraYaw = safeOut.yaw;
      this.playerState.cameraPitch = savedReturn ? savedReturn.cameraPitch : 0.28;
    } else if (savedReturn) {
      this.playerState.x = savedReturn.x;
      this.playerState.y = savedReturn.y;
      this.playerState.z = savedReturn.z;
      this.playerState.yaw = savedReturn.yaw;
      this.playerState.cameraYaw = savedReturn.cameraYaw;
      this.playerState.cameraPitch = savedReturn.cameraPitch;
    }

    this.playerState.vx = 0;
    this.playerState.vy = 0;
    this.playerState.vz = 0;
    this.playerState.grounded = true;
    this.playerState.speed = 0;
    this.playerState.isMoving = false;
    this.playerRig.root.visible = true;

    delete document.body.dataset.interior;
    const gy = getGroundHeightAt(this.playerState.x, this.playerState.z, CITY_LAYOUT, this.playerState.y);
    animateCharacterRig(this.playerRig, this.playerState, gy, this.playerState.elapsedTime);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    this.camInitialized = false;
    this.snapCameraBehindPlayer();
    this.renderer.render(this.scene, this.camera);
  }

  public triggerMissionAction(): void {
    if (this.phase !== 'playing') return;
    const nearMission = findNearestMissionStart(
      this.playerState.x,
      this.playerState.z,
      this.missionRuntime,
      5.2,
    );
    if (nearMission) {
      this.activateMission(nearMission.id);
    }
  }

  private activateMission(missionId: string): void {
    const started = startMission(this.missionRuntime, missionId);
    if (started) {
      this.audio.playCheckpoint();
      this.pushHudSnapshot(true);
    }
  }

  private enterVehicle(vehicle: VehicleState): void {
    // Entering a civilian traffic car or police car triggers Wanted level!
    if (vehicle.isPolice) {
      setWantedLevel(this.missionRuntime, Math.max(this.missionRuntime.wantedLevel, 2));
    } else if (vehicle.occupant === 'traffic') {
      addWantedHeat(this.missionRuntime, 1.0);
    }

    vehicle.occupant = 'player';
    vehicle.speed = 0;
    vehicle.isBraking = false;
    this.activeVehicleId = vehicle.id;

    const spec = VEHICLE_SPECS[vehicle.kind];
    const seat = computeVehicleSeatWorldPos(vehicle);
    this.transitionStartPos = {
      x: this.playerState.x,
      y: this.playerState.y,
      z: this.playerState.z,
      yaw: this.playerState.yaw,
    };
    const openRider = spec.isMotorcycle || vehicle.kind === 'jetski' || vehicle.kind === 'speedboat';
    this.transitionEndPos = {
      x: seat.x,
      y: vehicle.y + (openRider ? 0.16 : 0.04),
      z: seat.z,
      yaw: vehicle.yaw,
    };
    this.transitionTimer = 0;
    this.transitionDuration = 0.24;
    this.playerMode = 'entering';
    this.drivingCamOrbitYaw = shortestAngleDelta(vehicle.yaw, this.playerState.cameraYaw);
    document.body.dataset.mode = this.playerMode;

    this.audio.playDoorClunk(true);
    this.pushHudSnapshot(true);
  }

  public rotateCameraBy(deltaYaw: number, deltaPitch: number): void {
    if (this.playerMode === 'driving' || this.playerMode === 'entering') {
      this.drivingCamOrbitYaw -= deltaYaw;
      this.manualOrbitCooldown = 1.6;
    } else {
      this.playerState.cameraYaw -= deltaYaw;
    }
    this.playerState.cameraPitch = Math.max(
      -0.65,
      Math.min(1.05, this.playerState.cameraPitch + deltaPitch),
    );
  }

  private clearHeldInputs(): void {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.sprint = false;
    this.input.jumpHeld = false;
    this.input.jumpJustPressed = false;
    this.input.diveHeld = false;
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.drivingInput.accelerate = false;
    this.drivingInput.brakeReverse = false;
    this.drivingInput.steerLeft = false;
    this.drivingInput.steerRight = false;
    this.drivingInput.handbrake = false;
    this.drivingInput.ascend = false;
    this.drivingInput.dive = false;
    this.isMouseDragging = false;
  }

  private snapCameraBehindPlayer(): void {
    const dist = 5.4;
    const pitch = this.playerState.cameraPitch;
    const yaw = this.playerState.cameraYaw;
    const horizDist = dist * Math.cos(pitch);
    const heightOffset = 1.65 + dist * Math.sin(pitch);

    const originX = this.playerState.x;
    const originY = this.playerState.y + 1.48;
    const originZ = this.playerState.z;

    const desiredX = originX + Math.sin(yaw) * horizDist;
    const desiredY = this.playerState.y + heightOffset;
    const desiredZ = originZ + Math.cos(yaw) * horizDist;

    const safe = raycastCameraCollision(
      originX,
      originY,
      originZ,
      desiredX,
      desiredY,
      desiredZ,
      CITY_LAYOUT.colliders,
    );

    this.camPos.set(safe.x, safe.y, safe.z);
    this.camTarget.set(originX, originY, originZ);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.camInitialized = true;
  }

  private updateTitleCamera(elapsed: number): void {
    const angle = elapsed * 0.14;
    const radius = 42;
    const cx = 4 + Math.sin(angle) * radius;
    const cz = -4 + Math.cos(angle) * radius;
    const cy = 20 + Math.sin(elapsed * 0.25) * 3.5;

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(-6, 6, -12);
  }

  private updateFollowCamera(dt: number): void {
    if (!this.camInitialized) {
      this.snapCameraBehindPlayer();
      return;
    }

    const dist = 5.4;
    const pitch = this.playerState.cameraPitch;
    const yaw = this.playerState.cameraYaw;
    const horizDist = dist * Math.cos(pitch);
    const heightOffset = 1.65 + dist * Math.sin(pitch);

    const originX = this.playerState.x;
    const originY = this.playerState.y + 1.48;
    const originZ = this.playerState.z;

    const desiredX = originX + Math.sin(yaw) * horizDist;
    const desiredY = this.playerState.y + heightOffset;
    const desiredZ = originZ + Math.cos(yaw) * horizDist;

    const safe = raycastCameraCollision(
      originX,
      originY,
      originZ,
      desiredX,
      desiredY,
      desiredZ,
      CITY_LAYOUT.colliders,
    );
    const camWater = getWaterInfoAt(safe.x, safe.z, safe.y, CITY_LAYOUT);
    const safeY = camWater.inWater ? Math.max(camWater.seabedY + 0.38, safe.y) : safe.y;

    const posLambda = safe.clipped ? 24 : 14;
    this.camPos.x = dampValue(this.camPos.x, safe.x, posLambda, dt);
    this.camPos.y = dampValue(this.camPos.y, safeY, posLambda, dt);
    this.camPos.z = dampValue(this.camPos.z, safe.z, posLambda, dt);

    this.camTarget.x = dampValue(this.camTarget.x, originX, 18, dt);
    this.camTarget.y = dampValue(this.camTarget.y, originY, 18, dt);
    this.camTarget.z = dampValue(this.camTarget.z, originZ, 18, dt);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    const targetFov = this.playerState.isSprinting ? 68 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = dampValue(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private getInteriorCameraFraming(floorInfo: FloorCeilingInfo) {
    const dist = 2.75;
    const pitch = Math.max(-0.08, Math.min(0.45, this.playerState.cameraPitch));
    const yaw = this.playerState.cameraYaw;
    const horizDist = dist * Math.cos(pitch);
    const heightOffset = 1.48 + dist * Math.sin(pitch);

    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const shoulderOffset = 0.28;

    const originX = this.playerState.x + rightX * shoulderOffset;
    const originY = this.playerState.y + 1.42;
    const originZ = this.playerState.z + rightZ * shoulderOffset;

    const desiredX = originX + Math.sin(yaw) * horizDist;
    const desiredY = this.playerState.y + heightOffset;
    const desiredZ = originZ + Math.cos(yaw) * horizDist;

    const safe = raycastInteriorCamera(
      originX,
      originY,
      originZ,
      desiredX,
      desiredY,
      desiredZ,
      this.activeBlueprint!,
      floorInfo,
    );
    return { originX, originY, originZ, safe };
  }

  private snapInteriorCamera(): void {
    if (!this.activeBlueprint) return;
    const floorInfo = getInteriorFloorAndCeilingAt(
      this.playerState.x,
      this.playerState.y,
      this.playerState.z,
      this.activeBlueprint,
      this.activeElevatorState,
    );
    const { originX, originY, originZ, safe } = this.getInteriorCameraFraming(floorInfo);
    this.camPos.set(safe.x, safe.y, safe.z);
    this.camTarget.set(originX, originY, originZ);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
    this.camInitialized = true;
  }

  private updateInteriorCamera(dt: number, floorInfo: FloorCeilingInfo): void {
    if (!this.activeBlueprint) return;
    if (!this.camInitialized) {
      this.snapInteriorCamera();
      return;
    }
    const { originX, originY, originZ, safe } = this.getInteriorCameraFraming(floorInfo);
    const posLambda = safe.clipped ? 28 : 16;
    this.camPos.x = dampValue(this.camPos.x, safe.x, posLambda, dt);
    this.camPos.y = dampValue(this.camPos.y, safe.y, posLambda, dt);
    this.camPos.z = dampValue(this.camPos.z, safe.z, posLambda, dt);

    this.camTarget.x = dampValue(this.camTarget.x, originX, 20, dt);
    this.camTarget.y = dampValue(this.camTarget.y, originY, 20, dt);
    this.camTarget.z = dampValue(this.camTarget.z, originZ, 20, dt);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  private updateDrivingCamera(vehicle: VehicleState, dt: number): void {
    const spec = VEHICLE_SPECS[vehicle.kind];
    if (this.manualOrbitCooldown > 0) {
      this.manualOrbitCooldown = Math.max(0, this.manualOrbitCooldown - dt);
    } else if (!this.isMouseDragging && this.cameraTouchId === null && Math.abs(vehicle.speed) > 1.2) {
      // Auto-align camera behind vehicle when driving
      this.drivingCamOrbitYaw = dampValue(this.drivingCamOrbitYaw, 0, 2.8, dt);
    }

    const isMarine = spec.domain === 'water' || spec.domain === 'submersible';
    const isSmallRider = spec.isMotorcycle || vehicle.kind === 'jetski';
    const camYaw = vehicle.yaw + this.drivingCamOrbitYaw;
    const pitch = isMarine
      ? Math.max(-0.42, Math.min(0.92, this.playerState.cameraPitch))
      : Math.max(0.14, Math.min(0.68, this.playerState.cameraPitch));
    const dist = isSmallRider ? 5.6 : vehicle.kind === 'submarine' ? 8.4 : 7.4;
    const horizDist = dist * Math.cos(pitch);
    const heightOffset = (isSmallRider ? 1.55 : 2.0) + dist * Math.sin(pitch);

    const originX = vehicle.x;
    const originY = vehicle.y + (isSmallRider ? 1.3 : 1.55);
    const originZ = vehicle.z;

    const desiredX = originX + Math.sin(camYaw) * horizDist;
    const desiredY = vehicle.y + heightOffset;
    const desiredZ = originZ + Math.cos(camYaw) * horizDist;

    const safe = raycastCameraCollision(
      originX,
      originY,
      originZ,
      desiredX,
      desiredY,
      desiredZ,
      CITY_LAYOUT.colliders,
    );
    const camWater = getWaterInfoAt(safe.x, safe.z, safe.y, CITY_LAYOUT);
    const safeY = camWater.inWater ? Math.max(camWater.seabedY + 0.45, safe.y) : safe.y;

    const posLambda = safe.clipped ? 26 : 11;
    this.camPos.x = dampValue(this.camPos.x, safe.x, posLambda, dt);
    this.camPos.y = dampValue(this.camPos.y, safeY, posLambda, dt);
    this.camPos.z = dampValue(this.camPos.z, safe.z, posLambda, dt);

    const shake = this.cameraTrauma * this.cameraTrauma * 0.32;
    const shakeX = shake > 0.002 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0.002 ? (Math.random() - 0.5) * shake : 0;

    this.camTarget.x = dampValue(this.camTarget.x, originX, 16, dt);
    this.camTarget.y = dampValue(this.camTarget.y, originY, 16, dt);
    this.camTarget.z = dampValue(this.camTarget.z, originZ, 16, dt);

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camTarget);
    this.playerState.cameraYaw = camYaw;

    const speedRatio = Math.min(1, Math.abs(vehicle.speed) / spec.maxSpeed);
    const targetFov = 64 + speedRatio * 12;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = dampValue(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private getCustomizeCameraFraming() {
    const yaw = this.playerState.yaw;
    // Frame front-right quarter of player shifted slightly left on screen so right drawer has clear visibility
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    return {
      desiredX: this.playerState.x + fwdX * 2.45 + rightX * 0.95,
      desiredY: this.playerState.y + 1.42,
      desiredZ: this.playerState.z + fwdZ * 2.45 + rightZ * 0.95,
      targetX: this.playerState.x + rightX * 0.42,
      targetY: this.playerState.y + 1.05,
      targetZ: this.playerState.z + rightZ * 0.42,
    };
  }

  private snapCustomizePreviewCamera(): void {
    const f = this.getCustomizeCameraFraming();
    this.camPos.set(f.desiredX, f.desiredY, f.desiredZ);
    this.camTarget.set(f.targetX, f.targetY, f.targetZ);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.camInitialized = true;
  }

  private updateCustomizePreviewCamera(dt: number): void {
    const f = this.getCustomizeCameraFraming();
    this.camPos.x = dampValue(this.camPos.x, f.desiredX, 14, dt);
    this.camPos.y = dampValue(this.camPos.y, f.desiredY, 14, dt);
    this.camPos.z = dampValue(this.camPos.z, f.desiredZ, 14, dt);

    this.camTarget.x = dampValue(this.camTarget.x, f.targetX, 16, dt);
    this.camTarget.y = dampValue(this.camTarget.y, f.targetY, 16, dt);
    this.camTarget.z = dampValue(this.camTarget.z, f.targetZ, 16, dt);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  private updatePhotoModeCamera(dt: number): void {
    const dist = this.photoState.distance;
    const pitch = this.photoState.orbitPitch;
    const yaw = this.photoState.orbitYaw;
    const horizDist = dist * Math.cos(pitch);
    const originX = this.playerState.x;
    const originY = this.playerState.y + 1.18 + this.photoState.panY;
    const originZ = this.playerState.z;

    const desiredX = originX + Math.sin(yaw) * horizDist;
    const desiredY = originY + dist * Math.sin(pitch);
    const desiredZ = originZ + Math.cos(yaw) * horizDist;

    let safeX = desiredX;
    let safeY = desiredY;
    let safeZ = desiredZ;
    if (this.activeBlueprint) {
      const floorInfo = getInteriorFloorAndCeilingAt(
        this.playerState.x,
        this.playerState.y,
        this.playerState.z,
        this.activeBlueprint,
        this.activeElevatorState,
      );
      const hit = raycastInteriorCamera(
        originX,
        originY,
        originZ,
        desiredX,
        desiredY,
        desiredZ,
        this.activeBlueprint,
        floorInfo,
      );
      safeX = hit.x;
      safeY = hit.y;
      safeZ = hit.z;
    } else {
      const hit = raycastCameraCollision(
        originX,
        originY,
        originZ,
        desiredX,
        desiredY,
        desiredZ,
        CITY_LAYOUT.colliders,
      );
      safeX = hit.x;
      safeY = Math.max(getGroundHeightAt(hit.x, hit.z, CITY_LAYOUT, this.playerState.y) + 0.25, hit.y);
      safeZ = hit.z;
    }

    const lambda = Math.max(12, 22);
    this.camPos.x = dampValue(this.camPos.x, safeX, lambda, dt);
    this.camPos.y = dampValue(this.camPos.y, safeY, lambda, dt);
    this.camPos.z = dampValue(this.camPos.z, safeZ, lambda, dt);
    this.camTarget.set(originX, originY, originZ);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    if (Math.abs(this.camera.fov - this.photoState.fov) > 0.05) {
      this.camera.fov = dampValue(this.camera.fov, this.photoState.fov, 14, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private spawnImpactParticles(x: number, y: number, z: number, count: number): void {
    let spawned = 0;
    for (let i = 0; i < this.particlePool.length && spawned < count; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.28 + Math.random() * 0.22;
        const angle = Math.random() * Math.PI * 2;
        const spd = 2.2 + Math.random() * 4.5;
        p.vx = Math.cos(angle) * spd;
        p.vy = 2.5 + Math.random() * 3.8;
        p.vz = Math.sin(angle) * spd;
        p.mesh.position.set(x, y + 0.45, z);
        p.mesh.scale.setScalar(1);
        p.mesh.visible = true;
        spawned++;
      }
    }
  }

  private stepParticlePool(dt: number): void {
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const scale = Math.max(0.05, 1 - p.life / p.maxLife);
      p.mesh.scale.setScalar(scale);
    }
  }

  private applyHealthDamage(rawDamage: number): void {
    if (rawDamage <= 0) return;
    this.timeSinceDamage = 0;
    this.playerState.health = Math.max(0, this.playerState.health - rawDamage);
    if (this.playerState.health <= 0) {
      // Safe clinic respawn (never soft-locks)
      if (this.playerMode === 'driving' || this.playerMode === 'entering') {
        const activeV = this.getActiveVehicle();
        if (activeV) {
          activeV.occupant = 'none';
          activeV.speed = 0;
        }
        this.activeVehicleId = null;
        this.playerMode = 'on_foot';
        this.playerRig.root.visible = true;
        document.body.dataset.mode = this.playerMode;
      }
      this.playerState.x = CITY_LAYOUT.spawn.x;
      this.playerState.z = CITY_LAYOUT.spawn.z;
      this.playerState.y = getGroundHeightAt(this.playerState.x, this.playerState.z, CITY_LAYOUT);
      this.playerState.vx = 0;
      this.playerState.vy = 0;
      this.playerState.vz = 0;
      this.playerState.health = this.playerState.maxHealth;
      setWantedLevel(this.missionRuntime, 0);
      const clinicFee = Math.min(this.missionRuntime.money, 50);
      this.missionRuntime.money -= clinicFee;
      this.camInitialized = false;
      this.snapCameraBehindPlayer();
      this.audio.playMissionResult(false);
      this.showActivityToast(
        clinicFee > 0 ? `Recovered at City Clinic (-$${clinicFee})` : 'Recovered at City Clinic',
      );
    }
  }

  private resolvePedestrianVsVehicles(): void {
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const spec = VEHICLE_SPECS[v.kind];
      const rad = Math.max(spec.width * 0.55, spec.length * 0.38);
      const minDist = PLAYER_RADIUS + rad;
      const dx = this.playerState.x - v.x;
      const dz = this.playerState.z - v.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist && Math.abs(this.playerState.y - v.y) < 1.8) {
        if (dSq > 1e-6) {
          const d = Math.sqrt(dSq);
          const push = minDist - d;
          this.playerState.x += (dx / d) * push;
          this.playerState.z += (dz / d) * push;
        } else {
          this.playerState.x += minDist;
        }
      }
    }
  }

  private pushHudSnapshot(force = false): void {
    const now = performance.now();
    const coordX = this.activeEntrance ? this.activeEntrance.doorX : this.playerState.x;
    const coordZ = this.activeEntrance ? this.activeEntrance.doorZ : this.playerState.z;
    const district = getDistrictAt(coordX, coordZ, CITY_LAYOUT);
    if (!force && now - this.lastHudPushTime < 100 && district.id === this.lastDistrictId) {
      return;
    }
    this.lastHudPushTime = now;
    this.lastDistrictId = district.id;

    const activeVehicle = this.getActiveVehicle();
    let interactPrompt: HudSnapshot['interactPrompt'] = null;

    if (this.activeBlueprint) {
      if (!this.buildingTransition) {
        const nearInt = findNearestInteriorInteractable(
          this.playerState.x,
          this.playerState.y,
          this.playerState.z,
          this.activeBlueprint,
          this.activeInteriorDoors,
          this.currentInteriorFloor,
          this.activeElevatorState,
        );
        const nearQuiz = findNearestQuizKiosk(
          this.playerState.x,
          this.playerState.y,
          this.playerState.z,
          this.interiorKiosks,
        );
        if (
          nearQuiz &&
          (!nearInt ||
            Math.hypot(nearQuiz.x - this.playerState.x, nearQuiz.z - this.playerState.z) < 2.2)
        ) {
          interactPrompt = {
            kind: 'quiz_kiosk',
            label: nearQuiz.allCompleted
              ? `Review ${nearQuiz.label}`
              : `${nearQuiz.label} (${nearQuiz.nextSubjectName})`,
          };
        } else if (nearInt) {
          interactPrompt = { kind: nearInt.kind, label: nearInt.label };
        }
      }
    } else if (this.playerMode === 'on_foot' && !this.buildingTransition) {
      if (this.activeLadder) {
        interactPrompt = {
          kind: 'climb_ladder',
          label: 'Let Go of Ladder (E / Space)',
        };
      } else {
        const nearRoofDoor = findNearestRooftopInteriorDoor(
          this.playerState.x,
          this.playerState.y,
          this.playerState.z,
          CITY_LAYOUT,
        );
        const nearLadder = findNearestExteriorLadder(
          this.playerState.x,
          this.playerState.y,
          this.playerState.z,
          CITY_LAYOUT,
        );
        const nearEntrance = findNearestExteriorEntrance(
          this.playerState.x,
          this.playerState.z,
          CITY_LAYOUT.entrances,
        );
        const nearMission = findNearestMissionStart(
          this.playerState.x,
          this.playerState.z,
          this.missionRuntime,
        );
        const nearVehicle = findNearestInteractableVehicle(
          this.playerState.x,
          this.playerState.z,
          this.vehicles,
          VEHICLE_INTERACT_RANGE,
          this.playerState.y,
        );
        const nearKiosk = findNearestQuizKiosk(
          this.playerState.x,
          this.playerState.y,
          this.playerState.z,
          this.outdoorKiosks,
        );
        const nearGateJet = this.findNearestOutdoorGateJet();

        const prompts: Array<{
          kind: NonNullable<HudSnapshot['interactPrompt']>['kind'];
          label: string;
          dist: number;
        }> = [];
        if (nearGateJet) {
          prompts.push({
            kind: 'board_flight',
            label: `Board Flight at ${nearGateJet.name} (${nearGateJet.code})`,
            dist: Math.hypot(nearGateJet.gateJetX - this.playerState.x, nearGateJet.gateJetZ - this.playerState.z) * 0.4,
          });
        }
        if (nearRoofDoor) {
          prompts.push({
            kind: 'rooftop_enter',
            label: `Enter ${nearRoofDoor.rooftop.name} (Floor ${nearRoofDoor.targetFloor})`,
            dist: nearRoofDoor.distance,
          });
        }
        if (nearLadder) {
          prompts.push({
            kind: 'climb_ladder',
            label:
              nearLadder.entryEnd === 'top'
                ? `Climb Down ${nearLadder.ladder.label}`
                : `Climb ${nearLadder.ladder.label}`,
            dist: nearLadder.distance,
          });
        }
        if (nearEntrance && Math.abs(this.playerState.y - CITY_LAYOUT.sidewalkHeight) < 2.2) {
          prompts.push({
            kind: 'building_enter',
            label: `Enter ${nearEntrance.name}`,
            dist: Math.hypot(nearEntrance.doorX - this.playerState.x, nearEntrance.doorZ - this.playerState.z),
          });
        }
        if (nearMission && Math.abs(this.playerState.y - CITY_LAYOUT.sidewalkHeight) < 2.2) {
          prompts.push({
            kind: 'mission',
            label: `Start ${nearMission.title}`,
            dist: Math.hypot(nearMission.startX - this.playerState.x, nearMission.startZ - this.playerState.z),
          });
        }
        if (nearVehicle && Math.abs(this.playerState.y - nearVehicle.y) < 3.6) {
          prompts.push({
            kind: 'vehicle',
            label: `Drive ${nearVehicle.label}`,
            dist: Math.hypot(nearVehicle.x - this.playerState.x, nearVehicle.z - this.playerState.z),
          });
        }
        if (nearKiosk) {
          prompts.push({
            kind: 'quiz_kiosk',
            label: nearKiosk.allCompleted
              ? `Review ${nearKiosk.nextSubjectName} Quiz`
              : `Answer ${nearKiosk.nextSubjectName} Quiz (${nearKiosk.remainingCount} left)`,
            dist: Math.hypot(nearKiosk.x - this.playerState.x, nearKiosk.z - this.playerState.z),
          });
        }
        prompts.sort((a, b) => a.dist - b.dist);
        if (prompts.length > 0) {
          interactPrompt = { kind: prompts[0].kind, label: prompts[0].label };
        }
      }
    } else if (this.playerMode === 'driving') {
      const nearMission = findNearestMissionStart(
        this.playerState.x,
        this.playerState.z,
        this.missionRuntime,
        5.0,
      );
      if (nearMission) {
        interactPrompt = { kind: 'mission', label: `Start ${nearMission.title}` };
      }
    }

    let activeMissionSnap: HudSnapshot['activeMission'] = null;
    if (this.missionRuntime.activeMission) {
      const am = this.missionRuntime.activeMission;
      const def = getMissionDefinition(am.missionId);
      const cp = def?.checkpoints[am.checkpointIndex];
      if (def && cp) {
        activeMissionSnap = {
          id: am.missionId,
          type: am.type,
          title: am.title,
          targetLabel: cp.label,
          targetX: cp.x,
          targetZ: cp.z,
          distanceToTarget: Math.round(Math.hypot(cp.x - coordX, cp.z - coordZ)),
          checkpointIndex: am.checkpointIndex,
          totalCheckpoints: am.totalCheckpoints,
          timeRemaining: Math.max(0, Math.ceil(am.timeRemaining)),
          reward: am.reward,
        };
      }
    }

    const availableMissions = this.missionRuntime.activeMission
      ? []
      : MISSION_DEFINITIONS.map((m) => ({
          id: m.id,
          type: m.type,
          title: m.title,
          x: m.startX,
          z: m.startZ,
          color: m.badgeColor,
        }));

    const trafficMarkers = this.vehicles
      .filter((v) => v.occupant === 'police' || v.occupant === 'traffic')
      .map((v) => ({ x: v.x, z: v.z, isPolice: v.isPolice }));

    const activeQuestionsCount = getActiveQuestions(this.questionDb).length;
    const activeElev = this.activeBlueprint?.elevators[0];
    const inElevCabin = Boolean(
      activeElev &&
        this.activeElevatorState &&
        isPointInElevatorCabin(
          this.playerState.x,
          this.playerState.y,
          this.playerState.z,
          activeElev,
          this.activeElevatorState.currentY,
          0.18,
        ),
    );
    const explorationObjectives = evaluateExplorationObjectives(
      this.questionDb,
      this.quizProgress,
      this.explorationTracker,
    );

    const activeCity = getCityAt(coordX, coordZ, CITY_LAYOUT);

    this.callbacks.onSnapshot({
      phase: this.phase,
      timeOfDay: this.timeOfDay,
      timeLabel: TIME_PRESETS[this.timeOfDay].label,
      cityId: activeCity.id,
      cityName: activeCity.name,
      district: district.id,
      districtName: this.activeBlueprint ? this.activeBlueprint.name : district.name,
      activeFlight: this.flightSequence
        ? (() => {
            const prog = Math.min(1, this.flightSequence.timer / this.flightSequence.duration);
            const phaseLabel =
              prog < 0.22
                ? 'Takeoff'
                : prog > 0.78
                  ? `Landing · ${this.flightSequence.destAirportCode}`
                  : `Cruising → ${this.flightSequence.destAirportCode}`;
            return {
              fromCityName: this.flightSequence.originCityName,
              toCityName: this.flightSequence.destCityName,
              progress: prog,
              phaseLabel,
            };
          })()
        : null,
      speed: activeVehicle ? Math.abs(activeVehicle.speed) : this.playerState.speed,
      stamina: this.playerState.stamina,
      health: Math.round(this.playerState.health),
      maxHealth: this.playerState.maxHealth,
      isSprinting: this.playerState.isSprinting,
      grounded: this.playerState.grounded,
      inWater: Boolean(this.playerState.inWater),
      isUnderwater: Boolean(this.playerState.isUnderwater),
      waterDepth:
        activeVehicle && activeVehicle.kind === 'submarine'
          ? Math.max(0, Math.round((WATER_SURFACE_Y - activeVehicle.y) * 10) / 10)
          : Math.round((this.playerState.waterDepth ?? 0) * 10) / 10,
      distanceWalked: this.playerState.distanceWalked,
      elapsedTime: this.playerState.elapsedTime,
      playerX: coordX,
      playerZ: coordZ,
      playerYaw: this.playerState.yaw,
      cameraYaw: this.playerState.cameraYaw,
      pointerLocked: this.pointerLocked,
      money: this.missionRuntime.money,
      wantedLevel: this.missionRuntime.wantedLevel,
      playerMode: this.playerMode,
      currentVehicleKind: activeVehicle ? activeVehicle.kind : null,
      currentVehicleLabel: activeVehicle ? activeVehicle.label : null,
      interactPrompt,
      activeRooftopName: this.activeRooftop ? this.activeRooftop.name : null,
      isClimbingLadder: Boolean(this.activeLadder),
      photoModeActive: this.previewMode === 'photo',
      activeMission: activeMissionSnap,
      missionBanner: this.missionRuntime.missionBanner
        ? {
            status: this.missionRuntime.missionBanner.status,
            title: this.missionRuntime.missionBanner.title,
            reward: this.missionRuntime.missionBanner.reward,
            message: this.missionRuntime.missionBanner.message,
          }
        : null,
      availableMissions,
      trafficMarkers,
      progression: cloneProgression(this.progression),
      challenges: getChallengeStatuses(this.progression),
      completedMissionIds: [...this.missionRuntime.completedIds],
      settings: { ...this.settings },
      activityToast: this.activityToast,
      lastSavedAt: this.lastSavedAt,
      interior: this.activeBlueprint
        ? {
            active: true,
            buildingId: this.activeBlueprint.buildingId,
            buildingName: this.activeBlueprint.name,
            category: this.activeBlueprint.category,
            subtype: this.activeBlueprint.subtype,
            currentFloor: this.currentInteriorFloor,
            totalFloors: this.activeBlueprint.floorsCount,
            hasElevator: this.activeBlueprint.elevators.length > 0,
            elevatorFloor: this.activeElevatorState?.currentFloor,
            elevatorMoving: this.activeElevatorState?.moving,
            elevatorDoorState: this.activeElevatorState?.doorState,
            inElevatorCabin: inElevCabin,
          }
        : null,
      transitionFade: this.transitionFade,
      quizPoints: this.quizProgress.earnedPoints,
      knowledgePoints: this.knowledgePoints,
      completedQuestionsCount: this.quizProgress.completedQuestionIds.length,
      activeQuestionsCount,
      explorationObjectives,
      animState: this.playerAnimRuntime.currentState,
      isSitting: Boolean(this.activeSitSpot),
      remotePlayerMarkers: [...this.remoteAvatars.values()]
        .filter((e) => e.state.target.currentBuilding === (this.activeBlueprint?.buildingId || null))
        .map((e) => ({
          playerId: e.state.playerId,
          displayName: e.state.displayName,
          x: e.state.x,
          z: e.state.z,
          groupId: e.state.target.groupId ?? null,
        })),
      nearbyPlayers: [...this.remoteAvatars.values()]
        .filter((e) => {
          const sameB = (e.state.target.currentBuilding || null) === (this.activeBlueprint?.buildingId || null);
          const sameF = !this.activeBlueprint || e.state.target.currentFloor === this.currentInteriorFloor;
          if (!sameB || !sameF) return false;
          return Math.hypot(e.state.x - this.playerState.x, e.state.z - this.playerState.z) <= 6.5;
        })
        .map((e) => ({
          playerId: e.state.playerId,
          displayName: e.state.displayName,
          distance: Math.round(Math.hypot(e.state.x - this.playerState.x, e.state.z - this.playerState.z) * 10) / 10,
          animState: e.state.target.animState || e.state.target.movementState,
          currentActivity: e.state.target.currentActivity,
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6),
    });
  }

  private setupListeners(): void {
    const canvas = this.renderer.domElement;

    const isTextInputFocused = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextInputFocused(e.target)) {
        return;
      }
      if (this.previewMode !== 'none') {
        return;
      }

      if (e.code === 'KeyM') {
        this.toggleMute();
        return;
      }

      if (e.code === 'KeyT' && this.phase === 'playing') {
        this.cycleTimeOfDay();
        return;
      }

      if (this.phase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.startGame();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (this.phase === 'playing') {
          this.pauseGame();
        } else if (this.phase === 'paused') {
          this.resumeGame();
        }
        return;
      }

      if (this.phase !== 'playing') return;

      if (e.code === 'KeyE' && !e.repeat) {
        e.preventDefault();
        this.triggerInteract();
        return;
      }

      if (e.code === 'KeyF' && !e.repeat) {
        e.preventDefault();
        this.triggerMissionAction();
        return;
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = true;
          this.drivingInput.accelerate = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = true;
          this.drivingInput.brakeReverse = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = true;
          this.drivingInput.steerLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = true;
          this.drivingInput.steerRight = true;
          break;
        case 'KeyQ':
        case 'ControlLeft':
        case 'ControlRight':
          if (!e.shiftKey && !e.altKey && !e.metaKey) {
            this.input.diveHeld = true;
            this.drivingInput.dive = true;
          }
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = true;
          break;
        case 'Space':
          e.preventDefault();
          if (!this.input.jumpHeld) {
            this.input.jumpJustPressed = true;
          }
          this.input.jumpHeld = true;
          this.drivingInput.handbrake = true;
          this.drivingInput.ascend = true;
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = false;
          this.drivingInput.accelerate = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = false;
          this.drivingInput.brakeReverse = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = false;
          this.drivingInput.steerLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = false;
          this.drivingInput.steerRight = false;
          break;
        case 'KeyQ':
        case 'ControlLeft':
        case 'ControlRight':
          this.input.diveHeld = false;
          this.drivingInput.dive = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = false;
          break;
        case 'Space':
          this.input.jumpHeld = false;
          this.drivingInput.handbrake = false;
          this.drivingInput.ascend = false;
          break;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (this.phase !== 'playing') return;
      this.audio.unlock();
      this.isMouseDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (e.button === 0 && !this.pointerLocked && canvas.requestPointerLock) {
        try {
          const maybePromise = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {});
          }
        } catch {
          // Mouse-drag fallback works even when pointer lock is unavailable
        }
      }
    };

    const onMouseUp = () => {
      this.isMouseDragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.phase !== 'playing') return;
      if (this.pointerLocked) {
        if (this.skipNextLockedMove) {
          this.skipNextLockedMove = false;
          return;
        }
        const mx = Math.max(-45, Math.min(45, e.movementX));
        const my = Math.max(-45, Math.min(45, e.movementY));
        this.rotateCameraBy(mx * 0.0028, my * 0.0022);
      } else if (this.isMouseDragging) {
        const dx = Math.max(-60, Math.min(60, e.clientX - this.lastMouseX));
        const dy = Math.max(-60, Math.min(60, e.clientY - this.lastMouseY));
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.rotateCameraBy(dx * 0.0045, dy * 0.0035);
      }
    };

    const onPointerLockChange = () => {
      const nowLocked = document.pointerLockElement === canvas;
      if (nowLocked && !this.pointerLocked) {
        this.skipNextLockedMove = true;
      }
      this.pointerLocked = nowLocked;
      this.pushHudSnapshot(true);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (this.phase !== 'playing') return;
      this.audio.unlock();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.cameraTouchId === null) {
          this.cameraTouchId = t.identifier;
          this.lastTouchX = t.clientX;
          this.lastTouchY = t.clientY;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (this.phase !== 'playing' || this.cameraTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.cameraTouchId) {
          const dx = t.clientX - this.lastTouchX;
          const dy = t.clientY - this.lastTouchY;
          this.lastTouchX = t.clientX;
          this.lastTouchY = t.clientY;
          this.rotateCameraBy(dx * 0.0055, dy * 0.0042);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.cameraTouchId) {
          this.cameraTouchId = null;
        }
      }
    };

    const onBlur = () => {
      this.clearHeldInputs();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        this.clearHeldInputs();
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextError?.('WebGL context lost. Attempting recovery...');
    };

    const onContextRestored = () => {
      this.callbacks.onContextError?.('');
    };

    const handleResize = () => {
      if (this.isDisposed) return;
      const w = Math.max(this.container.clientWidth, window.innerWidth, 320);
      const h = Math.max(this.container.clientHeight, window.innerHeight, 240);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.render(this.scene, this.camera);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(handleResize);
      this.resizeObserver.observe(this.container);
    }

    this.disposeCallbacks.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      this.resizeObserver?.disconnect();
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.isDisposed) return;

      const now = performance.now();
      const rawDt = Math.max(0.001, (now - this.lastTickTime) / 1000);
      this.lastTickTime = now;
      const dt = Math.min(rawDt, 0.05);
      const isNightOrDusk = this.timeOfDay === 'malam' || this.timeOfDay === 'sore';

      if (!this.activeBlueprint) {
        this.updateTimeOfDayLighting(dt);
      }

      if (this.phase === 'title') {
        this.titleElapsed += dt;
        this.worldElapsed += dt;
        this.updateTitleCamera(this.titleElapsed);
        stepSkyLifeState(this.skyLifeState, dt);
        this.skyLifeRig.update(this.skyLifeState);
        this.builtCity.updateEnvironment(this.worldElapsed);
        stepNpcs(this.npcs, dt, 999, 999, CITY_LAYOUT);
        stepTrafficAndPolice(this.vehicles, dt, this.worldElapsed, 0, 999, 999, false, CITY_LAYOUT);
        resolveVehiclesPairwise(this.vehicles);
        for (let i = 0; i < this.npcs.length; i++) {
          animateNpcRig(this.npcRigs[i], this.npcs[i], this.titleElapsed);
        }
        for (let i = 0; i < this.vehicles.length; i++) {
          animateVehicleRig(this.vehicleRigs[i], this.vehicles[i], 0, isNightOrDusk);
        }
        animateCharacterRig(this.playerRig, this.playerState, 0, this.titleElapsed);
      } else if (this.phase === 'playing' && this.previewMode === 'photo') {
        // Photo Mode: Freeze local character in chosen pose while keeping the 3D city, sky life, boats, traffic & NPCs alive!
        this.worldElapsed += dt;
        stepSkyLifeState(this.skyLifeState, dt);
        this.skyLifeRig.update(this.skyLifeState);
        this.builtCity.updateEnvironment(this.worldElapsed);
        this.audio.updateEngineSound(false, 0, 1);

        if (!this.activeBlueprint) {
          stepNpcs(this.npcs, dt, this.playerState.x, this.playerState.z, CITY_LAYOUT);
          stepTrafficAndPolice(
            this.vehicles,
            dt,
            this.worldElapsed,
            0,
            this.playerState.x,
            this.playerState.z,
            false,
            CITY_LAYOUT,
          );
          resolveVehiclesPairwise(this.vehicles);
          for (let i = 0; i < this.npcs.length; i++) {
            const npc = this.npcs[i];
            const rig = this.npcRigs[i];
            const visible =
              Math.hypot(npc.x - this.playerState.x, npc.z - this.playerState.z) <= 135;
            rig.root.visible = visible;
            if (visible) animateNpcRig(rig, npc, this.worldElapsed);
          }
          for (let i = 0; i < this.vehicles.length; i++) {
            const v = this.vehicles[i];
            const rig = this.vehicleRigs[i];
            const visible =
              Math.hypot(v.x - this.playerState.x, v.z - this.playerState.z) <= 185;
            rig.root.visible = visible;
            if (visible) animateVehicleRig(rig, v, 0, isNightOrDusk);
          }
        }

        stepCharacterAnimRuntime(
          this.playerAnimRuntime,
          {
            speed: 0,
            vy: 0,
            grounded: true,
            isSprinting: false,
            isMoving: false,
            isDriving: false,
            onStairs: false,
            photoPose: this.photoState.pose,
            sitting: this.photoState.pose === 'sit',
            elapsedTime: this.worldElapsed,
          },
          dt,
        );
        const pGroundY = this.activeBlueprint
          ? this.playerState.y
          : getGroundHeightAt(this.playerState.x, this.playerState.z, CITY_LAYOUT, this.playerState.y);
        applyArticulatedPoseToRig(
          this.playerRig,
          this.playerAnimRuntime.pose,
          this.playerState.x,
          this.playerState.y,
          this.playerState.z,
          this.playerState.yaw,
          pGroundY,
          1,
        );
        this.updatePhotoModeCamera(dt);
        this.pushHudSnapshot(false);
      } else if (
        this.phase === 'playing' &&
        (this.previewMode === 'teacher' ||
          this.previewMode === 'quiz' ||
          this.previewMode === 'pin' ||
          this.previewMode === 'session' ||
          this.previewMode === 'elevator' ||
          this.previewMode === 'flight')
      ) {
        // Freeze gameplay physics & timers while modal dialogs are open
        this.audio.updateEngineSound(false, 0, 1);
      } else if (this.phase === 'playing') {
        this.worldElapsed += dt;
        this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.8);
        this.timeSinceDamage += dt;
        if (this.activityToastTimer > 0) {
          this.activityToastTimer -= dt;
          if (this.activityToastTimer <= 0) {
            this.activityToast = null;
          }
        }
        this.stepParticlePool(dt);

        // Stand up automatically if player attempts to walk or jump while seated
        if (
          this.activeSitSpot &&
          (this.input.forward ||
            this.input.backward ||
            this.input.left ||
            this.input.right ||
            Math.abs(this.input.moveX) > 0.15 ||
            Math.abs(this.input.moveY) > 0.15 ||
            this.input.jumpJustPressed)
        ) {
          this.activeSitSpot = null;
        }

        // Building enter/exit door transition animation sequence
        if (this.buildingTransition) {
          const bt = this.buildingTransition;
          bt.timer += dt;

          // Animate exterior door opening during enter transition
          this.builtCity.exteriorDoors.forEach((rig) => {
            const target = rig.targetOpen ? 1 : 0;
            const next = rig.openProgress + (target - rig.openProgress) * Math.min(1, dt * 8);
            rig.setOpenProgress(next);
          });

          if (this.activeBuiltInterior) {
            stepInteriorDoors(this.activeInteriorDoors, dt);
            this.activeBuiltInterior.syncDoors(this.activeInteriorDoors);
          }

          if (bt.kind === 'enter') {
            if (!bt.swapped) {
              this.transitionFade = Math.max(0, Math.min(1, (bt.timer - 0.16) / 0.22));
              if (bt.timer >= 0.38 && bt.entrance) {
                bt.swapped = true;
                this.transitionFade = 1;
                this.swapToInterior(bt.entrance, bt.targetFloor);
              }
            } else {
              this.transitionFade = Math.max(0, 1 - (bt.timer - 0.38) / 0.22);
              if (bt.timer >= 0.6) {
                this.transitionFade = 0;
                this.buildingTransition = null;
                this.pushHudSnapshot(true);
              }
            }
          } else if (bt.kind === 'exit') {
            if (!bt.swapped) {
              this.transitionFade = Math.max(0, Math.min(1, (bt.timer - 0.12) / 0.2));
              if (bt.timer >= 0.34) {
                bt.swapped = true;
                this.transitionFade = 1;
                this.exitInteriorToCity(bt.rooftopTarget);
              }
            } else {
              this.transitionFade = Math.max(0, 1 - (bt.timer - 0.34) / 0.22);
              if (bt.timer >= 0.56) {
                this.transitionFade = 0;
                this.buildingTransition = null;
                this.pushHudSnapshot(true);
              }
            }
          }

          this.pushHudSnapshot(true);
        } else if (this.activeBlueprint && this.activeBuiltInterior) {
          // Active Indoor 3D Building Interior Gameplay
          stepInteriorDoors(this.activeInteriorDoors, dt);
          this.activeBuiltInterior.syncDoors(this.activeInteriorDoors);

          // Step physically animated 3D Elevator + carry cabin passengers smoothly
          let ridingInElevator = false;
          const elevBlueprint = this.activeBlueprint.elevators[0];
          if (this.activeElevatorState && elevBlueprint) {
            const wasInCabin = isPointInElevatorCabin(
              this.playerState.x,
              this.playerState.y,
              this.playerState.z,
              elevBlueprint,
              this.activeElevatorState.currentY,
              0.2,
            );
            const elevEvents = stepElevatorRuntime(this.activeElevatorState, dt, elevBlueprint.floors);
            this.activeBuiltInterior.syncElevator(this.activeElevatorState);
            if (elevEvents.arrivedFloor !== null) {
              this.audio.playElevatorChime();
              if (wasInCabin) {
                this.showActivityToast(
                  elevEvents.arrivedFloor === 22
                    ? 'Arrived: Floor 22 · Open-Air Rooftop'
                    : `Arrived: Floor ${elevEvents.arrivedFloor}`,
                );
              }
            }
            if (wasInCabin) {
              ridingInElevator = true;
              this.playerState.y = this.activeElevatorState.currentY;
              this.playerState.vy = 0;
              this.playerState.grounded = true;
            }
          }

          const prevX = this.playerState.x;
          const prevZ = this.playerState.z;
          const prevY = this.playerState.y;
          const prevYaw = this.playerState.yaw;

          let res: ReturnType<typeof stepInteriorPlayerPhysics>;
          if (this.activeSitSpot) {
            this.input.jumpJustPressed = false;
            this.playerState.elapsedTime += dt;
            this.playerState.speed = 0;
            this.playerState.isMoving = false;
            res = {
              jumped: false,
              landed: false,
              floorInfo: getInteriorFloorAndCeilingAt(
                this.playerState.x,
                this.playerState.y,
                this.playerState.z,
                this.activeBlueprint,
                this.activeElevatorState,
              ),
            };
          } else {
            res = stepInteriorPlayerPhysics(
              this.playerState,
              this.input,
              dt,
              this.activeBlueprint,
              this.activeInteriorDoors,
              this.activeElevatorState,
            );
          }

          if (ridingInElevator && this.activeElevatorState) {
            this.playerState.y = this.activeElevatorState.currentY;
            this.playerState.grounded = true;
            res.floorInfo.currentFloor = this.activeElevatorState.currentFloor;
            res.floorInfo.floorY = this.activeElevatorState.currentY;
            res.floorInfo.ceilingY = this.activeElevatorState.currentY + 3.4;
          }

          this.input.jumpJustPressed = false;
          this.currentInteriorFloor = res.floorInfo.currentFloor;
          this.prevOnStairs = res.floorInfo.onStairs;
          this.progression.totalDistance += Math.hypot(
            this.playerState.x - prevX,
            this.playerState.z - prevZ,
          );

          if (this.currentInteriorFloor !== this.prevInteriorFloor) {
            this.prevInteriorFloor = this.currentInteriorFloor;
            this.activeBuiltInterior.syncVisibleFloorWindow(this.currentInteriorFloor);
            recordVisitedBuilding(
              this.explorationTracker,
              this.activeBlueprint.buildingId,
              this.currentInteriorFloor,
            );
            if (res.floorInfo.hasOpenSky) {
              this.showActivityToast('Floor 22 · Open-Air Rooftop!');
            }
          }

          // Open-Air Rooftop Skyline visibility: reveal city skyline, sky life & time-of-day sky on Floor 22 Rooftop
          if (res.floorInfo.hasOpenSky) {
            if (!this.builtCity.group.visible) {
              this.builtCity.group.visible = true;
            }
            this.skyLifeRig.group.visible = true;
            stepSkyLifeState(this.skyLifeState, dt);
            this.skyLifeRig.update(this.skyLifeState);
            this.builtCity.updateEnvironment(this.worldElapsed);
            this.updateTimeOfDayLighting(dt);
          } else {
            this.skyLifeRig.group.visible = false;
            if (this.builtCity.group.visible) {
              this.builtCity.group.visible = false;
              (this.scene.background as THREE.Color).setHex(0x131822);
              const fog = this.scene.fog as THREE.FogExp2;
              fog.color.setHex(0x131822);
              fog.density = 0;
              this.sunLight.intensity = 0.22;
              this.hemiLight.color.setHex(this.activeBlueprint.ambientColor);
              this.hemiLight.groundColor.setHex(0x475569);
              this.hemiLight.intensity = 0.92;
              this.scene.environmentIntensity = 0.55;
              this.renderer.toneMappingExposure = 1.12;
            }
          }

          if (res.jumped) this.audio.playJump();
          if (res.landed) this.audio.playLand();
          this.audio.updateFootsteps(
            this.playerState.gaitPhase,
            this.playerState.grounded,
            this.playerState.isMoving,
            this.playerState.isSprinting,
          );
          this.audio.updateEngineSound(false, 0, 1);

          const dy = this.playerState.y - prevY;
          const stairDir: 'up' | 'down' | 'none' =
            !res.floorInfo.onStairs ? 'none' : dy > 0.008 ? 'up' : dy < -0.008 ? 'down' : 'none';
          const turnDeltaYaw = shortestAngleDelta(prevYaw, this.playerState.yaw) / Math.max(0.001, dt);
          stepCharacterAnimRuntime(
            this.playerAnimRuntime,
            {
              speed: this.playerState.speed,
              vy: this.playerState.vy,
              grounded: this.playerState.grounded,
              isSprinting: this.playerState.isSprinting,
              isMoving: this.playerState.isMoving,
              isDriving: false,
              onStairs: res.floorInfo.onStairs,
              stairDirection: stairDir,
              turnDeltaYaw,
              inElevator: ridingInElevator,
              sitting: Boolean(this.activeSitSpot),
              elapsedTime: this.playerState.elapsedTime,
            },
            dt,
          );
          applyArticulatedPoseToRig(
            this.playerRig,
            this.playerAnimRuntime.pose,
            this.playerState.x,
            this.playerState.y,
            this.playerState.z,
            this.playerState.yaw,
            res.floorInfo.floorY,
            this.playerState.squashY,
          );
          this.prevPlayerY = this.playerState.y;
          this.prevPlayerYaw = this.playerState.yaw;

          if (this.previewMode === 'customize') {
            this.updateCustomizePreviewCamera(dt);
          } else {
            this.updateInteriorCamera(dt, res.floorInfo);
          }
          this.pushHudSnapshot(false);
        } else {
          // Outdoor City Gameplay
          this.builtCity.exteriorDoors.forEach((rig) => {
            if (rig.openProgress > 0.005) {
              const next = Math.max(0, rig.openProgress - dt * 3.5);
              rig.setOpenProgress(next);
            }
          });

          // Step Sky Wildlife, Aircraft, Boats & Airport Radar outdoors
          this.skyLifeRig.group.visible = true;
          stepSkyLifeState(this.skyLifeState, dt);
          this.skyLifeRig.update(this.skyLifeState);
          this.builtCity.updateEnvironment(this.worldElapsed);

          if (this.playerMode === 'on_foot') {
            const prevX = this.playerState.x;
            const prevZ = this.playerState.z;
            const prevYaw = this.playerState.yaw;
            let events = { jumped: false, landed: false, vaulted: false };
            this.lastLadderClimbSpeed = 0;

            if (this.activeLadder) {
              if (this.input.jumpJustPressed) {
                const l = this.activeLadder;
                this.activeLadder = null;
                this.playerState.activeLadderId = null;
                this.playerState.x = l.x + l.normalX * 1.1;
                this.playerState.z = l.z + l.normalZ * 1.1;
                this.playerState.vy = 2.0;
                this.audio.playJump();
              } else {
                const climbInput = Math.max(
                  -1,
                  Math.min(1, this.input.moveY + (this.input.forward ? 1 : 0) - (this.input.backward ? 1 : 0)),
                );
                const ladderRes = stepLadderClimb(this.playerState, this.activeLadder, climbInput, dt);
                this.lastLadderClimbSpeed = ladderRes.climbSpeed;
                if (ladderRes.finished) {
                  this.activeLadder = null;
                  if (ladderRes.exitReason === 'reached_top') {
                    const reachedRoof = findRooftopAt(
                      this.playerState.x,
                      this.playerState.y,
                      this.playerState.z,
                      CITY_LAYOUT,
                    );
                    if (reachedRoof) {
                      this.showActivityToast(`Reached ${reachedRoof.name}!`);
                    }
                  }
                  this.pushHudSnapshot(true);
                }
              }
            } else if (this.activeSitSpot) {
              this.input.jumpJustPressed = false;
              this.playerState.elapsedTime += dt;
              this.playerState.speed = 0;
              this.playerState.isMoving = false;
            } else {
              events = stepPlayerPhysics(this.playerState, this.input, dt, CITY_LAYOUT);
            }
            this.input.jumpJustPressed = false;
            this.prevOnStairs = false;
            this.progression.totalDistance += Math.hypot(this.playerState.x - prevX, this.playerState.z - prevZ);
            this.activeRooftop = findRooftopAt(
              this.playerState.x,
              this.playerState.y,
              this.playerState.z,
              CITY_LAYOUT,
            );

            stepNpcs(this.npcs, dt, this.playerState.x, this.playerState.z, CITY_LAYOUT);
            resolvePlayerVsNpcs(this.playerState, this.npcs);
            this.resolvePedestrianVsVehicles();

            if (events.jumped) this.audio.playJump();
            if (events.vaulted) {
              this.spawnImpactParticles(this.playerState.x, this.playerState.y, this.playerState.z, 3);
            }
            if (events.landed) {
              this.audio.playLand();
              this.spawnImpactParticles(this.playerState.x, this.playerState.y, this.playerState.z, 3);
            }
            this.audio.updateFootsteps(
              this.playerState.gaitPhase,
              this.playerState.grounded && !this.activeLadder && !this.playerState.inWater,
              this.playerState.isMoving && !this.activeLadder && !this.playerState.inWater,
              this.playerState.isSprinting,
            );
            this.audio.updateEngineSound(false, 0, 1);

            const groundY = getGroundHeightAt(
              this.playerState.x,
              this.playerState.z,
              CITY_LAYOUT,
              this.playerState.y,
            );
            const turnDeltaYaw = shortestAngleDelta(prevYaw, this.playerState.yaw) / Math.max(0.001, dt);
            this.prevTurnDeltaYaw = turnDeltaYaw;
            stepCharacterAnimRuntime(
              this.playerAnimRuntime,
              {
                speed: this.playerState.speed,
                vy: this.playerState.vy,
                grounded: this.playerState.grounded,
                isSprinting: this.playerState.isSprinting,
                isMoving: this.playerState.isMoving,
                isDriving: false,
                onStairs: false,
                climbingLadder: Boolean(this.activeLadder),
                climbSpeed: this.lastLadderClimbSpeed,
                parkourActive: (this.playerState.parkourTimer ?? 0) > 0,
                turnDeltaYaw,
                sitting: Boolean(this.activeSitSpot),
                swimming: Boolean(this.playerState.inWater),
                underwater: Boolean(this.playerState.isUnderwater),
                diveVy: this.playerState.vy,
                elapsedTime: this.playerState.elapsedTime,
              },
              dt,
            );
            applyArticulatedPoseToRig(
              this.playerRig,
              this.playerAnimRuntime.pose,
              this.playerState.x,
              this.playerState.y,
              this.playerState.z,
              this.playerState.yaw,
              this.playerState.inWater ? this.playerState.y : groundY,
              this.playerState.squashY,
            );
            if (this.previewMode === 'customize') {
              this.updateCustomizePreviewCamera(dt);
            } else {
              this.updateFollowCamera(dt);
            }
          } else if (this.playerMode === 'entering') {
            this.playerState.elapsedTime += dt;
            this.transitionTimer += dt;
            const t = Math.min(1, this.transitionTimer / this.transitionDuration);
            const ease = 1 - Math.pow(1 - t, 3);
            const hop = Math.sin(t * Math.PI) * 0.22;
            this.playerState.x =
              this.transitionStartPos.x + (this.transitionEndPos.x - this.transitionStartPos.x) * ease;
            this.playerState.z =
              this.transitionStartPos.z + (this.transitionEndPos.z - this.transitionStartPos.z) * ease;
            this.playerState.y =
              this.transitionStartPos.y +
              (this.transitionEndPos.y - this.transitionStartPos.y) * ease +
              hop;
            this.playerState.yaw =
              this.transitionStartPos.yaw +
              shortestAngleDelta(this.transitionStartPos.yaw, this.transitionEndPos.yaw) * ease;

            this.playerRig.root.position.set(this.playerState.x, this.playerState.y, this.playerState.z);
            this.playerRig.root.rotation.y = this.playerState.yaw;

            const activeV = this.getActiveVehicle();
            if (activeV) {
              const openRider =
                VEHICLE_SPECS[activeV.kind].isMotorcycle ||
                activeV.kind === 'jetski' ||
                activeV.kind === 'speedboat';
              if (t >= 0.72 && !openRider) {
                this.playerRig.root.visible = false;
              }
              this.updateDrivingCamera(activeV, dt);
            }

            if (t >= 1) {
              this.playerMode = 'driving';
              document.body.dataset.mode = this.playerMode;
              if (activeV) {
                const openRider =
                  VEHICLE_SPECS[activeV.kind].isMotorcycle ||
                  activeV.kind === 'jetski' ||
                  activeV.kind === 'speedboat';
                if (!openRider) {
                  this.playerRig.root.visible = false;
                }
              }
              this.pushHudSnapshot(true);
            }
          } else if (this.playerMode === 'driving') {
            this.playerState.elapsedTime += dt;
            const activeV = this.getActiveVehicle();
            if (activeV) {
              const upgrades = this.progression.vehicleUpgrades[activeV.kind];
              const spec = getUpgradedVehicleSpec(activeV.kind, upgrades);
              const prevX = activeV.x;
              const prevZ = activeV.z;
              const col = stepPlayerVehiclePhysics(
                activeV,
                this.drivingInput,
                dt,
                CITY_LAYOUT,
                upgrades,
              );
              if (col.collided && col.impactSpeed > 5.5) {
                this.cameraTrauma = Math.min(1, this.cameraTrauma + Math.min(0.65, col.impactSpeed / 26));
                this.audio.playCollision(col.impactSpeed / 25);
                this.spawnImpactParticles(activeV.x, activeV.y + 0.3, activeV.z, 6);
                if (col.impactSpeed > 9.0) {
                  this.applyHealthDamage((col.impactSpeed - 8.5) * 2.1 * spec.damageScale);
                }
              }

              this.playerState.x = activeV.x;
              this.playerState.y = activeV.y;
              this.playerState.z = activeV.z;
              this.playerState.yaw = activeV.yaw;
              this.playerState.speed = Math.abs(activeV.speed);
              const stepDist = Math.hypot(activeV.x - prevX, activeV.z - prevZ);
              this.playerState.distanceWalked += stepDist;
              this.progression.totalDistance += stepDist;
              const kmh = Math.round(this.playerState.speed * 3.6);
              if (kmh > this.progression.topSpeedKmh) {
                this.progression.topSpeedKmh = kmh;
              }

              const openRider =
                spec.isMotorcycle || activeV.kind === 'jetski' || activeV.kind === 'speedboat';
              if (openRider) {
                const seat = computeVehicleSeatWorldPos(activeV);
                stepCharacterAnimRuntime(
                  this.playerAnimRuntime,
                  {
                    speed: Math.abs(activeV.speed),
                    vy: 0,
                    grounded: true,
                    isSprinting: false,
                    isMoving: Math.abs(activeV.speed) > 0.4,
                    isDriving: true,
                    isMotorcycle: activeV.kind === 'motor' || activeV.kind === 'jetski',
                    onStairs: false,
                    elapsedTime: this.playerState.elapsedTime,
                  },
                  dt,
                );
                applyArticulatedPoseToRig(
                  this.playerRig,
                  this.playerAnimRuntime.pose,
                  seat.x,
                  seat.y - 0.55,
                  seat.z,
                  activeV.yaw,
                  seat.y - 0.55,
                  1,
                );
                this.playerRig.root.visible = true;
                this.playerRig.root.rotation.z = activeV.leanAngle;
              } else {
                this.playerRig.root.visible = false;
              }

              this.audio.updateEngineSound(true, Math.abs(activeV.speed), spec.maxSpeed);
              this.updateDrivingCamera(activeV, dt);
            } else {
              this.playerMode = 'on_foot';
              this.playerRig.root.visible = true;
              document.body.dataset.mode = this.playerMode;
            }
          } else if (this.playerMode === 'exiting') {
            this.playerState.elapsedTime += dt;
            this.transitionTimer += dt;
            const t = Math.min(1, this.transitionTimer / this.transitionDuration);
            const ease = 1 - Math.pow(1 - t, 3);
            const hop = Math.sin(t * Math.PI) * 0.35;
            this.playerState.x =
              this.transitionStartPos.x + (this.transitionEndPos.x - this.transitionStartPos.x) * ease;
            this.playerState.z =
              this.transitionStartPos.z + (this.transitionEndPos.z - this.transitionStartPos.z) * ease;
            this.playerState.y =
              this.transitionStartPos.y +
              (this.transitionEndPos.y - this.transitionStartPos.y) * ease +
              hop;
            this.playerState.yaw = this.transitionEndPos.yaw;

            this.playerRig.root.visible = true;
            this.playerRig.root.position.set(this.playerState.x, this.playerState.y, this.playerState.z);
            this.playerRig.root.rotation.set(0, this.playerState.yaw, 0);
            this.updateFollowCamera(dt);

            if (t >= 1) {
              this.playerMode = 'on_foot';
              this.activeVehicleId = null;
              this.playerState.speed = 0;
              this.playerState.vx = 0;
              this.playerState.vz = 0;
              const exitWater = getWaterInfoAt(
                this.playerState.x,
                this.playerState.z,
                this.transitionEndPos.y,
                CITY_LAYOUT,
              );
              if (exitWater.inWater && exitWater.depth > 1.2) {
                this.playerState.y = Math.max(
                  exitWater.seabedY + 0.1,
                  Math.min(exitWater.waterSurfaceY - 0.85, this.transitionEndPos.y),
                );
                this.playerState.inWater = true;
                this.playerState.grounded = false;
                this.playerState.waterDepth = Math.max(0, exitWater.waterSurfaceY - this.playerState.y);
                this.playerState.isUnderwater = this.playerState.y < exitWater.waterSurfaceY - 1.48;
              } else {
                this.playerState.y = getGroundHeightAt(this.playerState.x, this.playerState.z, CITY_LAYOUT);
                this.playerState.inWater = false;
                this.playerState.isUnderwater = false;
                this.playerState.waterDepth = 0;
              }
              document.body.dataset.mode = this.playerMode;
              this.pushHudSnapshot(true);
            }
          } else if (this.playerMode === 'flying' && this.flightSequence) {
            const fl = this.flightSequence;
            fl.timer += dt;
            const rawT = Math.min(1, fl.timer / fl.duration);
            const easeT = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;

            // Smooth lateral cruise arc + realistic takeoff climb & landing flare
            const dx = fl.endX - fl.startX;
            const dz = fl.endZ - fl.startZ;
            const arcBump = Math.sin(rawT * Math.PI) * 28;
            const distLen = Math.max(1, Math.hypot(dx, dz));
            const perpX = -dz / distLen;
            const perpZ = dx / distLen;

            const px = fl.startX + dx * easeT + perpX * arcBump;
            const pz = fl.startZ + dz * easeT + perpZ * arcBump;

            let py = 1.9;
            let pitch = 0;
            if (rawT < 0.14) {
              py = 1.9;
              pitch = 0.04;
            } else {
              const airT = (rawT - 0.14) / 0.86;
              py = 1.9 + Math.pow(Math.sin(airT * Math.PI), 0.72) * 76;
              pitch = Math.cos(airT * Math.PI) * 0.24;
            }

            const moveDx = px - this.playerState.x;
            const moveDz = pz - this.playerState.z;
            const flyYaw =
              moveDx * moveDx + moveDz * moveDz > 0.01
                ? Math.atan2(-moveDx, -moveDz)
                : Math.atan2(-dx, -dz);
            const bank = Math.sin(rawT * Math.PI * 2) * 0.22;

            this.playerState.x = px;
            this.playerState.y = py;
            this.playerState.z = pz;
            this.playerState.yaw = flyYaw;
            this.playerState.speed = 65;

            this.flightJetGroup.visible = true;
            this.flightJetGroup.position.set(px, py, pz);
            this.flightJetGroup.rotation.set(pitch, flyYaw, bank, 'YXZ');

            const camDist = 24;
            const targetCamX = px + Math.sin(flyYaw) * camDist + perpX * 4;
            const targetCamY = py + 7.2;
            const targetCamZ = pz + Math.cos(flyYaw) * camDist + perpZ * 4;
            this.camPos.x = dampValue(this.camPos.x, targetCamX, 8, dt);
            this.camPos.y = dampValue(this.camPos.y, targetCamY, 8, dt);
            this.camPos.z = dampValue(this.camPos.z, targetCamZ, 8, dt);
            this.camTarget.x = dampValue(this.camTarget.x, px, 12, dt);
            this.camTarget.y = dampValue(this.camTarget.y, py + 1.2, 12, dt);
            this.camTarget.z = dampValue(this.camTarget.z, pz, 12, dt);
            this.camera.position.copy(this.camPos);
            this.camera.lookAt(this.camTarget);
            this.audio.updateEngineSound(true, 26 + Math.sin(rawT * Math.PI) * 8, 36);

            if (rawT >= 1) {
              this.flightJetGroup.visible = false;
              this.flightSequence = null;
              this.playerMode = 'on_foot';
              document.body.dataset.mode = this.playerMode;
              this.playerState.x = fl.arrivalSpawnX;
              this.playerState.z = fl.arrivalSpawnZ;
              this.playerState.y = getGroundHeightAt(fl.arrivalSpawnX, fl.arrivalSpawnZ, CITY_LAYOUT);
              this.playerState.yaw = fl.arrivalSpawnYaw;
              this.playerState.cameraYaw = fl.arrivalSpawnYaw;
              this.playerState.cameraPitch = 0.26;
              this.playerState.speed = 0;
              this.playerState.vx = 0;
              this.playerState.vz = 0;
              this.playerState.grounded = true;
              this.playerRig.root.visible = true;
              this.camInitialized = false;
              this.snapCameraBehindPlayer();
              this.audio.updateEngineSound(false, 0, 1);
              this.audio.playCheckpoint();
              this.showActivityToast(`Landed at ${fl.destAirportName} (${fl.destAirportCode})!`);
              this.pushHudSnapshot(true);
            }
          }

          // Step ambient NPCs when not on foot (already stepped above when on_foot)
          if (this.playerMode !== 'on_foot') {
            stepNpcs(this.npcs, dt, this.playerState.x, this.playerState.z, CITY_LAYOUT);
          }

          // Step NPC Traffic & Police Pursuit
          stepTrafficAndPolice(
            this.vehicles,
            dt,
            this.worldElapsed,
            this.missionRuntime.wantedLevel,
            this.playerState.x,
            this.playerState.z,
            this.playerMode === 'driving',
            CITY_LAYOUT,
          );

          const vehicleImpacts = resolveVehiclesPairwise(this.vehicles);
          for (let i = 0; i < vehicleImpacts.length; i++) {
            const imp = vehicleImpacts[i];
            const involvesPlayer = imp.a.occupant === 'player' || imp.b.occupant === 'player';
            if (involvesPlayer && imp.impactSpeed > 4.2) {
              const other = imp.a.occupant === 'player' ? imp.b : imp.a;
              const playerVeh = imp.a.occupant === 'player' ? imp.a : imp.b;
              const damageScale = getUpgradedVehicleSpec(
                playerVeh.kind,
                this.progression.vehicleUpgrades[playerVeh.kind],
              ).damageScale;
              this.cameraTrauma = Math.min(1, this.cameraTrauma + Math.min(0.6, imp.impactSpeed / 22));
              this.audio.playCollision(imp.impactSpeed / 20);
              this.spawnImpactParticles(
                (imp.a.x + imp.b.x) * 0.5,
                playerVeh.y + 0.4,
                (imp.a.z + imp.b.z) * 0.5,
                5,
              );
              if (imp.impactSpeed > 6.8) {
                this.applyHealthDamage((imp.impactSpeed - 6.2) * 2.4 * damageScale);
              }
              if (other.isPolice) {
                addWantedHeat(this.missionRuntime, 1.5);
              } else if (other.occupant === 'traffic') {
                addWantedHeat(this.missionRuntime, 1.0);
              }
            }
          }

          // Gradual health recovery when calm
          if (this.timeSinceDamage > 5 && this.playerState.health < this.playerState.maxHealth) {
            this.playerState.health = Math.min(
              this.playerState.maxHealth,
              this.playerState.health + 3.2 * dt,
            );
          }

          // Step Mission & Wanted Progression
          const missionEvents = stepMissionAndWanted(
            this.missionRuntime,
            this.playerState.x,
            this.playerState.z,
            this.vehicles,
            dt,
          );
          if (this.prevWantedLevel > 0 && this.missionRuntime.wantedLevel === 0) {
            this.progression.wantedEscapesCount++;
          }
          this.prevWantedLevel = this.missionRuntime.wantedLevel;

          if (missionEvents.checkpointReached) {
            this.audio.playCheckpoint();
            this.pushHudSnapshot(true);
          }
          if (missionEvents.missionCompleted) {
            this.progression.missionsCompletedCount++;
            this.audio.playMissionResult(true);
            this.saveGame(true);
            this.pushHudSnapshot(true);
          }
          if (missionEvents.missionFailed) {
            this.audio.playMissionResult(false);
            this.pushHudSnapshot(true);
          }

          // District discovery, street activity payday & automatic challenge rewards
          const curDistrict = getDistrictAt(this.playerState.x, this.playerState.z, CITY_LAYOUT);
          if (recordVisitedDistrict(this.progression, curDistrict.id)) {
            this.missionRuntime.money += 50;
            this.audio.playCash();
            this.showActivityToast(`Discovered ${curDistrict.name}! +$50`);
          }

          if (this.progression.totalDistance - this.lastMilestoneDistance >= 250) {
            this.lastMilestoneDistance += 250;
            this.missionRuntime.money += 40;
            this.audio.playCash();
            this.showActivityToast('City Cruiser Bonus: +$40');
          }

          const chEval = evaluateChallenges(this.progression);
          if (chEval.rewardEarned > 0) {
            this.missionRuntime.money += chEval.rewardEarned;
            this.audio.playCash();
            this.showActivityToast(
              `Challenge Complete: ${chEval.newlyCompleted[0].title} (+$${chEval.rewardEarned})`,
            );
            this.saveGame(true);
          }

          // Distance culling & LOD budget by GraphicsQuality
          const q = this.settings.graphicsQuality;
          const maxActiveNpcs = q === 'low' ? 8 : q === 'medium' ? 12 : this.npcs.length;
          const npcCullDistSq = q === 'low' ? 68 * 68 : q === 'medium' ? 95 * 95 : 135 * 135;
          const vehCullDistSq = q === 'low' ? 95 * 95 : q === 'medium' ? 135 * 135 : 185 * 185;

          for (let i = 0; i < this.npcs.length; i++) {
            const npc = this.npcs[i];
            const rig = this.npcRigs[i];
            const dx = npc.x - this.playerState.x;
            const dz = npc.z - this.playerState.z;
            const visible = i < maxActiveNpcs && dx * dx + dz * dz <= npcCullDistSq;
            rig.root.visible = visible;
            if (visible) {
              animateNpcRig(rig, npc, this.playerState.elapsedTime);
            }
          }

          for (let i = 0; i < this.vehicles.length; i++) {
            const v = this.vehicles[i];
            const rig = this.vehicleRigs[i];
            const dx = v.x - this.playerState.x;
            const dz = v.z - this.playerState.z;
            const isImportant =
              v.occupant === 'player' || v.id === 'veh_player_garage' || (v.isPolice && this.missionRuntime.wantedLevel > 0);
            const visible = isImportant || dx * dx + dz * dz <= vehCullDistSq;
            rig.root.visible = visible;
            if (visible) {
              animateVehicleRig(rig, v, this.missionRuntime.wantedLevel, isNightOrDusk);
            }
          }

          if (!this.isSoftwareGl && this.settings.graphicsQuality !== 'low') {
            this.sunLight.position.set(
              this.playerState.x + this.sunOffset.x,
              this.sunOffset.y,
              this.playerState.z + this.sunOffset.z,
            );
            this.sunLight.target.position.set(this.playerState.x, 0, this.playerState.z);
          }
          this.fillLight.position.set(
            this.playerState.x - this.sunOffset.x * 0.8,
            Math.max(24, this.sunOffset.y * 0.55),
            this.playerState.z - this.sunOffset.z * 0.8,
          );
          this.fillLight.target.position.set(this.playerState.x, 1.2, this.playerState.z);

          this.pushHudSnapshot(false);
        }
      }

      // Animate 3D Mission Start Beacons & Active Objective Beacon (only outdoors)
      const showOutdoorBeacons = !this.activeBlueprint;
      const showStarts = showOutdoorBeacons && !this.missionRuntime.activeMission;
      const pulseScale = 1 + Math.sin(now * 0.005) * 0.08;
      for (let i = 0; i < this.missionBeacons.length; i++) {
        const mb = this.missionBeacons[i];
        mb.group.visible = showStarts;
        if (showStarts) {
          mb.ring.scale.set(pulseScale, 1, pulseScale);
        }
      }

      if (showOutdoorBeacons && this.missionRuntime.activeMission) {
        const def = getMissionDefinition(this.missionRuntime.activeMission.missionId);
        const cp = def?.checkpoints[this.missionRuntime.activeMission.checkpointIndex];
        if (cp) {
          const gy = getGroundHeightAt(cp.x, cp.z, CITY_LAYOUT);
          this.activeObjectiveBeacon.group.visible = true;
          this.activeObjectiveBeacon.group.position.set(cp.x, gy + 0.06, cp.z);
          this.activeObjectiveBeacon.ring.scale.set(pulseScale, 1, pulseScale);
        } else {
          this.activeObjectiveBeacon.group.visible = false;
        }
      } else {
        this.activeObjectiveBeacon.group.visible = false;
      }

      if (showOutdoorBeacons) {
        const waterPulse = Math.sin(now * 0.0025) * 0.025;
        for (let i = 0; i < this.builtCity.animatedWaterMeshes.length; i++) {
          this.builtCity.animatedWaterMeshes[i].position.y = 0.75 + waterPulse;
        }
        this.builtCity.bayWater.position.y = -0.38 + waterPulse * 1.4;
      }

      // Animate 3D Educational Quiz Kiosks & Hidden Collectibles (respecting floor visibility culling)
      const activeKiosks = this.activeBlueprint ? this.interiorKioskRigs : this.outdoorKioskRigs;
      const cullByFloor = Boolean(this.activeBlueprint && this.activeBlueprint.floorsCount > 3);
      for (let i = 0; i < activeKiosks.length; i++) {
        const kr = activeKiosks[i];
        const floorNum = kr.placement.floorNumber ?? 1;
        const visible = !cullByFloor || Math.abs(floorNum - this.currentInteriorFloor) <= 1;
        kr.group.visible = visible;
        if (!visible) continue;
        if (kr.crystal.userData.baseY === undefined) {
          kr.crystal.userData.baseY = kr.crystal.position.y;
        }
        const baseY = Number(kr.crystal.userData.baseY);
        kr.crystal.rotation.y = now * 0.0018 + i * 0.9;
        kr.crystal.position.y = baseY + Math.sin(now * 0.003 + i) * 0.055;
        kr.ring.scale.set(pulseScale, 1, pulseScale);
      }

      // Keep sky dome centered around the active player anywhere across all 3 cities
      this.builtCity.skyDome.position.set(this.playerState.x, 0, this.playerState.z);

      // Step & render real-time multiplayer remote classmates
      if (this.phase === 'playing') {
        this.stepRemoteAvatars(dt, this.worldElapsed);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.audio.dispose();
    this.disposeCallbacks.forEach((fn) => fn());
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
