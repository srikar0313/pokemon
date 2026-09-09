export const BIOME_PRESENTATIONS = Object.freeze({
  forest: {
    title: "FOREST",
    subtitle: "Dense Woodland",
    atmosphere: "Leaves drift through warm shafts of light",
    particle: "leaf",
    defaultWeather: "sunny",
  },
  cave: {
    title: "CAVE",
    subtitle: "Echoing Depths",
    atmosphere: "Crystal glints cut through the dusty dark",
    particle: "mote",
    defaultWeather: "clear",
  },
  volcano: {
    title: "VOLCANO",
    subtitle: "Ember Caldera",
    atmosphere: "Heat and ash roll above the lava rock",
    particle: "ember",
    defaultWeather: "sunny",
  },
  lake: {
    title: "LAKE",
    subtitle: "Shimmering Waters",
    atmosphere: "Mist and ripples move across the quiet shore",
    particle: "droplet",
    defaultWeather: "rain",
  },
  mountain: {
    title: "MOUNTAIN",
    subtitle: "Highland Pass",
    atmosphere: "Cold wind races beneath the cloud line",
    particle: "wind",
    defaultWeather: "snow",
  },
  desert: {
    title: "DESERT",
    subtitle: "Sunscorched Expanse",
    atmosphere: "Sand drifts through waves of desert heat",
    particle: "sand",
    defaultWeather: "sandstorm",
  },
  graveyard: {
    title: "GRAVEYARD",
    subtitle: "Moonlit Memorial",
    atmosphere: "Cold fog carries faint spectral wisps",
    particle: "wisp",
    defaultWeather: "clear",
  },
});

const WORLD_WEATHER = new Set(["clear", "rain", "sunny", "sandstorm", "snow"]);

export function getTimePresentation(date = new Date()) {
  const hour = Number(date.getHours());
  if (hour >= 6 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

export function normalizeWorldWeather(weather = "clear") {
  const key = String(weather || "clear").toLowerCase();
  if (key === "sun") return "sunny";
  return WORLD_WEATHER.has(key) ? key : "clear";
}

export function getBiomePresentation(area, { timeOfDay, weather } = {}) {
  const key = String(area || "forest").toLowerCase();
  const biome = BIOME_PRESENTATIONS[key] || BIOME_PRESENTATIONS.forest;
  return {
    ...biome,
    area: key,
    timeOfDay: timeOfDay || getTimePresentation(),
    weather: normalizeWorldWeather(weather || biome.defaultWeather),
  };
}

export function resolveEncounterTransition(pokemon = {}, { trainer = false } = {}) {
  if (trainer) return "trainer";
  if (pokemon.shiny) return "shiny";
  if (["legendary", "mythical"].includes(String(pokemon.rarity).toLowerCase())) {
    return "legendary";
  }
  if (String(pokemon.rarity).toLowerCase() === "rare") return "rare";
  return "normal";
}

export function createAreaEntryPlan(area, { reducedMotion = false } = {}) {
  const biome = getBiomePresentation(area);
  return {
    kind: "area-entry",
    area: biome.area,
    title: biome.title,
    subtitle: biome.subtitle,
    duration: reducedMotion ? 220 : 1050,
  };
}

export function createEncounterTransitionPlan(
  pokemon = {},
  { trainer = false, reducedMotion = false } = {},
) {
  const kind = resolveEncounterTransition(pokemon, { trainer });
  const durationByKind = {
    normal: 360,
    rare: 560,
    shiny: 680,
    legendary: 920,
    trainer: 620,
  };
  return {
    kind,
    duration: reducedMotion ? 180 : durationByKind[kind],
    dramatic: ["shiny", "legendary", "trainer"].includes(kind),
  };
}

export function createNpcPresentation(npc = {}) {
  return {
    attention: npc.type === "trainer" ? "challenge" : "interaction",
    label: npc.type === "trainer" ? "TRAINER SPOTTED YOU" : "READY TO TALK",
    trainer: npc.type === "trainer",
  };
}

function delay(duration) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, duration));
}

