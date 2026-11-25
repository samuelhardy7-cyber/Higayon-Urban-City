import { useState, type FC } from 'react';
import { Car, Check, Gauge, Shield, Sparkles, Trophy, Wrench, X } from 'lucide-react';
import {
  GARAGE_CATALOG,
  UPGRADE_SLOT_INFO,
  VEHICLE_PAINT_SWATCHES,
} from '../game/progressionSystem';
import type {
  ChallengeStatus,
  ProgressionState,
  VehicleKind,
  VehicleUpgradeLevels,
} from '../game/types';

interface GarageModalProps {
  money: number;
  progression: ProgressionState;
  challenges: ChallengeStatus[];
  onClose: () => void;
  onBuyOrSelectVehicle: (kind: VehicleKind) => void;
  onSelectPaint: (kind: VehicleKind, hex: number) => void;
  onBuyUpgrade: (kind: VehicleKind, slot: keyof VehicleUpgradeLevels) => void;
  onDeliverVehicle: () => void;
}

export const GarageModal: FC<GarageModalProps> = ({
  money,
  progression,
  challenges,
  onClose,
  onBuyOrSelectVehicle,
  onSelectPaint,
  onBuyUpgrade,
  onDeliverVehicle,
}) => {
  const [tab, setTab] = useState<'garage' | 'challenges'>('garage');
  const [inspectedKind, setInspectedKind] = useState<VehicleKind>(
    progression.activeGarageVehicle,
  );

  const selectedItem =
    GARAGE_CATALOG.find((g) => g.kind === inspectedKind) || GARAGE_CATALOG[0];
  const isOwned = progression.ownedVehicles.includes(inspectedKind);
  const isActive = progression.activeGarageVehicle === inspectedKind;
  const upgrades = progression.vehicleUpgrades[inspectedKind] || { engine: 0, handling: 0, chassis: 0 };
  const currentPaint = progression.vehicleColors[inspectedKind] ?? selectedItem.defaultColor;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(9, 14, 24, 0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-label="City Garage and Challenges"
      data-testid="garage-modal"
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-white/15 shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.96)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-400">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
                City Garage &amp; Challenges
              </h2>
              <div className="text-xs text-slate-400">
                Cash:{' '}
                <span data-testid="garage-money" className="font-mono-hud text-emerald-400 font-semibold">
                  ${money}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-white/10 p-0.5 bg-slate-900/80">
              <button
                type="button"
                onClick={() => setTab('garage')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  tab === 'garage' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Vehicles
              </button>
              <button
                type="button"
                data-testid="garage-tab-challenges"
                onClick={() => setTab('challenges')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  tab === 'challenges' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Challenges
              </button>
            </div>

            <button
              type="button"
              data-testid="garage-close"
              onClick={onClose}
              aria-label="Close Garage"
              className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'garage' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Vehicle List */}
              <div className="md:col-span-5 flex flex-col gap-2">
                {GARAGE_CATALOG.map((item) => {
                  const owned = progression.ownedVehicles.includes(item.kind);
                  const active = progression.activeGarageVehicle === item.kind;
                  const selected = inspectedKind === item.kind;
                  return (
                    <button
                      key={item.kind}
                      type="button"
                      data-testid={`garage-vehicle-${item.kind}`}
                      onClick={() => setInspectedKind(item.kind)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        selected
                          ? 'border-amber-400 bg-slate-800/90'
                          : 'border-white/10 bg-slate-900/60 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-white">
                          {item.name}
                        </span>
                        {active ? (
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                            Active
                          </span>
                        ) : owned ? (
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                            Owned
                          </span>
                        ) : (
                          <span className="font-mono-hud text-xs font-semibold text-amber-400">
                            ${item.price}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {item.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Vehicle Specs, Paint & Upgrades */}
              <div className="md:col-span-7 flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-900/65 p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-white">
                      {selectedItem.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedItem.description}</p>
                  </div>
                </div>

                {/* Stat Bars */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {[
                    { label: 'Top Speed', val: Math.min(100, selectedItem.topSpeedRating + upgrades.engine * 6) },
                    { label: 'Accel', val: Math.min(100, selectedItem.accelRating + upgrades.engine * 6) },
                    { label: 'Handling', val: Math.min(100, selectedItem.handlingRating + upgrades.handling * 5) },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="flex justify-between text-[10px] text-slate-300">
                        <span>{s.label}</span>
                        <span className="font-mono-hud">{s.val}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all duration-200"
                          style={{ width: `${s.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Primary Action: Buy / Select + Deliver */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {!isOwned ? (
                    <button
                      type="button"
                      data-testid={`garage-buy-${inspectedKind}`}
                      disabled={money < selectedItem.price}
                      onClick={() => onBuyOrSelectVehicle(inspectedKind)}
                      className={`flex-1 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                        money >= selectedItem.price
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/10'
                      }`}
                    >
                      Buy {selectedItem.name} (${selectedItem.price})
                    </button>
                  ) : (
                    <>
                      {!isActive && (
                        <button
                          type="button"
                          data-testid={`garage-equip-${inspectedKind}`}
                          onClick={() => onBuyOrSelectVehicle(inspectedKind)}
                          className="flex-1 px-3 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs sm:text-sm hover:bg-sky-400 transition-colors"
                        >
                          Set Active Vehicle
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="garage-deliver-btn"
                        onClick={() => {
                          if (!isActive) onBuyOrSelectVehicle(inspectedKind);
                          onDeliverVehicle();
                          onClose();
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs sm:text-sm hover:bg-emerald-400 transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Deliver Nearby &amp; Drive</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Paint Swatches */}
                {isOwned && (
                  <div className="border-t border-white/10 pt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Paint Color
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {VEHICLE_PAINT_SWATCHES.map((sw) => {
                        const selected = currentPaint === sw.hex;
                        return (
                          <button
                            key={sw.hex}
                            type="button"
                            aria-label={`Paint ${sw.label}`}
                            onClick={() => onSelectPaint(inspectedKind, sw.hex)}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform ${
                              selected ? 'border-white scale-110' : 'border-white/25 hover:scale-105'
                            }`}
                            style={{ backgroundColor: sw.css }}
                          >
                            {selected && <Check className="w-3.5 h-3.5 text-slate-950 drop-shadow" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Performance Upgrades */}
                {isOwned && (
                  <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                      Performance Upgrades
                    </div>
                    {(
                      [
                        { slot: 'engine' as const, icon: Gauge },
                        { slot: 'handling' as const, icon: Wrench },
                        { slot: 'chassis' as const, icon: Shield },
                      ] as const
                    ).map(({ slot, icon: Icon }) => {
                      const info = UPGRADE_SLOT_INFO[slot];
                      const lvl = upgrades[slot];
                      const nextCost = lvl < 3 ? info.costs[lvl] : null;
                      const canAfford = nextCost !== null && money >= nextCost;
                      return (
                        <div
                          key={slot}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white flex items-center gap-2">
                                <span>{info.label}</span>
                                <span className="font-mono-hud text-[10px] text-amber-300">
                                  Lv {lvl}/3
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {info.description}
                              </div>
                            </div>
                          </div>

                          {nextCost !== null ? (
                            <button
                              type="button"
                              data-testid={`upgrade-${slot}`}
                              disabled={!canAfford}
                              onClick={() => onBuyUpgrade(inspectedKind, slot)}
                              className={`shrink-0 px-2.5 py-1.5 rounded-md font-mono-hud text-[11px] font-semibold transition-colors ${
                                canAfford
                                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              ${nextCost}
                            </button>
                          ) : (
                            <span className="shrink-0 text-[10px] font-semibold text-emerald-400 px-2">
                              MAX
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Challenges Tab */
            <div className="flex flex-col gap-2.5">
              {challenges.map((ch) => {
                const pct = Math.min(100, Math.round((ch.progress / Math.max(1, ch.target)) * 100));
                return (
                  <div
                    key={ch.id}
                    className={`rounded-lg border p-3.5 ${
                      ch.completed
                        ? 'border-emerald-400/40 bg-emerald-950/20'
                        : 'border-white/10 bg-slate-900/65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Trophy
                          className={`w-4 h-4 ${
                            ch.completed ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        />
                        <span className="font-display text-sm font-bold text-white">
                          {ch.title}
                        </span>
                      </div>
                      <span
                        className={`font-mono-hud text-xs font-semibold ${
                          ch.completed ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {ch.completed ? 'COMPLETED' : `+$${ch.reward}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{ch.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            ch.completed ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono-hud text-[11px] text-slate-300 shrink-0">
                        {ch.progress}/{ch.target} {ch.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
