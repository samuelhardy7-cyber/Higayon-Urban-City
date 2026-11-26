import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveAtmosphere,
  DEFAULT_WEATHER_CYCLE_SECONDS,
  formatTimeWeatherLabel,
  nextTimeOfDay,
  nextWeather,
  stepWeatherCycle,
  TIME_PHASES,
  TIME_PRESETS,
  WEATHER_PHASES,
} from './timeOfDay';

describe('timeOfDay system', () => {
  it('cycles through Pagi -> Siang -> Sore -> Malam -> Pagi', () => {
    let phase = TIME_PHASES[0];
    assert.equal(phase, 'pagi');
    phase = nextTimeOfDay(phase);
    assert.equal(phase, 'siang');
    phase = nextTimeOfDay(phase);
    assert.equal(phase, 'sore');
    phase = nextTimeOfDay(phase);
    assert.equal(phase, 'malam');
    phase = nextTimeOfDay(phase);
    assert.equal(phase, 'pagi');
  });

  it('defines distinct lighting and higher night emissive glow for lamps and windows', () => {
    const siang = TIME_PRESETS.siang;
    const malam = TIME_PRESETS.malam;
    assert.ok(siang.sunIntensity > malam.sunIntensity);
    assert.ok(malam.lampEmissiveIntensity > siang.lampEmissiveIntensity);
    assert.ok(malam.windowEmissiveIntensity > siang.windowEmissiveIntensity);
  });

  it('cycles weather dynamically between sunny -> rainy -> foggy -> sunny', () => {
    let w = WEATHER_PHASES[0];
    assert.equal(w, 'sunny');
    w = nextWeather(w);
    assert.equal(w, 'rainy');
    w = nextWeather(w);
    assert.equal(w, 'foggy');
    w = nextWeather(w);
    assert.equal(w, 'sunny');

    const step1 = stepWeatherCycle('sunny', DEFAULT_WEATHER_CYCLE_SECONDS - 1, 2.5);
    assert.equal(step1.changed, true);
    assert.equal(step1.weather, 'rainy');
    assert.ok(step1.timerSeconds >= 1.4 && step1.timerSeconds <= 1.6);

    const step2 = stepWeatherCycle(step1.weather, DEFAULT_WEATHER_CYCLE_SECONDS - 0.5, 1.0);
    assert.equal(step2.changed, true);
    assert.equal(step2.weather, 'foggy');
  });

  it('formats HUD timeLabel with combined time of day and weather and computes distinct atmosphere presets', () => {
    assert.equal(formatTimeWeatherLabel('siang', 'sunny'), 'Siang · Cerah');
    assert.equal(formatTimeWeatherLabel('siang', 'rainy'), 'Siang · Hujan');
    assert.equal(formatTimeWeatherLabel('malam', 'foggy'), 'Malam · Berkabut');

    const sunny = computeEffectiveAtmosphere('siang', 'sunny');
    const rainy = computeEffectiveAtmosphere('siang', 'rainy');
    const foggy = computeEffectiveAtmosphere('siang', 'foggy');

    assert.equal(sunny.rainOpacity, 0);
    assert.ok(rainy.rainOpacity > 0.5);
    assert.ok(rainy.roadRoughness < sunny.roadRoughness);
    assert.ok(rainy.roadMetalness > sunny.roadMetalness);
    assert.ok(foggy.fogDensity > rainy.fogDensity);
    assert.ok(rainy.fogDensity > sunny.fogDensity);
    assert.ok(foggy.mistOpacity > 0.5);
  });
});