function createParticleMarkup(particle, count = 18) {
  return Array.from(
    { length: count },
    (_, index) => `<i class="ambient-particle particle-${particle}" style="--particle-index:${index}"></i>`,
  ).join("");
}

export class OverworldPresentationController {
  constructor({ documentLike = globalThis.document, storage = globalThis.sessionStorage, audio } = {}) {
    this.document = documentLike;
    this.storage = storage;
    this.audio = audio;
    this.area = null;
    this.weatherByArea = new Map();
    this.active = true;
    this.reducedMotion = Boolean(audio?.settings?.reduceMotion);
    this.parallaxPanel = null;
    this.handlePointerMove = (event) => {
      const panel = this.parallaxPanel;
      if (!panel) return;
      const bounds = panel.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 8;
      const y = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 6;
      panel.style.setProperty("--parallax-x", `${x.toFixed(2)}px`);
      panel.style.setProperty("--parallax-y", `${y.toFixed(2)}px`);
    };
    this.handlePointerLeave = () => {
      this.parallaxPanel?.style.setProperty("--parallax-x", "0px");
      this.parallaxPanel?.style.setProperty("--parallax-y", "0px");
    };
  }

  setActive(active) {
    this.active = Boolean(active);
    this.audio?.setAmbientArea?.(this.active ? this.area : null);
  }

  rememberWeather(area, weather) {
    if (!area) return;
    this.weatherByArea.set(area, normalizeWorldWeather(weather));
  }

  getBiome(area = this.area) {
    return getBiomePresentation(area, {
      weather: this.weatherByArea.get(area),
    });
  }

  mount({ area, weather, timeOfDay, playEntry = false } = {}) {
    const panel = this.document?.querySelector?.(".route-map-panel");
    if (!panel || !area) return null;
    this.reducedMotion = Boolean(this.audio?.settings?.reduceMotion);
    if (this.parallaxPanel) {
      this.parallaxPanel.removeEventListener("pointermove", this.handlePointerMove);
      this.parallaxPanel.removeEventListener("pointerleave", this.handlePointerLeave);
    }
    this.parallaxPanel = panel;
    panel.querySelector?.(".route-atmosphere")?.remove();
    this.area = area;
    if (weather) this.rememberWeather(area, weather);
    const biome = getBiomePresentation(area, {
      timeOfDay,
      weather: this.weatherByArea.get(area),
    });
    const mapHead = panel.querySelector?.(".route-map-head");
    let status = panel.querySelector?.(".route-atmosphere-status");
    if (!status && mapHead) {
      status = this.document.createElement("div");
      status.className = "route-atmosphere-status";
      mapHead.insertAdjacentElement("afterend", status);
    }
    if (status) {
      status.innerHTML = `<span>${biome.subtitle}</span><strong>${biome.timeOfDay} · ${biome.weather}</strong>`;
    }
    [...panel.classList]
      .filter((name) => name.startsWith("route-time-") || name.startsWith("route-weather-"))
      .forEach((name) => panel.classList.remove(name));
    panel.classList.add(
      "premium-route",
      `route-time-${biome.timeOfDay}`,
      `route-weather-${biome.weather}`,
    );
    panel.classList.toggle("route-motion-reduced", this.reducedMotion);
    panel.style.setProperty("--parallax-x", "0px");
    panel.style.setProperty("--parallax-y", "0px");
    panel.insertAdjacentHTML(
      "afterbegin",
      `<div class="route-atmosphere atmosphere-${biome.area}" aria-hidden="true">
        <div class="atmosphere-backdrop"></div>
        <div class="ambient-particles">${createParticleMarkup(biome.particle)}</div>
        <div class="atmosphere-foreground"></div>
      </div>`,
    );
    if (!this.reducedMotion) {
      panel.addEventListener("pointermove", this.handlePointerMove);
      panel.addEventListener("pointerleave", this.handlePointerLeave);
    }
    if (this.active) this.audio?.setAmbientArea?.(area);
    if (playEntry) this.playAreaEntry(area);
    return biome;
  }

