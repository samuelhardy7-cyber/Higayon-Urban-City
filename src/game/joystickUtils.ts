export interface ResponsiveJoystickMetrics {
  viewportWidth: number;
  viewportHeight: number;
  orientation: 'portrait' | 'landscape';
  compactLandscape: boolean;
  showTouchControls: boolean;
  padSizePx: number;
  knobSizePx: number;
  maxRadiusPx: number;
  actionBtnSizePx: number;
  jumpBtnSizePx: number;
  drivingSteerSizePx: number;
  drivingPedalWidthPx: number;
  drivingGasHeightPx: number;
  gapPx: number;
  bottomOffsetPx: number;
}

export function clampNumber(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function computeResponsiveJoystickMetrics(
  viewportWidth: number,
  viewportHeight: number,
  isCoarsePointer = false,
): ResponsiveJoystickMetrics {
  const safeW = Math.max(280, Math.round(viewportWidth));
  const safeH = Math.max(280, Math.round(viewportHeight));
  const orientation: 'portrait' | 'landscape' = safeW >= safeH ? 'landscape' : 'portrait';
  const minDim = Math.min(safeW, safeH);
  const compactLandscape = orientation === 'landscape' && safeH <= 500;
  const showTouchControls = safeW < 1024 || isCoarsePointer;

  // Scale joystick proportional to limiting viewport dimension while keeping comfortable thumb reach
  const rawPad = compactLandscape
    ? Math.round(safeH * 0.23)
    : safeW >= 768
      ? Math.round(minDim * 0.165)
      : Math.round(minDim * 0.27);

  const padSizePx = clampNumber(rawPad, 82, 134);
  const knobSizePx = clampNumber(Math.round(padSizePx * 0.43), 36, 58);
  const maxRadiusPx = Math.max(24, Math.round((padSizePx - knobSizePx * 0.5) * 0.46));

  const actionBtnSizePx = clampNumber(Math.round(padSizePx * 0.48), 44, 66);
  const jumpBtnSizePx = clampNumber(Math.round(padSizePx * 0.56), 50, 74);

  const drivingSteerSizePx = clampNumber(Math.round(padSizePx * 0.56), 48, 72);
  const drivingPedalWidthPx = clampNumber(Math.round(padSizePx * 0.54), 48, 70);
  const drivingGasHeightPx = clampNumber(Math.round(padSizePx * 0.7), 60, 92);

  const gapPx = compactLandscape ? 8 : safeW >= 768 ? 14 : 10;
  const bottomOffsetPx = compactLandscape ? 4 : safeW >= 768 ? 10 : 6;

  return {
    viewportWidth: safeW,
    viewportHeight: safeH,
    orientation,
    compactLandscape,
    showTouchControls,
    padSizePx,
    knobSizePx,
    maxRadiusPx,
    actionBtnSizePx,
    jumpBtnSizePx,
    drivingSteerSizePx,
    drivingPedalWidthPx,
    drivingGasHeightPx,
    gapPx,
    bottomOffsetPx,
  };
}
