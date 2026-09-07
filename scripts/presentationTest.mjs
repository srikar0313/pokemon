import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BATTLE_TYPES,
  getMotionTiming,
  resolveBattlePresentationMode,
  resolveMoveAnimation,
} from "../frontend/js/battleAnimationRegistry.mjs";
import {
  isWebGLAvailable,
  selectBattleRenderer,
} from "../frontend/js/battleCapabilities.mjs";
import {
  AudioManager,
  AUDIO_SETTINGS_KEY,
  deterministicCryProfile,
  resolveCrySampleCandidates,
  resolveMoveSampleKeys,
  SAMPLE_FILES,
} from "../frontend/js/battleAudio.mjs";

const move = {
  name: "Body Slam",
  type: "Normal",
  category: "Physical",
  power: 85,
  damage: 42,
  winner: "player",
};
const originalMove = structuredClone(move);
const physical = resolveMoveAnimation(move);
assert.deepEqual(move, originalMove, "presentation resolution mutated battle metadata");
assert.equal(physical.motion, "lunge", "physical move did not use lunge fallback");
assert.equal(physical.family, "impact", "Normal move did not use impact family");

BATTLE_TYPES.forEach((type) => {
  const animation = resolveMoveAnimation({ name: "Test", type, category: "Special" });
  assert(animation.family, `${type} has no animation family`);
  assert.equal(animation.type, type, `${type} animation changed move type`);
});

const signatureMoves = {
  Thunderbolt: "thunderbolt",
  Flamethrower: "flamethrower",
  Surf: "surf",
  Earthquake: "earthquake",
  "Shadow Ball": "shadow-ball",
  "Ice Beam": "ice-beam",
  "Hyper Beam": "hyper-beam",
};
Object.entries(signatureMoves).forEach(([name, expectedId]) => {
  const animation = resolveMoveAnimation({ name, type: "Normal", category: "Special" });
  assert.equal(animation.id, expectedId, `${name} did not use its specific animation`);
  assert.equal(animation.specific, true, `${name} was not marked as a specific override`);
});

assert.equal(isWebGLAvailable(null), false, "missing DOM did not select WebGL fallback");
assert.equal(
  selectBattleRenderer({ webglAvailable: false }),
  "css",
  "WebGL failure did not select CSS presentation",
);
assert.equal(
  selectBattleRenderer({ webglAvailable: true }),
  "webgl",
  "available WebGL did not select WebGL presentation",
);

const reduced = getMotionTiming(true, 800);
assert.equal(reduced.camera, false, "reduced motion retained camera movement");
assert.equal(reduced.shake, false, "reduced motion retained battle shake");
assert(reduced.duration <= 120, "reduced motion duration remained aggressive");

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
const firstAudio = new AudioManager({ storage, AudioContextClass: null });
firstAudio.saveSettings({
  musicVolume: 0.44,
  sfxVolume: 0.71,
  cryVolume: 0.33,
  muted: true,
  reduceMotion: true,
});
assert(memory.has(AUDIO_SETTINGS_KEY), "audio settings were not persisted");
const secondAudio = new AudioManager({ storage, AudioContextClass: null });
assert.equal(secondAudio.settings.musicVolume, 0.44, "music volume did not reload");
assert.equal(secondAudio.settings.sfxVolume, 0.71, "SFX volume did not reload");
assert.equal(secondAudio.settings.cryVolume, 0.33, "cry volume did not reload");
assert.equal(secondAudio.settings.muted, true, "mute setting did not reload");
assert.equal(secondAudio.settings.reduceMotion, true, "motion setting did not reload");

assert.deepEqual(
  deterministicCryProfile(25),
  deterministicCryProfile(25),
  "species cry profile is not deterministic",
);
assert.notDeepEqual(
  deterministicCryProfile(25),
  deterministicCryProfile(26),
  "different species received the same cry identity",
);

assert.deepEqual(
  resolveMoveSampleKeys({ name: "Thunderbolt", type: "Electric" }),
  ["electric", "critical"],
  "Thunderbolt did not resolve its layered sample override",
);
assert.deepEqual(
  resolveMoveSampleKeys({ name: "Unknown Move", type: "Water" }),
  ["water"],
  "type sample fallback did not resolve",
);

