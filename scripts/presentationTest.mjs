import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BATTLE_TYPES,
  getMotionTiming,
  normalizeWeatherVisual,
  resolveBattleIntro,
  resolveBattlePresentationMode,
  resolveHitReaction,
  resolveMoveAnimation,
} from "../frontend/js/battleAnimationRegistry.mjs";
import { getStatusVisual } from "../frontend/js/battleParticles.mjs";
import { playTransformEffect } from "../frontend/js/battleParticles.mjs";
import {
  isWebGLAvailable,
  selectBattleRenderer,
} from "../frontend/js/battleCapabilities.mjs";
import {
  AudioManager,
  AMBIENT_PROFILES,
  AUDIO_SETTINGS_KEY,
  deterministicCryProfile,
  resolveCrySampleCandidates,
  resolveMoveSampleKeys,
  resolveAmbientProfile,
  resumeAudioContext,
  SAMPLE_FILES,
} from "../frontend/js/battleAudio.mjs";
import {
  CAPTURE_BALL_TYPES,
  SerialPresentationQueue,
  createCaptureAnimationPlan,
  createEvolutionAnimationPlan,
  restoreCaptureScene,
} from "../frontend/js/battleCinematics.mjs";
import {
  getBattleConditions,
  getCurrentBattleAbility,
  getEffectivenessDisplay,
  getMoveDisplayData,
  getStageBadges,
  getWeatherDisplay,
} from "../frontend/js/battleTacticalUi.mjs";
import {
  buildTypeGuide,
  filterHandbookEntries,
  getMatchupResult,
  getTypeMultiplier,
} from "../frontend/js/handbookUi.mjs";
import {
  BIOME_PRESENTATIONS,
  createAreaEntryPlan,
  createEncounterTransitionPlan,
  createNpcPresentation,
  getBiomePresentation,
  getTimePresentation,
  normalizeWorldWeather,
  resolveEncounterTransition,
} from "../frontend/js/overworldPresentation.mjs";
import {
  buildEvolutionLayers,
  getEntrySpeciesId,
  getOwnedPokemonMatches,
  getPokedexDiscoveryState,
  getPokedexDisplayVariants,
  getPokedexVariantSummary,
  matchesPokedexFilters,
  selectPokedexDisplayVariant,
} from "../frontend/js/pokedexUi.mjs";

assert.deepEqual(Object.keys(BIOME_PRESENTATIONS).sort(), [
  "cave",
  "desert",
  "forest",
  "graveyard",
  "lake",
  "mountain",
  "volcano",
]);
assert.equal(Object.keys(AMBIENT_PROFILES).length, 7, "Every biome needs ambience");
assert.equal(getBiomePresentation("forest").subtitle, "Dense Woodland");
assert.equal(getBiomePresentation("graveyard").particle, "wisp");
assert.equal(resolveAmbientProfile("lake").wave, "sine");
assert.equal(normalizeWorldWeather("sun"), "sunny");
assert.equal(normalizeWorldWeather("unknown"), "clear");
const daytime = new Date(2026, 0, 1, 10);
const evening = new Date(2026, 0, 1, 18);
const nighttime = new Date(2026, 0, 1, 23);
assert.equal(getTimePresentation(daytime), "day");
assert.equal(getTimePresentation(evening), "evening");
assert.equal(getTimePresentation(nighttime), "night");
assert.equal(resolveEncounterTransition({ rarity: "common" }), "normal");
assert.equal(resolveEncounterTransition({ rarity: "rare" }), "rare");
assert.equal(resolveEncounterTransition({ shiny: true, rarity: "rare" }), "shiny");
assert.equal(resolveEncounterTransition({ rarity: "legendary" }), "legendary");
assert.equal(resolveEncounterTransition({}, { trainer: true }), "trainer");
assert(createEncounterTransitionPlan({ rarity: "legendary" }).duration > 600);
assert(createEncounterTransitionPlan({ rarity: "legendary" }, { reducedMotion: true }).duration <= 180);
assert(createAreaEntryPlan("forest").duration > createAreaEntryPlan("forest", { reducedMotion: true }).duration);
assert.equal(createNpcPresentation({ type: "trainer" }).attention, "challenge");
assert.equal(createNpcPresentation({ type: "guide" }).attention, "interaction");

