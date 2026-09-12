const { Prisma } = require("@prisma/client");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nullableJson(value) {
  return value === null || value === undefined ? Prisma.DbNull : value;
}

async function loadStoryState(client, playerId) {
  const [story, recurringProgress, league, badges, presets] = await Promise.all([
    client.storyState.findUnique({ where: { playerId } }),
    client.recurringCharacterProgress.findMany({ where: { playerId } }),
    client.leagueState.findUnique({ where: { playerId } }),
    client.badge.findMany({ where: { playerId }, orderBy: { earnedAt: "asc" } }),
    client.partyPreset.findMany({
      where: { playerId },
      include: { members: { orderBy: { position: "asc" } } },
      orderBy: { slot: "asc" },
    }),
  ]);
  const characters = Object.fromEntries(
    recurringProgress.map((entry) => [
      entry.characterId,
      {
        introduced: entry.introduced,
        encounterProgress: entry.encounterProgress,
        playerWins: entry.playerWins,
        playerLosses: entry.playerLosses,
        relationship: entry.relationship,
        completedSceneIds: entry.completedSceneIds,
        completedBattleIds: entry.completedBattleIds,
        rewardedEncounterIds: entry.rewardedEncounterIds,
        lastResult: entry.lastResult || null,
      },
    ]),
  );
  return {
    badges: badges.map((badge) => badge.name),
    story: story
      ? {
          version: story.version,
          currentAct: story.currentAct,
          currentChapter: story.currentChapter,
          flags: story.flags,
          completedEventIds: story.completedEventIds,
          rewardedEventIds: story.rewardedEventIds,
          badgeMilestones: story.badgeMilestones,
          discoveredLocations: story.discoveredLocations,
          characters,
        }
      : null,
    league: league
      ? {
          version: league.version,
          completed: league.completed,
          completionCount: league.completionCount,
          completedAt: league.completedAt?.toISOString() || null,
          hallOfFame: league.hallOfFame || null,
        }
      : null,
    partyPresets: presets.map((preset) => ({
      slot: preset.slot,
      pokemonIds: preset.members.map((member) => member.ownedId),
    })),
  };
}

async function saveBadges(client, playerId, badges = []) {
  await client.badge.deleteMany({ where: { playerId } });
  const rows = [...new Set(asArray(badges).map(String))].map((name) => ({
    playerId,
    name,
  }));
  if (rows.length) await client.badge.createMany({ data: rows });
}

async function saveStoryState(client, playerId, story = {}) {
  const storyData = {
    version: String(story.version || "story-v1"),
    currentAct: Math.max(1, Number(story.currentAct) || 1),
    currentChapter: String(story.currentChapter || "act-1"),
    flags: asArray(story.flags).map(String),
    completedEventIds: asArray(story.completedEventIds).map(String),
    rewardedEventIds: asArray(story.rewardedEventIds).map(String),
    badgeMilestones: asArray(story.badgeMilestones).map(String),
    discoveredLocations: asArray(story.discoveredLocations).map(String),
  };
  await client.storyState.upsert({
    where: { playerId },
    create: { playerId, ...storyData },
    update: storyData,
  });
  await client.recurringCharacterProgress.deleteMany({ where: { playerId } });
  const characterRows = Object.entries(story.characters || {}).map(
    ([characterId, progress]) => ({
      playerId,
      characterId,
      introduced: Boolean(progress.introduced),
      encounterProgress: Math.max(0, Number(progress.encounterProgress) || 0),
      playerWins: Math.max(0, Number(progress.playerWins) || 0),
      playerLosses: Math.max(0, Number(progress.playerLosses) || 0),
      relationship: progress.relationship ? String(progress.relationship) : null,
      completedSceneIds: asArray(progress.completedSceneIds).map(String),
      completedBattleIds: asArray(progress.completedBattleIds).map(String),
      rewardedEncounterIds: asArray(progress.rewardedEncounterIds).map(String),
      lastResult: nullableJson(progress.lastResult),
    }),
  );
  if (characterRows.length) {
    await client.recurringCharacterProgress.createMany({ data: characterRows });
  }
}

async function saveLeagueState(client, playerId, league = {}) {
  const data = {
    version: String(league.version || "league-v1"),
    completed: Boolean(league.completed),
    completionCount: Math.max(0, Number(league.completionCount) || 0),
    completedAt: league.completedAt ? new Date(league.completedAt) : null,
    hallOfFame: nullableJson(league.hallOfFame),
  };
  await client.leagueState.upsert({
    where: { playerId },
    create: { playerId, ...data },
    update: data,
  });
}

async function savePartyPresets(client, playerId, presets = []) {
  await client.partyPresetPokemon.deleteMany({ where: { playerId } });
  await client.partyPreset.deleteMany({ where: { playerId } });
  for (const preset of asArray(presets)) {
    const slot = Number(preset.slot);
    if (!Number.isInteger(slot) || slot < 1) continue;
    await client.partyPreset.create({
      data: {
        playerId,
        slot,
        members: {
          create: asArray(preset.pokemonIds).map((ownedId, position) => ({
            position,
            ownedId: String(ownedId),
          })),
        },
      },
    });
  }
}

async function saveLeagueState(client, playerId, league = {}) {
  const data = {
    version: String(league.version || "league-v1"),
    completed: Boolean(league.completed),
    completionCount: Math.max(0, Number(league.completionCount) || 0),
    completedAt: league.completedAt ? new Date(league.completedAt) : null,
    hallOfFame: nullableJson(league.hallOfFame),
  };
  await client.leagueState.upsert({
    where: { playerId },
    create: { playerId, ...data },
    update: data,
  });
}

async function savePartyPresets(client, playerId, presets = []) {
  await client.partyPresetPokemon.deleteMany({ where: { playerId } });
  await client.partyPreset.deleteMany({ where: { playerId } });
  for (const preset of asArray(presets)) {
    const slot = Number(preset.slot);
    if (!Number.isInteger(slot) || slot < 1) continue;
    await client.partyPreset.create({
      data: {
        playerId,
        slot,
        members: {
          create: asArray(preset.pokemonIds).map((ownedId, position) => ({
            position,
            ownedId: String(ownedId),
          })),
        },
      },
    });
  }
}

module.exports = {
  loadStoryState,
  saveBadges,
  saveStoryState,
  saveLeagueState,
  savePartyPresets,
};
