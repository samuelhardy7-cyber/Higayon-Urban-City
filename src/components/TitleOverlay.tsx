import { useEffect, useRef, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import { FolderOpen, Music, Play, Users, Volume2, VolumeX } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { MultiplayerSessionSnapshot } from '../game/multiplayerTypes';

interface TitleOverlayProps {
  muted: boolean;
  musicEnabled: boolean;
  hasSavedGame: boolean;
  authUser: User | null;
  activeSession: MultiplayerSessionSnapshot | null;
  onStart: () => void;
  onContinueSaved: () => void;
  onOpenSessionModal: () => void;
  onSecretTeacherTrigger: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
}

export const TitleOverlay: FC<TitleOverlayProps> = ({
  muted,
  musicEnabled,
  hasSavedGame,
  authUser,
  activeSession,
  onStart,
  onContinueSaved,
  onOpenSessionModal,
  onSecretTeacherTrigger,
  onToggleMute,
  onToggleMusic,
}) => {
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

  const handleLogoPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      onSecretTeacherTrigger();
    }, 3000);
  };

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12 pointer-events-none"
      style={{
        background:
          'linear-gradient(75deg, rgba(9, 14, 24, 0.84) 0%, rgba(9, 14, 24, 0.44) 44%, rgba(9, 14, 24, 0.05) 100%)',
      }}
    >
      {/* Top Row: Sound & Music Toggles */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMusic();
          }}
          aria-label={musicEnabled ? 'Turn music off' : 'Turn music on'}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-200 border border-white/15 transition-colors hover:bg-slate-800/90 focus-visible:outline-2 focus-visible:outline-amber-400"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.82)' }}
        >
          <Music className={`w-4 h-4 ${musicEnabled ? 'text-sky-400' : 'text-slate-400'}`} />
          <span className="whitespace-nowrap">{musicEnabled ? 'Music On' : 'Music Off'}</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-200 border border-white/15 transition-colors hover:bg-slate-800/90 focus-visible:outline-2 focus-visible:outline-amber-400"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.82)' }}
        >
          {muted ? (
            <VolumeX className="w-4 h-4 text-slate-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-amber-400" />
          )}
          <span className="whitespace-nowrap">{muted ? 'Sound Off' : 'Sound On'}</span>
        </button>
      </div>

      {/* Center-Left Focal Title Lockup over negative space */}
      <div className="max-w-xl my-auto">
        <div
          data-testid="title-logo-trigger"
          onPointerDown={handleLogoPointerDown}
          onPointerUp={clearHoldTimer}
          onPointerCancel={clearHoldTimer}
          onPointerLeave={clearHoldTimer}
          onContextMenu={(e) => e.preventDefault()}
          className="pointer-events-auto inline-block select-none touch-none"
        >
          {/* Custom Inline SVG City Crest Emblem */}
          <svg viewBox="0 0 275 44" className="w-60 h-10 mb-5" aria-hidden="true">
            <rect x="0" y="34" width="265" height="2" fill="#f59e0b" />
            <path
              d="M8 34V18h14v16M26 34V10h16v24M46 34V4h12v30M52 4V0M62 34V14h18v20M84 34V22h14v12"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
            <rect x="49" y="10" width="6" height="4" fill="#f59e0b" />
            <text
              x="108"
              y="26"
              fill="#f59e0b"
              fontSize="11"
              fontWeight="700"
              letterSpacing="3"
              fontFamily="Chakra Petch, sans-serif"
            >
              OPEN WORLD 3D
            </text>
          </svg>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.02] [text-wrap:balance]">
            URBAN LIFE
            <span className="block text-amber-400 mt-1 text-2xl sm:text-3xl md:text-4xl tracking-wide">
              CITY OF FREEDOM
            </span>
          </h1>
        </div>

        <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-md leading-relaxed">
          Explore an open 3D metropolis on foot or behind the wheel—enter buildings, solve study terminal challenges, customize your look, upgrade vehicles in your garage, and explore together in live classroom sessions.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {hasSavedGame && (
            <button
              type="button"
              data-testid="load-saved-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onContinueSaved();
              }}
              className="pointer-events-auto inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-base tracking-wide shadow-lg transition-transform duration-150 hover:bg-emerald-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Continue Saved Game</span>
            </button>
          )}

          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className={`pointer-events-auto inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg font-semibold text-base tracking-wide shadow-lg transition-transform duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 whitespace-nowrap ${
              hasSavedGame
                ? 'bg-slate-800/90 text-white border border-white/20 hover:bg-slate-700'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{hasSavedGame ? 'New Game' : 'Start Game'}</span>
          </button>

          <button
            type="button"
            data-testid="title-session-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSessionModal();
            }}
            className="pointer-events-auto inline-flex items-center gap-2 px-5 py-3.5 rounded-lg bg-slate-900/90 text-sky-300 border border-sky-400/40 font-semibold text-sm sm:text-base tracking-wide shadow-lg transition-colors hover:bg-slate-800 hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-sky-300 whitespace-nowrap"
          >
            <Users className="w-4 h-4" />
            <span>
              {activeSession
                ? `Session: ${activeSession.session.joinCode}`
                : authUser
                  ? 'Join Classroom Session'
                  : 'Sign In / Join Session'}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Safe Margin: Single-line flat control hint */}
      <div className="text-xs sm:text-sm text-slate-300/90 font-medium tracking-wide">
        <span className="hidden sm:inline">
          WASD Move / Drive · E Interact · G Garage · C Style · Space Jump / Brake · Esc Pause
        </span>
        <span className="sm:hidden">
          Touch Controls Move &amp; Drive · Garage &amp; Style · Drag Camera
        </span>
      </div>
    </div>
  );
};