const pokedexEntry = {
  id: 25,
  speciesId: 25,
  name: "Pikachu",
  types: ["Electric"],
  habitats: ["forest"],
  rarity: "uncommon",
  availability: { status: "wild", areas: ["forest"] },
  seen: true,
  caught: true,
  forms: [
    { id: "normal", seen: true, caught: true, shinySeen: true, shinyCaught: false },
    { id: "cosplay", seen: true, caught: false, shinySeen: false, shinyCaught: false },
  ],
};
assert.equal(getEntrySpeciesId(pokedexEntry), 25);
assert.equal(getPokedexDiscoveryState(pokedexEntry), "caught");
assert.equal(getPokedexDiscoveryState({ seen: true }), "seen");
assert.equal(getPokedexDiscoveryState({}), "unseen");
assert.equal(getPokedexVariantSummary(pokedexEntry).shinySeen, true);
assert.equal(getPokedexVariantSummary(pokedexEntry).discoveredAlternateForms, 1);
const displayVariants = getPokedexDisplayVariants(pokedexEntry);
assert.deepEqual(displayVariants.map((variant) => variant.key), [
  "normal:normal",
  "normal:shiny",
  "cosplay:normal",
]);
assert.equal(selectPokedexDisplayVariant(pokedexEntry, null, true).key, "normal:shiny");
assert.equal(
  selectPokedexDisplayVariant(pokedexEntry, "cosplay:normal", true).key,
  "cosplay:normal",
  "explicit form selection was not preserved",
);
const shinyOnlyEntry = {
  seen: true,
  caught: true,
  forms: [
    { id: "normal", seen: false, caught: false, shinySeen: true, shinyCaught: true },
  ],
};
assert.equal(
  selectPokedexDisplayVariant(shinyOnlyEntry)?.key,
  "normal:shiny",
  "a shiny-only collection entry did not default to its owned shiny artwork",
);
assert(matchesPokedexFilters(pokedexEntry, { search: "#025" }));
assert(matchesPokedexFilters(pokedexEntry, { search: "electric" }));
assert(matchesPokedexFilters(pokedexEntry, { search: "forest" }));
assert(matchesPokedexFilters(pokedexEntry, { search: "uncommon" }));
assert(matchesPokedexFilters(pokedexEntry, { type: "Electric" }));
assert(matchesPokedexFilters(pokedexEntry, { habitat: "forest" }));
assert(matchesPokedexFilters(pokedexEntry, { availability: "wild" }));
assert(matchesPokedexFilters(pokedexEntry, { shiny: "seen" }));
assert(matchesPokedexFilters(pokedexEntry, { forms: "discovered" }));
assert(!matchesPokedexFilters(pokedexEntry, { status: "unseen" }));
assert(matchesPokedexFilters({ ...pokedexEntry, seen: false, caught: false }, { status: "unseen" }));
const ownedPidgeot = { id: 16, speciesId: 18, name: "Pidgeot" };
const ownedPidgey = { id: 237, speciesId: 16, name: "Pidgey" };
assert.deepEqual(
  getOwnedPokemonMatches({ id: 16, speciesId: 18 }, [ownedPidgeot], [ownedPidgey])
    .map(({ pokemon }) => pokemon.name),
  ["Pidgeot"],
  "Pokédex ownership matching regressed to legacy local IDs",
);
const branchingEvolution = {
  evolutionGraph: {
    stages: [
      { speciesId: 133, name: "Eevee" },
      { speciesId: 134, name: "Vaporeon" },
      { speciesId: 135, name: "Jolteon" },
      { speciesId: 136, name: "Flareon" },
    ],
    edges: [
      { fromSpeciesId: 133, toSpeciesId: 134 },
      { fromSpeciesId: 133, toSpeciesId: 135 },
      { fromSpeciesId: 133, toSpeciesId: 136 },
    ],
  },
};
const evolutionLayers = buildEvolutionLayers(branchingEvolution);
assert.equal(evolutionLayers.length, 2);
assert.deepEqual(evolutionLayers[1].stages.map((stage) => stage.name), ["Vaporeon", "Jolteon", "Flareon"]);

const handbookChart = {
  Fire: { Grass: 2, Water: 0.5 },
  Water: { Fire: 2 },
  Grass: { Water: 2 },
  Ghost: { Normal: 0 },
  Normal: { Ghost: 0 },
};
const fireGuide = buildTypeGuide(handbookChart).find((entry) => entry.name === "Fire");
assert(fireGuide.strongAgainst.includes("Grass"));
assert(fireGuide.resistedBy.includes("Water"));
assert(fireGuide.weakAgainst.includes("Water"));
assert.equal(getTypeMultiplier(handbookChart, "Ghost", "Normal"), 0);
assert.equal(getMatchupResult(2).label, "Super Effective");
assert.equal(getMatchupResult(0.5).key, "resisted");
assert.equal(getMatchupResult(0).key, "immune");
assert.equal(getMatchupResult(1).key, "normal");
assert.equal(
  filterHandbookEntries([{ name: "Levitate" }, { name: "Intimidate" }], "levi").length,
  1,
  "Handbook search did not filter ability names",
);

