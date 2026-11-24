import { useEffect, useRef, useState, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Camera,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  DoorOpen,
  Flag,
  GraduationCap,
  Hand,
  Heart,
  MessageSquare,
  Moon,
  Pause,
  Shirt,
  ShoppingBag,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import type { EmoteKind } from '../game/characterAnimator';
import { computeResponsiveJoystickMetrics } from '../game/joystickUtils';
import type { MultiplayerSessionSnapshot } from '../game/multiplayerTypes';
import type { DrivingInputState, HudSnapshot, TimeOfDayPhase } from '../game/types';
import { CityMinimap } from './CityMinimap';

interface GameHudProps {
  snapshot: HudSnapshot;
  muted: boolean;
  activeSession: MultiplayerSessionSnapshot | null;
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  selfGroupId?: string | null;
  showGroupMarkers?: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onCycleTimeOfDay: () => void;
  onOpenPhotoMode: () => void;
  onOpenGarage: () => void;
  onOpenCustomize: () => void;
  onOpenShop: () => void;
  onOpenEmotes: () => void;
  onOpenSocial: () => void;
  onOpenSessionModal: () => void;
  onInteract: () => void;
  onMissionAction: () => void;
  onTriggerEmote: (emote: EmoteKind) => void;
  onToggleSit: () => void;
  onOpenElevatorPanel: () => void;
  onMobileMove: (x: number, y: number) => void;
  onMobileSprint: (active: boolean) => void;
  onMobileJump: (held: boolean) => void;
  onMobileDrivingInput: (field: keyof DrivingInputState, held: boolean) => void;
}

function getCardinalLabel(yaw: number): string {
  const norm = (((-yaw * 180) / Math.PI) % 360 + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(norm / 45) % 8];
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function renderTimeIcon(phase: TimeOfDayPhase) {
  switch (phase) {
    case 'pagi':
      return <Sunrise className="w-4 h-4 text-amber-300" />;
    case 'siang':
      return <Sun className="w-4 h-4 text-amber-400" />;
    case 'sore':
      return <Sunset className="w-4 h-4 text-orange-400" />;
    case 'malam':
      return <Moon className="w-4 h-4 text-sky-300" />;
  }
}

export const GameHud: FC<GameHudProps> = ({
  snapshot,
  muted,
  activeSession,
  connectionState,
  selfGroupId = null,
  showGroupMarkers = true,
  onPause,
  onToggleMute,
  onCycleTimeOfDay,
  onOpenPhotoMode,
  onOpenGarage,
  onOpenCustomize,
  onOpenShop,
  onOpenEmotes,
  onOpenSocial,
  onOpenSessionModal,
  onInteract,
  onMissionAction,
  onTriggerEmote,
  onToggleSit,
  onOpenElevatorPanel,
  onMobileMove,
  onMobileSprint,
  onMobileJump,
  onMobileDrivingInput,
}) => {
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const [sprintLocked, setSprintLocked] = useState(false);
  const [objectivesExpanded, setObjectivesExpanded] = useState(false);
  const hudRootRef = useRef<HTMLDivElement | null>(null);
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);

  const readMetrics = () => {
    if (typeof window === 'undefined') {
      return computeResponsiveJoystickMetrics(1024, 768, false);
    }
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    return computeResponsiveJoystickMetrics(vw, vh, coarse);
  };

  const [joyMetrics, setJoyMetrics] = useState(readMetrics);

  useEffect(() => {
    const refresh = () => {
      const next = readMetrics();
      setJoyMetrics(next);
      setJoyOffset((prev) => {
        const d = Math.hypot(prev.x, prev.y);
        if (d <= next.maxRadiusPx || d === 0) return prev;
        const scale = next.maxRadiusPx / d;
        return { x: prev.x * scale, y: prev.y * scale };
      });
    };

    refresh();
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', refresh);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && hudRootRef.current) {
      ro = new ResizeObserver(refresh);
      ro.observe(hudRootRef.current);
    }

    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      vv?.removeEventListener('resize', refresh);
      ro?.disconnect();
    };
  }, []);

  const maxRadius = joyMetrics.maxRadiusPx;

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const radius = Math.max(22, Math.min(maxRadius, rect.width * 0.38));
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    setJoyOffset({ x: dx, y: dy });
    onMobileMove(dx / radius, -dy / radius);
  };

  const handleJoyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    joyPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerId.current = null;
    setJoyOffset({ x: 0, y: 0 });
    onMobileMove(0, 0);
  };

  const speedKmh = Math.round(snapshot.speed * 3.6);
  const staminaPct = Math.round(snapshot.stamina);
  const healthPct = Math.max(0, Math.min(100, Math.round((snapshot.health / snapshot.maxHealth) * 100)));
  const heading = getCardinalLabel(snapshot.cameraYaw);
  const isDriving = snapshot.playerMode === 'driving' || snapshot.playerMode === 'entering';
  const interior = snapshot.interior?.active ? snapshot.interior : null;
  const interiorCategoryLabel = interior
    ? interior.category.charAt(0).toUpperCase() + interior.category.slice(1)
    : '';

  const makeDrivingHoldHandlers = (field: keyof DrivingInputState) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onMobileDrivingInput(field, true);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onMobileDrivingInput(field, false);
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onMobileDrivingInput(field, false);
    },
  });

  return (
    <div
      ref={hudRootRef}
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-5"
    >
      {/* Top Row: Left District/Money/Health/Wanted/Mission | Right Minimap & Controls */}
      <div className="flex items-start justify-between gap-2.5 sm:gap-4">
        <div className="flex flex-col gap-2">
          {/* Top-Left District + Cash + Health + Wanted + Stamina/Speed Card */}
          <div
            className="rounded-lg border border-white/15 px-2.5 py-2 sm:px-3.5 sm:py-2.5 shadow-md min-w-[172px] max-w-[214px] sm:max-w-none sm:min-w-[264px]"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] sm:text-[11px] font-medium text-amber-400 tracking-wide uppercase">
                {isDriving ? 'Vehicle' : interior ? interiorCategoryLabel : 'District'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono-hud text-slate-300">
                <span data-testid="hud-time-label" className="text-slate-200">
                  {snapshot.timeLabel}
                </span>
                <span className="text-slate-500">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Compass className="w-3 h-3 text-slate-400" />
                  {heading}
                </span>
              </span>
            </div>

            <div
              data-testid="hud-district"
              className="font-display text-xs sm:text-base font-bold text-white truncate mt-0.5"
            >
              {isDriving && snapshot.currentVehicleLabel
                ? snapshot.currentVehicleLabel
                : snapshot.districtName}
            </div>

            {interior && (
              <div className="mt-1 space-y-1">
                <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono-hud text-sky-300">
                  <span
                    data-testid="hud-floor-badge"
                    className="inline-flex items-center gap-1 font-semibold whitespace-nowrap"
                  >
                    <Building2 className="w-3 h-3 shrink-0" />
                    Floor {interior.currentFloor}/{interior.totalFloors}
                    {interior.totalFloors >= 10 && interior.currentFloor === interior.totalFloors
                      ? ' · Rooftop'
                      : ''}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {interior.hasElevator
                      ? 'Elevator · Stairs'
                      : interior.totalFloors > 1
                        ? 'Stairs'
                        : 'Indoor'}
                  </span>
                </div>
                {interior.inElevatorCabin && (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="hud-elevator-panel-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onOpenElevatorPanel();
                    }}
                    className="pointer-events-auto w-full inline-flex items-center justify-center gap-1.5 rounded bg-amber-500/20 border border-amber-400/50 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors"
                  >
                    <ArrowUpDown className="w-3 h-3 text-amber-300 shrink-0" />
                    <span>
                      {interior.elevatorMoving
                        ? `Cabin Moving (F${interior.elevatorFloor ?? interior.currentFloor})`
                        : 'Select Floor Panel'}
                    </span>
                  </button>
                )}
              </div>
            )}

            {!interior && snapshot.activeRooftopName && (
              <div
                data-testid="hud-rooftop-badge"
                className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono-hud text-amber-300 font-semibold"
              >
                <Building2 className="w-3 h-3 shrink-0 text-amber-400" />
                <span className="truncate">{snapshot.activeRooftopName}</span>
              </div>
            )}

            {snapshot.isClimbingLadder && (
              <div
                data-testid="hud-ladder-badge"
                className="mt-1 rounded bg-sky-500/20 border border-sky-400/45 px-2 py-0.5 text-[10px] font-mono-hud text-sky-200 font-semibold"
              >
                Climbing Ladder · W/S Climb · Jump Dismount
              </div>
            )}

            {/* Cash + Quiz Points + Wanted Stars Row */}
            <div className="mt-1.5 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  data-testid="hud-money"
                  className="font-mono-hud text-xs sm:text-sm font-semibold text-emerald-400 tabular-nums"
                >
                  ${snapshot.money}
                </span>
                <span
                  data-testid="hud-kp"
                  title={`Knowledge Points (${snapshot.completedQuestionsCount}/${snapshot.activeQuestionsCount} solved)`}
                  className="inline-flex items-center gap-1 font-mono-hud text-[11px] sm:text-xs font-bold text-amber-300 tabular-nums"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span data-testid="hud-quiz-points">
                    {snapshot.knowledgePoints ?? snapshot.quizPoints} KP
                  </span>
                </span>
              </div>

              <div
                data-testid="hud-wanted"
                aria-label={`Wanted level ${snapshot.wantedLevel} of 3`}
                className="flex items-center gap-1 shrink-0"
              >
                {[1, 2, 3].map((star) => {
                  const active = star <= snapshot.wantedLevel;
                  return (
                    <svg
                      key={star}
                      viewBox="0 0 24 24"
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 2.4l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.2l-5.8 3.1 1.1-6.5L2.6 9.2l6.5-.9L12 2.4z"
                        fill={active ? '#ef4444' : 'rgba(51, 65, 85, 0.7)'}
                        stroke={active ? '#fca5a5' : 'rgba(148, 163, 184, 0.45)'}
                        strokeWidth="1.4"
                      />
                    </svg>
                  );
                })}
              </div>
            </div>

            {/* Health Bar */}
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono-hud text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-400 fill-rose-400/80" />
                  <span>Health</span>
                </span>
                <span data-testid="hud-health" className="tabular-nums text-white font-semibold">
                  {healthPct}%
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-700/80 overflow-hidden">
                <div
                  className={`h-full transition-transform duration-150 origin-left ${
                    healthPct > 55
                      ? 'bg-emerald-400'
                      : healthPct > 25
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                  }`}
                  style={{ transform: `scaleX(${healthPct / 100})` }}
                />
              </div>
            </div>

            {/* Speed & Stamina / Vehicle Speedometer */}
            {isDriving ? (
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-200 font-mono-hud border-t border-white/10 pt-1.5">
                <span className="inline-flex items-center gap-1 text-amber-300 whitespace-nowrap shrink-0">
                  <Car className="w-3.5 h-3.5" />
                  <span data-testid="hud-speed">{speedKmh} km/h</span>
                </span>
                <span className="text-[10px] text-slate-400 truncate min-w-0 text-right">
                  {snapshot.districtName}
                </span>
              </div>
            ) : (
              <>
                <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300 font-mono-hud">
                  <span>Stamina {staminaPct}%</span>
                  <span data-testid="hud-speed">{speedKmh} km/h</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-700/80 overflow-hidden">
                  <div
                    className={`h-full transition-transform duration-100 origin-left ${
                      snapshot.isSprinting ? 'bg-amber-400' : 'bg-sky-400'
                    }`}
                    style={{ transform: `scaleX(${Math.max(0, Math.min(1, staminaPct / 100))})` }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Active Classroom Session Status Card */}
          {activeSession && (
            <div
              data-testid="hud-active-session-card"
              className="rounded-lg border border-sky-400/40 px-2.5 py-2 sm:px-3.5 sm:py-2 shadow-md max-w-[215px] sm:max-w-[265px]"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
                <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-sky-400">
                  <Users className="w-3 h-3" />
                  <span>{activeSession.session.joinCode}</span>
                </span>
                <span className="inline-flex items-center gap-1 font-mono-hud text-amber-300 font-semibold">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimer(activeSession.session.remainingSeconds)}</span>
                </span>
              </div>
              <div className="text-xs font-semibold text-white truncate mt-0.5">
                {activeSession.session.name}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-300 font-mono-hud">
                <span>
                  {activeSession.onlineCount}/{activeSession.session.maxPlayers} online
                </span>
                <span
                  className={
                    connectionState === 'connected'
                      ? 'text-emerald-400'
                      : connectionState === 'reconnecting'
                        ? 'text-amber-300'
                        : 'text-rose-400'
                  }
                >
                  {activeSession.session.status === 'paused' ? 'Paused' : connectionState}
                </span>
              </div>
            </div>
          )}

          {/* Active Mission Card (compact under top-left cluster) */}
          {snapshot.activeMission && (
            <div
              data-testid="active-mission-card"
              className="rounded-lg border border-amber-400/40 px-2.5 py-2 sm:px-3.5 sm:py-2.5 shadow-md max-w-[215px] sm:max-w-[265px]"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                  <Flag className="w-3 h-3" />
                  Mission
                </span>
                <span
                  data-testid="mission-timer"
                  className={`font-mono-hud text-xs font-bold tabular-nums ${
                    snapshot.activeMission.timeRemaining <= 12 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {formatTimer(snapshot.activeMission.timeRemaining)}
                </span>
              </div>
              <div className="font-display text-xs sm:text-sm font-bold text-white truncate mt-0.5">
                {snapshot.activeMission.title}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-300">
                <span className="truncate">{snapshot.activeMission.targetLabel}</span>
                <span className="font-mono-hud text-sky-300 shrink-0">
                  {snapshot.activeMission.distanceToTarget} m
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-400 font-mono-hud">
                <span>Reward +${snapshot.activeMission.reward}</span>
                {snapshot.activeMission.totalCheckpoints > 1 && (
                  <span>
                    {snapshot.activeMission.checkpointIndex + 1}/
                    {snapshot.activeMission.totalCheckpoints}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Exploration Objectives Compact Tracker */}
          {snapshot.explorationObjectives && snapshot.explorationObjectives.length > 0 && (
            <div
              data-testid="hud-objectives"
              className="pointer-events-auto rounded-lg border border-white/20 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-md max-w-[214px] sm:max-w-[264px]"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}
            >
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-objectives-toggle"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setObjectivesExpanded((prev) => !prev);
                }}
                className="w-full flex items-center justify-between gap-2 text-left text-[10px] sm:text-[11px] font-semibold text-slate-100 hover:text-white"
              >
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Target className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">City Quests</span>
                </span>
                <span className="inline-flex items-center gap-1 font-mono-hud text-emerald-300 shrink-0">
                  <span>
                    {snapshot.explorationObjectives.filter((o) => o.completed).length}/
                    {snapshot.explorationObjectives.length}
                  </span>
                  {objectivesExpanded ? (
                    <ChevronUp className="w-3 h-3 text-slate-300" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-slate-300" />
                  )}
                </span>
              </button>

              {objectivesExpanded ? (
                <div className="mt-1.5 space-y-1 border-t border-white/15 pt-1.5 max-h-40 overflow-y-auto">
                  {snapshot.explorationObjectives.map((obj) => (
                    <div
                      key={obj.id}
                      className="flex items-center justify-between gap-2 text-[10px]"
                    >
                      <span
                        className={`inline-flex items-center gap-1 truncate ${
                          obj.completed ? 'text-emerald-300 line-through' : 'text-slate-100'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-2.5 h-2.5 shrink-0 ${
                            obj.completed ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{obj.title}</span>
                      </span>
                      <span className="font-mono-hud text-slate-300 shrink-0">
                        {Math.min(obj.current, obj.target)}/{obj.target}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                (() => {
                  const nextObj =
                    snapshot.explorationObjectives.find((o) => !o.completed) ||
                    snapshot.explorationObjectives[0];
                  return nextObj ? (
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-200">
                      <span className="truncate">{nextObj.title}</span>
                      <span className="font-mono-hud text-sky-300 shrink-0">
                        {Math.min(nextObj.current, nextObj.target)}/{nextObj.target}
                      </span>
                    </div>
                  ) : null;
                })()
              )}
            </div>
          )}
        </div>

        {/* Top-Right Minimap, Garage/Style Shortcuts & Utility Actions */}
        <div className="flex items-start gap-2 sm:gap-2.5">
          <div className="flex flex-col gap-1.5 sm:gap-2 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause game"
              title="Pause (Esc / P)"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-white/15 flex items-center justify-center text-white hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.84)' }}
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title="Toggle Sound (M)"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-white/15 flex items-center justify-center text-white hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.84)' }}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-400" />
              )}
            </button>
            <button
              type="button"
              tabIndex={-1}
              data-testid="time-toggle"
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleTimeOfDay();
              }}
              aria-label={`Change time of day (${snapshot.timeLabel})`}
              title={`Time: ${snapshot.timeLabel} (T)`}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-white/15 flex items-center justify-center text-white hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.84)' }}
            >
              {renderTimeIcon(snapshot.timeOfDay)}
            </button>
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-photo-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenPhotoMode();
              }}
              aria-label="Open Photo Studio Mode"
              title="Photo Studio Mode (V)"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-amber-400/35 flex items-center justify-center text-amber-300 hover:bg-slate-800 hover:border-amber-400 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <CityMinimap
              playerX={snapshot.playerX}
              playerZ={snapshot.playerZ}
              cameraYaw={snapshot.cameraYaw}
              wantedLevel={snapshot.wantedLevel}
              activeMission={snapshot.activeMission}
              availableMissions={snapshot.availableMissions}
              trafficMarkers={snapshot.trafficMarkers}
              remotePlayerMarkers={snapshot.remotePlayerMarkers}
              selfGroupId={selfGroupId}
              showGroupMarkers={showGroupMarkers}
            />

            {/* Garage, Style, Reward Shop, Social & Classroom Session Quick Buttons */}
            <div className="pointer-events-auto flex flex-col gap-1.5 w-[148px] sm:w-[178px]">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-garage-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenGarage();
                  }}
                  title="Open Garage & Challenges (G)"
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-white/15 text-[11px] font-semibold text-white hover:border-amber-400/60 hover:bg-slate-800 transition-colors whitespace-nowrap"
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
                >
                  <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Garage</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-customize-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenCustomize();
                  }}
                  title="Open Character Style (C)"
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-white/15 text-[11px] font-semibold text-white hover:border-amber-400/60 hover:bg-slate-800 transition-colors whitespace-nowrap"
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
                >
                  <Shirt className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>Style</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-shop-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenShop();
                  }}
                  title="3D Reward Shop & Inventory (K)"
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-amber-400/35 text-[11px] font-semibold text-amber-200 hover:border-amber-400 hover:bg-slate-800 transition-colors whitespace-nowrap"
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
                >
                  <ShoppingBag className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Shop</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-social-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenSocial();
                  }}
                  title="Social Chat, Groups & Challenge Leaderboard"
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-white/15 text-[11px] font-semibold text-white hover:border-sky-400/60 hover:bg-slate-800 transition-colors whitespace-nowrap"
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
                >
                  <MessageSquare className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Social</span>
                </button>
              </div>
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-session-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenSessionModal();
                }}
                title="Join Classroom Session & Account"
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-white/15 text-[11px] font-semibold text-white hover:border-sky-400/60 hover:bg-slate-800 transition-colors whitespace-nowrap"
                style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
              >
                <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>{activeSession ? 'Session Roster' : 'Join Session'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Area: Banners, Contextual Prompt, Mobile & Desktop Controls */}
      <div className="flex flex-col gap-2 w-full">
        {/* Economy / Challenge / Save Activity Toast */}
        {snapshot.activityToast && (
          <div className="flex justify-center">
            <div
              data-testid="activity-toast"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/45 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{snapshot.activityToast}</span>
            </div>
          </div>
        )}

        {/* Mission Result Banner */}
        {snapshot.missionBanner && (
          <div className="flex justify-center">
            <div
              data-testid="mission-result-banner"
              className={`rounded-lg border px-4 py-2.5 shadow-lg text-center ${
                snapshot.missionBanner.status === 'completed'
                  ? 'border-emerald-400/60 text-white'
                  : 'border-red-400/60 text-white'
              }`}
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.94)' }}
            >
              <div
                className={`font-display text-sm sm:text-base font-bold ${
                  snapshot.missionBanner.status === 'completed'
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {snapshot.missionBanner.status === 'completed'
                  ? 'Mission Completed'
                  : 'Mission Failed'}
              </div>
              <div className="text-xs text-slate-200 mt-0.5">
                {snapshot.missionBanner.title} · {snapshot.missionBanner.message}
              </div>
            </div>
          </div>
        )}

        {/* Contextual Vehicle / Mission Interact Prompt */}
        {snapshot.interactPrompt && (
          <div className="flex justify-center">
            <button
              type="button"
              tabIndex={-1}
              data-testid="interact-prompt"
              onClick={(e) => {
                e.currentTarget.blur();
                if (isDriving && snapshot.interactPrompt?.kind === 'mission') {
                  onMissionAction();
                } else {
                  onInteract();
                }
              }}
              className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-amber-400/55 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition-colors"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
            >
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono-hud text-[11px] font-bold">
                {isDriving && snapshot.interactPrompt.kind === 'mission' ? 'F' : 'E'}
              </span>
              <span>{snapshot.interactPrompt.label}</span>
            </button>
          </div>
        )}

        {/* Responsive Touch Controls (mobile portrait/landscape & touch tablets) */}
        {joyMetrics.showTouchControls && (isDriving ? (
          /* Mobile Driving Controls: Left/Right Steering | Exit, Brake/Reverse, Gas */
          <div
            data-testid="mobile-driving-controls"
            className="flex items-end justify-between w-full px-1"
            style={{ paddingBottom: `${joyMetrics.bottomOffsetPx}px` }}
          >
            {/* Left / Right Steering Buttons */}
            <div className="pointer-events-auto flex items-center" style={{ gap: `${joyMetrics.gapPx}px` }}>
              <button
                type="button"
                data-testid="mobile-steer-left"
                aria-label="Steer left"
                {...makeDrivingHoldHandlers('steerLeft')}
                className="rounded-xl border-2 border-white/25 text-white flex items-center justify-center active:bg-amber-500 active:text-slate-950 transition-colors touch-none"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.78)',
                  width: `${joyMetrics.drivingSteerSizePx}px`,
                  height: `${joyMetrics.drivingSteerSizePx}px`,
                }}
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                data-testid="mobile-steer-right"
                aria-label="Steer right"
                {...makeDrivingHoldHandlers('steerRight')}
                className="rounded-xl border-2 border-white/25 text-white flex items-center justify-center active:bg-amber-500 active:text-slate-950 transition-colors touch-none"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.78)',
                  width: `${joyMetrics.drivingSteerSizePx}px`,
                  height: `${joyMetrics.drivingSteerSizePx}px`,
                }}
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>

            {/* Exit + Brake/Reverse + Accelerate */}
            <div className="pointer-events-auto flex items-end" style={{ gap: `${joyMetrics.gapPx}px` }}>
              <button
                type="button"
                data-testid="mobile-exit"
                aria-label="Exit vehicle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onInteract();
                }}
                className="rounded-full border-2 border-white/25 text-white flex flex-col items-center justify-center text-[10px] font-semibold"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  width: `${joyMetrics.actionBtnSizePx}px`,
                  height: `${joyMetrics.actionBtnSizePx}px`,
                }}
              >
                <DoorOpen className="w-4 h-4" />
                <span>Exit</span>
              </button>

              <button
                type="button"
                data-testid="mobile-brake"
                aria-label="Brake or Reverse"
                {...makeDrivingHoldHandlers('brakeReverse')}
                className="rounded-xl border-2 border-red-400/50 text-white flex flex-col items-center justify-center text-[10px] font-semibold active:bg-red-500 transition-colors touch-none"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.82)',
                  width: `${joyMetrics.drivingPedalWidthPx}px`,
                  height: `${joyMetrics.drivingSteerSizePx}px`,
                }}
              >
                <ArrowDown className="w-5 h-5" />
                <span>Brake</span>
              </button>

              <button
                type="button"
                data-testid="mobile-accelerate"
                aria-label="Accelerate"
                {...makeDrivingHoldHandlers('accelerate')}
                className="rounded-xl border-2 border-amber-400/70 text-white flex flex-col items-center justify-center text-xs font-semibold active:bg-amber-500 active:text-slate-950 transition-colors touch-none"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.86)',
                  width: `${joyMetrics.drivingSteerSizePx}px`,
                  height: `${joyMetrics.drivingGasHeightPx}px`,
                }}
              >
                <ArrowUp className="w-6 h-6" />
                <span>Gas</span>
              </button>
            </div>
          </div>
        ) : (
          /* Mobile On-Foot Controls: Dynamic Joystick | Interact, Run, Jump */
          <div
            data-testid="mobile-foot-controls"
            className="flex items-end justify-between w-full px-1"
            style={{ paddingBottom: `${joyMetrics.bottomOffsetPx}px` }}
          >
            <div
              ref={joyBaseRef}
              data-testid="mobile-joystick"
              onPointerDown={handleJoyDown}
              onPointerMove={handleJoyMove}
              onPointerUp={handleJoyUp}
              onPointerCancel={handleJoyUp}
              className="pointer-events-auto relative rounded-full border-2 border-white/25 flex items-center justify-center touch-none transition-[width,height] duration-150"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.55)',
                width: `${joyMetrics.padSizePx}px`,
                height: `${joyMetrics.padSizePx}px`,
              }}
              aria-label="Movement joystick"
            >
              <div
                data-testid="mobile-joystick-knob"
                className="rounded-full border border-amber-300/60 shadow-md pointer-events-none"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.88)',
                  width: `${joyMetrics.knobSizePx}px`,
                  height: `${joyMetrics.knobSizePx}px`,
                  transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`,
                }}
              />
            </div>

            <div className="pointer-events-auto flex items-end" style={{ gap: `${joyMetrics.gapPx}px` }}>
              <button
                type="button"
                data-testid="mobile-interact"
                aria-label="Interact with vehicle or mission"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onInteract();
                }}
                className={`rounded-full border-2 flex flex-col items-center justify-center text-[10px] font-semibold transition-colors ${
                  snapshot.interactPrompt
                    ? 'border-amber-300 bg-amber-500 text-slate-950'
                    : 'border-white/20 text-slate-300'
                }`}
                style={{
                  ...(snapshot.interactPrompt ? {} : { backgroundColor: 'rgba(15, 23, 42, 0.72)' }),
                  width: `${joyMetrics.actionBtnSizePx}px`,
                  height: `${joyMetrics.actionBtnSizePx}px`,
                }}
              >
                <Hand className="w-4 h-4" />
                <span>Interact</span>
              </button>

              <button
                type="button"
                data-testid="mobile-sprint"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const next = !sprintLocked;
                  setSprintLocked(next);
                  onMobileSprint(next);
                }}
                aria-label="Toggle sprint"
                aria-pressed={sprintLocked}
                className={`rounded-full border-2 flex flex-col items-center justify-center text-[11px] font-semibold transition-colors ${
                  sprintLocked
                    ? 'border-amber-300 bg-amber-500 text-slate-950'
                    : 'border-white/25 text-white'
                }`}
                style={{
                  ...(sprintLocked ? {} : { backgroundColor: 'rgba(15, 23, 42, 0.72)' }),
                  width: `${joyMetrics.actionBtnSizePx}px`,
                  height: `${joyMetrics.actionBtnSizePx}px`,
                }}
              >
                <Zap className="w-4 h-4" />
                <span>Run</span>
              </button>

              <button
                type="button"
                data-testid="mobile-jump"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onMobileJump(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onMobileJump(false);
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  onMobileJump(false);
                }}
                aria-label="Jump"
                className="rounded-full border-2 border-white/30 text-white flex flex-col items-center justify-center text-xs font-semibold active:scale-95 transition-transform"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.78)',
                  width: `${joyMetrics.jumpBtnSizePx}px`,
                  height: `${joyMetrics.jumpBtnSizePx}px`,
                }}
              >
                <ArrowUp className="w-5 h-5" />
                <span>Jump</span>
              </button>
            </div>
          </div>
        ))}

        {/* Nearby Classmate Quick Social Strip */}
        {snapshot.playerMode === 'on_foot' &&
          snapshot.nearbyPlayers &&
          snapshot.nearbyPlayers.length > 0 && (
            <div className="flex justify-center">
              <div
                data-testid="hud-nearby-social"
                className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 px-3 py-1 text-[11px] text-emerald-200 shadow-md"
                style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
              >
                <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium truncate max-w-[140px]">
                  {snapshot.nearbyPlayers[0].displayName}
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerEmote('handshake');
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-semibold hover:bg-emerald-500/30"
                >
                  Handshake
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerEmote('high_five');
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-semibold hover:bg-amber-500/30"
                >
                  High-Five
                </button>
              </div>
            </div>
          )}

        {/* Compact On-Foot Emote & Sit Quick-Bar */}
        {snapshot.playerMode === 'on_foot' && (
          <div className="flex justify-center">
            <div
              data-testid="hud-emote-bar"
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/15 px-1.5 py-1 shadow-md"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)' }}
            >
              {(
                [
                  { kind: 'wave', label: 'Wave' },
                  { kind: 'celebrate', label: 'Cheer' },
                  { kind: 'clap', label: 'Clap' },
                  { kind: 'dance', label: 'Dance' },
                  { kind: 'point', label: 'Point' },
                ] as const
              ).map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  tabIndex={-1}
                  data-testid={`emote-btn-${item.kind}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerEmote(item.kind);
                  }}
                  className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-semibold transition-colors ${
                    snapshot.animState === item.kind
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <span className="h-3.5 w-px bg-white/15 mx-0.5" aria-hidden="true" />
              <button
                type="button"
                tabIndex={-1}
                data-testid="emote-btn-sit"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleSit();
                }}
                className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-semibold transition-colors ${
                  snapshot.isSitting
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-sky-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {snapshot.isSitting ? 'Stand' : 'Sit'}
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-emotes-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenEmotes();
                }}
                title="Open Full Emote Wheel (B)"
                className="px-2 py-1 rounded text-[10px] sm:text-[11px] font-semibold text-amber-300 hover:bg-slate-800 hover:text-amber-200 transition-colors"
              >
                Wheel (B)
              </button>
            </div>
          </div>
        )}

        {/* Desktop Subtle Bottom Controls Strip */}
        <div className="hidden lg:flex w-full justify-center pb-1">
          <div
            className="px-4 py-1.5 rounded-lg border border-white/10 text-xs text-slate-200/90 tracking-wide"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
          >
            {isDriving
              ? 'W/S Gas & Reverse · A/D Steer · Space Handbrake · E Exit · V Photo · G Garage · K Shop · Esc Pause'
              : interior
                ? 'WASD Move · Space Jump · E Door / Kiosk / Exit · B Emotes · V Photo · K Shop · Esc Pause'
                : snapshot.pointerLocked
                  ? 'WASD Move · Shift Sprint · E Interact · B Emotes · V Photo · K Shop · G Garage · T Time'
                  : 'Click or Drag Camera · WASD Move · E Interact · B Emotes · V Photo · K Shop · G Garage'}
          </div>
        </div>
      </div>
    </div>
  );
};
