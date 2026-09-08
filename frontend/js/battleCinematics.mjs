export const CAPTURE_BALL_TYPES = Object.freeze([
  "standard",
  "great",
  "ultra",
  "master",
]);

export const CAPTURE_BALL_VISUALS = Object.freeze({
  standard: { label: "Poke Ball", className: "ball-standard" },
  great: { label: "Great Ball", className: "ball-great" },
  ultra: { label: "Ultra Ball", className: "ball-ultra" },
  master: { label: "Master Ball", className: "ball-master" },
});

function wait(duration) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, duration));
}

function cloneIdentity(pokemon = {}) {
  return {
    id: pokemon.id ?? null,
    speciesId: pokemon.speciesId ?? null,
    name: pokemon.name || "Pokemon",
    imageId: pokemon.imageId ?? null,
    shiny: Boolean(pokemon.shiny),
    form: pokemon.form ? structuredClone(pokemon.form) : null,
  };
}

export function normalizeCaptureBallType(ballType) {
  return CAPTURE_BALL_TYPES.includes(ballType) ? ballType : "standard";
}

export function createCaptureAnimationPlan({
  ballType = "standard",
  caught = false,
  reducedMotion = false,
  random = Math.random,
} = {}) {
  const resolvedBallType = normalizeCaptureBallType(ballType);
  const shakeCount = caught
    ? reducedMotion
      ? 1
      : 3
    : reducedMotion
      ? 0
      : Math.max(0, Math.min(2, Math.floor(random() * 3)));
  const scale = reducedMotion ? 0.32 : 1;
  const steps = [
    { id: "throw", duration: Math.round(520 * scale), audio: "throw" },
    { id: "impact", duration: Math.round(280 * scale), audio: "impact" },
    { id: "drop", duration: Math.round(360 * scale), audio: "bounce" },
    ...Array.from({ length: shakeCount }, (_, index) => ({
      id: "shake",
      index,
      duration: Math.round(360 * scale),
      audio: "shake",
    })),
    {
      id: caught ? "success" : "breakout",
      duration: Math.round((caught ? 560 : 440) * scale),
      audio: caught ? "success" : "breakout",
    },
  ];
  return {
    ballType: resolvedBallType,
    ball: CAPTURE_BALL_VISUALS[resolvedBallType],
    caught: Boolean(caught),
    restoreOpponent: !caught,
    shakeCount,
    reducedMotion: Boolean(reducedMotion),
    steps,
  };
}

export function createEvolutionAnimationPlan({
  before = {},
  after = {},
  reducedMotion = false,
} = {}) {
  const scale = reducedMotion ? 0.25 : 1;
  return {
    before: cloneIdentity(before),
    after: cloneIdentity(after),
    reducedMotion: Boolean(reducedMotion),
    phases: [
      { id: "darken", duration: Math.round(220 * scale) },
      { id: "pulse", duration: Math.round(900 * scale) },
      { id: "transform", duration: Math.round(650 * scale) },
      { id: "reveal", duration: Math.round(620 * scale) },
    ],
  };
}

export class SerialPresentationQueue {
  constructor() {
    this.items = [];
    this.active = false;
  }

  enqueue(item) {
    this.items.push(item);
    return this.items.length;
  }

  next() {
    if (this.active || !this.items.length) return null;
    this.active = true;
    return this.items.shift();
  }

  complete() {
    this.active = false;
    return this.next();
  }
}

export function restoreCaptureScene(container) {
  container?.querySelectorAll(".capture-cinematic-layer").forEach((node) => node.remove());
  const opponent = container?.querySelector(".battle-pokemon.opponent-side");
  opponent?.classList.remove("capture-absorbing", "capture-contained");
}

export async function playCaptureDomSequence({
  container,
  plan,
  audio,
} = {}) {
  if (!container || !plan) return { rendered: false, ...plan };
  restoreCaptureScene(container);
  const opponent = container.querySelector(".battle-pokemon.opponent-side");
  if (!opponent) return { rendered: false, ...plan };

  const layer = document.createElement("div");
  layer.className = `capture-cinematic-layer ${plan.ball.className}${plan.reducedMotion ? " reduced-motion" : ""}`;
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <span class="capture-flight-trail"></span>
    <span class="capture-impact-flash"></span>
    <span class="capture-ball"><i></i></span>
    <span class="capture-success-stars">${"<i></i>".repeat(plan.reducedMotion ? 3 : 9)}</span>
  `;
  container.appendChild(layer);

  try {
    for (const step of plan.steps) {
      layer.dataset.phase = step.id;
      if (step.id === "impact") opponent.classList.add("capture-absorbing");
      if (step.id === "drop") opponent.classList.add("capture-contained");
      if (step.id === "shake") {
        layer.classList.remove("capture-shaking");
        void layer.offsetWidth;
        layer.classList.add("capture-shaking");
      }
      await audio?.playCaptureCue?.(step.audio);
      await wait(step.duration);
    }
    if (!plan.caught) restoreCaptureScene(container);
    return { rendered: true, ...plan };
  } catch (error) {
    restoreCaptureScene(container);
    throw error;
  } finally {
    layer.remove();
  }
}

export async function playEvolutionDomSequence({
  container,
  plan,
  audio,
} = {}) {
  if (!container || !plan) return { rendered: false, ...plan };
  container.classList.add("active", "evolution-cinematic-running");
  const stage = container.querySelector(".evolution-sprite-stage");
  const particles = container.querySelector(".evolution-particles");
  try {
    await audio?.playEvolutionCue?.(plan.after);
    for (const phase of plan.phases) {
      container.dataset.phase = phase.id;
      [...(stage?.classList || [])]
        .filter((className) => className.startsWith("evolution-phase-"))
        .forEach((className) => stage.classList.remove(className));
      stage?.classList.add(`evolution-phase-${phase.id}`);
      if (phase.id === "reveal") particles?.classList.add("active");
      await wait(phase.duration);
    }
    container.classList.add("complete");
    return { rendered: true, ...plan };
  } catch (error) {
    container.classList.add("complete");
    return { rendered: false, error, ...plan };
  } finally {
    container.classList.remove("evolution-cinematic-running");
  }
}
