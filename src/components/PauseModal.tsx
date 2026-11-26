import { useEffect, useRef, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import {
  FolderOpen,
  Home,
  Lock,
  Music,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { MultiplayerSessionSnapshot } from '../game/multiplayerTypes';
import type { GraphicsQuality, HudSnapshot } from '../game/types';

interface PauseModalProps {
  snapshot: HudSnapshot;
  muted: boolean;
  musicEnabled: boolean;
  hasSaved: boolean;
  activeSession: MultiplayerSessionSnapshot | null;
  onResume: () => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onNewGame: () => void;
  onMainMenu: () => void;
  onOpenSessionModal: () => void;
  onSecretTeacherTrigger: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onSetGraphicsQuality: (quality: GraphicsQuality) => void;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PauseModal: FC<PauseModalProps> = ({
  snapshot,
  muted,
  musicEnabled,
  hasSaved,
  activeSession,
  onResume,
  onSaveGame,
  onLoadGame,
  onNewGame,
  onMainMenu,
  onOpenSessionModal,
  onSecretTeacherTrigger,
  onToggleMute,
  onToggleMusic,
  onSetGraphicsQuality,
}) => {
  const completedChallenges = snapshot.challenges.filter((c) => c.completed).length;
  const holdTimerRef = useRef<number | null>(null);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearHoldTimer();
  }, []);

  const handleHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      onSecretTeacherTrigger();
    }, 3000);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(9, 14, 24, 0.74)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      data-testid="pause-modal"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-white/15 p-5 sm:p-6 shadow-2xl"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.96)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div
            data-testid="pause-logo-trigger"
            onPointerDown={handleHeaderPointerDown}
            onPointerUp={clearHoldTimer}
            onPointerCancel={clearHoldTimer}
            onPointerLeave={clearHoldTimer}
            onContextMenu={(e) => e.preventDefault()}
            className="select-none touch-none"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-amber-400">
              Urban Life: City of Freedom
            </div>
            <h2 id="pause-title" className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
              Game Paused
            </h2>
          </div>
          {snapshot.lastSavedAt && (
            <span className="text-[11px] font-mono-hud text-emerald-400 bg-emerald-500/10 border border-emerald-400/25 rounded px-2 py-1">
              Saved {new Date(snapshot.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Tabular Exploration Stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-white/10">
          <div>
            <div className="text-[11px] text-slate-400">Cash</div>
            <div className="font-mono-hud text-lg font-semibold text-emerald-400 mt-0.5">
              ${snapshot.money}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Quiz Points</div>
            <div className="font-mono-hud text-lg font-semibold text-sky-300 mt-0.5">
              {snapshot.quizPoints} pts
            </div>
            <div className="text-[10px] text-slate-400">
              {snapshot.completedQuestionsCount}/{snapshot.activeQuestionsCount} solved
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Session</div>
            <div className="font-mono-hud text-lg font-semibold text-white mt-0.5">
              {formatDuration(snapshot.elapsedTime)}
            </div>
            <div className="text-[10px] text-slate-400">
              {Math.round(snapshot.progression.totalDistance)} m
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Location</div>
            <div className="text-xs sm:text-sm font-semibold text-amber-300 mt-1 leading-snug">
              {snapshot.districtName}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{snapshot.timeLabel}</div>
          </div>
        </div>

        {/* Audio & Graphics Settings */}
        <div className="mt-4 space-y-3 border-b border-white/10 pb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Audio &amp; Quality Settings
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono-hud text-slate-400">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Challenges {completedChallenges}/{snapshot.challenges.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="pause-toggle-sfx"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                muted
                  ? 'border-white/10 bg-slate-800/70 text-slate-400'
                  : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
              }`}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{muted ? 'SFX Off' : 'SFX On'}</span>
            </button>

            <button
              type="button"
              data-testid="pause-toggle-music"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMusic();
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                !musicEnabled || muted
                  ? 'border-white/10 bg-slate-800/70 text-slate-400'
                  : 'border-sky-400/40 bg-sky-500/15 text-sky-300'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>{musicEnabled ? 'Music On' : 'Music Off'}</span>
            </button>
          </div>

          <div>
            <div className="text-[11px] text-slate-400 mb-1.5">Graphics Quality</div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((q) => {
                const active = snapshot.settings.graphicsQuality === q;
                return (
                  <button
                    key={q}
                    type="button"
                    data-testid={`graphics-${q}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSetGraphicsQuality(q);
                    }}
                    className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold capitalize transition-colors ${
                      active
                        ? 'border-amber-400 bg-amber-500 text-slate-950'
                        : 'border-white/10 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions: Resume | Session | Save / Load | New Game / Main Menu */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            data-testid="resume-game-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onResume();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 transition-colors focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume</span>
          </button>

          <button
            type="button"
            data-testid="pause-session-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSessionModal();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg border border-sky-400/40 bg-sky-500/15 text-sky-300 font-semibold text-xs sm:text-sm hover:bg-sky-500/25 transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>
              {activeSession
                ? `Classroom Session (${activeSession.session.joinCode})`
                : 'Classroom Session & Account'}
            </span>
          </button>

          <button
            type="button"
            data-testid="pause-teacher-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onSecretTeacherTrigger();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-300 font-semibold text-xs sm:text-sm hover:bg-amber-500/20 transition-colors"
          >
            <Lock className="w-4 h-4" />
            <span>Teacher Mode (Edit Questions &amp; Locations)</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="save-game-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onSaveGame();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs sm:text-sm hover:bg-emerald-500 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Game</span>
            </button>

            <button
              type="button"
              data-testid="load-game-btn"
              disabled={!hasSaved}
              onClick={(e) => {
                e.currentTarget.blur();
                onLoadGame();
              }}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border font-semibold text-xs sm:text-sm transition-colors ${
                hasSaved
                  ? 'bg-slate-800 border-white/15 text-white hover:bg-slate-700'
                  : 'bg-slate-900/60 border-white/5 text-slate-500 cursor-not-allowed'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>Load Game</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="new-game-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onNewGame();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 text-white border border-white/10 font-medium text-xs sm:text-sm hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>New Game</span>
            </button>

            <button
              type="button"
              data-testid="main-menu-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onMainMenu();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-transparent text-slate-300 border border-white/10 font-medium text-xs sm:text-sm hover:bg-slate-800/70 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Main Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
