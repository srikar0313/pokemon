export function getStoryMotionProfile(reducedMotion = false) {
  return reducedMotion
    ? { characterDelay: 0, sceneDelay: 0, transition: "none" }
    : { characterDelay: 18, sceneDelay: 180, transition: "cinematic" };
}

export function normalizeStoryEvent(event = {}) {
  const dialogue = (Array.isArray(event.dialogue) ? event.dialogue : [])
    .filter((line) => line && line.text)
    .map((line) => ({
      speaker: String(line.speaker || event.speaker?.name || "Story"),
      text: String(line.text),
    }));
  return {
    id: String(event.id || ""),
    title: String(event.title || "Story Event"),
    act: Math.max(1, Number(event.act) || 1),
    chapter: String(event.chapter || "act-1"),
    speaker: {
      name: String(event.speaker?.name || dialogue[0]?.speaker || "Story"),
      portrait: String(event.speaker?.portrait || "guide"),
    },
    dialogue,
    reward: event.reward || null,
    context: event.context || {},
    presentation: String(event.presentation || "story"),
    characterId: event.characterId || null,
    encounterId: event.encounterId || null,
    phase: event.phase || null,
  };
}

export function getStoryProgress(event, lineIndex = 0) {
  const total = Math.max(1, event?.dialogue?.length || 0);
  const current = Math.min(total, Math.max(1, Number(lineIndex) + 1));
  return { current, total, percent: Math.round((current / total) * 100) };
}

export function mergeStoryEventQueue(current = [], incoming = []) {
  const queuedIds = new Set(current.map((event) => event.id));
  return [
    ...current,
    ...incoming.filter((event) => event?.id && !queuedIds.has(event.id)),
  ];
}
