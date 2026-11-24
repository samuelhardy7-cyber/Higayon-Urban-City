import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { CustomizeModal } from './components/CustomizeModal';
import { ElevatorModal } from './components/ElevatorModal';
import { EmoteWheelModal } from './components/EmoteWheelModal';
import { GameHud } from './components/GameHud';
import { GarageModal } from './components/GarageModal';
import { PauseModal } from './components/PauseModal';
import { PlayerQuizModal } from './components/PlayerQuizModal';
import { RewardShop3DModal } from './components/RewardShop3DModal';
import { SocialChallengeDrawer } from './components/SocialChallengeDrawer';
import { StudentSessionModal } from './components/StudentSessionModal';
import { TeacherDashboardModal } from './components/TeacherDashboardModal';
import { TeacherPinGateModal } from './components/TeacherPinGateModal';
import { TitleOverlay } from './components/TitleOverlay';
import {
  signInWithGooglePopup,
  signOutFirebase,
  subscribeToAuth,
  syncTeacherDatabaseToFirestore,
  syncUserProfileToFirestore,
} from './firebase';
import { UrbanWorldEngine } from './game/UrbanWorldEngine';
import { MISSION_DEFINITIONS } from './game/missionSystem';
import type {
  AuthUserProfile,
  ChallengeSessionState,
  ChatMessageRecord,
  MultiplayerSessionSnapshot,
  PlayerAccountProfile,
  SocialGroupSnapshot,
} from './game/multiplayerTypes';
import {
  STARTING_CASH,
  createInitialProgressionState,
  getChallengeStatuses,
} from './game/progressionSystem';
import { createDefaultTeacherConfig, createSeedQuestionDatabase } from './game/questionBank';
import type {
  AnswerKey,
  PlayerQuestionChallenge,
  PlayerSubmissionOutcome,
  QuestionDatabase,
  TeacherConfig,
} from './game/questionTypes';
import {
  REWARD_SHOP_CATALOG,
  STARTER_OWNED_ITEM_IDS,
  applyShopItemToCustomization,
  getEffectiveShopCatalog,
  type RewardShopItem,
} from './game/rewardShopCatalog';
import { DEFAULT_SOCIAL_CONFIG } from './game/socialSystem';
import { hasSavedGame } from './game/saveSystem';
import type { EmoteKind } from './game/characterAnimator';
import type {
  AccessoryId,
  CharacterCustomization,
  DrivingInputState,
  GamePhase,
  GraphicsQuality,
  HudSnapshot,
  InteriorElevatorFloor,
  OutfitId,
  VehicleKind,
  VehicleUpgradeLevels,
} from './game/types';
import { DISTRICT_LABELS } from './game/worldData';
import {
  MultiplayerWsClient,
  checkJoinSession,
  fetchAuthProfile,
  fetchPlayerProfile,
  fetchPublicQuizState,
  fetchShopCatalog,
  fetchTeacherDatabase,
  purchaseShopItemOnServer,
  resetTeacherDatabase,
  saveTeacherDatabase,
  submitQuizAnswerToServer,
  syncPlayerProgressOnServer,
  updatePlayerCustomizationOnServer,
} from './services/multiplayerClient';

const INITIAL_PROGRESSION = createInitialProgressionState();

const INITIAL_SNAPSHOT: HudSnapshot = {
  phase: 'title',
  timeOfDay: 'siang',
  timeLabel: 'Siang',
  district: 'avenue',
  districtName: DISTRICT_LABELS.avenue,
  speed: 0,
  stamina: 100,
  health: 100,
  maxHealth: 100,
  isSprinting: false,
  grounded: true,
  distanceWalked: 0,
  elapsedTime: 0,
  playerX: 0,
  playerZ: 16,
  playerYaw: 0,
  cameraYaw: 0,
  pointerLocked: false,
  money: STARTING_CASH,
  wantedLevel: 0,
  playerMode: 'on_foot',
  currentVehicleKind: null,
  currentVehicleLabel: null,
  interactPrompt: null,
  activeMission: null,
  missionBanner: null,
  availableMissions: MISSION_DEFINITIONS.map((m) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    x: m.startX,
    z: m.startZ,
    color: m.badgeColor,
  })),
  trafficMarkers: [],
  remotePlayerMarkers: [],
  progression: INITIAL_PROGRESSION,
  challenges: getChallengeStatuses(INITIAL_PROGRESSION),
  completedMissionIds: [],
  settings: {
    muted: false,
    musicEnabled: true,
    timeOfDay: 'siang',
    graphicsQuality: 'medium',
  },
  activityToast: null,
  lastSavedAt: null,
  interior: null,
  transitionFade: 0,
  quizPoints: 0,
  completedQuestionsCount: 0,
  activeQuestionsCount: 10,
};

type ActiveModalKind =
  | 'none'
  | 'garage'
  | 'customize'
  | 'quiz'
  | 'elevator'
  | 'session'
  | 'pin'
  | 'teacher'
  | 'shop'
  | 'emotes'
  | 'social';

