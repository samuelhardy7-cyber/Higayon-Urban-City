import type { FC } from 'react';
import { ArrowUpDown, Building2, Compass, X } from 'lucide-react';
import type { InteriorElevatorFloor } from '../game/types';

interface ElevatorModalProps {
  buildingName: string;
  currentFloor: number;
  targetFloor: number | null;
  moving: boolean;
  floors: InteriorElevatorFloor[];
  onSelectFloor: (floorNumber: number) => void;
  onClose: () => void;
}

export const ElevatorModal: FC<ElevatorModalProps> = ({
  buildingName,
  currentFloor,
  targetFloor,
  moving,
  floors,
  onSelectFloor,
  onClose,
}) => {
  const orderedFloors = [...floors].sort((a, b) => b.floorNumber - a.floorNumber);
  const topFloorNumber = orderedFloors[0]?.floorNumber ?? floors.length;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(9, 14, 24, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="elevator-panel-title"
      data-testid="elevator-modal"
    >
      <div
        className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-xl border border-white/15 p-5 shadow-2xl space-y-4"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.97)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/45 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Elevator Control
              </div>
              <h2
                id="elevator-panel-title"
                className="font-display text-lg font-bold text-white truncate"
              >
                {buildingName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            data-testid="elevator-close-btn"
            onClick={onClose}
            aria-label="Close elevator floor panel"
            className="w-8 h-8 rounded-lg border border-white/15 bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Cabin Status Strip */}
        <div className="rounded-lg border border-white/10 bg-slate-900/85 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-slate-300">Cabin Floor:</span>
            <span
              data-testid="elevator-current-floor"
              className="font-mono-hud font-bold text-white"
            >
              Floor {currentFloor}
            </span>
          </div>
          <span
            className={`font-mono-hud text-[11px] font-semibold ${
              moving ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {moving && targetFloor ? `Moving → F${targetFloor}` : 'Doors Ready'}
          </span>
        </div>

        {/* Floor Grid (Highest at top, Floor 1 Lobby at bottom) */}
        <div
          className={`grid gap-2 ${
            orderedFloors.length > 6 ? 'grid-cols-4 sm:grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {orderedFloors.map((fl) => {
            const isCurrent = fl.floorNumber === currentFloor;
            const isTarget = fl.floorNumber === targetFloor && moving;
            const isRooftop = fl.floorNumber === topFloorNumber && orderedFloors.length >= 10;

            return (
              <button
                key={fl.floorNumber}
                type="button"
                data-testid={`elevator-floor-btn-${fl.floorNumber}`}
                onClick={() => onSelectFloor(fl.floorNumber)}
                className={`relative rounded-lg border px-2.5 py-2.5 text-left transition-colors ${
                  isCurrent
                    ? 'border-emerald-400 bg-emerald-500/20 text-white'
                    : isTarget
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : isRooftop
                        ? 'border-sky-400/50 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25'
                        : 'border-white/15 bg-slate-900 text-slate-200 hover:border-amber-400/60 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono-hud text-sm font-bold">
                    {fl.floorNumber === 1 ? 'L / 1' : fl.floorNumber}
                  </span>
                  {isRooftop && <Compass className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {isRooftop ? 'Rooftop' : fl.label.replace(/^Floor \d+\s*[·-]?\s*/i, '') || `Floor ${fl.floorNumber}`}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Select a destination floor. Cabin doors lock safely while moving and reopen automatically on arrival.
        </p>
      </div>
    </div>
  );
};
