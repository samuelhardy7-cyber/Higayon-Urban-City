import { useState, type FC, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Radio,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  AuthUserProfile,
  MultiplayerSessionSnapshot,
} from '../game/multiplayerTypes';
import type { HudSnapshot } from '../game/types';

interface StudentSessionModalProps {
  authUser: User | null;
  authProfile: AuthUserProfile | null;
  authLoading: boolean;
  activeSession: MultiplayerSessionSnapshot | null;
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  sessionError: string | null;
  guestDisplayName?: string;
  explorationObjectives?: HudSnapshot['explorationObjectives'];
  onSignInGoogle: () => Promise<void>;
  onSignInEmail?: (email: string, password: string) => Promise<void>;
  onRegisterEmail?: (email: string, password: string, displayName?: string) => Promise<void>;
  onResetPassword?: (email: string) => Promise<void>;
  onResendVerification?: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onUpdateGuestName?: (name: string) => Promise<void>;
  onJoinSession: (joinCode: string) => Promise<void>;
  onLeaveSession: () => void;
  onOpenTeacherMode?: () => void;
  onClose: () => void;
}

function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const StudentSessionModal: FC<StudentSessionModalProps> = ({
  authUser,
  authProfile,
  authLoading,
  activeSession,
  connectionState,
  sessionError,
  guestDisplayName = '',
  explorationObjectives,
  onSignInGoogle,
  onSignInEmail,
  onRegisterEmail,
  onResetPassword,
  onResendVerification,
  onSignOut,
  onUpdateGuestName,
  onJoinSession,
  onLeaveSession,
  onOpenTeacherMode,
  onClose,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [nameInput, setNameInput] = useState(guestDisplayName);
  const [savingName, setSavingName] = useState(false);
  const [joining, setJoining] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [accountNameInput, setAccountNameInput] = useState('');
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const combinedError = localError || sessionError;
  const isOpenWorld = activeSession?.session.joinCode === 'OPEN_WORLD';
  const onlinePlayers = (activeSession?.players || []).filter(
    (p) => p.connectionStatus !== 'offline',
  );

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!onUpdateGuestName) return;
    setSavingName(true);
    try {
      await onUpdateGuestName(nameInput);
    } finally {
      setSavingName(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoNotice(null);
    const cleanedEmail = emailInput.trim();
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setLocalError('Masukkan alamat email yang valid (contoh: siswa@sekolah.sch.id).');
      return;
    }
    if (!passwordInput || (authMode === 'register' && passwordInput.length < 6)) {
      setLocalError(
        authMode === 'register'
          ? 'Kata sandi minimal 6 karakter.'
          : 'Masukkan kata sandi terlebih dahulu.',
      );
      return;
    }
    try {
      if (authMode === 'register') {
        if (!onRegisterEmail) return;
        await onRegisterEmail(cleanedEmail, passwordInput, accountNameInput);
        setInfoNotice('Akun berhasil dibuat! Anda sudah masuk ke sesi Open World.');
      } else {
        if (!onSignInEmail) return;
        await onSignInEmail(cleanedEmail, passwordInput);
      }
      setPasswordInput('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal login menggunakan email.');
    }
  };

  const handleForgotPassword = async () => {
    if (!onResetPassword) return;
    setLocalError(null);
    setInfoNotice(null);
    const cleanedEmail = emailInput.trim();
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setLocalError('Ketik alamat email Anda di kolom email terlebih dahulu untuk reset kata sandi.');
      return;
    }
    try {
      await onResetPassword(cleanedEmail);
      setInfoNotice(`Link reset kata sandi dikirim ke ${cleanedEmail}.`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Tidak dapat mengirim reset kata sandi.');
    }
  };

  const handleJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (!cleaned || cleaned.length < 4) {
      setLocalError('Enter the classroom session join code shared by your teacher.');
      return;
    }
    setLocalError(null);
    setJoining(true);
    try {
      await onJoinSession(cleaned);
      setJoinCode('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to join session.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(9, 14, 24, 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-session-title"
      data-testid="student-session-modal"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-white/15 p-5 sm:p-6 shadow-2xl space-y-4"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.97)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                {isOpenWorld ? 'Real-Time Open World' : 'Classroom Multiplayer'}
              </div>
              <h2
                id="student-session-title"
                className="font-display text-lg sm:text-xl font-bold text-white"
              >
                {activeSession ? activeSession.session.name : 'Multiplayer & Account'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            data-testid="session-modal-close"
            onClick={onClose}
            aria-label="Close session panel"
            className="w-8 h-8 rounded-lg border border-white/15 bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {combinedError && (
          <div
            data-testid="session-modal-error"
            className="rounded-lg border border-rose-400/45 bg-rose-950/60 px-3 py-2.5 text-xs text-rose-200 space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{combinedError}</span>
            </div>
            {(combinedError.toLowerCase().includes('domain') ||
              combinedError.toLowerCase().includes('google') ||
              combinedError.toLowerCase().includes('popup')) && (
              <div className="pl-6 text-[11px] text-amber-200">
                Tip: Login menggunakan tab <strong>Sign In with Email</strong> atau <strong>Create Account</strong> di bawah berfungsi langsung tanpa pembatasan domain.
              </div>
            )}
          </div>
        )}

        {infoNotice && (
          <div
            data-testid="session-modal-notice"
            className="rounded-lg border border-emerald-400/45 bg-emerald-950/60 px-3 py-2.5 text-xs text-emerald-200 flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{infoNotice}</span>
          </div>
        )}

        {/* Account Section */}
        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3.5 space-y-3">
          {!authUser ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-white">Playing in Open World City</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Sign in with Email or Google to save Knowledge Points and join Classroom Sessions.
                  </div>
                </div>
              </div>

              {(onSignInEmail || onRegisterEmail) && (
                <form onSubmit={handleEmailSubmit} className="space-y-2.5 pt-2 border-t border-white/10">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      data-testid="auth-tab-signin"
                      onClick={() => {
                        setAuthMode('signin');
                        setLocalError(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        authMode === 'signin'
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Sign In with Email
                    </button>
                    <button
                      type="button"
                      data-testid="auth-tab-register"
                      onClick={() => {
                        setAuthMode('register');
                        setLocalError(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        authMode === 'register'
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  {authMode === 'register' && (
                    <input
                      type="text"
                      maxLength={32}
                      value={accountNameInput}
                      onChange={(e) => setAccountNameInput(e.target.value)}
                      data-testid="auth-name-input"
                      placeholder="Display Name (optional)"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="email"
                      autoComplete="email"
                      value={emailInput}
                      onChange={(e) => {
                        setLocalError(null);
                        setEmailInput(e.target.value);
                      }}
                      data-testid="auth-email-input"
                      placeholder="Email address"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                    />
                    <input
                      type="password"
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      value={passwordInput}
                      onChange={(e) => {
                        setLocalError(null);
                        setPasswordInput(e.target.value);
                      }}
                      data-testid="auth-password-input"
                      placeholder={authMode === 'register' ? 'Password (min 6 chars)' : 'Password'}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {authMode === 'signin' && onResetPassword ? (
                      <button
                        type="button"
                        data-testid="auth-reset-btn"
                        disabled={authLoading}
                        onClick={() => void handleForgotPassword()}
                        className="text-[11px] text-sky-300 hover:text-sky-200 underline disabled:opacity-50"
                      >
                        Forgot password?
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Min. 6 characters</span>
                    )}
                    <button
                      type="submit"
                      disabled={authLoading}
                      data-testid="auth-email-submit"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400 transition-colors disabled:opacity-60"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>
                        {authLoading
                          ? 'Processing...'
                          : authMode === 'register'
                            ? 'Register Email'
                            : 'Login Email'}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              <div className="flex items-center gap-2 pt-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-wider text-slate-400">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                disabled={authLoading}
                data-testid="session-google-signin"
                onClick={() => {
                  setLocalError(null);
                  setInfoNotice(null);
                  void onSignInGoogle().catch((e) =>
                    setLocalError(e instanceof Error ? e.message : 'Sign-in cancelled.'),
                  );
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors disabled:opacity-60"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{authLoading ? 'Signing in...' : 'Continue with Google'}</span>
              </button>

              {onUpdateGuestName && (
                <form onSubmit={handleSaveName} className="flex gap-2 pt-2 border-t border-white/10">
                  <input
                    type="text"
                    maxLength={22}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    data-testid="guest-name-input"
                    placeholder="Guest Player Name (e.g. Alex)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="submit"
                    disabled={savingName}
                    data-testid="guest-name-save"
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 border border-white/15 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors shrink-0"
                  >
                    {savingName ? 'Saving...' : 'Set Name'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {authProfile?.displayName || authUser.displayName || authUser.email}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {authProfile?.email || authUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="session-google-signout"
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
              {!authUser.emailVerified && onResendVerification && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-950/35 px-2.5 py-1.5 text-[11px] text-amber-200">
                  <span>Email verification optional for students; required for Teacher Mode.</span>
                  <button
                    type="button"
                    data-testid="resend-verification-btn"
                    onClick={() => {
                      setLocalError(null);
                      void onResendVerification()
                        .then(() => setInfoNotice('Verification email sent. Check your inbox.'))
                        .catch((e) => setLocalError(e instanceof Error ? e.message : 'Unable to send email.'));
                    }}
                    className="text-amber-300 font-semibold underline shrink-0"
                  >
                    Resend
                  </button>
                </div>
              )}
            </div>
          )}

          {onOpenTeacherMode && (
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
              <div className="text-[11px] text-slate-400">
                Instructor tools (Questions &amp; Locations)
              </div>
              <button
                type="button"
                data-testid="session-teacher-btn"
                onClick={onOpenTeacherMode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors shrink-0"
              >
                <Lock className="w-3 h-3" />
                <span>Teacher Mode</span>
              </button>
            </div>
          )}
        </div>

        {/* Classroom Join Code Form (available whenever signed in and not already inside a private classroom session) */}
        {authUser && (!activeSession || isOpenWorld) && (
          <form onSubmit={handleJoinSubmit} className="space-y-2.5 rounded-xl border border-white/10 bg-slate-900/60 p-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Join Private Classroom Session (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={10}
                  value={joinCode}
                  onChange={(e) => {
                    setLocalError(null);
                    setJoinCode(e.target.value.toUpperCase());
                  }}
                  data-testid="session-join-code-input"
                  placeholder="e.g. URB482"
                  className="flex-1 px-3.5 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-sm uppercase tracking-widest text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={joining}
                  data-testid="session-join-submit"
                  className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs sm:text-sm hover:bg-sky-400 transition-colors disabled:opacity-60 shrink-0"
                >
                  {joining ? 'Joining...' : 'Join Class'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Active Live Roster (for Open World OR Classroom Session) */}
        {activeSession && (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-sky-400/35 bg-sky-950/25 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono-hud text-xs font-bold px-2 py-0.5 rounded bg-slate-900 border border-white/15 text-amber-300">
                    {activeSession.session.joinCode}
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    {activeSession.session.subject}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                    connectionState === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : connectionState === 'reconnecting'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                  }`}
                >
                  {connectionState === 'connected' ? (
                    <Wifi className="w-3 h-3" />
                  ) : (
                    <WifiOff className="w-3 h-3" />
                  )}
                  <span>{connectionState}</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <div className="rounded-lg bg-slate-900/75 px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">Status</div>
                  <div className="font-semibold text-white capitalize mt-0.5 inline-flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400" />
                    {activeSession.session.status}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-900/75 px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">{isOpenWorld ? 'World' : 'Timer'}</div>
                  <div className="font-mono-hud font-semibold text-amber-300 mt-0.5 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {isOpenWorld ? '4 Cities' : formatRemaining(activeSession.session.remainingSeconds)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-900/75 px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">Online</div>
                  <div className="font-mono-hud font-semibold text-emerald-300 mt-0.5">
                    {activeSession.onlineCount}/{activeSession.session.maxPlayers}
                  </div>
                </div>
              </div>

              {activeSession.session.objectives && (
                <div className="text-xs text-slate-300 border-t border-white/10 pt-2">
                  <span className="font-semibold text-sky-300">Goal: </span>
                  {activeSession.session.objectives}
                </div>
              )}
            </div>

            {/* Connected Roster */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Players Online Right Now ({onlinePlayers.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {onlinePlayers.map((p) => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            p.connectionStatus === 'online'
                              ? 'bg-emerald-400'
                              : p.connectionStatus === 'reconnecting'
                                ? 'bg-amber-400'
                                : 'bg-slate-500'
                          }`}
                        />
                        <span className="truncate">{p.displayName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate inline-flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
                        <span>
                          {p.currentBuilding
                            ? `${p.currentBuilding} (F${p.currentFloor})`
                            : p.currentActivity}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono-hud shrink-0">
                      <div className="text-emerald-300 font-semibold">{p.pointsEarned} pts</div>
                      <div className="text-[10px] text-slate-400">{p.questionsCompleted} Qs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {!isOpenWorld ? (
                <button
                  type="button"
                  data-testid="session-leave-btn"
                  onClick={onLeaveSession}
                  className="px-4 py-2 rounded-lg border border-rose-400/40 bg-rose-500/15 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition-colors"
                >
                  Return to Open World
                </button>
              ) : (
                <span className="text-[11px] text-emerald-300 font-medium">
                  Real-time sync active
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors"
              >
                Back to City
              </button>
            </div>
          </div>
        )}

        {/* City Exploration Quests Summary */}
        {explorationObjectives && explorationObjectives.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-slate-900/75 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              <span>Exploration Objectives</span>
              <span className="font-mono-hud">
                {explorationObjectives.filter((o) => o.completed).length}/{explorationObjectives.length}
              </span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {explorationObjectives.map((obj) => (
                <div
                  key={obj.id}
                  className="flex items-center justify-between gap-2 text-xs rounded-lg bg-slate-950/70 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <div
                      className={`font-semibold truncate ${
                        obj.completed ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      {obj.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{obj.description}</div>
                  </div>
                  <div className="font-mono-hud text-[11px] text-sky-300 shrink-0">
                    {Math.min(obj.current, obj.target)}/{obj.target}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
