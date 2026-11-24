import type { FC } from 'react';
import type { HudSnapshot } from '../game/types';
import { CITY_LAYOUT } from '../game/worldData';

interface CityMinimapProps {
  playerX: number;
  playerZ: number;
  cameraYaw: number;
  wantedLevel: number;
  activeMission: HudSnapshot['activeMission'];
  availableMissions: HudSnapshot['availableMissions'];
  trafficMarkers: HudSnapshot['trafficMarkers'];
  remotePlayerMarkers?: HudSnapshot['remotePlayerMarkers'];
  selfGroupId?: string | null;
  showGroupMarkers?: boolean;
}

export const CityMinimap: FC<CityMinimapProps> = ({
  playerX,
  playerZ,
  cameraYaw,
  wantedLevel,
  activeMission,
  availableMissions,
  trafficMarkers,
  remotePlayerMarkers = [],
  selfGroupId = null,
  showGroupMarkers = true,
}) => {
  // Uniform scale: X spans [-98..122] (220m), Z spans [-110..110] (220m)
  const mapSpan = 220;
  const toSvgX = (x: number) => ((x + 98) / mapSpan) * 100;
  const toSvgZ = (z: number) => ((z + 110) / mapSpan) * 100;

  const px = toSvgX(playerX);
  const pz = toSvgZ(playerZ);
  // Camera yaw=0 looks along -Z (up on minimap -> 0 deg SVG rotation)
  const deg = (-cameraYaw * 180) / Math.PI;

  return (
    <div
      className="rounded-lg border border-white/15 p-1.5 shadow-md"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
      aria-label="City radar minimap with landmarks and missions"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-20 h-20 sm:w-28 sm:h-28 rounded bg-slate-800 block"
      >
        {/* Bay water on East coast */}
        <rect x={toSvgX(95)} y="0" width={100 - toSvgX(95)} height="100" fill="#174c6b" />

        {/* Harbor Industrial Wharf */}
        <rect
          x={toSvgX(89)}
          y={toSvgZ(-86)}
          width={toSvgX(103.5) - toSvgX(89)}
          height={toSvgZ(-14) - toSvgZ(-86)}
          fill="#64748b"
        />

        {/* Coastal Sandy Beach */}
        <rect
          x={toSvgX(95)}
          y={toSvgZ(-6)}
          width={toSvgX(108.5) - toSvgX(95)}
          height={toSvgZ(94) - toSvgZ(-6)}
          rx="1.2"
          fill="#d9be82"
        />

        {/* Coastal Tourist Pier */}
        <rect
          x={toSvgX(95)}
          y={toSvgZ(39)}
          width={toSvgX(118.5) - toSvgX(95)}
          height={toSvgZ(45) - toSvgZ(39)}
          fill="#b87b48"
        />

        {/* City blocks colored by district */}
        {CITY_LAYOUT.blocks.map((b) => {
          const sizeSvg = (b.size / mapSpan) * 100;
          const xSvg = toSvgX(b.cx) - sizeSvg * 0.5;
          const zSvg = toSvgZ(b.cz) - sizeSvg * 0.5;
          let fill = '#475569';
          if (b.type === 'residential_park') fill = '#2f6b43';
          else if (b.type === 'downtown_tower' || b.type === 'downtown_mall') fill = '#334155';
          else if (b.type === 'downtown_parking') fill = '#475569';
          else if (b.type === 'industrial_factory' || b.type === 'industrial_port') fill = '#524b42';
          else if (b.type === 'coastal_resort' || b.type === 'coastal_restaurants') fill = '#696253';
          else fill = '#57534e';

          return (
            <rect
              key={b.id}
              x={xSvg}
              y={zSvg}
              width={sizeSvg}
              height={sizeSvg}
              rx="1"
              fill={fill}
            />
          );
        })}

        {/* Building footprints */}
        {CITY_LAYOUT.buildings.map((bld) => {
          const w = (bld.width / mapSpan) * 100;
          const d = (bld.depth / mapSpan) * 100;
          return (
            <rect
              key={bld.id}
              x={toSvgX(bld.x) - w * 0.5}
              y={toSvgZ(bld.z) - d * 0.5}
              width={w}
              height={d}
              fill={bld.id === 'freedom_tower' ? '#f59e0b' : '#64748b'}
              opacity={bld.id === 'freedom_tower' ? 0.9 : 0.72}
            />
          );
        })}

        {/* Residential house footprints */}
        {CITY_LAYOUT.houses.map((house) => {
          const w = (house.width / mapSpan) * 100;
          const d = (house.depth / mapSpan) * 100;
          return (
            <rect
              key={house.id}
              x={toSvgX(house.x) - w * 0.5}
              y={toSvgZ(house.z) - d * 0.5}
              width={w}
              height={d}
              fill="#78716c"
              opacity={0.75}
            />
          );
        })}

        {/* Important Location Markers (Landmarks) */}
        {CITY_LAYOUT.landmarks.map((lm) => {
          const lx = toSvgX(lm.x);
          const lz = toSvgZ(lm.z);
          return (
            <g key={lm.id} data-landmark={lm.id}>
              <title>{lm.label}</title>
              <circle
                cx={lx}
                cy={lz}
                r="4.1"
                fill="#0f172a"
                stroke={lm.color}
                strokeWidth="1.15"
              />
              <text
                x={lx}
                y={lz + 1.65}
                textAnchor="middle"
                fill={lm.color}
                fontSize="4.8"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {lm.shortCode}
              </text>
            </g>
          );
        })}

        {/* Available Mission Start Diamonds */}
        {availableMissions.map((m) => {
          const mx = toSvgX(m.x);
          const mz = toSvgZ(m.z);
          return (
            <g key={m.id} data-minimap-mission={m.id}>
              <title>{m.title}</title>
              <polygon
                points={`${mx},${mz - 3.6} ${mx + 3.6},${mz} ${mx},${mz + 3.6} ${mx - 3.6},${mz}`}
                fill={m.color}
                stroke="#0f172a"
                strokeWidth="1"
              />
            </g>
          );
        })}

        {/* Active Mission Target Marker + Route Guide Line */}
        {activeMission && (
          <g data-minimap-target="true">
            <line
              x1={px}
              y1={pz}
              x2={toSvgX(activeMission.targetX)}
              y2={toSvgZ(activeMission.targetZ)}
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeDasharray="2.5 2"
              opacity="0.8"
            />
            <circle
              cx={toSvgX(activeMission.targetX)}
              cy={toSvgZ(activeMission.targetZ)}
              r="4.6"
              fill="#facc15"
              stroke="#0f172a"
              strokeWidth="1.2"
            />
          </g>
        )}

        {/* Police Cruisers (highlighted when Wanted >= 1) */}
        {wantedLevel > 0 &&
          trafficMarkers
            .filter((t) => t.isPolice)
            .map((t, idx) => (
              <circle
                key={`pol_${idx}`}
                cx={toSvgX(t.x)}
                cy={toSvgZ(t.z)}
                r="2.4"
                fill="#ef4444"
                stroke="#38bdf8"
                strokeWidth="1.1"
              />
            ))}

        {/* Connected Multiplayer Classmates */}
        {remotePlayerMarkers.map((rp) => {
          const isGroupMate = Boolean(showGroupMarkers && selfGroupId && rp.groupId === selfGroupId);
          return (
            <g key={rp.playerId} data-minimap-remote={rp.playerId}>
              <title>
                {rp.displayName}
                {isGroupMate ? ' (Group)' : ''}
              </title>
              <circle
                cx={toSvgX(rp.x)}
                cy={toSvgZ(rp.z)}
                r={isGroupMate ? '3.3' : '2.7'}
                fill={isGroupMate ? '#10b981' : '#22d3ee'}
                stroke={isGroupMate ? '#fbbf24' : '#0f172a'}
                strokeWidth={isGroupMate ? '1.25' : '1'}
              />
            </g>
          );
        })}

        {/* Player view cone + marker */}
        <g transform={`translate(${px.toFixed(2)}, ${pz.toFixed(2)}) rotate(${deg.toFixed(1)})`}>
          <path d="M 0 0 L -6 -13 A 14 14 0 0 1 6 -13 Z" fill="rgba(245, 158, 11, 0.34)" />
          <circle cx="0" cy="0" r="3.2" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.2" />
        </g>
      </svg>
    </div>
  );
};
