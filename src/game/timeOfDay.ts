import type { TimeOfDayPhase, WeatherPhase } from './types';

export interface TimeLightingPreset {
  id: TimeOfDayPhase;
  label: string;
  skyTop: number;
  skyHorizon: number;
  sunGlow: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  envIntensity: number;
  lampEmissiveIntensity: number;
  windowEmissiveIntensity: number;
  exposure: number;
}

export const TIME_PHASES: TimeOfDayPhase[] = ['pagi', 'siang', 'sore', 'malam'];

export const TIME_PRESETS: Record<TimeOfDayPhase, TimeLightingPreset> = {
  pagi: {
    id: 'pagi',
    label: 'Pagi',
    skyTop: 0x5c94cf,
    skyHorizon: 0xf4cfb2,
    sunGlow: 0xffe2b0,
    fogColor: 0xebd0ba,
    fogDensity: 0.0024,
    sunColor: 0xffd7a8,
    sunIntensity: 1.65,
    sunPosition: [85, 38, 28],
    hemiSky: 0xa7cbe8,
    hemiGround: 0x6b5c4f,
    hemiIntensity: 0.68,
    envIntensity: 0.72,
    lampEmissiveIntensity: 0.35,
    windowEmissiveIntensity: 0.18,
    exposure: 1.04,
  },
  siang: {
    id: 'siang',
    label: 'Siang',
    skyTop: 0x4c8fd6,
    skyHorizon: 0xd7e9f6,
    sunGlow: 0xfff5db,
    fogColor: 0xd7e9f6,
    fogDensity: 0.0021,
    sunColor: 0xfff3dc,
    sunIntensity: 2.0,
    sunPosition: [52, 86, 42],
    hemiSky: 0x9bc8eb,
    hemiGround: 0x5e564a,
    hemiIntensity: 0.78,
    envIntensity: 0.95,
    lampEmissiveIntensity: 0.1,
    windowEmissiveIntensity: 0.06,
    exposure: 1.08,
  },
  sore: {
    id: 'sore',
    label: 'Sore',
    skyTop: 0x2c4b7d,
    skyHorizon: 0xeb8d54,
    sunGlow: 0xffa852,
    fogColor: 0xcc8863,
    fogDensity: 0.0026,
    sunColor: 0xff944d,
    sunIntensity: 1.55,
    sunPosition: [-88, 26, -32],
    hemiSky: 0x7e90bd,
    hemiGround: 0x4d3830,
    hemiIntensity: 0.56,
    envIntensity: 0.54,
    lampEmissiveIntensity: 1.6,
    windowEmissiveIntensity: 0.9,
    exposure: 1.02,
  },
  malam: {
    id: 'malam',
    label: 'Malam',
    skyTop: 0x050b18,
    skyHorizon: 0x111f3b,
    sunGlow: 0x5f88c2,
    fogColor: 0x0c162b,
    fogDensity: 0.0034,
    sunColor: 0x7ba5e0,
    sunIntensity: 0.34,
    sunPosition: [-48, 72, 54],
    hemiSky: 0x233966,
    hemiGround: 0x10141f,
    hemiIntensity: 0.28,
    envIntensity: 0.16,
    lampEmissiveIntensity: 3.2,
    windowEmissiveIntensity: 1.9,
    exposure: 0.88,
  },
};

export function nextTimeOfDay(current: TimeOfDayPhase): TimeOfDayPhase {
  const idx = TIME_PHASES.indexOf(current);
  return TIME_PHASES[(idx + 1) % TIME_PHASES.length];
}

export interface WeatherPreset {
  id: WeatherPhase;
  label: string;
  skyTopMixColor: number;
  skyTopMixWeight: number;
  skyHorizonMixColor: number;
  skyHorizonMixWeight: number;
  sunGlowMultiplier: number;
  fogColorMixColor: number;
  fogColorMixWeight: number;
  fogDensityMultiplier: number;
  minFogDensity: number;
  sunIntensityMultiplier: number;
  hemiIntensityMultiplier: number;
  envIntensityMultiplier: number;
  roadRoughness: number;
  roadMetalness: number;
  rainOpacity: number;
  mistOpacity: number;
  lampBoost: number;
  exposureMultiplier: number;
}

export const WEATHER_PHASES: WeatherPhase[] = ['sunny', 'rainy', 'foggy'];

export const DEFAULT_WEATHER_CYCLE_SECONDS = 42;

export const WEATHER_PRESETS: Record<WeatherPhase, WeatherPreset> = {
  sunny: {
    id: 'sunny',
    label: 'Cerah',
    skyTopMixColor: 0x000000,
    skyTopMixWeight: 0,
    skyHorizonMixColor: 0x000000,
    skyHorizonMixWeight: 0,
    sunGlowMultiplier: 1.0,
    fogColorMixColor: 0x000000,
    fogColorMixWeight: 0,
    fogDensityMultiplier: 1.0,
    minFogDensity: 0.0018,
    sunIntensityMultiplier: 1.0,
    hemiIntensityMultiplier: 1.0,
    envIntensityMultiplier: 1.0,
    roadRoughness: 0.86,
    roadMetalness: 0.04,
    rainOpacity: 0,
    mistOpacity: 0,
    lampBoost: 0,
    exposureMultiplier: 1.0,
  },
  rainy: {
    id: 'rainy',
    label: 'Hujan',
    skyTopMixColor: 0x334155,
    skyTopMixWeight: 0.68,
    skyHorizonMixColor: 0x64748b,
    skyHorizonMixWeight: 0.72,
    sunGlowMultiplier: 0.25,
    fogColorMixColor: 0x52657a,
    fogColorMixWeight: 0.68,
    fogDensityMultiplier: 2.05,
    minFogDensity: 0.0048,
    sunIntensityMultiplier: 0.42,
    hemiIntensityMultiplier: 0.96,
    envIntensityMultiplier: 0.78,
    roadRoughness: 0.18,
    roadMetalness: 0.36,
    rainOpacity: 0.78,
    mistOpacity: 0.26,
    lampBoost: 0.95,
    exposureMultiplier: 0.94,
  },
  foggy: {
    id: 'foggy',
    label: 'Berkabut',
    skyTopMixColor: 0x94a3b8,
    skyTopMixWeight: 0.64,
    skyHorizonMixColor: 0xcbd5e1,
    skyHorizonMixWeight: 0.82,
    sunGlowMultiplier: 0.38,
    fogColorMixColor: 0xcbd5e1,
    fogColorMixWeight: 0.78,
    fogDensityMultiplier: 4.8,
    minFogDensity: 0.0135,
    sunIntensityMultiplier: 0.52,
    hemiIntensityMultiplier: 1.08,
    envIntensityMultiplier: 0.68,
    roadRoughness: 0.46,
    roadMetalness: 0.14,
    rainOpacity: 0,
    mistOpacity: 0.86,
    lampBoost: 0.7,
    exposureMultiplier: 0.98,
  },
};

