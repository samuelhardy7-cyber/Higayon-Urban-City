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
  // Player-centered 220m x 220m open-world radar across all 3 cities, bridges & airports
  const mapSpan = 220;
  const halfSpan = mapSpan * 0.5;
  const minX = playerX - halfSpan;
  const minZ = playerZ - halfSpan;
  const toSvgX = (x: number) => ((x - minX) / mapSpan) * 100;
  const toSvgZ = (z: number) => ((z - minZ) / mapSpan) * 100;
  const toSvgLen = (len: number) => (len / mapSpan) * 100;

  // Player stays centered on the radar (50, 50)
  const px = 50;
  const pz = 50;
  // Camera yaw=0 looks along -Z (up on minimap -> 0 deg SVG rotation)
  const deg = (-cameraYaw * 180) / Math.PI;

  const isInRadar = (sx: number, sy: number, pad = 2) =>
    sx >= -pad && sx <= 100 + pad && sy >= -pad && sy <= 100 + pad;

  const activeTargetSvg = activeMission
    ? {
        x: toSvgX(activeMission.targetX),
        y: toSvgZ(activeMission.targetZ),
      }
    : null;

  const offRadarMissionEdge = (() => {
    if (!activeTargetSvg || isInRadar(activeTargetSvg.x, activeTargetSvg.y, -4)) {
      return null;
    }
    const dx = activeTargetSvg.x - px;
    const dy = activeTargetSvg.y - pz;
    const dist = Math.hypot(dx, dy) || 1;
    const edgeRadius = 45;
    return {
      x: px + (dx / dist) * edgeRadius,
      y: pz + (dy / dist) * edgeRadius,
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
    };
  })();

  return (
    <div
      className="rounded-lg border border-white/15 p-1.5 shadow-md"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
      aria-label="Open-world radar minimap with cities, bridges, airports, and missions"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-20 h-20 sm:w-28 sm:h-28 rounded bg-[#174c6b] block"
      >
        <defs>
          <clipPath id="openworld-radar-clip">
            <rect x="0" y="0" width="100" height="100" rx="2" />
          </clipPath>
        </defs>

        <g clipPath="url(#openworld-radar-clip)">
          {/* Surrounding bay ocean */}
          <rect x="0" y="0" width="100" height="100" fill="#174c6b" />

          {/* City Island Foundations & Road Grids */}
          {CITY_LAYOUT.cities.map((city) => {
            const x1 = toSvgX(city.landMinX);
            const z1 = toSvgZ(city.landMinZ);
            const w = toSvgLen(city.landMaxX - city.landMinX);
            const h = toSvgLen(city.landMaxZ - city.landMinZ);
            const roadW = toSvgLen(CITY_LAYOUT.roadWidth);
            return (
              <g key={city.id}>
                <rect
                  x={x1}
                  y={z1}
                  width={w}
                  height={h}
                  rx="1.8"
                  fill="#233043"
                  stroke="#64748b"
                  strokeWidth="0.6"
                />
                {city.roadCentersX.map((rx) => (
                  <rect
                    key={`rx_${city.id}_${rx}`}
                    x={toSvgX(rx) - roadW * 0.5}
                    y={z1}
                    width={roadW}
                    height={h}
                    fill="#1e293b"
                  />
                ))}
                {city.roadCentersZ.map((rz) => (
                  <rect
                    key={`rz_${city.id}_${rz}`}
                    x={x1}
                    y={toSvgZ(rz) - roadW * 0.5}
                    width={w}
                    height={roadW}
                    fill="#1e293b"
                  />
                ))}
              </g>
            );
          })}

          {/* Airports: aprons, connector roads & runways */}
          {CITY_LAYOUT.airports.map((ap) => {
            const ax = toSvgX(ap.apronMinX);
            const az = toSvgZ(ap.apronMinZ);
            const aw = toSvgLen(ap.apronMaxX - ap.apronMinX);
            const ah = toSvgLen(ap.apronMaxZ - ap.apronMinZ);
            const r1x = toSvgX(ap.runwayStartX);
            const r2x = toSvgX(ap.runwayEndX);
            const rz = toSvgZ(ap.runwayZ);
            return (
              <g key={ap.id}>
                {ap.connectorRects.map((rect, idx) => (
                  <rect
                    key={`conn_${ap.id}_${idx}`}
                    x={toSvgX(rect.minX)}
                    y={toSvgZ(rect.minZ)}
                    width={toSvgLen(rect.maxX - rect.minX)}
                    height={toSvgLen(rect.maxZ - rect.minZ)}
                    fill="#334155"
                  />
                ))}
                <rect
                  x={ax}
                  y={az}
                  width={aw}
                  height={ah}
                  rx="1.2"
                  fill="#334155"
                  stroke="#94a3b8"
                  strokeWidth="0.5"
                />
                <line
                  x1={r1x}
                  y1={rz}
                  x2={r2x}
                  y2={rz}
                  stroke="#0f172a"
                  strokeWidth="2.8"
                />
                <line
                  x1={r1x}
                  y1={rz}
                  x2={r2x}
                  y2={rz}
                  stroke="#e2e8f0"
                  strokeWidth="0.6"
                  strokeDasharray="2 1.6"
                />
              </g>
            );
          })}

          {/* Intercity Suspension Bridges */}
          {CITY_LAYOUT.bridges.map((br) => {
            const totalW = br.roadWidth + br.sidewalkWidth * 2;
            if (br.axis === 'x') {
              return (
                <g key={br.id}>
                  <rect
                    x={toSvgX(br.start)}
                    y={toSvgZ(br.crossCenter - totalW * 0.5)}
                    width={toSvgLen(br.end - br.start)}
                    height={toSvgLen(totalW)}
                    fill="#475569"
                    stroke="#cbd5e1"
                    strokeWidth="0.45"
                  />
                  {br.towerPositions.map((tx) => (
                    <circle
                      key={`bt_${br.id}_${tx}`}
                      cx={toSvgX(tx)}
                      cy={toSvgZ(br.crossCenter)}
                      r="1.3"
                      fill="#f59e0b"
                    />
                  ))}
                </g>
              );
            }
            return (
              <g key={br.id}>
                <rect
                  x={toSvgX(br.crossCenter - totalW * 0.5)}
                  y={toSvgZ(br.start)}
                  width={toSvgLen(totalW)}
                  height={toSvgLen(br.end - br.start)}
                  fill="#475569"
                  stroke="#cbd5e1"
                  strokeWidth="0.45"
                />
                {br.towerPositions.map((tz) => (
                  <circle
                    key={`bt_${br.id}_${tz}`}
                    cx={toSvgX(br.crossCenter)}
                    cy={toSvgZ(tz)}
                    r="1.3"
                    fill="#f59e0b"
                  />
                ))}
              </g>
            );
          })}

          {/* City 1 East Coast Wharf, Beach (split around East Bridge), & Tourist Pier */}
          <rect
            x={toSvgX(89)}
            y={toSvgZ(-86)}
            width={toSvgLen(14.5)}
            height={toSvgLen(72)}
            fill="#64748b"
          />
          <rect
            x={toSvgX(95)}
            y={toSvgZ(8)}
            width={toSvgLen(13.5)}
            height={toSvgLen(86)}
            rx="1.2"
            fill="#d9be82"
          />
          <rect
            x={toSvgX(95)}
            y={toSvgZ(39)}
            width={toSvgLen(23.5)}
            height={toSvgLen(6)}
            fill="#b87b48"
          />

          {/* City blocks colored by district */}
          {CITY_LAYOUT.blocks.map((b) => {
            const sizeSvg = toSvgLen(b.size);
            const xSvg = toSvgX(b.cx) - sizeSvg * 0.5;
            const zSvg = toSvgZ(b.cz) - sizeSvg * 0.5;
            let fill = '#475569';
            if (b.type === 'residential_park' || b.type === 'highland_campus') fill = '#2f6b43';
            else if (b.type === 'downtown_tower' || b.type === 'downtown_mall') fill = '#334155';
            else if (b.type === 'downtown_parking') fill = '#475569';
            else if (b.type === 'industrial_factory' || b.type === 'industrial_port') fill = '#524b42';
            else if (b.type === 'coastal_resort' || b.type === 'coastal_restaurants') fill = '#696253';
            else if (b.type === 'bay_marina') fill = '#1e5266';
            else if (b.type === 'golden_promenade') fill = '#715636';
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
            const w = toSvgLen(bld.width);
            const d = toSvgLen(bld.depth);
            const isMajorTower =
              bld.id === 'freedom_tower' ||
              bld.id === 'c2_emerald_tower' ||
              bld.id === 'c3_aero_observatory' ||
              bld.id === 'c4_golden_spire';
            const isTerminal = bld.id.startsWith('airport_');
            return (
              <rect
                key={bld.id}
                x={toSvgX(bld.x) - w * 0.5}
                y={toSvgZ(bld.z) - d * 0.5}
                width={w}
                height={d}
                fill={isMajorTower ? '#f59e0b' : isTerminal ? '#38bdf8' : '#64748b'}
                opacity={isMajorTower || isTerminal ? 0.92 : 0.74}
              />
            );
          })}

          {/* Residential house footprints */}
          {CITY_LAYOUT.houses.map((house) => {
            const w = toSvgLen(house.width);
            const d = toSvgLen(house.depth);
            return (
              <rect
                key={house.id}
                x={toSvgX(house.x) - w * 0.5}
                y={toSvgZ(house.z) - d * 0.5}
                width={w}
                height={d}
                fill="#78716c"
                opacity={0.78}
              />
            );
          })}

          {/* Important Location Markers (Landmarks) */}
          {CITY_LAYOUT.landmarks.map((lm) => {
            const lx = toSvgX(lm.x);
            const lz = toSvgZ(lm.z);
            if (!isInRadar(lx, lz, 8)) return null;
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
                  fontSize="4.6"
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
            if (!isInRadar(mx, mz, 6)) return null;
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
          {activeMission && activeTargetSvg && (
            <g data-minimap-target="true">
              <line
                x1={px}
                y1={pz}
                x2={activeTargetSvg.x}
                y2={activeTargetSvg.y}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="2.5 2"
                opacity="0.85"
              />
              {isInRadar(activeTargetSvg.x, activeTargetSvg.y, 4) && (
                <circle
                  cx={activeTargetSvg.x}
                  cy={activeTargetSvg.y}
                  r="4.6"
                  fill="#facc15"
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
              )}
            </g>
          )}

          {/* Police Cruisers (highlighted when Wanted >= 1) */}
          {wantedLevel > 0 &&
            trafficMarkers
              .filter((t) => t.isPolice)
              .map((t, idx) => {
                const tx = toSvgX(t.x);
                const tz = toSvgZ(t.z);
                if (!isInRadar(tx, tz, 4)) return null;
                return (
                  <circle
                    key={`pol_${idx}`}
                    cx={tx}
                    cy={tz}
                    r="2.4"
                    fill="#ef4444"
                    stroke="#38bdf8"
                    strokeWidth="1.1"
                  />
                );
              })}

          {/* Connected Multiplayer Classmates */}
          {remotePlayerMarkers.map((rp) => {
            const rx = toSvgX(rp.x);
            const rz = toSvgZ(rp.z);
            if (!isInRadar(rx, rz, 4)) return null;
            const isGroupMate = Boolean(showGroupMarkers && selfGroupId && rp.groupId === selfGroupId);
            return (
              <g key={rp.playerId} data-minimap-remote={rp.playerId}>
                <title>
                  {rp.displayName}
                  {isGroupMate ? ' (Group)' : ''}
                </title>
                <circle
                  cx={rx}
                  cy={rz}
                  r={isGroupMate ? '3.3' : '2.7'}
                  fill={isGroupMate ? '#10b981' : '#22d3ee'}
                  stroke={isGroupMate ? '#fbbf24' : '#0f172a'}
                  strokeWidth={isGroupMate ? '1.25' : '1'}
                />
              </g>
            );
          })}

          {/* Player view cone + marker */}
          <g transform={`translate(${px}, ${pz}) rotate(${deg.toFixed(1)})`}>
            <path d="M 0 0 L -6 -13 A 14 14 0 0 1 6 -13 Z" fill="rgba(245, 158, 11, 0.34)" />
            <circle cx="0" cy="0" r="3.2" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.2" />
          </g>
        </g>

        {/* Off-radar active mission edge arrow */}
        {offRadarMissionEdge && (
          <g
            transform={`translate(${offRadarMissionEdge.x.toFixed(1)}, ${offRadarMissionEdge.y.toFixed(1)}) rotate(${offRadarMissionEdge.angleDeg.toFixed(1)})`}
          >
            <polygon points="0,-4 3.2,2.8 -3.2,2.8" fill="#facc15" stroke="#0f172a" strokeWidth="0.9" />
          </g>
        )}
      </svg>
    </div>
  );
};
