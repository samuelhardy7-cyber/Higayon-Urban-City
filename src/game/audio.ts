export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private musicEnabled = true;
  private lastStepPhase = 0;

  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private isPlayingPhase = false;
  private lastCollisionSoundTime = 0;

  public unlock(): void {
    if (this.muted) return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.syncAmbientAndMusic();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.ctx) {
      const now = this.ctx.currentTime;
      this.engineGain?.gain.setTargetAtTime(0.0001, now, 0.04);
      this.ambientGain?.gain.setTargetAtTime(0.0001, now, 0.05);
    }
    this.syncAmbientAndMusic();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.syncAmbientAndMusic();
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setPlayingState(isPlaying: boolean): void {
    this.isPlayingPhase = isPlaying;
    this.syncAmbientAndMusic();
  }

  private ensureAmbientCityBed(): void {
    if (!this.ctx || this.ambientSource || this.ctx.state !== 'running') return;
    try {
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 2.2;
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();

      this.ambientSource = src;
      this.ambientGain = gain;
    } catch {
      // ignore audio init restrictions
    }
  }

  private syncAmbientAndMusic(): void {
    const canPlay = !this.muted && this.isPlayingPhase && this.ctx && this.ctx.state === 'running';
    if (this.ctx) {
      if (canPlay) {
        this.ensureAmbientCityBed();
        this.ambientGain?.gain.setTargetAtTime(0.022, this.ctx.currentTime, 0.35);
      } else {
        this.ambientGain?.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
      }
    }

    if (canPlay && this.musicEnabled) {
      if (this.musicTimer === null) {
        this.musicTimer = window.setInterval(() => {
          this.triggerMusicStep();
        }, 360);
      }
    } else if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private triggerMusicStep(): void {
    if (this.muted || !this.musicEnabled || !this.isPlayingPhase || !this.ctx || this.ctx.state !== 'running') {
      return;
    }
    const now = this.ctx.currentTime;
    // Smooth warm urban synth progression (C minor / Ab / Eb / Bb)
    const bassNotes = [65.41, 65.41, 51.91, 51.91, 77.78, 77.78, 58.27, 58.27];
    const leadNotes = [261.63, 311.13, 392.0, 311.13, 233.08, 311.13, 349.23, 293.66];
    const idx = this.musicStep % bassNotes.length;
    this.musicStep++;

    // Soft bass pulse every step
    const bass = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bass.type = 'triangle';
    bass.frequency.setValueAtTime(bassNotes[idx], now);
    bassGain.gain.setValueAtTime(0.022, now);
    bassGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);
    bass.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bass.start(now);
    bass.stop(now + 0.33);

    // Subtle arpeggio lead on alternating beats
    if (this.musicStep % 2 === 1) {
      const lead = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      lead.type = 'sine';
      lead.frequency.setValueAtTime(leadNotes[idx], now);
      leadGain.gain.setValueAtTime(0.012, now);
      leadGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.28);
      lead.connect(leadGain);
      leadGain.connect(this.ctx.destination);
      lead.start(now);
      lead.stop(now + 0.3);
    }
  }

  public playUiClick(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.055);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playCash(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    [659.25, 987.77].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playError(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.12);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playJump(): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.14);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playLand(): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playDoorClunk(entering: boolean): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(entering ? 140 : 185, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playDoorLatch(opening: boolean): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(opening ? 320 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(opening ? 480 : 150, now + 0.07);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playElevatorChime(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    [783.99, 1046.5].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.11;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playCollision(intensity = 0.6): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const nowMs = performance.now();
    // Rate-limit collision pooling so rapid scrapes never stack loudly
    if (nowMs - this.lastCollisionSoundTime < 140) return;
    this.lastCollisionSoundTime = nowMs;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(105, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);
    gain.gain.setValueAtTime(Math.min(0.15, 0.05 + intensity * 0.08), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playCheckpoint(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t0 = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.09, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.19);
    });
  }

  public playMissionResult(success: boolean): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const notes = success ? [523.25, 659.25, 783.99, 1046.5] : [330, 261.63, 196];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.1, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    });
  }

  public updateEngineSound(active: boolean, absSpeed: number, maxSpeed: number): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      }
      return;
    }

    if (!this.engineOsc || !this.engineGain || !this.engineSubOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineSubOsc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;

      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'triangle';
      this.engineSubOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 62;
      this.engineSubOsc.frequency.value = 31;
      this.engineGain.gain.value = 0.0001;

      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.35;

      this.engineOsc.connect(filter);
      this.engineSubOsc.connect(subGain);
      subGain.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.engineSubOsc.start();
    }

    const now = this.ctx.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.06);
      return;
    }

    const ratio = Math.min(1, Math.max(0, absSpeed / Math.max(1, maxSpeed)));
    const targetFreq = 56 + ratio * 96;
    const targetGain = 0.018 + ratio * 0.028;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
    this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.06);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.06);
  }

  public updateFootsteps(
    gaitPhase: number,
    grounded: boolean,
    isMoving: boolean,
    isSprinting: boolean,
  ): void {
    if (!grounded || !isMoving) {
      this.lastStepPhase = gaitPhase;
      return;
    }
    const stepCycle = Math.floor(gaitPhase / Math.PI);
    const prevCycle = Math.floor(this.lastStepPhase / Math.PI);
    this.lastStepPhase = gaitPhase;

    if (stepCycle !== prevCycle && !this.muted && this.ctx && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const pitchJitter = 0.92 + Math.random() * 0.16;
      osc.type = 'sine';
      osc.frequency.setValueAtTime((isSprinting ? 118 : 96) * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(46, now + 0.055);
      gain.gain.setValueAtTime(isSprinting ? 0.06 : 0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.065);
    }
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch {
        // ignore
      }
      this.ambientSource = null;
      this.ambientGain = null;
    }
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {
        // ignore already stopped oscillator
      }
      this.engineOsc = null;
    }
    if (this.engineSubOsc) {
      try {
        this.engineSubOsc.stop();
        this.engineSubOsc.disconnect();
      } catch {
        // ignore
      }
      this.engineSubOsc = null;
    }
    this.engineGain = null;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
