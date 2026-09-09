export const AUDIO_SETTINGS_KEY = "pokemon-battle-audio-v1";

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  musicVolume: 0.28,
  sfxVolume: 0.65,
  cryVolume: 0.5,
  muted: false,
  reduceMotion: false,
});

export const SAMPLE_FILES = Object.freeze({
  "hit-light": "/assets/audio/sfx/impactGeneric_light_000.ogg",
  "hit-heavy": "/assets/audio/sfx/impactPunch_heavy_000.ogg",
  critical: "/assets/audio/sfx/impactBell_heavy_000.ogg",
  fire: "/assets/audio/sfx/laser4.ogg",
  water: "/assets/audio/sfx/phaseJump2.ogg",
  electric: "/assets/audio/sfx/zap1.ogg",
  ice: "/assets/audio/sfx/impactGlass_heavy_000.ogg",
  "ground-rock": "/assets/audio/sfx/impactMining_000.ogg",
  psychic: "/assets/audio/sfx/phaserUp2.ogg",
  ghost: "/assets/audio/sfx/phaserDown2.ogg",
  steel: "/assets/audio/sfx/impactMetal_heavy_000.ogg",
  fighting: "/assets/audio/sfx/impactPunch_heavy_000.ogg",
  healing: "/assets/audio/sfx/powerUp3.ogg",
  status: "/assets/audio/sfx/glitch_001.ogg",
  sendout: "/assets/audio/sfx/switch_003.ogg",
  faint: "/assets/audio/sfx/lowDown.ogg",
  evolution: "/assets/audio/sfx/threeTone1.ogg",
  "ui-select": "/assets/audio/sfx/select_001.ogg",
  "capture-throw": "/assets/audio/sfx/switch_003.ogg",
  "capture-impact": "/assets/audio/sfx/phaseJump2.ogg",
  "capture-bounce": "/assets/audio/sfx/impactGeneric_light_000.ogg",
  "capture-shake": "/assets/audio/sfx/select_001.ogg",
  "capture-success": "/assets/audio/sfx/threeTone1.ogg",
  "capture-breakout": "/assets/audio/sfx/glitch_001.ogg",
});

const CAPTURE_SAMPLE_KEYS = Object.freeze({
  throw: "capture-throw",
  impact: "capture-impact",
  bounce: "capture-bounce",
  shake: "capture-shake",
  success: "capture-success",
  breakout: "capture-breakout",
});

const CAPTURE_TONES = Object.freeze({
  throw: { frequency: 260, end: 920, duration: 0.18, wave: "sine", gain: 0.11 },
  impact: { frequency: 880, end: 240, duration: 0.2, wave: "triangle", gain: 0.14 },
  bounce: { frequency: 150, end: 72, duration: 0.09, wave: "square", gain: 0.1 },
  shake: { frequency: 440, end: 520, duration: 0.07, wave: "sine", gain: 0.07 },
  success: { frequency: 523, end: 1046, duration: 0.34, wave: "triangle", gain: 0.13 },
  breakout: { frequency: 720, end: 130, duration: 0.28, wave: "sawtooth", gain: 0.12 },
});

const TYPE_SAMPLE_KEYS = Object.freeze({
  Normal: ["hit-light"], Fire: ["fire"], Water: ["water"],
  Electric: ["electric"], Grass: ["healing", "hit-light"], Ice: ["ice"],
  Fighting: ["fighting"], Poison: ["status"], Ground: ["ground-rock"],
  Flying: ["sendout"], Psychic: ["psychic"], Bug: ["hit-light"],
  Rock: ["ground-rock"], Ghost: ["ghost"], Dragon: ["fire", "hit-heavy"],
  Dark: ["ghost"], Steel: ["steel"], Fairy: ["healing"],
});