assert.equal(getEffectivenessDisplay(2).label, "SUPER EFFECTIVE");
assert.equal(getEffectivenessDisplay(1).label, "EFFECTIVE");
assert.equal(getEffectivenessDisplay(0.5).label, "NOT VERY EFFECTIVE");
assert.equal(getEffectivenessDisplay(0).label, "NO EFFECT");
const tacticalMove = getMoveDisplayData({
  name: "Quick Attack",
  type: "Normal",
  category: "Physical",
  power: 40,
  accuracy: 100,
  pp: 30,
  maxPp: 30,
  currentPp: 12,
  priority: 1,
});
assert.equal(tacticalMove.power, 40);
assert.equal(tacticalMove.accuracy, 100);
assert.equal(tacticalMove.currentPp, 12);
assert.equal(tacticalMove.maxPp, 30);
assert.equal(tacticalMove.priority, 1);
const tacticalPokemon = {
  name: "Charizard",
  status: "burned",
  ability: { name: "blaze" },
  battleState: {
    stages: { attack: 2, defense: 0, accuracy: -1 },
    volatile: { confusionTurns: 2 },
    protected: true,
    transform: { active: true, originalName: "Ditto", targetName: "Charizard" },
  },
};
assert.deepEqual(getStageBadges(tacticalPokemon).map((entry) => entry.text), ["ATK +2", "ACC -1"]);
assert(getBattleConditions(tacticalPokemon).some((entry) => entry.label === "Burn"));
assert(getBattleConditions(tacticalPokemon).some((entry) => entry.label === "Confused"));
assert(getBattleConditions(tacticalPokemon).some((entry) => entry.label === "Protected"));
assert(getBattleConditions(tacticalPokemon).some((entry) => entry.label === "Ditto transformed into Charizard"));
assert.equal(getCurrentBattleAbility(tacticalPokemon).label, "Blaze");
assert.equal(getCurrentBattleAbility(tacticalPokemon).copied, true);
assert.equal(getWeatherDisplay("rain").label, "Rain");
assert(getWeatherDisplay("sandstorm").description.includes("Rock"));

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
assert.equal(physical.archetype, "contact", "physical move did not use contact choreography");
assert.deepEqual(
  physical.phases,
  ["anticipation", "buildup", "travel", "impact", "recovery"],
  "move choreography phases are incomplete",
);

BATTLE_TYPES.forEach((type) => {
  const animation = resolveMoveAnimation({ name: "Test", type, category: "Special" });
  assert(animation.family, `${type} has no animation family`);
  assert.equal(animation.type, type, `${type} animation changed move type`);
  assert(animation.layers.length >= 2, `${type} does not have layered effects`);
});

assert.equal(
  resolveMoveAnimation({ name: "Solar Beam", type: "Grass", category: "Special" }).archetype,
  "beam",
  "beam move did not use beam choreography",
);
assert.equal(
  resolveMoveAnimation({ name: "Blizzard", type: "Ice", category: "Special" }).archetype,
  "area",
  "area move did not use area choreography",
);
assert.equal(
  resolveMoveAnimation({ name: "Hypnosis", type: "Psychic", category: "Status" }).archetype,
  "setup",
  "status move did not use setup choreography",
);

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
assert.equal(resolveMoveAnimation({ name: "Surf", type: "Water", category: "Special" }).archetype, "area");
assert.equal(resolveMoveAnimation({ name: "Earthquake", type: "Ground", category: "Physical" }).archetype, "ground");
assert.equal(resolveMoveAnimation({ name: "Shadow Ball", type: "Ghost", category: "Special" }).archetype, "mystic");

assert.equal(resolveHitReaction({ damage: 0, effectiveness: 0 }).id, "immune");
assert.equal(resolveHitReaction({ damage: 8, maxHp: 100, effectiveness: 0.5 }).id, "resisted");
assert.equal(resolveHitReaction({ damage: 18, maxHp: 100, effectiveness: 2 }).id, "effective");
assert.equal(resolveHitReaction({ damage: 18, maxHp: 100, critical: true }).id, "critical");
assert.equal(resolveHitReaction({ damage: 38, maxHp: 100 }).id, "heavy");
assert.equal(resolveHitReaction({ damage: 8, maxHp: 100 }).id, "light");

