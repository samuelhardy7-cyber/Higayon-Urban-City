import { useRef, useState, type FC, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import {
  Camera,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { PhotoFilterId, PhotoModeState, PhotoPoseId } from '../game/types';

interface PhotoModeOverlayProps {
  photoState: PhotoModeState;
  capturedDataUrl: string | null;
  onPatch: (patch: Partial<PhotoModeState>) => void;
  onCapture: () => void;
  onClearCapture: () => void;
  onClose: () => void;
}

const PHOTO_POSES: Array<{ id: PhotoPoseId; label: string }> = [
  { id: 'photo_cool', label: 'Cool' },
  { id: 'photo_hero', label: 'Hero' },
  { id: 'photo_peace', label: 'Peace' },
  { id: 'photo_victory', label: 'Victory' },
  { id: 'photo_scholar', label: 'Scholar' },
  { id: 'photo_parkour', label: 'Parkour' },
  { id: 'wave', label: 'Wave' },
  { id: 'sit', label: 'Chill' },
];

const PHOTO_FILTERS: Array<{ id: PhotoFilterId; label: string }> = [
  { id: 'natural', label: 'Natural' },
  { id: 'golden', label: 'Golden' },
  { id: 'cinema', label: 'Cinema' },
  { id: 'vivid', label: 'Vivid' },
];

export const PhotoModeOverlay: FC<PhotoModeOverlayProps> = ({
  photoState,
  capturedDataUrl,
  onPatch,
  onCapture,
  onClearCapture,
  onClose,
}) => {
  const [dragging, setDragging] = useState(false);
  const lastPtr = useRef<{ x: number; y: number } | null>(null);

  const handleOrbitDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (capturedDataUrl) return;
    setDragging(true);
    lastPtr.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleOrbitMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !lastPtr.current) return;
    const dx = e.clientX - lastPtr.current.x;
    const dy = e.clientY - lastPtr.current.y;
    lastPtr.current = { x: e.clientX, y: e.clientY };
    onPatch({
      orbitYaw: photoState.orbitYaw - dx * 0.009,
      orbitPitch: Math.max(-0.42, Math.min(0.88, photoState.orbitPitch + dy * 0.0065)),
    });
  };

  const handleOrbitUp = () => {
    setDragging(false);
    lastPtr.current = null;
  };

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (capturedDataUrl) return;
    const nextDist = Math.max(2.1, Math.min(11.5, photoState.distance + e.deltaY * 0.004));
    onPatch({ distance: nextDist });
  };

  return (
    <div
      data-testid="photo-mode-overlay"
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none"
    >
      {/* Full-screen Drag-to-Orbit Viewport Layer */}
      <div
        data-testid="photo-orbit-pad"
        onPointerDown={handleOrbitDown}
        onPointerMove={handleOrbitMove}
        onPointerUp={handleOrbitUp}
        onPointerCancel={handleOrbitUp}
        onWheel={handleWheel}
        className={`absolute inset-0 pointer-events-auto touch-none ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        aria-label="Drag to orbit camera 360 degrees"
      />

      {/* Top Studio Header Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2 pointer-events-none">
        {!photoState.hideUi ? (
          <div
            className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-amber-400/45 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
          >
            <Camera className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-display tracking-wide">PHOTO STUDIO</span>
            <span className="hidden sm:inline text-[11px] text-slate-300 font-normal">
              Drag 360° · Scroll Zoom · Live City
            </span>
          </div>
        ) : (
          <div />
        )}

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            data-testid="photo-hide-hud-btn"
            onClick={() => onPatch({ hideUi: !photoState.hideUi })}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/20 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
            title="Toggle Controls (H)"
          >
            {photoState.hideUi ? (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Show UI</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Clean Frame</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="photo-close-btn"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/20 text-xs font-semibold text-white hover:bg-rose-600/80 transition-colors"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
            title="Exit Photo Mode (V / Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Captured Snapshot Modal Preview */}
      {capturedDataUrl && (
        <div className="relative z-20 flex items-center justify-center pointer-events-auto px-2">
          <div
            data-testid="photo-preview-card"
            className="w-full max-w-md rounded-xl border border-amber-400/50 p-3 sm:p-4 shadow-2xl"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.96)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-display font-bold text-white">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Snapshot Captured
              </span>
              <button
                type="button"
                onClick={onClearCapture}
                className="p-1 rounded hover:bg-slate-800 text-slate-300"
                aria-label="Dismiss preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-lg overflow-hidden border border-white/15 bg-slate-950">
              <img
                src={capturedDataUrl}
                alt="Urban Life Photo Mode snapshot"
                className="w-full max-h-[46vh] object-contain"
              />
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClearCapture}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retake
              </button>
              <a
                href={capturedDataUrl}
                download={`urban-life-${Date.now()}.png`}
                data-testid="photo-download-link"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download PNG
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Controls Dock */}
      {!photoState.hideUi && (
        <div className="relative z-10 flex justify-center pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-2xl rounded-xl border border-white/15 p-2.5 sm:p-3.5 shadow-xl space-y-2.5"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
          >
            {/* Pose Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 shrink-0 mr-1">
                Pose
              </span>
              {PHOTO_POSES.map((p) => {
                const active = photoState.pose === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`photo-pose-${p.id}`}
                    onClick={() => onPatch({ pose: p.id })}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Framing Sliders + Filter + Capture */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-200">
              <label className="flex flex-col gap-0.5">
                <span className="flex justify-between text-[10px] text-slate-400">
                  <span>Zoom</span>
                  <span className="font-mono-hud text-slate-200">{photoState.distance.toFixed(1)}m</span>
                </span>
                <input
                  type="range"
                  min={2.2}
                  max={11.0}
                  step={0.2}
                  value={photoState.distance}
                  onChange={(e) => onPatch({ distance: Number(e.target.value) })}
                  className="accent-amber-400 cursor-pointer"
                />
              </label>

              <label className="flex flex-col gap-0.5">
                <span className="flex justify-between text-[10px] text-slate-400">
                  <span>Height</span>
                  <span className="font-mono-hud text-slate-200">{photoState.panY.toFixed(1)}m</span>
                </span>
                <input
                  type="range"
                  min={-0.6}
                  max={1.4}
                  step={0.05}
                  value={photoState.panY}
                  onChange={(e) => onPatch({ panY: Number(e.target.value) })}
                  className="accent-amber-400 cursor-pointer"
                />
              </label>

              <label className="flex flex-col gap-0.5">
                <span className="flex justify-between text-[10px] text-slate-400">
                  <span>FOV</span>
                  <span className="font-mono-hud text-slate-200">{Math.round(photoState.fov)}°</span>
                </span>
                <input
                  type="range"
                  min={32}
                  max={82}
                  step={1}
                  value={photoState.fov}
                  onChange={(e) => onPatch({ fov: Number(e.target.value) })}
                  className="accent-amber-400 cursor-pointer"
                />
              </label>

              <div className="flex items-end justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onPatch({
                      orbitYaw: Math.PI - 0.42,
                      orbitPitch: 0.14,
                      distance: 3.6,
                      fov: 54,
                      panY: 0.12,
                      filter: 'natural',
                    })
                  }
                  className="px-2 py-1.5 rounded-lg border border-white/15 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
                  title="Reset camera angle"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  data-testid="photo-capture-btn"
                  onClick={onCapture}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Snap</span>
                </button>
              </div>
            </div>

            {/* Color Grade Filters */}
            <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-white/10">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 shrink-0 mr-1">
                  Tone
                </span>
                {PHOTO_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    data-testid={`photo-filter-${f.id}`}
                    onClick={() => onPatch({ filter: f.id })}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      photoState.filter === f.id
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="hidden sm:inline text-[10px] text-slate-400">
                World stays live while you pose
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
