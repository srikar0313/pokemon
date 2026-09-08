const STATUS_PARTICLES = {
  burned: { glyph: "", className: "status-flame", count: 4 },
  poisoned: { glyph: "", className: "status-poison", count: 5 },
  badpoison: { glyph: "", className: "status-poison", count: 7 },
  paralyzed: { glyph: "", className: "status-electric", count: 5 },
  asleep: { glyph: "Z", className: "status-sleep", count: 3 },
  frozen: { glyph: "", className: "status-frost", count: 6 },
  confused: { glyph: "?", className: "status-confusion", count: 4 },
};

export function getStatusVisual(status, reducedMotion = false) {
  const config = STATUS_PARTICLES[status];
  if (!config) return null;
  return {
    ...config,
    count: reducedMotion ? Math.min(2, config.count) : config.count,
  };
}

function wait(duration) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, duration));
}

export function clearStatusParticles(target) {
  target?.querySelectorAll(".presentation-status-particles").forEach((node) => node.remove());
}

export function renderStatusParticles(target, status, reducedMotion = false) {
  if (!target) return;
  clearStatusParticles(target);
  const config = getStatusVisual(status, reducedMotion);
  if (!config) return;
  const layer = document.createElement("span");
  layer.className = `presentation-status-particles ${config.className}`;
  layer.setAttribute("aria-hidden", "true");
  for (let index = 0; index < config.count; index += 1) {
    const particle = document.createElement("i");
    particle.textContent = config.glyph;
    particle.style.setProperty("--particle-index", index);
    particle.style.setProperty("--particle-left", `${18 + (index * 23) % 68}%`);
    layer.appendChild(particle);
  }
  target.appendChild(layer);
}

export function createAbilityAnnouncement(target, text, reducedMotion = false) {
  if (!target || !text) return;
  const banner = document.createElement("span");
  banner.className = "ability-announcement";
  banner.textContent = text;
  target.appendChild(banner);
  globalThis.setTimeout?.(() => banner.remove(), reducedMotion ? 850 : 1500);
}

export function flashBattlefield(container, tone = "hit", reducedMotion = false) {
  if (!container) return;
  const flash = document.createElement("span");
  flash.className = `battlefield-flash flash-${tone}`;
  if (reducedMotion) flash.classList.add("reduced");
  container.appendChild(flash);
  globalThis.setTimeout?.(() => flash.remove(), reducedMotion ? 100 : 360);
}

export async function playCssMoveEffect(container, side, animation, reducedMotion = false) {
  if (!container || !animation) return false;
  const layer = document.createElement("span");
  layer.className = [
    "move-cinematic",
    `move-${animation.family}`,
    `move-${animation.archetype}`,
    side === "opponent" ? "from-opponent" : "from-player",
    animation.specific ? `move-special-${animation.id}` : "",
    reducedMotion ? "reduced" : "",
  ].filter(Boolean).join(" ");
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <i class="move-core"></i>
    <i class="move-wave"></i>
    <i class="move-trail"></i>
    ${Array.from({ length: reducedMotion ? 4 : 10 }, (_, index) => `<b style="--fx-index:${index}"></b>`).join("")}
  `;
  container.appendChild(layer);
  await wait(reducedMotion ? 110 : animation.duration);
  layer.remove();
  return true;
}

export async function applyCssHitReaction(target, reaction, reducedMotion = false) {
  if (!target || !reaction) return false;
  const className = `reaction-${reaction.id}`;
  target.classList.add("battle-reacting", className);
  await wait(reducedMotion ? 90 : reaction.id === "critical" ? 360 : 260);
  target.classList.remove("battle-reacting", className);
  return true;
}

export function showBattleBanner(container, text, tone = "neutral", reducedMotion = false) {
  if (!container || !text) return;
  const banner = document.createElement("span");
  banner.className = `presentation-banner banner-${tone}${reducedMotion ? " reduced" : ""}`;
  banner.textContent = text;
  container.appendChild(banner);
  globalThis.setTimeout?.(() => banner.remove(), reducedMotion ? 650 : 1250);
}

export function showProtectShield(target, reducedMotion = false) {
  if (!target) return;
  const shield = document.createElement("span");
  shield.className = `protect-shield${reducedMotion ? " reduced" : ""}`;
  shield.setAttribute("aria-hidden", "true");
  target.appendChild(shield);
  globalThis.setTimeout?.(() => shield.remove(), reducedMotion ? 180 : 700);
}

export function syncWeatherVisual(container, weather = "clear", reducedMotion = false) {
  if (!container) return;
  const current = container.dataset.presentationWeather || "clear";
  if (current === weather && container.querySelector(".weather-cinematic")) return;
  container.querySelectorAll(".weather-cinematic").forEach((node) => node.remove());
  container.classList.remove("weather-rain", "weather-sun", "weather-sandstorm", "weather-snow");
  container.dataset.presentationWeather = weather;
  if (weather === "clear") return;
  container.classList.add(`weather-${weather}`);
  const layer = document.createElement("span");
  layer.className = `weather-cinematic weather-${weather}${reducedMotion ? " reduced" : ""}`;
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = Array.from(
    { length: reducedMotion ? 8 : 22 },
    (_, index) => `<i style="--weather-index:${index}"></i>`,
  ).join("");
  container.prepend(layer);
}

export function clearPresentationLayers(container) {
  container?.querySelectorAll(
    ".move-cinematic, .weather-cinematic, .presentation-banner, .protect-shield",
  ).forEach((node) => node.remove());
}
