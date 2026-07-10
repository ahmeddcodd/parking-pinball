/** Music bus level when the player has music enabled. */
const MUSIC_VOLUME = 0.16;

/**
 * All audio is synthesized with the Web Audio API — zero audio files,
 * zero download weight, instant load. The context is unlocked on the
 * first user gesture (browser autoplay rules).
 *
 * Signal graph:  sfxGain ─┐
 *                          ├─> masterGain ─> destination
 *                musicGain ┘
 *
 * `masterGain` belongs to the platform: YouTube's audio state drives it and
 * nothing else does. When YouTube disables audio the master is 0 and the game
 * is silent no matter what the player's own Sound/Music toggles say — those
 * only attenuate within what the platform already permits. Keeping the two
 * layers separate means a platform mute never overwrites (or is overwritten
 * by) the player's saved preferences.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private sfxOn = true;
  private musicOn = true;
  /** Platform-authoritative. Only setPlatformAudioEnabled() may change it. */
  private platformAudioOn = true;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private lastStretch = 0;

  init(sound: boolean, music: boolean): void {
    this.sfxOn = sound;
    this.musicOn = music;
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.platformAudioOn ? 1 : 0;
      this.masterGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = MUSIC_VOLUME;
      this.musicGain.connect(this.masterGain);
      this.startMusic();
    }
    // Never un-suspend behind the platform's back.
    if (this.platformAudioOn && this.ctx.state === "suspended") void this.ctx.resume();
  }

  /**
   * YouTube's audio state. Authoritative and one-way: the game reports it
   * here and never writes it back to the save.
   */
  setPlatformAudioEnabled(enabled: boolean): void {
    this.platformAudioOn = enabled;
    if (!this.ctx) return;
    this.masterGain.gain.value = enabled ? 1 : 0;
    if (!enabled) {
      void this.ctx.suspend();
    } else if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  /** Halt audio for a platform pause, without touching any user preference. */
  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  /** Resume after a platform pause — unless YouTube still forbids audio. */
  resume(): void {
    if (!this.platformAudioOn) return;
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setSound(on: boolean): void {
    this.sfxOn = on;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicGain.gain.value = on ? MUSIC_VOLUME : 0;
  }

  // ────────────────────────────────────────────────────────── helpers

  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      vol?: number;
      slide?: number; // target freq at end
      delay?: number;
      dest?: GainNode;
    } = {}
  ): void {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t0 + dur);
    const vol = opts.vol ?? 0.6;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(opts.dest ?? this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, opts: { vol?: number; freq?: number; slide?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(opts.freq ?? 800, t0);
    if (opts.slide) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.slide), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
  }

  // ────────────────────────────────────────────────────────── SFX

  click(): void {
    this.tone(750, 0.07, { type: "triangle", vol: 0.35 });
  }

  /** Elastic creak while dragging; internally throttled. */
  stretch(power: number): void {
    const now = performance.now();
    if (now - this.lastStretch < 70) return;
    this.lastStretch = now;
    this.tone(180 + power * 320, 0.05, { type: "sawtooth", vol: 0.06 + power * 0.06 });
  }

  launch(power: number): void {
    this.tone(160 + power * 120, 0.3, { type: "square", vol: 0.3, slide: 60 });
    this.noise(0.25, { vol: 0.3, freq: 1600, slide: 300 });
  }

  bumper(comboLevel: number): void {
    const base = 240 * Math.pow(1.12, Math.min(comboLevel, 12));
    this.tone(base, 0.16, { type: "square", vol: 0.4, slide: base * 1.8 });
    this.noise(0.08, { vol: 0.18, freq: 2500 });
  }

  wallHit(intensity: number): void {
    this.noise(0.12, { vol: 0.12 + intensity * 0.25, freq: 420, slide: 120 });
  }

  crash(): void {
    this.noise(0.3, { vol: 0.5, freq: 300, slide: 80 });
    this.tone(90, 0.25, { type: "sawtooth", vol: 0.3, slide: 45 });
  }

  coin(streak: number): void {
    const f = 880 * Math.pow(1.06, Math.min(streak, 14));
    this.tone(f, 0.12, { type: "triangle", vol: 0.4 });
    this.tone(f * 1.5, 0.18, { type: "triangle", vol: 0.3, delay: 0.06 });
  }

  ramp(): void {
    this.noise(0.35, { vol: 0.35, freq: 500, slide: 3200 });
  }

  land(): void {
    this.noise(0.1, { vol: 0.28, freq: 350, slide: 150 });
  }

  success(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((f, i) => this.tone(f, 0.28, { type: "triangle", vol: 0.4, delay: i * 0.09 }));
  }

  perfect(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    notes.forEach((f, i) => this.tone(f, 0.35, { type: "triangle", vol: 0.42, delay: i * 0.08 }));
    this.noise(0.5, { vol: 0.2, freq: 3000, slide: 6000, delay: 0.3 });
    this.horn(0.55);
  }

  fail(): void {
    this.tone(300, 0.28, { type: "sawtooth", vol: 0.28, slide: 150 });
    this.tone(150, 0.4, { type: "sawtooth", vol: 0.24, slide: 75, delay: 0.18 });
  }

  horn(delay = 0): void {
    this.tone(392, 0.16, { type: "square", vol: 0.22, delay });
    this.tone(330, 0.24, { type: "square", vol: 0.22, delay: delay + 0.14 });
  }

  confetti(): void {
    this.noise(0.2, { vol: 0.4, freq: 2000, slide: 500 });
  }

  // ────────────────────────────────────────────────────────── music
  // Tiny generative loop: I–V–vi–IV plucks + bass, scheduled ahead.

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.musicGain.gain.value = this.musicOn ? MUSIC_VOLUME : 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
  }

  private scheduleMusic(): void {
    if (!this.ctx) return;
    const stepDur = 60 / 112 / 2; // 112 BPM, 8th notes
    const chords = [
      [261.63, 329.63, 392.0], // C
      [196.0, 246.94, 293.66], // G
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
    ];
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const bar = Math.floor(this.musicStep / 8) % 4;
      const step = this.musicStep % 8;
      const chord = chords[bar];
      const t = this.nextNoteTime - this.ctx.currentTime;
      if (step % 2 === 0) {
        // bass on beats
        this.musicTone(chord[0] / 2, stepDur * 1.6, "triangle", 0.5, t);
      }
      if (step === 2 || step === 5 || step === 7) {
        const note = chord[1 + (this.musicStep % 2)];
        this.musicTone(note * 2, stepDur * 0.9, "square", 0.12, t);
      }
      this.nextNoteTime += stepDur;
      this.musicStep++;
    }
  }

  private musicTone(freq: number, dur: number, type: OscillatorType, vol: number, delay: number): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + Math.max(0, delay);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}
