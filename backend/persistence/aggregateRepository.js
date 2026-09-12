const { getPrismaClient } = require("./prismaClient");
const { loadPlayer, savePlayer } = require("./playerRepository");
const { loadOwnedPokemon, saveOwnedPokemon } = require("./pokemonRepository");
const { loadInventory, saveInventory } = require("./inventoryRepository");
const {
  loadStoryState,
  saveBadges,
  saveStoryState,
  saveLeagueState,
  savePartyPresets,
} = require("./storyRepository");

const DEFAULT_PLAYER_ID = "local-player";

function createAggregateRepository({ prisma = getPrismaClient() } = {}) {
  async function loadAggregate(playerId = DEFAULT_PLAYER_ID) {
    const player = await loadPlayer(prisma, playerId);
    if (!player) return null;
    const [owned, items, storyData] = await Promise.all([
      loadOwnedPokemon(prisma, playerId),
      loadInventory(prisma, playerId),
      loadStoryState(prisma, playerId),
    ]);
    return {
      player: {
        ...(player.extraState || {}),
        trainerName: player.trainerName,
        coins: player.coins,
        money: player.coins,
        level: player.level,
        xp: player.xp,
        championDefeated: player.championDefeated,
        pokedex: player.pokedex,
        unlockedAreas: player.unlockedAreas,
        unlockedGyms: player.unlockedGyms,
        defeatedNpcs: player.defeatedNpcs,
        achievements: player.achievements,
        items,
        badges: storyData.badges,
        story: storyData.story || {},
        league: storyData.league || {},
        partyPresets: storyData.partyPresets,
      },
      team: owned.team,
      storage: owned.storage,
    };
  }

  async function saveWithClient(client, aggregate, playerId) {
    const state = aggregate.player || {};
    await savePlayer(client, playerId, state);
    await saveOwnedPokemon(
      client,
      playerId,
      aggregate.team || [],
      aggregate.storage || [],
    );
    await saveInventory(client, playerId, state.items || {});
    await saveBadges(client, playerId, state.badges || []);
    await saveStoryState(client, playerId, state.story || {});
    await saveLeagueState(client, playerId, state.league || {});
    await savePartyPresets(client, playerId, state.partyPresets || []);
  }

  async function saveAggregate(aggregate, playerId = DEFAULT_PLAYER_ID) {
    return prisma.$transaction((transaction) =>
      saveWithClient(transaction, aggregate, playerId),
    );
  }

  async function importLegacy(
    aggregate,
    { playerId = DEFAULT_PLAYER_ID, importKey = `legacy-json:${playerId}` } = {},
  ) {
    return prisma.$transaction(async (transaction) => {
      const imported = await transaction.persistenceMetadata.findUnique({
        where: { key: importKey },
      });
      if (imported) return { imported: false, reason: "already-imported" };
      await saveWithClient(transaction, aggregate, playerId);
      await transaction.persistenceMetadata.create({
        data: {
          key: importKey,
          value: {
            playerId,
            importedAt: new Date().toISOString(),
            partyCount: (aggregate.team || []).length,
            storageCount: (aggregate.storage || []).length,
          },
        },
      });
      return { imported: true };
    });
  }

  return {
    connect: () => prisma.$connect(),
    loadAggregate,
    saveAggregate,
    saveWithClient,
    importLegacy,
  };
}

module.exports = { DEFAULT_PLAYER_ID, createAggregateRepository };