interface ElevatorPanelState {
  buildingName: string;
  elevatorId: string;
  currentFloor: number;
  targetFloor: number | null;
  moving: boolean;
  floors: InteriorElevatorFloor[];
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<UrbanWorldEngine | null>(null);
  const wsClientRef = useRef<MultiplayerWsClient | null>(null);
  const selfPlayerIdRef = useRef<string | null>(null);

  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [phase, setPhase] = useState<GamePhase>(autostart ? 'playing' : 'title');
  const [muted, setMuted] = useState(false);
  const [snapshot, setSnapshot] = useState<HudSnapshot>(INITIAL_SNAPSHOT);
  const [contextError, setContextError] = useState('');
  const [activeModal, setActiveModal] = useState<ActiveModalKind>('none');
  const [activeQuizChallenge, setActiveQuizChallenge] = useState<PlayerQuestionChallenge | null>(
    null,
  );
  const [elevatorPanelState, setElevatorPanelState] = useState<ElevatorPanelState | null>(null);
  const [savedExists, setSavedExists] = useState<boolean>(() => hasSavedGame());

  // Firebase Auth & Role state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authIdToken, setAuthIdToken] = useState<string | null>(null);
  const [authProfile, setAuthProfile] = useState<AuthUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Memory-only Teacher Mode elevation token & Teacher full question bank
  const [teacherToken, setTeacherToken] = useState<string | null>(null);
  const [teacherTokenExpiresAt, setTeacherTokenExpiresAt] = useState<number>(0);
  const [teacherDatabase, setTeacherDatabase] = useState<QuestionDatabase | null>(null);

  // Live Multiplayer Classroom Session state
  const [selfPlayerId, setSelfPlayerId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<MultiplayerSessionSnapshot | null>(null);
  const [connectionState, setConnectionState] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('disconnected');
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Stage 10: Authoritative KP Account Profile, Reward Shop Catalog & Social/Challenge state
  const [playerProfile, setPlayerProfile] = useState<PlayerAccountProfile | null>(null);
  const [shopCatalog, setShopCatalog] = useState<RewardShopItem[]>(REWARD_SHOP_CATALOG);
  const [publicTeacherConfig, setPublicTeacherConfig] = useState<TeacherConfig>(() =>
    createDefaultTeacherConfig(),
  );
  const [chatMessages, setChatMessages] = useState<ChatMessageRecord[]>([]);
  const [groups, setGroups] = useState<SocialGroupSnapshot[]>([]);
  const [challengeState, setChallengeState] = useState<ChallengeSessionState | null>(null);
  const [mutedPlayerIds, setMutedPlayerIds] = useState<string[]>([]);
  const mutedPlayerIdSet = useMemo(() => new Set(mutedPlayerIds), [mutedPlayerIds]);
  const lastSyncedBuildingRef = useRef<string | null>(null);
  const lastSyncedFloorRef = useRef<number>(1);

  const setModal = useCallback((next: ActiveModalKind) => {
    if (next !== 'quiz') {
      setActiveQuizChallenge(null);
    }
    if (next !== 'elevator') {
      setElevatorPanelState(null);
    }
    setActiveModal(next);
    engineRef.current?.setPreviewMode(next);
  }, []);

  // Initialize 3D Engine
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new UrbanWorldEngine(
      mount,
      {
        onSnapshot: (snap) => setSnapshot(snap),
        onPhaseChange: (nextPhase) => {
          setPhase(nextPhase);
          if (nextPhase !== 'playing') {
            setActiveModal((prev) =>
              prev === 'teacher' || prev === 'pin' || prev === 'session' ? prev : 'none',
            );
            setActiveQuizChallenge(null);
            setElevatorPanelState(null);
          }
          setSavedExists(hasSavedGame());
        },
        onMuteChange: (nextMuted) => setMuted(nextMuted),
        onContextError: (msg) => setContextError(msg),
        onOpenQuiz: (challenge) => {
          setActiveQuizChallenge(challenge);
          setActiveModal('quiz');
        },
        onOpenElevator: (params) => {
          setElevatorPanelState(params);
          setActiveModal('elevator');
        },
        onOpenRewardShop: () => {
          setActiveModal('shop');
        },
        onElevatorAction: (action) => {
          wsClientRef.current?.sendElevatorAction(action);
        },
        onTriggerSocialEmote: (targetPlayerId, emote) => {
          wsClientRef.current?.sendSocialEmote(targetPlayerId, emote);
        },
      },
      autostart,
    );
    engineRef.current = engine;

    // Fetch authoritative public quiz database (answer keys stripped on server)
    void fetchPublicQuizState(null)
      .then(({ database, progress }) => {
        engine.applyPublicQuestionDatabase(database, progress);
        setPublicTeacherConfig(database.teacherConfig);
        setShopCatalog(getEffectiveShopCatalog(database.teacherConfig.shopItemOverrides));
      })
      .catch(() => {
        // Fallback already initialized from public seed inside engine
      });

    void fetchShopCatalog()
      .then(({ items, teacherConfig }) => {
        setShopCatalog(items);
        setPublicTeacherConfig(teacherConfig);
      })
      .catch(() => {
        // Keep local default catalog fallback
      });

    return () => {
      wsClientRef.current?.disconnect();
      wsClientRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
  }, [autostart]);

