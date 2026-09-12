CREATE TYPE "PokemonLocation" AS ENUM ('PARTY', 'STORAGE');

CREATE TABLE "Player" (
  "id" TEXT NOT NULL,
  "trainerName" TEXT NOT NULL DEFAULT 'Player',
  "coins" INTEGER NOT NULL DEFAULT 100,
  "level" INTEGER NOT NULL DEFAULT 1,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "championDefeated" BOOLEAN NOT NULL DEFAULT false,
  "pokedex" JSONB NOT NULL,
  "unlockedAreas" TEXT[] NOT NULL,
  "unlockedGyms" INTEGER[] NOT NULL,
  "defeatedNpcs" INTEGER[] NOT NULL,
  "achievements" TEXT[] NOT NULL,
  "extraState" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerPokemon" (
  "ownedId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "speciesId" INTEGER NOT NULL,
  "legacyLocalId" INTEGER,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "xp" INTEGER NOT NULL,
  "currentHp" INTEGER NOT NULL,
  "maxHp" INTEGER NOT NULL,
  "shiny" BOOLEAN NOT NULL DEFAULT false,
  "formId" TEXT,
  "abilityName" TEXT,
  "status" TEXT,
  "moves" JSONB NOT NULL,
  "data" JSONB NOT NULL,
  "location" "PokemonLocation" NOT NULL,
  "partyPosition" INTEGER,
  "storagePosition" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerPokemon_pkey" PRIMARY KEY ("ownedId")
);

CREATE TABLE "InventoryItem" (
  "playerId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("playerId", "itemId")
);

CREATE TABLE "Badge" (
  "playerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Badge_pkey" PRIMARY KEY ("playerId", "name")
);

CREATE TABLE "StoryState" (
  "playerId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "currentAct" INTEGER NOT NULL,
  "currentChapter" TEXT NOT NULL,
  "flags" TEXT[] NOT NULL,
  "completedEventIds" TEXT[] NOT NULL,
  "rewardedEventIds" TEXT[] NOT NULL,
  "badgeMilestones" TEXT[] NOT NULL,
  "discoveredLocations" TEXT[] NOT NULL,
  CONSTRAINT "StoryState_pkey" PRIMARY KEY ("playerId")
);

CREATE TABLE "RecurringCharacterProgress" (
  "playerId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "introduced" BOOLEAN NOT NULL DEFAULT false,
  "encounterProgress" INTEGER NOT NULL DEFAULT 0,
  "playerWins" INTEGER NOT NULL DEFAULT 0,
  "playerLosses" INTEGER NOT NULL DEFAULT 0,
  "relationship" TEXT,
  "completedSceneIds" TEXT[] NOT NULL,
  "completedBattleIds" TEXT[] NOT NULL,
  "rewardedEncounterIds" TEXT[] NOT NULL,
  "lastResult" JSONB,
  CONSTRAINT "RecurringCharacterProgress_pkey" PRIMARY KEY ("playerId", "characterId")
);

CREATE TABLE "LeagueState" (
  "playerId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completionCount" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "hallOfFame" JSONB,
  CONSTRAINT "LeagueState_pkey" PRIMARY KEY ("playerId")
);

CREATE TABLE "PartyPreset" (
  "playerId" TEXT NOT NULL,
  "slot" INTEGER NOT NULL,
  CONSTRAINT "PartyPreset_pkey" PRIMARY KEY ("playerId", "slot")
);

CREATE TABLE "PartyPresetPokemon" (
  "playerId" TEXT NOT NULL,
  "slot" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "ownedId" TEXT NOT NULL,
  CONSTRAINT "PartyPresetPokemon_pkey" PRIMARY KEY ("playerId", "slot", "position")
);

CREATE TABLE "PersistenceMetadata" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersistenceMetadata_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "PlayerPokemon_playerId_location_partyPosition_idx" ON "PlayerPokemon"("playerId", "location", "partyPosition");
CREATE INDEX "PlayerPokemon_playerId_speciesId_idx" ON "PlayerPokemon"("playerId", "speciesId");
CREATE INDEX "PartyPresetPokemon_ownedId_idx" ON "PartyPresetPokemon"("ownedId");

ALTER TABLE "PlayerPokemon" ADD CONSTRAINT "PlayerPokemon_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryState" ADD CONSTRAINT "StoryState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringCharacterProgress" ADD CONSTRAINT "RecurringCharacterProgress_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueState" ADD CONSTRAINT "LeagueState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyPreset" ADD CONSTRAINT "PartyPreset_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyPresetPokemon" ADD CONSTRAINT "PartyPresetPokemon_playerId_slot_fkey" FOREIGN KEY ("playerId", "slot") REFERENCES "PartyPreset"("playerId", "slot") ON DELETE CASCADE ON UPDATE CASCADE;
