function getGymStoryContext(gym) {
  return {
    gymId: gym.id,
    badge: gym.badge,
  };
}

function buildDialogue(gym, phase) {
  const story = gym.story || {};
  const supporting =
    phase === "pre" ? story.supportingPrelude : story.supportingFollowup;
  const leaderText =
    phase === "pre" ? story.preBattleMessage : story.postBattleMessage;
  return [
    ...(supporting?.text
      ? [
          {
            speaker: supporting.name,
            portrait: supporting.portrait || "guide",
            text: supporting.text,
          },
        ]
      : []),
    ...(leaderText
      ? [
          {
            speaker: gym.leaderName,
            portrait: String(gym.leaderName || "").toLowerCase(),
            text: leaderText,
          },
        ]
      : []),
  ];
}

function createGymStoryEvents(gyms = []) {
  return gyms.flatMap((gym) => {
    const story = gym.story || {};
    if (!story.preBattleMessage && !story.postBattleMessage) return [];
    const act = Math.max(1, Number(story.act) || 1);
    const chapter = story.chapter || `act-${act}`;
    const portrait = String(gym.leaderName || "").toLowerCase();
    return [
      {
        id: `gym-${gym.id}-first-challenge`,
        order: 40 + gym.id * 40,
        title: story.leaderTitle || `${gym.leaderName}, ${gym.type} Leader`,
        act,
        chapter,
        triggers: ["gym-challenge"],
        oneTime: true,
        conditions: {
          gymId: gym.id,
          excludedBadges: [gym.badge],
        },
        speaker: { name: gym.leaderName, portrait },
        dialogue: buildDialogue(gym, "pre"),
        setFlags: [`gym_${gym.id}_introduced`],
        presentation: "gym",
        theme: String(gym.type || "normal").toLowerCase(),
      },
      {
        id: `gym-${gym.id}-first-victory`,
        order: 50 + gym.id * 40,
        title: `${gym.badge} Earned`,
        act,
        chapter,
        triggers: ["badge-earned", "resume"],
        oneTime: true,
        conditions: {
          badge: gym.badge,
          triggerBadge: gym.badge,
          requiredFlags: [`gym_${gym.id}_introduced`],
        },
        speaker: { name: gym.leaderName, portrait },
        dialogue: buildDialogue(gym, "post"),
        setFlags: [`gym_${gym.id}_story_complete`],
        presentation: "gym",
        theme: String(gym.type || "normal").toLowerCase(),
      },
    ].filter((event) => event.dialogue.length);
  });
}

function getGymStorySummary(gym = {}) {
  const story = gym.story || {};
  return {
    leaderTitle: story.leaderTitle || `${gym.type || "Pokemon"} Leader`,
    personality: story.personality || "A determined Gym Leader.",
    theme: story.theme || `${gym.type || "Pokemon"} mastery`,
    battleLine: story.battleLine || "Show me how your team battles together!",
    localStoryHook: story.localStoryHook || "A key stop on the League journey.",
  };
}

module.exports = {
  createGymStoryEvents,
  getGymStoryContext,
  getGymStorySummary,
};