  async playAreaEntry(area, { force = false } = {}) {
    this.reducedMotion = Boolean(this.audio?.settings?.reduceMotion);
    const key = `pokemon.area-intro.${area}`;
    if (!force && this.storage?.getItem?.(key)) return { played: false, area };
    try {
      this.storage?.setItem?.(key, "1");
    } catch {
      // Session-only presentation still works when storage is unavailable.
    }
    const plan = createAreaEntryPlan(area, { reducedMotion: this.reducedMotion });
    const overlay = this.document?.createElement?.("div");
    if (!overlay || !this.document?.body) return { ...plan, played: false };
    overlay.className = `area-entry-cinematic entry-${plan.area}${this.reducedMotion ? " reduced" : ""}`;
    overlay.innerHTML = `<div><span>NEW AREA</span><strong>${plan.title}</strong><small>${plan.subtitle}</small></div>`;
    this.document.body.appendChild(overlay);
    await delay(plan.duration);
    overlay.remove();
    return { ...plan, played: true };
  }

  async playEncounterTransition({ pokemon = {}, area } = {}) {
    this.reducedMotion = Boolean(this.audio?.settings?.reduceMotion);
    const plan = createEncounterTransitionPlan(pokemon, {
      reducedMotion: this.reducedMotion,
    });
    if (area && pokemon.weather) this.rememberWeather(area, pokemon.weather);
    this.audio?.setAmbientArea?.(null);
    const overlay = this.document?.createElement?.("div");
    if (!overlay || !this.document?.body) return { ...plan, rendered: false };
    const title = plan.kind === "legendary"
      ? "A POWERFUL PRESENCE"
      : plan.kind === "shiny"
        ? "A RADIANT ENCOUNTER"
        : plan.kind === "rare"
          ? "RARE ENCOUNTER"
          : "WILD ENCOUNTER";
    overlay.className = `world-transition encounter-transition transition-${plan.kind}${this.reducedMotion ? " reduced" : ""}`;
    overlay.innerHTML = `<div class="transition-sweep"></div><div class="transition-copy"><span>${title}</span><strong>${pokemon.name || "Wild Pokemon"}</strong></div><div class="transition-particles">${createParticleMarkup(plan.kind === "shiny" ? "sparkle" : "energy", 14)}</div>`;
    this.document.body.appendChild(overlay);
    if (["shiny", "legendary"].includes(plan.kind)) {
      this.audio?.playStatus?.();
    }
    if (plan.kind === "legendary") {
      globalThis.setTimeout?.(() => this.audio?.playCry?.(pokemon), this.reducedMotion ? 40 : 330);
    }
    await delay(plan.duration);
    overlay.remove();
    return { ...plan, rendered: true };
  }

  async playTrainerTransition({ npc = {} } = {}) {
    this.reducedMotion = Boolean(this.audio?.settings?.reduceMotion);
    const plan = createEncounterTransitionPlan({}, {
      trainer: true,
      reducedMotion: this.reducedMotion,
    });
    this.audio?.setAmbientArea?.(null);
    const overlay = this.document?.createElement?.("div");
    if (!overlay || !this.document?.body) return { ...plan, rendered: false };
    overlay.className = `world-transition trainer-transition${this.reducedMotion ? " reduced" : ""}`;
    overlay.innerHTML = `<div class="trainer-alert">!</div><div class="transition-copy"><span>TRAINER CHALLENGE</span><strong>${npc.name || "Trainer"}</strong></div>`;
    this.document.body.appendChild(overlay);
    this.audio?.playUiSelect?.();
    await delay(plan.duration);
    overlay.remove();
    return { ...plan, rendered: true };
  }
}
