import assert from "node:assert/strict";
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
  `[presentation] OK: types=${BATTLE_TYPES.length}, signatures=${Object.keys(signatureMoves).length}, fallback=css`,
);
