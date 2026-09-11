function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))];
}

function createRecurringCharacterEngine({ characterData = {}, itemCatalog = {} } = {}) {
  const characters = Array.isArray(characterData.characters) ? characterData.characters : [];
  const charactersById = new Map(characters.map((character) => [character.id, character]));
  const encounters = characters.flatMap((character) =>
    (character.encounters || []).map((encounter) => ({ ...encounter, characterId: character.id })),
  );
  const encountersById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
  const encountersByNpcId = new Map(encounters.map((encounter) => [Number(encounter.npcId), encounter]));

  function createCharacterProgress(character, existing = {}) {
    return {
      introduced: Boolean(existing.introduced),
      encounterProgress: Math.max(0, Number(existing.encounterProgress) || 0),
      playerWins: Math.max(0, Number(existing.playerWins) || 0),
      playerLosses: Math.max(0, Number(existing.playerLosses) || 0),
      relationship: String(existing.relationship || character.initialRelationship || "newcomer"),
      completedSceneIds: uniqueStrings(existing.completedSceneIds),
      completedBattleIds: uniqueStrings(existing.completedBattleIds),
      rewardedEncounterIds: uniqueStrings(existing.rewardedEncounterIds),
      lastResult: existing.lastResult || null,
    };
  }

  function normalizeCharacterState(value = {}) {
    const existing = value && typeof value === "object" ? value : {};
    return {
      ...existing,
      ...Object.fromEntries(
        characters.map((character) => [
          character.id,
          createCharacterProgress(character, existing[character.id]),
        ]),
      ),
    };
  }

  function ensureStoryCharacters(playerState) {
    playerState.story ||= {};
    playerState.story.characters = normalizeCharacterState(playerState.story.characters);
    return playerState.story.characters;
  }

  function conditionsMet(encounter, playerState = {}) {
    const conditions = encounter.conditions || {};
    const flags = new Set(playerState.story?.flags || []);
    const badges = new Set(playerState.badges || []);
    const progress = ensureStoryCharacters(playerState)[encounter.characterId];
    if (Number(conditions.minBadges || 0) > badges.size) return false;
    if ((conditions.requiredFlags || []).some((flag) => !flags.has(flag))) return false;
    if ((conditions.requiredBadges || []).some((badge) => !badges.has(badge))) return false;
    if (
      encounter.previousEncounterId &&
      !progress.completedBattleIds.includes(encounter.previousEncounterId)
    ) return false;
    return !progress.completedBattleIds.includes(encounter.id);
  }

  function getEncounterNpc(encounter, playerState) {
    const character = charactersById.get(encounter.characterId);
    if (!character || !conditionsMet(encounter, playerState)) return null;
    return {
      id: Number(encounter.npcId),
      characterId: character.id,
      encounterId: encounter.id,
      area: encounter.area,
      name: character.name,
      title: encounter.title || character.title,
      type: "trainer",
      role: "rival",
      sprite: character.sprite || "trainer-ranger",
      position: encounter.position,
      dialogue: encounter.repeatDialogue || "Our next battle can wait until you are ready.",
      introDialogue: encounter.battleIntro || `${character.name} wants to battle!`,
      team: encounter.team || [],
      rewardCoins: Math.max(0, Number(encounter.reward?.coins) || 0),
      aiDifficulty: encounter.aiDifficulty || "MEDIUM",
      recurringCharacter: true,
      defeated: false,
    };
  }

  function getAreaNpcs(playerState, area) {
    return encounters
      .filter((encounter) => encounter.area === area)
      .map((encounter) => getEncounterNpc(encounter, playerState))
      .filter(Boolean);
  }

  function getNpcById(playerState, npcId) {
    const encounter = encountersByNpcId.get(Number(npcId));
    return encounter ? getEncounterNpc(encounter, playerState) : null;
  }

  function getSceneId(encounterId, phase) {
    return `${encounterId}:${phase}`;
  }

  function getSceneView(encounter, phase) {
    const character = charactersById.get(encounter.characterId);
    const dialogue = encounter[`${phase}Dialogue`];
    if (!character || !Array.isArray(dialogue) || !dialogue.length) return null;
    return {
      id: getSceneId(encounter.id, phase),
      title: phase === "intro" ? encounter.title : `${character.name} - ${phase === "win" ? "After the Battle" : "A Promise to Retry"}`,
      act: encounter.act,
      chapter: `act-${encounter.act}`,
      speaker: { name: character.name, portrait: character.portrait || "ranger" },
      dialogue,
      oneTime: true,
      presentation: "rival",
      characterId: character.id,
      encounterId: encounter.id,
      phase,
    };
  }

  function findScene(sceneId) {
    for (const encounter of encounters) {
      for (const phase of ["intro", "win", "loss"]) {
        if (getSceneId(encounter.id, phase) === sceneId) {
          return { encounter, phase, scene: getSceneView(encounter, phase) };
        }
      }
    }
    return null;
  }

  function shouldPlayIntro(playerState, encounterId) {
    const encounter = encountersById.get(encounterId);
    if (!encounter) return false;
    const progress = ensureStoryCharacters(playerState)[encounter.characterId];
    return !progress.completedSceneIds.includes(getSceneId(encounter.id, "intro"));
  }

  function getIntroScene(playerState, encounterId) {
    const encounter = encountersById.get(encounterId);
    return encounter && shouldPlayIntro(playerState, encounterId)
      ? getSceneView(encounter, "intro")
      : null;
  }

  function hasScene(sceneId) {
    return Boolean(findScene(sceneId));
  }

  function completeScene(playerState, sceneId) {
    const found = findScene(sceneId);
    if (!found?.scene) return { error: "Unknown recurring-character scene" };
    const { encounter, phase, scene } = found;
    let progress = ensureStoryCharacters(playerState)[encounter.characterId];
    if (progress.completedSceneIds.includes(sceneId)) {
      return { success: true, alreadyCompleted: true, event: scene, state: playerState };
    }
    if (phase === "intro" && !conditionsMet(encounter, playerState)) {
      return { error: "Rival encounter requirements are not met" };
    }
    progress = ensureStoryCharacters(playerState)[encounter.characterId];
    progress.completedSceneIds = uniqueStrings([...progress.completedSceneIds, sceneId]);
    if (phase === "intro") progress.introduced = true;
    return {
      success: true,
      alreadyCompleted: false,
      event: scene,
      state: playerState,
      nextAction: phase === "intro"
        ? { type: "rival-battle", npcId: Number(encounter.npcId) }
        : null,
    };
  }

  function applyReward(playerState, encounter, progress) {
    if (progress.rewardedEncounterIds.includes(encounter.id)) return null;
    const reward = encounter.reward || {};
    const coins = Math.max(0, Number(reward.coins) || 0);
    if (coins) {
      playerState.coins = (Number(playerState.coins) || 0) + coins;
      playerState.money = playerState.coins;
    }
    const items = [];
    (reward.items || []).forEach((entry) => {
      if (!itemCatalog[entry.id]) return;
      const quantity = Math.max(1, Number(entry.quantity) || 1);
      playerState.items ||= {};
      playerState.items[entry.id] = (playerState.items[entry.id] || 0) + quantity;
      items.push({ id: entry.id, name: itemCatalog[entry.id].name, quantity });
    });
    progress.rewardedEncounterIds = uniqueStrings([...progress.rewardedEncounterIds, encounter.id]);
    return { coins, items };
  }

  function recordBattleResult(playerState, encounterId, result) {
    const encounter = encountersById.get(encounterId);
    if (!encounter) return { error: "Unknown recurring-character battle" };
    const progress = ensureStoryCharacters(playerState)[encounter.characterId];
    const won = result === "won";
    const alreadyCompleted = progress.completedBattleIds.includes(encounter.id);
    if (won && !alreadyCompleted) {
      progress.playerWins += 1;
      progress.completedBattleIds = uniqueStrings([...progress.completedBattleIds, encounter.id]);
      progress.encounterProgress = progress.completedBattleIds.length;
      progress.relationship = encounter.relationshipAfter || progress.relationship;
      const flags = new Set(playerState.story.flags || []);
      (encounter.setFlags || []).forEach((flag) => flags.add(flag));
      playerState.story.flags = [...flags];
    } else if (!won) {
      progress.playerLosses += 1;
    }
    progress.lastResult = { encounterId: encounter.id, result };
    const phase = won ? "win" : "loss";
    const scene = getSceneView(encounter, phase);
    return {
      success: true,
      alreadyCompleted,
      reward: won && !alreadyCompleted ? applyReward(playerState, encounter, progress) : null,
      storyEvents: scene && !progress.completedSceneIds.includes(scene.id) ? [scene] : [],
      state: playerState,
      progress,
    };
  }

  function getPendingScenes(playerState) {
    const characterStates = ensureStoryCharacters(playerState);
    return characters.flatMap((character) => {
      const progress = characterStates[character.id];
      const pendingWins = (character.encounters || [])
        .filter((encounter) => progress.completedBattleIds.includes(encounter.id))
        .map((encounter) => getSceneView({ ...encounter, characterId: character.id }, "win"));
      const latestLoss =
        progress.lastResult?.result === "lost"
          ? encountersById.get(progress.lastResult.encounterId)
          : null;
      const pendingLoss = latestLoss
        ? getSceneView(latestLoss, "loss")
        : null;
      return [...pendingWins, pendingLoss]
        .filter(Boolean)
        .filter((scene) => !progress.completedSceneIds.includes(scene.id));
    });
  }

  return {
    characters,
    encounters,
    normalizeCharacterState,
    getAreaNpcs,
    getNpcById,
    getIntroScene,
    shouldPlayIntro,
    hasScene,
    completeScene,
    recordBattleResult,
    getPendingScenes,
  };
}

module.exports = { createRecurringCharacterEngine };