const SPECIAL_MOVE_SAMPLE_LAYERS = Object.freeze({
  thunderbolt: ["electric", "critical"],
  flamethrower: ["fire", "hit-heavy"],
  surf: ["water", "hit-heavy"],
  earthquake: ["ground-rock", "hit-heavy"],
  "shadow-ball": ["ghost", "psychic"],
  "ice-beam": ["ice", "psychic"],
  "hyper-beam": ["psychic", "critical", "hit-heavy"],
});

const MUSIC_PATTERNS = {
  wild: [220, 277, 330, 277, 247, 330, 370, 330],
  trainer: [196, 247, 294, 330, 294, 370, 330, 247],
  gym: [165, 220, 262, 330, 392, 330, 294, 220],
  elite: [147, 220, 294, 349, 440, 392, 349, 294],
  champion: [131, 196, 262, 330, 440, 523, 440, 330],
  legendary: [110, 165, 220, 330, 247, 370, 277, 415],
};

export const AMBIENT_PROFILES = Object.freeze({
  forest: { notes: [196, 294, 392], interval: 2400, wave: "sine", gain: 0.018 },
  cave: { notes: [73, 110, 147], interval: 3200, wave: "triangle", gain: 0.022 },
  volcano: { notes: [48, 62, 82], interval: 1900, wave: "sawtooth", gain: 0.024 },
  lake: { notes: [220, 330, 440], interval: 2800, wave: "sine", gain: 0.016 },
  mountain: { notes: [147, 220, 330], interval: 2600, wave: "triangle", gain: 0.015 },
  desert: { notes: [82, 123, 165], interval: 2300, wave: "sine", gain: 0.018 },
  graveyard: { notes: [98, 131, 196], interval: 3400, wave: "sine", gain: 0.02 },
});

export function resolveAmbientProfile(area) {
  return AMBIENT_PROFILES[String(area || "").toLowerCase()] || null;
}

export async function resumeAudioContext(context, timeoutMs = 450) {
  if (!context || context.state !== "suspended") return Boolean(context);
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = globalThis.setTimeout?.(() => resolve(false), timeoutMs);
  });
  const resumed = Promise.resolve()
    .then(() => context.resume())
    .then(() => context.state !== "suspended")
    .catch(() => false);
  const result = await Promise.race([resumed, timeout]);
  if (timeoutId != null) globalThis.clearTimeout?.(timeoutId);
  return Boolean(result);
}

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