export function nextWeather(current: WeatherPhase): WeatherPhase {
  const idx = WEATHER_PHASES.indexOf(current);
  return WEATHER_PHASES[(idx + 1) % WEATHER_PHASES.length];
}

export function formatTimeWeatherLabel(
  timeOfDay: TimeOfDayPhase,
  weather: WeatherPhase = 'sunny',
): string {
  const timeLabel = TIME_PRESETS[timeOfDay].label;
  const weatherLabel = WEATHER_PRESETS[weather].label;
  return `${timeLabel} · ${weatherLabel}`;
}

export function stepWeatherCycle(
  current: WeatherPhase,
  timerSeconds: number,
  dt: number,
  cycleDurationSeconds = DEFAULT_WEATHER_CYCLE_SECONDS,
): { weather: WeatherPhase; timerSeconds: number; changed: boolean } {
  const safeDuration = Math.max(5, cycleDurationSeconds);
  let nextTimer = timerSeconds + Math.max(0, dt);
  let nextPhase = current;
  let changed = false;
  while (nextTimer >= safeDuration) {
    nextTimer -= safeDuration;
    nextPhase = nextWeather(nextPhase);
    changed = true;
  }
  return { weather: nextPhase, timerSeconds: nextTimer, changed };
}

function lerpHexColor(a: number, b: number, weight: number): number {
  const t = Math.max(0, Math.min(1, weight));
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function scaleHexColor(hex: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

export interface EffectiveAtmosphere {
  timeOfDay: TimeOfDayPhase;
  weather: WeatherPhase;
  label: string;
  skyTop: number;
  skyHorizon: number;
  sunGlow: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  envIntensity: number;
  lampEmissiveIntensity: number;
  windowEmissiveIntensity: number;
  exposure: number;
  roadRoughness: number;
  roadMetalness: number;
  rainOpacity: number;
  mistOpacity: number;
}

export function computeEffectiveAtmosphere(
  timeOfDay: TimeOfDayPhase,
  weather: WeatherPhase = 'sunny',
): EffectiveAtmosphere {
  const t = TIME_PRESETS[timeOfDay];
  const w = WEATHER_PRESETS[weather];
  // Dim overcast/fog tint during dusk and night so night fog stays dark atmospheric slate
  const weatherTintScale =
    timeOfDay === 'malam' ? 0.22 : timeOfDay === 'sore' ? 0.62 : timeOfDay === 'pagi' ? 0.88 : 1.0;

  const skyTopTarget = scaleHexColor(w.skyTopMixColor, weatherTintScale);
  const skyHorizonTarget = scaleHexColor(w.skyHorizonMixColor, weatherTintScale);
  const fogTarget = scaleHexColor(w.fogColorMixColor, weatherTintScale);

  const skyTop = lerpHexColor(t.skyTop, skyTopTarget, w.skyTopMixWeight);
  const skyHorizon = lerpHexColor(t.skyHorizon, skyHorizonTarget, w.skyHorizonMixWeight);
  const sunGlow = scaleHexColor(t.sunGlow, w.sunGlowMultiplier);
  const fogColor = lerpHexColor(t.fogColor, fogTarget, w.fogColorMixWeight);
  const fogDensity = Math.max(w.minFogDensity, t.fogDensity * w.fogDensityMultiplier);

  return {
    timeOfDay,
    weather,
    label: formatTimeWeatherLabel(timeOfDay, weather),
    skyTop,
    skyHorizon,
    sunGlow,
    fogColor,
    fogDensity,
    sunColor: t.sunColor,
    sunIntensity: t.sunIntensity * w.sunIntensityMultiplier,
    sunPosition: t.sunPosition,
    hemiSky: lerpHexColor(t.hemiSky, fogTarget, w.fogColorMixWeight * 0.45),
    hemiGround: t.hemiGround,
    hemiIntensity: t.hemiIntensity * w.hemiIntensityMultiplier,
    envIntensity: t.envIntensity * w.envIntensityMultiplier,
    lampEmissiveIntensity: t.lampEmissiveIntensity + w.lampBoost,
    windowEmissiveIntensity: t.windowEmissiveIntensity + w.lampBoost * 0.45,
    exposure: t.exposure * w.exposureMultiplier,
    roadRoughness: w.roadRoughness,
    roadMetalness: w.roadMetalness,
    rainOpacity: w.rainOpacity,
    mistOpacity: w.mistOpacity,
  };
}

