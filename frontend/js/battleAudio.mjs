export const AUDIO_SETTINGS_KEY = "pokemon-battle-audio-v1";

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  musicVolume: 0.28,
  sfxVolume: 0.65,
  cryVolume: 0.5,
  muted: false,
  reduceMotion: false,
});

const MUSIC_PATTERNS = {
  wild: [220, 277, 330, 277, 247, 330, 370, 330],
  trainer: [196, 247, 294, 330, 294, 370, 330, 247],
  gym: [165, 220, 262, 330, 392, 330, 294, 220],
  elite: [147, 220, 294, 349, 440, 392, 349, 294],
  champion: [131, 196, 262, 330, 440, 523, 440, 330],
  legendary: [110, 165, 220, 330, 247, 370, 277, 415],
};

const TYPE_AUDIO = {
  Fire: { frequency: 150, end: 72, wave: "sawtooth" },
  Water: { frequency: 520, end: 190, wave: "sine" },
  Electric: { frequency: 1200, end: 180, wave: "square" },
  Grass: { frequency: 680, end: 320, wave: "triangle" },
  Ice: { frequency: 1500, end: 650, wave: "sine" },
  Fighting: { frequency: 105, end: 55, wave: "square" },
  Poison: { frequency: 190, end: 120, wave: "sawtooth" },
  Ground: { frequency: 82, end: 48, wave: "sawtooth" },
  Flying: { frequency: 760, end: 260, wave: "triangle" },
  Psychic: { frequency: 330, end: 880, wave: "sine" },
  Bug: { frequency: 420, end: 690, wave: "square" },
  Rock: { frequency: 92, end: 42, wave: "square" },
  Ghost: { frequency: 260, end: 90, wave: "sine" },
  Dragon: { frequency: 145, end: 420, wave: "sawtooth" },
  Dark: { frequency: 120, end: 74, wave: "triangle" },
  Steel: { frequency: 880, end: 1760, wave: "triangle" },
  Fairy: { frequency: 660, end: 1320, wave: "sine" },
  Normal: { frequency: 180, end: 95, wave: "triangle" },
};

