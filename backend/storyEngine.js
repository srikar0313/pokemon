const STORY_STATE_VERSION = "story-v1";

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))];
}

function createStoryEngine({
  storyData = {},
  itemCatalog = {},
  normalizeCharacters = (characters) =>
    characters && typeof characters === "object" ? characters : {},
} = {}) {
  const chapters = Array.isArray(storyData.chapters) ? storyData.chapters : [];
  const events = Array.isArray(storyData.events) ? storyData.events : [];
  const eventsById = new Map(events.map((event) => [event.id, event]));

  function getChapterForProgress(playerState = {}) {
    const badgeCount = (playerState.badges || []).length;
    const available = chapters.filter(
      (chapter) =>
        badgeCount >= Number(chapter.minBadges || 0) &&
        (!chapter.requiresChampion || playerState.championDefeated),
    );
    return available.at(-1) || chapters[0] || { id: "act-1", act: 1 };
  }

  function conditionsMet(event, playerState = {}, context = {}) {
    const conditions = event?.conditions || {};
    const flags = new Set(playerState.story?.flags || []);
    const badges = new Set(playerState.badges || []);
    if (conditions.area && conditions.area !== context.area) return false;
    if (
      conditions.gymId !== undefined &&
      Number(conditions.gymId) !== Number(context.gymId)
    ) {
      return false;
    }
    if (conditions.badge && !badges.has(conditions.badge)) return false;
    if (
      conditions.triggerBadge &&
      context.badge &&
      conditions.triggerBadge !== context.badge
    ) {
      return false;
    }
    if (Number(conditions.minBadges || 0) > badges.size) return false;
    if (
      (conditions.requiredBadges || []).some((badge) => !badges.has(badge)) ||
      (conditions.excludedBadges || []).some((badge) => badges.has(badge)) ||
      (conditions.requiredFlags || []).some((flag) => !flags.has(flag)) ||
      (conditions.excludedFlags || []).some((flag) => flags.has(flag))
    ) {
      return false;
    }
    if (
      conditions.championDefeated !== undefined &&
      Boolean(playerState.championDefeated) !== conditions.championDefeated
    ) {
      return false;
    }
    return true;
  }

  function normalizeStoryState(story, playerState = {}) {
    const existing = story && typeof story === "object" ? story : {};
    const migrating = existing.version !== STORY_STATE_VERSION;
    const completedEventIds = new Set(uniqueStrings(existing.completedEventIds));
    const rewardedEventIds = new Set(uniqueStrings(existing.rewardedEventIds));
    const flags = new Set(uniqueStrings(existing.flags));
    const badgeMilestones = new Set(uniqueStrings(existing.badgeMilestones));
    const discoveredLocations = new Set(uniqueStrings(existing.discoveredLocations));

    if (migrating) {
      const hasPriorJourney =
        (playerState.badges || []).length > 0 ||
        (playerState.defeatedNpcs || []).length > 0 ||
        (playerState.pokedex?.seen || []).length > 0 ||
        Number(playerState.level || 1) > 1;
      if (hasPriorJourney) {
        flags.add("journey_started");
        completedEventIds.add("prologue-first-light");
      }
      events
        .filter((event) => event.migrateIfSatisfied && !event.conditions?.area)
        .forEach((event) => {
          const migrationState = {
            ...playerState,
            story: { flags: [...flags] },
          };
          if (!conditionsMet(event, migrationState, {})) return;
          completedEventIds.add(event.id);
          (event.setFlags || []).forEach((flag) => flags.add(flag));
          if (event.badgeMilestone) badgeMilestones.add(event.badgeMilestone);
        });
    }

    const progressChapter = getChapterForProgress(playerState);
    const requestedAct = Number(existing.currentAct || 1);
    const currentAct = Math.max(requestedAct, Number(progressChapter.act || 1));
    const currentChapter =
      chapters.find((chapter) => chapter.act === currentAct)?.id ||
      existing.currentChapter ||
      progressChapter.id;

    return {
      version: STORY_STATE_VERSION,
      currentAct,
      currentChapter,
      flags: [...flags],
      completedEventIds: [...completedEventIds],
      rewardedEventIds: [...rewardedEventIds],
      badgeMilestones: [...badgeMilestones],
      discoveredLocations: [...discoveredLocations],
      characters: normalizeCharacters(existing.characters),
    };
  }

  function getEventView(event) {
    return {
      id: event.id,
      title: event.title,
      act: event.act,
      chapter: event.chapter,
      speaker: event.speaker,
      dialogue: event.dialogue || [],
      reward: event.reward || null,
      oneTime: event.oneTime !== false,
      presentation: event.presentation || "story",
      theme: event.theme || null,
    };
  }

  function getEligibleEvents(playerState = {}, trigger, context = {}) {
    const state = {
      ...playerState,
      story: normalizeStoryState(playerState.story, playerState),
    };
    const completed = new Set(state.story.completedEventIds);
    return events
      .filter((event) => (event.triggers || []).includes(trigger))
      .filter((event) => !(event.oneTime !== false && completed.has(event.id)))
      .filter((event) => conditionsMet(event, state, context))
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
      .map(getEventView);
  }

  function applyReward(playerState, event) {
    const reward = event.reward || null;
    if (!reward) return null;
    const rewarded = new Set(playerState.story.rewardedEventIds);
    if (rewarded.has(event.id)) return null;
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
    rewarded.add(event.id);
    playerState.story.rewardedEventIds = [...rewarded];
    return { coins, items };
  }

  function completeEvent(playerState = {}, eventId, context = {}) {
    const event = eventsById.get(eventId);
    if (!event) return { error: "Unknown story event" };
    playerState.story = normalizeStoryState(playerState.story, playerState);
    if (playerState.story.completedEventIds.includes(event.id)) {
      return {
        success: true,
        alreadyCompleted: true,
        event: getEventView(event),
        reward: null,
        state: playerState,
      };
    }
    if (!conditionsMet(event, playerState, context)) {
      return { error: "Story event requirements are not met" };
    }

    const completed = new Set(playerState.story.completedEventIds);
    const flags = new Set(playerState.story.flags);
    const milestones = new Set(playerState.story.badgeMilestones);
    const locations = new Set(playerState.story.discoveredLocations);
    completed.add(event.id);
    (event.setFlags || []).forEach((flag) => flags.add(flag));
    if (event.badgeMilestone) milestones.add(event.badgeMilestone);
    if (event.storyLocation) locations.add(event.storyLocation);
    if (event.act) playerState.story.currentAct = Math.max(playerState.story.currentAct, event.act);
    if (event.chapter) playerState.story.currentChapter = event.chapter;
    playerState.story.completedEventIds = [...completed];
    playerState.story.flags = [...flags];
    playerState.story.badgeMilestones = [...milestones];
    playerState.story.discoveredLocations = [...locations];
    const reward = applyReward(playerState, event);

    return {
      success: true,
      alreadyCompleted: false,
      event: getEventView(event),
      reward,
      state: playerState,
    };
  }

  function getStorySnapshot(playerState = {}) {
    const story = normalizeStoryState(playerState.story, playerState);
    return {
      state: story,
      chapters: chapters.map((chapter) => ({
        ...chapter,
        active: chapter.id === story.currentChapter,
      })),
    };
  }

  return {
    chapters,
    events,
    normalizeStoryState,
    conditionsMet,
    getEligibleEvents,
    completeEvent,
    getStorySnapshot,
    hasEvent: (eventId) => eventsById.has(eventId),
  };
}

module.exports = {
  STORY_STATE_VERSION,
  createStoryEngine,
};