["burned", "poisoned", "paralyzed", "asleep", "frozen", "confused"].forEach((status) => {
  assert(getStatusVisual(status), `${status} has no persistent visual`);
  assert(getStatusVisual(status, true).count <= 2, `${status} ignores reduced motion`);
});
assert.equal(normalizeWeatherVisual("sunny"), "sun");
assert.equal(normalizeWeatherVisual("rain"), "rain");
assert.equal(normalizeWeatherVisual("unsupported"), "clear");
assert.equal(
  await playTransformEffect(null, "Charizard", true),
  false,
  "Transform presentation did not fail safely without a mounted battle scene",
);
["wild", "trainer", "gym", "elite", "champion", "legendary"].forEach((mode) => {
  assert(resolveBattleIntro(mode).label, `${mode} has no intro presentation`);
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

CAPTURE_BALL_TYPES.forEach((ballType) => {
  const plan = createCaptureAnimationPlan({ ballType, caught: true, random: () => 0 });
  assert.equal(plan.ballType, ballType, `${ballType} did not keep its visual identity`);
  assert.equal(plan.caught, true, `${ballType} capture plan changed the server result`);
  assert.equal(plan.shakeCount, 3, `${ballType} success plan omitted capture shakes`);
  assert.equal(plan.steps.at(-1).id, "success", `${ballType} has no success ending`);
});

const failedCapture = createCaptureAnimationPlan({
  ballType: "great",
  caught: false,
  random: () => 0.99,
});
assert.equal(failedCapture.shakeCount, 2, "failed capture exceeded 0-2 shakes");
assert.equal(failedCapture.steps.at(-1).id, "breakout", "failed capture has no breakout");
assert.equal(failedCapture.restoreOpponent, true, "failed capture did not restore opponent");
assert.equal(failedCapture.caught, false, "presentation changed a failed capture result");

const removedCaptureClasses = [];
let captureLayerRemoved = false;
restoreCaptureScene({
  querySelectorAll: () => [{ remove: () => { captureLayerRemoved = true; } }],
  querySelector: () => ({
    classList: { remove: (...names) => removedCaptureClasses.push(...names) },
  }),
});
assert.equal(captureLayerRemoved, true, "failed capture layer was not removed");
assert.deepEqual(
  removedCaptureClasses,
  ["capture-absorbing", "capture-contained"],
  "failed capture did not restore the opponent sprite",
);

const reducedCapture = createCaptureAnimationPlan({
  ballType: "master",
  caught: true,
  reducedMotion: true,
});
assert.equal(reducedCapture.shakeCount, 1, "reduced motion retained full shaking");
assert(
  reducedCapture.steps.every((step) => step.duration <= 180),
  "reduced capture motion remained too long",
);

const evolutionBefore = {
  id: 37,
  speciesId: 37,
  name: "Vulpix",
  shiny: true,
  form: { id: "alolan", name: "Alolan Form", imageId: 10103 },
};
const evolutionAfter = {
  id: 38,
  speciesId: 38,
  name: "Ninetales",
  shiny: true,
  form: { id: "alolan", name: "Alolan Form", imageId: 10104 },
};
const evolutionPlan = createEvolutionAnimationPlan({
  before: evolutionBefore,
  after: evolutionAfter,
});
assert.equal(evolutionPlan.before.name, "Vulpix", "evolution lost before identity");
assert.equal(evolutionPlan.after.name, "Ninetales", "evolution lost after identity");
assert.equal(evolutionPlan.before.shiny, true, "evolution visual lost shiny state");
assert.equal(evolutionPlan.after.form.id, "alolan", "evolution visual lost form state");
assert.deepEqual(evolutionBefore.form, { id: "alolan", name: "Alolan Form", imageId: 10103 });

const evolutionQueue = new SerialPresentationQueue();
evolutionQueue.enqueue({ from: "Bulbasaur", to: "Ivysaur", ownedSlot: 1 });
evolutionQueue.enqueue({ from: "Bulbasaur", to: "Ivysaur", ownedSlot: 2 });
assert.equal(evolutionQueue.next().ownedSlot, 1, "evolution queue did not start first event");
assert.equal(evolutionQueue.next(), null, "evolution queue overlapped active events");
assert.equal(evolutionQueue.complete().ownedSlot, 2, "evolution queue deduplicated a valid event");

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
const ambientAudio = new AudioManager({ storage, AudioContextClass: null });
assert.equal(ambientAudio.setAmbientArea("forest"), "forest");
assert.equal(ambientAudio.pendingAmbientArea, "forest");
assert.equal(ambientAudio.setAmbientArea("lake"), "lake");
assert.equal(ambientAudio.pendingAmbientArea, "lake", "ambience did not switch areas");
assert.equal(ambientAudio.setAmbientArea("not-an-area"), null);
assert.equal(ambientAudio.pendingAmbientArea, null, "invalid ambience did not stop safely");
const blockedAudioContext = {
  state: "suspended",
  resume: () => new Promise(() => {}),
};
const blockedAudioStartedAt = Date.now();
assert.equal(
  await resumeAudioContext(blockedAudioContext, 10),
  false,
  "blocked audio context incorrectly reported as available",
);
assert(
  Date.now() - blockedAudioStartedAt < 250,
  "blocked audio context can freeze presentation actions",
);

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
assert.equal(
  (await sampleFirst.playCaptureCue("success")).source,
  "sample",
  "capture cue did not prefer a local sample",
);
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

const frontendSource = fs.readFileSync(path.join(rootDir, "frontend/script.js"), "utf8");
const frontendIndex = fs.readFileSync(path.join(rootDir, "frontend/index.html"), "utf8");
const frontendStyles = fs.readFileSync(path.join(rootDir, "frontend/style.css"), "utf8");
const encounterRules = JSON.parse(
  fs.readFileSync(path.join(rootDir, "data/encounters.json"), "utf8"),
);
assert.equal(encounterRules.legendaryRollChance, 0.15, "presentation changed legendary odds");
assert.equal(encounterRules.shinyRollChance, 0.03, "presentation changed shiny odds");
assert.deepEqual(
  encounterRules.rarityWeights,
  { common: 60, uncommon: 25, rare: 10, legendary: 3, mythical: 1 },
  "presentation changed rarity weights",
);
assert(frontendIndex.includes('data-screen="handbook"'), "Handbook navigation tab is missing");
assert(frontendIndex.includes('id="handbook-screen"'), "Handbook screen is missing");
assert(!frontendIndex.includes('data-screen="quests"'), "Quest navigation remains visible");
assert(!frontendIndex.includes('id="quests-screen"'), "Quest screen remains in the UI");
assert(frontendSource.includes('fetch("/api/handbook")'), "Handbook data is not loaded from the backend");
assert(frontendSource.includes("renderBattleHandbookShortcut"), "Battle Handbook shortcut is missing");
assert(frontendSource.includes("renderTypeMatchupExplorer"), "Battle Academy Type Explorer is missing");
assert(frontendSource.includes("Advanced battle notes"), "Advanced type chart disclosure is missing");
assert(frontendSource.includes("renderBattleTips"), "Trainer coaching cards are missing");
assert(frontendSource.includes("syncOverworldPresentation"), "Overworld lifecycle is not integrated");
assert(frontendSource.includes('playEncounterTransition'), "Encounter transition is not integrated");
assert(frontendSource.includes('playTrainerTransition'), "Trainer transition is not integrated");
assert(
  !frontendSource.includes('querySelector(".status-line").innerHTML'),
  "Wild battle refresh still assumes the removed legacy status line exists",
);
assert(
  frontendStyles.includes(".handbook-type-grid") &&
    frontendStyles.includes(".type-matchup-explorer") &&
    frontendStyles.includes(".battle-tips-block") &&
    frontendStyles.includes("@media (max-width: 760px)"),
  "Handbook responsive styles are missing",
);
assert(
  frontendStyles.includes(".route-atmosphere") &&
    frontendStyles.includes(".area-entry-cinematic") &&
    frontendStyles.includes(".transition-legendary") &&
    frontendStyles.includes("@media (prefers-reduced-motion: reduce)"),
  "Premium overworld presentation styles are missing",
);
const catchRequestCount = (frontendSource.match(/fetch\("\/api\/catch"/g) || []).length;
assert.equal(catchRequestCount, 1, "capture UI can issue duplicate catch requests");
assert(
  frontendSource.includes('runBattlePresentation("restoreCaptureScene")'),
  "capture request errors do not restore the opponent scene",
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
  `[presentation] OK: types=${BATTLE_TYPES.length}, signatures=${Object.keys(signatureMoves).length}, samples=${Object.keys(SAMPLE_FILES).length}, fallback=css`,
);