function clampVolume(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

export function normalizeAudioSettings(settings = {}) {
  return {
    musicVolume: clampVolume(settings.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
    sfxVolume: clampVolume(settings.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
    cryVolume: clampVolume(settings.cryVolume, DEFAULT_AUDIO_SETTINGS.cryVolume),
    muted: Boolean(settings.muted),
    reduceMotion: Boolean(settings.reduceMotion),
  };
}

export function deterministicCryProfile(speciesId) {
  let seed = (Math.abs(Number(speciesId)) || 1) >>> 0;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const waveforms = ["square", "sawtooth", "triangle"];
  return {
    startFrequency: Math.round(180 + next() * 620),
    endFrequency: Math.round(90 + next() * 430),
    duration: Number((0.16 + next() * 0.22).toFixed(3)),
    wave: waveforms[Math.floor(next() * waveforms.length)],
    pulse: Number((4 + next() * 10).toFixed(2)),
  };
}

export class AudioManager {
  constructor({ storage = globalThis.localStorage, AudioContextClass } = {}) {
    this.storage = storage;
    this.AudioContextClass =
      AudioContextClass || globalThis.AudioContext || globalThis.webkitAudioContext;
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.cryGain = null;
    this.musicTimer = null;
    this.musicTimeouts = new Set();
    this.musicOscillators = new Set();
    this.pendingMode = null;
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      return normalizeAudioSettings(
        JSON.parse(this.storage?.getItem(AUDIO_SETTINGS_KEY) || "{}"),
      );
    } catch {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
  }

  saveSettings(nextSettings) {
    this.settings = normalizeAudioSettings({ ...this.settings, ...nextSettings });
    try {
      this.storage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Audio preferences can remain session-only if storage is unavailable.
    }
    this.applyVolumes();
    return { ...this.settings };
  }

  ensureContext() {
    if (this.context || !this.AudioContextClass) return this.context;
    this.context = new this.AudioContextClass();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.cryGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.cryGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.applyVolumes();
    return this.context;
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) return false;
    if (context.state === "suspended") await context.resume();
    if (this.pendingMode && !this.musicTimer) this.startMusic(this.pendingMode);
    return true;
  }

  applyVolumes() {
    if (!this.context) return;
    const now = this.context.currentTime;
    const mute = this.settings.muted ? 0 : 1;
    this.masterGain.gain.setTargetAtTime(mute, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.02);
    this.cryGain.gain.setTargetAtTime(this.settings.cryVolume, now, 0.02);
  }

  playTone({ frequency, end = frequency, duration = 0.16, wave = "sine", gain = 0.18 }, output) {
    const context = this.ensureContext();
    if (!context || this.settings.muted) return null;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const now = context.currentTime;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
    return oscillator;
  }

  async playMove(move = {}) {
    if (!(await this.unlock())) return;
    const profile = TYPE_AUDIO[move.type] || TYPE_AUDIO.Normal;
    this.playTone({ ...profile, duration: 0.2, gain: 0.16 }, this.sfxGain);
  }

  async playHit(heavy = false) {
    if (!(await this.unlock())) return;
    this.playTone(
      {
        frequency: heavy ? 105 : 180,
        end: heavy ? 38 : 72,
        duration: heavy ? 0.22 : 0.12,
        wave: "square",
        gain: heavy ? 0.23 : 0.15,
      },
      this.sfxGain,
    );
  }

  async playSendOut(speciesId) {
    if (!(await this.unlock())) return;
    this.playTone(
      { frequency: 240, end: 920, duration: 0.2, wave: "sine", gain: 0.12 },
      this.sfxGain,
    );
    globalThis.setTimeout?.(() => this.playCry(speciesId), 130);
  }

  async playCry(speciesId) {
    if (!(await this.unlock())) return;
    const profile = deterministicCryProfile(speciesId);
    this.playTone(
      {
        frequency: profile.startFrequency,
        end: profile.endFrequency,
        duration: profile.duration,
        wave: profile.wave,
        gain: 0.12,
      },
      this.cryGain,
    );
  }

  async playFaint() {
    if (!(await this.unlock())) return;
    this.playTone(
      { frequency: 360, end: 42, duration: 0.42, wave: "sawtooth", gain: 0.16 },
      this.sfxGain,
    );
  }

  async playEvolutionCue() {
    if (!(await this.unlock())) return;
    [0, 0.1, 0.2, 0.34].forEach((offset, index) => {
      globalThis.setTimeout?.(() => {
        this.playTone(
          { frequency: [392, 494, 587, 784][index], duration: 0.18, gain: 0.11 },
          this.sfxGain,
        );
      }, offset * 1000);
    });
  }

  setBattleMode(mode) {
    this.pendingMode = MUSIC_PATTERNS[mode] ? mode : "wild";
    if (this.context?.state === "running") this.startMusic(this.pendingMode);
  }

  startMusic(mode) {
    const context = this.ensureContext();
    if (!context) return;
    this.stopMusic(0.08);
    const pattern = MUSIC_PATTERNS[mode] || MUSIC_PATTERNS.wild;
    const schedule = () => {
      if (!this.context || this.settings.muted) return;
      pattern.forEach((frequency, index) => {
        const timer = globalThis.setTimeout?.(() => {
          this.musicTimeouts.delete(timer);
          const oscillator = this.playTone(
            { frequency, duration: 0.24, wave: "square", gain: 0.045 },
            this.musicGain,
          );
          if (oscillator) {
            this.musicOscillators.add(oscillator);
            oscillator.addEventListener?.("ended", () => {
              this.musicOscillators.delete(oscillator);
            }, { once: true });
          }
        }, index * 280);
        if (timer != null) this.musicTimeouts.add(timer);
      });
    };
    schedule();
    this.musicTimer = globalThis.setInterval?.(schedule, pattern.length * 280);
  }

  stopMusic(fadeSeconds = 0.2) {
    if (this.musicTimer != null) globalThis.clearInterval?.(this.musicTimer);
    this.musicTimer = null;
    this.musicTimeouts.forEach((timer) => globalThis.clearTimeout?.(timer));
    this.musicTimeouts.clear();
    const activeOscillators = [...this.musicOscillators];
    this.musicOscillators.clear();
    if (this.context && this.musicGain) {
      const now = this.context.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
      globalThis.setTimeout?.(() => this.applyVolumes(), fadeSeconds * 1000 + 30);
    }
    globalThis.setTimeout?.(() => {
      activeOscillators.forEach((oscillator) => {
        try {
          oscillator.stop?.();
        } catch {
          // Oscillator may already have stopped naturally.
        }
      });
    }, fadeSeconds * 1000);
  }

  endBattle() {
    this.pendingMode = null;
    this.stopMusic();
  }
}
