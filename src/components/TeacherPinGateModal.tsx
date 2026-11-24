import { useEffect, useState, type FC, type FormEvent } from 'react';
import {
  AlertTriangle,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { AuthUserProfile, TeacherPinStatus } from '../game/multiplayerTypes';
import {
  fetchTeacherPinStatus,
  setupTeacherPin,
  verifyTeacherPin,
} from '../services/multiplayerClient';

interface TeacherPinGateModalProps {
  authUser: User | null;
  authProfile: AuthUserProfile | null;
  authLoading: boolean;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onVerified: (teacherToken: string, expiresAt: number) => void;
  onClose: () => void;
}

export const TeacherPinGateModal: FC<TeacherPinGateModalProps> = ({
  authUser,
  authProfile,
  authLoading,
  onSignInGoogle,
  onSignOut,
  onVerified,
  onClose,
}) => {
  const [pinStatus, setPinStatus] = useState<TeacherPinStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  const isVerifiedTeacher = Boolean(authUser && authProfile?.role === 'teacher');

  useEffect(() => {
    let cancelled = false;
    if (!authUser || !isVerifiedTeacher) {
      setPinStatus(null);
      return;
    }

    setStatusLoading(true);
    setErrorMsg(null);
    void authUser
      .getIdToken()
      .then((token) => fetchTeacherPinStatus(token))
      .then((status) => {
        if (cancelled) return;
        setPinStatus(status);
        setLockCountdown(status.locked ? status.retryAfterSeconds : 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Unable to check PIN status.');
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, isVerifiedTeacher]);

  useEffect(() => {
    if (lockCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) {
          setPinStatus((cur) => (cur ? { ...cur, locked: false, retryAfterSeconds: 0 } : cur));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockCountdown]);

  const handleCreatePin = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser || submitting) return;
    setErrorMsg(null);

    if (!/^\d{6,12}$/.test(pinInput)) {
      setErrorMsg('Teacher PIN must contain 6 to 12 numeric digits.');
      return;
    }
    if (pinInput !== confirmPinInput) {
      setErrorMsg('PIN confirmation does not match.');
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await setupTeacherPin(idToken, pinInput);
      setPinInput('');
      setConfirmPinInput('');
      onVerified(res.teacherToken, res.expiresAt);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPin = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser || submitting) return;
    setErrorMsg(null);

    if (!/^\d{6,12}$/.test(pinInput)) {
      setErrorMsg('Enter your 6 to 12 digit numeric Teacher PIN.');
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await verifyTeacherPin(idToken, pinInput);
      setPinInput('');
      onVerified(res.teacherToken, res.expiresAt);
    } catch (err) {
      const apiErr = err as Error & {
        retryAfterSeconds?: number;
        remainingAttempts?: number;
        locked?: boolean;
      };
      if (apiErr.locked || (apiErr.retryAfterSeconds && apiErr.retryAfterSeconds > 0)) {
        const secs = apiErr.retryAfterSeconds || 60;
        setLockCountdown(secs);
        setPinStatus((cur) =>
          cur
            ? {
                ...cur,
                locked: true,
                retryAfterSeconds: secs,
                remainingAttempts: 0,
              }
            : cur,
        );
      } else if (typeof apiErr.remainingAttempts === 'number') {
        setPinStatus((cur) =>
          cur ? { ...cur, remainingAttempts: apiErr.remainingAttempts ?? cur.remainingAttempts } : cur,
        );
      }
      setErrorMsg(apiErr.message || 'Invalid Teacher PIN.');
      setPinInput('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 14, 24, 0.84)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-pin-gate-title"
      data-testid="teacher-pin-gate-modal"
    >
      <div
        className="w-full max-w-md rounded-xl border border-amber-400/35 p-5 sm:p-6 shadow-2xl space-y-4"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.97)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Protected Access
              </div>
              <h2
                id="teacher-pin-gate-title"
                className="font-display text-lg font-bold text-white"
              >
                Instructor Verification
              </h2>
            </div>
          </div>

          <button
            type="button"
            data-testid="pin-gate-close-btn"
            onClick={onClose}
            aria-label="Close verification"
            className="w-8 h-8 rounded-lg border border-white/15 bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            data-testid="pin-gate-error"
            className="rounded-lg border border-rose-400/45 bg-rose-950/60 px-3 py-2.5 text-xs text-rose-200 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Not signed in */}
        {!authUser && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Sign in with an authorized instructor Google account before entering your 6-digit security PIN.
            </p>
            <button
              type="button"
              disabled={authLoading}
              data-testid="pin-gate-google-signin"
              onClick={() => void onSignInGoogle().catch((e) => setErrorMsg(e instanceof Error ? e.message : 'Sign-in cancelled.'))}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{authLoading ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          </div>
        )}

        {/* Step 1b: Signed in but not authorized teacher */}
        {authUser && authProfile && !isVerifiedTeacher && (
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-400/40 bg-rose-950/40 p-3.5 text-xs text-rose-200 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Access Denied</div>
                <div className="mt-1">
                  Signed in as <span className="font-mono-hud text-amber-300">{authProfile.email}</span> (Student account). Instructor authorization is required to open management tools.
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/15 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch Account</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Return to City
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Verified Teacher Google Account -> PIN setup or PIN entry */}
        {authUser && isVerifiedTeacher && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-400/30 bg-emerald-950/35 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium truncate">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">{authProfile?.email}</span>
              </span>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="text-[11px] text-slate-300 hover:text-white underline shrink-0"
              >
                Sign out
              </button>
            </div>

            {statusLoading || !pinStatus ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Checking security status...
              </div>
            ) : !pinStatus.pinConfigured ? (
              <form onSubmit={handleCreatePin} className="space-y-3">
                <div className="text-xs text-slate-300 leading-relaxed">
                  First-time setup: create a secure numeric Teacher PIN (6 to 12 digits). Your PIN is salted and hashed on the server.
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    New Teacher PIN (6+ digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={12}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    data-testid="pin-setup-input"
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-base tracking-[0.35em] text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Confirm Teacher PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={12}
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    data-testid="pin-setup-confirm-input"
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-base tracking-[0.35em] text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="pin-setup-submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{submitting ? 'Saving PIN...' : 'Create PIN & Unlock'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPin} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Enter Teacher PIN (6+ digits)
                    </label>
                    {lockCountdown > 0 ? (
                      <span className="text-[11px] font-mono-hud text-rose-400 font-semibold">
                        Locked ({lockCountdown}s)
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono-hud text-slate-400">
                        {pinStatus.remainingAttempts} attempts left
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    maxLength={12}
                    disabled={lockCountdown > 0 || submitting}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    data-testid="pin-verify-input"
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-white/15 font-mono-hud text-base tracking-[0.35em] text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={lockCountdown > 0 || submitting}
                  data-testid="pin-verify-submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{submitting ? 'Verifying...' : 'Unlock Instructor Panel'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