const cryManifest = {
  cries: {
    25: "/assets/audio/cries/25.ogg",
    10025: "/assets/audio/cries/10025.ogg",
  },
};
assert.deepEqual(
  resolveCrySampleCandidates(
    { speciesId: 25, form: { pokemonId: 10025 } },
    cryManifest,
  ),
  ["/assets/audio/cries/10025.ogg", "/assets/audio/cries/25.ogg"],
  "form cry did not fall back to base species in the correct order",
);
assert.deepEqual(
  resolveCrySampleCandidates({ speciesId: 26 }, cryManifest),
  [],
  "missing cry unexpectedly resolved a sample",
);

class TestAudioManager extends AudioManager {
  constructor(sampleAvailable) {
    super({ storage, AudioContextClass: null, cryManifest: { cries: {} } });
    this.sampleAvailable = sampleAvailable;
    this.tonesPlayed = 0;
  }

  async unlock() {
    return true;
  }

  async playSample() {
    return this.sampleAvailable ? { started: true } : null;
  }

  playTone() {
    this.tonesPlayed += 1;
    return { started: true };
  }
}

const sampleFirst = new TestAudioManager(true);
assert.equal((await sampleFirst.playHit()).source, "sample", "sample was not preferred");
assert.equal(sampleFirst.tonesPlayed, 0, "synth played over an available sample");
sampleFirst.cryManifest = cryManifest;
assert.deepEqual(
  await sampleFirst.playCry({ speciesId: 25, form: { pokemonId: 10025 } }),
  { source: "sample", path: "/assets/audio/cries/10025.ogg" },
  "local form cry was not preferred over synthesis",
);

const synthFallback = new TestAudioManager(false);
assert.equal((await synthFallback.playHit()).source, "synth", "missing sample did not use synth");
assert.equal(synthFallback.tonesPlayed, 1, "synth fallback was not played exactly once");
assert.equal((await synthFallback.playCry({ speciesId: 25 })).source, "synth");

let fetchCount = 0;
let startedSources = 0;
class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.destination = {};
  }

  createGain() {
    return {
      connect() {},
      gain: {
        value: 1,
        setTargetAtTime() {},
        setValueAtTime() {},
        cancelScheduledValues() {},
        linearRampToValueAtTime() {},
      },
    };
  }

  createBufferSource() {
    return {
      playbackRate: { value: 1 },
      connect() {},
      start() { startedSources += 1; },
    };
  }

  decodeAudioData() {
    return Promise.resolve({ decoded: true });
  }
}

const cachedAudio = new AudioManager({
  storage: {
    getItem: () => null,
    setItem() {},
  },
  AudioContextClass: FakeAudioContext,
  cryManifest: { cries: {} },
  fetchFn: async () => {
    fetchCount += 1;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  },
});
await Promise.all([
  cachedAudio.loadAudioBuffer("hit-light"),
  cachedAudio.loadAudioBuffer("hit-light"),
]);
assert.equal(fetchCount, 1, "AudioBuffer cache fetched the same sample twice");
await Promise.all([
  cachedAudio.playSample("hit-light"),
  cachedAudio.playSample("hit-light"),
]);
assert.equal(startedSources, 2, "overlapping sample sources were not created");
assert(Object.values(SAMPLE_FILES).every((path) => path.endsWith(".ogg")));
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
new Set(Object.values(SAMPLE_FILES)).forEach((samplePath) => {
  const localPath = path.join(rootDir, samplePath.replace(/^\//, ""));
  assert(fs.existsSync(localPath), `mapped sample is missing: ${samplePath}`);
});
const generatedCryManifest = JSON.parse(
  fs.readFileSync(path.join(rootDir, "assets/audio/cries/manifest.json"), "utf8"),
);
assert.equal(generatedCryManifest.version, 1, "cry manifest version is invalid");
assert.equal(typeof generatedCryManifest.cries, "object", "cry manifest is invalid");

assert.equal(resolveBattlePresentationMode("wild", { rarity: "common" }), "wild");
assert.equal(resolveBattlePresentationMode("npc", {}), "trainer");
assert.equal(resolveBattlePresentationMode("gym", {}), "gym");
assert.equal(resolveBattlePresentationMode("elite", {}), "elite");
assert.equal(resolveBattlePresentationMode("champion", {}), "champion");
assert.equal(
  resolveBattlePresentationMode("wild", { rarity: "legendary" }),
  "legendary",
);

console.log(
  `[presentation] OK: types=${BATTLE_TYPES.length}, signatures=${Object.keys(signatureMoves).length}, samples=${Object.keys(SAMPLE_FILES).length}, fallback=css`,
);
