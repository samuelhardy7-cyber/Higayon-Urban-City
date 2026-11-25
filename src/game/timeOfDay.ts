import type { TimeOfDayPhase } from './types';

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
