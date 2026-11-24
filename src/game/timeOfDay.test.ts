import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextTimeOfDay, TIME_PHASES, TIME_PRESETS } from './timeOfDay';

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
});