  // Subscribe to Firebase Authentication state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setAuthUser(user);
      if (!user) {
        setAuthIdToken(null);
        setAuthProfile(null);
        setPlayerProfile(null);
        setTeacherToken(null);
        setTeacherTokenExpiresAt(0);
        setTeacherDatabase(null);
        wsClientRef.current?.disconnect();
        wsClientRef.current = null;
        selfPlayerIdRef.current = null;
        setSelfPlayerId(null);
        setActiveSession(null);
        setGroups([]);
        setChatMessages([]);
        setChallengeState(null);
        setConnectionState('disconnected');
        engineRef.current?.clearRemotePlayers();
        engineRef.current?.setKnowledgePoints(0);
        void fetchPublicQuizState(null)
          .then(({ database, progress }) => {
            engineRef.current?.applyPublicQuestionDatabase(database, progress);
            setPublicTeacherConfig(database.teacherConfig);
            setShopCatalog(getEffectiveShopCatalog(database.teacherConfig.shopItemOverrides));
          })
          .catch(() => {});
        return;
      }

      void user
        .getIdToken()
        .then(async (token) => {
          setAuthIdToken(token);
          const profile = await fetchAuthProfile(token);
          setAuthProfile(profile);
          void syncUserProfileToFirestore(user, profile.role).catch(() => {});
          const [publicState, accountRes] = await Promise.all([
            fetchPublicQuizState(token),
            fetchPlayerProfile(token).catch(() => null),
          ]);
          engineRef.current?.applyPublicQuestionDatabase(
            publicState.database,
            publicState.progress,
          );
          setPublicTeacherConfig(publicState.database.teacherConfig);
          setShopCatalog(
            getEffectiveShopCatalog(publicState.database.teacherConfig.shopItemOverrides),
          );
          if (accountRes?.profile) {
            setPlayerProfile(accountRes.profile);
            engineRef.current?.setKnowledgePoints(accountRes.profile.knowledgePoints);
            engineRef.current?.applySyncedCustomization(accountRes.profile.customization);
          }
        })
        .catch(() => {
          // Ignore transient token fetch error
        });
    });
    return () => unsubscribe();
  }, []);

  // Discreet Teacher Mode Entry Handler (Ctrl+Shift+T or 3s Logo Long-Press)
  const openSecretTeacherAccess = useCallback(async () => {
    const hasMemoryElevation =
      Boolean(teacherToken) &&
      teacherTokenExpiresAt > Date.now() &&
      Boolean(authUser) &&
      authProfile?.role === 'teacher';

    if (hasMemoryElevation && authUser && teacherToken) {
      try {
        const freshToken = await authUser.getIdToken();
        setAuthIdToken(freshToken);
        const res = await fetchTeacherDatabase(freshToken, teacherToken);
        setTeacherDatabase(res.database);
        setModal('teacher');
        return;
      } catch {
        setTeacherToken(null);
        setTeacherTokenExpiresAt(0);
        setTeacherDatabase(null);
      }
    }

    setModal('pin');
  }, [teacherToken, teacherTokenExpiresAt, authUser, authProfile, setModal]);

  const handlePinVerified = useCallback(
    async (newTeacherToken: string, expiresAt: number) => {
      if (!authUser) return;
      try {
        const freshToken = await authUser.getIdToken();
        setAuthIdToken(freshToken);
        setTeacherToken(newTeacherToken);
        setTeacherTokenExpiresAt(expiresAt);
        const res = await fetchTeacherDatabase(freshToken, newTeacherToken);
        setTeacherDatabase(res.database);
        setModal('teacher');
      } catch {
        setTeacherToken(null);
        setTeacherTokenExpiresAt(0);
        setModal('pin');
      }
    },
    [authUser, setModal],
  );

  const handleLockTeacherMode = useCallback(() => {
    setTeacherToken(null);
    setTeacherTokenExpiresAt(0);
    setTeacherDatabase(null);
    setModal('none');
  }, [setModal]);

  // Global Keyboard Shortcuts (Ctrl+Shift+T secret teacher gate + Escape + G/C)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.ctrlKey && e.shiftKey && e.code === 'KeyT' && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        if (activeModal === 'teacher' || activeModal === 'pin') {
          setModal('none');
        } else {
          void openSecretTeacherAccess();
        }
        return;
      }

      if (e.code === 'Escape' && activeModal !== 'none') {
        e.preventDefault();
        e.stopPropagation();
        setModal('none');
        return;
      }

      if (phase !== 'playing' || isEditingText) return;

      if (e.code === 'KeyG' && !e.repeat && (activeModal === 'none' || activeModal === 'garage')) {
        e.preventDefault();
        setModal(activeModal === 'garage' ? 'none' : 'garage');
      } else if (
        e.code === 'KeyC' &&
        !e.repeat &&
        (activeModal === 'none' || activeModal === 'customize')
      ) {
        e.preventDefault();
        setModal(activeModal === 'customize' ? 'none' : 'customize');
      } else if (
        e.code === 'KeyK' &&
        !e.repeat &&
        (activeModal === 'none' || activeModal === 'shop')
      ) {
        e.preventDefault();
        setModal(activeModal === 'shop' ? 'none' : 'shop');
      } else if (
        e.code === 'KeyB' &&
        !e.repeat &&
        (activeModal === 'none' || activeModal === 'emotes')
      ) {
        e.preventDefault();
        setModal(activeModal === 'emotes' ? 'none' : 'emotes');
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [phase, activeModal, setModal, openSecretTeacherAccess]);

  // Sync interior visits & CITY TOWER climb progress to authoritative player profile for badges/leaderboard
  useEffect(() => {
    if (!authUser || !snapshot.interior) return;
    const buildingId = snapshot.interior.buildingId;
    const floor = snapshot.interior.currentFloor || 1;
    const isNewBuilding = buildingId !== lastSyncedBuildingRef.current;
    const isHigherTowerFloor = buildingId === 'freedom_tower' && floor > lastSyncedFloorRef.current;
    if (!isNewBuilding && !isHigherTowerFloor) return;

    lastSyncedBuildingRef.current = buildingId;
    if (buildingId === 'freedom_tower') {
      lastSyncedFloorRef.current = Math.max(lastSyncedFloorRef.current, floor);
    }

    void authUser
      .getIdToken()
      .then((token) =>
        syncPlayerProgressOnServer(token, {
          visitedBuildingId: buildingId,
          towerFloor: buildingId === 'freedom_tower' ? floor : undefined,
        }),
      )
      .then(({ profile }) => {
        setPlayerProfile(profile);
        engineRef.current?.setKnowledgePoints(profile.knowledgePoints);
      })
      .catch(() => {});
  }, [authUser, snapshot.interior]);

  // Real-time player transform/activity sync loop (~14 Hz) while joined in a session
  useEffect(() => {
    if (!activeSession || connectionState !== 'connected' || phase !== 'playing') {
      return;
    }
    const timer = window.setInterval(() => {
      const engine = engineRef.current;
      const ws = wsClientRef.current;
      if (!engine || !ws) return;
      ws.sendPlayerUpdate(engine.getLocalMultiplayerState());
    }, 70);
    return () => window.clearInterval(timer);
  }, [activeSession, connectionState, phase]);

  // Google Sign-In / Sign-Out Handlers
  const handleSignInGoogle = useCallback(async () => {
    setAuthLoading(true);
    try {
      const user = await signInWithGooglePopup();
      const token = await user.getIdToken();
      setAuthUser(user);
      setAuthIdToken(token);
      const profile = await fetchAuthProfile(token);
      setAuthProfile(profile);
      void syncUserProfileToFirestore(user, profile.role).catch(() => {});
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleSignOutGoogle = useCallback(async () => {
    wsClientRef.current?.disconnect();
    wsClientRef.current = null;
    selfPlayerIdRef.current = null;
    setSelfPlayerId(null);
    setPlayerProfile(null);
    setActiveSession(null);
    setGroups([]);
    setChatMessages([]);
    setChallengeState(null);
    setConnectionState('disconnected');
    setTeacherToken(null);
    setTeacherTokenExpiresAt(0);
    setTeacherDatabase(null);
    engineRef.current?.clearRemotePlayers();
    engineRef.current?.setKnowledgePoints(0);
    await signOutFirebase();
  }, []);

  // Join / Leave Multiplayer Session
  const handleJoinSession = useCallback(
    async (joinCode: string) => {
      if (!authUser) {
        throw new Error('Sign in with Google before joining a classroom session.');
      }
      setSessionError(null);
      const token = await authUser.getIdToken();
      setAuthIdToken(token);
      await checkJoinSession(token, joinCode);

      wsClientRef.current?.disconnect();
      const client = new MultiplayerWsClient(
        async () => (authUser ? authUser.getIdToken() : null),
        snapshot.progression.customization,
        {
          onJoined: (joinedPlayerId, snap) => {
            selfPlayerIdRef.current = joinedPlayerId;
            setSelfPlayerId(joinedPlayerId);
            setActiveSession(snap);
            setGroups(snap.groups || []);
            setChatMessages(snap.recentChat || []);
            setChallengeState(snap.challengeState || null);
            setSessionError(null);
            engineRef.current?.setMultiplayerPlayers(joinedPlayerId, snap.players);
            snap.elevators?.forEach((el) => engineRef.current?.applyRemoteElevatorState(el));
          },
          onSessionState: (snap) => {
            setActiveSession(snap);
            if (snap.groups) setGroups(snap.groups);
            if (snap.challengeState) setChallengeState(snap.challengeState);
            engineRef.current?.setMultiplayerPlayers(selfPlayerIdRef.current, snap.players);
            snap.elevators?.forEach((el) => engineRef.current?.applyRemoteElevatorState(el));
          },
          onPlayerDelta: (msg) => {
            if (msg.player.playerId !== selfPlayerIdRef.current) {
              engineRef.current?.upsertRemotePlayer(msg.player);
            }
          },
          onPlayerLeft: (msg) => {
            engineRef.current?.removeRemotePlayer(msg.playerId);
          },
          onElevatorState: (msg) => {
            engineRef.current?.applyRemoteElevatorState(msg.elevator);
          },
          onChatMessage: (message) => {
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === message.id)) return prev;
              return [...prev, message].slice(-80);
            });
          },
          onEmoteEvent: (evt) => {
            if (
              evt.targetPlayerId === selfPlayerIdRef.current &&
              evt.fromPlayerId !== selfPlayerIdRef.current
            ) {
              engineRef.current?.triggerEmote(evt.emote);
            }
          },
          onGroupsState: (nextGroups) => {
            setGroups(nextGroups);
          },
          onChallengeState: (nextState) => {
            setChallengeState(nextState);
          },
          onConnectionChange: (state) => {
            setConnectionState(state);
          },
          onError: (code, message) => {
            setSessionError(message);
            if (code === 'SESSION_ENDED' || code === 'DUPLICATE_LOGIN' || code === 'SESSION_FULL') {
              setActiveSession(null);
              setGroups([]);
              setChallengeState(null);
              engineRef.current?.clearRemotePlayers();
            }
          },
        },
      );
      wsClientRef.current = client;
      await client.connect(joinCode, snapshot.progression.customization);
    },
    [authUser, snapshot.progression.customization],
  );

  const handleLeaveSession = useCallback(() => {
    wsClientRef.current?.disconnect();
    wsClientRef.current = null;
    selfPlayerIdRef.current = null;
    setSelfPlayerId(null);
    setActiveSession(null);
    setGroups([]);
    setChatMessages([]);
    setChallengeState(null);
    setSessionError(null);
    setConnectionState('disconnected');
    engineRef.current?.clearRemotePlayers();
  }, []);

  // Gameplay & Modal Callbacks
  const handleStart = useCallback(() => {
    engineRef.current?.startGame();
  }, []);

  const handleNewGame = useCallback(() => {
    engineRef.current?.newGame();
    setSavedExists(hasSavedGame());
  }, []);

  const handleContinueSaved = useCallback(() => {
    engineRef.current?.loadGame();
    setSavedExists(hasSavedGame());
  }, []);

  const handleSaveGame = useCallback(() => {
    const ok = engineRef.current?.saveGame(false);
    if (ok) {
      setSavedExists(true);
    }
  }, []);

  const handlePause = useCallback(() => {
    setModal('none');
    engineRef.current?.pauseGame();
  }, [setModal]);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleMainMenu = useCallback(() => {
    setModal('none');
    engineRef.current?.returnToMenu();
    setSavedExists(hasSavedGame());
  }, [setModal]);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleToggleMusic = useCallback(() => {
    engineRef.current?.setMusicEnabled(!snapshot.settings.musicEnabled);
  }, [snapshot.settings.musicEnabled]);

  const handleSetGraphicsQuality = useCallback((quality: GraphicsQuality) => {
    engineRef.current?.setGraphicsQuality(quality);
  }, []);

  const handleCycleTimeOfDay = useCallback(() => {
    engineRef.current?.cycleTimeOfDay();
  }, []);

  const handleInteract = useCallback(() => {
    engineRef.current?.triggerInteract();
  }, []);

  const handleMissionAction = useCallback(() => {
    engineRef.current?.triggerMissionAction();
  }, []);

  const handleTriggerEmote = useCallback((emote: EmoteKind) => {
    engineRef.current?.triggerEmote(emote);
  }, []);

  const handleToggleSit = useCallback(() => {
    engineRef.current?.toggleSit();
  }, []);

  const handleOpenElevatorPanel = useCallback(() => {
    engineRef.current?.openElevatorPanel();
  }, []);

  const handleSelectElevatorFloor = useCallback(
    (floorNumber: number) => {
      engineRef.current?.selectElevatorFloorFromUi(floorNumber);
      setModal('none');
    },
    [setModal],
  );

  const handleMobileMove = useCallback((x: number, y: number) => {
    engineRef.current?.setMobileMove(x, y);
  }, []);

  const handleMobileSprint = useCallback((active: boolean) => {
    engineRef.current?.setMobileSprint(active);
  }, []);

  const handleMobileJump = useCallback((held: boolean) => {
    engineRef.current?.triggerMobileJump(held);
  }, []);

  const handleMobileDrivingInput = useCallback(
    (field: keyof DrivingInputState, held: boolean) => {
      engineRef.current?.setMobileDrivingInput(field, held);
    },
    [],
  );

  const handleBuyOrSelectVehicle = useCallback(
    (kind: VehicleKind) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (snapshot.progression.ownedVehicles.includes(kind)) {
        engine.selectOwnedVehicle(kind);
      } else {
        engine.buyOrSelectVehicle(kind);
      }
      setSavedExists(hasSavedGame());
    },
    [snapshot.progression.ownedVehicles],
  );

  const handleSelectPaint = useCallback((kind: VehicleKind, color: number) => {
    engineRef.current?.setVehiclePaint(kind, color);
    setSavedExists(hasSavedGame());
  }, []);

  const handleBuyUpgrade = useCallback(
    (kind: VehicleKind, slot: keyof VehicleUpgradeLevels) => {
      engineRef.current?.buyVehicleUpgrade(kind, slot);
      setSavedExists(hasSavedGame());
    },
    [],
  );

  const handleDeliverVehicle = useCallback(() => {
    engineRef.current?.deliverGarageVehicle();
    setModal('none');
  }, [setModal]);

  const handleSelectOutfit = useCallback((id: OutfitId) => {
    engineRef.current?.buyOrEquipOutfit(id);
    setSavedExists(hasSavedGame());
  }, []);

  const handleSelectAccessory = useCallback((id: AccessoryId) => {
    engineRef.current?.buyOrEquipAccessory(id);
    setSavedExists(hasSavedGame());
  }, []);

  const handleChangeColors = useCallback(
    async (
      colors: Partial<
        Pick<
          CharacterCustomization,
          'skinTone' | 'hairColor' | 'jacketColor' | 'pantsColor' | 'shoeColor'
        >
      >,
    ) => {
      engineRef.current?.setCustomizationColors(colors);
      setSavedExists(hasSavedGame());
      if (authUser) {
        try {
          const token = await authUser.getIdToken();
          const { profile } = await updatePlayerCustomizationOnServer(token, { patch: colors });
          setPlayerProfile(profile);
          engineRef.current?.applySyncedCustomization(profile.customization);
        } catch {
          // Local preview remains active even if offline
        }
      }
    },
    [authUser],
  );

  const handlePurchaseShopItem = useCallback(
    async (itemId: string) => {
      if (!authUser) {
        throw new Error('Sign in with Google to purchase rewards using Knowledge Points.');
      }
      const token = await authUser.getIdToken();
      const txId = `tx_shop_${itemId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const res = await purchaseShopItemOnServer(token, {
        itemId,
        txId,
        equipImmediately: true,
      });
      setPlayerProfile(res.profile);
      engineRef.current?.setKnowledgePoints(res.profile.knowledgePoints);
      engineRef.current?.applySyncedCustomization(res.profile.customization);
      engineRef.current?.playRewardAnimation(
        res.item.rarity === 'special' || res.item.rarity === 'rare'
          ? 'rare_outfit'
          : res.item.category === 'accessories'
            ? 'accessory'
            : 'kp',
      );
      setSavedExists(hasSavedGame());
    },
    [authUser],
  );

  const handleEquipShopItem = useCallback(
    async (itemId: string) => {
      const item = shopCatalog.find((entry) => entry.id === itemId);
      if (!item) return;

      if (authUser) {
        const token = await authUser.getIdToken();
        const { profile } = await updatePlayerCustomizationOnServer(token, { itemId });
        setPlayerProfile(profile);
        engineRef.current?.applySyncedCustomization(profile.customization);
      } else {
        const next = applyShopItemToCustomization(snapshot.progression.customization, item);
        engineRef.current?.applySyncedCustomization(next);
      }
      engineRef.current?.playRewardAnimation(
        item.category === 'accessories' ? 'accessory' : 'kp',
      );
      setSavedExists(hasSavedGame());
    },
    [authUser, shopCatalog, snapshot.progression.customization],
  );

  const handleSendChat = useCallback((text: string) => {
    wsClientRef.current?.sendChatMessage(text);
  }, []);

  const handleGroupAction = useCallback(
    (action: 'create' | 'join' | 'leave', groupId?: string, name?: string) => {
      wsClientRef.current?.sendGroupAction(action, groupId, name);
    },
    [],
  );

  const handleToggleMutePlayer = useCallback((targetPlayerId: string) => {
    setMutedPlayerIds((prev) =>
      prev.includes(targetPlayerId)
        ? prev.filter((id) => id !== targetPlayerId)
        : [...prev, targetPlayerId],
    );
  }, []);

  const handleReportPlayer = useCallback(
    (targetPlayerId: string, reason: string, excerpt?: string) => {
      wsClientRef.current?.sendSocialReport(targetPlayerId, reason, excerpt);
    },
    [],
  );

  const handleGreetPlayer = useCallback((targetPlayerId: string, emote: EmoteKind) => {
    engineRef.current?.triggerEmote(emote);
    wsClientRef.current?.sendSocialEmote(targetPlayerId, emote);
  }, []);

  const handleUpdateQuestionDatabase = useCallback(
    async (nextDb: QuestionDatabase) => {
      setTeacherDatabase(nextDb);
      setPublicTeacherConfig(nextDb.teacherConfig);
      setShopCatalog(getEffectiveShopCatalog(nextDb.teacherConfig.shopItemOverrides));
      engineRef.current?.updateQuestionDatabase(nextDb);
      if (!authUser || !teacherToken) return;
      const freshToken = await authUser.getIdToken();
      setAuthIdToken(freshToken);
      const res = await saveTeacherDatabase(freshToken, teacherToken, nextDb);
      setTeacherDatabase(res.database);
      setPublicTeacherConfig(res.database.teacherConfig);
      setShopCatalog(getEffectiveShopCatalog(res.database.teacherConfig.shopItemOverrides));
      engineRef.current?.updateQuestionDatabase(res.database);
      void syncTeacherDatabaseToFirestore(res.database).catch(() => {});
    },
    [authUser, teacherToken],
  );

  const handleResetQuestionBank = useCallback(async (): Promise<QuestionDatabase> => {
    if (!authUser || !teacherToken) {
      const seed = createSeedQuestionDatabase();
      setTeacherDatabase(seed);
      setPublicTeacherConfig(seed.teacherConfig);
      setShopCatalog(getEffectiveShopCatalog(seed.teacherConfig.shopItemOverrides));
      engineRef.current?.updateQuestionDatabase(seed);
      return seed;
    }
    const freshToken = await authUser.getIdToken();
    setAuthIdToken(freshToken);
    const res = await resetTeacherDatabase(freshToken, teacherToken);
    setTeacherDatabase(res.database);
    setPublicTeacherConfig(res.database.teacherConfig);
    setShopCatalog(getEffectiveShopCatalog(res.database.teacherConfig.shopItemOverrides));
    engineRef.current?.updateQuestionDatabase(res.database);
    void syncTeacherDatabaseToFirestore(res.database).catch(() => {});
    return res.database;
  }, [authUser, teacherToken]);

  const handleSubmitQuizAnswer = useCallback(
    async (questionId: string, selectedAnswer: AnswerKey): Promise<PlayerSubmissionOutcome> => {
      const freshIdToken = authUser ? await authUser.getIdToken() : null;
      const txId = `tx_quiz_${questionId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { outcome, progress, profile } = await submitQuizAnswerToServer({
        idToken: freshIdToken,
        questionId,
        selectedAnswer,
        sessionId: activeSession?.session.id || null,
        txId,
      });
      if (profile) {
        setPlayerProfile(profile);
        engineRef.current?.setKnowledgePoints(profile.knowledgePoints);
      } else if (outcome.isCorrect) {
        engineRef.current?.setKnowledgePoints(progress.earnedPoints);
      }
      engineRef.current?.applyServerQuizOutcome(progress, outcome);
      setSavedExists(hasSavedGame());
      return outcome;
    },
    [authUser, activeSession],
  );

  const isOverlayOpen =
    activeModal === 'teacher' || activeModal === 'pin' || activeModal === 'session';

  const selfGroupId = useMemo(
    () =>
      selfPlayerId
        ? groups.find((g) => g.memberPlayerIds.includes(selfPlayerId))?.id || null
        : null,
    [groups, selfPlayerId],
  );

  return (
    <main className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Isolated WebGL mount container */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-container"
        className="w-full h-full"
      />

      {contextError && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-900/95 border border-red-400/40 text-xs text-white"
        >
          {contextError}
        </div>
      )}

      {phase === 'title' && !isOverlayOpen && (
        <TitleOverlay
          muted={muted}
          musicEnabled={snapshot.settings.musicEnabled}
          hasSavedGame={savedExists}
          authUser={authUser}
          activeSession={activeSession}
          onStart={savedExists ? handleNewGame : handleStart}
          onContinueSaved={handleContinueSaved}
          onOpenSessionModal={() => setModal('session')}
          onSecretTeacherTrigger={() => void openSecretTeacherAccess()}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
        />
      )}

      {phase === 'playing' && activeModal === 'none' && (
        <GameHud
          snapshot={snapshot}
          muted={muted}
          activeSession={activeSession}
          connectionState={connectionState}
          selfGroupId={selfGroupId}
          showGroupMarkers={publicTeacherConfig.socialConfig?.groupMinimapMarkers ?? true}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          onCycleTimeOfDay={handleCycleTimeOfDay}
          onOpenGarage={() => setModal('garage')}
          onOpenCustomize={() => setModal('customize')}
          onOpenShop={() => setModal('shop')}
          onOpenEmotes={() => setModal('emotes')}
          onOpenSocial={() => setModal('social')}
          onOpenSessionModal={() => setModal('session')}
          onInteract={handleInteract}
          onMissionAction={handleMissionAction}
          onTriggerEmote={handleTriggerEmote}
          onToggleSit={handleToggleSit}
          onOpenElevatorPanel={handleOpenElevatorPanel}
          onMobileMove={handleMobileMove}
          onMobileSprint={handleMobileSprint}
          onMobileJump={handleMobileJump}
          onMobileDrivingInput={handleMobileDrivingInput}
        />
      )}

      {phase === 'playing' && activeModal === 'garage' && (
        <GarageModal
          money={snapshot.money}
          progression={snapshot.progression}
          challenges={snapshot.challenges}
          onClose={() => setModal('none')}
          onBuyOrSelectVehicle={handleBuyOrSelectVehicle}
          onSelectPaint={handleSelectPaint}
          onBuyUpgrade={handleBuyUpgrade}
          onDeliverVehicle={handleDeliverVehicle}
        />
      )}

      {phase === 'playing' && activeModal === 'customize' && (
        <CustomizeModal
          money={snapshot.money}
          knowledgePoints={
            playerProfile ? playerProfile.knowledgePoints : (snapshot.knowledgePoints ?? snapshot.quizPoints)
          }
          customization={snapshot.progression.customization}
          onClose={() => setModal('none')}
          onOpenRewardShop={() => setModal('shop')}
          onSelectOutfit={handleSelectOutfit}
          onSelectAccessory={handleSelectAccessory}
          onChangeColors={(colors) => void handleChangeColors(colors)}
        />
      )}

      {phase === 'playing' && activeModal === 'shop' && (
        <RewardShop3DModal
          knowledgePoints={
            playerProfile ? playerProfile.knowledgePoints : (snapshot.knowledgePoints ?? snapshot.quizPoints)
          }
          lifetimeKpEarned={
            playerProfile ? playerProfile.lifetimeKpEarned : (snapshot.knowledgePoints ?? snapshot.quizPoints)
          }
          ownedItemIds={
            playerProfile
              ? playerProfile.ownedItemIds
              : snapshot.progression.customization.ownedItemIds || STARTER_OWNED_ITEM_IDS
          }
          unlockedBadges={playerProfile ? playerProfile.unlockedBadges : []}
          customization={snapshot.progression.customization}
          catalogItems={shopCatalog}
          authSignedIn={Boolean(authUser)}
          transactions={playerProfile ? playerProfile.recentTransactions : []}
          onClose={() => setModal('none')}
          onOpenAuth={() => setModal('session')}
          onPurchaseItem={handlePurchaseShopItem}
          onEquipItem={handleEquipShopItem}
          onChangeColors={handleChangeColors}
        />
      )}

      {phase === 'playing' && activeModal === 'emotes' && (
        <EmoteWheelModal
          animState={snapshot.animState}
          isSitting={snapshot.isSitting}
          nearbyPlayers={snapshot.nearbyPlayers || []}
          emoteWheelEnabled={publicTeacherConfig.socialConfig?.emoteWheelEnabled ?? true}
          onTriggerEmote={handleTriggerEmote}
          onToggleSit={handleToggleSit}
          onClose={() => setModal('none')}
        />
      )}

      {phase === 'playing' && activeModal === 'social' && (
        <SocialChallengeDrawer
          activeSession={activeSession}
          selfPlayerId={selfPlayerId}
          nearbyPlayers={snapshot.nearbyPlayers || []}
          socialConfig={publicTeacherConfig.socialConfig || DEFAULT_SOCIAL_CONFIG}
          chatMessages={chatMessages}
          groups={groups}
          challengeState={challengeState}
          mutedPlayerIds={mutedPlayerIdSet}
          onSendChat={handleSendChat}
          onGroupAction={handleGroupAction}
          onToggleMute={handleToggleMutePlayer}
          onReportPlayer={handleReportPlayer}
          onGreetPlayer={handleGreetPlayer}
          onOpenSessionModal={() => setModal('session')}
          onClose={() => setModal('none')}
        />
      )}

      {phase === 'playing' && activeModal === 'quiz' && activeQuizChallenge && (
        <PlayerQuizModal
          challenge={activeQuizChallenge}
          onSubmitAnswer={handleSubmitQuizAnswer}
          onClose={() => setModal('none')}
        />
      )}

      {phase === 'playing' && activeModal === 'elevator' && elevatorPanelState && (
        <ElevatorModal
          buildingName={elevatorPanelState.buildingName}
          currentFloor={
            snapshot.interior?.elevatorFloor ?? elevatorPanelState.currentFloor
          }
          targetFloor={elevatorPanelState.targetFloor}
          moving={snapshot.interior?.elevatorMoving ?? elevatorPanelState.moving}
          floors={elevatorPanelState.floors}
          onSelectFloor={handleSelectElevatorFloor}
          onClose={() => setModal('none')}
        />
      )}

      {activeModal === 'session' && (
        <StudentSessionModal
          authUser={authUser}
          authProfile={authProfile}
          authLoading={authLoading}
          activeSession={activeSession}
          connectionState={connectionState}
          sessionError={sessionError}
          explorationObjectives={snapshot.explorationObjectives}
          onSignInGoogle={handleSignInGoogle}
          onSignOut={handleSignOutGoogle}
          onJoinSession={handleJoinSession}
          onLeaveSession={handleLeaveSession}
          onClose={() => setModal('none')}
        />
      )}

      {activeModal === 'pin' && (
        <TeacherPinGateModal
          authUser={authUser}
          authProfile={authProfile}
          authLoading={authLoading}
          onSignInGoogle={handleSignInGoogle}
          onSignOut={handleSignOutGoogle}
          onVerified={(tok, exp) => void handlePinVerified(tok, exp)}
          onClose={() => setModal('none')}
        />
      )}

      {activeModal === 'teacher' && authIdToken && teacherToken && teacherDatabase && (
        <TeacherDashboardModal
          idToken={authIdToken}
          teacherToken={teacherToken}
          teacherEmail={authProfile?.email || authUser?.email || ''}
          database={teacherDatabase}
          onUpdateDatabase={handleUpdateQuestionDatabase}
          onResetToDefaults={handleResetQuestionBank}
          onLockTeacherMode={handleLockTeacherMode}
          onClose={() => setModal('none')}
        />
      )}

      {phase === 'paused' && !isOverlayOpen && (
        <PauseModal
          snapshot={snapshot}
          muted={muted}
          musicEnabled={snapshot.settings.musicEnabled}
          hasSaved={savedExists}
          activeSession={activeSession}
          onResume={handleResume}
          onSaveGame={handleSaveGame}
          onLoadGame={handleContinueSaved}
          onNewGame={handleNewGame}
          onMainMenu={handleMainMenu}
          onOpenSessionModal={() => setModal('session')}
          onSecretTeacherTrigger={() => void openSecretTeacherAccess()}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onSetGraphicsQuality={handleSetGraphicsQuality}
        />
      )}

      {snapshot.transitionFade > 0.01 && (
        <div
          data-testid="transition-fade"
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-slate-950 pointer-events-none"
          style={{ opacity: snapshot.transitionFade }}
        />
      )}
    </main>
  );
}
