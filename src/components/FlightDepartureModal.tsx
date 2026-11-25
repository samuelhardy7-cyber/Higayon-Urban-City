import type { FC } from 'react';
import { MapPin, Navigation, Plane, X } from 'lucide-react';
import type { CityId } from '../game/types';
import { CITY_LAYOUT } from '../game/worldData';

interface FlightDepartureModalProps {
  originAirportId: string;
  originAirportName: string;
  originAirportCode: string;
  originCityId: CityId;
  originCityName: string;
  onSelectDestination: (destCityId: CityId) => void;
  onClose: () => void;
}

export const FlightDepartureModal: FC<FlightDepartureModalProps> = ({
  originAirportName,
  originAirportCode,
  originCityId,
  originCityName,
  onSelectDestination,
  onClose,
}) => {
  const originAp =
    CITY_LAYOUT.airports.find((a) => a.cityId === originCityId) ?? CITY_LAYOUT.airports[0];

  return (
    <div
      data-testid="flight-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flight-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-slate-950/78"
    >
      <div className="w-full max-w-2xl rounded-xl border border-sky-400/35 bg-slate-900 shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/80 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
              <Plane className="w-5 h-5 text-sky-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-mono-hud uppercase tracking-wider text-sky-300">
                <span>Skyline Air Terminal</span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/35 font-bold">
                  {originAirportCode}
                </span>
              </div>
              <h2
                id="flight-modal-title"
                className="font-display text-base sm:text-lg font-bold text-white truncate"
              >
                {originAirportName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close flight departures"
            className="w-9 h-9 rounded-lg border border-white/15 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Origin status bar */}
        <div className="px-4 py-2.5 sm:px-5 bg-slate-800/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Departing from <strong className="text-white">{originCityName}</strong>
            </span>
          </span>
          <span className="font-mono-hud text-[11px] text-amber-300">
            Free Intercity Charter · Instant Boarding
          </span>
        </div>

        {/* Destination Cities Grid */}
        <div
          className={`p-4 sm:p-5 grid grid-cols-1 gap-3 max-h-[65vh] overflow-y-auto ${
            CITY_LAYOUT.cities.length >= 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
          }`}
        >
          {CITY_LAYOUT.cities.map((city) => {
            const destAp = CITY_LAYOUT.airports.find((a) => a.cityId === city.id);
            const isCurrent = city.id === originCityId;
            const distM = destAp
              ? Math.round(
                  Math.hypot(destAp.centerX - originAp.centerX, destAp.centerZ - originAp.centerZ),
                )
              : 0;

            return (
              <div
                key={city.id}
                className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                  isCurrent
                    ? 'border-emerald-400/40 bg-slate-800/70'
                    : 'border-white/15 bg-slate-800/90 hover:border-sky-400/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-mono-hud font-bold uppercase tracking-wider text-slate-950"
                      style={{ backgroundColor: city.accentColor }}
                    >
                      {destAp?.code ?? city.shortName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono-hud text-slate-400">
                      <Navigation className="w-3 h-3 text-sky-400" />
                      {isCurrent ? 'Here' : `${distM} m`}
                    </span>
                  </div>

                  <h3 className="font-display text-sm sm:text-base font-bold text-white mt-2">
                    {city.name}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{city.tagline}</p>
                  {destAp && (
                    <div className="mt-2 text-[11px] font-mono-hud text-sky-300/90 truncate">
                      {destAp.name}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  data-testid={`fly-to-${city.id}`}
                  onClick={() => onSelectDestination(city.id)}
                  className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-slate-700 hover:bg-slate-600 text-slate-100 border border-white/15'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold'
                  }`}
                >
                  <Plane className="w-3.5 h-3.5" />
                  <span>{isCurrent ? 'Scenic Flight Loop' : 'Board & Fly'}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Tip */}
        <div className="px-4 py-2.5 sm:px-5 border-t border-white/10 bg-slate-950/70 flex items-center justify-between text-[11px] text-slate-400">
          <span>You can also drive or walk across the suspension bridges connecting every city.</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white font-semibold ml-3 shrink-0"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
