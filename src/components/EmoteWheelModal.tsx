import type { FC } from 'react';
import { Sparkles, Users, X } from 'lucide-react';
import { EMOTE_WHEEL_OPTIONS, type EmoteKind } from '../game/characterAnimator';
import type { HudSnapshot } from '../game/types';

interface EmoteWheelModalProps {
  animState?: string;
  isSitting?: boolean;
  nearbyPlayers: NonNullable<HudSnapshot['nearbyPlayers']>;
  emoteWheelEnabled: boolean;
  onTriggerEmote: (emote: EmoteKind) => void;
  onToggleSit: () => void;
  onClose: () => void;
}

export const EmoteWheelModal: FC<EmoteWheelModalProps> = ({
  animState,
  isSitting,
  nearbyPlayers,
  emoteWheelEnabled,
  onTriggerEmote,
  onToggleSit,
  onClose,
}) => {
  const nearestPlayer = nearbyPlayers[0] || null;
  const radius = 154;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3"
      style={{ backgroundColor: 'rgba(8, 12, 22, 0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Character Emote Wheel"
      data-testid="emote-wheel-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-white/15 p-4 sm:p-5 shadow-2xl"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.96)' }}
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="font-display text-base font-bold text-white">
              Character Expressions &amp; Emotes
            </h2>
          </div>
          <button
            type="button"
            data-testid="emote-wheel-close"
            onClick={onClose}
            aria-label="Close Emote Wheel"
            className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {nearestPlayer && (
          <div className="mt-3 rounded-lg border border-emerald-400/35 bg-emerald-950/40 px-3 py-2 flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-emerald-200 font-medium truncate">
              <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">
                Nearby: <strong>{nearestPlayer.displayName}</strong> ({nearestPlayer.distance.toFixed(1)}m)
              </span>
            </span>
            <span className="text-[10px] font-mono-hud text-amber-300 shrink-0">
              Handshake / High-Five ready
            </span>
          </div>
        )}

        {!emoteWheelEnabled ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-6 text-center text-xs text-slate-300">
            Emotes are currently paused by your classroom teacher.
          </div>
        ) : (
          <>
            {/* Desktop Radial Wheel */}
            <div className="hidden sm:flex relative mx-auto my-3 w-[404px] h-[380px] items-center justify-center">
              <div className="w-28 h-28 rounded-full border border-amber-400/40 bg-slate-900/95 flex flex-col items-center justify-center text-center p-2 shadow-inner">
                <button
                  type="button"
                  data-testid="emote-wheel-sit"
                  onClick={() => {
                    onToggleSit();
                    onClose();
                  }}
                  className={`w-full h-full rounded-full flex flex-col items-center justify-center text-xs font-bold transition-colors ${
                    isSitting
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-sky-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{isSitting ? 'Stand Up' : 'Sit Down'}</span>
                  <span className="text-[10px] font-normal text-slate-400 mt-0.5">
                    Press B
                  </span>
                </button>
              </div>

              {EMOTE_WHEEL_OPTIONS.map((opt, idx) => {
                const angle = (idx / EMOTE_WHEEL_OPTIONS.length) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const active = animState === opt.animState;
                return (
                  <button
                    key={opt.kind}
                    type="button"
                    data-testid={`wheel-emote-${opt.kind}`}
                    onClick={() => {
                      onTriggerEmote(opt.kind);
                      onClose();
                    }}
                    style={{
                      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
                    }}
                    className={`absolute w-[80px] py-2 px-1 rounded-lg border text-center text-[11px] font-semibold shadow-md transition-colors ${
                      active
                        ? 'border-amber-300 bg-amber-500 text-slate-950'
                        : opt.socialTargeted && nearestPlayer
                          ? 'border-emerald-400/50 bg-slate-900 text-emerald-200 hover:bg-emerald-500/20'
                          : 'border-white/15 bg-slate-900/95 text-white hover:border-amber-400/60 hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Mobile Grid */}
            <div className="grid sm:hidden grid-cols-2 gap-2 mt-4">
              {EMOTE_WHEEL_OPTIONS.map((opt) => {
                const active = animState === opt.animState;
                return (
                  <button
                    key={opt.kind}
                    type="button"
                    onClick={() => {
                      onTriggerEmote(opt.kind);
                      onClose();
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                      active
                        ? 'border-amber-300 bg-amber-500 text-slate-950'
                        : 'border-white/15 bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  onToggleSit();
                  onClose();
                }}
                className="col-span-2 py-2.5 px-3 rounded-lg border border-sky-400/45 bg-sky-500/20 text-xs font-semibold text-sky-200"
              >
                {isSitting ? 'Stand Up' : 'Sit Down'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