function moveKey(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function resolveMoveSampleKeys(move = {}) {
  return [...(SPECIAL_MOVE_SAMPLE_LAYERS[moveKey(move.name)] || TYPE_SAMPLE_KEYS[move.type] || ["hit-light"])];
}

function getCryIdentityIds(pokemon) {
  if (typeof pokemon === "number" || typeof pokemon === "string") {
    return [Number(pokemon)].filter(Number.isFinite);
  }
  const speciesId = Number(pokemon?.speciesId || pokemon?.id);
  const formPokemonId = Number(
    pokemon?.form?.pokemonId || pokemon?.form?.imageId || pokemon?.pokemonId ||
      (pokemon?.form && pokemon?.imageId !== speciesId ? pokemon.imageId : 0),
  );
  return [...new Set([formPokemonId, speciesId].filter((id) => id > 0))];
}

export function resolveCrySampleCandidates(pokemon, manifest = {}) {
  const cries = manifest.cries || manifest;
  return getCryIdentityIds(pokemon).map((id) => cries?.[String(id)]).filter(Boolean);
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
  constructor({ storage = globalThis.localStorage, AudioContextClass, fetchFn = globalThis.fetch?.bind(globalThis), cryManifest = null } = {}) {
    this.storage = storage;
    this.AudioContextClass = AudioContextClass || globalThis.AudioContext || globalThis.webkitAudioContext;
    this.fetchFn = fetchFn;
    this.cryManifest = cryManifest;
    this.cryManifestPromise = null;
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.cryGain = null;
    this.bufferCache = new Map();
    this.musicTimer = null;
    this.musicTimeouts = new Set();
    this.musicOscillators = new Set();
    this.pendingMode = null;
    this.pendingAmbientArea = null;
    this.ambientTrack = null;
    this.preloadStarted = false;
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      return normalizeAudioSettings(JSON.parse(this.storage?.getItem(AUDIO_SETTINGS_KEY) || "{}"));
    } catch {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
  }

  saveSettings(nextSettings) {
    this.settings = normalizeAudioSettings({ ...this.settings, ...nextSettings });
    try {
      this.storage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Preferences remain session-only when storage is unavailable.
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
    if (!(await resumeAudioContext(context))) return false;
    if (!this.preloadStarted) {
      this.preloadStarted = true;
      this.preload().catch(() => {});
      this.loadCryManifest().catch(() => {});
    }
    if (this.pendingMode && !this.musicTimer) this.startMusic(this.pendingMode);
    else if (this.pendingAmbientArea && !this.ambientTrack) {
      this.startAmbience(this.pendingAmbientArea);
    }
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
    if (this.ambientTrack?.gain) {
      this.ambientTrack.gain.gain.setTargetAtTime(
        this.settings.musicVolume * 0.42,
        now,
        0.05,
      );
    }
  }

  resolveSamplePath(keyOrPath) {
    return SAMPLE_FILES[keyOrPath] || keyOrPath || null;
  }

  async loadAudioBuffer(keyOrPath) {
    const path = this.resolveSamplePath(keyOrPath);
    const context = this.ensureContext();
    if (!path || !context || !this.fetchFn || !context.decodeAudioData) return null;
    if (this.bufferCache.has(path)) return this.bufferCache.get(path);
    const loading = Promise.resolve()
      .then(() => this.fetchFn(path))
      .then((response) => {
        if (!response?.ok) throw new Error(`Audio request failed: ${path}`);
        return response.arrayBuffer();
      })
      .then((bytes) => context.decodeAudioData(bytes))
      .catch(() => null);
    this.bufferCache.set(path, loading);
    return loading;
  }

  preload(keys = Object.keys(SAMPLE_FILES)) {
    return Promise.all(keys.map((key) => this.loadAudioBuffer(key)));
  }

  getOutput(category) {
    return category === "cry" ? this.cryGain : this.sfxGain;
  }

  async playSample(keyOrPath, { category = "sfx", gain = 1, playbackRate = 1 } = {}) {
    if (!(await this.unlock()) || this.settings.muted) return null;
    const buffer = await this.loadAudioBuffer(keyOrPath);
    if (!buffer) return null;
    const source = this.context.createBufferSource();
    const level = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    level.gain.value = Math.max(0, gain);
    source.connect(level);
    level.connect(this.getOutput(category));
    source.start();
    return source;
  }

  async playSamples(keys, options) {
    const sources = await Promise.all(keys.map((key) => this.playSample(key, options)));
    return sources.filter(Boolean);
  }

  async loadCryManifest() {
    if (this.cryManifest) return this.cryManifest;
    if (this.cryManifestPromise) return this.cryManifestPromise;
    if (!this.fetchFn) return { version: 1, cries: {} };
    this.cryManifestPromise = Promise.resolve()
      .then(() => this.fetchFn("/assets/audio/cries/manifest.json"))
      .then((response) => response?.ok ? response.json() : { version: 1, cries: {} })
      .catch(() => ({ version: 1, cries: {} }))
      .then((manifest) => {
        this.cryManifest = manifest;
        return manifest;
      });
    return this.cryManifestPromise;
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
    if (!(await this.unlock())) return { source: "none" };
    const samples = await this.playSamples(resolveMoveSampleKeys(move), { gain: 0.72 });
    if (samples.length) return { source: "sample", count: samples.length };
    const profile = TYPE_AUDIO[move.type] || TYPE_AUDIO.Normal;
    this.playTone({ ...profile, duration: 0.2, gain: 0.16 }, this.sfxGain);
    return { source: "synth" };
  }

  async playHit(heavy = false, { critical = false } = {}) {
    if (!(await this.unlock())) return { source: "none" };
    const key = critical ? "critical" : heavy ? "hit-heavy" : "hit-light";
    if (await this.playSample(key, { gain: critical ? 0.9 : 0.76 })) return { source: "sample", key };
    this.playTone({ frequency: heavy ? 105 : 180, end: heavy ? 38 : 72, duration: heavy ? 0.22 : 0.12, wave: "square", gain: heavy ? 0.23 : 0.15 }, this.sfxGain);
    return { source: "synth", key };
  }

  async playSendOut(pokemon) {
    if (!(await this.unlock())) return { source: "none" };
    const sample = await this.playSample("sendout", { gain: 0.72 });
    if (!sample) this.playTone({ frequency: 240, end: 920, duration: 0.2, wave: "sine", gain: 0.12 }, this.sfxGain);
    globalThis.setTimeout?.(() => this.playCry(pokemon), 130);
    return { source: sample ? "sample" : "synth" };
  }

  async playBall() {
    return this.playCaptureCue("throw");
  }

  async playCaptureCue(cue) {
    if (!(await this.unlock())) return { source: "none", cue };
    const key = CAPTURE_SAMPLE_KEYS[cue] || CAPTURE_SAMPLE_KEYS.throw;
    const sample = await this.playSample(key, {
      gain: cue === "success" ? 0.82 : 0.68,
      playbackRate: cue === "shake" ? 1.08 : 1,
    });
    if (sample) return { source: "sample", cue, key };
    this.playTone(CAPTURE_TONES[cue] || CAPTURE_TONES.throw, this.sfxGain);
    return { source: "synth", cue, key };
  }

  async playCry(pokemon) {
    if (!(await this.unlock())) return { source: "none" };
    const candidates = resolveCrySampleCandidates(pokemon, await this.loadCryManifest());
    for (const path of candidates) {
      if (await this.playSample(path, { category: "cry", gain: 0.9 })) return { source: "sample", path };
    }
    const speciesId = getCryIdentityIds(pokemon).at(-1) || 1;
    const profile = deterministicCryProfile(speciesId);
    this.playTone({ frequency: profile.startFrequency, end: profile.endFrequency, duration: profile.duration, wave: profile.wave, gain: 0.12 }, this.cryGain);
    return { source: "synth" };
  }

  async playFaint() {
    if (!(await this.unlock())) return { source: "none" };
    if (await this.playSample("faint", { gain: 0.78 })) return { source: "sample" };
    this.playTone({ frequency: 360, end: 42, duration: 0.42, wave: "sawtooth", gain: 0.16 }, this.sfxGain);
    return { source: "synth" };
  }

  async playHealing() {
    if (!(await this.unlock())) return { source: "none" };
    const source = await this.playSample("healing", { gain: 0.7 });
    if (!source) {
      this.playTone({ frequency: 420, end: 960, duration: 0.28, wave: "sine", gain: 0.11 }, this.sfxGain);
    }
    return { source: source ? "sample" : "synth" };
  }

  async playStatus() {
    if (!(await this.unlock())) return { source: "none" };
    const source = await this.playSample("status", { gain: 0.6 });
    if (!source) {
      this.playTone({ frequency: 210, end: 135, duration: 0.18, wave: "square", gain: 0.1 }, this.sfxGain);
    }
    return { source: source ? "sample" : "synth" };
  }

  async playUiSelect() {
    if (!(await this.unlock())) return { source: "none" };
    const source = await this.playSample("ui-select", { gain: 0.45 });
    if (!source) {
      this.playTone({ frequency: 620, end: 760, duration: 0.06, wave: "sine", gain: 0.06 }, this.sfxGain);
    }
    return { source: source ? "sample" : "synth" };
  }

  async playEvolutionCue(pokemon) {
    if (!(await this.unlock())) return { source: "none" };
    const sample = await this.playSample("evolution", { gain: 0.82 });
    if (!sample) {
      [0, 0.1, 0.2, 0.34].forEach((offset, index) => globalThis.setTimeout?.(() => {
        this.playTone({ frequency: [392, 494, 587, 784][index], duration: 0.18, gain: 0.11 }, this.sfxGain);
      }, offset * 1000));
    }
    if (pokemon) globalThis.setTimeout?.(() => this.playCry(pokemon), 420);
    return { source: sample ? "sample" : "synth" };
  }

  setBattleMode(mode) {
    this.pendingMode = MUSIC_PATTERNS[mode] ? mode : "wild";
    this.stopAmbience(0.18, false);
    if (this.context?.state === "running") this.startMusic(this.pendingMode);
  }

  setAmbientArea(area) {
    const normalized = resolveAmbientProfile(area)
      ? String(area).toLowerCase()
      : null;
    this.pendingAmbientArea = normalized;
    if (!normalized) {
      this.stopAmbience(0.3, false);
      return null;
    }
    if (!this.pendingMode && this.context?.state === "running") {
      this.startAmbience(normalized);
    }
    return normalized;
  }

  startAmbience(area) {
    const context = this.ensureContext();
    const profile = resolveAmbientProfile(area);
    if (!context || !profile || this.pendingMode) return null;
    if (this.ambientTrack?.area === area) return this.ambientTrack;

    const previousTrack = this.ambientTrack;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.linearRampToValueAtTime(
      this.settings.musicVolume * 0.42,
      context.currentTime + 0.38,
    );
    gain.connect(this.masterGain);
    const track = {
      area,
      gain,
      interval: null,
      timers: new Set(),
    };
    const schedule = () => {
      if (!this.context || this.settings.muted || this.pendingMode) return;
      profile.notes.forEach((frequency, index) => {
        const timer = globalThis.setTimeout?.(() => {
          track.timers.delete(timer);
          this.playTone(
            {
              frequency,
              end: frequency * (area === "graveyard" ? 0.82 : 1.04),
              duration: 0.55,
              wave: profile.wave,
              gain: profile.gain,
            },
            gain,
          );
        }, index * 240);
        if (timer != null) track.timers.add(timer);
      });
    };
    schedule();
    track.interval = globalThis.setInterval?.(schedule, profile.interval);
    this.ambientTrack = track;
    if (previousTrack) this.stopAmbientTrack(previousTrack, 0.38);
    return track;
  }

  stopAmbientTrack(track, fadeSeconds = 0.3) {
    if (!track) return;
    if (track.interval != null) globalThis.clearInterval?.(track.interval);
    track.timers.forEach((timer) => globalThis.clearTimeout?.(timer));
    track.timers.clear();
    if (this.context && track.gain) {
      const now = this.context.currentTime;
      track.gain.gain.cancelScheduledValues(now);
      track.gain.gain.setValueAtTime(Math.max(0.0001, track.gain.gain.value), now);
      track.gain.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
    }
    globalThis.setTimeout?.(() => track.gain?.disconnect?.(), fadeSeconds * 1000 + 30);
  }

  stopAmbience(fadeSeconds = 0.3, clearPending = true) {
    const track = this.ambientTrack;
    if (track) this.stopAmbientTrack(track, fadeSeconds);
    if (this.ambientTrack === track) this.ambientTrack = null;
    if (clearPending) this.pendingAmbientArea = null;
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
          const oscillator = this.playTone({ frequency, duration: 0.24, wave: "square", gain: 0.045 }, this.musicGain);
          if (oscillator) {
            this.musicOscillators.add(oscillator);
            oscillator.addEventListener?.("ended", () => this.musicOscillators.delete(oscillator), { once: true });
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
    globalThis.setTimeout?.(() => activeOscillators.forEach((oscillator) => {
      try { oscillator.stop?.(); } catch { /* Already stopped. */ }
    }), fadeSeconds * 1000);
  }

  endBattle() {
    this.pendingMode = null;
    this.stopMusic();
    if (this.pendingAmbientArea) {
      globalThis.setTimeout?.(() => this.startAmbience(this.pendingAmbientArea), 240);
    }
  }
}
